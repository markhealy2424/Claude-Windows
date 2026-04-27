import { useMemo, useState } from "react";
import { api } from "../api.js";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

const blankItem = {
  mark: "", quantity: 1, type: "fixed", operation: "", material: "Aluminum",
  width_in: 36, height_in: 48, unit_price_usd: 0, total_price_usd: 0, notes: "",
};

const blankQuote = () => ({
  id: crypto.randomUUID(),
  supplier: "",
  invoice_number: "",
  invoice_date: "",
  receivedAt: new Date().toISOString(),
  filePersisted: false,
  fileName: "",
  items: [],
});

const TYPE_OPTIONS = [
  ["fixed", "fixed"], ["casement", "casement"], ["sliding", "sliding"],
  ["awning", "awning"], ["hung", "hung"],
  ["folding-door", "folding door"], ["casement-door", "casement door"], ["sliding-door", "sliding door"],
];

export default function QuotesTab({ project, onChange }) {
  const quotes = project.quotes ?? [];
  const [activeId, setActiveId] = useState(quotes[0]?.id ?? null);
  const [draft, setDraft] = useState(blankItem);
  const [comparison, setComparison] = useState(project.discrepancies ?? null);
  const [comparing, setComparing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadingTo, setUploadingTo] = useState(null);  // quoteId being uploaded to
  const [error, setError] = useState("");

  const active = useMemo(() => quotes.find((q) => q.id === activeId) ?? null, [quotes, activeId]);

  function persist(nextQuotes, nextComparison = comparison) {
    onChange({ quotes: nextQuotes, discrepancies: nextComparison });
  }

  function addQuote() {
    const q = blankQuote();
    const next = [...quotes, q];
    setActiveId(q.id);
    persist(next);
  }

  function removeQuote(id) {
    const next = quotes.filter((q) => q.id !== id);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    persist(next);
  }

  function updateActive(patch) {
    const next = quotes.map((q) => (q.id === activeId ? { ...q, ...patch } : q));
    persist(next);
  }

  function updateActiveItem(idx, patch) {
    if (!active) return;
    const items = active.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    updateActive({ items });
  }

  function addItem(e) {
    e.preventDefault();
    if (!active || !draft.mark) return;
    updateActive({ items: [...active.items, { ...draft }] });
    setDraft(blankItem);
  }

  function removeItem(idx) {
    updateActive({ items: active.items.filter((_, i) => i !== idx) });
  }

  function set(key, value) {
    setDraft({ ...draft, [key]: value });
  }

  // ── Supplier-quote upload + AI parse ──
  async function handleSupplierFile(e, quoteId) {
    const f = e.target.files?.[0];
    if (!f || !quoteId) return;
    e.target.value = "";  // allow re-upload of same filename
    setError("");
    setUploadingTo(quoteId);
    try {
      const result = await api.uploadSupplierQuote(f, project.id, quoteId);
      const next = quotes.map((q) => (q.id === quoteId
        ? { ...q, filePersisted: !!result.pdfPersisted, fileName: result.fileName ?? f.name }
        : q));
      persist(next);
      // Auto-trigger parse right after upload
      await runParse(quoteId);
    } catch (err) {
      setError("Upload failed: " + String(err));
    } finally {
      setUploadingTo(null);
    }
  }

  async function runParse(quoteId) {
    setParsing(true);
    setError("");
    try {
      const result = await api.parseSupplierQuoteVision({ projectId: project.id, quoteId });
      // Fold the parsed items + supplier metadata into the quote.
      const next = quotes.map((q) => (q.id === quoteId
        ? {
            ...q,
            supplier: q.supplier || result.supplier || q.supplier,
            invoice_number: result.invoice_number || q.invoice_number,
            invoice_date: result.invoice_date || q.invoice_date,
            items: result.items ?? [],
          }
        : q));
      persist(next);
    } catch (err) {
      setError("AI parse failed: " + String(err) + " — you can still enter quote lines manually.");
    } finally {
      setParsing(false);
    }
  }

  async function runCompare() {
    if (!active) return;
    setComparing(true);
    setError("");
    try {
      const result = await api.compareQuote(project.items ?? [], active.items);
      const tagged = { ...result, quoteId: active.id, supplier: active.supplier, ranAt: new Date().toISOString() };
      setComparison(tagged);
      onChange({ discrepancies: tagged });
    } catch (e) {
      setError(String(e));
    } finally {
      setComparing(false);
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {quotes.map((q) => (
            <button
              key={q.id}
              className={`pill-toggle${q.id === activeId ? " active" : ""}`}
              onClick={() => setActiveId(q.id)}
            >
              {q.supplier || "(unnamed)"} · {q.items.length}{q.filePersisted ? " · file ✓" : ""}
            </button>
          ))}
          <button onClick={addQuote} className="pill-upload">+ Add quote</button>
        </div>
      </div>

      {!active && <div className="card">No supplier quotes yet. Click "+ Add quote" to start.</div>}

      {active && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
              <div className="row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
                <TextField
                  label="Supplier"
                  value={active.supplier}
                  onChange={(v) => updateActive({ supplier: v })}
                  inputStyle={{ minWidth: 240 }}
                />
                <TextField
                  label="Invoice #"
                  value={active.invoice_number ?? ""}
                  onChange={(v) => updateActive({ invoice_number: v })}
                />
                <TextField
                  label="Invoice date"
                  value={active.invoice_date ?? ""}
                  onChange={(v) => updateActive({ invoice_date: v })}
                />
              </div>
              <div className="row">
                <label className="pill-upload">
                  {active.filePersisted ? "Re-upload supplier PDF" : "+ Upload supplier PDF"}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    onChange={(e) => handleSupplierFile(e, active.id)}
                    style={{ display: "none" }}
                  />
                </label>
                {active.filePersisted && (
                  <button onClick={() => runParse(active.id)} disabled={parsing}>
                    {parsing ? "Re-parsing…" : "Re-parse with AI"}
                  </button>
                )}
                <button onClick={() => removeQuote(active.id)}>Remove this quote</button>
              </div>
            </div>
            {(uploadingTo === active.id || parsing) && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                {uploadingTo === active.id && !parsing && "Uploading…"}
                {parsing && "Reading the supplier quote with Claude Opus 4.7. This takes ~10–20 seconds."}
              </div>
            )}
            {active.fileName && (
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                File on disk: <code>{active.fileName}</code>
              </div>
            )}
          </div>

          {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

          <h4 style={{ marginBottom: 8 }}>Quote line items <span className="text-muted" style={{ fontWeight: 400, fontSize: 13 }}>· editable, auto-filled by AI parse</span></h4>

          <table style={{ marginBottom: 16 }}>
            <thead>
              <tr>
                <th>Mark</th><th>Qty</th><th>Type</th><th>Op</th><th>Material</th>
                <th>Width (in)</th><th>Height (in)</th><th>Unit $</th><th>Total $</th><th>Notes</th><th></th>
              </tr>
            </thead>
            <tbody>
              {active.items.map((it, i) => (
                <tr key={i}>
                  <td><input value={it.mark ?? ""} onChange={(e) => updateActiveItem(i, { mark: e.target.value })} style={{ width: 50 }} /></td>
                  <td><input type="number" value={it.quantity ?? 0} onChange={(e) => updateActiveItem(i, { quantity: Number(e.target.value) || 0 })} style={{ width: 50 }} onFocus={(e)=>e.target.select()} /></td>
                  <td>
                    <select value={it.type ?? "fixed"} onChange={(e) => updateActiveItem(i, { type: e.target.value })}>
                      {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </td>
                  <td><input value={it.operation ?? ""} onChange={(e) => updateActiveItem(i, { operation: e.target.value })} style={{ width: 60 }} /></td>
                  <td><input value={it.material ?? "Aluminum"} onChange={(e) => updateActiveItem(i, { material: e.target.value })} style={{ width: 80 }} /></td>
                  <td><input type="number" value={it.width_in ?? 0} onChange={(e) => updateActiveItem(i, { width_in: Number(e.target.value) || 0 })} style={{ width: 70 }} onFocus={(e)=>e.target.select()} /></td>
                  <td><input type="number" value={it.height_in ?? 0} onChange={(e) => updateActiveItem(i, { height_in: Number(e.target.value) || 0 })} style={{ width: 70 }} onFocus={(e)=>e.target.select()} /></td>
                  <td><input type="number" value={it.unit_price_usd ?? it.cost ?? 0} onChange={(e) => updateActiveItem(i, { unit_price_usd: Number(e.target.value) || 0 })} style={{ width: 80 }} onFocus={(e)=>e.target.select()} /></td>
                  <td><input type="number" value={it.total_price_usd ?? 0} onChange={(e) => updateActiveItem(i, { total_price_usd: Number(e.target.value) || 0 })} style={{ width: 90 }} onFocus={(e)=>e.target.select()} /></td>
                  <td><input value={it.notes ?? ""} onChange={(e) => updateActiveItem(i, { notes: e.target.value })} style={{ width: 200 }} /></td>
                  <td><button onClick={() => removeItem(i)} title="Drop this line">×</button></td>
                </tr>
              ))}
              {active.items.length === 0 && (
                <tr><td colSpan={11} className="text-subtle">No quote lines yet. Upload a supplier PDF above, or use the form below to add lines manually.</td></tr>
              )}
            </tbody>
          </table>

          <details style={{ marginBottom: 16 }}>
            <summary className="text-muted" style={{ cursor: "pointer", fontSize: 13 }}>Add a line manually</summary>
            <form onSubmit={addItem} className="row" style={{ flexWrap: "wrap", marginTop: 12, alignItems: "flex-end" }}>
              <TextField label="Mark" value={draft.mark} onChange={(v) => set("mark", v)} />
              <NumberField label="Qty" value={draft.quantity} onChange={(v) => set("quantity", v)} />
              <SelectField label="Type" value={draft.type} onChange={(v) => set("type", v)} options={TYPE_OPTIONS} />
              <TextField label="Operation" value={draft.operation} onChange={(v) => set("operation", v)} />
              <NumberField label="Width (in)" value={draft.width_in} onChange={(v) => set("width_in", v)} />
              <NumberField label="Height (in)" value={draft.height_in} onChange={(v) => set("height_in", v)} />
              <NumberField label="Unit $" value={draft.unit_price_usd} onChange={(v) => set("unit_price_usd", v)} />
              <button className="primary" type="submit">Add line</button>
            </form>
          </details>

          <div className="row" style={{ marginBottom: 16 }}>
            <button className="primary" onClick={runCompare} disabled={comparing || active.items.length === 0}>
              {comparing ? "Comparing…" : "Run discrepancy check vs RFQ"}
            </button>
            {comparison?.quoteId === active.id && (
              <span className="text-muted">
                last run {new Date(comparison.ranAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {comparison?.quoteId === active.id && (
            <DiscrepancyReport comparison={comparison} />
          )}
        </>
      )}
    </div>
  );
}

function DiscrepancyReport({ comparison }) {
  if (comparison.ok) {
    return (
      <div className="card">
        <div className="text-success" style={{ fontSize: 16, fontWeight: 600 }}>
          ✓ No discrepancies — supplier quote matches the RFQ.
        </div>
      </div>
    );
  }

  // Group issues by severity for the summary header
  const high = comparison.issues.filter((i) => i.severity === "high");
  const medium = comparison.issues.filter((i) => i.severity === "medium");
  const low = comparison.issues.filter((i) => i.severity === "low");

  return (
    <div className="card warning">
      <div style={{ marginBottom: 12, fontSize: 14 }}>
        <strong className="text-warning">⚠ {comparison.issues.length} discrepancy{comparison.issues.length === 1 ? "" : "ies"} found</strong>
        {high.length > 0 && <span className="text-muted"> · {high.length} critical</span>}
        {medium.length > 0 && <span className="text-muted"> · {medium.length} medium</span>}
        {low.length > 0 && <span className="text-muted"> · {low.length} minor</span>}
      </div>
      <table>
        <thead>
          <tr>
            <th>Mark</th>
            <th>Severity</th>
            <th>Issue</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {comparison.issues.map((iss, i) => (
            <tr key={i}>
              <td><strong>{iss.mark}</strong></td>
              <td>
                <span className={
                  iss.severity === "high" ? "text-error"
                  : iss.severity === "medium" ? "text-warning"
                  : "text-muted"
                } style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase" }}>
                  {iss.severity}
                </span>
              </td>
              <td>{iss.kind.replace(/_/g, " ")}</td>
              <td>{iss.message ?? describeLegacy(iss)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-muted" style={{ fontSize: 12, marginTop: 12, fontStyle: "italic" }}>
        Mention these to the supplier so they can correct the quote before you commit.
      </div>
    </div>
  );
}

function describeLegacy(iss) {
  if (iss.detail) return iss.detail;
  if (iss.rfq != null && iss.quote != null) return `RFQ ${iss.rfq} vs Quote ${iss.quote}`;
  return "";
}
