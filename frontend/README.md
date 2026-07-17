# Exposure Triage Assistant — Frontend

Next.js (App Router), TypeScript, Tailwind CSS. Ships as a static export
(`output: "export"` in `next.config.ts`) — no Node server in production.

See the [repo root README](../README.md) for the full picture: what this app does, running it
locally, and deployment.

## Local dev

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL should match the backend port
npm run dev
```
