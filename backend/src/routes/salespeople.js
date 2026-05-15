import { Router } from "express";
import {
  listSalespeople,
  getSalesperson,
  createSalesperson,
  updateSalesperson,
  deleteSalesperson,
  listInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getProject,
} from "../store.js";

const router = Router();

// Invoice routes are declared BEFORE the `:id` catch-all so Express
// doesn't match "invoices" as a salesperson id.

router.get("/invoices/all", (_req, res) => res.json(listInvoices()));

router.post("/invoices/generate", (req, res) => {
  const { projectId } = req.body ?? {};
  if (!projectId) return res.status(400).json({ error: "projectId required" });

  const project = getProject(projectId);
  if (!project) return res.status(404).json({ error: "project not found" });

  const sale = project.sale ?? {};
  if (!sale.salespersonId) return res.status(400).json({ error: "project has no salesperson assigned" });
  if (!(Number(sale.salePrice) > 0)) return res.status(400).json({ error: "sale price must be greater than 0" });
  if (!(Number(sale.commissionRate) > 0)) return res.status(400).json({ error: "commission rate must be greater than 0" });

  const salesperson = getSalesperson(sale.salespersonId);
  if (!salesperson) return res.status(404).json({ error: "salesperson not found" });

  const salePrice = Number(sale.salePrice) || 0;
  const commissionRate = Number(sale.commissionRate) || 0;
  const commissionAmount = +(salePrice * commissionRate / 100).toFixed(2);

  const info = project.info ?? {};
  const inv = createInvoice({
    salespersonId: salesperson.id,
    salespersonSnapshot: {
      name: salesperson.name,
      email: salesperson.email,
      phone: salesperson.phone,
      address: salesperson.address,
      defaultPaymentMethod: salesperson.defaultPaymentMethod,
    },
    projectId: project.id,
    projectName: project.name,
    clientName: info.buyerName || info.company || "",
    saleDate: sale.saleDate || "",
    salePrice,
    commissionRate,
    commissionAmount,
    notes: sale.notes || "",
    paymentMethod: salesperson.defaultPaymentMethod || "",
  });
  res.status(201).json(inv);
});

router.get("/invoices/:id", (req, res) => {
  const inv = getInvoice(req.params.id);
  if (!inv) return res.status(404).json({ error: "not found" });
  res.json(inv);
});

router.patch("/invoices/:id", (req, res) => {
  const inv = updateInvoice(req.params.id, req.body ?? {});
  if (!inv) return res.status(404).json({ error: "not found" });
  res.json(inv);
});

router.delete("/invoices/:id", (req, res) => {
  const ok = deleteInvoice(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

// Salespeople CRUD.

router.get("/", (_req, res) => res.json(listSalespeople()));

router.post("/", (req, res) => {
  res.status(201).json(createSalesperson(req.body ?? {}));
});

router.get("/:id", (req, res) => {
  const s = getSalesperson(req.params.id);
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
});

router.patch("/:id", (req, res) => {
  const s = updateSalesperson(req.params.id, req.body ?? {});
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
});

router.delete("/:id", (req, res) => {
  const ok = deleteSalesperson(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

export default router;
