# Shitstein

A hybrid Frankenstein of the card games **Shithead** and **UK Blackjack** (a.k.a. Switch / Black Jack). Pure-JS, runs entirely in the browser, no server required.

**Play it live:** https://jammin808.github.io/Shitstein/

## What is it?

A standard 52-card game for 2–5 players. Each player starts with 3 face-down, 3 face-up, and 3 hand cards. The goal is to get rid of all your cards. The last player still holding cards is the **Shithead** and has to make the tea.

It mixes:

- The **Shithead** structure (face-down / face-up / hand layers, the dreaded blind flip, 10 burns the pile, four-of-a-kind burns, last-one-out loses).
- The **UK Blackjack / Switch** specials (2 = pickup-2 chain, black Jack = +5, red Jack cancels, 8 = skip, Q = reverse, A = name the suit).

Plus a few house rules (see below).

## Modes

- **vs Bots** — 2–5 players, simulated opponents with their own personalities.
- **Pass & Play** — local hot-seat for 2–5 humans on one device.
- **Host Online / Join Online** — peer-to-peer over WebRTC via PeerJS. Host gets a room code, players paste it in. No backend, no accounts.

## Special cards

| Card | Effect |
|------|--------|
| **2** | Wild lead + pickup chain +2. Plays on anything (like a 10), unless the 8 skip queue is alive. The next player picks up 2 unless they counter. |
| **7** | Lower-or-equal lock. Plays per the normal rule (not wild). When a 7 is on top, the next player must play rank ≤ 7 or a 10. |
| **8** | Skip stack. Each 8 queues one skip. While the queue is alive, only another 8 plays. |
| **10** | Burn / wild lead. Single-card 10 plays on anything (incl. a pickup chain) and clears the pile. As a chain link a 10 must follow numerical sequence. |
| **J** | Plays on another Jack or in suit. Black Jacks (♠ ♣) add +5 to the pickup chain; red Jacks (♥ ♦) cancel a black Jack. |
| **Q** | Reverse + lock. Plays on another Q or in suit. Once on top, only Q / 2 / 10 / A / higher-same-suit may follow. |
| **K** | Royal demand. Plays on another K or in suit. Cannot follow a freshly-placed 2 / 8 / J — the previous player must have had a turn to react. Solo King draws +1 from the deck. |
| **A** | Wild. Plays at any time except after a 2, black J, or 8. Names the suit the next player must follow. |
| **4 of a kind** | Burns the pile (any rank, including specials). |

### House rules

- **Runs** of strictly consecutive same-suit cards are valid in chains (e.g. `3♥ → 4♥ → 5♥`).
- **Same-rank stacks** mix freely with runs (e.g. `5♠ + 5♥ + 6♥ + 7♥`).
- **K-chain extension**: any same-suit card can follow a K within a chain (except 10, which must obey numerical sequence).
- **Pickup-chain run-out**: if a multi-card play mixes chain cards (2 / Jacks) with a run and ends on a non-chain card, the pickup chain is cancelled — the next player just plays on the last card.
- **Hand-and-deck-empty rule**: face-up cards are locked until both your hand and the deck are empty. Then face-up. Then face-down (blind, one at a time).

Common Shithead variants that are **not** in play: 8 = invisible, 3 = mirror. (Shitstein uses 7 as a lower-or-equal lock — see the table above.)

## Tech

- Vanilla JS rules engine, AI, and UI in `shithead.js`.
- `index.html` + `styles.css` — felt-table layout with hand-crafted SVG cards.
- `images/felt.webp` — Canva-generated emerald linen-weave texture (downscaled + WebP-compressed from the original PNG).
- `music/` — drop royalty-free MP3s here for in-game background music (auto-detected, with a topbar toggle to flip between your tracks and the built-in synth chiptune). See [music/README.md](music/README.md) for details.
- WebRTC peer-to-peer multiplayer via [PeerJS](https://peerjs.com).
