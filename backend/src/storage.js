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
