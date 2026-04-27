import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { generateSketch } from "./sketchGenerator.js";

export function generateRFQ({ items, projectName }) {
  const rows = items.map((it) => ({
    mark: it.mark,
    qty: it.quantity,
    sketch: generateSketch(it),
    type: it.type,
    width: it.width_in,
    height: it.height_in,
    operation: it.operation,
    notes: it.notes ?? "",
  }));
  return { projectName, rows, generatedAt: new Date().toISOString() };
}

export function renderRFQPdf({ items, projectName }, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(stream);

  doc.fontSize(18).text(`Ready for Quote — ${projectName ?? "Untitled"}`);
  doc.fontSize(9).fillColor("#666").text(new Date().toLocaleString());
  doc.moveDown(0.8).fillColor("#000");

  const cols = [
    { key: "mark", label: "Mark", w: 40 },
    { key: "qty", label: "Qty", w: 30 },
    { key: "sketch", label: "Sketch", w: 110 },
    { key: "type", label: "Type", w: 60 },
    { key: "size", label: "Size (in)", w: 70 },
    { key: "operation", label: "Operation", w: 70 },
    { key: "notes", label: "Notes", w: 135 },
  ];
  const xStart = doc.page.margins.left;
  const rowH = 80;

  function drawHeader() {
    let x = xStart;
    doc.fontSize(10).font("Helvetica-Bold");
    cols.forEach((c) => {
      doc.text(c.label, x + 4, doc.y, { width: c.w - 8 });
      x += c.w;
    });
    doc.font("Helvetica").fontSize(9);
    const y = doc.y + 2;
    doc.moveTo(xStart, y).lineTo(xStart + cols.reduce((s, c) => s + c.w, 0), y).stroke();
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

    cellText(it.mark, cols[0].w); x += cols[0].w;
    cellText(it.quantity, cols[1].w); x += cols[1].w;

    const sketch = generateSketch(it);
    try {
      SVGtoPDF(doc, sketch, x + 4, yTop + 6, { width: cols[2].w - 8, height: rowH - 12, preserveAspectRatio: "xMidYMid meet" });
    } catch {
      doc.text("(sketch err)", x + 4, yTop + 6);
    }
    x += cols[2].w;

    cellText(it.type, cols[3].w); x += cols[3].w;
    cellText(`${it.width_in}" × ${it.height_in}"`, cols[4].w); x += cols[4].w;
    cellText(it.operation, cols[5].w); x += cols[5].w;
    cellText(it.notes, cols[6].w);

    const yBot = yTop + rowH;
    doc.moveTo(xStart, yBot).lineTo(xStart + cols.reduce((s, c) => s + c.w, 0), yBot).strokeColor("#ddd").stroke().strokeColor("#000");
    doc.y = yBot + 2;
    doc.x = xStart;
  });

  doc.end();
}
