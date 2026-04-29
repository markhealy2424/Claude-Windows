// Parse window/door schedule pages into items conforming to the data model in REQUIREMENTS.md §2.4.
// Approach: cluster text items into rows by y-coordinate, find the header row, map each subsequent
// row's items to columns by x-proximity. Robust to typical digital-PDF schedule tables.

const HEADER_PATTERNS = {
  mark: /^(mark|tag|id|type\s*id|window|door|wdw|dr)$/i,
  width: /^(width|w(\.|idth)?|wd)$/i,
  height: /^(height|h(\.|eight)?|ht)$/i,
  type: /^(type|style|product)$/i,
  operation: /^(operation|op|function|swing)$/i,
  quantity: /^(qty|quantity|count|no\.?|#)$/i,
  notes: /^(notes?|remarks?|comments?)$/i,
  panels: /^(panels?|lites?|sashes?)$/i,
};

function clusterIntoRows(items) {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  const tol = Math.max(2, (sorted[0].h ?? sorted[0].fontSize ?? 8) * 0.5);
  let current = { y: sorted[0].y, items: [sorted[0]] };
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    if (Math.abs(it.y - current.y) <= tol) {
      current.items.push(it);
    } else {
      rows.push(current);
      current = { y: it.y, items: [it] };
    }
  }
  rows.push(current);
  for (const r of rows) r.items.sort((a, b) => a.x - b.x);
  return rows;
}

function classifyHeader(str) {
  const s = str.trim();
  for (const [field, pattern] of Object.entries(HEADER_PATTERNS)) {
    if (pattern.test(s)) return field;
  }
  return null;
}

function findHeaderRow(rows) {
  let best = { idx: -1, hits: 0, columns: null };
  for (let i = 0; i < rows.length; i++) {
    const fields = {};
    for (const it of rows[i].items) {
      const field = classifyHeader(it.str);
      if (field && fields[field] == null) {
        fields[field] = it.x + it.w / 2;
      }
    }
    const hits = Object.keys(fields).length;
    if (hits >= 2 && hits > best.hits) {
      best = { idx: i, hits, columns: fields };
    }
  }
  return best;
}

function mapRowToColumns(row, columns) {
  const cells = Object.fromEntries(Object.keys(columns).map((k) => [k, []]));
  for (const it of row.items) {
    const cx = it.x + it.w / 2;
    let bestField = null;
    let bestDist = Infinity;
    for (const [field, colX] of Object.entries(columns)) {
      const d = Math.abs(cx - colX);
      if (d < bestDist) {
        bestDist = d;
        bestField = field;
      }
    }
    if (bestField) cells[bestField].push(it.str);
  }
  return Object.fromEntries(
    Object.entries(cells).map(([k, parts]) => [k, parts.join(" ").trim()])
  );
}

function parseDimension(str) {
  if (!str) return { in: null, mm: null };
  const s = str.replace(/\s+/g, " ").trim();

  // "3'-0"" or "3' 0"" → inches
  const ftIn = s.match(/(\d+)\s*['']\s*-?\s*(\d+(?:\.\d+)?)?\s*["”]?/);
  if (ftIn) {
    const ft = parseInt(ftIn[1], 10);
    const inch = ftIn[2] ? parseFloat(ftIn[2]) : 0;
    const totalIn = ft * 12 + inch;
    return { in: totalIn, mm: Math.round(totalIn * 25.4) };
  }

  // pure inches: 36" or 36in
  const justIn = s.match(/(\d+(?:\.\d+)?)\s*(?:["”]|in\.?|inches?)/i);
  if (justIn) {
    const v = parseFloat(justIn[1]);
    return { in: v, mm: Math.round(v * 25.4) };
  }

  // mm: 914 mm
  const mm = s.match(/(\d+(?:\.\d+)?)\s*mm/i);
  if (mm) {
    const v = parseFloat(mm[1]);
    return { in: Math.round((v / 25.4) * 100) / 100, mm: v };
  }

  // bare number — assume inches if small, mm if large
  const num = s.match(/(\d+(?:\.\d+)?)/);
  if (num) {
    const v = parseFloat(num[1]);
    if (v <= 200) return { in: v, mm: Math.round(v * 25.4) };
    return { in: Math.round((v / 25.4) * 100) / 100, mm: v };
  }

  return { in: null, mm: null };
}

function inferType(str) {
  const s = (str || "").toLowerCase();
  if (/casement/.test(s)) return "casement";
  if (/slider/.test(s)) return "slider";
  if (/slid/.test(s)) return "sliding";
  if (/awning/.test(s)) return "awning";
  if (/hopper/.test(s)) return "hopper";
  if (/double[\s-]?hung|\bdh\b/.test(s)) return "double-hung";
  if (/hung|sash/.test(s)) return "hung";
  if (/fix/.test(s)) return "fixed";
  if (/picture/.test(s)) return "fixed";
  if (s) return s;
  return "fixed";
}

function rowToItem(cells) {
  const mark = (cells.mark || "").trim();
  if (!mark) return null;

  const width = parseDimension(cells.width);
  const height = parseDimension(cells.height);
  const qty = parseInt((cells.quantity || "1").match(/\d+/)?.[0] ?? "1", 10);
  const panels = parseInt((cells.panels || "").match(/\d+/)?.[0] ?? "1", 10);

  return {
    mark,
    quantity: qty || 1,
    type: inferType(cells.type),
    operation: (cells.operation || "").trim(),
    width_in: width.in,
    height_in: height.in,
    width_mm: width.mm,
    height_mm: height.mm,
    panels: panels || 1,
    grid: false,
    notes: (cells.notes || "").trim(),
  };
}

// Deduplicates by mark, summing quantities if the same mark appears on multiple pages.
function dedupeByMark(items) {
  const map = new Map();
  for (const it of items) {
    const existing = map.get(it.mark);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + (it.quantity || 1);
    } else {
      map.set(it.mark, { ...it });
    }
  }
  return [...map.values()];
}

export function parseSchedule(pages, schedulePageNumbers) {
  const pageSet = new Set(schedulePageNumbers);
  const out = [];
  const meta = { pages: [] };

  for (const page of pages) {
    if (!pageSet.has(page.pageNumber)) continue;
    const rows = clusterIntoRows(page.items);
    const header = findHeaderRow(rows);
    if (header.idx < 0) {
      meta.pages.push({ pageNumber: page.pageNumber, ok: false, reason: "no header row found" });
      continue;
    }

    let rowsAdded = 0;
    for (let i = header.idx + 1; i < rows.length; i++) {
      const cells = mapRowToColumns(rows[i], header.columns);
      const item = rowToItem(cells);
      if (item) {
        out.push(item);
        rowsAdded++;
      }
    }
    meta.pages.push({
      pageNumber: page.pageNumber,
      ok: true,
      columns: Object.keys(header.columns),
      itemsExtracted: rowsAdded,
    });
  }

  return { items: dedupeByMark(out), meta };
}

// Placeholder for full pipeline; not used yet.
export function matchSchedule(_marks, _pages) {
  return [];
}
