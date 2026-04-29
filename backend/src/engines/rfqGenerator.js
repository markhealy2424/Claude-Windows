import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { generateSketch } from "./sketchGenerator.js";
import { totalWidthIn, totalWidthMm, heightMm } from "./dimensions.js";
import { partitionByKind } from "./itemKind.js";

// Decode an item's optional sketchImage data URL into a Buffer. Returns
// null if no override is set so callers can fall back to the auto sketch.
function sketchImageBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const m = /^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  try {
    return Buffer.from(m[1], "base64");
  } catch {
    return null;
  }
}

function dimCell(inches, mm) {
  const inPart = inches == null ? "?" : `${inches}"`;
  const mmPart = mm == null ? "" : `\n${mm} mm`;
  return inPart + mmPart;
}

export function generateRFQ({ items, projectName, info }) {
  const rows = items.map((it) => {
    const wPerPanelIn = it.width_in ?? null;
    const wPerPanelMm = wPerPanelIn != null ? Math.round(Number(wPerPanelIn) * 25.4) : null;
    return {
      mark: it.mark,
      qty: it.quantity,
      sketch: it.sketchImage || generateSketch(it),
      type: it.type,
      material: it.material ?? "Aluminum",
      width_per_panel_in: wPerPanelIn,
      width_per_panel_mm: wPerPanelMm,
      width_in: totalWidthIn(it),
      height_in: it.height_in ?? null,
      width_mm: totalWidthMm(it),
      height_mm: heightMm(it),
      panels: it.panels ?? 1,
      operation: it.operation,
      notes: it.notes ?? "",
    };
  });
  return { projectName, info: info ?? {}, rows, generatedAt: new Date().toISOString() };
}

