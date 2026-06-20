import React, { useEffect, useMemo, useRef, useState } from "react";
import { NumberField } from "../lib/Fields.jsx";
import { api } from "../api.js";
import { compressImageToDataUrl } from "../lib/imageCompress.js";
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

  // Add helpers now take the finalized draft from the Ledger. Rows are
  // prepended so the most recent transaction lands at the top of the
  // list (matches the in-progress new-row position).
  function addReceipt(draft) {
    persist({
      clientReceipts: [
        { id: crypto.randomUUID(), ...draft },
        ...f.clientReceipts,
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

  function addPayment(draft) {
    persist({
      supplierPayments: [
        { id: crypto.randomUUID(), ...draft },
        ...f.supplierPayments,
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
          <div style={{ marginTop: 12 }}>
            <InlineMoneyField
              label="Supplier total cost ($)"
              value={f.supplierTotalCost}
              onSave={(v) => persist({ supplierTotalCost: v })}
              helpEmpty="Set a total to track outstanding balance"
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
              { key: "notes", label: "Notes", type: "text", width: 160 },
              { key: "proof", label: "Proof", type: "file", width: 90 },
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
          <div style={{ marginTop: 12 }}>
            <InlineMoneyField
              label="Client contract total ($)"
              value={f.clientQuoted}
              onSave={(v) => persist({ clientQuoted: v })}
              helpEmpty="Set the contract amount to track owed"
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
              { key: "notes", label: "Notes", type: "text", width: 160 },
              { key: "proof", label: "Proof", type: "file", width: 90 },
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

// Save / edit flow. Saved rows render as static text; clicking + Add
// row opens a single draft at the top of the table (replaces the row
// list while in-progress) — Save commits, Cancel discards. Existing
// rows get an Edit button that puts them in the same draft state.
// Only one editor is active at a time so it's always clear what's
// committed vs. in-progress.
export function Ledger({ title, emptyMessage, rows, columns, onAdd, onUpdate, onRemove, footerLabel, footerValue, bare = false }) {
  // null when nothing is being edited.
  // { mode: "new",  draft }              — adding a new row
  // { mode: "edit", draft, rowId }       — editing an existing row in place
  const [editState, setEditState] = useState(null);

  const Wrapper = bare ? "div" : "div";
  const wrapperClass = bare ? "" : "card";
  const wrapperStyle = bare
    ? { marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }
    : { marginBottom: 16 };
  const titleTag = bare ? (
    <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
      {title}
    </div>
  ) : (
    <h4 style={{ margin: 0 }}>{title}</h4>
  );

  function blankDraft() {
    const d = {};
    for (const c of columns) {
      if (c.type === "date") d[c.key] = todayIso();
      else if (c.type === "number") d[c.key] = null;
      else if (c.type === "file") d[c.key] = null;
      else d[c.key] = "";
    }
    return d;
  }

  function startNew() {
    setEditState({ mode: "new", draft: blankDraft() });
  }
  function startEdit(row) {
    setEditState({ mode: "edit", rowId: row.id, draft: { ...blankDraft(), ...row } });
  }
  function updateDraft(key, value) {
    setEditState((s) => (s ? { ...s, draft: { ...s.draft, [key]: value } } : s));
  }
  function saveDraft() {
    if (!editState) return;
    if (editState.mode === "new") {
      onAdd(editState.draft);
    } else {
      onUpdate(editState.rowId, editState.draft);
    }
    setEditState(null);
  }
  function cancelDraft() {
    setEditState(null);
  }

  const isEditing = editState !== null;
  const editingRowId = editState?.mode === "edit" ? editState.rowId : null;

  const editRow = (
    <tr className="editing">
      {columns.map((c) => (
        <td key={c.key} className={nowrapClass(c)}>{renderEditCell(c, editState?.draft ?? {}, updateDraft)}</td>
      ))}
      <td className="nowrap ledger-actions">
        <div className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
          <button className="primary" type="button" onClick={saveDraft}>Save</button>
          <button type="button" onClick={cancelDraft}>Cancel</button>
        </div>
      </td>
    </tr>
  );

  return (
    <Wrapper className={wrapperClass} style={wrapperStyle}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        {titleTag}
        <button onClick={startNew} disabled={isEditing}>+ Add row</button>
      </div>
      <div className="table-scroll">
      <table className="compact">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {editState?.mode === "new" && editRow}
          {rows.map((row) => {
            if (row.id === editingRowId) return <React.Fragment key={row.id}>{editRow}</React.Fragment>;
            return (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c.key} className={nowrapClass(c)}>{renderReadCell(c, row)}</td>
                ))}
                <td className="nowrap ledger-actions">
                  <div className="row" style={{ gap: 4, justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    <button type="button" onClick={() => startEdit(row)} disabled={isEditing}>Edit</button>
                    <button type="button" onClick={() => onRemove(row.id)} disabled={isEditing} title="Delete row">×</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && editState?.mode !== "new" && (
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
      </div>
    </Wrapper>
  );
}

// Cells that should never break mid-content: date, money, file (the
// thumb), and the action button column. Text/note columns are fine to
// wrap at word boundaries so longer notes don't push the table wider
// than its card.
function nowrapClass(column) {
  return column.type === "text" ? "" : "nowrap";
}

// ── Cell renderers ──────────────────────────────────────────────────

function renderReadCell(c, row) {
  const value = row[c.key];
  if (c.type === "file") return <ProofThumb proof={value} />;
  if (c.type === "date") {
    if (!value) return <span className="text-subtle">—</span>;
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  if (c.type === "number") {
    if (value == null || value === "") return <span className="text-subtle">—</span>;
    return money(Number(value));
  }
  return value || <span className="text-subtle">—</span>;
}

function renderEditCell(c, draft, updateDraft) {
  if (c.type === "file") {
    return (
      <ProofCell
        value={draft[c.key]}
        onChange={(v) => updateDraft(c.key, v)}
      />
    );
  }
  const isNumber = c.type === "number";
  const displayValue = draft[c.key] == null || draft[c.key] === "" ? "" : draft[c.key];
  return (
    <input
      type={c.type}
      value={displayValue}
      placeholder={c.placeholder ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        let v;
        if (isNumber) {
          if (raw === "") v = null;
          else {
            const n = Number(raw);
            v = Number.isFinite(n) ? n : null;
          }
        } else {
          v = raw;
        }
        updateDraft(c.key, v);
      }}
      onFocus={(e) => isNumber && e.target.select()}
      style={{ width: c.width }}
    />
  );
}

// Inline finalize-on-Save editor for a single dollar amount. Default
// view shows the formatted number next to an Edit button; clicking
// Edit swaps in a NumberField with Save / Cancel actions inline. Used
// on the Financial tab for Supplier total cost + Client contract total
// so those headline numbers feel like saved figures rather than
// always-editable form inputs.
function InlineMoneyField({ label, value, onSave, helpEmpty }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Snap the draft to the parent's value whenever we're not editing —
  // covers the case where the project switches or another tab writes
  // to this same field.
  useEffect(() => {
    if (!editing) setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }
  function cancel() {
    setDraft(value);
    setEditing(false);
  }
  function save() {
    onSave(Number(draft) || 0);
    setEditing(false);
  }

  return (
    <div className="inline-money">
      <span className="inline-money-label">{label}</span>
      {editing ? (
        <div className="inline-money-value-row">
          <NumberField
            label=""
            value={draft ?? ""}
            onChange={(v) => setDraft(v)}
            inputStyle={{ width: 160 }}
          />
          <button className="primary" type="button" onClick={save}>Save</button>
          <button type="button" onClick={cancel}>Cancel</button>
        </div>
      ) : (
        <div className="inline-money-value-row">
          <span className="inline-money-value">
            {Number(value) > 0 ? money(Number(value)) : <span className="text-subtle">{helpEmpty || "—"}</span>}
          </span>
          <button type="button" onClick={startEdit}>Edit</button>
        </div>
      )}
    </div>
  );
}

// Read-only proof view used in saved rows — thumbnail / PDF pill that
// opens the stored data URL in a new tab. No upload affordance.
function ProofThumb({ proof }) {
  if (!proof?.dataUrl) return <span className="text-subtle">—</span>;
  const isImg = (proof.type ?? "").startsWith("image/");
  function open() {
    const win = window.open();
    if (!win) return;
    win.document.write(
      isImg
        ? `<img src="${proof.dataUrl}" style="max-width:100%" />`
        : `<embed src="${proof.dataUrl}" type="application/pdf" style="width:100vw;height:100vh" />`
    );
  }
  return (
    <button type="button" className="proof-thumb" onClick={open} title={`Open ${proof.name || "proof"}`}>
      {isImg ? <img src={proof.dataUrl} alt="" /> : <span className="proof-pdf-pill">PDF</span>}
    </button>
  );
}

// File-upload cell for the proof-of-payment column. Stores the uploaded
// file as a data-URL object on the row: { dataUrl, name, type }. Images
// get a tiny thumbnail; PDFs get a "PDF" pill — both clickable to open
// the file in a new tab. Click × to remove.
function ProofCell({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isImage && !isPdf) {
        setError("Use PNG, JPG, or PDF");
        return;
      }
      // Hard cap at ~6 MB raw before we even try; data URLs balloon ~33%
      // over the source so the persisted row stays under ~8 MB.
      if (file.size > 6 * 1024 * 1024) {
        setError("Max 6 MB");
        return;
      }
      let dataUrl;
      if (isImage) {
        // Squash images so a 4 MB phone screenshot becomes a tidy ~200 KB
        // data URL — same compressor we use for sketch overrides.
        dataUrl = await compressImageToDataUrl(file);
      } else {
        dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(file);
        });
      }
      onChange({ dataUrl, name: file.name, type: file.type || (isPdf ? "application/pdf" : "image/*") });
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setBusy(false);
    }
  }

  function clear(e) {
    e.stopPropagation();
    onChange(null);
    setError("");
  }

  function openProof() {
    if (!value?.dataUrl) return;
    const win = window.open();
    if (!win) return;
    win.document.write(
      value.type.startsWith("image/")
        ? `<img src="${value.dataUrl}" style="max-width:100%" />`
        : `<embed src="${value.dataUrl}" type="application/pdf" style="width:100vw;height:100vh" />`
    );
  }

  if (value?.dataUrl) {
    const isImg = (value.type ?? "").startsWith("image/");
    return (
      <div className="proof-cell">
        <button
          type="button"
          className="proof-thumb"
          onClick={openProof}
          title={`Open ${value.name || "proof"}`}
        >
          {isImg ? (
            <img src={value.dataUrl} alt="" />
          ) : (
            <span className="proof-pdf-pill">PDF</span>
          )}
        </button>
        <button type="button" onClick={clear} title="Remove proof" className="proof-remove">×</button>
      </div>
    );
  }

  return (
    <div className="proof-cell">
      <button
        type="button"
        className="proof-upload-btn"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Upload proof of payment (PNG / JPG / PDF, max 6 MB)"
      >
        {busy ? "…" : "+ Upload"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,application/pdf,image/webp"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {error && <div className="proof-error" title={error}>{error}</div>}
    </div>
  );
}
