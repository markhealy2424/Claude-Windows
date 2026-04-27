import { useEffect, useState } from "react";

const labelStyle = { display: "flex", flexDirection: "column", gap: 2 };
const captionStyle = { fontSize: 11, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 };

export function NumberField({ label, value, onChange, style, inputStyle, ...rest }) {
  const [text, setText] = useState(value == null ? "" : String(value));

  useEffect(() => {
    setText(value == null ? "" : String(value));
  }, [value]);

  function handleFocus(e) {
    if (text === "0") {
      setText("");
    } else {
      e.target.select();
    }
  }

  function handleChange(e) {
    const v = e.target.value;
    setText(v);
    if (v === "" || v === "-") return;
    const n = Number(v);
    if (!Number.isNaN(n)) onChange(n);
  }

  function handleBlur() {
    if (text === "" || text === "-") {
      setText("0");
      onChange(0);
    }
  }

  return (
    <label style={{ ...labelStyle, ...style }}>
      <span style={captionStyle}>{label}</span>
      <input
        type="number"
        value={text}
        onFocus={handleFocus}
        onChange={handleChange}
        onBlur={handleBlur}
        style={inputStyle}
        {...rest}
      />
    </label>
  );
}

export function TextField({ label, value, onChange, style, inputStyle, ...rest }) {
  return (
    <label style={{ ...labelStyle, ...style }}>
      <span style={captionStyle}>{label}</span>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        {...rest}
      />
    </label>
  );
}

export function SelectField({ label, value, onChange, options, style, ...rest }) {
  return (
    <label style={{ ...labelStyle, ...style }}>
      <span style={captionStyle}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {options.map((o) => {
          const [val, lbl] = Array.isArray(o) ? o : [o, o];
          return <option key={val} value={val}>{lbl}</option>;
        })}
      </select>
    </label>
  );
}
