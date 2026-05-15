import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { StatusSelect, InlineNameInput } from "./Dashboard.jsx";

export default function Projects() {
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

  async function updateProject(id, patch) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    try {
      const updated = await api.updateProject(id, patch);
      setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (err) {
      console.error("Project update failed:", err);
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
