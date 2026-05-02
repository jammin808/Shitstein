'use strict';

/* ============================================================
 *  SHITHEAD — fully client-side card game
 *  Engine + AI + UI + WebSocket multiplayer (relay in /relay)
 * ============================================================ */

// =================== CONSTANTS ===================
const RANKS    = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const SUITS    = ['S','H','D','C'];
const SUIT_SYM = { S:'♠', H:'♥', D:'♦', C:'♣' };
const RANK_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

// Specials override the follow-suit rule and trigger their own effects.
const SPECIALS = new Set(['2', '7', '8', '10', 'Q', 'K', 'A']);
function isSpecial(rank) { return SPECIALS.has(rank); }
function isJackBlack(card) { return card.rank === 'J' && (card.suit === 'S' || card.suit === 'C'); }
function isJackRed(card)   { return card.rank === 'J' && (card.suit === 'H' || card.suit === 'D'); }

const CARD_INFO = {
  '2':  '<strong>2 — Wild lead, pick up two.</strong><br>A 2 of any suit plays on <em>any</em> top card — same as a 10. The only block is when the 8 skip queue is active (the next player owes a skip and must play another 8). The next player after a 2 must pick up <strong>2 cards</strong> from the deck — unless they play a 2 (+2 more), a black Jack (+5), or a red Jack (cancels a black Jack). Stacking another 2 passes the additive total down the chain. <em>In your own hand chain, however, a 2 is NOT wild</em> — it must follow numerical sequence: same rank (pair), strictly consecutive same-suit (±1), or the low-Ace neighbour (A↔2 same suit). The exception: a 2 may chain off a black Jack to extend the pickup chain. <em>If a multi-card run starts with a 2 (or Jack) but ends on a non-chain card (e.g., 2♥ + 3♥ + 4♥), the pickup chain is cancelled and the next player just plays on the last card.</em>',
  '3':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '4':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '5':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '6':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '7':  '<strong>7 — Lower-or-equal lock.</strong><br>A 7 plays per the normal rule (higher same suit, equal rank, or per chain rules — it is NOT wild). When a 7 is on top, the next player must play <strong>7 or lower</strong> (any card 2–7 of any suit — the suit/rank rule is overridden) or a 10 (wild, burns the pile). 8 / 9 / J / Q / K / A are blocked.',
  '8':  '<strong>8 — Skip stack.</strong><br>An 8 can only be played on another 8, or on a lower rank in the same suit. <strong>Each 8 played stacks one skip in the queue</strong> — play two 8s, the next two players miss their go. While the skip queue is alive, only another 8 plays. Once the queue drains, the 8 on top becomes a normal card and the following player plays per the usual rules. With wraparound, the original 8-player can get another go. <em>In your own hand chain, an 8 chains by numerical sequence (±1 same suit, e.g., 7♠ → 8♠ → 9♠) or as a same-rank pair (8 + 8 of any suits).</em>',
  '9':  'Standard card. Plays on a higher rank in the same suit, or the same rank in any suit. In a multi-card play, each card must chain to the previous via either the same rank, OR the next rank up or down in the same suit (a strict run — no jumps).',
  '10': '<strong>10 — Burn!</strong><br>A 10 of any suit can be played on <em>anything</em> to clear the pack — including breaking out of a pickup chain. (Still rejected while skips from an 8 are queued.) <em>In a chain, however, a 10 must be in numerical sequence</em> like any other card — a 10 isn\'t wild as a chain link.',
  'J':  '<strong>Jack.</strong><br>A Jack can only be played on another Jack, or on a lower rank in the same suit. <strong>Black Jacks</strong> (♠ ♣) add <strong>+5</strong> to a pickup chain. <strong>Red Jacks</strong> (♥ ♦) cancel the most recent black Jack and its 5 cards. <em>In your own hand chain, a Jack chains by numerical sequence (±1 same suit, e.g., 10♠ → J♠ → Q♠) or as a same-rank pair (J + J of any suits).</em>',
  'Q':  '<strong>Q — Reverse &amp; lock.</strong><br>A Queen can <em>only</em> be played on another Queen or in suit. Flips the direction of play (with two players, the same player goes again). Once a Q is on top, it can only be followed by another Queen, a higher rank in the Q\'s suit, a 2, a 10, or an Ace.',
  'K':  '<strong>K — Royal demand.</strong><br>A King can only be played on another King or in suit. <em>Exceptions:</em> a K cannot follow a freshly-placed 8 or Jack — the previous player must have had a turn to react first. A K <em>can</em> follow a freshly-placed 2, but only if it\'s the same suit. <strong>When chaining off a K in your own play</strong>, the legal followers are: another K (pair), <em>any card of the K\'s suit</em>, a 10 of any suit (burns the pile), or the same-suit Ace (high-Ace ±1). Played solo? Pick up one extra card from the deck as penalty.',
  'A':  '<strong>A — Wild lead, suit-pivot in chains.</strong><br>An Ace of any suit can lead at any time, except after a 2, a black Jack, or an 8. <em>You name the called suit as soon as you click the Ace</em> — the next player must follow that suit. In a chain, the Ace also acts as a suit-pivot: the called suit becomes the chain\'s direction, and the Ace can be high (14) or low (1), so the legal next chain link is another Ace (pair), the <strong>K of the called suit</strong> (high), or the <strong>2 of the called suit</strong> (low). E.g. A♥ called as ♠ → K♠ or 2♠ chains.',
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

// =================== AUDIO (8-bit synth, chiptune-style) ===================
// Tiny self-contained Web Audio module: a master gain feeding music + sfx sub-buses.
// All sounds are synthesised on the fly — no audio files. The music is a chiptune-ish
// loop with a square-wave melody and a triangle-wave bass; sfx are short blip sequences.
const Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicSchedTimer = null;
  let musicLoopEnd = 0;
  let muted        = (typeof localStorage !== 'undefined' && localStorage.getItem('shitstein-muted') === '1');
  let musicEnabled = (typeof localStorage === 'undefined' || localStorage.getItem('shitstein-music') !== '0');

  // MP3 background-music support. Drop files into /music and either list them in
  // music/manifest.json or name them 1.mp3, 2.mp3, ... — see music/README.md.
  // musicMode: 'mp3' or 'synth'. Defaults to 'mp3' if any tracks are discovered,
  // otherwise 'synth'. User's explicit choice (via the topbar button) is persisted.
  const MUSIC_DIR = 'music/';
  const PROBE_LIMIT = 20;
  const PROBE_EXTS = ['.mp3', '.mpeg', '.mpg'];
  let mp3Tracks = [];                                // [{ url, name }]
  let mp3Index = 0;
  let mp3Audio = null;                               // HTMLAudioElement
  let mp3Source = null;                              // MediaElementAudioSourceNode
  let musicMode = (typeof localStorage !== 'undefined' ? localStorage.getItem('shitstein-music-mode') : null);
  if (musicMode !== 'mp3' && musicMode !== 'synth') musicMode = null; // resolved after discovery

  let musicFilter = null;   // LPF on the tonal voices only — sweeps with intensity
  let tonalGain   = null;   // melody / harmony / bass route here (filter applies)
  let drumBus     = null;   // kick / snare / hat route here (filter bypassed)
  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.45;
    sfxGain.connect(master);
    // Music graph (so the filter sweep doesn't murder the drums):
    //   tonalGain  → musicFilter (LPF, swept) ↘
    //                                          musicGain (master volume) → master
    //   drumBus    → ────────────────────────↗
    // Tonal voices feel the intensity-driven cutoff; drums always come through clear.
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.12;
    musicGain.connect(master);

    musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 1800;
    musicFilter.Q.value = 0.5;
    musicFilter.connect(musicGain);

    tonalGain = ctx.createGain();
    tonalGain.gain.value = 1.0;
    tonalGain.connect(musicFilter);

    drumBus = ctx.createGain();
    drumBus.gain.value = 1.6; // a bit hotter so drums sit forward
    drumBus.connect(musicGain);
    return ctx;
  }
  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function blip(freq, dur, type, gain, when) {
    if (!ctx) init();
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.25, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  function blipSeq(notes, type, gain, gap) {
    let when = 0;
    notes.forEach(([f, d]) => { blip(f, d, type, gain, when); when += d + (gap || 0); });
  }

  // Sweep helper for "whoosh"-style sfx.
  function sweep(fromHz, toHz, dur, type, gain, when) {
    if (!ctx) init();
    if (!ctx || muted) return;
    const t = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.setValueAtTime(fromHz, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.3, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  const SFX = {
    play:           () => blipSeq([[523, 0.05], [659, 0.06]], 'square', 0.22),
    chain:          () => blipSeq([[523, 0.04], [659, 0.04], [784, 0.05]], 'square', 0.18),
    burn:           () => { sweep(900, 120, 0.45, 'sawtooth', 0.32); blip(220, 0.18, 'square', 0.22, 0.12); },
    pickup:         () => blipSeq([[294, 0.10], [247, 0.14]], 'square', 0.25),
    take:           () => blipSeq([[330, 0.08], [262, 0.12]], 'triangle', 0.25),
    skip:           () => blipSeq([[523, 0.04], [392, 0.05], [330, 0.06]], 'square', 0.20),
    reverse:        () => blipSeq([[523, 0.06], [659, 0.06], [784, 0.06], [659, 0.06], [523, 0.08]], 'square', 0.20),
    select:         () => blip(880, 0.03, 'square', 0.10),
    deselect:       () => blip(440, 0.03, 'square', 0.08),
    newgame:        () => blipSeq([[262, 0.10], [330, 0.10], [392, 0.10], [523, 0.20]], 'square', 0.25),
    gameover:       () => blipSeq([[523, 0.20], [494, 0.20], [440, 0.40]], 'square', 0.30),
    reaction:       () => blip(880, 0.04, 'triangle', 0.15),
    sort:           () => blip(659, 0.03, 'triangle', 0.10),
    'special-2':      () => blipSeq([[523, 0.05], [659, 0.06], [784, 0.06]], 'square', 0.25),
    'special-7':      () => blipSeq([[392, 0.06], [330, 0.06], [262, 0.08]], 'triangle', 0.25),
    'special-8':      () => blipSeq([[440, 0.04], [494, 0.04], [554, 0.04], [620, 0.06]], 'square', 0.20),
    'special-Q':      () => blipSeq([[784, 0.06], [587, 0.06], [392, 0.08]], 'square', 0.25),
    'special-K':      () => blipSeq([[523, 0.06], [659, 0.06], [784, 0.10], [1047, 0.16]], 'square', 0.30),
    'special-A':      () => blipSeq([[1047, 0.04], [1319, 0.04], [1568, 0.06], [2093, 0.08]], 'square', 0.20),
    'special-Jblack': () => blipSeq([[220, 0.08], [165, 0.10]], 'sawtooth', 0.30),
    'special-Jred':   () => blipSeq([[659, 0.06], [659, 0.06]], 'square', 0.20, 0.05),
  };
  function sfx(name) {
    if (muted) return;
    if (!ctx) init();
    resume();
    if (SFX[name]) SFX[name]();
  }

  // ----- Human-style mouth whistle (idle-attention call) -----
  // Synthesized with a sine carrier + 6 Hz vibrato (LFO) + bandpass-filtered breath
  // noise underneath, with an upward pitch slide so it reads as "hey, you" rather
  // than a flat tone. level 0..1 controls duration / intensity / number of beeps.
  function whistleTone(when, fromHz, toHz, dur, gain) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(fromHz, when);
    osc.frequency.linearRampToValueAtTime(toHz, when + dur * 0.8);
    osc.frequency.exponentialRampToValueAtTime(toHz * 0.96, when + dur);
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    lfoG.gain.value = 14;
    lfo.connect(lfoG);
    lfoG.connect(osc.frequency);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.04);
    g.gain.linearRampToValueAtTime(gain * 0.85, when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g); g.connect(sfxGain);
    osc.start(when); lfo.start(when);
    osc.stop(when + dur + 0.05); lfo.stop(when + dur + 0.05);
    // Breath noise — gives it the human air-rush quality
    const noise = ctx.createBufferSource();
    noise.buffer = getNoise();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = (fromHz + toHz) / 2;
    filt.Q.value = 6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, when);
    ng.gain.linearRampToValueAtTime(gain * 0.18, when + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.7);
    noise.connect(filt); filt.connect(ng); ng.connect(sfxGain);
    noise.start(when); noise.stop(when + dur);
  }
  function whistle(level) {
    if (muted) return;
    if (!ctx) init();
    resume();
    if (!ctx) return;
    const t = ctx.currentTime;
    if ((level || 0) >= 1) {
      // Urgent two-note "hey-hey!" — rising in pitch and volume
      whistleTone(t,        1700, 2100, 0.20, 0.30);
      whistleTone(t + 0.28, 1900, 2400, 0.30, 0.36);
    } else {
      // Single subtle "psst" — single rising note
      whistleTone(t, 1650, 1950, 0.26, 0.24);
    }
  }

  // ===== Music engine — multi-section chiptune in C major =====
  // 132 BPM (was 110 — punchier tempo, ~20% faster). Each section is 4 bars (~7.3 s).
  // C major instead of A minor — same scale notes, different tonal centre, way brighter
  // mood. Phrases resolve to C / E / G (the I chord) for a satisfied, cheerful feel.
  const TEMPO = 132;
  const BEAT = 60 / TEMPO;
  const BEATS_PER_SECTION = 16;

  // Pre-built 1-second white-noise buffer (re-used by all drum hits via filtered slices).
  let _noiseBuf = null;
  function getNoise() {
    if (!_noiseBuf && ctx) {
      _noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = _noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return _noiseBuf;
  }
  // Drum primitives: noise + filter (shaped via biquad), with optional tonal layer for the
  // kick + snare body. All routed through the music sub-bus so the master / mute control
  // them along with the melody.
  function drumKick(when, gain) {
    if (!ctx) return;
    const t = when;
    const tone = ctx.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(130, t);
    tone.frequency.exponentialRampToValueAtTime(45, t + 0.09);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(gain * 0.65, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    tone.connect(tg); tg.connect(drumBus);
    tone.start(t); tone.stop(t + 0.11);
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 110; filt.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.30, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(filt); filt.connect(g); g.connect(drumBus);
    src.start(t); src.stop(t + 0.07);
  }
  function drumSnare(when, gain) {
    if (!ctx) return;
    const t = when;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 1700; filt.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.55, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
    src.connect(filt); filt.connect(g); g.connect(drumBus);
    src.start(t); src.stop(t + 0.11);
    const tone = ctx.createOscillator();
    tone.type = 'triangle'; tone.frequency.setValueAtTime(220, t);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(gain * 0.25, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    tone.connect(tg); tg.connect(drumBus);
    tone.start(t); tone.stop(t + 0.06);
  }
  function drumHat(when, gain) {
    if (!ctx) return;
    const t = when;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 7000; filt.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    src.connect(filt); filt.connect(g); g.connect(drumBus);
    src.start(t); src.stop(t + 0.05);
  }
  // Tonal voice — used by melody (square), harmony (sawtooth), and bass (triangle).
  // Routed through tonalGain so the music low-pass filter shapes only the tonal layers.
  function playNote(freq, dur, type, gain, when) {
    if (!ctx || !freq) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.012);
    g.gain.linearRampToValueAtTime(gain * 0.55, when + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur - 0.005);
    osc.connect(g); g.connect(tonalGain);
    osc.start(when); osc.stop(when + dur);
  }

  // Section library — 16 beats each (4 bars × 4 beats). Notes are [Hz, beats].
  // Sections: A / A2 (calm, alternating), B / B2 (verse, alternating), C / C2 (intense,
  // alternating), D (climax, rare). The variants are picked probabilistically so the
  // same intensity level doesn't loop the same phrase forever — psychological captivation
  // comes from familiarity + variation, not repetition.
  // C major reference frequencies used below:
  // C2=65, C3=131, D3=147, E3=165, F3=175, G3=196, A3=220, B3=247
  // C4=262, D4=294, E4=330, F4=349, G4=392, A4=440, B4=494
  // C5=523, D5=587, E5=659, F5=698, G5=784, A5=880, B5=988, C6=1047, D6=1175
  const SECTIONS = {
    A: { // Calm — bright C-major arpeggio that resolves to G (sun-out-of-clouds)
      melody: [
        [523, 1], [659, 1], [784, 1], [659, 1],   // C E G E
        [698, 1], [659, 1], [587, 1], [523, 1],   // F E D C
        [587, 1], [659, 1], [784, 1], [880, 1],   // D E G A
        [784, 2], [659, 2],                        // G E (resolve up)
      ],
      harmony: [ // sustained 5ths over the I and IV chords
        [392, 4], [392, 4], [349, 4], [392, 4],   // G G F G
      ],
      bass: [ // I-I-IV-V
        [131, 4], [131, 4], [175, 4], [196, 4],   // C C F G
      ],
      kicks:  [0, 4, 8, 12],
      snares: [],
      hats:   [0, 2, 4, 6, 8, 10, 12, 14],
      melodyGain: 0.085, bassGain: 0.16, harmonyGain: 0.07, drumGain: 0.65,
    },
    A2: { // Calm variant — ascending answer phrase
      melody: [
        [392, 1], [440, 1], [523, 1], [659, 1],   // G A C E (walking up)
        [784, 1], [659, 1], [523, 1], [440, 1],   // G E C A (back down)
        [494, 1], [523, 1], [587, 1], [659, 1],   // B C D E
        [523, 2], [659, 2],                        // C E
      ],
      harmony: [
        [330, 4], [392, 4], [330, 4], [392, 4],   // E G E G
      ],
      bass: [
        [131, 4], [196, 4], [175, 4], [131, 4],   // C G F C
      ],
      kicks:  [0, 4, 8, 12],
      snares: [],
      hats:   [0, 2, 4, 6, 8, 10, 12, 14],
      melodyGain: 0.085, bassGain: 0.16, harmonyGain: 0.07, drumGain: 0.65,
    },
    B: { // Verse — bouncy C major hook, classic I-IV-V-I progression
      melody: [
        [523, 1], [659, 1], [784, 1], [659, 1],   // C E G E
        [698, 1], [880, 1], [784, 1], [659, 1],   // F A G E
        [587, 1], [698, 1], [880, 1], [988, 1],   // D F A B
        [1047, 2], [784, 2],                       // C G (high resolve)
      ],
      harmony: [ // syncopated 5ths on the off-beats
        [0, 0.5], [392, 0.5], [0, 0.5], [392, 0.5],
        [0, 0.5], [440, 0.5], [0, 0.5], [440, 0.5],
        [0, 0.5], [494, 0.5], [0, 0.5], [523, 0.5],
        [659, 2], [523, 2],
      ],
      bass: [ // walking C-F-G-C
        [131, 2], [196, 2], [175, 2], [262, 2],
        [196, 2], [294, 2], [131, 2], [196, 2],
      ],
      kicks:  [0, 4, 8, 12],
      snares: [2, 6, 10, 14],
      hats:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      melodyGain: 0.10, bassGain: 0.18, harmonyGain: 0.075, drumGain: 0.90,
    },
    B2: { // Verse variant — high octave call, lower answer
      melody: [
        [1047, 1], [880, 1], [784, 1], [659, 1],   // C A G E (descending)
        [523, 0.5], [587, 0.5], [659, 1], [784, 0.5], [880, 0.5],
        [659, 1], [523, 1], [659, 1], [784, 1],   // E C E G
        [1047, 2], [659, 2],                        // C E
      ],
      harmony: [
        [0, 1], [523, 1], [0, 1], [392, 1],
        [0, 1], [440, 1], [0, 1], [392, 1],
        [330, 2], [440, 2],
        [523, 2], [392, 2],
      ],
      bass: [
        [131, 1], [131, 1], [196, 2],
        [175, 1], [175, 1], [262, 2],
        [196, 1], [196, 1], [294, 2],
        [131, 2], [196, 2],
      ],
      kicks:  [0, 4, 8, 12],
      snares: [2, 6, 10, 14],
      hats:   [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      melodyGain: 0.10, bassGain: 0.18, harmonyGain: 0.075, drumGain: 0.90,
    },
    C: { // Intense — 8th-note runs in C major, full ensemble
      melody: [
        [523, 0.5], [659, 0.5], [784, 0.5], [1047, 0.5],
        [880, 0.5], [784, 0.5], [659, 0.5], [523, 0.5],
        [698, 0.5], [880, 0.5], [1047, 0.5], [1175, 0.5],
        [1047, 0.5], [880, 0.5], [784, 0.5], [659, 0.5],
        [587, 0.5], [698, 0.5], [880, 0.5], [988, 0.5],
        [1047, 1], [880, 1],
        [784, 0.5], [988, 0.5], [880, 0.5], [659, 0.5],
        [523, 2],
      ],
      harmony: [ // 3rds and 5ths underneath the lead
        [330, 2], [392, 2], [440, 2], [392, 2],
        [349, 2], [440, 2], [330, 2], [392, 2],
      ],
      bass: [ // arpeggiated I (C E G E) → IV → V → I
        [131, 0.5], [196, 0.5], [262, 0.5], [196, 0.5],
        [131, 0.5], [196, 0.5], [262, 0.5], [196, 0.5],
        [175, 0.5], [262, 0.5], [349, 0.5], [262, 0.5],
        [175, 0.5], [262, 0.5], [349, 0.5], [262, 0.5],
        [196, 0.5], [294, 0.5], [392, 0.5], [294, 0.5],
        [196, 0.5], [294, 0.5], [392, 0.5], [294, 0.5],
        [131, 0.5], [196, 0.5], [262, 0.5], [196, 0.5],
        [131, 0.5], [196, 0.5], [262, 0.5], [196, 0.5],
      ],
      kicks:  [0, 2, 4, 6, 8, 10, 12, 14],
      snares: [2, 6, 10, 14],
      hats:   Array.from({ length: 32 }, (_, i) => i * 0.5),
      melodyGain: 0.105, bassGain: 0.18, harmonyGain: 0.085, drumGain: 1.05,
    },
    C2: { // Intense variant — descending lead, hopping bass
      melody: [
        [1047, 0.5], [988, 0.5], [1047, 0.5], [1175, 0.5],
        [1319, 1], [1047, 1],
        [880, 0.5], [988, 0.5], [880, 0.5], [784, 0.5],
        [698, 1], [523, 1],
        [988, 0.5], [880, 0.5], [988, 0.5], [880, 0.5],
        [784, 0.5], [659, 0.5], [698, 0.5], [784, 0.5],
        [523, 0.5], [659, 0.5], [784, 0.5], [1047, 0.5],
        [784, 2],
      ],
      harmony: [
        [392, 1], [440, 1], [523, 1], [392, 1],
        [349, 1], [440, 1], [330, 1], [392, 1],
        [392, 2], [523, 2],
        [330, 2], [392, 2],
      ],
      bass: [
        [131, 0.5], [262, 0.5], [131, 0.5], [262, 0.5],
        [196, 0.5], [262, 0.5], [196, 0.5], [262, 0.5],
        [175, 0.5], [349, 0.5], [175, 0.5], [349, 0.5],
        [196, 0.5], [392, 0.5], [196, 0.5], [392, 0.5],
        [131, 0.5], [262, 0.5], [131, 0.5], [262, 0.5],
        [175, 0.5], [349, 0.5], [175, 0.5], [349, 0.5],
        [131, 0.5], [196, 0.5], [262, 0.5], [196, 0.5],
        [131, 2],
      ],
      kicks:  [0, 2, 4, 6, 8, 10, 12, 14],
      snares: [2, 6, 10, 14],
      hats:   Array.from({ length: 32 }, (_, i) => i * 0.5),
      melodyGain: 0.105, bassGain: 0.18, harmonyGain: 0.085, drumGain: 1.05,
    },
    D: { // Climax — modulation to G major (lift!), snare rolls
      melody: [
        [784, 0.5], [988, 0.5], [1175, 0.5], [1568, 0.5],
        [1397, 1], [1175, 0.5], [988, 0.5],
        [880, 0.5], [1175, 0.5], [1397, 0.5], [1568, 0.5],
        [1760, 2],
        [1568, 0.5], [1397, 0.5], [1175, 0.5], [988, 0.5],
        [1175, 1], [880, 1],
        [784, 0.5], [988, 0.5], [1175, 0.5], [1397, 0.5],
        [1175, 2],
      ],
      harmony: [
        [392, 1], [494, 1], [587, 1], [784, 1],
        [659, 4],
        [494, 1], [587, 1], [784, 1], [988, 1],
        [784, 4],
      ],
      bass: [ // G-D-G-D modulation, then back to C resolution
        [98, 0.5], [147, 0.5], [196, 0.5], [147, 0.5],
        [98, 0.5], [147, 0.5], [196, 0.5], [147, 0.5],
        [98, 0.5], [196, 0.5], [294, 0.5], [196, 0.5],
        [98, 0.5], [196, 0.5], [294, 0.5], [196, 0.5],
        [110, 0.5], [165, 0.5], [220, 0.5], [165, 0.5],
        [123, 0.5], [196, 0.5], [247, 0.5], [196, 0.5],
        [131, 0.5], [196, 0.5], [262, 0.5], [196, 0.5],
        [131, 4],
      ],
      kicks:  [0, 2, 4, 6, 8, 10, 12, 14],
      snares: [2, 4, 6, 7, 10, 12, 14, 15], // roll fills at the end of bars 2 and 4
      hats:   Array.from({ length: 32 }, (_, i) => i * 0.5),
      melodyGain: 0.115, bassGain: 0.20, harmonyGain: 0.095, drumGain: 1.10,
    },
  };
  // Track previous section so variant rotation can pick a different sibling next time.
  let _lastSection = null;

  function computeIntensity() {
    if (typeof state === 'undefined' || !state || state.phase !== 'play') return 0;
    let i = 0.32;
    if (state.pickupChain   > 0) i = Math.max(i, 0.95);
    if (state.pendingSkips  > 0) i = Math.max(i, 0.72);
    const tags = state.lastEventTags || [];
    if (tags.includes('chainAdd'))    i = Math.max(i, 0.85);
    if (tags.includes('fourOfKind'))  i = Math.max(i, 0.65);
    if (tags.includes('burn'))        i = Math.max(i, 0.55);
    if ((state.discard.length || 0) > 7) i = Math.max(i, 0.50);
    return i;
  }
  // Pick the next section. At each intensity tier there's a "main" section and a "variant"
  // (A/A2, B/B2, C/C2). We rotate the pair so the same phrase doesn't repeat back-to-back.
  // At very high intensity, occasionally drop the climax (D — a modulation to D minor with
  // snare rolls and peak energy) for a satisfying release.
  function pickSection(intensity) {
    let pool;
    if (intensity >= 0.85) {
      // Climax can fire ~30% of the time at peak intensity; otherwise stay in C/C2.
      if (Math.random() < 0.30 && _lastSection !== 'D') return (_lastSection = 'D');
      pool = ['C', 'C2'];
    } else if (intensity >= 0.70) {
      pool = ['C', 'C2'];
    } else if (intensity >= 0.40) {
      pool = ['B', 'B2'];
    } else {
      pool = ['A', 'A2'];
    }
    // Prefer the variant that wasn't last played for natural rotation; if neither matches,
    // pick at random (slight bias toward variation).
    const next = pool.includes(_lastSection)
      ? pool.find(s => s !== _lastSection)
      : pool[Math.random() < 0.55 ? 0 : 1];
    _lastSection = next;
    return next;
  }
  // Sweep the music low-pass filter toward an intensity-driven cutoff so the music opens
  // up (bright, present) when the game is tense and closes down (mellow, distant) during
  // calm passages. Small amount of psychoacoustic drama for free.
  function sweepMusicFilter(intensity, when, duration) {
    if (!musicFilter || !ctx) return;
    const target = 1100 + intensity * 5500; // ~1100 Hz calm, ~6600 Hz peak
    try {
      musicFilter.frequency.cancelScheduledValues(when);
      musicFilter.frequency.setValueAtTime(musicFilter.frequency.value, when);
      musicFilter.frequency.linearRampToValueAtTime(target, when + Math.max(0.5, duration * 0.6));
    } catch (_) {}
  }
  // Schedule one section starting at `startTime`. Returns the section's end time.
  function scheduleSection(name, startTime) {
    const sec = SECTIONS[name];
    let t;
    // Melody
    t = startTime;
    sec.melody.forEach(([f, b]) => {
      const dur = b * BEAT;
      if (f) playNote(f, dur, 'square', sec.melodyGain, t);
      t += dur;
    });
    const sectionEnd = t;
    // Harmony — sawtooth (different timbre from the square melody so the two voices
    // are perceptually distinct, not just two squares blending into mush).
    if (sec.harmony) {
      t = startTime;
      sec.harmony.forEach(([f, b]) => {
        const dur = b * BEAT;
        if (f) playNote(f, dur, 'sawtooth', sec.harmonyGain, t);
        t += dur;
      });
    }
    // Bass
    t = startTime;
    sec.bass.forEach(([f, b]) => {
      const dur = b * BEAT;
      if (f) playNote(f, dur, 'triangle', sec.bassGain, t);
      t += dur;
    });
    // Drums — beats are positions in 0..16 (or fractional).
    const dg = sec.drumGain;
    sec.kicks.forEach(beat  => drumKick (startTime + beat * BEAT, 0.65 * dg));
    sec.snares.forEach(beat => drumSnare(startTime + beat * BEAT, 0.50 * dg));
    sec.hats.forEach(beat   => drumHat  (startTime + beat * BEAT, 0.35 * dg));
    return sectionEnd;
  }
  // ---- MP3 track discovery (manifest first, then numeric probing) -------------
  async function fetchManifest() {
    try {
      const r = await fetch(MUSIC_DIR + 'manifest.json', { cache: 'no-cache' });
      if (!r.ok) return [];
      const j = await r.json();
      if (Array.isArray(j)) return j.filter(s => typeof s === 'string');
      if (j && Array.isArray(j.tracks)) return j.tracks.filter(s => typeof s === 'string');
      return [];
    } catch (_) { return []; }
  }
  async function probeNumericTracks() {
    const found = [];
    for (let i = 1; i <= PROBE_LIMIT; i++) {
      let hit = null;
      for (const ext of PROBE_EXTS) {
        const url = MUSIC_DIR + i + ext;
        try {
          const r = await fetch(url, { method: 'HEAD' });
          if (r.ok) { hit = i + ext; break; }
        } catch (_) { /* try next extension */ }
      }
      if (!hit) break;
      found.push(hit);
    }
    return found;
  }
  const tracksReadyPromise = (async () => {
    let names = await fetchManifest();
    if (!names.length) names = await probeNumericTracks();
    mp3Tracks = names
      .filter(n => typeof n === 'string' && n.length > 0)
      .map(n => ({ url: MUSIC_DIR + n, name: n.replace(/\.[^.]+$/, '') }));
    // Resolve default mode now that we know whether tracks exist.
    if (musicMode === null) musicMode = mp3Tracks.length ? 'mp3' : 'synth';
    else if (musicMode === 'mp3' && !mp3Tracks.length) musicMode = 'synth';
    return mp3Tracks.slice();
  })();

  // ---- MP3 playback (routes through musicGain so master/mute Just Work) -------
  function ensureMp3Audio() {
    if (mp3Audio) return mp3Audio;
    if (!ctx) init();
    if (!ctx) return null;
    mp3Audio = new Audio();
    mp3Audio.preload = 'auto';
    mp3Audio.addEventListener('ended', () => {
      if (!mp3Tracks.length) return;
      mp3Index = (mp3Index + 1) % mp3Tracks.length;
      loadAndPlayCurrentMp3();
    });
    mp3Audio.addEventListener('error', () => {
      // Skip broken file, advance after a short pause to avoid tight error loops.
      if (!mp3Tracks.length) return;
      mp3Index = (mp3Index + 1) % mp3Tracks.length;
      setTimeout(loadAndPlayCurrentMp3, 250);
    });
    try {
      mp3Source = ctx.createMediaElementSource(mp3Audio);
      mp3Source.connect(musicGain);
    } catch (_) { /* already wired */ }
    return mp3Audio;
  }
  function loadAndPlayCurrentMp3() {
    if (!mp3Tracks.length || musicMode !== 'mp3' || muted || !musicEnabled) return;
    const a = ensureMp3Audio();
    if (!a) return;
    const t = mp3Tracks[mp3Index % mp3Tracks.length];
    const want = new URL(t.url, location.href).href;
    if (a.src !== want) a.src = t.url;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay blocked, retry on next user gesture */ });
  }
  function startMp3Music() {
    if (!musicEnabled || muted || !mp3Tracks.length) return false;
    if (!ctx) init();
    if (!ctx) return false;
    resume();
    loadAndPlayCurrentMp3();
    return true;
  }
  function stopMp3Music() {
    if (mp3Audio && !mp3Audio.paused) {
      try { mp3Audio.pause(); } catch (_) {}
    }
  }

  // ---- Synth music (the existing scheduler) ----------------------------------
  function startSynthMusic() {
    if (musicSchedTimer) return;
    const loop = () => {
      if (muted || !musicEnabled || musicMode !== 'synth') { musicSchedTimer = null; return; }
      const intensity = computeIntensity();
      const section = pickSection(intensity);
      const start = Math.max(ctx.currentTime + 0.05, musicLoopEnd);
      musicLoopEnd = scheduleSection(section, start);
      const dur = musicLoopEnd - start;
      sweepMusicFilter(intensity, start, dur);
      const lookahead = musicLoopEnd - ctx.currentTime;
      musicSchedTimer = setTimeout(loop, Math.max(500, (lookahead - 0.4) * 1000));
    };
    loop();
  }
  function stopSynthMusic() {
    if (musicSchedTimer) clearTimeout(musicSchedTimer);
    musicSchedTimer = null;
    musicLoopEnd = 0;
  }

  // ---- Public start/stop dispatch by mode ------------------------------------
  function startMusic() {
    if (!musicEnabled || muted) return;
    if (!ctx) init();
    if (!ctx) return;
    resume();
    if (musicMode === null) {
      // Discovery hasn't resolved yet — start once it does.
      tracksReadyPromise.then(() => { if (musicEnabled && !muted) startMusic(); });
      return;
    }
    if (musicMode === 'mp3' && mp3Tracks.length) {
      stopSynthMusic();
      startMp3Music();
    } else {
      stopMp3Music();
      startSynthMusic();
    }
  }
  function stopMusic() {
    stopSynthMusic();
    stopMp3Music();
  }
  function setMusicMode(m) {
    if (m !== 'mp3' && m !== 'synth') return;
    if (m === 'mp3' && !mp3Tracks.length) return;
    if (musicMode === m) return;
    musicMode = m;
    if (typeof localStorage !== 'undefined') localStorage.setItem('shitstein-music-mode', musicMode);
    if (!musicEnabled || muted || !ctx) return;
    // Smooth ~200ms swap: ramp musicGain down, switch source, ramp back up.
    const targetVol = 0.12;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicGain.gain.value, t);
    musicGain.gain.linearRampToValueAtTime(0, t + 0.1);
    setTimeout(() => {
      stopMusic();
      startMusic();
      const t2 = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(t2);
      musicGain.gain.setValueAtTime(0, t2);
      musicGain.gain.linearRampToValueAtTime(targetVol, t2 + 0.1);
    }, 110);
  }
  function setMuted(m) {
    muted = !!m;
    if (typeof localStorage !== 'undefined') localStorage.setItem('shitstein-muted', muted ? '1' : '0');
    if (master && ctx) master.gain.linearRampToValueAtTime(muted ? 0 : 1, ctx.currentTime + 0.1);
    if (muted) stopMusic(); else startMusic();
  }
  function setMusicEnabled(on) {
    musicEnabled = !!on;
    if (typeof localStorage !== 'undefined') localStorage.setItem('shitstein-music', musicEnabled ? '1' : '0');
    if (musicEnabled) startMusic(); else stopMusic();
  }

  // External code can stash an extra intensity factor (0..1) here that's added to the
  // music engine's computeIntensity result. Used by the idle-watcher to lift the music
  // when the player has stalled.
  let extraIntensity = 0;
  function setExtraIntensity(v) { extraIntensity = Math.max(0, Math.min(1, v || 0)); }
  // Splice the boost into computeIntensity by wrapping it once.
  const _origComputeIntensity = computeIntensity;
  computeIntensity = function () {
    return Math.min(1, _origComputeIntensity() + extraIntensity);
  };

  return { init, resume, sfx, whistle, startMusic, stopMusic, setMuted, setMusicEnabled,
           setExtraIntensity, isMuted: () => muted, isMusicEnabled: () => musicEnabled,
           setMusicMode, getMusicMode: () => musicMode,
           getMp3Tracks: () => mp3Tracks.slice(),
           tracksReady: () => tracksReadyPromise };
})();

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
  // K-chain exception (must run BEFORE the strict 10/Ace rules): after a King, an Ace of
  // ANY suit chains (the Ace pivots to whatever suit the player names at click time), and
  // a 10 of any suit chains too (matches the standard K-on-top rule).
  if (prevCard.rank === 'K' && (card.rank === 'A' || card.rank === '10')) return true;
  // 10-card chain rule (highest priority): a 10 in a chain must follow numerical sequence —
  // either same rank or strictly consecutive same-suit (±1). 10 is wild only as a single-card
  // lead, NOT as a chain link. Even after a Q or 9, the 10 needs ±1 same-suit / pair.
  if (card.rank === '10') return chainStep(card, prevCard);
  // Ace chain rule (same logic as 10): an Ace in a chain must follow numerical sequence.
  // Likewise anything FOLLOWING an Ace must be in sequence — so the Ace doesn't chain off
  // a non-adjacent rank, and it doesn't render the next card wild either.
  if (card.rank === 'A')  return chainStep(card, prevCard);
  if (prevCard.rank === 'A') return chainStep(card, prevCard);
  // 2-card chain rule (matches 10/Ace): a 2 is wild as a single-card LEAD, but in a chain
  // it must follow numerical sequence — same rank (pair), strictly consecutive same-suit
  // (±1), or the low-Ace neighbour (A↔2 same suit, handled inside chainStep). The one
  // historical exception: a 2 may chain off a black Jack to keep the pickup-chain stacking
  // mechanic intact (BJ +5 → 2 +2).
  if (card.rank === '2') {
    if (isJackBlack(prevCard)) return true;
    return chainStep(card, prevCard);
  }

  // ---- Top-card locks / extensions (apply before card-specific rules) ----
  // (8-lock removed: an 8 in a hand chain is now followed by another 8 (pair) OR a
  // ±1 same-suit neighbour — i.e. 7 or 9 of the same suit. The 8-card-specific rule
  // below + the default chainStep at the bottom cover both cases. The pending-skip
  // lock in canPlayCard still gates the NEXT player from any non-8 single-card lead
  // when an 8 is on top.)
  // 7-lock: when a 7 sits at the head of the chain link, only ranks ≤ 7 (which still must
  // satisfy chainStep) or a 10 (wild burn) may follow. 8 / 9 / J / Q / K / A are blocked.
  if (prevCard.rank === '7') {
    if (card.rank === '10') return true;
    if (RANK_VAL[card.rank] > 7) return false;
    // fall through to chainStep / card-specific rules for ≤ 7.
  }
  // Q-lock: a Q in a chain accepts another Q (pair), a 2 (chain-cancel), or higher-same-suit
  // (which under chainStep means a same-suit K — A would also be ±1 same-suit but is gated by
  // the top-of-function Ace rule). 10 and Ace are handled at the top — never wild here.
  if (prevCard.rank === 'Q') {
    if (card.rank === 'Q' || card.rank === '2') return true;
    return card.suit === prevCard.suit && RANK_VAL[card.rank] > RANK_VAL[prevCard.rank];
  }
  // K-chain extension: another K or any same-suit card follows a King in a chain. Aces and
  // 10s are handled at the top — they only chain via numerical sequence (same-suit Ace will
  // satisfy the same-suit branch via chainStep, but is gated by the top-of-function rule).
  if (prevCard.rank === 'K') {
    if (card.rank === 'K') return true;
    return card.suit === prevCard.suit;
  }

  // ---- Card-specific rules (when prev is a normal-ish card) ----
  // (2 is handled at the top of the function — strict chainStep with a BJ exception.)
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
  // Aces and 10s as chain links are handled at the top — they never wild-shortcut a chain.

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
  const cv = RANK_VAL[card.rank];
  const pv = RANK_VAL[prevCard.rank];
  if (cv - pv === 1 || cv - pv === -1) return true;
  // Low-Ace neighbour: an Ace (rank-value 14) and a 2 (rank-value 2) chain when same suit,
  // because the Ace can act as the "1" below a 2. The high-Ace neighbour (A↔K) is already
  // covered by the ±1 check above.
  if ((cv === 14 && pv === 2) || (cv === 2 && pv === 14)) return true;
  return false;
}

