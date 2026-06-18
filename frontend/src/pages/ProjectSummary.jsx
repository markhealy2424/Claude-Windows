import { useMemo, useState } from "react";
import { money, projectSummary } from "../lib/financials.js";
import { StatusSelect } from "./Dashboard.jsx";

// Project-scoped dashboard. Three sections:
//   1. Hero stat row — status, money headline, open to-dos
//   2. Money details — per-project P&L breakdown (client + supplier + profit)
//   3. To-do list — auto-suggestions derived from project state + manual
//      to-dos persisted on project.todos
//
// This is the default landing tab when a project is opened.

export default function ProjectSummary({ project, onChange }) {
  const fin = useMemo(() => projectSummary(project), [project]);
  const items = project.items ?? [];
  const plans = project.plans ?? [];
  const quotes = project.quotes ?? [];
  const todos = project.todos ?? [];

  const suggestions = useMemo(
    () => buildProjectSuggestions(project, fin),
    [project, fin]
  );

  const openTodoCount = todos.filter((t) => !t.done).length + suggestions.length;

  return (
    <div>
      <HeroStats
        project={project}
        fin={fin}
        openTodoCount={openTodoCount}
        onStatusChange={(status) => onChange({ status })}
      />
      <ProjectStats project={project} items={items} plans={plans} quotes={quotes} />
      <MoneyDetails fin={fin} />
      <TodoList
        suggestions={suggestions}
        todos={todos}
        onChange={(next) => onChange({ todos: next })}
      />
    </div>
  );
}

// ── Hero (3 stat cards) ──────────────────────────────────────────────

function HeroStats({ project, fin, openTodoCount, onStatusChange }) {
  const pctCollected = fin.clientQuoted > 0
    ? Math.round((fin.clientReceived / fin.clientQuoted) * 100)
    : 0;

  return (
    <div className="summary-hero">
      <div className="stat-card">
        <div className="stat-label">Status</div>
        {/* Status is editable here on the Project Summary tab — moved off
            the page header so it's not duplicated across every sub-tab. */}
        <div style={{ marginTop: 6, marginBottom: 4 }}>
          <StatusSelect
            className="status-pill"
            value={project.status}
            onChange={onStatusChange}
          />
        </div>
        <div className="stat-sub">
          {project.info?.address || "No address set"}
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-label">Revenue</div>
        <div className="stat-num">{money(fin.clientReceived)}</div>
        <div className="stat-sub">
          {fin.clientQuoted > 0
            ? <>of {money(fin.clientQuoted)} quoted · <strong>{pctCollected}%</strong> collected</>
            : <>no client quote on file yet</>}
        </div>
      </div>

      <div className={`stat-card ${openTodoCount > 0 ? "stat-card--warn" : ""}`}>
        <div className="stat-label">Open to-dos</div>
        <div className={`stat-num ${openTodoCount > 0 ? "stat-num--warn" : ""}`}>{openTodoCount}</div>
        <div className="stat-sub">
          {openTodoCount === 0
            ? "Nothing waiting on you"
            : `${openTodoCount} action${openTodoCount === 1 ? "" : "s"} need attention`}
        </div>
      </div>
    </div>
  );
}

// ── Project stats card (counts + dates) ──────────────────────────────

function ProjectStats({ project, items, plans, quotes }) {
  const startedAt = project.createdAt ? new Date(project.createdAt) : null;
  const daysActive = startedAt
    ? Math.max(0, Math.floor((Date.now() - startedAt.getTime()) / 86400000))
    : null;

  const lastEdited = lastActivityAt(project);
  const lastEditedRel = lastEdited ? relativeDays(lastEdited) : null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Project stats</h3>
        {startedAt && (
          <span className="text-muted" style={{ fontSize: 13 }}>
            Started {startedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {daysActive !== null && <> · {daysActive} day{daysActive === 1 ? "" : "s"} active</>}
          </span>
        )}
      </div>
      <div className="summary-stats-grid">
        <SimpleStat label="Items" value={items.length} />
        <SimpleStat label="Plans uploaded" value={plans.length} />
        <SimpleStat label="Supplier quotes" value={quotes.length} />
        <SimpleStat
          label="Last activity"
          value={lastEditedRel || "—"}
          small={!lastEditedRel}
        />
      </div>
    </div>
  );
}

