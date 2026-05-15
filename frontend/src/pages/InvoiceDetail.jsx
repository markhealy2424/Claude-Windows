import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../lib/financials.js";

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [allInvoices, setAllInvoices] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getInvoice(id), api.listInvoices()])
      .then(([inv, all]) => {
        if (cancelled) return;
        setInvoice(inv);
        setAllInvoices(all);
      })
      .catch((e) => !cancelled && setError(String(e)));
    return () => { cancelled = true; };
  }, [id]);

  // YTD paid commission to this salesperson — sum across all PAID invoices
  // for the same salesperson in the current calendar year.
  const ytdPaid = useMemo(() => {
    if (!invoice) return 0;
    const year = new Date(invoice.issuedAt).getFullYear();
    return allInvoices
      .filter((i) =>
        i.salespersonId === invoice.salespersonId &&
        i.paymentStatus === "paid" &&
        new Date(i.paidAt ?? i.issuedAt).getFullYear() === year
      )
      .reduce((s, i) => s + (Number(i.commissionAmount) || 0), 0);
  }, [invoice, allInvoices]);

  async function setStatus(paymentStatus) {
    const patch = { paymentStatus };
    if (paymentStatus === "paid") {
      patch.paidAmount = invoice.commissionAmount;
      patch.paidAt = new Date().toISOString();
    } else if (paymentStatus === "unpaid") {
      patch.paidAmount = 0;
      patch.paidAt = null;
    }
    const updated = await api.updateInvoice(id, patch);
    setInvoice(updated);
  }

  async function updateField(patch) {
    const updated = await api.updateInvoice(id, patch);
    setInvoice(updated);
  }

  async function deleteThisInvoice() {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    await api.deleteInvoice(id);
    navigate("/financials/invoices");
  }

  if (error) return <div className="card error">{error}</div>;
  if (!invoice) return <div>Loading…</div>;

  const sp = invoice.salespersonSnapshot ?? {};

  return (
    <div>
      <div className="invoice-actions">
        <div className="breadcrumb">
          <Link to="/financials/invoices">← Invoices</Link>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => window.print()}>Print / save PDF</button>
          <button onClick={deleteThisInvoice} title="Delete this invoice">Delete</button>
        </div>
      </div>

      <div className="invoice-page">
        <header className="invoice-header">
          <div>
            <div className="invoice-eyebrow">Commission invoice</div>
            <div className="invoice-number">{invoice.invoiceNumber}</div>
          </div>
          <div className="invoice-meta">
            <div><span className="invoice-meta-label">Issued</span> {fmtDate(invoice.issuedAt)}</div>
            {invoice.dueDate && <div><span className="invoice-meta-label">Due</span> {fmtDate(invoice.dueDate)}</div>}
            <div>
              <span className="invoice-meta-label">Status</span>{" "}
              <span className={`invoice-status invoice-status--${invoice.paymentStatus}`}>
                {invoice.paymentStatus}
              </span>
            </div>
          </div>
        </header>

        <section className="invoice-parties">
          <div>
            <div className="invoice-section-title">From (salesperson)</div>
            <div className="invoice-party-name">{sp.name || "—"}</div>
            {sp.email && <div>{sp.email}</div>}
            {sp.phone && <div>{sp.phone}</div>}
            {sp.address && <div style={{ whiteSpace: "pre-line" }}>{sp.address}</div>}
          </div>
          <div>
            <div className="invoice-section-title">For (project)</div>
            <div className="invoice-party-name">
              <Link to={`/projects/${invoice.projectId}`} className="invoice-project-link">
                {invoice.projectName || "—"}
              </Link>
            </div>
            {invoice.clientName && <div>Client: {invoice.clientName}</div>}
            {invoice.saleDate && <div>Sale date: {fmtDate(invoice.saleDate)}</div>}
          </div>
        </section>

        <section>
          <table className="invoice-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Description</th>
                <th>Sale price</th>
                <th>Rate</th>
                <th style={{ textAlign: "right" }}>Commission</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: "left" }}>
                  Sale of <strong>{invoice.projectName || "project"}</strong>
                  {invoice.clientName ? ` to ${invoice.clientName}` : ""}
                </td>
                <td>{money(invoice.salePrice)}</td>
                <td>{invoice.commissionRate}%</td>
                <td style={{ textAlign: "right" }}>{money(invoice.commissionAmount)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} style={{ textAlign: "right", fontWeight: 600 }}>Amount due</td>
                <td style={{ textAlign: "right", fontWeight: 700, fontSize: 18 }}>{money(invoice.commissionAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        {invoice.notes && (
          <section className="invoice-notes">
            <div className="invoice-section-title">Notes</div>
            <div style={{ whiteSpace: "pre-line" }}>{invoice.notes}</div>
          </section>
        )}

        <section className="invoice-payment">
          <div className="invoice-section-title">Payment</div>
          <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
            <div>
              <div className="invoice-meta-label">Method</div>
              <div>{invoice.paymentMethod || sp.defaultPaymentMethod || "—"}</div>
            </div>
            <div>
              <div className="invoice-meta-label">YTD paid to {sp.name || "salesperson"} ({new Date(invoice.issuedAt).getFullYear()})</div>
              <div>{money(ytdPaid)}</div>
            </div>
          </div>
        </section>

        <div className="invoice-controls">
          <div className="invoice-section-title">Mark status</div>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              className={invoice.paymentStatus === "unpaid" ? "primary" : ""}
              onClick={() => setStatus("unpaid")}
            >Unpaid</button>
            <button
              className={invoice.paymentStatus === "partial" ? "primary" : ""}
              onClick={() => setStatus("partial")}
            >Partial</button>
            <button
              className={invoice.paymentStatus === "paid" ? "primary" : ""}
              onClick={() => setStatus("paid")}
            >Paid in full</button>
          </div>
          {invoice.paymentStatus === "partial" && (
            <div className="row" style={{ alignItems: "flex-end", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="invoice-meta-label">Paid so far ($)</span>
                <input
                  type="number"
                  value={invoice.paidAmount ?? 0}
                  onChange={(e) => updateField({ paidAmount: Number(e.target.value) || 0 })}
                  style={{ width: 120 }}
                  onFocus={(e) => e.target.select()}
                />
              </label>
              <span className="text-subtle" style={{ fontSize: 12, paddingBottom: 6 }}>
                Remaining: {money(invoice.commissionAmount - (Number(invoice.paidAmount) || 0))}
              </span>
            </div>
          )}
          <div className="row" style={{ marginTop: 12, alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="invoice-meta-label">Payment method</span>
              <input
                value={invoice.paymentMethod ?? ""}
                placeholder="Check #1234 / Zelle / ACH"
                onChange={(e) => updateField({ paymentMethod: e.target.value })}
                style={{ width: 220 }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="invoice-meta-label">Due date</span>
              <input
                type="date"
                value={invoice.dueDate ?? ""}
                onChange={(e) => updateField({ dueDate: e.target.value })}
              />
            </label>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", maxWidth: 600 }}>
              <span className="invoice-meta-label">Notes / memo</span>
              <textarea
                value={invoice.notes ?? ""}
                placeholder="Bonuses, adjustments, clawbacks…"
                onChange={(e) => updateField({ notes: e.target.value })}
                rows={2}
                style={{ width: "100%", padding: 6, fontSize: 13 }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  // Accept "YYYY-MM-DD" or full ISO timestamps.
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
