// Content: sourdough phases — global rule cycler config.
export const PHASES = [
  { id: 'knead', icon: '✊', name: 'Knead',  desc: 'longer combos. streak decay halved.',                  comboMult: 1.25, streakDecayMult: 2 },
  { id: 'rise',  icon: '🫧', name: 'Rise',   desc: '+50% passive rate, but tap value -50%.',                rateMult: 1.5, tapMult: 0.5 },
  { id: 'bake',  icon: '🔥', name: 'Bake',   desc: 'buff events fire 2× often. debuffs are blocked.',       buffPace: 0.5, blockDebuffs: true },
  { id: 'cool',  icon: '❄️', name: 'Cool',  desc: 'chaos events suspended. every 60s, bank +10%.',          suspendEvents: true, bankBonusEvery: 60, bankBonusPct: 0.10 },
  { id: 'stale', icon: '🥖', name: 'Stale',  desc: 'production -25%, but treats are 50% off.',              rateMult: 0.75, treatDiscount: 0.5 },
];
