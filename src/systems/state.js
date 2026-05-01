// Central mutable game state, defaults, and persistence.
// Other modules `import { state }` and read/write fields directly. The state
// object reference itself is never reassigned — replaceState() mutates the
// existing object in place so external imports remain live.
import { TEMPERAMENTS } from '../content/temperaments.js';
import { GARDEN_PLOT_COUNT } from '../content/species.js';

export const SAVE_KEY = 'pumpernickel-save-v2';
export const SAVE_KEY_V1 = 'pumpernickel-save-v1';

export function emptyGarden() {
  const g = [];
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) g.push({ species: null, plantedAt: 0, lastTickAt: 0 });
  return g;
}

export function defaultState() {
  return {
    count: 0, owned: {}, lifetime: 0, lastTick: Date.now(),
    achievements: {}, totalTaps: 0, longestStreak: 0,
    buffsConsecutive: 0, startedAt: Date.now(), hasEgg: false,
    activeEffects: [], criticalTaps: 0, goldensClicked: 0,
    crowns: 0, ascensions: 0, lifetimeBaked: 0, crownShop: {},
    crumbs: 0, lastCrumbAt: Date.now(),
    phaseIndex: 0, phaseStartAt: Date.now(),
    garden: emptyGarden(), barleyBonus: 0,
    burntCrusts: [],
    pantheon: [null, null, null],
    market: { holdings: {}, prices: {}, lastUpdateAt: 0 },
    saveVersion: 3,
  };
}

export const state = defaultState();

// Replace state contents in-place so external `import { state }` references
// stay valid. Used by ascend reset and the manual reset button.
export function replaceState(newState) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, newState);
}

export function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

// Defensive load — coerces every field to a sane shape so a tampered or
// older save won't crash later lookups. Returns true if a save was found.
export function load() {
  let raw = localStorage.getItem(SAVE_KEY);
  let isV1 = false;
  if (!raw) { raw = localStorage.getItem(SAVE_KEY_V1); isV1 = !!raw; }
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    state.count = typeof s.count === 'number' ? s.count : 0;
    state.lifetime = typeof s.lifetime === 'number' ? s.lifetime : 0;
    state.owned = (s.owned && typeof s.owned === 'object') ? s.owned : {};
    state.achievements = (s.achievements && typeof s.achievements === 'object') ? s.achievements : {};
    state.totalTaps = typeof s.totalTaps === 'number' ? s.totalTaps : 0;
    state.longestStreak = typeof s.longestStreak === 'number' ? s.longestStreak : 0;
    state.buffsConsecutive = typeof s.buffsConsecutive === 'number' ? s.buffsConsecutive : 0;
    state.startedAt = typeof s.startedAt === 'number' ? s.startedAt : Date.now();
    state.hasEgg = !!s.hasEgg;
    state.activeEffects = Array.isArray(s.activeEffects) ? s.activeEffects : [];
    state.criticalTaps = typeof s.criticalTaps === 'number' ? s.criticalTaps : 0;
    state.goldensClicked = typeof s.goldensClicked === 'number' ? s.goldensClicked : 0;
    state.crowns = typeof s.crowns === 'number' ? s.crowns : 0;
    state.ascensions = typeof s.ascensions === 'number' ? s.ascensions : 0;
    state.lifetimeBaked = typeof s.lifetimeBaked === 'number' ? s.lifetimeBaked : 0;
    state.crownShop = (s.crownShop && typeof s.crownShop === 'object') ? s.crownShop : {};
    state.crumbs = typeof s.crumbs === 'number' ? s.crumbs : 0;
    state.lastCrumbAt = typeof s.lastCrumbAt === 'number' ? s.lastCrumbAt : Date.now();
    state.phaseIndex = typeof s.phaseIndex === 'number' ? s.phaseIndex : 0;
    state.phaseStartAt = typeof s.phaseStartAt === 'number' ? s.phaseStartAt : Date.now();
    state.lastTick = typeof s.lastTick === 'number' ? s.lastTick : Date.now();
    if (Array.isArray(s.garden) && s.garden.length === GARDEN_PLOT_COUNT) {
      state.garden = s.garden.map(p => ({
        species: (p && typeof p.species === 'string') ? p.species : null,
        plantedAt: (p && typeof p.plantedAt === 'number') ? p.plantedAt : 0,
        lastTickAt: (p && typeof p.lastTickAt === 'number') ? p.lastTickAt : 0,
      }));
    } else {
      state.garden = emptyGarden();
    }
    state.barleyBonus = typeof s.barleyBonus === 'number' ? s.barleyBonus : 0;
    state.burntCrusts = Array.isArray(s.burntCrusts) ? s.burntCrusts.filter(c =>
      c && typeof c.bakerId === 'string' && typeof c.attachedAt === 'number' && typeof c.drained === 'number'
    ) : [];
    state.pantheon = (Array.isArray(s.pantheon) && s.pantheon.length === 3)
      ? s.pantheon.map(t => (typeof t === 'string' && TEMPERAMENTS.some(x => x.id === t)) ? t : null)
      : [null, null, null];
    state.market = (s.market && typeof s.market === 'object') ? {
      holdings: (s.market.holdings && typeof s.market.holdings === 'object') ? s.market.holdings : {},
      prices: (s.market.prices && typeof s.market.prices === 'object') ? s.market.prices : {},
      lastUpdateAt: typeof s.market.lastUpdateAt === 'number' ? s.market.lastUpdateAt : 0,
    } : { holdings: {}, prices: {}, lastUpdateAt: 0 };
    state.saveVersion = 3;
    if (isV1) { localStorage.removeItem(SAVE_KEY_V1); save(); }
  } catch {}
  state.lastTick = Date.now();
  return true;
}

// passiveRate cache — invalidated on buy/sell/crust mutation. The cache itself
// lives in rate.js; this is just the dirty flag for cross-module coordination.
let _passiveRateDirty = true;
export function invalidatePassiveRate() { _passiveRateDirty = true; }
export function isPassiveRateDirty() { return _passiveRateDirty; }
export function clearPassiveRateDirty() { _passiveRateDirty = false; }
