import { useMemo, useState } from "react";
import { SelectField } from "../lib/Fields.jsx";
import { findQuoteMatches, pickQuoteCost, pickQuoteSpec } from "../lib/quoteLookup.js";

// Spec fields shown in the per-mark detail row when they differ between
// the two quotes. Order matches the rough importance to a buyer.
const SPEC_FIELDS = [
  ["glass", "Glass"],
  ["thickness", "Thickness"],
  ["profile", "Profile"],
  ["material", "Material"],
  ["ext_color", "Ext color"],
  ["int_color", "Int color"],
];

const money = (n) =>
  Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtDelta = (n) => {
  const abs = Math.abs(n);
  return (n >= 0 ? "+" : "−") + money(abs).replace(/^[-$]/g, "$");
};

// One row of the compare table — for a single mark.
//   present_a / present_b: was this mark bid by side A / B?
//   cost_a / cost_b:       per-unit price (0 if missing)
//   line_a / line_b:       cost × qty
//   spec_a / spec_b:       extracted glass/color/etc per side
//   spec_diffs:            keys whose values differ (both present + non-equal)
function buildRow({ mark, qty, a, b }) {
  const matchesA = findQuoteMatches(a?.items, mark);
  const matchesB = findQuoteMatches(b?.items, mark);
  const cost_a = pickQuoteCost(a?.items, mark);
  const cost_b = pickQuoteCost(b?.items, mark);
  const spec_a = pickQuoteSpec(a?.items, mark);
  const spec_b = pickQuoteSpec(b?.items, mark);
  const spec_diffs = SPEC_FIELDS.filter(([key]) => {
    const va = (spec_a[key] ?? "").trim().toLowerCase();
    const vb = (spec_b[key] ?? "").trim().toLowerCase();
    if (!va && !vb) return false;
    return va !== vb;
  }).map(([key, label]) => ({ key, label, a: spec_a[key] || "—", b: spec_b[key] || "—" }));
  return {
    mark,
    qty,
    present_a: matchesA.length > 0,
    present_b: matchesB.length > 0,
    cost_a, cost_b,
    line_a: cost_a * qty,
    line_b: cost_b * qty,
    spec_a, spec_b, spec_diffs,
  };
}

// Pick which marks to show. Project-item order wins when items exist —
// that's the canonical demand list. Otherwise fall back to the union of
// marks that appear in either quote (preserving A's order, then any B-only
// marks appended).
function unionMarks(a, b, items) {
  if (items.length > 0) {
    return items
      .map((it) => ({ mark: (it.mark ?? "").trim(), qty: Number(it.quantity ?? 1) || 1 }))
      .filter((r) => r.mark);
  }
  const seen = new Set();
  const out = [];
  for (const q of [a, b]) {
    for (const line of q?.items ?? []) {
      const m = (line.mark ?? "").trim();
      if (!m || seen.has(m)) continue;
      seen.add(m);
      out.push({ mark: m, qty: Number(line.quantity ?? 1) || 1 });
    }
  }
  return out;
}

