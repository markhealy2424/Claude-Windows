// Extracts text + positions per page from a digital PDF using pdfjs-dist (Node-friendly legacy build).
// Returns: [{ pageNumber, width, height, items: [{ str, x, y, w, h, fontSize }] }]
// Coordinates are in PDF user units, origin bottom-left.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPlan(pdfBuffer) {
  const data = new Uint8Array(pdfBuffer);
  const pdf = await getDocument({ data, disableFontFace: true, useSystemFonts: false }).promise;
  const pages = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent({ includeMarkedContent: false });

    const items = tc.items
      .filter((it) => "str" in it && it.str.trim() !== "")
      .map((it) => {
        const x = it.transform[4];
        const y = it.transform[5];
        const fontSize = Math.hypot(it.transform[2], it.transform[3]);
        return {
          str: it.str,
          x,
          y,
          w: it.width,
          h: it.height || fontSize,
          fontSize,
        };
      });

    pages.push({
      pageNumber: p,
      width: viewport.width,
      height: viewport.height,
      items,
    });

    page.cleanup();
  }

  await pdf.cleanup();
  return pages;
}