function SimpleStat({ label, value, small }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "var(--font-serif)",
        fontSize: small ? 16 : 22,
        fontWeight: 600,
        marginTop: 4,
        letterSpacing: "-0.01em"
      }}>
        {value}
      </div>
    </div>
  );
}

// ── Money details — full P&L breakdown ───────────────────────────────

function MoneyDetails({ fin }) {
  const clientPct = fin.clientQuoted > 0
    ? Math.round((fin.clientReceived / fin.clientQuoted) * 100)
    : 0;
  const supplierPct = fin.supplierTotalCost > 0
    ? Math.round((fin.supplierPaid / fin.supplierTotalCost) * 100)
    : 0;
  const marginPct = fin.clientQuoted > 0
    ? Math.round((fin.plannedProfit / fin.clientQuoted) * 100)
    : 0;
  const isProfitable = fin.plannedProfit >= 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 16 }}>Money details</h3>
      <div className="money-grid">
        <div>
          <div className="money-side-label">Client side</div>
          <MoneyRow label="Quoted" value={fin.clientQuoted} />
          <MoneyRow label="Received" value={fin.clientReceived} suffix={fin.clientQuoted > 0 && ` · ${clientPct}%`} accent="success" />
          <MoneyRow label="Outstanding" value={fin.clientOutstanding} accent={fin.clientOutstanding > 0 ? "warning" : null} />
        </div>
        <div>
          <div className="money-side-label">Supplier side</div>
          <MoneyRow label="Total cost" value={fin.supplierTotalCost} />
          <MoneyRow label="Paid" value={fin.supplierPaid} suffix={fin.supplierTotalCost > 0 && ` · ${supplierPct}%`} />
          <MoneyRow label="Outstanding" value={fin.supplierOutstanding} accent={fin.supplierOutstanding > 0 ? "warning" : null} />
        </div>
      </div>

      <div style={{
        marginTop: 16,
        paddingTop: 12,
        borderTop: "1px solid var(--color-divider)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 12,
      }}>
        <div>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
            Projected profit
          </div>
          <div style={{
            fontFamily: "var(--font-serif)",
            fontSize: 28,
            fontWeight: 600,
            marginTop: 2,
            color: isProfitable ? "var(--color-success)" : "var(--color-error)",
            letterSpacing: "-0.01em",
          }}>
            {money(fin.plannedProfit)}
          </div>
        </div>
        {fin.clientQuoted > 0 && (
          <div style={{ textAlign: "right" }}>
            <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
              Margin
            </div>
            <div style={{
              fontFamily: "var(--font-serif)",
              fontSize: 22,
              fontWeight: 600,
              marginTop: 2,
              color: isProfitable ? "var(--color-success)" : "var(--color-error)",
            }}>
              {marginPct}%
            </div>
          </div>
        )}
      </div>

      {fin.clientQuoted === 0 && fin.supplierTotalCost === 0 && (
        <div className="text-subtle" style={{ fontSize: 13, marginTop: 12 }}>
          No money tracked yet. Enter client quote and supplier costs on the <strong>Financial</strong> tab to see this project's P&amp;L.
        </div>
      )}
    </div>
  );
}

