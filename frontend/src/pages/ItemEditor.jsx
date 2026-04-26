import { useState } from "react";

const blank = {
  mark: "", quantity: 1, type: "fixed", operation: "",
  width_in: 36, height_in: 48, width_mm: 914, height_mm: 1219,
  panels: 1, grid: false, notes: "",
};

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

  function field(name, type = "text") {
    return (
      <input
        type={type}
        value={draft[name]}
        onChange={(e) => setDraft({ ...draft, [name]: type === "number" ? Number(e.target.value) : e.target.value })}
        placeholder={name}
      />
    );
  }

  return (
    <div>
      <form onSubmit={addItem} className="row" style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {field("mark")}
        {field("quantity", "number")}
        <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
          <option value="fixed">fixed</option>
          <option value="casement">casement</option>
          <option value="sliding">sliding</option>
        </select>
        <input value={draft.operation} onChange={(e) => setDraft({ ...draft, operation: e.target.value })} placeholder="operation (left/right)" />
        {field("width_in", "number")}
        {field("height_in", "number")}
        {field("panels", "number")}
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
