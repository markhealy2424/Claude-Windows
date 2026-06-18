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
    let itemsA = 0, itemsB = 0;
    let comparableItemsA = 0, comparableItemsB = 0;
    let comparableMarks = 0;
    const missingA = [];
    const missingB = [];
    const zeroA = [];
    const zeroB = [];

    for (const r of rows) {
      itemsA += r.line_a;
      itemsB += r.line_b;
      if (r.present_a && r.present_b) {
        comparableItemsA += r.line_a;
        comparableItemsB += r.line_b;
        comparableMarks += 1;
      }
      if (!r.present_a) missingA.push(r.mark);
      if (!r.present_b) missingB.push(r.mark);
      if (r.present_a && r.cost_a === 0) zeroA.push(r.mark);
      if (r.present_b && r.cost_b === 0) zeroB.push(r.mark);
    }

    const freightA = Number(a?.freight_usd) || 0;
    const freightB = Number(b?.freight_usd) || 0;

    // Freight is a real cost difference between suppliers, so it counts
    // toward the recommendation alongside the comparable-mark subtotal.
    const totalA = itemsA + freightA;
    const totalB = itemsB + freightB;
    const comparableA = comparableItemsA + freightA;
    const comparableB = comparableItemsB + freightB;

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
      itemsA, itemsB,
      freightA, freightB,
      totalA, totalB,
      comparableItemsA, comparableItemsB,
      comparableA, comparableB, comparableMarks,
      missingA, missingB,
      zeroA, zeroB,
      recommendation, savings,
    };
  }, [rows, a, b]);

  function useForProposal(id) {
    onChange({ proposal: { ...(project.proposal ?? {}), quoteId: id, updatedAt: new Date().toISOString() } });
  }

  function updateQuote(id, patch) {
    onChange({ quotes: quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
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
          <div className="text-subtle" style={{ fontSize: 12, marginTop: 8, color: "var(--color-error)" }}>
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

          <LedgerCard
            a={a}
            b={b}
            summary={summary}
            onSetFreightA={(v) => updateQuote(aId, { freight_usd: v })}
            onSetFreightB={(v) => updateQuote(bId, { freight_usd: v })}
          />

          <DetailTable a={a} b={b} rows={rows} />
        </>
      )}
    </div>
  );
}

function SummaryCard({ a, b, summary, onUseA, onUseB }) {
  const {
    freightA, freightB,
    comparableA, comparableB, comparableMarks,
    missingA, missingB, zeroA, zeroB,
    recommendation, savings,
  } = summary;

  const supplierA = a.supplier || "Quote A";
  const supplierB = b.supplier || "Quote B";

  // Resolve winner / loser based on recommendation so the hero stats can
  // tell a single coherent story: "X saved with WINNER, LOSER missing N items".
  const winnerName  = recommendation === "a" ? supplierA : recommendation === "b" ? supplierB : null;
  const loserName   = recommendation === "a" ? supplierB : recommendation === "b" ? supplierA : null;
  const loserMissing = recommendation === "a" ? missingB : recommendation === "b" ? missingA : [];

  const showHeroStats = recommendation === "a" || recommendation === "b";

  // Non-missing-items caveats still surface (zero prices, mismatched freight),
  // just below the hero in a quieter footer slot.
  const otherCaveats = [];
  if (zeroA.length) otherCaveats.push(`${supplierA} has no unit price for: ${zeroA.join(", ")}`);
  if (zeroB.length) otherCaveats.push(`${supplierB} has no unit price for: ${zeroB.join(", ")}`);
  if (freightA > 0 && freightB === 0) otherCaveats.push(`${supplierB} has no freight listed — confirm whether shipping is included or quoted EXW (pickup-only).`);
  if (freightB > 0 && freightA === 0) otherCaveats.push(`${supplierA} has no freight listed — confirm whether shipping is included or quoted EXW (pickup-only).`);
  // For tie/insufficient, surface missing-items in the secondary list too so
  // the info isn't lost (hero stats only show them in the win/win cases).
  if (!showHeroStats) {
    if (missingA.length) otherCaveats.push(`${supplierA} is missing ${missingA.length} mark${missingA.length === 1 ? "" : "s"}: ${missingA.join(", ")}`);
    if (missingB.length) otherCaveats.push(`${supplierB} is missing ${missingB.length} mark${missingB.length === 1 ? "" : "s"}: ${missingB.join(", ")}`);
  }

  return (
    <div className="compare-hero">
      <div className="compare-hero-eyebrow">AI Recommendation</div>

      {showHeroStats ? (
        <>
          <div className="compare-hero-stats">
            <div className="stat-card stat-card--win">
              <div className="stat-num stat-num--win">{money(savings)}</div>
              <div className="stat-label">Saved</div>
              <div className="stat-sub">{supplierA} {recommendation === "a" ? "beats" : "vs"} {supplierB}</div>
            </div>
            <div className={`stat-card ${loserMissing.length > 0 ? "stat-card--warn" : ""}`}>
              <div className={`stat-num ${loserMissing.length > 0 ? "stat-num--warn" : ""}`}>
                {loserMissing.length}
              </div>
              <div className="stat-label">Items missing</div>
              <div className="stat-sub">
                {loserMissing.length > 0
                  ? <>from {loserName}: {loserMissing.join(", ")}</>
                  : <>both quotes cover all marks</>}
              </div>
            </div>
            <div className="stat-card stat-card--accent">
              <div className="stat-num stat-num--accent" style={{ fontSize: 26 }}>{winnerName}</div>
              <div className="stat-label">Recommended</div>
              <div className="stat-sub">
                {money(comparableA < comparableB ? comparableA : comparableB)} vs {money(comparableA < comparableB ? comparableB : comparableA)} on {comparableMarks} comparable mark{comparableMarks === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginBottom: "var(--s-5)" }}>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {recommendation === "tie" ? "It's a tie" : "Not enough comparable data"}
          </div>
          <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            {recommendation === "tie"
              ? "Comparable totals are within $1 of each other."
              : "No marks appear on both quotes — comparison can't pick a winner."}
          </div>
        </div>
      )}

      <div className="compare-hero-actions">
        <button className={recommendation === "a" ? "primary" : ""} onClick={onUseA}>
          Use {supplierA} for proposal
        </button>
        <button className={recommendation === "b" ? "primary" : ""} onClick={onUseB}>
          Use {supplierB} for proposal
        </button>
        <span className="text-subtle">Sets the active supplier quote on the Proposal tab.</span>
      </div>

      {otherCaveats.length > 0 && (
        <div style={{ marginTop: "var(--s-4)", paddingTop: "var(--s-3)", borderTop: "1px solid var(--color-divider)" }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600, marginBottom: 6 }}>
            Also worth flagging
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--color-text-muted)" }}>
            {otherCaveats.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      <div className="text-subtle" style={{ fontSize: 11, marginTop: "var(--s-4)", paddingTop: "var(--s-3)", borderTop: "1px solid var(--color-divider)", lineHeight: 1.5 }}>
        Window Stream's AI cross-referenced specs and prices across {supplierA} and {supplierB}. <strong>Always verify the line items against the original supplier PDFs</strong> before committing to a purchase order.
      </div>
    </div>
  );
}

