'use strict';

/* ============================================================
 *  SHITHEAD — fully client-side card game
 *  Engine + AI + UI + WebRTC multiplayer (PeerJS)
 * ============================================================ */

// =================== CONSTANTS ===================
const RANKS    = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS    = ['S','H','D','C'];
const SUIT_SYM = { S:'♠', H:'♥', D:'♦', C:'♣' };
const RANK_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

// Specials override the follow-suit rule and trigger their own effects.
const SPECIALS = new Set(['2', '8', '9', '10', 'Q', 'K', 'A']);
function isSpecial(rank) { return SPECIALS.has(rank); }
function isJackBlack(card) { return card.rank === 'J' && (card.suit === 'S' || card.suit === 'C'); }
function isJackRed(card)   { return card.rank === 'J' && (card.suit === 'H' || card.suit === 'D'); }

const CARD_INFO = {
  '2':  '<strong>2 — Pick up two!</strong><br>A 2 can only be played on another 2, on a black Jack, or in suit. The next player must pick up <strong>2 cards</strong> from the deck — unless they play a 2 (+2 more), a black Jack (+5), or a red Jack (cancels a black Jack). Stacking another 2 passes the additive total down the chain. <em>If a multi-card run starts with a 2 (or Jack) but ends on a non-chain card (e.g., 2♥ + 3♥ + 4♥), the pickup chain is cancelled and the next player just plays on the last card.</em>',
  '3':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '4':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '5':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '6':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '7':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '8':  '<strong>8 — Skip stack.</strong><br>An 8 can only be played on another 8, or on a lower rank in the same suit. <strong>Each 8 played stacks one skip in the queue</strong> — play two 8s, the next two players miss their go. While the skip queue is alive, only another 8 plays. Once the queue drains, the 8 on top becomes a normal card and the following player plays per the usual rules. With wraparound, the original 8-player can get another go.',
  '9':  '<strong>9 — Lower-or-equal lock.</strong><br>A 9 can only be played on another 9 or in suit. <strong>It cannot be played on a 2 or an 8.</strong> When a 9 is on top, the next player must play <strong>equal or lower than 9</strong> (any card 2–9 of any suit — the suit/rank rule is overridden) or a 10 (wild, burns the pile). J / Q / K / A are blocked.',
  '10': '<strong>10 — Burn!</strong><br>A 10 of any suit can be played on <em>anything</em> to clear the pack — including breaking out of a pickup chain. (Still rejected while skips from an 8 are queued.) <em>In a chain, however, a 10 must be in numerical sequence</em> like any other card — a 10 isn\'t wild as a chain link.',
  'J':  '<strong>Jack.</strong><br>A Jack can only be played on another Jack, or on a lower rank in the same suit. <strong>Black Jacks</strong> (♠ ♣) add <strong>+5</strong> to a pickup chain. <strong>Red Jacks</strong> (♥ ♦) cancel the most recent black Jack and its 5 cards.',
  'Q':  '<strong>Q — Reverse &amp; lock.</strong><br>A Queen can <em>only</em> be played on another Queen or in suit. Flips the direction of play (with two players, the same player goes again). Once a Q is on top, it can only be followed by another Queen, a higher rank in the Q\'s suit, a 2, a 10, or an Ace.',
  'K':  '<strong>K — Royal demand.</strong><br>A King can only be played on another King or in suit. <em>Exception:</em> a K cannot follow a freshly-placed 2, 8, or Jack — the previous player must have had a turn to react first (e.g., taken the chain or been skipped). When a K is on top (or you\'re chaining off one), the legal followers are: another King (paired), a card of the same suit, or an Ace. Played solo? Pick up one extra card from the deck as penalty.',
  'A':  '<strong>A — Wild.</strong><br>An Ace of any suit can be played at any time, except after a 2, a black Jack, or an 8. You name the suit the next player must follow (any rank in that suit).',
};

const INSULTS = [
  (n) => `Oh ${n}, the universal champion of last place. Pop the kettle on, treasure — milky for everyone, two sugars for me.`,
  (n) => `Behold: ${n}, freshly crowned Shithead of the realm. Tradition demands a strong cup of tea, made with hot water and tears.`,
  (n) => `Bravo, ${n}. You played those cards like a goldfish plays chess. Now go put the kettle on, would you, sweetheart?`,
  (n) => `${n} loses again — colour me astonished. Be a love and brew up. The rest of us are parched from your dreadful play.`,
  (n) => `Rough one, ${n}. So many decisions, every single one wrong. Off you trot to contemplate your sins over a pot of Earl Grey.`,
  (n) => `${n}, my sweet champion of incompetence. Earn back your dignity in service: tea, biscuits, and a damp flannel for the elders.`,
  (n) => `Congratulations, ${n}: you have lost so spectacularly that historians will speak of it. Your reward? Brew duty.`,
  (n) => `Right then, ${n}. The cards have spoken. Down to the kitchen with you — three teas, one coffee, and a fizzy water, if you please.`,
];
const CHORES = [
  "Make everyone a hot drink. Don't skimp on the biscuits.",
  "Plump the cushions and fetch a round of teas, served with a small ceremonial bow.",
  "Boil the kettle. The proper way. Two teabags. None of that 'just a splash' nonsense.",
  "Tea. Now. With biscuits arranged in a tasteful spiral.",
  "A round of hot drinks for everyone, in their preferred mug — yes, you'll have to ask which.",
  "Snacks AND drinks. A modest nibble platter. Show effort.",
  "Tea, biscuits, AND a sincere apology for that last face-down flip.",
];
const BOT_NAMES = ['Bot Bartholomew','Sir Sips-a-lot','Tea Tornado','Madame Mug','Lord Loose-leaf'];