export default function CompareTab({ project, onChange }) {
  const quotes = project.quotes ?? [];
  const items = project.items ?? [];

  // Only quotes with at least one priced line are useful for comparison.
  const usable = quotes.filter((q) => (q.items ?? []).length > 0);

  // Default: first two distinct usable quotes.
  const defaultA = usable[0]?.id ?? "";
  const defaultB = usable.find((q) => q.id !== defaultA)?.id ?? "";

  const [aId, setAId] = useState(defaultA);
  const [bId, setBId] = useState(defaultB);

  const a = useMemo(() => quotes.find((q) => q.id === aId) ?? null, [quotes, aId]);
  const b = useMemo(() => quotes.find((q) => q.id === bId) ?? null, [quotes, bId]);

  const rows = useMemo(() => {
    if (!a || !b) return [];
    return unionMarks(a, b, items).map((r) => buildRow({ ...r, a, b }));
  }, [a, b, items]);

  // Summary numbers: only marks present on BOTH sides count toward
  // "comparable totals" so missing-on-one-side rows don't unfairly
  // tilt the recommendation. Headline totals (overall) are also shown
  // separately so the user can sanity-check the dollar amounts.
  const summary = useMemo(() => {
    let totalA = 0, totalB = 0;
    let comparableA = 0, comparableB = 0;
    let comparableMarks = 0;
    const missingA = [];
    const missingB = [];
    const zeroA = [];
    const zeroB = [];

    for (const r of rows) {
      totalA += r.line_a;
      totalB += r.line_b;
      if (r.present_a && r.present_b) {
        comparableA += r.line_a;
        comparableB += r.line_b;
        comparableMarks += 1;
      }
      if (!r.present_a) missingA.push(r.mark);
      if (!r.present_b) missingB.push(r.mark);
      if (r.present_a && r.cost_a === 0) zeroA.push(r.mark);
      if (r.present_b && r.cost_b === 0) zeroB.push(r.mark);
    }

    let recommendation = null;
    let savings = 0;
    if (comparableMarks === 0) {
      recommendation = "insufficient";
    } else if (Math.abs(comparableA - comparableB) < 1) {
      recommendation = "tie";
      savings = 0;
    } else if (comparableA < comparableB) {
      recommendation = "a";
      savings = comparableB - comparableA;
    } else {
      recommendation = "b";
      savings = comparableA - comparableB;
    }

    return {
      totalA, totalB,
      comparableA, comparableB, comparableMarks,
      missingA, missingB,
      zeroA, zeroB,
      recommendation, savings,
    };
  }, [rows]);

  function useForProposal(id) {
    onChange({ proposal: { ...(project.proposal ?? {}), quoteId: id, updatedAt: new Date().toISOString() } });
  }

  if (usable.length < 2) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Need two quotes to compare</h3>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          Upload at least two supplier-quote PDFs (each with priced line items) on the <strong>Quotes</strong> tab,
          then return here. The comparison is read directly from the parsed quote rows — edits on the Quotes tab flow through automatically.
        </p>
        {usable.length === 1 && (
          <div className="text-subtle" style={{ fontSize: 12, marginTop: 8 }}>
            One quote is loaded so far ({usable[0].supplier || "(unnamed)"} · {usable[0].items.length} items).
          </div>
        )}
      </div>
    );
  }

  const quoteOptions = usable.map((q) => [q.id, `${q.supplier || "(unnamed)"} · ${q.items.length} items`]);

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Compare two supplier quotes</h3>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectField label="Quote A" value={aId} onChange={setAId} options={quoteOptions} />
          <SelectField label="Quote B" value={bId} onChange={setBId} options={quoteOptions} />
        </div>
        {aId === bId && (
          <div className="text-subtle" style={{ fontSize: 12, marginTop: 8, color: "#94251A" }}>
            Both sides are the same quote — pick a different supplier on one side.
          </div>
        )}
      </div>

      {a && b && aId !== bId && (
        <>
          <SummaryCard
            a={a}
            b={b}
            summary={summary}
            onUseA={() => useForProposal(aId)}
            onUseB={() => useForProposal(bId)}
          />

          <DetailTable a={a} b={b} rows={rows} />
        </>
      )}
    </div>
  );
}

