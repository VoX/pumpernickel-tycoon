// Pumpernickel Tycoon — main entry. Imports content modules and provides
// game logic + UI render in a single script (Phase 1 module split — content
// extracted to src/content/, system + ui split coming in 1c/1d).
import { TREATS } from './content/treats.js';
import { EVENTS } from './content/events.js';
import { ACHIEVEMENTS } from './content/achievements.js';
import { GOLDEN_BUFFS } from './content/golden-buffs.js';
import { MARKET_THRESHOLD, MARKET_PRICE_UPDATE_MS, MARKET_HOLDING_CAP, COMMODITIES } from './content/commodities.js';
import { PANTHEON_SLOT_WEIGHTS, PANTHEON_SLOT_NAMES, PANTHEON_SWAP_COST, TEMPERAMENTS } from './content/temperaments.js';
import { PHASES } from './content/phases.js';
import { GARDEN_PLOT_COUNT, GARDEN_GRID_SIZE, GARDEN_BARLEY_BONUS, GARDEN_BARLEY_CAP, GARDEN_POLLINATE_CHANCE, GARDEN_WATER_COST, SPECIES } from './content/species.js';
import { CROWN_SHOP_ITEMS } from './content/crown-shop.js';

import { SFX, setMuted, isMuted } from './systems/audio.js';
import { initPumpPhysics, bouncePump, fireAura, pumpClickImpulse } from './systems/physics.js';

// Tunables that stay in main for now — phase 1c moves them to systems/.
const SAVE_KEY = 'pumpernickel-save-v2';
const SAVE_KEY_V1 = 'pumpernickel-save-v1';
const COMBO_RESET_MS = 800;
const COMBO_THRESHOLDS = [10, 25, 50];   // [combo-1, combo-2, combo-3] streak entry
const COMBO_MULTIPLIERS = [1, 2, 3, 5];  // 1 → tier1=2 → tier2=3 → tier3=5 (deliberate skip of 4 for dramatic top tier)
const EVENT_MIN_MS = 30000;
const EVENT_MAX_MS = 90000;
const FIRST_EVENT_DELAY = 60000;
const TOAST_MS = 1800;
const BANNER_MS = 4500;
const BANNER_GAP_MS = 350;
const WINK_MIN_MS = 8000;
const WINK_MAX_MS = 15000;
const WINK_DURATION_MS = 400;
const HAPTIC_MS = 8;
const HAPTIC_CRIT_MS = 18;
const OFFLINE_CAP_SEC = 8 * 3600;
const SAVE_INTERVAL_MS = 5000;
const TICK_MS = 1000;
const CRUMB_GLYPHS = ['·', '•', '◦', '∙'];
const CRUMB_COUNTS = [4, 2, 1, 1];     // index = comboTierIndex (0..3)
const CRUMB_DIST_MIN = 40;
const CRUMB_DIST_RANGE = 40;
const CRUMB_DURATION_MIN = 600;
const CRUMB_DURATION_RANGE = 200;
const CRUMB_LIFETIME_MS = 850;
const CRIT_CHANCE = 0.05;          // 5% per tap
const CRIT_MULT = 10;              // ×10 on crit
const CRIT_CRUMB_BONUS = 6;        // extra crumbs on crit
const ACH_BONUS_PER_UNLOCK = 0.01; // +1% rate per achievement
const TAP_RATE_FACTOR = 0.005;     // base click value scales with 5ms of current rate
const GOLDEN_MIN_MS = 60000;
const GOLDEN_MAX_MS = 180000;
const GOLDEN_LIFETIME_MS = 9000;
const GOLDEN_BONUS_SECONDS = 180;        // 3 minutes of rate per golden
const GOLDEN_BONUS_FALLBACK = 100;       // floor for early game when rate=0
const GOLDEN_BUFF_DURATION_MIN = 12000;  // random buff also fires on tap
const GOLDEN_BUFF_DURATION_MAX = 30000;
const CRUMB_RIPEN_MS = 60 * 60 * 1000;  // ripe crumb every 1 hour real-time
const PHASE_DURATION_MS = 30 * 60 * 1000; // each sourdough phase lasts ~30 min of play
const BURNT_CRUST_THRESHOLD = 1e9;        // unlocks at 1B lifetime
const BURNT_CRUST_MIN_MS = 5 * 60 * 1000; // 5min between attempts
const BURNT_CRUST_MAX_MS = 15 * 60 * 1000;
const BURNT_CRUST_DRAIN_PCT = 0.05;       // 5% of baker rate while attached
const BURNT_CRUST_PAYOUT_MULT = 1.10;     // pop pays 110% of drained
const BURNT_CRUST_MAX = 3;                // cap active crusts
const ASCEND_THRESHOLD = 1e9;       // 1B lifetime to unlock first ascension
const CROWN_DIVISOR = 1e9;          // crowns earned = floor(sqrt(lifetime / divisor))
const CROWN_BONUS_PER = 0.05;       // each crown adds +5% to global rate
const CROWN_BONUS_LEDGER = 0.06;    // upgraded rate when Royal Ledger owned
const EVENT_PACE_PACING = 0.66;     // event interval scale when Cosmic Pacing owned
const AUTO_BUY_INTERVAL_TICKS = 5;


function defaultState() {
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
function emptyGarden() {
  const g = [];
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) g.push({ species: null, plantedAt: 0, lastTickAt: 0 });
  return g;
}

let state = defaultState();
let streakCount = 0;
let lastTapTime = 0;
let streakResetTimer = null;
let lastRenderedCount = -1;
let lastRenderedRate = -1;
let lastStreakTier = -1;

function load() {
  let raw = localStorage.getItem(SAVE_KEY);
  let isV1 = false;
  if (!raw) { raw = localStorage.getItem(SAVE_KEY_V1); isV1 = !!raw; }
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    // Defensive type validation — tampered or truncated saves shouldn't crash later lookups.
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
    // Yeast Garden — array of 9 plot objects. Replace whole-cloth on length mismatch
    // (e.g. a future save with a different grid size) so plot count stays sane.
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
    const offlineCap = OFFLINE_CAP_SEC * (1 + pantheonMod('offline'));
    const dt = Math.min((Date.now() - state.lastTick) / 1000, offlineCap);
    const offlineGain = Math.floor(dt * rate());
    if (offlineGain > 0) { state.count += offlineGain; state.lifetime += offlineGain; toast(`+${fmt(offlineGain)} while you were gone`); }
  } catch {}
  state.lastTick = Date.now();
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }

