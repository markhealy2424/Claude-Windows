// Vision-based window-schedule extraction using Claude Sonnet 4.6 + native PDF input.
// Reads each row of a window schedule and returns a structured items array with
// dimensions, type, operation, panels, etc. Designed to be applied to existing
// project items (matched by mark) so quantity from the floor-plan mark count and
// dimensions/type from the schedule combine into a complete record.

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are reading a window schedule from an architectural PDF.

A window schedule is a table where each row describes one window mark. Common columns:
- Mark / Tag / Type / ID — the label assigned to the window (single uppercase letter or short code like A, B, D1)
- Width — horizontal dimension (e.g. 3'-0", 36", or 914 mm)
- Height — vertical dimension
- Type — window type/style (Casement, Fixed, Sliding, Awning, Hung, Picture, etc.)
- Operation — swing/slide direction (Left, Right, etc.) — may be combined with type
- Quantity — how many of this mark exist
- Panels / Lites — number of panels
- Notes / Remarks — any extra info (tempered, egress, dual glazing, etc.)

EXTRACTION RULES:

1. **One row → one item.** Skip header rows, title bars, footer notes, and any rows that don't have a mark.

2. **Convert ALL dimensions to inches.**
   - Feet-inches like "3'-0\\"" → 36 inches
   - Bare inches like "36\\"" or "36 in" → 36
   - Millimeters like "914 mm" → 36 (divide by 25.4, round to 1 decimal)
   - If you can't read the dimension or it's blank, return 0.

3. **Normalize the type field** to lowercase. Map common variations:
   - "Casement" / "CSMT" → "casement"
   - "Fixed" / "Picture" / "FX" → "fixed"
   - "Sliding" / "Slider" / "SL" → "sliding"
   - "Awning" / "AWN" → "awning"
   - "Single Hung" / "Double Hung" / "DH" → "hung"
   - If unsure, use the closest of the above. Use empty string "" only if truly unknown.

4. **Operation** is the swing direction or panel arrangement: "left", "right", "center", or empty string. If the type column already encodes operation (e.g. "Casement L"), extract it into operation.

5. **Panels** defaults to 1 unless the schedule explicitly says otherwise (look for a panels/lites column or notation like "3-LITE").

6. **Quantity** comes from the schedule's quantity column if present. If absent, return 0 (the floor-plan mark count is the authoritative source for quantity; the schedule provides dimensions/type).

7. **Notes** captures any extra info (tempered, egress, dual glazing, etc.). Keep brief; empty string if none.

OUTPUT FORMAT:

Return ONLY a JSON object with this exact shape:

{
  "items": [
    {
      "mark": "A",
      "width_in": 36,
      "height_in": 60,
      "type": "casement",
      "operation": "right",
      "panels": 1,
      "quantity": 3,
      "notes": "Tempered"
    }
  ]
}

- Always return all required fields per item, even if some are 0 or "".
- Do not include any commentary, explanation, or text outside the JSON.`;

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
