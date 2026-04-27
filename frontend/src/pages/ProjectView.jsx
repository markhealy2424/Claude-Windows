import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import ItemEditor from "./ItemEditor.jsx";
import RFQTab from "./RFQTab.jsx";
import QuotesTab from "./QuotesTab.jsx";
import ProposalTab from "./ProposalTab.jsx";
import PlansTab from "./PlansTab.jsx";

const TABS = ["Plans", "Items", "RFQ", "Quotes", "Proposal"];

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("Items");

  useEffect(() => { api.getProject(id).then(setProject); }, [id]);

  if (!project) return <div>Loading…</div>;

  async function savePatch(patch) {
    setProject((p) => (p ? { ...p, ...patch } : p));
    try {
      const updated = await api.updateProject(id, patch);
      setProject(updated);
    } catch (err) {
      console.error("savePatch failed:", err);
      api.getProject(id).then(setProject).catch(() => {});
    }
  }

  async function saveItems(items) {
    return savePatch({ items });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <a href="/">← Projects</a>
          </div>
          <h1 style={{ margin: 0 }}>{project.name}</h1>
        </div>
        <span className="badge accent">{project.status}</span>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "Plans" && <PlansTab project={project} onChange={savePatch} />}
      {tab === "Items" && <ItemEditor items={project.items} onChange={saveItems} />}
      {tab === "RFQ" && <RFQTab project={project} />}
      {tab === "Quotes" && <QuotesTab project={project} onChange={savePatch} />}
      {tab === "Proposal" && <ProposalTab project={project} onChange={savePatch} />}
    </div>
  );
}
