import express from "express";
import cors from "cors";
import projects from "./routes/projects.js";
import plans from "./routes/plans.js";
import rfq from "./routes/rfq.js";
import quotes from "./routes/quotes.js";
import proposals from "./routes/proposals.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "25mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/projects", projects);
app.use("/api/plans", plans);
app.use("/api/rfq", rfq);
app.use("/api/quotes", quotes);
app.use("/api/proposals", proposals);

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`api listening on :${port}`));
