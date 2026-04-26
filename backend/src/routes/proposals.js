import { Router } from "express";
import { applyPricing } from "../engines/pricing.js";
import { generateProposal } from "../engines/proposalGenerator.js";

const router = Router();

router.post("/price", (req, res) => {
  const { items, markup = 0.30, overrides = {} } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  res.json(applyPricing(items, { markup, overrides }));
});

router.post("/", (req, res) => {
  const { items, projectName, branding } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  res.json(generateProposal({ items, projectName, branding }));
});

export default router;
