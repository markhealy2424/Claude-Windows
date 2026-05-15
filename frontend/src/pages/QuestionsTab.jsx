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

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))" }}>
        {flagged.map(([it, i]) => (
          <QuestionCard
            key={i}
            item={it}
            onChangeQuestion={(v) => updateAt(i, { clientQuestion: v })}
            onClear={() => clearFlag(i)}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({ item, onChangeQuestion, onClear }) {
  const kindLabel = isDoor(item) ? "Door" : "Window";
  const dims = [
    item.width_in ? `${item.width_in}"W` : null,
    item.height_in ? `${item.height_in}"H` : null,
    item.panels && item.panels > 1 ? `${item.panels} panels` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="card" style={{ borderLeft: "4px solid #C68B00", background: "#FFFCEF" }}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 80, minWidth: 80 }}
             dangerouslySetInnerHTML={{ __html: item.sketchImage?.startsWith?.("data:image/")
               ? `<img src="${item.sketchImage}" style="width:80px;max-height:80px;object-fit:contain;" />`
               : generateSketch(item) }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div>
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                {kindLabel} · {item.type || "—"}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                {item.mark || "(no mark)"}
              </div>
              {dims && <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>{dims}</div>}
              {item.quantity > 0 && (
                <div className="text-muted" style={{ fontSize: 12 }}>Qty: {item.quantity}</div>
              )}
            </div>
            <button onClick={onClear} title="Mark as resolved — removes the flag">Resolved</button>
          </div>
        </div>
      </div>

      <label style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 12 }}>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600, color: "var(--color-text-muted)" }}>
          Question for the client
        </span>
        <textarea
          value={item.clientQuestion ?? ""}
          onChange={(e) => onChangeQuestion(e.target.value)}
          placeholder="e.g. Confirm tempered glass on bathroom window? Sliding direction left or right?"
          rows={3}
          style={{ width: "100%", padding: 8, fontSize: 13, lineHeight: 1.4, borderRadius: 4, border: "1px solid var(--color-border)", background: "#fff", resize: "vertical" }}
        />
      </label>

      {item.notes && (
        <div className="text-subtle" style={{ fontSize: 12, marginTop: 8 }}>
          <strong>Existing notes:</strong> {item.notes}
        </div>
      )}
    </div>
  );
}
