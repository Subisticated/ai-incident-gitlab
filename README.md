# AI Incident Copilot

End-to-end GitLab incident triage helper made of three services:

1. **Backend API (`/backend`)** – Express + MongoDB service that ingests GitLab pipeline webhooks, stores incidents/projects, and orchestrates automation (AI RCA, patch generation, and merge requests).
2. **AI service (`/ai-service`)** – Thin Express wrapper over Groq (primary) and Gemini (fallback) that produces RCA summaries and unified diffs.
3. **Frontend (`/frontend`)** – Vite + React dashboard for viewing incidents, analyses, patches, and MR status.

This document explains how to set up all three pieces locally and which environment variables you need for each.

## Requirements

- Node.js 18+ and npm
- MongoDB 6+ running locally or in the cloud
- A GitLab Personal/Project Access Token with `api` scope (used to read repos, create branches/MRs, retry pipelines)
- Groq API key (`llama-3.3-70b-versatile`) and optionally a Gemini key for fallback
- (Optional) `ngrok` if you want to expose your backend webhook endpoint to GitLab while developing locally

## Repository layout

```
backend/       # Express API, Mongo models, GitLab + automation services
ai-service/    # Prompt templates + LLM calls (Groq/Gemini)
frontend/      # Vite React UI
README.md
```

## Environment configuration

Create a `.env` file **inside each service folder**. The values below are safe defaults for local work; replace secrets with your own.

### backend/.env

```
PORT=4000
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=incident_copilot

# Where the AI microservice is running
AI_SERVICE_URL=http://localhost:5001
AI_SERVICE_TOKEN=dev-token

# GitLab
GITLAB_BASE_URL=https://gitlab.com/api/v4
```

> The backend stores GitLab project metadata (project ID, access token, default branch) in MongoDB, so you only need `GITLAB_BASE_URL` globally.

### ai-service/.env

```
AI_PORT=5001
AI_SERVICE_TOKEN=dev-token
GROQ_API_KEY=sk-groq-...
# Optional, only used when Groq fails
GEMINI_API_KEY=AIza...
```

### frontend/.env (or `.env.local`)

```
VITE_API_URL=http://localhost:4000
```

Point `VITE_API_URL` wherever the backend is exposed (local port, ngrok URL, or a deployed API).

## Local development workflow

Open three terminals (MongoDB should already be running):

```powershell
# 1) Backend API
cd backend
npm install
npm run dev

# 2) AI microservice
cd ../ai-service
npm install
npm run dev

# 3) Frontend
cd ../frontend
npm install
npm run dev
```

Key endpoints once everything is running:

| Service   | URL                             |
|-----------|---------------------------------|
| Backend   | http://localhost:4000           |
| AI        | http://localhost:5001           |
| Frontend  | http://localhost:5173 (default) |

Use `npm start` instead of `npm run dev` on backend/ai-service for production-style runs (without nodemon).

## Registering projects and incidents

1. Insert a `Project` document (via API or Mongo shell) with:
   - `gitlabProjectId`
   - `gitlabUrl`
   - `gitlabAccessToken`
   - `defaultBranch`
2. Point GitLab pipeline webhooks to `POST /api/webhooks` on your backend. When running locally, expose the backend with ngrok:

```powershell
ngrok http 4000
```

Use the generated HTTPS URL as the webhook target so GitLab can reach your machine.

When a pipeline fails, the webhook creates an `Incident` document, which automatically triggers:

1. AI RCA via the ai-service
2. Patch generation + validation
3. Branch creation + merge request on GitLab

Retry pipelines (MR pipelines) are also listened to so the system can attempt another fix.

## Useful commands & checks

- **Backend health**: `GET /api/health`
- **List incidents**: `GET /api/incidents`
- **Trigger RCA manually**: `POST /api/incidents/:id/analysis`
- **Trigger patch manually**: `POST /api/incidents/:id/patch`

## Troubleshooting tips

- **AI service 401** – Ensure both backend and ai-service share the same `AI_SERVICE_TOKEN`.
- **Patch validation errors** – Check `AIPatch.validationError` in MongoDB for the exact validator failure.
- **GitLab 404/401** – Confirm the stored project token has `api` scope and that `gitlabProjectId` matches the numeric ID from GitLab.
- **Webhook unreachable** – Run ngrok (or expose via your own tunnel) and update the GitLab webhook URL.
- **Mongo errors** – Verify `MONGO_URI` and that MongoDB is reachable before starting the backend.

## Contributing

1. Fork the repo and create a feature branch.
2. Keep the three services running locally (backend, ai-service, frontend) while you develop.
3. Add tests or manual steps that describe how you verified your change (especially around automation).
4. Open a PR describing the change, affected services, and any env updates.

## License

Add your preferred license text/file if required for distribution.
