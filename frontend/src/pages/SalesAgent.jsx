import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";

export default function SalesAgent() {
  const [context, setContext] = useState("");
  const [contextDraft, setContextDraft] = useState("");
  const [editingContext, setEditingContext] = useState(false);
  const [sourceCount, setSourceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.getLeadSettings(), api.listLeadSources()])
      .then(([s, sources]) => {
        if (cancelled) return;
        setContext(s.businessContext || "");
        setContextDraft(s.businessContext || "");
        setEditingContext(!s.businessContext);
        setSourceCount(sources.length);
        setLoading(false);
      })
      .catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

  async function saveContext() {
    const result = await api.saveLeadSettings({ businessContext: contextDraft.trim() });
    setContext(result.businessContext);
    setEditingContext(false);
  }

  async function runReport() {
    setRunning(true);
    setError("");
    setRunResult(null);
    try {
      setRunResult(await api.runLeadsReport());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setRunning(false);
    }
  }

  const canRun = sourceCount > 0 && context.trim().length > 0;

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>AI Agent</h2>
        <button
          className="primary"
          onClick={runReport}
          disabled={!canRun || running}
          title={
            !context.trim() ? "Add a business context first" :
            sourceCount === 0 ? "Add at least one source URL on the Resources tab first" :
            "Fetch every source and extract leads with Claude"
          }
        >
          {running ? "Running…" : "Run report"}
        </button>
      </div>

      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Business context</h3>
        {editingContext ? (
          <>
            <textarea
              value={contextDraft}
              onChange={(e) => setContextDraft(e.target.value)}
              rows={6}
              placeholder="We sell custom aluminum windows and doors in Southern California. Ideal clients are GCs, architects, and developers running $1M+ residential projects in Pasadena, Beverly Hills, and the Westside."
              style={{ width: "100%", padding: 8, fontSize: 14, lineHeight: 1.4, boxSizing: "border-box" }}
            />
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <button className="primary" onClick={saveContext} disabled={!contextDraft.trim()}>Save</button>
              {context && <button onClick={() => { setContextDraft(context); setEditingContext(false); }}>Cancel</button>}
            </div>
          </>
        ) : (
          <>
            <div style={{ whiteSpace: "pre-line", padding: "10px 12px", background: "var(--color-surface-alt)", borderRadius: 4, fontSize: 14 }}>
              {context || <span className="text-subtle">No context yet.</span>}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={() => setEditingContext(true)}>{context ? "Edit" : "Add"}</button>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ margin: 0 }}>Sources</h3>
            <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
              {sourceCount} source{sourceCount === 1 ? "" : "s"} configured.
            </div>
          </div>
          <Link to="/sales/resources"><button>Manage sources →</button></Link>
        </div>
      </div>

      {runResult && (
        <div className="card">
          <h3 style={{ margin: "0 0 8px" }}>
            Suggested contacts
            <span className="text-muted" style={{ fontWeight: 400, fontSize: 14, marginLeft: 8 }}>
              · {runResult.created.length} added · {(runResult.durationMs / 1000).toFixed(1)}s · {runResult.sourcesQueried} source{runResult.sourcesQueried === 1 ? "" : "s"} queried
              {runResult.skipped.length > 0 && ` · ${runResult.skipped.length} dupes skipped`}
            </span>
          </h3>
          {runResult.errors.length > 0 && (
            <div className="text-error" style={{ fontSize: 13, marginBottom: 8 }}>
              {runResult.errors.length} source error{runResult.errors.length === 1 ? "" : "s"}:
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {runResult.errors.map((e, i) => <li key={i}><strong>{e.label || e.url}</strong>: {e.message}</li>)}
              </ul>
            </div>
          )}
          {runResult.created.length === 0 ? (
            <div className="text-subtle" style={{ fontSize: 13 }}>No new contacts in the last run.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
              {runResult.created.map((l) => (
                <li key={l.id} style={{ padding: "10px 12px", background: "var(--color-surface-alt)", borderRadius: 4, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <strong>{l.company}</strong>
                    <span className="text-muted" style={{ fontSize: 12 }}>{l.qualityScore}/5 · {l.source?.label || l.source?.url}</span>
                  </div>
                  {l.whyGoodFit && <div className="text-muted" style={{ marginTop: 2 }}>{l.whyGoodFit}</div>}
                </li>
              ))}
            </ul>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <Link to="/sales"><button>View in pipeline →</button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
