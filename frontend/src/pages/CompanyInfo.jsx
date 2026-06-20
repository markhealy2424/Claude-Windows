import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { TextField } from "../lib/Fields.jsx";

// Single-tenant company branding page. Contact details use the same
// finalize-on-Save pattern as Project Info — static text view by
// default, Edit button flips to an input form with Save/Cancel.
// Accent color + logo / cover uploads stay action-based (each click
// is its own commit), since they're already not always-editable.
export default function CompanyInfo() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCompanyInfo()
      .then(setInfo)
      .catch((e) => setError(String(e)));
  }, []);

  async function saveContact(patch) {
    setError("");
    try {
      const next = await api.updateCompanyInfo(patch);
      setInfo(next);
    } catch (e) {
      setError(String(e));
      throw e;
    }
  }

  async function saveAccentColor(hex) {
    return saveContact({
      // Preserve every other field — the API merges via spread on the
      // server, but explicitly listing keeps the contract obvious.
      name: info.name ?? "",
      tagline: info.tagline ?? "",
      address: info.address ?? "",
      phone: info.phone ?? "",
      email: info.email ?? "",
      accentColor: hex,
    });
  }

  if (error && !info) return <div style={{ color: "var(--color-error)" }}>{error}</div>;
  if (!info) return <div className="text-subtle">Loading…</div>;

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <h1 style={{ margin: 0 }}>Company Info</h1>
        <p className="text-subtle" style={{ marginTop: 6 }}>
          Your branding on every customer-facing document — proposals, RFQs, and invoices.
          Set once here; every project pulls these values automatically.
        </p>
      </header>

      <ContactDetailsCard info={info} onSave={saveContact} />

      <AccentColorCard accentColor={info.accentColor} onSave={saveAccentColor} />

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Brand assets</h2>
        <p className="text-subtle" style={{ margin: 0, fontSize: 13 }}>
          PNG or JPG only. Replaces the default proposal artwork.
        </p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <AssetSlot
            kind="logo"
            label="Header logo"
            hint="Shown at the top of every proposal page. Wide rectangle works best."
            meta={info.logo}
            previewW={220}
            previewH={120}
            onUpdated={(next) => setInfo(next)}
          />
          <AssetSlot
            kind="cover"
            label="Cover banner"
            hint="Big image at the top of the proposal cover page. ~914×610 aspect."
            meta={info.coverBanner}
            previewW={300}
            previewH={200}
            onUpdated={(next) => setInfo(next)}
          />
        </div>
      </section>

      {error && (
        <div style={{ color: "var(--color-error)", fontSize: 13 }}>{error}</div>
      )}
    </div>
  );
}

// ── Contact details (Company name / tagline / address / phone / email) ──