// =================== ENGINE ===================
function makeDeck() {
  const deck = [];
  for (const r of RANKS) for (const s of SUITS) deck.push({ rank: r, suit: s, id: r + s });
  return deck;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newGame(playerNames) {
  if (playerNames.length < 2 || playerNames.length > 5) {
    throw new Error('Shitstein requires 2–5 players');
  }
  const deck = shuffle(makeDeck());
  const players = playerNames.map((name, i) => ({
    id: i, name, hand: [], faceUp: [], faceDown: [],
    finished: false, isHuman: false,
  }));
  // Deal 3 face-down each
  for (let i = 0; i < 3; i++) for (const p of players) p.faceDown.push(deck.pop());
  // Deal 3 face-up each
  for (let i = 0; i < 3; i++) for (const p of players) p.faceUp.push(deck.pop());
  // Deal 3 hand each
  for (let i = 0; i < 3; i++) for (const p of players) p.hand.push(deck.pop());

  return {
    deck, discard: [], burned: 0,
    players, current: 0,
    direction: 1,                 // +1 = clockwise; flipped by Q
    pendingSkips: 0,              // skip-queue: each surviving 8 adds 1; each skipTurn consumes 1
    lastEightPlayer: null,        // who played the most recent 8 — exempt from queue wraparound
    turnCount: 0,                 // increments on every advanceTurn — used for "fresh-card" checks
    topPlayedAtTurn: -1,          // the turnCount when the current discard top was placed
    pickupChain: 0,               // running pickup count from 2s and black Jacks
    pendingBlackJacks: 0,         // black Jacks in chain that a red Jack can cancel
    aceSuit: null,                // suit named after a played Ace ('S'|'H'|'D'|'C')
    finishedOrder: [],
    phase: 'swap',
    lastEvent: 'Cards dealt. Swap any hand cards with face-up cards if you like, then ready up.',
    lastEventTags: [],
    lastEventPlayer: null,
    swapReady: new Set(),
    shithead: null,
  };
}

function startPlay(state) {
  // Player with the lowest non-special hand card starts.
  let best = null;
  for (const p of state.players) {
    for (const c of p.hand) {
      if (isSpecial(c.rank)) continue;
      const v = RANK_VAL[c.rank];
      if (!best || v < best.v || (v === best.v && p.id < best.id)) {
        best = { id: p.id, v };
      }
    }
  }
  state.current = best ? best.id : 0;
  state.phase   = 'play';
  state.lastEvent = `${state.players[state.current].name} starts (lowest card).`;
  state.lastEventTags = [];
  state.lastEventPlayer = null;
}

function topDiscard(state) {
  return state.discard.length ? state.discard[state.discard.length - 1] : null;
}

// Suit-based legality. Specials override; otherwise follow suit of the discard top.
// Pickup chain: only 2 / black-Jack / (red-Jack if there's a black Jack to cancel) are legal.
// Skip pending: only specials (or a black Jack, which is treated as a special).
// Top is an Ace: follow the suit named by the player who played it.
// Chain-link legality: would `card` legally play if `prevCard` were the discard top
// (with a clean state — no pickup chain, no skip pending, no ace named-suit override)?
// Used for face-up "domino" chains where each card plays on the previous one.
function canPlayOnCard(card, prevCard) {
  // 10-card chain rule (highest priority): a 10 in a chain must follow numerical sequence —
  // either same rank or strictly consecutive same-suit (±1). 10 is wild only as a single-card
  // lead, NOT as a chain link. Even after a Q, K, or 9, the 10 needs ±1 same-suit / pair.
  if (card.rank === '10') return chainStep(card, prevCard);

  // ---- Top-card locks / extensions (apply before card-specific rules) ----
  // 8-lock: only an 8 follows an 8.
  if (prevCard.rank === '8') return card.rank === '8';
  // 9-lock: blocks J/Q/K/A on the chain link too (10 is wild). Cards ≤ 9 fall through to the
  // normal chain-step / card-specific rules so e.g. a same-suit run continues correctly.
  if (prevCard.rank === '9') {
    if (card.rank === '10') return true;
    if (RANK_VAL[card.rank] > 9) return false;
    // fall through.
  }
  // Q-lock: Q, higher-same-suit, 2, 10, or A follows a Q.
  if (prevCard.rank === 'Q') {
    if (card.rank === 'Q' || card.rank === '2' || card.rank === '10' || card.rank === 'A') return true;
    return card.suit === prevCard.suit && RANK_VAL[card.rank] > RANK_VAL[prevCard.rank];
  }
  // K-chain extension: another K, an Ace (any suit), or a card of the same suit (any rank)
  // follows a King in a chain. (10s only chain via numerical sequence — same-suit 10 is allowed
  // by the same-suit branch; off-suit 10 is not.)
  if (prevCard.rank === 'K') {
    if (card.rank === 'K' || card.rank === 'A') return true;
    return card.suit === prevCard.suit;
  }
  // Ace wild after A — anything follows.
  if (prevCard.rank === 'A') return true;

  // ---- Card-specific rules (when prev is a normal-ish card) ----
  if (card.rank === '2') {
    if (prevCard.rank === '2') return true;
    if (isJackBlack(prevCard)) return true;
    return card.suit === prevCard.suit;
  }
  if (card.rank === '8') {
    if (prevCard.rank === '8') return true;        // (handled by lock above)
    return chainStep(card, prevCard);
  }
  if (card.rank === 'Q') {
    if (prevCard.rank === 'Q') return true;        // (handled by Q-lock above)
    return chainStep(card, prevCard);              // strict run / equal rank for chains
  }
  if (card.rank === 'K') {
    if (prevCard.rank === 'K') return true;        // (handled by K-chain extension above)
    return chainStep(card, prevCard);              // strict run / equal rank for chains
  }
  if (card.rank === 'J') {
    if (prevCard.rank === 'J') return true;
    return chainStep(card, prevCard);
  }
  if (card.rank === '9') {
    if (prevCard.rank === '2' || prevCard.rank === '8') return false;
    return chainStep(card, prevCard);
  }

  // Ace stays wild for chain continuation. 10s do NOT — a 10 in a chain must be in numerical
  // sequence (same-suit ±1) or equal rank, just like any other card.
  if (card.rank === 'A') return true;

  // Normal chain link: strictly consecutive same-suit run (up or down by 1) or equal rank any suit.
  return chainStep(card, prevCard);
}

// Single-card legality on the discard top: equal rank in any suit, OR higher rank in the same suit
// (any gap allowed — this is the original "must beat the top suit" rule).
function higherOrEqual(card, prevCard) {
  if (card.rank === prevCard.rank) return true;
  return card.suit === prevCard.suit && RANK_VAL[card.rank] > RANK_VAL[prevCard.rank];
}

// Chain-step legality between two consecutive cards in a multi-card play: equal rank in any suit,
// OR strictly consecutive in the same suit (up or down by exactly 1). This is the "runs" rule —
// jumps of more than one rank in the same suit are NOT allowed.
function chainStep(card, prevCard) {
  if (card.rank === prevCard.rank) return true;
  if (card.suit !== prevCard.suit) return false;
  const diff = RANK_VAL[card.rank] - RANK_VAL[prevCard.rank];
  return diff === 1 || diff === -1;
}

function canPlayCard(card, state) {
  // Pickup chain: 2 / black-J / red-J-cancel extend or counter the chain. A 10 is universally
  // wild and clears the pack — including the chain.
  if (state.pickupChain > 0) {
    if (card.rank === '10') return true;
    if (card.rank === '2') return true;
    if (isJackBlack(card)) return true;
    if (isJackRed(card) && state.pendingBlackJacks > 0) return true;
    return false;
  }
  // Pending-skip lock: while there are queued skips from played 8s, the only legal play is
  // another 8 (which extends the chain). Once the queue drains, the 8 on top is just a card —
  // normal play resumes for the following player.
  if (state.pendingSkips > 0) return card.rank === '8';

  const top = topDiscard(state);
  // Empty pile — anything goes.
  if (!top) return true;
  // 9-lock: top=9 forces the next player to play EQUAL or LOWER than 9. Any card of rank ≤ 9
  // (any suit) plays — this overrides the normal suit/rank rule. 10 is wild (burns). J, Q, K,
  // A are all blocked.
  if (top.rank === '9') {
    if (card.rank === '10') return true;
    if (RANK_VAL[card.rank] > 9) return false;
    return true;
  }
  // K-lock: top=K can be followed by another K, an Ace (any suit), a 10 (any suit — 10 is wild
  // and clears the pile), or any card of the same suit (any rank).
  if (top.rank === 'K') {
    if (card.rank === 'K' || card.rank === 'A' || card.rank === '10') return true;
    return card.suit === top.suit;
  }

  // Card-specific rules — more-restrictive cards must win over the Q-lock.
  const matchSuit = (top.rank === 'A' && state.aceSuit) ? state.aceSuit : top.suit;
  const matchTop = { rank: top.rank, suit: matchSuit };

  // 2-card rule: a 2 plays only on another 2, on a black Jack, or in suit.
  if (card.rank === '2') {
    if (top.rank === '2') return true;
    if (isJackBlack(top)) return true;
    return card.suit === matchSuit;
  }
  // 8-card rule: an 8 plays only on another 8, or higher rank in the same suit (any gap).
  if (card.rank === '8') {
    if (top.rank === '8') return true;       // (handled by 8-lock above, kept for safety)
    return higherOrEqual(card, matchTop);
  }
  // Q-card rule: a Queen can only be played on another Queen or in suit.
  if (card.rank === 'Q') {
    if (top.rank === 'Q') return true;
    return card.suit === matchSuit;
  }
  // K-card rule: a King can only be played on another King or in suit. Additionally, a K cannot
  // play on a freshly-placed 2 / 8 / J — the previous player must have had a turn between the
  // 2/8/J landing and now (i.e., they took the chain, were skipped, etc.).
  if (card.rank === 'K') {
    if (top.rank === 'K') return true;
    const fresh = state.turnCount === (state.topPlayedAtTurn + 1);
    if (fresh && (top.rank === '2' || top.rank === '8' || top.rank === 'J')) return false;
    return card.suit === matchSuit;
  }
  // Jack rule: J plays only on another Jack, or higher rank in the same suit (any gap).
  if (card.rank === 'J') {
    if (top.rank === 'J') return true;
    return higherOrEqual(card, matchTop);
  }
  // 9-card rule: a 9 plays on another 9 or in suit. Cannot play on a 2 or 8.
  if (card.rank === '9') {
    if (top.rank === '2' || top.rank === '8') return false;
    if (top.rank === '9') return true;
    return card.suit === matchSuit;
  }

  // Q-lock (top is Q) — applies to remaining cards (10, A, 3-7, 9).
  if (top.rank === 'Q') {
    if (card.rank === '10' || card.rank === 'A') return true;
    return card.suit === top.suit && RANK_VAL[card.rank] > RANK_VAL[top.rank];
  }

  // 10 and Ace remain wild — except when they fall foul of the chain (handled at the top)
  // or the 8-lock / 9-lock / Q-lock (handled above).
  if (card.rank === '10' || card.rank === 'A') return true;

  // Top is an Ace with a named suit — follow the named suit (any rank).
  if (top.rank === 'A' && state.aceSuit) return card.suit === state.aceSuit;

  // Normal single-card play: higher rank in the same suit (any gap), or equal rank in any suit.
  return higherOrEqual(card, top);
}

// House rule: a player can only access face-up / face-down once the deck AND their hand are both empty.
// (In practice the refill loop in playCards keeps hand >= 1 while the deck has cards, so this is mostly
// belt-and-braces — but it prevents face-up plays after, e.g., an unusual pickup state.)
function getActiveSource(p, state) {
  if (p.hand.length > 0) return 'hand';
  if (state && state.deck && state.deck.length > 0) return null;
  if (p.faceUp.length   > 0) return 'faceUp';
  if (p.faceDown.length > 0) return 'faceDown';
  return null;
}

function checkBurn(state) {
  const top = topDiscard(state);
  if (!top) return false;
  if (top.rank === '10') return true;
  if (state.discard.length >= 4) {
    const top4 = state.discard.slice(-4);
    if (top4.every(c => c.rank === top4[0].rank)) return true;
  }
  return false;
}

function checkPlayerOut(state, p) {
  if (p.hand.length === 0 && p.faceUp.length === 0 && p.faceDown.length === 0) {
    p.finished = true;
    state.finishedOrder.push(p.id);
    state.lastEvent += ` 🎉 ${p.name} is OUT!`;
    return true;
  }
  return false;
}

function checkGameEnd(state) {
  const remaining = state.players.filter(p => !p.finished);
  if (remaining.length <= 1) {
    if (remaining.length === 1) state.shithead = remaining[0].id;
    state.phase = 'over';
    return true;
  }
  return false;
}

function advanceTurn(state) {
  if (state.phase !== 'play') return;
  const n = state.players.length;
  let next = state.current;
  state.turnCount = (state.turnCount || 0) + 1;
  for (let i = 0; i < n; i++) {
    next = (next + state.direction + n) % n;
    if (!state.players[next].finished) {
      state.current = next;
      // Skip-queue exemption: when the queue wraps back round to the player who played
      // the most-recent 8, they get their go without being skipped — any leftover skips evaporate.
      if (state.pendingSkips > 0 && state.lastEightPlayer === next) {
        state.pendingSkips = 0;
      }
      return;
    }
  }
}

function playCards(state, source, indices, aceSuit) {
  const p = state.players[state.current];
  const pool = p[source];
  if (!indices.length) return { ok: false, error: 'no cards' };

  // House rule: face-up locked while deck has cards.
  if (source !== 'hand' && state.deck.length > 0) {
    return { ok: false, error: "can't play face-up cards while the deck still has cards" };
  }

  const cards = indices.map(i => pool[i]);
  const lead  = cards[0];

  // ---- Validation ----
  if (!canPlayCard(lead, state)) {
    if (state.pickupChain > 0) {
      return { ok: false, error: `pickup chain at +${state.pickupChain} — play a 2, a black Jack, or a red Jack (if a black Jack is pending), or take the cards` };
    }
    return { ok: false, error: state.pendingSkips > 0
      ? 'must play an 8 to escape the skip, or click Skip Turn'
      : 'must follow suit (or play a special)' };
  }
  // Multi-card plays use chain validation: each card must legally play on the previous one.
  // This unifies same-rank stacks, K-chains, runs, and any creative mixed plays.
  if (cards.length > 1) {
    for (let i = 1; i < cards.length; i++) {
      if (!canPlayOnCard(cards[i], cards[i - 1])) {
        return { ok: false, error: `chain broken: ${cards[i].rank}${SUIT_SYM[cards[i].suit]} can't play on ${cards[i-1].rank}${SUIT_SYM[cards[i-1].suit]}` };
      }
    }
  }
  // While a pickup chain is active, the WHOLE play must be chain-relevant — 2s, Jacks (any
  // colour), or a 10 (which burns the chain). No other ranks may appear.
  if (state.pickupChain > 0) {
    for (const c of cards) {
      if (c.rank === '2' || c.rank === '10' || isJackBlack(c) || isJackRed(c)) continue;
      return { ok: false, error: 'during a pickup chain, only 2s, Jacks, or a 10 may be played' };
    }
  }
  // Red-Jack cancellations need a matching number of pending black Jacks. Count actual red Js
  // in the play, not the total cards (a [redJ, 2, 2] play uses 1 red-J cancellation, not 3).
  if (state.pickupChain > 0) {
    const redJsInPlay = cards.filter(isJackRed).length;
    if (redJsInPlay > state.pendingBlackJacks) {
      return { ok: false, error: `only ${state.pendingBlackJacks} black Jack${state.pendingBlackJacks === 1 ? '' : 's'} to cancel` };
    }
  }
  // Ace must be accompanied by a chosen suit.
  if (cards.some(c => c.rank === 'A')) {
    if (!aceSuit || !['S','H','D','C'].includes(aceSuit)) {
      return { ok: false, error: 'must name a suit when playing an Ace' };
    }
  }

  // (No more pendingSkip "play-through" reset — under the stacking rule, each played 8 simply
  // adds to the skip queue; the canPlayCard 8-lock has already gated which cards can lead.)

  // ---- Remove from source ----
  const sorted = indices.slice().sort((a, b) => b - a);
  for (const i of sorted) pool.splice(i, 1);

  // ---- Push cards in selection order, applying burn iteratively.
  // Track survivors so burned cards lose their Q/8 effects.
  let goAgain = false, burned = false, fourOfKindBurn = false, tenBurn = false;
  let survivors = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    state.discard.push(c);
    if (checkBurn(state)) {
      if (c.rank === '10') {
        tenBurn = true;
        // A 10 clears the pack — and that includes any active pickup chain or queued skips.
        state.pickupChain = 0;
        state.pendingBlackJacks = 0;
        state.pendingSkips = 0;
        state.lastEightPlayer = null;
      } else {
        fourOfKindBurn = true;
      }
      state.burned += state.discard.length;
      state.discard = [];
      goAgain = true;
      burned  = true;
      survivors = [];
    } else {
      survivors.push(c);
    }
  }
  // Top changed (something survived): record at which turn the new top was placed.
  if (survivors.length > 0) {
    state.topPlayedAtTurn = state.turnCount;
  }

  // ---- Refill hand from deck ----
  if (source === 'hand') {
    while (p.hand.length < 3 && state.deck.length > 0) p.hand.push(state.deck.pop());
  }

  // ---- Solo-King penalty ----
  let kingPenalty = false;
  if (cards.length === 1 && lead.rank === 'K' && state.deck.length > 0) {
    p.hand.push(state.deck.pop());
    kingPenalty = true;
  }

  // ---- Apply effects from surviving cards (burned ones lose their effects) ----
  const survQ  = survivors.filter(c => c.rank === 'Q').length;
  const surv8  = survivors.filter(c => c.rank === '8').length;
  const surv2  = survivors.filter(c => c.rank === '2').length;
  const survBJ = survivors.filter(isJackBlack).length;
  const survRJ = survivors.filter(isJackRed).length;
  const survA  = survivors.filter(c => c.rank === 'A').length;

  let reversed = false;
  if (survQ % 2 === 1) { state.direction *= -1; reversed = true; }
  let skipSet = false;
  if (surv8 > 0) { state.pendingSkips += surv8; state.lastEightPlayer = p.id; skipSet = surv8; }

  // Pickup chain effects
  let chainAdd = 0, chainCancel = 0;
  if (surv2 > 0) {
    state.pickupChain += 2 * surv2;
    chainAdd += 2 * surv2;
  }
  if (survBJ > 0) {
    state.pickupChain += 5 * survBJ;
    state.pendingBlackJacks += survBJ;
    chainAdd += 5 * survBJ;
  }
  if (survRJ > 0) {
    const cancel = Math.min(survRJ, state.pendingBlackJacks);
    state.pickupChain -= 5 * cancel;
    state.pendingBlackJacks -= cancel;
    chainCancel = 5 * cancel;
    if (state.pickupChain < 0) state.pickupChain = 0;
  }

  // House rule: if the play's combined run/chain ends on a non-pickup-chain
  // card (anything but a 2 or Jack), the pickup chain is cancelled. The next
  // player just follows the last card placed.
  let chainEnded = false;
  if (survivors.length > 0 && state.pickupChain > 0) {
    const last = survivors[survivors.length - 1];
    if (last.rank !== '2' && last.rank !== 'J') {
      state.pickupChain = 0;
      state.pendingBlackJacks = 0;
      chainAdd = 0;
      chainEnded = true;
    }
  }

  // Ace suit override
  if (survA > 0) {
    state.aceSuit = aceSuit;
  } else if (survivors.length > 0) {
    state.aceSuit = null; // a non-A card established a new top
  }

  // ---- Tags + event message ----
  const tags = [];
  if (tenBurn)        tags.push('burn');
  if (fourOfKindBurn) tags.push('fourOfKind');
  if (reversed)       tags.push('reverse');
  if (skipSet)        tags.push('skip');
  if (kingPenalty)    tags.push('soloKing');
  if (chainAdd > 0)   tags.push('chainAdd');
  if (chainCancel > 0 || chainEnded) tags.push('chainCancel');
  if (survA > 0)      tags.push('aceCalled');

  const cardList = cards.map(c => c.rank + SUIT_SYM[c.suit]).join(', ');
  const burnMsg  = burned     ? ' 🔥 Burn!'                            : '';
  const revMsg   = reversed   ? ' 🔄 Direction reversed!'              : '';
  const skipMsg  = skipSet    ? ' 💤 Next player skips unless they play a special.' : '';
  const chainMsg = (state.pickupChain > 0)
    ? ` 📤 Pickup chain at +${state.pickupChain}.`
    : (chainEnded ? ' ✋ Pickup chain cancelled — ended on a non-chain card.'
       : (chainCancel > 0 ? ' ✋ Black Jack cancelled.' : ''));
  const aceMsg   = survA > 0  ? ` 🎩 Suit called: ${SUIT_SYM[aceSuit]}.` : '';
  const againMsg = goAgain    ? ' Plays again.'                        : '';
  const kpMsg    = kingPenalty ? ' 👑 Solo King — drew an extra card.' : '';
  state.lastEvent = `${p.name} plays ${cardList}.${burnMsg}${revMsg}${skipMsg}${chainMsg}${aceMsg}${againMsg}${kpMsg}`;
  state.lastEventTags = tags;
  state.lastEventPlayer = p.id;

  const finished = checkPlayerOut(state, p);
  if (finished) tags.push('finished');
  if (checkGameEnd(state)) return { ok: true, goAgain, finished };
  if (!goAgain || finished) advanceTurn(state);
  return { ok: true, goAgain, finished };
}

