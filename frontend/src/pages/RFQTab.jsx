import { useEffect, useState } from "react";
import { api } from "../api.js";
import { REQUIREMENTS } from "../lib/projectRequirements.js";
import { isDoor } from "../lib/itemKind.js";

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
    api.generateRFQ(items, project.name, project.info)
      .then((r) => { if (!cancelled) setPreview(r); })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [project.id, items.length, project.info]);

  async function downloadPdf() {
    setDownloading(true);
    setError("");
    try {
      await api.downloadRFQPdf(items, project.name, project.info);
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
        <div className="text-muted">
          {items.length} item{items.length === 1 ? "" : "s"}
          {preview && <> · generated {new Date(preview.generatedAt).toLocaleTimeString()}</>}
        </div>
        <button className="primary" onClick={downloadPdf} disabled={downloading}>
          {downloading ? "Building PDF…" : "Download PDF"}
        </button>
      </div>
      {error && <div className="card error" style={{ marginBottom: 12 }}>{error}</div>}
      {loading && <div className="card">Generating preview…</div>}
      {preview && (
        <RFQHeader info={project.info ?? {}} projectName={project.name} />
      )}
      {preview && (() => {
        const windowRows = preview.rows.filter((r) => !isDoor(r.type));
        const doorRows = preview.rows.filter((r) => isDoor(r.type));
        const renderRow = (r, key) => (
          <tr key={key}>
            <td>{r.mark}</td>
            <td>{r.qty}</td>
            <td style={{ width: 120 }}>
              {typeof r.sketch === "string" && r.sketch.startsWith("data:image/") ? (
                <img src={r.sketch} alt="" style={{ width: 110, maxHeight: 90, objectFit: "contain" }} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: r.sketch }} />
              )}
            </td>
            <td>{r.type}</td>
            <td>{r.material ?? "Aluminum"}</td>
            <td>
              {r.width_per_panel_in ?? "?"}"
              {r.width_per_panel_mm != null && <div className="text-muted" style={{ fontSize: 11 }}>{r.width_per_panel_mm} mm</div>}
            </td>
            <td>
              {r.width_in ?? "?"}"
              {r.width_mm != null && <div className="text-muted" style={{ fontSize: 11 }}>{r.width_mm} mm</div>}
            </td>
            <td>
              {r.height_in ?? "?"}"
              {r.height_mm != null && <div className="text-muted" style={{ fontSize: 11 }}>{r.height_mm} mm</div>}
            </td>
            <td>{r.panels ?? 1}</td>
            <td>{r.operation}</td>
            <td>{r.notes}</td>
          </tr>
        );
        const sectionHeader = (label, count) => (
          <tr>
            <td colSpan={11} style={{ background: "#f2f2f2", fontWeight: 600, padding: "6px 8px", borderTop: "1px solid #ddd" }}>
              {label} <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>({count})</span>
            </td>
          </tr>
        );
        return (
          <table>
            <thead>
              <tr>
                <th>Mark</th><th>Qty</th><th>Sketch</th><th>Type</th><th>Material</th>
                <th>W/Panel</th><th>Total W</th><th>Height</th><th>Panels</th><th>Operation</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {windowRows.length > 0 && sectionHeader("Windows", windowRows.length)}
              {windowRows.map((r, i) => renderRow(r, `w-${i}`))}
              {doorRows.length > 0 && sectionHeader("Doors", doorRows.length)}
              {doorRows.map((r, i) => renderRow(r, `d-${i}`))}
            </tbody>
          </table>
        );
      })()}
    </div>
  );
}

function RFQHeader({ info, projectName }) {
  const filled = info.address || info.buyerName || info.company || info.date;
  const reqs = info.requirements ?? {};
  const answeredReqs = REQUIREMENTS.filter((r) => reqs[r.key] === "yes" || reqs[r.key] === "no");

  if (!filled && answeredReqs.length === 0) {
    return (
      <div className="card warning" style={{ marginBottom: 16 }}>
        Project info not filled in yet. Open the <strong>Project Info</strong> tab to add the address, buyer, company, date, and project requirements — these appear in the RFQ header.
      </div>
    );
  }
  const dateLabel = info.date
    ? new Date(info.date + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "—";
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0, marginBottom: 8 }}>Ready for Quote — {projectName}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 16, rowGap: 4, fontSize: 13 }}>
        {info.address && (<><span className="text-muted">Address:</span><span>{info.address}</span></>)}
        {info.buyerName && (<><span className="text-muted">Buyer:</span><span>{info.buyerName}</span></>)}
        {info.company && (<><span className="text-muted">Company:</span><span>{info.company}</span></>)}
        {info.date && (<><span className="text-muted">Date:</span><span>{dateLabel}</span></>)}
      </div>

      {answeredReqs.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-divider)" }}>
          <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, marginBottom: 8 }}>
            Project requirements
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            {answeredReqs.map((req) => {
              const value = reqs[req.key];
              const spec = req.hasSpec && value === "no" ? reqs[`${req.key}Spec`] : null;
              return (
                <div key={req.key}>
                  {req.label}
                  {spec && <span className="text-muted" style={{ fontStyle: "italic" }}> — {spec}</span>}
                  <span style={{ marginLeft: 4 }}>: </span>
                  <strong style={{ color: value === "yes" ? "var(--color-success)" : "var(--color-error)" }}>
                    {value === "yes" ? "Yes" : "No"}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
