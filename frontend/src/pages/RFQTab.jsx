import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function RFQTab({ project }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const items = project.items ?? [];

  useEffect(() => {
    let cancelled = false;
    if (items.length === 0) { setPreview(null); return; }
    setLoading(true);
    api.generateRFQ(items, project.name)
      .then((r) => { if (!cancelled) setPreview(r); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id, items.length]);

  async function downloadPdf() {
    setDownloading(true);
    setError("");
    try {
      await api.downloadRFQPdf(items, project.name);
    } catch (e) {
      setError(String(e));
    } finally {
      setDownloading(false);
    }
  }

  if (items.length === 0) {
    return <div className="card">Add items in the Items tab to generate an RFQ.</div>;
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
        <div style={{ color: "#666" }}>
          {items.length} item{items.length === 1 ? "" : "s"}
          {preview && <> · generated {new Date(preview.generatedAt).toLocaleTimeString()}</>}
        </div>
        <button className="primary" onClick={downloadPdf} disabled={downloading}>
          {downloading ? "Building PDF…" : "Download PDF"}
        </button>
      </div>
      {error && <div className="card" style={{ color: "#b00", marginBottom: 12 }}>{error}</div>}
      {loading && <div className="card">Generating preview…</div>}
      {preview && (
        <table>
          <thead>
            <tr>
              <th>Mark</th><th>Qty</th><th>Sketch</th><th>Type</th>
              <th>Width</th><th>Height</th><th>Operation</th><th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((r, i) => (
              <tr key={i}>
                <td>{r.mark}</td>
                <td>{r.qty}</td>
                <td style={{ width: 120 }} dangerouslySetInnerHTML={{ __html: r.sketch }} />
                <td>{r.type}</td>
                <td>
                  {r.width_in ?? "?"}"
                  {r.width_mm != null && <div style={{ color: "#666", fontSize: 11 }}>{r.width_mm} mm</div>}
                </td>
                <td>
                  {r.height_in ?? "?"}"
                  {r.height_mm != null && <div style={{ color: "#666", fontSize: 11 }}>{r.height_mm} mm</div>}
                </td>
                <td>{r.operation}</td>
                <td>{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
