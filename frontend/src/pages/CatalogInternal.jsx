import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";

// Mirror of the type slugs in pages/ItemEditor.jsx — kept in sync manually.
// Catalog is intentionally isolated from per-project items for now, so we
// duplicate rather than couple the two. When the catalog starts feeding
// quotes, lift this into a shared lib.
const TYPES = [
  ["fixed", "Fixed window"],
  ["casement", "Casement window"],
  ["awning", "Awning window"],
  ["sliding", "Sliding window"],
  ["slider", "Slider window"],
  ["hopper", "Hopper window"],
  ["double-hung", "Double Hung window"],
  ["sliding-door", "Sliding door"],
  ["french-door", "French door"],
  ["bifold-door", "Bi-Fold door"],
  ["multi-fold-door", "Multi-Fold door"],
  ["single-hinged-door", "Single-Hinged door"],
  ["double-hinged-door", "Double-Hinged door"],
  ["entry-door", "Entry door"],
];

const ALL_GROUP_ID = "__all__";

// SKU autoformat: "{ManufacturerInitial}-{NNN}-{Type}" e.g. "C-001-Fixed".
// The type segment strips a trailing " window" but keeps " door" so doors
// stay disambiguated, with spaces collapsed to dashes.
function typeForSku(typeSlug) {
  const label = TYPES.find(([s]) => s === typeSlug)?.[1] || "";
  return label.replace(/\s*window$/i, "").trim().replace(/\s+/g, "-");
}

