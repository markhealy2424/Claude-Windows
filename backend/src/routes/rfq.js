import { Router } from "express";
import { generateRFQ } from "../engines/rfqGenerator.js";

const router = Router();

router.post("/", (req, res) => {
  const { items, projectName } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  res.json(generateRFQ({ items, projectName }));
});

export default router;
