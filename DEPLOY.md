# Deploying Blaze Ignite

Three pieces, one shared database:

| Piece | Where | Why |
|---|---|---|
| Web app (`apps/web`) | **Vercel** | Next.js, serverless-friendly |
| Database | **Vercel Postgres (Neon, free)** | shared by web + bridge |
| Bridge (`apps/bridge`) | **Render / Railway / Fly** | needs an always-on process (a serverless host can't hold the event socket) |

## 1. Database (free)

In the Vercel project → **Storage → Create Database → Postgres (Neon)** (free
tier). Vercel injects a `DATABASE_URL` (and `POSTGRES_*`) into the project. Copy
the `DATABASE_URL` — the bridge needs the same one.

Run the migration once against it (locally):
```bash
DATABASE_URL="<neon url>" npm run db:deploy --workspace packages/db
```

## 2. Web app on Vercel

Project settings:
- **Root Directory:** `apps/web`
- **Framework:** Next.js (auto-detected)
- Install/build/output are auto-detected; `prisma generate` runs via the
  `packages/db` postinstall.

Environment variables (Project → Settings → Environment Variables):
```
DATABASE_URL            (from the Vercel Postgres integration)
BLAZE_CLIENT_ID
BLAZE_CLIENT_SECRET
BLAZE_OAUTH_BASE        https://blaze.stream/bapi/oauth2
BLAZE_REST_BASE         https://api.blaze.stream/v1
BLAZE_WS_URL            https://blaze.stream
BLAZE_WS_PATH           /ws
BLAZE_SCOPES            users.read offline.access channel.moderate users.bot
BLAZE_REDIRECT_URI      https://<your-vercel-domain>/api/auth/blaze/callback
TOKEN_ENCRYPTION_KEY    (openssl rand -base64 32) — MUST match the bridge
AUTH_SESSION_SECRET     (openssl rand -base64 32)
BRIDGE_INTERNAL_SECRET  (openssl rand -base64 32) — MUST match the bridge
NEXT_PUBLIC_BRIDGE_URL  https://<your-bridge-host>
BRIDGE_URL              https://<your-bridge-host>
NEXT_PUBLIC_APP_URL     https://<your-vercel-domain>
```

Then add `https://<your-vercel-domain>/api/auth/blaze/callback` as an OAuth
redirect URI in the Blaze dev console.

## 3. Bridge on Render

Deploy `render.yaml` (Render → New → Blueprint) or a new Web Service pointing at
this repo with:
- Build: `npm ci && npm run build --workspace packages/shared && npm run db:generate && npm run build --workspace apps/bridge`
- Start: `node apps/bridge/dist/main.js`
- Health check path: `/health`

Set these env vars (the crypto/secret values **must match Vercel**):
```
DATABASE_URL, TOKEN_ENCRYPTION_KEY, BRIDGE_INTERNAL_SECRET,
BLAZE_CLIENT_ID, BLAZE_CLIENT_SECRET, BRIDGE_PORT=4000, NODE_ENV=production
```

> Render's free web service sleeps after ~15 min idle. Keep it warm by pinging
> `/health` every few minutes (e.g. a free cron-job.org job), or use a paid plan
> / Fly.io for a truly always-on socket.

## 4. Go live

Push to the connected GitHub repo → Vercel auto-builds the web app; redeploy the
bridge. Open the Vercel URL, connect your Blaze channel, and add the overlay URLs
to OBS.
