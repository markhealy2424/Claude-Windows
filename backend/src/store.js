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
const SALESPEOPLE_FILE = resolve(DATA_DIR, "salespeople.json");
const SALESPEOPLE_TMP = resolve(DATA_DIR, "salespeople.json.tmp");
const INVOICES_FILE = resolve(DATA_DIR, "salesperson-invoices.json");
const INVOICES_TMP = resolve(DATA_DIR, "salesperson-invoices.json.tmp");
const TODOS_FILE = resolve(DATA_DIR, "todos.json");
const TODOS_TMP = resolve(DATA_DIR, "todos.json.tmp");
const LEADS_FILE = resolve(DATA_DIR, "leads.json");
const LEADS_TMP = resolve(DATA_DIR, "leads.json.tmp");
const LEAD_SOURCES_FILE = resolve(DATA_DIR, "lead-sources.json");
const LEAD_SOURCES_TMP = resolve(DATA_DIR, "lead-sources.json.tmp");
const LEAD_SETTINGS_FILE = resolve(DATA_DIR, "lead-settings.json");
const LEAD_SETTINGS_TMP = resolve(DATA_DIR, "lead-settings.json.tmp");

mkdirSync(DATA_DIR, { recursive: true });

const projects = new Map();
const companyExpenses = new Map();
const salespeople = new Map();
const invoices = new Map();
const todos = new Map();
const leads = new Map();
const leadSources = new Map();
let leadSettings = { businessContext: "" };
// Monotonically increasing invoice counter — derived from the highest
// existing invoice number on load so we never reissue the same number.
let invoiceCounter = 0;

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
  if (existsSync(SALESPEOPLE_FILE)) {
    try {
      const raw = readFileSync(SALESPEOPLE_FILE, "utf8");
      if (raw.trim()) {
        const arr = JSON.parse(raw);
        for (const s of arr) salespeople.set(s.id, s);
      }
    } catch (err) {
      console.error("[store] failed to load salespeople.json:", err.message);
    }
  }
  if (existsSync(TODOS_FILE)) {
    try {
      const raw = readFileSync(TODOS_FILE, "utf8");
      if (raw.trim()) {
        const arr = JSON.parse(raw);
        for (const t of arr) todos.set(t.id, t);
      }
    } catch (err) {
      console.error("[store] failed to load todos.json:", err.message);
    }
  }
  if (existsSync(LEADS_FILE)) {
    try {
      const raw = readFileSync(LEADS_FILE, "utf8");
      if (raw.trim()) for (const l of JSON.parse(raw)) leads.set(l.id, l);
    } catch (err) { console.error("[store] failed to load leads.json:", err.message); }
  }
  if (existsSync(LEAD_SOURCES_FILE)) {
    try {
      const raw = readFileSync(LEAD_SOURCES_FILE, "utf8");
      if (raw.trim()) for (const s of JSON.parse(raw)) leadSources.set(s.id, s);
    } catch (err) { console.error("[store] failed to load lead-sources.json:", err.message); }
  }
  if (existsSync(LEAD_SETTINGS_FILE)) {
    try {
      const raw = readFileSync(LEAD_SETTINGS_FILE, "utf8");
      if (raw.trim()) leadSettings = { ...leadSettings, ...JSON.parse(raw) };
    } catch (err) { console.error("[store] failed to load lead-settings.json:", err.message); }
  }
  if (existsSync(INVOICES_FILE)) {
    try {
      const raw = readFileSync(INVOICES_FILE, "utf8");
      if (raw.trim()) {
        const arr = JSON.parse(raw);
        for (const inv of arr) {
          invoices.set(inv.id, inv);
          // Parse the trailing integer of "INV-000123" to seed the counter.
          const n = Number(String(inv.invoiceNumber ?? "").replace(/\D/g, ""));
          if (Number.isFinite(n) && n > invoiceCounter) invoiceCounter = n;
        }
      }
    } catch (err) {
      console.error("[store] failed to load salesperson-invoices.json:", err.message);
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

let salespeopleWriteQueued = false;
function persistSalespeople() {
  if (salespeopleWriteQueued) return;
  salespeopleWriteQueued = true;
  queueMicrotask(() => {
    salespeopleWriteQueued = false;
    try {
      const json = JSON.stringify([...salespeople.values()], null, 2);
      writeFileSync(SALESPEOPLE_TMP, json);
      renameSync(SALESPEOPLE_TMP, SALESPEOPLE_FILE);
    } catch (err) {
      console.error("[store] failed to write salespeople.json:", err.message);
    }
  });
}

let leadsWriteQueued = false;
function persistLeads() {
  if (leadsWriteQueued) return;
  leadsWriteQueued = true;
  queueMicrotask(() => {
    leadsWriteQueued = false;
    try {
      writeFileSync(LEADS_TMP, JSON.stringify([...leads.values()], null, 2));
      renameSync(LEADS_TMP, LEADS_FILE);
    } catch (err) { console.error("[store] failed to write leads.json:", err.message); }
  });
}

let leadSourcesWriteQueued = false;
function persistLeadSources() {
  if (leadSourcesWriteQueued) return;
  leadSourcesWriteQueued = true;
  queueMicrotask(() => {
    leadSourcesWriteQueued = false;
    try {
      writeFileSync(LEAD_SOURCES_TMP, JSON.stringify([...leadSources.values()], null, 2));
      renameSync(LEAD_SOURCES_TMP, LEAD_SOURCES_FILE);
    } catch (err) { console.error("[store] failed to write lead-sources.json:", err.message); }
  });
}

let leadSettingsWriteQueued = false;
function persistLeadSettings() {
  if (leadSettingsWriteQueued) return;
  leadSettingsWriteQueued = true;
  queueMicrotask(() => {
    leadSettingsWriteQueued = false;
    try {
      writeFileSync(LEAD_SETTINGS_TMP, JSON.stringify(leadSettings, null, 2));
      renameSync(LEAD_SETTINGS_TMP, LEAD_SETTINGS_FILE);
    } catch (err) { console.error("[store] failed to write lead-settings.json:", err.message); }
  });
}

let todosWriteQueued = false;
function persistTodos() {
  if (todosWriteQueued) return;
  todosWriteQueued = true;
  queueMicrotask(() => {
    todosWriteQueued = false;
    try {
      const json = JSON.stringify([...todos.values()], null, 2);
      writeFileSync(TODOS_TMP, json);
      renameSync(TODOS_TMP, TODOS_FILE);
    } catch (err) {
      console.error("[store] failed to write todos.json:", err.message);
    }
  });
}

let invoicesWriteQueued = false;
function persistInvoices() {
  if (invoicesWriteQueued) return;
  invoicesWriteQueued = true;
  queueMicrotask(() => {
    invoicesWriteQueued = false;
    try {
      const json = JSON.stringify([...invoices.values()], null, 2);
      writeFileSync(INVOICES_TMP, json);
      renameSync(INVOICES_TMP, INVOICES_FILE);
    } catch (err) {
      console.error("[store] failed to write salesperson-invoices.json:", err.message);
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

// ── Salespeople ────────────────────────────────────────────────────────

export function listSalespeople() {
  return [...salespeople.values()].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

export function getSalesperson(id) {
  return salespeople.get(id) ?? null;
}

export function createSalesperson({ name, email, phone, address, defaultPaymentMethod, notes }) {
  const id = crypto.randomUUID();
  const s = {
    id,
    name: name || "",
    email: email || "",
    phone: phone || "",
    address: address || "",
    defaultPaymentMethod: defaultPaymentMethod || "",
    notes: notes || "",
    createdAt: new Date().toISOString(),
  };
  salespeople.set(id, s);
  persistSalespeople();
  return s;
}

export function updateSalesperson(id, patch) {
  const s = salespeople.get(id);
  if (!s) return null;
  Object.assign(s, patch);
  persistSalespeople();
  return s;
}

export function deleteSalesperson(id) {
  const existed = salespeople.delete(id);
  if (existed) persistSalespeople();
  return existed;
}

// ── Salesperson invoices ───────────────────────────────────────────────

function nextInvoiceNumber() {
  invoiceCounter += 1;
  return `INV-${String(invoiceCounter).padStart(6, "0")}`;
}

export function listInvoices() {
  return [...invoices.values()].sort((a, b) =>
    (b.issuedAt ?? "").localeCompare(a.issuedAt ?? "")
  );
}

export function getInvoice(id) {
  return invoices.get(id) ?? null;
}

// Create a salesperson invoice. The caller hands in a snapshot of the
// project + salesperson values; we freeze them on the invoice so later
// edits to the source records don't retroactively change a signed-off
// invoice.
export function createInvoice(input) {
  const id = crypto.randomUUID();
  const inv = {
    id,
    invoiceNumber: nextInvoiceNumber(),
    salespersonId: input.salespersonId,
    salespersonSnapshot: input.salespersonSnapshot ?? {},
    projectId: input.projectId,
    projectName: input.projectName || "",
    clientName: input.clientName || "",
    saleDate: input.saleDate || "",
    salePrice: Number(input.salePrice) || 0,
    commissionRate: Number(input.commissionRate) || 0,
    commissionAmount: Number(input.commissionAmount) || 0,
    notes: input.notes || "",
    issuedAt: new Date().toISOString(),
    dueDate: input.dueDate || "",
    paymentStatus: "unpaid",
    paymentMethod: input.paymentMethod || "",
    paidAmount: 0,
    paidAt: null,
  };
  invoices.set(id, inv);
  persistInvoices();
  return inv;
}

export function updateInvoice(id, patch) {
  const inv = invoices.get(id);
  if (!inv) return null;
  // Don't allow callers to mutate identity / snapshot fields.
  delete patch.id;
  delete patch.invoiceNumber;
  delete patch.issuedAt;
  Object.assign(inv, patch);
  persistInvoices();
  return inv;
}

export function deleteInvoice(id) {
  const existed = invoices.delete(id);
  if (existed) persistInvoices();
  return existed;
}

// ── Dashboard to-dos ────────────────────────────────────────────────────

export function listTodos() {
  return [...todos.values()].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}

export function createTodo({ text }) {
  const id = crypto.randomUUID();
  const t = {
    id,
    text: text || "",
    done: false,
    createdAt: new Date().toISOString(),
  };
  todos.set(id, t);
  persistTodos();
  return t;
}

export function updateTodo(id, patch) {
  const t = todos.get(id);
  if (!t) return null;
  Object.assign(t, patch);
  persistTodos();
  return t;
}

export function deleteTodo(id) {
  const existed = todos.delete(id);
  if (existed) persistTodos();
  return existed;
}

// ── Lead sources ────────────────────────────────────────────────────────

export function listLeadSources() {
  return [...leadSources.values()].sort((a, b) =>
    (a.label ?? "").localeCompare(b.label ?? "")
  );
}

export function createLeadSource({ url, label, notes }) {
  const id = crypto.randomUUID();
  const s = {
    id,
    url: url || "",
    label: label || "",
    notes: notes || "",
    addedAt: new Date().toISOString(),
  };
  leadSources.set(id, s);
  persistLeadSources();
  return s;
}

export function updateLeadSource(id, patch) {
  const s = leadSources.get(id);
  if (!s) return null;
  Object.assign(s, patch);
  persistLeadSources();
  return s;
}

export function deleteLeadSource(id) {
  const existed = leadSources.delete(id);
  if (existed) persistLeadSources();
  return existed;
}

// ── Lead settings (business context) ───────────────────────────────────

export function getLeadSettings() { return { ...leadSettings }; }

export function updateLeadSettings(patch) {
  leadSettings = { ...leadSettings, ...patch };
  persistLeadSettings();
  return { ...leadSettings };
}

// ── Leads ──────────────────────────────────────────────────────────────

export function listLeads() {
  return [...leads.values()].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? "")
  );
}

export function createLead(input) {
  const id = crypto.randomUUID();
  const l = {
    id,
    company: input.company || "",
    contact: input.contact || { name: "", email: "", phone: "", role: "" },
    website: input.website || "",
    source: input.source || null,
    whyGoodFit: input.whyGoodFit || "",
    qualityScore: Number(input.qualityScore) || 0,
    rawExcerpt: input.rawExcerpt || "",
    stage: input.stage || "not_contacted",
    salespersonId: input.salespersonId || "",
    interactions: Array.isArray(input.interactions) ? input.interactions : [],
    notes: input.notes || "",
    origin: input.origin || (input.source ? "agent" : "manual"),
    createdAt: new Date().toISOString(),
  };
  leads.set(id, l);
  persistLeads();
  return l;
}

export function addLeadInteraction(leadId, { kind, summary, outcome, date }) {
  const l = leads.get(leadId);
  if (!l) return null;
  const entry = {
    id: crypto.randomUUID(),
    kind: kind || "note",
    summary: summary || "",
    outcome: outcome || "",
    date: date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  l.interactions = [entry, ...(l.interactions ?? [])];
  persistLeads();
  return l;
}

export function deleteLeadInteraction(leadId, interactionId) {
  const l = leads.get(leadId);
  if (!l) return null;
  const before = l.interactions?.length ?? 0;
  l.interactions = (l.interactions ?? []).filter((e) => e.id !== interactionId);
  if (l.interactions.length === before) return null;
  persistLeads();
  return l;
}

export function updateLead(id, patch) {
  const l = leads.get(id);
  if (!l) return null;
  Object.assign(l, patch);
  persistLeads();
  return l;
}

export function deleteLead(id) {
  const existed = leads.delete(id);
  if (existed) persistLeads();
  return existed;
}
