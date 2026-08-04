# Bunny Solitaire — project guide

A Klondike solitaire in a hand-drawn meadow. Vanilla JS + CSS, **no build tooling, no dependencies**,
deployed to GitHub Pages (`leandrogn10-ctrl/bunny-solitaire`).

## What this is (don't drift from this)
- **Two shapes of the same app.** `index.html` + `css/styles.css` + `js/{engine,sprites,game}.js` are
  the **dev files**; `Bunny Solitaire.html` is a generated **single-file** build meant to survive being
  emailed and double-clicked. Never hand-edit `Bunny Solitaire.html` — it is output.
- **Classic scripts, not ES modules** — deliberately, so the single file runs from `file://`. Load
  order matters: `engine.js` → `sprites.js` → `game.js`; `game.js` reads `window.Engine` /
  `window.Sprites` at parse time and will throw if that order changes.
- **All art is code.** `sprites.js` generates the cards, bunnies, clouds, trees, flowers, butterflies
  and the favicon — there are no image assets, and there shouldn't be. The layered meadow backdrop
  (`#sky #sun #clouds #hills #scenery #meadow #foreground`) is CSS.

## The load-bearing rules
- **Run `./build.sh` after ANY change to the dev files.** It inlines css + js into
  `Bunny Solitaire.html` and asserts the inlining actually happened. Editing `index.html` and pushing
  without it ships a stale single-file build.
- **Bump the `?v=N` cache-buster in `index.html` on every deploy.** GitHub Pages and browsers cache
  `css/js` for ~10 minutes, so without the bump players sit on stale styles/scripts after a push.
  `build.sh`'s regexes tolerate any `N` — the bump is for the *hosted* dev-file version, not the build.
- Undo is a full state snapshot (`history`, capped at 200). Any new mutation must go through
  `snapshot()` first or it becomes un-undoable.

## Dev loop
```bash
python3 -m http.server 8000
```
Open `http://localhost:8000/`, then `./build.sh` and verify `Bunny Solitaire.html` opens standalone
from `file://` before pushing — that path is the one the dev files can't prove.
