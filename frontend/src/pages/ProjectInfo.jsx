import { useState, useEffect } from "react";
import { TextField } from "../lib/Fields.jsx";
import { REQUIREMENTS } from "../lib/projectRequirements.js";

const blankClient = {
  name: "",
  address: "",
  manager: "",
  phone: "",
  email: "",
  notes: "",
};

const blank = {
  address: "",
  buyerName: "",
  company: "",
  date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  requirements: {},  // { dualGlazed: "yes"|"no", narrowFrame: "yes"|"no", narrowFrameSpec: "...", ... }
  // Client info is stored as a nested object so it doesn't collide with
  // the buyer fields above. The buyer is whoever's purchasing windows
  // (often a contractor or builder); the client is the end-user / owner
  // the project is being built for. The two are frequently different.
  client: blankClient,
};

export default function ProjectInfo({ project, onChange }) {
  const [info, setInfo] = useState({ ...blank, ...(project.info ?? {}) });

  useEffect(() => {
    setInfo({ ...blank, ...(project.info ?? {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  function set(key, value) {
    const next = { ...info, [key]: value };
    setInfo(next);
    onChange({ info: next });
  }

  function setReq(key, value) {
    const nextReqs = { ...(info.requirements ?? {}), [key]: value };
    set("requirements", nextReqs);
  }

  function setClient(key, value) {
    const nextClient = { ...blankClient, ...(info.client ?? {}), [key]: value };
    set("client", nextClient);
  }

  const reqs = info.requirements ?? {};
  const client = { ...blankClient, ...(info.client ?? {}) };

  return (
    <div>
      <p className="text-muted" style={{ fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        These details appear in the header of every RFQ PDF you export for this project. Changes save automatically.
      </p>

      <div className="card" style={{ maxWidth: 720, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Project details</h3>
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
            placeholder="Your company name"
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

      <div className="card" style={{ maxWidth: 720, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>Client</h3>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 16 }}>
          The end client this project is being built for — typically the homeowner or building owner. Often distinct from the buyer above (a contractor or builder placing the order on the client's behalf).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--s-4)" }}>
          <TextField
            label="Client name"
            value={client.name}
            onChange={(v) => setClient("name", v)}
            placeholder="Jane Homeowner"
            inputStyle={{ width: "100%" }}
          />
          <TextField
            label="Client manager / contact"
            value={client.manager}
            onChange={(v) => setClient("manager", v)}
            placeholder="Property manager or rep"
            inputStyle={{ width: "100%" }}
          />
          <div style={{ gridColumn: "1 / -1" }}>
            <TextField
              label="Client address"
              value={client.address}
              onChange={(v) => setClient("address", v)}
              placeholder="If different from the build address"
              inputStyle={{ width: "100%" }}
            />
          </div>
          <TextField
            label="Phone"
            value={client.phone}
            onChange={(v) => setClient("phone", v)}
            placeholder="(555) 123-4567"
            inputStyle={{ width: "100%" }}
          />
          <TextField
            label="Email"
            value={client.email}
            onChange={(v) => setClient("email", v)}
            placeholder="client@example.com"
            inputStyle={{ width: "100%" }}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: 2, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
              Notes (optional)
            </span>
            <textarea
              value={client.notes}
              onChange={(e) => setClient("notes", e.target.value)}
              placeholder="Anything specific about how this client likes to communicate, payment terms, access codes, etc."
              rows={2}
              style={{ width: "100%", fontFamily: "inherit", fontSize: 13 }}
            />
          </label>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 720, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Project requirements</h3>
        <p className="text-muted" style={{ fontSize: 12, marginTop: 0, marginBottom: 16 }}>
          These appear as a checklist on the RFQ so suppliers know exactly what spec to quote against. Leave blank for any you don't have a preference on.
        </p>
        {REQUIREMENTS.map((req) => {
          const value = reqs[req.key] ?? "";
          const showSpec = req.hasSpec && value === "no";
          const specKey = `${req.key}Spec`;
          return (
            <div key={req.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14 }}>{req.label}</div>
                {showSpec && (
                  <input
                    placeholder={req.specLabel}
                    value={reqs[specKey] ?? ""}
                    onChange={(e) => setReq(specKey, e.target.value)}
                    style={{ width: "100%", marginTop: 6, fontSize: 13 }}
                  />
                )}
              </div>
              <div className="yn-toggle">
                <button
                  type="button"
                  className={value === "yes" ? "active" : ""}
                  onClick={() => setReq(req.key, value === "yes" ? "" : "yes")}
                >Yes</button>
                <button
                  type="button"
                  className={value === "no" ? "active" : ""}
                  onClick={() => setReq(req.key, value === "no" ? "" : "no")}
                >No</button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-muted" style={{ fontSize: 12, marginTop: 16, fontStyle: "italic" }}>
        ✓ All fields auto-save. To verify, refresh this page — your values will still be here.
      </p>
    </div>
  );
}
