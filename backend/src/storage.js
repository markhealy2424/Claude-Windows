import { mkdirSync, writeFileSync, existsSync } from "node:fs";
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

export function getSchedulePdfPath(projectId, scheduleId) {
  return resolve(DATA_DIR, "schedules", safe(projectId), `${safe(scheduleId)}.pdf`);
}

export function saveSchedulePdf(projectId, scheduleId, buffer) {
  const path = getSchedulePdfPath(projectId, scheduleId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  return path;
}

export function schedulePdfExists(projectId, scheduleId) {
  return existsSync(getSchedulePdfPath(projectId, scheduleId));
}
