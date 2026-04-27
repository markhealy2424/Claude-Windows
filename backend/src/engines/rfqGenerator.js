import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { generateSketch } from "./sketchGenerator.js";
import { totalWidthIn, totalWidthMm, heightMm } from "./dimensions.js";

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
      sketch: generateSketch(it),
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

  items.forEach((it) => {
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

    const sketch = generateSketch(it);
    try {
      SVGtoPDF(doc, sketch, x + 4, yTop + 6, { width: cols[2].w - 8, height: rowH - 12, preserveAspectRatio: "xMidYMid meet" });
    } catch {
      doc.text("(sketch err)", x + 4, yTop + 6);
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
  });

  doc.end();
}