function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 1e6) return (n/1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
  if (n < 1e9) return (n/1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n/1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
}
// Synergy stack for a baker — product of all owned synergy treats targeting it.
// Hot path; called from passiveRate, bestRateBuy, and the burnt-crust tick.
function synergyMultFor(bakerId) {
  let mult = 1;
  for (const s of TREATS) {
    if (s.synergyTarget === bakerId && (state.owned[s.id] || 0) > 0) mult *= s.synergyMult;
  }
  return mult;
}
// passiveRate cache invalidated on buy/sell/crust mutation. Cuts the O(N²)
// scan on hot paths (rate, tapAmount, fireEvent, spawnGolden, etc).
let _passiveRateCache = null;
function invalidatePassiveRate() { _passiveRateCache = null; }
function passiveRate() {
  if (_passiveRateCache !== null) return _passiveRateCache;
  let total = 0;
  for (const t of TREATS) {
    if (!t.rate) continue;
    let contribution = t.rate * (state.owned[t.id] || 0) * synergyMultFor(t.id);
    const crustsHere = state.burntCrusts.filter(c => c.bakerId === t.id).length;
    if (crustsHere > 0) contribution *= Math.pow(1 - BURNT_CRUST_DRAIN_PCT, crustsHere);
    total += contribution;
  }
  return _passiveRateCache = total;
}
function effectMultiplier() {
  const now = Date.now();
  let m = 1;
  for (const e of state.activeEffects) if (now < e.expiresAt) m *= e.mult;
  return m;
}
function currentPhase() {
  return PHASES[(state.phaseIndex || 0) % PHASES.length];
}
function phaseRateMult() { return currentPhase().rateMult || 1; }
function phaseTapMult() { return currentPhase().tapMult || 1; }
function phaseComboMult() { return currentPhase().comboMult || 1; }
function phaseTreatDiscount() { return currentPhase().treatDiscount || 1; }
function achievementBonus() {
  return Object.keys(state.achievements || {}).length * ACH_BONUS_PER_UNLOCK * (1 + pantheonMod('achBonus'));
}
function hasCrown(id) { return !!(state.crownShop && state.crownShop[id]); }
function crownBonus() {
  return (state.crowns || 0) * (hasCrown('royalLedger') ? CROWN_BONUS_LEDGER : CROWN_BONUS_PER);
}
function eventPaceFactor() {
  let f = hasCrown('pacing') ? EVENT_PACE_PACING : 1;
  if (hasGardenChaosBoost()) f *= (1 / SPECIES.find(s => s.id === 'hops').chaosPaceMult);
  return f;
}
function gardenBonus() {
  return Math.min(state.barleyBonus || 0, GARDEN_BARLEY_CAP);
}
function hasGardenChaosBoost() {
  // True while a 'g_hops' active effect is live (set on hops harvest).
  const now = Date.now();
  return (state.activeEffects || []).some(e => e.id === 'g_hops' && now < e.expiresAt);
}
// Pantheon modifier — sums slotted temperament effects weighted by slot.
// Returns a fraction (e.g. 0.30 for +30%); apply as `× (1 + pantheonMod(stat))`.
function pantheonMod(stat) {
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
function hasActiveBuff() {
  // Any live effect counts (buff or debuff). Used by Dreamer's rateNoBuff
  // penalty so it doesn't double-stack on top of an active debuff.
  const now = Date.now();
  return (state.activeEffects || []).some(e => now < e.expiresAt && e.mult !== 1);
}
function globalMult() {
  const baseMult = (1 + achievementBonus() + crownBonus() + gardenBonus()) * effectMultiplier() * phaseRateMult();
  // Pantheon: rate stat, plus the no-buff penalty if dreamer is slotted and no buff is up.
  let pantheonRate = pantheonMod('rate');
  if (!hasActiveBuff()) pantheonRate += pantheonMod('rateNoBuff');
  return baseMult * (1 + pantheonRate);
}
function rate() { return passiveRate() * globalMult(); }
function comboTier() {
  // Walk thresholds high→low, return matching multiplier index.
  for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
    if (streakCount >= COMBO_THRESHOLDS[i]) return COMBO_MULTIPLIERS[i + 1];
  }
  return COMBO_MULTIPLIERS[0];
}
function comboTierIndex() {
  for (let i = COMBO_THRESHOLDS.length - 1; i >= 0; i--) {
    if (streakCount >= COMBO_THRESHOLDS[i]) return i + 1;
  }
  return 0;
}
function tapAmount() {
  const bonus = TREATS.filter(t => t.tapBonus).reduce((s, t) => s + (t.tapBonus * (state.owned[t.id] || 0)), 0);
  const fromRate = passiveRate() * TAP_RATE_FACTOR;
  const combo = comboTier() * phaseComboMult() * (1 + pantheonMod('combo'));
  return (1 + bonus + fromRate) * combo * globalMult() * phaseTapMult() * (1 + pantheonMod('tap'));
}
function priceOf(t) { return Math.ceil(t.cost * Math.pow(t.costGrowth, state.owned[t.id] || 0) * phaseTreatDiscount()); }
function lastPriceOf(t) {
  const owned = state.owned[t.id] || 0;
  if (owned <= 0) return 0;
  return Math.ceil(t.cost * Math.pow(t.costGrowth, owned - 1) * phaseTreatDiscount());
}
function sellOne(t) {
  const owned = state.owned[t.id] || 0;
  if (owned <= 0) return;
  const refund = Math.floor(lastPriceOf(t) * 0.5);
  state.owned[t.id] = owned - 1;
  invalidatePassiveRate();
  state.count += refund;
  // Lifetime isn't bumped — refunds recover past spend, not new earning.
  toast(`sold 1 ${t.name} · +${fmt(refund)}`);
  save(); renderCount(); refreshTreats(); refreshBakery();
}
// Toast queue — multiple acks within ~1s queue instead of clobbering. A flood
// (eg. ascend with many achievements firing) caps at 4 pending so we don't
// loop forever showing back-to-back toasts.
let toastQueue = [];
let toastShowing = false;
function drainToast() {
  if (!toastQueue.length) { toastShowing = false; return; }
  toastShowing = true;
  const msg = toastQueue.shift();
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(drainToast, 200); }, TOAST_MS);
}
function toast(msg) {
  if (toastQueue.length >= 4) toastQueue.shift();
  toastQueue.push(msg);
  if (!toastShowing) drainToast();
}
function setPumpEmoji() {
  pumpEl.textContent = state.owned.crowncake ? '👑' : '🍞';
}

const countEl = document.getElementById('count');
const rateEl = document.getElementById('rate');
const streakEl = document.getElementById('streak');
const effectsEl = document.getElementById('effects');
const phaseEl = document.getElementById('phase');
const pumpEl = document.getElementById('pump');
const pumpInnerEl_ = document.getElementById('pump-inner');
const auraEl_ = document.getElementById('pump-aura');
initPumpPhysics({ pump: pumpEl, inner: pumpInnerEl_, aura: auraEl_ });
const treatsEl = document.getElementById('treats');
const companionEl = document.getElementById('companion');
const bannerEl = document.getElementById('event-banner');
const menuBtnEl = document.getElementById('menu-btn');
const menuModalEl = document.getElementById('menu-modal');
const menuInfoEl = document.getElementById('menu-info');
const achListEl = document.getElementById('ach-list');
const achSubEl = document.getElementById('ach-sub');
const statsEl = document.getElementById('stats');

const treatRowsById = {}; // built once by buildTreatRows()
const bakeryEl = document.getElementById('bakery');
const goldenEl = document.getElementById('golden');
const ascendDetailEl = document.getElementById('ascend-detail');
const shopSubEl = document.getElementById('shop-sub');
const shopListEl = document.getElementById('shop-list');
const bakeryAssetsById = {}; // built lazily by refreshBakery()

// Per-baker contribution (rate × owned × stacked synergy mults).
function bakerContribution(t) {
  const owned = state.owned[t.id] || 0;
  if (!t.rate || owned <= 0) return { contribution: 0, synergy: 1 };
  const synergy = synergyMultFor(t.id);
  return { contribution: t.rate * owned * synergy, synergy };
}
function bakerInfo(t) {
  const owned = state.owned[t.id] || 0;
  const { contribution, synergy } = bakerContribution(t);
  const synergyTxt = synergy > 1 ? ` ×${synergy} synergy` : '';
  return `${t.name} ×${owned} → +${fmt(contribution)}/s${synergyTxt}`;
}
function refreshBakery() {
  for (const t of TREATS) {
    if (!t.rate && !t.tapBonus && !t.hatch && t.id !== 'crowncake') continue;
    const owned = state.owned[t.id] || 0;
    const live = !!t.rate || (t.id === 'crowncake' && owned > 0) || (t.hatch && owned > 0);
    let row = bakeryAssetsById[t.id];
    if (owned <= 0) {
      if (row) { row.el.remove(); delete bakeryAssetsById[t.id]; }
      continue;
    }
    if (!row) {
      const el = document.createElement('span');
      el.className = 'asset popin' + (live ? ' live' : '');
      el.dataset.id = t.id;
      if (t.bobMs) el.style.setProperty('--bob', t.bobMs + 'ms');
      el.innerHTML = `<span class="asset-icon">${t.icon}</span><span class="asset-count">×${owned}</span>`;
      // Tap = rate info; long-press (500ms) = confirm sell-back at 50% refund.
      let pressTimer = null, longFired = false;
      el.addEventListener('pointerdown', () => {
        longFired = false;
        pressTimer = setTimeout(() => {
          longFired = true;
          const refund = Math.floor(lastPriceOf(t) * 0.5);
          if (confirm(`Sell 1 ${t.name} for ${fmt(refund)} pumpernickels?`)) sellOne(t);
        }, 500);
      });
      const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
      el.addEventListener('pointerup', () => { cancelPress(); if (!longFired) toast(bakerInfo(t)); });
      el.addEventListener('pointercancel', cancelPress);
      el.addEventListener('pointerleave', cancelPress);
      bakeryEl.appendChild(el);
      setTimeout(() => el.classList.remove('popin'), 400);
      row = bakeryAssetsById[t.id] = { el, countEl: el.querySelector('.asset-count'), owned };
    }
    if (row.owned !== owned) {
      row.countEl.textContent = `×${owned}`;
      row.owned = owned;
      row.el.classList.add('bumped');
      setTimeout(() => row.el.classList.remove('bumped'), 220);
    }
    // Burnt crusts attached to this baker — show one popup-able icon per crust.
    const existingCrusts = row.el.querySelectorAll('.burnt-crust');
    existingCrusts.forEach(n => n.remove());
    const crustsHere = (state.burntCrusts || []).map((c, i) => ({ c, i })).filter(x => x.c.bakerId === t.id);
    crustsHere.forEach(({ c, i }, k) => {
      const crustEl = document.createElement('span');
      crustEl.className = 'burnt-crust';
      crustEl.textContent = '🥵';
      crustEl.title = `burnt crust — drained ${fmt(c.drained)} so far. tap to pop for ${fmt(c.drained * BURNT_CRUST_PAYOUT_MULT)}.`;
      crustEl.style.right = (-6 - k * 14) + 'px';
      crustEl.addEventListener('click', (e) => { e.stopPropagation(); popBurntCrust(state.burntCrusts.indexOf(c)); });
      row.el.appendChild(crustEl);
    });
    // Always refresh hover tooltip — rate may change due to synergy purchases.
    row.el.title = bakerInfo(t);
  }
}

