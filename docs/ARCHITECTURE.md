# Mow Money: Architecture

Vite + TypeScript (strict) + three.js. Static site, deployed to GitHub Pages from `dist/` by `.github/workflows/pages.yml`. No backend. Saves go to cookies with a localStorage mirror (`src/core/save.ts`).

## Commands

| Command | What |
|---|---|
| `npm run dev` | dev server on :5178 (index.html plus harness pages) |
| `npm run typecheck` | `tsc --noEmit`, must pass before any hand-off |
| `npm test` | vitest (`tests/**/*.test.ts`) |
| `npm run build` | typecheck + production build to `dist/` |
| `npm run balance` | headless economy simulation with bot strategies (`tools/balance.ts`) |
| `node tools/snap.mjs --path "/harness/mow.html" --wait 4000 --shot out/mow.png` | headless Chrome screenshot (WebGL and rAF work). Read the PNG to see it. |

## Module ownership

Each module has one owner during the parallel build. Never edit a file you do not own; if a contract must change, adapt locally and report the change you need.

| Path | Owner | Contents |
|---|---|---|
| `src/core/*` | orchestrator | shared types, RNG, save, store, bus, format, asset loader |
| `src/data/equipment.ts`, `archetypes.ts`, `hoods.ts`, `assets.ts` | orchestrator (sim may retune numbers, never ids or keys) | catalogs |
| `src/sim/*` except `negotiation.ts` | sim builder | all game rules, pure TS, no DOM, no three.js |
| `src/sim/negotiation.ts`, `src/pitch/*`, `src/data/dialogue.ts` | pitch builder | bargaining engine, neighborhood screen, pitch UI |
| `src/world/property.ts`, `src/mow/*`, `harness/mow.*` | mow builder | property layouts, the 3D mowing job |
| `src/ui/*`, `src/main.ts`, `src/styles/*` | UI builder | app shell, router, every other screen, design system |
| `src/audio/*`, `public/audio/*` | audio builder | Web Audio engine, SFX and music files |
| `art/blender/*`, `public/models/*`, `public/img/thumbs/*` | 3D art builders | Blender scripts and exported GLB models, shop thumbnails |
| `public/img/portraits/*`, `public/img/staff/*`, `public/img/*.webp` | 2D art builder | portraits and key art |
| `tests/*`, `tools/balance.ts` | sim builder (other builders may add their own `tests/<module>.test.ts`) | |

## Dependency rules

```
ui  ──> sim (index.ts only), mow (index.ts), pitch (index.ts), audio (index.ts), core, data
pitch ──> sim (index.ts, negotiation.ts), core, data, world, audio
mow ──> core, data, world, audio, sim/index.ts (computeQuality, TIME_SCALE only)
sim ──> core, data, world/property.ts
world ──> core types only
```

- `src/sim` is pure: no DOM, no `window`, no three.js, no `Math.random()`. It must run in Node (tests, balance tool).
- `src/mow` and `src/pitch` may use three.js and the DOM.
- UI code never reaches into another module's internals.
- Every module must survive missing art: a GLB that 404s becomes a procedural placeholder, a missing portrait becomes a CSS avatar with initials, a missing sound is silent or synthesized.

## State flow

```
store.state (GameState)  <── sim functions mutate it ──  UI / pitch handlers
        │
        └── store.commit() ──> bus 'state:changed' ──> screens re-render
                         └──> debounced saveGame() (cookie + localStorage)
```

Screens re-render from `store.state` on `state:changed`. Keep render functions idempotent. The mowing scene does not touch the store while running; it returns a `MowJobResult` and the UI applies it with `sim.completeManualJob`.

## Screen map

```
Title ──> New game (company name, color) ──> Hub
Hub (Today): jobs due, crews, forecast, End Day
  ├─ Map: towns ─> neighborhoods ─> Neighborhood (pitch module): houses, knock, pitch, mow a client here
  ├─ Clients: list, detail (price, frequency, add-ons, risk, history)
  ├─ Crew: staff, hiring board, crews, gear, managers
  ├─ Garage (shop): mowers, tools, vehicles, add-ons, maintenance
  ├─ Finance: ledger, loans, insurance, marketing, bids
  ├─ Business: charts, valuation, achievements, sell the company (legacy)
  ├─ Skills: owner perk trees
  └─ Settings: audio, graphics, controls, save export/import, reset
Mow job (mow module, full screen) ──> Job Result (UI) ──> back to where you came from
End Day ──> Day Report (UI) ──> Hub (next morning)
```

## Debug hooks

`window.__mm` (set by main.ts in every build): `{ store, sim, debug: { newGame(), grant(cash), setDay(n), goto(screen) } }` so headless tools can drive the game.

## Coordinate conventions

- three.js: +Y up, meters. Models face +Z, origin on the ground at the footprint center.
- Property layout: x across the lot (0..w), z from the street edge (0) to the back (d). The street is z < 0.
- Neighborhood map: meters, streets along x, lots on both sides.
