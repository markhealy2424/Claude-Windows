import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import ProjectSummary from "./ProjectSummary.jsx";
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

const TABS = ["Project Summary", "Project Info", "Plans", "Items", "Questions for Client", "RFQ", "Quotes", "Compare", "Proposal", "Drawings", "Financial"];

export default function ProjectView() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState("Project Summary");
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

  return (
    <div className="with-subnav">
      <nav className="subnav" aria-label="Project sections">
        <div className="subnav-title">{project.name}</div>
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <div>
        {tab === "Project Summary" && <ProjectSummary project={project} onChange={savePatch} />}
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
        {tab === "Financial" && <MoneyTab project={project} onChange={savePatch} />}
      </div>
    </div>
  );
}
