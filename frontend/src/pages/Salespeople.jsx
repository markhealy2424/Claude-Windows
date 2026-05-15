import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { money } from "../lib/financials.js";

// Renders the "Sale assignments" sub-tab under Financials. One row per
// project — attach a salesperson + commission rate, then hit Generate
// invoice once the sale is locked in.

export default function Salespeople() {
  const [salespeople, setSalespeople] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingFor, setGeneratingFor] = useState(null);
  const [generateError, setGenerateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listSalespeople(), api.listProjects()])
      .then(([sp, ps]) => {
        if (cancelled) return;
        setSalespeople(sp);
        setProjects(ps);
        setLoading(false);
      })
      .catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

  // Patch a project's `sale` object — optimistic local + PATCH to server.
  async function updateProjectSale(projectId, patch) {
    setProjects((prev) => prev.map((p) => (
      p.id === projectId ? { ...p, sale: { ...(p.sale ?? {}), ...patch } } : p
    )));
    try {
      const proj = projects.find((p) => p.id === projectId);
      const nextSale = { ...(proj?.sale ?? {}), ...patch };
      await api.updateProject(projectId, { sale: nextSale });
    } catch (err) {
      console.error("project sale update failed:", err);
    }
  }

  async function generateForProject(projectId) {
    setGenerateError("");
    setGeneratingFor(projectId);
    try {
      await api.generateInvoice(projectId);
    } catch (err) {
      setGenerateError(`${(projects.find((p) => p.id === projectId)?.name || "Project")}: ${err.message || err}`);
    } finally {
      setGeneratingFor(null);
    }
  }

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      <h2 style={{ margin: "0 0 8px" }}>Sale assignments</h2>
      <p className="text-muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
        Attach a salesperson and commission rate to each project. Hit <strong>Generate invoice</strong> once the sale is locked in — it creates a new commission invoice for the salesperson.
      </p>

      {generateError && <div className="card error" style={{ marginBottom: 12 }}>{generateError}</div>}

      <table>
        <thead>
          <tr>
            <th>Project</th>
            <th>Salesperson</th>
            <th>Sale price ($)</th>
            <th>Rate (%)</th>
            <th>Sale date</th>
            <th>Commission</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 && (
            <tr><td colSpan={7} className="text-subtle">No projects yet.</td></tr>
          )}
          {projects.map((p) => {
            const sale = p.sale ?? {};
            const price = Number(sale.salePrice) || 0;
            const rate = Number(sale.commissionRate) || 0;
            const commission = price * rate / 100;
            const canGenerate = Boolean(sale.salespersonId && price > 0 && rate > 0);
            const generating = generatingFor === p.id;
            return (
              <tr key={p.id}>
                <td><Link to={`/projects/${p.id}`}><strong>{p.name}</strong></Link></td>
                <td>
                  <select
                    value={sale.salespersonId ?? ""}
                    onChange={(e) => updateProjectSale(p.id, { salespersonId: e.target.value })}
                    style={{ minWidth: 180 }}
                  >
                    <option value="">— none —</option>
                    {salespeople.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || "(unnamed)"}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={sale.salePrice ?? 0}
                    onChange={(e) => updateProjectSale(p.id, { salePrice: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    style={{ width: 110 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={sale.commissionRate ?? 0}
                    onChange={(e) => updateProjectSale(p.id, { commissionRate: Number(e.target.value) || 0 })}
                    onFocus={(e) => e.target.select()}
                    style={{ width: 70 }}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={sale.saleDate ?? ""}
                    onChange={(e) => updateProjectSale(p.id, { saleDate: e.target.value })}
                  />
                </td>
                <td style={{ fontWeight: 600, color: commission > 0 ? "var(--color-success)" : "var(--color-text-muted)" }}>
                  {money(commission)}
                </td>
                <td>
                  <button
                    onClick={() => generateForProject(p.id)}
                    disabled={!canGenerate || generating}
                    title={canGenerate ? "Create a new commission invoice for this sale" : "Pick a salesperson and set sale price + commission rate first"}
                  >
                    {generating ? "Generating…" : "Generate invoice"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {salespeople.length === 0 && (
        <div className="text-subtle" style={{ fontSize: 13, marginTop: 12 }}>
          No salespeople yet — add some on the <Link to="/financials/roster"><strong>Roster</strong></Link> tab first.
        </div>
      )}
    </div>
  );
}
