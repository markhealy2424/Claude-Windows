import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

const defaultBranding = { company: "", tagline: "", color: "#111" };

function pickQuoteCost(quoteItems, mark) {
  const m = quoteItems.find((q) => q.mark === mark);
  return m ? Number(m.cost ?? 0) : 0;
}

export default function ProposalTab({ project, onChange }) {
  const items = project.items ?? [];
  const quotes = project.quotes ?? [];
  const saved = project.proposal ?? {};

  const [quoteId, setQuoteId] = useState(saved.quoteId ?? quotes[0]?.id ?? "");
  const [markup, setMarkup] = useState(saved.markup ?? 30);
  const [delivery, setDelivery] = useState(saved.delivery ?? 0);
  const [fees, setFees] = useState(saved.fees ?? 0);
  const [round, setRound] = useState(saved.round ?? 0);
  const [overrides, setOverrides] = useState(saved.overrides ?? {});
  const [branding, setBranding] = useState({ ...defaultBranding, ...(saved.branding ?? {}) });
  const [priced, setPriced] = useState(saved.priced ?? null);
  const [pricing, setPricing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const activeQuote = useMemo(() => quotes.find((q) => q.id === quoteId) ?? null, [quotes, quoteId]);

  const itemsWithCost = useMemo(() => {
    if (!activeQuote) return items.map((it) => ({ ...it, cost: 0 }));
    return items.map((it) => ({ ...it, cost: pickQuoteCost(activeQuote.items, it.mark) }));
  }, [items, activeQuote]);

  useEffect(() => {
    if (!quoteId && quotes[0]?.id) setQuoteId(quotes[0].id);
  }, [quotes, quoteId]);

  async function runPricing() {
    setPricing(true);
    setError("");
    try {
      const result = await api.applyPricing(itemsWithCost, {
        markup: Number(markup) / 100,
        overrides: Object.fromEntries(
          Object.entries(overrides)
            .filter(([, v]) => v !== "" && v != null)
            .map(([k, v]) => [k, { markup: Number(v) / 100 }])
        ),
        delivery: Number(delivery),
        fees: Number(fees),
        round: Number(round),
      });
      setPriced(result);
      onChange({
        proposal: {
          quoteId, markup, delivery, fees, round, overrides, branding,
          priced: result, updatedAt: new Date().toISOString(),
        },
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setPricing(false);
    }
  }

  async function downloadPdf() {
    if (!priced) return;
    setDownloading(true);
    setError("");
    try {
      await api.downloadProposalPdf(
        priced.items,
        project.name,
        branding,
        { delivery: priced.delivery, fees: priced.fees, total: priced.total }
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  }

  if (items.length === 0) {
    return <div className="card">Add items in the Items tab before building a proposal.</div>;
  }

  const money = (n) =>
    Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Pricing</h3>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <SelectField
            label="Supplier quote"
            value={quoteId}
            onChange={setQuoteId}
            options={[
              ["", "— none (zero cost) —"],
              ...quotes.map((q) => [q.id, `${q.supplier || "(unnamed)"} · ${q.items.length}`]),
            ]}
          />
          <NumberField label="Markup %" value={markup} onChange={setMarkup} inputStyle={{ width: 80 }} />
          <NumberField label="Delivery ($)" value={delivery} onChange={setDelivery} inputStyle={{ width: 90 }} />
          <NumberField label="Fees ($)" value={fees} onChange={setFees} inputStyle={{ width: 90 }} />
          <NumberField label="Round to" value={round} onChange={setRound} inputStyle={{ width: 80 }} />
          <button className="primary" onClick={runPricing} disabled={pricing}>
            {pricing ? "Pricing…" : "Apply pricing"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Branding</h3>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField label="Company" value={branding.company} onChange={(v) => setBranding({ ...branding, company: v })} />
          <TextField label="Tagline" value={branding.tagline} onChange={(v) => setBranding({ ...branding, tagline: v })} />
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#666" }}>Header color</span>
            <input type="color" value={branding.color} onChange={(e) => setBranding({ ...branding, color: e.target.value })} />
          </label>
        </div>
      </div>

      {error && <div className="card" style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}

      {priced && (
        <>
          <div className="row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
            <strong>Preview</strong>
            <button className="primary" onClick={downloadPdf} disabled={downloading}>
              {downloading ? "Building PDF…" : "Download proposal PDF"}
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th><th>Qty</th><th>Description</th><th>Width</th><th>Height</th>
                <th>Supplier</th><th>Markup %</th><th>Client price</th><th>Line total</th>
              </tr>
            </thead>
            <tbody>
              {priced.items.map((it, i) => {
                const lineTotal = Number(it.client_price ?? 0) * Number(it.quantity ?? 1);
                const totalW = it.width_in != null ? Number(it.width_in) * Math.max(1, Math.floor(Number(it.panels ?? 1))) : null;
                return (
                  <tr key={i}>
                    <td>{it.mark}</td>
                    <td>{it.quantity}</td>
                    <td>{[it.type, it.operation].filter(Boolean).join(", ")}</td>
                    <td>{totalW != null ? `${totalW}"` : "?"}</td>
                    <td>{it.height_in != null ? `${it.height_in}"` : "?"}</td>
                    <td>{money(it.cost)}</td>
                    <td>
                      <input
                        type="number"
                        value={overrides[it.mark] ?? ""}
                        placeholder={String(markup)}
                        style={{ width: 70 }}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setOverrides({ ...overrides, [it.mark]: e.target.value })}
                      />
                    </td>
                    <td>{money(it.client_price)}</td>
                    <td>{money(lineTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={8} style={{ textAlign: "right" }}>Subtotal</td><td>{money(priced.subtotal)}</td></tr>
              {Number(priced.delivery) > 0 && <tr><td colSpan={8} style={{ textAlign: "right" }}>Delivery</td><td>{money(priced.delivery)}</td></tr>}
              {Number(priced.fees) > 0 && <tr><td colSpan={8} style={{ textAlign: "right" }}>Fees</td><td>{money(priced.fees)}</td></tr>}
              <tr><td colSpan={8} style={{ textAlign: "right", fontWeight: 600 }}>Total</td><td style={{ fontWeight: 600 }}>{money(priced.total)}</td></tr>
            </tfoot>
          </table>
          <div style={{ color: "#888", marginTop: 8, fontSize: 12 }}>
            Edit any per-item markup % above and click "Apply pricing" again to recompute.
          </div>
        </>
      )}
    </div>
  );
}
