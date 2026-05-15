import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../lib/financials.js";

// Renders the "Invoices" sub-tab under Financials. Master list of every
// salesperson invoice with stage indicator + open/delete actions.

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.listInvoices()
      .then((inv) => { if (!cancelled) { setInvoices(inv); setLoading(false); } })
      .catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

  async function removeInvoice(inv) {
    const label = `${inv.invoiceNumber} (${inv.salespersonSnapshot?.name || "salesperson"})`;
    if (!confirm(`Delete invoice ${label}? This can't be undone.`)) return;
    setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    try { await api.deleteInvoice(inv.id); }
    catch (err) { console.error("invoice delete failed:", err); }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}
      <h2 style={{ margin: "0 0 12px" }}>All invoices ({invoices.length})</h2>
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
            <tr><td colSpan={10} className="text-subtle">No invoices yet. Open the <strong>Salespeople</strong> sub-tab, attach a salesperson to a project, and hit <strong>Generate invoice</strong>.</td></tr>
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
