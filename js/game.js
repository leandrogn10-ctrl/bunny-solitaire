// Classic script (no ES modules) so the game runs from a double-clicked
// file:// page. engine.js and sprites.js must load before this.
const E = window.Engine;
const {
  suitSprite, faceSprite, hopperSprite, backEmblem,
  cloudSprite, bushSprite, treeSprite, flowerSprite, grassSprite, butterflySprite,
  logoSprite, faviconSVG,
} = window.Sprites;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const DAISY_COLORS = ['#ffffff', '#ff5e9c', '#7ab8ff', '#c78bff', '#ffe066'];

// ── state + history ───────────────────────────────────────────────────────────
let state = null;
let history = [];
const clone = (s) => JSON.parse(JSON.stringify(s));
const snapshot = () => { history.push(clone(state)); if (history.length > 200) history.shift(); };

const $ = (sel) => document.querySelector(sel);
const board = $('#board');
const tableauEl = $('#tableau');
const foundationsEl = $('#foundations');
const stockEl = $('#stock');
const wasteEl = $('#waste');

// ── persistence, settings, timer, scores ──────────────────────────────────────
const KEY = { game: 'bunny.game', time: 'bunny.time', settings: 'bunny.settings', scores: 'bunny.scores' };
const saveJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
const loadJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } };

let settings = Object.assign({ sound: true, drawMode: 1 }, loadJSON(KEY.settings) || {});
let sound = settings.sound;
let drawMode = settings.drawMode;
const saveSettings = () => saveJSON(KEY.settings, { sound, drawMode });

function saveGame() {
  if (winning) { localStorage.removeItem(KEY.game); localStorage.removeItem(KEY.time); return; }
  saveJSON(KEY.game, { state, history });
  saveJSON(KEY.time, { ms: timer.ms, active: timer.active });
}
const saveTime = () => saveJSON(KEY.time, { ms: timer.ms, active: timer.active });

function tryResume() {
  const g = loadJSON(KEY.game);
  if (!g || !g.state || E.isWon(g.state)) return false;
  state = g.state;
  history = g.history || [];
  drawMode = state.drawCount || drawMode;
  updateDrawModeButton();
  const t = loadJSON(KEY.time) || {};
  timer.ms = t.ms || 0;
  winning = false;
  autoRunning = false;
  render();
  renderTimer();
  if (t.active || timer.ms > 0) startTimer();
  return true;
}

const timer = { ms: 0, active: false, interval: null };
const fmtTime = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const renderTimer = () => { $('#timer').textContent = fmtTime(timer.ms); };
function startTimer() {
  if (timer.active || winning) return;
  timer.active = true;
  timer.interval = setInterval(() => { timer.ms += 1000; renderTimer(); saveTime(); }, 1000);
}
function stopTimer() { timer.active = false; clearInterval(timer.interval); timer.interval = null; }
function resetTimer() { stopTimer(); timer.ms = 0; renderTimer(); }

const loadScores = () => loadJSON(KEY.scores) || { times: [], moves: [] };
function recordWin(ms, moves) {
  const scores = loadScores();
  const isTimeBest = !scores.times.length || ms < Math.min(...scores.times.map((e) => e.ms));
  const isMoveBest = !scores.moves.length || moves < Math.min(...scores.moves.map((e) => e.moves));
  const entry = { ms, moves, date: Date.now() };
  scores.times = [...scores.times, entry].sort((a, b) => a.ms - b.ms).slice(0, 5);
  scores.moves = [...scores.moves, entry].sort((a, b) => a.moves - b.moves).slice(0, 5);
  saveJSON(KEY.scores, scores);
  return { isTimeBest, isMoveBest, date: entry.date };
}
function renderScoreboard(freshDate) {
  const scores = loadScores();
  const row = (e, val) => `<li class="${e.date === freshDate ? 'fresh' : ''}"><span>${new Date(e.date).toLocaleDateString()}</span><span class="val">${val}</span></li>`;
  $('#score-times').innerHTML = scores.times.length ? scores.times.map((e) => row(e, fmtTime(e.ms))).join('') : '<li class="empty">no wins yet</li>';
  $('#score-moves').innerHTML = scores.moves.length ? scores.moves.map((e) => row(e, e.moves + ' moves')).join('') : '<li class="empty">no wins yet</li>';
}

