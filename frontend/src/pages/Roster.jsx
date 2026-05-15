import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { money } from "../lib/financials.js";

// Renders the "Roster" sub-tab under Financials — the master list of
// salespeople with their contact info, default payment method, and
// rolled-up invoice stats (count, outstanding, paid YTD).

export default function Roster() {
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
      .catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

  // Per-salesperson invoice stats — total unpaid, YTD-paid total, count.
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
      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Roster ({salespeople.length})</h2>
        <button onClick={addSalesperson}>+ Add salesperson</button>
      </div>
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
                <td style={{ color: stats.unpaid > 0 ? "var(--color-error)" : "var(--color-text-muted)", fontWeight: 600 }}>
                  {money(stats.unpaid)}
                </td>
                <td style={{ color: "var(--color-success)" }}>{money(stats.paid)}</td>
                <td><button onClick={() => removeSalesperson(s.id)} title="Delete salesperson">×</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
