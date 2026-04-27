// Vision-based mark detection using Claude Sonnet 4.6 with native PDF input.
// The model reads pixels (not extracted text), so it bypasses font-encoding issues
// entirely and applies the hexagon rule visually. See memory/mark_convention.md
// for the rule this prompt encodes.

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an expert at reading architectural floor plans to count window and door marks.

A WINDOW/DOOR MARK is a single uppercase letter (A–Z) or short letter+digit code (e.g. D1, A2) that is enclosed inside a HEXAGONAL symbol on the plan. Marks are placed near the windows and doors they identify.

CRITICAL COUNTING RULES — read carefully:

1. **The hexagon is the disambiguator.** Each hexagon contains exactly ONE letter. There are NEVER multiple letters inside a single hexagon.

2. **Count every hexagon.** count(letter X) = the number of hexagons that contain X. Nothing more complicated. Always return the raw hexagon count — do not attempt to collapse clusters into a smaller number on your own.

3. **Empty pages are valid.** If a page in the PDF has no hexagons (e.g., a 3rd-floor sheet with no windows placed yet), it contributes zero marks. Do not invent marks to fill in.

4. **Letters NOT inside a hexagon are NOT marks.** Ignore them entirely. Common false-positive sources you must IGNORE:
   - Grid-line labels at the page edges (architectural reference grid)
   - Room labels (BEDROOM, KITCHEN, M. BATH, GARAGE, etc.)
   - Dimension numbers and dimension callouts
   - Legend entries at the bottom of the sheet (e.g., "A. xxx", "B. xxx")
   - Sheet titles, footnote references, schedule/notes text
   - Letters that appear inside or next to a window symbol but are NOT enclosed in their own hexagon (those are panel sub-labels, not marks)

5. **Detect CLUSTERS for human verification.** A "cluster" is 3 OR MORE hexagons containing the SAME letter, positioned tightly together (immediately adjacent, touching or nearly so, with no other hexagons between them). A cluster usually represents ONE multi-panel window assembly (e.g., a 5-hexagon cluster of "G" is typically one 5-panel window, total quantity = 1), but it can also be N separate side-by-side windows. The window schedule resolves the ambiguity. Always still return the raw hexagon count in "marks" and "perPage" — the cluster info is an additional flag for the human to verify.

   - 1 standalone hexagon with letter X → just count it; not a cluster.
   - 2 adjacent hexagons of same letter (e.g., "II" or "NN") → just count them as 2; not a cluster.
   - 3+ adjacent hexagons of same letter → REPORT IT in the "clusters" array.

OUTPUT FORMAT:

Return ONLY a JSON object with this exact shape:

{
  "marks": [
    { "letter": "A", "count": 3 },
    { "letter": "B", "count": 1 }
  ],
  "perPage": [
    { "page": 1, "marks": [{ "letter": "A", "count": 3 }, { "letter": "B", "count": 1 }] },
    { "page": 2, "marks": [{ "letter": "C", "count": 2 }] }
  ],
  "clusters": [
    { "mark": "G", "page": 1, "hexagonCount": 5 }
  ],
  "detections": [
    { "mark": "A", "page": 1, "x": 25.5, "y": 38.0, "width": 3.0, "height": 3.5 }
  ]
}

Where:
- "marks" is an array of {letter, count} objects — one entry per distinct mark across all analyzed pages, with the TOTAL raw hexagon count.
- "perPage" is an array of {page, marks} objects — one entry per page analyzed (1-indexed page number), each containing the per-page {letter, count} array.
- "clusters" is an array of {mark, page, hexagonCount} objects — one entry per cluster of 3+ same-letter adjacent hexagons. Empty array if none.
- "detections" is an array of bounding boxes — ONE ENTRY PER COUNTED HEXAGON. If you counted 5 G hexagons total, you must return exactly 5 G entries in detections (one per hexagon, not one summary). The total number of detections across all marks must equal the total raw hexagon count. Each detection has:
   - "mark": the letter inside the hexagon
   - "page": 1-indexed page number where the hexagon is located
   - "x": horizontal position of the hexagon's TOP-LEFT corner, as a percentage of page width (0 = left edge, 100 = right edge)
   - "y": vertical position of the hexagon's TOP-LEFT corner, as a percentage of page height (0 = top edge, 100 = bottom edge)
   - "width": hexagon width as a percentage of page width (typically 2-5)
   - "height": hexagon height as a percentage of page height (typically 2-5)
   Be as precise as you can — these coordinates are used to highlight each hexagon on the rendered page so a human can verify your count visually.
