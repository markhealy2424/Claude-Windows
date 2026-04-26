import { generateSketch } from "./sketchGenerator.js";

export function generateProposal({ items, projectName, branding = {} }) {
  const rows = items.map((it) => ({
    item: it.mark,
    qty: it.quantity,
    description: [it.type, it.operation].filter(Boolean).join(", "),
    size: `${it.width_in}" x ${it.height_in}"`,
    price: it.client_price,
    sketch: generateSketch(it),
  }));
  return { projectName, branding, rows, generatedAt: new Date().toISOString() };
  // TODO: branded PDF rendering.
}
