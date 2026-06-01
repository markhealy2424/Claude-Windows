import { mkdirSync, writeFileSync, existsSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(__dirname, "../data");

function safe(s) {
  return String(s ?? "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function getPlanPdfPath(projectId, planId) {
  return resolve(DATA_DIR, "plans", safe(projectId), `${safe(planId)}.pdf`);
}

export function savePlanPdf(projectId, planId, buffer) {
  const path = getPlanPdfPath(projectId, planId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  return path;
}

export function planPdfExists(projectId, planId) {
  return existsSync(getPlanPdfPath(projectId, planId));
}

// Schedule files: PDF, PNG, JPEG, or WebP. Stored under
// ${DATA_DIR}/schedules/<projectId>/<scheduleId>.<ext> where ext matches
// the upload's original extension. Vision API handles PDF and image
// content blocks differently, so we preserve the extension for dispatch.

const SCHEDULE_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

function pickExt(originalName, fallback = "pdf") {
  const raw = String(originalName || "").split(".").pop().toLowerCase();
  return SCHEDULE_EXTS.has(raw) ? raw : fallback;
}

export function getScheduleFilePath(projectId, scheduleId) {
  const dir = resolve(DATA_DIR, "schedules", safe(projectId));
  if (!existsSync(dir)) return null;
  const prefix = `${safe(scheduleId)}.`;
  const match = readdirSync(dir).find((f) => f.startsWith(prefix));
  return match ? resolve(dir, match) : null;
}

export function saveScheduleFile(projectId, scheduleId, buffer, originalName) {
  const ext = pickExt(originalName);
  const dir = resolve(DATA_DIR, "schedules", safe(projectId));
  mkdirSync(dir, { recursive: true });
  // Replace any existing file for this schedule (e.g. user re-uploads with
  // a different format).
  const existing = getScheduleFilePath(projectId, scheduleId);
  if (existing) {
    try { unlinkSync(existing); } catch { /* best effort */ }
  }
  const path = resolve(dir, `${safe(scheduleId)}.${ext}`);
  writeFileSync(path, buffer);
  return path;
}

export function scheduleFileExists(projectId, scheduleId) {
  return Boolean(getScheduleFilePath(projectId, scheduleId));
}

// Backwards-compat aliases — older callers still reference the PDF-only names.
export const getSchedulePdfPath = getScheduleFilePath;
export const schedulePdfExists = scheduleFileExists;
export const saveSchedulePdf = (projectId, scheduleId, buffer) =>
  saveScheduleFile(projectId, scheduleId, buffer, "schedule.pdf");

// Supplier quote files: same shape as schedules — PDF, PNG, JPEG, WebP.
const QUOTE_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

function pickQuoteExt(originalName, fallback = "pdf") {
  const raw = String(originalName || "").split(".").pop().toLowerCase();
  return QUOTE_EXTS.has(raw) ? raw : fallback;
}

export function getQuoteFilePath(projectId, quoteId) {
  const dir = resolve(DATA_DIR, "quotes", safe(projectId));
  if (!existsSync(dir)) return null;
  const prefix = `${safe(quoteId)}.`;
  const match = readdirSync(dir).find((f) => f.startsWith(prefix));
  return match ? resolve(dir, match) : null;
}

export function saveQuoteFile(projectId, quoteId, buffer, originalName) {
  const ext = pickQuoteExt(originalName);
  const dir = resolve(DATA_DIR, "quotes", safe(projectId));
  mkdirSync(dir, { recursive: true });
  const existing = getQuoteFilePath(projectId, quoteId);
  if (existing) {
    try { unlinkSync(existing); } catch { /* best effort */ }
  }
  const path = resolve(dir, `${safe(quoteId)}.${ext}`);
  writeFileSync(path, buffer);
  return path;
}

export function quoteFileExists(projectId, quoteId) {
  return Boolean(getQuoteFilePath(projectId, quoteId));
}

// Final supplier drawings/designs — long-lived, kept past project close.
// Same file-format set as schedules/quotes.
const DRAWING_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

function pickDrawingExt(originalName, fallback = "pdf") {
  const raw = String(originalName || "").split(".").pop().toLowerCase();
  return DRAWING_EXTS.has(raw) ? raw : fallback;
}

export function getDrawingFilePath(projectId, drawingId) {
  const dir = resolve(DATA_DIR, "drawings", safe(projectId));
  if (!existsSync(dir)) return null;
  const prefix = `${safe(drawingId)}.`;
  const match = readdirSync(dir).find((f) => f.startsWith(prefix));
  return match ? resolve(dir, match) : null;
}

export function saveDrawingFile(projectId, drawingId, buffer, originalName) {
  const ext = pickDrawingExt(originalName);
  const dir = resolve(DATA_DIR, "drawings", safe(projectId));
  mkdirSync(dir, { recursive: true });
  const existing = getDrawingFilePath(projectId, drawingId);
  if (existing) {
    try { unlinkSync(existing); } catch { /* best effort */ }
  }
  const path = resolve(dir, `${safe(drawingId)}.${ext}`);
  writeFileSync(path, buffer);
  return { path, ext };
}

export function deleteDrawingFile(projectId, drawingId) {
  const path = getDrawingFilePath(projectId, drawingId);
  if (!path) return false;
  try { unlinkSync(path); return true; }
  catch { return false; }
}

export function drawingFileExists(projectId, drawingId) {
  return Boolean(getDrawingFilePath(projectId, drawingId));
}

// Final invoices — two slots per project, "supplier" and "client".
// One file per slot; re-uploads overwrite. Long-lived storage on the
// persistent volume, same shape as drawings/quotes.
const FINAL_INVOICE_KINDS = new Set(["supplier", "client"]);
const FINAL_INVOICE_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp"]);

function pickFinalInvoiceExt(originalName, fallback = "pdf") {
  const raw = String(originalName || "").split(".").pop().toLowerCase();
  return FINAL_INVOICE_EXTS.has(raw) ? raw : fallback;
}

export function getFinalInvoiceFilePath(projectId, kind) {
  if (!FINAL_INVOICE_KINDS.has(kind)) return null;
  const dir = resolve(DATA_DIR, "final-invoices", safe(projectId));
  if (!existsSync(dir)) return null;
  const prefix = `${safe(kind)}.`;
  const match = readdirSync(dir).find((f) => f.startsWith(prefix));
  return match ? resolve(dir, match) : null;
}

export function saveFinalInvoiceFile(projectId, kind, buffer, originalName) {
  if (!FINAL_INVOICE_KINDS.has(kind)) throw new Error(`bad kind: ${kind}`);
  const ext = pickFinalInvoiceExt(originalName);
  const dir = resolve(DATA_DIR, "final-invoices", safe(projectId));
  mkdirSync(dir, { recursive: true });
  // Delete any prior file in the slot (could be a different extension).
  const existing = getFinalInvoiceFilePath(projectId, kind);
  if (existing) {
    try { unlinkSync(existing); } catch { /* best effort */ }
  }
  const path = resolve(dir, `${safe(kind)}.${ext}`);
  writeFileSync(path, buffer);
  return { path, ext };
}

export function deleteFinalInvoiceFile(projectId, kind) {
  const path = getFinalInvoiceFilePath(projectId, kind);
  if (!path) return false;
  try { unlinkSync(path); return true; }
  catch { return false; }
}

// Catalog product images — two slots per product, "product" (the SKU shot)
// and "lifestyle" (the product in a real-life setting). Image-only — no PDF.
const CATALOG_IMAGE_KINDS = new Set(["product", "lifestyle"]);
const CATALOG_IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp"]);

function pickCatalogImageExt(originalName, fallback = "jpg") {
  const raw = String(originalName || "").split(".").pop().toLowerCase();
  return CATALOG_IMAGE_EXTS.has(raw) ? raw : fallback;
}

export function getCatalogImagePath(productId, kind) {
  if (!CATALOG_IMAGE_KINDS.has(kind)) return null;
  const dir = resolve(DATA_DIR, "catalog-images", safe(productId));
  if (!existsSync(dir)) return null;
  const prefix = `${safe(kind)}.`;
  const match = readdirSync(dir).find((f) => f.startsWith(prefix));
  return match ? resolve(dir, match) : null;
}

export function saveCatalogImage(productId, kind, buffer, originalName) {
  if (!CATALOG_IMAGE_KINDS.has(kind)) throw new Error(`bad kind: ${kind}`);
  const ext = pickCatalogImageExt(originalName);
  const dir = resolve(DATA_DIR, "catalog-images", safe(productId));
  mkdirSync(dir, { recursive: true });
  const existing = getCatalogImagePath(productId, kind);
  if (existing) {
    try { unlinkSync(existing); } catch { /* best effort */ }
  }
  const path = resolve(dir, `${safe(kind)}.${ext}`);
  writeFileSync(path, buffer);
  return { path, ext };
}

export function deleteCatalogImage(productId, kind) {
  const path = getCatalogImagePath(productId, kind);
  if (!path) return false;
  try { unlinkSync(path); return true; }
  catch { return false; }
}

// Company branding assets — header logo + cover banner. Single-tenant for
// Phase 1 (one file per slot, lives directly under company-branding/).
// In Phase 2 this gains a per-tenant subdirectory.
const COMPANY_ASSET_KINDS = new Set(["logo", "cover"]);
const COMPANY_ASSET_EXTS = new Set(["png", "jpg", "jpeg"]);

function pickCompanyAssetExt(originalName, fallback = "png") {
  const raw = String(originalName || "").split(".").pop().toLowerCase();
  return COMPANY_ASSET_EXTS.has(raw) ? raw : fallback;
}

export function getCompanyAssetPath(kind) {
  if (!COMPANY_ASSET_KINDS.has(kind)) return null;
  const dir = resolve(DATA_DIR, "company-branding");
  if (!existsSync(dir)) return null;
  const prefix = `${kind}.`;
  const match = readdirSync(dir).find((f) => f.startsWith(prefix));
  return match ? resolve(dir, match) : null;
}

export function saveCompanyAsset(kind, buffer, originalName) {
  if (!COMPANY_ASSET_KINDS.has(kind)) throw new Error(`bad kind: ${kind}`);
  const ext = pickCompanyAssetExt(originalName);
  const dir = resolve(DATA_DIR, "company-branding");
  mkdirSync(dir, { recursive: true });
  const existing = getCompanyAssetPath(kind);
  if (existing) {
    try { unlinkSync(existing); } catch { /* best effort */ }
  }
  const path = resolve(dir, `${kind}.${ext}`);
  writeFileSync(path, buffer);
  return { path, ext };
}

export function deleteCompanyAsset(kind) {
  const path = getCompanyAssetPath(kind);
  if (!path) return false;
  try { unlinkSync(path); return true; }
  catch { return false; }
}
