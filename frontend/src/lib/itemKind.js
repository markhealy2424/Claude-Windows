// Mirror of backend/src/engines/itemKind.js — keep them in sync.
//
// All slugs that should render in the "Doors" section of the Items tab,
// the RFQ, and the proposal. Anything not in this set is treated as a
// window (including legacy / blank types).
const DOOR_SLUGS = new Set([
  "sliding-door",
  "french-door",
  "bifold-door",
  "multi-fold-door",
  "single-hinged-door",
  "double-hinged-door",
  "entry-door",
  // Legacy slugs from older extractions / projects.
  "folding-door",
  "casement-door",
]);

export function isDoor(typeOrItem) {
  const t = typeof typeOrItem === "string" ? typeOrItem : (typeOrItem?.type ?? "");
  return DOOR_SLUGS.has(String(t).toLowerCase());
}

export function partitionByKind(items = []) {
  const windows = [];
  const doors = [];
  for (const it of items) {
    if (isDoor(it)) doors.push(it);
    else windows.push(it);
  }
  return { windows, doors };
}

// True when a swing direction (in / out) is meaningful for this type:
// casement windows + every door type. Sliding, fixed, awning, hopper,
// hung etc. don't have a meaningful swing direction (or it's
// standardized by the type itself), so the swing field stays hidden
// for them.
export function needsSwing(typeOrItem) {
  const t = String(typeof typeOrItem === "string" ? typeOrItem : (typeOrItem?.type ?? "")).toLowerCase();
  if (t === "casement") return true;
  return DOOR_SLUGS.has(t);
}

// Human-readable label for an item's swing — used in row subtitles and
// PDF cells. Returns "" when the type doesn't need a swing or the field
// is blank.
export function swingLabel(item) {
  if (!item || !needsSwing(item.type)) return "";
  const s = String(item.swing ?? "").toLowerCase();
  if (s === "in") return "swings in";
  if (s === "out") return "swings out";
  return "";
}
