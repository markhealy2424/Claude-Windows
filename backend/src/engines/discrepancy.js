// Compare RFQ items (project items) against parsed supplier-quote items.
// Surfaces every mismatch the user should mention back to the supplier.
//
// RFQ items come from the project's items array. Their width is per-panel,
// so total width = width_in × panels. The supplier quote reports the TOTAL
// unit width directly. We compare totals.
//
// Suppliers often split a single RFQ mark into orientation variants (G1, G2,
// L1, L2, N1, N2, O1, O2). We collapse <letter><digit> variants back to the
// base letter so the totals can be compared sensibly.

function baseMark(mark) {
  // "G1" → "G", "O2" → "O", "N1" → "N". Keep multi-letter or pure-numeric
  // marks unchanged ("D11" stays "D11", "11" stays "11").
  const m = String(mark || "").trim();
  if (/^[A-Z]\d+$/.test(m)) return m[0];
  return m;
}

function collapseByBaseMark(items) {
  const out = new Map();
  for (const it of items) {
    const key = baseMark(it.mark);
    const existing = out.get(key);
    if (!existing) {
      out.set(key, { ...it, mark: key, _variants: [it.mark] });
    } else {
      existing.quantity = (existing.quantity || 0) + (it.quantity || 0);
      existing._variants.push(it.mark);
      // Keep first non-empty values for the descriptive fields. If width or
      // height differ across variants we'll surface that as a separate issue.
      if (!existing.type && it.type) existing.type = it.type;
      if (!existing.material && it.material) existing.material = it.material;
      if (!existing.width_in && it.width_in) existing.width_in = it.width_in;
      if (!existing.height_in && it.height_in) existing.height_in = it.height_in;
    }
  }
  return [...out.values()];
}

// Strict tolerance: flag any difference greater than 0.99 mm. This catches
// real dimensional mismatches while ignoring inch↔mm conversion rounding
// (e.g. 36" → 914.4 mm → 36.0" diff is well under 1 mm).
const DIM_TOLERANCE_MM = 0.99;
const MM_PER_IN = 25.4;

function dimMatches(aIn, bIn) {
  if (aIn == null || bIn == null) return true;  // can't compare → don't flag
  const diffMm = Math.abs(Number(aIn) - Number(bIn)) * MM_PER_IN;
  return diffMm <= DIM_TOLERANCE_MM;
}

function strMatch(a, b) {
  if (!a || !b) return true;
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function rfqTotalWidth(item) {
  if (item.width_in == null) return null;
  const panels = Math.max(1, Math.floor(Number(item.panels ?? 1)));
  return Number(item.width_in) * panels;
}

export function findDiscrepancies(rfqItems, quoteItems) {
  const collapsedQuote = collapseByBaseMark(quoteItems ?? []);
  const rfqByMark = new Map((rfqItems ?? []).map((it) => [String(it.mark).trim(), it]));
  const quoteByMark = new Map(collapsedQuote.map((it) => [String(it.mark).trim(), it]));

  const issues = [];

  for (const [mark, r] of rfqByMark) {
    const q = quoteByMark.get(mark);
    if (!q) {
      issues.push({
        mark,
        kind: "missing_in_quote",
        severity: "high",
        message: `Mark ${mark} is in the RFQ but missing from the supplier's quote.`,
      });
      continue;
    }
    const variantSuffix = q._variants.length > 1 ? ` (split into ${q._variants.join(", ")})` : "";

    if (Number(r.quantity ?? 0) !== Number(q.quantity ?? 0)) {
      issues.push({
        mark,
        kind: "quantity_mismatch",
        severity: "high",
        rfq: r.quantity,
        quote: q.quantity,
        message: `Quantity for mark ${mark}${variantSuffix}: RFQ ${r.quantity} vs quote ${q.quantity}.`,
      });
    }

    if (r.type && q.type && !strMatch(r.type, q.type)) {
      issues.push({
        mark,
        kind: "type_mismatch",
        severity: "high",
        rfq: r.type,
        quote: q.type,
        message: `Type for mark ${mark}${variantSuffix}: RFQ "${r.type}" vs quote "${q.type}".`,
      });
    }

    if (r.material && q.material && !strMatch(r.material, q.material)) {
      issues.push({
        mark,
        kind: "material_mismatch",
        severity: "medium",
        rfq: r.material,
        quote: q.material,
        message: `Material for mark ${mark}${variantSuffix}: RFQ "${r.material}" vs quote "${q.material}".`,
      });
    }

    const rfqTotalW = rfqTotalWidth(r);
    if (rfqTotalW != null && q.width_in != null && !dimMatches(rfqTotalW, q.width_in)) {
      const diffMm = Math.round(Math.abs(rfqTotalW - q.width_in) * MM_PER_IN * 10) / 10;
      issues.push({
        mark,
        kind: "width_mismatch",
        severity: "high",
        rfq: rfqTotalW,
        quote: q.width_in,
        diff_mm: diffMm,
        message: `Total width for mark ${mark}${variantSuffix}: RFQ ${rfqTotalW}" vs quote ${q.width_in}" (off by ${diffMm} mm).`,
      });
    }

    if (r.height_in != null && q.height_in != null && !dimMatches(r.height_in, q.height_in)) {
      const diffMm = Math.round(Math.abs(r.height_in - q.height_in) * MM_PER_IN * 10) / 10;
      issues.push({
        mark,
        kind: "height_mismatch",
        severity: "high",
        rfq: r.height_in,
        quote: q.height_in,
        diff_mm: diffMm,
        message: `Height for mark ${mark}${variantSuffix}: RFQ ${r.height_in}" vs quote ${q.height_in}" (off by ${diffMm} mm).`,
      });
    }

    if (r.operation && q.operation && !strMatch(r.operation, q.operation)) {
      issues.push({
        mark,
        kind: "operation_mismatch",
        severity: "low",
        rfq: r.operation,
        quote: q.operation,
        message: `Operation for mark ${mark}${variantSuffix}: RFQ "${r.operation}" vs quote "${q.operation}".`,
      });
    }
  }

  for (const [mark, q] of quoteByMark) {
    if (!rfqByMark.has(mark)) {
      const variantSuffix = q._variants.length > 1 ? ` (variants: ${q._variants.join(", ")})` : "";
      issues.push({
        mark,
        kind: "extra_in_quote",
        severity: "medium",
        message: `Mark ${mark}${variantSuffix} is in the supplier's quote but not in the RFQ.`,
      });
    }
  }

  return { issues, ok: issues.length === 0 };
}
