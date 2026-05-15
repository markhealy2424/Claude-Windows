import { Router } from "express";
import {
  listLeadSources, createLeadSource, updateLeadSource, deleteLeadSource,
  getLeadSettings, updateLeadSettings,
  listLeads, createLead, updateLead, deleteLead,
  addLeadInteraction, deleteLeadInteraction,
} from "../store.js";

const router = Router();

// Lazy-load the agent so a vision-SDK / module issue can't crash startup.
let _agent = null;
async function loadAgent() {
  if (_agent) return _agent;
  const m = await import("../engines/leadsAgent.js");
  _agent = m.runLeadsReport;
  return _agent;
}

// ── Sources ────────────────────────────────────────────────────────────

router.get("/sources", (_req, res) => res.json(listLeadSources()));

router.post("/sources", (req, res) => {
  res.status(201).json(createLeadSource(req.body ?? {}));
});

router.patch("/sources/:id", (req, res) => {
  const s = updateLeadSource(req.params.id, req.body ?? {});
  if (!s) return res.status(404).json({ error: "not found" });
  res.json(s);
});

router.delete("/sources/:id", (req, res) => {
  const ok = deleteLeadSource(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

// ── Settings (business context) ────────────────────────────────────────

router.get("/settings", (_req, res) => res.json(getLeadSettings()));
router.put("/settings", (req, res) => res.json(updateLeadSettings(req.body ?? {})));

// ── Run report ─────────────────────────────────────────────────────────
// POST /api/leads/run — queries every saved source, returns the new leads.
// New entries are also persisted into the leads store; existing leads with
// the same company name are skipped so the report can be re-run without
// duplicating records.

router.post("/run", async (_req, res) => {
  const sources = listLeadSources();
  if (sources.length === 0) {
    return res.status(400).json({ error: "Add at least one lead source first." });
  }

  const { businessContext } = getLeadSettings();
  try {
    const run = await loadAgent();
    const startMs = Date.now();
    const result = await run({ sources, businessContext });
    const durationMs = Date.now() - startMs;

    // Persist new ones; skip dupes (case-insensitive company-name match
    // against existing leads).
    const existingCompanies = new Set(
      listLeads().map((l) => (l.company || "").toLowerCase().trim())
    );
    const created = [];
    const skipped = [];
    for (const l of result.leads) {
      const key = (l.company || "").toLowerCase().trim();
      if (!key) continue;
      if (existingCompanies.has(key)) { skipped.push(l.company); continue; }
      existingCompanies.add(key);
      created.push(createLead(l));
    }

    res.json({
      created,
      skipped,
      sourcesQueried: result.sourcesQueried,
      durationMs,
      errors: result.errors,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[leads/run]", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Leads ──────────────────────────────────────────────────────────────

router.get("/", (_req, res) => res.json(listLeads()));

router.post("/", (req, res) => {
  // Manual lead creation — user adds a company they want to track directly,
  // without going through the agent.
  res.status(201).json(createLead({ ...req.body, origin: "manual" }));
});

router.patch("/:id", (req, res) => {
  const l = updateLead(req.params.id, req.body ?? {});
  if (!l) return res.status(404).json({ error: "not found" });
  res.json(l);
});

router.delete("/:id", (req, res) => {
  const ok = deleteLead(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

router.post("/:id/interactions", (req, res) => {
  const l = addLeadInteraction(req.params.id, req.body ?? {});
  if (!l) return res.status(404).json({ error: "lead not found" });
  res.status(201).json(l);
});

router.delete("/:id/interactions/:entryId", (req, res) => {
  const l = deleteLeadInteraction(req.params.id, req.params.entryId);
  if (!l) return res.status(404).json({ error: "not found" });
  res.json(l);
});

export default router;
