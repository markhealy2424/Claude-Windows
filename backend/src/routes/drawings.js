import { Router } from "express";
import multer from "multer";
import {
  saveDrawingFile,
  getDrawingFilePath,
  deleteDrawingFile,
} from "../storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const { projectId, drawingId } = req.body ?? {};
  if (!projectId || !drawingId) return res.status(400).json({ error: "projectId and drawingId required" });

  try {
    const { ext } = saveDrawingFile(projectId, drawingId, req.file.buffer, req.file.originalname);
    res.json({
      fileName: req.file.originalname,
      ext,
      sizeBytes: req.file.size,
    });
  } catch (err) {
    console.error("[drawings/upload]", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete("/file/:projectId/:drawingId", (req, res) => {
  const { projectId, drawingId } = req.params;
  const ok = deleteDrawingFile(projectId, drawingId);
  if (!ok) return res.status(404).json({ error: "file not on disk" });
  res.status(204).end();
});

router.get("/file/:projectId/:drawingId", (req, res) => {
  const { projectId, drawingId } = req.params;
  const path = getDrawingFilePath(projectId, drawingId);
  if (!path) return res.status(404).json({ error: "drawing not on disk" });
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
