import { useMemo, useState } from "react";
import { api } from "../api.js";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

const blankItem = {
  mark: "", quantity: 1, type: "fixed", operation: "",
  width_in: 36, height_in: 48, cost: 0,
};

const blankQuote = () => ({
  id: crypto.randomUUID(),
  supplier: "",
  receivedAt: new Date().toISOString(),
  items: [],
});

export default function QuotesTab({ project, onChange }) {
  const quotes = project.quotes ?? [];
  const [activeId, setActiveId] = useState(quotes[0]?.id ?? null);
  const [draft, setDraft] = useState(blankItem);
  const [comparison, setComparison] = useState(project.discrepancies ?? null);
  const [comparing, setComparing] = useState(false);
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

  function addItem(e) {
    e.preventDefault();
    if (!active || !draft.mark) return;
    updateActive({ items: [...active.items, { ...draft }] });
    setDraft(blankItem);
  }

  function removeItem(idx) {
    updateActive({ items: active.items.filter((_, i) => i !== idx) });
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

  function set(key, value) {
    setDraft({ ...draft, [key]: value });
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {quotes.map((q) => (
            <button
              key={q.id}
              className={q.id === activeId ? "active" : ""}
              onClick={() => setActiveId(q.id)}
              style={{
                padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc",
                background: q.id === activeId ? "#111" : "#fff",
                color: q.id === activeId ? "#fff" : "#111", cursor: "pointer",
              }}
            >
              {q.supplier || "(unnamed)"} · {q.items.length}
            </button>
          ))}
          <button onClick={addQuote}>+ Add quote</button>
        </div>
      </div>

      {!active && <div className="card">No supplier quotes yet. Click "+ Add quote" to start.</div>}

      {active && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
              <TextField
                label="Supplier"
                value={active.supplier}
                onChange={(v) => updateActive({ supplier: v })}
              />
              <button onClick={() => removeQuote(active.id)}>Remove this quote</button>
            </div>
          </div>

          <form onSubmit={addItem} className="row" style={{ flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
            <TextField label="Mark" value={draft.mark} onChange={(v) => set("mark", v)} />
            <NumberField label="Qty" value={draft.quantity} onChange={(v) => set("quantity", v)} />
            <SelectField
              label="Type"
              value={draft.type}
              onChange={(v) => set("type", v)}
              options={[["fixed", "fixed"], ["casement", "casement"], ["sliding", "sliding"]]}
            />
            <TextField label="Operation" value={draft.operation} onChange={(v) => set("operation", v)} />
            <NumberField label="Width (in)" value={draft.width_in} onChange={(v) => set("width_in", v)} />
            <NumberField label="Height (in)" value={draft.height_in} onChange={(v) => set("height_in", v)} />
            <NumberField label="Cost ($)" value={draft.cost} onChange={(v) => set("cost", v)} />
            <button className="primary" type="submit">Add line</button>
          </form>

          <table style={{ marginBottom: 20 }}>
            <thead>
              <tr><th>Mark</th><th>Qty</th><th>Type</th><th>Operation</th><th>W</th><th>H</th><th>Cost</th><th></th></tr>
            </thead>
            <tbody>
              {active.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.mark}</td><td>{it.quantity}</td><td>{it.type}</td><td>{it.operation}</td>
                  <td>{it.width_in}</td><td>{it.height_in}</td><td>${Number(it.cost).toFixed(2)}</td>
                  <td><button onClick={() => removeItem(i)}>Remove</button></td>
                </tr>
              ))}
              {active.items.length === 0 && (
                <tr><td colSpan={8} style={{ color: "#888" }}>No quote lines yet.</td></tr>
              )}
            </tbody>
          </table>

          <div className="row" style={{ marginBottom: 16 }}>
            <button className="primary" onClick={runCompare} disabled={comparing || active.items.length === 0}>
              {comparing ? "Comparing…" : "Run discrepancy check"}
            </button>
            {comparison?.quoteId === active.id && (
              <span style={{ color: "#666" }}>
                last run {new Date(comparison.ranAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          {error && <div className="card" style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}

          {comparison?.quoteId === active.id && (
            <div className="card">
              {comparison.ok ? (
                <div style={{ color: "#0a0" }}>No discrepancies — quote matches RFQ.</div>
              ) : (
                <table>
                  <thead>
                    <tr><th>Mark</th><th>Issue</th><th>Detail</th></tr>
                  </thead>
                  <tbody>
                    {comparison.issues.map((iss, i) => (
                      <tr key={i}>
                        <td>{iss.mark}</td>
                        <td>{iss.kind.replace(/_/g, " ")}</td>
                        <td>{describe(iss)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function describe(iss) {
  if (iss.detail) return iss.detail;
  if (iss.kind === "quantity_mismatch") return `RFQ ${iss.rfq} vs Quote ${iss.quote}`;
  if (iss.kind === "type_mismatch") return `RFQ ${iss.rfq} vs Quote ${iss.quote}`;
  if (iss.kind === "operation_mismatch") return `RFQ ${iss.rfq} vs Quote ${iss.quote}`;
  return "";
}
