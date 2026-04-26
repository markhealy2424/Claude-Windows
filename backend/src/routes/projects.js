import { Router } from "express";
import { createProject, listProjects, getProject, updateProject } from "../store.js";

const router = Router();

router.get("/", (_req, res) => res.json(listProjects()));

router.post("/", (req, res) => {
  const { name } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name required" });
  res.status(201).json(createProject(name));
});

router.get("/:id", (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

router.patch("/:id", (req, res) => {
  const p = updateProject(req.params.id, req.body);
  if (!p) return res.status(404).json({ error: "not found" });
  res.json(p);
});

export default router;
