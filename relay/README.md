# Shitstein relay

A tiny Cloudflare Worker + Durable Object that fans out WebSocket messages
between the host and joined clients of an online game. Replaces the previous
PeerJS / WebRTC transport so that remote users behind strict NATs/firewalls
can reliably connect (the relay is publicly reachable, so there's no
hole-punching to fail).

- `src/worker.js` — entry point + the `Room` Durable Object.
- `wrangler.toml` — Cloudflare config.

## Deploy (one-off, ~5 minutes)

You need a Cloudflare account. The free Workers tier is more than enough.

```bash
cd relay
npx wrangler login        # one-time browser auth
npx wrangler deploy
```

Wrangler prints the deployed URL, e.g.:

```
Published shitstein-relay (X.YZ sec)
  https://shitstein-relay.YOUR-CF-SUBDOMAIN.workers.dev
```

Copy that URL.

## Wire it up to the game

Open `../shithead.js`, find the `RELAY_URL` constant near the top of the
"ONLINE MULTIPLAYER" section, and set it to the **wss** form of your
worker URL:

```js
const RELAY_URL = 'wss://shitstein-relay.YOUR-CF-SUBDOMAIN.workers.dev';
```

Commit and push. The GitHub Pages site will pick it up.

## Allowed origins

The worker only accepts WebSocket upgrades from the origins listed in
`ALLOWED_ORIGINS` at the top of `src/worker.js`. By default that's
`https://jammin808.github.io`. If you fork the game or host elsewhere,
add your own origin and redeploy. `localhost` / `127.0.0.1` (any port)
is always allowed for local development.

## Local testing

```bash
npx wrangler dev
```

This starts the worker on `http://localhost:8787` with WebSocket support.
Temporarily change `RELAY_URL` in `shithead.js` to
`ws://localhost:8787` to test against it.

## What the relay enforces

- Origin pinning (above).
- Max 5 clients per room.
- Max 30 messages/sec per socket — drops further messages until the next
  second tick.
- Max 64 KB per message.
- Room codes restricted to `[A-Za-z0-9_-]{1,32}`.
- One host per room. A second `?role=host` connection on the same room
  code is rejected with HTTP 409.

## What the relay does NOT enforce

- Authentication. Anyone with the room code can join (same as before).
- Game-rule validation. The host runs the engine; the relay is dumb.
- Persistence. The Durable Object holds state in memory only — when the
  host disconnects, the room is torn down.

## Cost

Free tier: 100k requests/day, 10ms CPU per request. A 4-player game with
~1 message every few seconds is nowhere near that. You can run a lot of
games before this costs anything.
