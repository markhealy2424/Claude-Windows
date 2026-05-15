// Lead-finder agent.
//
// For each user-supplied source URL: fetch the page HTML and ask Claude to
// extract potential business leads (company + contact + a one-line "why
// this could be a good fit") in light of the user-defined business
// context. Returns one aggregated, deduped array.
//
// Uses Claude Haiku 4.5 — extraction is high-volume and cost-sensitive;
// the model is good enough for HTML → structured-data tasks and ~10x
// cheaper than Opus.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

// Hard cap on how much HTML we send per source. Most directory pages
// fit under 200KB; this protects against pathological pages and keeps
// per-source token usage bounded.
const MAX_HTML_CHARS = 180_000;

const SYSTEM_PROMPT = `You are a business-development analyst for a windows-and-doors company. The user will give you:
  1. A short paragraph of business context (region, target customer type, deal size).
  2. The HTML contents of a single webpage that may contain potential leads (a contractor directory, an architect listing, a permits portal, an association member page, etc.).

Your job is to extract LEADS — companies or individuals whose work suggests they could buy windows/doors from this business. For each lead, return:

- company: company name as it appears on the page
- contact: { name, email, phone, role } — fill in whatever the page provides; empty strings if missing
- website: company website URL if listed (otherwise "")
- whyGoodFit: one specific sentence explaining why this entity, given the business context, is a plausible lead. Cite the evidence ("specializes in luxury residential renovations", "10 active permits in the target ZIP", etc.). Do NOT write generic filler ("could be a good fit").
- qualityScore: integer 1–5 based on how strong the signal is. 5 = active project in target geography + perfect ICP. 1 = name on a list with no qualifying detail.
- rawExcerpt: a short (<200 char) verbatim snippet from the page that supports the lead.

CRITICAL RULES:
- Only return real, named entities that appear in the page. Never invent companies, contact info, or details that aren't on the page.
- If the page has no plausible leads, return an empty array. Do not pad.
- Skip the business itself, its competitors, and obvious non-customers.
- Skip placeholder / template / login / navigation content.

Return ONLY this JSON shape:

{
  "leads": [
    {
      "company": "Acme Construction",
      "contact": { "name": "Jane Doe", "email": "jane@acme.com", "phone": "555-555-5555", "role": "Owner" },
      "website": "https://acme.com",
      "whyGoodFit": "Acme advertises 'custom luxury homes in Pasadena' — direct match for the target ICP and region.",
      "qualityScore": 4,
      "rawExcerpt": "Acme Construction · Pasadena, CA · Custom luxury homes since 1998"
    }
  ]
}

No commentary outside the JSON.`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    leads: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          contact: {
            type: "object",
            properties: {
              name: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
              role: { type: "string" },
            },
            required: ["name", "email", "phone", "role"],
            additionalProperties: false,
          },
          website: { type: "string" },
          whyGoodFit: { type: "string" },
          qualityScore: { type: "integer" },
          rawExcerpt: { type: "string" },
        },
        required: ["company", "contact", "website", "whyGoodFit", "qualityScore", "rawExcerpt"],
        additionalProperties: false,
      },
    },
  },
  required: ["leads"],
  additionalProperties: false,
};

// Strip out tags and excess whitespace so we don't blow the token budget
// on <script> blobs and inline styles. Crude but effective for the dense
// directory pages we expect to see.
function htmlToText(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchSource(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20_000);
  try {
    const res = await fetch(url, {
      signal: ctl.signal,
      redirect: "follow",
      headers: {
        // Identify ourselves cleanly. Some sites block default fetch UA.
        "User-Agent": "HealyWindowsLeadFinder/1.0 (+https://healywindowsanddoors.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function extractFromSource(client, source, businessContext) {
  const html = await fetchSource(source.url);
  const text = htmlToText(html).slice(0, MAX_HTML_CHARS);
  if (!text) throw new Error("empty page");

  const userMessage = [
    `Business context:\n${businessContext || "(none provided)"}`,
    `Source: ${source.label || source.url}\nNotes: ${source.notes || "(none)"}\nURL: ${source.url}`,
    `Page contents (HTML stripped to text, truncated to ${MAX_HTML_CHARS} chars):\n\n${text}`,
  ].join("\n\n---\n\n");

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { format: { type: "json_schema", schema: RESPONSE_SCHEMA } },
    messages: [{ role: "user", content: userMessage }],
  });

  const message = await stream.finalMessage();
  const block = message.content.find((b) => b.type === "text");
  if (!block?.text) throw new Error("no JSON content in response");

  let parsed;
  try { parsed = JSON.parse(block.text); }
  catch (err) { throw new Error(`bad JSON: ${err.message}`); }

  const usage = {
    input_tokens: message.usage?.input_tokens ?? 0,
    output_tokens: message.usage?.output_tokens ?? 0,
  };
  return { leads: parsed.leads ?? [], usage };
}

function normalize(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

// Aggregate leads across sources, dedupe by normalized company name +
// website + email (any match collapses). When two records collide, keep
// the highest-quality one and merge contact info from the loser.
function dedupe(rawLeads) {
  const out = [];
  const indexByKey = new Map();
  for (const l of rawLeads) {
    const keys = [normalize(l.company), normalize(l.website), normalize(l.contact?.email)].filter(Boolean);
    let existingIdx = -1;
    for (const k of keys) {
      if (indexByKey.has(k)) { existingIdx = indexByKey.get(k); break; }
    }
    if (existingIdx < 0) {
      const idx = out.push(l) - 1;
      for (const k of keys) indexByKey.set(k, idx);
    } else {
      const existing = out[existingIdx];
      if ((Number(l.qualityScore) || 0) > (Number(existing.qualityScore) || 0)) {
        out[existingIdx] = {
          ...l,
          contact: { ...existing.contact, ...l.contact },
        };
      } else {
        existing.contact = { ...l.contact, ...existing.contact };
      }
      for (const k of keys) indexByKey.set(k, existingIdx);
    }
  }
  return out;
}

export async function runLeadsReport({ sources, businessContext }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  if (!Array.isArray(sources) || sources.length === 0) {
    return { leads: [], errors: [], sourcesQueried: 0, usage: { input_tokens: 0, output_tokens: 0 } };
  }

  const client = new Anthropic({ apiKey });
  const allLeads = [];
  const errors = [];
  let totalIn = 0;
  let totalOut = 0;

  // Sequential so we don't hammer a single source or rate-limit Claude.
  // Fast enough for a handful of URLs; can parallelize later if needed.
  for (const source of sources) {
    try {
      const { leads: srcLeads, usage } = await extractFromSource(client, source, businessContext);
      totalIn += usage.input_tokens;
      totalOut += usage.output_tokens;
      for (const l of srcLeads) allLeads.push({ ...l, source: { id: source.id, label: source.label, url: source.url } });
    } catch (err) {
      errors.push({ sourceId: source.id, label: source.label, url: source.url, message: err.message });
    }
  }

  return {
    leads: dedupe(allLeads),
    errors,
    sourcesQueried: sources.length,
    usage: { input_tokens: totalIn, output_tokens: totalOut },
  };
}
