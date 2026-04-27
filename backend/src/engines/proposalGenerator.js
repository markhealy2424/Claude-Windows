import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { generateSketch } from "./sketchGenerator.js";

export function generateProposal({ items, projectName, branding = {} }) {
  const rows = items.map((it) => ({
    item: it.mark,
    qty: it.quantity,
    description: [it.type, it.operation].filter(Boolean).join(", "),
    size: `${it.width_in}" x ${it.height_in}"`,
    price: it.client_price,
    sketch: generateSketch(it),
  }));
  return { projectName, branding, rows, generatedAt: new Date().toISOString() };
}

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

export function renderProposalPdf({ items, projectName, branding = {}, totals = {} }, stream) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(stream);

  const accent = branding.color || "#111";
  const company = branding.company || "Your Company";
  const tagline = branding.tagline || "";

  doc.rect(0, 0, doc.page.width, 70).fill(accent);
  doc.fillColor("#fff").fontSize(18).text(company, 40, 22);
  if (tagline) doc.fontSize(10).text(tagline, 40, 46);
  doc.fillColor("#000");

  doc.moveDown(3);
  doc.fontSize(16).text(`Proposal — ${projectName ?? "Untitled"}`);
  doc.fontSize(9).fillColor("#666").text(new Date().toLocaleString());
  doc.moveDown(0.8).fillColor("#000");

  const cols = [
    { label: "Item", w: 40 },
    { label: "Qty", w: 30 },
    { label: "Sketch", w: 100 },
    { label: "Description", w: 130 },
    { label: "Size", w: 75 },
    { label: "Price", w: 70 },
    { label: "Line total", w: 70 },
  ];
  const xStart = doc.page.margins.left;
  const tableWidth = cols.reduce((s, c) => s + c.w, 0);
  const rowH = 80;

  function drawHeader() {
    let x = xStart;
    const y = doc.y;
    doc.rect(xStart, y, tableWidth, 18).fill("#f2f2f2").fillColor("#000");
    doc.fontSize(10).font("Helvetica-Bold");
    cols.forEach((c) => {
      doc.text(c.label, x + 4, y + 4, { width: c.w - 8 });
      x += c.w;
    });
    doc.font("Helvetica").fontSize(9);
    doc.y = y + 20;
    doc.x = xStart;
  }

  drawHeader();

  let subtotal = 0;
  items.forEach((it) => {
    if (doc.y + rowH > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      drawHeader();
    }
    const yTop = doc.y;
    let x = xStart;
    const cellText = (text, w) => {
      doc.text(String(text ?? ""), x + 4, yTop + 6, { width: w - 8, height: rowH - 12 });
    };

    const qty = Number(it.quantity ?? 1);
    const price = Number(it.client_price ?? 0);
    const lineTotal = qty * price;
    subtotal += lineTotal;

    cellText(it.mark, cols[0].w); x += cols[0].w;
    cellText(qty, cols[1].w); x += cols[1].w;

    try {
      SVGtoPDF(doc, generateSketch(it), x + 4, yTop + 6, {
        width: cols[2].w - 8, height: rowH - 12, preserveAspectRatio: "xMidYMid meet",
      });
    } catch {
      doc.text("(sketch err)", x + 4, yTop + 6);
    }
    x += cols[2].w;

    cellText([it.type, it.operation].filter(Boolean).join(", "), cols[3].w); x += cols[3].w;
    cellText(`${it.width_in}" × ${it.height_in}"`, cols[4].w); x += cols[4].w;
    cellText(money(price), cols[5].w); x += cols[5].w;
    cellText(money(lineTotal), cols[6].w);

    const yBot = yTop + rowH;
    doc.moveTo(xStart, yBot).lineTo(xStart + tableWidth, yBot).strokeColor("#ddd").stroke().strokeColor("#000");
    doc.y = yBot + 2;
    doc.x = xStart;
  });

  const delivery = Number(totals.delivery ?? 0);
  const fees = Number(totals.fees ?? 0);
  const total = Number(totals.total ?? subtotal + delivery + fees);

  doc.moveDown(1);
  const labelW = tableWidth - 100;
  const valueW = 100;
  const writeTotal = (label, amount, bold = false) => {
    if (bold) doc.font("Helvetica-Bold");
    doc.text(label, xStart, doc.y, { width: labelW, align: "right" });
    doc.text(money(amount), xStart + labelW, doc.y - doc.currentLineHeight(), { width: valueW, align: "right" });
    if (bold) doc.font("Helvetica");
  };
  writeTotal("Subtotal", subtotal);
  if (delivery) writeTotal("Delivery", delivery);
  if (fees) writeTotal("Fees", fees);
  doc.moveDown(0.3);
  writeTotal("Total", total, true);

  doc.end();
}
