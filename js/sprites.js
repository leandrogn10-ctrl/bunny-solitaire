// ── Pixel-art sprites, hand-authored as char grids → SVG <rect>s ─────────────
// Each sprite is an array of strings. Every char maps to a color via the sprite's
// palette; '.' is transparent. render() tolerates ragged rows (short rows = the
// rest is transparent). Exposed as the global `Sprites` (no ES modules, file://).

window.Sprites = (function () {
function render(grid, palette, opts = {}) {
  const h = grid.length;
  const w = Math.max(...grid.map((r) => r.length));
  const size = Math.max(w, h);
  let rects = '';
  if (opts.bg) rects += `<rect x="0" y="0" width="${size}" height="${size}" rx="${opts.rx || 0}" fill="${opts.bg}"/>`;
  const ox = opts.center ? (size - w) / 2 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const fill = palette[grid[y][x]];
      if (!fill) continue;
      rects += `<rect x="${(x + ox).toFixed(2)}" y="${y}" width="1.02" height="1.02" fill="${fill}"/>`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" class="sprite" preserveAspectRatio="xMidYMid meet">${rects}</svg>`;
}

// ── palette (single-char keys only) ───────────────────────────────────────────
const P = {
  g: '#63b34a', G: '#3f8a2e', l: '#8fd06b',            // greens
  o: '#f6902e', d: '#cf6f12', H: '#ffd59a',            // carrot
  r: '#ec4b3f', R: '#bd2f2a', s: '#ffe27a', w: '#fff3cf', // strawberry
  k: '#5a5a68', K: '#33333d',                          // paw
  f: '#f7ead9', F: '#e5cfb8', p: '#f4a3b4', e: '#3a2d27', n: '#d98a97', // bunny
  i: '#ffffff', h: '#f7b3c2', u: '#c8707c',            // eye-shine / cheek / mouth
  y: '#f4c542', Y: '#d29a1f', b: '#6cc0f0',            // crown / gem
  W: '#fffdf6', C: '#e7e2d4',                          // cloud
  t: '#a9713e', T: '#7d5127',                          // trunk
  q: '#ffffff', c: '#ffd94a', m: '#ff8fb0', M: '#e0648c', // daisy / tulip
};

// ── SUITS ─────────────────────────────────────────────────────────────────────
const CARROT = [
  '...g.l.g...',
  '..gGllGGg..',
  '...gGGGg...',
  '....ooo....',
  '...oHooo...',
  '...ooooo...',
  '...doood...',
  '....ooo....',
  '....ooo....',
  '....doo....',
  '.....oo....',
  '.....d.....',
];
const STRAWBERRY = [
  '...glg.....',
  '..g.G.g....',
  '.rrrrrrr...',
  '.rwrsrrsr..',
  '.rsrrsrrr..',
  '..rsrrsrr..',
  '..Rrsrrsr..',
  '...Rrsrr...',
  '...RrsR....',
  '....RrR....',
  '.....R.....',
];
const CLOVER = [
  '...ll.ll...',
  '..lGGlGGl..',
  '..GGGGGGG..',
  '...GGGGG...',
  '..ll.G.ll..',
  '.lGGlGlGGl.',
  '.GGGGlGGGG.',
  '..GGGGGGG..',
  '...GG.GG...',
  '.....G.....',
  '.....G.....',
];
const PAW = [
  '.k...k...k.',
  'kKk.kKk.kKk',
  'kKk.kKk.kKk',
  '.k...k...k.',
  '...........',
  '...kKKKk...',
  '..kKKKKKk..',
  '.kKKKKKKKk.',
  '.kKKKKKKKk.',
  '..kKKKKKk..',
  '...kKKKk...',
];

// ── BUNNY (base 16×16) — the cute one: simple dot eyes + rosy cheeks ───────────
// f fur, F fur-shadow, p inner-ear pink, e eye, n nose, h cheek blush
const BUNNY = [
  '..f........f....',
  '.fFf......fFf...',
  '.fpf......fpf...',
  '.fpf......fpf...',
  '.fFf......fFf...',
  '.ffff....ffff...',
  '..fffffffffff...',
  '.fffffffffffff..',
  '.ffeffffffeff...',
  '.fhfffnnfffhf...',
  '.fffffuufffff...',
  '.fffffffffffff..',
  '..fffffffffff...',
  '...ffffffffff...',
  '....ff....ff....',
  '................',
];

function withHead(rows) {
  const base = BUNNY.map((r) => r.split(''));
  for (const [y, x, ch] of rows) base[y][x] = ch;
  return base.map((r) => r.join(''));
}

// Jack — a spring sprout between the ears (young, no crown)
const KIT = withHead([
  [0, 7, 'g'], [1, 6, 'g'], [1, 7, 'G'], [1, 8, 'l'], [2, 7, 'G'],
]);
// Queen — a wide flower crown across the brow (pink petals, yellow centers)
const DOE = withHead([
  [5, 5, 'p'], [5, 7, 'p'], [5, 9, 'p'],
  [6, 3, 'g'], [6, 4, 'p'], [6, 5, 'c'], [6, 6, 'p'], [6, 7, 'c'],
  [6, 8, 'p'], [6, 9, 'c'], [6, 10, 'p'], [6, 11, 'g'],
]);
// King — a gold crown with a blue gem
const BUCK = withHead([
  [4, 4, 'y'], [4, 6, 'y'], [4, 8, 'y'],
  [5, 3, 'y'], [5, 4, 'Y'], [5, 5, 'y'], [5, 6, 'b'], [5, 7, 'y'], [5, 8, 'Y'], [5, 9, 'y'],
  [6, 4, 'Y'], [6, 5, 'Y'], [6, 6, 'Y'], [6, 7, 'Y'], [6, 8, 'Y'],
]);

// ── SCENERY ───────────────────────────────────────────────────────────────────
// Side-view sitting rabbit facing right (proportions referenced from classic
// farm-game rabbits): alert head held high, ears swept back, big rear haunch,
// front legs dropping to the ground, white tail. h fur, p inner ear, e eye,
// n nose, W tail.
const HOPPER = [
  '.....hh...hh....',
  '.....hph..hph...',
  '......hph.hph...',
  '.......hh.hph...',
  '........hhhhhh..',
  '.......hhhhhhhh.',
  '.......hhhhhehh.',
  '.......hhhhhhhn.',
  '....hhhhhhhhhhh.',
  '..hhhhhhhhhhhhh.',
  '.Whhhhhhhhhhhhh.',
  'WWhhhhhhhhhhhh..',
  '.Whhhhhhhhhhhh..',
  '..hhhhhhhhhhh...',
  '..hhhhhh.hhh....',
  '...hhhh..hhh....',
];
const CLOUD = [
  '....WWWW....',
  '..WWWWWWWWW.',
  '.WWWWWWWWWWW',
  'WWWWWWWWWWWW',
  '.CCCCCCCCCC.',
];
const BUSH = [
  '....GGG.....',
  '..GGlGGGG...',
  '.GGGGGGGGG..',
  'GGGlGGGGGGG.',
  'GGGGGGGlGGGG',
  '.GGGGGGGGGG.',
  '..GGGGGGGG..',
];
const TREE = [
  '...lll...',
  '..lGGGl..',
  '.GGGGGGG.',
  '.GGlGGGG.',
  '..GGGGG..',
  '...GGG...',
  '....t....',
  '....T....',
  '...TTT...',
];
const DAISY = [
  '.p.p.p.',
  'p.ppp.p',
  '.ppcpp.',
  'ppcccpp',
  '.ppcpp.',
  'p.ppp.p',
  '.p.p.p.',
];
const TULIP = [
  'm.m.m',
  'mMmMm',
  '.mMm.',
  '..g..',
  '.lg..',
];
const GRASS = [
  '.g.l.g.',
  'gGgGgGg',
  'gGGGGGg',
];
const BUTTERFLY = [
  'm.e.m',
  'MMeMM',
  'm.e.m',
];

const SUIT_GRIDS = { carrot: CARROT, strawberry: STRAWBERRY, clover: CLOVER, paw: PAW };
const FACE_GRIDS = { 11: KIT, 12: DOE, 13: BUCK };

function suitSprite(suit) {
  return render(SUIT_GRIDS[suit], P);
}
function faceSprite(rank, suit) {
  const warm = suit === 'carrot' || suit === 'strawberry';
  const pal = warm ? P : { ...P, f: '#e9e4ef', F: '#cfc7dd', n: '#b7a6cf' };
  return render(FACE_GRIDS[rank], pal);
}
function hopperSprite(color = '#f2e6d4') {
  return render(HOPPER, { h: color, W: '#fff8ec', e: '#3a2d27', p: '#f4a3b4', n: '#e88a99' });
}
function backEmblem() {
  return render(BUNNY, { ...P, f: '#fff6ea', F: '#ecd9c4', p: '#f7a6b6', e: '#3b2f2a', n: '#d98a97' });
}
function cloudSprite() { return render(CLOUD, P); }
function bushSprite() { return render(BUSH, P); }
function treeSprite() { return render(TREE, P); }
function flowerSprite(type, color) {
  if (type === 'tulip') return render(TULIP, P);
  return render(DAISY, { ...P, p: color || '#ffffff', c: '#ffd94a' });
}
function grassSprite() { return render(GRASS, P); }
function butterflySprite(color = '#ff8fb0') {
  return render(BUTTERFLY, { m: color, M: '#00000033', e: '#3a2d27' });
}
// A cheerful bunny head for the wordmark.
function logoSprite() { return render(BUNNY, P); }
// A self-contained favicon: bunny on a warm rounded tile.
function faviconSVG() {
  return render(BUNNY, { ...P, f: '#fff6ea', F: '#ecd9c4' }, { bg: '#f0932b', rx: 3 });
}

return {
  suitSprite, faceSprite, hopperSprite, backEmblem,
  cloudSprite, bushSprite, treeSprite, flowerSprite, grassSprite, butterflySprite,
  logoSprite, faviconSVG,
};
})();
