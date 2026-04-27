import { useEffect, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { api } from "../api.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const KINDS = [
  ["unknown", "Unknown"],
  ["floor", "Floor Plan"],
  ["elevation", "Elevation"],
  ["window_schedule", "Window Schedule"],
  ["door_schedule", "Door Schedule"],
];

const SCHEDULE_KINDS = new Set(["window_schedule", "door_schedule"]);

export default function PlansTab({ project, onChange }) {
  const plans = project.plans ?? [];
  const items = project.items ?? [];
  const [activeId, setActiveId] = useState(plans[0]?.id ?? null);
  const [file, setFile] = useState(null);
  const [thumbs, setThumbs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extractingItems, setExtractingItems] = useState(false);
  const [extractionPreview, setExtractionPreview] = useState(null);
  const [error, setError] = useState("");

  const active = plans.find((p) => p.id === activeId) ?? null;
  const schedulePages = active
    ? Object.entries(active.tags ?? {})
        .filter(([, kind]) => SCHEDULE_KINDS.has(kind))
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
      setError(String(e));
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

    let extractedPages = null;
    try {
      const result = await api.extractPlan(f);
      extractedPages = result.pages ?? [];
    } catch (e) {
      setError("Text extraction failed: " + String(e) + " (you can still tag pages manually)");
    }

    const plan = {
      id: crypto.randomUUID(),
      name: f.name,
      pageCount: count,
      tags: {},
      pages: extractedPages,
      addedAt: new Date().toISOString(),
    };
    setActiveId(plan.id);
    onChange({ plans: [...plans, plan] });
  }

  function setTag(pageNumber, kind) {
    if (!active) return;
    const tags = { ...active.tags, [pageNumber]: kind };
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

  function applyItems(mode) {
    if (!extractionPreview) return;
    const incoming = extractionPreview.items;
    const next =
      mode === "replace"
        ? incoming
        : mergeByMark(items, incoming);
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
            {p.name} · {p.pageCount}p{p.pages?.length ? " · text ✓" : ""}
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
          <div className="row" style={{ marginBottom: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ color: "#666" }}>
              {active.name} · {active.pageCount} pages
              {schedulePages.length > 0 && <> · {schedulePages.length} schedule page{schedulePages.length === 1 ? "" : "s"} tagged</>}
            </div>
            <div className="row">
              <button
                className="primary"
                onClick={extractItems}
                disabled={!hasExtractedText || schedulePages.length === 0 || extractingItems}
                title={
                  !hasExtractedText
                    ? "Re-upload this PDF to enable extraction"
                    : schedulePages.length === 0
                    ? "Tag at least one page as Window Schedule or Door Schedule first"
                    : ""
                }
              >
                {extractingItems ? "Extracting…" : "Extract items from schedules"}
              </button>
              <button onClick={() => removePlan(active.id)}>Remove plan</button>
            </div>
          </div>

          {!hasExtractedText && (
            <div className="card" style={{ marginBottom: 12, color: "#a60" }}>
              No extracted text on file for this plan. Re-upload the PDF to enable item extraction.
            </div>
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
              {thumbs.map((pg) => (
                <div key={pg.pageNumber} className="card">
                  <div style={{ marginBottom: 6, fontSize: 12, color: "#666" }}>Page {pg.pageNumber}</div>
                  <img src={pg.dataUrl} alt={`Page ${pg.pageNumber}`} style={{ width: "100%", border: "1px solid #eee" }} />
                  <select
                    value={active.tags[pg.pageNumber] ?? "unknown"}
                    onChange={(e) => setTag(pg.pageNumber, e.target.value)}
                    style={{ marginTop: 8, width: "100%" }}
                  >
                    {KINDS.map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
              ))}
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
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
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
