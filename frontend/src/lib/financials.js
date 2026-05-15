// Per-project financials live under `project.financials`:
//   { clientQuoted: number, clientReceipts: [...], supplierPayments: [...] }
// Company-wide expenses (rent, software, contractors, etc.) live in a
// separate top-level collection fetched from /api/financials/expenses.

export function emptyFinancials() {
  return {
    clientQuoted: 0,
    supplierTotalCost: 0,
    clientReceipts: [],
    supplierPayments: [],
  };
}

export function getFinancials(project) {
  return project?.financials ?? emptyFinancials();
}

export function sumAmounts(rows) {
  return (rows ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

// Per-project P&L. `quoted` is what the client agreed to pay; profit is
// money in (received) minus money out (supplier payments). Outstanding AR
// is what the client still owes against the quoted amount. Outstanding AP
// is what we still owe the supplier against the agreed total cost.
export function projectSummary(project) {
  const f = getFinancials(project);
  const clientReceived = sumAmounts(f.clientReceipts);
  const supplierPaid = sumAmounts(f.supplierPayments);
  const clientQuoted = Number(f.clientQuoted) || 0;
  const supplierTotalCost = Number(f.supplierTotalCost) || 0;
  return {
    clientQuoted,
    clientReceived,
    clientOutstanding: Math.max(0, clientQuoted - clientReceived),
    supplierTotalCost,
    supplierPaid,
    supplierOutstanding: Math.max(0, supplierTotalCost - supplierPaid),
    profit: clientReceived - supplierPaid,
    // If a supplier total is set, the planned profit is what's left after
    // paying the supplier in full. Otherwise fall back to the looser
    // "client agreed − supplier paid so far".
    plannedProfit: supplierTotalCost > 0
      ? clientQuoted - supplierTotalCost
      : clientQuoted - supplierPaid,
  };
}

export function money(n) {
  return Number(n ?? 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
