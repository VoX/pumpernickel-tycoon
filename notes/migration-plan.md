# Pumpernickel migration plan — React + Vite

## Where we are

- `index.html` is 2125 lines: inline CSS, inline JS, all in one file.
- 92 functions, 30+ top-level constants, ~7 game subsystems (production loop, garden, market, pantheon, crusts, phases, audio).
- Served by Caddy as a static file from `/home/ec2-user/projects/pumpernickel/`. Edit-and-refresh dev loop, no build step.
- One node test harness (`balance/simulate.js`) that imports nothing — duplicates the TREATS array.
- localStorage save format at `saveVersion: 3`.

## Should we migrate at all

**Yes if:**
- We plan to keep adding mechanics (each new system gets harder to thread).
- We want to test UI logic (currently untestable).
- We want hot module reload during dev.
- We want to ship as a PWA / native shell later.

**No if:**
- We're at the end of feature work — current architecture is fine for maintenance.
- We value the "open `index.html` in a browser, edit, refresh" loop above all else.
- We don't want a build step.

VoX's call. The plan below assumes yes.

## Recommended order — incremental, not big-bang

### Phase 0: prerequisite cleanup *(stay in single file)*
Land before any restructure to keep diffs small per phase:
- Remove the duplicated TREATS array in `balance/simulate.js`.
- Pull the inline CSS out into a `<style>` source-of-truth file referenced by HTML (still no build step, just a link tag). Lets us split CSS by feature later.
- Add a tiny `tests/` runner that exercises pure functions (`passiveRate`, `crownsForLifetime`, `pantheonMod`, etc) via node import. Today nothing is testable.

Result: same single-file UX, but we can extract one chunk at a time without breaking things.

### Phase 1: module split *(still vanilla, no React)*
Add a minimal Vite config that bundles ES modules into a single output. Develop with `vite dev`, ship `vite build` to Caddy.

Proposed structure:

```
src/
  content/                # static data, no logic
    treats.js
    events.js
    achievements.js
    species.js
    temperaments.js
    commodities.js
    phases.js
    crown-shop.js
    golden-buffs.js

  systems/                # game logic, pure or near-pure
    state.js              # defaultState, load, save, invalidatePassiveRate
    rate.js               # passiveRate (cached), rate, tapAmount, globalMult
    achievements.js       # checkAchievements
    events.js             # fireEvent, scheduler
    crumbs.js             # ripening tick
    phases.js             # currentPhase, phase modifiers
    pantheon.js           # pantheonMod, slot/unslot
    garden.js             # plant, harvest, water, pollinate
    market.js             # price update, buy/sell
    burnt-crusts.js       # attach, drain, pop
    audio.js              # SFX synth + mute
    physics.js            # pump bounce + depth spring-damper

  ui/                     # DOM render and event wiring (still vanilla)
    bakery.js
    treats.js
    menu.js               # tab switcher, root modal
    panels/
      achievements.js     # ach list + stats grid
      shop.js
      ascend.js
      garden.js
      pantheon.js
      market.js
    overlays/
      banner.js
      toast.js
      golden.js
      effects-pills.js

  main.js                 # boot: load(), buildTreatRows(), schedulers, intervals

styles/
  base.css
  header.css
  pump.css
  bakery.css
  shop.css
  modal.css
  panels/...

index.html                # shell: header, main, shop section, modal mounts
balance/
  simulate.js             # imports from src/content/* and src/systems/rate.js
```

~30 files, each 50-200 lines. Single-file 2125 → many-file ~3000 lines because of imports and module boilerplate, but every file fits in your head. The balance simulator finally shares code with the live game.

This is a lot of value before any React. **If we stop here, we've already won most of the maintainability benefit.**

### Phase 2: state container
Pick the lightest tool that gives us subscribable state:
- **Zustand** — 1KB, no boilerplate, works with or without React. Recommend.
- Plain `useSyncExternalStore` + a custom store object — also tiny, no dep.
- Skip Redux/MobX — overkill.

