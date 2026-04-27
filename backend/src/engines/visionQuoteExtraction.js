// Vision-based supplier-quote extraction. Uses Claude Opus 4.7 for the
// highest accuracy on dense quote tables (suppliers vary wildly in format).
// Returns a structured array of items the discrepancy engine can compare
// against the project's RFQ items.
//
// Item shape returned (per row):
//   { mark, quantity, type, width_in, height_in, material, glass,
//     ext_color, int_color, thickness, profile, unit_price_usd,
//     total_price_usd, notes }

import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";

const MODEL = "claude-opus-4-7";

const SYSTEM_PROMPT = `You are reading a SUPPLIER QUOTE (a.k.a. proforma invoice / quotation) for a window/door order, and extracting one structured item per quoted product.

Supplier formats vary widely. Two common shapes:

FORMAT A — Wanjia / "Drawing + Model + Description" style:
  - MODEL column with letter codes (A, B, C, ... O1, O2, ...) or numeric IDs (2, 3, 7) for doors
  - PRODUCT NAME embedded in description (e.g. "Aluminum 91 Series Thermal Break Fixed Window")
  - Dimensions given as BOTH inches AND mm in separate columns
  - Per-row spec rows underneath: Material, Thickness, Color, Glass type, Open style, Hardware
  - Unit price + Total price columns

FORMAT B — Greensee / Tabular style:
  - ITEM column with letter codes, sometimes with a digit suffix (G1, G2, L1, L2, N1, N2 for orientation variants) or door prefix (D8, D10, D11, D13)
  - PRODUCT column (e.g. "GAW75ZWK", "GAD122TLM") — supplier's own SKU, ignore
  - OPEN TYPE column with the window type ("Fixed window", "Casement window", "Sliding window", "Top-hung window", "Awning window", "Sliding door")
  - SPEC column with multi-line text containing Opening type, Color, Aluminum Alloy Profile, Glass Config (often includes orientation in parens like "Casement window(Right)" or "Sliding door (4 panels)")
  - QUANTITY (set), Width(mm), Length(mm) — height is in the LENGTH column, dimensions are mm-only
  - Total Area + TOTAL EXW (USD) — only TOTAL price shown, no per-unit. Derive unit price as total / quantity.
  - Subtotal / Package Cost / Total EXW Amount rows at the very bottom — SKIP these.

EXTRACTION METHOD — follow these steps in order:

STEP 1. Identify every quoted product in the document. Each row/block describes one product (one mark). SKIP: page footers, page numbers, header rows, totals, subtotals, package cost, terms & conditions, bank info, payment info, signature blocks, remarks.

STEP 2. For each product, extract:
   a. mark — the model/item identifier exactly as printed. Preserve case and any digit suffix:
        "A", "B", "C" — simple marks
        "O1", "O2", "G1", "G2", "L1", "L2", "N1", "N2" — variants (KEEP the digit suffix)
        "2", "3", "7", "11", "20" — numeric door marks
        "D8", "D10", "D11" — door marks with D prefix
   b. quantity — integer from the QTY / Quantity column.
   c. width_in — width converted to inches. If "Width(mm)" or only mm shown, divide by 25.4 and round to nearest integer (e.g. 914 mm → 36, 1828.8 mm → 72, 533.4 mm → 21).
   d. height_in — height/length converted to inches. The HEIGHT column may be labeled "Length", "Height", or "H".
   e. type — normalize the window/door type to one of:
        "fixed"          ← "Fixed window", "Picture", "FX", "Fixed window (circle)"
        "casement"       ← "Casement window", "CSMT" (any orientation)
        "sliding"        ← "Sliding window", "Slider"
        "awning"         ← "Awning window", "Top-hung window" (top-hung IS awning, normalize to awning)
        "hung"           ← "Single Hung", "Double Hung"
        "folding-door"   ← "Folding Door"
        "casement-door"  ← "Casement Door"
        "sliding-door"   ← "Sliding door"
      Choose the closest match. Empty string only if truly unrecognizable.
   f. operation — swing direction if the spec says "(Right)" / "(Left)" (Format B) or "Open to outside" / "Open to inside" / "Fold to outside". One of: "left", "right", "in", "out", "" (empty if not specified).
   g. material — "Aluminum" if the product mentions "Aluminum" or "Aluminium" anywhere (most do). Else infer ("Iron", "Wood"), else "". Include the construction descriptor when stated, e.g. "Thermally Broken, Aluminum".
   h. glass — full glass build-up exactly as stated, e.g.
        "6mm Low E + 20A + Warm edge spacer + Argon gas + 6mm Low E, Double Tempered Glass"
        "Double Tempered Low-E Glass with Argon"
        Include thicknesses, low-E layers, spacer type, gas fill, tempered/laminated callouts. Empty string if not stated.
   i. ext_color — exterior color/finish as stated (e.g. "Matte Black, Powder Coating", "RAL 9005 Matte Black"). Empty string if not stated.
   j. int_color — interior color/finish. If the supplier states a single color for both, repeat it for both ext_color and int_color. Empty string if not stated.
   k. thickness — frame/profile wall thickness as stated (e.g. "1.4mm", "1.6mm", "2.0mm"). Look in the "Thickness" row under Format A or in the SPEC column under Format B. Empty string if not stated.
   l. profile — aluminum alloy profile / system name as stated. Common shapes:
        "Aluminum 91 Series Thermal Break"   (Format A — series name from product description)
        "GAW75ZWK", "GAD122TLM"               (Format B — supplier SKU code under PRODUCT column)
        "6063-T5", "6063-T6"                  (alloy designations)
      Capture exactly as printed. Empty string if not stated.
   m. unit_price_usd — unit price as a number. If only TOTAL is shown (Format B), divide total by quantity. 0 if not listed.
   n. total_price_usd — total price as a number, no currency symbol or commas. 0 if not listed.
   o. notes — short comma-separated list of remaining spec callouts NOT already captured above (e.g. "Grid", "Screen", "Argon" if not in glass field, shape "Circle"). Skip boilerplate. Empty string if nothing notable.

STEP 3. Pull supplier metadata (use empty string "" or 0 if not visible):
   - supplier — supplier company name from the top of the doc
   - invoice_number — invoice/quote/quotation number if shown
   - invoice_date — ISO YYYY-MM-DD if derivable, otherwise as-printed
   - total_quantity — sum from totals block if shown
   - total_price_usd — grand total / Total EXW Amount if shown

STEP 4. Verify before returning:
   - Did you skip every Subtotal / Package Cost / Total row? They are NOT items.
   - Does items.length equal the number of distinct products you saw?
   - Did you preserve every digit suffix on marks (G1 ≠ G, O1 ≠ O)?

OUTPUT FORMAT — return ONLY this JSON:

{
  "supplier": "Foshan Wanjia Window and Door Co., Ltd",
  "invoice_number": "WJ20260420-4",
  "invoice_date": "2026-04-20",
  "total_quantity": 44,
  "total_price_usd": 35921.29,
  "items": [
    {
      "mark": "A",
      "quantity": 2,
      "width_in": 144,
      "height_in": 120,
      "type": "fixed",
      "operation": "",
      "material": "Thermally Broken, Aluminum",
      "glass": "6mm Low E + 20A + Warm edge spacer + Argon gas + 6mm Low E, Double Tempered Glass",
      "ext_color": "Matte Black, Powder Coating",
      "int_color": "Matte Black, Powder Coating",
      "thickness": "1.4mm",
      "profile": "Aluminum 91 Series Thermal Break",
      "unit_price_usd": 1868.99,
      "total_price_usd": 3737.98,
      "notes": "Grid"
    }
  ]
}

Every item must include all fields. Use 0 for missing numbers and "" for missing strings. No commentary outside the JSON.`;

