// Per-project window/door requirements that show up on the RFQ. Each is a
// yes/no question; two have an optional free-text "specify if not" field
// that only matters when the user picks "no".

export const REQUIREMENTS = [
  { key: "dualGlazed",       label: "All windows dual glazed?" },
  { key: "argonFilled",      label: "All windows argon filled?" },
  { key: "thermallyBroken",  label: "All aluminum thermally broken?" },
  { key: "nfrc",             label: "All windows NFRC certified?" },
  { key: "aamaCertified",    label: "All windows AAMA (American Architectural Manufacturers Association) certified?" },
  { key: "modernHardware",   label: "Modern styled hardware?" },
  { key: "narrowFrame",      label: "Narrow styled frame?", hasSpec: true, specLabel: "If not narrow, specify frame style" },
  { key: "retractableScreen",label: "Retractable folded screen?" },
  { key: "nailFin",          label: "New construction style (with nail fin)?" },
  { key: "powderCoatedBlack",label: "Powder coated black color?", hasSpec: true, specLabel: "If not black, specify color" },
];