// --card-w is fluid (see :root in styles.css — it solves for whatever width
// fits 7 columns on the current screen), so card size must be read live
// rather than hardcoded. Fan offsets and waste spacing are kept as the same
// proportions of card height/width that the original fixed 78×110 design used.
function cardMetrics() {
  // --card-w is set as a plain resolved px value by fitCardWidth() (see below),
  // so reading it back is safe. --card-h is a calc() formula in CSS, and
  // getComputedStyle returns a custom property's raw authored formula rather
  // than its resolved pixels — so we mirror that same 1.410 ratio here instead
  // of trying to read --card-h directly (it would parse to NaN).
  const w = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-w'));
  const h = w * 1.410;
  return { w, h, fanDown: h * 0.218, fanUp: h * 0.273, wasteFan: w * 0.231 };
}

// ── card element ──────────────────────────────────────────────────────────────
// Standard playing-card pip positions, as % of the card. Columns pulled in (L/R)
// so outer pips clear the corner indices; rows run 20%→80%. All pips upright —
// upside-down carrots looked odd, and this reads cuter.
const L = 32, M = 50, R = 68;
const PIPS = {
  2: [[M, 0.20], [M, 0.80]],
  3: [[M, 0.20], [M, 0.50], [M, 0.80]],
  4: [[L, 0.20], [R, 0.20], [L, 0.80], [R, 0.80]],
  5: [[L, 0.20], [R, 0.20], [M, 0.50], [L, 0.80], [R, 0.80]],
  6: [[L, 0.20], [R, 0.20], [L, 0.50], [R, 0.50], [L, 0.80], [R, 0.80]],
  7: [[L, 0.20], [R, 0.20], [M, 0.35], [L, 0.50], [R, 0.50], [L, 0.80], [R, 0.80]],
  8: [[L, 0.20], [R, 0.20], [M, 0.35], [L, 0.50], [R, 0.50], [M, 0.65], [L, 0.80], [R, 0.80]],
  9: [[L, 0.20], [R, 0.20], [L, 0.40], [R, 0.40], [M, 0.50], [L, 0.60], [R, 0.60], [L, 0.80], [R, 0.80]],
  10: [[L, 0.20], [R, 0.20], [M, 0.32], [L, 0.40], [R, 0.40], [L, 0.60], [R, 0.60], [M, 0.68], [L, 0.80], [R, 0.80]],
};

function cardFace(card) {
  const suit = suitSprite(card.suit);
  const label = E.rankLabel(card.rank);
  const corner = `<div class="corner"><span>${label}</span>${suit}</div>`;
  let center;
  if (card.rank >= 11) center = `<div class="center face">${faceSprite(card.rank, card.suit)}</div>`;
  else if (card.rank === 1) center = `<div class="center ace">${suit}</div>`;
  else {
    const pips = PIPS[card.rank]
      .map(([x, y]) => `<span class="pip" style="left:${x}%;top:${y * 100}%">${suit}</span>`)
      .join('');
    center = `<div class="center pips">${pips}</div>`;
  }
  return `${corner}${center}<div class="corner br"><span>${label}</span>${suit}</div>`;
}

function makeCardEl(card, faceUp) {
  const el = document.createElement('div');
  el.className = `card ${card.color} ${faceUp ? 'up' : 'down'}`;
  el.dataset.id = card.id;
  el.innerHTML = faceUp ? cardFace(card) : `<div class="back">${backEmblem()}</div>`;
  return el;
}

// ── render ────────────────────────────────────────────────────────────────────
function render() {
  renderStockWaste();
  renderFoundations();
  renderTableau();
  updateStatus();
}

