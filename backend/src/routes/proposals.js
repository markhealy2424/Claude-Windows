import { Router } from "express";
import { applyPricing } from "../engines/pricing.js";
import { generateProposal, renderProposalPdf } from "../engines/proposalGenerator.js";

const router = Router();

router.post("/price", (req, res) => {
  const { items, markup = 0.30, overrides = {}, delivery = 0, fees = 0, round = 0 } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  res.json(applyPricing(items, { markup, overrides, delivery, fees, round }));
});

router.post("/", (req, res) => {
  const { items, projectName, branding } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  res.json(generateProposal({ items, projectName, branding }));
});

router.post("/pdf", (req, res) => {
  const { items, projectName, branding, totals, info } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  const safeName = (projectName ?? "proposal").replace(/[^a-z0-9-_]+/gi, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}-proposal.pdf"`);
  renderProposalPdf({ items, projectName, branding, totals, info }, res);
});

export default router;
