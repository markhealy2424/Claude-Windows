// Vision-based window-schedule extraction using Claude Opus 4.7 + native PDF input.
// Reads each row of a window schedule and returns a structured items array with
// dimensions, type, operation, panels, etc.
//
// Why Opus 4.7 for this (vs Sonnet for the mark detector): schedule tables are
// dense small-text tabular data where row-alignment and digit accuracy matter
// at the per-pixel level. Opus 4.7 has 2576px max image resolution (vs 1568 on
// Sonnet 4.6) and is much more careful at structured table reading. Cost is
// ~5× higher (~$0.10 per schedule vs $0.02), but schedule parsing happens
// once per project, not per click — accuracy is the right tradeoff.

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are reading a WINDOW SCHEDULE table from an architectural PDF and extracting one structured item per row.

This is a DATA TRANSCRIPTION task, not an interpretation task. The schedule is a table with clearly-labeled columns. Your job is to read each row's cells exactly as printed and return them as JSON. Accuracy matters more than speed — these values feed straight into a window-quote workflow.

==========
EXTRACTION METHOD — follow these steps in order, every time:
==========

STEP 1. Locate the WINDOW SCHEDULE.
   - Find the table whose title/header says "WINDOW SCHEDULE" (or similar).
   - Identify the column headers, typically: MARK, QTY, PANEL, WIDTH, HEIGHT, DESCRIPTION. Other columns (HEADER, WALL, etc.) may be present — ignore them.
   - Note exactly which column is WIDTH and which is HEIGHT — different architects order them differently.

STEP 2. Count the data rows.
   - The data rows are everything below the header until the table ends.
   - Count them. Remember the count. Your output will have exactly this many items.
   - Note the FIRST mark (top row) and the LAST mark (bottom row).

STEP 3. For EACH ROW, top to bottom, extract these fields:
   a. mark — the letter in the MARK column (e.g. "A", "C", "D1").
   b. quantity — the integer in the QTY column. If blank, return 0.
   c. panels — the integer in the PANEL column. Read it DIRECTLY from that column's cell. Do NOT infer panels from anywhere else. If the cell shows "1", panels=1. If "2", panels=2. If blank, return 1.
   d. width_in — the value in the WIDTH column, converted to inches (see CONVERSION RULES below). This is the per-panel width — return it as printed in the cell. Do NOT multiply or divide.
   e. height_in — the value in the HEIGHT column, converted to inches.
   f. type — read the DESCRIPTION column and normalize (see TYPE RULES).
   g. operation — read the DESCRIPTION column for swing direction ("left", "right"). MULLED is NOT an operation. If none, return "".
   h. notes — modifier words from DESCRIPTION (MULLED, EGRESS, BLACK OUT, TEMP, DUAL GLAZING) plus any remarks. Comma-separated. Empty string if none.

STEP 4. Verify before returning.
   - Count the items in your output array. It MUST equal the row count from step 2.
   - The first item's mark MUST equal the first mark from step 2.
   - The last item's mark MUST equal the last mark from step 2.
   - If any of these don't match, RE-READ the schedule and fix.

==========
CONVERSION RULES (dimensions → inches):
==========
- 3'-0"  → 36   (3×12 + 0)
- 5'-6"  → 66   (5×12 + 6)
- 2'-0"  → 24   (NOT 60. Just 24.)
- 4'-0"  → 48
- 10'-0" → 120
- 36"     → 36
- 914 mm → 36   (divide by 25.4)
- Blank or unreadable → 0

==========
TYPE RULES (DESCRIPTION → normalized lowercase type):
==========
- FIXED UNIT / Fixed / Picture / FX  → "fixed"
- CASEMENT / CSMT                     → "casement"
- SLIDING / Slider / SL               → "sliding"
- AWNING / AWN                        → "awning"
- Single Hung / Double Hung / DH      → "hung"
- Closest match if unclear; "" if truly unknown.

==========
IGNORE THE DOOR SCHEDULE.
==========
If the page contains a separate DOOR SCHEDULE table, you must NOT include any door rows. The door schedule has:
  - A DOOR / DOOR NO. column with numeric IDs (1, 2, 3, ...)
  - Header "DOOR SCHEDULE"
  - Descriptions like "EXTERIOR FRONT DOOR", "FRENCH DOOR"
The window schedule has letter codes in the MARK column. Output ONLY window-schedule rows.

==========
OUTPUT FORMAT
==========

Return ONLY this JSON object — no commentary, no text outside the JSON:

{
  "items": [
    {
      "mark": "A",
      "width_in": 120,
      "height_in": 60,
      "type": "fixed",
      "operation": "",
      "panels": 3,
      "quantity": 3,
      "notes": "Mulled"
    }
  ]
}

Every field must be present in every item, even if 0 or "". One item per WINDOW schedule row, in the same order as the rows appear top-to-bottom in the table.`;

const SCHEDULE_ITEM_SCHEMA = {
  type: "object",
  properties: {
    mark: { type: "string" },
    width_in: { type: "number" },
    height_in: { type: "number" },
    type: { type: "string" },
    operation: { type: "string" },
    panels: { type: "integer" },
    quantity: { type: "integer" },
    notes: { type: "string" },
  },
  required: ["mark", "width_in", "height_in", "type", "operation", "panels", "quantity", "notes"],
  additionalProperties: false,
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    items: { type: "array", items: SCHEDULE_ITEM_SCHEMA },
  },
  required: ["items"],
  additionalProperties: false,
};

export async function parseScheduleWithVision({ pdfPath, projectName }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const pdfBytes = await readFile(pdfPath);
  const pdfBase64 = pdfBytes.toString("base64");

  const userInstruction = `Read every row of the WINDOW SCHEDULE in the attached PDF and return the items array per the system prompt's procedure (locate table → count rows → row-by-row extraction → verify count).${projectName ? `\n\nProject: ${projectName}.` : ""}`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 16384,
    // Adaptive thinking is off by default on Opus 4.7 — enable explicitly so
    // the model reasons through dense rows before committing to JSON.
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
      // xhigh is the Opus 4.7 sweet spot — best for intelligence-sensitive
      // structured-data extraction. Higher than Sonnet's high; less thrashy
      // than max.
      effort: "xhigh",
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
          },
          { type: "text", text: userInstruction },
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

  // Post-process: clean up + derive mm
  const items = (parsed.items ?? [])
    .filter((it) => it && typeof it.mark === "string" && it.mark.trim().length > 0)
    .map((it) => {
      const wIn = Number(it.width_in) || 0;
      const hIn = Number(it.height_in) || 0;
      return {
        mark: it.mark.trim(),
        width_in: wIn || null,
        height_in: hIn || null,
        width_mm: wIn ? Math.round(wIn * 25.4) : null,
        height_mm: hIn ? Math.round(hIn * 25.4) : null,
        type: (it.type || "fixed").trim().toLowerCase(),
        operation: (it.operation || "").trim(),
        panels: Math.max(1, Math.floor(Number(it.panels) || 1)),
        quantity: Math.max(0, Math.floor(Number(it.quantity) || 0)),
        notes: (it.notes || "").trim(),
      };
    });

  return {
    items,
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
