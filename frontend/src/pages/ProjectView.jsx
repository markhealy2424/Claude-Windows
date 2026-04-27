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

  async function saveItems(items) {
    const updated = await api.updateProject(id, { items });
    setProject(updated);
  }

  async function savePatch(patch) {
    const updated = await api.updateProject(id, patch);
    setProject(updated);
  }

  return (
    <div>
      <h1>{project.name} <small style={{ color: "#888" }}>· {project.status}</small></h1>
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
