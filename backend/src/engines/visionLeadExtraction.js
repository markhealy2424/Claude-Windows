// Vision-based prospect-list extraction. Reads a PDF (or image) that lists
// business leads — conference attendee rosters, broker/builder directories,
// tradeshow exhibitor lists, CRM exports, compiled email signatures, etc.
// — and returns one structured lead record per organization found.
//
// Output is reviewed in the UI before any leads are actually created.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are reading a document that lists prospective business leads, and extracting one structured record per distinct organization/contact.

DOCUMENTS VARY WIDELY:
 - Conference attendee rosters
 - Real estate broker / builder / architect directories
 - Tradeshow exhibitor lists
 - CRM exports
 - Email signatures compiled together
 - Press releases / industry articles mentioning multiple firms

EXTRACTION METHOD:

STEP 1. Identify every prospective organization in the document. SKIP page headers/footers, page numbers, tables of contents, "About this directory" copy, ads, sponsors-of-the-event blocks, and anything that is not a specific company/contact.

STEP 2. For each lead, extract:
   a. company — exact company name as printed. Trim trailing entity types ("LLC", "Inc.") only if the rest of the entries do so consistently; otherwise keep as printed.
   b. contact_name — primary contact's full name (e.g. "Jane Doe"). Empty string if not stated.
   c. contact_email — primary email. Empty string if not stated.
   d. contact_phone — primary phone, preserving the formatting as printed. Empty string if not stated.
   e. contact_role — job title / role (e.g. "Owner", "VP Sales", "Project Architect"). Empty string if not stated.
   f. website — company website URL if listed. Strip "http(s)://" prefix; keep the bare domain. Empty string if not stated.
   g. why_good_fit — short reason this prospect is relevant ONLY IF the document explicitly says so (e.g. a "Why a fit" column, or descriptive copy). Do NOT speculate. Empty string if not explicit.
   h. raw_excerpt — a verbatim 1–3 sentence quote from the source about this company, so the human reviewer can verify the extraction. If the source is purely tabular, concatenate the row cells (e.g. "Company | Contact | Email | Phone").

STEP 3. Do NOT aggressively deduplicate. If the same company appears twice with different contacts (e.g. a sales rep and an owner), return two rows — the reviewer will merge if needed.

STEP 4. Verify before returning:
   - Every lead has at least a non-empty company OR a non-empty contact_name (drop rows that have neither).
   - You skipped every header/footer/page-number/about-the-doc block.

OUTPUT FORMAT — return ONLY this JSON:

{
  "source_doc_title": "...",
  "leads": [
    {
      "company": "Acme Architects",
      "contact_name": "Jane Doe",
      "contact_email": "jane@acme.com",
      "contact_phone": "(415) 555-1234",
      "contact_role": "Principal",
      "website": "acme.com",
      "why_good_fit": "",
      "raw_excerpt": "Jane Doe, Principal, Acme Architects — high-end residential, SF Bay Area."
    }
  ]
}

Every lead must include all fields. Use "" for missing strings. No commentary outside the JSON.`;

const LEAD_SCHEMA = {
  type: "object",
  properties: {
    company: { type: "string" },
    contact_name: { type: "string" },
    contact_email: { type: "string" },
    contact_phone: { type: "string" },
    contact_role: { type: "string" },
    website: { type: "string" },
    why_good_fit: { type: "string" },
    raw_excerpt: { type: "string" },
  },
  required: [
    "company", "contact_name", "contact_email", "contact_phone",
    "contact_role", "website", "why_good_fit", "raw_excerpt",
  ],
  additionalProperties: false,
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    source_doc_title: { type: "string" },
    leads: { type: "array", items: LEAD_SCHEMA },
  },
  required: ["source_doc_title", "leads"],
  additionalProperties: false,
};

export async function extractLeadsWithVision({ bytes, ext }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const fileBase64 = Buffer.from(bytes).toString("base64");
  const e = String(ext || "pdf").toLowerCase();

  const isImage = e === "png" || e === "jpg" || e === "jpeg" || e === "webp";
  const mediaType = ({
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  })[e] || "application/pdf";

  const sourceBlock = isImage
    ? { type: "image", source: { type: "base64", media_type: mediaType, data: fileBase64 } }
    : { type: "document", source: { type: "base64", media_type: mediaType, data: fileBase64 } };

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16384,
    thinking: { type: "adaptive" },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: {
      effort: "xhigh",
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          sourceBlock,
          { type: "text", text: "Read every prospective lead in the attached document and return the JSON per the system prompt's procedure." },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();
  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock?.text) throw new Error("Vision response had no text content");

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(`Vision response was not valid JSON: ${err.message}\n${textBlock.text.slice(0, 200)}`);
  }

  // Normalize: trim every string field, drop rows that have neither company
  // nor contact name (the model shouldn't emit them per the prompt, but be
  // defensive).
  const leads = (parsed.leads ?? [])
    .map((l) => ({
      company: String(l.company ?? "").trim(),
      contact_name: String(l.contact_name ?? "").trim(),
      contact_email: String(l.contact_email ?? "").trim(),
      contact_phone: String(l.contact_phone ?? "").trim(),
      contact_role: String(l.contact_role ?? "").trim(),
      website: String(l.website ?? "").trim(),
      why_good_fit: String(l.why_good_fit ?? "").trim(),
      raw_excerpt: String(l.raw_excerpt ?? "").trim(),
    }))
    .filter((l) => l.company || l.contact_name);

  return {
    source_doc_title: String(parsed.source_doc_title ?? "").trim(),
    leads,
    detector: "vision",
    model: MODEL,
    usage: {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    },
  };
}
