import { useEffect, useState } from "react";
import { generateSketch } from "../lib/sketch.js";
import { isDoor } from "../lib/itemKind.js";

// Lists every item flagged "needs special attention" on the Items tab and
// gives the user a place to write the question they need to ask the client.
// Toggling the flag here keeps the Items tab and this view in sync.

export default function QuestionsTab({ items = [], onChange }) {
  const flagged = items
    .map((it, i) => [it, i])
    .filter(([it]) => it.needsAttention);

  function updateAt(idx, patch) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function clearFlag(idx) {
    updateAt(idx, { needsAttention: false });
  }

  if (flagged.length === 0) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>No items flagged yet</h3>
        <p className="text-muted" style={{ fontSize: 13, marginTop: 0 }}>
          Open the <strong>Items</strong> tab and tick the ⚠ checkbox on any item that
          needs to be confirmed with the client. Flagged items will appear here with
          a place to record the question you want to ask.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0, marginBottom: 4 }}>
          Questions for client · {flagged.length} item{flagged.length === 1 ? "" : "s"}
        </h3>
        <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
          One card per flagged item. Type the question that needs to be confirmed with the client.
          Edits save automatically. Hit <strong>Resolved</strong> to clear the flag once you have an answer.
        </p>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(460px, 1fr))" }}>
        {flagged.map(([it, i]) => (
          <QuestionCard
            key={i}
            item={it}
            onChangeQuestion={(v) => updateAt(i, { clientQuestion: v })}
            onChangeResponse={(v) => updateAt(i, { clientResponse: v })}
            onClear={() => clearFlag(i)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ item, onChangeQuestion, onChangeResponse, onClear }) {
  const kindLabel = isDoor(item) ? "Door" : "Window";
  const metaParts = [
    item.width_in ? `${item.width_in}"W` : null,
    item.height_in ? `${item.height_in}"H` : null,
    item.panels && item.panels > 1 ? `${item.panels} panels` : null,
    item.quantity > 0 ? `Qty ${item.quantity}` : null,
  ].filter(Boolean);

  const sketchHtml = item.sketchImage && item.sketchImage.startsWith?.("data:image/")
    ? `<img src="${item.sketchImage}" alt="" />`
    : generateSketch(item);

  return (
    <div className="question-card">
      <div className="question-card-head">
        <div style={{ minWidth: 0 }}>
          <div className="text-muted question-eyebrow">
            {kindLabel} · {item.type || "—"}
          </div>
          <div className="question-mark">{item.mark || "(no mark)"}</div>
          {metaParts.length > 0 && (
            <div className="question-meta">{metaParts.join(" · ")}</div>
          )}
        </div>
        <button onClick={onClear} title="Clear the attention flag once the client confirms">Resolved</button>
      </div>

      <div className="question-body">
        <div
          className="question-sketch"
          dangerouslySetInnerHTML={{ __html: sketchHtml }}
        />
        <div className="question-body-right">
          <EditableField
            label="Question for the client"
            value={item.clientQuestion ?? ""}
            onSave={onChangeQuestion}
            placeholder="e.g. Confirm tempered glass on bathroom window? Sliding direction left or right?"
            emptyPlaceholder="No question entered yet."
            addLabel="+ Add question"
          />
        </div>
      </div>

      <div className="question-response">
        <EditableField
          label="Response from client"
          value={item.clientResponse ?? ""}
          onSave={onChangeResponse}
          placeholder="Paste or type the client's answer here…"
          emptyPlaceholder="No response yet."
          addLabel="+ Add response"
        />
      </div>

      {item.notes && (
        <div className="question-notes">
          <strong>Existing notes:</strong> {item.notes}
        </div>
      )}
    </div>
  );
}

// Three states: editing (textarea + Save / Cancel), saved (read-only text +
// Edit), or empty-and-not-editing (placeholder + Add button — only reachable
// if the user clicks Cancel before saving anything).
function EditableField({ label, value, onSave, placeholder, emptyPlaceholder, addLabel }) {
  // Auto-open the editor when there's nothing saved yet so a fresh card is
  // immediately typable. After save, only an explicit Edit click reopens it.
  const [editing, setEditing] = useState(!value);
  const [draft, setDraft] = useState(value ?? "");

  // Keep the draft in sync if the saved value changes externally (e.g. the
  // parent list re-orders items and re-renders the card).
  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  function save() {
    onSave(draft.trim());
    setEditing(false);
  }
  function cancel() {
    setDraft(value ?? "");
    setEditing(false);
  }
  function startEdit() {
    setDraft(value ?? "");
    setEditing(true);
  }

  return (
    <div className="question-field">
      <span className="question-label">{label}</span>
      {editing ? (
        <>
          <textarea
            className="question-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            autoFocus={!value}
          />
          <div className="question-edit-row">
            {value && <button onClick={cancel}>Cancel</button>}
            <button className="primary" onClick={save} disabled={draft.trim() === (value ?? "")}>
              Save
            </button>
          </div>
        </>
      ) : value ? (
        <>
          <div className="question-saved-text">{value}</div>
          <div className="question-saved-row">
            <button onClick={startEdit}>Edit</button>
          </div>
        </>
      ) : (
        <>
          <div className="question-empty-placeholder">{emptyPlaceholder}</div>
          <div className="question-saved-row">
            <button onClick={startEdit}>{addLabel}</button>
          </div>
        </>
      )}
    </div>
  );
}
