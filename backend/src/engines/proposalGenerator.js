import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSketch } from "./sketchGenerator.js";
import { totalWidthIn } from "./dimensions.js";

// Bundled cover banner + small per-page header logo. Resolved once at module
// load; if either is missing we fall back to the drawn brand-mark block so
// the PDF still renders.
const __dirname = dirname(fileURLToPath(import.meta.url));
const COVER_BANNER_PATH = resolve(__dirname, "../../assets/cover-banner.png");
const COVER_BANNER_AVAILABLE = existsSync(COVER_BANNER_PATH);
const HEADER_LOGO_PATH = resolve(__dirname, "../../assets/header-logo.png");
const HEADER_LOGO_AVAILABLE = existsSync(HEADER_LOGO_PATH);
// Source image is 750 × 416 (logo crest + "A1 CONSTRUCTION & DESIGNS INC." text).
const HEADER_LOGO_ASPECT = 750 / 416;

const ACCENT = "#B85C38";
const RED = "#C0392B";
const BORDER = "#888";
const SUBTLE = "#666";
const ROW_TINT = "#fafafa";
const HEADER_TINT = "#f2f2f2";

const DEFAULT_EXT_COLOR = "Matte Black, Powder Coating";
const DEFAULT_INT_COLOR = "Matte Black, Powder Coating";
const DEFAULT_GLASS =
  "6mm Low E (Interior) +20A+Warm edge spacer+Argon gas+ 6mm Low E (Exterior), Double Tempered Glass";
const DEFAULT_WHO_WE_ARE =
  "Every project is approached with strong logistics, careful preparation, and a customer-first mindset to ensure a smooth and dependable process from start to finish. Our philosophy is simple: deliver refined products, thoughtful service, and results that reflect true craftsmanship. We are committed to helping our customers feel confident in every choice, with clear communication, organized planning, and a dedication to excellence at every step.";
const DEFAULT_WHAT_WE_BELIEVE =
  "We take pride in providing windows and doors that meet respected industry standards for performance, durability, and efficiency. All of our windows are NFRC certified and AAMA certified, reinforcing our dedication to dependable quality and proven excellence. We stand behind the products we offer and the level of care we bring to every order, backed by a 20 year warranty for every customer.";

const TYPE_NAMES = {
  fixed: "Fixed Window",
  casement: "Casement Window",
  awning: "Awning Window",
  hopper: "Hopper Window",
  hung: "Hung Window",
  "double-hung": "Double Hung Window",
  sliding: "Sliding Window",
  slider: "Slider Window",
  "sliding-door": "Sliding Door",
  "bifold-door": "Bi-Fold Door",
  "single-hinged-door": "Single-Hinged Door",
  "double-hinged-door": "Double-Hinged Door",
  // Legacy: "folding-door" was the original Bi-Fold slug.
  "folding-door": "Bi-Fold Door",
};

