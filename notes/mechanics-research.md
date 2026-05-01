# Clicker / idle game mechanics survey

Reference notes for future Pumpernickel Tycoon expansions. Not all of these belong in a small game, but they're the menu.

## Cookie Clicker (the canonical idle)
- **Long upgrade ladder** — 19 building types, each ~10-20x output of the previous. Generates a satisfying "cross a threshold, unlock a new tier" loop for hours.
- **Per-building upgrades** — "Forwards from grandma" doubles grandma output. A second tier doubles again. Each building has 3-5 such multiplier upgrades that unlock at owned-count breakpoints (1, 5, 25, 50, 100…).
- **Achievement bonuses** — earned achievements give +1% to total CpS; the achievement tab becomes an active source of progress.
- **Sugar lumps** — slow-growing secondary currency (one ripens every ~24h) used to permanently level individual buildings.
- **Heavenly chips / prestige** — burn the run, get permanent multiplier proportional to lifetime. Re-enter with bonuses.
- **Mini-games** — Garden (plant seeds for buffs), Stock Market (trade goods), Pantheon (slot deities for passive bonuses), Grimoire (cast spells with mana).
- **Golden cookies** — random clickable that floats across the screen for 13s, gives a buff on click (Frenzy x7, Lucky +15min CpS, Click Frenzy x777 for 13s).
- **Wrinklers** — late-game pests that drain CpS but pay 110% on pop.

## Clicker Heroes
- **Stages with HP** — DPS-vs-HP rather than pure click-to-collect. Adds a kill-progression rhythm.
- **Heroes** — analogous to buildings; each has tap and idle multipliers separately.
- **Ancients** (prestige) — souls reset progress, ancients level on souls and grant compounding multipliers.
- **Active vs idle archetypes** — different ancient/hero choices favor active tapping or AFK play.

## Adventure Capitalist
- **Managers** — once owned, the building auto-buys/auto-collects; idle without page-open management.
- **Angel investors** (prestige) — softcap-then-reset loop with permanent bonus.

## Common idle-game mechanics worth considering
- **Critical taps** — small % chance per tap for ×10 (or higher) value. Cheap to implement, high payoff feel.
- **Combo/streak** — already in v3.
- **Random clickable bonus** (golden cookie / lucky bread) — periodic, screen-wandering, gives instant bonus or temporary buff.
- **Per-building upgrade tiers** — "Cookbook" doubles apprentice rate; unlocks at N owned. Multiple tiers per building.
- **Synergies** — building X gives +Y% to building Z when both at N+ owned.
- **Achievement % bonus** — passive multiplier from total earned.
- **Sugar-lump-equivalent** — slow secondary currency for long-term spend.
- **Time-bounded events** — real-world holiday content, weekly challenges.
- **Golden run / hardcore mode** — restart with constraints for cosmetic rewards.
- **Themes / skins** — purely cosmetic, drives long-term investment.
- **Soundtrack toggle + sfx** — easy QoL, big "polish" perception boost.

## Recommendations for next 2-3 commits

1. **Extend the upgrade ladder by 4 tiers** (Mill → Citadel → Singularity → Universe) so the game has 9 production buildings instead of 5. Re-run balance sim.
2. **Per-baker upgrade unlocks** — at 10 of any baker, unlock a "Better X" treat that doubles that baker's rate. Adds visible "next thing to buy" for each baker independently.
3. **Golden Pumpernickel** — every 60-180s, a floating 🟡 appears for 8s, taps give +N seconds of current rate as instant bonus. Reuses chaos-event timer infra; new render path.
4. **Critical tap** — 5% chance per tap to give ×10 value. Subtle particle differentiation. Combo-stackable.
5. **Achievement % bonus** — every unlocked achievement adds +1% to total rate. Surfaces a passive reason to chase achievements.

Pick 1-2 per commit cycle, /simplify between, sim balance after each ladder expansion.

---

## Cookie-Clicker-style mini-game adaptations (May 2026)

VoX directive: research Cookie Clicker's farming / stock-market / pantheon / etc. and design *similar but distinct* mechanics for pumpernickel. This file is the design space. Pick one to ship per multi-cycle build.

### A. Yeast Garden  (farming equivalent)
- 3×3 grid of plots in a new menu tab. First plot free; subsequent plots cost crowns or pumpernickels.
- 6-8 species, each with a unique real-time grow timer (5min - 2h):
  - **Active Sourdough** — basic, plays nice with anything. Harvest gives temporary +25% rate buff (5min).
  - **Hops** — wants two empty neighbors. Harvest gives +1% chaos-event frequency for 30min.
  - **Malted Barley** — slow grow (1h). Harvest gives a permanent +0.2% to all baker rates (capped at +5%).
  - **Tinyclaw Weed** — grows next to any sourdough. Harvest unlocks a one-shot golden pumpernickel.
  - **Stardust Grain** — only matures during a buff event. Harvest = bonus crowns.
  - **Void Mold** — destroys neighbors but harvests for ×3 rate buff (3min).
