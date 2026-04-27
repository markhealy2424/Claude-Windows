import { useMemo, useState } from "react";
import { generateSketch } from "../lib/sketch.js";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

export default function SketchGenerator() {
  const [spec, setSpec] = useState({
    width_in: 36, height_in: 120, panels: 3, gridRows: 2, type: "fixed", operation: "",
  });
  const svg = useMemo(() => generateSketch(spec), [spec]);
  const totalW = Number(spec.width_in ?? 0) * Math.max(1, Math.floor(Number(spec.panels ?? 1)));

  function set(key, value) { setSpec({ ...spec, [key]: value }); }

  return (
    <div>
      <h1>Sketch Generator</h1>
      <div className="row" style={{ flexWrap: "wrap", marginBottom: 8, alignItems: "flex-end" }}>
        <NumberField label="Width per panel (in)" value={spec.width_in} onChange={(v) => set("width_in", v)} />
        <NumberField label="Height (in)" value={spec.height_in} onChange={(v) => set("height_in", v)} />
        <NumberField label="Panels" value={spec.panels} onChange={(v) => set("panels", v)} min={1} />
        <NumberField label="Grid rows" value={spec.gridRows} onChange={(v) => set("gridRows", v)} min={1} />
        <SelectField
          label="Type"
          value={spec.type}
          onChange={(v) => set("type", v)}
          options={[["fixed", "fixed"], ["casement", "casement"], ["sliding", "sliding"]]}
        />
        <TextField label="Operation" value={spec.operation} onChange={(v) => set("operation", v)} />
      </div>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 16 }}>
        Total width = per-panel × panels = <strong>{totalW}"</strong>. Grid rows draws (rows − 1) horizontal lines evenly across the unit.
      </div>
      <div className="card" style={{ display: "inline-block" }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ marginTop: 12, color: "#666", fontSize: 12, maxWidth: 540 }}>
        Default multi-panel casement layout (matches typical Casement/Picture/.../Picture/Casement units):
        <ul style={{ margin: "4px 0 4px 18px", padding: 0 }}>
          <li>2 panels → [L, R] — twin casement</li>
          <li>3 panels → [L, picture, R]</li>
          <li>4 panels → [L, picture, picture, R]</li>
          <li>N panels → outer two casement, middle panels picture</li>
        </ul>
        Override via Operation:
        <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
          <li><code>all</code> — every panel casement (e.g. 4 → [L, L, R, R])</li>
          <li><code>L,F,F,R</code> — explicit per-panel list (L=left, R=right, F=fixed)</li>
          <li>For single-panel: <code>left</code> or <code>right</code></li>
        </ul>
      </div>
    </div>
  );
}
