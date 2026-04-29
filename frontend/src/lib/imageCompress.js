// Downscale + recompress an uploaded image so it can be embedded in the
// project JSON without bloating it. Screenshots of windows/doors are
// usually fine at ≤ 800px on the long edge and JPEG quality 0.85.
//
// Returns a base64 data URL ready to drop on item.sketchImage.
export async function compressImageToDataUrl(file, opts = {}) {
  const { maxDim = 800, quality = 0.85, mime = "image/jpeg" } = opts;
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("Could not decode image"));
      i.src = objectUrl;
    });
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const ratio = Math.min(1, maxDim / longest);
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    // JPEG can't hold an alpha channel — paint a white background so
    // transparent PNGs don't render as solid black.
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL(mime, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
