# 🔥 Blaze Ignite — Support & Vote-to-Action

**Real Blaze events → live, on-stream overlays.**

Blaze Ignite is a creator toolkit for the [Blaze](https://blaze.stream) live-streaming
platform. It turns a streamer's real on-platform events — **Thanks** (support),
**Backstage votes**, **subscriptions**, **gifted subs**, and **follows** — into
animated **OBS overlays**: alerts, funding goals, tip-wars, boss battles, and a
live Backstage **Spotlight** leaderboard. It also shows the live **$BLAZE → USD**
value everywhere amounts appear.

No virtual coins, no AI gimmicks — every overlay is driven by a genuine Blaze
EventSub event, delivered in real time over WebSocket.

**▶ Live demo:** https://blaze-ignite-web.vercel.app — connect your own Blaze
channel and drop the overlay URLs into OBS.

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Repository layout (code by topic)](#repository-layout-code-by-topic)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [OBS overlay usage](#obs-overlay-usage)
- [Blaze API integration notes](#blaze-api-integration-notes)
- [Testing](#testing)
- [Deployment](#deployment)
- [Environment variables](#environment-variables)
- [License](#license)

---

## Features

**Overlays (OBS browser sources)**
- **Alerts** — animated pop-ups for Thanks, follows, subscriptions, and gifted
  subs. Fully editable message per event type with `{name}` / `{amount}`
  placeholders, per-alert theme, animation, and on-screen duration.
- **Goals** — a progress bar funded by Thanks, toward a target you set.
- **Tip-wars** — viewers pick a side by putting an option keyword in their
  Thanks message; bars race in real time.
- **Boss battles** — collective Thanks chip away a boss's `$BLAZE` health bar.
- **Backstage Spotlight** — a live, on-stream leaderboard of Backstage votes for
  the current epoch, showing voter wallets — surfacing on-chain governance that
  Blaze otherwise only shows on its website.

**Creator dashboard**
- One-click **Blaze OAuth** connect.
- Per-event alert editors with **live Preview** (fires a sample to the overlay).
- Goal / boss / tip-war editors; changes reflect on overlays instantly.
- **Test Event** button (with a preview-only mode that doesn't mutate real state).
- Copyable overlay URLs with a **position picker** (each overlay anchors to a
  different corner by default; `?pos=` overrides).
- Live **$BLAZE → USD** price and a `≈ $USD` figure next to every amount.

**Analytics & diagnostics**
- Real follower / subscriber / viewer counts (live from Blaze), Thanks and vote
  totals, top supporters and voters, and a recent-activity feed.
- Diagnostics page: adapter mode + connection health, token expiry, endpoints.

**Reliability**
- **Idempotent** event handling (no duplicate alerts on reconnect/backfill).
- **Automatic OAuth token refresh** — the event subscription re-authenticates
  before the ~24h token expires, so the stream never drops on its own.
- Socket auto-reconnect with backoff; overlay state re-sent on (re)connect so an
  OBS source refresh never loses progress.

---

## How it works

1. A creator connects their Blaze channel via OAuth.
2. The always-on **bridge** opens a Blaze **EventSub** WebSocket for that channel
   and subscribes to the relevant events.
3. Each incoming event is normalized, de-duplicated, persisted, and matched
   against the creator's rules.
4. Matching rules produce **overlay messages** that are pushed over WebSocket to
   the creator's OBS browser sources, where they animate on stream.

---

## Architecture

```
 Blaze API ──OAuth──▶  Bridge worker (always-on)  ──WS──▶  OBS overlays
                          │  EventAdapter (Socket.IO | polling)
                          │  rule engine · idempotent persist · token refresh
                          ▼
                       Postgres  ◀──  Next.js app (landing · dashboard · analytics)
```

- The **bridge** holds the long-lived event subscription; serverless functions
  can't, so it runs as its own process.
- The **Next.js app** handles auth, the dashboard, overlay pages, and read APIs.
- **Postgres** is the source of truth for idempotency and analytics.
- All Blaze-specific wire decoding lives behind a single **EventAdapter**
  interface, so the upstream API shape is isolated to one place.

---

## Repository layout (code by topic)

This is an npm-workspaces monorepo.

### `packages/shared` — domain model & contracts
The dependency-free core shared by both apps.
- `events.ts` — the **normalized event model** (`thanks`, `vote`, `subscription`,
  `gift`, `follow`, stream lifecycle) with Zod schemas. Everything downstream
  depends only on these shapes, not on Blaze's raw payloads.
- `rules.ts` — the **rule model**: how a creator maps events to actions (alert /
  goal / tip-war / boss), including alert triggers and message templates.
- `overlay.ts` — the **wire protocol** the bridge pushes to overlays.
- `adapter.ts` — the **`EventAdapter` contract** (the single insulation seam).
- `themes.ts` — overlay color palettes, shared so dashboard and overlay match.

### `packages/db` — persistence
- `prisma/schema.prisma` — Postgres schema: users, channels (encrypted tokens),
  action rules, the `Event` log (idempotency + analytics), goals, tip-wars, bosses.
- `index.ts` — a shared Prisma client.

### `apps/bridge` — always-on event worker
- `adapters/` — **the only code that knows Blaze's wire shape**. `decode.ts` maps
  raw Blaze payloads → normalized events; `socketio.ts` (preferred) and
  `polling.ts` (fallback) implement `EventAdapter`; `factory.ts` picks one.
- `ruleEngine.ts` — matches events to rules and renders overlay messages
  (including `{name}`/`{amount}` template substitution).
- `channelManager.ts` — orchestrates the per-channel pipeline and the **token
  refresh scheduler**.
- `store.ts` — idempotent persistence, rule/state loading, Spotlight aggregation,
  token-refresh-on-load.
- `overlayHub.ts` — the Socket.IO server that pushes to OBS overlays.
- `controlServer.ts` — the internal HTTP API used by the web app (guarded by a
  shared secret): start/stop/reload, refresh, preview, test.
- `crypto.ts` — AES-256-GCM encryption for tokens at rest.

### `apps/web` — Next.js app (App Router)
- `app/page.tsx` — landing page.
- `app/api/auth/blaze/*` — the OAuth connect flow (PKCE).
- `app/dashboard/*` — the creator dashboard (editors, analytics, diagnostics).
- `app/overlay/[token]/[widget]/*` — the OBS overlay pages.
- `app/api/*` — rule/goal/boss/tip-war CRUD, analytics, diagnostics, live price.
- `components/overlay/*` — the overlay widgets.
- `lib/*` — the Blaze client, crypto, session, bridge client, price hook, and the
  pure display helpers in `format.ts`.

---

## Tech stack

- **TypeScript** everywhere, **Zod** for runtime validation.
- **Next.js** (App Router) + **Tailwind CSS** + **Framer Motion**.
- **Node.js** bridge with **Socket.IO** (client + server) and **Express**.
- **Prisma** + **PostgreSQL**.
- **Vitest** for unit tests.

---

## Getting started

### Prerequisites
- Node.js 20+
- A PostgreSQL database (local Docker works — see below)
- A Blaze developer application (Client ID / Secret) from the Blaze dev console

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in `DATABASE_URL` and your Blaze `BLAZE_CLIENT_ID` / `BLAZE_CLIENT_SECRET`,
then generate the local secrets:
```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY
openssl rand -base64 32   # BRIDGE_INTERNAL_SECRET
openssl rand -base64 32   # AUTH_SESSION_SECRET
```
Register `http://localhost:3000/api/auth/blaze/callback` as an OAuth redirect URI
in the Blaze dev console.

> The web app, bridge, and Prisma each read env from their own directory. The
> simplest local setup is one root `.env` symlinked into place:
> ```bash
> ln -sf ../../.env apps/web/.env.local
> ln -sf ../../.env apps/bridge/.env
> ln -sf ../../.env packages/db/.env
> ```

### 3. Database
```bash
docker compose up -d          # local Postgres on :5433
npm run db:generate
npm run db:migrate
```

### 4. Run (two terminals)
```bash
npm run dev:bridge            # always-on worker  (:4000)
npm run dev:web               # Next.js app       (:3000)
```
Open `http://localhost:3000`, connect your Blaze channel, and add the overlay
URLs from the dashboard as Browser Sources in OBS.

---

## OBS overlay usage

Each overlay is a full-screen, transparent **Browser Source**:
```
/overlay/<overlayToken>/<widget>?pos=<position>
```
- `widget`: `alert` · `goal` · `boss` · `tipwar` · `spotlight`
- `pos` (optional): `top-left` · `top-center` · `top-right` · `center-left` ·
  `center` · `center-right` · `bottom-left` · `bottom-center` · `bottom-right`

Each widget defaults to a distinct corner so multiple overlays don't overlap. The
dashboard's *OBS overlay sources* section builds these URLs for you with a copy
button and a position dropdown.

---

## Blaze API integration notes

- **Three hosts:** OAuth, REST, and the EventSub WebSocket live on different
  bases (all configurable via env).
- **REST auth:** every request needs **both** an `Authorization: Bearer` token
  **and** a `client-id` header.
- **Events used:** `channel.thanks`, `channel.vote`, `channel.subscribe`,
  `channel.subscription.gift`, `channel.follow`, `stream.online/offline`.
- **Amounts are unitless:** Blaze money events carry no currency or tx hash, so
  amounts are treated as `$BLAZE` and shown with a live USD estimate.
- **No price endpoint:** the Blaze API exposes no token price, so `$BLAZE → USD`
  is read from the public on-chain DEX price (DexScreener), cached server-side,
  with an optional manual fallback.

All of the above are isolated to a small number of files (`apps/bridge/src/adapters/decode.ts`,
`apps/web/src/lib/blaze.ts`, `apps/web/src/app/api/blaze-price/route.ts`), so
adapting to upstream changes is contained.

---

## Testing

```bash
npm test
```
Vitest covers the pure, high-value logic: event decoding, the rule engine's
alert matching and template rendering, the shared schemas, and the display
helpers.

Type-check and build everything:
```bash
npm run typecheck
npm run build
```

---

## Deployment

- **Web app** → any Next.js host (e.g. Vercel).
- **Bridge** → any always-on Node host (e.g. Render / Railway / Fly).
- **Database** → a managed Postgres (e.g. Neon / Supabase).

Set the production env vars on each service (including a production OAuth redirect
URI registered in the Blaze dev console) and run `npm run db:migrate` (or
`db:deploy`) against the production database.

---

## Environment variables

See [`.env.example`](./.env.example) for the full, commented list. Summary:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BLAZE_CLIENT_ID` / `BLAZE_CLIENT_SECRET` | Blaze OAuth app credentials |
| `BLAZE_OAUTH_BASE` / `BLAZE_REST_BASE` / `BLAZE_WS_URL` / `BLAZE_WS_PATH` | Blaze API hosts |
| `BLAZE_SCOPES` / `BLAZE_REDIRECT_URI` | OAuth scopes & callback |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for tokens at rest (32 bytes, base64) |
| `AUTH_SESSION_SECRET` | Session cookie secret |
| `BRIDGE_INTERNAL_SECRET` | Shared secret for web → bridge calls |
| `NEXT_PUBLIC_BRIDGE_URL` / `BRIDGE_URL` / `BRIDGE_PORT` | Bridge wiring |
| `EVENT_ADAPTER_MODE` / `POLLING_INTERVAL_MS` | Event ingestion mode |
| `BLAZE_USD_PRICE` | Optional manual price fallback |

---

## License

MIT
