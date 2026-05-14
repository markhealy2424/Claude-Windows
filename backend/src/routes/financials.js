import { Router } from "express";
import {
  listCompanyExpenses,
  createCompanyExpense,
  updateCompanyExpense,
  deleteCompanyExpense,
} from "../store.js";

const router = Router();

router.get("/expenses", (_req, res) => res.json(listCompanyExpenses()));

router.post("/expenses", (req, res) => {
  res.status(201).json(createCompanyExpense(req.body ?? {}));
});

router.patch("/expenses/:id", (req, res) => {
  const e = updateCompanyExpense(req.params.id, req.body ?? {});
  if (!e) return res.status(404).json({ error: "not found" });
  res.json(e);
});

router.delete("/expenses/:id", (req, res) => {
  const ok = deleteCompanyExpense(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

export default router;
