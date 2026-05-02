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
- **Host Online / Join Online** — clients connect through a small WebSocket relay (Cloudflare Worker + Durable Object, see [`relay/`](relay/)). Host gets a 5-character room code, players paste it in. No accounts. Origin-pinned relay so random pages can't open rooms on your worker.

## Special cards

| Card | Effect |
|------|--------|
| **2** | Wild lead + pickup chain +2. Plays on anything (like a 10), unless the 8 skip queue is alive. The next player picks up 2 unless they counter. |
| **7** | Lower-or-equal lock. Plays per the normal rule (not wild). When a 7 is on top, the next player must play rank ≤ 7 or a 10. |
| **8** | Skip stack. Each 8 queues one skip. While the queue is alive, only another 8 plays. **Cannot be played while a pickup chain is active** — only 2s, Jacks, or a 10 may go during a chain. **Cannot follow a Jack** at the top of the pile. |
| **10** | Burn / wild lead. Single-card 10 plays on anything (incl. a pickup chain) and clears the pile. As a chain link a 10 must follow numerical sequence. |
| **J** | Plays on another Jack or in suit (normal value/suit sequence). Black Jacks (♠ ♣) add +5 to the pickup chain. Red Jacks (♥ ♦) play per the same normal Jack rules — and **additionally** can cancel a pending black Jack (deducting 5 from the chain) when the deck is not empty and the pickup chain is alive. **Blocks 8** as the lead on a Jack-topped pile. **Blocks Ace** specifically on a black Jack while the deck still has cards (Ace plays on a red Jack always, and on a black Jack once the deck is empty). |
| **Q** | Reverse + lock. Plays on another Q or in suit. Once on top, only Q / 2 / 10 / A / higher-same-suit may follow. |
| **K** | Royal demand. Plays on another K or in suit. Cannot follow a freshly-placed 2 / 8 / J — the previous player must have had a turn to react. **A K of any suit plays on a red Jack once the pickup chain is empty** (the RJ has done its cancel job). **Any play that ends on a K draws +1 from the deck** — solo K, or a chain ending on K (e.g. Q♠ → K♠). The player should have followed on (K-chain extension lets a same-suit card or another K chain after a K). No penalty when the deck is empty or the K burns as part of a 4-of-a-kind. |
| **A** | Wild. Blocked only when the chain card on top is **fresh** — a freshly-placed 2 (until the chain is taken), or a freshly-placed black Jack while the deck still has cards. Once a turn has passed without that card being played on (the next player took the chain, was skipped, etc.) the 2 / black J becomes a stale "guide" and Ace plays normally on it. Always blocked after an 8 (skip-lock). Plays on a red Jack always. Names the suit the next player must follow. |
| **4 of a kind** | Burns the pile (any rank, including specials). **A 4-of-a-kind held in hand can be selected as a combined play and led on anything** — it's wild like a 10, plays straight onto any top card and through any pickup chain, and burns the pile when all four hit the discard. (Skip-lock still wins — only 8s play through a pending skip.) |

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
- `relay/` — Cloudflare Worker + Durable Object that fans WebSocket messages between online players. See [relay/README.md](relay/README.md) for the (one-off) deploy.
