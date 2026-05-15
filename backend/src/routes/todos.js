import { Router } from "express";
import { listTodos, createTodo, updateTodo, deleteTodo } from "../store.js";

const router = Router();

router.get("/", (_req, res) => res.json(listTodos()));

router.post("/", (req, res) => {
  res.status(201).json(createTodo(req.body ?? {}));
});

router.patch("/:id", (req, res) => {
  const t = updateTodo(req.params.id, req.body ?? {});
  if (!t) return res.status(404).json({ error: "not found" });
  res.json(t);
});

router.delete("/:id", (req, res) => {
  const ok = deleteTodo(req.params.id);
  if (!ok) return res.status(404).json({ error: "not found" });
  res.status(204).end();
});

export default router;
