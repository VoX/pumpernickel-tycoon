#!/usr/bin/env node
// Pumpernickel Tycoon balance simulation.
// Runs the game forward with three strategies and prints time-to-milestone.
// No DOM, no localStorage — pure logic copy of the cost/rate model.

const TREATS = [
  { id: 'apprentice',  cost: 10,        costGrowth: 1.18, rate: 1 },
  { id: 'oven',        cost: 75,        costGrowth: 1.22, rate: 5 },
  { id: 'cow',         cost: 500,       costGrowth: 1.25, rate: 25 },
  { id: 'wizard',      cost: 4000,      costGrowth: 1.30, rate: 150 },
  { id: 'factory',     cost: 30000,     costGrowth: 1.35, rate: 1000 },
  { id: 'mill',        cost: 200000,    costGrowth: 1.40, rate: 5000 },
  { id: 'citadel',     cost: 1500000,   costGrowth: 1.45, rate: 25000 },
  { id: 'singularity', cost: 10000000,  costGrowth: 1.50, rate: 150000 },
  { id: 'universe',    cost: 75000000,  costGrowth: 1.55, rate: 1000000 },
  { id: 'tap2',        cost: 50,        costGrowth: 2.0,  tapBonus: 1, max: 25 },
  { id: 'tap3',        cost: 5000,      costGrowth: 1.9,  tapBonus: 2, max: 50 },
  { id: 'tap4',        cost: 500000,    costGrowth: 1.85, tapBonus: 5, max: 100 },
  { id: 's_apprentice', cost: 1000,       costGrowth: 999, max: 1, synergyTarget: 'apprentice', synergyMult: 2, requiresOwned: { apprentice: 10 } },
  { id: 's_oven',       cost: 7500,       costGrowth: 999, max: 1, synergyTarget: 'oven',       synergyMult: 2, requiresOwned: { oven: 10 } },
  { id: 's_cow',        cost: 50000,      costGrowth: 999, max: 1, synergyTarget: 'cow',        synergyMult: 2, requiresOwned: { cow: 10 } },
  { id: 's_wizard',     cost: 400000,     costGrowth: 999, max: 1, synergyTarget: 'wizard',     synergyMult: 2, requiresOwned: { wizard: 10 } },
  { id: 's_factory',    cost: 3000000,    costGrowth: 999, max: 1, synergyTarget: 'factory',    synergyMult: 2, requiresOwned: { factory: 10 } },
  { id: 's_mill',       cost: 20000000,   costGrowth: 999, max: 1, synergyTarget: 'mill',       synergyMult: 2, requiresOwned: { mill: 10 } },
  { id: 's_citadel',    cost: 150000000,  costGrowth: 999, max: 1, synergyTarget: 'citadel',    synergyMult: 2, requiresOwned: { citadel: 10 } },
  { id: 's_singularity',cost: 1000000000, costGrowth: 999, max: 1, synergyTarget: 'singularity',synergyMult: 2, requiresOwned: { singularity: 5 } },
  { id: 's_universe',   cost: 7500000000, costGrowth: 999, max: 1, synergyTarget: 'universe',   synergyMult: 2, requiresOwned: { universe: 5 } },
  { id: 's2_apprentice', cost: 12000,         costGrowth: 999, max: 1, synergyTarget: 'apprentice', synergyMult: 3, requiresOwned: { apprentice: 25 } },
  { id: 's2_oven',       cost: 90000,         costGrowth: 999, max: 1, synergyTarget: 'oven',       synergyMult: 3, requiresOwned: { oven: 25 } },
  { id: 's2_cow',        cost: 600000,        costGrowth: 999, max: 1, synergyTarget: 'cow',        synergyMult: 3, requiresOwned: { cow: 25 } },
  { id: 's2_wizard',     cost: 5000000,       costGrowth: 999, max: 1, synergyTarget: 'wizard',     synergyMult: 3, requiresOwned: { wizard: 25 } },
  { id: 's2_factory',    cost: 36000000,      costGrowth: 999, max: 1, synergyTarget: 'factory',    synergyMult: 3, requiresOwned: { factory: 25 } },
  { id: 's2_mill',       cost: 240000000,     costGrowth: 999, max: 1, synergyTarget: 'mill',       synergyMult: 3, requiresOwned: { mill: 25 } },
  { id: 's2_citadel',    cost: 1800000000,    costGrowth: 999, max: 1, synergyTarget: 'citadel',    synergyMult: 3, requiresOwned: { citadel: 25 } },
  { id: 's2_singularity',cost: 12000000000,   costGrowth: 999, max: 1, synergyTarget: 'singularity',synergyMult: 3, requiresOwned: { singularity: 15 } },
  { id: 's2_universe',   cost: 90000000000,   costGrowth: 999, max: 1, synergyTarget: 'universe',   synergyMult: 3, requiresOwned: { universe: 15 } },
  { id: 's3_apprentice', cost: 150000,         costGrowth: 999, max: 1, synergyTarget: 'apprentice', synergyMult: 4, requiresOwned: { apprentice: 100 } },
  { id: 's3_oven',       cost: 1100000,        costGrowth: 999, max: 1, synergyTarget: 'oven',       synergyMult: 4, requiresOwned: { oven: 100 } },
  { id: 's3_cow',        cost: 7500000,        costGrowth: 999, max: 1, synergyTarget: 'cow',        synergyMult: 4, requiresOwned: { cow: 100 } },
  { id: 's3_wizard',     cost: 60000000,       costGrowth: 999, max: 1, synergyTarget: 'wizard',     synergyMult: 4, requiresOwned: { wizard: 100 } },
  { id: 's3_factory',    cost: 450000000,      costGrowth: 999, max: 1, synergyTarget: 'factory',    synergyMult: 4, requiresOwned: { factory: 100 } },
  { id: 's3_mill',       cost: 3000000000,     costGrowth: 999, max: 1, synergyTarget: 'mill',       synergyMult: 4, requiresOwned: { mill: 100 } },
  { id: 's3_citadel',    cost: 22500000000,    costGrowth: 999, max: 1, synergyTarget: 'citadel',    synergyMult: 4, requiresOwned: { citadel: 100 } },
  { id: 's3_singularity',cost: 150000000000,   costGrowth: 999, max: 1, synergyTarget: 'singularity',synergyMult: 4, requiresOwned: { singularity: 50 } },
  { id: 's3_universe',   cost: 1100000000000,  costGrowth: 999, max: 1, synergyTarget: 'universe',   synergyMult: 4, requiresOwned: { universe: 50 } },
  { id: 'shower',      cost: 1000,         costGrowth: 999, max: 1, doubleBank: true, requiresOwned: { apprentice: 1 } },
  { id: 'shower2',     cost: 100000,       costGrowth: 999, max: 1, doubleBank: true, requiresOwned: { oven: 5 } },
  { id: 'shower3',     cost: 5000000,      costGrowth: 999, max: 1, doubleBank: true, requiresOwned: { cow: 10 } },
  { id: 'shower4',     cost: 250000000,    costGrowth: 999, max: 1, doubleBank: true, requiresOwned: { wizard: 10 } },
  { id: 'shower5',     cost: 10000000000,  costGrowth: 999, max: 1, doubleBank: true, requiresOwned: { factory: 10 } },
  { id: 'egg',         cost: 50000,     costGrowth: 999,  max: 1 },
  { id: 'crowncake',   cost: 500000,    costGrowth: 999,  max: 1 },
];