function blindFlip(state, faceDownIdx) {
  const p = state.players[state.current];
  if (p.hand.length > 0 || p.faceUp.length > 0) return { ok: false, error: 'finish hand and face-up first' };
  if (faceDownIdx < 0 || faceDownIdx >= p.faceDown.length) return { ok: false, error: 'bad index' };

  if (state.pendingSkips > 0) {
    return { ok: false, error: 'a skip is pending — click Skip Turn instead' };
  }

  const card = p.faceDown.splice(faceDownIdx, 1)[0];

  if (canPlayCard(card, state)) {
    state.discard.push(card);
    let goAgain = false, burned = false, fourOfKindBurn = false, tenBurn = false;
    if (checkBurn(state)) {
      if (card.rank === '10') {
        tenBurn = true;
        state.pickupChain = 0;
        state.pendingBlackJacks = 0;
        state.pendingSkips = 0;
        state.lastEightPlayer = null;
      } else {
        fourOfKindBurn = true;
      }
      state.burned += state.discard.length;
      state.discard = [];
      goAgain = true;
      burned  = true;
    } else {
      // Card survived on top — record the turn count for the freshness check.
      state.topPlayedAtTurn = state.turnCount;
    }

    // Solo-King penalty (blind flip is always solo)
    let kingPenalty = false;
    if (card.rank === 'K' && state.deck.length > 0) {
      p.hand.push(state.deck.pop());
      kingPenalty = true;
    }

    // Effects (only if survived the burn)
    let reversed = false, skipSet = false, chainAdd = 0, chainCancel = 0, aceCalled = false;
    if (!burned) {
      if (card.rank === 'Q') { state.direction *= -1; reversed = true; }
      if (card.rank === '8') { state.pendingSkips += 1; state.lastEightPlayer = p.id; skipSet = true; }
      if (card.rank === '2') { state.pickupChain += 2; chainAdd = 2; }
      if (isJackBlack(card)) { state.pickupChain += 5; state.pendingBlackJacks += 1; chainAdd = 5; }
      if (isJackRed(card) && state.pendingBlackJacks > 0) {
        state.pickupChain -= 5;
        state.pendingBlackJacks -= 1;
        if (state.pickupChain < 0) state.pickupChain = 0;
        chainCancel = 5;
      }
      if (card.rank === 'A') {
        // Blind flip: name the card's own suit (no real choice possible without seeing it).
        state.aceSuit = card.suit;
        aceCalled = true;
      } else {
        // Any non-A non-burn card establishes a fresh top — clear the previous Ace's named suit.
        state.aceSuit = null;
      }
    }

    const tags = ['blindGood'];
    if (tenBurn)        tags.push('burn');
    if (fourOfKindBurn) tags.push('fourOfKind');
    if (reversed)       tags.push('reverse');
    if (skipSet)        tags.push('skip');
    if (kingPenalty)    tags.push('soloKing');
    if (chainAdd > 0)   tags.push('chainAdd');
    if (chainCancel > 0) tags.push('chainCancel');
    if (aceCalled)      tags.push('aceCalled');

    const burnMsg  = burned      ? ' 🔥 Burn!'                            : '';
    const revMsg   = reversed    ? ' 🔄 Direction reversed!'              : '';
    const skipMsg  = skipSet     ? ' 💤 Next player skips unless special.' : '';
    const chainMsg = (state.pickupChain > 0)
      ? ` 📤 Pickup chain at +${state.pickupChain}.`
      : (chainCancel > 0 ? ' ✋ Black Jack cancelled.' : '');
    const aceMsg   = aceCalled   ? ` 🎩 Suit defaulted to ${SUIT_SYM[card.suit]}.` : '';
    const againMsg = goAgain     ? ' Plays again.'                        : '';
    const kpMsg    = kingPenalty ? ' 👑 Solo King — drew a card.'          : '';
    state.lastEvent = `${p.name} flips ${card.rank}${SUIT_SYM[card.suit]} blind — and it plays!${burnMsg}${revMsg}${skipMsg}${chainMsg}${aceMsg}${againMsg}${kpMsg}`;
    state.lastEventTags = tags;
    state.lastEventPlayer = p.id;

    const finished = checkPlayerOut(state, p);
    if (finished) tags.push('finished');
    if (checkGameEnd(state)) return { ok: true, played: true, goAgain, finished, card };
    if (!goAgain || finished) advanceTurn(state);
    return { ok: true, played: true, goAgain, finished, card };
  } else {
    // Can't play. If a chain is active, take the chain count from the deck and keep the flipped card.
    // Otherwise, the classic "pick up the pile + the flipped card" applies.
    if (state.pickupChain > 0) {
      const N = state.pickupChain;
      const taken = Math.min(N, state.deck.length);
      for (let i = 0; i < taken; i++) p.hand.push(state.deck.pop());
      state.pickupChain = 0;
      state.pendingBlackJacks = 0;
      p.hand.push(card);
      state.lastEvent = `${p.name} flips ${card.rank}${SUIT_SYM[card.suit]} blind — can't counter! Takes ${taken} from the deck and keeps the card.`;
      state.lastEventTags = ['blindBad', 'chainTaken'];
    } else {
      p.hand.push(card);
      p.hand.push(...state.discard);
      state.discard = [];
      state.lastEvent = `${p.name} flips ${card.rank}${SUIT_SYM[card.suit]} blind — can't play! Picks up the pile.`;
      state.lastEventTags = ['blindBad', 'pickUp'];
    }
    state.lastEventPlayer = p.id;
    advanceTurn(state);
    return { ok: true, played: false, card };
  }
}

function pickUp(state) {
  const p = state.players[state.current];
  if (p.hand.length === 0 && p.faceUp.length === 0 && p.faceDown.length > 0) {
    return { ok: false, error: 'use blind flip from face-down' };
  }
  if (state.pickupChain > 0) {
    return { ok: false, error: 'pickup chain active — take from the deck or play a chain card' };
  }
  if (state.pendingSkips > 0) {
    return { ok: false, error: 'cannot pick up while a skip is pending — play an 8 or click Skip Turn' };
  }
  if (state.discard.length === 0) return { ok: false, error: 'nothing to pick up' };
  p.hand.push(...state.discard);
  state.discard = [];
  state.lastEvent = `${p.name} picks up the pile.`;
  state.lastEventTags = ['pickUp'];
  state.lastEventPlayer = p.id;
  advanceTurn(state);
  return { ok: true };
}

function takeChain(state) {
  const p = state.players[state.current];
  if (state.pickupChain <= 0) return { ok: false, error: 'no pickup chain to take' };
  const N = state.pickupChain;
  const taken = Math.min(N, state.deck.length);
  for (let i = 0; i < taken; i++) p.hand.push(state.deck.pop());
  state.pickupChain = 0;
  state.pendingBlackJacks = 0;
  state.pendingSkips = 0;        // chain takes precedence over any queued skips
  state.lastEvent = `${p.name} takes ${taken} card${taken === 1 ? '' : 's'} from the deck. Chain consumed.`;
  state.lastEventTags = ['chainTaken'];
  state.lastEventPlayer = p.id;
  advanceTurn(state);
  return { ok: true, taken };
}

function skipTurn(state) {
  const p = state.players[state.current];
  if (state.pendingSkips <= 0) return { ok: false, error: 'no skip to take' };
  state.pendingSkips -= 1;
  state.lastEvent = `${p.name} is skipped — better luck next round.${state.pendingSkips > 0 ? ' (' + state.pendingSkips + ' skip' + (state.pendingSkips === 1 ? '' : 's') + ' still queued)' : ''}`;
  state.lastEventTags = ['skip'];
  state.lastEventPlayer = p.id;
  advanceTurn(state);
  return { ok: true };
}

function swapHandFaceUp(state, playerId, handIdx, faceUpIdx) {
  const p = state.players[playerId];
  [p.hand[handIdx], p.faceUp[faceUpIdx]] = [p.faceUp[faceUpIdx], p.hand[handIdx]];
}

// =================== AI ===================
function botSwap(state, playerId) {
  const p = state.players[playerId];
  const valOf = (c) => c.rank === '10' ? 16 : c.rank === '2' ? 15 : RANK_VAL[c.rank];
  // Greedy: keep swapping while a hand card is more valuable than a face-up card
  for (let safety = 0; safety < 9; safety++) {
    let best = null;
    for (let h = 0; h < p.hand.length; h++) {
      for (let f = 0; f < p.faceUp.length; f++) {
        const gain = valOf(p.hand[h]) - valOf(p.faceUp[f]);
        if (gain > 0 && (!best || gain > best.gain)) best = { h, f, gain };
      }
    }
    if (!best) break;
    swapHandFaceUp(state, playerId, best.h, best.f);
  }
}

