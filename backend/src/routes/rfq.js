import { Router } from "express";
import { generateRFQ, renderRFQPdf } from "../engines/rfqGenerator.js";

const router = Router();

router.post("/", (req, res) => {
  const { items, projectName } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  res.json(generateRFQ({ items, projectName }));
});

router.post("/pdf", (req, res) => {
  const { items, projectName } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  const safeName = (projectName ?? "rfq").replace(/[^a-z0-9-_]+/gi, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}-rfq.pdf"`);
  renderRFQPdf({ items, projectName }, res);
});

export default router;