const ITEM_SCHEMA = {
  type: "object",
  properties: {
    mark: { type: "string" },
    quantity: { type: "integer" },
    width_in: { type: "number" },
    height_in: { type: "number" },
    type: { type: "string" },
    operation: { type: "string" },
    material: { type: "string" },
    glass: { type: "string" },
    ext_color: { type: "string" },
    int_color: { type: "string" },
    thickness: { type: "string" },
    profile: { type: "string" },
    unit_price_usd: { type: "number" },
    total_price_usd: { type: "number" },
    notes: { type: "string" },
  },
  required: [
    "mark", "quantity", "width_in", "height_in", "type", "operation",
    "material", "glass", "ext_color", "int_color", "thickness", "profile",
    "unit_price_usd", "total_price_usd", "notes",
  ],
  additionalProperties: false,
};

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    supplier: { type: "string" },
    invoice_number: { type: "string" },
    invoice_date: { type: "string" },
    total_quantity: { type: "integer" },
    total_price_usd: { type: "number" },
    items: { type: "array", items: ITEM_SCHEMA },
  },
  required: ["supplier", "invoice_number", "invoice_date", "total_quantity", "total_price_usd", "items"],
  additionalProperties: false,
};

export async function extractSupplierQuoteWithVision({ filePath }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });
  const fileBytes = await readFile(filePath);
  const fileBase64 = fileBytes.toString("base64");
  const ext = filePath.split(".").pop().toLowerCase();

  const isImage = ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp";
  const mediaType = ({
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  })[ext] || "application/pdf";

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
          { type: "text", text: "Read every quoted item in the attached supplier quote and return the JSON per the system prompt's procedure." },
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

  const items = (parsed.items ?? [])
    .filter((it) => it && typeof it.mark === "string" && it.mark.trim().length > 0)
    .map((it) => ({
      mark: it.mark.trim(),
      quantity: Math.max(0, Math.floor(Number(it.quantity) || 0)),
      width_in: Number(it.width_in) || null,
      height_in: Number(it.height_in) || null,
      type: (it.type || "").trim().toLowerCase(),
      operation: (it.operation || "").trim().toLowerCase(),
      material: (it.material || "").trim() || "Aluminum",
      glass: (it.glass || "").trim(),
      ext_color: (it.ext_color || "").trim(),
      int_color: (it.int_color || "").trim() || (it.ext_color || "").trim(),
      thickness: (it.thickness || "").trim(),
      profile: (it.profile || "").trim(),
      unit_price_usd: Number(it.unit_price_usd) || 0,
      total_price_usd: Number(it.total_price_usd) || 0,
      notes: (it.notes || "").trim(),
    }));

  return {
    supplier: (parsed.supplier || "").trim(),
    invoice_number: (parsed.invoice_number || "").trim(),
    invoice_date: (parsed.invoice_date || "").trim(),
    total_quantity: Number(parsed.total_quantity) || 0,
    total_price_usd: Number(parsed.total_price_usd) || 0,
    items,
    detector: "vision",
    model: MODEL,
    usage: {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    },
  };
}