function buildTreatRows() {
  treatsEl.innerHTML = '';
  for (const t of TREATS) {
    const div = document.createElement('div');
    div.className = 'treat locked';
    div.dataset.id = t.id;
    div.innerHTML = `
      <div class="icon">${t.icon}</div>
      <div class="info"><div class="name">${t.name}</div><div class="desc">${t.desc}</div></div>
      <div class="meta"><div class="price"></div><div class="owned"></div></div>`;
    div.addEventListener('click', () => buy(t));
    treatsEl.appendChild(div);
    treatRowsById[t.id] = {
      el: div,
      priceEl: div.querySelector('.price'),
      ownedEl: div.querySelector('.owned'),
    };
  }
  refreshTreats();
}
function meetsRequirement(t) {
  if (!t.requiresOwned) return true;
  for (const id in t.requiresOwned) {
    if ((state.owned[id] || 0) < t.requiresOwned[id]) return false;
  }
  return true;
}
function refreshTreats() {
  for (const t of TREATS) {
    const row = treatRowsById[t.id];
    if (!row) continue;
    const owned = state.owned[t.id] || 0;
    if (t.max && owned >= t.max) { row.el.className = 'treat maxed'; continue; }
    if (!meetsRequirement(t)) { row.el.className = 'treat maxed'; continue; }
    const price = priceOf(t);
    row.el.className = 'treat ' + (state.count >= price ? 'affordable' : 'locked');
    row.priceEl.textContent = fmt(price);
    row.ownedEl.textContent = owned ? `×${owned}` : '';
  }
}
function renderCount() {
  // Only update DOM if count actually moved — saves the bump-pulse-every-tick problem.
  const c = Math.floor(state.count);
  if (c !== lastRenderedCount) {
    countEl.textContent = fmt(c);
    countEl.classList.add('bump');
    setTimeout(() => countEl.classList.remove('bump'), 120);
    lastRenderedCount = c;
  }
  const r = rate();
  if (r !== lastRenderedRate) {
    rateEl.textContent = r > 0 ? `+${fmt(r)} / sec` : '';
    lastRenderedRate = r;
  }
  companionEl.classList.toggle('show', !!state.hasEgg);
}
function renderStreak() {
  // Only the tap path + streak-reset path call this — not the per-second tick.
  const tier = comboTierIndex();
  if (tier === lastStreakTier && streakCount < 5) return;
  if (streakCount >= 5) {
    streakEl.textContent = tier > 0 ? `🔥 ×${comboTier()} (streak ${streakCount})` : `streak ${streakCount}`;
    streakEl.classList.add('show');
  } else {
    streakEl.classList.remove('show');
  }
  pumpEl.classList.toggle('combo-1', tier === 1);
  pumpEl.classList.toggle('combo-2', tier === 2);
  pumpEl.classList.toggle('combo-3', tier === 3);
  lastStreakTier = tier;
}
function renderPhase() {
  const ph = currentPhase();
  const remaining = Math.max(0, PHASE_DURATION_MS - (Date.now() - state.phaseStartAt));
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
  phaseEl.title = ph.desc;
  phaseEl.innerHTML = `<span class="phase-icon">${ph.icon}</span><span class="phase-name">${ph.name}</span><span class="phase-time">${minutes}:${seconds}</span>`;
}
function renderEffects() {
  // Show one pill per active effect with mult and remaining seconds.
  const now = Date.now();
  const live = (state.activeEffects || []).filter(e => now < e.expiresAt);
  if (live.length === 0) { effectsEl.textContent = ''; return; }
  effectsEl.innerHTML = live.map(e => {
    const remaining = Math.ceil((e.expiresAt - now) / 1000);
    const kind = e.mult >= 1 ? 'buff' : 'debuff';
    const sign = e.mult >= 1 ? `×${e.mult}` : `×${e.mult.toFixed(2)}`;
    return `<span class="effect-pill ${kind}">${sign} · ${remaining}s</span>`;
  }).join('');
}
function renderAchPanel() {
  achListEl.innerHTML = '';
  let earned = 0;
  for (const a of ACHIEVEMENTS) {
    const got = !!state.achievements[a.id];
    if (got) earned++;
    const hideMe = a.hidden && !got;
    const row = document.createElement('div');
    row.className = 'ach-row ' + (got ? 'earned' : 'locked');
    row.innerHTML = `
      <div class="icon">${hideMe ? '❓' : a.icon}</div>
      <div class="info">
        <div class="name">${hideMe ? '???' : a.name}</div>
        <div class="desc">${hideMe ? '???' : a.desc}</div>
      </div>`;
    achListEl.appendChild(row);
  }
  const bonus = (earned * ACH_BONUS_PER_UNLOCK * 100).toFixed(0);
  achSubEl.textContent = `${earned} of ${ACHIEVEMENTS.length} · +${bonus}% rate`;
  renderStats();
  refreshMenu();
}
function renderStats() {
  const taps = state.totalTaps || 0;
  const crits = state.criticalTaps || 0;
  const critPct = taps > 0 ? ((crits / taps) * 100).toFixed(1) : '0';
  const totalLifetime = (state.lifetimeBaked || 0) + state.lifetime;
  const stats = [
    ['total taps', fmt(taps)],
    ['critical hits', `${fmt(crits)} (${critPct}%)`],
    ['goldens tapped', fmt(state.goldensClicked || 0)],
    ['ascensions', String(state.ascensions || 0)],
    ['ripe crumbs 🍞', String(state.crumbs || 0)],
    ['longest streak', String(state.longestStreak || 0)],
    ['lifetime baked', fmt(totalLifetime)],
  ];
  statsEl.innerHTML = stats.map(([k, v]) => `<div class="stat"><span class="stat-k">${k}</span><span class="stat-v">${v}</span></div>`).join('');
}
function buy(t) {
  const price = priceOf(t);
  if (state.count < price) return;
  state.count -= price;
  state.owned[t.id] = (state.owned[t.id] || 0) + 1;
  invalidatePassiveRate();
  if (t.doubleBank) {
    // Final bank = 2× pre-purchase bank. state.count just had `price` subtracted,
    // so add (pre + price) to land at 2*pre.
    const pre = state.count + price;
    const delta = pre + price;
    state.count += delta;
    state.lifetime += delta;
    toast(`✨ bank doubled. +${fmt(delta)}`);
  }
  if (t.hatch) { state.hasEgg = true; toast('🐣 a small dragon hatched.'); }
  if (t.id === 'crowncake') { toast('👑 the kingdom kneels.'); setPumpEmoji(); }
  SFX.buy();
  // Flash the treat row briefly to acknowledge the purchase.
  const row = treatRowsById[t.id];
  if (row && row.el) {
    row.el.classList.remove('buy-flash'); void row.el.offsetWidth; row.el.classList.add('buy-flash');
    setTimeout(() => row.el.classList.remove('buy-flash'), 400);
  }
  save(); renderCount(); refreshTreats(); refreshBakery(); checkAchievements();
}
// Pick the rate-upgrade with the best rate-gain per pumpernickel spent.
// Mirrors bestRateBuy() in balance/simulate.js so auto-buy and manual play
// converge on the same purchase order.
function bestRateBuy() {
  let best = null, bestEff = 0;
  for (const t of TREATS) {
    if (t.max && (state.owned[t.id] || 0) >= t.max) continue;
    if (!meetsRequirement(t)) continue;
    let effRate = 0;
    if (t.rate) effRate = t.rate;
    if (t.synergyTarget) {
      const targ = TREATS.find(x => x.id === t.synergyTarget);
      const owned = state.owned[t.synergyTarget] || 0;
      if (targ && owned > 0) {
        // Stack on top of synergies the player already owns on this baker.
        const existingSynergy = synergyMultFor(t.synergyTarget) / (state.owned[t.id] > 0 ? t.synergyMult : 1);
        effRate = (targ.rate * owned * existingSynergy) * (t.synergyMult - 1);
      }
    }
    if (effRate <= 0) continue;
    const eff = effRate / priceOf(t);
    if (eff > bestEff) { bestEff = eff; best = t; }
  }
  return best;
}

function checkAchievements() {
  let any = false;
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    if (a.check(state)) {
      state.achievements[a.id] = Date.now();
      toast(`🏆 ${a.name}`);
      any = true;
    }
  }
  if (any) {
    save(); renderAchPanel();
    menuBtnEl.classList.remove('popped'); void menuBtnEl.offsetWidth; menuBtnEl.classList.add('popped');
    SFX.ach();
  }
}