const MILESTONES = [1e3, 1e4, 1e5, 1e6, 5e6, 1e8, 1e9];

function priceOf(t, owned) {
  return Math.ceil(t.cost * Math.pow(t.costGrowth, owned));
}

function passiveRate(state) {
  let total = 0;
  for (const t of TREATS) {
    if (!t.rate) continue;
    let mult = 1;
    for (const s of TREATS) {
      if (s.synergyTarget === t.id && (state.owned[s.id] || 0) > 0) mult *= s.synergyMult;
    }
    total += t.rate * (state.owned[t.id] || 0) * mult;
  }
  return total;
}
function tapAmount(state) {
  const bonus = TREATS.filter(t => t.tapBonus).reduce((s, t) => s + (t.tapBonus * (state.owned[t.id] || 0)), 0);
  const fromRate = passiveRate(state) * 0.005;
  return 1 + bonus + fromRate;
}

// Greedy buy: always buy the production-rate upgrade with the best
// "rate gained per pumpernickel spent" at current price.
function meetsReq(state, t) {
  if (!t.requiresOwned) return true;
  for (const id in t.requiresOwned) if ((state.owned[id] || 0) < t.requiresOwned[id]) return false;
  return true;
}
function bestRateBuy(state) {
  let best = null, bestEfficiency = 0;
  for (const t of TREATS) {
    if (t.max && (state.owned[t.id] || 0) >= t.max) continue;
    if (!meetsReq(state, t)) continue;
    const price = priceOf(t, state.owned[t.id] || 0);
    let effRate = 0;
    if (t.rate) effRate = t.rate;
    if (t.synergyTarget) {
      // Approximate: synergy gives mult-1 of the target's current contribution
      const targ = TREATS.find(x => x.id === t.synergyTarget);
      const owned = state.owned[t.synergyTarget] || 0;
      if (targ && owned > 0) effRate = (targ.rate * owned) * (t.synergyMult - 1);
    }
    if (effRate <= 0) continue;
    const eff = effRate / price;
    if (eff > bestEfficiency) { bestEfficiency = eff; best = t; }
  }
  return best;
}

