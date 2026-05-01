// Production rate calculations. passiveRate is memoized per-mutation —
// invalidate via invalidatePassiveRate() in state.js whenever buy/sell/crust
// changes.
import { TREATS } from '../content/treats.js';
import { TEMPERAMENTS, PANTHEON_SLOT_WEIGHTS } from '../content/temperaments.js';
import { GARDEN_BARLEY_CAP, SPECIES } from '../content/species.js';
import { state, isPassiveRateDirty, clearPassiveRateDirty } from './state.js';
import { phaseRateMult, phaseTreatDiscount } from './phases.js';

// Tunables — game-balance knobs that live with rate logic.
export const ACH_BONUS_PER_UNLOCK = 0.01;
export const CROWN_BONUS_PER = 0.05;
export const CROWN_BONUS_LEDGER = 0.06;
export const EVENT_PACE_PACING = 0.66;
export const BURNT_CRUST_DRAIN_PCT = 0.05;

// Synergy stack for a baker — product of all owned synergy treats targeting it.
export function synergyMultFor(bakerId) {
  let mult = 1;
  for (const s of TREATS) {
    if (s.synergyTarget === bakerId && (state.owned[s.id] || 0) > 0) mult *= s.synergyMult;
  }
  return mult;
}

let _passiveRateCache = 0;
export function passiveRate() {
  if (!isPassiveRateDirty()) return _passiveRateCache;
  let total = 0;
  for (const t of TREATS) {
    if (!t.rate) continue;
    let contribution = t.rate * (state.owned[t.id] || 0) * synergyMultFor(t.id);
    const crustsHere = state.burntCrusts.filter(c => c.bakerId === t.id).length;
    if (crustsHere > 0) contribution *= Math.pow(1 - BURNT_CRUST_DRAIN_PCT, crustsHere);
    total += contribution;
  }
  _passiveRateCache = total;
  clearPassiveRateDirty();
  return total;
}

export function effectMultiplier() {
  const now = Date.now();
  let m = 1;
  for (const e of state.activeEffects) if (now < e.expiresAt) m *= e.mult;
  return m;
}

export function hasCrown(id) { return !!(state.crownShop && state.crownShop[id]); }

export function achievementBonus() {
  return Object.keys(state.achievements || {}).length * ACH_BONUS_PER_UNLOCK * (1 + pantheonMod('achBonus'));
}

export function crownBonus() {
  return (state.crowns || 0) * (hasCrown('royalLedger') ? CROWN_BONUS_LEDGER : CROWN_BONUS_PER);
}

export function gardenBonus() {
  return Math.min(state.barleyBonus || 0, GARDEN_BARLEY_CAP);
}

export function hasGardenChaosBoost() {
  const now = Date.now();
  return (state.activeEffects || []).some(e => e.id === 'g_hops' && now < e.expiresAt);
}

export function eventPaceFactor() {
  let f = hasCrown('pacing') ? EVENT_PACE_PACING : 1;
  if (hasGardenChaosBoost()) f *= (1 / SPECIES.find(s => s.id === 'hops').chaosPaceMult);
  return f;
}

// Pantheon modifier — sums slotted temperament effects weighted by slot.
// Returns a fraction (e.g. 0.30 for +30%); apply as `× (1 + pantheonMod(stat))`.
export function pantheonMod(stat) {
  let mod = 0;
  if (!state.pantheon) return 0;
  for (let i = 0; i < 3; i++) {
    const tid = state.pantheon[i];
    if (!tid) continue;
    const t = TEMPERAMENTS.find(x => x.id === tid);
    if (!t || t.mods[stat] === undefined) continue;
    mod += t.mods[stat] * PANTHEON_SLOT_WEIGHTS[i];
  }
  return mod;
}

export function hasActiveBuff() {
  // Any live effect counts (buff or debuff). Used by Dreamer's rateNoBuff
  // penalty so it doesn't double-stack on top of an active debuff.
  const now = Date.now();
  return (state.activeEffects || []).some(e => now < e.expiresAt && e.mult !== 1);
}

export function globalMult() {
  const baseMult = (1 + achievementBonus() + crownBonus() + gardenBonus()) * effectMultiplier() * phaseRateMult();
  let pantheonRate = pantheonMod('rate');
  if (!hasActiveBuff()) pantheonRate += pantheonMod('rateNoBuff');
  return baseMult * (1 + pantheonRate);
}

export function rate() { return passiveRate() * globalMult(); }

export function priceOf(t) {
  return Math.ceil(t.cost * Math.pow(t.costGrowth, state.owned[t.id] || 0) * phaseTreatDiscount());
}
export function lastPriceOf(t) {
  const owned = state.owned[t.id] || 0;
  if (owned <= 0) return 0;
  return Math.ceil(t.cost * Math.pow(t.costGrowth, owned - 1) * phaseTreatDiscount());
}