function ContactDetailsCard({ info, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(info);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!editing) setDraft(info);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.name, info.tagline, info.address, info.phone, info.email]);

  function startEdit() {
    setDraft({ ...info });
    setLocalError("");
    setEditing(true);
  }
  function cancel() {
    setDraft({ ...info });
    setLocalError("");
    setEditing(false);
  }
  async function save() {
    setSaving(true);
    setLocalError("");
    try {
      await onSave({
        name: draft.name ?? "",
        tagline: draft.tagline ?? "",
        address: draft.address ?? "",
        phone: draft.phone ?? "",
        email: draft.email ?? "",
        accentColor: info.accentColor ?? "#077BE2",
      });
      setEditing(false);
    } catch (e) {
      setLocalError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" style={{ padding: 24 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Contact details</h2>
        {!editing && (
          <button type="button" onClick={startEdit}>Edit</button>
        )}
      </div>

      {editing ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Company name" value={draft.name ?? ""} onChange={(v) => setDraft({ ...draft, name: v })} inputStyle={{ width: "100%" }} />
          <TextField label="Tagline (optional)" value={draft.tagline ?? ""} onChange={(v) => setDraft({ ...draft, tagline: v })} inputStyle={{ width: "100%" }} />
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField label="Address" value={draft.address ?? ""} onChange={(v) => setDraft({ ...draft, address: v })} inputStyle={{ width: "100%" }} />
          </div>
          <TextField label="Phone" value={draft.phone ?? ""} onChange={(v) => setDraft({ ...draft, phone: v })} inputStyle={{ width: "100%" }} />
          <TextField label="Email" value={draft.email ?? ""} onChange={(v) => setDraft({ ...draft, email: v })} inputStyle={{ width: "100%" }} />
        </div>
      ) : (
        <dl className="info-list">
          <InfoRow label="Company name" value={info.name} />
          <InfoRow label="Tagline" value={info.tagline} />
          <InfoRow label="Address" value={info.address} />
          <InfoRow label="Phone" value={info.phone} />
          <InfoRow label="Email" value={info.email} />
        </dl>
      )}

      {editing && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
          {localError && (
            <span style={{ color: "var(--color-error)", fontSize: 13, marginRight: "auto" }}>{localError}</span>
          )}
          <button type="button" onClick={cancel} disabled={saving}>Cancel</button>
          <button type="button" className="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}

// ── Accent color (read view shows the swatch + hex; Edit reveals the
//    picker + Save/Cancel actions to match the rest of the page) ─────

function AccentColorCard({ accentColor, onSave }) {
  const initial = accentColor || "#077BE2";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    if (!editing) setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentColor]);

  function startEdit() {
    setDraft(initial);
    setLocalError("");
    setEditing(true);
  }
  function cancel() {
    setDraft(initial);
    setLocalError("");
    setEditing(false);
  }
  async function save() {
    setSaving(true);
    setLocalError("");
    try {
      await onSave(draft);
      setEditing(false);
    } catch (e) {
      setLocalError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" style={{ padding: 24 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Brand accent color</h2>
        {!editing && (
          <button type="button" onClick={startEdit}>Edit</button>
        )}
      </div>
      <p className="text-subtle" style={{ margin: "0 0 12px 0", fontSize: 13 }}>
        Used as the accent on your proposal PDFs (header band, callouts, totals row).
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {editing ? (
          <input
            type="color"
            className="brand-swatch"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Accent color"
          />
        ) : (
          <span
            className="brand-swatch"
            style={{ background: initial, display: "inline-block", cursor: "default" }}
            aria-hidden="true"
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <code style={{ fontSize: 14, fontWeight: 600 }}>{editing ? draft : initial}</code>
          <span className="text-subtle" style={{ fontSize: 11 }}>
            {editing ? "Click the swatch to pick a new color" : "Click Edit to change"}
          </span>
        </div>
      </div>
      {editing && (
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
          {localError && (
            <span style={{ color: "var(--color-error)", fontSize: 13, marginRight: "auto" }}>{localError}</span>
          )}
          <button type="button" onClick={cancel} disabled={saving}>Cancel</button>
          <button type="button" className="primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}

// ── Read-mode primitive (mirrors the helpers used on Project Info) ───

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

// ── Asset slot (unchanged — uploads commit per-click via the API) ───

function AssetSlot({ kind, label, hint, meta, previewW, previewH, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const src = meta ? api.companyAssetUrl(kind, meta.uploadedAt) : null;

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true); setError("");
    try {
      const next = await api.uploadCompanyAsset(kind, file);
      onUpdated?.(next);
    } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  }

  async function onDelete() {
    if (!confirm(`Delete this ${label.toLowerCase()}?`)) return;
    setBusy(true); setError("");
    try {
      const next = await api.deleteCompanyAsset(kind);
      onUpdated?.(next);
    } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      <div
        style={{
          width: previewW,
          height: previewH,
          border: "1px dashed var(--color-border)",
          borderRadius: 6,
          background: "var(--color-surface-alt)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {src ? (
          <img src={src} alt={label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <span className="text-subtle" style={{ fontSize: 12 }}>No image</span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg" onChange={onPick} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => inputRef.current?.click()} disabled={busy}>{meta ? "Replace" : "Upload"}</button>
        {meta && <button onClick={onDelete} disabled={busy}>Delete</button>}
      </div>
      {hint && <span className="text-subtle" style={{ fontSize: 11, maxWidth: previewW }}>{hint}</span>}
      {error && <span style={{ color: "var(--color-error)", fontSize: 11 }}>{error}</span>}
    </div>
  );
}
