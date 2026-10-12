# AGENTS.md

Asteroids clone in pure HTML5 Canvas + vanilla JavaScript. Zero dependencies, no bundler, no `package.json`, no tests, no linter, no CI — there is nothing to install or run besides the game itself. Don't invent npm scripts or look for build config.

## Run / verify

Open `index.html` directly in a browser (works from `file://` — no fetch or modules used), or:

```bash
npx serve .
```

There is no automated verification; changes must be play-tested manually.

## Conventions

- Comments and user-facing strings (HUD, overlays) are in **Spanish**. Keep new code consistent.
- `game.js` is loaded as a **classic script** (`<script src="game.js">` in `index.html`) — no ES module syntax, no imports/exports.
- Canvas size is defined in two places that must stay in sync: the `<canvas width="800" height="600">` attributes in `index.html` and the `W`/`H` constants at the top of `game.js`.

## Architecture (all in `game.js`)

- Global state machine: `state` ∈ `'playing' | 'dead' | 'gameover'`; `update(dt)` branches on it, `initGame()` resets everything.
- Input: `keys` (held) vs `justPressed` (one-shot). `pressed(code)` **consumes** the flag — call it at most once per frame per key.
- Toroidal space: all positions go through `wrap(v, max)`; `dt` is clamped to 0.05 s in `loop()`.
- Entity pattern: each class (`Ship`, `Asteroid`, `Bullet`, `Particle`, `PowerUp`) has `update(dt)` + `draw()` + a `dead` flag; entity arrays are re-filtered every frame.
- Asteroid tuning lives in the `RADII`/`SPEEDS`/`POINTS` arrays indexed by size 1–3 (index 0 is an unused placeholder); ship handling constants (`ROT`, `THRUST`, `DRAG`) are inline in `Ship.update()`.
- Power-ups: `PowerUp` items drop from destroyed asteroids (10% chance, max 2 on screen, 10 s TTL with a blinking warning); the active effect is a countdown on the ship (`Ship.speedBoost`, in seconds, refreshed on re-pickup). `Particle` takes an optional `color` (defaults to white).
