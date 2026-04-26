import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

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
    setProjects((prev) => [...prev, p]);
    setName("");
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
              <td>{p.name}</td>
              <td>{p.status}</td>
              <td>{new Date(p.createdAt).toLocaleString()}</td>
              <td><Link to={`/projects/${p.id}`}>Open</Link></td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr><td colSpan={4} style={{ color: "#888" }}>No projects yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
