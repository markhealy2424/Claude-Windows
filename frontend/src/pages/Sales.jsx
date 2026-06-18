import { useState } from "react";
import SalesPipeline from "./SalesPipeline.jsx";
import SalesAgent from "./SalesAgent.jsx";
import SalesResources from "./SalesResources.jsx";

const SUB_TABS = ["Pipeline", "AI Agent", "Resources"];

export default function Sales({ initialTab = "Pipeline" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="with-subnav">
      <nav className="subnav" aria-label="Sales sections">
        <div className="subnav-eyebrow">Sales</div>
        {SUB_TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <div>
        <h1 style={{ marginTop: 0, marginBottom: 16 }}>{tab}</h1>
        {tab === "Pipeline" && <SalesPipeline />}
        {tab === "AI Agent" && <SalesAgent />}
        {tab === "Resources" && <SalesResources />}
      </div>
    </div>
  );
}
