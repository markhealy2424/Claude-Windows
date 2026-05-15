import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function SalesResources() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.listLeadSources()
      .then((s) => { if (!cancelled) { setSources(s); setLoading(false); } })
      .catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

  async function addSource() {
    const created = await api.createLeadSource({ url: "", label: "", notes: "" });
    setSources((prev) => [...prev, created]);
  }
  async function updateSource(id, patch) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try { await api.updateLeadSource(id, patch); } catch (err) { console.error(err); }
  }
  async function removeSource(id) {
    if (!confirm("Delete this source?")) return;
    setSources((prev) => prev.filter((s) => s.id !== id));
    try { await api.deleteLeadSource(id); } catch (err) { console.error(err); }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Resources</h2>
        <button onClick={addSource}>+ Source</button>
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        URLs the AI agent crawls on each <strong>Run report</strong>. Best fits: contractor / architect directories, association member lists, building-permit portals, chamber-of-commerce member pages. Static HTML works best.
      </p>

      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      {sources.length === 0 ? (
        <div className="card text-subtle">No sources yet. Hit <strong>+ Source</strong> to add one.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Label</th><th>URL</th><th>Notes</th><th></th></tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td><input value={s.label ?? ""} placeholder="Label" onChange={(e) => updateSource(s.id, { label: e.target.value })} style={{ width: "100%" }} /></td>
                <td><input value={s.url ?? ""} placeholder="https://..." onChange={(e) => updateSource(s.id, { url: e.target.value })} style={{ width: "100%" }} /></td>
                <td><input value={s.notes ?? ""} placeholder="What's on this page" onChange={(e) => updateSource(s.id, { notes: e.target.value })} style={{ width: "100%" }} /></td>
                <td><button onClick={() => removeSource(s.id)} title="Delete">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
