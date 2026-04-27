// Vision-based window-schedule extraction using Claude Sonnet 4.6 + native PDF input.
// Reads each row of a window schedule and returns a structured items array with
// dimensions, type, operation, panels, etc. Designed to be applied to existing
// project items (matched by mark) so quantity from the floor-plan mark count and
// dimensions/type from the schedule combine into a complete record.

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are reading a WINDOW SCHEDULE from an architectural PDF.

A window schedule is a table where each row describes one window mark. The exact column set varies by architect; common columns include:
- Mark / Tag / Type / ID — single uppercase letter or short code (A, B, D1, ...)
- Qty — how many windows of this mark exist
- Panel / Lites — number of panels in the unit
- Width — horizontal dimension (e.g. 3'-0", 36", or 914 mm)
- Height — vertical dimension
- Description / Type — window type plus modifiers (e.g. "CASEMENT, MULLED EGRESS", "FIXED UNIT, BLACK OUT")
- Notes / Remarks — any extra info (tempered, dual glazing, etc.)

The schedule may also contain Header (header height) and Wall (framing) columns. **Ignore those columns entirely** — they're not needed for downstream workflow.

CRITICAL: IGNORE THE DOOR SCHEDULE.

If the page contains BOTH a window schedule AND a door schedule (very common — they're often on the same sheet), you must extract ONLY the window schedule rows. The door schedule is identifiable by:
  - A "DOOR" or "DOOR NO." column (numeric IDs like 1, 2, 3)
  - A header that says "DOOR SCHEDULE"
  - Descriptions like "EXTERIOR FRONT DOOR", "FRENCH DOOR", "PANEL DOOR"
The window schedule is identifiable by:
  - A "MARK" column with letter codes (A, B, C, ...)
  - A header that says "WINDOW SCHEDULE"
  - Descriptions involving "FIXED", "CASEMENT", "SLIDING", etc.
DO NOT include any door schedule rows in your output.

EXTRACTION RULES:

1. **One window-schedule row → one item.** Skip the header row of the window schedule, any title bars, footer notes (e.g. "NOTES:" lists), elevation drawings, and any door-schedule rows.

2. **Convert ALL dimensions to inches.**
   - Feet-inches like 3'-0" → 36
   - Feet-inches like 5'-6" → 66 (5×12 + 6)
   - Bare inches like 36" or 36 in → 36
   - Millimeters like 914 mm → 36 (divide by 25.4, round to 1 decimal)
   - If a cell is blank or unreadable, return 0.

3. **Normalize the type field** to lowercase from the description column:
   - "FIXED UNIT" / "Fixed" / "Picture" / "FX" → "fixed"
   - "CASEMENT" / "CSMT" → "casement"
   - "SLIDING" / "Slider" / "SL" → "sliding"
   - "AWNING" / "AWN" → "awning"
   - "Single Hung" / "Double Hung" / "DH" → "hung"
   - If unsure, use the closest of the above. Use empty string "" only if truly unknown.

4. **operation** captures swing direction if explicitly stated ("left", "right"). The "MULLED" modifier is NOT an operation — it goes in notes. If no swing direction is given, return "".

5. **panels** comes from the Panel/Lites column. Default to 1 if absent.

6. **quantity** comes from the Qty column. If absent or blank, return 0 (the floor-plan mark count is the authoritative source for quantity; the schedule provides dimensions/type).

7. **notes** captures every modifier word from the description column AND any other remarks. Keep short and comma-separated. Common modifiers to capture:
   - MULLED — multiple panels joined as one assembly
   - EGRESS — meets emergency egress requirements
   - BLACK OUT — no light passes (often shower/bathroom)
   - TEMP / TEMPERED — tempered glass
   - DUAL GLAZING / DG
   So a description like "CASEMENT, MULLED EGRESS" → type: "casement", notes: "Mulled, Egress".

OUTPUT FORMAT:

Return ONLY a JSON object with this exact shape:

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

- Every required field must appear in every item, even if the value is 0 or "".
- One item per WINDOW schedule row. Do not include door rows.
- Do not include commentary, explanation, or text outside the JSON.`;

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

  const userInstruction = `Read every row of the window schedule in the attached PDF and return the items array per the system prompt's rules.${projectName ? `\n\nProject: ${projectName}.` : ""}`;

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    output_config: {
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