function renderStockWaste() {
  stockEl.innerHTML = '';
  if (state.stock.length) {
    const el = document.createElement('div');
    el.className = 'card down stock-top';
    el.innerHTML = `<div class="back">${backEmblem()}</div>`;
    stockEl.appendChild(el);
  } else {
    stockEl.innerHTML = '<div class="pile-slot recycle">↻</div>';
  }

  wasteEl.innerHTML = '';
  const w = state.waste;
  const shown = w.slice(-3); // fan the last few
  const { wasteFan } = cardMetrics();
  shown.forEach((card, i) => {
    const el = makeCardEl(card, true);
    el.style.left = `${i * wasteFan}px`;
    if (i === shown.length - 1) attachDrag(el, card);
    wasteEl.appendChild(el);
  });
}

function renderFoundations() {
  foundationsEl.innerHTML = '';
  for (const suit of E.SUITS) {
    const pile = document.createElement('div');
    pile.className = 'pile foundation';
    pile.dataset.zone = 'foundation';
    pile.dataset.suit = suit;
    const cards = state.foundations[suit];
    if (!cards.length) {
      pile.innerHTML = `<div class="pile-slot ghost">${suitSprite(suit)}</div>`;
    } else {
      const top = cards[cards.length - 1];
      const el = makeCardEl(top, true);
      attachDrag(el, top);
      pile.appendChild(el);
    }
    foundationsEl.appendChild(pile);
  }
}

function renderTableau() {
  tableauEl.innerHTML = '';
  const { h, fanDown, fanUp } = cardMetrics();
  state.tableau.forEach((pile, col) => {
    const colEl = document.createElement('div');
    colEl.className = 'pile column';
    colEl.dataset.zone = 'tableau';
    colEl.dataset.col = col;
    if (!pile.length) colEl.classList.add('empty');
    let y = 0;
    pile.forEach((card) => {
      const el = makeCardEl(card, card.faceUp);
      el.style.top = `${y}px`;
      if (card.faceUp) attachDrag(el, card);
      colEl.appendChild(el);
      y += card.faceUp ? fanUp : fanDown;
    });
    colEl.style.minHeight = `${y + h}px`;
    tableauEl.appendChild(colEl);
  });
}

function updateStatus() {
  $('#moves').textContent = state.moves;
  const done = E.SUITS.reduce((n, s) => n + state.foundations[s].length, 0);
  $('#progress').textContent = `${done}/52`;
  // surface the finish button only when a foundation-only finish truly wins
  $('#auto').classList.toggle('hidden', E.isWon(state) || !canFinishByFoundation());
}

// ── interaction: drag + tap ───────────────────────────────────────────────────
let drag = null;

function attachDrag(el, card) {
  el.addEventListener('pointerdown', (ev) => beginDrag(ev, el, card));
}

function beginDrag(ev, el, card) {
  ev.preventDefault();
  const grabbed = E.grabbedStack(state, card.id);
  if (!grabbed) return;

  // collect the DOM elements for the whole moving run (this card + those above it)
  const colEl = el.closest('.pile');
  let groupEls = [el];
  if (colEl && colEl.classList.contains('column')) {
    const all = [...colEl.querySelectorAll('.card')];
    const idx = all.indexOf(el);
    groupEls = all.slice(idx);
  }

  const startRect = el.getBoundingClientRect();
  drag = {
    card,
    els: groupEls,
    startX: ev.clientX,
    startY: ev.clientY,
    moved: false,
    origin: groupEls.map((g) => ({ el: g, parent: g.parentElement, next: g.nextSibling })),
    offX: ev.clientX - startRect.left,
    offY: ev.clientY - startRect.top,
    baseTop: groupEls.map((g) => parseFloat(g.style.top || '0')),
  };

  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd, { once: true });
}

function onDragMove(ev) {
  if (!drag) return;
  const dx = ev.clientX - drag.startX;
  const dy = ev.clientY - drag.startY;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return; // tap threshold
  if (!drag.moved) {
    drag.moved = true;
    drag.els.forEach((g) => g.classList.add('dragging'));
  }
  drag.els.forEach((g) => {
    g.style.transform = `translate(${dx}px, ${dy}px)`;
    g.style.zIndex = 9999;
  });
  updateDropHint(ev.clientX, ev.clientY);
}