function formatRfqDate(isoOrUndefined) {
  if (!isoOrUndefined) return "";
  const d = new Date(`${isoOrUndefined}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(isoOrUndefined);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// Mirrors frontend/src/lib/projectRequirements.js. Backend doesn't import
// from frontend, so we duplicate the small list here. Keep these in sync if
// the labels/keys ever change.
const RFQ_REQUIREMENTS = [
  { key: "dualGlazed",        label: "All windows dual glazed" },
  { key: "argonFilled",       label: "All windows argon filled" },
  { key: "thermallyBroken",   label: "All aluminum thermally broken" },
  { key: "nfrc",              label: "All windows NFRC certified" },
  { key: "aamaCertified",     label: "All windows AAMA certified" },
  { key: "modernHardware",    label: "Modern styled hardware" },
  { key: "narrowFrame",       label: "Narrow styled frame", hasSpec: true },
  { key: "retractableScreen", label: "Retractable folded screen" },
  { key: "nailFin",           label: "New construction style (with nail fin)" },
  { key: "powderCoatedBlack", label: "Powder coated black color", hasSpec: true },
];

export function renderRFQPdf({ items, projectName, info }, stream) {
  // Landscape A4 — 10 columns + sketches need the extra width.
  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 40 });
  doc.pipe(stream);

  // Title
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#000")
    .text(`Ready for Quote — ${projectName ?? "Untitled"}`);
  doc.font("Helvetica");

  // Project info block
  const safe = info ?? {};
  const dateLabel = formatRfqDate(safe.date);
  const lineY = doc.y + 6;
  doc.moveTo(doc.page.margins.left, lineY)
    .lineTo(doc.page.width - doc.page.margins.right, lineY)
    .strokeColor("#888").lineWidth(0.5).stroke().strokeColor("#000");
  doc.moveDown(0.5);

  const labelW = 75;
  function row(label, value) {
    if (!value) return;
    const y = doc.y;
    doc.fontSize(9).fillColor("#666").text(label, doc.page.margins.left, y, { width: labelW, continued: false });
    doc.fontSize(10).fillColor("#000").text(value, doc.page.margins.left + labelW, y);
  }
  row("Address", safe.address);
  row("Buyer", safe.buyerName);
  row("Company", safe.company);
  row("Date", dateLabel);

  // Requirements checklist — only render rows the user has answered
  // (yes/no). Each row prints as "Label:  Yes" with the value immediately
  // adjacent to the question so the reader's eye doesn't have to track
  // across whitespace to a right-aligned column.
  const reqs = safe.requirements ?? {};
  const answered = RFQ_REQUIREMENTS.filter((r) => reqs[r.key] === "yes" || reqs[r.key] === "no");
  if (answered.length > 0) {
    doc.moveDown(0.6);
    const startY = doc.y;
    doc.moveTo(doc.page.margins.left, startY)
      .lineTo(doc.page.width - doc.page.margins.right, startY)
      .strokeColor("#888").lineWidth(0.5).stroke().strokeColor("#000");
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000")
      .text("PROJECT REQUIREMENTS");
    doc.font("Helvetica").moveDown(0.2);

    for (const req of answered) {
      const value = reqs[req.key];
      const spec = req.hasSpec && value === "no" ? (reqs[`${req.key}Spec`] || "").trim() : "";
      const labelText = spec ? `${req.label} — ${spec}: ` : `${req.label}: `;
      doc.fontSize(9).fillColor("#000")
        .text(labelText, doc.page.margins.left, doc.y, { continued: true });
      doc.font("Helvetica-Bold")
        .fillColor(value === "yes" ? "#15623F" : "#94251A")
        .text(value === "yes" ? "Yes" : "No");
      doc.font("Helvetica").fillColor("#000");
    }
  }

  doc.moveDown(0.8);
  doc.fillColor("#000");

  const cols = [
    { key: "mark", label: "Mark", w: 38 },
    { key: "qty", label: "Qty", w: 32 },
    { key: "sketch", label: "Sketch", w: 120 },
    { key: "type", label: "Type", w: 58 },
    { key: "material", label: "Material", w: 58 },
    { key: "wpp", label: "W/Panel", w: 60 },
    { key: "width", label: "Total W", w: 60 },
    { key: "height", label: "Height", w: 60 },
    { key: "panels", label: "Panels", w: 44 },
    { key: "operation", label: "Operation", w: 60 },
    { key: "notes", label: "Notes", w: 172 },
  ];
  const xStart = doc.page.margins.left;
  const tableWidth = cols.reduce((s, c) => s + c.w, 0);
  const rowH = 80;

  function drawHeader() {
    let x = xStart;
    doc.fontSize(10).font("Helvetica-Bold");
    const headerY = doc.y;
    cols.forEach((c) => {
      doc.text(c.label, x + 4, headerY, { width: c.w - 8 });
      x += c.w;
    });
    doc.font("Helvetica").fontSize(9);
    const y = doc.y + 2;
    doc.moveTo(xStart, y).lineTo(xStart + tableWidth, y).stroke();
    doc.moveDown(0.2);
  }

  drawHeader();

  // Render a section title spanning the full table width — used to
  // separate the Windows and Doors blocks within the same RFQ table.
  function drawSectionTitle(label) {
    const titleH = 24;
    if (doc.y + titleH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const yTop = doc.y;
    doc.rect(xStart, yTop, tableWidth, titleH).fill("#f2f2f2");
    doc.fillColor("#000").font("Helvetica-Bold").fontSize(11)
      .text(label.toUpperCase(), xStart + 6, yTop + 7, { width: tableWidth - 12 });
    doc.font("Helvetica").fontSize(9);
    doc.y = yTop + titleH;
    doc.x = xStart;
  }

  const { windows: windowItems, doors: doorItems } = partitionByKind(items);
  const renderRow = (it) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const yTop = doc.y;
    let x = xStart;
    const cellText = (text, w) => {
      doc.text(String(text ?? ""), x + 4, yTop + 6, { width: w - 8, height: rowH - 12 });
    };

    const wIn = totalWidthIn(it);
    const wMm = totalWidthMm(it);
    const hMm = heightMm(it);

    cellText(it.mark, cols[0].w); x += cols[0].w;
    cellText(it.quantity, cols[1].w); x += cols[1].w;

    const customSketch = sketchImageBuffer(it.sketchImage);
    let sketchPlaced = false;
    if (customSketch) {
      try {
        doc.image(customSketch, x + 4, yTop + 6, {
          fit: [cols[2].w - 8, rowH - 12],
          align: "center",
          valign: "center",
        });
        sketchPlaced = true;
      } catch { /* fall through to auto sketch */ }
    }
    if (!sketchPlaced) {
      try {
        SVGtoPDF(doc, generateSketch(it), x + 4, yTop + 6, { width: cols[2].w - 8, height: rowH - 12, preserveAspectRatio: "xMidYMid meet" });
      } catch {
        doc.text("(sketch err)", x + 4, yTop + 6);
      }
    }
    x += cols[2].w;

    const wppIn = it.width_in ?? null;
    const wppMm = wppIn != null ? Math.round(Number(wppIn) * 25.4) : null;

    cellText(it.type, cols[3].w); x += cols[3].w;
    cellText(it.material ?? "Aluminum", cols[4].w); x += cols[4].w;
    cellText(dimCell(wppIn, wppMm), cols[5].w); x += cols[5].w;
    cellText(dimCell(wIn, wMm), cols[6].w); x += cols[6].w;
    cellText(dimCell(it.height_in, hMm), cols[7].w); x += cols[7].w;
    cellText(it.panels ?? 1, cols[8].w); x += cols[8].w;
    cellText(it.operation, cols[9].w); x += cols[9].w;
    cellText(it.notes, cols[10].w);

    const yBot = yTop + rowH;
    doc.moveTo(xStart, yBot).lineTo(xStart + tableWidth, yBot).strokeColor("#ddd").stroke().strokeColor("#000");
    doc.y = yBot + 2;
    doc.x = xStart;
  };

  if (windowItems.length > 0) {
    drawSectionTitle("Windows");
    windowItems.forEach(renderRow);
  }
  if (doorItems.length > 0) {
    drawSectionTitle("Doors");
    doorItems.forEach(renderRow);
  }

  doc.end();
}