- Only include marks with count >= 1. Do not list marks with count 0.
- Do not include any commentary, explanation, or text outside the JSON.`;

// Anthropic structured outputs don't support numerical constraints
// (minimum/maximum/multipleOf) — they're rejected at the API. Bounds are
// enforced in the parsing step below instead.
const MARK_COUNT_ITEM = {
  type: "object",
  properties: {
    letter: { type: "string" },
    count: { type: "integer" },
  },
  required: ["letter", "count"],
  additionalProperties: false,
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    marks: {
      type: "array",
      items: MARK_COUNT_ITEM,
    },
    perPage: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page: { type: "integer" },
          marks: { type: "array", items: MARK_COUNT_ITEM },
        },
        required: ["page", "marks"],
        additionalProperties: false,
      },
    },
    clusters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mark: { type: "string" },
          page: { type: "integer" },
          hexagonCount: { type: "integer" },
        },
        required: ["mark", "page", "hexagonCount"],
        additionalProperties: false,
      },
    },
    detections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          mark: { type: "string" },
          page: { type: "integer" },
          x: { type: "number" },
          y: { type: "number" },
          width: { type: "number" },
          height: { type: "number" },
        },
        required: ["mark", "page", "x", "y", "width", "height"],
        additionalProperties: false,
      },
    },
  },
  required: ["marks", "perPage", "clusters", "detections"],
  additionalProperties: false,
};

export async function detectMarksWithVision({ pdfPath, floorPageNumbers, projectName }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const client = new Anthropic({ apiKey });
  const pdfBytes = await readFile(pdfPath);
  const pdfBase64 = pdfBytes.toString("base64");

  const pages = (floorPageNumbers ?? []).map(Number).filter(Number.isFinite);
  const pageDirective = pages.length > 0
    ? `Analyze ONLY these pages of the attached PDF (1-indexed): ${pages.join(", ")}. Ignore all other pages.`
    : "Analyze every page of the attached PDF.";

  const userInstruction = `${pageDirective}

Apply the rules from the system prompt and return the JSON object with mark counts. The "perPage" keys must be the page numbers as strings (e.g. "1", "2") — only include pages you analyzed.${projectName ? `\n\nFor reference, this plan is for project: ${projectName}.` : ""}`;

  // Streaming + finalMessage for timeout safety on large PDFs.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 4096,
    // System prompt is stable across requests; cache_control on it lets repeat
    // calls reuse the cached prefix. The PDF (in messages) varies per request
    // and is not cached, which is correct.
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: RESPONSE_SCHEMA,
      },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          { type: "text", text: userInstruction },
        ],
      },
    ],
  });

  const message = await stream.finalMessage();

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock?.text) {
    throw new Error("Vision response had no text content");
  }

  let parsed;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    throw new Error(`Vision response was not valid JSON: ${err.message}\n${textBlock.text.slice(0, 200)}`);
  }

  // Convert array-of-pairs (schema-friendly) back to object-keyed shape that
  // the rest of the app expects.
  const counts = {};
  for (const { letter, count } of parsed.marks ?? []) {
    if (letter && count > 0) counts[letter] = count;
  }

  const perPage = {};
  for (const { page, marks } of parsed.perPage ?? []) {
    if (!page) continue;
    perPage[Number(page)] = {};
    for (const { letter, count } of marks ?? []) {
      if (letter && count > 0) perPage[Number(page)][letter] = count;
    }
  }

  const totalDetected = Object.values(counts).reduce((s, n) => s + Number(n || 0), 0);

  // Filter clusters to the documented threshold (3+) — model occasionally
  // emits 2-hexagon "clusters" despite the prompt instructions.
  const clusters = (parsed.clusters ?? [])
    .map((c) => ({
      mark: c.mark,
      page: Number(c.page),
      hexagonCount: Number(c.hexagonCount),
    }))
    .filter((c) => c.mark && c.page >= 1 && c.hexagonCount >= 3);

  // Per-hexagon bounding boxes (percentages of page dimensions). Filter to
  // entries that look sane — coords inside [0, 100] and non-zero size.
  const detections = (parsed.detections ?? [])
    .map((d) => ({
      mark: d.mark,
      page: Number(d.page),
      x: Number(d.x),
      y: Number(d.y),
      width: Number(d.width),
      height: Number(d.height),
    }))
    .filter((d) =>
      d.mark &&
      d.page >= 1 &&
      d.x >= 0 && d.x <= 100 &&
      d.y >= 0 && d.y <= 100 &&
      d.width > 0 && d.width <= 100 &&
      d.height > 0 && d.height <= 100
    );

  return {
    counts,
    perPage,
    clusters,
    detections,
    decoded: false,
    shift: 0,
    totalDetected,
    detector: "vision",
    model: MODEL,
    usage: {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
      cache_read_input_tokens: message.usage?.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: message.usage?.cache_creation_input_tokens ?? 0,
    },
  };
}
