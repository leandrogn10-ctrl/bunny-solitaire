// ── Bunny Solitaire: rules engine ────────────────────────────────────────────
// Pure-ish Klondike. State is a plain object; helpers read it or return moves.
// Rendering and interaction live elsewhere. Undo is snapshot-based (see game.js).
// Exposed as the global `Engine` so it works from file:// (no ES modules).

window.Engine = (function () {
const SUITS = ['carrot', 'strawberry', 'clover', 'paw'];
const RED_SUITS = new Set(['carrot', 'strawberry']);
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // A..K

const colorOf = (suit) => (RED_SUITS.has(suit) ? 'red' : 'black');
const rankLabel = (r) =>
  ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));

let _idSeed = 0;
const makeCard = (rank, suit) => ({
  id: `${suit}-${rank}-${_idSeed++}`,
  rank,
  suit,
  color: colorOf(suit),
  faceUp: false,
});

// Deterministic-ish shuffle (Fisher–Yates). rng defaults to Math.random.
const shuffle = (arr, rng = Math.random) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

function newDeck() {
  const cards = [];
  for (const s of SUITS) for (const r of RANKS) cards.push(makeCard(r, s));
  return cards;
}

// Fresh game. `drawCount` = 1 or 3.
function deal(rng = Math.random, drawCount = 1) {
  _idSeed = 0;
  const deck = shuffle(newDeck(), rng);
  const tableau = [[], [], [], [], [], [], []];
  let k = 0;
  for (let col = 0; col < 7; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck[k++];
      card.faceUp = row === col; // only the top card of each pile is face up
      tableau[col].push(card);
    }
  }
  const stock = deck.slice(k).map((c) => ({ ...c, faceUp: false }));
  return {
    tableau,
    foundations: { carrot: [], strawberry: [], clover: [], paw: [] },
    stock,
    waste: [],
    drawCount,
    moves: 0,
  };
}

// ── Move legality ────────────────────────────────────────────────────────────

// Can `card` sit on a foundation given the pile's current top?
function canPlayToFoundation(card, foundationPile) {
  if (!card) return false;
  const top = foundationPile[foundationPile.length - 1];
  if (!top) return card.rank === 1; // only an Ace starts a foundation
  return card.suit === top.suit && card.rank === top.rank + 1;
}

// Can `card` land on a tableau column (as the moving stack's bottom card)?
function canPlayToTableau(card, column) {
  if (!card) return false;
  const top = column[column.length - 1];
  if (!top) return card.rank === 13; // only a King goes on an empty column
  return top.faceUp && card.color !== top.color && card.rank === top.rank - 1;
}

// A run of face-up cards is movable if it descends by rank and alternates color.
function isValidRun(cards) {
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].faceUp) return false;
    if (i > 0) {
      const prev = cards[i - 1];
      const cur = cards[i];
      if (cur.rank !== prev.rank - 1 || cur.color === prev.color) return false;
    }
  }
  return true;
}

// ── Locating cards ───────────────────────────────────────────────────────────
// A location: {zone:'tableau', col, index} | {zone:'waste'} | {zone:'foundation', suit}

function findCard(state, cardId) {
  for (let col = 0; col < state.tableau.length; col++) {
    const idx = state.tableau[col].findIndex((c) => c.id === cardId);
    if (idx !== -1) return { zone: 'tableau', col, index: idx };
  }
  const w = state.waste.length - 1;
  if (w >= 0 && state.waste[w].id === cardId) return { zone: 'waste' };
  for (const suit of SUITS) {
    const f = state.foundations[suit];
    if (f.length && f[f.length - 1].id === cardId)
      return { zone: 'foundation', suit };
  }
  return null;
}

