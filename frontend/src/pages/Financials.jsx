import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { money, projectSummary, todayIso } from "../lib/financials.js";
import { Ledger } from "./MoneyTab.jsx";

export default function Financials() {
  const [projects, setProjects] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listProjects(), api.listCompanyExpenses()])
      .then(([ps, es]) => {
        if (cancelled) return;
        setProjects(ps);
        setExpenses(es);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(
    () => projects.map((p) => ({ project: p, summary: projectSummary(p) })),
    [projects]
  );

  const totals = useMemo(() => {
    let quoted = 0, received = 0, outstanding = 0, supplierPaid = 0;
    for (const { summary } of rows) {
      quoted += summary.clientQuoted;
      received += summary.clientReceived;
      outstanding += summary.clientOutstanding;
      supplierPaid += summary.supplierPaid;
    }
    const companyExpenses = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const projectProfit = received - supplierPaid;
    const netProfit = projectProfit - companyExpenses;
    return { quoted, received, outstanding, supplierPaid, companyExpenses, projectProfit, netProfit };
  }, [rows, expenses]);

  async function addExpense() {
    const created = await api.createCompanyExpense({
      date: todayIso(),
      payee: "",
      amount: 0,
      category: "",
      notes: "",
    });
    setExpenses((prev) => [created, ...prev]);
  }

  async function updateExpense(id, patch) {
    // Optimistic apply locally; don't overwrite with the server response,
    // since per-keystroke PATCHes can finish out of order and clobber
    // freshly typed input.
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    try {
      await api.updateCompanyExpense(id, patch);
    } catch (err) {
      console.error("expense update failed:", err);
    }
  }

  async function removeExpense(id) {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    try {
      await api.deleteCompanyExpense(id);
    } catch (err) {
      console.error("expense delete failed:", err);
    }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Financials</h1>
      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Company-wide totals</h3>
        <div className="row" style={{ gap: 28, flexWrap: "wrap" }}>
          <Stat label="Client quoted (all projects)" value={money(totals.quoted)} />
          <Stat label="Client paid in" value={money(totals.received)} color="#15623F" />
          <Stat
            label="Outstanding AR"
            value={money(totals.outstanding)}
            color={totals.outstanding > 0 ? "#94251A" : "#666"}
            hint="client still owes us"
          />
          <Stat label="Paid to suppliers" value={money(totals.supplierPaid)} color="#94251A" />
          <Stat label="Company expenses" value={money(totals.companyExpenses)} color="#94251A" hint="non-project overhead" />
          <Stat
            label="Project profit"
            value={money(totals.projectProfit)}
            color={totals.projectProfit >= 0 ? "#15623F" : "#94251A"}
            hint="client paid − supplier paid"
          />
          <Stat
            label="Net profit"
            value={money(totals.netProfit)}
            color={totals.netProfit >= 0 ? "#15623F" : "#94251A"}
            big
            hint="incl. company expenses"
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Per-project rollup</h3>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Quoted</th>
              <th>Received</th>
              <th>Outstanding</th>
              <th>Supplier paid</th>
              <th>Profit so far</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ project, summary }) => (
              <tr key={project.id}>
                <td><strong>{project.name}</strong></td>
                <td>{money(summary.clientQuoted)}</td>
                <td>{money(summary.clientReceived)}</td>
                <td style={{ color: summary.clientOutstanding > 0 ? "#94251A" : "#666" }}>
                  {money(summary.clientOutstanding)}
                </td>
                <td>{money(summary.supplierPaid)}</td>
                <td style={{ color: summary.profit >= 0 ? "#15623F" : "#94251A", fontWeight: 600 }}>
                  {money(summary.profit)}
                </td>
                <td><Link to={`/projects/${project.id}`}>Open →</Link></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="text-subtle">No projects yet.</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td style={{ fontWeight: 600 }}>Totals</td>
                <td style={{ fontWeight: 600 }}>{money(totals.quoted)}</td>
                <td style={{ fontWeight: 600 }}>{money(totals.received)}</td>
                <td style={{ fontWeight: 600 }}>{money(totals.outstanding)}</td>
                <td style={{ fontWeight: 600 }}>{money(totals.supplierPaid)}</td>
                <td style={{ fontWeight: 600, color: totals.projectProfit >= 0 ? "#15623F" : "#94251A" }}>
                  {money(totals.projectProfit)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Ledger
        title="Company expenses (non-project)"
        emptyMessage="No company expenses logged yet. Use this for rent, software, contractors, overhead — anything not tied to a single project."
        rows={expenses}
        onAdd={addExpense}
        onUpdate={updateExpense}
        onRemove={removeExpense}
        columns={[
          { key: "date", label: "Date", type: "date", width: 130 },
          { key: "payee", label: "Paid to", type: "text", width: 200 },
          { key: "category", label: "Category", type: "text", width: 160, placeholder: "Rent / Software / Contractor" },
          { key: "amount", label: "Amount ($)", type: "number", width: 120 },
          { key: "notes", label: "Notes", type: "text", width: 280 },
        ]}
        footerLabel="Total"
        footerValue={money(totals.companyExpenses)}
      />
    </div>
  );
}

function Stat({ label, value, color, big, hint }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 24 : 18, fontWeight: 700, color: color || "#222", marginTop: 4 }}>
        {value}
      </div>
      {hint && <div className="text-subtle" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}
