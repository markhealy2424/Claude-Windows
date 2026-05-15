import { Router } from "express";
import multer from "multer";
import {
  saveFinalInvoiceFile,
  getFinalInvoiceFilePath,
  deleteFinalInvoiceFile,
} from "../storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const { projectId, kind } = req.body ?? {};
  if (!projectId || !kind) return res.status(400).json({ error: "projectId and kind required" });
  if (kind !== "supplier" && kind !== "client") return res.status(400).json({ error: "kind must be 'supplier' or 'client'" });

  try {
    const { ext } = saveFinalInvoiceFile(projectId, kind, req.file.buffer, req.file.originalname);
    res.json({
      fileName: req.file.originalname,
      ext,
      sizeBytes: req.file.size,
    });
  } catch (err) {
    console.error("[finalInvoices/upload]", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/file/:projectId/:kind", (req, res) => {
  const { projectId, kind } = req.params;
  const ok = deleteFinalInvoiceFile(projectId, kind);
  if (!ok) return res.status(404).json({ error: "file not on disk" });
  res.status(204).end();
});

router.get("/file/:projectId/:kind", (req, res) => {
  const { projectId, kind } = req.params;
  const path = getFinalInvoiceFilePath(projectId, kind);
  if (!path) return res.status(404).json({ error: "invoice not on disk" });
  const ext = path.split(".").pop().toLowerCase();
  const mime = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  }[ext] || "application/octet-stream";
  res.setHeader("Content-Type", mime);
  res.sendFile(path);
});

export default router;
