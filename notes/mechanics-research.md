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
