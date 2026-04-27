import { useEffect, useRef, useState } from "react";
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

export default function PlansTab({ project, onChange }) {
  const plans = project.plans ?? [];
  const [activeId, setActiveId] = useState(plans[0]?.id ?? null);
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState(null);
  const [error, setError] = useState("");

  const active = plans.find((p) => p.id === activeId) ?? null;

  async function loadPdf(f) {
    setLoading(true);
    setError("");
    setPages([]);
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
      setPages(out);
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
    const count = await loadPdf(f);
    if (count > 0) {
      const plan = {
        id: crypto.randomUUID(),
        name: f.name,
        pageCount: count,
        tags: {},
        addedAt: new Date().toISOString(),
      };
      const next = [...plans, plan];
      setActiveId(plan.id);
      onChange({ plans: next });
    }
  }

  function setTag(pageNumber, kind) {
    if (!active) return;
    const tags = { ...active.tags, [pageNumber]: kind };
    const next = plans.map((p) => (p.id === active.id ? { ...p, tags } : p));
    onChange({ plans: next });
  }

  function removePlan(id) {
    const next = plans.filter((p) => p.id !== id);
    if (activeId === id) {
      setActiveId(next[0]?.id ?? null);
      setPages([]);
      setFile(null);
      setExtraction(null);
    }
    onChange({ plans: next });
  }

  async function runExtract() {
    if (!file) return;
    setExtracting(true);
    setError("");
    try {
      const result = await api.extractPlan(file);
      setExtraction(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setExtracting(false);
    }
  }

  // When switching plans, clear previews unless the active plan was the just-uploaded one
  useEffect(() => {
    if (!active || !file || file.name !== active.name) {
      setPages([]);
      setFile(null);
      setExtraction(null);
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
            {p.name} · {p.pageCount}p
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
          <div className="row" style={{ marginBottom: 12, justifyContent: "space-between" }}>
            <div style={{ color: "#666" }}>{active.name} · {active.pageCount} pages</div>
            <div className="row">
              <button onClick={runExtract} disabled={!file || extracting}>
                {extracting ? "Extracting…" : "Run extraction (stub)"}
              </button>
              <button onClick={() => removePlan(active.id)}>Remove plan</button>
            </div>
          </div>

          {!file && pages.length === 0 && (
            <div className="card" style={{ marginBottom: 12, color: "#888" }}>
              Re-upload this PDF to view page previews. (PDF bytes aren't persisted server-side yet — only metadata + tags.)
            </div>
          )}

          {extraction && (
            <div className="card" style={{ marginBottom: 12 }}>
              <strong>Extraction result</strong>
              <div style={{ color: "#666", fontSize: 12, marginBottom: 6 }}>
                {extraction.pages?.length ?? 0} pages · {extraction.marks?.length ?? 0} marks · {extraction.items?.length ?? 0} items
              </div>
              {(extraction.pages?.length ?? 0) === 0 && (
                <div style={{ color: "#a60", fontSize: 12 }}>
                  Backend extraction engines are stubs — they return empty results. Use page tags + the Items tab in the meantime.
                </div>
              )}
            </div>
          )}

          {pages.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {pages.map((pg) => (
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