// Chaos events
let bannerQueue = [];
let bannerShowing = false;
function showBanner(text, kind) {
  // Cap queue so background-tab pile-ups don't ambush the player on focus.
  if (bannerQueue.length >= 5) bannerQueue.shift();
  bannerQueue.push({ text, kind });
  if (!bannerShowing) drainBanner();
}
function drainBanner() {
  if (!bannerQueue.length) { bannerShowing = false; return; }
  bannerShowing = true;
  const { text, kind } = bannerQueue.shift();
  bannerEl.className = 'event-banner kind-' + kind;
  bannerEl.textContent = text;
  requestAnimationFrame(() => bannerEl.classList.add('show'));
  setTimeout(() => {
    bannerEl.classList.remove('show');
    setTimeout(drainBanner, BANNER_GAP_MS);
  }, BANNER_MS);
}
function fireEvent() {
  if (passiveRate() === 0) return;
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  const isDebuff = ev.kind === 'debuff' || (ev.kind === 'instant_pct' && ev.factor < 0);
  // Bake phase blocks all debuffs.
  if (isDebuff && currentPhase().blockDebuffs) {
    showBanner(`🔥 bake phase shielded: ${ev.copy.split('.')[0]}`, 'buff');
    return;
  }
  // Yeast Insurance consumes one to block this debuff entirely.
  if (isDebuff && (state.owned.insurance || 0) > 0) {
    state.owned.insurance -= 1;
    showBanner(`☂️ insurance blocked: ${ev.copy.split('.')[0]}`, 'buff');
    save(); refreshTreats(); renderEffects();
    return;
  }
  // Buff streak: 3+ buffs in a row makes the next buff hit twice as hard.
  const streakHot = ev.kind === 'buff' && state.buffsConsecutive >= 3;
  if (ev.kind === 'instant') {
    // Greedy boosts positive instants (debit events stay raw).
    const amt = ev.amount > 0 ? Math.floor(ev.amount * (1 + pantheonMod('instantAmount'))) : ev.amount;
    state.count = Math.max(0, state.count + amt);
    if (amt > 0) state.lifetime += amt;
  } else if (ev.kind === 'instant_pct') {
    const delta = Math.floor(state.count * ev.factor);
    state.count = Math.max(0, state.count + delta);
  } else if (ev.kind === 'buff' || ev.kind === 'debuff') {
    let mult = streakHot ? ev.mult * 2 : ev.mult;
    // Cunning weakens buff strength (only positive buffs — debuffs unaffected).
    if (mult > 1) mult = Math.max(1, 1 + (mult - 1) * (1 + pantheonMod('buffStrength')));
    // Lazy shortens buff duration (only buffs).
    let dur = ev.duration;
    if (ev.kind === 'buff') dur = Math.max(1000, dur * (1 + pantheonMod('buffDuration')));
    state.activeEffects.push({ id: ev.id, expiresAt: Date.now() + dur, mult });
  }
  if (ev.kind === 'buff') state.buffsConsecutive++;
  else if (isDebuff) state.buffsConsecutive = 0;
  const copy = streakHot ? ev.copy + ' (streak ×2!)' : ev.copy;
  showBanner(copy, ev.kind);
  if (ev.kind === 'buff') SFX.buff();
  else if (ev.kind === 'debuff') SFX.debuff();
  save(); renderCount(); renderEffects(); checkAchievements();
}
function scheduleNextEvent() {
  const ph = currentPhase();
  const phasePace = ph.buffPace || (ph.suspendEvents ? 999 : 1);
  const wait = (EVENT_MIN_MS + Math.random() * (EVENT_MAX_MS - EVENT_MIN_MS)) * eventPaceFactor() * phasePace;
  setTimeout(() => { if (!currentPhase().suspendEvents) fireEvent(); scheduleNextEvent(); }, wait);
}

// Golden Pumpernickel — random clickable bonus.
let goldenExpiresAt = 0;
function spawnGolden() {
  if (passiveRate() === 0) { scheduleNextGolden(); return; }
  goldenEl.style.left = (Math.random() * 70 + 15) + '%';
  goldenEl.style.top = (Math.random() * 50 + 20) + '%';
  goldenEl.classList.add('active');
  if (hasCrown('goldenChime')) SFX.chime();
  goldenExpiresAt = Date.now() + GOLDEN_LIFETIME_MS;
  const myExpiry = goldenExpiresAt;
  setTimeout(() => {
    if (goldenExpiresAt === myExpiry) {
      goldenEl.classList.remove('active');
      goldenExpiresAt = 0;
      scheduleNextGolden();
    }
  }, GOLDEN_LIFETIME_MS);
}
function scheduleNextGolden() {
  // Cunning temperament makes goldens fire faster.
  const freqMod = 1 + pantheonMod('goldenFreq');
  const wait = (GOLDEN_MIN_MS + Math.random() * (GOLDEN_MAX_MS - GOLDEN_MIN_MS)) / Math.max(0.1, freqMod);
  setTimeout(spawnGolden, wait);
}
goldenEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (!goldenEl.classList.contains('active')) return;
  // Use baseline (no active-buff) rate so a golden_storm/cosmic_align
  // doesn't compound into a 10-minute jackpot per the balance review.
  const baseRate = passiveRate() * (1 + achievementBonus() + crownBonus());
  const gain = Math.max(Math.floor(baseRate * GOLDEN_BONUS_SECONDS), GOLDEN_BONUS_FALLBACK);
  state.count += gain; state.lifetime += gain;
  state.goldensClicked = (state.goldensClicked || 0) + 1;
  // Roll a random buff to fire alongside the instant grant.
  const buff = GOLDEN_BUFFS[Math.floor(Math.random() * GOLDEN_BUFFS.length)];
  const dur = GOLDEN_BUFF_DURATION_MIN + Math.random() * (GOLDEN_BUFF_DURATION_MAX - GOLDEN_BUFF_DURATION_MIN);
  state.activeEffects.push({ id: buff.id, expiresAt: Date.now() + dur, mult: buff.mult });
  state.buffsConsecutive = (state.buffsConsecutive || 0) + 1;
  SFX.golden();
  toast(`✨ +${fmt(gain)} · ${buff.copy} (${Math.round(dur/1000)}s)`);
  // Burst of crit-styled crumb particles at the click point.
  const r = goldenEl.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < 12; i++) {
    const c = document.createElement('div');
    c.className = 'crumb crit';
    c.textContent = CRUMB_GLYPHS[Math.floor(Math.random() * CRUMB_GLYPHS.length)];
    c.style.position = 'fixed';
    c.style.left = cx + 'px'; c.style.top = cy + 'px';
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 60;
    c.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
    c.style.setProperty('--cy', Math.sin(angle) * dist + 'px');
    c.style.setProperty('--cr', (Math.random() * 360 - 180) + 'deg');
    c.style.animation = `crumb-fly ${CRUMB_DURATION_MIN + Math.random() * CRUMB_DURATION_RANGE}ms forwards ease-out`;
    document.body.appendChild(c);
    setTimeout(() => c.remove(), CRUMB_LIFETIME_MS);
  }
  goldenEl.classList.remove('active');
  goldenExpiresAt = 0;
  renderCount(); refreshTreats(); save();
  scheduleNextGolden();
});

// Burnt Crusts — late-game pests that drain a baker, pop for 110% payout.
function attachBurntCrust() {
  if (!state.burntCrusts) state.burntCrusts = [];
  if (state.burntCrusts.length >= BURNT_CRUST_MAX) { scheduleNextBurntCrust(); return; }
  if (state.lifetime < BURNT_CRUST_THRESHOLD) { scheduleNextBurntCrust(); return; }
  // Pick a random owned production baker.
  const owned = TREATS.filter(t => t.rate && (state.owned[t.id] || 0) > 0);
  if (owned.length === 0) { scheduleNextBurntCrust(); return; }
  const t = owned[Math.floor(Math.random() * owned.length)];
  state.burntCrusts.push({ bakerId: t.id, attachedAt: Date.now(), drained: 0 });
  invalidatePassiveRate();
  showBanner(`🥵 a burnt crust attached to your ${t.name}. tap to pop.`, 'debuff');
  refreshBakery();
  scheduleNextBurntCrust();
}
function scheduleNextBurntCrust() {
  const wait = BURNT_CRUST_MIN_MS + Math.random() * (BURNT_CRUST_MAX_MS - BURNT_CRUST_MIN_MS);
  setTimeout(attachBurntCrust, wait);
}
function popBurntCrust(crustIdx) {
  if (!state.burntCrusts || crustIdx < 0 || crustIdx >= state.burntCrusts.length) return;
  const c = state.burntCrusts[crustIdx];
  const payout = Math.floor(c.drained * BURNT_CRUST_PAYOUT_MULT);
  state.count += payout;
  state.lifetime += Math.floor(c.drained * (BURNT_CRUST_PAYOUT_MULT - 1)); // only the 10% bonus, not the recovery
  state.burntCrusts.splice(crustIdx, 1);
  invalidatePassiveRate();
  toast(`🥵 popped! +${fmt(payout)}`);
  SFX.golden();
  save(); renderCount(); refreshBakery();
}

// Companion wink
function scheduleWink() {
  const wait = WINK_MIN_MS + Math.random() * (WINK_MAX_MS - WINK_MIN_MS);
  setTimeout(() => {
    if (state.hasEgg) {
      companionEl.textContent = '😉';
      setTimeout(() => { companionEl.textContent = '🐣'; }, WINK_DURATION_MS);
    }
    scheduleWink();
  }, wait);
}