function onDragEnd(ev) {
  window.removeEventListener('pointermove', onDragMove);
  const d = drag;
  drag = null;
  if (!d) return;

  if (!d.moved) {
    tapToPlay(d.card);
    return;
  }

  d.els.forEach((g) => {
    g.classList.remove('dragging');
    g.style.transform = '';
    g.style.zIndex = '';
  });

  const target = hitTest(ev.clientX, ev.clientY, d.els);
  if (target) {
    snapshot();
    const ok = E.tryMove(state, d.card.id, target);
    if (ok) {
      playMoveSound(target);
      startTimer();
      render();
      markPlaced(d.card.id);
      afterMove();
      saveGame();
      return;
    }
    history.pop(); // illegal — discard the snapshot
    render();
    rejectCard(d.card.id); // aimed at a pile but it wasn't legal
    return;
  }
  render(); // dropped on empty space — snap back quietly
}

// Which pile is under the pointer? Ignore the cards we're dragging.
function hitTest(x, y, ignore) {
  const ignoreSet = new Set(ignore);
  const piles = [...document.querySelectorAll('.pile')];
  for (const pile of piles) {
    const r = pile.getBoundingClientRect();
    // expand column hit area downward to cover the fanned tail
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom + 40) {
      const zone = pile.dataset.zone;
      if (zone === 'foundation') return { zone, suit: pile.dataset.suit };
      if (zone === 'tableau') return { zone, col: Number(pile.dataset.col) };
    }
  }
  return null;
}

function tapToPlay(card) {
  const target = E.autoTarget(state, card.id);
  if (!target) { thud(); return; } // nothing legal to do with this card
  snapshot();
  if (E.tryMove(state, card.id, target)) {
    playMoveSound(target);
    startTimer();
    render();
    markPlaced(card.id);
    afterMove();
    saveGame();
  } else history.pop();
}

// ── controls ──────────────────────────────────────────────────────────────────
stockEl.addEventListener('click', () => {
  if (state.stock.length === 0 && state.waste.length === 0) { thud(); return; }
  snapshot();
  if (E.drawFromStock(state)) {
    drawTick();
    startTimer();
    render();
    saveGame();
  } else history.pop();
});

function undo() {
  if (!history.length) { thud(); return; }
  state = history.pop();
  undoBlip();
  render();
  saveGame();
}

function newGame() {
  history = [];
  winning = false;
  autoRunning = false;
  document.body.classList.remove('won');
  $('#win').classList.add('hidden');
  $('#confetti').innerHTML = '';
  resetTimer();
  state = E.deal(Math.random, drawMode);
  render();
  dealAnimation();
  saveGame();
}

function afterMove() {
  if (E.isWon(state)) return winSequence();
}

// ── auto-complete ─────────────────────────────────────────────────────────────
// Available only when the board is guaranteed winnable (all cards face up, stock
// & waste empty). Repeatedly sends the next playable card to its foundation.
let autoRunning = false;

function nextFoundationMove(s = state) {
  const tops = s.tableau.map((p) => p[p.length - 1]).filter(Boolean);
  if (s.waste.length) tops.push(s.waste[s.waste.length - 1]);
  for (const card of tops)
    for (const suit of E.SUITS)
      if (E.canPlayToFoundation(card, s.foundations[suit]))
        return { id: card.id, suit };
  return null;
}

// True only if greedy foundation-only moves fully win from here. `canAutoComplete`
// (all face up, empty stock) is necessary but NOT sufficient — e.g. [A,2] with 2
// on top deadlocks — so we simulate on a clone and confirm the win is reachable.
function canFinishByFoundation() {
  if (!E.canAutoComplete(state)) return false;
  const sim = clone(state);
  for (let guard = 0; guard < 60; guard++) {
    if (E.isWon(sim)) return true;
    const mv = nextFoundationMove(sim);
    if (!mv) return false;
    E.tryMove(sim, mv.id, { zone: 'foundation', suit: mv.suit });
  }
  return E.isWon(sim);
}

