// Mirror of backend/src/engines/sketchGenerator.js — keep them in sync.

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
  if (n === 1) {
    return [operation.toLowerCase().includes("right") ? "right" : "left"];
  }
  const half = Math.floor(n / 2);
  const middle = n % 2;
  return [
    ...Array(half).fill("left"),
    ...Array(middle).fill("fixed"),
    ...Array(half).fill("right"),
  ];
}

export function generateSketch({ width_in, height_in, panels = 1, type = "fixed", operation = "" }) {
  const frameW = 240;
  const aspect = Number(height_in) / Math.max(Number(width_in), 1);
  const frameH = Math.max(80, Math.round(frameW * (Number.isFinite(aspect) ? aspect : 0.6)));
  const leftPad = 36, topPad = 22, rightPad = 12, bottomPad = 14;
  const W = leftPad + frameW + rightPad;
  const H = topPad + frameH + bottomPad;

  const n = Math.max(1, Math.floor(panels));
  const panelW = frameW / n;
  const dirs = panelDirections(n, type, operation);

  const dividers = [];
  for (let i = 1; i < n; i++) {
    const x = leftPad + i * panelW;
    dividers.push(
      `<line x1="${x}" y1="${topPad}" x2="${x}" y2="${topPad + frameH}" stroke="black" stroke-width="1"/>`
    );
  }

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
    `<text x="${leftPad + frameW / 2}" y="${topPad - 6}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#111">${formatInches(width_in)}</text>`;
  const hCenter = topPad + frameH / 2;
  const heightLabel =
    `<text x="${leftPad - 10}" y="${hCenter + 4}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#111" transform="rotate(-90 ${leftPad - 10} ${hCenter})">${formatInches(height_in)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0,0 L10,5 L0,10 Z" fill="black"/></marker></defs>
    <rect x="${leftPad + 0.5}" y="${topPad + 0.5}" width="${frameW - 1}" height="${frameH - 1}" fill="white" stroke="black" stroke-width="2"/>
    ${dividers.join("")}
    ${glyphs.join("")}
    ${slidingArrow}
    ${widthLabel}
    ${heightLabel}
  </svg>`;
}
