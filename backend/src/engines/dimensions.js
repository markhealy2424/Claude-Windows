// Width/height helpers. Convention: `width_in` on an item is the per-panel width;
// the displayed "total width" of the unit is width_in × panels.

function panelCount(it) {
  const p = Number(it.panels ?? 1);
  return Math.max(1, Math.floor(Number.isFinite(p) ? p : 1));
}

export function totalWidthIn(it) {
  if (it.width_in == null) return null;
  return Number(it.width_in) * panelCount(it);
}

export function totalWidthMm(it) {
  if (it.width_mm != null) return Number(it.width_mm) * panelCount(it);
  if (it.width_in != null) return Math.round(Number(it.width_in) * 25.4) * panelCount(it);
  return null;
}

export function heightMm(it) {
  if (it.height_mm != null) return Number(it.height_mm);
  if (it.height_in != null) return Math.round(Number(it.height_in) * 25.4);
  return null;
}
