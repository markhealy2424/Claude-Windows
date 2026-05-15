import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { STATUS_OPTIONS, isKnownStatus } from "../lib/projectStatus.js";
import { money, projectSummary } from "../lib/financials.js";

// ── Public exports kept for back-compat (still imported by ProjectView
//    and Projects pages). ────────────────────────────────────────────────

export function StatusSelect({ value, onChange }) {
  const known = isKnownStatus(value);
  return (
    <select
      value={known ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Project status"
    >
      {!known && <option value="" disabled>{value ? `${value} — pick new` : "— pick status —"}</option>}
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

export function InlineNameInput({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { setDraft(value); return; }
    if (trimmed !== value) onSave(trimmed);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "Escape") { setDraft(value); e.target.blur(); }
      }}
      onFocus={(e) => e.target.select()}
      style={{ fontWeight: 500, minWidth: 200, width: "100%" }}
      aria-label="Project name"
    />
  );
}

// ── Dashboard page ────────────────────────────────────────────────────

const DISMISSED_KEY = "dashboard.dismissedSuggestions.v1";
function loadDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}
function saveDismissed(set) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set])); } catch {}
}

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [dismissed, setDismissed] = useState(loadDismissed);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listProjects(),
      api.listCompanyExpenses(),
      api.listInvoices(),
      api.listTodos(),
    ]).then(([ps, es, inv, ts]) => {
      if (cancelled) return;
      setProjects(ps);
      setExpenses(es);
      setInvoices(inv);
      setTodos(ts);
      setLoading(false);
    }).catch(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  async function createProject(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    const p = await api.createProject(newName.trim());
    setProjects((prev) => [p, ...prev]);
    setNewName("");
  }

  function dismissSuggestion(id) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(next);
      return next;
    });
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>

      <form onSubmit={createProject} className="row" style={{ marginBottom: 24, gap: 8 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New project name"
          style={{ flex: "1 1 280px", maxWidth: 360 }}
        />
        <button className="primary" type="submit" disabled={!newName.trim()}>+ Start project</button>
      </form>

      <div className="dashboard-grid">
        <ProjectsKanban projects={projects} />
        <FinancialsSummary projects={projects} expenses={expenses} invoices={invoices} />
      </div>

      <TodoList
        todos={todos}
        setTodos={setTodos}
        projects={projects}
        invoices={invoices}
        dismissed={dismissed}
        onDismiss={dismissSuggestion}
      />
    </div>
  );
}

// ── Summary of Projects (Kanban by status) ───────────────────────────

