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
