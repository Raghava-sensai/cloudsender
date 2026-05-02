# Email Automation Dashboard

React + Vite dashboard for the Cloudflare email automation Worker.

## Vercel Settings

- Framework preset: `Vite`
- Root directory: `dashboard`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`

## Environment Variables

Set this in Vercel Project Settings:

```text
VITE_API_BASE=https://cloudflare-email-automation-worker.veeraraghava698.workers.dev
```

All frontend API calls go through `VITE_API_BASE` in `src/api.ts`.

See `DEPLOYMENT.md` for the deployment checklist.

The dashboard stores the short-lived bearer token in `localStorage` and sends it as:

```text
Authorization: Bearer <dashboard_token>
```

## Local Development

```powershell
npm install
npm run dev
```

To point at a local Worker, change `.env.development`:

```text
VITE_API_BASE=http://127.0.0.1:8787
```
