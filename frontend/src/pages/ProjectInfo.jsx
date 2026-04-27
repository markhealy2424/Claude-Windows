import { useState, useEffect } from "react";
import { TextField } from "../lib/Fields.jsx";

const blank = {
  address: "",
  buyerName: "",
  company: "",
  date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
};

export default function ProjectInfo({ project, onChange }) {
  const [info, setInfo] = useState({ ...blank, ...(project.info ?? {}) });

  // Reset local state when navigating between projects.
  useEffect(() => {
    setInfo({ ...blank, ...(project.info ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Auto-save: every change pushes to the parent's optimistic-savePatch
  // path, so values persist as you type — no Save button to remember.
  function set(key, value) {
    const next = { ...info, [key]: value };
    setInfo(next);
    onChange({ info: next });
  }

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        These details appear in the header of every RFQ PDF you export for this project. Changes save automatically.
      </p>

      <div className="card" style={{ maxWidth: 640 }}>
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
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: 16, fontStyle: "italic" }}>
        ✓ All fields auto-save. To verify, refresh this page — your values will still be here.
      </p>
    </div>
  );
}
