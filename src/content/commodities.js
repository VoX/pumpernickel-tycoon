// Content: yeast market commodities + market tunables.
export const MARKET_THRESHOLD = 1e12;
export const MARKET_PRICE_UPDATE_MS = 30000;
export const MARKET_HOLDING_CAP = 1000;
export const COMMODITIES = [
  { id: 'flour',  icon: '🌾', name: 'Flour',  basePrice: 100,    bakerInfluence: 'mill' },
  { id: 'salt',   icon: '🧂', name: 'Salt',   basePrice: 500,    bakerInfluence: 'oven' },
  { id: 'butter', icon: '🧈', name: 'Butter', basePrice: 2500,   bakerInfluence: 'cow' },
  { id: 'sugar',  icon: '🍬', name: 'Sugar',  basePrice: 12500,  bakerInfluence: 'wizard' },
  { id: 'yeast',  icon: '🫧', name: 'Yeast',  basePrice: 60000,  bakerInfluence: 'apprentice' },
];