function nextProductNumberFor(manufacturer, products) {
  const m = String(manufacturer ?? "").trim().toLowerCase();
  if (!m) return 1;
  let max = 0;
  for (const p of products) {
    if (String(p.manufacturer ?? "").trim().toLowerCase() !== m) continue;
    const parts = String(p.sku ?? "").split("-");
    const n = parseInt(parts[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

export default function CatalogInternal() {
  const [groups, setGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState(ALL_GROUP_ID);
  const [view, setView] = useState({ mode: "list" }); // "list" | { mode: "edit", productId? }
  const [managingGroups, setManagingGroups] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.listCatalogGroups(), api.listCatalogProducts()])
      .then(([g, p]) => {
        if (cancelled) return;
        setGroups(g);
        setProducts(p);
        setLoading(false);
      })
      .catch((e) => !cancelled && (setError(String(e)), setLoading(false)));
    return () => { cancelled = true; };
  }, []);

  const filteredProducts = useMemo(() => {
    if (selectedGroupId === ALL_GROUP_ID) return products;
    return products.filter((p) => Array.isArray(p.groupIds) && p.groupIds.includes(selectedGroupId));
  }, [products, selectedGroupId]);

  const countByGroup = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      for (const gid of (p.groupIds ?? [])) counts.set(gid, (counts.get(gid) ?? 0) + 1);
    }
    return counts;
  }, [products]);

  // Quick-add suggestions: aggregate distinct spec rows and option groups
  // across every existing product, sorted by frequency. Lets the user
  // re-use common specs (e.g. "Glass Type: 6mm + 12A + 6mm Low-E") without
  // retyping. Skipped on the *first* product since there's nothing to draw from.
  const recentSpecs = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      for (const s of (p.specs ?? [])) {
        const label = String(s.label ?? "").trim();
        const value = String(s.value ?? "").trim();
        if (!label && !value) continue;
        const key = `${label}|${value}`;
        const e = counts.get(key);
        if (e) e.n++;
        else counts.set(key, { label, value, n: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 12);
  }, [products]);

  const recentOptionGroups = useMemo(() => {
    const counts = new Map();
    for (const p of products) {
      for (const o of (p.options ?? [])) {
        const name = String(o.name ?? "").trim();
        const choices = (o.choices ?? []).map((c) => String(c).trim()).filter(Boolean);
        if (!name && choices.length === 0) continue;
        const key = `${name}|${[...choices].sort().join("|")}`;
        const e = counts.get(key);
        if (e) e.n++;
        else counts.set(key, { name, choices, n: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }, [products]);

  if (loading) return <div>Loading…</div>;

  if (view.mode === "edit") {
    const existing = view.productId ? products.find((p) => p.id === view.productId) : null;
    return (
      <ProductEditor
        groups={groups}
        product={existing}
        products={products}
        recentSpecs={recentSpecs}
        recentOptionGroups={recentOptionGroups}
        onCancel={() => setView({ mode: "list" })}
        onSaved={(saved, kind) => {
          if (kind === "create") setProducts((prev) => [...prev, saved]);
          else if (kind === "update") setProducts((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
          else if (kind === "delete") setProducts((prev) => prev.filter((p) => p.id !== saved.id));
          setView({ mode: "list" });
        }}
      />
    );
  }

  return (
    <div>
      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      <p className="text-muted" style={{ fontSize: 13, margin: "0 0 12px" }}>
        SKU-level directory of every product you offer. Groups are for organizing
        and ordering products in the look-book. Sizing and pricing are not part
        of the catalog — they live on the per-project items.
      </p>

      <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <button
          className={selectedGroupId === ALL_GROUP_ID ? "pill-toggle active" : "pill-toggle"}
          onClick={() => setSelectedGroupId(ALL_GROUP_ID)}
        >
          All products <span className="text-subtle">({products.length})</span>
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            className={selectedGroupId === g.id ? "pill-toggle active" : "pill-toggle"}
            onClick={() => setSelectedGroupId(g.id)}
          >
            {g.name || "(untitled)"} <span className="text-subtle">({countByGroup.get(g.id) ?? 0})</span>
          </button>
        ))}
        <button className="pill-toggle" onClick={() => setManagingGroups(true)}>+ Manage groups</button>
      </div>

      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>
          {selectedGroupId === ALL_GROUP_ID
            ? "All products"
            : (groups.find((g) => g.id === selectedGroupId)?.name || "Group")}
        </h2>
        <button onClick={() => setView({ mode: "edit" })}>+ New product</button>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="card text-subtle">
          No products yet. Hit <strong>+ New product</strong> to add one.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Manufacturer</th>
              <th>Product line</th>
              <th>Type</th>
              <th>Groups</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const typeLabel = TYPES.find(([slug]) => slug === p.type)?.[1] || p.type || "—";
              const groupNames = (p.groupIds ?? [])
                .map((gid) => groups.find((g) => g.id === gid)?.name)
                .filter(Boolean);
              return (
                <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => setView({ mode: "edit", productId: p.id })}>
                  <td><strong>{p.sku || "—"}</strong></td>
                  <td>{p.manufacturer || "—"}</td>
                  <td>{p.productLine || "—"}</td>
                  <td>{typeLabel}</td>
                  <td className="text-subtle">{groupNames.join(", ") || "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    <button onClick={(e) => { e.stopPropagation(); setView({ mode: "edit", productId: p.id }); }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {managingGroups && (
        <GroupsManager
          groups={groups}
          onClose={() => setManagingGroups(false)}
          onChange={setGroups}
          onGroupDeleted={(deletedId) => {
            // Drop any references in local product state — the server already did this server-side.
            setProducts((prev) => prev.map((p) => ({
              ...p,
              groupIds: (p.groupIds ?? []).filter((gid) => gid !== deletedId),
            })));
            if (selectedGroupId === deletedId) setSelectedGroupId(ALL_GROUP_ID);
          }}
        />
      )}
    </div>
  );
}

function GroupsManager({ groups, onClose, onChange, onGroupDeleted }) {
  const [draftName, setDraftName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function addGroup() {
    const name = draftName.trim();
    if (!name) return;
    setBusy(true); setError("");
    try {
      const g = await api.createCatalogGroup({ name });
      onChange([...groups, g]);
      setDraftName("");
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  async function renameGroup(id, name) {
    try {
      const g = await api.updateCatalogGroup(id, { name });
      onChange(groups.map((x) => (x.id === id ? g : x)));
    } catch (e) { setError(String(e)); }
  }

  async function moveGroup(id, dir) {
    const idx = groups.findIndex((g) => g.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= groups.length) return;
    const next = [...groups];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
    try {
      const updated = await api.reorderCatalogGroups(next.map((g) => g.id));
      onChange(updated);
    } catch (e) { setError(String(e)); }
  }

  async function removeGroup(id) {
    if (!confirm("Delete this group? Products in it stay, but lose the group tag.")) return;
    try {
      await api.deleteCatalogGroup(id);
      onChange(groups.filter((g) => g.id !== id));
      onGroupDeleted?.(id);
    } catch (e) { setError(String(e)); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Manage groups</h3>
        <button onClick={onClose}>Done</button>
      </div>
      {error && <div className="card error" style={{ marginBottom: 8 }}>{error}</div>}
      <div className="row" style={{ gap: 8, marginBottom: 12 }}>
        <input
          placeholder="New group name (e.g. Casement Windows)"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addGroup(); }}
          style={{ flex: 1 }}
        />
        <button onClick={addGroup} disabled={busy || !draftName.trim()}>+ Add</button>
      </div>
      {groups.length === 0 ? (
        <div className="text-subtle">No groups yet.</div>
      ) : (
        <table>
          <thead>
            <tr><th>Order</th><th>Name</th><th></th></tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.id}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button onClick={() => moveGroup(g.id, -1)} disabled={i === 0}>↑</button>{" "}
                  <button onClick={() => moveGroup(g.id, +1)} disabled={i === groups.length - 1}>↓</button>
                </td>
                <td>
                  <input
                    value={g.name}
                    onChange={(e) => onChange(groups.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)))}
                    onBlur={(e) => renameGroup(g.id, e.target.value)}
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <button onClick={() => removeGroup(g.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ProductEditor({ groups, product, products = [], recentSpecs = [], recentOptionGroups = [], onCancel, onSaved }) {
  const isNew = !product;
  const [draft, setDraft] = useState(() => ({
    sku: product?.sku ?? "",
    manufacturer: product?.manufacturer ?? "",
    productLine: product?.productLine ?? "",
    type: product?.type ?? "",
    groupIds: product?.groupIds ?? [],
    description: product?.description ?? "",
    specs: product?.specs ?? [],
    options: product?.options ?? [],
    notes: product?.notes ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Existing products: assume the saved SKU was user-set. New products:
  // auto-fill from manufacturer + type until the user types in SKU manually.
  const skuTouched = useRef(!isNew);

  function set(field, value) { setDraft((d) => ({ ...d, [field]: value })); }

  useEffect(() => {
    if (!isNew) return;
    if (skuTouched.current) return;
    const initial = String(draft.manufacturer ?? "").trim().charAt(0).toUpperCase();
    const typePart = typeForSku(draft.type);
    if (!initial || !typePart) return;
    const num = nextProductNumberFor(draft.manufacturer, products);
    const auto = `${initial}-${String(num).padStart(3, "0")}-${typePart}`;
    setDraft((d) => (d.sku === auto ? d : { ...d, sku: auto }));
  }, [draft.manufacturer, draft.type, products, isNew]);

  function toggleGroup(id) {
    setDraft((d) => {
      const has = d.groupIds.includes(id);
      return { ...d, groupIds: has ? d.groupIds.filter((g) => g !== id) : [...d.groupIds, id] };
    });
  }

  async function save() {
    setBusy(true); setError("");
    try {
      if (isNew) {
        const saved = await api.createCatalogProduct(draft);
        onSaved(saved, "create");
      } else {
        const saved = await api.updateCatalogProduct(product.id, draft);
        onSaved(saved, "update");
      }
    } catch (e) { setError(String(e)); setBusy(false); }
  }

  async function remove() {
    if (!confirm("Delete this product?")) return;
    setBusy(true); setError("");
    try {
      await api.deleteCatalogProduct(product.id);
      onSaved(product, "delete");
    } catch (e) { setError(String(e)); setBusy(false); }
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{isNew ? "New product" : (product.sku || "Product")}</h2>
        <div className="row" style={{ gap: 8 }}>
          <button onClick={onCancel} disabled={busy}>Cancel</button>
          {!isNew && <button onClick={remove} disabled={busy}>Delete</button>}
          <button onClick={save} disabled={busy}>{isNew ? "Create" : "Save"}</button>
        </div>
      </div>

      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Identity</h3>
        <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
          <Field label="SKU" hint="Auto: {Manufacturer initial}-{NNN}-{Type} (e.g. C-001-Fixed). Editable.">
            <input
              value={draft.sku}
              onChange={(e) => { skuTouched.current = true; set("sku", e.target.value); }}
            />
          </Field>
          <Field label="Manufacturer">
            <input value={draft.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
          </Field>
          <Field label="Product line">
            <input value={draft.productLine} onChange={(e) => set("productLine", e.target.value)} />
          </Field>
          <Field label="Type">
            <select value={draft.type} onChange={(e) => set("type", e.target.value)}>
              <option value="">— select —</option>
              {TYPES.map(([slug, label]) => <option key={slug} value={slug}>{label}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Groups</h3>
        {groups.length === 0 ? (
          <div className="text-subtle">No groups yet — create one from the catalog list.</div>
        ) : (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {groups.map((g) => (
              <button
                key={g.id}
                className={draft.groupIds.includes(g.id) ? "pill-toggle active" : "pill-toggle"}
                onClick={() => toggleGroup(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Description</h3>
        <textarea
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          rows={4}
          style={{ width: "100%" }}
          placeholder="Customer-facing description that will appear in the look-book."
        />
      </div>

      <RepeatableSpecs
        specs={draft.specs}
        onChange={(specs) => set("specs", specs)}
        suggestions={recentSpecs}
      />

      <RepeatableOptions
        options={draft.options}
        onChange={(options) => set("options", options)}
        suggestions={recentOptionGroups}
      />

      <div className="card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginTop: 0 }}>Internal notes</h3>
        <textarea
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          style={{ width: "100%" }}
          placeholder="Not shown to clients."
        />
      </div>
    </div>
  );
}

function truncate(s, n) {
  if (typeof s !== "string") return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200, flex: 1 }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span className="text-subtle" style={{ fontSize: 11 }}>{hint}</span>}
    </label>
  );
}

function RepeatableSpecs({ specs, onChange, suggestions = [] }) {
  function update(i, patch) {
    onChange(specs.map((s, j) => (i === j ? { ...s, ...patch } : s)));
  }
  function add() { onChange([...specs, { label: "", value: "" }]); }
  function remove(i) { onChange(specs.filter((_, j) => j !== i)); }

  // Hide suggestions that are already on this product (same label+value).
  const available = suggestions.filter((s) => !specs.some(
    (x) =>
      String(x.label ?? "").trim().toLowerCase() === s.label.toLowerCase() &&
      String(x.value ?? "").trim().toLowerCase() === s.value.toLowerCase()
  ));

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Specs</h3>
        <button onClick={add}>+ Spec</button>
      </div>
      <p className="text-subtle" style={{ fontSize: 12, margin: "4px 0 12px" }}>
        Display-only descriptive fields (frame material, U-value, certifications, …). Different products can have different specs.
      </p>
      {available.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span className="text-subtle" style={{ fontSize: 12 }}>Recently used:</span>
          {available.map((s, i) => (
            <button
              key={i}
              className="pill-toggle"
              onClick={() => onChange([...specs, { label: s.label, value: s.value }])}
              title={s.value ? `${s.label}: ${s.value}` : s.label}
            >
              + {s.label}{s.value ? `: ${truncate(s.value, 36)}` : ""}
            </button>
          ))}
        </div>
      )}
      {specs.length === 0 ? (
        <div className="text-subtle">No specs yet.</div>
      ) : (
        <table>
          <thead><tr><th style={{ width: "30%" }}>Label</th><th>Value</th><th></th></tr></thead>
          <tbody>
            {specs.map((s, i) => (
              <tr key={i}>
                <td><input value={s.label} onChange={(e) => update(i, { label: e.target.value })} style={{ width: "100%" }} /></td>
                <td><input value={s.value} onChange={(e) => update(i, { value: e.target.value })} style={{ width: "100%" }} /></td>
                <td style={{ textAlign: "right" }}><button onClick={() => remove(i)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RepeatableOptions({ options, onChange, suggestions = [] }) {
  function update(i, patch) {
    onChange(options.map((o, j) => (i === j ? { ...o, ...patch } : o)));
  }
  function add() { onChange([...options, { name: "", choices: [] }]); }
  function remove(i) { onChange(options.filter((_, j) => j !== i)); }

  const available = suggestions.filter((s) => !options.some((x) => {
    const sameName = String(x.name ?? "").trim().toLowerCase() === s.name.toLowerCase();
    const sameChoices = [...(x.choices ?? [])].map((c) => String(c).trim()).sort().join("|") ===
                        [...s.choices].sort().join("|");
    return sameName && sameChoices;
  }));

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Options</h3>
        <button onClick={add}>+ Option group</button>
      </div>
      <p className="text-subtle" style={{ fontSize: 12, margin: "4px 0 12px" }}>
        Selectable configurations (Screens, Grids, Glass, Color, Hardware finish…). One option group per row; comma-separate the choices.
      </p>
      {available.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          <span className="text-subtle" style={{ fontSize: 12 }}>Recently used:</span>
          {available.map((s, i) => (
            <button
              key={i}
              className="pill-toggle"
              onClick={() => onChange([...options, { name: s.name, choices: [...s.choices] }])}
              title={s.choices.join(", ")}
            >
              + {s.name || "(unnamed)"}{s.choices.length ? `: ${truncate(s.choices.join(", "), 36)}` : ""}
            </button>
          ))}
        </div>
      )}
      {options.length === 0 ? (
        <div className="text-subtle">No options yet.</div>
      ) : (
        <table>
          <thead><tr><th style={{ width: "30%" }}>Name</th><th>Choices (comma-separated)</th><th></th></tr></thead>
          <tbody>
            {options.map((o, i) => (
              <tr key={i}>
                <td>
                  <input
                    value={o.name}
                    placeholder="e.g. Screen"
                    onChange={(e) => update(i, { name: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </td>
                <td>
                  <input
                    value={(o.choices ?? []).join(", ")}
                    placeholder="None, Fiberglass, Retractable"
                    onChange={(e) => update(i, {
                      choices: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })}
                    style={{ width: "100%" }}
                  />
                </td>
                <td style={{ textAlign: "right" }}><button onClick={() => remove(i)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
