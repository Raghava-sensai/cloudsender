# Vercel Deployment Checklist

## Project Settings

- Root Directory: `dashboard`
- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

## Environment Variables

Set this in Vercel:

```text
VITE_API_BASE=https://cloudflare-email-automation-worker.veeraraghava698.workers.dev
```

## API Routing

All dashboard API calls are routed through `src/api.ts` and use `VITE_API_BASE`.

Authenticated calls include:

```text
Authorization: Bearer <dashboard_token>
```

## Required Worker State

Deploy the Worker before deploying this dashboard, because the dashboard expects:

- `POST /auth/login`
- `GET /auth/me`
- `GET/POST/PATCH/DELETE /triggers`
- `GET/PATCH /templates`
- `GET /logs`
- `POST /preview`
- `POST /events`