function autoComplete() {
  if (autoRunning || !canFinishByFoundation()) return;
  autoRunning = true;
  const step = () => {
    if (!autoRunning) return;
    const mv = nextFoundationMove();
    if (!mv) {
      autoRunning = false;
      return;
    }
    snapshot();
    if (E.tryMove(state, mv.id, { zone: 'foundation', suit: mv.suit })) {
      boop();
      render();
    }
    if (E.isWon(state)) {
      autoRunning = false;
      winSequence();
      return;
    }
    setTimeout(step, 80);
  };
  step();
}

// ── juice ─────────────────────────────────────────────────────────────────────
// AudioContext creation itself has real startup cost (the browser spins up the
// OS audio subsystem) and can start "suspended" until resumed. If we waited
// until the first sound to create it, that first click would lag. Instead we
// warm it up as early as possible — on load, and again on the very first
// pointer/key touch — so by the time the player actually clicks a card, the
// context is already running and every sound schedules with minimal latency.
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    } catch (_) { return null; }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  return audioCtx;
}
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, ensureAudio, { once: true, passive: true }));

function tone(freq, { when = 0, dur = 0.13, vol = 0.08, type = 'sine' } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  } catch (_) {}
}
function boop() {
  if (!sound) return;
  tone(420 + Math.random() * 120);
}
// A little rising bunny-hop fanfare on win.
function victoryJingle() {
  if (!sound) return;
  [523, 659, 784, 1047, 1319].forEach((f, i) =>
    tone(f, { when: i * 0.11, dur: 0.24, vol: 0.09, type: 'triangle' })
  );
}
// distinct cues for each action
function foundationDing() { if (!sound) return; tone(660, { dur: 0.1, vol: 0.07 }); tone(988, { when: 0.07, dur: 0.16, vol: 0.07, type: 'triangle' }); }
function drawTick() { if (!sound) return; tone(300, { dur: 0.05, vol: 0.05, type: 'square' }); }
function thud() { if (!sound) return; tone(150, { dur: 0.14, vol: 0.09 }); }
function undoBlip() { if (!sound) return; tone(500, { dur: 0.07, vol: 0.06, type: 'triangle' }); tone(370, { when: 0.05, dur: 0.1, vol: 0.06, type: 'triangle' }); }
function clickTick() { if (!sound) return; tone(680, { dur: 0.03, vol: 0.04, type: 'square' }); }

// ── visual feedback ────────────────────────────────────────────────────────────
const playMoveSound = (target) => (target.zone === 'foundation' ? foundationDing() : boop());
function flashCard(id, cls) {
  const el = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
  if (!el) return;
  el.classList.add(cls);
  el.addEventListener('animationend', () => el.classList.remove(cls), { once: true });
}
const rejectCard = (id) => { thud(); flashCard(id, 'shake'); };
const markPlaced = (id) => flashCard(id, 'just-placed');

// highlight the pile under the pointer while dragging, if the drop is legal
function updateDropHint(x, y) {
  document.querySelectorAll('.pile.drop-ok').forEach((p) => p.classList.remove('drop-ok'));
  if (!drag) return;
  const target = hitTest(x, y, drag.els);
  if (!target) return;
  const bottom = drag.card;
  const grabbed = E.grabbedStack(state, bottom.id);
  let ok = false, sel = null;
  if (target.zone === 'foundation') {
    ok = grabbed && grabbed.cards.length === 1 && E.canPlayToFoundation(bottom, state.foundations[target.suit]);
    sel = `.foundation[data-suit="${target.suit}"]`;
  } else {
    ok = E.canPlayToTableau(bottom, state.tableau[target.col]);
    sel = `.column[data-col="${target.col}"]`;
  }
  if (ok && sel) document.querySelector(sel)?.classList.add('drop-ok');
}