function botMove(state) {
  const p   = state.players[state.current];
  const src = getActiveSource(p, state);
  if (!src) return null;
  if (src === 'faceDown') {
    if (state.pickupChain > 0)  return { action: 'takeChain' };
    if (state.pendingSkips > 0) return { action: 'skip' };
    const idx = Math.floor(Math.random() * p.faceDown.length);
    return { action: 'blind', index: idx };
  }
  const pool = p[src];

  // Face-up phase: search for the longest valid chain through the face-up cards.
  if (src === 'faceUp') {
    let best = [];
    const visit = (prefix) => {
      if (prefix.length > best.length) best = prefix.slice();
      for (let i = 0; i < pool.length; i++) {
        if (prefix.includes(i)) continue;
        const card = pool[i];
        // Pickup-chain mode locks the entire play to chain-relevant cards: 2 / black-J / red-J
        // (with a black-J pending) / 10 (which burns the chain).
        if (state.pickupChain > 0) {
          const isChainCard = card.rank === '2' || card.rank === '10' || isJackBlack(card)
            || (isJackRed(card) && state.pendingBlackJacks > 0);
          if (!isChainCard) continue;
        }
        const valid = (prefix.length === 0)
          ? canPlayCard(card, state)
          : canPlayOnCard(card, pool[prefix[prefix.length - 1]]);
        if (valid) {
          prefix.push(i);
          visit(prefix);
          prefix.pop();
        }
      }
    };
    visit([]);

    if (best.length === 0) {
      if (state.pickupChain > 0)   return { action: 'takeChain' };
      if (state.pendingSkips > 0)  return { action: 'skip' };
      return { action: 'pickUp' };
    }
    const move = { action: 'play', source: 'faceUp', indices: best, rank: pool[best[0]].rank };
    if (best.some(i => pool[i].rank === 'A')) {
      // Pick a suit (only matters if A ends up on top, which the chain handles via survivors).
      const counts = { S: 0, H: 0, D: 0, C: 0 };
      pool.forEach((c, i) => {
        if (best.includes(i) || c.rank === 'A') return;
        counts[c.suit]++;
      });
      let bestSuit = 'S', bestN = -1;
      for (const s of ['S','H','D','C']) if (counts[s] > bestN) { bestSuit = s; bestN = counts[s]; }
      move.aceSuit = bestSuit;
    }
    return move;
  }

  // Helper: pick the best chain card for a solo King to dodge the penalty.
  // Allowed: another K, any A, any 10, or a same-suit-as-a-played-K non-K card.
  // Priority: don't waste high-value specials. Use cheap same-suit cards first; save 10s and Aces.
  const findKingChain = (kIdx) => {
    const kSuit = pool[kIdx].suit;
    // Legal K-chain partners: same-suit (any rank — 10 of same suit included), or an Ace of any
    // suit. 10s of a different suit are NOT legal chain partners (chains require numerical run).
    const cands = pool
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => i !== kIdx && c.rank !== 'K' && (
        c.rank === 'A' || c.suit === kSuit
      ));
    if (cands.length === 0) return null;

    // 1. Same-suit non-special low rank — cheapest dump.
    const sameSuitLow = cands
      .filter(({ c }) => c.suit === kSuit && !isSpecial(c.rank))
      .sort((a, b) => RANK_VAL[a.c.rank] - RANK_VAL[b.c.rank])[0];
    // 2. Same-suit cheap specials (2 / Q / 8).
    const sameSuit2 = cands.find(({ c }) => c.suit === kSuit && c.rank === '2');
    const sameSuitQ = cands.find(({ c }) => c.suit === kSuit && c.rank === 'Q');
    const sameSuit8 = cands.find(({ c }) => c.suit === kSuit && c.rank === '8');
    // 3. Any Ace — last resort; the wild has independent value.
    // (Same-suit 10 is NOT a valid K-chain partner under the strict 10 rule — 10 chains only
    //  via numerical sequence, and K→10 isn't ±1.)
    const anyA = cands.find(({ c }) => c.rank === 'A');
    const fallback = cands[0];

    return (sameSuitLow || sameSuit2 || sameSuitQ || sameSuit8 || anyA || fallback).i;
  };

  // Helper: build a play stack for a chosen rank (lead first; same-rank stack; K chain bonus).
  const buildIndicesForRank = (rank) => {
    const idxs = pool.map((c, i) => ({ c, i })).filter(x => x.c.rank === rank).map(x => x.i);
    const leadIdx = idxs.find(i => canPlayCard(pool[i], state));
    if (leadIdx == null) return null;
    let stack = idxs;
    if (rank === 'J') {
      // Same-colour stack only — mixed-colour Jack plays are illegal.
      const leadBlack = isJackBlack(pool[leadIdx]);
      stack = idxs.filter(i => isJackBlack(pool[i]) === leadBlack);
    }
    let indices = [leadIdx, ...stack.filter(i => i !== leadIdx)];
    if (rank === 'K' && indices.length === 1) {
      const chainI = findKingChain(leadIdx);
      if (chainI != null) indices = [leadIdx, chainI];
    }
    return indices;
  };

  // Pick the suit the bot has most of (including face-up cards it'll play later) — biggest benefit
  // is continuity, since the next-played suit will likely be the one the bot can follow on.
  const pickAceSuit = (excludeIndices) => {
    const counts = { S: 0, H: 0, D: 0, C: 0 };
    pool.forEach((c, i) => {
      if (excludeIndices.includes(i)) return;
      if (c.rank === 'A') return;
      counts[c.suit]++;
    });
    if (src !== 'faceUp') {
      for (const c of p.faceUp) {
        if (c.rank === 'A') continue;
        counts[c.suit]++;
      }
    }
    let best = 'S', bestN = -1;
    for (const s of ['S','H','D','C']) if (counts[s] > bestN) { best = s; bestN = counts[s]; }
    return best;
  };

  const playOf = (rank, indices) => {
    const move = { action: 'play', source: src, indices, rank };
    // Any Ace anywhere in the play (lead or chain) needs a named suit.
    if (indices.some(i => pool[i].rank === 'A')) {
      move.aceSuit = pickAceSuit(indices);
    }
    return move;
  };

  // ===== Pickup chain active: counter / burn-out / take =====
  if (state.pickupChain > 0) {
    // 1. Extend with 2s (cheapest contribution, +2). Pushes the problem to the opponent.
    const twoIdxs = pool.map((c, i) => ({ c, i })).filter(x => x.c.rank === '2').map(x => x.i);
    if (twoIdxs.length > 0) return playOf('2', twoIdxs);
    // 2. Cancel a black Jack with a red Jack — defensive, but at least dumps a card.
    if (state.pendingBlackJacks > 0) {
      const idxs = pool
        .map((c, i) => ({ c, i }))
        .filter(x => isJackRed(x.c))
        .slice(0, state.pendingBlackJacks)
        .map(x => x.i);
      if (idxs.length > 0) return playOf('J', idxs);
    }
    // 3. Extend with black Jack(s) (+5 each).
    const bjIdxs = pool.map((c, i) => ({ c, i })).filter(x => isJackBlack(x.c)).map(x => x.i);
    if (bjIdxs.length > 0) return playOf('J', bjIdxs);
    // 4. Burn the chain with a 10 — 10 is wild and clears the pack including the chain.
    const tenIdxs = pool.map((c, i) => ({ c, i })).filter(x => x.c.rank === '10').map(x => x.i);
    if (tenIdxs.length > 0) return playOf('10', [tenIdxs[0]]);
    // 5. Take the chain.
    return { action: 'takeChain' };
  }

  // ===== Pending skip (or 8 on top): only an 8 escapes. Otherwise skip. =====
  if (state.pendingSkips > 0) {
    const indices = buildIndicesForRank('8');
    if (indices) return playOf('8', indices);
    return { action: 'skip' };
  }

  // ===== Normal turn =====
  const ranksHere = [...new Set(pool.map(c => c.rank))];
  const playableRanks = ranksHere.filter(r => buildIndicesForRank(r) !== null);
  if (playableRanks.length === 0) return { action: 'pickUp' };

  // 1. Cheapest dump: lowest non-special, non-Jack card.
  const nonSp = playableRanks.filter(r => !isSpecial(r) && r !== 'J').sort((a, b) => RANK_VAL[a] - RANK_VAL[b]);
  if (nonSp.length > 0) return playOf(nonSp[0], buildIndicesForRank(nonSp[0]));

  // 2. Red Jacks — same-suit follow-up dumps with no chain effect outside an active chain.
  const playableRedJs = pool
    .map((c, i) => ({ c, i }))
    .filter(x => isJackRed(x.c) && canPlayCard(x.c, state))
    .map(x => x.i);
  if (playableRedJs.length > 0) return playOf('J', playableRedJs);

  // 3. K with a chain partner — dumps two cards in one turn (chain card priority is in findKingChain).
  if (playableRanks.includes('K')) {
    const kIdxs = buildIndicesForRank('K');
    if (kIdxs.length >= 2) return playOf('K', kIdxs);
  }

  // 4. Cheap specials (2 / Q / 8) — dump a card with a light effect.
  for (const r of ['2', 'Q', '8']) {
    if (playableRanks.includes(r)) return playOf(r, buildIndicesForRank(r));
  }

  // 5. Black Jack — starts a +5 pickup chain. Now constrained by the J-on-J/2/suit rule.
  const blackJs = pool.map((c, i) => ({ c, i })).filter(x => isJackBlack(x.c) && canPlayCard(x.c, state)).map(x => x.i);
  if (blackJs.length > 0) return playOf('J', blackJs);

  // 6. Ace — wild; name a suit. Saved for late because it's flexible.
  if (playableRanks.includes('A')) return playOf('A', buildIndicesForRank('A'));

  // 7. 10 — burn the pile. Saved for last because it's our best anti-pickup safety net.
  if (playableRanks.includes('10')) return playOf('10', buildIndicesForRank('10'));

  // 8. Solo K (+1 deck penalty) — last resort.
  if (playableRanks.includes('K')) return playOf('K', buildIndicesForRank('K'));

  return { action: 'pickUp' }; // unreachable in practice
}

// =================== APP STATE / UI ===================
let state        = null;
let mode         = null;       // 'ai' | 'local' | 'online-host' | 'online-join'
let myPlayerId   = 0;
let selected     = [];         // [{source, idx}, ...]
let autoPlay     = true;       // when false, bot turns wait for the human to click Continue
let pendingBotTurn = false;    // step-mode flag: a bot turn is queued
let actionLog    = [];         // [{ player, name, html, ts }, ...] running feed
let lastDirectionRendered = 1; // for animation triggering
let net          = null;       // multiplayer adapter
let swapSelected = { hand: null, faceUp: null };

const $  = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

// --------- card rendering ---------
// Hand-crafted SVG suit paths (centered around 0,0 in viewBox -50..50)
const SUIT_PATH = {
  S: 'M0,-44 C16,-22 40,-8 40,12 C40,25 30,35 18,35 C10,35 4,30 0,25 L6,42 L-6,42 L0,25 C-4,30 -10,35 -18,35 C-30,35 -40,25 -40,12 C-40,-8 -16,-22 0,-44 Z',
  H: 'M0,40 C-25,15 -40,0 -40,-15 C-40,-32 -28,-42 -15,-42 C-7,-42 -2,-37 0,-30 C2,-37 7,-42 15,-42 C28,-42 40,-32 40,-15 C40,0 25,15 0,40 Z',
  D: 'M0,-44 L36,0 L0,44 L-36,0 Z',
  C: 'M0,-42 C-10,-42 -18,-35 -18,-24 C-18,-18 -16,-13 -13,-9 C-22,-12 -34,-6 -34,8 C-34,18 -25,26 -14,26 C-8,26 -3,24 0,21 L-8,40 L8,40 L0,21 C3,24 8,26 14,26 C25,26 34,18 34,8 C34,-6 22,-12 13,-9 C16,-13 18,-18 18,-24 C18,-35 10,-42 0,-42 Z',
};

// Pip layouts for ranks 2–10 (coords inside a 100×140 card viewBox).
const PIP_LAYOUTS = {
  '2':  [[50,32],[50,108]],
  '3':  [[50,32],[50,70],[50,108]],
  '4':  [[30,32],[70,32],[30,108],[70,108]],
  '5':  [[30,32],[70,32],[50,70],[30,108],[70,108]],
  '6':  [[30,32],[70,32],[30,70],[70,70],[30,108],[70,108]],
  '7':  [[30,32],[70,32],[50,51],[30,70],[70,70],[30,108],[70,108]],
  '8':  [[30,32],[70,32],[50,51],[30,70],[70,70],[50,89],[30,108],[70,108]],
  '9':  [[30,32],[70,32],[30,57],[70,57],[50,70],[30,83],[70,83],[30,108],[70,108]],
  '10': [[30,32],[70,32],[50,45],[30,57],[70,57],[30,83],[70,83],[50,95],[30,108],[70,108]],
};

function injectSVGDefsOnce() {
  if (document.getElementById('shithead-svg-defs')) return;
  const tags = Object.entries(SUIT_PATH).map(([s, d]) =>
    `<symbol id="suit-${s}" viewBox="-50 -50 100 100"><path d="${d}" fill="currentColor"/></symbol>`
  ).join('');
  const defs = document.createElement('div');
  defs.id = 'shithead-svg-defs';
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defs.setAttribute('aria-hidden', 'true');
  defs.innerHTML = `<svg width="0" height="0"><defs>${tags}<pattern id="back-weave" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)"><rect width="14" height="14" fill="#7a1d1d"/><rect x="0" y="0" width="7" height="7" fill="#a23030"/><rect x="7" y="7" width="7" height="7" fill="#a23030"/></pattern></defs></svg>`;
  document.body.appendChild(defs);
}

function pipsSVG(rank, suit) {
  const layout = PIP_LAYOUTS[rank];
  if (!layout) return '';
  return layout.map(([x, y]) => {
    const flipped = y > 70 ? ` transform="rotate(180 ${x} ${y})"` : '';
    return `<use href="#suit-${suit}" x="${x - 9}" y="${y - 9}" width="18" height="18"${flipped}/>`;
  }).join('');
}

function faceCardSVG(rank, suit) {
  // Stylized monogram panel: thin border, tinted backdrop, big rank letter, small suit pips
  // at top-left and bottom-right (rotated). Aces get a single huge centred suit instead.
  if (rank === 'A') {
    return `<use href="#suit-${suit}" x="22" y="40" width="56" height="56"/>`;
  }
  return `
    <rect x="22" y="28" width="56" height="84" rx="4" ry="4" class="face-panel"/>
    <use href="#suit-${suit}" x="25" y="32" width="14" height="14"/>
    <use href="#suit-${suit}" x="61" y="98" width="14" height="14" transform="rotate(180 68 105)"/>
    <text x="50" y="82" class="face-letter" text-anchor="middle">${rank}</text>
  `;
}

function cornerSVG(rank, suit) {
  // Top-left corner: rank + tiny suit pip below it. The bottom-right corner is the same
  // group rotated 180° around the card centre.
  return `
    <text x="11" y="20" class="card-rank" text-anchor="middle">${rank}</text>
    <use href="#suit-${suit}" x="6" y="22" width="10" height="10"/>
  `;
}

function renderCardSVG(card) {
  const isRed = (card.suit === 'H' || card.suit === 'D');
  const colorClass = isRed ? 'red' : 'black';
  const center = (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === 'A')
    ? faceCardSVG(card.rank, card.suit)
    : pipsSVG(card.rank, card.suit);
  const corners = `
    <g>${cornerSVG(card.rank, card.suit)}</g>
    <g transform="rotate(180 50 70)">${cornerSVG(card.rank, card.suit)}</g>
  `;
  return `<svg class="card-svg ${colorClass}" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
    <rect x="1" y="1" width="98" height="138" rx="9" ry="9" class="card-bg"/>
    ${corners}
    ${center}
  </svg>`;
}

