import { Router } from "express";
import multer from "multer";
import { extractPlan } from "../engines/planExtraction.js";
import { parseSchedule } from "../engines/scheduleMatching.js";
import { detectMarks } from "../engines/markDetection.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/extract", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "pdf required" });
  try {
    const pages = await extractPlan(req.file.buffer);
    res.json({ pages });
  } catch (err) {
    console.error("[plans/extract]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/count-marks", (req, res) => {
  const { pages, floorPageNumbers } = req.body ?? {};
  if (!Array.isArray(pages)) return res.status(400).json({ error: "pages array required" });
  if (!Array.isArray(floorPageNumbers) || floorPageNumbers.length === 0) {
    return res.status(400).json({ error: "floorPageNumbers array required" });
  }
  try {
    const result = detectMarks(pages, floorPageNumbers);
    res.json(result);
  } catch (err) {
    console.error("[plans/count-marks]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/parse-schedule", (req, res) => {
  const { pages, schedulePageNumbers } = req.body ?? {};
  if (!Array.isArray(pages)) return res.status(400).json({ error: "pages array required" });
  if (!Array.isArray(schedulePageNumbers) || schedulePageNumbers.length === 0) {
    return res.status(400).json({ error: "schedulePageNumbers array required" });
  }
  try {
    const result = parseSchedule(pages, schedulePageNumbers.map(Number));
    res.json(result);
  } catch (err) {
    console.error("[plans/parse-schedule]", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