// Cards are visible by default (see .card in CSS). The deal-in is a pure CSS
// animation layered on top via .dealing, so if it never runs the table still
// shows. `backwards` fill holds the start frame only during the stagger delay.
function dealAnimation() {
  // The deal-in hides cards (opacity 0) until the animation plays. A hidden/
  // unfocused tab pauses CSS animations, which would strand them invisible — so
  // only animate when visible; otherwise the cards just show at base opacity.
  if (document.visibilityState !== 'visible') return;
  const cards = [...tableauEl.querySelectorAll('.card')];
  cards.forEach((c, i) => {
    c.style.animationDelay = `${i * 16}ms`;
    c.classList.add('dealing');
    c.addEventListener(
      'animationend',
      () => {
        c.classList.remove('dealing');
        c.style.animationDelay = '';
      },
      { once: true }
    );
  });
}

let winning = false;
function winSequence() {
  if (winning) return;
  winning = true;
  stopTimer();
  const ms = timer.ms;
  const moves = state.moves;
  const { isTimeBest, isMoveBest, date } = recordWin(ms, moves);
  saveGame(); // clears the saved (now-finished) game

  $('#win-time').textContent = fmtTime(ms);
  $('#win-moves').textContent = moves;
  $('#win-time-badge').classList.toggle('hidden', !isTimeBest);
  $('#win-moves-badge').classList.toggle('hidden', !isMoveBest);
  winFreshDate = date;

  document.body.classList.add('won');
  victoryJingle();
  cascadeFoundations();
  spawnConfettiBunnies();
  // let the cards fly before the overlay drops in
  setTimeout(() => $('#win').classList.remove('hidden'), 1400);
}
let winFreshDate = 0;