// The stack of cards that would move if you grab `cardId` (itself + everything on top).
function grabbedStack(state, cardId) {
  const loc = findCard(state, cardId);
  if (!loc) return null;
  if (loc.zone === 'tableau') {
    const pile = state.tableau[loc.col];
    const run = pile.slice(loc.index);
    if (!isValidRun(run)) return null;
    return { loc, cards: run };
  }
  if (loc.zone === 'waste') {
    return { loc, cards: [state.waste[state.waste.length - 1]] };
  }
  if (loc.zone === 'foundation') {
    return { loc, cards: [state.foundations[loc.suit].slice(-1)[0]] };
  }
  return null;
}

// ── Mutations (call on a working copy; caller snapshots for undo) ─────────────

function removeStack(state, loc, count) {
  if (loc.zone === 'tableau') {
    const pile = state.tableau[loc.col];
    const removed = pile.splice(pile.length - count, count);
    // flip newly exposed tableau card face up
    const nowTop = pile[pile.length - 1];
    if (nowTop && !nowTop.faceUp) nowTop.faceUp = true;
    return removed;
  }
  if (loc.zone === 'waste') return state.waste.splice(state.waste.length - count, count);
  if (loc.zone === 'foundation')
    return state.foundations[loc.suit].splice(-count, count);
  return [];
}

// Attempt to move the stack grabbed at cardId onto target.
// target: {zone:'tableau', col} | {zone:'foundation', suit}
// Returns true if the move happened.
function tryMove(state, cardId, target) {
  const grabbed = grabbedStack(state, cardId);
  if (!grabbed) return false;
  const { loc, cards } = grabbed;
  const bottom = cards[0];

  if (target.zone === 'foundation') {
    if (cards.length !== 1) return false; // foundations take one card at a time
    if (!canPlayToFoundation(bottom, state.foundations[target.suit])) return false;
    removeStack(state, loc, 1);
    state.foundations[target.suit].push(bottom);
    state.moves++;
    return true;
  }

  if (target.zone === 'tableau') {
    if (loc.zone === 'tableau' && loc.col === target.col) return false; // no-op
    if (!canPlayToTableau(bottom, state.tableau[target.col])) return false;
    const moving = removeStack(state, loc, cards.length);
    state.tableau[target.col].push(...moving);
    state.moves++;
    return true;
  }
  return false;
}

// Find the best automatic destination for a card (double-click / auto-move).
// Prefers a foundation, then any legal tableau column.
function autoTarget(state, cardId) {
  const grabbed = grabbedStack(state, cardId);
  if (!grabbed) return null;
  const { cards } = grabbed;
  const bottom = cards[0];
  if (cards.length === 1) {
    for (const suit of SUITS)
      if (canPlayToFoundation(bottom, state.foundations[suit]))
        return { zone: 'foundation', suit };
  }
  for (let col = 0; col < state.tableau.length; col++) {
    const loc = findCard(state, cardId);
    if (loc.zone === 'tableau' && loc.col === col) continue;
    if (canPlayToTableau(bottom, state.tableau[col]))
      return { zone: 'tableau', col };
  }
  return null;
}

// Draw from stock to waste (drawCount cards). If stock empty, recycle waste.
function drawFromStock(state) {
  if (state.stock.length === 0) {
    if (state.waste.length === 0) return false;
    // recycle: waste back to stock, face down, order reversed
    state.stock = state.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    state.waste = [];
    state.moves++;
    return true;
  }
  const n = Math.min(state.drawCount, state.stock.length);
  const drawn = state.stock.splice(state.stock.length - n, n).reverse();
  for (const c of drawn) c.faceUp = true;
  state.waste.push(...drawn);
  state.moves++;
  return true;
}

function isWon(state) {
  return SUITS.every((s) => state.foundations[s].length === 13);
}

// True if every remaining card is face up and could theoretically auto-finish.
function canAutoComplete(state) {
  if (state.stock.length || state.waste.length) return false;
  return state.tableau.every((pile) => pile.every((c) => c.faceUp));
}

return {
  SUITS, RED_SUITS, RANKS, colorOf, rankLabel, newDeck, deal,
  canPlayToFoundation, canPlayToTableau, isValidRun, findCard, grabbedStack,
  tryMove, autoTarget, drawFromStock, isWon, canAutoComplete,
};
})();
