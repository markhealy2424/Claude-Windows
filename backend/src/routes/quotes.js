import { Router } from "express";
import multer from "multer";
import { parseQuote } from "../engines/quoteParsing.js";
import { findDiscrepancies } from "../engines/discrepancy.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

export default router;
