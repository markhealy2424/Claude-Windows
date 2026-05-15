import { useState } from "react";
import { api } from "../api.js";

// Per-project record shape (lives on project.drawings):
//   { id, fileName, ext, sizeBytes, supplier, version, notes, uploadedAt }
// The file itself is on disk at `${DATA_DIR}/drawings/<projectId>/<id>.<ext>`.

function fmtSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleString(); }
  catch { return iso; }
}

export default function DrawingsTab({ project, onChange }) {
  const drawings = project.drawings ?? [];
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function persist(next) {
    onChange({ drawings: next });
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      // Upload sequentially so one bad file doesn't drop the others.
      const newRecords = [];
      for (const f of files) {
        const id = crypto.randomUUID();
        const result = await api.uploadDrawing(f, project.id, id);
        newRecords.push({
          id,
          fileName: result.fileName || f.name,
          ext: result.ext,
          sizeBytes: result.sizeBytes ?? f.size,
          supplier: "",
          version: "",
          notes: "",
          uploadedAt: new Date().toISOString(),
        });
      }
      persist([...newRecords, ...drawings]);
    } catch (err) {
      setError("Upload failed: " + String(err));
    } finally {
      setUploading(false);
    }
  }

  function updateDrawing(id, patch) {
    persist(drawings.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function removeDrawing(id) {
    if (!confirm("Delete this drawing? The file will be removed from disk.")) return;
    try { await api.deleteDrawingFile(project.id, id); }
    catch (err) { console.error("delete file failed:", err); }
    persist(drawings.filter((d) => d.id !== id));
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>Final drawings &amp; designs</h3>
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              Supplier shop drawings showing exactly what each window and door will look like.
              Upload every iteration — files stay on file after the project closes.
            </p>
          </div>
          <label className="pill-upload">
            {uploading ? "Uploading…" : "+ Upload drawings"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              multiple
              onChange={handleUpload}
              disabled={uploading}
              style={{ display: "none" }}
            />
          </label>
        </div>
        {error && <div className="text-error" style={{ fontSize: 13, marginTop: 12 }}>{error}</div>}
      </div>

      {drawings.length === 0 ? (
        <div className="card text-subtle">
          No drawings uploaded yet. Click <strong>+ Upload drawings</strong> above to add the first iteration.
          You can upload multiple files at once (PDF or image).
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Supplier</th>
              <th>Version / iteration</th>
              <th>Notes</th>
              <th>Uploaded</th>
              <th>Size</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {drawings.map((d) => (
              <tr key={d.id}>
                <td>
                  <a
                    href={api.drawingFileUrl(project.id, d.id)}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in new tab"
                    style={{ fontWeight: 500 }}
                  >
                    {d.fileName}
                  </a>
                </td>
                <td>
                  <input
                    value={d.supplier ?? ""}
                    placeholder="Supplier"
                    onChange={(e) => updateDrawing(d.id, { supplier: e.target.value })}
                    style={{ width: 160 }}
                  />
                </td>
                <td>
                  <input
                    value={d.version ?? ""}
                    placeholder="e.g. Rev 2, 2026-05-12"
                    onChange={(e) => updateDrawing(d.id, { version: e.target.value })}
                    style={{ width: 180 }}
                  />
                </td>
                <td>
                  <input
                    value={d.notes ?? ""}
                    placeholder="Approval status, marks covered, …"
                    onChange={(e) => updateDrawing(d.id, { notes: e.target.value })}
                    style={{ width: 280 }}
                  />
                </td>
                <td className="text-muted" style={{ fontSize: 12 }}>{fmtDate(d.uploadedAt)}</td>
                <td className="text-muted" style={{ fontSize: 12 }}>{fmtSize(d.sizeBytes)}</td>
                <td><button onClick={() => removeDrawing(d.id)} title="Delete drawing">×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