Convert the global `state` object into a store. UI render functions subscribe to the slices they need. Tick mutations call `store.set(...)`. The render-function boundary stays imperative; only the data flow changes.

This is a one-cycle change and unlocks Phase 3.

### Phase 3: convert panels to React, one at a time
Order from least-coupled to most:
1. **Help panel** — pure static text. Trivial.
2. **Achievements + Stats** — read-only display from store.
3. **Shop** — store reads + buy actions.
4. **Ascend pane** — same shape as shop.
5. **Pantheon** — slot UI, dnd-feel without dnd lib.
6. **Garden** — biggest, has its own internal state (species picker overlay, plot timers).
7. **Market** — many rows, needs memo for the price-tick refresh.
8. **Bakery row** — hover/long-press/popin/burnt crusts.
9. **Effects pills** — store-subscribed.
10. **Phase indicator + count + rate header** — store-subscribed, simple.

Each panel becomes one `.jsx` file. The main pump emoji + tap handler stays vanilla until last; React isn't great for spring physics anyway.

### Phase 4: tick + game loop
Move `setInterval(tick, 1000)` and the rAF physics loop into `useEffect` hooks at the app root. Memoize pure helpers. Add a `usePerf` hook that profiles tick duration if we ever need it.

### Phase 5: pump physics + tap handler
Last because it's the most touchy. Tap latency must stay <16ms. React's reconciliation can spike that under load. The actual pump element can render imperatively via a ref; React just owns the "active combo tier" CSS class.

### Phase 6: cleanup + ship
- Remove `index.html` source-of-truth (Vite generates it).
- Update Caddy to serve `dist/` instead of repo root.
- Lock save format at `v3` and write a real migration story for future bumps.
- Delete the now-dead bits of `balance/simulate.js` that duplicated content arrays.

## Risk register

| Risk | Mitigation |
|------|------------|
| Bundle size jumps from inline ~50KB JS to React+rdom ~150KB gzipped | Use Preact (~3KB) instead — same React-like API, much smaller. Or stay vanilla through Phase 1 only. |
| Tap latency regresses | Phase 5 last. Profile before/after. Pump tap stays imperative via ref. |
| Save format diverges between phases | Bump `saveVersion` to 4 only after Phase 6. Add real migration logic in `state.load()`. |
| Hot iteration slows down | Vite HMR is sub-second. Should actually be faster than full reload because state survives. |
| One developer (me) makes a mistake mid-phase that breaks live | Each phase ships independently. Caddy serves whichever build succeeded last. |

## What I recommend right now

**Do Phase 0 + Phase 1 as a 2-3 cycle commitment.** That's the biggest maintainability win for the lowest risk. We get:
- Module-level edits instead of 2125-line scrolls
- Vite dev server with HMR
- Reusable test target (balance sim shares code)
- A clean place to add new mechanics

**Then stop and decide** whether React is worth Phases 2-5. Honestly, after Phase 1 the codebase may feel fine without React, and we save 100KB of bundle.

If we do go React, **Preact** instead of React. Same API surface, ~50KB savings, no real downsides for a single-page game.

## Estimated effort

- Phase 0: 1 cycle (~30 min)
- Phase 1: 2-3 cycles (~1.5h)
- Phase 2 (Zustand store): 1 cycle
- Phase 3 (10 panels @ ~30 min each): 3-4 cycles
- Phase 4: 1 cycle
- Phase 5: 1 cycle
- Phase 6: 1 cycle

Total Phase 0-1 only: ~2 hours.
Total all phases: ~5-7 hours of focused work.

## Questions for VoX

1. Stop after Phase 1 (no React) or commit to the full migration?
2. Preact or React?
3. Keep `index.html` editable as-source for emergency edits, or accept the build step is final?
4. Save migration: cut over to `v4` at end, or keep `v3` and treat the migration as transparent to existing players?
