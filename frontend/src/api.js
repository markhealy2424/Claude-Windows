const base = import.meta.env.VITE_API_BASE || "/api";

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
  extractPlan: (file, projectId, planId) => {
    const fd = new FormData();
    fd.append("pdf", file);
    if (projectId) fd.append("projectId", projectId);
    if (planId) fd.append("planId", planId);
    return fetch(`${base}/plans/extract`, { method: "POST", body: fd }).then(json);
  },
  parseSchedule: (pages, schedulePageNumbers) =>
    fetch(`${base}/plans/parse-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages, schedulePageNumbers }),
    }).then(json),
  countMarks: ({ pages, floorPageNumbers, projectId, planId, projectName }) =>
    fetch(`${base}/plans/count-marks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pages, floorPageNumbers, projectId, planId, projectName }),
    }).then(json),
  planPdfUrl: (projectId, planId) => `${base}/plans/${projectId}/${planId}.pdf`,
  extractScheduleUpload: (file, projectId, scheduleId) => {
    const fd = new FormData();
    fd.append("pdf", file);
    if (projectId) fd.append("projectId", projectId);
    if (scheduleId) fd.append("scheduleId", scheduleId);
    return fetch(`${base}/plans/schedule-extract`, { method: "POST", body: fd }).then(json);
  },
  parseScheduleVision: ({ projectId, scheduleId, projectName, pages, schedulePageNumbers }) =>
    fetch(`${base}/plans/parse-schedule-vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, scheduleId, projectName, pages, schedulePageNumbers }),
    }).then(json),
  schedulePdfUrl: (projectId, scheduleId) => `${base}/plans/schedule/${projectId}/${scheduleId}.pdf`,
  updateProject: (id, patch) =>
    fetch(`${base}/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  generateRFQ: (items, projectName, info) =>
    fetch(`${base}/rfq`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, projectName, info }),
    }).then(json),
  downloadRFQPdf: async (items, projectName, info) => {
    const res = await fetch(`${base}/rfq/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, projectName, info }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName || "rfq").replace(/[^a-z0-9-_]+/gi, "_")}-rfq.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
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
  downloadProposalPdf: async (items, projectName, branding, totals) => {
    const res = await fetch(`${base}/proposals/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, projectName, branding, totals }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName || "proposal").replace(/[^a-z0-9-_]+/gi, "_")}-proposal.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
