import { Router } from "express";
import multer from "multer";
import { getCompanyInfo, updateCompanyInfo, setCompanyAsset } from "../store.js";
import {
  saveCompanyAsset,
  getCompanyAssetPath,
  deleteCompanyAsset,
} from "../storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const ASSET_KINDS = new Set(["logo", "cover"]);
const ASSET_MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

router.get("/", (_req, res) => res.json(getCompanyInfo()));

router.put("/", (req, res) => {
  const allowed = ["name", "tagline", "address", "phone", "email", "accentColor"];
  const patch = {};
  for (const k of allowed) if (k in (req.body ?? {})) patch[k] = req.body[k];
  res.json(updateCompanyInfo(patch));
});

router.post("/asset/:kind", upload.single("file"), (req, res) => {
  const { kind } = req.params;
  if (!ASSET_KINDS.has(kind)) return res.status(400).json({ error: "kind must be 'logo' or 'cover'" });
  if (!req.file) return res.status(400).json({ error: "file required" });
  try {
    const { ext } = saveCompanyAsset(kind, req.file.buffer, req.file.originalname);
    const meta = { ext, uploadedAt: new Date().toISOString() };
    const field = kind === "logo" ? "logo" : "coverBanner";
    res.json(setCompanyAsset(field, meta));
  } catch (err) {
    console.error("[company-info/asset upload]", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/asset/:kind", (req, res) => {
  const { kind } = req.params;
  if (!ASSET_KINDS.has(kind)) return res.status(400).json({ error: "kind must be 'logo' or 'cover'" });
  deleteCompanyAsset(kind);
  const field = kind === "logo" ? "logo" : "coverBanner";
  res.json(setCompanyAsset(field, null));
});

router.get("/asset/:kind", (req, res) => {
  const { kind } = req.params;
  if (!ASSET_KINDS.has(kind)) return res.status(400).json({ error: "kind must be 'logo' or 'cover'" });
  const path = getCompanyAssetPath(kind);
  if (!path) return res.status(404).json({ error: "asset not on disk" });
  const ext = path.split(".").pop().toLowerCase();
  res.setHeader("Content-Type", ASSET_MIME[ext] || "application/octet-stream");
  res.sendFile(path);
});

export default router;