function affordable(state, t) {
  return state.count >= priceOf(t, state.owned[t.id] || 0);
}

function buyTreat(state, t) {
  const price = priceOf(t, state.owned[t.id] || 0);
  state.count -= price;
  state.owned[t.id] = (state.owned[t.id] || 0) + 1;
  if (t.doubleBank) {
    // Apply 2× bank effect (mirrors index.html buy()).
    const pre = state.count + price;
    const delta = pre + price;
    state.count += delta;
    state.lifetime += delta;
  }
}

// Track simple achievement unlocks for the +1% bonus.
function checkAchievements(state) {
  const lts = state.lifetime;
  const unlocked = state.achievements;
  const adds = [];
  if (!unlocked.first_tap && state.totalTaps >= 1) adds.push('first_tap');
  if (!unlocked.tap_100 && state.totalTaps >= 100) adds.push('tap_100');
  if (!unlocked.k1 && lts >= 1e3) adds.push('k1');
  if (!unlocked.k100 && lts >= 1e5) adds.push('k100');
  if (!unlocked.m1 && lts >= 1e6) adds.push('m1');
  if (!unlocked.first_baker && (state.owned.apprentice||0) >= 1) adds.push('first_baker');
  if (!unlocked.late_game && (state.owned.universe||0) >= 1) adds.push('late_game');
  for (const id of adds) unlocked[id] = true;
}
function achBonus(state) { return Object.keys(state.achievements || {}).length * 0.01; }
function globalMult(state) { return 1 + achBonus(state); } // crowns / events not modeled in single-run sim

function effectiveRate(state) { return passiveRate(state) * globalMult(state); }

// Golden Pumpernickel model — fires every 60-180s on average (use 120s).
// Awards 180s of baseline rate (post-crit-and-buff revision).
function tickGolden(state) {
  state.goldenTimer = (state.goldenTimer || 0) - 1;
  if (state.goldenTimer <= 0) {
    state.goldenTimer = 60 + Math.floor(Math.random() * 120);
    if (passiveRate(state) > 0) {
      const gain = Math.max(180 * effectiveRate(state), 100);
      state.count += gain;
      state.lifetime += gain;
    }
  }
}

// Strategies — each takes (state) and either taps, buys, or waits.

function strategySpamTap(state) {
  for (let i = 0; i < 5; i++) state.count += tapAmount(state);
  state.totalTaps += 5;
  const t = bestRateBuy(state);
  if (t && affordable(state, t)) buyTreat(state, t);
}

function strategySteadyBuy(state) {
  state.count += tapAmount(state);
  state.totalTaps += 1;
  while (true) {
    const t = bestRateBuy(state);
    if (!t || !affordable(state, t)) break;
    buyTreat(state, t);
  }
}

function strategyIdle(state) {
  const t = bestRateBuy(state);
  if (t && affordable(state, t)) buyTreat(state, t);
}