function canPlayCard(card, state) {
  // ---- House rules: top-of-pile blocks for 8 and Ace ----
  // Checked before anything else so they win over chain/skip allowances below.
  // 8: cannot follow a Jack of any colour. (8 still cancels a 2-chain on 2-top etc.)
  // Ace: cannot follow a 2 (always), cannot follow a Black Jack while the deck
  //      still has cards, but CAN follow a Red Jack (always) and CAN follow a
  //      Black Jack once the deck is empty (the "no-more-pickups" relaxation).
  //      All of Ace's normal wild behaviour on every other top card stays.
  const _top0 = topDiscard(state);
  if (_top0) {
    if (card.rank === '8' && _top0.rank === 'J') return false;
    if (card.rank === 'A') {
      if (_top0.rank === '2') return false;
      if (isJackBlack(_top0) && state.deck.length > 0) return false;
    }
  }

  // Pickup chain: 2 / black-J / red-J-cancel extend or counter the chain. A 10 is universally
  // wild and clears the pack — including the chain.
  // House rule: once the deck is empty, all 2/Jack pickup penalties are bypassed for the
  // rest of the game — the next player just plays normally on the chain card.
  if (state.pickupChain > 0 && state.deck.length > 0) {
    if (card.rank === '10') return true;
    if (card.rank === '2') return true;
    if (card.rank === '8') return true;            // 8 escapes a chain — see playCards for cancel logic
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
  // 2 is a wild lead — plays on any top card, just like the 10. The exceptions are handled
  // above: an active pickup chain has its own whitelist (which already includes 2), and the
  // 8 skip queue blocks everything except another 8.
  if (card.rank === '2') return true;
  // 7-lock: top=7 forces the next player to play 7 or lower. Any card of rank ≤ 7 (any suit)
  // plays — this overrides the normal suit/rank rule. 10 is wild (burns the pile). 8 / 9 / J /
  // Q / K / A are all blocked.
  if (top.rank === '7') {
    if (card.rank === '10') return true;
    if (RANK_VAL[card.rank] > 7) return false;
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

  // Top is an Ace with a named suit: any card of the called suit follows (any rank). This
  // must short-circuit BEFORE the J/8 card-specific rules below, otherwise their "higher in
  // suit" check rejects e.g. J♠ on A-called-Spades since J=11 < A=14.
  if (top.rank === 'A' && state.aceSuit && card.suit === state.aceSuit) return true;

  // (2 is handled above — it's a wild lead.)
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
  // play on a freshly-placed 8 or Jack — the previous player must have had a turn between the
  // 8/J landing and now (i.e., they took the chain, were skipped, etc.). For a freshly-placed
  // 2 the rule is relaxed: a SAME-SUIT K is allowed (the suit-match still rules out cross-suit
  // Kings, so the same-suit return at the bottom carries that case).
  if (card.rank === 'K') {
    if (top.rank === 'K') return true;
    const fresh = state.turnCount === (state.topPlayedAtTurn + 1);
    if (fresh && (top.rank === '8' || top.rank === 'J')) return false;
    return card.suit === matchSuit;
  }
  // Jack rule: J plays only on another Jack, or higher rank in the same suit (any gap).
  if (card.rank === 'J') {
    if (top.rank === 'J') return true;
    return higherOrEqual(card, matchTop);
  }
  // Q-lock (top is Q) — applies to remaining cards (10, A, 3-7, 9).
  if (top.rank === 'Q') {
    if (card.rank === '10' || card.rank === 'A') return true;
    return card.suit === top.suit && RANK_VAL[card.rank] > RANK_VAL[top.rank];
  }

  // 10 and Ace remain wild — except when they fall foul of the chain (handled at the top)
  // or the 7-lock / 8-lock / Q-lock (handled above).
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

// Build a brief, situation-aware hint for the human player. Reads the top card and any active
// chain/skip state so the user knows what their legal actions actually are this turn.
function buildActionHint(state, myPlayerId, myActive) {
  if (state.phase === 'swap')   return 'Click a hand card and a face-up card to swap them.';
  if (state.phase === 'over')   return '';
  if (state.current !== myPlayerId) return 'Watching…';

  if (state.pickupChain > 0) {
    return `📤 Pickup chain at +${state.pickupChain}. Counter with a 2 (+2), black J (+5), red J (cancels), or 10 (burns). Or click Take from Deck.`;
  }
  if (state.pendingSkips > 0) {
    return `💤 ${state.pendingSkips} skip${state.pendingSkips === 1 ? '' : 's'} queued. Play another 8 to escape (and stack), or click Skip Turn.`;
  }
  if (myActive === 'faceDown') return '🙈 Hand, face-up and deck all empty — flip a face-down card, blind. Brace yourself.';
  if (myActive === 'faceUp')   return 'Hand and deck empty — play from your face-up cards.';

  const top = topDiscard(state);
  if (!top) return 'Pile empty — anything goes.';
  const sym = SUIT_SYM[top.suit];
  // 2 / 10 are wild leads, an Ace is wild (with naming) — these always apply unless a chain/
  // skip is up, both of which we've already returned for above.
  const wildOptions = 'Or play a 2, a 10 (burns), or an Ace (you name the suit).';

  if (top.rank === 'A' && state.aceSuit) {
    return `🎩 Top is A${sym}, suit called ${SUIT_SYM[state.aceSuit]}. Follow ${SUIT_SYM[state.aceSuit]} (any rank), or pair with another A. ${wildOptions}`;
  }
  if (top.rank === 'K') {
    return `👑 Top is K${sym}. Follow with another K, an A, or any ${sym}. ${wildOptions}`;
  }
  if (top.rank === 'Q') {
    return `Top is Q${sym}. Follow with another Q, K${sym} or A${sym} (higher in suit). ${wildOptions}`;
  }
  if (top.rank === 'J') {
    return `Top is J${sym}. Follow with another J, or higher in ${sym} (Q/K/A). ${wildOptions}`;
  }
  if (top.rank === '8') {
    return `Top is 8${sym}. Follow with another 8 or higher in ${sym}. ${wildOptions}`;
  }
  if (top.rank === '7') {
    return `🔒 Top is 7${sym}. Play any 2-7 (any suit) or a 10 to burn. 8 / 9 / J / Q / K / A are blocked.`;
  }
  // Plain number cards (3, 4, 5, 6, 9, 10).
  return `Top is ${top.rank}${sym}. Match the rank, or play higher in ${sym}. ${wildOptions}`;
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

function playCards(state, source, indices, aceSuit, calledSuits) {
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
  // This unifies same-rank stacks, K-chains, runs, and any creative mixed plays. When the
  // previous card is an Ace whose called suit was named at click time, treat the Ace as if
  // it were of the called suit so the cross-suit pivot (A♥ called ♠ → K♠ or 2♠) validates.
  if (cards.length > 1) {
    for (let i = 1; i < cards.length; i++) {
      let prev = cards[i - 1];
      if (prev.rank === 'A' && calledSuits && calledSuits[i - 1]) {
        prev = { rank: 'A', suit: calledSuits[i - 1] };
      }
      if (!canPlayOnCard(cards[i], prev)) {
        return { ok: false, error: `chain broken: ${cards[i].rank}${SUIT_SYM[cards[i].suit]} can't play on ${cards[i-1].rank}${SUIT_SYM[cards[i-1].suit]}` };
      }
    }
  }
  // While a pickup chain is active, the WHOLE play must be chain-relevant — 2s, 8s, Jacks
  // (any colour), or a 10. 8 cancels the chain (existing chain-ended rule below clears
  // pickupChain when the play ends on a non-2/J), and 10 burns the pile chain-and-all.
  if (state.pickupChain > 0) {
    for (const c of cards) {
      if (c.rank === '2' || c.rank === '8' || c.rank === '10' || isJackBlack(c) || isJackRed(c)) continue;
      return { ok: false, error: 'during a pickup chain, only 2s, 8s, Jacks, or a 10 may be played' };
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
      if (c.rank === '10') tenBurn = true;
      else                 fourOfKindBurn = true;
      // Any burn (10 or four-of-a-kind) clears the pack AND wipes any chain/skip state. This
      // matters most for a four-Jack burn — the cancel/add bookkeeping on pickupChain may have
      // left a residue from cards that are now in the burn pile, so reset to a clean slate.
      // The Ace's called-suit constraint also resets — the Ace card is in the burn pile.
      state.pickupChain = 0;
      state.pendingBlackJacks = 0;
      state.pendingSkips = 0;
      state.lastEightPlayer = null;
      state.aceSuit = null;
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

  // Pickup chain effects. House rule: once the deck is empty there's nothing to draw, so
  // 2 / black-Jack penalties are silently dropped instead of accumulating a chain that
  // can't be enforced. Red Jacks still cancel any leftover pending black Jacks (cosmetic
  // bookkeeping — the chain itself is moot once the deck is gone).
  let chainAdd = 0, chainCancel = 0;
  const deckEmpty = state.deck.length === 0;
  if (surv2 > 0 && !deckEmpty) {
    state.pickupChain += 2 * surv2;
    chainAdd += 2 * surv2;
  }
  if (survBJ > 0 && !deckEmpty) {
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

  // Ace suit override — the called-suit constraint only applies when an Ace is the LAST
  // surviving card on the discard top. A buried Ace mid-chain (e.g. K♠ + A♠ + Q♠) doesn't
  // leave a called-suit constraint behind, since the next player plays on Q♠ not the Ace.
  // The Ace's effect resets the moment another card is placed on top of it.
  if (survivors.length > 0) {
    const lastSurv = survivors[survivors.length - 1];
    state.aceSuit = (lastSurv.rank === 'A') ? aceSuit : null;
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
  // Snapshot the played cards so the renderer can fan them out on the discard for visual
  // clarity (especially useful for multi-card chains). Burned chains snapshot the burned
  // cards so the player can still see what burned. Single-card plays just hold one card.
  // Snapshot only the cards still on the discard (i.e. NOT burned). A 10 burns its play
  // partners, so a chain like 9♠+10♠ ends with an empty pile and lastPlayCards = [] —
  // no fan, no leftover 10 visible. A chain like 9♠+10♠+J♠ ends on J♠ alone (the 10 and
  // 9 are gone with the burn), so lastPlayCards = [J♠] — single card, no fan.
  state.lastPlayCards = survivors.map(c => ({ rank: c.rank, suit: c.suit }));

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
      if (card.rank === '10') tenBurn = true;
      else                    fourOfKindBurn = true;
      // Any burn clears the pack AND chain/skip/aceSuit state (see playCards for rationale).
      state.pickupChain = 0;
      state.pendingBlackJacks = 0;
      state.pendingSkips = 0;
      state.lastEightPlayer = null;
      state.aceSuit = null;
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
    state.lastPlayCards = [{ rank: card.rank, suit: card.suit }];

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
  state.lastPlayCards = null;
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
  state.lastPlayCards = null;
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
  state.lastPlayCards = null;
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
    // Legal K-chain partners: any same-suit card (K-extension), a 10 of any suit (K-rule),
    // or a same-suit Ace via the high-Ace neighbour (±1). Off-suit Aces don't chain on K.
    const cands = pool
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => i !== kIdx && c.rank !== 'K' && (
        c.rank === '10' || c.suit === kSuit
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
    // 3. A 10 of any suit — productive: K + 10 burns the pile and the bot plays again.
    const any10     = cands.find(({ c }) => c.rank === '10');
    // 4. Same-suit Ace — last resort; saves the wild for a freer moment.
    const sameSuitA = cands.find(({ c }) => c.suit === kSuit && c.rank === 'A');
    const fallback  = cands[0];

    return (sameSuitLow || sameSuit2 || sameSuitQ || sameSuit8 || any10 || sameSuitA || fallback).i;
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
let handSortMode = 'rank';        // 'rank' | 'pairs' | 'suit' | 'chains'

const SUIT_ORDER = { S: 0, H: 1, D: 2, C: 3 };

// Sort the hand for display. Returns an array of { card, idx } where idx is the original
// position in me.hand (so click handlers still target the engine's index, not the visual
// slot). Mode controls grouping:
//   'rank'   — pure ascending rank, then suit
//   'pairs'  — same-rank groups clustered, biggest groups first
//   'suit'   — group by suit, ascending rank within each suit
//   'chains' — group cards that can chain together (same rank OR same-suit ±1)
function sortHandForDisplay(handWithIdx, mode) {
  const items = handWithIdx.slice();
  if (mode === 'rank' || !mode) {
    return items.sort((a, b) =>
      RANK_VAL[a.card.rank] - RANK_VAL[b.card.rank] ||
      SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
    );
  }
  if (mode === 'pairs') {
    const groups = new Map();
    items.forEach(it => {
      const k = it.card.rank;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    });
    const arr = [...groups.values()];
    arr.forEach(g => g.sort((a, b) => SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]));
    arr.sort((a, b) => b.length - a.length || RANK_VAL[a[0].card.rank] - RANK_VAL[b[0].card.rank]);
    return arr.flat();
  }
  if (mode === 'suit') {
    return items.sort((a, b) =>
      SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit] ||
      RANK_VAL[a.card.rank] - RANK_VAL[b.card.rank]
    );
  }
  if (mode === 'chains') {
    // Union-find: any two cards with same rank, or same suit ±1, are in the same chain.
    const n = items.length;
    const parent = items.map((_, i) => i);
    const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const union = (i, j) => { const pi = find(i), pj = find(j); if (pi !== pj) parent[pi] = pj; };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = items[i].card, b = items[j].card;
        const sameRank = a.rank === b.rank;
        const sameSuitAdj = a.suit === b.suit && Math.abs(RANK_VAL[a.rank] - RANK_VAL[b.rank]) === 1;
        // Low-Ace neighbour: A↔2 same suit
        const aceLow = a.suit === b.suit && (
          (a.rank === 'A' && b.rank === '2') || (a.rank === '2' && b.rank === 'A')
        );
        if (sameRank || sameSuitAdj || aceLow) union(i, j);
      }
    }
    const groups = new Map();
    items.forEach((it, i) => {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(it);
    });
    const arr = [...groups.values()];
    arr.forEach(g => g.sort((a, b) =>
      RANK_VAL[a.card.rank] - RANK_VAL[b.card.rank] ||
      SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
    ));
    arr.sort((a, b) => b.length - a.length || RANK_VAL[a[0].card.rank] - RANK_VAL[b[0].card.rank]);
    return arr.flat();
  }
  return items;
}

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

// SVG strings are deterministic per card and never mutated, so we memoize them.
// 52 cards + 1 back means a 53-entry cache after the first full render.
const _cardSVGCache = new Map();
let _cardBackSVGCache = null;

function renderCardSVG(card) {
  const key = card.rank + card.suit;
  const hit = _cardSVGCache.get(key);
  if (hit) return hit;
  const isRed = (card.suit === 'H' || card.suit === 'D');
  const colorClass = isRed ? 'red' : 'black';
  const center = (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' || card.rank === 'A')
    ? faceCardSVG(card.rank, card.suit)
    : pipsSVG(card.rank, card.suit);
  const corners = `
    <g>${cornerSVG(card.rank, card.suit)}</g>
    <g transform="rotate(180 50 70)">${cornerSVG(card.rank, card.suit)}</g>
  `;
  const svg = `<svg class="card-svg ${colorClass}" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
    <rect x="1" y="1" width="98" height="138" rx="9" ry="9" class="card-bg"/>
    ${corners}
    ${center}
  </svg>`;
  _cardSVGCache.set(key, svg);
  return svg;
}

function renderCardBackSVG() {
  if (_cardBackSVGCache) return _cardBackSVGCache;
  _cardBackSVGCache = `<svg class="card-svg card-back-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
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
  return _cardBackSVGCache;
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
// Track which play we've already animated so the entrance class is only added on the
// render for a NEW play — re-renders during the same play (e.g. hand sort, idle ticks)
// don't retrigger card-land. Reset to null on any state change that wipes lastPlayCards.
let _lastFreshPlayKey = null;
function _currentPlayKey() {
  if (!state || !state.lastPlayCards || !state.lastPlayCards.length) return null;
  return state.lastPlayCards.map(c => c.rank + c.suit).join(',') + ':' + state.discard.length;
}
function _fxClassForLastCard() {
  if (!state || !state.lastPlayCards || !state.lastPlayCards.length) return null;
  const last = state.lastPlayCards[state.lastPlayCards.length - 1];
  if (!last) return null;
  if (last.rank === '2')  return 'fx-2';
  if (last.rank === '7')  return 'fx-7';
  if (last.rank === '8')  return 'fx-8';
  if (last.rank === 'Q')  return 'fx-Q';
  if (last.rank === 'K')  return 'fx-K';
  if (last.rank === 'A')  return 'fx-A';
  if (last.rank === 'J')  return (last.suit === 'S' || last.suit === 'C') ? 'fx-Jblack' : 'fx-Jred';
  return null;
}

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
  // When the deck runs dry we hide the deck slot and shift the play area to the left
  // (CSS handles the slide animation via .middle.deck-empty). The discard fan's max
  // extension also widens — see the discard render below.
  const deckEl = $('deck');
  const middleEl = deckEl.parentElement;
  if (middleEl) middleEl.classList.toggle('deck-empty', state.deck.length === 0);
  deckEl.innerHTML = '';
  if (state.deck.length > 0) {
    deckEl.appendChild(renderCard(null, { back: true }));
    const lbl = document.createElement('div');
    lbl.className = 'pile-count';
    lbl.textContent = `${state.deck.length} left`;
    deckEl.appendChild(lbl);
  }
  // (When deck.length === 0 we leave the slot empty — the CSS .deck-empty rule
  // collapses and slides it out of view, so no "deck" placeholder is rendered.)

  // ---- Discard ----
  // Gate the rebuild on a play-key so re-renders for the SAME play (clicks, sort changes,
  // idle ticks) leave the existing card in the DOM untouched — its entrance animation runs
  // to completion instead of being yanked back to keyframe-0 by a fresh innerHTML wipe.
  // The key only changes when a genuinely new play hits the discard, the pile burns, or
  // someone picks up. The data-attribute lives on discardEl itself so it's never wiped.
  const discardEl = $('discard');
  const discardKey = (_currentPlayKey() || ('empty:' + state.discard.length));
  if (discardEl.dataset.discardKey !== discardKey) {
  discardEl.dataset.discardKey = discardKey;
  discardEl.innerHTML = '';
  const top = topDiscard(state);
  if (top) {
    // If the most recent move was a multi-card chain, fan the cards out (50% horizontal
    // overlap, newest on the right at the slot's nominal position) so the player can read
    // each rank/suit. Single-card plays render the same as before.
    const chain = (state.lastPlayCards && state.lastPlayCards.length > 1) ? state.lastPlayCards : null;
    if (chain) {
      discardEl.classList.add('has-fan');
      const fan = document.createElement('div');
      fan.className = 'discard-fan';
      // Dynamic overlap: short chains spread out (20% overlap, each card shows 80%),
      // long chains compress (up to 85% overlap, each card shows 15%). The fan also
      // gets a measured maximum extension so it doesn't reach over the direction-of-
      // play arrow or the deck — beyond that we fall back to the 85% overlap cap.
      const N = chain.length;
      const minOverlap = 0.20, maxOverlap = 0.85;
      // Linear lerp: 0 at N=2, 1 at N=6+. Past N=6 we stay at the 85% cap.
      const t = Math.max(0, Math.min((N - 2) / 4, 1));
      let overlap = minOverlap + (maxOverlap - minOverlap) * t;
      // Also cap by available leftward space inside the play panel (the gap between
      // the discard slot's left edge and the direction-arrow's right edge). Once the
      // deck is gone its slot is hidden, freeing ~160 px more, so the fan can spread.
      const maxExtensionPx = (state.deck.length === 0) ? 240 : 80;
      const cardWPx = (function () {
        const m = getComputedStyle(discardEl).getPropertyValue('--card-w').trim();
        const v = parseFloat(m);
        return Number.isFinite(v) && v > 0 ? v : 160;
      })();
      const requiredOverlap = N > 1 ? 1 - (maxExtensionPx / ((N - 1) * cardWPx)) : 0;
      if (requiredOverlap > overlap) overlap = Math.min(maxOverlap, requiredOverlap);
      const offsetFraction = -(1 - overlap); // negative = shifts left
      chain.forEach((c, i) => {
        const card = renderCard(c, { help: false });
        card.classList.add('fan-card');
        const offsetSteps = (chain.length - 1 - i);
        card.style.left = `calc(var(--card-w) * ${offsetFraction} * ${offsetSteps})`;
        card.style.zIndex = String(i + 1);
        card.style.animationDelay = `${i * 70}ms`;
        fan.appendChild(card);
      });
      discardEl.appendChild(fan);
    } else {
      discardEl.classList.remove('has-fan');
      const topCardEl = renderCard(top);
      // For a brand-new single-card play, attach .fresh (+ any fx-* class) at DOM-creation
      // time so the entrance animation property is on the element from its first paint.
      // Applying these classes AFTER insertion (the old postMoveProcessing path) caused a
      // brief paint at "landed" state followed by the animation jumping to keyframe-0 and
      // playing — i.e. the card appearing twice within milliseconds.
      const playKey = _currentPlayKey();
      if (playKey && playKey !== _lastFreshPlayKey) {
        topCardEl.classList.add('fresh');
        const fxCls = _fxClassForLastCard();
        if (fxCls) topCardEl.classList.add(fxCls);
      }
      discardEl.appendChild(topCardEl);
    }
    const cnt = document.createElement('div');
    cnt.className = 'pile-count';
    cnt.textContent = `${state.discard.length} card${state.discard.length === 1 ? '' : 's'}`;
    discardEl.appendChild(cnt);
  } else {
    discardEl.classList.remove('has-fan');
    const e = document.createElement('div');
    e.className = 'empty-slot';
    e.textContent = 'discard';
    discardEl.appendChild(e);
  }
  } // end if (discardKey changed)
  _lastFreshPlayKey = _currentPlayKey();

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
  const myActive = getActiveSource(me, state);
  // The full per-play guidance lives in the play-hint banner above the action bar (its own
  // dedicated row, so reaction bubbles can never land on top of the text). The me-hint span
  // stays in the header for short status text only.
  const playHint = $('play-hint');
  if (playHint) playHint.textContent = buildActionHint(state, myPlayerId, myActive);
  const meHint = $('me-hint');
  if (state.phase === 'swap')                       meHint.textContent = 'Click a hand card and a face-up card to swap them.';
  else if (state.phase === 'over')                  meHint.textContent = '';
  else if (state.current !== myPlayerId)            meHint.textContent = 'Watching…';
  else                                              meHint.textContent = '';
  // Reserve panel: the label/hint shows ONLY when the reserve is the active play source —
  // i.e. the player's hand & deck are both empty and they're about to play face-up or
  // face-down. The cards themselves stay visible at all times, just unlabelled.
  // The 'faceup-active' class additionally tells the CSS to drop the face-up overlay so
  // face-up cards expand to full size beneath the face-down row when they're about to be
  // played.
  const reserveEl = document.querySelector('.reserve');
  if (reserveEl) {
    reserveEl.classList.toggle('reserve-active', myActive === 'faceUp' || myActive === 'faceDown');
    reserveEl.classList.toggle('faceup-active', myActive === 'faceUp');
  }

  // ---- Reserve pairs (face-down + face-up overlapping HORIZONTALLY per slot) ----
  // Each "slot" is a face-down card with a face-up card sitting on top of it, offset
  // horizontally so the back of the face-down card peeks out at the LEFT. The whole
  // reserve renders as N pairs in a horizontal row.
  const pairsEl = $('me-reserve-pairs');
  if (pairsEl) {
    pairsEl.innerHTML = '';
    const N = me.faceDown.length;
    for (let i = 0; i < N; i++) {
      const pair = document.createElement('div');
      pair.className = 'reserve-pair';
      // Face-down (back) — sits at the bottom z-index of the pair.
      const back = renderCard(null, { back: true, size: 'small' });
      back.classList.add('reserve-back');
      if (state.phase === 'play' && state.current === myPlayerId && myActive === 'faceDown') {
        back.classList.add('clickable');
        back.title = 'Flip blindly';
        back.addEventListener('click', () => onBlindFlipClicked(i));
      }
      pair.appendChild(back);
      // Face-up — sits on top of the back, offset to the right so the back's left edge
      // peeks out by 15%. Same size as the back when stowed; expands to full size when
      // the reserve is the active source so the player can read it.
      if (i < me.faceUp.length) {
        const fuSize = (myActive === 'faceUp') ? null : 'small';
        const up = renderCard(me.faceUp[i], fuSize ? { size: fuSize } : {});
        up.classList.add('reserve-up');
        if (state.phase === 'swap') {
          up.classList.add('clickable');
          if (swapSelected.faceUp === i) up.classList.add('selected');
          up.addEventListener('click', () => onSwapFaceUpClick(i));
        } else if (state.phase === 'play' && state.current === myPlayerId && myActive === 'faceUp') {
          if (isSelected('faceUp', i)) up.classList.add('selected');
          if (canSelect('faceUp', me.faceUp[i])) {
            up.classList.add('clickable');
            up.addEventListener('click', () => onCardClick('faceUp', i));
          } else {
            up.classList.add('disabled');
          }
        }
        pair.appendChild(up);
      }
      pairsEl.appendChild(pair);
    }
  }

  // ---- Hand row ----
  const handEl = $('me-hand');
  // FLIP animation: snapshot positions of existing cards by their stable key (rank+suit+
  // original-index) so we can animate cards sliding to new positions when sort/order
  // changes. New cards (e.g. dealt from the deck) appear without an old position and
  // therefore animate in via the card-land mechanism only if they land on the discard.
  const oldRects = new Map();
  Array.from(handEl.children).forEach(el => {
    const key = el.dataset.cardKey;
    if (key) oldRects.set(key, el.getBoundingClientRect());
  });
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
  // Sort the hand for display only — the actual indices into me.hand stay stable so click
  // handlers refer to the engine's index, not the visual position.
  const handWithIdx = me.hand.map((c, i) => ({ card: c, idx: i }));
  const sortedHand = sortHandForDisplay(handWithIdx, handSortMode);
  sortedHand.forEach(({ card: c, idx: i }) => {
    const card = renderCard(c);
    card.dataset.cardKey = `${c.rank}${c.suit}-${i}`;
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
  // FLIP — invert + play.
  Array.from(handEl.children).forEach(el => {
    const key = el.dataset.cardKey;
    if (!key) return;
    const oldRect = oldRects.get(key);
    if (!oldRect) return;
    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (dx === 0 && dy === 0) return;
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = 'none';
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.34s cubic-bezier(0.34, 1.2, 0.64, 1), filter 0.13s ease';
      el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, 360);
    });
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
  const lastSel  = selected[selected.length - 1];
  const lastCard = me[lastSel.source][lastSel.idx];

  // House rule: when the previous selection is an Ace whose called suit was named at click
  // time, the Ace behaves as if it were of the called suit AND its value can be high (14) or
  // low (1). The next chain card is therefore either another Ace (pair), or a card of the
  // called suit with rank 13 (K — high Ace neighbour) or 2 (low Ace neighbour).
  if (lastCard.rank === 'A' && lastSel.calledSuit) {
    if (card.rank === 'A') return true;
    if (card.suit !== lastSel.calledSuit) return false;
    const v = RANK_VAL[card.rank];
    return v === 13 || v === 2;
  }
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

// Track which log entries are already in the DOM so we only animate truly new ones.
// Wiping and re-rendering on every renderTable() was causing every entry to re-animate
// (the user reported this as "flashing" log entries).
let _lastRenderedLogTs = 0;

function renderActionLog() {
  const el = $('action-log');
  if (!el) return;
  // Append only entries that arrived since the last render.
  const fresh = actionLog.filter(e => e.ts > _lastRenderedLogTs);
  fresh.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.dataset.ts = String(entry.ts);
    div.innerHTML = `<span class="who">${escapeHtml(entry.name)}:</span> <span class="what">${entry.html}</span>`;
    // Newest visually on top.
    el.insertBefore(div, el.firstChild);
  });
  if (fresh.length) _lastRenderedLogTs = fresh[fresh.length - 1].ts;
  // Cap to the last 8 entries — drop oldest off the bottom.
  while (el.children.length > 8) el.removeChild(el.lastChild);
  // Fade out the older half so the eye is drawn to recent moves.
  Array.from(el.children).forEach((child, i) => {
    child.classList.toggle('fading', i > 4);
  });
}
function resetActionLog() {
  actionLog = [];
  _lastRenderedLogTs = 0;
  const el = $('action-log');
  if (el) el.innerHTML = '';
}

function appendActionLog(entry) {
  actionLog.push(entry);
  if (actionLog.length > 60) actionLog = actionLog.slice(-60);
}

// Online clients don't run applyMove (the host does), so they never reach the host-side
// log-append in applyMove. Mirror the same logic here off of the synced state.lastEvent.
let _lastClientLogEvent = null;
function syncActionLogFromState() {
  if (!state || !state.lastEvent || state.lastEventPlayer == null) return;
  if (state.lastEvent === _lastClientLogEvent) return;
  _lastClientLogEvent = state.lastEvent;
  const actor = state.players[state.lastEventPlayer];
  if (!actor) return;
  const tags = state.lastEventTags || [];
  const isBurn = tags.includes('burn') || tags.includes('fourOfKind');
  const what = state.lastEvent.replace(new RegExp('^' + actor.name + '\\s+'), '');
  appendActionLog({ player: actor.id, name: actor.name, html: escapeHtml(what), ts: Date.now(), burn: isBurn });
}

function onCardClick(source, idx) {
  Idle.bump();
  if (isSelected(source, idx)) {
    // Unified chain mode (hand AND face-up): clicking a selected card drops it
    // and every link that came after it, preserving the chain invariant.
    const pos = selected.findIndex(s => s.source === source && s.idx === idx);
    selected = selected.slice(0, pos);
    Sound.sfx('deselect');
    renderTable();
    return;
  }
  const me = state.players[myPlayerId];
  const card = me[source][idx];
  if (!canSelect(source, card)) return;
  Sound.sfx('select');

  // Aces: name the called suit at click time so subsequent chain choices are validated against
  // the called suit (high or low). The same prompt covers an Ace at any chain position.
  if (card.rank === 'A') {
    askAceSuit((suit) => {
      selected.push({ source, idx, calledSuit: suit });
      renderTable();
    });
    return;
  }
  selected.push({ source, idx });
  renderTable();
}
function onPlayClick() {
  if (state.phase === 'swap') { onReadyClick(); return; }
  if (state.phase === 'play' && state.current === myPlayerId && selected.length) {
    const me = state.players[myPlayerId];
    const source  = selected[0].source;
    const indices = selected.map(s => s.idx);
    const cards   = indices.map(i => me[source][i]);
    const anyAce  = cards.some(c => c.rank === 'A');
    // Per-position called suits for chain validation. The last Ace's called suit also drives
    // state.aceSuit (the next player's suit constraint).
    const calledSuits = {};
    let aceSuit = null;
    selected.forEach((s, i) => {
      if (cards[i].rank === 'A' && s.calledSuit) calledSuits[i] = s.calledSuit;
    });
    for (let i = selected.length - 1; i >= 0; i--) {
      if (cards[i].rank === 'A') { aceSuit = selected[i].calledSuit || 'S'; break; }
    }
    selected = [];
    sendOrApplyMove(anyAce
      ? { type: 'play', source, indices, aceSuit: aceSuit || 'S', calledSuits }
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
    if      (move.type === 'play')      result = playCards(state, move.source, move.indices, move.aceSuit, move.calledSuits);
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

// ===== Idle watcher =====
// When it becomes the human player's turn, start a 5-second timer. If they don't make
// a move in that window, play a soft attention whistle and bump the music intensity by
// 0.30 so the score lifts. Another 10 seconds later fire a louder two-note whistle and
// raise the boost to 0.60. Cancel/reset on any meaningful click or when the turn passes.
const Idle = (() => {
  let timers = [];
  function clear() {
    timers.forEach(t => clearTimeout(t));
    timers = [];
    Sound.setExtraIntensity(0);
  }
  function start() {
    clear();
    timers.push(setTimeout(() => {
      Sound.whistle(0);          // soft 1-note "psst"
      Sound.setExtraIntensity(0.30);
      timers.push(setTimeout(() => {
        Sound.whistle(1);        // urgent 2-note "hey-hey!"
        Sound.setExtraIntensity(0.60);
      }, 10000));
    }, 5000));
  }
  // Restart the idle timer if it's currently running (used after a card click etc. so
  // engaged users don't get whistled at while still considering their move).
  function bump() {
    if (timers.length === 0) return;
    if (state && state.phase === 'play' && state.current === myPlayerId && !pendingBotTurn) {
      start();
    } else {
      clear();
    }
  }
  function syncWithState() {
    const myTurn = state && state.phase === 'play' && state.current === myPlayerId && !pendingBotTurn;
    if (myTurn) start();
    else clear();
  }
  return { start, clear, bump, syncWithState };
})();

function postMoveProcessing() {
  renderTable();
  // Visual: flash a burn over the discard if the last move triggered one.
  const tags = (state && state.lastEventTags) || [];
  if (tags.includes('burn') || tags.includes('fourOfKind')) {
    flashBurnOnDiscard();
    Sound.sfx('burn');
  }
  // Audio cues for discrete game events. Special-card sfx fires from playSpecialCardFX
  // below; here we cover the non-special outcomes.
  if (tags.includes('pickUp'))     Sound.sfx('pickup');
  if (tags.includes('skip'))       Sound.sfx('skip');
  if (tags.includes('chainTaken')) Sound.sfx('take');
  if (tags.includes('reverse'))    Sound.sfx('reverse');
  // The card-entrance classes (.fresh and any .fx-* for specials) are now applied INSIDE
  // renderTable at DOM-creation time on the rendered top card — that's what eliminates the
  // double-pop where the card painted briefly at "landed" state before the animation could
  // jump it back to keyframe-0. Here we just need the audio + floating stamp side effects.
  const allDiscardCards = document.querySelectorAll('#discard .card');
  const topCard = allDiscardCards[allDiscardCards.length - 1];
  if (topCard) {
    // Skip the card-class re-add (renderTable already did it) — playSpecialCardFX still
    // emits the +2/king/etc floating stamp and the special-card sfx.
    playSpecialCardFX(topCard, { skipCardClass: true });
  }
  maybeShowReactions();
  Idle.syncWithState();

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
  // Only bots auto-react. Real players (vs-bots: the local human; pass-and-play and
  // online: every human at the table) decide for themselves when to drop an emoji
  // via the picker — putting words in their mouth would feel awful.
  const others = state.players.filter(p => p.id !== movePlayerId && !p.finished && !p.isHuman);
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

// Apply a unique animation to the just-played top card based on its rank/suit. Each special
// card gets its own FX: a floating stamp + a card-level pulse / spin / shimmer + 8-bit sfx.
// opts.skipCardClass: when true (chain plays), skip the card-class animation that would
// otherwise replace the fan-card-land entrance and cause a double-landing. The floating
// stamp still shows.
function playSpecialCardFX(topCardEl, opts = {}) {
  if (!state || !state.lastPlayCards || !state.lastPlayCards.length) return;
  const last = state.lastPlayCards[state.lastPlayCards.length - 1];
  if (!last) return;
  let cls = null, stamp = null;
  if (last.rank === '2')      { cls = 'fx-2';   stamp = '+2'; }
  else if (last.rank === '7') { cls = 'fx-7';   stamp = '≤ 7'; }
  else if (last.rank === '8') { cls = 'fx-8';   stamp = '⏭ skip'; }
  else if (last.rank === 'Q') { cls = 'fx-Q';   stamp = '↻'; }
  else if (last.rank === 'K') { cls = 'fx-K';   stamp = '👑'; }
  else if (last.rank === 'A') { cls = 'fx-A';   stamp = '★'; }
  else if (last.rank === 'J') {
    if (last.suit === 'S' || last.suit === 'C') { cls = 'fx-Jblack'; stamp = '+5'; }
    else                                          { cls = 'fx-Jred';   stamp = '✖'; }
  }
  if (cls) Sound.sfx(cls.replace('fx-', 'special-'));
  else     Sound.sfx(state.lastPlayCards.length > 1 ? 'chain' : 'play');
  if (!cls) return;
  if (!opts.skipCardClass) {
    topCardEl.classList.add(cls);
    setTimeout(() => topCardEl.classList.remove(cls), 1100);
  }
  // Floating stamp over the discard
  const discardEl = document.getElementById('discard');
  if (discardEl && stamp) {
    const fx = document.createElement('div');
    fx.className = `card-fx ${cls}-stamp`;
    fx.textContent = stamp;
    discardEl.appendChild(fx);
    setTimeout(() => { if (fx.parentNode) fx.remove(); }, 1100);
  }
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
  Sound.sfx('gameover');
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
  // Clear any DOM ephemera left over from the previous game so a new game starts clean:
  // floating reaction bubbles, thinking dots, burn flashes, modals/passover screens, and
  // the right-rail action log feed.
  document.querySelectorAll('.passover, .modal-overlay, .reaction, .thinking, .burn-flash, .disconnect-banner').forEach(el => el.remove());
  resetActionLog();
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
    <p class="muted">Add bots up to a maximum of 5 players total.</p>
    <div id="cfg-bot-list"></div>
    <div class="row" style="margin-top:8px;">
      <button class="ghost" id="cfg-add-bot">+ Add bot</button>
      <button class="primary" id="cfg-start">Deal!</button>
    </div>
  `;
  const botList = $('cfg-bot-list');
  const bots = [{ name: BOT_NAMES[0] || 'Bot 1' }, { name: BOT_NAMES[1] || 'Bot 2' }];

  function renderBots() {
    botList.innerHTML = '';
    bots.forEach((b, i) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `
        <input type="text" value="${escapeHtml(b.name)}" data-idx="${i}" maxlength="16">
        <span class="muted">🤖 Bot</span>
        ${bots.length > 1 ? `<button class="ghost" data-rm="${i}">remove</button>` : ''}
      `;
      botList.appendChild(row);
    });
    botList.querySelectorAll('input[type=text]').forEach(inp => {
      inp.addEventListener('input', () => { bots[+inp.dataset.idx].name = inp.value; });
    });
    botList.querySelectorAll('button[data-rm]').forEach(btn => {
      btn.addEventListener('click', () => { bots.splice(+btn.dataset.rm, 1); renderBots(); updateAddButton(); });
    });
  }
  function updateAddButton() {
    const btn = $('cfg-add-bot');
    if (!btn) return;
    btn.disabled = bots.length >= 4; // +1 human = 5 total cap
    btn.style.opacity = btn.disabled ? '0.5' : '';
  }
  renderBots();
  updateAddButton();

  $('cfg-add-bot').addEventListener('click', () => {
    if (bots.length >= 4) return;
    bots.push({ name: BOT_NAMES[bots.length] || `Bot ${bots.length + 1}` });
    renderBots();
    updateAddButton();
  });
  $('cfg-start').addEventListener('click', () => {
    const myName = ($('cfg-name').value.trim() || 'You').slice(0, 16);
    if (bots.length < 1) return alert('Need at least one bot opponent.');
    const names  = [myName, ...bots.map((b, i) => (b.name.trim() || BOT_NAMES[i] || `Bot ${i + 1}`).slice(0, 16))];
    const humans = [true, ...Array(bots.length).fill(false)];
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
  Sound.sfx('newgame');
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

// =================== ONLINE MULTIPLAYER (WebSocket relay) ===================
//
// Online play uses a tiny WebSocket relay (Cloudflare Worker + Durable Object —
// see /relay) instead of WebRTC peer-to-peer. The previous PeerJS path failed
// silently for users behind symmetric NATs / strict firewalls; a public relay
// is always reachable so connectivity is no longer the bottleneck. Topology is
// unchanged: the host runs the engine, clients send `move` packets, the host
// applies them and broadcasts new `state`. The relay just routes bytes between
// the host socket and the client sockets in a given room.
//
// Set RELAY_URL to YOUR deployed worker's wss:// URL — see /relay/README.md.
const RELAY_URL = 'wss://shitstein.b-rohleder.workers.dev';
function relayConfigured() { return !RELAY_URL.includes('YOUR-CF-SUBDOMAIN'); }

// Short, readable, hard-to-confuse room codes (no 0/O, no 1/I/L).
function generateRoomCode() {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

// Build a shareable join URL for a given room code, anchored to the page that's loaded.
function buildShareUrl(roomId) {
  const url = new URL(location.href);
  url.search = `?room=${encodeURIComponent(roomId)}`;
  url.hash = '';
  return url.toString();
}

function buildHostConfig(cfg) {
  cfg.innerHTML = `
    <h3>Host Online Game</h3>
    <div class="row"><label>Your name <input type="text" id="cfg-name" value="Host" maxlength="16"></label></div>
    <button class="primary" id="cfg-host">Create Room</button>
    <div id="host-room" class="hidden" style="margin-top:18px;"></div>
  `;
  $('cfg-host').addEventListener('click', () => {
    if (!relayConfigured()) {
      alert("Online play needs a relay server. Deploy the worker in /relay (see relay/README.md) and set RELAY_URL in shithead.js.");
      return;
    }
    const name = ($('cfg-name').value.trim() || 'Host').slice(0, 16);
    startHosting(name);
  });
}

function startHosting(myName) {
  const hostBtn = $('cfg-host');
  hostBtn.disabled = true;
  hostBtn.textContent = 'Connecting…';

  const roomCode = generateRoomCode();
  let ws;
  try {
    ws = new WebSocket(`${RELAY_URL}/room/${roomCode}?role=host`);
  } catch (e) {
    console.error('[host] failed to open WebSocket', e);
    alert("Couldn't open WebSocket: " + (e.message || e));
    hostBtn.disabled = false; hostBtn.textContent = 'Create Room';
    return;
  }

  // Sanity timeout: if the relay doesn't say roomReady within 10s, give the user a clear out.
  const openTimeout = setTimeout(() => {
    if (hostBtn.disabled && hostBtn.textContent === 'Connecting…') {
      console.warn('[host] relay did not roomReady within 10s');
      try { ws.close(); } catch (_) {}
      hostBtn.disabled = false; hostBtn.textContent = 'Retry';
      alert("Couldn't reach the game relay. Check your connection and try again.");
    }
  }, 10000);

  let opened = false;
  ws.addEventListener('open', () => { opened = true; });
  // Initial listener: waits for the relay's roomReady, then hands off to showHostLobby
  // (which attaches its own message listener for ongoing traffic). We don't bother removing
  // this listener — the relay only sends roomReady once per host socket.
  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }
    if (msg.type !== 'roomReady') return;
    clearTimeout(openTimeout);
    console.log('[host] room open — code', roomCode);
    hostBtn.style.display = 'none';
    const nameInput = $('cfg-name');
    if (nameInput) {
      const nameRow = nameInput.closest('.row');
      if (nameRow) nameRow.style.display = 'none';
    }
    showHostLobby(ws, roomCode, myName);
  });
  ws.addEventListener('error', () => {
    clearTimeout(openTimeout);
    console.error('[host] websocket error');
    if (!opened) {
      alert("Network error connecting to the game relay. The server may be down, your origin may not be allowed, or your network may be blocking WebSockets.");
      hostBtn.style.display = '';
      hostBtn.disabled = false; hostBtn.textContent = 'Create Room';
    }
  });
  ws.addEventListener('close', (ev) => {
    clearTimeout(openTimeout);
    if (!opened) {
      const reason = ev.reason || `code ${ev.code}`;
      alert("Couldn't open the relay connection: " + reason);
      hostBtn.style.display = '';
      hostBtn.disabled = false; hostBtn.textContent = 'Create Room';
    }
  });
}

function showHostLobby(ws, roomCode, hostName) {
  const div = $('host-room');
  const shareUrl = buildShareUrl(roomCode);
  div.classList.remove('hidden');
  div.innerHTML = `
    <p>Send this <strong>invite link</strong> to friends — they click it and they're in:</p>
    <div class="code-display" id="copy-link" title="Click to copy link">${escapeHtml(shareUrl)}</div>
    <p class="muted" style="font-size:12px;margin-top:6px;">Or share the room code: <code id="copy-id" style="cursor:pointer" title="Click to copy code">${escapeHtml(roomCode)}</code></p>
    <p class="muted" style="font-size:12px;">Game runs over a small WebSocket relay. The room exists only as long as this tab stays open. Up to 5 players.</p>
    <h4 style="margin-top:14px;margin-bottom:6px;">Players in lobby</h4>
    <ul class="players-list" id="lobby-players"></ul>
    <button class="primary" id="start-online">Start Game</button>
    <p class="muted" id="host-status" style="font-size:12px;margin-top:8px;">Waiting for players…</p>
  `;
  const copyToClipboard = async (text, el) => {
    try {
      await navigator.clipboard.writeText(text);
      const orig = el.textContent;
      el.textContent = 'Copied!';
      setTimeout(() => el.textContent = orig, 1200);
    } catch (e) {/* fallback: leave it */}
  };
  $('copy-link').addEventListener('click', () => copyToClipboard(shareUrl, $('copy-link')));
  $('copy-id').addEventListener('click', () => copyToClipboard(roomCode, $('copy-id')));

  const connections = []; // { connId, name, playerId? }

  function sendTo(connId, body) {
    try { ws.send(JSON.stringify({ ...body, to: connId })); } catch (_) {}
  }

  function refreshLobby() {
    const ul = $('lobby-players');
    if (!ul) return;
    const total = connections.length + 1;
    let html = `<li><strong>${escapeHtml(hostName)}</strong> <span class="muted">(you, host)</span></li>`;
    connections.forEach((c, i) => {
      html += `<li><span>${escapeHtml(c.name)}</span> <button class="ghost lobby-kick" data-idx="${i}" title="Remove this player">kick</button></li>`;
    });
    ul.innerHTML = html;
    ul.querySelectorAll('.lobby-kick').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const c = connections[idx];
        if (!c) return;
        try { ws.send(JSON.stringify({ type: 'kick', to: c.connId, reason: 'You were removed by the host.' })); } catch (_) {}
        connections.splice(idx, 1);
        refreshLobby();
      });
    });
    const status = $('host-status');
    if (status) status.textContent = `${total}/5 player${total === 1 ? '' : 's'} ready.${total < 2 ? ' Need at least one more to start.' : ''}`;
  }
  refreshLobby();

  ws.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (_) { return; }
    if (msg.type === 'clientJoined') {
      // We'll wait for their hello before adding them to the lobby.
      return;
    }
    if (msg.type === 'clientLeft') {
      const idx = connections.findIndex(c => c.connId === msg.connId);
      if (idx >= 0) {
        const lost = connections[idx];
        connections.splice(idx, 1);
        refreshLobby();
        if (state && lost.playerId != null) {
          console.warn(`[host] ${lost.name} disconnected mid-game (player ${lost.playerId})`);
        }
      }
      return;
    }
    // Forwarded message from a client. `from` = the client's connId.
    if (msg.from == null) return;
    if (msg.type === 'hello') {
      if (state) { sendTo(msg.from, { type: 'reject', reason: 'Game already started' }); return; }
      if (connections.length >= 4) {
        sendTo(msg.from, { type: 'reject', reason: 'Room is full (5 players max)' });
        return;
      }
      connections.push({ connId: msg.from, name: (String(msg.name || 'Player')).slice(0, 16) });
      sendTo(msg.from, { type: 'welcome' });
      refreshLobby();
    } else if (msg.type === 'move' && state && msg.playerId != null) {
      // Sanity: ensure the move is for the player slot this client was assigned, so
      // a confused or malicious client can't act for someone else.
      const c = connections.find(c => c.connId === msg.from);
      if (!c || c.playerId !== msg.playerId) {
        console.warn('[host] move from wrong player', msg);
        return;
      }
      applyMove(msg.move, msg.playerId);
    } else if (msg.type === 'reaction' && state) {
      // A client posted an emoji. Show it locally and re-broadcast to the OTHER clients
      // (not back to the sender). The reaction is attributed to the sender's playerId.
      const c = connections.find(c => c.connId === msg.from);
      if (!c || c.playerId == null) return;
      const reaction = { emoji: String(msg.emoji || ''), text: String(msg.text || '') };
      showReactionBubble(c.playerId, reaction, true);
      Sound.sfx('reaction');
      connections.forEach(other => {
        if (other.connId === msg.from) return;
        sendTo(other.connId, { type: 'reaction', playerId: c.playerId, ...reaction });
      });
    }
  });
  ws.addEventListener('close', (ev) => {
    console.warn('[host] relay socket closed', ev.code, ev.reason);
    if (state) {
      const banner = document.createElement('div');
      banner.className = 'disconnect-banner';
      banner.textContent = '⚠ Lost connection to the game relay. Refresh to start a new game.';
      document.body.appendChild(banner);
    }
  });

  // Keep-alive: Cloudflare drops idle WebSockets after ~100s of silence. Send a tiny
  // ping every 30s so the relay keeps the socket open between moves. The relay drops
  // pings (doesn't forward); we just want the activity to reset its idle timer.
  const hostPingTimer = setInterval(() => {
    if (ws.readyState === 1) { try { ws.send(JSON.stringify({ type: 'ping' })); } catch (_) {} }
  }, 30000);
  ws.addEventListener('close', () => clearInterval(hostPingTimer));

  net = {
    cleanup() { try { ws.close(); } catch (e) {} clearInterval(hostPingTimer); },
    broadcastState() {
      connections.forEach(c => {
        if (c.playerId == null) return;
        sendTo(c.connId, { type: 'state', state: serializeStateFor(state, c.playerId) });
      });
    },
    broadcastReaction(reaction) {
      // reaction = { playerId, emoji, text }. Sent to every connected client.
      connections.forEach(c => sendTo(c.connId, { type: 'reaction', ...reaction }));
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

    connections.forEach(c => sendTo(c.connId, { type: 'assign', playerId: c.playerId }));

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
    if (!relayConfigured()) {
      alert("Online play needs a relay server. Deploy the worker in /relay (see relay/README.md) and set RELAY_URL in shithead.js.");
      return;
    }
    const name = ($('cfg-name').value.trim() || 'Player').slice(0, 16);
    const code = $('cfg-code').value.trim();
    if (!code) return alert('Enter a room code first.');
    joinRoom(code, name);
  });
}

function joinRoom(roomId, myName) {
  $('cfg-join').disabled = true;
  $('cfg-join').textContent = 'Joining…';
  $('join-status').textContent = 'Connecting to relay…';

  let ws;
  try {
    ws = new WebSocket(`${RELAY_URL}/room/${encodeURIComponent(roomId)}?role=join`);
  } catch (e) {
    $('cfg-join').disabled = false;
    $('cfg-join').textContent = 'Join';
    return alert("Couldn't open WebSocket: " + (e.message || e));
  }

  let opened = false;
  const connectTimeout = setTimeout(() => {
    if (!opened) {
      $('join-status').textContent = "Couldn't connect — relay may be down or blocking your network.";
      try { ws.close(); } catch (e) {}
      $('cfg-join').disabled = false;
      $('cfg-join').textContent = 'Join';
    }
  }, 20000);
  let welcomeTimeout = null;

  // Keep-alive: Cloudflare drops idle WebSockets after ~100s. A tiny ping every 30s
  // keeps the relay's idle timer reset between human moves (which can be slow).
  // The relay drops pings without forwarding; we just need traffic on the pipe.
  const joinPingTimer = setInterval(() => {
    if (ws.readyState === 1) { try { ws.send(JSON.stringify({ type: 'ping' })); } catch (_) {} }
  }, 30000);

  ws.addEventListener('open', () => {
    opened = true;
    clearTimeout(connectTimeout);
    $('join-status').textContent = 'Connected. Saying hello…';
    try { ws.send(JSON.stringify({ type: 'hello', name: myName })); }
    catch (e) { $('join-status').textContent = 'Could not send hello: ' + (e.message || e); }
    welcomeTimeout = setTimeout(() => {
      $('join-status').textContent = "Connected but the host didn't acknowledge. They might still be loading — wait a moment, or refresh and try again.";
    }, 20000);
  });

  ws.addEventListener('message', (ev) => {
    let data;
    try { data = JSON.parse(ev.data); } catch (_) { return; }
    if (data.type === 'reject' || data.type === 'kicked') {
      clearTimeout(welcomeTimeout);
      alert((data.type === 'kicked' ? 'Removed: ' : 'Rejected: ') + (data.reason || ''));
      try { ws.close(); } catch (e) {}
      $('cfg-join').disabled = false;
      $('cfg-join').textContent = 'Join';
    } else if (data.type === 'welcome') {
      clearTimeout(welcomeTimeout);
      $('join-status').textContent = 'In the lobby. Waiting for the host to start the game…';
    } else if (data.type === 'assign') {
      myPlayerId = data.playerId;
    } else if (data.type === 'state') {
      state = deserializeStateForClient(data.state);
      $('lobby').classList.remove('active');
      $('table').classList.add('active');
      syncActionLogFromState();
      renderTable();
      if (state.phase === 'over') showGameOver();
    } else if (data.type === 'reaction' && state) {
      // Someone else (the host or another client, relayed via host) posted an emoji.
      const reactor = (data.playerId != null) ? state.players[data.playerId] : null;
      if (!reactor) return;
      showReactionBubble(reactor.id, { emoji: String(data.emoji || ''), text: String(data.text || '') }, true);
      Sound.sfx('reaction');
    } else if (data.type === 'hostLeft') {
      // Host disconnected — relay will close us next, but show a clear banner now.
      if (state) {
        const banner = document.createElement('div');
        banner.className = 'disconnect-banner';
        banner.textContent = '⚠ Host left the game. Refresh to rejoin or start a new one.';
        document.body.appendChild(banner);
      }
    }
  });
  ws.addEventListener('error', (err) => {
    console.warn('[join] websocket error', err);
  });
  ws.addEventListener('close', (ev) => {
    clearTimeout(connectTimeout);
    clearTimeout(welcomeTimeout);
    clearInterval(joinPingTimer);
    if (!opened) {
      $('join-status').textContent = 'Could not connect to the relay (' + (ev.reason || `code ${ev.code}`) + '). Check your room code and try again.';
      $('cfg-join').disabled = false;
      $('cfg-join').textContent = 'Join';
    } else if (state) {
      $('join-status').textContent = 'Lost connection to the relay.';
      const banner = document.createElement('div');
      banner.className = 'disconnect-banner';
      banner.textContent = '⚠ Disconnected. Refresh the page to rejoin.';
      document.body.appendChild(banner);
    } else {
      $('join-status').textContent = 'Disconnected before the game started. ' + (ev.reason || '');
      $('cfg-join').disabled = false;
      $('cfg-join').textContent = 'Join';
    }
  });

  net = {
    cleanup() { try { ws.close(); } catch (e) {} clearInterval(joinPingTimer); },
    sendToHost(msg) {
      try { ws.send(JSON.stringify(msg)); }
      catch (e) { console.warn('sendToHost failed', e); }
    },
    broadcastState() {},
  };
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
    lastPlayCards: s.lastPlayCards ? s.lastPlayCards.slice() : null,
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
    lastPlayCards: packet.lastPlayCards || null,
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

// Emoji picker — human reactions. Each emoji has a pool of 10 lines that cycle randomly,
// avoiding the most-recent line so consecutive clicks of the same button feel fresh.
const EMOJI_LINES = {
  '👏': [
    "Nice one.", "Tidy that, mate.", "Class move.", "Look at the brain on you.",
    "Pure quality, that.", "Top shelf.", "Standing ovation, get the trumpets.",
    "Behave yourself, that was lovely.", "Had to be done.", "Oh mama, gorgeous play.",
  ],
  '🔥': [
    "Absolute weapon!", "Flatten 'em!", "Cooking with petrol.", "Sheer carnage.",
    "Opponents in shambles.", "Boomshakalaka.", "Setting the table on fire.",
    "Take a bow, you menace.", "That's a war crime.", "Somebody call the council.",
  ],
  '🤣': [
    "Absolute melt.", "I'm wheezing.", "What was that, exactly?",
    "Laugh? I nearly bought a round.", "Pure comedy, no notes.", "Pop that on YouTube.",
    "Dignity: sold.", "Never recovering from that.", "Bin it, mate.",
    "Shakespeare couldn't write that.",
  ],
  '😬': [
    "Ouch, mate.", "Yikes on bikes.", "That's gonna sting.", "Felt that one in me bones.",
    "Hurts to watch.", "Eyes off, eyes off.", "Emotional damage.", "I need a lie down.",
    "Hold this for a sec.", "That was unprovoked.",
  ],
  '💀': [
    "RIP.", "Get the priest.", "Game's over for them, send flowers.", "Toe-tagged.",
    "Buried with full honours.", "The morgue is full.", "F in the chat.",
    "Gone but not forgotten.", "Notify their next of kin.", "Cause of death: that.",
  ],
  '🙄': [
    "Was that it?", "Astonishing nothing.", "Riveting stuff, truly.",
    "I've seen better in a Blackpool car park.", "Granny does it better.",
    "Whelmed. Just whelmed.", "Cheers for that, I suppose.", "Slow clap.",
    "We're all so impressed.", "Yawn factory.",
  ],
  '🥲': [
    "Bless ya.", "It's alright, sweetheart.", "We've all been there.",
    "Pop the kettle on, eh.", "There, there.", "Chin up, troops.", "Tough crowd, this.",
    "Nan would be proud (probably).", "Brave attempt.", "Walk it off, champ.",
  ],
  '👑': [
    "Royalty.", "Bow to the monarch.", "Coronation imminent.", "Get a throne in here.",
    "Your majesty, please.", "Top of the food chain.", "All hail.", "Sceptre energy.",
    "Born to rule.", "The realm is yours.",
  ],
  '🤡': [
    "Clown energy.", "Honk honk.", "Get back in the car, all of you.",
    "Big top tonight, is it?", "Three-ring solo performance.", "Make-up's running, love.",
    "Bozo behaviour.", "The circus called, they want their act back.",
    "Comedy gold (the bad kind).", "Send in the clowns — oh wait.",
  ],
  '🍵': [
    "Brew incoming.", "Get the kettle on.", "Tea duty for you, pal.",
    "Builders, two sugars, quick smart.", "The realm demands a brew.", "Cuppa o'clock.",
    "Dunk a digestive while you're at it.", "Earl Grey, strictly.",
    "I take mine milky, ta.", "Less crying, more boiling.",
  ],
};
const _emojiLastIdx = {}; // remembers last picked index per emoji to avoid repeats
function pickEmojiLine(emoji, fallback) {
  const pool = EMOJI_LINES[emoji];
  if (!pool || !pool.length) return fallback || '';
  const last = _emojiLastIdx[emoji];
  let idx = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && idx === last) idx = (idx + 1) % pool.length;
  _emojiLastIdx[emoji] = idx;
  return pool[idx];
}
document.querySelectorAll('#emoji-picker .emoji-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!state || state.phase !== 'play') return;
    Idle.bump();
    const emoji = btn.dataset.emoji;
    const text  = pickEmojiLine(emoji, btn.dataset.text || '');
    showReactionBubble(myPlayerId, { emoji, text }, true);
    Sound.sfx('reaction');
    // Sync to other players in online modes. Host broadcasts to all clients;
    // a joined client sends to host (which re-broadcasts to everyone else).
    if (mode === 'online-host' && net && net.broadcastReaction) {
      net.broadcastReaction({ playerId: myPlayerId, emoji, text });
    } else if (mode === 'online-join' && net && net.sendToHost) {
      net.sendToHost({ type: 'reaction', emoji, text });
    }
  });
});

