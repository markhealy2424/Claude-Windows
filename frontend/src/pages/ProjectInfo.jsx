import { useEffect, useState } from "react";
import { TextField } from "../lib/Fields.jsx";
import { REQUIREMENTS } from "../lib/projectRequirements.js";

const blankClient = {
  name: "",
  address: "",
  manager: "",
  phone: "",
  email: "",
  notes: "",
};

const blank = {
  address: "",
  buyerName: "",
  company: "",
  date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  requirements: {},  // { dualGlazed: "yes"|"no", narrowFrame: "yes"|"no", narrowFrameSpec: "...", ... }
  // Client info is stored as a nested object so it doesn't collide with
  // the buyer fields above. The buyer is whoever's purchasing windows
  // (often a contractor or builder); the client is the end-user / owner
  // the project is being built for. The two are frequently different.
  client: blankClient,
};

export default function ProjectInfo({ project, onChange }) {
  const info = { ...blank, ...(project.info ?? {}) };
  const client = { ...blankClient, ...(info.client ?? {}) };
  const reqs = info.requirements ?? {};

  function savePatch(patch) {
    onChange({ info: { ...info, ...patch } });
  }

  function saveClient(nextClient) {
    savePatch({ client: nextClient });
  }

  function setReq(key, value) {
    savePatch({ requirements: { ...reqs, [key]: value } });
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        These details appear in the header of every RFQ PDF you export for this project.
      </p>

      <ProjectDetailsCard values={info} onSave={savePatch} />

      <ClientCard values={client} onSave={saveClient} />

      <div className="card" style={{ maxWidth: 720, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Project requirements</h3>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 16 }}>
          These appear as a checklist on the RFQ so suppliers know exactly what spec to quote against. Leave blank for any you don't have a preference on.
        </p>
        {REQUIREMENTS.map((req) => {
          const value = reqs[req.key] ?? "";
          const showSpec = req.hasSpec && value === "no";
          const specKey = `${req.key}Spec`;
          return (
            <div key={req.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{req.label}</div>
                {showSpec && (
                  <input
                    placeholder={req.specLabel}
                    value={reqs[specKey] ?? ""}
                    onChange={(e) => setReq(specKey, e.target.value)}
                    style={{ width: "100%", marginTop: 6, fontSize: 13 }}
                  />
                )}
              </div>
              <div className="yn-toggle">
                <button
                  type="button"
                  className={value === "yes" ? "active" : ""}
                  onClick={() => setReq(req.key, value === "yes" ? "" : "yes")}
                >Yes</button>
                <button
                  type="button"
                  className={value === "no" ? "active" : ""}
                  onClick={() => setReq(req.key, value === "no" ? "" : "no")}
                >No</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Project details card ─────────────────────────────────────────────

function ProjectDetailsCard({ values, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);

  // If the parent's values shift while we're not editing (e.g. a different
  // project loaded), snap the draft to the latest values so the next Edit
  // starts from the right place.
  useEffect(() => {
    if (!editing) setDraft(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.address, values.buyerName, values.company, values.date]);

  function startEdit() {
    setDraft({ ...values });
    setEditing(true);
  }
  function cancel() {
    setDraft({ ...values });
    setEditing(false);
  }
  function save() {
    onSave({
      address: draft.address,
      buyerName: draft.buyerName,
      company: draft.company,
      date: draft.date,
    });
    setEditing(false);
  }

  return (
    <EditableCard
      title="Project details"
      editing={editing}
      onStartEdit={startEdit}
      onSave={save}
      onCancel={cancel}
    >
      {editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-4)" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField
              label="Address of build (project location)"
              value={draft.address}
              onChange={(v) => setDraft({ ...draft, address: v })}
              inputStyle={{ width: "100%" }}
              placeholder="1437 Crest Dr, Altadena, CA 91001"
            />
          </div>
          <TextField
            label="Buyer name"
            value={draft.buyerName}
            onChange={(v) => setDraft({ ...draft, buyerName: v })}
            placeholder="Shashi Dayal"
            inputStyle={{ width: "100%" }}
          />
          <TextField
            label="Company requesting quote"
            value={draft.company}
            onChange={(v) => setDraft({ ...draft, company: v })}
            placeholder="Your company name"
            inputStyle={{ width: "100%" }}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
              RFQ date
            </span>
            <input
              type="date"
              value={draft.date ?? ""}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              style={{ width: 180 }}
            />
          </label>
        </div>
      ) : (
        <InfoList>
          <InfoRow label="Address of build" value={values.address} />
          <InfoRow label="Buyer name" value={values.buyerName} />
          <InfoRow label="Company requesting quote" value={values.company} />
          <InfoRow label="RFQ date" value={formatDate(values.date)} />
        </InfoList>
      )}
    </EditableCard>
  );
}

// ── Client card ──────────────────────────────────────────────────────

function ClientCard({ values, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);

  useEffect(() => {
    if (!editing) setDraft(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.name, values.manager, values.address, values.phone, values.email, values.notes]);

  function startEdit() {
    setDraft({ ...values });
    setEditing(true);
  }
  function cancel() {
    setDraft({ ...values });
    setEditing(false);
  }
  function save() {
    onSave({ ...values, ...draft });
    setEditing(false);
  }

  function setField(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <EditableCard
      title="Client"
      description="The end client this project is being built for — typically the homeowner or building owner. Often distinct from the buyer above (a contractor or builder placing the order on the client's behalf)."
      editing={editing}
      onStartEdit={startEdit}
      onSave={save}
      onCancel={cancel}
    >
      {editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-4)" }}>
          <TextField
            label="Client name"
            value={draft.name}
            onChange={(v) => setField("name", v)}
            placeholder="Jane Homeowner"
            inputStyle={{ width: "100%" }}
          />
          <TextField
            label="Client manager / contact"
            value={draft.manager}
            onChange={(v) => setField("manager", v)}
            placeholder="Property manager or rep"
            inputStyle={{ width: "100%" }}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField
              label="Client address"
              value={draft.address}
              onChange={(v) => setField("address", v)}
              placeholder="If different from the build address"
              inputStyle={{ width: "100%" }}
            />
          </div>
          <TextField
            label="Phone"
            value={draft.phone}
            onChange={(v) => setField("phone", v)}
            placeholder="(555) 123-4567"
            inputStyle={{ width: "100%" }}
          />
          <TextField
            label="Email"
            value={draft.email}
            onChange={(v) => setField("email", v)}
            placeholder="client@example.com"
            inputStyle={{ width: "100%" }}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
              Notes (optional)
            </span>
            <textarea
              value={draft.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Anything specific about how this client likes to communicate, payment terms, access codes, etc."
              rows={2}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 13 }}
            />
          </label>
        </div>
      ) : (
        <InfoList>
          <InfoRow label="Client name" value={values.name} />
          <InfoRow label="Client manager / contact" value={values.manager} />
          <InfoRow label="Client address" value={values.address} />
          <InfoRow label="Phone" value={values.phone} />
          <InfoRow label="Email" value={values.email} />
          <InfoRow label="Notes" value={values.notes} multiline />
        </InfoList>
      )}
    </EditableCard>
  );
}

// ── Shared primitives ───────────────────────────────────────────────

// Reusable card shell with an Edit / Save / Cancel header so any block
// of fields on Project Info (Project details, Client, future) shares
// the same finalize-on-Save UX as the Financial ledger.
function EditableCard({ title, description, editing, onStartEdit, onSave, onCancel, children }) {
  return (
    <div className="card" style={{ maxWidth: 720, marginBottom: 24 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <h3 style={{ marginTop: 0, marginBottom: 0 }}>{title}</h3>
        {!editing && (
          <button type="button" onClick={onStartEdit}>Edit</button>
        )}
      </div>
      {description && (
        <p className="text-muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 16 }}>
          {description}
        </p>
      )}
      {children}
      {editing && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" className="primary" onClick={onSave}>Save</button>
        </div>
      )}
    </div>
  );
}

// Definition-list-style read view. Labels live in a fixed left column,
// values flow on the right — reads like a completed form, not an input
// surface.
function InfoList({ children }) {
  return <dl className="info-list">{children}</dl>;
}

function InfoRow({ label, value, multiline = false }) {
  const isEmpty = value == null || value === "";
  return (
    <div className="info-row">
      <dt>{label}</dt>
      <dd className={isEmpty ? "text-subtle" : ""} style={multiline ? { whiteSpace: "pre-wrap" } : undefined}>
        {isEmpty ? "—" : value}
      </dd>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