function renderCardBackSVG() {
  return `<svg class="card-svg card-back-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
    <rect x="1" y="1" width="98" height="138" rx="9" ry="9" fill="#7a1d1d"/>
    <rect x="4" y="4" width="92" height="132" rx="7" ry="7" fill="url(#back-weave)"/>
    <rect x="9" y="9" width="82" height="122" rx="5" ry="5" fill="none" stroke="#f1d9a4" stroke-width="0.8"/>
    <rect x="11" y="11" width="78" height="118" rx="4" ry="4" fill="none" stroke="#f1d9a4" stroke-width="0.4"/>
    <g transform="translate(50 70)" fill="#f1d9a4" font-family="Georgia, serif" font-weight="700">
      <circle r="22" fill="none" stroke="#f1d9a4" stroke-width="0.8"/>
      <circle r="18" fill="#5a1414"/>
      <text y="6" text-anchor="middle" font-size="16" letter-spacing="-1">SH</text>
    </g>
  </svg>`;
}

function renderCard(card, opts = {}) {
  injectSVGDefsOnce();
  const div = document.createElement('div');
  if (!card || opts.back) {
    div.className = 'card card-back';
    if (opts.size) div.classList.add(opts.size);
    div.innerHTML = renderCardBackSVG();
    return div;
  }
  const isRed = (card.suit === 'H' || card.suit === 'D');
  div.className = `card ${isRed ? 'red' : 'black'}`;
  if (opts.size) div.classList.add(opts.size);
  if (card.rank === '2')  div.classList.add('special-2');
  if (card.rank === '10') div.classList.add('special-10');
  div.innerHTML = renderCardSVG(card)
    + (opts.help === false ? '' : `<div class="help-icon" data-help="${card.rank}">?</div>`);
  return div;
}

// --------- main render ---------
function renderTable() {
  if (!state) return;
  const me = state.players[myPlayerId];

  // ---- Opponents ----
  const oppContainer = $('opponents');
  oppContainer.innerHTML = '';
  for (const p of state.players) {
    if (p.id === myPlayerId) continue;
    const opp = document.createElement('div');
    opp.className = 'opponent';
    opp.dataset.player = p.id;
    if (state.current === p.id && state.phase === 'play') opp.classList.add('active');
    if (p.finished) opp.classList.add('finished');

    const turnDot = (state.current === p.id && state.phase === 'play') ? '<span class="pulse">⏳</span>' : '';
    const trophy  = p.finished ? '🏆' : '';
    opp.innerHTML = `
      <div class="opponent-name">${trophy} ${escapeHtml(p.name)} ${turnDot}</div>
      <div class="opponent-counts">Hand: ${p.hand.length} • Up: ${p.faceUp.length} • Down: ${p.faceDown.length}${p.finished ? ' • OUT' : ''}</div>
    `;

    const stacks = document.createElement('div');
    stacks.className = 'opponent-stacks';
    for (let i = 0; i < p.faceDown.length; i++) stacks.appendChild(renderCard(null, { back: true, size: 'small' }));
    for (const c of p.faceUp) stacks.appendChild(renderCard(c, { size: 'small' }));
    opp.appendChild(stacks);

    if (p.hand.length > 0) {
      const hand = document.createElement('div');
      hand.className = 'opponent-hand';
      for (let i = 0; i < p.hand.length; i++) hand.appendChild(renderCard(null, { back: true, size: 'tiny' }));
      opp.appendChild(hand);
    }
    oppContainer.appendChild(opp);
  }

  // ---- Deck ----
  const deckEl = $('deck');
  deckEl.innerHTML = '';
  if (state.deck.length > 0) {
    deckEl.appendChild(renderCard(null, { back: true }));
    const lbl = document.createElement('div');
    lbl.className = 'pile-count';
    lbl.textContent = `${state.deck.length} left`;
    deckEl.appendChild(lbl);
  } else {
    const e = document.createElement('div');
    e.className = 'empty-slot';
    e.textContent = 'deck';
    deckEl.appendChild(e);
  }

  // ---- Discard ----
  const discardEl = $('discard');
  discardEl.innerHTML = '';
  const top = topDiscard(state);
  if (top) {
    discardEl.appendChild(renderCard(top));
    const cnt = document.createElement('div');
    cnt.className = 'pile-count';
    cnt.textContent = `${state.discard.length} card${state.discard.length === 1 ? '' : 's'}`;
    discardEl.appendChild(cnt);
  } else {
    const e = document.createElement('div');
    e.className = 'empty-slot';
    e.textContent = 'discard';
    discardEl.appendChild(e);
  }

  // ---- Turn indicator ----
  const turnLabel = $('turn-indicator');
  if (state.phase === 'over') {
    turnLabel.textContent = '🎉 Game Over';
  } else if (state.phase === 'swap') {
    turnLabel.textContent = 'Swap phase — ready up when satisfied';
  } else {
    const cur = state.players[state.current];
    turnLabel.textContent = (cur.id === myPlayerId) ? '🎯 Your turn' : `${cur.name}'s turn`;
  }

  // ---- Me header ----
  $('me-label').textContent = `${me.name}${(state.current === myPlayerId && state.phase === 'play') ? ' — your turn' : ''}`;
  const meHint = $('me-hint');
  const myActive = getActiveSource(me, state);
  if (state.phase === 'swap')                          meHint.textContent = 'Click a hand card and a face-up card to swap them.';
  else if (state.phase === 'over')                      meHint.textContent = '';
  else if (state.current !== myPlayerId)                meHint.textContent = 'Watching…';
  else if (state.pickupChain > 0)                        meHint.textContent = `Pickup chain: +${state.pickupChain}. Play a 2 (+2), a black Jack (+5), a red Jack (cancels a black Jack), or take the cards.`;
  else if (state.pendingSkips > 0)                      meHint.textContent = `8 played — ${state.pendingSkips} skip${state.pendingSkips === 1 ? '' : 's'} queued. Play an 8 to escape (and add to the queue), or click Skip Turn.`;
  else if (myActive === 'faceDown')                     meHint.textContent = 'Flip a face-down card. Brace yourself.';
  else if (myActive === 'faceUp')                       meHint.textContent = 'Hand and deck empty — play from your face-up cards. Follow suit, or play a special.';
  else                                                  meHint.textContent = 'Follow suit, or play a special. Same-rank cards stack.';

  // ---- Face-down row ----
  const fdEl = $('me-faceDown');
  fdEl.innerHTML = '';
  for (let i = 0; i < me.faceDown.length; i++) {
    const card = renderCard(null, { back: true, size: 'small' });
    if (state.phase === 'play' && state.current === myPlayerId && myActive === 'faceDown') {
      card.classList.add('clickable');
      card.title = 'Flip blindly';
      card.addEventListener('click', () => onBlindFlipClicked(i));
    }
    fdEl.appendChild(card);
  }

  // ---- Face-up row ----
  const fuEl = $('me-faceUp');
  fuEl.innerHTML = '';
  me.faceUp.forEach((c, i) => {
    const card = renderCard(c);
    if (state.phase === 'swap') {
      card.classList.add('clickable');
      if (swapSelected.faceUp === i) card.classList.add('selected');
      card.addEventListener('click', () => onSwapFaceUpClick(i));
    } else if (state.phase === 'play' && state.current === myPlayerId && myActive === 'faceUp') {
      if (isSelected('faceUp', i)) card.classList.add('selected');
      if (canSelect('faceUp', c)) {
        card.classList.add('clickable');
        card.addEventListener('click', () => onCardClick('faceUp', i));
      } else {
        card.classList.add('disabled');
      }
    }
    fuEl.appendChild(card);
  });

  // ---- Hand row ----
  const handEl = $('me-hand');
  handEl.innerHTML = '';
  if (me.hand.length === 0 && state.phase === 'play' && myActive !== 'hand') {
    const note = document.createElement('div');
    note.style.cssText = 'opacity:0.5;font-style:italic;align-self:center;';
    note.textContent = myActive === 'faceUp'
      ? '— hand empty, playing from face-up —'
      : myActive === 'faceDown'
        ? '— face-up gone too. Time for blind faith. —'
        : '— you are out! —';
    handEl.appendChild(note);
  }
  me.hand.forEach((c, i) => {
    const card = renderCard(c);
    if (state.phase === 'swap') {
      card.classList.add('clickable');
      if (swapSelected.hand === i) card.classList.add('selected');
      card.addEventListener('click', () => onSwapHandClick(i));
    } else if (state.phase === 'play' && state.current === myPlayerId && myActive === 'hand') {
      if (isSelected('hand', i)) card.classList.add('selected');
      if (canSelect('hand', c)) {
        card.classList.add('clickable');
        card.addEventListener('click', () => onCardClick('hand', i));
      } else {
        card.classList.add('disabled');
      }
    }
    handEl.appendChild(card);
  });

  renderActionButtons();
  $('event-log').textContent = state.lastEvent || '';
  renderDirection();
  renderActionLog();
}

// --------- selection helpers ---------
function isSelected(source, idx) {
  return selected.some(s => s.source === source && s.idx === idx);
}
function canSelect(source, card) {
  if (selected.length === 0) return canPlayCard(card, state);
  const me = state.players[myPlayerId];
  const first = selected[0];
  if (first.source !== source) return false;

  // Unified chain rule (hand AND face-up): each new card must legally play on the
  // previously-selected card. Same-rank stacks, K-chains, runs (up or down), and any
  // creative mix of those all flow through canPlayOnCard.
  const lastSel = selected[selected.length - 1];
  const lastCard = me[lastSel.source][lastSel.idx];
  return canPlayOnCard(card, lastCard);
}

// --------- click handlers (gameplay) ---------
function renderActionButtons() {
  if (!state) return;
  const me = state.players[myPlayerId];
  const myActive = getActiveSource(me, state);
  const playBtn   = $('btn-play');
  const pickupBtn = $('btn-pickup');
  const skipBtn   = $('btn-skip');
  const takeBtn   = $('btn-take');
  const stepBtn   = $('btn-step');
  const hideAux = () => {
    pickupBtn.style.display = 'none';
    if (skipBtn) skipBtn.style.display = 'none';
    if (takeBtn) takeBtn.style.display = 'none';
    if (stepBtn) stepBtn.style.display = 'none';
  };

  if (state.phase === 'swap') {
    playBtn.textContent = "I'm Ready";
    playBtn.disabled = false;
    playBtn.style.display = '';
    hideAux();
    return;
  }
  if (state.phase === 'over') {
    playBtn.style.display = 'none';
    hideAux();
    return;
  }

  // Step-mode pause: bot turn queued, show Continue.
  if (pendingBotTurn && !autoPlay) {
    playBtn.style.display = 'none';
    hideAux();
    if (stepBtn) {
      stepBtn.style.display = '';
      stepBtn.disabled = false;
      const cur = state.players[state.current];
      stepBtn.textContent = `▶ Continue — ${cur.name}'s turn`;
    }
    return;
  }

  if (state.current === myPlayerId) {
    playBtn.style.display = '';
    hideAux();
    if (state.pickupChain > 0) {
      playBtn.textContent = `Counter${selected.length ? ' (' + selected.length + ')' : ''}`;
      playBtn.disabled    = selected.length === 0;
      if (takeBtn) {
        takeBtn.style.display = '';
        takeBtn.textContent = `Take ${state.pickupChain} from Deck`;
        takeBtn.disabled = false;
      }
    } else if (state.pendingSkips > 0) {
      playBtn.textContent = `Play 8${selected.length > 1 ? ' ×' + selected.length : ''}`;
      playBtn.disabled    = selected.length === 0;
      if (skipBtn) { skipBtn.style.display = ''; skipBtn.disabled = false; }
    } else if (myActive === 'faceDown') {
      playBtn.textContent = 'Click a face-down card ↑';
      playBtn.disabled    = true;
    } else {
      playBtn.textContent = `Play${selected.length ? ' ' + selected.length : ''} Card${selected.length === 1 ? '' : 's'}`;
      playBtn.disabled    = selected.length === 0;
      pickupBtn.style.display = '';
      pickupBtn.disabled  = state.discard.length === 0;
    }
  } else {
    playBtn.style.display = 'none';
    hideAux();
  }
}

function renderDirection() {
  const arrow = $('direction-arrow');
  const glyph = $('direction-glyph');
  const label = $('direction-label');
  if (!arrow || !state) return;
  const reverse = state.direction === -1;
  if (state.direction !== lastDirectionRendered) {
    arrow.classList.remove('flipping');
    void arrow.offsetWidth;
    arrow.classList.add('flipping');
    lastDirectionRendered = state.direction;
  }
  if (glyph) glyph.textContent = reverse ? '↺' : '↻';
  if (label) label.textContent = reverse ? 'reversed' : 'clockwise';
}

