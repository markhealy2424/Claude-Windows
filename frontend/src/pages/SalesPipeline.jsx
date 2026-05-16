import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

export const STAGE_OPTIONS = [
  ["not_contacted",     "Not contacted"],
  ["reached_out",       "Reached out"],
  ["meeting_scheduled", "Meeting scheduled"],
  ["meeting_held",      "Meeting held"],
  ["quote_sent",        "Quote sent"],
  ["won",               "Won"],
  ["lost",              "Lost"],
];

export const INTERACTION_KINDS = [
  ["call",    "Call"],
  ["email",   "Email"],
  ["meeting", "Meeting"],
  ["note",    "Note"],
];

export default function SalesPipeline() {
  const [leads, setLeads] = useState([]);
  const [salespeople, setSalespeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listLeads(), api.listSalespeople()])
      .then(([l, sp]) => {
        if (cancelled) return;
        setLeads(l);
        setSalespeople(sp);
        setLoading(false);
      })
      .catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

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

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(STAGE_OPTIONS.map(([k]) => [k, 0]));
    for (const l of leads) counts[l.stage] = (counts[l.stage] ?? 0) + 1;
    return counts;
  }, [leads]);

  if (loading) return <div>Loading…</div>;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Pipeline ({leads.length})</h2>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={() => setImportOpen((v) => !v)}>{importOpen ? "Close import" : "Import PDF"}</button>
          <button onClick={() => setManualOpen((v) => !v)}>{manualOpen ? "Cancel" : "+ Company"}</button>
        </div>
      </div>

      <div className="row" style={{ gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {STAGE_OPTIONS.map(([key, label]) => (
          <div key={key} style={{ padding: "6px 10px", background: "var(--color-surface-alt)", borderRadius: 4, fontSize: 13 }}>
            <strong>{stageCounts[key]}</strong> <span className="text-muted">{label}</span>
          </div>
        ))}
      </div>

      {manualOpen && (
        <ManualAddForm
          onAdd={async (data) => { await addCompany(data); setManualOpen(false); }}
          onCancel={() => setManualOpen(false)}
        />
      )}

      {importOpen && (
        <PdfImportPanel
          onCreated={(created) => {
            setLeads((prev) => [...created, ...prev]);
          }}
          onClose={() => setImportOpen(false)}
        />
      )}

      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      {leads.length === 0 ? (
        <div className="card text-subtle">No leads yet. Hit <strong>+ Company</strong> to add one, or use the <strong>AI Agent</strong> tab.</div>
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

function ManualAddForm({ onAdd, onCancel }) {
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
  }

  return (
    <form
      onSubmit={submit}
      className="row"
      style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: 12, background: "var(--color-surface-alt)", border: "1px solid var(--color-border)", borderRadius: 6, marginBottom: 12 }}
    >
      <Field label="Company"><input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Construction" autoFocus style={{ width: 220 }} /></Field>
      <Field label="Website"><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" style={{ width: 240 }} /></Field>
      <Field label="Contact"><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name (optional)" style={{ width: 180 }} /></Field>
      <Field label="Email"><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Optional" style={{ width: 200 }} /></Field>
      <Field label="Phone"><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Optional" style={{ width: 140 }} /></Field>
      <button className="primary" type="submit" disabled={!company.trim()}>Add</button>
      {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
    </form>
  );
}

function PdfImportPanel({ onCreated, onClose }) {
  // Three states: "pick" (waiting for upload), "parsing", "review" (got drafts).
  const [stage, setStage] = useState("pick");
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [sourceDocTitle, setSourceDocTitle] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [approved, setApproved] = useState({}); // index -> bool
  const [confirming, setConfirming] = useState(false);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStage("parsing"); setError(""); setFileName(file.name);
    try {
      const result = await api.importLeadsFromPdf(file);
      setSourceDocTitle(result.sourceDocTitle || "");
      setDrafts(result.drafts || []);
      // Default: every extracted row approved. The user unchecks the noise.
      setApproved(Object.fromEntries((result.drafts || []).map((_, i) => [i, true])));
      setStage("review");
    } catch (err) {
      setError(String(err.message || err));
      setStage("pick");
    }
  }

  function updateDraft(i, patch) {
    setDrafts((prev) => prev.map((d, j) => (i === j ? { ...d, ...patch } : d)));
  }

  async function confirm() {
    const keep = drafts.filter((_, i) => approved[i]);
    if (keep.length === 0) return;
    setConfirming(true); setError("");
    try {
      const result = await api.confirmLeadImport({
        drafts: keep,
        sourceDocTitle,
        fileName,
      });
      onCreated?.(result.created);
      if (result.skipped?.length) {
        setError(`Imported ${result.created.length} • Skipped ${result.skipped.length} duplicate company name(s): ${result.skipped.join(", ")}`);
      }
      // Reset to a fresh pick state so the user can import another PDF without closing.
      setStage("pick");
      setDrafts([]);
      setApproved({});
      setFileName("");
      setSourceDocTitle("");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setConfirming(false);
    }
  }

  const approvedCount = drafts.reduce((n, _, i) => n + (approved[i] ? 1 : 0), 0);

  return (
    <div
      className="card"
      style={{ padding: 12, marginBottom: 12 }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Import leads from PDF</h3>
        <button onClick={onClose}>Close</button>
      </div>

      {error && <div className="card error" style={{ marginBottom: 8 }}>{error}</div>}

      {stage === "pick" && (
        <div>
          <p className="text-muted" style={{ fontSize: 13, margin: "0 0 8px" }}>
            Drop in a prospect list (broker directory, conference roster, exhibitor list, etc.) — Claude vision will extract each company + contact for you to review.
          </p>
          <label className="pill-upload" style={{ display: "inline-block", cursor: "pointer" }}>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={onPick}
              style={{ display: "none" }}
            />
            Choose PDF or image
          </label>
        </div>
      )}

      {stage === "parsing" && (
        <div className="text-muted" style={{ fontSize: 13 }}>
          Reading <strong>{fileName}</strong> with Claude vision… this usually takes 15–60 seconds depending on length.
        </div>
      )}

      {stage === "review" && (
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <div className="text-muted" style={{ fontSize: 13 }}>
              <strong>{drafts.length}</strong> leads extracted from <strong>{fileName}</strong>
              {sourceDocTitle ? ` (${sourceDocTitle})` : ""}. Uncheck any rows you don't want. Click <strong>Import {approvedCount}</strong> to create them.
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button onClick={() => setApproved(Object.fromEntries(drafts.map((_, i) => [i, true])))}>Select all</button>
              <button onClick={() => setApproved({})}>Select none</button>
              <button
                className="primary"
                onClick={confirm}
                disabled={confirming || approvedCount === 0}
              >
                {confirming ? "Importing…" : `Import ${approvedCount}`}
              </button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="text-subtle">No leads found in the document.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 32 }}></th>
                  <th>Company</th>
                  <th>Contact</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={i} style={{ opacity: approved[i] ? 1 : 0.4 }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={!!approved[i]}
                        onChange={(e) => setApproved((a) => ({ ...a, [i]: e.target.checked }))}
                      />
                    </td>
                    <td><input value={d.company} onChange={(e) => updateDraft(i, { company: e.target.value })} style={{ width: "100%" }} /></td>
                    <td><input value={d.contactName} onChange={(e) => updateDraft(i, { contactName: e.target.value })} style={{ width: "100%" }} /></td>
                    <td><input value={d.contactEmail} onChange={(e) => updateDraft(i, { contactEmail: e.target.value })} style={{ width: "100%" }} /></td>
                    <td><input value={d.contactPhone} onChange={(e) => updateDraft(i, { contactPhone: e.target.value })} style={{ width: "100%" }} /></td>
                    <td><input value={d.contactRole} onChange={(e) => updateDraft(i, { contactRole: e.target.value })} style={{ width: "100%" }} /></td>
                    <td><input value={d.website} onChange={(e) => updateDraft(i, { website: e.target.value })} style={{ width: "100%" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
      <span className="text-muted" style={{ textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
}

function shortUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "") + (u.pathname && u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url.length > 50 ? url.slice(0, 50) + "…" : url;
  }
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
              <a href={lead.website} target="_blank" rel="noreferrer" title={lead.website}>{shortUrl(lead.website)}</a>
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
      <div style={{ flex: "1 1 280px", minWidth: 240 }}>
        <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>Contact</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          {lead.contact?.name && <div><strong>{lead.contact.name}</strong>{lead.contact.role ? ` · ${lead.contact.role}` : ""}</div>}
          {lead.contact?.email && <div><a href={`mailto:${lead.contact.email}`}>{lead.contact.email}</a></div>}
          {lead.contact?.phone && <div><a href={`tel:${lead.contact.phone}`}>{lead.contact.phone}</a></div>}
          {!lead.contact?.name && !lead.contact?.email && !lead.contact?.phone && <span className="text-subtle">No contact info yet.</span>}
        </div>

        {salesperson && (
          <div style={{ marginTop: 12 }}>
            <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>Assigned to</div>
            <div style={{ fontSize: 13 }}>
              <strong>{salesperson.name}</strong>
              {salesperson.email && <> · <a href={`mailto:${salesperson.email}`}>{salesperson.email}</a></>}
              {salesperson.phone && <> · {salesperson.phone}</>}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>Notes</div>
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

      <div style={{ flex: "2 1 420px", minWidth: 320 }}>
        <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 4 }}>Interaction log</div>

        <form onSubmit={submit} style={{ background: "#fff", padding: 10, borderRadius: 4, marginBottom: 10, border: "1px solid var(--color-border)" }}>
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
            <Field label="Type">
              <select value={logKind} onChange={(e) => setLogKind(e.target.value)}>
                {INTERACTION_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Field>
            <Field label="Date"><input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} /></Field>
          </div>
          <input value={logSummary} onChange={(e) => setLogSummary(e.target.value)} placeholder="What did you do? (e.g. Left voicemail with Jane)" style={{ width: "100%", marginBottom: 6, boxSizing: "border-box" }} />
          <input value={logOutcome} onChange={(e) => setLogOutcome(e.target.value)} placeholder="Outcome / next step (e.g. Scheduled site visit Tue 10am)" style={{ width: "100%", marginBottom: 6, boxSizing: "border-box" }} />
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