function LedgerCard({ a, b, summary, onSetFreightA, onSetFreightB }) {
  const {
    itemsA, itemsB, freightA, freightB,
    totalA, totalB,
    comparableItemsA, comparableItemsB,
    comparableA, comparableB,
  } = summary;
  const supplierA = a.supplier || "Quote A";
  const supplierB = b.supplier || "Quote B";

  return (
    <div className="compare-ledger">
      <div className="compare-ledger-title">Comparison details</div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th style={{ textAlign: "right" }}>{supplierA}</th>
            <th style={{ textAlign: "right" }}>{supplierB}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="text-muted">Items subtotal</td>
            <td style={{ textAlign: "right" }}>{money(itemsA)}</td>
            <td style={{ textAlign: "right" }}>{money(itemsB)}</td>
          </tr>
          <tr>
            <td className="text-muted">Freight</td>
            <td style={{ textAlign: "right" }}><FreightInput value={freightA} onChange={onSetFreightA} /></td>
            <td style={{ textAlign: "right" }}><FreightInput value={freightB} onChange={onSetFreightB} /></td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Headline total</td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{money(totalA)}</td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{money(totalB)}</td>
          </tr>
          <tr className="ledger-divider"><td colSpan={3}></td></tr>
          <tr>
            <td className="text-muted">Comparable items</td>
            <td style={{ textAlign: "right" }}>{money(comparableItemsA)}</td>
            <td style={{ textAlign: "right" }}>{money(comparableItemsB)}</td>
          </tr>
          <tr>
            <td className="text-muted">+ Freight</td>
            <td style={{ textAlign: "right" }}>{freightA > 0 ? money(freightA) : <span className="text-subtle">—</span>}</td>
            <td style={{ textAlign: "right" }}>{freightB > 0 ? money(freightB) : <span className="text-subtle">—</span>}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 600 }}>Comparable total</td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{money(comparableA)}</td>
            <td style={{ textAlign: "right", fontWeight: 600 }}>{money(comparableB)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DetailTable({ a, b, rows }) {
  if (rows.length === 0) {
    return <div className="card text-muted">No marks to compare yet.</div>;
  }

  return (
    <div className="table-scroll">
    <table className="compact">
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
          if (!r.present_a && r.present_b) { winner = b.supplier || "B"; winnerColor = "var(--color-success)"; }
          else if (r.present_a && !r.present_b) { winner = a.supplier || "A"; winnerColor = "var(--color-success)"; }
          else if (r.present_a && r.present_b) {
            if (Math.abs(delta) < 0.5) { winner = "Tie"; winnerColor = "#666"; }
            else if (delta > 0) { winner = a.supplier || "A"; winnerColor = "var(--color-success)"; }
            else { winner = b.supplier || "B"; winnerColor = "var(--color-success)"; }
          }

          return (
            <tr key={r.mark}>
              <td style={{ fontWeight: 600 }}>{r.mark}</td>
              <td>{r.qty}</td>
              <td>{r.present_a ? money(r.cost_a) : <span className="text-subtle">—</span>}</td>
              <td>{r.present_a ? money(r.line_a) : <span className="text-subtle">—</span>}</td>
              <td>{r.present_b ? money(r.cost_b) : <span className="text-subtle">—</span>}</td>
              <td>{r.present_b ? money(r.line_b) : <span className="text-subtle">—</span>}</td>
              <td style={{ color: !r.present_a || !r.present_b ? "#666" : delta === 0 ? "#666" : delta > 0 ? "var(--color-success)" : "var(--color-error)" }}>
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
    </div>
  );
}

function FreightInput({ value, onChange }) {
  return (
    <input
      type="number"
      value={value ?? 0}
      min={0}
      step="0.01"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
      style={{ width: 100, textAlign: "right" }}
    />
  );
}
