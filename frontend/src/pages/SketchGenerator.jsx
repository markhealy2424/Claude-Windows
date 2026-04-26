import { useMemo, useState } from "react";

function buildSketch({ width_in, height_in, panels, type, operation }) {
  const w = 300;
  const h = Math.max(120, Math.round((height_in / Math.max(width_in, 1)) * w));
  const panelW = w / Math.max(panels, 1);
  const dividers = [];
  for (let i = 1; i < panels; i++) {
    const x = i * panelW;
    dividers.push(<line key={i} x1={x} y1={0} x2={x} y2={h} stroke="black" strokeWidth={1} />);
  }
  let glyph = null;
  if (type === "casement") {
    const right = operation.toLowerCase().includes("right");
    glyph = right ? (
      <>
        <line x1={w} y1={0} x2={0} y2={h / 2} stroke="black" strokeDasharray="4 3" />
        <line x1={w} y1={h} x2={0} y2={h / 2} stroke="black" strokeDasharray="4 3" />
      </>
    ) : (
      <>
        <line x1={0} y1={0} x2={w} y2={h / 2} stroke="black" strokeDasharray="4 3" />
        <line x1={0} y1={h} x2={w} y2={h / 2} stroke="black" strokeDasharray="4 3" />
      </>
    );
  } else if (type === "sliding") {
    glyph = <line x1={20} y1={h / 2} x2={w - 20} y2={h / 2} stroke="black" markerEnd="url(#arr)" />;
  }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 Z" fill="black" />
        </marker>
      </defs>
      <rect x={0.5} y={0.5} width={w - 1} height={h - 1} fill="white" stroke="black" strokeWidth={2} />
      {dividers}
      {glyph}
    </svg>
  );
}

export default function SketchGenerator() {
  const [spec, setSpec] = useState({ width_in: 48, height_in: 36, panels: 2, type: "sliding", operation: "" });
  const sketch = useMemo(() => buildSketch(spec), [spec]);

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
        <label>Operation <input value={spec.operation} onChange={(e) => set("operation", e.target.value)} placeholder="left / right" /></label>
      </div>
      <div className="card" style={{ display: "inline-block" }}>{sketch}</div>
    </div>
  );
}
