import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";
import { pickQuoteCost, pickQuoteSpec } from "../lib/quoteLookup.js";

// Mirror of backend/src/engines/pricing.js — keep in sync. Lives client-side
// so the proposal preview is always live: any edit to items, markup,
// overrides, delivery, fees, or round recomputes immediately without an
// API round-trip or stale snapshot.
function applyPricingLocal(items, { markup = 0, overrides = {}, delivery = 0, fees = 0, round = 0 }) {
  const priced = items.map((it) => {
    const ov = overrides[it.mark];
    const m = (ov !== "" && ov != null && !Number.isNaN(Number(ov))) ? Number(ov) / 100 : markup;
    const supplier = Number(it.cost ?? 0);
    let client = supplier * (1 + m);
    if (round > 0) client = Math.round(client / round) * round;
    return { ...it, markup: m, client_price: client };
  });
  const subtotal = priced.reduce((s, it) => s + it.client_price * Number(it.quantity ?? 1), 0);
  return { items: priced, subtotal, delivery, fees, total: subtotal + delivery + fees };
}

// Per-project branding tracks only the fields that genuinely change per
// project: the quote number and the product-spec defaults the user can
// override for this client. Company-level brand (name, address, phone,
// accent color, logo) lives on Company Info and is pulled by the proposal
// generator's fallback chain — it should not be re-entered per project.
const defaultBranding = {
  quoteNumber: "",
  extColor: "Matte Black, Powder Coating",
  intColor: "Matte Black, Powder Coating",
  glassSpec:
    "6mm Low E (Interior) +20A+Warm edge spacer+Argon gas+ 6mm Low E (Exterior), Double Tempered Glass",
};

// Strip any legacy company-level brand fields that may still be present in
// older saved data (company, companyAddress, etc.). These were moved to
// Company Info — keeping them in state would let stale values silently
// flow into the PDF generator.
function sanitizeBranding(saved) {
  const allowed = ["quoteNumber", "extColor", "intColor", "glassSpec"];
  const out = { ...defaultBranding };
  for (const k of allowed) if (saved && k in saved) out[k] = saved[k];
  return out;
}

// Build a project Item from a supplier-quote line so the user can skip
// re-entering items in the Items tab when the quote already has them all.
// Only carries identity / spec fields — pricing fields (unit_price_usd,
// total_price_usd, cost) stay on the quote side; the proposal pulls cost
// from the matched quote line at pricing time.
function quoteLineToItem(q) {
  const blank = {
    mark: "", quantity: 1, type: "fixed", operation: "", material: "Aluminum",
    width_in: 36, height_in: 48, panels: 1, gridRows: 1, gridCols: 1,
    operableRow: "all", notes: "", sketchImage: "",
  };
  // Project items use a PER-PANEL width_in (the proposal computes
  // total = width_in × panels). Supplier quote lines store width_in as
  // the TOTAL assembled width — that's what the spec sheet prints. So
  // when we import we divide by the supplier's panel count so the
  // existing `total = width_in × panels` formula reproduces the
  // supplier's number exactly. If panels is 1 or missing this is a
  // no-op.
  const qPanels = Math.max(1, Math.floor(Number(q?.panels ?? 1) || 1));
  const qTotalWidthIn = Number(q?.width_in ?? 0) || 0;
  const perPanelWidthIn = qPanels > 1 ? qTotalWidthIn / qPanels : qTotalWidthIn;
  return {
    ...blank,
    mark: (q?.mark ?? "").trim(),
    quantity: Number(q?.quantity ?? 1) || 1,
    type: (q?.type ?? "fixed").trim().toLowerCase() || "fixed",
    operation: q?.operation ?? "",
    material: q?.material || "Aluminum",
    width_in: perPanelWidthIn,
    height_in: Number(q?.height_in ?? 0) || 0,
    panels: qPanels,
    notes: q?.notes ?? "",
    glass: q?.glass ?? "",
    extColor: q?.ext_color ?? "",
    intColor: q?.int_color ?? "",
    thickness: q?.thickness ?? "",
    profile: q?.profile ?? "",
  };
}

