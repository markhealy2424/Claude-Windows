# Window Stream

Multi-tenant SaaS for window and door contractors: a quote-automation platform.

Processes building plan PDFs to extract window/door schedules, generates RFQs, parses supplier quotes, detects discrepancies, applies pricing markup, and outputs branded client proposals.

See `REQUIREMENTS.md` for the full Requirements Design Framework.

## Structure

```
frontend/   React + Vite UI
backend/    Node.js + Express API and engines
```

## Quick start

```bash
# backend
cd backend && npm install && npm run dev

# frontend (in another terminal)
cd frontend && npm install && npm run dev
```

## Deployment / persistence

Uploaded files (final drawings, supplier-quote PDFs, plans) and the JSON
store (projects, company expenses) all live under `DATA_DIR`. **In
production this must point at a mounted volume**, otherwise everything is
wiped on every redeploy.

### Railway

1. Open the service in the Railway dashboard → **Settings → Volumes**.
2. Click **+ New Volume**, mount path: `/data`, size: 1–5 GB to start.
3. Open **Variables** and set `DATA_DIR=/data`.
4. Redeploy. The startup log will print `[storage] persistent volume:
   DATA_DIR=/data` when wired correctly, or a `WARNING: DATA_DIR is not
   set` line when it isn't.

### Fly.io

The volume mount is already declared in `fly.toml` (`source = "data"`,
`destination = "/data"`) and `DATA_DIR=/data` is set under `[env]`. You
just need to run `fly volumes create data --size 1` once per region
before the first deploy.

## Status

MVP scaffolding only — engines are stubs. See `REQUIREMENTS.md` §7 for MVP build requirements.
