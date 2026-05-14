import { useMemo } from "react";
import { NumberField } from "../lib/Fields.jsx";
import {
  emptyFinancials,
  getFinancials,
  money,
  projectSummary,
  todayIso,
} from "../lib/financials.js";

export default function MoneyTab({ project, onChange }) {
  const f = useMemo(() => ({ ...emptyFinancials(), ...getFinancials(project) }), [project]);
  const summary = useMemo(() => projectSummary(project), [project]);

  function persist(patch) {
    onChange({ financials: { ...f, ...patch } });
  }

  function addReceipt() {
    persist({
      clientReceipts: [
        ...f.clientReceipts,
        { id: crypto.randomUUID(), date: todayIso(), amount: 0, method: "", notes: "" },
      ],
    });
  }

  function updateReceipt(id, patch) {
    persist({
      clientReceipts: f.clientReceipts.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function removeReceipt(id) {
    persist({ clientReceipts: f.clientReceipts.filter((r) => r.id !== id) });
  }

  function addPayment() {
    persist({
      supplierPayments: [
        ...f.supplierPayments,
        { id: crypto.randomUUID(), date: todayIso(), supplier: "", amount: 0, notes: "" },
      ],
    });
  }

  function updatePayment(id, patch) {
    persist({
      supplierPayments: f.supplierPayments.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  function removePayment(id) {
    persist({ supplierPayments: f.supplierPayments.filter((p) => p.id !== id) });
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Project P&amp;L</h3>
        <div className="row" style={{ gap: 32, flexWrap: "wrap" }}>
          <Stat label="Client quoted" value={money(summary.clientQuoted)} />
          <Stat label="Client paid" value={money(summary.clientReceived)} color="#15623F" />
          <Stat label="Client owes" value={money(summary.clientOutstanding)} color={summary.clientOutstanding > 0 ? "#94251A" : "#666"} />
          <Stat label="Supplier paid" value={money(summary.supplierPaid)} color="#94251A" />
          <Stat
            label="Profit so far"
            value={money(summary.profit)}
            color={summary.profit >= 0 ? "#15623F" : "#94251A"}
            big
          />
          <Stat
            label="Expected profit"
            value={money(summary.expectedProfit)}
            color={summary.expectedProfit >= 0 ? "#15623F" : "#94251A"}
            hint="if client pays full quoted amount"
          />
        </div>
        <div className="row" style={{ marginTop: 12, alignItems: "flex-end" }}>
          <NumberField
            label="Client quoted ($)"
            value={f.clientQuoted}
            onChange={(v) => persist({ clientQuoted: Number(v) || 0 })}
            inputStyle={{ width: 140 }}
          />
          <span className="text-subtle" style={{ fontSize: 12, paddingBottom: 6 }}>
            Set this to the contract amount. Drives the "owes" and "expected profit" numbers.
          </span>
        </div>
      </div>

      <Ledger
        title="Client payments received"
        emptyMessage="No client payments logged yet."
        rows={f.clientReceipts}
        onAdd={addReceipt}
        onUpdate={updateReceipt}
        onRemove={removeReceipt}
        columns={[
          { key: "date", label: "Date", type: "date", width: 130 },
          { key: "amount", label: "Amount ($)", type: "number", width: 120 },
          { key: "method", label: "Method", type: "text", width: 140, placeholder: "Check / wire / card" },
          { key: "notes", label: "Notes", type: "text", width: 280 },
        ]}
        footerLabel="Total received"
        footerValue={money(summary.clientReceived)}
      />

      <Ledger
        title="Supplier payments"
        emptyMessage="No supplier payments logged yet."
        rows={f.supplierPayments}
        onAdd={addPayment}
        onUpdate={updatePayment}
        onRemove={removePayment}
        columns={[
          { key: "date", label: "Date", type: "date", width: 130 },
          { key: "supplier", label: "Paid to", type: "text", width: 180 },
          { key: "amount", label: "Amount ($)", type: "number", width: 120 },
          { key: "notes", label: "Notes", type: "text", width: 280 },
        ]}
        footerLabel="Total paid"
        footerValue={money(summary.supplierPaid)}
      />
    </div>
  );
}

function Stat({ label, value, color, big, hint }) {
  return (
    <div>
      <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: big ? 22 : 18, fontWeight: 700, color: color || "#222", marginTop: 4 }}>
        {value}
      </div>
      {hint && <div className="text-subtle" style={{ fontSize: 11, marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

export function Ledger({ title, emptyMessage, rows, columns, onAdd, onUpdate, onRemove, footerLabel, footerValue }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <button onClick={onAdd}>+ Add row</button>
      </div>
      <table>
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key}>
                  <input
                    type={c.type}
                    value={row[c.key] ?? (c.type === "number" ? 0 : "")}
                    placeholder={c.placeholder ?? ""}
                    onChange={(e) => {
                      const v = c.type === "number" ? (Number(e.target.value) || 0) : e.target.value;
                      onUpdate(row.id, { [c.key]: v });
                    }}
                    onFocus={(e) => c.type === "number" && e.target.select()}
                    style={{ width: c.width }}
                  />
                </td>
              ))}
              <td><button onClick={() => onRemove(row.id)} title="Delete row">×</button></td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + 1} className="text-subtle">{emptyMessage}</td></tr>
          )}
        </tbody>
        {rows.length > 0 && footerLabel && (
          <tfoot>
            <tr>
              <td colSpan={columns.length} style={{ textAlign: "right", fontWeight: 600 }}>{footerLabel}</td>
              <td style={{ fontWeight: 600 }}>{footerValue}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
