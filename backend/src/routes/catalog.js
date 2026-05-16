import { Router } from "express";
import {
  listCatalogGroups,
  createCatalogGroup,
  updateCatalogGroup,
  deleteCatalogGroup,
  reorderCatalogGroups,
  listCatalogProducts,
  getCatalogProduct,
  createCatalogProduct,
  updateCatalogProduct,
  deleteCatalogProduct,
  reorderCatalogProducts,
} from "../store.js";

const router = Router();

// ── Groups ─────────────────────────────────────────────────────────────

router.get("/groups", (_req, res) => res.json(listCatalogGroups()));

router.post("/groups", (req, res) => {
  res.status(201).json(createCatalogGroup(req.body ?? {}));
});

router.patch("/groups/reorder", (req, res) => {
  const ids = req.body?.orderedIds;
  res.json(reorderCatalogGroups(ids));
});

router.patch("/groups/:id", (req, res) => {
  const g = updateCatalogGroup(req.params.id, req.body ?? {});
  if (!g) return res.status(404).json({ error: "not found" });
  res.json(g);
});

router.delete("/groups/:id", (req, res) => {
  const ok = deleteCatalogGroup(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

// ── Products ───────────────────────────────────────────────────────────

router.get("/products", (_req, res) => res.json(listCatalogProducts()));

router.get("/products/:id", (req, res) => {
  const p = getCatalogProduct(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

router.post("/products", (req, res) => {
  res.status(201).json(createCatalogProduct(req.body ?? {}));
});

router.patch("/products/reorder", (req, res) => {
  const ids = req.body?.orderedIds;
  res.json(reorderCatalogProducts(ids));
});

router.patch("/products/:id", (req, res) => {
  const p = updateCatalogProduct(req.params.id, req.body ?? {});
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

router.delete("/products/:id", (req, res) => {
  const ok = deleteCatalogProduct(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

export default router;
