import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api.js";
import ItemEditor from "./ItemEditor.jsx";
import RFQTab from "./RFQTab.jsx";
import QuotesTab from "./QuotesTab.jsx";
import ProposalTab from "./ProposalTab.jsx";
import CompareTab from "./CompareTab.jsx";
import PlansTab from "./PlansTab.jsx";
import ProjectInfo from "./ProjectInfo.jsx";
import MoneyTab from "./MoneyTab.jsx";
import DrawingsTab from "./DrawingsTab.jsx";
import QuestionsTab from "./QuestionsTab.jsx";
import { StatusSelect } from "./Dashboard.jsx";

const TABS = ["Project Info", "Plans", "Items", "Questions for Client", "RFQ", "Quotes", "Compare", "Proposal", "Drawings", "Money"];

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("Items");
  // Per-keystroke PATCHes can race: an older response carrying an older
  // snapshot of the project arrives AFTER a newer one and clobbers freshly
  // typed input ("letters get deleted as I type"). Track the latest issued
  // patch and ignore any response that isn't the latest.
  const latestPatchRef = useRef(0);

  useEffect(() => { api.getProject(id).then(setProject); }, [id]);

  if (!project) return <div>Loading…</div>;

  async function savePatch(patch) {
    setProject((p) => (p ? { ...p, ...patch } : p));
    const myReq = ++latestPatchRef.current;
    try {
      const updated = await api.updateProject(id, patch);
      if (myReq !== latestPatchRef.current) return;  // a newer keystroke is in flight
      setProject(updated);
    } catch (err) {
      console.error("savePatch failed:", err);
      if (myReq !== latestPatchRef.current) return;
      api.getProject(id).then(setProject).catch(() => {});
    }
  }

  async function saveItems(items) {
    return savePatch({ items });
  }

  // One-line project identity for the header — surfaces what's otherwise
  // buried in the Project Info tab so every tab shows who/where at a glance.
  const subtitleParts = [
    project.info?.buyerName,
    project.info?.company,
    project.info?.address,
  ].filter(Boolean);

  return (
    <div className="with-subnav">
      <nav className="subnav" aria-label="Project sections">
        <div className="subnav-eyebrow">Project</div>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <div>
        <div className="page-header">
          <div style={{ minWidth: 0 }}>
            <div className="breadcrumb">
              <Link to="/projects">← Projects</Link>
            </div>
            <h1 style={{ margin: 0 }}>{project.name}</h1>
            {subtitleParts.length > 0 && (
              <div className="text-muted" style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>
                {subtitleParts.join(" · ")}
              </div>
            )}
          </div>
          <div className="project-status">
            <span className="project-status-label">Status</span>
            <StatusSelect
              value={project.status}
              onChange={(status) => savePatch({ status })}
            />
          </div>
        </div>
        {tab === "Project Info" && <ProjectInfo project={project} onChange={savePatch} />}
        {tab === "Plans" && <PlansTab project={project} onChange={savePatch} />}
        {tab === "Items" && <ItemEditor items={project.items} onChange={saveItems} />}
        {tab === "Questions for Client" && (
          <QuestionsTab
            items={project.items ?? []}
            projectName={project.name}
            info={project.info ?? {}}
            onChange={saveItems}
          />
        )}
        {tab === "RFQ" && <RFQTab project={project} />}
        {tab === "Quotes" && <QuotesTab project={project} onChange={savePatch} />}
        {tab === "Compare" && <CompareTab project={project} onChange={savePatch} />}
        {tab === "Proposal" && <ProposalTab project={project} onChange={savePatch} />}
        {tab === "Drawings" && <DrawingsTab project={project} onChange={savePatch} />}
        {tab === "Money" && <MoneyTab project={project} onChange={savePatch} />}
      </div>
    </div>
  );
}
