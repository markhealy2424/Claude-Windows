import { useEffect, useRef, useState } from "react";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";
import { compressImageToDataUrl } from "../lib/imageCompress.js";
import { generateSketch } from "../lib/sketch.js";
import { isDoor } from "../lib/itemKind.js";

const blank = {
  mark: "", quantity: 1, type: "fixed", operation: "", material: "Aluminum",
  width_in: 36, height_in: 48, width_mm: 914, height_mm: 1219,
  panels: 1, gridRows: 1, gridCols: 1, operableRow: "all", notes: "",
  screen: false, sketchImage: "",
  needsAttention: false, clientQuestion: "",
};

// "ColsxRows" — e.g. "2x4" = 2 lite columns, 4 lite rows.
function gridToString(item) {
  const c = Math.max(1, Math.floor(Number(item?.gridCols ?? 1)));
  const r = Math.max(1, Math.floor(Number(item?.gridRows ?? 1)));
  return `${c}x${r}`;
}

function parseGridString(str) {
  const m = /^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i.exec(String(str ?? ""));
  if (!m) return null;
  return { gridCols: Math.max(1, parseInt(m[1], 10)), gridRows: Math.max(1, parseInt(m[2], 10)) };
}

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
const OPERABLE_ROWS = [["all", "All rows"], ["top", "Top row"], ["bottom", "Bottom row"]];
const MATERIALS = [["Aluminum", "Aluminum"], ["Iron", "Iron"], ["Wood", "Wood"]];

const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

function totalWidth(it) {
  return Number(it.width_in ?? 0) * Math.max(1, Math.floor(Number(it.panels ?? 1)));
}

