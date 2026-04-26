import { generateSketch } from "./sketchGenerator.js";

export function generateRFQ({ items, projectName }) {
  const rows = items.map((it) => ({
    mark: it.mark,
    qty: it.quantity,
    sketch: generateSketch(it),
    type: it.type,
    width: it.width_in,
    height: it.height_in,
    operation: it.operation,
    notes: it.notes ?? "",
  }));
  return { projectName, rows, generatedAt: new Date().toISOString() };
  // TODO: PDF/Excel export (pdfkit / exceljs).
}
