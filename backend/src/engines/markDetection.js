// Detect window/door mark labels (A, B, C, D1, ...) on floor plan pages and count
// occurrences per mark. Many architectural PDFs ship with a custom font that has no
// ToUnicode CMap, so pdfjs returns the raw glyph indices — typically a constant ASCII
// shift away from the real letters. We auto-detect the shift and decode.

function detectShift(rawSingles) {
  if (rawSingles.length === 0) return 0;
  const codes = rawSingles.map((c) => c.charCodeAt(0));

  // Already in A-Z range — no shift needed.
  if (codes.every((c) => c >= 65 && c <= 90)) return 0;

  // Try common shifts that map the observed range cleanly into A-Z.
  // Most common in practice: +29 (e.g. "$" → "A").
  for (const shift of [29, 32, 64, -32, -29]) {
    if (codes.every((c) => c + shift >= 65 && c + shift <= 90)) return shift;
  }

  return 0;
}

function decode(s, shift) {
  if (!s) return s;
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (shift !== 0 && code + shift >= 65 && code + shift <= 90) {
      out += String.fromCharCode(code + shift);
    } else if (code >= 97 && code <= 122) {
      out += ch.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}

export function detectMarks(pages, floorPageNumbers) {
  const pageSet = new Set((floorPageNumbers ?? []).map(Number));

  // Collect short standalone text items from the targeted pages.
  const candidates = [];
  for (const page of pages ?? []) {
    if (!pageSet.has(page.pageNumber)) continue;
    for (const item of page.items ?? []) {
      const s = (item.str ?? "").trim();
      if (s.length >= 1 && s.length <= 3) {
        candidates.push({
          str: s,
          page: page.pageNumber,
          x: item.x,
          y: item.y,
          fontSize: item.fontSize ?? 0,
        });
      }
    }
  }

  // Detect the per-PDF encoding shift from single-character items.
  const singles = candidates.filter((c) => c.str.length === 1).map((c) => c.str);
  const uniqueSingles = [...new Set(singles)];
  const shift = detectShift(uniqueSingles);

  // Decode each candidate and keep only those that look like a valid mark
  // (1-3 chars, starts with an uppercase letter, otherwise letter/digit).
  const validRe = /^[A-Z][A-Z0-9]{0,2}$/;
  const decoded = [];
  for (const it of candidates) {
    const mark = decode(it.str, shift);
    if (validRe.test(mark)) {
      decoded.push({ ...it, mark });
    }
  }

  const counts = {};
  const perPage = {};
  for (const it of decoded) {
    counts[it.mark] = (counts[it.mark] || 0) + 1;
    if (!perPage[it.page]) perPage[it.page] = {};
    perPage[it.page][it.mark] = (perPage[it.page][it.mark] || 0) + 1;
  }

  return {
    counts,
    perPage,
    decoded: shift !== 0,
    shift,
    totalDetected: decoded.length,
  };
}
