import { useMemo, useState } from "react";
import { generateSketch } from "../lib/sketch.js";
import { NumberField, TextField, SelectField } from "../lib/Fields.jsx";

export default function SketchGenerator() {
  const [spec, setSpec] = useState({
    width_in: 48, height_in: 36, panels: 2, type: "casement", operation: "",
  });
  const svg = useMemo(() => generateSketch(spec), [spec]);

  function set(key, value) { setSpec({ ...spec, [key]: value }); }

  return (
    <div>
      <h1>Sketch Generator</h1>
      <div className="row" style={{ flexWrap: "wrap", marginBottom: 20, alignItems: "flex-end" }}>
        <NumberField label="Width (in)" value={spec.width_in} onChange={(v) => set("width_in", v)} />
        <NumberField label="Height (in)" value={spec.height_in} onChange={(v) => set("height_in", v)} />
        <NumberField label="Panels" value={spec.panels} onChange={(v) => set("panels", v)} min={1} />
        <SelectField
          label="Type"
          value={spec.type}
          onChange={(v) => set("type", v)}
          options={[["fixed", "fixed"], ["casement", "casement"], ["sliding", "sliding"]]}
        />
        <TextField label="Operation (1-panel only)" value={spec.operation} onChange={(v) => set("operation", v)} />
      </div>
      <div className="card" style={{ display: "inline-block" }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
        Multi-panel casement uses an automatic swing layout: 2 → [L, R], 3 → [L, fixed, R], 4 → [L, L, R, R], etc. Single-panel honors the operation field.
      </div>
    </div>
  );
}