function SketchDrop({ value, item, onChange, height = 56 }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFile(file) {
    if (!file || !file.type?.startsWith("image/")) return;
    setBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      onChange(dataUrl);
    } catch (err) {
      console.error("Sketch upload failed:", err);
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  }

  function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) handleFile(file);
  }

  function clear(e) {
    e.stopPropagation();
    onChange("");
  }

  // Custom screenshot uploaded — show it with an × to revert.
  if (value) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        style={{
          position: "relative", width: 80, height,
          border: `1px solid ${over ? "#444" : "#ddd"}`,
          borderRadius: 4, overflow: "hidden", background: "var(--color-surface)",
        }}
        title="Drop a new image to replace"
      >
        <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        <button
          type="button"
          onClick={clear}
          title="Remove custom sketch (revert to auto-generated)"
          style={{
            position: "absolute", top: 1, right: 1,
            padding: "0 5px", fontSize: 11, lineHeight: "16px",
            background: "rgba(255,255,255,0.85)", border: "1px solid #bbb",
            borderRadius: 3, cursor: "pointer",
          }}
        >×</button>
      </div>
    );
  }

  // No upload — render the auto-generated SVG sketch (same one used in the
  // proposal PDF) and overlay an upload affordance so dropping an image
  // replaces it. Click to open the file picker.
  const autoSvg = item ? generateSketch(item) : "";

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      style={{
        position: "relative",
        width: 80, height,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px ${over ? "dashed" : "solid"} ${over ? "#444" : "#ddd"}`,
        borderRadius: 4,
        background: over ? "var(--color-surface-hover)" : "var(--color-surface)",
        cursor: "pointer", overflow: "hidden",
      }}
      title="Auto-generated sketch — drop an image or click to replace"
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={onPick}
        style={{ display: "none" }}
      />
      {autoSvg && !over && !busy && (
        <div
          style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}
          dangerouslySetInnerHTML={{ __html: autoSvg }}
        />
      )}
      {(over || busy) && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#444", background: "rgba(243,243,243,0.85)" }}>
          {busy ? "…" : "Drop"}
        </div>
      )}
    </div>
  );
}

export default function ItemEditor({ items = [], onChange }) {
  const [draft, setDraft] = useState(blank);
  const [editIndex, setEditIndex] = useState(-1);
  const [editDraft, setEditDraft] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  // Close the add-item modal on Escape, mirroring the Dashboard new-project
  // modal so the keyboard contract is consistent across the app.
  useEffect(() => {
    if (!showAdd) return;
    function onKey(e) { if (e.key === "Escape") setShowAdd(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAdd]);

  function addItem(e) {
    e.preventDefault();
    if (!draft.mark) return;
    onChange([...items, { ...draft }]);
    setDraft(blank);
    setShowAdd(false);
  }

  function removeItem(idx) {
    if (editIndex === idx) { setEditIndex(-1); setEditDraft(null); }
    onChange(items.filter((_, i) => i !== idx));
  }

  function startEdit(idx) {
    setEditIndex(idx);
    setEditDraft({ ...blank, ...items[idx] });
  }

  function cancelEdit() {
    setEditIndex(-1);
    setEditDraft(null);
  }

  function saveEdit() {
    if (editIndex < 0 || !editDraft) return;
    if (!editDraft.mark) return;
    onChange(items.map((it, i) => (i === editIndex ? { ...editDraft } : it)));
    setEditIndex(-1);
    setEditDraft(null);
  }

  function set(key, value) {
    setDraft({ ...draft, [key]: value });
  }

  function setEdit(key, value) {
    setEditDraft({ ...editDraft, [key]: value });
  }

  // Allow drag-drop / click-upload directly on a non-editing row so users
  // can attach a sketch without opening the row's edit form.
  function setSketchAt(idx, dataUrl) {
    onChange(items.map((it, i) => (i === idx ? { ...it, sketchImage: dataUrl } : it)));
  }

  // Toggle "needs special attention" inline without entering edit mode.
  function toggleAttentionAt(idx, value) {
    onChange(items.map((it, i) => (i === idx ? { ...it, needsAttention: value } : it)));
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="primary" onClick={() => setShowAdd(true)}>+ Add item</button>
      </div>

      <ItemTable
        items={items}
        editIndex={editIndex}
        editDraft={editDraft}
        setEditDraft={setEditDraft}
        setEdit={setEdit}
        startEdit={startEdit}
        cancelEdit={cancelEdit}
        saveEdit={saveEdit}
        removeItem={removeItem}
        setSketchAt={setSketchAt}
        toggleAttentionAt={toggleAttentionAt}
      />

      {showAdd && (
        <NewItemModal
          draft={draft}
          set={set}
          setDraft={setDraft}
          onSubmit={addItem}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function NewItemModal({ draft, set, setDraft, onSubmit, onClose }) {
  const draftTotalW = totalWidth(draft);
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 style={{ margin: 0 }}>New item</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <TextField label="Mark" value={draft.mark} onChange={(v) => set("mark", v)} />
            <NumberField label="Qty" value={draft.quantity} onChange={(v) => set("quantity", v)} />
            <SelectField label="Type" value={draft.type} onChange={(v) => set("type", v)} options={TYPES} />
            <SelectField label="Material" value={draft.material ?? "Aluminum"} onChange={(v) => set("material", v)} options={MATERIALS} />
            <TextField label="Operation (left/right)" value={draft.operation} onChange={(v) => set("operation", v)} />
            <NumberField label="Width per panel (in)" value={draft.width_in} onChange={(v) => set("width_in", v)} />
            <NumberField label="Height (in)" value={draft.height_in} onChange={(v) => set("height_in", v)} />
            <NumberField label="Panels" value={draft.panels} onChange={(v) => set("panels", v)} />
            <TextField
              label="Grid (CxR)"
              value={gridToString(draft)}
              onChange={(v) => {
                const g = parseGridString(v);
                if (g) setDraft({ ...draft, ...g });
              }}
              inputStyle={{ width: 70 }}
            />
            <SelectField label="Operable row" value={draft.operableRow ?? "all"} onChange={(v) => set("operableRow", v)} options={OPERABLE_ROWS} />
            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
              <span style={{ color: "var(--color-text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Screen</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, paddingTop: 6 }}>
                <input
                  type="checkbox"
                  checked={!!draft.screen}
                  onChange={(e) => set("screen", e.target.checked)}
                />
                <span style={{ fontSize: 12 }}>Has screen</span>
              </label>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
              <span style={{ color: "var(--color-text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Sketch image</span>
              <SketchDrop
                value={draft.sketchImage || ""}
                item={draft}
                onChange={(dataUrl) => set("sketchImage", dataUrl)}
              />
            </label>
          </div>

          <div className="text-muted" style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
            Total width = per-panel × panels. Currently {Number(draft.width_in) || 0}" × {draft.panels || 1} = <strong>{draftTotalW}"</strong>.
            Grid is <strong>cols × rows</strong> of divided lites per panel (<code>2x4</code> = 2 muntin columns, 4 muntin rows; <code>1x1</code> = no grid).
          </div>

          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary" type="submit" disabled={!draft.mark}>Add item</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TABLE_COLSPAN = 16;

function ItemTable({
  items,
  editIndex, editDraft, setEditDraft, setEdit,
  startEdit, cancelEdit, saveEdit, removeItem, setSketchAt, toggleAttentionAt,
}) {
  // Carry the original index alongside each item so edits, removals, and
  // sketch uploads still mutate the correct slot in the canonical array.
  const indexed = items.map((it, i) => [it, i]);
  const windowEntries = indexed.filter(([it]) => !isDoor(it));
  const doorEntries = indexed.filter(([it]) => isDoor(it));

  const renderRow = ([it, i]) => {
    if (i === editIndex && editDraft) {
      const editTotal = totalWidth(editDraft);
      const editRowStyle = editDraft.needsAttention ? { background: "var(--color-highlight-soft)" } : undefined;
      return (
        <tr key={i} className="editing" style={editRowStyle}>
          <td style={{ textAlign: "center" }}>
            <input
              type="checkbox"
              checked={!!editDraft.needsAttention}
              onChange={(e) => setEdit("needsAttention", e.target.checked)}
              title="Flag this item as needing special attention"
            />
          </td>
          <td><TextField label="" value={editDraft.mark} onChange={(v) => setEdit("mark", v)} inputStyle={{ width: 60 }} /></td>
          <td><NumberField label="" value={editDraft.quantity} onChange={(v) => setEdit("quantity", v)} inputStyle={{ width: 50 }} /></td>
          <td>
            <SelectField label="" value={editDraft.type} onChange={(v) => setEdit("type", v)} options={TYPES} />
          </td>
          <td>
            <SelectField label="" value={editDraft.material ?? "Aluminum"} onChange={(v) => setEdit("material", v)} options={MATERIALS} />
          </td>
          <td><TextField label="" value={editDraft.operation} onChange={(v) => setEdit("operation", v)} inputStyle={{ width: 80 }} /></td>
          <td><NumberField label="" value={editDraft.width_in} onChange={(v) => setEdit("width_in", v)} inputStyle={{ width: 60 }} /></td>
          <td className="text-muted">{editTotal}"</td>
          <td><NumberField label="" value={editDraft.height_in} onChange={(v) => setEdit("height_in", v)} inputStyle={{ width: 60 }} /></td>
          <td><NumberField label="" value={editDraft.panels} onChange={(v) => setEdit("panels", v)} inputStyle={{ width: 50 }} /></td>
          <td>
            <TextField
              label=""
              value={gridToString(editDraft)}
              onChange={(v) => {
                const g = parseGridString(v);
                if (g) setEditDraft({ ...editDraft, ...g });
              }}
              inputStyle={{ width: 50 }}
            />
          </td>
          <td>
            <SelectField label="" value={editDraft.operableRow ?? "all"} onChange={(v) => setEdit("operableRow", v)} options={OPERABLE_ROWS} />
          </td>
          <td style={{ textAlign: "center" }}>
            <input
              type="checkbox"
              checked={!!editDraft.screen}
              onChange={(e) => setEdit("screen", e.target.checked)}
              title="Has screen"
            />
          </td>
          <td>
            <SketchDrop
              value={editDraft.sketchImage || ""}
              item={editDraft}
              onChange={(dataUrl) => setEdit("sketchImage", dataUrl)}
            />
          </td>
          <td><TextField label="" value={editDraft.notes} onChange={(v) => setEdit("notes", v)} inputStyle={{ width: 120 }} /></td>
          <td>
            <div className="row">
              <button className="primary" onClick={saveEdit} disabled={!editDraft.mark} type="button">Save</button>
              <button onClick={cancelEdit} type="button">Cancel</button>
            </div>
          </td>
        </tr>
      );
    }
    const rowStyle = it.needsAttention ? { background: "var(--color-highlight-soft)" } : undefined;
    return (
      <tr key={i} style={rowStyle}>
        <td style={{ textAlign: "center" }}>
          <input
            type="checkbox"
            checked={!!it.needsAttention}
            onChange={(e) => toggleAttentionAt(i, e.target.checked)}
            title="Flag this item as needing special attention"
          />
        </td>
        <td>{it.mark}</td>
        <td>{it.quantity}</td>
        <td>{it.type}</td>
        <td>{it.material ?? "Aluminum"}</td>
        <td>{it.operation}</td>
        <td>{it.width_in}"</td>
        <td>{totalWidth(it)}"</td>
        <td>{it.height_in}"</td>
        <td>{it.panels}</td>
        <td>{gridToString(it)}</td>
        <td>{it.operableRow ?? "all"}</td>
        <td style={{ textAlign: "center" }}>
          {it.screen ? "✓" : <span className="text-subtle">—</span>}
        </td>
        <td>
          <SketchDrop
            value={it.sketchImage || ""}
            item={it}
            onChange={(dataUrl) => setSketchAt(i, dataUrl)}
          />
        </td>
        <td className="text-muted" style={{ maxWidth: 180 }}>{it.notes}</td>
        <td>
          <div className="row">
            <button onClick={() => startEdit(i)} disabled={editIndex >= 0 && editIndex !== i}>Edit</button>
            <button onClick={() => removeItem(i)}>Remove</button>
          </div>
        </td>
      </tr>
    );
  };

  const sectionHeader = (label, count) => (
    <tr className="section-header">
      <td colSpan={TABLE_COLSPAN} style={{ background: "var(--color-surface-alt)", fontWeight: 600, padding: "6px 8px", borderTop: "1px solid var(--color-border)" }}>
        {label} <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>({count})</span>
      </td>
    </tr>
  );

  return (
    <table>
      <thead>
        <tr>
          <th title="Needs special attention">⚠</th>
          <th>Mark</th><th>Qty</th><th>Type</th><th>Material</th><th>Operation</th>
          <th>W/panel</th><th>Total W</th><th>H</th>
          <th>Panels</th><th>Grid</th><th>Operable</th><th>Screen</th><th>Sketch</th><th>Notes</th><th></th>
        </tr>
      </thead>
      <tbody>
        {sectionHeader("Windows", windowEntries.length)}
        {windowEntries.length === 0 ? (
          <tr><td colSpan={TABLE_COLSPAN} className="text-subtle">No windows yet.</td></tr>
        ) : (
          windowEntries.map(renderRow)
        )}
        {sectionHeader("Doors", doorEntries.length)}
        {doorEntries.length === 0 ? (
          <tr><td colSpan={TABLE_COLSPAN} className="text-subtle">No doors yet.</td></tr>
        ) : (
          doorEntries.map(renderRow)
        )}
      </tbody>
    </table>
  );
}
