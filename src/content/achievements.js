// Content: achievement definitions. Hidden achievements have hidden:true.
export const ACHIEVEMENTS = [
  { id: 'first_tap', icon: '👇', name: 'first crumb',         desc: 'welcome to the gluten lifestyle.',                            check: s => s.totalTaps >= 1 },
  { id: 'tap_100',   icon: '✋', name: 'finger committed',     desc: 'wrist developing opinions.',                                  check: s => s.totalTaps >= 100 },
  { id: 'k1',        icon: '🪙', name: 'first kilonickel',     desc: 'small bakery.',                                               check: s => s.lifetime >= 1000 },
  { id: 'k100',      icon: '🥖', name: 'mid-game economy',     desc: 'regional bread power.',                                       check: s => s.lifetime >= 100000 },
  { id: 'm1',        icon: '🍞', name: 'megaloaf',             desc: 'carbohydrate hegemony.',                                      check: s => s.lifetime >= 1e6 },
  { id: 'first_baker', icon: '🧑‍🍳', name: 'hired help',     desc: 'they have questions about wages.',                            check: s => (s.owned.apprentice||0) >= 1 },
  { id: 'cow',       icon: '🐄', name: 'mooo',                 desc: 'ethically ambiguous but productive.',                         check: s => (s.owned.cow||0) >= 1 },
  { id: 'wizard',    icon: '🧙', name: 'arcane bakery',        desc: 'union rules unclear.',                                        check: s => (s.owned.wizard||0) >= 1 },
  { id: 'streak_25', icon: '🔥', name: 'sharp tap',            desc: 'impressive wrist.',                                            check: s => s.longestStreak >= 25 },
  { id: 'streak_50', icon: '⚡', name: 'speed demon',          desc: 'genuinely concerning.',                                        check: s => s.longestStreak >= 50 },
  { id: 'lucky',     icon: '🍀', name: 'got lucky',            desc: 'three buffs in a row. statistically suspicious.',             check: s => s.buffsConsecutive >= 3 },
  { id: 'long_haul', icon: '⏳', name: 'long haul',            desc: 'played for 24 hours. hello.',                                 check: s => (Date.now() - s.startedAt) >= 24*3600*1000 },
  { id: 'late_game', icon: '🪐', name: 'cosmic baker',         desc: 'owned a Loaf Universe. concerning scale.',                    check: s => (s.owned.universe||0) >= 1 },
  { id: 'crown',     icon: '👑', name: 'crowned',              desc: 'the kingdom kneels.',                                          check: s => (s.owned.crowncake||0) >= 1 },
  { id: 'egg',       icon: '🐣', name: 'eggcellent decision',  desc: 'she winks at you sometimes.',                                  check: s => s.hasEgg === true, hidden: true },
  { id: 'crits_10',  icon: '✦', name: 'rare hit',             desc: 'ten critical taps. statistically allowed.',                   check: s => (s.criticalTaps || 0) >= 10, hidden: true },
];
