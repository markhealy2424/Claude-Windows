import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { StatusSelect } from "./Dashboard.jsx";

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");

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

  // Case-insensitive substring match against the project name. Keeps it
  // simple — at this scale we don't need debouncing or fuzzy matching.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => (p.name ?? "").toLowerCase().includes(q));
  }, [projects, query]);

  return (
    <div>
      <h1>Projects</h1>

      <div className="row" style={{ marginBottom: 20, gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          aria-label="Search projects"
        />
        <form onSubmit={create} className="row" style={{ marginLeft: "auto", gap: 8 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            style={{ width: 240 }}
          />
          <button className="primary" type="submit" disabled={!name.trim()}>Create</button>
        </form>
      </div>

      <table>
        <thead>
          <tr><th>Name</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td>
                <Link to={`/projects/${p.id}`} className="project-name-link">{p.name}</Link>
              </td>
              <td>
                <StatusSelect
                  className="status-pill"
                  value={p.status}
                  onChange={(status) => updateProject(p.id, { status })}
                />
              </td>
              <td><Link to={`/projects/${p.id}`}>Open →</Link></td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={3} className="text-subtle">
                {projects.length === 0
                  ? "No projects yet."
                  : `No projects match "${query}".`}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
