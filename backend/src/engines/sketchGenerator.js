// Minimal SVG sketch. Real version handles casement hinges, slider arrows, mulled frames.
export function generateSketch({ width_in, height_in, panels = 1, type = "fixed", operation = "" }) {
  const w = 200;
  const h = Math.max(80, Math.round((height_in / Math.max(width_in, 1)) * w));
  const panelW = w / Math.max(panels, 1);

  const dividers = [];
  for (let i = 1; i < panels; i++) {
    const x = i * panelW;
    dividers.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="black" stroke-width="1"/>`);
  }

  let glyph = "";
  if (type === "casement") {
    const dir = operation.toLowerCase().includes("right") ? "right" : "left";
    glyph =
      dir === "right"
        ? `<line x1="${w}" y1="0" x2="0" y2="${h / 2}" stroke="black" stroke-dasharray="4 3"/>` +
          `<line x1="${w}" y1="${h}" x2="0" y2="${h / 2}" stroke="black" stroke-dasharray="4 3"/>`
        : `<line x1="0" y1="0" x2="${w}" y2="${h / 2}" stroke="black" stroke-dasharray="4 3"/>` +
          `<line x1="0" y1="${h}" x2="${w}" y2="${h / 2}" stroke="black" stroke-dasharray="4 3"/>`;
  } else if (type === "sliding") {
    glyph = `<line x1="20" y1="${h / 2}" x2="${w - 20}" y2="${h / 2}" stroke="black" marker-end="url(#arr)"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="black"/></marker></defs>
    <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="white" stroke="black" stroke-width="2"/>
    ${dividers.join("")}
    ${glyph}
  </svg>`;
}
