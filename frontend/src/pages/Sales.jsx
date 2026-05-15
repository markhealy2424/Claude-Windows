import { useState } from "react";
import SalesPipeline from "./SalesPipeline.jsx";
import SalesAgent from "./SalesAgent.jsx";
import SalesResources from "./SalesResources.jsx";

const SUB_TABS = ["Pipeline", "AI Agent", "Resources"];

export default function Sales({ initialTab = "Pipeline" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <h1 style={{ marginTop: 0, marginBottom: 12 }}>Sales</h1>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {SUB_TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "Pipeline" && <SalesPipeline />}
      {tab === "AI Agent" && <SalesAgent />}
      {tab === "Resources" && <SalesResources />}
    </div>
  );
}
