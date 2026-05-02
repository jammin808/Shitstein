// Shitstein game relay — a tiny WebSocket fan-out per room.
//
// Topology mirrors the previous PeerJS setup: one host, several clients, all
// messages go via the host. The host runs the game engine and is the source
// of truth; clients send `move` packets, the host applies and broadcasts new
// `state`. The relay's job is just to shuttle bytes:
//   - Client → host: relay forwards, adding `from: <connId>` so the host can
//     tell which client it came from.
//   - Host → all: omit `to` and the relay broadcasts to every client.
//   - Host → one: include `to: <connId>` and the relay unicasts.
//   - `{type:'kick', to:<connId>}` from host closes that client's socket.
//
// Locked to specific origins via the Origin allowlist below — random web pages
// can't open a socket. Per-socket rate limit drops abusers. Max client cap
// per room. WebSocket framing handles encryption (wss://).

const ALLOWED_ORIGINS = new Set([
  'https://jammin808.github.io',
]);
const LOCAL_DEV_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?$/;

const MAX_CLIENTS_PER_ROOM = 5;
const MAX_MSG_BYTES = 64 * 1024;
const MAX_MSGS_PER_SEC = 30;
const ROOM_CODE_RE = /^[A-Za-z0-9_-]{1,32}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Health probe — useful for "is the relay alive" checks without a WS upgrade.
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('shitstein-relay ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Lock down: only allow upgrades from origins we expect. This is the main
    // gate against random pages opening rooms on our relay.
    const origin = request.headers.get('Origin') || '';
    const originOk = ALLOWED_ORIGINS.has(origin) || LOCAL_DEV_ORIGIN_RE.test(origin);
    if (!originOk) {
      return new Response('forbidden origin: ' + origin, { status: 403 });
    }

    const m = url.pathname.match(/^\/room\/([^/]+)$/);
    if (!m || !ROOM_CODE_RE.test(m[1])) {
      return new Response('not found', { status: 404 });
    }
    const roomId = m[1];
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    return stub.fetch(request);
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.host = null;          // { ws, connId, msgsThisSec, secondMark }
    this.clients = new Map();  // connId → { ws, msgsThisSec, secondMark }
    this.nextConnId = 1;
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    if (role !== 'host' && role !== 'join') {
      return new Response('bad role', { status: 400 });
    }
    if (role === 'host' && this.host) {
      return new Response('host already exists', { status: 409 });
    }
    if (role === 'join' && this.clients.size >= MAX_CLIENTS_PER_ROOM) {
      return new Response('room full', { status: 409 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();

    const connId = this.nextConnId++;
    const meta = { ws: server, connId, msgsThisSec: 0, secondMark: 0 };

    if (role === 'host') {
      this.host = meta;
      try { server.send(JSON.stringify({ type: 'roomReady', connId })); } catch (_) {}
    } else {
      this.clients.set(connId, meta);
      // Tell the host (if any) that someone showed up so they can prepare.
      if (this.host) {
        try { this.host.ws.send(JSON.stringify({ type: 'clientJoined', connId })); } catch (_) {}
      }
    }

    server.addEventListener('message', (ev) => {
      // Rate limit by wall-clock second — cheap and resets cleanly without timers.
      const sec = (Date.now() / 1000) | 0;
      if (meta.secondMark !== sec) { meta.secondMark = sec; meta.msgsThisSec = 0; }
      meta.msgsThisSec++;
      if (meta.msgsThisSec > MAX_MSGS_PER_SEC) return;

      const data = ev.data;
      if (typeof data !== 'string') return;
      if (data.length > MAX_MSG_BYTES) return;

      let msg;
      try { msg = JSON.parse(data); } catch (_) { return; }
      if (!msg || typeof msg !== 'object') return;

      // Keep-alive pings are absorbed here. The act of receiving them resets the
      // edge's idle timer (which would otherwise close the socket after ~100s),
      // so we don't need to forward or reply — just drop.
      if (msg.type === 'ping') return;

      if (role === 'host') {
        // Special: host kicks a client. Close that socket politely.
        if (msg.type === 'kick' && typeof msg.to === 'number') {
          const c = this.clients.get(msg.to);
          if (c) {
            try { c.ws.send(JSON.stringify({ type: 'kicked', reason: msg.reason || '' })); } catch (_) {}
            try { c.ws.close(1000, 'kicked'); } catch (_) {}
            this.clients.delete(msg.to);
          }
          return;
        }
        // Targeted send to one client.
        if (typeof msg.to === 'number') {
          const c = this.clients.get(msg.to);
          if (c) try { c.ws.send(data); } catch (_) {}
          return;
        }
        // Broadcast to everyone.
        for (const c of this.clients.values()) {
          try { c.ws.send(data); } catch (_) {}
        }
      } else {
        // Client → host. Annotate sender so the host can tell who it was from.
        if (!this.host) return;
        msg.from = connId;
        try { this.host.ws.send(JSON.stringify(msg)); } catch (_) {}
      }
    });

    server.addEventListener('close', () => {
      if (role === 'host') {
        // Host vanished — tear the room down for everyone.
        this.host = null;
        for (const c of this.clients.values()) {
          try { c.ws.send(JSON.stringify({ type: 'hostLeft' })); } catch (_) {}
          try { c.ws.close(1000, 'host left'); } catch (_) {}
        }
        this.clients.clear();
      } else {
        this.clients.delete(connId);
        if (this.host) {
          try { this.host.ws.send(JSON.stringify({ type: 'clientLeft', connId })); } catch (_) {}
        }
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
}
