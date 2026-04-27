import { useMemo, useState } from "react";
import { generateSketch } from "../lib/sketch.js";

export default function SketchGenerator() {
  const [spec, setSpec] = useState({
    width_in: 48, height_in: 36, panels: 2, type: "casement", operation: "",
  });
  const svg = useMemo(() => generateSketch(spec), [spec]);

  function set(key, value) { setSpec({ ...spec, [key]: value }); }

  return (
    <div>
      <h1>Sketch Generator</h1>
      <div className="row" style={{ flexWrap: "wrap", marginBottom: 20 }}>
        <label>Width" <input type="number" value={spec.width_in} onChange={(e) => set("width_in", Number(e.target.value))} /></label>
        <label>Height" <input type="number" value={spec.height_in} onChange={(e) => set("height_in", Number(e.target.value))} /></label>
        <label>Panels <input type="number" value={spec.panels} min={1} onChange={(e) => set("panels", Number(e.target.value))} /></label>
        <label>Type <select value={spec.type} onChange={(e) => set("type", e.target.value)}>
          <option value="fixed">fixed</option>
          <option value="casement">casement</option>
          <option value="sliding">sliding</option>
        </select></label>
        <label>Operation (1-panel only) <input value={spec.operation} onChange={(e) => set("operation", e.target.value)} placeholder="left / right" /></label>
      </div>
      <div className="card" style={{ display: "inline-block" }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
        Multi-panel casement uses an automatic swing layout: 2 → [L, R], 3 → [L, fixed, R], 4 → [L, L, R, R], etc. Single-panel honors the operation field.
      </div>
    </div>
  );
}
