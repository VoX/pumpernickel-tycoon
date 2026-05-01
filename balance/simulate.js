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
  { id: 's_apprentice', cost: 1000,       costGrowth: 999, max: 1, synergyTarget: 'apprentice', synergyMult: 2, requiresOwned: { apprentice: 10 } },
  { id: 's_oven',       cost: 7500,       costGrowth: 999, max: 1, synergyTarget: 'oven',       synergyMult: 2, requiresOwned: { oven: 10 } },
  { id: 's_cow',        cost: 50000,      costGrowth: 999, max: 1, synergyTarget: 'cow',        synergyMult: 2, requiresOwned: { cow: 10 } },
  { id: 's_wizard',     cost: 400000,     costGrowth: 999, max: 1, synergyTarget: 'wizard',     synergyMult: 2, requiresOwned: { wizard: 10 } },
  { id: 's_factory',    cost: 3000000,    costGrowth: 999, max: 1, synergyTarget: 'factory',    synergyMult: 2, requiresOwned: { factory: 10 } },
  { id: 's_mill',       cost: 20000000,   costGrowth: 999, max: 1, synergyTarget: 'mill',       synergyMult: 2, requiresOwned: { mill: 10 } },
  { id: 's_citadel',    cost: 150000000,  costGrowth: 999, max: 1, synergyTarget: 'citadel',    synergyMult: 2, requiresOwned: { citadel: 10 } },
  { id: 's_singularity',cost: 1000000000, costGrowth: 999, max: 1, synergyTarget: 'singularity',synergyMult: 2, requiresOwned: { singularity: 5 } },
  { id: 's_universe',   cost: 7500000000, costGrowth: 999, max: 1, synergyTarget: 'universe',   synergyMult: 2, requiresOwned: { universe: 5 } },
  { id: 'shower',      cost: 250,       costGrowth: 2.5,  instant: 1000 },
  { id: 'shower2',     cost: 25000,     costGrowth: 2.5,  instant: 50000 },
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
  return 1 + TREATS.filter(t => t.tapBonus).reduce((s, t) => s + (t.tapBonus * (state.owned[t.id] || 0)), 0);
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

// Strategies — each takes (state) and either taps, buys, or waits.

function strategySpamTap(state) {
  // Tap 5x/sec, buy whenever any rate-upgrade is affordable.
  for (let i = 0; i < 5; i++) state.count += tapAmount(state);
  const t = bestRateBuy(state);
  if (t && affordable(state, t)) {
    state.count -= priceOf(t, state.owned[t.id] || 0);
    state.owned[t.id] = (state.owned[t.id] || 0) + 1;
  }
}

function strategySteadyBuy(state) {
  // Tap 1x/sec, buy aggressively.
  state.count += tapAmount(state);
  while (true) {
    const t = bestRateBuy(state);
    if (!t || !affordable(state, t)) break;
    state.count -= priceOf(t, state.owned[t.id] || 0);
    state.owned[t.id] = (state.owned[t.id] || 0) + 1;
  }
}

function strategyIdle(state) {
  // No taps. Buy when affordable.
  const t = bestRateBuy(state);
  if (t && affordable(state, t)) {
    state.count -= priceOf(t, state.owned[t.id] || 0);
    state.owned[t.id] = (state.owned[t.id] || 0) + 1;
  }
}

function simulate(name, stepFn, maxSeconds = 86400) {
  const state = { count: 0, owned: {}, lifetime: 0 };
  const hits = {};
  for (let s = 0; s < maxSeconds; s++) {
    const r = passiveRate(state);
    state.count += r;
    state.lifetime += r;
    stepFn(state);
    state.lifetime = Math.max(state.lifetime, state.count);
    for (const m of MILESTONES) {
      if (!hits[m] && state.lifetime >= m) hits[m] = s;
    }
  }
  return { name, hits, finalCount: Math.floor(state.count), finalRate: passiveRate(state), owned: state.owned };
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