function ProjectsKanban({ projects }) {
  const byStatus = useMemo(() => {
    const m = new Map(STATUS_OPTIONS.map((s) => [s, []]));
    m.set("(other)", []);
    for (const p of projects) {
      const k = isKnownStatus(p.status) ? p.status : "(other)";
      m.get(k).push(p);
    }
    return m;
  }, [projects]);

  return (
    <div className="card dashboard-card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Summary of projects</h2>
        <Link to="/projects" className="text-muted" style={{ fontSize: 13 }}>See all →</Link>
      </div>
      <div className="kanban">
        {STATUS_OPTIONS.map((status) => (
          <KanbanColumn key={status} status={status} projects={byStatus.get(status) ?? []} />
        ))}
        {(byStatus.get("(other)") ?? []).length > 0 && (
          <KanbanColumn status="No status" projects={byStatus.get("(other)") ?? []} />
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ status, projects }) {
  return (
    <div className="kanban-col">
      <div className="kanban-col-head">
        <span className="kanban-col-title">{status}</span>
        <span className="kanban-col-count">{projects.length}</span>
      </div>
      <div className="kanban-col-body">
        {projects.length === 0 && (
          <div className="text-subtle" style={{ fontSize: 12, padding: "6px 4px" }}>—</div>
        )}
        {projects.map((p) => (
          <Link key={p.id} to={`/projects/${p.id}`} className="kanban-card">
            <div className="kanban-card-name">{p.name}</div>
            {p.info?.buyerName && (
              <div className="kanban-card-client text-muted">{p.info.buyerName}</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Summary of Financials (pie chart + AR list) ──────────────────────

function FinancialsSummary({ projects, expenses, invoices }) {
  const totals = useMemo(() => {
    const revenue = projects.reduce((s, p) => s + projectSummary(p).clientReceived, 0);
    const cogs = projects.reduce((s, p) => s + projectSummary(p).supplierPaid, 0);
    const opex = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    let commissionsPaid = 0;
    for (const inv of invoices) {
      const amt = Number(inv.commissionAmount) || 0;
      if (inv.paymentStatus === "paid") commissionsPaid += amt;
      else if (inv.paymentStatus === "partial") commissionsPaid += Number(inv.paidAmount) || 0;
    }
    const netProfit = revenue - cogs - opex - commissionsPaid;
    return { revenue, cogs, opex, commissionsPaid, netProfit };
  }, [projects, expenses, invoices]);

  // Outstanding AR — flat list: project, client, amount owed.
  const arRows = useMemo(() => {
    return projects
      .map((p) => ({
        id: p.id,
        name: p.name,
        client: p.info?.buyerName || p.info?.company || "—",
        owed: projectSummary(p).clientOutstanding,
      }))
      .filter((r) => r.owed > 0)
      .sort((a, b) => b.owed - a.owed);
  }, [projects]);

  // Slices for the pie. If profitable, show 4 slices that sum to revenue.
  // If we're at a loss, drop the (negative) profit slice and show a banner
  // with the deficit — a pie can't render a negative slice meaningfully.
  const profitable = totals.netProfit >= 0;
  const slices = profitable
    ? [
        { key: "cogs",        label: "COGS (suppliers)",   value: totals.cogs,           color: "#94251A" },
        { key: "opex",        label: "Operating expenses", value: totals.opex,           color: "#C68B00" },
        { key: "commissions", label: "Commissions paid",   value: totals.commissionsPaid, color: "#74521C" },
        { key: "profit",      label: "Net profit",         value: totals.netProfit,      color: "#15623F" },
      ]
    : [
        { key: "cogs",        label: "COGS (suppliers)",   value: totals.cogs,           color: "#94251A" },
        { key: "opex",        label: "Operating expenses", value: totals.opex,           color: "#C68B00" },
        { key: "commissions", label: "Commissions paid",   value: totals.commissionsPaid, color: "#74521C" },
      ];

  return (
    <div className="card dashboard-card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Summary of financials</h2>
        <Link to="/financials" className="text-muted" style={{ fontSize: 13 }}>See all →</Link>
      </div>

      <div className="row" style={{ gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <MultiSlicePie slices={slices} size={180} />
        <div style={{ flex: 1, minWidth: 200 }}>
          {slices.map((s) => (
            <SliceRow key={s.key} color={s.color} label={s.label} value={s.value} total={totals.revenue} />
          ))}
          <div style={{ borderTop: "1px solid #eee", marginTop: 8, paddingTop: 8 }}>
            <SliceRow color="#333" label="Revenue" value={totals.revenue} total={totals.revenue} bold />
            <div style={{ fontSize: 14, marginTop: 6 }}>
              <strong style={{ color: profitable ? "var(--color-success)" : "var(--color-error)" }}>
                {profitable ? "Net profit" : "Net loss"}: {money(profitable ? totals.netProfit : -totals.netProfit)}
              </strong>
              {totals.revenue > 0 && (
                <span className="text-subtle" style={{ marginLeft: 6, fontSize: 12 }}>
                  ({Math.round((totals.netProfit / totals.revenue) * 100)}% margin)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #eee" }}>
        <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 6 }}>
          What clients owe us
        </div>
        {arRows.length === 0 ? (
          <div className="text-subtle" style={{ fontSize: 13 }}>Nothing outstanding.</div>
        ) : (
          <table style={{ background: "transparent", border: "none" }}>
            <thead>
              <tr><th>Project</th><th>Client</th><th style={{ textAlign: "right" }}>Amount owed</th></tr>
            </thead>
            <tbody>
              {arRows.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/projects/${r.id}`}>{r.name}</Link></td>
                  <td className="text-muted">{r.client}</td>
                  <td style={{ textAlign: "right", color: "var(--color-error)", fontWeight: 600 }}>{money(r.owed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SliceRow({ color, label, value, total, bold }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
      <span>
        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, marginRight: 6, verticalAlign: "middle" }} />
        <span style={{ fontWeight: bold ? 600 : 400 }}>{label}</span>
      </span>
      <span style={{ fontWeight: bold ? 700 : 500 }}>
        {money(value)}
        {!bold && total > 0 && <span className="text-subtle" style={{ marginLeft: 6, fontSize: 11 }}>({pct}%)</span>}
      </span>
    </div>
  );
}

// Multi-slice SVG pie. Slices sweep clockwise from 12 o'clock. Slices
// with zero or negative value are skipped (the chart only renders the
// positive portion — the parent decides what to do with deficits).
function MultiSlicePie({ slices, size = 160 }) {
  const r = size / 2;
  const cx = r, cy = r;
  const positives = slices.filter((s) => s.value > 0);
  const total = positives.reduce((s, x) => s + x.value, 0);

  if (total <= 0) {
    return (
      <svg width={size} height={size} role="img" aria-label="No data">
        <circle cx={cx} cy={cy} r={r - 1} fill="#D6D3CD" />
      </svg>
    );
  }
  if (positives.length === 1) {
    return (
      <svg width={size} height={size} role="img" aria-label={positives[0].label}>
        <circle cx={cx} cy={cy} r={r - 1} fill={positives[0].color} />
      </svg>
    );
  }

  let angleStart = 0;
  return (
    <svg width={size} height={size} role="img" aria-label="Financial breakdown">
      {positives.map((s) => {
        const frac = s.value / total;
        const angleEnd = angleStart + frac * Math.PI * 2;
        const x0 = cx + r * Math.sin(angleStart);
        const y0 = cy - r * Math.cos(angleStart);
        const x1 = cx + r * Math.sin(angleEnd);
        const y1 = cy - r * Math.cos(angleEnd);
        const largeArc = frac > 0.5 ? 1 : 0;
        const d = `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
        angleStart = angleEnd;
        return <path key={s.key} d={d} fill={s.color}><title>{`${s.label}: ${money(s.value)}`}</title></path>;
      })}
    </svg>
  );
}

// ── TO-DO list ──────────────────────────────────────────────────────

function TodoList({ todos, setTodos, projects, invoices, dismissed, onDismiss }) {
  const [draft, setDraft] = useState("");

  const suggestions = useMemo(
    () => buildSuggestions({ projects, invoices }).filter((s) => !dismissed.has(s.id)),
    [projects, invoices, dismissed]
  );

  async function addTodo(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const t = await api.createTodo(text);
    setTodos((prev) => [t, ...prev]);
    setDraft("");
  }

  async function toggleDone(id, done) {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done } : t)));
    try { await api.updateTodo(id, { done }); }
    catch (err) { console.error("todo update failed:", err); }
  }

  async function removeTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try { await api.deleteTodo(id); }
    catch (err) { console.error("todo delete failed:", err); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>To-do</h2>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
        Things to do to keep the business running smooth. Suggestions come from project state automatically — dismiss the ones you don't care about. Add your own below.
      </p>

      {suggestions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 6 }}>
            Suggested ({suggestions.length})
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {suggestions.map((s) => (
              <li key={s.id} className="todo-suggestion">
                <span style={{ marginRight: 8 }}>{s.icon}</span>
                <span style={{ flex: 1 }}>{s.linkTo ? <Link to={s.linkTo}>{s.text}</Link> : s.text}</span>
                <button onClick={() => onDismiss(s.id)} title="Dismiss this suggestion" style={{ fontSize: 12 }}>Dismiss</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={addTodo} className="row" style={{ marginTop: 8, gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item…"
          style={{ flex: 1 }}
        />
        <button className="primary" type="submit" disabled={!draft.trim()}>Add</button>
      </form>

      {todos.length === 0 ? (
        <div className="text-subtle" style={{ fontSize: 13, marginTop: 12 }}>
          No manual to-dos yet.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
          {todos.map((t) => (
            <li key={t.id} className={`todo-item${t.done ? " done" : ""}`}>
              <input
                type="checkbox"
                checked={!!t.done}
                onChange={(e) => toggleDone(t.id, e.target.checked)}
                style={{ marginRight: 8 }}
              />
              <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "var(--color-text-muted)" : "inherit" }}>
                {t.text}
              </span>
              <button onClick={() => removeTodo(t.id)} style={{ fontSize: 12 }}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function buildSuggestions({ projects, invoices }) {
  const out = [];

  for (const p of projects) {
    // Open client questions
    const openQs = (p.items ?? []).filter((it) => it.needsAttention && !(it.clientResponse ?? "").trim());
    if (openQs.length > 0) {
      out.push({
        id: `questions:${p.id}`,
        icon: "❓",
        text: `${p.name} — ${openQs.length} unresolved client question${openQs.length === 1 ? "" : "s"}`,
        linkTo: `/projects/${p.id}`,
      });
    }
    // Outstanding AR
    const sum = projectSummary(p);
    if (sum.clientOutstanding > 0 && sum.clientReceived > 0) {
      // Only nag once at least one payment has come in (otherwise the
      // contract is just unpaid — that's normal pre-invoice state).
      out.push({
        id: `ar:${p.id}`,
        icon: "💰",
        text: `Collect ${money(sum.clientOutstanding)} from ${p.info?.buyerName || p.name}`,
        linkTo: `/projects/${p.id}`,
      });
    }
    // Awaiting shipment
    if (p.status === "Awaiting shipment") {
      out.push({
        id: `ship:${p.id}`,
        icon: "📦",
        text: `${p.name} is awaiting shipment — confirm ETA`,
        linkTo: `/projects/${p.id}`,
      });
    }
    // Waiting for quote with no quotes yet
    if (p.status === "Waiting for quote" && (p.quotes ?? []).length === 0) {
      out.push({
        id: `quote:${p.id}`,
        icon: "📋",
        text: `${p.name} — chase suppliers for quotes`,
        linkTo: `/projects/${p.id}`,
      });
    }
  }

  // Unpaid salesperson invoices older than 7 days
  const nowMs = Date.now();
  for (const inv of invoices) {
    if (inv.paymentStatus === "paid") continue;
    const issued = new Date(inv.issuedAt).getTime();
    if (Number.isNaN(issued)) continue;
    const ageDays = (nowMs - issued) / (1000 * 60 * 60 * 24);
    if (ageDays >= 7) {
      out.push({
        id: `inv:${inv.id}`,
        icon: "🧾",
        text: `Pay ${inv.salespersonSnapshot?.name || "salesperson"} — invoice ${inv.invoiceNumber} (${money(inv.commissionAmount)}, ${Math.floor(ageDays)}d old)`,
        linkTo: `/invoices/${inv.id}`,
      });
    }
  }

  return out;
}
