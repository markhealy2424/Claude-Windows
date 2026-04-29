// Mirror of frontend/src/lib/itemKind.js — keep them in sync.
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
