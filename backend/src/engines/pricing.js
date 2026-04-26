export function applyPricing(items, { markup = 0.30, overrides = {}, delivery = 0, fees = 0, round = 0 } = {}) {
  const priced = items.map((it) => {
    const m = overrides[it.mark]?.markup ?? markup;
    const supplier = Number(it.cost ?? 0);
    let client = supplier * (1 + m);
    if (round > 0) client = Math.round(client / round) * round;
    return { ...it, markup: m, client_price: client };
  });
  const subtotal = priced.reduce((s, it) => s + it.client_price * (it.quantity ?? 1), 0);
  return { items: priced, subtotal, delivery, fees, total: subtotal + delivery + fees };
}
