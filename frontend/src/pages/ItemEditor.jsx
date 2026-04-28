import { useState } from "react";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

const blank = {
  mark: "", quantity: 1, type: "fixed", operation: "", material: "Aluminum",
  width_in: 36, height_in: 48, width_mm: 914, height_mm: 1219,
  panels: 1, gridRows: 1, operableRow: "all", grid: false, notes: "",
};

const TYPES = [
  ["fixed", "Fixed window"],
  ["casement", "Casement window"],
  ["sliding", "Sliding window"],
  ["sliding-door", "Sliding door"],
  ["french-door", "French door"],
  ["bifold-door", "Bi-Fold door"],
  ["single-hinged-door", "Single-Hinged door"],
  ["double-hinged-door", "Double-Hinged door"],
];
const OPERABLE_ROWS = [["all", "All rows"], ["top", "Top row"], ["bottom", "Bottom row"]];
const MATERIALS = [["Aluminum", "Aluminum"], ["Iron", "Iron"], ["Wood", "Wood"]];

function totalWidth(it) {
  return Number(it.width_in ?? 0) * Math.max(1, Math.floor(Number(it.panels ?? 1)));
}

export default function ItemEditor({ items = [], onChange }) {
  const [draft, setDraft] = useState(blank);
  const [editIndex, setEditIndex] = useState(-1);
  const [editDraft, setEditDraft] = useState(null);

  function addItem(e) {
    e.preventDefault();
    if (!draft.mark) return;
    onChange([...items, { ...draft }]);
    setDraft(blank);
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

  const draftTotalW = totalWidth(draft);

  return (
    <div>
      <form onSubmit={addItem} className="row" style={{ flexWrap: "wrap", marginBottom: 8, alignItems: "flex-end" }}>
        <TextField label="Mark" value={draft.mark} onChange={(v) => set("mark", v)} />
        <NumberField label="Qty" value={draft.quantity} onChange={(v) => set("quantity", v)} />
        <SelectField label="Type" value={draft.type} onChange={(v) => set("type", v)} options={TYPES} />
        <SelectField label="Material" value={draft.material ?? "Aluminum"} onChange={(v) => set("material", v)} options={MATERIALS} />
        <TextField label="Operation (left/right)" value={draft.operation} onChange={(v) => set("operation", v)} />
        <NumberField label="Width per panel (in)" value={draft.width_in} onChange={(v) => set("width_in", v)} />
        <NumberField label="Height (in)" value={draft.height_in} onChange={(v) => set("height_in", v)} />
        <NumberField label="Panels" value={draft.panels} onChange={(v) => set("panels", v)} />
        <NumberField label="Grid rows" value={draft.gridRows} onChange={(v) => set("gridRows", v)} />
        <SelectField label="Operable row" value={draft.operableRow ?? "all"} onChange={(v) => set("operableRow", v)} options={OPERABLE_ROWS} />
        <button className="primary" type="submit">Add</button>
      </form>
      <div className="text-muted" style={{ fontSize: 12, marginBottom: 16 }}>
        Total width = per-panel width × panels. Currently: {Number(draft.width_in) || 0}" × {draft.panels || 1} = <strong>{draftTotalW}"</strong>.
        Grid rows = how many horizontal divisions to draw across the unit (1 = no grid).
      </div>

      <table>
        <thead>
          <tr>
            <th>Mark</th><th>Qty</th><th>Type</th><th>Material</th><th>Operation</th>
            <th>W/panel</th><th>Total W</th><th>H</th>
            <th>Panels</th><th>Grid</th><th>Operable</th><th>Notes</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => {
            if (i === editIndex && editDraft) {
              const editTotal = totalWidth(editDraft);
              return (
                <tr key={i} className="editing">
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
                  <td><NumberField label="" value={editDraft.gridRows} onChange={(v) => setEdit("gridRows", v)} inputStyle={{ width: 50 }} /></td>
                  <td>
                    <SelectField label="" value={editDraft.operableRow ?? "all"} onChange={(v) => setEdit("operableRow", v)} options={OPERABLE_ROWS} />
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
            return (
              <tr key={i}>
                <td>{it.mark}</td>
                <td>{it.quantity}</td>
                <td>{it.type}</td>
                <td>{it.material ?? "Aluminum"}</td>
                <td>{it.operation}</td>
                <td>{it.width_in}"</td>
                <td>{totalWidth(it)}"</td>
                <td>{it.height_in}"</td>
                <td>{it.panels}</td>
                <td>{it.gridRows ?? 1}</td>
                <td>{it.operableRow ?? "all"}</td>
                <td className="text-muted" style={{ maxWidth: 180 }}>{it.notes}</td>
                <td>
                  <div className="row">
                    <button onClick={() => startEdit(i)} disabled={editIndex >= 0 && editIndex !== i}>Edit</button>
                    <button onClick={() => removeItem(i)}>Remove</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr><td colSpan={13} className="text-subtle">No items yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