// Pull all line items from one quote (or every quote) and return a
// deduped item list, keyed by mark. If two quotes share a mark, the
// first one wins so the user can pick a "primary" quote when multiple
// suppliers bid the same project.
function itemsFromQuotes(quotes) {
  const seen = new Set();
  const out = [];
  for (const q of quotes) {
    for (const line of q?.items ?? []) {
      const it = quoteLineToItem(line);
      if (!it.mark) continue;
      if (seen.has(it.mark)) continue;
      seen.add(it.mark);
      out.push(it);
    }
  }
  return out;
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
  const [branding, setBranding] = useState(() => sanitizeBranding(saved.branding));
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

  // Live-priced preview. Recomputes on every change to items, the active
  // quote, markup, overrides, delivery, fees, or round — so an edit in
  // the Items tab is reflected here the next render with no "Apply"
  // button to click.
  const priced = useMemo(() => applyPricingLocal(itemsWithCost, {
    markup: Number(markup) / 100,
    overrides,
    delivery: Number(delivery),
    fees: Number(fees),
    round: Number(round),
  }), [itemsWithCost, markup, overrides, delivery, fees, round]);

  // Persist the user-controlled settings (not the priced snapshot, since
  // that's now derived) so they survive across sessions. Skip the very
  // first render so we don't write back the same values we just loaded.
  const firstSettingsRender = useRef(true);
  useEffect(() => {
    if (firstSettingsRender.current) { firstSettingsRender.current = false; return; }
    onChange({
      proposal: {
        quoteId, markup, delivery, fees, round, overrides, branding,
        updatedAt: new Date().toISOString(),
      },
    });
    // onChange is stable per ProjectView render; intentionally omitted to
    // avoid re-firing on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, markup, delivery, fees, round, overrides, branding]);

  async function downloadPdf() {
    if (!priced) return;
    setDownloading(true);
    setError("");
    try {
      // Brand identity (company name, address, phone, accent color) is pulled
      // from Company Info by the server-side fallback chain — don't pass it
      // here. Per-project fields stay: quote #, default product specs, and
      // the project's own customer/site info.
      const fullBranding = {
        ...branding,
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

  function importFromQuote(quote) {
    const imported = itemsFromQuotes([quote]);
    if (imported.length === 0) return;
    onChange({ items: imported });
  }

  function importFromAllQuotes() {
    const imported = itemsFromQuotes(quotes);
    if (imported.length === 0) return;
    onChange({ items: imported });
  }

  if (items.length === 0) {
    const quotesWithItems = quotes.filter((q) => (q.items ?? []).length > 0);
    if (quotesWithItems.length === 0) {
      return <div className="card">Add items in the Items tab before building a proposal.</div>;
    }
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>No items yet — import from a quote?</h3>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          You don't have any items in the Items tab. If your supplier quote already lists every product,
          you can pull the items straight in instead of re-entering them.
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          {quotesWithItems.map((q) => (
            <button key={q.id} className="primary" onClick={() => importFromQuote(q)}>
              Use {q.items.length} item{q.items.length === 1 ? "" : "s"} from {q.supplier || "(unnamed quote)"}
            </button>
          ))}
          {quotesWithItems.length > 1 && (
            <button onClick={importFromAllQuotes}>
              Merge all quotes ({quotesWithItems.reduce((s, q) => s + q.items.length, 0)} unique marks)
            </button>
          )}
        </div>
        <div className="text-subtle" style={{ marginTop: 10, fontSize: 12 }}>
          This copies mark, dimensions, type, operation, glass, colors, and material onto Items. Pricing still
          comes from the chosen Supplier quote dropdown above the proposal table.
        </div>
      </div>
    );
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
          <TextField label="Quote #" value={branding.quoteNumber} onChange={(v) => setBranding({ ...branding, quoteNumber: v })} inputStyle={{ width: 120 }} />
        </div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
          Preview updates live as you edit pricing or items in the Items tab.
          Company name, address, phone, and brand color come from{" "}
          <a href="/settings/company-info">Company Info</a>.
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


      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

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
        Edits in the Items tab and changes to the inputs above are reflected here automatically.
      </div>
    </div>
  );
}
