import { Router } from "express";
import multer from "multer";
import { parseQuote } from "../engines/quoteParsing.js";
import { findDiscrepancies } from "../engines/discrepancy.js";
import {
  saveQuoteFile, getQuoteFilePath, quoteFileExists,
} from "../storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Lazy-loaded so a vision-module problem doesn't crash server startup.
let _quoteParser = null;
async function loadQuoteParser() {
  if (_quoteParser) return _quoteParser;
  const m = await import("../engines/visionQuoteExtraction.js");
  _quoteParser = m.extractSupplierQuoteWithVision;
  return _quoteParser;
}

router.post("/parse", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "pdf required" });
  const quote = await parseQuote(req.file.buffer);
  res.json(quote);
});

router.post("/compare", (req, res) => {
  const { rfqItems, quoteItems } = req.body ?? {};
  if (!Array.isArray(rfqItems) || !Array.isArray(quoteItems)) {
    return res.status(400).json({ error: "rfqItems and quoteItems arrays required" });
  }
  res.json(findDiscrepancies(rfqItems, quoteItems));
});

// Upload a supplier quote PDF/image, persist it to the quote-file disk
// store, and return the parse result (vision if API key + persisted file
// available, otherwise just metadata).
router.post("/extract-supplier", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const { projectId, quoteId } = req.body ?? {};

  let pdfPersisted = false;
  if (projectId && quoteId) {
    try {
      saveQuoteFile(projectId, quoteId, req.file.buffer, req.file.originalname);
      pdfPersisted = true;
    } catch (err) {
      console.error("[quotes/extract-supplier] failed to persist:", err);
    }
  }

  res.json({ pdfPersisted, fileName: req.file.originalname });
});

router.post("/parse-supplier-vision", async (req, res) => {
  const { projectId, quoteId } = req.body ?? {};

  const visionAvailable = Boolean(process.env.ANTHROPIC_API_KEY);
  const filePath = projectId && quoteId ? getQuoteFilePath(projectId, quoteId) : null;
  const pdfOnDisk = Boolean(filePath);
  let visionError = null;

  if (visionAvailable && pdfOnDisk) {
    try {
      const parser = await loadQuoteParser();
      const result = await parser({ filePath });
      return res.json(result);
    } catch (err) {
      console.error("[quotes/parse-supplier-vision]", err);
      visionError = err?.message ?? String(err);
    }
  }

  res.status(400).json({
    error: "Vision unavailable for supplier-quote parsing",
    visionAvailable,
    pdfOnDisk,
    visionError,
  });
});

router.get("/file/:projectId/:quoteId.pdf", (req, res) => {
  const { projectId, quoteId } = req.params;
  const path = getQuoteFilePath(projectId, quoteId);
  if (!path) return res.status(404).json({ error: "quote file not on disk" });
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
