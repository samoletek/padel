# Padel Mix

Free Americano, Mexicano and Team Americano schedules for 4–24 players, built for
casual sessions where nobody wants to pay for an app store subscription.

**Live:** https://padel-mix.vercel.app

## Why it exists

The usual padel apps keep the whole session on one phone. When two courts finish
and the third is still playing — and the schedule lives on a phone that is on
that third court — everyone waits, and the groups that finished cannot even
record their result.

Padel Mix fixes both halves of that:

- **One shared room.** A four-character code puts every player on the same live
  schedule. Anyone can start a game or submit a score from their own phone.
- **Courts never idle.** When a court frees up the app offers the earliest
  queued game whose four players are actually off court — not necessarily the
  next one in the round. If no queued game fits the players standing around, it
  proposes an extra game built from whoever is free.

## Formats

| Format | Partners | Scoring |
| --- | --- | --- |
| Americano | change every round | individual |
| Mexicano | drawn from the standings after each round | individual |
| Team Americano | fixed pairs all session | shared by the pair |

## How the draw works

The schedule is generated once, up front:

- Every partner and opponent pairing carries a cost that grows quadratically
  with each repeat. Each round is chosen by sampling a few hundred arrangements
  and then improving the best one with local search.
- When there are more players than court slots, whoever has played fewest goes
  on next, with the longest rest breaking ties.

In practice this gets 24 players through a full session with no repeated
partners and a spread of at most one game between the busiest and quietest
player. `shared/engine.js` holds all of it and has no dependencies, so the
browser and the API run exactly the same logic.

## Stack

- Vite + React 19, no router and no state library
- Vercel serverless functions in `api/`
- Redis for room state, keyed `padel:room:<CODE>` with a 7-day TTL
- Clients poll `GET /api/room` every 3 seconds (15 while backgrounded) and send
  mutations through `POST /api/act`, which uses `WATCH`/`MULTI` so two phones
  submitting at once cannot clobber each other

If `REDIS_URL` is not set — or the database behind it cannot be reached — the
API answers `503` and the app falls back to a device-only session stored in
`localStorage`. The schedule still works; it just cannot be shared.

## Connecting the database

Shared rooms need a Redis instance. Vercel only provisions marketplace
databases through the dashboard, so this part is manual and takes about a
minute:

1. Open the [padel-mix project](https://vercel.com/architeq/padel-mix) →
   **Storage** → **Create Database** → **Redis** → the **Free** plan.
2. Connect it to `padel-mix` for production, preview and development. Vercel
   injects `REDIS_URL` automatically.
3. Redeploy (`vercel --prod`) so the functions pick up the new variable.

Any Redis works — Upstash, Redis Cloud, a self-hosted instance. The app only
reads `REDIS_URL`, and rooms live under the `padel:room:` prefix with a 7-day
TTL, so an existing database can be reused safely.

## Local development

```bash
npm install
npm run dev
```

`vite.config.js` serves `api/*` locally, mirroring how Vercel routes them. Set
`REDIS_URL` in `.env.local` to exercise room sharing; without it you get the
device-only fallback.

## Layout

```
api/            serverless handlers (_store.js is the Redis layer)
shared/engine.js  schedule generation, standings, board planning, actions
src/components/   one file per step and per room view
src/i18n/         English and Russian strings
src/lib/          API client, polling hook, localStorage helpers
```
