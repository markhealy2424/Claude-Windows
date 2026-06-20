import { useEffect, useRef, useState } from "react";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";
import { compressImageToDataUrl } from "../lib/imageCompress.js";
import { generateSketch } from "../lib/sketch.js";
import { isDoor, needsSwing, swingLabel, needsLeftRightOperation } from "../lib/itemKind.js";

const blank = {
  mark: "", quantity: 1, type: "fixed", operation: "", material: "Aluminum",
  width_in: 36, height_in: 48, width_mm: 914, height_mm: 1219,
  panels: 1, gridRows: 1, gridCols: 1, operableRow: "all", notes: "",
  screen: false, sketchImage: "",
  // "in" | "out" | "" — only meaningful for casement + door types
  // (see needsSwing()).
  swing: "",
  needsAttention: false, clientQuestion: "",
};

const SWING_OPTIONS = [
  ["", "—"],
  ["in", "Swings in"],
  ["out", "Swings out"],
];

// Left / Right operation options for casement (and any future type
// that opts into needsLeftRightOperation).
const LEFT_RIGHT_OPTIONS = [
  ["", "—"],
  ["left", "Left"],
  ["right", "Right"],
];

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
const MATERIALS = [["Aluminum", "Aluminum"], ["Steel", "Steel"], ["Iron", "Iron"], ["Wood", "Wood"]];

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
  // formState: null when no modal open; { mode: "new" } for add;
  // { mode: "edit", index } when editing a row in place. Editing in a
  // modal (instead of inline) lets the read-only table stay compact —
  // ~8 columns instead of the 16 the inline-edit pattern needed.
  const [draft, setDraft] = useState(blank);
  const [formState, setFormState] = useState(null);

  useEffect(() => {
    if (!formState) return;
    function onKey(e) { if (e.key === "Escape") closeForm(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formState]);

  function openNew() {
    setDraft(blank);
    setFormState({ mode: "new" });
  }

  function openEdit(idx) {
    setDraft({ ...blank, ...items[idx] });
    setFormState({ mode: "edit", index: idx });
  }

  function closeForm() {
    setFormState(null);
    setDraft(blank);
  }

  function submitForm(e) {
    e.preventDefault();
    if (!draft.mark) return;
    if (formState?.mode === "edit") {
      onChange(items.map((it, i) => (i === formState.index ? { ...draft } : it)));
    } else {
      onChange([...items, { ...draft }]);
    }
    closeForm();
  }

  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function set(key, value) {
    setDraft({ ...draft, [key]: value });
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
        <button className="primary" onClick={openNew}>+ Add item</button>
      </div>

      <ItemTable
        items={items}
        onEdit={openEdit}
        onRemove={removeItem}
        onSketch={setSketchAt}
        onToggleAttention={toggleAttentionAt}
      />

      {formState && (
        <ItemFormModal
          mode={formState.mode}
          draft={draft}
          set={set}
          setDraft={setDraft}
          onSubmit={submitForm}
          onClose={closeForm}
        />
      )}
    </div>
  );
}

function ItemFormModal({ mode, draft, set, setDraft, onSubmit, onClose }) {
  const draftTotalW = totalWidth(draft);
  const isEdit = mode === "edit";
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" style={{ maxWidth: 760 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 style={{ margin: 0 }}>{isEdit ? "Edit item" : "New item"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
            <TextField label="Mark" value={draft.mark} onChange={(v) => set("mark", v)} />
            <NumberField label="Qty" value={draft.quantity} onChange={(v) => set("quantity", v)} />
            <SelectField label="Type" value={draft.type} onChange={(v) => set("type", v)} options={TYPES} />
            <SelectField label="Material" value={draft.material ?? "Aluminum"} onChange={(v) => set("material", v)} options={MATERIALS} />
            {needsLeftRightOperation(draft.type) ? (
              <SelectField
                label="Operation"
                value={draft.operation ?? ""}
                onChange={(v) => set("operation", v)}
                options={LEFT_RIGHT_OPTIONS}
              />
            ) : (
              <TextField label="Operation (left/right)" value={draft.operation} onChange={(v) => set("operation", v)} />
            )}
            {needsSwing(draft.type) && (
              <SelectField
                label="Swing direction"
                value={draft.swing ?? ""}
                onChange={(v) => set("swing", v)}
                options={SWING_OPTIONS}
              />
            )}
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
            <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
              <span style={{ color: "var(--color-text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Flag</span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, paddingTop: 6 }}>
                <input
                  type="checkbox"
                  checked={!!draft.needsAttention}
                  onChange={(e) => set("needsAttention", e.target.checked)}
                />
                <span style={{ fontSize: 12 }}>Needs attention</span>
              </label>
            </label>
          </div>

          <div className="text-muted" style={{ fontSize: 12, marginBottom: 16, lineHeight: 1.5 }}>
            Total width = per-panel × panels. Currently {Number(draft.width_in) || 0}" × {draft.panels || 1} = <strong>{draftTotalW}"</strong>.
            Grid is <strong>cols × rows</strong> of divided lites per panel (<code>2x4</code> = 2 muntin columns, 4 muntin rows; <code>1x1</code> = no grid).
          </div>

          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button className="primary" type="submit" disabled={!draft.mark}>{isEdit ? "Save changes" : "Add item"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TABLE_COLSPAN = 7;

function ItemTable({ items, onEdit, onRemove, onSketch, onToggleAttention }) {
  // Carry the original index alongside each item so edits, removals, and
  // sketch uploads still mutate the correct slot in the canonical array.
  const indexed = items.map((it, i) => [it, i]);
  const windowEntries = indexed.filter(([it]) => !isDoor(it));
  const doorEntries = indexed.filter(([it]) => isDoor(it));

  const renderRow = ([it, i]) => {
    const total = totalWidth(it);
    const grid = gridToString(it);
    const opLabel = [
      it.operation,
      it.operableRow && it.operableRow !== "all" ? `${it.operableRow} row` : null,
      swingLabel(it),
    ]
      .filter(Boolean)
      .join(" · ");
    const rowStyle = it.needsAttention ? { background: "var(--color-highlight-soft)" } : undefined;
    return (
      <tr key={i} style={rowStyle}>
        <td className="nowrap">
          {it.needsAttention && <span title="Needs attention" style={{ color: "var(--color-warning)", marginRight: 4 }}>⚠</span>}
          <strong>{it.mark}</strong>
          {" "}<span className="text-subtle" style={{ fontSize: 11 }}>· {it.quantity}</span>
        </td>
        <td>
          <div>{it.type}</div>
          {opLabel && (
            <div className="text-subtle" style={{ fontSize: 11, marginTop: 2 }}>{opLabel}</div>
          )}
        </td>
        <td>
          <div>{it.material ?? "Aluminum"}</div>
          {it.screen && (
            <div className="text-subtle" style={{ fontSize: 11, marginTop: 2 }}>+ screen</div>
          )}
        </td>
        <td className="nowrap">
          <div>{it.width_in}" × {it.height_in}"</div>
          <div className="text-subtle" style={{ fontSize: 11, marginTop: 2 }}>
            {it.panels} panel{Number(it.panels) === 1 ? "" : "s"}
            {total !== Number(it.width_in) && <> · {total}" total</>}
            {grid && grid !== "1x1" && <> · {grid} grid</>}
          </div>
        </td>
        <td>
          <SketchDrop
            value={it.sketchImage || ""}
            item={it}
            onChange={(dataUrl) => onSketch(i, dataUrl)}
          />
        </td>
        <td className="text-muted" style={{ maxWidth: 220 }}>{it.notes}</td>
        <td className="nowrap">
          <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
            <button
              onClick={() => onToggleAttention(i, !it.needsAttention)}
              title={it.needsAttention ? "Clear attention flag" : "Flag for attention"}
              style={{ padding: "4px 8px", color: it.needsAttention ? "var(--color-warning)" : "var(--color-text-muted)" }}
            >⚠</button>
            <button onClick={() => onEdit(i)}>Edit</button>
            <button onClick={() => onRemove(i)}>Remove</button>
          </div>
        </td>
      </tr>
    );
  };

  const sectionHeader = (label, count) => (
    <tr className="section-header">
      <td colSpan={TABLE_COLSPAN} style={{ background: "var(--color-surface-alt)", fontWeight: 600, padding: "6px 10px", borderTop: "1px solid var(--color-border)" }}>
        {label} <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>({count})</span>
      </td>
    </tr>
  );

  return (
    <div className="table-scroll">
      <table className="compact">
        <thead>
          <tr>
            <th>Mark · Qty</th>
            <th>Type</th>
            <th>Material</th>
            <th>Size</th>
            <th>Sketch</th>
            <th>Notes</th>
            <th></th>
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
    </div>
  );
}
