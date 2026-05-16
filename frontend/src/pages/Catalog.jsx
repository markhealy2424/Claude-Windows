import { useState } from "react";
import CatalogInternal from "./CatalogInternal.jsx";

const SUB_TABS = ["Internal Catalog"];

export default function Catalog({ initialTab = "Internal Catalog" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: 12 }}>Catalog</h1>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {SUB_TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "Internal Catalog" && <CatalogInternal />}
    </div>
  );
}