function renderActionLog() {
  const el = $('action-log');
  if (!el) return;
  el.innerHTML = '';
  // Show newest first, cap at last 8
  actionLog.slice(-8).reverse().forEach((entry, i) => {
    const div = document.createElement('div');
    div.className = 'log-entry' + (i > 4 ? ' fading' : '');
    div.innerHTML = `<span class="who">${escapeHtml(entry.name)}:</span> <span class="what">${entry.html}</span>`;
    el.appendChild(div);
  });
}

function appendActionLog(entry) {
  actionLog.push(entry);
  if (actionLog.length > 60) actionLog = actionLog.slice(-60);
}

function onCardClick(source, idx) {
  if (isSelected(source, idx)) {
    // Unified chain mode (hand AND face-up): clicking a selected card drops it
    // and every link that came after it, preserving the chain invariant.
    const pos = selected.findIndex(s => s.source === source && s.idx === idx);
    selected = selected.slice(0, pos);
  } else {
    const me = state.players[myPlayerId];
    const card = me[source][idx];
    if (canSelect(source, card)) {
      selected.push({ source, idx });
    }
  }
  renderTable();
}
function onPlayClick() {
  if (state.phase === 'swap') { onReadyClick(); return; }
  if (state.phase === 'play' && state.current === myPlayerId && selected.length) {
    const me = state.players[myPlayerId];
    const source  = selected[0].source;
    const indices = selected.map(s => s.idx);
    const cards = indices.map(i => me[source][i]);
    const lastIsAce = cards[cards.length - 1].rank === 'A';
    const anyAce    = cards.some(c => c.rank === 'A');
    if (lastIsAce) {
      // Last card is an Ace — its suit-naming will matter for the next player.
      askAceSuit((suit) => {
        selected = [];
        sendOrApplyMove({ type: 'play', source, indices, aceSuit: suit });
      });
      return;
    }
    selected = [];
    // Buried Aces: the engine still requires aceSuit, but the named suit gets cleared by the
    // non-Ace card that lands on top. Pass any valid suit.
    sendOrApplyMove(anyAce
      ? { type: 'play', source, indices, aceSuit: 'S' }
      : { type: 'play', source, indices });
  }
}

function askAceSuit(cb) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:380px;">
      <h2 style="color:var(--primary);">Name the suit</h2>
      <p>Your Ace is wild. Which suit must the next player follow?</p>
      <div class="suit-picker">
        <button class="suit-btn" data-s="S">♠<small>Spades</small></button>
        <button class="suit-btn" data-s="H">♥<small>Hearts</small></button>
        <button class="suit-btn" data-s="D">♦<small>Diamonds</small></button>
        <button class="suit-btn" data-s="C">♣<small>Clubs</small></button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.suit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const suit = btn.dataset.s;
      overlay.remove();
      cb(suit);
    });
  });
}
function onPickupClick() {
  if (state.phase === 'play' && state.current === myPlayerId) {
    sendOrApplyMove({ type: 'pickUp' });
  }
}
function onBlindFlipClicked(idx) {
  if (state.phase === 'play' && state.current === myPlayerId) {
    sendOrApplyMove({ type: 'blind', index: idx });
  }
}
function onSwapHandClick(idx) {
  swapSelected.hand = (swapSelected.hand === idx) ? null : idx;
  tryCommitSwap();
  renderTable();
}
function onSwapFaceUpClick(idx) {
  swapSelected.faceUp = (swapSelected.faceUp === idx) ? null : idx;
  tryCommitSwap();
  renderTable();
}
function tryCommitSwap() {
  if (swapSelected.hand != null && swapSelected.faceUp != null) {
    sendOrApplyMove({ type: 'swap', hand: swapSelected.hand, faceUp: swapSelected.faceUp });
    swapSelected = { hand: null, faceUp: null };
  }
}
function onReadyClick() {
  if (state.phase === 'swap') sendOrApplyMove({ type: 'ready' });
}

// --------- move dispatch ---------
function sendOrApplyMove(move) {
  if (mode === 'online-join') { net.sendToHost({ type: 'move', move, playerId: myPlayerId }); return; }
  applyMove(move, myPlayerId);
}

function applyMove(move, playerId) {
  if (!state) return;
  const prevEvent = state.lastEvent;
  if (move.type === 'swap' && state.phase === 'swap') {
    swapHandFaceUp(state, playerId, move.hand, move.faceUp);
  } else if (move.type === 'ready' && state.phase === 'swap') {
    state.swapReady.add(playerId);
  } else if (state.phase === 'play' && state.current === playerId) {
    let result;
    if      (move.type === 'play')      result = playCards(state, move.source, move.indices, move.aceSuit);
    else if (move.type === 'pickUp')    result = pickUp(state);
    else if (move.type === 'blind')     result = blindFlip(state, move.index);
    else if (move.type === 'skip')      result = skipTurn(state);
    else if (move.type === 'takeChain') result = takeChain(state);

    // Defensive: if a play is rejected, log the state so we can debug and fall back to a safe
    // legal action — pick up the pile (or take the chain / accept the skip) so the game never
    // looks like the bot just illegally played something.
    if (result && result.ok === false) {
      const top = topDiscard(state);
      const cards = move.indices ? move.indices.map(i => {
        const c = state.players[playerId][move.source]?.[i];
        return c ? c.rank + (c.suit ? c.suit : '') : '?';
      }) : null;
      console.warn('[applyMove] move REJECTED:', {
        error: result.error, move,
        top: top ? top.rank + top.suit : 'empty',
        pendingSkips: state.pendingSkips, pickupChain: state.pickupChain,
        aceSuit: state.aceSuit, cards
      });
      // Safe fallback so the game keeps moving (and humans never see a phantom illegal play).
      if (state.pickupChain > 0) takeChain(state);
      else if (state.pendingSkips > 0) skipTurn(state);
      else pickUp(state);
    }
  }

  // Append a log entry whenever the engine produced a fresh narration.
  if (state.lastEvent && state.lastEvent !== prevEvent && state.lastEventPlayer != null) {
    const actor = state.players[state.lastEventPlayer];
    if (actor) {
      const tags = state.lastEventTags || [];
      const isBurn = tags.includes('burn') || tags.includes('fourOfKind');
      // Strip the leading "Name plays …" and just keep the action description.
      let what = state.lastEvent.replace(new RegExp('^' + actor.name + '\\s+'), '');
      appendActionLog({ player: actor.id, name: actor.name, html: escapeHtml(what), ts: Date.now(), burn: isBurn });
    }
  }

  if (mode === 'online-host') net.broadcastState();
  postMoveProcessing();
}

function postMoveProcessing() {
  renderTable();
  // Visual: flash a burn over the discard if the last move triggered one.
  const tags = (state && state.lastEventTags) || [];
  if (tags.includes('burn') || tags.includes('fourOfKind')) flashBurnOnDiscard();
  // Mark the freshly-played top card so it animates in.
  const topCard = document.querySelector('#discard .card');
  if (topCard) { topCard.classList.add('fresh'); setTimeout(() => topCard.classList.remove('fresh'), 320); }
  maybeShowReactions();

  if (state.phase === 'over') { showGameOver(); return; }

  // Auto-ready bots in swap phase (host of any local-flavoured mode)
  if (state.phase === 'swap' && (mode === 'ai' || mode === 'local' || mode === 'online-host')) {
    let changed = false;
    for (const p of state.players) {
      if (!p.isHuman && !state.swapReady.has(p.id)) {
        botSwap(state, p.id);
        state.swapReady.add(p.id);
        changed = true;
      }
    }
    if (state.swapReady.size >= state.players.length) {
      startPlay(state);
      if (mode === 'online-host') net.broadcastState();
      renderTable();
    } else if (changed && mode === 'online-host') {
      net.broadcastState();
    }
  }

  // Pass-and-play: hand off to next un-readied human in swap phase
  if (state.phase === 'swap' && mode === 'local') {
    const nextHuman = state.players.find(p => p.isHuman && !state.swapReady.has(p.id));
    if (nextHuman && nextHuman.id !== myPlayerId) {
      showPassScreen(nextHuman, 'is up to swap');
    }
  }

  // Play phase
  if (state.phase === 'play') {
    const cur = state.players[state.current];
    if (!cur.isHuman && (mode === 'ai' || mode === 'local' || mode === 'online-host')) {
      if (autoPlay) {
        // Slow the pace so a human can actually read what's happened.
        const delay = 1700 + Math.floor(Math.random() * 700);
        showThinking(cur.id);
        pendingBotTurn = false;
        setTimeout(() => { if (autoPlay) botTurn(); }, delay);
      } else {
        // Step mode: queue the bot turn and surface the Continue button via render.
        pendingBotTurn = true;
        renderActionButtons();
      }
      return;
    }
    if (mode === 'local' && cur.isHuman && cur.id !== myPlayerId) {
      showPassScreen(cur, "'s turn");
    }
  }
}

function botTurn() {
  if (!state || state.phase !== 'play') return;
  const cur = state.players[state.current];
  if (cur.isHuman) return;
  const move = botMove(state);
  if (!move) return;
  if      (move.action === 'pickUp')    applyMove({ type: 'pickUp' }, cur.id);
  else if (move.action === 'skip')      applyMove({ type: 'skip' }, cur.id);
  else if (move.action === 'takeChain') applyMove({ type: 'takeChain' }, cur.id);
  else if (move.action === 'blind')     applyMove({ type: 'blind', index: move.index }, cur.id);
  else if (move.action === 'play') {
    const m = { type: 'play', source: move.source, indices: move.indices };
    if (move.aceSuit) m.aceSuit = move.aceSuit;
    applyMove(m, cur.id);
  }
}

// --------- reactions / banter ---------
const REACTIONS = {
  burn: [
    { emoji: '🔥', text: 'Absolute weapon!' },
    { emoji: '🔥', text: 'Cheeky bugger.' },
    { emoji: '🥵', text: 'Oof, you\'ve done it now.' },
    { emoji: '😤', text: 'Show off, you.' },
    { emoji: '👏', text: 'Cracking play.' },
    { emoji: '😬', text: 'That\'s gonna sting someone.' },
  ],
  fourOfKind: [
    { emoji: '🎯', text: 'Have it!' },
    { emoji: '🤯', text: 'FOUR of them?! Pack it in.' },
    { emoji: '👀', text: 'Where you been hiding those?' },
    { emoji: '🥳', text: 'Absolute scenes.' },
    { emoji: '💅', text: 'Cool as a cucumber.' },
  ],
  pickUp: [
    { emoji: '📦', text: 'Bin lorry has arrived.' },
    { emoji: '🤣', text: 'Absolute meltdown.' },
    { emoji: '😬', text: 'Painful, that.' },
    { emoji: '🥲', text: 'Bless your cotton socks.' },
    { emoji: '🪣', text: 'Bucket-bound, you.' },
    { emoji: '🤡', text: 'Clown energy.' },
    { emoji: '🥴', text: 'Yikes, mate.' },
    { emoji: '🫠', text: 'Just melt away then.' },
    { emoji: '🐌', text: 'Take your time, love.' },
  ],
  soloKing: [
    { emoji: '👑', text: 'Royal mug.' },
    { emoji: '🤴', text: 'Crowned a numpty.' },
    { emoji: '🤦', text: 'Unforced error, sire.' },
    { emoji: '😭', text: 'King without a court.' },
    { emoji: '🪙', text: 'Pay the toll, your majesty.' },
  ],
  skip: [
    { emoji: '💤', text: 'Night night.' },
    { emoji: '😴', text: 'Off to bed with you.' },
    { emoji: '🚪', text: 'Sit this one out.' },
    { emoji: '🤐', text: 'Hush now.' },
    { emoji: '🙊', text: 'Quiet, you.' },
  ],
  reverse: [
    { emoji: '🔄', text: 'Plot twist!' },
    { emoji: '😏', text: 'Oh do behave.' },
    { emoji: '🙃', text: 'Topsy-turvy now.' },
    { emoji: '🌀', text: 'Right, that\'ll throw a spanner in.' },
  ],
  finished: [
    { emoji: '🏆', text: 'Top of the class.' },
    { emoji: '👏', text: 'Get in!' },
    { emoji: '😎', text: 'Smug, but earned.' },
    { emoji: '🍾', text: 'Crack open the bubbles.' },
    { emoji: '🫡', text: 'Salute.' },
  ],
  blindGood: [
    { emoji: '🎲', text: 'Jammy git.' },
    { emoji: '🍀', text: 'Born lucky, you.' },
    { emoji: '😏', text: 'Suspiciously lucky.' },
    { emoji: '🎯', text: 'Surgical, that.' },
  ],
  blindBad: [
    { emoji: '💀', text: 'Tragic.' },
    { emoji: '🪦', text: 'RIP your dignity.' },
    { emoji: '🥹', text: 'Aw, mate.' },
    { emoji: '😬', text: 'That\'s grim viewing.' },
    { emoji: '🤕', text: 'Ouch. Painful.' },
  ],
  reset: [
    { emoji: '🦥', text: 'Booooring.' },
    { emoji: '🥱', text: 'Stalling, are we?' },
    { emoji: '🚪', text: 'Reset deployed.' },
    { emoji: '😒', text: 'Real safe play.' },
  ],
  chainAdd: [
    { emoji: '📤', text: 'Right, that\'s yours, that.' },
    { emoji: '😈', text: 'Stack \'em up.' },
    { emoji: '🪤', text: 'Trap set, cheers.' },
    { emoji: '🥷', text: 'Devious.' },
    { emoji: '🃏', text: 'Take that, mate.' },
  ],
  chainCancel: [
    { emoji: '✋', text: 'Hold up — red Jack saves the day.' },
    { emoji: '🛡️', text: 'Defended like a champ.' },
    { emoji: '😏', text: 'Nice escape, weasel.' },
    { emoji: '🪄', text: 'Vanished, just like that.' },
  ],
  chainTaken: [
    { emoji: '😩', text: 'Oof — pile of fresh cards for you.' },
    { emoji: '🥲', text: 'Pour one out for the deck-taker.' },
    { emoji: '📚', text: 'Reading material.' },
    { emoji: '🫠', text: 'Stack of shame, that.' },
    { emoji: '🤐', text: 'Don\'t mug it off again.' },
  ],
  aceCalled: [
    { emoji: '🎩', text: 'Ohhhh fancy, calling the suit.' },
    { emoji: '👑', text: 'High and mighty.' },
    { emoji: '🤌', text: 'Big-brain move.' },
    { emoji: '🪄', text: 'Magic that.' },
  ],
  general: [
    { emoji: '👍', text: 'Nice one.' },
    { emoji: '🙄', text: 'Was that it?' },
    { emoji: '😐', text: 'Decent enough, I s\'pose.' },
    { emoji: '💅', text: 'Cool as.' },
    { emoji: '🤷', text: 'Eh.' },
    { emoji: '🤨', text: 'Hmm.' },
    { emoji: '🫥', text: 'Forgettable.' },
  ],
};
const REACTION_PRIORITY = ['fourOfKind','finished','soloKing','chainTaken','chainCancel','chainAdd','aceCalled','burn','reverse','skip','blindBad','blindGood','pickUp','reset','general'];

