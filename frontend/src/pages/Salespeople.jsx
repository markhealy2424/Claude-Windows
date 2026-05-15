import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../lib/financials.js";

export default function Salespeople() {
  const [salespeople, setSalespeople] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listSalespeople(), api.listInvoices()])
      .then(([sp, inv]) => {
        if (cancelled) return;
        setSalespeople(sp);
        setInvoices(inv);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e));
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // For each salesperson, sum unpaid commission across their invoices,
  // YTD-paid total, and invoice count.
  const summaryBySalesperson = useMemo(() => {
    const map = new Map();
    for (const inv of invoices) {
      const m = map.get(inv.salespersonId) ?? { unpaid: 0, paid: 0, count: 0 };
      m.count += 1;
      const amt = Number(inv.commissionAmount) || 0;
      if (inv.paymentStatus === "paid") m.paid += amt;
      else if (inv.paymentStatus === "partial") {
        m.paid += Number(inv.paidAmount) || 0;
        m.unpaid += amt - (Number(inv.paidAmount) || 0);
      } else {
        m.unpaid += amt;
      }
      map.set(inv.salespersonId, m);
    }
    return map;
  }, [invoices]);

  async function addSalesperson() {
    const created = await api.createSalesperson({ name: "" });
    setSalespeople((prev) => [...prev, created]);
  }

  async function updateField(id, patch) {
    setSalespeople((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try { await api.updateSalesperson(id, patch); }
    catch (err) { console.error("salesperson update failed:", err); }
  }

  async function removeSalesperson(id) {
    if (!confirm("Delete this salesperson? Invoices already issued will keep their record.")) return;
    setSalespeople((prev) => prev.filter((s) => s.id !== id));
    try { await api.deleteSalesperson(id); }
    catch (err) { console.error("salesperson delete failed:", err); }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Salespeople</h1>
        <button onClick={addSalesperson}>+ Add salesperson</button>
      </div>

      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16, padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Default payment</th>
              <th>Invoices</th>
              <th>Owed</th>
              <th>Paid YTD</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {salespeople.length === 0 && (
              <tr><td colSpan={8} className="text-subtle">No salespeople yet. Click <strong>+ Add salesperson</strong> to start.</td></tr>
            )}
            {salespeople.map((s) => {
              const stats = summaryBySalesperson.get(s.id) ?? { unpaid: 0, paid: 0, count: 0 };
              return (
                <tr key={s.id}>
                  <td>
                    <input
                      value={s.name ?? ""}
                      placeholder="Salesperson name"
                      onChange={(e) => updateField(s.id, { name: e.target.value })}
                      style={{ width: 180, fontWeight: 600 }}
                    />
                  </td>
                  <td>
                    <input
                      type="email"
                      value={s.email ?? ""}
                      placeholder="email@example.com"
                      onChange={(e) => updateField(s.id, { email: e.target.value })}
                      style={{ width: 200 }}
                    />
                  </td>
                  <td>
                    <input
                      type="tel"
                      value={s.phone ?? ""}
                      placeholder="555-555-5555"
                      onChange={(e) => updateField(s.id, { phone: e.target.value })}
                      style={{ width: 140 }}
                    />
                  </td>
                  <td>
                    <input
                      value={s.defaultPaymentMethod ?? ""}
                      placeholder="Zelle / ACH / check"
                      onChange={(e) => updateField(s.id, { defaultPaymentMethod: e.target.value })}
                      style={{ width: 140 }}
                    />
                  </td>
                  <td className="text-muted">{stats.count}</td>
                  <td style={{ color: stats.unpaid > 0 ? "#94251A" : "#666", fontWeight: 600 }}>
                    {money(stats.unpaid)}
                  </td>
                  <td style={{ color: "#15623F" }}>{money(stats.paid)}</td>
                  <td><button onClick={() => removeSalesperson(s.id)} title="Delete salesperson">×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 style={{ margin: "24px 0 12px" }}>All invoices</h2>
      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Issued</th>
            <th>Salesperson</th>
            <th>Project</th>
            <th>Client</th>
            <th>Sale price</th>
            <th>Rate</th>
            <th>Commission</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {invoices.length === 0 && (
            <tr><td colSpan={10} className="text-subtle">No invoices generated yet. Open a project's <strong>Money</strong> tab to create one.</td></tr>
          )}
          {invoices.map((inv) => (
            <tr key={inv.id}>
              <td><Link to={`/invoices/${inv.id}`}><strong>{inv.invoiceNumber}</strong></Link></td>
              <td className="text-muted">{new Date(inv.issuedAt).toLocaleDateString()}</td>
              <td>{inv.salespersonSnapshot?.name || "—"}</td>
              <td><Link to={`/projects/${inv.projectId}`}>{inv.projectName || "—"}</Link></td>
              <td>{inv.clientName || "—"}</td>
              <td>{money(inv.salePrice)}</td>
              <td>{inv.commissionRate}%</td>
              <td style={{ fontWeight: 600 }}>{money(inv.commissionAmount)}</td>
              <td>
                <span style={{
                  fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600,
                  color: inv.paymentStatus === "paid" ? "#15623F" : inv.paymentStatus === "partial" ? "#94251A" : "#666",
                }}>
                  {inv.paymentStatus}
                </span>
              </td>
              <td><Link to={`/invoices/${inv.id}`}>Open →</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
