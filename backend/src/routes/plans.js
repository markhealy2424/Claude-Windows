import { Router } from "express";
import multer from "multer";
import { extractPlan } from "../engines/planExtraction.js";
import { detectMarks } from "../engines/markDetection.js";
import { matchSchedule } from "../engines/scheduleMatching.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/extract", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "pdf required" });
  const pages = await extractPlan(req.file.buffer);
  const marks = detectMarks(pages);
  const items = matchSchedule(marks, pages);
  res.json({ pages, marks, items });
});

export default router;
