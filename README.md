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

Games are played to a fixed number of points — 16 by default, four serves each,
which is the usual Americano scoring.

A court is booked by the hour, not by the round, so a session is open-ended by
default: the draw stages about six rounds ahead of play and tops itself up as
games finish. Fixed-length sessions are still available if you want a set
number of rounds.

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
- Redis for room state, keyed `padel:room:<CODE>`, expiring after three hours
- Clients poll `GET /api/room` every 3 seconds (15 while backgrounded) and send
  mutations through `POST /api/act`, which uses `WATCH`/`MULTI` so two phones
  submitting at once cannot clobber each other

If no Redis variable is set — or the database behind it cannot be reached — the
API answers `503` and the app falls back to a device-only session stored in
`localStorage`. The schedule still works; it just cannot be shared.

## The database

Shared rooms need Redis. Any instance works — Vercel's marketplace, Upstash,
Redis Cloud, self-hosted. The connection string is read from `REDIS_URL`, or
from any variable ending in `REDIS_URL`: attaching a marketplace store to a
project where `REDIS_URL` is already taken makes Vercel rename it after the
store, e.g. `PADEL_MIX_REDIS_URL`.

Note that Vercel only provisions marketplace databases through the dashboard —
`vercel integration add redis` answers *"This resource must be provisioned
through the Web UI"* — so that step cannot be scripted.

A room lives for three hours from creation and is then deleted. Two keys, both
pinned to that same deadline so writes cannot extend it:

- `padel:room:<CODE>` — the room document
- `padel:room:<CODE>:v` — its version, mirrored so that a poll which is already
  up to date reads a handful of bytes instead of the whole room. That is the
  difference between roughly 650 MB and a few MB of Redis bandwidth over a
  three-hour session with twelve phones, which matters on a free plan.

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
