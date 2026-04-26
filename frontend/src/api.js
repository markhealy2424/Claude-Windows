const base = "/api";

async function json(res) {
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  listProjects: () => fetch(`${base}/projects`).then(json),
  createProject: (name) =>
    fetch(`${base}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(json),
  getProject: (id) => fetch(`${base}/projects/${id}`).then(json),
  updateProject: (id, patch) =>
    fetch(`${base}/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  generateRFQ: (items, projectName) =>
    fetch(`${base}/rfq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, projectName }),
    }).then(json),
  compareQuote: (rfqItems, quoteItems) =>
    fetch(`${base}/quotes/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfqItems, quoteItems }),
    }).then(json),
  applyPricing: (items, opts) =>
    fetch(`${base}/proposals/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, ...opts }),
    }).then(json),
  generateProposal: (items, projectName, branding) =>
    fetch(`${base}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, projectName, branding }),
    }).then(json),
};