// Classic solitaire payoff: all 52 foundation cards pour off the piles and
// tumble across the meadow. Built from state, so every card flies (not just the
// four rendered tops).
function cascadeFoundations() {
  const piles = [...foundationsEl.querySelectorAll('.foundation')];
  const layer = document.getElementById('confetti');
  let idx = 0;
  E.SUITS.forEach((suit, si) => {
    const rect = piles[si].getBoundingClientRect();
    const cards = state.foundations[suit];
    for (let r = cards.length - 1; r >= 0; r--) {
      const fly = document.createElement('div');
      fly.className = `card up flying ${cards[r].color}`;
      fly.innerHTML = cardFace(cards[r]);
      fly.style.left = `${rect.left}px`;
      fly.style.top = `${rect.top}px`;
      fly.style.setProperty('--vx', `${(Math.random() - 0.5) * 150}vw`);
      fly.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`);
      fly.style.animationDelay = `${idx * 32}ms`;
      fly.addEventListener('animationend', () => fly.remove(), { once: true });
      layer.appendChild(fly);
      idx++;
    }
  });
}

function spawnConfettiBunnies() {
  const layer = $('#confetti');
  const colors = ['#f6e7d8', '#f7a6b6', '#f0932b', '#6ab04c', '#eb4d4b'];
  for (let i = 0; i < 40; i++) {
    const b = document.createElement('div');
    b.className = 'confetti-bunny';
    b.innerHTML = hopperSprite(colors[i % colors.length]);
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDelay = `${Math.random() * 1.2}s`;
    b.style.animationDuration = `${2 + Math.random() * 1.5}s`;
    layer.appendChild(b);
  }
  setTimeout(() => (layer.innerHTML = ''), 5000);
}

// Build the static-but-lively meadow scene once: clouds, hills, bushes/trees,
// flowers, foreground grass, butterflies. Everything animates via CSS.
function buildScenery() {
  const clouds = $('#clouds');
  for (let i = 0; i < 4; i++) {
    const c = document.createElement('div');
    c.className = 'cloud';
    c.innerHTML = cloudSprite();
    c.style.top = `${rand(5, 30)}%`;
    c.style.setProperty('--s', rand(0.7, 1.7).toFixed(2));
    c.style.setProperty('--o', rand(0.72, 0.95).toFixed(2));
    c.style.setProperty('--dur', `${rand(75, 135) | 0}s`);
    c.style.setProperty('--delay', `-${rand(0, 130) | 0}s`);
    clouds.appendChild(c);
  }

  const scenery = $('#scenery');
  for (let i = 0; i < 7; i++) {
    const isTree = Math.random() < 0.35;
    const el = document.createElement('div');
    el.className = isTree ? 'tree' : 'bush';
    el.innerHTML = isTree ? treeSprite() : bushSprite();
    el.style.left = `${rand(1, 92)}%`;
    el.style.top = `${rand(49, 59)}%`;
    el.style.setProperty('--s', rand(0.7, 1.35).toFixed(2));
    scenery.appendChild(el);
  }
  for (let i = 0; i < 16; i++) {
    const fl = document.createElement('div');
    fl.className = 'bloom';
    fl.innerHTML = Math.random() < 0.5 ? flowerSprite('tulip') : flowerSprite('daisy', pick(DAISY_COLORS));
    fl.style.left = `${rand(1, 97)}%`;
    fl.style.top = `${rand(58, 73)}%`;
    fl.style.setProperty('--s', rand(0.7, 1.25).toFixed(2));
    scenery.appendChild(fl);
  }

  const fg = $('#foreground');
  for (let i = 0; i < 18; i++) {
    const t = document.createElement('div');
    t.className = 'tuft';
    t.innerHTML = grassSprite();
    t.style.left = `${rand(0, 98)}%`;
    t.style.setProperty('--s', rand(0.8, 1.9).toFixed(2));
    fg.appendChild(t);
  }
  for (let i = 0; i < 10; i++) {
    const fl = document.createElement('div');
    fl.className = 'near-bloom';
    fl.innerHTML = Math.random() < 0.5 ? flowerSprite('tulip') : flowerSprite('daisy', pick(DAISY_COLORS));
    fl.style.left = `${rand(1, 97)}%`;
    fl.style.bottom = `${rand(6, 54) | 0}px`;
    fl.style.setProperty('--s', rand(0.9, 1.7).toFixed(2));
    fg.appendChild(fl);
  }
  const bfColors = ['#ff8fb0', '#ffd166', '#8fb0ff'];
  for (let i = 0; i < 2; i++) {
    const bf = document.createElement('div');
    bf.className = 'flutter';
    bf.innerHTML = butterflySprite(bfColors[i % bfColors.length]);
    bf.style.left = `${rand(8, 66)}%`;
    bf.style.top = `${rand(46, 74)}%`;
    bf.style.setProperty('--fdur', `${rand(11, 18) | 0}s`);
    fg.appendChild(bf);
  }

  addResidentBunnies();
  spawnHoppers();
}

// A few bunnies that always stay in the side margins, hopping in place — so the
// meadow is never empty even when no one is crossing.
function addResidentBunnies() {
  const meadow = $('#meadow');
  const furs = ['#f2e6d4', '#e8d8c2', '#fff1e0', '#d9c3a8'];
  const spots = [
    [rand(3, 12), rand(60, 78)],
    [rand(4, 13), rand(70, 84)],
    [rand(88, 96), rand(58, 76)],
    [rand(86, 95), rand(70, 84)],
    [rand(2, 10), rand(82, 90)],
  ];
  for (const [left, top] of spots) {
    const b = document.createElement('div');
    b.className = 'rest-bunny';
    b.style.left = `${left}%`;
    b.style.top = `${top}%`;
    b.style.setProperty('--scale', rand(0.9, 1.6).toFixed(2));
    b.style.setProperty('--hp', `${rand(2.2, 3.6).toFixed(1)}s`);
    b.style.setProperty('--hd', `-${rand(0, 2).toFixed(1)}s`);
    b.innerHTML = `<span class="hopper-inner">${hopperSprite(pick(furs))}</span>`;
    meadow.appendChild(b);
  }
}

// Bunnies hop across the meadow band on a loop. `offset` seconds pre-advances a
// bunny (via negative delay) so the field looks populated the instant we load.
function spawnHoppers() {
  const meadow = $('#meadow');
  const furs = ['#f2e6d4', '#e8d8c2', '#fff1e0', '#d9c3a8'];
  const hop = (offset = 0) => {
    const b = document.createElement('div');
    b.className = 'meadow-bunny';
    const cross = rand(9, 15) | 0;
    b.style.top = `${rand(64, 84)}%`;
    b.style.setProperty('--scale', rand(0.8, 1.7).toFixed(2));
    b.style.setProperty('--cross', `${cross}s`);
    if (offset) b.style.animationDelay = `-${offset.toFixed(1)}s, 0s`;
    b.innerHTML = hopperSprite(pick(furs));
    meadow.appendChild(b);
    setTimeout(() => b.remove(), (cross - offset + 2) * 1000);
  };
  for (let i = 0; i < 3; i++) hop(rand(1, 9)); // seed a few already crossing
  setInterval(() => hop(), 3600);
}

// ── buttons ───────────────────────────────────────────────────────────────────
function updateDrawModeButton() {
  const b = $('#draw-mode');
  b.textContent = `draw ${drawMode}`;
  b.classList.toggle('three', drawMode === 3);
}
function setDrawMode(m) {
  drawMode = m;
  if (state) state.drawCount = m; // apply to the current game too
  updateDrawModeButton();
  saveSettings();
  saveGame();
}

$('#new-game').addEventListener('click', () => { clickTick(); newGame(); });
$('#undo').addEventListener('click', undo);
$('#auto').addEventListener('click', autoComplete);
$('#draw-mode').addEventListener('click', () => { clickTick(); setDrawMode(drawMode === 1 ? 3 : 1); });
$('#win-again').addEventListener('click', () => {
  clickTick();
  document.body.classList.remove('won');
  $('#win').classList.add('hidden');
  newGame();
});
$('#scores').addEventListener('click', () => { clickTick(); renderScoreboard(winFreshDate); $('#scoreboard').classList.remove('hidden'); });
$('#scores-close').addEventListener('click', () => { clickTick(); $('#scoreboard').classList.add('hidden'); });
$('#sound').addEventListener('click', (e) => {
  sound = !sound;
  e.currentTarget.textContent = sound ? '🔊' : '🔇';
  saveSettings();
  if (sound) clickTick();
});
// clicking the dim backdrop closes a modal
[$('#win'), $('#scoreboard')].forEach((ov) =>
  ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.add('hidden'); })
);

// ── debug/testing hook ────────────────────────────────────────────────────────
// Small public handle for the console: inspect/replace state, force flows.
window.Game = {
  get state() { return state; },
  set state(s) { state = s; render(); },
  render, newGame, autoComplete, winSequence,
  wipe() { [KEY.game, KEY.time, KEY.settings, KEY.scores].forEach((k) => localStorage.removeItem(k)); },
};

// ── logo + favicon ─────────────────────────────────────────────────────────────
$('#logo-bunny').innerHTML = logoSprite();
$('#favicon').href = 'data:image/svg+xml,' + encodeURIComponent(faviconSVG());

// --card-w must make exactly 7 columns + 6 gaps fit #board's real content
// width. The CSS clamp() fallback approximates this from 100vw, but can't
// know every ancestor's padding — so once the DOM is laid out, measure the
// actual available space and set the variable precisely. This also re-runs
// on resize so rotating a phone or resizing a window keeps it exact, and
// re-renders afterward since fan offsets/min-heights are baked into inline
// px styles at render time.
function fitCardWidth() {
  const cs = getComputedStyle(board);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  // Custom properties report their raw formula (e.g. "clamp(4px, 2vw, 22px)")
  // via getComputedStyle, not a resolved px value — read it off a real grid
  // property instead, which the browser does resolve.
  const gap = parseFloat(getComputedStyle(tableauEl).columnGap) || 0;
  const available = board.clientWidth - padX;
  const w = Math.max(34, Math.min(78, (available - 6 * gap) / 7));
  document.documentElement.style.setProperty('--card-w', `${w}px`);
}

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fitCardWidth();
    state && render();
  }, 120);
});

// ── boot ──────────────────────────────────────────────────────────────────────
fitCardWidth(); // before the first render, so fan offsets use the real card size
buildScenery();
ensureAudio(); // pay AudioContext startup cost now, not on the player's first click
$('#sound').textContent = sound ? '🔊' : '🔇';
updateDrawModeButton();
renderTimer();
if (!tryResume()) newGame();
