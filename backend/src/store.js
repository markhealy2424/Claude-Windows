import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(__dirname, "../data");
const DATA_FILE = resolve(DATA_DIR, "projects.json");
const TMP_FILE = resolve(DATA_DIR, "projects.json.tmp");

mkdirSync(DATA_DIR, { recursive: true });

const projects = new Map();

function load() {
  if (!existsSync(DATA_FILE)) return;
  try {
    const raw = readFileSync(DATA_FILE, "utf8");
    if (!raw.trim()) return;
    const arr = JSON.parse(raw);
    for (const p of arr) projects.set(p.id, p);
  } catch (err) {
    console.error("[store] failed to load projects.json:", err.message);
  }
}

let writeQueued = false;
function persist() {
  if (writeQueued) return;
  writeQueued = true;
  queueMicrotask(() => {
    writeQueued = false;
    try {
      const json = JSON.stringify([...projects.values()], null, 2);
      writeFileSync(TMP_FILE, json);
      renameSync(TMP_FILE, DATA_FILE);
    } catch (err) {
      console.error("[store] failed to write projects.json:", err.message);
    }
  });
}

load();

export function createProject(name) {
  const id = crypto.randomUUID();
  const project = {
    id,
    name,
    status: "Need to make RFQ",
    plans: [],
    items: [],
    quotes: [],
    discrepancies: null,
    proposal: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  projects.set(id, project);
  persist();
  return project;
}

export function listProjects() {
  return [...projects.values()].sort((a, b) =>
    (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt)
  );
}

export function getProject(id) {
  return projects.get(id);
}

export function updateProject(id, patch) {
  const p = projects.get(id);
  if (!p) return null;
  Object.assign(p, patch, { updatedAt: new Date().toISOString() });
  persist();
  return p;
}

export function deleteProject(id) {
  const existed = projects.delete(id);
  if (existed) persist();
  return existed;
}
