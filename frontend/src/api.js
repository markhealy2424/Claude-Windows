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
  uploadSupplierQuote: (file, projectId, quoteId) => {
    const fd = new FormData();
    fd.append("pdf", file);
    if (projectId) fd.append("projectId", projectId);
    if (quoteId) fd.append("quoteId", quoteId);
    return fetch(`${base}/quotes/extract-supplier`, { method: "POST", body: fd }).then(json);
  },
  parseSupplierQuoteVision: ({ projectId, quoteId }) =>
    fetch(`${base}/quotes/parse-supplier-vision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, quoteId }),
    }).then(json),
  quoteFileUrl: (projectId, quoteId) => `${base}/quotes/file/${projectId}/${quoteId}.pdf`,
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
  listSalespeople: () => fetch(`${base}/salespeople`).then(json),
  createSalesperson: (s) =>
    fetch(`${base}/salespeople`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    }).then(json),
  updateSalesperson: (id, patch) =>
    fetch(`${base}/salespeople/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteSalesperson: (id) =>
    fetch(`${base}/salespeople/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  listInvoices: () => fetch(`${base}/salespeople/invoices/all`).then(json),
  getInvoice: (id) => fetch(`${base}/salespeople/invoices/${id}`).then(json),
  generateInvoice: (projectId) =>
    fetch(`${base}/salespeople/invoices/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    }).then(json),
  updateInvoice: (id, patch) =>
    fetch(`${base}/salespeople/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteInvoice: (id) =>
    fetch(`${base}/salespeople/invoices/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  listLeadSources: () => fetch(`${base}/leads/sources`).then(json),
  createLeadSource: (s) =>
    fetch(`${base}/leads/sources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    }).then(json),
  updateLeadSource: (id, patch) =>
    fetch(`${base}/leads/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteLeadSource: (id) =>
    fetch(`${base}/leads/sources/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  getLeadSettings: () => fetch(`${base}/leads/settings`).then(json),
  saveLeadSettings: (patch) =>
    fetch(`${base}/leads/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  listLeads: () => fetch(`${base}/leads`).then(json),
  createLead: (lead) =>
    fetch(`${base}/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    }).then(json),
  runLeadsReport: () =>
    fetch(`${base}/leads/run`, { method: "POST" }).then(json),
  importLeadsFromPdf: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${base}/leads/import-pdf`, { method: "POST", body: fd }).then(json);
  },
  confirmLeadImport: ({ drafts, sourceDocTitle, fileName }) =>
    fetch(`${base}/leads/import-confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ drafts, sourceDocTitle, fileName }),
    }).then(json),
  updateLead: (id, patch) =>
    fetch(`${base}/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteLead: (id) =>
    fetch(`${base}/leads/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  addLeadInteraction: (id, entry) =>
    fetch(`${base}/leads/${id}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).then(json),
  deleteLeadInteraction: (id, entryId) =>
    fetch(`${base}/leads/${id}/interactions/${entryId}`, { method: "DELETE" }).then(json),
  listCatalogGroups: () => fetch(`${base}/catalog/groups`).then(json),
  createCatalogGroup: (g) =>
    fetch(`${base}/catalog/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(g),
    }).then(json),
  updateCatalogGroup: (id, patch) =>
    fetch(`${base}/catalog/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteCatalogGroup: (id) =>
    fetch(`${base}/catalog/groups/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  reorderCatalogGroups: (orderedIds) =>
    fetch(`${base}/catalog/groups/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    }).then(json),
  listCatalogProducts: () => fetch(`${base}/catalog/products`).then(json),
  getCatalogProduct: (id) => fetch(`${base}/catalog/products/${id}`).then(json),
  createCatalogProduct: (p) =>
    fetch(`${base}/catalog/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    }).then(json),
  updateCatalogProduct: (id, patch) =>
    fetch(`${base}/catalog/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteCatalogProduct: (id) =>
    fetch(`${base}/catalog/products/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  reorderCatalogProducts: (orderedIds) =>
    fetch(`${base}/catalog/products/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    }).then(json),
  uploadCatalogProductImage: (productId, kind, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${base}/catalog/products/${productId}/image/${kind}`, {
      method: "POST",
      body: fd,
    }).then(json);
  },
  deleteCatalogProductImage: (productId, kind) =>
    fetch(`${base}/catalog/products/${productId}/image/${kind}`, { method: "DELETE" }).then(json),
  // Cache-buster `v` so the browser refetches after an upload.
  catalogProductImageUrl: (productId, kind, v) =>
    `${base}/catalog/products/${productId}/image/${kind}${v ? `?v=${encodeURIComponent(v)}` : ""}`,
  listTodos: () => fetch(`${base}/todos`).then(json),
  createTodo: (text) =>
    fetch(`${base}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).then(json),
  updateTodo: (id, patch) =>
    fetch(`${base}/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteTodo: (id) =>
    fetch(`${base}/todos/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  uploadFinalInvoice: (file, projectId, kind) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", projectId);
    fd.append("kind", kind);
    return fetch(`${base}/final-invoices/upload`, { method: "POST", body: fd }).then(json);
  },
  deleteFinalInvoiceFile: (projectId, kind) =>
    fetch(`${base}/final-invoices/file/${projectId}/${kind}`, { method: "DELETE" }).then((r) => {
      if (!r.ok && r.status !== 404) throw new Error("delete failed");
    }),
  finalInvoiceFileUrl: (projectId, kind) => `${base}/final-invoices/file/${projectId}/${kind}`,
  uploadDrawing: (file, projectId, drawingId) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", projectId);
    fd.append("drawingId", drawingId);
    return fetch(`${base}/drawings/upload`, { method: "POST", body: fd }).then(json);
  },
  deleteDrawingFile: (projectId, drawingId) =>
    fetch(`${base}/drawings/file/${projectId}/${drawingId}`, { method: "DELETE" }).then((r) => {
      if (!r.ok && r.status !== 404) throw new Error("delete failed");
    }),
  drawingFileUrl: (projectId, drawingId) => `${base}/drawings/file/${projectId}/${drawingId}`,
  listCompanyExpenses: () => fetch(`${base}/financials/expenses`).then(json),
  createCompanyExpense: (expense) =>
    fetch(`${base}/financials/expenses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(expense),
    }).then(json),
  updateCompanyExpense: (id, patch) =>
    fetch(`${base}/financials/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  deleteCompanyExpense: (id) =>
    fetch(`${base}/financials/expenses/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new Error("delete failed");
    }),
  downloadQuestionsPdf: async (items, projectName, info) => {
    const res = await fetch(`${base}/questions/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, projectName, info }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(projectName || "questions").replace(/[^a-z0-9-_]+/gi, "_")}-questions.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  getCompanyInfo: () => fetch(`${base}/company-info`).then(json),
  updateCompanyInfo: (patch) =>
    fetch(`${base}/company-info`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then(json),
  uploadCompanyAsset: (kind, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(`${base}/company-info/asset/${kind}`, { method: "POST", body: fd }).then(json);
  },
  deleteCompanyAsset: (kind) =>
    fetch(`${base}/company-info/asset/${kind}`, { method: "DELETE" }).then(json),
  companyAssetUrl: (kind, v) =>
    `${base}/company-info/asset/${kind}${v ? `?v=${encodeURIComponent(v)}` : ""}`,
  downloadProposalPdf: async (items, projectName, branding, totals, info) => {
    const res = await fetch(`${base}/proposals/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, projectName, branding, totals, info }),
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
