import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const STAGE_OPTIONS = [
  ["not_contacted",     "Not contacted"],
  ["reached_out",       "Reached out"],
  ["meeting_scheduled", "Meeting scheduled"],
  ["meeting_held",      "Meeting held"],
  ["quote_sent",        "Quote sent"],
  ["won",               "Won"],
  ["lost",              "Lost"],
];
const STAGE_LABEL = Object.fromEntries(STAGE_OPTIONS);

const INTERACTION_KINDS = [
  ["call",    "Call"],
  ["email",   "Email"],
  ["meeting", "Meeting"],
  ["note",    "Note"],
];

export default function Leads() {
  const [sources, setSources] = useState([]);
  const [leads, setLeads] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [context, setContext] = useState("");
  const [contextDraft, setContextDraft] = useState("");
  const [editingContext, setEditingContext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listLeadSources(),
      api.listLeads(),
      api.getLeadSettings(),
      api.listSalespeople(),
    ]).then(([s, l, settings, sp]) => {
      if (cancelled) return;
      setSources(s);
      setLeads(l);
      setContext(settings.businessContext || "");
      setContextDraft(settings.businessContext || "");
      setEditingContext(!settings.businessContext);
      setSalespeople(sp);
      setLoading(false);
    }).catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

  async function saveContext() {
    const result = await api.saveLeadSettings({ businessContext: contextDraft.trim() });
    setContext(result.businessContext);
    setEditingContext(false);
  }

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

  async function runReport() {
    setRunning(true);
    setError("");
    setRunResult(null);
    try {
      const result = await api.runLeadsReport();
      setRunResult(result);
      setLeads(await api.listLeads());
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setRunning(false);
    }
  }

  async function updateLead(id, patch) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    try { await api.updateLead(id, patch); } catch (err) { console.error(err); }
  }
  async function removeLead(id) {
    if (!confirm("Delete this lead and its history?")) return;
    setLeads((prev) => prev.filter((l) => l.id !== id));
    if (expandedId === id) setExpandedId(null);
    try { await api.deleteLead(id); } catch (err) { console.error(err); }
  }

  async function addCompany({ company, website, contact }) {
    const created = await api.createLead({ company, website, contact });
    setLeads((prev) => [created, ...prev]);
    setExpandedId(created.id);
  }

  async function logInteraction(leadId, entry) {
    const updated = await api.addLeadInteraction(leadId, entry);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
  }
  async function removeInteraction(leadId, entryId) {
    const updated = await api.deleteLeadInteraction(leadId, entryId);
    setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
  }

  const canRun = sources.length > 0 && context.trim().length > 0;
  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGE_OPTIONS.map(([k]) => [k, 0]));
    for (const l of leads) counts[l.stage] = (counts[l.stage] ?? 0) + 1;
    return counts;
  }, [leads]);

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>Leads</h1>
        <button
          className="primary"
          onClick={runReport}
          disabled={!canRun || running}
          title={
            !context.trim() ? "Add a business context first" :
            sources.length === 0 ? "Add at least one source URL first" :
            "Fetch every source and extract leads with Claude"
          }
          style={{ fontSize: 15 }}
        >
          {running ? "Running…" : "Run report"}
        </button>
      </div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Two ways to fill your pipeline: paste a list of companies you already want to chase (<strong>Add company</strong> below), or have the agent crawl your saved source URLs and surface new prospects (<strong>Run report</strong>). Each lead has a full funnel tracker and interaction log underneath.
      </p>

      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      {/* ── Business context ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Business context</h3>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          The agent reads this every run. Concrete is better than abstract — region, target customer type, deal size, the kind of project you want to win.
        </p>
        {editingContext ? (
          <>
            <textarea
              value={contextDraft}
              onChange={(e) => setContextDraft(e.target.value)}
              rows={5}
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
            <div style={{ whiteSpace: "pre-line", padding: "8px 12px", background: "var(--color-surface-alt)", borderRadius: 4, fontSize: 14 }}>
              {context}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button onClick={() => setEditingContext(true)}>Edit</button>
            </div>
          </>
        )}
      </div>

      {/* ── Manual company add ─────────────────────────────────────── */}
      <ManualAddCard onAdd={addCompany} />

      {/* ── Source URLs (for the agent) ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div>
            <h3 style={{ margin: 0 }}>Agent source URLs</h3>
            <p className="text-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
              Pages the agent fetches on each <strong>Run report</strong>. Best fits: contractor / architect directories, association member lists, building-permit portals, chamber-of-commerce member pages. Static HTML works best.
            </p>
          </div>
          <button onClick={addSource}>+ Add source</button>
        </div>
        {sources.length === 0 ? (
          <div className="text-subtle" style={{ fontSize: 13 }}>No sources yet.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Label</th><th>URL</th><th>Notes</th><th></th></tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td><input value={s.label ?? ""} placeholder="e.g. AIA Pasadena directory" onChange={(e) => updateSource(s.id, { label: e.target.value })} style={{ width: 200 }} /></td>
                  <td><input value={s.url ?? ""} placeholder="https://..." onChange={(e) => updateSource(s.id, { url: e.target.value })} style={{ width: 320 }} /></td>
                  <td><input value={s.notes ?? ""} placeholder="What's on this page" onChange={(e) => updateSource(s.id, { notes: e.target.value })} style={{ width: 240 }} /></td>
                  <td><button onClick={() => removeSource(s.id)} title="Delete">×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Last run summary ───────────────────────────────────────── */}
      {runResult && (
        <div className="card" style={{ marginBottom: 16, background: "var(--color-success-soft)", borderLeft: "4px solid var(--color-success)" }}>
          <strong>Last run:</strong> queried {runResult.sourcesQueried} source{runResult.sourcesQueried === 1 ? "" : "s"} in {(runResult.durationMs / 1000).toFixed(1)}s — added {runResult.created.length} new lead{runResult.created.length === 1 ? "" : "s"}{runResult.skipped.length > 0 ? `, skipped ${runResult.skipped.length} duplicate${runResult.skipped.length === 1 ? "" : "s"}` : ""}.
          {runResult.errors.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <strong>{runResult.errors.length} source error{runResult.errors.length === 1 ? "" : "s"}:</strong>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                {runResult.errors.map((e, i) => <li key={i}><strong>{e.label || e.url}</strong>: {e.message}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Funnel summary ─────────────────────────────────────────── */}
      <h2 style={{ margin: "8px 0" }}>Pipeline ({leads.length})</h2>
      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {STAGE_OPTIONS.map(([key, label]) => (
          <div key={key} style={{ padding: "6px 10px", background: "var(--color-surface-alt)", borderRadius: 4, fontSize: 13 }}>
            <strong>{stageCounts[key]}</strong> <span className="text-muted">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Leads list ─────────────────────────────────────────────── */}
      {leads.length === 0 ? (
        <div className="card text-subtle">No leads yet. Add a company above, or set up the agent and hit <strong>Run report</strong>.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Why fit</th>
              <th>Salesperson</th>
              <th>Stage</th>
              <th>Last touch</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <LeadRow
                key={l.id}
                lead={l}
                salespeople={salespeople}
                expanded={expandedId === l.id}
                onExpand={() => setExpandedId(expandedId === l.id ? null : l.id)}
                onUpdate={(patch) => updateLead(l.id, patch)}
                onRemove={() => removeLead(l.id)}
                onLogInteraction={(entry) => logInteraction(l.id, entry)}
                onRemoveInteraction={(eid) => removeInteraction(l.id, eid)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ManualAddCard({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!company.trim()) return;
    await onAdd({
      company: company.trim(),
      website: website.trim(),
      contact: { name: contactName.trim(), email: contactEmail.trim(), phone: contactPhone.trim(), role: "" },
    });
    setCompany(""); setWebsite(""); setContactName(""); setContactEmail(""); setContactPhone("");
    setOpen(false);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0 }}>Add company manually</h3>
          <p className="text-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
            For companies you already know you want to chase. They land in the pipeline at <em>Not contacted</em> stage.
          </p>
        </div>
        <button onClick={() => setOpen(!open)}>{open ? "Cancel" : "+ Add company"}</button>
      </div>
      {open && (
        <form onSubmit={submit} className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
            <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Company</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Construction" autoFocus style={{ width: 220 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
            <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Website</span>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" style={{ width: 240 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
            <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Contact name</span>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Optional" style={{ width: 180 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
            <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Email</span>
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Optional" style={{ width: 200 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
            <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Phone</span>
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Optional" style={{ width: 140 }} />
          </label>
          <button className="primary" type="submit" disabled={!company.trim()}>Add to pipeline</button>
        </form>
      )}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

function LeadRow({ lead, salespeople, expanded, onExpand, onUpdate, onRemove, onLogInteraction, onRemoveInteraction }) {
  const lastTouch = lead.interactions?.[0];
  const salesperson = salespeople.find((s) => s.id === lead.salespersonId);

  return (
    <>
      <tr style={{ opacity: lead.stage === "lost" ? 0.55 : 1, background: expanded ? "var(--color-surface-alt)" : undefined }}>
        <td>
          <button onClick={onExpand} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
            <strong>{lead.company}</strong>
          </button>
          {lead.website && (
            <div style={{ fontSize: 12, marginTop: 2 }}>
              <a href={lead.website} target="_blank" rel="noreferrer">{lead.website.replace(/^https?:\/\//, "")}</a>
            </div>
          )}
          <div className="text-subtle" style={{ fontSize: 11, marginTop: 2 }}>
            {lead.origin === "manual" ? "Added manually" : lead.source?.label ? `via ${lead.source.label}` : "via agent"}
          </div>
        </td>
        <td style={{ fontSize: 13, maxWidth: 320 }}>{lead.whyGoodFit || <span className="text-subtle">—</span>}</td>
        <td>
          <select value={lead.salespersonId ?? ""} onChange={(e) => onUpdate({ salespersonId: e.target.value })}>
            <option value="">— unassigned —</option>
            {salespeople.map((s) => <option key={s.id} value={s.id}>{s.name || "(unnamed)"}</option>)}
          </select>
        </td>
        <td>
          <select value={lead.stage} onChange={(e) => onUpdate({ stage: e.target.value })}>
            {STAGE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </td>
        <td style={{ fontSize: 12 }}>
          {lastTouch ? (
            <>
              <div>{INTERACTION_KINDS.find(([k]) => k === lastTouch.kind)?.[1] || lastTouch.kind} · {fmtDate(lastTouch.date)}</div>
              {lastTouch.outcome && <div className="text-muted">{lastTouch.outcome}</div>}
            </>
          ) : <span className="text-subtle">no touches yet</span>}
        </td>
        <td style={{ fontWeight: 600, textAlign: "center" }}>{lead.qualityScore || "—"}</td>
        <td>
          <div className="row" style={{ gap: 4 }}>
            <button onClick={onExpand}>{expanded ? "Close" : "Open"}</button>
            <button onClick={onRemove} title="Delete">×</button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr style={{ background: "var(--color-surface-alt)" }}>
          <td colSpan={7} style={{ padding: "12px 16px" }}>
            <LeadDetail
              lead={lead}
              salesperson={salesperson}
              onUpdate={onUpdate}
              onLogInteraction={onLogInteraction}
              onRemoveInteraction={onRemoveInteraction}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function LeadDetail({ lead, salesperson, onUpdate, onLogInteraction, onRemoveInteraction }) {
  const [logKind, setLogKind] = useState("call");
  const [logSummary, setLogSummary] = useState("");
  const [logOutcome, setLogOutcome] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));

  async function submit(e) {
    e.preventDefault();
    if (!logSummary.trim() && !logOutcome.trim()) return;
    await onLogInteraction({ kind: logKind, summary: logSummary.trim(), outcome: logOutcome.trim(), date: logDate });
    setLogSummary("");
    setLogOutcome("");
  }

  return (
    <div className="row" style={{ gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      {/* Left column: contact / source / notes */}
      <div style={{ flex: "1 1 280px", minWidth: 240 }}>
        <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>
          Contact
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          {lead.contact?.name && <div><strong>{lead.contact.name}</strong>{lead.contact.role ? ` · ${lead.contact.role}` : ""}</div>}
          {lead.contact?.email && <div><a href={`mailto:${lead.contact.email}`}>{lead.contact.email}</a></div>}
          {lead.contact?.phone && <div><a href={`tel:${lead.contact.phone}`}>{lead.contact.phone}</a></div>}
          {!lead.contact?.name && !lead.contact?.email && !lead.contact?.phone && <span className="text-subtle">No contact info yet.</span>}
        </div>

        {salesperson && (
          <div style={{ marginTop: 12 }}>
            <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>
              Assigned to
            </div>
            <div style={{ fontSize: 13 }}>
              <strong>{salesperson.name}</strong>
              {salesperson.email && <> · <a href={`mailto:${salesperson.email}`}>{salesperson.email}</a></>}
              {salesperson.phone && <> · {salesperson.phone}</>}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>
            Notes
          </div>
          <textarea
            value={lead.notes ?? ""}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            rows={3}
            placeholder="Add internal notes about this lead…"
            style={{ width: "100%", padding: 6, fontSize: 13, boxSizing: "border-box" }}
          />
        </div>

        {lead.source?.url && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <span className="text-muted">Source: </span>
            <a href={lead.source.url} target="_blank" rel="noreferrer">{lead.source.label || lead.source.url}</a>
          </div>
        )}
      </div>

      {/* Right column: interaction log + add new */}
      <div style={{ flex: "2 1 420px", minWidth: 320 }}>
        <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>
          Interaction log
        </div>

        <form onSubmit={submit} style={{ background: "#fff", padding: 10, borderRadius: 4, marginBottom: 10, border: "1px solid var(--color-border)" }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
              <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Type</span>
              <select value={logKind} onChange={(e) => setLogKind(e.target.value)}>
                {INTERACTION_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 11 }}>
              <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Date</span>
              <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
            </label>
          </div>
          <input
            value={logSummary}
            onChange={(e) => setLogSummary(e.target.value)}
            placeholder="What did you do? (e.g. Left voicemail with Jane; called the office)"
            style={{ width: "100%", marginBottom: 6, boxSizing: "border-box" }}
          />
          <input
            value={logOutcome}
            onChange={(e) => setLogOutcome(e.target.value)}
            placeholder="Outcome / next step (e.g. Scheduled site visit Tue 10am; not interested, follow up Q3)"
            style={{ width: "100%", marginBottom: 6, boxSizing: "border-box" }}
          />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="primary" type="submit" disabled={!logSummary.trim() && !logOutcome.trim()}>Log interaction</button>
          </div>
        </form>

        {(lead.interactions?.length ?? 0) === 0 ? (
          <div className="text-subtle" style={{ fontSize: 13 }}>No interactions logged yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {lead.interactions.map((e) => (
              <li key={e.id} style={{ padding: "8px 10px", background: "#fff", borderRadius: 4, marginBottom: 6, border: "1px solid var(--color-border)" }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <div>
                    <strong>{INTERACTION_KINDS.find(([k]) => k === e.kind)?.[1] || e.kind}</strong>
                    <span className="text-muted" style={{ marginLeft: 8, fontSize: 12 }}>{fmtDate(e.date)}</span>
                  </div>
                  <button onClick={() => onRemoveInteraction(e.id)} title="Delete" style={{ fontSize: 11 }}>×</button>
                </div>
                {e.summary && <div style={{ fontSize: 13 }}>{e.summary}</div>}
                {e.outcome && <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 2 }}><em>→ {e.outcome}</em></div>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
