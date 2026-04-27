import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { STATUS_OPTIONS, isKnownStatus } from "../lib/projectStatus.js";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const p = await api.createProject(name.trim());
    setProjects((prev) => [p, ...prev]);
    setName("");
  }

  // Optimistic in-place update + persist via PATCH.
  async function updateProject(id, patch) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try {
      const updated = await api.updateProject(id, patch);
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      console.error("Project update failed:", err);
      // Refetch as recovery.
      api.listProjects().then(setProjects).catch(() => {});
    }
  }

  return (
    <div>
      <h1>Projects</h1>
      <form onSubmit={create} className="row" style={{ marginBottom: 20 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New project name" />
        <button className="primary" type="submit">Create</button>
      </form>
      <table>
        <thead>
          <tr><th>Name</th><th>Status</th><th>Created</th><th></th></tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td><InlineNameInput value={p.name} onSave={(name) => updateProject(p.id, { name })} /></td>
              <td>
                <StatusSelect
                  value={p.status}
                  onChange={(status) => updateProject(p.id, { status })}
                />
              </td>
              <td className="text-muted">{new Date(p.createdAt).toLocaleString()}</td>
              <td><Link to={`/projects/${p.id}`}>Open →</Link></td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr><td colSpan={4} className="text-subtle">No projects yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function InlineNameInput({ value, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) { setDraft(value); return; }
    if (trimmed !== value) onSave(trimmed);
  }

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
        if (e.key === "Escape") { setDraft(value); e.target.blur(); }
      }}
      onFocus={(e) => e.target.select()}
      style={{ fontWeight: 500, minWidth: 200, width: "100%" }}
      aria-label="Project name"
    />
  );
}

export function StatusSelect({ value, onChange }) {
  const known = isKnownStatus(value);
  return (
    <select
      value={known ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Project status"
    >
      {!known && <option value="" disabled>{value ? `${value} — pick new` : "— pick status —"}</option>}
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