// Tap handler
pumpEl.addEventListener('pointerdown', (e) => {
  const now = Date.now();
  const prevTier = comboTierIndex();
  // Knead phase doubles the combo decay window, letting streaks last longer.
  const decayMs = COMBO_RESET_MS * (currentPhase().streakDecayMult || 1);
  if (now - lastTapTime < decayMs) streakCount++;
  else streakCount = 1;
  lastTapTime = now;
  if (streakCount > state.longestStreak) state.longestStreak = streakCount;
  clearTimeout(streakResetTimer);
  streakResetTimer = setTimeout(() => { streakCount = 0; renderStreak(); }, decayMs);
  // Tier-up aura burst when crossing a combo threshold.
  const newTier = comboTierIndex();
  if (newTier > prevTier && newTier > 0) { fireAura(); toast(`🔥 streak ×${comboTier()}`); }
  bouncePump();
  pumpClickImpulse();

  const baseCritChance = hasCrown('ironKnuckles') ? 0.10 : CRIT_CHANCE;
  const critChance = Math.max(0, baseCritChance * (1 + pantheonMod('crit')));
  const critMult = hasCrown('luckyHands') ? 15 : CRIT_MULT;
  const crit = Math.random() < critChance;
  const gain = Math.floor(tapAmount() * (crit ? critMult : 1));
  state.count += gain; state.lifetime += gain; state.totalTaps++;
  if (crit) state.criticalTaps = (state.criticalTaps || 0) + 1;
  const rect = pumpEl.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const f = document.createElement('div');
  f.className = 'float' + (crit ? ' crit' : ''); f.textContent = (crit ? '✦+' : '+') + fmt(gain);
  f.style.left = x + 'px'; f.style.top = y + 'px';
  pumpEl.appendChild(f);
  setTimeout(() => f.remove(), 900);
  // Crumb particles — fewer at high streak; extra burst on crit.
  const crumbCount = CRUMB_COUNTS[comboTierIndex()] + (crit ? CRIT_CRUMB_BONUS : 0);
  for (let i = 0; i < crumbCount; i++) {
    const c = document.createElement('div');
    c.className = 'crumb' + (crit ? ' crit' : '');
    c.textContent = CRUMB_GLYPHS[Math.floor(Math.random() * CRUMB_GLYPHS.length)];
    c.style.left = x + 'px'; c.style.top = y + 'px';
    const angle = Math.random() * Math.PI * 2;
    const dist = CRUMB_DIST_MIN + Math.random() * CRUMB_DIST_RANGE * (crit ? 1.6 : 1);
    c.style.setProperty('--cx', Math.cos(angle) * dist + 'px');
    c.style.setProperty('--cy', Math.sin(angle) * dist + 'px');
    c.style.setProperty('--cr', (Math.random() * 360 - 180) + 'deg');
    c.style.animation = `crumb-fly ${CRUMB_DURATION_MIN + Math.random() * CRUMB_DURATION_RANGE}ms ease-out forwards`;
    pumpEl.appendChild(c);
    setTimeout(() => c.remove(), CRUMB_LIFETIME_MS);
  }
  renderCount(); renderStreak(); refreshTreats(); checkAchievements();
  if (navigator.vibrate) navigator.vibrate(crit ? HAPTIC_CRIT_MS : HAPTIC_MS);
  (crit ? SFX.crit : SFX.tap)();
});

// Single menu — tabs for ach / shop / ascend.
let activeTab = 'ach';
function switchTab(tab) {
  // Skip disabled tabs (shop unlocks at first ascension, ascend at 1B lifetime).
  const tabBtn = document.querySelector(`.menu-tab[data-tab="${tab}"]`);
  if (tabBtn && tabBtn.disabled) return;
  activeTab = tab;
  document.querySelectorAll('.menu-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.menu-pane').forEach(p => p.hidden = (p.dataset.tab !== tab));
  if (tab === 'ach') renderAchPanel();
  else if (tab === 'shop') renderShop();
  else if (tab === 'ascend') openAscendPane();
  else if (tab === 'garden') renderGarden();
  else if (tab === 'pantheon') renderPantheon();
  else if (tab === 'market') renderMarket();
}
function refreshMenu() {
  // Tab availability gates content rather than hiding tabs.
  const shopTab = document.querySelector('.menu-tab[data-tab="shop"]');
  const ascendTab = document.querySelector('.menu-tab[data-tab="ascend"]');
  const gardenTab = document.querySelector('.menu-tab[data-tab="garden"]');
  shopTab.disabled = (state.ascensions || 0) < 1 && (state.crowns || 0) === 0;
  ascendTab.disabled = state.lifetime < ASCEND_THRESHOLD && (state.crowns || 0) === 0;
  if (gardenTab) gardenTab.disabled = (state.crumbs || 0) === 0 && state.garden && state.garden.every(p => !p.species);
  const pantheonTab = document.querySelector('.menu-tab[data-tab="pantheon"]');
  if (pantheonTab) pantheonTab.disabled = (state.ascensions || 0) < 1;
  const marketTab = document.querySelector('.menu-tab[data-tab="market"]');
  if (marketTab) marketTab.disabled = (state.lifetimeBaked || 0) + state.lifetime < MARKET_THRESHOLD;
  // If active tab is now disabled, fall back to ach.
  const activeBtn = document.querySelector(`.menu-tab[data-tab="${activeTab}"]`);
  if (activeBtn && activeBtn.disabled) { activeTab = 'ach'; }
  // Compact info next to ☰ — earned/total achievements + crown count when relevant.
  const earned = Object.keys(state.achievements || {}).length;
  const crowns = state.crowns || 0;
  menuInfoEl.textContent = crowns > 0 ? `${earned}/${ACHIEVEMENTS.length} · ${crowns}👑` : `${earned}/${ACHIEVEMENTS.length}`;
  // Pulse the menu button when an ascension is earnable.
  const earnable = state.lifetime >= ASCEND_THRESHOLD ? crownsForLifetime(state.lifetime) - crowns : 0;
  menuBtnEl.classList.toggle('pulse', earnable > 0);
}
menuBtnEl.addEventListener('click', () => {
  refreshMenu();
  switchTab(activeTab);
  menuModalEl.classList.add('show');
});
document.getElementById('menu-close').addEventListener('click', () => menuModalEl.classList.remove('show'));
menuModalEl.addEventListener('click', (e) => { if (e.target === menuModalEl) menuModalEl.classList.remove('show'); });
document.querySelectorAll('.menu-tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

// Prestige — ascend the tinyclaw.
function crownsForLifetime(lifetime) {
  return Math.floor(Math.sqrt(Math.max(0, lifetime) / CROWN_DIVISOR));
}
function openAscendPane() {
  const earnable = crownsForLifetime(state.lifetime);
  const gain = Math.max(0, earnable - (state.crowns || 0));
  const have = state.crowns || 0;
  ascendDetailEl.innerHTML = `
    you have <b>${have}</b> 👑 (+${Math.round(have*CROWN_BONUS_PER*100)}% rate).<br>
    ascending now grants <b>+${gain}</b> 👑 (total +${Math.round((have+gain)*CROWN_BONUS_PER*100)}%).<br>
    <span style="opacity:0.65">resets pumpernickels, bakers, eggs, and effects. keeps achievements and crowns.</span>
  `;
  document.getElementById('ascend-confirm').disabled = gain <= 0;
}
document.getElementById('ascend-confirm').addEventListener('click', () => {
  const earnable = crownsForLifetime(state.lifetime);
  const gain = earnable - (state.crowns || 0);
  if (gain <= 0) { menuModalEl.classList.remove('show'); return; }
  // Carry forward: economy resets, but progression markers persist so unlocked
  // achievements stay coherent (no vanishing egg, no re-armed 24h timer, etc).
  const shop = state.crownShop || {};
  const carry = {
    crowns: (state.crowns || 0) + gain,
    ascensions: (state.ascensions || 0) + 1,
    lifetimeBaked: (state.lifetimeBaked || 0) + state.lifetime,
    achievements: state.achievements || {},
    crownShop: shop,
    totalTaps: state.totalTaps || 0,
    longestStreak: state.longestStreak || 0,
    criticalTaps: state.criticalTaps || 0,
    goldensClicked: state.goldensClicked || 0,
    hasEgg: !!state.hasEgg || !!shop.eternalEgg,
    startedAt: state.startedAt || Date.now(),
    crumbs: state.crumbs || 0,
    lastCrumbAt: state.lastCrumbAt || Date.now(),
    phaseIndex: state.phaseIndex || 0,
    phaseStartAt: state.phaseStartAt || Date.now(),
    garden: state.garden || emptyGarden(),
    barleyBonus: state.barleyBonus || 0,
    pantheon: state.pantheon || [null, null, null],
    market: state.market || { holdings: {}, prices: {}, lastUpdateAt: 0 },
  };
  // Auto-pop all attached burnt crusts at ascend time so accumulated drain
  // isn't silently lost when bakers reset. Pays out at the standard 110%.
  let crustPayout = 0;
  for (const c of (state.burntCrusts || [])) crustPayout += Math.floor(c.drained * BURNT_CRUST_PAYOUT_MULT);
  state = Object.assign(defaultState(), carry);
  if (shop.reinforced) state.owned.apprentice = (state.owned.apprentice || 0) + 1;
  invalidatePassiveRate();
  streakCount = 0;
  lastRenderedCount = -1; lastRenderedRate = -1; lastStreakTier = -1;
  setPumpEmoji();
  // Apply the carried crust payout (state.count is post-reset bank).
  if (crustPayout > 0) state.count += crustPayout;
  menuModalEl.classList.remove('show');
  const flash = document.getElementById('ascend-flash');
  flash.classList.remove('show'); void flash.offsetWidth; flash.classList.add('show');
  SFX.ascend();
  const tail = crustPayout > 0 ? ` (carried crust payout: +${fmt(crustPayout)})` : '';
  toast(`✨ ascended. +${gain}👑 — total ${state.crowns}${tail}`);
  save(); renderCount(); refreshTreats(); refreshBakery(); renderAchPanel(); refreshMenu();
});

// Crown Shop — spend crowns on permanent meta-upgrades.
function renderShop() {
  shopSubEl.textContent = `you have ${state.crowns || 0}👑 to spend.`;
  shopListEl.innerHTML = '';
  for (const item of CROWN_SHOP_ITEMS) {
    const owned = !!(state.crownShop && state.crownShop[item.id]);
    const affordable = (state.crowns || 0) >= item.cost;
    const row = document.createElement('div');
    row.className = 'ach-row' + (!owned && !affordable ? ' locked' : '');
    row.innerHTML = `
      <div class="icon">${item.icon}</div>
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="desc">${item.desc}</div>
      </div>
      <button data-id="${item.id}" class="shop-buy${owned ? ' owned' : ''}" ${owned || !affordable ? 'disabled' : ''}>
        ${owned ? 'owned' : item.cost + '👑'}
      </button>
    `;
    shopListEl.appendChild(row);
  }
  shopListEl.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => buyShopItem(btn.dataset.id));
  });
}
function buyShopItem(id) {
  const item = CROWN_SHOP_ITEMS.find(x => x.id === id);
  if (!item) return;
  if (state.crownShop && state.crownShop[id]) return;
  if ((state.crowns || 0) < item.cost) return;
  state.crowns -= item.cost;
  state.crownShop = state.crownShop || {};
  state.crownShop[id] = true;
  if (id === 'eternalEgg') state.hasEgg = true;
  if (id === 'reinforced') {
    state.owned.apprentice = (state.owned.apprentice || 0) + 1;
    invalidatePassiveRate();
    refreshTreats(); refreshBakery();
  }
  toast(`🪙 ${item.name}`);
  save();
  renderShop(); refreshMenu(); renderCount();
}

