import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import projects from "./routes/projects.js";
import plans from "./routes/plans.js";
import rfq from "./routes/rfq.js";
import quotes from "./routes/quotes.js";
import proposals from "./routes/proposals.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

// Diagnostic endpoint — surfaces which optional modules loaded and what env
// vars are present (key names only, never values). Helps debug deploy issues
// without needing access to logs.
app.get("/diag", async (_req, res) => {
  const out = {
    ok: true,
    node: process.version,
    pid: process.pid,
    env: {
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? "set" : "missing",
      DATA_DIR: process.env.DATA_DIR ?? "(unset, defaulting to backend/data)",
      NODE_ENV: process.env.NODE_ENV ?? "(unset)",
      PORT: process.env.PORT ?? "(unset, defaulting to 4000)",
    },
    modules: {},
  };
  for (const [name, path] of [
    ["@anthropic-ai/sdk", "@anthropic-ai/sdk"],
    ["pdfjs-dist", "pdfjs-dist/legacy/build/pdf.mjs"],
    ["pdfkit", "pdfkit"],
    ["svg-to-pdfkit", "svg-to-pdfkit"],
    ["visionMarkDetection", "./engines/visionMarkDetection.js"],
    ["visionScheduleExtraction", "./engines/visionScheduleExtraction.js"],
  ]) {
    try {
      await import(path);
      out.modules[name] = "ok";
    } catch (err) {
      out.modules[name] = `error: ${err.message}`;
    }
  }
  res.json(out);
});

app.use("/api/projects", projects);
app.use("/api/plans", plans);
app.use("/api/rfq", rfq);
app.use("/api/quotes", quotes);
app.use("/api/proposals", proposals);

const frontendDist = resolve(__dirname, "../../frontend/dist");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(resolve(frontendDist, "index.html"));
  });
}

const port = Number(process.env.PORT) || 4000;
app.listen(port, "0.0.0.0", () => {
  console.log(`api listening on 0.0.0.0:${port}`);
});

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});
