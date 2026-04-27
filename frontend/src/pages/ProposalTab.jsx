import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

const defaultBranding = {
  company: "",
  tagline: "",
  color: "#B85C38",
  companyAddress: "",
  companyPhone: "",
  quoteNumber: "",
  extColor: "Matte Black, Powder Coating",
  intColor: "Matte Black, Powder Coating",
  glassSpec:
    "6mm Low E (Interior) +20A+Warm edge spacer+Argon gas+ 6mm Low E (Exterior), Double Tempered Glass",
  whoWeAre: "",
  whatWeBelieve: "",
};

// Find the supplier-quote line for a given RFQ mark. Suppliers sometimes split
// a single mark into orientation variants (G1, G2). For an RFQ mark "G", any
// quote mark matching ^G\d+$ counts as the same product (for spec lookup the
// first variant wins; cost sums across all variants since each variant is its
// own priced unit).
function findQuoteMatches(quoteItems, mark) {
  if (!Array.isArray(quoteItems) || !mark) return [];
  const exact = quoteItems.filter((q) => q.mark === mark);
  if (exact.length) return exact;
  const variantRe = new RegExp(`^${mark}\\d+$`);
  return quoteItems.filter((q) => variantRe.test(q.mark || ""));
}

// Per-unit cost. Prefer unit_price_usd; fall back to total_price_usd / quantity.
// `cost` is the legacy field name kept for old data.
function pickQuoteCost(quoteItems, mark) {
  const matches = findQuoteMatches(quoteItems, mark);
  if (!matches.length) return 0;
  // For variant splits we sum unit prices (each variant is one unit of the assembly).
  let unit = 0;
  for (const m of matches) {
    const u = Number(m.unit_price_usd ?? m.cost ?? 0);
    if (u > 0) { unit += u; continue; }
    const total = Number(m.total_price_usd ?? 0);
    const qty = Number(m.quantity ?? 1) || 1;
    if (total > 0) unit += total / qty;
  }
  return unit;
}

// Pick the glass / color / material spec from the matched supplier line so it
// can flow into the proposal. First non-empty value across variants wins.
function pickQuoteSpec(quoteItems, mark) {
  const matches = findQuoteMatches(quoteItems, mark);
  const firstNonEmpty = (key) => {
    for (const m of matches) {
      const v = (m?.[key] ?? "").toString().trim();
      if (v) return v;
    }
    return "";
  };
  return {
    glass: firstNonEmpty("glass"),
    ext_color: firstNonEmpty("ext_color"),
    int_color: firstNonEmpty("int_color"),
    material: firstNonEmpty("material"),
    thickness: firstNonEmpty("thickness"),
    profile: firstNonEmpty("profile"),
  };
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
    return items.map((it) => {
      const spec = pickQuoteSpec(activeQuote.items, it.mark);
      return {
        ...it,
        cost: pickQuoteCost(activeQuote.items, it.mark),
        // Spec from supplier flows into the proposal card. Per-item values on
        // the project item itself (if a user set them manually) win.
        material: it.material || spec.material || "Aluminum",
        glass: it.glass || spec.glass,
        extColor: it.extColor || spec.ext_color,
        intColor: it.intColor || spec.int_color,
        thickness: it.thickness || spec.thickness,
        profile: it.profile || spec.profile,
      };
    });
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
      // Merge branding + customer/site info from project so the PDF header is
      // populated. Branding wins per-field if set.
      const fullBranding = {
        ...branding,
        company: branding.company || project.info?.company || "Healy Windows and Doors",
        customerName: project.info?.buyerName || "",
        siteAddress: project.info?.address || "",
        deliveryCharge: Number(priced.delivery ?? 0),
      };
      await api.downloadProposalPdf(
        priced.items,
        project.name,
        fullBranding,
        { delivery: priced.delivery, fees: priced.fees, total: priced.total },
        project.info ?? {}
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
        <h3 style={{ marginTop: 0 }}>Proposal header & branding</h3>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
          These appear in the cover and header bar of the generated proposal PDF. Customer and site
          come from the Project Info tab.
        </p>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField label="Company name" value={branding.company} onChange={(v) => setBranding({ ...branding, company: v })} inputStyle={{ minWidth: 220 }} />
          <TextField label="Company address" value={branding.companyAddress} onChange={(v) => setBranding({ ...branding, companyAddress: v })} inputStyle={{ minWidth: 240 }} />
          <TextField label="Company phone" value={branding.companyPhone} onChange={(v) => setBranding({ ...branding, companyPhone: v })} />
          <TextField label="Quote #" value={branding.quoteNumber} onChange={(v) => setBranding({ ...branding, quoteNumber: v })} inputStyle={{ width: 120 }} />
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="text-muted" style={{ fontSize: 11 }}>Brand color</span>
            <input type="color" value={branding.color} onChange={(e) => setBranding({ ...branding, color: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Default product specs</h3>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 12 }}>
          These default colors and glass spec print on every item card unless overridden per item.
        </p>
        <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField label="Ext color" value={branding.extColor} onChange={(v) => setBranding({ ...branding, extColor: v })} inputStyle={{ minWidth: 240 }} />
          <TextField label="Interior color" value={branding.intColor} onChange={(v) => setBranding({ ...branding, intColor: v })} inputStyle={{ minWidth: 240 }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="text-muted" style={{ fontSize: 11 }}>Glass spec</span>
            <textarea
              value={branding.glassSpec}
              onChange={(e) => setBranding({ ...branding, glassSpec: e.target.value })}
              rows={2}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 13 }}
            />
          </label>
        </div>
      </div>

      <details className="card" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Cover-page copy (optional)</summary>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 8, marginBottom: 12 }}>
          Override the "Who We Are" and "What We Believe In" paragraphs on the proposal cover. Leave
          blank to use the defaults.
        </p>
        <label style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
          <span className="text-muted" style={{ fontSize: 11 }}>Who We Are</span>
          <textarea
            value={branding.whoWeAre}
            onChange={(e) => setBranding({ ...branding, whoWeAre: e.target.value })}
            rows={3}
            placeholder="~50 words about your company"
            style={{ width: "100%", fontFamily: "inherit", fontSize: 13 }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="text-muted" style={{ fontSize: 11 }}>What We Believe In</span>
          <textarea
            value={branding.whatWeBelieve}
            onChange={(e) => setBranding({ ...branding, whatWeBelieve: e.target.value })}
            rows={3}
            placeholder="~70 words about certifications + warranty"
            style={{ width: "100%", fontFamily: "inherit", fontSize: 13 }}
          />
        </label>
      </details>

      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

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
                <th>Supplier cost</th><th>Markup %</th><th>Client price</th><th>Line total</th>
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
          <div className="text-subtle" style={{ marginTop: 8, fontSize: 12 }}>
            Edit any per-item markup % above and click "Apply pricing" again to recompute.
          </div>
        </>
      )}
    </div>
  );
}