// Yeast Garden — 3×3 mini-game.
const gardenGridEl = document.getElementById('garden-grid');
const gardenBonusEl = document.getElementById('garden-bonus');
const gardenSummaryEl = document.getElementById('garden-summary');
const waterBtnEl = document.getElementById('water-btn');
function plotGrowProgress(plot) {
  const sp = SPECIES.find(s => s.id === plot.species);
  if (!sp) return 1;
  // Stardust pauses while no buff is active. Use lastTickAt accumulator.
  const accumulated = plot.lastTickAt - plot.plantedAt;
  return Math.max(0, Math.min(1, accumulated / sp.growMs));
}
function plotIsMature(plot) { return plot.species && plotGrowProgress(plot) >= 1; }
function emptyNeighbors(idx) {
  const x = idx % GARDEN_GRID_SIZE, y = Math.floor(idx / GARDEN_GRID_SIZE);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let count = 0;
  for (const [dx, dy] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= GARDEN_GRID_SIZE || ny >= GARDEN_GRID_SIZE) continue;
    if (!state.garden[ny * GARDEN_GRID_SIZE + nx].species) count++;
  }
  return count;
}
function neighborsOfSpecies(idx, species) {
  const x = idx % GARDEN_GRID_SIZE, y = Math.floor(idx / GARDEN_GRID_SIZE);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  let n = 0;
  for (const [dx, dy] of dirs) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= GARDEN_GRID_SIZE || ny >= GARDEN_GRID_SIZE) continue;
    if (state.garden[ny * GARDEN_GRID_SIZE + nx].species === species) n++;
  }
  return n;
}
function canPlant(species, idx) {
  if ((state.crumbs || 0) < species.cost) return { ok: false, reason: `costs ${species.cost} crumb${species.cost === 1 ? '' : 's'}` };
  if (species.needsEmptyNeighbors && emptyNeighbors(idx) < species.needsEmptyNeighbors) {
    return { ok: false, reason: `needs ${species.needsEmptyNeighbors} empty neighbors` };
  }
  if (species.requiresAdjacent && neighborsOfSpecies(idx, species.requiresAdjacent) < 1) {
    return { ok: false, reason: `must be adjacent to ${species.requiresAdjacent}` };
  }
  return { ok: true };
}
function plantInPlot(idx, speciesId) {
  const species = SPECIES.find(s => s.id === speciesId);
  if (!species) return;
  const plot = state.garden[idx];
  if (plot.species) return;
  const check = canPlant(species, idx);
  if (!check.ok) { toast(`can't plant: ${check.reason}`); return; }
  state.crumbs -= species.cost;
  plot.species = species.id;
  plot.plantedAt = Date.now();
  plot.lastTickAt = Date.now();
  // Void mold destroys cardinal neighbors on plant.
  if (species.destroysNeighbors) {
    const x = idx % GARDEN_GRID_SIZE, y = Math.floor(idx / GARDEN_GRID_SIZE);
    let refunds = 0;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GARDEN_GRID_SIZE || ny >= GARDEN_GRID_SIZE) continue;
      const n = state.garden[ny * GARDEN_GRID_SIZE + nx];
      if (n.species) {
        const ns = SPECIES.find(s => s.id === n.species);
        if (ns) refunds += Math.floor(ns.cost * 0.5);
        n.species = null; n.plantedAt = 0; n.lastTickAt = 0;
      }
    }
    if (refunds > 0) { state.crumbs += refunds; toast(`mold destroyed neighbors. +${refunds} crumbs.`); }
  }
  save(); renderGarden(); refreshMenu();
}
function harvestPlot(idx) {
  const plot = state.garden[idx];
  if (!plotIsMature(plot)) return;
  const species = SPECIES.find(s => s.id === plot.species);
  if (!species) return;
  // Apply harvest reward.
  if (species.buffMult && species.buffMs) {
    state.activeEffects.push({ id: 'g_' + species.id, expiresAt: Date.now() + species.buffMs, mult: species.buffMult });
  }
  if (species.chaosPaceMs) {
    state.activeEffects.push({ id: 'g_hops', expiresAt: Date.now() + species.chaosPaceMs, mult: 1 });
  }
  if (species.permanentBonus) {
    state.barleyBonus = Math.min(GARDEN_BARLEY_CAP, (state.barleyBonus || 0) + species.permanentBonus);
  }
  if (species.spawnsGolden) {
    spawnGolden();
  }
  if (species.crownReward) {
    state.crowns = (state.crowns || 0) + species.crownReward;
  }
  toast(`🌱 harvested ${species.name}`);
  // Cross-pollination: 5% chance per matching neighbor to seed an empty plot
  // with a random non-mold species.
  const matches = neighborsOfSpecies(idx, species.id);
  if (matches > 0 && Math.random() < GARDEN_POLLINATE_CHANCE * matches) {
    const empty = [];
    for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
      if (!state.garden[i].species) empty.push(i);
    }
    if (empty.length) {
      const target = empty[Math.floor(Math.random() * empty.length)];
      // Filter to species whose placement rules are satisfied at the target.
      const candidates = SPECIES.filter(s =>
        s.id !== 'voidmold' &&
        (!s.requiresAdjacent || neighborsOfSpecies(target, s.requiresAdjacent) > 0) &&
        (!s.needsEmptyNeighbors || emptyNeighbors(target) >= s.needsEmptyNeighbors) &&
        (!s.requiresBuff || hasActiveBuff())
      );
      if (candidates.length) {
        const hybrid = candidates[Math.floor(Math.random() * candidates.length)];
        state.garden[target].species = hybrid.id;
        state.garden[target].plantedAt = Date.now();
        state.garden[target].lastTickAt = Date.now();
        toast(`🌱 a wild ${hybrid.name} sprouted next door.`);
      }
    }
  }
  // Clear plot.
  plot.species = null; plot.plantedAt = 0; plot.lastTickAt = 0;
  save(); renderCount(); renderGarden(); refreshMenu(); renderEffects();
}
function clearPlot(idx) {
  const plot = state.garden[idx];
  if (!plot.species) return;
  // Caller is responsible for the confirm dialog (avoids double-prompt).
  plot.species = null; plot.plantedAt = 0; plot.lastTickAt = 0;
  save(); renderGarden();
}
function waterRandomPlot() {
  if ((state.count || 0) < GARDEN_WATER_COST) { toast(`watering can needs ${GARDEN_WATER_COST} pumpernickels`); return; }
  // Pick the plot closest to ready (most progressed but not yet mature).
  let target = -1, best = -1;
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
    const p = state.garden[i];
    if (!p.species || plotIsMature(p)) continue;
    const prog = plotGrowProgress(p);
    if (prog > best) { best = prog; target = i; }
  }
  if (target < 0) { toast('nothing growing yet.'); return; }
  state.count -= GARDEN_WATER_COST;
  const plot = state.garden[target];
  const species = SPECIES.find(s => s.id === plot.species);
  // Halve remaining grow time by advancing lastTickAt.
  const remaining = species.growMs - (plot.lastTickAt - plot.plantedAt);
  plot.lastTickAt += remaining / 2;
  toast(`💧 watered the ${species.name}`);
  save(); renderCount(); renderGarden();
}
let speciesPickerEl = null;
function openSpeciesPicker(idx) {
  if (speciesPickerEl && speciesPickerEl.parentNode) return; // already open, ignore re-clicks
  const ovEl = document.createElement('div');
  speciesPickerEl = ovEl;
  ovEl.className = 'ach-modal show';
  ovEl.style.zIndex = '500';
  const card = document.createElement('div');
  card.className = 'ach-card';
  card.innerHTML = `
    <button class="ach-close" aria-label="Close">×</button>
    <div class="ach-title">🌱 plant in plot ${idx + 1}</div>
    <div class="ach-sub">crumbs: ${state.crumbs || 0}</div>
    <div class="species-picker"></div>
  `;
  ovEl.appendChild(card);
  document.body.appendChild(ovEl);
  const grid = card.querySelector('.species-picker');
  for (const sp of SPECIES) {
    const check = canPlant(sp, idx);
    const row = document.createElement('div');
    row.className = 'species-row' + (check.ok ? '' : ' locked');
    row.innerHTML = `
      <div class="species-icon">${sp.icon}</div>
      <div class="species-info">
        <div class="species-name">${sp.name}</div>
        <div class="species-desc">${sp.desc}${check.ok ? '' : ' — ' + check.reason}</div>
      </div>
      <div class="species-cost">${sp.cost === 0 ? 'free' : sp.cost + '🍞'}</div>
    `;
    if (check.ok) row.addEventListener('click', () => { plantInPlot(idx, sp.id); document.body.removeChild(ovEl); });
    grid.appendChild(row);
  }
  const close = () => { if (ovEl.parentNode) document.body.removeChild(ovEl); speciesPickerEl = null; };
  card.querySelector('.ach-close').addEventListener('click', close);
  ovEl.addEventListener('click', (e) => { if (e.target === ovEl) close(); });
}
function renderGarden() {
  if (!gardenGridEl) return;
  gardenGridEl.innerHTML = '';
  for (let i = 0; i < GARDEN_PLOT_COUNT; i++) {
    const plot = state.garden[i];
    const cell = document.createElement('div');
    cell.className = 'plot';
    if (!plot.species) {
      cell.classList.add('empty');
      cell.innerHTML = `<div class="plot-icon">＋</div><div class="plot-time">empty</div>`;
      cell.addEventListener('click', () => openSpeciesPicker(i));
    } else {
      const sp = SPECIES.find(s => s.id === plot.species);
      const mature = plotIsMature(plot);
      const progress = plotGrowProgress(plot);
      cell.classList.add(mature ? 'mature' : 'planted');
      const remaining = mature ? 0 : Math.max(0, sp.growMs - (plot.lastTickAt - plot.plantedAt));
      const minutes = Math.floor(remaining / 60000), seconds = Math.floor((remaining % 60000) / 1000);
      const paused = sp.requiresBuff && !state.activeEffects.some(e => Date.now() < e.expiresAt && e.mult > 1);
      const timeText = mature ? 'harvest!' : (paused ? 'paused (no buff)' : `${minutes}:${seconds.toString().padStart(2, '0')}`);
      cell.innerHTML = `
        <div class="plot-icon">${sp.icon}</div>
        <div class="plot-time ${mature ? 'ready' : (paused ? 'paused' : '')}">${timeText}</div>
        <div class="plot-bar"><i style="width:${(progress * 100).toFixed(1)}%"></i></div>
      `;
      if (mature) {
        cell.addEventListener('click', () => harvestPlot(i));
      } else {
        // Tap on a non-mature plot shows status; long-press (500ms) uproots.
        // Avoids the destructive native confirm dialog on every accidental tap.
        let pressTimer = null, longFired = false;
        cell.addEventListener('pointerdown', () => {
          longFired = false;
          pressTimer = setTimeout(() => {
            longFired = true;
            if (confirm(`Uproot the ${sp.name}? Crumbs not refunded.`)) clearPlot(i);
          }, 500);
        });
        const cancelPress = () => { clearTimeout(pressTimer); pressTimer = null; };
        cell.addEventListener('pointerup', () => {
          cancelPress();
          if (!longFired) {
            const minutes = Math.floor(remaining / 60000), seconds = Math.floor((remaining % 60000) / 1000);
            toast(`${sp.name} · ${minutes}:${seconds.toString().padStart(2, '0')} left · long-press to uproot`);
          }
        });
        cell.addEventListener('pointercancel', cancelPress);
        cell.addEventListener('pointerleave', cancelPress);
      }
    }
    gardenGridEl.appendChild(cell);
  }
  if (gardenBonusEl) gardenBonusEl.textContent = `+${(gardenBonus() * 100).toFixed(1)}% permanent rate`;
  if (waterBtnEl) waterBtnEl.disabled = (state.count || 0) < GARDEN_WATER_COST;
  if (gardenSummaryEl) gardenSummaryEl.textContent = `crumbs: ${state.crumbs || 0} · barley harvests cap at +${(GARDEN_BARLEY_CAP * 100).toFixed(0)}% (currently +${(gardenBonus() * 100).toFixed(1)}%)`;
}
if (waterBtnEl) waterBtnEl.addEventListener('click', waterRandomPlot);

