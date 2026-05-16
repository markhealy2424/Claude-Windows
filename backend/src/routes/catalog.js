import { Router } from "express";
import multer from "multer";
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
import {
  saveCatalogImage,
  getCatalogImagePath,
  deleteCatalogImage,
} from "../storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const IMAGE_KINDS = new Set(["product", "lifestyle"]);
const IMAGE_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

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

// ── Product images ─────────────────────────────────────────────────────
// Two slots per product: "product" (catalog/SKU shot) and "lifestyle"
// (real-life setting). On upload, we stash the file on the persistent
// volume AND record the ext + uploadedAt on the product so the frontend
// knows the slot is populated without having to probe.

router.post("/products/:id/image/:kind", upload.single("file"), (req, res) => {
  const { id, kind } = req.params;
  if (!IMAGE_KINDS.has(kind)) return res.status(400).json({ error: "kind must be 'product' or 'lifestyle'" });
  if (!req.file) return res.status(400).json({ error: "file required" });
  const product = getCatalogProduct(id);
  if (!product) return res.status(404).json({ error: "product not found" });

  try {
    const { ext } = saveCatalogImage(id, kind, req.file.buffer, req.file.originalname);
    const meta = { ext, uploadedAt: new Date().toISOString() };
    const field = kind === "product" ? "productImage" : "lifestyleImage";
    const updated = updateCatalogProduct(id, { [field]: meta });
    res.json(updated);
  } catch (err) {
    console.error("[catalog/image upload]", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/products/:id/image/:kind", (req, res) => {
  const { id, kind } = req.params;
  if (!IMAGE_KINDS.has(kind)) return res.status(400).json({ error: "kind must be 'product' or 'lifestyle'" });
  const product = getCatalogProduct(id);
  if (!product) return res.status(404).json({ error: "product not found" });

  deleteCatalogImage(id, kind);
  const field = kind === "product" ? "productImage" : "lifestyleImage";
  const updated = updateCatalogProduct(id, { [field]: null });
  res.json(updated);
});

router.get("/products/:id/image/:kind", (req, res) => {
  const { id, kind } = req.params;
  if (!IMAGE_KINDS.has(kind)) return res.status(400).json({ error: "kind must be 'product' or 'lifestyle'" });
  const path = getCatalogImagePath(id, kind);
  if (!path) return res.status(404).json({ error: "image not on disk" });
  const ext = path.split(".").pop().toLowerCase();
  res.setHeader("Content-Type", IMAGE_MIME[ext] || "application/octet-stream");
  res.sendFile(path);
});

export default router;