// Casual: 30 taps every 5min (300s), otherwise idle. Buys best-rate when
// affordable, plus opportunistically buys doubleBank instants when bank
// is at least 2× the cost (real value gain).
function strategyCasual(state) {
  state.casualBurst = (state.casualBurst || 0) - 1;
  if (state.casualBurst <= 0 && Math.random() < 1 / 300) {
    state.casualBurst = 30;
  }
  if (state.casualBurst > 0) {
    state.count += tapAmount(state);
    state.totalTaps += 1;
    state.casualBurst -= 1;
  }
  // Try doubleBank instants when bank is fat
  for (const t of TREATS) {
    if (!t.doubleBank) continue;
    if ((state.owned[t.id] || 0) >= 1) continue;
    if (!meetsReq(state, t)) continue;
    const price = priceOf(t, 0);
    if (state.count >= price * 2) buyTreat(state, t);
  }
  const t = bestRateBuy(state);
  if (t && affordable(state, t)) buyTreat(state, t);
}

function simulate(name, stepFn, maxSeconds = 86400) {
  const state = { count: 0, owned: {}, lifetime: 0, achievements: {}, totalTaps: 0 };
  const hits = {};
  for (let s = 0; s < maxSeconds; s++) {
    const r = effectiveRate(state);
    state.count += r;
    state.lifetime += r;
    tickGolden(state);
    stepFn(state);
    checkAchievements(state);
    state.lifetime = Math.max(state.lifetime, state.count);
    for (const m of MILESTONES) {
      if (!hits[m] && state.lifetime >= m) hits[m] = s;
    }
  }
  return { name, hits, finalCount: Math.floor(state.count), finalRate: effectiveRate(state), owned: state.owned, achievements: state.achievements };
}

function fmtTime(s) {
  if (s == null) return '—';
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s/60) + 'm' + (s%60 ? ' ' + (s%60) + 's' : '');
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  return h + 'h' + (m ? ' ' + m + 'm' : '');
}

const results = [
  simulate('spam-tap', strategySpamTap),
  simulate('steady-buy', strategySteadyBuy),
  simulate('idle', strategyIdle),
  simulate('casual', strategyCasual),
];

console.log('# Pumpernickel Tycoon balance — 24h simulation\n');
console.log('Time-to-milestone by strategy. (— means not reached in 24h.)\n');
const header = 'milestone        | ' + results.map(r => r.name.padEnd(11)).join(' | ');
console.log(header);
console.log('-'.repeat(header.length));
for (const m of MILESTONES) {
  const row = m.toExponential(0).padStart(15) + ' | ' + results.map(r => fmtTime(r.hits[m]).padEnd(11)).join(' | ');
  console.log(row);
}

console.log('\n## Final state at 24h\n');
for (const r of results) {
  console.log('### ' + r.name);
  console.log(`  count: ${r.finalCount.toExponential(2)}  rate: ${r.finalRate}/s`);
  console.log(`  owned: ${JSON.stringify(r.owned)}`);
}

console.log('\n## Recommendations');
const spamHits = results[0].hits;
const idleHits = results[2].hits;
const k1 = spamHits[1e3] || Infinity;
const k100 = spamHits[1e5] || Infinity;
const m1 = spamHits[1e6] || Infinity;

if (k1 > 600) console.log('- spam-tap > 10min to first 1k feels slow. Consider lowering apprentice cost or increasing first-tier rate.');
else if (k1 < 60) console.log('- spam-tap reaches 1k in <60s. Could increase early cost growth to make first 10min more interesting.');
else console.log(`- spam-tap reaches 1k in ${fmtTime(k1)} — within target band.`);

if (m1 > 18*3600) console.log('- 1M lifetime takes >18h on best strategy — late-game feels grindy.');
else if (m1 < 4*3600) console.log('- 1M lifetime in <4h — endgame may arrive too quickly.');
else console.log(`- 1M lifetime in ${fmtTime(m1)} — within target band (4-18h).`);

if (idleHits[1e3] && idleHits[1e3] > 1800) console.log('- pure idle to 1k > 30min, suggesting taps are the only viable early path. OK if intentional.');