// Yeast Market — commodity arbitrage. Prices fluctuate every 30s.
function updateMarketPrices() {
  const now = Date.now();
  if (now - (state.market.lastUpdateAt || 0) < MARKET_PRICE_UPDATE_MS) return;
  state.market.lastUpdateAt = now;
  for (const c of COMMODITIES) {
    // Random walk ±50%, plus +5% per 10 of the influencing baker (more bakers
    // = your supply is plentiful, market price is higher when you sell).
    const noise = 0.5 + Math.random();
    const ownedCount = state.owned[c.bakerInfluence] || 0;
    const influence = 1 + 0.05 * (ownedCount / 10);
    state.market.prices[c.id] = Math.max(1, Math.floor(c.basePrice * noise * influence));
  }
}
function buyCommodity(id) {
  const c = COMMODITIES.find(x => x.id === id);
  if (!c) return;
  const price = state.market.prices[id] || c.basePrice;
  const held = state.market.holdings[id] || 0;
  if (held >= MARKET_HOLDING_CAP) { toast(`max holdings (${MARKET_HOLDING_CAP}) reached`); return; }
  if (state.count < price) { toast(`not enough pumpernickels`); return; }
  state.count -= price;
  state.market.holdings[id] = held + 1;
  save(); renderCount(); renderMarket();
}
function sellCommodity(id) {
  const c = COMMODITIES.find(x => x.id === id);
  if (!c) return;
  const price = state.market.prices[id] || c.basePrice;
  const held = state.market.holdings[id] || 0;
  if (held <= 0) return;
  state.market.holdings[id] = held - 1;
  state.count += price;
  // No lifetime credit on sale — without cost-basis tracking, crediting could
  // inflate lifetime via buy/sell-same-tick loops. state.count is the truth.
  save(); renderCount(); renderMarket();
}
function buyMaxCommodity(id) {
  const c = COMMODITIES.find(x => x.id === id);
  if (!c) return;
  const price = state.market.prices[id] || c.basePrice;
  const held = state.market.holdings[id] || 0;
  const slots = MARKET_HOLDING_CAP - held;
  const affordable = Math.floor(state.count / price);
  const qty = Math.min(slots, affordable);
  if (qty <= 0) return;
  state.count -= qty * price;
  state.market.holdings[id] = held + qty;
  save(); renderCount(); renderMarket();
}
function sellAllCommodity(id) {
  const c = COMMODITIES.find(x => x.id === id);
  if (!c) return;
  const price = state.market.prices[id] || c.basePrice;
  const held = state.market.holdings[id] || 0;
  if (held <= 0) return;
  state.count += held * price;
  state.market.holdings[id] = 0;
  save(); renderCount(); renderMarket();
}
function renderMarket() {
  const list = document.getElementById('market-list');
  if (!list) return;
  updateMarketPrices();
  list.innerHTML = '';
  for (const c of COMMODITIES) {
    const price = state.market.prices[c.id] || c.basePrice;
    const held = state.market.holdings[c.id] || 0;
    const baseline = c.basePrice;
    const delta = ((price / baseline - 1) * 100).toFixed(0);
    const trend = price > baseline ? `<span style="color:#cfe9c9">+${delta}%</span>` : `<span style="color:#f0c4c4">${delta}%</span>`;
    const row = document.createElement('div');
    row.className = 'market-row';
    row.innerHTML = `
      <div class="market-icon">${c.icon}</div>
      <div class="market-info">
        <div class="market-name">${c.name}</div>
        <div class="market-meta">price ${fmt(price)} · ${trend} · holding ${held}/${MARKET_HOLDING_CAP}</div>
      </div>
      <div class="market-actions">
        <button data-act="buy"     data-id="${c.id}" ${state.count < price || held >= MARKET_HOLDING_CAP ? 'disabled' : ''}>buy</button>
        <button data-act="buy-max" data-id="${c.id}" ${state.count < price || held >= MARKET_HOLDING_CAP ? 'disabled' : ''}>max</button>
        <button data-act="sell"    data-id="${c.id}" ${held <= 0 ? 'disabled' : ''}>sell</button>
        <button data-act="sell-all" data-id="${c.id}" ${held <= 0 ? 'disabled' : ''}>all</button>
      </div>
    `;
    list.appendChild(row);
  }
  list.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act, id = btn.dataset.id;
      if (act === 'buy') buyCommodity(id);
      else if (act === 'buy-max') buyMaxCommodity(id);
      else if (act === 'sell') sellCommodity(id);
      else if (act === 'sell-all') sellAllCommodity(id);
    });
  });
  const sub = document.getElementById('market-sub');
  if (sub) {
    const next = Math.max(0, MARKET_PRICE_UPDATE_MS - (Date.now() - (state.market.lastUpdateAt || 0)));
    sub.textContent = `prices refresh every 30s. owned bakers raise the matching commodity price. next refresh ${Math.ceil(next/1000)}s.`;
  }
}

