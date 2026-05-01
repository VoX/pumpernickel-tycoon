// Content: yeast garden species — grow timers, costs, harvest rewards.
export const GARDEN_PLOT_COUNT = 9;
export const GARDEN_GRID_SIZE = 3;
export const GARDEN_BARLEY_BONUS = 0.005;       // +0.5% per harvest
export const GARDEN_BARLEY_CAP = 0.10;          // capped at +10% global
export const GARDEN_POLLINATE_CHANCE = 0.05;    // per matching neighbor on harvest
export const GARDEN_WATER_COST = 1000;          // pumpernickels per use
export const SPECIES = [
  { id: 'sourdough',  icon: '🌾', name: 'Active Sourdough', desc: 'fast, free. +25% rate buff (5min).',                     growMs: 5*60*1000,  cost: 0, buffMult: 1.25, buffMs: 5*60*1000 },
  { id: 'hops',       icon: '🍃', name: 'Hops',             desc: 'wants 2 empty neighbors. +50% chaos pace (30min).',       growMs: 10*60*1000, cost: 1, needsEmptyNeighbors: 2, chaosPaceMs: 30*60*1000, chaosPaceMult: 1.5 },
  { id: 'barley',     icon: '🌿', name: 'Malted Barley',    desc: 'slow grow, permanent +0.5% rate (cap +10%).',             growMs: 60*60*1000, cost: 2, permanentBonus: GARDEN_BARLEY_BONUS },
  { id: 'tinyclaw',   icon: '🍄', name: 'Tinyclaw Weed',    desc: 'plant adjacent to sourdough. spawns a golden 🥯.',         growMs: 15*60*1000, cost: 1, requiresAdjacent: 'sourdough', spawnsGolden: true },
  { id: 'stardust',   icon: '✨', name: 'Stardust Grain',   desc: 'only matures during a buff. harvest = +1 👑.',            growMs: 20*60*1000, cost: 3, requiresBuff: true, crownReward: 1 },
  { id: 'voidmold',   icon: '🦠', name: 'Void Mold',        desc: 'destroys 4 cardinal neighbors. ×3 rate buff (3min).',     growMs: 30*60*1000, cost: 1, destroysNeighbors: true, buffMult: 3, buffMs: 3*60*1000 },
];
