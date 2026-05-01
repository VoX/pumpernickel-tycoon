// Content: pantheon temperaments + slot config.
export const PANTHEON_SLOT_WEIGHTS = [1.5, 1.0, 0.5]; // heart, mind, belly
export const PANTHEON_SLOT_NAMES = ['Heart', 'Mind', 'Belly'];
export const PANTHEON_SWAP_COST = 1; // crumbs per swap
export const TEMPERAMENTS = [
  { id: 'hungry',  icon: '😋', name: 'Hungry',  desc: '+30% baker rate · -20% tap value', mods: { rate: 0.30, tap: -0.20 } },
  { id: 'lazy',    icon: '😴', name: 'Lazy',    desc: '+50% offline gain · -15% buff duration', mods: { offline: 0.50, buffDuration: -0.15 } },
  { id: 'greedy',  icon: '🤑', name: 'Greedy',  desc: '+50% instant amounts · -10% rate while tapping', mods: { instantAmount: 0.50, rate: -0.10 } },
  { id: 'cunning', icon: '🧐', name: 'Cunning', desc: '+30% golden frequency · -15% buff strength', mods: { goldenFreq: 0.30, buffStrength: -0.15 } },
  { id: 'stout',   icon: '💪', name: 'Stout',   desc: '+25% combo bonus · -30% crit chance', mods: { combo: 0.25, crit: -0.30 } },
  { id: 'dreamer', icon: '🌙', name: 'Dreamer', desc: '+50% achievement bonus · -15% no-buff rate', mods: { achBonus: 0.50, rateNoBuff: -0.15 } },
];
