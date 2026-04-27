import { useMemo, useState } from "react";
import { api } from "../api.js";

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

  function field(name, type = "text") {
    return (
      <input
        type={type}
        value={draft[name]}
        onChange={(e) => setDraft({ ...draft, [name]: type === "number" ? Number(e.target.value) : e.target.value })}
        placeholder={name}
      />
    );
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
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label>
                Supplier{" "}
                <input
                  value={active.supplier}
                  onChange={(e) => updateActive({ supplier: e.target.value })}
                  placeholder="Supplier name"
                />
              </label>
              <button onClick={() => removeQuote(active.id)}>Remove this quote</button>
            </div>
          </div>

          <form onSubmit={addItem} className="row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
            {field("mark")}
            {field("quantity", "number")}
            <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
              <option value="fixed">fixed</option>
              <option value="casement">casement</option>
              <option value="sliding">sliding</option>
            </select>
            <input value={draft.operation} onChange={(e) => setDraft({ ...draft, operation: e.target.value })} placeholder="operation" />
            {field("width_in", "number")}
            {field("height_in", "number")}
            {field("cost", "number")}
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
