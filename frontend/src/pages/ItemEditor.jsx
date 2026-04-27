import { useState } from "react";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

const blank = {
  mark: "", quantity: 1, type: "fixed", operation: "",
  width_in: 36, height_in: 48, width_mm: 914, height_mm: 1219,
  panels: 1, grid: false, notes: "",
};

const TYPES = [["fixed", "fixed"], ["casement", "casement"], ["sliding", "sliding"]];

export default function ItemEditor({ items = [], onChange }) {
  const [draft, setDraft] = useState(blank);

  function addItem(e) {
    e.preventDefault();
    if (!draft.mark) return;
    onChange([...items, { ...draft }]);
    setDraft(blank);
  }

  function removeItem(idx) {
    onChange(items.filter((_, i) => i !== idx));
  }

  function set(key, value) {
    setDraft({ ...draft, [key]: value });
  }

  return (
    <div>
      <form onSubmit={addItem} className="row" style={{ flexWrap: "wrap", marginBottom: 16, alignItems: "flex-end" }}>
        <TextField label="Mark" value={draft.mark} onChange={(v) => set("mark", v)} />
        <NumberField label="Qty" value={draft.quantity} onChange={(v) => set("quantity", v)} />
        <SelectField label="Type" value={draft.type} onChange={(v) => set("type", v)} options={TYPES} />
        <TextField label="Operation (left/right)" value={draft.operation} onChange={(v) => set("operation", v)} />
        <NumberField label="Width (in)" value={draft.width_in} onChange={(v) => set("width_in", v)} />
        <NumberField label="Height (in)" value={draft.height_in} onChange={(v) => set("height_in", v)} />
        <NumberField label="Panels" value={draft.panels} onChange={(v) => set("panels", v)} />
        <button className="primary" type="submit">Add</button>
      </form>
      <table>
        <thead>
          <tr><th>Mark</th><th>Qty</th><th>Type</th><th>Operation</th><th>W</th><th>H</th><th>Panels</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td>{it.mark}</td><td>{it.quantity}</td><td>{it.type}</td><td>{it.operation}</td>
              <td>{it.width_in}</td><td>{it.height_in}</td><td>{it.panels}</td>
              <td><button onClick={() => removeItem(i)}>Remove</button></td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><td colSpan={8} style={{ color: "#888" }}>No items yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
