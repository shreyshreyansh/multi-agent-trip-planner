# Multi-Agent Trip Planner

A focused take-home implementation for a multi-agent AI trip planning assistant.

## What It Does

- Accepts a natural-language trip request from a React 18 + Vite frontend.
- Routes work through three distinct agents: Destination, Itinerary, and Budget.
- Synthesizes one response while showing which agents contributed.
- Persists an audit log of requests, agent participation, provider mode, status, and duration.
- Uses Gemini through a backend adapter when `GEMINI_API_KEY` is present, with deterministic fallback mode when it is not.

## Run Locally

```bash
npm install
cp .env.example .env
# Add GEMINI_API_KEY to .env if you want live Gemini calls.
npm run dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:8787`.

## Useful Commands

```bash
npm test
npm run typecheck
npm run build
npm start
```

## Environment

See `.env.example`. No secrets are committed.

- `GEMINI_API_KEY` enables live Gemini calls.
- `GEMINI_MODEL` defaults to `gemini-3.6-flash`.
- `AUDIT_LOG_PATH` controls the append-only JSONL audit log location.

## API

- `POST /api/trips/plan` with `{ "prompt": "five day trip somewhere warm in Europe for under 1500 pounds" }`
- `GET /api/audit?limit=20`
- `GET /api/metrics`
- `GET /api/health`

## Deployment

This repo includes `render.yaml` and a `Dockerfile`.

For Render:

1. Create a new Render web service from this GitHub repo.
2. Use the included `render.yaml` blueprint or these commands:
   - Build: `npm ci --include=dev && npm run build && npm prune --omit=dev`
   - Start: `npm start`
3. Add `GEMINI_API_KEY` as a secret environment variable.

The free-tier filesystem is suitable for demonstrating the audit trail, but production should move the audit store to a managed database.

## Submission Notes

- [Decision note](docs/decision-note.md)
- [Production architecture note](docs/production-architecture.md)

## AI Assistance Disclosure

Built with AI coding assistance. I reviewed the generated code paths, kept the orchestration explicit, and added tests around the behavior I expect to defend.
