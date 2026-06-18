import { useMemo, useState } from "react";
import { NumberField } from "../lib/Fields.jsx";
import { api } from "../api.js";
import {
  emptyFinancials,
  getFinancials,
  money,
  projectSummary,
  todayIso,
} from "../lib/financials.js";

// Two-segment SVG pie chart. `paid` and `remaining` are dollar amounts;
// the chart renders the share of each. If the total is 0 we draw a flat
// gray circle as a placeholder so the layout doesn't jump.
function PieChart({ paid, remaining, paidColor = "#15623F", remainingColor = "#D6D3CD", size = 140 }) {
  const total = paid + remaining;
  const r = size / 2;
  const cx = r;
  const cy = r;

  if (total <= 0) {
    return (
      <svg width={size} height={size} role="img" aria-label="No data yet">
        <circle cx={cx} cy={cy} r={r - 1} fill={remainingColor} />
      </svg>
    );
  }

  // Fully-paid (or fully-unpaid) edge cases — a single full circle, since
  // an SVG arc with the same start and end point degenerates to nothing.
  if (paid >= total) {
    return (
      <svg width={size} height={size} role="img" aria-label="Fully paid">
        <circle cx={cx} cy={cy} r={r - 1} fill={paidColor} />
      </svg>
    );
  }
  if (paid <= 0) {
    return (
      <svg width={size} height={size} role="img" aria-label="Nothing paid yet">
        <circle cx={cx} cy={cy} r={r - 1} fill={remainingColor} />
      </svg>
    );
  }

  const paidFrac = paid / total;
  const angle = paidFrac * Math.PI * 2;
  // Start at 12 o'clock, sweep clockwise.
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);
  const largeArc = paidFrac > 0.5 ? 1 : 0;
  const paidPath = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x} ${y} Z`;
  const remainingPath = `M ${cx} ${cy} L ${x} ${y} A ${r} ${r} 0 ${1 - largeArc} 1 ${cx} ${cy - r} Z`;

  return (
    <svg width={size} height={size} role="img" aria-label={`${Math.round(paidFrac * 100)}% paid`}>
      <path d={paidPath} fill={paidColor} />
      <path d={remainingPath} fill={remainingColor} />
    </svg>
  );
}

function LegendDot({ color }) {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: "50%",
      background: color, marginRight: 6, verticalAlign: "middle",
    }} />
  );
}

export default function MoneyTab({ project, onChange }) {
  const f = useMemo(() => ({ ...emptyFinancials(), ...getFinancials(project) }), [project]);
  const summary = useMemo(() => projectSummary(project), [project]);
  const finalInvoices = project.finalInvoices ?? {};

  function persist(patch) {
    onChange({ financials: { ...f, ...patch } });
  }

  function persistFinalInvoice(kind, meta) {
    onChange({ finalInvoices: { ...finalInvoices, [kind]: meta } });
  }

  function addReceipt() {
    persist({
      clientReceipts: [
        ...f.clientReceipts,
        { id: crypto.randomUUID(), date: todayIso(), amount: 0, method: "", notes: "" },
      ],
    });
  }

  function updateReceipt(id, patch) {
    persist({
      clientReceipts: f.clientReceipts.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function removeReceipt(id) {
    persist({ clientReceipts: f.clientReceipts.filter((r) => r.id !== id) });
  }

  function addPayment() {
    persist({
      supplierPayments: [
        ...f.supplierPayments,
        { id: crypto.randomUUID(), date: todayIso(), supplier: "", amount: 0, notes: "" },
      ],
    });
  }

  function updatePayment(id, patch) {
    persist({
      supplierPayments: f.supplierPayments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removePayment(id) {
    persist({ supplierPayments: f.supplierPayments.filter((p) => p.id !== id) });
  }

  const clientPaidPct = summary.clientQuoted > 0 ? Math.round((summary.clientReceived / summary.clientQuoted) * 100) : 0;
  const supplierPaidPct = summary.supplierTotalCost > 0 ? Math.round((summary.supplierPaid / summary.supplierTotalCost) * 100) : 0;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Project P&amp;L</h3>
        <div className="row" style={{ gap: 32, flexWrap: "wrap" }}>
          <Stat
            label="Profit so far"
            value={money(summary.profit)}
            color={summary.profit >= 0 ? "var(--color-success)" : "var(--color-error)"}
            big
            hint="client paid − supplier paid"
          />
          <Stat
            label="Planned profit"
            value={money(summary.plannedProfit)}
            color={summary.plannedProfit >= 0 ? "var(--color-success)" : "var(--color-error)"}
            hint={summary.supplierTotalCost > 0 ? "client quoted − supplier total" : "set a supplier total cost below"}
          />
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: "stretch", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 360px" }}>
          <h3 style={{ marginTop: 0 }}>Supplier costs</h3>
          <div className="row" style={{ gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <PieChart
              paid={summary.supplierPaid}
              remaining={summary.supplierOutstanding}
              paidColor="#94251A"
              remainingColor="#D6D3CD"
            />
            <div style={{ flex: 1, minWidth: 160 }}>
              <Row dotColor="#94251A" label="Paid to supplier" value={money(summary.supplierPaid)} />
              <Row dotColor="#D6D3CD" label="Remaining balance" value={money(summary.supplierOutstanding)} valueColor={summary.supplierOutstanding > 0 ? "var(--color-error)" : "var(--color-text-muted)"} />
              <Divider />
              <Row label="Total supplier cost" value={money(summary.supplierTotalCost)} bold />
              <div className="text-subtle" style={{ fontSize: 12, marginTop: 6 }}>
                {summary.supplierTotalCost > 0
                  ? `${supplierPaidPct}% paid · deposit shows up as the first payment below`
                  : "Set the supplier total below — deposit goes in the payments table."}
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <NumberField
              label="Supplier total cost ($)"
              value={f.supplierTotalCost}
              onChange={(v) => persist({ supplierTotalCost: Number(v) || 0 })}
              inputStyle={{ width: 160 }}
            />
          </div>
          <Ledger
            bare
            title="Supplier payments"
            emptyMessage="No supplier payments logged yet. The deposit goes here as the first row."
            rows={f.supplierPayments}
            onAdd={addPayment}
            onUpdate={updatePayment}
            onRemove={removePayment}
            columns={[
              { key: "date", label: "Date", type: "date", width: 130 },
              { key: "supplier", label: "Paid to", type: "text", width: 150 },
              { key: "amount", label: "Amount ($)", type: "number", width: 110 },
              { key: "notes", label: "Notes", type: "text", width: 180 },
            ]}
            footerLabel="Total paid"
            footerValue={money(summary.supplierPaid)}
          />
        </div>

        <div className="card" style={{ flex: "1 1 360px" }}>
          <h3 style={{ marginTop: 0 }}>Client receivables</h3>
          <div className="row" style={{ gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <PieChart
              paid={summary.clientReceived}
              remaining={summary.clientOutstanding}
              paidColor="#15623F"
              remainingColor="#E2C7C2"
            />
            <div style={{ flex: 1, minWidth: 160 }}>
              <Row dotColor="#15623F" label="Received" value={money(summary.clientReceived)} />
              <Row dotColor="#E2C7C2" label="Still owed by client" value={money(summary.clientOutstanding)} valueColor={summary.clientOutstanding > 0 ? "var(--color-error)" : "var(--color-text-muted)"} />
              <Divider />
              <Row label="Total quoted" value={money(summary.clientQuoted)} bold />
              <div className="text-subtle" style={{ fontSize: 12, marginTop: 6 }}>
                {summary.clientQuoted > 0 ? `${clientPaidPct}% of contract received` : "Set the contract amount below to track owed."}
              </div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
            <NumberField
              label="Client contract total ($)"
              value={f.clientQuoted}
              onChange={(v) => persist({ clientQuoted: Number(v) || 0 })}
              inputStyle={{ width: 160 }}
            />
          </div>
          <Ledger
            bare
            title="Client payments received"
            emptyMessage="No client payments logged yet."
            rows={f.clientReceipts}
            onAdd={addReceipt}
            onUpdate={updateReceipt}
            onRemove={removeReceipt}
            columns={[
              { key: "date", label: "Date", type: "date", width: 130 },
              { key: "amount", label: "Amount ($)", type: "number", width: 110 },
              { key: "method", label: "Method", type: "text", width: 130, placeholder: "Check / wire / card" },
              { key: "notes", label: "Notes", type: "text", width: 180 },
            ]}
            footerLabel="Total received"
            footerValue={money(summary.clientReceived)}
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Final invoices on file</h3>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          Store the final invoice from the supplier and the one you sent to the client. Re-uploading replaces the file on disk.
        </p>
        <div className="row" style={{ gap: 16, alignItems: "stretch", flexWrap: "wrap" }}>
          <FinalInvoiceSlot
            projectId={project.id}
            kind="supplier"
            title="Supplier final invoice"
            helper="The bill the supplier sent us."
            meta={finalInvoices.supplier}
            onChange={(m) => persistFinalInvoice("supplier", m)}
          />
          <FinalInvoiceSlot
            projectId={project.id}
            kind="client"
            title="Client final invoice"
            helper="The invoice we sent the client for this project."
            meta={finalInvoices.client}
            onChange={(m) => persistFinalInvoice("client", m)}
          />
        </div>
      </div>

    </div>
  );
}

function FinalInvoiceSlot({ projectId, kind, title, helper, meta, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";  // allow re-upload of same filename
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await api.uploadFinalInvoice(file, projectId, kind);
      onChange({
        fileName: result.fileName || file.name,
        ext: result.ext,
        sizeBytes: result.sizeBytes ?? file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete the ${kind} invoice file? This removes it from disk.`)) return;
    try { await api.deleteFinalInvoiceFile(projectId, kind); }
    catch (err) { console.error("delete failed:", err); }
    onChange(null);
  }

  const hasFile = Boolean(meta?.fileName);
  return (
    <div className="card" style={{ flex: "1 1 320px", background: "var(--color-surface-alt)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 2 }}>{title}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>{helper}</div>
        </div>
        <label className="pill-upload">
          {uploading ? "Uploading…" : hasFile ? "Replace" : "+ Upload"}
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={handleUpload}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
      </div>
      {hasFile ? (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <a
              href={api.finalInvoiceFileUrl(projectId, kind)}
              target="_blank"
              rel="noreferrer"
              style={{ fontWeight: 500, wordBreak: "break-all" }}
            >
              {meta.fileName}
            </a>
            <button onClick={handleDelete} title="Delete this file" style={{ fontSize: 12 }}>Delete</button>
          </div>
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {fmtSize(meta.sizeBytes)} · uploaded {fmtDate(meta.uploadedAt)}
          </div>
        </div>
      ) : (
        <div className="text-subtle" style={{ fontSize: 13, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          No file uploaded yet.
        </div>
      )}
      {error && <div className="text-error" style={{ fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}

function Row({ dotColor, label, value, valueColor, bold }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", fontSize: 14 }}>
      <span>
        {dotColor && <LegendDot color={dotColor} />}
        <span style={{ fontWeight: bold ? 600 : 400 }}>{label}</span>
      </span>
      <span style={{ fontWeight: bold ? 700 : 500, color: valueColor || "var(--color-text)" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #eee", margin: "6px 0" }} />;
}

function Stat({ label, value, color, big, hint }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 700, color: color || "var(--color-text)", marginTop: 4 }}>
        {value}
      </div>
      {hint && <div className="text-subtle" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export function Ledger({ title, emptyMessage, rows, columns, onAdd, onUpdate, onRemove, footerLabel, footerValue, bare = false }) {
  const Wrapper = bare ? "div" : "div";
  const wrapperClass = bare ? "" : "card";
  const wrapperStyle = bare ? { marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" } : { marginBottom: 16 };
  const titleTag = bare ? (
    <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
      {title}
    </div>
  ) : (
    <h4 style={{ margin: 0 }}>{title}</h4>
  );
  return (
    <Wrapper className={wrapperClass} style={wrapperStyle}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        {titleTag}
        <button onClick={onAdd}>+ Add row</button>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key}>
                  <input
                    type={c.type}
                    value={row[c.key] ?? (c.type === "number" ? 0 : "")}
                    placeholder={c.placeholder ?? ""}
                    onChange={(e) => {
                      const v = c.type === "number" ? (Number(e.target.value) || 0) : e.target.value;
                      onUpdate(row.id, { [c.key]: v });
                    }}
                    onFocus={(e) => c.type === "number" && e.target.select()}
                    style={{ width: c.width }}
                  />
                </td>
              ))}
              <td><button onClick={() => onRemove(row.id)} title="Delete row">×</button></td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="text-subtle">{emptyMessage}</td></tr>
          )}
        </tbody>
        {rows.length > 0 && footerLabel && (
          <tfoot>
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "right", fontWeight: 600 }}>{footerLabel}</td>
              <td style={{ fontWeight: 600 }}>{footerValue}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </Wrapper>
  );
}
