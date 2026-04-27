import { useState, useEffect } from "react";
import { TextField } from "../lib/Fields.jsx";

const blank = {
  address: "",
  buyerName: "",
  company: "",
  date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
};

export default function ProjectInfo({ project, onChange }) {
  const initial = { ...blank, ...(project.info ?? {}) };
  const [info, setInfo] = useState(initial);
  const [saved, setSaved] = useState(false);

  // Reset local state if the project changes (navigating between projects).
  useEffect(() => {
    setInfo({ ...blank, ...(project.info ?? {}) });
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  function set(key, value) {
    setInfo({ ...info, [key]: value });
    setSaved(false);
  }

  function save(e) {
    e?.preventDefault();
    onChange({ info });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        These details appear in the header of every RFQ PDF you export for this project.
      </p>

      <form onSubmit={save} className="card" style={{ maxWidth: 640 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-4)" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField
              label="Address of build (project location)"
              value={info.address}
              onChange={(v) => set("address", v)}
              inputStyle={{ width: "100%" }}
              placeholder="1437 Crest Dr, Altadena, CA 91001"
            />
          </div>
          <TextField
            label="Buyer name"
            value={info.buyerName}
            onChange={(v) => set("buyerName", v)}
            placeholder="Shashi Dayal"
            inputStyle={{ width: "100%" }}
          />
          <TextField
            label="Company requesting quote"
            value={info.company}
            onChange={(v) => set("company", v)}
            placeholder="Healy Windows & Doors"
            inputStyle={{ width: "100%" }}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
              RFQ date
            </span>
            <input
              type="date"
              value={info.date}
              onChange={(e) => set("date", e.target.value)}
              style={{ width: 180 }}
            />
          </label>
        </div>

        <div className="row" style={{ marginTop: 20, justifyContent: "flex-end" }}>
          {saved && <span className="text-success" style={{ marginRight: 8 }}>✓ Saved</span>}
          <button className="primary" type="submit">Save project info</button>
        </div>
      </form>
    </div>
  );
}
