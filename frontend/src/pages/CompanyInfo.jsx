import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { TextField } from "../lib/Fields.jsx";

// Single-tenant company branding page. Text fields save on "Save changes";
// logo + cover banner uploads commit immediately on file pick. The values
// here are pulled into proposal PDFs as the default branding layer (the
// per-project overrides on the Proposal tab still win when set).
export default function CompanyInfo() {
  const [info, setInfo] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCompanyInfo()
      .then((d) => { setInfo(d); setDraft(d); })
      .catch((e) => setError(String(e)));
  }, []);

  const dirty = info && Object.keys(draft).some((k) => draft[k] !== info[k] && k !== "logo" && k !== "coverBanner");

  async function save() {
    setSaving(true); setError("");
    try {
      const patch = {
        name: draft.name ?? "",
        tagline: draft.tagline ?? "",
        address: draft.address ?? "",
        phone: draft.phone ?? "",
        email: draft.email ?? "",
        accentColor: draft.accentColor ?? "#077BE2",
      };
      const next = await api.updateCompanyInfo(patch);
      setInfo(next); setDraft(next); setSavedAt(Date.now());
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (error && !info) return <div style={{ color: "var(--color-error)" }}>{error}</div>;
  if (!info) return <div className="text-subtle">Loading…</div>;

  return (
    <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 24 }}>
      <header>
        <h1 style={{ margin: 0 }}>Company Info</h1>
        <p className="text-subtle" style={{ marginTop: 6 }}>
          Your branding on customer-facing proposals and invoices. The
          Window Stream app chrome (sidebar, buttons) stays blue regardless.
        </p>
      </header>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Contact details</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <TextField label="Company name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} inputStyle={{ width: "100%" }} />
          <TextField label="Tagline (optional)" value={draft.tagline} onChange={(v) => setDraft({ ...draft, tagline: v })} inputStyle={{ width: "100%" }} />
          <TextField label="Address" value={draft.address} onChange={(v) => setDraft({ ...draft, address: v })} inputStyle={{ width: "100%" }} style={{ gridColumn: "1 / -1" }} />
          <TextField label="Phone" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} inputStyle={{ width: "100%" }} />
          <TextField label="Email" value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} inputStyle={{ width: "100%" }} />
        </div>
      </section>

      <section className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Brand accent color</h2>
        <p className="text-subtle" style={{ margin: 0, fontSize: 13 }}>
          Used as the accent on your proposal PDFs (header band, callouts, totals row).
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <input
            type="color"
            value={draft.accentColor || "#077BE2"}
            onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
            style={{ width: 48, height: 36, border: "none", background: "transparent", cursor: "pointer" }}
            aria-label="Accent color"
          />
          <code style={{ fontSize: 13 }}>{draft.accentColor || "#077BE2"}</code>
        </div>
      </section>

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
            onUpdated={(next) => { setInfo(next); setDraft({ ...draft, logo: next.logo }); }}
          />
          <AssetSlot
            kind="cover"
            label="Cover banner"
            hint="Big image at the top of the proposal cover page. ~914×610 aspect."
            meta={info.coverBanner}
            previewW={300}
            previewH={200}
            onUpdated={(next) => { setInfo(next); setDraft({ ...draft, coverBanner: next.coverBanner }); }}
          />
        </div>
      </section>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {savedAt > 0 && !dirty && <span className="text-subtle" style={{ fontSize: 12 }}>Saved.</span>}
        {error && <span style={{ color: "var(--color-error)", fontSize: 13 }}>{error}</span>}
      </div>
    </div>
  );
}

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
