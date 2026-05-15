import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../lib/financials.js";

// Renders the Salespeople sub-tab inside the Financials page.
// Three sections:
//   1. Roster — manage salespeople records
//   2. Project sale assignments — attach a salesperson + commission to each
//      project and generate an invoice from there
//   3. All invoices — full invoice log

export default function Salespeople() {
  const [salespeople, setSalespeople] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingFor, setGeneratingFor] = useState(null);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listSalespeople(), api.listInvoices(), api.listProjects()])
      .then(([sp, inv, ps]) => {
        if (cancelled) return;
        setSalespeople(sp);
        setInvoices(inv);
        setProjects(ps);
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

  async function removeInvoice(inv) {
    const label = `${inv.invoiceNumber} (${inv.salespersonSnapshot?.name || "salesperson"})`;
    if (!confirm(`Delete invoice ${label}? This can't be undone.`)) return;
    setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    try { await api.deleteInvoice(inv.id); }
    catch (err) { console.error("invoice delete failed:", err); }
  }

  // Patch a project's `sale` object — optimistic local + PATCH to server.
  async function updateProjectSale(projectId, patch) {
    setProjects((prev) => prev.map((p) => (
      p.id === projectId
        ? { ...p, sale: { ...(p.sale ?? {}), ...patch } }
        : p
    )));
    try {
      const proj = projects.find((p) => p.id === projectId);
      const nextSale = { ...(proj?.sale ?? {}), ...patch };
      await api.updateProject(projectId, { sale: nextSale });
    } catch (err) {
      console.error("project sale update failed:", err);
    }
  }

  async function generateForProject(projectId) {
    setGenerateError("");
    setGeneratingFor(projectId);
    try {
      const inv = await api.generateInvoice(projectId);
      setInvoices((prev) => [inv, ...prev]);
    } catch (err) {
      setGenerateError(`${(projects.find((p) => p.id === projectId)?.name || "Project")}: ${err.message || err}`);
    } finally {
      setGeneratingFor(null);
    }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* ── Roster ─────────────────────────────────────────────────── */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Roster</h2>
        <button onClick={addSalesperson}>+ Add salesperson</button>
      </div>
      <div className="card" style={{ marginBottom: 24, padding: 0, overflowX: "auto" }}>
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

      {/* ── Project sale assignments ───────────────────────────────── */}
      <h2 style={{ margin: "0 0 8px" }}>Project sale assignments</h2>
      <p className="text-muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
        Attach a salesperson and commission rate to each project. Hit <strong>Generate invoice</strong> once the sale is locked in — it creates a new commission invoice for the salesperson.
      </p>
      {generateError && <div className="card error" style={{ marginBottom: 12 }}>{generateError}</div>}
      <div className="card" style={{ marginBottom: 24, padding: 0, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Salesperson</th>
              <th>Sale price ($)</th>
              <th>Rate (%)</th>
              <th>Sale date</th>
              <th>Commission</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr><td colSpan={7} className="text-subtle">No projects yet.</td></tr>
            )}
            {projects.map((p) => {
              const sale = p.sale ?? {};
              const price = Number(sale.salePrice) || 0;
              const rate = Number(sale.commissionRate) || 0;
              const commission = price * rate / 100;
              const canGenerate = Boolean(sale.salespersonId && price > 0 && rate > 0);
              const generating = generatingFor === p.id;
              return (
                <tr key={p.id}>
                  <td><Link to={`/projects/${p.id}`}><strong>{p.name}</strong></Link></td>
                  <td>
                    <select
                      value={sale.salespersonId ?? ""}
                      onChange={(e) => updateProjectSale(p.id, { salespersonId: e.target.value })}
                      style={{ minWidth: 180 }}
                    >
                      <option value="">— none —</option>
                      {salespeople.map((s) => (
                        <option key={s.id} value={s.id}>{s.name || "(unnamed)"}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      value={sale.salePrice ?? 0}
                      onChange={(e) => updateProjectSale(p.id, { salePrice: Number(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      style={{ width: 110 }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={sale.commissionRate ?? 0}
                      onChange={(e) => updateProjectSale(p.id, { commissionRate: Number(e.target.value) || 0 })}
                      onFocus={(e) => e.target.select()}
                      style={{ width: 70 }}
                    />
                  </td>
                  <td>
                    <input
                      type="date"
                      value={sale.saleDate ?? ""}
                      onChange={(e) => updateProjectSale(p.id, { saleDate: e.target.value })}
                    />
                  </td>
                  <td style={{ fontWeight: 600, color: commission > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                    {money(commission)}
                  </td>
                  <td>
                    <button
                      onClick={() => generateForProject(p.id)}
                      disabled={!canGenerate || generating}
                      title={canGenerate ? "Create a new commission invoice for this sale" : "Pick a salesperson and set sale price + commission rate first"}
                    >
                      {generating ? "Generating…" : "Generate invoice"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── All invoices ───────────────────────────────────────────── */}
      <h2 style={{ margin: "0 0 12px" }}>All invoices</h2>
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
            <tr><td colSpan={10} className="text-subtle">No invoices generated yet. Pick a salesperson on a project above and hit <strong>Generate invoice</strong>.</td></tr>
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
                  color: inv.paymentStatus === "paid" ? "var(--color-success)" : inv.paymentStatus === "partial" ? "var(--color-warning)" : "var(--color-text-muted)",
                }}>
                  {inv.paymentStatus}
                </span>
              </td>
              <td>
                <div className="row" style={{ gap: 6, alignItems: "center", justifyContent: "flex-end" }}>
                  <Link to={`/invoices/${inv.id}`}>Open →</Link>
                  <button onClick={() => removeInvoice(inv)} title="Delete this invoice">×</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