function maybeShowReactions() {
  if (!state || state.phase !== 'play' && state.phase !== 'over') return;
  const tags = state.lastEventTags || [];
  const movePlayerId = state.lastEventPlayer;
  if (movePlayerId == null) return;

  let pool = REACTIONS.general;
  for (const tag of REACTION_PRIORITY) {
    if (tags.includes(tag) && REACTIONS[tag]) { pool = REACTIONS[tag]; break; }
  }
  const others = state.players.filter(p => p.id !== movePlayerId && !p.finished);
  if (others.length === 0) return;

  // 70% chance one player reacts; 25% two react; 5% silence (still feels alive without spam).
  const roll = Math.random();
  if (roll < 0.05) return;
  const count = roll < 0.75 ? 1 : Math.min(2, others.length);
  const shuffled = others.slice().sort(() => Math.random() - 0.5).slice(0, count);
  shuffled.forEach((reactor, i) => {
    const r = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => showReactionBubble(reactor.id, r), i * 350);
  });
}

function showReactionBubble(playerId, reaction, fromHuman) {
  document.querySelectorAll('.reaction[data-player="' + playerId + '"]').forEach(el => el.remove());
  const target = (playerId === myPlayerId)
    ? document.querySelector('.me-area')
    : document.querySelector('.opponent[data-player="' + playerId + '"]');
  if (!target) return;
  const player = state && state.players ? state.players[playerId] : null;
  const name   = player ? player.name : '';
  const bubble = document.createElement('div');
  bubble.className = 'reaction' + (fromHuman ? ' from-human' : '');
  bubble.dataset.player = playerId;
  bubble.innerHTML = `<span class="r-name">${escapeHtml(name)}</span><span class="r-emoji">${reaction.emoji}</span><span class="r-text">${escapeHtml(reaction.text)}</span>`;
  target.appendChild(bubble);
  setTimeout(() => bubble.classList.add('fade'), 2600);
  setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 3100);
}

function flashBurnOnDiscard() {
  const discardEl = document.getElementById('discard');
  if (!discardEl) return;
  const flash = document.createElement('div');
  flash.className = 'burn-flash';
  flash.textContent = '🔥';
  discardEl.appendChild(flash);
  setTimeout(() => { if (flash.parentNode) flash.remove(); }, 950);
}

function showThinking(playerId) {
  if (playerId === myPlayerId) return;
  document.querySelectorAll('.thinking').forEach(el => el.remove());
  const target = document.querySelector('.opponent[data-player="' + playerId + '"]');
  if (!target) return;
  const bubble = document.createElement('div');
  bubble.className = 'thinking';
  bubble.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  target.appendChild(bubble);
  setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 1600);
}

// --------- pass screen (hot-seat) ---------
function showPassScreen(targetPlayer, suffix) {
  // remove any existing
  document.querySelectorAll('.passover').forEach(el => el.remove());
  const overlay = document.createElement('div');
  overlay.className = 'passover';
  overlay.innerHTML = `
    <h2>Pass the device to</h2>
    <h1>${escapeHtml(targetPlayer.name)}</h1>
    <p>${escapeHtml(targetPlayer.name + ' ' + suffix)}. Hide your screen from prying eyes.</p>
    <button class="primary" id="pass-go">Tap to begin</button>
  `;
  document.body.appendChild(overlay);
  $('pass-go').addEventListener('click', () => {
    myPlayerId = targetPlayer.id;
    selected   = [];
    swapSelected = { hand: null, faceUp: null };
    overlay.remove();
    renderTable();
  });
}

// --------- game over ---------
function showGameOver() {
  document.querySelectorAll('.passover').forEach(el => el.remove());
  const shithead = state.players[state.shithead];
  const winners  = state.finishedOrder.map(id => state.players[id].name);
  const insultFn = INSULTS[Math.floor(Math.random() * INSULTS.length)];
  const insult   = shithead ? insultFn(shithead.name) : 'Nobody won. Nobody lost. The cards have failed us.';
  const chore    = CHORES[Math.floor(Math.random() * CHORES.length)];

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>👎 ${shithead ? escapeHtml(shithead.name) + ' is the SHITHEAD!' : 'Game over.'}</h2>
      <p class="insult">${insult}</p>
      <div class="chore">📋 By ancient decree: ${escapeHtml(chore)}</div>
      <p style="margin-top:18px;font-size:13px;color:var(--muted);">
        Finishing order: ${winners.length ? winners.map((n,i) => `<strong>${i+1}.</strong> ${escapeHtml(n)}`).join(' &nbsp; → &nbsp; ') : '— none —'}
      </p>
      <div class="actions-row">
        <button class="primary" id="play-again">Play Again</button>
        <button class="ghost"   id="back-lobby">Back to Lobby</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  $('play-again').addEventListener('click', () => { overlay.remove(); restartGame(); });
  $('back-lobby').addEventListener('click', () => { overlay.remove(); backToLobby(); });
}

// --------- restart / lobby ---------
function restartGame() {
  if (mode === 'online-join') { backToLobby(); return; } // can only restart from host
  const names  = state.players.map(p => p.name);
  const humans = state.players.map(p => p.isHuman);
  state = newGame(names);
  state.players.forEach((p, i) => p.isHuman = humans[i]);
  selected     = [];
  swapSelected = { hand: null, faceUp: null };
  if (mode === 'local') {
    myPlayerId = state.players.findIndex(p => p.isHuman);
    if (myPlayerId < 0) myPlayerId = 0;
  } else if (mode === 'ai') {
    myPlayerId = state.players.findIndex(p => p.isHuman);
    if (myPlayerId < 0) myPlayerId = 0;
  }
  if (mode === 'online-host') net.broadcastState();
  renderTable();
  postMoveProcessing();
}

function backToLobby() {
  state = null;
  selected     = [];
  swapSelected = { hand: null, faceUp: null };
  if (net) { try { net.cleanup(); } catch (e) {} net = null; }
  document.querySelectorAll('.passover, .modal-overlay').forEach(el => el.remove());
  $('table').classList.remove('active');
  $('lobby').classList.add('active');
  $('mode-config').classList.add('hidden');
  $('mode-config').innerHTML = '';
}

// --------- tooltip (card help) ---------
const tooltipEl = () => $('tooltip');
function placeTooltip(el) {
  const t = tooltipEl();
  const rect = el.getBoundingClientRect();
  t.classList.add('show');
  // Position after measuring
  const tRect = t.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - tRect.width / 2;
  let top  = rect.bottom + 8;
  if (left < 8) left = 8;
  if (left + tRect.width > window.innerWidth - 8) left = window.innerWidth - tRect.width - 8;
  if (top + tRect.height > window.innerHeight - 8) top = rect.top - tRect.height - 8;
  t.style.left = left + 'px';
  t.style.top  = top  + 'px';
}
document.addEventListener('mouseover', (e) => {
  const el = e.target.closest('[data-help]');
  if (el) {
    const rank = el.dataset.help;
    const t = tooltipEl();
    t.innerHTML = CARD_INFO[rank] || rank;
    placeTooltip(el);
  }
});
document.addEventListener('mouseout', (e) => {
  const el = e.target.closest('[data-help]');
  if (el) tooltipEl().classList.remove('show');
});
// Touch support: tap a help icon
document.addEventListener('click', (e) => {
  const el = e.target.closest('.help-icon');
  if (el && el.matches('[data-help]')) {
    e.stopPropagation();
    const t = tooltipEl();
    if (t.classList.contains('show') && t.dataset.helpRank === el.dataset.help) {
      t.classList.remove('show');
    } else {
      t.innerHTML = CARD_INFO[el.dataset.help] || el.dataset.help;
      t.dataset.helpRank = el.dataset.help;
      placeTooltip(el);
      setTimeout(() => tooltipEl().classList.remove('show'), 4000);
    }
  }
});

// --------- top-bar buttons ---------
$('btn-rules').addEventListener('click', () => $('rules-sidebar').classList.toggle('open'));
$('rules-close').addEventListener('click', () => $('rules-sidebar').classList.remove('open'));
$('btn-new').addEventListener('click', () => {
  if (!state || state.phase === 'over' || confirm('Abandon current game and return to the lobby?')) backToLobby();
});

// --------- mode selection ---------
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => showModeConfig(btn.dataset.mode));
});

function showModeConfig(m) {
  mode = m;
  const cfg = $('mode-config');
  cfg.classList.remove('hidden');
  cfg.innerHTML = '';

  if (m === 'ai')           buildAiConfig(cfg);
  else if (m === 'local')   buildLocalConfig(cfg);
  else if (m === 'online-host') buildHostConfig(cfg);
  else if (m === 'online-join') buildJoinConfig(cfg);
}

function buildAiConfig(cfg) {
  cfg.innerHTML = `
    <h3>vs Bots</h3>
    <div class="row"><label>Your name <input type="text" id="cfg-name" value="You" maxlength="16"></label></div>
    <div class="row"><label>Bot opponents
      <select id="cfg-bots">
        <option value="1">1 bot (2 players)</option>
        <option value="2" selected>2 bots (3 players)</option>
        <option value="3">3 bots (4 players)</option>
        <option value="4">4 bots (5 players)</option>
      </select></label></div>
    <button class="primary" id="cfg-start">Deal!</button>
  `;
  $('cfg-start').addEventListener('click', () => {
    const myName = ($('cfg-name').value.trim() || 'You').slice(0, 16);
    const bots   = parseInt($('cfg-bots').value, 10);
    const names  = [myName, ...Array.from({ length: bots }, (_, i) => BOT_NAMES[i] || `Bot ${i + 1}`)];
    const humans = [true, ...Array(bots).fill(false)];
    startLocalGame(names, humans, 0);
  });
}