function MoneyRow({ label, value, suffix, accent }) {
  const color =
    accent === "success" ? "var(--color-success)" :
    accent === "warning" ? "var(--color-warning)" :
    accent === "error" ? "var(--color-error)" :
    "var(--color-text)";
  return (
    <div className="money-row">
      <span className="text-muted">{label}</span>
      <span style={{ color, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {money(value)}
        {suffix && <span className="text-subtle" style={{ fontWeight: 400, marginLeft: 6 }}>{suffix}</span>}
      </span>
    </div>
  );
}

// ── To-do list ───────────────────────────────────────────────────────

function TodoList({ suggestions, todos, onChange }) {
  const [draft, setDraft] = useState("");

  function addTodo(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const next = [
      { id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() },
      ...todos,
    ];
    onChange(next);
    setDraft("");
  }

  function toggleDone(id, done) {
    onChange(todos.map((t) => (t.id === id ? { ...t, done } : t)));
  }

  function removeTodo(id) {
    onChange(todos.filter((t) => t.id !== id));
  }

  const openTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 6 }}>To-do list</h3>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Action items for this project. Suggestions come from project state automatically. Add your own below.
      </p>

      {suggestions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>
            Suggested ({suggestions.length})
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {suggestions.map((s) => (
              <li key={s.id} className="todo-suggestion">
                <span>{s.icon}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={addTodo} className="row" style={{ gap: 8, marginBottom: 12 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item for this project…"
          style={{ flex: 1 }}
        />
        <button className="primary" type="submit" disabled={!draft.trim()}>Add</button>
      </form>

      {openTodos.length === 0 && doneTodos.length === 0 ? (
        <div className="text-subtle" style={{ fontSize: 13 }}>
          No manual to-dos for this project yet.
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {openTodos.map((t) => (
            <TodoItem key={t.id} todo={t} onToggle={toggleDone} onRemove={removeTodo} />
          ))}
          {doneTodos.length > 0 && (
            <>
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, margin: "16px 0 6px" }}>
                Done ({doneTodos.length})
              </div>
              {doneTodos.map((t) => (
                <TodoItem key={t.id} todo={t} onToggle={toggleDone} onRemove={removeTodo} />
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  );
}

function TodoItem({ todo, onToggle, onRemove }) {
  return (
    <li className={`todo-item${todo.done ? " done" : ""}`}>
      <input
        type="checkbox"
        checked={!!todo.done}
        onChange={(e) => onToggle(todo.id, e.target.checked)}
        style={{ marginRight: 8 }}
      />
      <span style={{
        flex: 1,
        textDecoration: todo.done ? "line-through" : "none",
        color: todo.done ? "var(--color-text-muted)" : "inherit",
      }}>
        {todo.text}
      </span>
      <button onClick={() => onRemove(todo.id)} style={{ fontSize: 12 }}>×</button>
    </li>
  );
}

// ── Auto-suggestions for the project to-do list ──────────────────────

function buildProjectSuggestions(project, fin) {
  const out = [];

  const openQs = (project.items ?? []).filter(
    (it) => it.needsAttention && !(it.clientResponse ?? "").trim()
  );
  if (openQs.length > 0) {
    out.push({
      id: `questions`,
      icon: "❓",
      text: `${openQs.length} unresolved client question${openQs.length === 1 ? "" : "s"} — see Questions for Client tab`,
    });
  }

  if (fin.clientOutstanding > 0 && fin.clientReceived > 0) {
    out.push({
      id: "ar",
      icon: "💰",
      text: `Collect ${money(fin.clientOutstanding)} outstanding from client`,
    });
  }

  if (fin.supplierPaid > 0 && fin.clientReceived === 0) {
    out.push({
      id: "cashflow",
      icon: "⚠️",
      text: `Cash-flow risk: ${money(fin.supplierPaid)} paid to supplier, $0 received from client`,
    });
  }

  if (project.status === "Awaiting shipment") {
    out.push({
      id: "ship",
      icon: "📦",
      text: "Confirm shipment ETA with supplier",
    });
  }

  if (project.status === "Waiting for quote" && (project.quotes ?? []).length === 0) {
    out.push({
      id: "chase-quote",
      icon: "📋",
      text: "Chase suppliers — no quotes received yet",
    });
  }

  if (project.status === "Need to make RFQ" && (project.items ?? []).length > 0) {
    out.push({
      id: "make-rfq",
      icon: "📄",
      text: "Generate and send the RFQ to your suppliers",
    });
  }

  if ((project.quotes ?? []).length >= 2 && !project.proposal?.quoteId) {
    out.push({
      id: "pick-supplier",
      icon: "⚖️",
      text: "Multiple quotes received — run the Compare tab and pick a supplier",
    });
  }

  return out;
}

// ── Helpers ──────────────────────────────────────────────────────────

function lastActivityAt(project) {
  const candidates = [
    project.statusUpdatedAt,
    project.proposal?.updatedAt,
    ...(project.plans ?? []).map((p) => p.addedAt),
    ...(project.schedules ?? []).map((s) => s.addedAt),
    ...(project.quotes ?? []).map((q) => q.receivedAt),
  ].filter(Boolean).map((s) => new Date(s).getTime()).filter((n) => Number.isFinite(n));
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates));
}

function relativeDays(date) {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