// Hand sort selector — changing it re-renders with FLIP animation moving cards into place.
const handSortEl = $('hand-sort');
if (handSortEl) {
  handSortEl.value = handSortMode;
  handSortEl.addEventListener('change', () => {
    handSortMode = handSortEl.value;
    Sound.sfx('sort');
    if (state) renderTable();
  });
}

$('lobby').classList.add('active');

// Audio bootstrapping. Browsers block AudioContext until the user interacts; the first
// click anywhere on the page initialises and resumes audio, then kicks off the loop.
const muteBtn = $('btn-mute');
function refreshMuteIcon() {
  if (!muteBtn) return;
  muteBtn.textContent = Sound.isMuted() ? '🔇' : '🔊';
  muteBtn.setAttribute('title', Sound.isMuted() ? 'Sound off — click to unmute' : 'Sound on — click to mute');
}
refreshMuteIcon();
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    Sound.setMuted(!Sound.isMuted());
    refreshMuteIcon();
    if (!Sound.isMuted()) { Sound.resume(); Sound.startMusic(); }
  });
}

// Music-source toggle (MP3 ↔ Synth). The button stays hidden until track discovery
// finishes and we know whether any MP3s exist in /music.
const musicSrcBtn = $('btn-music-src');
function refreshMusicSrcBtn() {
  if (!musicSrcBtn) return;
  const tracks = Sound.getMp3Tracks();
  if (!tracks.length) { musicSrcBtn.style.display = 'none'; return; }
  musicSrcBtn.style.display = '';
  const mode = Sound.getMusicMode();
  if (mode === 'mp3') {
    musicSrcBtn.textContent = '🎵 MP3';
    musicSrcBtn.title = `Music: MP3 (${tracks.length} track${tracks.length === 1 ? '' : 's'}). Click for synth.`;
  } else {
    musicSrcBtn.textContent = '🎹 Synth';
    musicSrcBtn.title = 'Music: synth. Click for MP3.';
  }
}
Sound.tracksReady().then(refreshMusicSrcBtn);
if (musicSrcBtn) {
  musicSrcBtn.addEventListener('click', () => {
    Sound.resume();
    const next = Sound.getMusicMode() === 'mp3' ? 'synth' : 'mp3';
    Sound.setMusicMode(next);
    refreshMusicSrcBtn();
  });
}
document.addEventListener('click', function firstAudioGesture() {
  Sound.init();
  Sound.resume();
  if (!Sound.isMuted()) Sound.startMusic();
  document.removeEventListener('click', firstAudioGesture);
}, { once: true, capture: true });
// Tab visibility: pause/resume music politely so it doesn't keep playing in the background.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Sound.stopMusic();
  else if (!Sound.isMuted()) Sound.startMusic();
});