function typeDisplayName(item) {
  const t = (item.type || "").toLowerCase();
  // French door label switches based on panel count for both the new
  // explicit "french-door" slug and the legacy "casement-door" slug that
  // earlier extractions / project items may still carry.
  if (t === "french-door" || t === "casement-door") {
    return Number(item.panels ?? 1) >= 2 ? "Double French Door" : "French Door";
  }
  if (TYPE_NAMES[t]) return TYPE_NAMES[t];
  if (!t) return "Window";
  return t.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

function inchStr(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "?";
  const r = Math.round(n * 100) / 100;
  return `${r}"`;
}

function totalSqFt(w, h) {
  const W = Number(w);
  const H = Number(h);
  if (!Number.isFinite(W) || !Number.isFinite(H)) return null;
  return (W * H) / 144;
}

function roughOpening(w, h) {
  const W = Number(w);
  const H = Number(h);
  if (!Number.isFinite(W) || !Number.isFinite(H)) return "?";
  const fmt = (v) => {
    const r = Math.round(v * 10) / 10;
    return `${r}`;
  };
  return `${fmt(W + 0.5)}"x${fmt(H + 0.5)}"`;
}

function buildContext(branding = {}, info = {}, totals = {}) {
  return {
    margin: 36,
    accent: branding.color || ACCENT,
    company: branding.company || info.company || "Healy Windows and Doors",
    companyAddress: branding.companyAddress || "",
    companyPhone: branding.companyPhone || "",
    customerName: branding.customerName || info.buyerName || "",
    quoteNumber: branding.quoteNumber || "",
    siteAddress: branding.siteAddress || info.address || "",
    extColor: branding.extColor || DEFAULT_EXT_COLOR,
    intColor: branding.intColor || DEFAULT_INT_COLOR,
    glassSpec: branding.glassSpec || DEFAULT_GLASS,
    deliveryCharge: Number(branding.deliveryCharge ?? totals.delivery ?? 0),
    // Cover copy is fixed company boilerplate — same on every proposal.
    whoWeAre: DEFAULT_WHO_WE_ARE,
    whatWeBelieve: DEFAULT_WHAT_WE_BELIEVE,
  };
}

function drawBrandMark(doc, x, y, size, ctx) {
  doc.save();
  doc.roundedRect(x, y, size, size, Math.max(6, size / 8)).fill(ctx.accent);
  doc
    .fillColor("#fff")
    .font("Helvetica-Bold")
    .fontSize(size * 0.55)
    .text((ctx.company.charAt(0) || "H").toUpperCase(), x, y + size * 0.18, {
      width: size,
      align: "center",
    });
  doc.restore();
  doc.fillColor("#000");
}

// Header bar drawn at the top of every detail / summary / signature page.
// Returns the y-coordinate just below the header so callers can lay out content.
function drawPageHeader(doc, ctx) {
  const { margin } = ctx;
  const pageW = doc.page.width;
  const x0 = margin;
  const y0 = margin;
  const w = pageW - margin * 2;
  const headerH = 90;

  doc.lineWidth(1).strokeColor("#000").rect(x0, y0, w, headerH).stroke();

  // Logo on the left. Scale the bundled PNG to fit the header bar while
  // preserving its 750×416 aspect ratio. Falls back to the H brand mark if
  // the asset is missing from the deploy.
  const logoBoxH = headerH - 16;
  const logoBoxW = Math.min(140, Math.round(logoBoxH * HEADER_LOGO_ASPECT));
  const logoX = x0 + 12;
  const logoY = y0 + (headerH - logoBoxH) / 2;
  if (HEADER_LOGO_AVAILABLE) {
    doc.image(HEADER_LOGO_PATH, logoX, logoY, {
      fit: [logoBoxW, logoBoxH],
      align: "center",
      valign: "center",
    });
  } else {
    const brandSize = 60;
    drawBrandMark(doc, logoX, y0 + (headerH - brandSize) / 2, brandSize, ctx);
  }

  // Vertical divider just to the right of the logo
  const divX = logoX + logoBoxW + 14;
  doc
    .strokeColor("#000")
    .lineWidth(0.8)
    .moveTo(divX, y0 + 10)
    .lineTo(divX, y0 + headerH - 10)
    .stroke();

  // Center column: company name + tagline + address + phone. Each line uses
  // an explicit doc.y advance so wrapping never overlaps the next line.
  const rightStart = x0 + w * 0.66;
  const centerX = divX + 12;
  const centerW = rightStart - centerX - 12;

  let cy = y0 + 10;
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(13)
    .text(ctx.company, centerX, cy, { width: centerW, align: "center" });
  cy = doc.y + 6;

  doc.font("Helvetica").fontSize(9).fillColor("#000");
  if (ctx.companyAddress) {
    doc.text(ctx.companyAddress, centerX, cy, { width: centerW, align: "center" });
    cy = doc.y + 1;
  }
  if (ctx.companyPhone) {
    doc.text(ctx.companyPhone, centerX, cy, { width: centerW, align: "center" });
  }

  // Right column: Address of Build (project site) + Quote #
  const rx = rightStart + 10;
  const rw = w - (rightStart - x0) - 20;
  let ry = y0 + 14;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000")
    .text("Address of Build: ", rx, ry, { continued: true, width: rw });
  doc.font("Helvetica").fillColor("#000")
    .text(ctx.siteAddress || "—", { width: rw });
  ry = doc.y + 6;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000")
    .text("Quote #: ", rx, ry, { continued: true, width: rw });
  doc.font("Helvetica").fillColor("#000")
    .text(ctx.quoteNumber || "—", { width: rw });

  return y0 + headerH;
}

// Draw a single item card. Card box includes top header info and body
// (sketch on left, spec block on right).
function drawItemCard(doc, item, lineNumber, ctx, x, y, w, h) {
  doc.lineWidth(1).strokeColor("#000").rect(x, y, w, h).stroke();

  // ── Top bar: Line / Qty (left) · Location (center) · Item / Line totals (right)
  const topPad = 8;
  const leftCol = x + 12;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000");
  doc.text(`Line:${String(lineNumber).padStart(2, "0")}`, leftCol, y + topPad);
  doc.text(`Quantity: ${item.quantity ?? 1}`, leftCol, y + topPad + 14);

  // Center label
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#000")
    .text(`Location: - ${item.mark ?? ""}`, x, y + topPad + 4, {
      width: w,
      align: "center",
    });

  // Right totals
  const itemTotal = Number(item.client_price ?? 0);
  const qty = Number(item.quantity ?? 1);
  const lineTotal = itemTotal * qty;
  const rightW = 180;
  const rightX = x + w - rightW - 12;
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#000")
    .text(`Item total: ${money(itemTotal)}`, rightX, y + topPad, {
      width: rightW,
      align: "right",
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(RED)
    .text(`Line Total: ${money(lineTotal)}`, rightX, y + topPad + 14, {
      width: rightW,
      align: "right",
    });
  doc.fillColor("#000");

  // ── Body
  const bodyTop = y + topPad + 36;
  const bodyH = h - (bodyTop - y) - 8;
  const sketchW = Math.min(170, w * 0.32);
  const sketchX = x + 8;

  try {
    SVGtoPDF(doc, generateSketch(item), sketchX, bodyTop, {
      width: sketchW - 4,
      height: bodyH - 4,
      preserveAspectRatio: "xMidYMid meet",
    });
  } catch {
    doc
      .fillColor(SUBTLE)
      .font("Helvetica")
      .fontSize(9)
      .text("(sketch error)", sketchX, bodyTop);
    doc.fillColor("#000");
  }

  // Spec block
  const specX = x + sketchW + 14;
  const specW = w - sketchW - 24;
  let sy = bodyTop;

  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor("#000")
    .text(typeDisplayName(item), specX, sy, { width: specW, align: "center" });
  sy = doc.y + 6;

  const totalW = totalWidthIn(item) ?? Number(item.width_in ?? 0);
  const h_in = Number(item.height_in ?? 0);
  const extColor = item.extColor || ctx.extColor;
  const intColor = item.intColor || ctx.intColor;
  const glassSpec = item.glass || ctx.glassSpec;
  const hasGrid = Number(item.gridRows ?? 1) > 1;
  // Material can come straight from the supplier (already includes
  // "Thermally Broken, ...") or just be the bare material name.
  const rawMat = (item.material || "").trim();
  const material = !rawMat
    ? "Thermally Broken, Aluminum"
    : /thermally broken/i.test(rawMat)
      ? rawMat
      : `Thermally Broken, ${rawMat}`;

  const lines = [
    [null, material],
    [null, "Tempered Glass"],
    ["Size", `${inchStr(totalW)} x ${inchStr(h_in)}`],
  ];
  if (item.profile) lines.push(["Aluminum Alloy Profile", item.profile]);
  if (item.thickness) lines.push(["Thickness", item.thickness]);
  lines.push(["Ext Color", extColor]);
  lines.push(["Interior Color", intColor]);
  if (hasGrid) lines.push(["Internal Grid", "Grid in Between"]);
  lines.push(["Glass", glassSpec]);
  lines.push(["Rough Opening", roughOpening(totalW, h_in)]);
  const sqft = totalSqFt(totalW, h_in);
  lines.push(["Total Sq.Ft.", sqft != null ? sqft.toFixed(2) : "?"]);

  for (const [label, val] of lines) {
    if (sy > y + h - 12) break; // safety
    if (label) {
      doc
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .fillColor("#000")
        .text(`${label}: `, specX, sy, { continued: true, width: specW });
      doc.font("Helvetica").text(val, { width: specW });
    } else {
      doc.font("Helvetica").fontSize(9.5).fillColor("#000")
        .text(val, specX, sy, { width: specW });
    }
    sy = doc.y + 1.5;
  }
}

function drawCoverPage(doc, ctx) {
  const { margin } = ctx;
  const pageW = doc.page.width;
  const x = margin;
  const y = margin;
  const w = pageW - margin * 2;

  // Banner: 914×610 source, fit into width preserving aspect ratio.
  const bannerH = Math.round(w * (610 / 914));
  if (COVER_BANNER_AVAILABLE) {
    doc.image(COVER_BANNER_PATH, x, y, { width: w, height: bannerH });
  } else {
    // Fallback path if the asset isn't bundled (shouldn't happen in prod).
    doc.lineWidth(1).strokeColor("#000").rect(x, y, w, bannerH).stroke();
    const brandSize = 100;
    drawBrandMark(doc, x + (w - brandSize) / 2, y + 32, brandSize, ctx);
    doc
      .fillColor("#000")
      .font("Helvetica-Bold")
      .fontSize(24)
      .text(ctx.company, x, y + 150, { width: w, align: "center" });
  }

  // Body copy below the banner
  const padX = 60;
  let by = y + bannerH + 50;
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Who We Are", x, by, { width: w, align: "center" });
  by = doc.y + 8;
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor("#000")
    .text(ctx.whoWeAre, x + padX, by, {
      width: w - padX * 2,
      align: "center",
      paragraphGap: 6,
    });

  by = doc.y + 36;
  doc
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("What We Believe In", x, by, { width: w, align: "center" });
  by = doc.y + 8;
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor("#000")
    .text(ctx.whatWeBelieve, x + padX, by, {
      width: w - padX * 2,
      align: "center",
      paragraphGap: 6,
    });
}

function drawSummaryPage(doc, items, ctx) {
  const headerBottom = drawPageHeader(doc, ctx);
  const { margin } = ctx;
  const x0 = margin;
  const w = doc.page.width - margin * 2;

  let y = headerBottom + 24;
  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .fillColor("#000")
    .text("Quote Summary", x0, y, { width: w, align: "center" });
  y = doc.y + 14;

  const cols = [
    { label: "Line", w: 40, align: "center" },
    { label: "Product", w: 150, align: "left" },
    { label: "Location", w: 60, align: "center" },
    { label: "Qty", w: 40, align: "right" },
    { label: "Sq.Ft.", w: 55, align: "right" },
    { label: "Unit Price", w: 80, align: "right" },
    { label: "Total", w: 90, align: "right" },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const tableX = x0 + (w - tableW) / 2;

  // Header row
  doc.rect(tableX, y, tableW, 22).fill(HEADER_TINT);
  doc.fillColor("#000").font("Helvetica-Bold").fontSize(10);
  let cx = tableX;
  cols.forEach((c) => {
    doc.text(c.label, cx + 5, y + 6, { width: c.w - 10, align: c.align });
    cx += c.w;
  });
  y += 22;

  doc.font("Helvetica").fontSize(9.5);
  let subtotal = 0;
  let totalSqftAll = 0;
  let totalProducts = 0;

  items.forEach((it, i) => {
    const totalW = totalWidthIn(it) ?? Number(it.width_in ?? 0);
    const h_in = Number(it.height_in ?? 0);
    const sqft = totalSqFt(totalW, h_in) ?? 0;
    const qty = Number(it.quantity ?? 1);
    const unit = Number(it.client_price ?? 0);
    const total = unit * qty;
    subtotal += total;
    totalSqftAll += sqft * qty;
    totalProducts += qty;

    if (i % 2 === 1) {
      doc.rect(tableX, y, tableW, 18).fill(ROW_TINT).fillColor("#000");
    }

    cx = tableX;
    const vals = [
      String(i + 1).padStart(2, "0"),
      typeDisplayName(it),
      it.mark ?? "",
      String(qty),
      sqft.toFixed(2),
      money(unit),
      money(total),
    ];
    doc.font("Helvetica").fontSize(9.5).fillColor("#000");
    cols.forEach((c, j) => {
      doc.text(vals[j], cx + 5, y + 5, { width: c.w - 10, align: c.align });
      cx += c.w;
    });
    y += 18;
  });

  // Bottom totals
  y += 4;
  doc
    .lineWidth(0.5)
    .strokeColor(BORDER)
    .moveTo(tableX, y)
    .lineTo(tableX + tableW, y)
    .stroke();
  y += 6;

  const lastColW = cols[cols.length - 1].w;
  const labelW = tableW - lastColW;
  const writeTotalRow = (label, amount, bold) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 10);
    doc.text(label, tableX, y, { width: labelW - 8, align: "right" });
    doc.text(money(amount), tableX + labelW, y, {
      width: lastColW - 6,
      align: "right",
    });
    y = doc.y + 4;
  };

  writeTotalRow("Subtotal", subtotal, true);
  if (ctx.deliveryCharge > 0) writeTotalRow("Delivery Charge", ctx.deliveryCharge, false);
  writeTotalRow("Total", subtotal + ctx.deliveryCharge, true);

  return { subtotal, total: subtotal + ctx.deliveryCharge, totalSqftAll, totalProducts };
}

function drawSignaturePage(doc, ctx, summary) {
  drawPageHeader(doc, ctx);
  const { margin } = ctx;
  const x0 = margin;
  const w = doc.page.width - margin * 2;
  const pageH = doc.page.height;

  let y = margin + 130;

  const cells = [
    ["Total", money(summary.total)],
    ["Total Sq.Ft.", summary.totalSqftAll.toFixed(2)],
    ["Total Products", String(summary.totalProducts)],
  ];
  const cellW = w / cells.length;
  const cellH = 70;
  cells.forEach(([label, val], i) => {
    const cx = x0 + cellW * i;
    doc.lineWidth(0.8).strokeColor("#000").rect(cx, y, cellW, cellH).stroke();
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor(SUBTLE)
      .text(label, cx, y + 14, { width: cellW, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#000")
      .text(val, cx, y + 36, { width: cellW, align: "center" });
  });

  // Signature block near the bottom
  const sigY = pageH - margin - 180;
  const lineDash = "____________________________________";
  doc.font("Helvetica").fontSize(11).fillColor("#000");
  doc.text(`Customer Signature: ${lineDash}      Date: ${"_".repeat(20)}`, x0, sigY, {
    width: w,
  });
  doc.moveDown(3);
  doc.text(`Print Name: ${lineDash}${lineDash}`, x0, doc.y, { width: w });
}

function addPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(SUBTLE)
      .text(`Page ${i + 1} of ${total}`, pageW - 110, pageH - 28, {
        width: 80,
        align: "right",
      });
    doc.fillColor("#000");
  }
}

export function renderProposalPdf(
  { items = [], projectName, branding = {}, totals = {}, info = {} },
  stream
) {
  const ctx = buildContext(branding, info, totals);
  const margin = ctx.margin;

  const doc = new PDFDocument({ size: "A4", margin, bufferPages: true });
  doc.pipe(stream);

  // 1) Cover page
  drawCoverPage(doc, ctx);

  // 2) Detail pages — 3 cards per page
  const cardsPerPage = 3;
  const pageH = 842; // A4 portrait pt
  const pageW = 595;
  const usableW = pageW - margin * 2;

  for (let i = 0; i < items.length; i += cardsPerPage) {
    doc.addPage();
    const headerBottom = drawPageHeader(doc, ctx);
    const footerReserve = 36;
    const usableH = pageH - margin - footerReserve - (headerBottom - margin);
    const gap = 14;
    const cardH = (usableH - (cardsPerPage - 1) * gap) / cardsPerPage;

    const slice = items.slice(i, i + cardsPerPage);
    slice.forEach((it, j) => {
      const cardY = headerBottom + 14 + j * (cardH + gap);
      drawItemCard(doc, it, i + j + 1, ctx, margin, cardY, usableW, cardH);
    });
  }

  // 3) Summary page
  doc.addPage();
  const summary = drawSummaryPage(doc, items, ctx);

  // 4) Signature page
  doc.addPage();
  drawSignaturePage(doc, ctx, summary);

  // Page numbers across all pages
  addPageNumbers(doc);

  doc.end();
}

export function generateProposal({ items, projectName, branding = {} }) {
  const rows = items.map((it) => ({
    item: it.mark,
    qty: it.quantity,
    description: typeDisplayName(it),
    size: `${inchStr(totalWidthIn(it) ?? it.width_in)} x ${inchStr(it.height_in)}`,
    price: it.client_price,
    sketch: generateSketch(it),
  }));
  return { projectName, branding, rows, generatedAt: new Date().toISOString() };
}