function buildLocalConfig(cfg) {
  cfg.innerHTML = `
    <h3>Pass &amp; Play</h3>
    <p class="muted">Add 2–5 players. Mix humans and bots however you like.</p>
    <div id="cfg-players"></div>
    <div class="row" style="margin-top:8px;">
      <button class="ghost"  id="cfg-add-human">+ Add human</button>
      <button class="ghost"  id="cfg-add-bot">+ Add bot</button>
      <button class="primary" id="cfg-start">Deal!</button>
    </div>
  `;
  const playersDiv = $('cfg-players');
  const players = [
    { name: 'Player 1', human: true },
    { name: 'Player 2', human: true },
  ];
  function renderPlayers() {
    playersDiv.innerHTML = '';
    players.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input type="text" value="${escapeHtml(p.name)}" data-idx="${i}" maxlength="16">
        <span class="muted">${p.human ? '🧑 Human' : '🤖 Bot'}</span>
        ${players.length > 2 ? `<button class="ghost" data-rm="${i}">remove</button>` : ''}
      `;
      playersDiv.appendChild(row);
    });
    playersDiv.querySelectorAll('input[type=text]').forEach(inp => {
      inp.addEventListener('input', () => { players[+inp.dataset.idx].name = inp.value; });
    });
    playersDiv.querySelectorAll('button[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => { players.splice(+btn.dataset.rm, 1); renderPlayers(); });
    });
  }
  renderPlayers();
  $('cfg-add-human').addEventListener('click', () => {
    if (players.length < 5) { players.push({ name: `Player ${players.length + 1}`, human: true }); renderPlayers(); }
  });
  $('cfg-add-bot').addEventListener('click', () => {
    if (players.length < 5) {
      const bots = players.filter(p => !p.human).length;
      players.push({ name: BOT_NAMES[bots] || `Bot ${bots + 1}`, human: false });
      renderPlayers();
    }
  });
  $('cfg-start').addEventListener('click', () => {
    if (players.length < 2) return alert('Need at least 2 players');
    const names    = players.map(p => (p.name.trim() || 'Player').slice(0, 16));
    const humans   = players.map(p => p.human);
    const firstHum = humans.indexOf(true);
    if (firstHum < 0) return alert('At least one player must be human (otherwise nobody is around to make tea)');
    startLocalGame(names, humans, firstHum);
  });
}

function startLocalGame(names, humansArr, primaryHumanId) {
  state = newGame(names);
  state.players.forEach((p, i) => p.isHuman = humansArr[i]);
  myPlayerId   = primaryHumanId;
  selected     = [];
  swapSelected = { hand: null, faceUp: null };
  $('lobby').classList.remove('active');
  $('table').classList.add('active');
  renderTable();
  postMoveProcessing();
}

// =================== ONLINE MULTIPLAYER (PeerJS) ===================
function buildHostConfig(cfg) {
  cfg.innerHTML = `
    <h3>Host Online Game</h3>
    <div class="row"><label>Your name <input type="text" id="cfg-name" value="Host" maxlength="16"></label></div>
    <button class="primary" id="cfg-host">Create Room</button>
    <div id="host-room" class="hidden" style="margin-top:18px;"></div>
  `;
  $('cfg-host').addEventListener('click', () => {
    if (typeof Peer === 'undefined') return alert('PeerJS failed to load. Check your network.');
    const name = ($('cfg-name').value.trim() || 'Host').slice(0, 16);
    startHosting(name);
  });
}

function startHosting(myName) {
  $('cfg-host').disabled = true;
  $('cfg-host').textContent = 'Connecting…';

  const peer = new Peer();
  peer.on('open', (id) => {
    showHostLobby(peer, id, myName);
  });
  peer.on('error', (err) => {
    alert('Network error: ' + (err.message || err.type || err));
    console.error(err);
    $('cfg-host').disabled = false;
    $('cfg-host').textContent = 'Create Room';
  });
}

function showHostLobby(peer, peerId, hostName) {
  const div = $('host-room');
  div.classList.remove('hidden');
  div.innerHTML = `
    <p>Share this <strong>room code</strong> with friends. They'll paste it into "Join Online":</p>
    <div class="code-display" id="copy-id" title="Click to copy">${escapeHtml(peerId)}</div>
    <p class="muted" style="font-size:12px;">Peer-to-peer over WebRTC. The room exists only as long as this tab stays open.</p>
    <h4 style="margin-top:14px;margin-bottom:6px;">Players in lobby</h4>
    <ul class="players-list" id="lobby-players"></ul>
    <button class="primary" id="start-online">Start Game</button>
  `;
  $('copy-id').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(peerId);
      const el = $('copy-id');
      const orig = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(() => el.textContent = orig, 1200);
    } catch (e) {/* fallback: just leave it */}
  });

  const connections = []; // { conn, name, playerId? }

  function refreshLobby() {
    const ul = $('lobby-players');
    if (!ul) return;
    let html = `<li><strong>${escapeHtml(hostName)}</strong> <span class="muted">(you, host)</span></li>`;
    connections.forEach(c => { html += `<li>${escapeHtml(c.name)}</li>`; });
    ul.innerHTML = html;
  }
  refreshLobby();

  peer.on('connection', (conn) => {
    if (state) { conn.on('open', () => { conn.send({ type: 'reject', reason: 'Game already started' }); setTimeout(() => conn.close(), 200); }); return; }
    if (connections.length >= 4) {
      conn.on('open', () => { conn.send({ type: 'reject', reason: 'Room is full' }); setTimeout(() => conn.close(), 200); });
      return;
    }
    conn.on('open', () => {
      conn.on('data', (data) => {
        if (data.type === 'hello') {
          connections.push({ conn, name: (String(data.name || 'Player')).slice(0, 16) });
          conn.send({ type: 'welcome' });
          refreshLobby();
        } else if (data.type === 'move' && state && data.playerId != null) {
          applyMove(data.move, data.playerId);
        }
      });
      conn.on('close', () => {
        const idx = connections.findIndex(c => c.conn === conn);
        if (idx >= 0) {
          connections.splice(idx, 1);
          refreshLobby();
        }
      });
    });
  });

  net = {
    cleanup() {
      connections.forEach(c => { try { c.conn.close(); } catch (e) {} });
      try { peer.destroy(); } catch (e) {}
    },
    broadcastState() {
      connections.forEach(c => {
        if (c.playerId == null) return;
        try {
          c.conn.send({ type: 'state', state: serializeStateFor(state, c.playerId) });
        } catch (e) { console.warn('broadcast failed', e); }
      });
    },
  };

  $('start-online').addEventListener('click', () => {
    if (connections.length === 0) return alert('Need at least one other player to join.');
    const allNames = [hostName, ...connections.map(c => c.name)];
    state = newGame(allNames);
    state.players.forEach(p => p.isHuman = true);
    connections.forEach((c, i) => { c.playerId = i + 1; });
    myPlayerId   = 0;
    selected     = [];
    swapSelected = { hand: null, faceUp: null };

    // Tell each client which player they are
    connections.forEach(c => {
      try { c.conn.send({ type: 'assign', playerId: c.playerId }); } catch (e) {}
    });

    $('lobby').classList.remove('active');
    $('table').classList.add('active');
    renderTable();
    net.broadcastState();
    postMoveProcessing();
  });
}

function buildJoinConfig(cfg) {
  cfg.innerHTML = `
    <h3>Join Online Game</h3>
    <div class="row"><label>Your name <input type="text" id="cfg-name" value="Player" maxlength="16"></label></div>
    <div class="row"><label>Room code <input type="text" id="cfg-code" placeholder="paste full code here" style="min-width:280px;"></label></div>
    <button class="primary" id="cfg-join">Join</button>
    <div id="join-status" class="muted" style="margin-top:10px;font-size:13px;"></div>
  `;
  $('cfg-join').addEventListener('click', () => {
    if (typeof Peer === 'undefined') return alert('PeerJS failed to load. Check your network.');
    const name = ($('cfg-name').value.trim() || 'Player').slice(0, 16);
    const code = $('cfg-code').value.trim();
    if (!code) return alert('Enter a room code first.');
    joinRoom(code, name);
  });
}

function joinRoom(roomId, myName) {
  $('cfg-join').disabled = true;
  $('cfg-join').textContent = 'Joining…';
  $('join-status').textContent = 'Connecting to broker…';

  const peer = new Peer();
  peer.on('open', () => {
    $('join-status').textContent = 'Connecting to host…';
    const conn = peer.connect(roomId, { reliable: true });
    let timeoutId = setTimeout(() => {
      $('join-status').textContent = 'Connection timed out. Check the code and try again.';
      try { conn.close(); } catch (e) {}
      try { peer.destroy(); } catch (e) {}
      $('cfg-join').disabled = false;
      $('cfg-join').textContent = 'Join';
    }, 15000);

    conn.on('open', () => {
      clearTimeout(timeoutId);
      $('join-status').textContent = 'Connected. Waiting for host to start…';
      conn.send({ type: 'hello', name: myName });
      conn.on('data', (data) => {
        if (data.type === 'reject') {
          alert('Rejected: ' + data.reason);
          try { peer.destroy(); } catch (e) {}
          $('cfg-join').disabled = false;
          $('cfg-join').textContent = 'Join';
        } else if (data.type === 'welcome') {
          // wait for assign + state
        } else if (data.type === 'assign') {
          myPlayerId = data.playerId;
        } else if (data.type === 'state') {
          state = deserializeStateForClient(data.state);
          $('lobby').classList.remove('active');
          $('table').classList.add('active');
          renderTable();
          if (state.phase === 'over') showGameOver();
        }
      });
    });
    conn.on('error', (e) => {
      $('join-status').textContent = 'Error: ' + (e.message || e);
    });
    conn.on('close', () => {
      $('join-status').textContent = 'Disconnected from host.';
    });

    net = {
      cleanup() { try { conn.close(); } catch (e) {} try { peer.destroy(); } catch (e) {} },
      sendToHost(msg) { try { conn.send(msg); } catch (e) {} },
      broadcastState() {},
    };
  });
  peer.on('error', (err) => {
    $('join-status').textContent = 'Network error: ' + (err.message || err.type || err);
    $('cfg-join').disabled = false;
    $('cfg-join').textContent = 'Join';
  });
}

// Redact other players' hands & face-down values for a given viewer
function serializeStateFor(s, viewerId) {
  return {
    deckCount: s.deck.length,
    discard: s.discard.slice(),
    burned: s.burned,
    players: s.players.map(p => ({
      id: p.id, name: p.name, finished: p.finished, isHuman: p.isHuman,
      hand:     p.id === viewerId ? p.hand.slice() : new Array(p.hand.length).fill(null),
      faceUp:   p.faceUp.slice(),
      faceDown: new Array(p.faceDown.length).fill(null),
    })),
    current: s.current,
    direction: s.direction,
    pendingSkips: s.pendingSkips || 0,
    lastEightPlayer: s.lastEightPlayer != null ? s.lastEightPlayer : null,
    pickupChain: s.pickupChain || 0,
    pendingBlackJacks: s.pendingBlackJacks || 0,
    aceSuit: s.aceSuit || null,
    finishedOrder: s.finishedOrder.slice(),
    phase: s.phase,
    lastEvent: s.lastEvent,
    lastEventTags: (s.lastEventTags || []).slice(),
    lastEventPlayer: s.lastEventPlayer,
    swapReady: [...(s.swapReady || [])],
    shithead: s.shithead,
  };
}

function deserializeStateForClient(packet) {
  return {
    deck:    new Array(packet.deckCount).fill(null),
    discard: packet.discard,
    burned:  packet.burned,
    players: packet.players,
    current: packet.current,
    direction: packet.direction != null ? packet.direction : 1,
    pendingSkips: packet.pendingSkips || 0,
    lastEightPlayer: packet.lastEightPlayer != null ? packet.lastEightPlayer : null,
    pickupChain: packet.pickupChain || 0,
    pendingBlackJacks: packet.pendingBlackJacks || 0,
    aceSuit: packet.aceSuit || null,
    finishedOrder: packet.finishedOrder,
    phase:   packet.phase,
    lastEvent: packet.lastEvent,
    lastEventTags: packet.lastEventTags || [],
    lastEventPlayer: packet.lastEventPlayer != null ? packet.lastEventPlayer : null,
    swapReady: new Set(packet.swapReady),
    shithead: packet.shithead,
  };
}

function onSkipClick() {
  if (state && state.phase === 'play' && state.current === myPlayerId && state.pendingSkips > 0) {
    sendOrApplyMove({ type: 'skip' });
  }
}
function onTakeChainClick() {
  if (state && state.phase === 'play' && state.current === myPlayerId && state.pickupChain > 0) {
    sendOrApplyMove({ type: 'takeChain' });
  }
}

// =================== INIT ===================
$('btn-play').addEventListener('click', onPlayClick);
$('btn-pickup').addEventListener('click', onPickupClick);
const _skipBtn = $('btn-skip');
if (_skipBtn) _skipBtn.addEventListener('click', onSkipClick);
const _takeBtn = $('btn-take');
if (_takeBtn) _takeBtn.addEventListener('click', onTakeChainClick);

// Auto-play / step toggle
const _autoToggle = $('auto-play-toggle');
if (_autoToggle) {
  _autoToggle.addEventListener('change', () => {
    autoPlay = _autoToggle.checked;
    // If we flipped back to auto-play with a bot turn pending, fire it now.
    if (autoPlay && pendingBotTurn) {
      pendingBotTurn = false;
      setTimeout(botTurn, 400);
      renderActionButtons();
    } else {
      renderActionButtons();
    }
  });
}

// Step button — fires the queued bot turn in step mode.
const _stepBtn = $('btn-step');
if (_stepBtn) {
  _stepBtn.addEventListener('click', () => {
    if (!pendingBotTurn) return;
    pendingBotTurn = false;
    renderActionButtons();
    botTurn();
  });
}

// Emoji picker — human reactions.
document.querySelectorAll('#emoji-picker .emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state || state.phase !== 'play') return;
    const emoji = btn.dataset.emoji;
    const text  = btn.dataset.text || '';
    showReactionBubble(myPlayerId, { emoji, text }, true);
  });
});

$('lobby').classList.add('active');
