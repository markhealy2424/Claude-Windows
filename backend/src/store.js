import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR
  ? resolve(process.env.DATA_DIR)
  : resolve(__dirname, "../data");
const DATA_FILE = resolve(DATA_DIR, "projects.json");
const TMP_FILE = resolve(DATA_DIR, "projects.json.tmp");
const EXPENSES_FILE = resolve(DATA_DIR, "company-expenses.json");
const EXPENSES_TMP = resolve(DATA_DIR, "company-expenses.json.tmp");

mkdirSync(DATA_DIR, { recursive: true });

const projects = new Map();
const companyExpenses = new Map();

function load() {
  if (existsSync(DATA_FILE)) {
    try {
      const raw = readFileSync(DATA_FILE, "utf8");
      if (raw.trim()) {
        const arr = JSON.parse(raw);
        for (const p of arr) projects.set(p.id, p);
      }
    } catch (err) {
      console.error("[store] failed to load projects.json:", err.message);
    }
  }
  if (existsSync(EXPENSES_FILE)) {
    try {
      const raw = readFileSync(EXPENSES_FILE, "utf8");
      if (raw.trim()) {
        const arr = JSON.parse(raw);
        for (const e of arr) companyExpenses.set(e.id, e);
      }
    } catch (err) {
      console.error("[store] failed to load company-expenses.json:", err.message);
    }
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

let expensesWriteQueued = false;
function persistExpenses() {
  if (expensesWriteQueued) return;
  expensesWriteQueued = true;
  queueMicrotask(() => {
    expensesWriteQueued = false;
    try {
      const json = JSON.stringify([...companyExpenses.values()], null, 2);
      writeFileSync(EXPENSES_TMP, json);
      renameSync(EXPENSES_TMP, EXPENSES_FILE);
    } catch (err) {
      console.error("[store] failed to write company-expenses.json:", err.message);
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

export function listCompanyExpenses() {
  return [...companyExpenses.values()].sort((a, b) =>
    (b.date ?? "").localeCompare(a.date ?? "")
  );
}

export function createCompanyExpense({ date, payee, amount, category, notes }) {
  const id = crypto.randomUUID();
  const e = {
    id,
    date: date || new Date().toISOString().slice(0, 10),
    payee: payee || "",
    amount: Number(amount) || 0,
    category: category || "",
    notes: notes || "",
    createdAt: new Date().toISOString(),
  };
  companyExpenses.set(id, e);
  persistExpenses();
  return e;
}

export function updateCompanyExpense(id, patch) {
  const e = companyExpenses.get(id);
  if (!e) return null;
  Object.assign(e, patch);
  persistExpenses();
  return e;
}

export function deleteCompanyExpense(id) {
  const existed = companyExpenses.delete(id);
  if (existed) persistExpenses();
  return existed;
}