- Cross-pollination: adjacent compatible plants ~5% chance per tick to seed a hybrid in an empty plot.
- Watering can: spend 1k pumpernickels to halve a plant's remaining grow time.
- Persists across ascensions like crown shop.
- Distinct from Cookie Clicker: bread theme, simpler grid (3×3 vs CC's 6×6), more emphasis on neighbor-based interactions, fewer hybrid species.

### B. Yeast Market  (stock market equivalent)
- 5 commodities: flour, salt, butter, sugar, yeast.
- Prices fluctuate every 30s based on time + active chaos events + your bakery composition (e.g. owning many cows raises butter price).
- Buy/sell with pumpernickels. Profit = arbitrage. Limit 1000 units per commodity.
- Unlocks at 1T lifetime (mid-late game).
- News ticker shows hints ("apprentices hate flour", "wizard predicts butter shortage").
- Distinct from Cookie Clicker: prices tied to player's own bakery rather than purely random, unifies with chaos-event flavor.

### C. Tinyclaw Pantheon  (deity slot equivalent)
- Unlock at first ascension. 6 tinyclaw "temperaments", choose 3 to slot.
- Slots: Heart (×1.5 effect), Mind (×1.0), Belly (×0.5).
- Temperaments:
  - **Hungry** — +X% baker rates, -Y% tap.
  - **Lazy** — +X% offline gain, -Y% buff duration.
  - **Greedy** — ×2 instant event amounts, taps cost 0.1% of bank.
  - **Cunning** — +X% golden pumpernickel frequency, -Y% buff strength.
  - **Stout** — ×1.5 streak combo cap, -Y% crit chance.
  - **Dreamer** — +X% achievement bonus, -Y% rate when no buff active.
- Swap costs sugar-lump-equivalent (Crumbs, see D).
- Distinct from Cookie Clicker: explicit tradeoffs in every temperament, no purely-positive options.

### D. Crumb Trail  (sugar lump equivalent)
- A "ripe crumb" appears every 24h real-time (uses lastTick + a ripenAt timestamp).
- Crumbs persist across ascensions. Spend on:
  - Permanent baker level (e.g. apprentice level 3 = +30% apprentice rate).
  - Pantheon temperament swap.
  - Garden plot unlocks.
  - Re-roll a chaos event.
- Crumb types (random on ripening): plain (1 crumb), bifurcated (2), golden (boosts current run), stale (unlocks a hidden achievement).
- Distinct from Cookie Clicker: serves as the "spend currency" for multiple mini-games rather than just building levels.

### E. Sourdough Phases  (seasons equivalent without calendar)
- Cycle of 5 phases, each lasting ~30min of active play time.
- Phase order: Knead → Rise → Bake → Cool → Stale → loop.
- Each phase has unique rules:
  - **Knead** — taps stack 2× combo decay (long streaks possible).
  - **Rise** — passive rate +50%, tap value -50%.
  - **Bake** — buff events fire 2× often, debuffs blocked.
  - **Cool** — chaos events suspend, but every 60s the bank doubles by +10%.
  - **Stale** — production -25% but treats are 50% off.
- Phase indicator near the count display.
- Distinct from Cookie Clicker: not real-world calendar, instead emerges from play rhythm.

### F. Wrinkler equivalent: "Burnt Crusts"
- Late-game (post-1B lifetime). Random chance every 5-15min for a small black icon to attach to a bakery asset.
- Burnt Crust drains 5% of that baker's rate while present.
- Manual click: pops crust, payout = 110% of drained amount across its lifetime.
- Up to 3 crusts at a time.
- Distinct from Cookie Clicker: mid-cycle decision (let it drain longer for bigger payout, or pop early?).

---

## Sequencing recommendation

Pick ONE big mechanic per design cycle:

1. **First**: Crumb Trail (D) — minimal UI, foundation for spending in other mechanics. Can ship in 1 cycle.
2. **Second**: Yeast Garden (A) — biggest player-facing addition. 2-3 cycles for grid + species + pollination.
3. **Third**: Sourdough Phases (E) — modifies existing systems (phases as global rule layer). 1 cycle.
4. **Fourth**: Tinyclaw Pantheon (C) — depends on D for swap currency. 2 cycles.
5. **Fifth**: Burnt Crusts (F) — depends on bakery asset interactions (already partly there). 1 cycle.
6. **Stretch**: Yeast Market (B) — most complex, lowest player engagement bang-per-effort. Save for last.

Goal: every long-term player should always have one big mechanic they're "actively engaged" with, even if production has plateaued.
