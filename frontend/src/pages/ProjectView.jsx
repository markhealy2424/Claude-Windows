import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import ItemEditor from "./ItemEditor.jsx";

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

  return (
    <div>
      <h1>{project.name} <small style={{ color: "#888" }}>· {project.status}</small></h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "Plans" && <div className="card">Plan upload + page tagging — TODO.</div>}
      {tab === "Items" && <ItemEditor items={project.items} onChange={saveItems} />}
      {tab === "RFQ" && <div className="card">Generate RFQ → PDF/Excel — TODO.</div>}
      {tab === "Quotes" && <div className="card">Upload supplier quote + run discrepancy check — TODO.</div>}
      {tab === "Proposal" && <div className="card">Apply markup + branded proposal — TODO.</div>}
    </div>
  );
}
