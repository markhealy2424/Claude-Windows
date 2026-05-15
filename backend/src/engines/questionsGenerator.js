import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { generateSketch } from "./sketchGenerator.js";
import { isDoor } from "./itemKind.js";

// Renders a "Questions for Client" PDF — one section per flagged item
// with a sketch, identity, the user's question, and an area for the
// client's response. Intended to be sent (printed or emailed) to the
// client so they can review and answer each open item.

function sketchImageBuffer(dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const m = /^data:image\/(?:png|jpeg|jpg|webp);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  try { return Buffer.from(m[1], "base64"); }
  catch { return null; }
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function metaLine(item) {
  const parts = [
    item.width_in ? `${item.width_in}"W` : null,
    item.height_in ? `${item.height_in}"H` : null,
    item.panels && item.panels > 1 ? `${item.panels} panels` : null,
    item.quantity > 0 ? `Qty ${item.quantity}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function renderQuestionsPdf({ items, projectName, info }, stream) {
  const flagged = (items ?? []).filter((it) => it && it.needsAttention);

  const margin = 48;
  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin, bufferPages: true });
  doc.pipe(stream);

  const pageW = doc.page.width;
  const usableW = pageW - margin * 2;
  const xStart = margin;

  // ── Header ───────────────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#000")
    .text("Questions for Client", { width: usableW });
  doc.moveDown(0.1);
  doc.font("Helvetica").fontSize(13).fillColor("#444")
    .text(projectName || "Untitled project", { width: usableW });
  doc.fillColor("#000");

  // Divider
  let lineY = doc.y + 6;
  doc.moveTo(xStart, lineY).lineTo(xStart + usableW, lineY)
    .strokeColor("#888").lineWidth(0.5).stroke().strokeColor("#000");
  doc.moveDown(0.6);

  // Project info rows
  const labelW = 70;
  const safe = info ?? {};
  function metaRow(label, value) {
    if (!value) return;
    const y = doc.y;
    doc.fontSize(9).fillColor("#666").text(label, xStart, y, { width: labelW });
    doc.fontSize(10).fillColor("#000").text(value, xStart + labelW, y, { width: usableW - labelW });
  }
  metaRow("Address", safe.address);
  metaRow("Buyer", safe.buyerName);
  metaRow("Company", safe.company);
  metaRow("Date", fmtDate(safe.date));
  metaRow("Items", `${flagged.length} flagged for confirmation`);

  doc.moveDown(0.8);

  // Empty state — still produce a valid PDF if nothing is flagged.
  if (flagged.length === 0) {
    doc.fontSize(11).fillColor("#666")
      .text("No items are currently flagged for confirmation.", { width: usableW });
    doc.end();
    return;
  }

  // Lead-in paragraph
  doc.fontSize(10).fillColor("#333").text(
    "Each window and door below needs your confirmation before we place the order. " +
    "Please review the question for each item and provide a response in the space provided.",
    { width: usableW, lineGap: 1 }
  );
  doc.fillColor("#000");
  doc.moveDown(1);

  // ── Per-item blocks ──────────────────────────────────────────────
  const sketchSize = 96;
  const responseMinH = 60;

  for (let i = 0; i < flagged.length; i++) {
    const item = flagged[i];
    renderItemBlock(doc, item, { xStart, usableW, sketchSize, responseMinH, margin });
    // Spacing between items
    if (i < flagged.length - 1) doc.moveDown(0.6);
  }

  // ── Footer with page numbers ────────────────────────────────────
  const pageCount = doc.bufferedPageRange().count;
  for (let p = 0; p < pageCount; p++) {
    doc.switchToPage(p);
    const footerY = doc.page.height - margin / 2 - 6;
    doc.fontSize(8).fillColor("#888").text(
      `${projectName || "Project"} · Questions for Client · Page ${p + 1} of ${pageCount}`,
      xStart, footerY, { width: usableW, align: "center", lineBreak: false }
    );
  }

  doc.end();
}

function renderItemBlock(doc, item, opts) {
  const { xStart, usableW, sketchSize, responseMinH, margin } = opts;

  // Measure the block height up-front so we can decide whether to push
  // it onto a new page. Heights are based on a fixed sketch row + the
  // question text height + the response box (or its filled contents).
  const headerH = sketchSize + 8;
  const questionText = (item.clientQuestion ?? "").trim();
  const responseText = (item.clientResponse ?? "").trim();

  const questionLabelH = 14;
  const questionBoxPad = 8;
  doc.fontSize(11);
  const questionTextH = questionText
    ? Math.max(20, doc.heightOfString(questionText, { width: usableW - questionBoxPad * 2 }))
    : 28; // empty → placeholder line height
  const questionH = questionLabelH + questionTextH + questionBoxPad * 2 + 4;

  const responseTextH = responseText
    ? Math.max(responseMinH, doc.heightOfString(responseText, { width: usableW - questionBoxPad * 2 }))
    : responseMinH;
  const responseH = questionLabelH + responseTextH + questionBoxPad * 2 + 4;

  const blockH = headerH + questionH + responseH + 8;

  // Page-break if this block won't fit.
  if (doc.y + blockH > doc.page.height - margin) {
    doc.addPage();
  }

  const blockYTop = doc.y;

  // ── Header row: sketch + identity ──
  const headerYTop = blockYTop;
  drawSketch(doc, item, xStart, headerYTop, sketchSize);

  const identX = xStart + sketchSize + 14;
  const identW = usableW - sketchSize - 14;
  const kindLabel = isDoor(item) ? "Door" : "Window";

  doc.fontSize(9).fillColor("#666").font("Helvetica-Bold")
    .text(`${kindLabel.toUpperCase()} · ${(item.type || "").toUpperCase() || "—"}`,
      identX, headerYTop + 2, { width: identW, characterSpacing: 0.6, lineBreak: false });
  doc.fontSize(22).fillColor("#000").font("Helvetica-Bold")
    .text(item.mark || "(no mark)", identX, headerYTop + 14, { width: identW, lineBreak: false });
  doc.fontSize(10).fillColor("#444").font("Helvetica")
    .text(metaLine(item) || "—", identX, headerYTop + 42, { width: identW });
  if (item.notes) {
    doc.fontSize(9).fillColor("#888")
      .text(`Existing notes: ${item.notes}`, identX, headerYTop + 60, { width: identW });
  }

  doc.fillColor("#000");

  let cursorY = headerYTop + sketchSize + 8;

  // ── Question box ──
  cursorY = drawLabeledBox(doc, {
    label: "Question",
    text: questionText,
    placeholder: "(No question entered.)",
    xStart, usableW, yTop: cursorY,
    minTextH: 20,
    bg: "#FFFCEF",
    borderColor: "#C68B00",
  });

  cursorY += 6;

  // ── Response box ──
  cursorY = drawLabeledBox(doc, {
    label: "Response from client",
    text: responseText,
    placeholder: "",  // blank lines when empty so the recipient can write
    xStart, usableW, yTop: cursorY,
    minTextH: responseMinH,
    bg: "#FFFFFF",
    borderColor: "#888",
    drawLines: !responseText,
  });

  doc.y = cursorY + 4;
  doc.x = xStart;
}

function drawSketch(doc, item, x, y, size) {
  // Item-card frame so the sketch sits in a defined box even when blank.
  doc.save();
  doc.rect(x, y, size, size).fillAndStroke("#FFFFFF", "#bbb");
  doc.restore();

  const pad = 6;
  const inner = size - pad * 2;
  const customBuf = sketchImageBuffer(item.sketchImage);

  if (customBuf) {
    try {
      doc.image(customBuf, x + pad, y + pad, {
        fit: [inner, inner], align: "center", valign: "center",
      });
      return;
    } catch { /* fall through to auto */ }
  }
  try {
    SVGtoPDF(doc, generateSketch(item), x + pad, y + pad, {
      width: inner, height: inner, preserveAspectRatio: "xMidYMid meet",
    });
  } catch {
    doc.fontSize(9).fillColor("#999")
      .text("(sketch unavailable)", x + pad, y + size / 2 - 6, { width: inner, align: "center" });
  }
}

function drawLabeledBox(doc, opts) {
  const { label, text, placeholder, xStart, usableW, yTop, minTextH, bg, borderColor, drawLines } = opts;
  const labelH = 14;
  const pad = 8;

  doc.fontSize(9).fillColor("#666").font("Helvetica-Bold")
    .text(label.toUpperCase(), xStart, yTop, { characterSpacing: 0.6, lineBreak: false });
  doc.font("Helvetica");

  const boxYTop = yTop + labelH;
  const innerW = usableW - pad * 2;
  doc.fontSize(11);
  const textH = text
    ? Math.max(minTextH, doc.heightOfString(text, { width: innerW }))
    : minTextH;
  const boxH = textH + pad * 2;

  // Box background + border
  doc.save();
  doc.rect(xStart, boxYTop, usableW, boxH).fillAndStroke(bg, borderColor);
  doc.restore();

  if (text) {
    doc.fontSize(11).fillColor("#000")
      .text(text, xStart + pad, boxYTop + pad, { width: innerW });
  } else if (placeholder) {
    doc.fontSize(10).fillColor("#aaa")
      .text(placeholder, xStart + pad, boxYTop + pad, { width: innerW });
  } else if (drawLines) {
    // Empty response — render writing lines so the recipient can fill it
    // out on paper.
    doc.save();
    doc.strokeColor("#ccc").lineWidth(0.5);
    const lineGap = 18;
    let ly = boxYTop + pad + lineGap;
    while (ly < boxYTop + boxH - 4) {
      doc.moveTo(xStart + pad, ly).lineTo(xStart + usableW - pad, ly).stroke();
      ly += lineGap;
    }
    doc.restore();
  }
  doc.fillColor("#000");

  return boxYTop + boxH;
}