// Tinyclaw Pantheon — slot 3 temperaments with weighted effects.
const pantheonSlotsEl = document.getElementById('pantheon-slots');
const pantheonPoolEl = document.getElementById('pantheon-pool');
function pantheonSlot(slotIdx, tempId) {
  if (slotIdx < 0 || slotIdx > 2) return;
  // Cost a crumb if displacing an existing temperament, otherwise free.
  const occupied = !!state.pantheon[slotIdx];
  if (occupied && (state.crumbs || 0) < PANTHEON_SWAP_COST) {
    toast(`swap costs ${PANTHEON_SWAP_COST} 🍞`);
    return;
  }
  if (occupied) state.crumbs -= PANTHEON_SWAP_COST;
  // Remove this temperament from any other slot first (no duplicates).
  for (let i = 0; i < 3; i++) if (state.pantheon[i] === tempId) state.pantheon[i] = null;
  state.pantheon[slotIdx] = tempId;
  save(); renderPantheon(); refreshMenu();
}
function pantheonUnslot(slotIdx) {
  if (slotIdx < 0 || slotIdx > 2) return;
  if (!state.pantheon[slotIdx]) return;
  state.pantheon[slotIdx] = null;
  save(); renderPantheon(); refreshMenu();
}
function renderPantheon() {
  if (!pantheonSlotsEl) return;
  pantheonSlotsEl.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement('div');
    const tempId = state.pantheon ? state.pantheon[i] : null;
    const t = tempId ? TEMPERAMENTS.find(x => x.id === tempId) : null;
    slot.className = 'pantheon-slot' + (t ? '' : ' empty');
    slot.innerHTML = `
      <div class="slot-name">${PANTHEON_SLOT_NAMES[i]}</div>
      <div class="slot-weight">×${PANTHEON_SLOT_WEIGHTS[i]}</div>
      <div class="slot-icon">${t ? t.icon : '○'}</div>
      <div class="slot-name-filled">${t ? t.name : 'empty'}</div>
    `;
    if (t) slot.addEventListener('click', () => pantheonUnslot(i));
    pantheonSlotsEl.appendChild(slot);
  }
  pantheonPoolEl.innerHTML = '';
  for (const t of TEMPERAMENTS) {
    const slottedAt = (state.pantheon || []).indexOf(t.id);
    const isSlotted = slottedAt >= 0;
    const row = document.createElement('div');
    row.className = 'temperament' + (isSlotted ? ' slotted' : '');
    row.innerHTML = `
      <div class="temp-icon">${t.icon}</div>
      <div style="flex:1; min-width: 0">
        <div class="temp-name">${t.name}${isSlotted ? ` <span style="opacity:0.6; font-weight:400">(${PANTHEON_SLOT_NAMES[slottedAt]})</span>` : ''}</div>
        <div class="temp-desc">${t.desc}</div>
      </div>
      <div class="temp-actions"></div>
    `;
    const actions = row.querySelector('.temp-actions');
    if (isSlotted) {
      const unslotBtn = document.createElement('button');
      unslotBtn.className = 'slot-btn unslot';
      unslotBtn.textContent = 'unslot';
      unslotBtn.addEventListener('click', () => pantheonUnslot(slottedAt));
      actions.appendChild(unslotBtn);
    } else {
      for (let i = 0; i < 3; i++) {
        const btn = document.createElement('button');
        btn.className = 'slot-btn';
        const occupied = !!state.pantheon[i];
        btn.textContent = PANTHEON_SLOT_NAMES[i].charAt(0); // H/M/B
        btn.title = `slot in ${PANTHEON_SLOT_NAMES[i]} (×${PANTHEON_SLOT_WEIGHTS[i]})${occupied ? ` — costs ${PANTHEON_SWAP_COST} 🍞` : ''}`;
        if (occupied && (state.crumbs || 0) < PANTHEON_SWAP_COST) btn.disabled = true;
        btn.addEventListener('click', () => pantheonSlot(i, t.id));
        actions.appendChild(btn);
      }
    }
    pantheonPoolEl.appendChild(row);
  }
}

const helpModalEl = document.getElementById('help-modal');
document.getElementById('help-btn').addEventListener('click', () => helpModalEl.classList.add('show'));
document.getElementById('help-close').addEventListener('click', () => helpModalEl.classList.remove('show'));
helpModalEl.addEventListener('click', (e) => { if (e.target === helpModalEl) helpModalEl.classList.remove('show'); });

// Escape key dismisses any open modal — desktop a11y expectation.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const m of [menuModalEl, helpModalEl]) {
    if (m.classList.contains('show')) { m.classList.remove('show'); return; }
  }
  // Species picker is created on demand; close any open one.
  if (speciesPickerEl && speciesPickerEl.parentNode) {
    document.body.removeChild(speciesPickerEl);
    speciesPickerEl = null;
  }
});

// Suppress the iOS/Android long-press context menu on bakery chips so the
// 500ms sell-back hold doesn't race with native image-save / text-select UI.
document.addEventListener('contextmenu', (e) => {
  if (e.target.closest('.asset')) e.preventDefault();
});

document.getElementById('mute-btn').addEventListener('click', () => setMuted(!isMuted()));
setMuted(isMuted());

document.getElementById('reset').addEventListener('click', () => {
  if (!confirm('Reset all progress?')) return;
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_KEY_V1);
  state = defaultState();
  streakCount = 0;
  lastRenderedCount = -1; lastRenderedRate = -1; lastStreakTier = -1;
  setPumpEmoji();
  renderCount(); refreshTreats(); refreshBakery(); renderAchPanel(); refreshMenu();
});

// Tick — passive accumulation + treat-affordability refresh + achievement check.
let tickCount = 0;
setInterval(() => {
  tickCount++;
  const now = Date.now();
  // Real-elapsed-since-last-tick — used by garden so background-tab throttling
  // doesn't pause plant growth in wall-clock time. Cap at 5min to avoid
  // single-tick offline jumps that mature everything at once.
  const dt = Math.min(now - (state.lastTick || now), 5 * 60 * 1000);
  state.activeEffects = state.activeEffects.filter(e => now < e.expiresAt);
  const r = rate();
  if (r > 0) { state.count += r; state.lifetime += r; }
  state.lastTick = now;
  if (hasCrown('steward') && tickCount % AUTO_BUY_INTERVAL_TICKS === 0) {
    const t = bestRateBuy();
    if (t && state.count >= priceOf(t)) buy(t);
  }
  // Crumb Trail — a ripe crumb appears every CRUMB_RIPEN_MS (catches up if offline).
  while (now - state.lastCrumbAt >= CRUMB_RIPEN_MS) {
    state.crumbs = (state.crumbs || 0) + 1;
    state.lastCrumbAt += CRUMB_RIPEN_MS;
    toast(`🍞 a ripe crumb appeared. you have ${state.crumbs}.`);
  }
  // Yeast Market — tick price refresh in the background even if modal is closed.
  if (state.market) updateMarketPrices();
  // Burnt Crusts — accumulate drained value per-second for the pop payout.
  if (state.burntCrusts && state.burntCrusts.length > 0) {
    for (const c of state.burntCrusts) {
      const t = TREATS.find(x => x.id === c.bakerId);
      if (!t) continue;
      // Per-tick drain = per-baker contribution × drain pct, scaled by globalMult
      // so payout matches "real" lost rate (ach/crown bonuses apply too).
      const baseContribution = t.rate * (state.owned[t.id] || 0) * synergyMultFor(t.id);
      c.drained += baseContribution * BURNT_CRUST_DRAIN_PCT * globalMult();
    }
    refreshBakery();
  }
  // Yeast Garden — advance plot grow timers by real elapsed time so a
  // backgrounded tab still sees plants mature at the advertised rate.
  // Stardust pauses when no buff is up.
  if (state.garden.some(p => p.species)) {
    const buffActive = hasActiveBuff();
    for (let i = 0; i < state.garden.length; i++) {
      const plot = state.garden[i];
      if (!plot.species) continue;
      const sp = SPECIES.find(s => s.id === plot.species);
      if (!sp) continue;
      if (sp.requiresBuff && !buffActive) continue;
      plot.lastTickAt = Math.min(plot.plantedAt + sp.growMs, plot.lastTickAt + dt);
    }
  }
  // Sourdough Phases — global rule cycler. Advances on real elapsed time.
  while (now - state.phaseStartAt >= PHASE_DURATION_MS) {
    state.phaseStartAt += PHASE_DURATION_MS;
    state.phaseIndex = ((state.phaseIndex || 0) + 1) % PHASES.length;
    const ph = currentPhase();
    showBanner(`${ph.icon} entering ${ph.name} phase — ${ph.desc}`, 'buff');
  }
  // Cool phase: bank +10% every 60s (no events firing during this phase).
  if (currentPhase().bankBonusEvery && tickCount % currentPhase().bankBonusEvery === 0 && state.count > 0) {
    const bonus = Math.floor(state.count * currentPhase().bankBonusPct);
    if (bonus > 0) { state.count += bonus; state.lifetime += bonus; }
  }
  renderPhase();
  renderCount();
  renderEffects();
  refreshTreats();
  refreshMenu();
  checkAchievements();
  // If a tab with live timers is open, refresh it so countdowns don't freeze.
  if (menuModalEl.classList.contains('show')) {
    if (activeTab === 'garden') renderGarden();
    else if (activeTab === 'market') renderMarket();
    else if (activeTab === 'ascend') openAscendPane();
  }
}, TICK_MS);
setInterval(save, SAVE_INTERVAL_MS);
window.addEventListener('beforeunload', save);

load();
invalidatePassiveRate();
buildTreatRows();
refreshBakery();
setPumpEmoji();
renderCount();
renderAchPanel();
refreshMenu();
renderEffects();
renderPhase();
setTimeout(() => scheduleNextEvent(), FIRST_EVENT_DELAY);
scheduleNextBurntCrust();
scheduleNextGolden();
scheduleWink();
checkAchievements();