function SummaryCard({ a, b, summary, onUseA, onUseB }) {
  const { totalA, totalB, comparableA, comparableB, comparableMarks, missingA, missingB, zeroA, zeroB, recommendation, savings } = summary;

  const headline = (() => {
    if (recommendation === "insufficient") return "Not enough comparable data";
    if (recommendation === "tie") return "It's a tie";
    if (recommendation === "a") return `Recommend ${a.supplier || "Quote A"}`;
    return `Recommend ${b.supplier || "Quote B"}`;
  })();

  const headlineColor = recommendation === "a" || recommendation === "b" ? "#15623F" : "#666";

  const caveats = [];
  if (missingA.length) caveats.push(`${a.supplier || "Quote A"} is missing ${missingA.length} mark${missingA.length === 1 ? "" : "s"}: ${missingA.join(", ")}`);
  if (missingB.length) caveats.push(`${b.supplier || "Quote B"} is missing ${missingB.length} mark${missingB.length === 1 ? "" : "s"}: ${missingB.join(", ")}`);
  if (zeroA.length) caveats.push(`${a.supplier || "Quote A"} has no unit price for: ${zeroA.join(", ")}`);
  if (zeroB.length) caveats.push(`${b.supplier || "Quote B"} has no unit price for: ${zeroB.join(", ")}`);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px" }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
            Recommendation
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: headlineColor, marginTop: 4 }}>
            {headline}
          </div>
          {recommendation === "a" || recommendation === "b" ? (
            <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {money(savings)} cheaper across {comparableMarks} comparable mark{comparableMarks === 1 ? "" : "s"}
              ({recommendation === "a"
                ? `${money(comparableA)} vs ${money(comparableB)}`
                : `${money(comparableB)} vs ${money(comparableA)}`}).
            </div>
          ) : (
            <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
              {recommendation === "tie" ? "Comparable totals are within $1 of each other." : "No marks appear on both quotes — comparison can't pick a winner."}
            </div>
          )}
        </div>

        <div style={{ flex: "0 1 360px" }}>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              <tr>
                <td className="text-muted">Headline total</td>
                <td style={{ textAlign: "right" }}>{money(totalA)}</td>
                <td style={{ textAlign: "right" }}>{money(totalB)}</td>
              </tr>
              <tr>
                <td className="text-muted">Comparable subtotal</td>
                <td style={{ textAlign: "right" }}>{money(comparableA)}</td>
                <td style={{ textAlign: "right" }}>{money(comparableB)}</td>
              </tr>
              <tr>
                <td></td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{a.supplier || "Quote A"}</td>
                <td style={{ textAlign: "right", fontWeight: 600 }}>{b.supplier || "Quote B"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {caveats.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 6 }}>
            Caveats
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#444" }}>
            {caveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      <div className="row" style={{ marginTop: 14, gap: 8 }}>
        <button className={recommendation === "a" ? "primary" : ""} onClick={onUseA}>
          Use {a.supplier || "Quote A"} for proposal
        </button>
        <button className={recommendation === "b" ? "primary" : ""} onClick={onUseB}>
          Use {b.supplier || "Quote B"} for proposal
        </button>
        <span className="text-subtle" style={{ fontSize: 12, alignSelf: "center" }}>
          Sets the active supplier quote on the Proposal tab.
        </span>
      </div>
    </div>
  );
}

function DetailTable({ a, b, rows }) {
  if (rows.length === 0) {
    return <div className="card text-muted">No marks to compare yet.</div>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Mark</th>
          <th>Qty</th>
          <th>{a.supplier || "Quote A"} unit</th>
          <th>{a.supplier || "Quote A"} line</th>
          <th>{b.supplier || "Quote B"} unit</th>
          <th>{b.supplier || "Quote B"} line</th>
          <th>Δ (line)</th>
          <th>Spec differences</th>
          <th>Winner</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const delta = r.line_b - r.line_a;
          let winner = "—";
          let winnerColor = "#666";
          if (!r.present_a && r.present_b) { winner = b.supplier || "B"; winnerColor = "#15623F"; }
          else if (r.present_a && !r.present_b) { winner = a.supplier || "A"; winnerColor = "#15623F"; }
          else if (r.present_a && r.present_b) {
            if (Math.abs(delta) < 0.5) { winner = "Tie"; winnerColor = "#666"; }
            else if (delta > 0) { winner = a.supplier || "A"; winnerColor = "#15623F"; }
            else { winner = b.supplier || "B"; winnerColor = "#15623F"; }
          }

          return (
            <tr key={r.mark}>
              <td style={{ fontWeight: 600 }}>{r.mark}</td>
              <td>{r.qty}</td>
              <td>{r.present_a ? money(r.cost_a) : <span className="text-subtle">—</span>}</td>
              <td>{r.present_a ? money(r.line_a) : <span className="text-subtle">—</span>}</td>
              <td>{r.present_b ? money(r.cost_b) : <span className="text-subtle">—</span>}</td>
              <td>{r.present_b ? money(r.line_b) : <span className="text-subtle">—</span>}</td>
              <td style={{ color: !r.present_a || !r.present_b ? "#666" : delta === 0 ? "#666" : delta > 0 ? "#15623F" : "#94251A" }}>
                {r.present_a && r.present_b ? fmtDelta(delta) : "—"}
              </td>
              <td style={{ fontSize: 12 }}>
                {r.spec_diffs.length === 0 ? (
                  <span className="text-subtle">none</span>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 14 }}>
                    {r.spec_diffs.map((d) => (
                      <li key={d.key}>
                        <strong>{d.label}:</strong>{" "}
                        <span title={d.a}>{d.a.length > 28 ? d.a.slice(0, 28) + "…" : d.a}</span>
                        {" → "}
                        <span title={d.b}>{d.b.length > 28 ? d.b.slice(0, 28) + "…" : d.b}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td style={{ color: winnerColor, fontWeight: 600 }}>{winner}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
