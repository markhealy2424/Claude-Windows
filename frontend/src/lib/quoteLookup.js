// Shared helpers for matching project marks against supplier-quote line items.
//
// Suppliers sometimes split a single project mark into orientation variants
// (G1, G2). For a project mark "G", any supplier mark matching ^G\d+$ counts
// as the same product — exact matches take precedence; if there are no exact
// matches we fall back to variant suffixes.

export function findQuoteMatches(quoteItems, mark) {
  if (!Array.isArray(quoteItems) || !mark) return [];
  const exact = quoteItems.filter((q) => q.mark === mark);
  if (exact.length) return exact;
  const variantRe = new RegExp(`^${mark}\\d+$`);
  return quoteItems.filter((q) => variantRe.test(q.mark || ""));
}

// Per-unit cost. Prefer unit_price_usd; fall back to total_price_usd / quantity.
// `cost` is the legacy field name kept for old data. For variant splits we sum
// unit prices since each variant is one unit of the assembled product.
export function pickQuoteCost(quoteItems, mark) {
  const matches = findQuoteMatches(quoteItems, mark);
  if (!matches.length) return 0;
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

// First non-empty value across variants wins for each spec field.
export function pickQuoteSpec(quoteItems, mark) {
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
