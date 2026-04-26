export function findDiscrepancies(rfqItems, quoteItems) {
  const byMark = (arr) => Object.fromEntries(arr.map((i) => [i.mark, i]));
  const rfq = byMark(rfqItems);
  const quote = byMark(quoteItems);
  const issues = [];

  for (const mark of Object.keys(rfq)) {
    const r = rfq[mark];
    const q = quote[mark];
    if (!q) {
      issues.push({ mark, kind: "missing_in_quote", detail: `RFQ item ${mark} not in quote` });
      continue;
    }
    if (r.quantity !== q.quantity) {
      issues.push({ mark, kind: "quantity_mismatch", rfq: r.quantity, quote: q.quantity });
    }
    if (r.type && q.type && r.type !== q.type) {
      issues.push({ mark, kind: "type_mismatch", rfq: r.type, quote: q.type });
    }
    if (r.operation && q.operation && r.operation !== q.operation) {
      issues.push({ mark, kind: "operation_mismatch", rfq: r.operation, quote: q.operation });
    }
  }

  for (const mark of Object.keys(quote)) {
    if (!rfq[mark]) {
      issues.push({ mark, kind: "extra_in_quote", detail: `Quote item ${mark} not in RFQ` });
    }
  }

  return { issues, ok: issues.length === 0 };
}
