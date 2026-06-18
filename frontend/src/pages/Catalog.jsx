import { useState } from "react";
import CatalogInternal from "./CatalogInternal.jsx";

const SUB_TABS = ["Internal Catalog"];

export default function Catalog({ initialTab = "Internal Catalog" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="with-subnav">
      <nav className="subnav" aria-label="Catalog sections">
        <div className="subnav-eyebrow">Catalog</div>
        {SUB_TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <div>
        <h1 style={{ marginTop: 0, marginBottom: 16 }}>{tab}</h1>
        {tab === "Internal Catalog" && <CatalogInternal />}
      </div>
    </div>
  );
}
