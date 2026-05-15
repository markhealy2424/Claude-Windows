import { Router } from "express";
import { renderQuestionsPdf } from "../engines/questionsGenerator.js";

const router = Router();

router.post("/pdf", (req, res) => {
  const { items, projectName, info } = req.body ?? {};
  if (!Array.isArray(items)) return res.status(400).json({ error: "items array required" });
  const safeName = (projectName ?? "questions").replace(/[^a-z0-9-_]+/gi, "_");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}-questions.pdf"`);
  renderQuestionsPdf({ items, projectName, info }, res);
});

export default router;
