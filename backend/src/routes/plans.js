import { Router } from "express";
import multer from "multer";
import { extractPlan } from "../engines/planExtraction.js";
import { parseSchedule } from "../engines/scheduleMatching.js";
import { detectMarks } from "../engines/markDetection.js";
import { detectMarksWithVision } from "../engines/visionMarkDetection.js";
import { parseScheduleWithVision } from "../engines/visionScheduleExtraction.js";
import {
  savePlanPdf, getPlanPdfPath, planPdfExists,
  saveSchedulePdf, getSchedulePdfPath, schedulePdfExists,
} from "../storage.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/extract", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "pdf required" });
  const { projectId, planId } = req.body ?? {};
  try {
    const pages = await extractPlan(req.file.buffer);

    let pdfPersisted = false;
    if (projectId && planId) {
      try {
        savePlanPdf(projectId, planId, req.file.buffer);
        pdfPersisted = true;
      } catch (err) {
        console.error("[plans/extract] failed to persist PDF:", err);
      }
    }

    res.json({ pages, pdfPersisted });
  } catch (err) {
    console.error("[plans/extract]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/count-marks", async (req, res) => {
  const { pages, floorPageNumbers, projectId, planId, projectName } = req.body ?? {};
  if (!Array.isArray(floorPageNumbers) || floorPageNumbers.length === 0) {
    return res.status(400).json({ error: "floorPageNumbers array required" });
  }

  const visionAvailable = Boolean(process.env.ANTHROPIC_API_KEY);
  const pdfOnDisk = Boolean(projectId && planId && planPdfExists(projectId, planId));
  let visionError = null;

  if (visionAvailable && pdfOnDisk) {
    try {
      const result = await detectMarksWithVision({
        pdfPath: getPlanPdfPath(projectId, planId),
        floorPageNumbers,
        projectName,
      });
      return res.json(result);
    } catch (err) {
      console.error("[plans/count-marks/vision]", err);
      visionError = err?.message ?? String(err);
    }
  }

  if (!Array.isArray(pages)) {
    return res.status(400).json({
      error: "pages array required for local detection",
      visionAvailable,
      pdfOnDisk,
      visionError,
    });
  }
  try {
    const result = detectMarks(pages, floorPageNumbers);
    res.json({
      ...result,
      detector: "local",
      visionAvailable,
      pdfOnDisk,
      visionError,
    });
  } catch (err) {
    console.error("[plans/count-marks/local]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/schedule-extract", upload.single("pdf"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "pdf required" });
  const { projectId, scheduleId } = req.body ?? {};
  try {
    // Best-effort text extraction so the local fallback parser can still run
    // without API key. Vision is the primary path.
    let pages = [];
    try { pages = await extractPlan(req.file.buffer); } catch { /* ignore */ }

    let pdfPersisted = false;
    if (projectId && scheduleId) {
      try {
        saveSchedulePdf(projectId, scheduleId, req.file.buffer);
        pdfPersisted = true;
      } catch (err) {
        console.error("[plans/schedule-extract] failed to persist PDF:", err);
      }
    }

    res.json({ pages, pdfPersisted });
  } catch (err) {
    console.error("[plans/schedule-extract]", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/parse-schedule-vision", async (req, res) => {
  const { projectId, scheduleId, projectName, pages, schedulePageNumbers } = req.body ?? {};

  const visionAvailable = Boolean(process.env.ANTHROPIC_API_KEY);
  const pdfOnDisk = Boolean(projectId && scheduleId && schedulePdfExists(projectId, scheduleId));
  let visionError = null;

  if (visionAvailable && pdfOnDisk) {
    try {
      const result = await parseScheduleWithVision({
        pdfPath: getSchedulePdfPath(projectId, scheduleId),
        projectName,
      });
      return res.json(result);
    } catch (err) {
      console.error("[plans/parse-schedule-vision]", err);
      visionError = err?.message ?? String(err);
    }
  }

  // Fallback: local text-based parser (works on the page extraction the
  // upload step ran). Requires `pages` array in body and a list of
  // 1-indexed `schedulePageNumbers` to scan (defaults to all pages).
  if (Array.isArray(pages) && pages.length > 0) {
    try {
      const targetPages = Array.isArray(schedulePageNumbers) && schedulePageNumbers.length > 0
        ? schedulePageNumbers.map(Number)
        : pages.map((p) => p.pageNumber);
      const local = parseSchedule(pages, targetPages);
      return res.json({
        items: local.items ?? [],
        meta: local.meta,
        detector: "local",
        visionAvailable,
        pdfOnDisk,
        visionError,
      });
    } catch (err) {
      console.error("[plans/parse-schedule-vision/local]", err);
    }
  }

  res.status(400).json({
    error: "Vision unavailable and no extracted pages provided for local fallback",
    visionAvailable,
    pdfOnDisk,
    visionError,
  });
});

router.get("/schedule/:projectId/:scheduleId.pdf", (req, res) => {
  const { projectId, scheduleId } = req.params;
  if (!schedulePdfExists(projectId, scheduleId)) {
    return res.status(404).json({ error: "schedule PDF not on disk" });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.sendFile(getSchedulePdfPath(projectId, scheduleId));
});

router.get("/:projectId/:planId.pdf", (req, res) => {
  const { projectId, planId } = req.params;
  if (!planPdfExists(projectId, planId)) {
    return res.status(404).json({ error: "PDF not on disk for this plan" });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.sendFile(getPlanPdfPath(projectId, planId));
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