// Device detection — tag the body with phone | tablet | desktop so CSS hooks (and any future
// JS-driven adaptations) can target the device class. We combine viewport width with a touch
// check rather than UA sniffing (modern iPads claim a desktop UA in Safari). Re-runs on resize.
(function detectDevice() {
  function classify() {
    const w = window.innerWidth;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    let device;
    if (w <= 640)        device = 'phone';
    else if (w <= 1024)  device = 'tablet';
    else                 device = isTouch ? 'tablet' : 'desktop';
    document.body.dataset.device = device;
    document.body.dataset.touch  = isTouch ? 'true' : 'false';
  }
  classify();
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(classify, 150);
  });
})();

// If the page was opened with ?room=ABC123 (a shared invite link), drop the user straight into
// the Join Online flow with the code prefilled — they only need a name and one click.
(function autoJoinFromUrl() {
  try {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (!room) return;
    showModeConfig('online-join');
    setTimeout(() => {
      const codeInput = $('cfg-code');
      const nameInput = $('cfg-name');
      if (codeInput) codeInput.value = room;
      if (nameInput) {
        nameInput.focus();
        nameInput.select();
      }
      const cfg = $('mode-config');
      if (cfg) cfg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);
  } catch (e) { console.warn('autoJoinFromUrl failed', e); }
})();
