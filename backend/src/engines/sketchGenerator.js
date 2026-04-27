// SVG sketch with width/height labels and per-panel casement swing direction.
//
// Width semantics:
//   `width_in` is the width of ONE panel. Total displayed width = width_in × panels.
//   For 1-panel items this still works (× 1).
//
// Casement panel layout defaults (matches typical Casement/Picture/.../Picture/Casement units):
//   1 panel:  honors `operation` ("left" or "right")
//   2 panels: [L, R]                       — twin casement, both swing outward
//   3 panels: [L, picture, R]              — Casement / Picture / Casement
//   N panels: outer two casement, all middle panels picture/fixed
// Override via `operation`:
//   "all"           → every panel casement, paired hinges (e.g. 4 → [L, L, R, R])
//   "L,F,F,R"       → explicit per-panel list (L=left, R=right, F/P=fixed/picture)
//
// Grids:
//   `gridRows` (default 1) draws (gridRows - 1) horizontal grid lines spanning the
//   full frame, dividing it into evenly-spaced rows.

function formatInches(n) {
  if (n == null || Number.isNaN(Number(n))) return "?";
  const v = Number(n);
  if (v >= 12) {
    const ft = Math.floor(v / 12);
    const inchPart = Math.round((v - ft * 12) * 100) / 100;
    if (inchPart === 0) return `${ft}'-0"`;
    return `${ft}'-${inchPart}"`;
  }
  return `${v}"`;
}

function panelDirections(panels, type, operation = "") {
  const n = Math.max(1, Math.floor(panels));
  if (type !== "casement") return new Array(n).fill(null);

  const op = (operation || "").toLowerCase();

  if (n === 1) {
    return [op.includes("right") ? "right" : "left"];
  }

  if (op.includes(",")) {
    const parts = op.split(",").map((s) => s.trim());
    const dirs = [];
    for (let i = 0; i < n; i++) {
      const p = parts[i] ?? "";
      if (p.startsWith("l")) dirs.push("left");
      else if (p.startsWith("r")) dirs.push("right");
      else dirs.push("fixed");
    }
    return dirs;
  }

  if (n === 2) return ["left", "right"];

  if (op.includes("all")) {
    const half = Math.floor(n / 2);
    const middle = n % 2;
    return [
      ...Array(half).fill("left"),
      ...Array(middle).fill("fixed"),
      ...Array(half).fill("right"),
    ];
  }

  const dirs = new Array(n).fill("fixed");
  dirs[0] = "left";
  dirs[n - 1] = "right";
  return dirs;
}

export function generateSketch({ width_in, height_in, panels = 1, type = "fixed", operation = "", gridRows = 1 }) {
  const n = Math.max(1, Math.floor(panels));
  const totalWidth = Number(width_in ?? 0) * n;

  const frameW = 240;
  const aspect = Number(height_in) / Math.max(totalWidth, 1);
  const frameH = Math.max(80, Math.round(frameW * (Number.isFinite(aspect) && aspect > 0 ? aspect : 0.6)));
  const leftPad = 36, topPad = 22, rightPad = 12, bottomPad = 14;
  const W = leftPad + frameW + rightPad;
  const H = topPad + frameH + bottomPad;

  const panelW = frameW / n;
  const dirs = panelDirections(n, type, operation);

  const dividers = [];
  for (let i = 1; i < n; i++) {
    const x = leftPad + i * panelW;
    dividers.push(
      `<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + frameH}" stroke="black" stroke-width="1.5"/>`
    );
  }

  const gR = Math.max(1, Math.floor(gridRows));
  const gridLines = [];
  for (let i = 1; i < gR; i++) {
    const y = topPad + (frameH * i) / gR;
    gridLines.push(
      `<line x1="${leftPad}" y1="${y}" x2="${leftPad + frameW}" y2="${y}" stroke="black" stroke-width="1"/>`
    );
  }

  // Per-panel casement glyph: V whose apex sits on the SWING (handle) side.
  const glyphs = [];
  for (let i = 0; i < n; i++) {
    const px = leftPad + i * panelW;
    const py = topPad;
    const inset = 3;
    const cy = py + frameH / 2;
    const dir = dirs[i];
    if (dir === "right") {
      glyphs.push(
        `<line x1="${px + inset}" y1="${py + inset}" x2="${px + panelW - inset}" y2="${cy}" stroke="black" stroke-dasharray="4 3"/>` +
        `<line x1="${px + inset}" y1="${py + frameH - inset}" x2="${px + panelW - inset}" y2="${cy}" stroke="black" stroke-dasharray="4 3"/>`
      );
    } else if (dir === "left") {
      glyphs.push(
        `<line x1="${px + panelW - inset}" y1="${py + inset}" x2="${px + inset}" y2="${cy}" stroke="black" stroke-dasharray="4 3"/>` +
        `<line x1="${px + panelW - inset}" y1="${py + frameH - inset}" x2="${px + inset}" y2="${cy}" stroke="black" stroke-dasharray="4 3"/>`
      );
    }
  }

  let slidingArrow = "";
  if (type === "sliding") {
    const arrY = topPad + frameH / 2;
    slidingArrow =
      `<line x1="${leftPad + 14}" y1="${arrY}" x2="${leftPad + frameW - 14}" y2="${arrY}" stroke="black" marker-end="url(#arr)"/>`;
  }

  const widthLabel =
    `<text x="${leftPad + frameW / 2}" y="${topPad - 6}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#111">${formatInches(totalWidth)}</text>`;
  const hCenter = topPad + frameH / 2;
  const heightLabel =
    `<text x="${leftPad - 10}" y="${hCenter + 4}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#111" transform="rotate(-90 ${leftPad - 10} ${hCenter})">${formatInches(height_in)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="black"/></marker></defs>
    <rect x="${leftPad + 0.5}" y="${topPad + 0.5}" width="${frameW - 1}" height="${frameH - 1}" fill="white" stroke="black" stroke-width="2"/>
    ${dividers.join("")}
    ${gridLines.join("")}
    ${glyphs.join("")}
    ${slidingArrow}
    ${widthLabel}
    ${heightLabel}
  </svg>`;
}
