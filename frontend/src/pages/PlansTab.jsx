import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "../api.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const KINDS = [
  { value: "unknown", label: "—", color: "#eee", text: "#666" },
  { value: "floor", label: "Floor", color: "#dbeafe", text: "#1e3a8a" },
  { value: "elevation", label: "Elev.", color: "#e0e7ff", text: "#3730a3" },
  { value: "window_schedule", label: "Win Sched", color: "#fde68a", text: "#92400e" },
  { value: "door_schedule", label: "Door Sched", color: "#fecaca", text: "#991b1b" },
];

const SCHEDULE_KINDS = new Set(["window_schedule", "door_schedule"]);
const FLOOR_KINDS = new Set(["floor"]);

export default function PlansTab({ project, onChange }) {
  const plans = project.plans ?? [];
  const items = project.items ?? [];
  const [activeId, setActiveId] = useState(plans[0]?.id ?? null);
  const [file, setFile] = useState(null);
  const [thumbs, setThumbs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extractingItems, setExtractingItems] = useState(false);
  const [extractionPreview, setExtractionPreview] = useState(null);
  const [countingMarks, setCountingMarks] = useState(false);
  const [marksPreview, setMarksPreview] = useState(null);
  const [error, setError] = useState("");

  const active = plans.find((p) => p.id === activeId) ?? null;
  const schedulePages = active
    ? Object.entries(active.tags ?? {})
        .filter(([, kind]) => SCHEDULE_KINDS.has(kind))
        .map(([n]) => Number(n))
        .sort((a, b) => a - b)
    : [];
  const floorPages = active
    ? Object.entries(active.tags ?? {})
        .filter(([, kind]) => FLOOR_KINDS.has(kind))
        .map(([n]) => Number(n))
        .sort((a, b) => a - b)
    : [];
  const hasExtractedText = !!(active?.pages?.length);

  async function renderThumbs(f) {
    setLoading(true);
    setError("");
    setThumbs([]);
    try {
      const buf = await f.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf }).promise;
      const out = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        out.push({ pageNumber: i, dataUrl: canvas.toDataURL("image/png") });
      }
      setThumbs(out);
      return out.length;
    } catch (e) {
      setError("Failed to render PDF preview: " + String(e));
      return 0;
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setExtractionPreview(null);
    const count = await renderThumbs(f);
    if (count === 0) return;

    const planId = crypto.randomUUID();

    let extractedPages = null;
    let pdfPersisted = false;
    try {
      const result = await api.extractPlan(f, project.id, planId);
      extractedPages = result.pages ?? [];
      pdfPersisted = !!result.pdfPersisted;
    } catch (e) {
      setError("Text extraction failed (you can still tag pages, but won't be able to auto-extract items): " + String(e));
    }

    const plan = {
      id: planId,
      name: f.name,
      pageCount: count,
      tags: {},
      pages: extractedPages,
      pdfPersisted,
      addedAt: new Date().toISOString(),
    };
    setActiveId(plan.id);
    onChange({ plans: [...plans, plan] });
  }

  function setTag(pageNumber, kind) {
    if (!active) return;
    const tags = { ...(active.tags ?? {}), [pageNumber]: kind };
    onChange({ plans: plans.map((p) => (p.id === active.id ? { ...p, tags } : p)) });
  }

  function setAllTags(kind) {
    if (!active) return;
    const tags = {};
    for (let i = 1; i <= active.pageCount; i++) tags[i] = kind;
    onChange({ plans: plans.map((p) => (p.id === active.id ? { ...p, tags } : p)) });
  }

  function removePlan(id) {
    const next = plans.filter((p) => p.id !== id);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null);
      setThumbs([]);
      setFile(null);
      setExtractionPreview(null);
    }
    onChange({ plans: next });
  }

  async function extractItems() {
    if (!active || !hasExtractedText || schedulePages.length === 0) return;
    setExtractingItems(true);
    setError("");
    try {
      const result = await api.parseSchedule(active.pages, schedulePages);
      setExtractionPreview(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setExtractingItems(false);
    }
  }

  async function countMarks() {
    if (!active || floorPages.length === 0) return;
    setCountingMarks(true);
    setError("");
    try {
      const result = await api.countMarks({
        pages: active.pages,
        floorPageNumbers: floorPages,
        projectId: project.id,
        planId: active.id,
        projectName: project.name,
      });
      setMarksPreview(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setCountingMarks(false);
    }
  }

  function applyMarkCounts(finalCounts) {
    if (!marksPreview) return;
    const counts = finalCounts ?? marksPreview.counts ?? {};
    const updated = items.map((it) => {
      const c = counts[it.mark];
      if (c != null && c > 0) return { ...it, quantity: c };
      return it;
    });
    onChange({ items: updated });
    setMarksPreview(null);
  }

  function applyItems(mode) {
    if (!extractionPreview) return;
    const incoming = extractionPreview.items;
    const next = mode === "replace" ? incoming : mergeByMark(items, incoming);
    onChange({ items: next });
    setExtractionPreview(null);
  }

  useEffect(() => {
    if (!active || !file || file.name !== active.name) {
      setThumbs([]);
      setFile(null);
      setExtractionPreview(null);
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tagCounts = active
    ? KINDS.reduce((acc, k) => {
        acc[k.value] = Object.values(active.tags ?? {}).filter((v) => v === k.value).length;
        return acc;
      }, {})
    : {};

  return (
    <div>
      <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {plans.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveId(p.id)}
            style={{
              padding: "6px 10px", borderRadius: 4, border: "1px solid #ccc",
              background: p.id === activeId ? "#111" : "#fff",
              color: p.id === activeId ? "#fff" : "#111", cursor: "pointer",
            }}
          >
            {p.name} · {p.pageCount}p{p.pages?.length ? " · text ✓" : ""}{p.pdfPersisted ? " · PDF ✓" : " · PDF ✗"}
          </button>
        ))}
        <label style={{ padding: "6px 10px", border: "1px dashed #888", borderRadius: 4, cursor: "pointer" }}>
          + Upload PDF
          <input type="file" accept="application/pdf" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>

      {error && <div className="card" style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}
      {loading && <div className="card">Rendering pages…</div>}

      {active && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{active.name}</div>
                <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>
                  {active.pageCount} pages ·{" "}
                  {KINDS.filter((k) => tagCounts[k.value] > 0).map((k) => `${tagCounts[k.value]} ${k.label}`).join(", ") || "none tagged yet"}
                </div>
              </div>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button
                  onClick={countMarks}
                  disabled={floorPages.length === 0 || countingMarks || (!hasExtractedText && !active.pdfPersisted)}
                  title={
                    floorPages.length === 0
                      ? "Tag at least one page as Floor first"
                      : !hasExtractedText && !active.pdfPersisted
                      ? "Re-upload this PDF to enable mark detection"
                      : ""
                  }
                >
                  {countingMarks ? "Counting…" : `Count marks (${floorPages.length} floor page${floorPages.length === 1 ? "" : "s"})`}
                </button>
                <button
                  className="primary"
                  onClick={extractItems}
                  disabled={!hasExtractedText || schedulePages.length === 0 || extractingItems}
                  title={
                    !hasExtractedText
                      ? "Re-upload this PDF to enable extraction"
                      : schedulePages.length === 0
                      ? "Tag at least one page as Win Sched or Door Sched first"
                      : ""
                  }
                >
                  {extractingItems ? "Extracting…" : `Extract items (${schedulePages.length} schedule page${schedulePages.length === 1 ? "" : "s"})`}
                </button>
                <button onClick={() => removePlan(active.id)}>Remove plan</button>
              </div>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Bulk: mark every page as</div>
              <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
                {KINDS.map((k) => (
                  <button
                    key={k.value}
                    onClick={() => setAllTags(k.value)}
                    style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #ccc", background: k.color, color: k.text, cursor: "pointer", fontSize: 12 }}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!hasExtractedText && (
            <div className="card" style={{ marginBottom: 12, color: "#a60" }}>
              No extracted text on file for this plan. Re-upload the PDF to enable item extraction.
            </div>
          )}

          {marksPreview && (
            <MarksPreview
              preview={marksPreview}
              items={items}
              floorPages={floorPages}
              project={project}
              plan={active}
              onCancel={() => setMarksPreview(null)}
              onApply={applyMarkCounts}
            />
          )}

          {extractionPreview && (
            <ExtractionPreview
              preview={extractionPreview}
              schedulePages={schedulePages}
              existingItemCount={items.length}
              onCancel={() => setExtractionPreview(null)}
              onApply={applyItems}
            />
          )}

          {thumbs.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {thumbs.map((pg) => {
                const currentKind = active.tags?.[pg.pageNumber] ?? "unknown";
                const kindMeta = KINDS.find((k) => k.value === currentKind) ?? KINDS[0];
                return (
                  <div
                    key={pg.pageNumber}
                    className="card"
                    style={{
                      borderColor: SCHEDULE_KINDS.has(currentKind) ? kindMeta.text : "#eee",
                      borderWidth: SCHEDULE_KINDS.has(currentKind) ? 2 : 1,
                    }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#666" }}>Page {pg.pageNumber}</span>
                      <span
                        style={{
                          fontSize: 11, padding: "2px 6px", borderRadius: 10,
                          background: kindMeta.color, color: kindMeta.text, fontWeight: 600,
                        }}
                      >
                        {kindMeta.label}
                      </span>
                    </div>
                    <img
                      src={pg.dataUrl}
                      alt={`Page ${pg.pageNumber}`}
                      style={{ width: "100%", border: "1px solid #eee", display: "block" }}
                    />
                    <div className="row" style={{ flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                      {KINDS.map((k) => {
                        const selected = currentKind === k.value;
                        return (
                          <button
                            key={k.value}
                            onClick={() => setTag(pg.pageNumber, k.value)}
                            style={{
                              flex: "1 1 auto",
                              padding: "4px 6px",
                              borderRadius: 4,
                              border: selected ? `2px solid ${k.text}` : "1px solid #ddd",
                              background: selected ? k.color : "#fff",
                              color: selected ? k.text : "#333",
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: selected ? 600 : 400,
                            }}
                          >
                            {k.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {plans.length === 0 && (
        <div className="card">No plans uploaded yet. Click "+ Upload PDF" to start.</div>
      )}
    </div>
  );
}

function ExtractionPreview({ preview, schedulePages, existingItemCount, onCancel, onApply }) {
  const { items, meta } = preview;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap" }}>
        <strong>Extracted {items.length} item{items.length === 1 ? "" : "s"} from {schedulePages.length} schedule page{schedulePages.length === 1 ? "" : "s"}</strong>
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={() => onApply("append")} disabled={items.length === 0}>
            Append to existing items
          </button>
          <button className="primary" onClick={() => onApply("replace")} disabled={items.length === 0}>
            Replace all {existingItemCount} item{existingItemCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {meta?.pages && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
          {meta.pages.map((p) => (
            <div key={p.pageNumber}>
              Page {p.pageNumber}: {p.ok
                ? <>columns: {p.columns.join(", ")} · {p.itemsExtracted} row{p.itemsExtracted === 1 ? "" : "s"}</>
                : <span style={{ color: "#a60" }}>{p.reason}</span>}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <table>
          <thead>
            <tr><th>Mark</th><th>Qty</th><th>Type</th><th>Operation</th><th>W (in)</th><th>H (in)</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>{it.mark}</td><td>{it.quantity}</td><td>{it.type}</td><td>{it.operation}</td>
                <td>{it.width_in ?? "?"}</td><td>{it.height_in ?? "?"}</td><td>{it.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ color: "#a60" }}>
          No items detected. The schedule may use a layout the parser doesn't recognize yet (no header row found, or columns we don't classify).
        </div>
      )}
    </div>
  );
}

function MarksPreview({ preview, items, floorPages, project, plan, onCancel, onApply }) {
  const counts = preview.counts ?? {};
  const marks = Object.keys(counts).sort();
  const itemMarks = new Set(items.map((it) => it.mark));
  const clusters = preview.clusters ?? [];
  const clusteredMarks = new Set(clusters.map((c) => c.mark));
  const detections = preview.detections ?? [];

  // Editable counts default to vision counts; user can adjust before applying.
  const [editedCounts, setEditedCounts] = useState({});
  useEffect(() => {
    const init = {};
    for (const m of Object.keys(counts)) init[m] = counts[m];
    setEditedCounts(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const matched = marks.filter((m) => itemMarks.has(m) && Number(editedCounts[m] ?? counts[m]) > 0);

  function handleEdit(mark, value) {
    const n = value === "" ? 0 : Number(value);
    setEditedCounts({ ...editedCounts, [mark]: Number.isFinite(n) && n >= 0 ? n : 0 });
  }

  function applyEdited() {
    onApply(editedCounts);
  }

  // Group detections by page for the per-page renders.
  const detectionsByPage = {};
  for (const d of detections) {
    if (!detectionsByPage[d.page]) detectionsByPage[d.page] = [];
    detectionsByPage[d.page].push(d);
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap" }}>
        <strong>
          Detected {preview.totalDetected} mark instance{preview.totalDetected === 1 ? "" : "s"} across{" "}
          {floorPages.length} floor page{floorPages.length === 1 ? "" : "s"}{" "}
          ({marks.length} unique mark{marks.length === 1 ? "" : "s"})
        </strong>
        <div className="row">
          <button onClick={onCancel}>Cancel</button>
          <button
            className="primary"
            onClick={applyEdited}
            disabled={matched.length === 0}
            title={matched.length === 0 ? "No detected marks match any existing item" : ""}
          >
            Apply quantities to {matched.length} matching item{matched.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 12, marginBottom: 8 }}>
        {preview.detector === "vision" ? (
          <span style={{ color: "#0a0" }}>
            ✓ Counted by AI vision ({preview.model ?? "Claude"}) — reads hexagons directly from the rendered PDF.
            {preview.usage && (
              <span style={{ color: "#888" }}>
                {" "}· {preview.usage.input_tokens?.toLocaleString()} input + {preview.usage.output_tokens?.toLocaleString()} output tokens
                {preview.usage.cache_read_input_tokens > 0 && ` (${preview.usage.cache_read_input_tokens.toLocaleString()} cached)`}
              </span>
            )}
          </span>
        ) : (
          <span style={{ color: "#a60" }}>
            ⚠ Counted by local text fallback. Local detection over-counts grid labels, legend entries, and any short-letter glyph it finds — counts here are unreliable.
            <br /><br />
            <strong>Why vision didn't run:</strong>{" "}
            {!preview.visionAvailable ? (
              <>
                The <code>ANTHROPIC_API_KEY</code> environment variable is not set on the server. Add it in Railway → Variables (the value should start with <code>sk-ant-</code>), then wait for the redeploy to show <strong>Active</strong>.
              </>
            ) : !preview.pdfOnDisk ? (
              <>
                The PDF bytes aren't on the server's persistent disk. <strong>Click "Remove plan" and re-upload this PDF</strong> — only PDFs uploaded after the persistence code shipped are saved on the volume.
              </>
            ) : preview.visionError ? (
              <>
                Vision was attempted but the API call failed: <code>{preview.visionError}</code>. Most common causes: the API key is invalid, billing isn't set up at console.anthropic.com, or the PDF exceeds 32&nbsp;MB / 100 pages.
              </>
            ) : (
              <>Reason unknown — check the backend logs in Railway.</>
            )}
            {preview.decoded && (
              <> Auto-decoded font shift: +{preview.shift}.</>
            )}
          </span>
        )}
      </div>

      {clusters.length > 0 && (
        <div style={{
          background: "#fff8e1",
          border: "1px solid #f0c040",
          borderRadius: 4,
          padding: 12,
          marginBottom: 12,
        }}>
          <strong style={{ color: "#92400e" }}>
            ⚠ {clusters.length} cluster{clusters.length === 1 ? "" : "s"} of 3+ same-letter hexagons detected — verify against the schedule
          </strong>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4, marginBottom: 8 }}>
            A cluster of 3+ adjacent hexagons with the same letter is usually a single multi-panel window assembly (total quantity = 1 with that many panels), not N separate windows. Check each one against the schedule's panel count for that mark and adjust the quantity manually after applying.
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
            {clusters.map((c, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{c.mark}</strong> on page {c.page} — {c.hexagonCount} hexagons clustered.
                {" "}If the schedule lists mark {c.mark} as a {c.hexagonCount}-panel window, set quantity = <strong>1</strong> with panels = <strong>{c.hexagonCount}</strong>.
                {" "}If they're {c.hexagonCount} separate single-panel windows, leave the count as <strong>{c.hexagonCount}</strong>.
              </li>
            ))}
          </ul>
        </div>
      )}

      {detections.length > 0 && project && plan && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "#333", marginBottom: 8 }}>
            <strong>Visual verification</strong> — each yellow box marks where the AI found a hexagon. Compare against the plan, then adjust the "Final qty" column below before applying.
          </div>
          {floorPages.map((pageNum) => {
            const pageDets = detectionsByPage[pageNum] ?? [];
            if (pageDets.length === 0) return null;
            return (
              <PageWithDetections
                key={pageNum}
                projectId={project.id}
                planId={plan.id}
                pageNumber={pageNum}
                detections={pageDets}
              />
            );
          })}
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Mark</th>
            <th>AI count</th>
            {floorPages.map((p) => (
              <th key={p}>Page {p}</th>
            ))}
            <th>Final qty</th>
            <th>Existing item?</th>
            <th>Apply preview</th>
          </tr>
        </thead>
        <tbody>
          {marks.map((m) => {
            const item = items.find((it) => it.mark === m);
            const isClustered = clusteredMarks.has(m);
            const editedVal = editedCounts[m] ?? counts[m];
            const edited = Number(editedVal) !== Number(counts[m]);
            return (
              <tr key={m} style={isClustered ? { background: "#fff8e1" } : undefined}>
                <td>
                  <strong>{m}</strong>
                  {isClustered && <span title="Cluster detected — verify against schedule" style={{ marginLeft: 6, color: "#92400e" }}>⚠</span>}
                </td>
                <td>{counts[m]}</td>
                {floorPages.map((p) => (
                  <td key={p}>{preview.perPage?.[p]?.[m] ?? 0}</td>
                ))}
                <td>
                  <input
                    type="number"
                    min={0}
                    value={editedVal}
                    onChange={(e) => handleEdit(m, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    style={{
                      width: 60,
                      fontWeight: edited ? 600 : 400,
                      borderColor: edited ? "#0a0" : undefined,
                    }}
                  />
                </td>
                <td>{item ? "yes" : <span style={{ color: "#a60" }}>no — add it in Items</span>}</td>
                <td>{item ? `${item.quantity} → ${editedVal}` : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {unmatched.length > 0 && (
        <div style={{ fontSize: 12, color: "#a60", marginTop: 8 }}>
          {unmatched.length} mark{unmatched.length === 1 ? "" : "s"} found in floor plans with no matching item: {unmatched.join(", ")}.
          Add them in the Items tab to capture their counts.
        </div>
      )}
    </div>
  );
}

// Cache the parsed PDF document per planId so we don't re-fetch + re-parse for each page.
const pdfCache = new Map();
async function getCachedPdf(projectId, planId) {
  const key = `${projectId}/${planId}`;
  if (!pdfCache.has(key)) {
    const promise = (async () => {
      const url = api.planPdfUrl(projectId, planId);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
      const buf = await res.arrayBuffer();
      return await pdfjs.getDocument({ data: buf }).promise;
    })();
    pdfCache.set(key, promise);
  }
  return pdfCache.get(key);
}

function PageWithDetections({ projectId, planId, pageNumber, detections }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdf = await getCachedPdf(projectId, planId);
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const targetWidth = 900;
        const scale = Math.min(targetWidth / baseViewport.width, 2);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        if (!cancelled) setSize({ w: viewport.width, h: viewport.height });
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, planId, pageNumber]);

  // Color a stable hue per mark so adjacent same-letter boxes are visually grouped.
  const colorForMark = (mark) => {
    let h = 0;
    for (const c of mark) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h}, 80%, 50%)`;
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
        Page {pageNumber} — {detections.length} hexagon{detections.length === 1 ? "" : "s"} detected
      </div>
      {error && <div style={{ color: "#b00", fontSize: 12 }}>{error}</div>}
      <div style={{ position: "relative", display: "inline-block", border: "1px solid #ddd", maxWidth: "100%", overflow: "auto" }}>
        <canvas ref={canvasRef} style={{ display: "block" }} />
        {size.w > 0 && (
          <svg
            style={{ position: "absolute", top: 0, left: 0, width: size.w, height: size.h, pointerEvents: "none" }}
            viewBox={`0 0 ${size.w} ${size.h}`}
          >
            {detections.map((d, i) => {
              const px = (d.x / 100) * size.w;
              const py = (d.y / 100) * size.h;
              const pw = Math.max(8, (d.width / 100) * size.w);
              const ph = Math.max(8, (d.height / 100) * size.h);
              const color = colorForMark(d.mark);
              return (
                <g key={i}>
                  <rect
                    x={px}
                    y={py}
                    width={pw}
                    height={ph}
                    fill="rgba(255, 235, 59, 0.25)"
                    stroke={color}
                    strokeWidth={2}
                  />
                  <text
                    x={px + pw / 2}
                    y={Math.max(12, py - 3)}
                    textAnchor="middle"
                    fill={color}
                    fontWeight="bold"
                    fontSize={13}
                    style={{ paintOrder: "stroke", stroke: "white", strokeWidth: 3 }}
                  >
                    {d.mark}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

function mergeByMark(existing, incoming) {
  const map = new Map(existing.map((it) => [it.mark, { ...it }]));
  for (const it of incoming) {
    if (map.has(it.mark)) {
      map.set(it.mark, { ...map.get(it.mark), ...it });
    } else {
      map.set(it.mark, { ...it });
    }
  }
  return [...map.values()];
}
