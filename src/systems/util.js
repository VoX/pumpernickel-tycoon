// Pure formatting utilities. No game state.

// Compact number formatting — 1234 → "1.23K", 1.5e9 → "1.5B".
export function fmt(n) {
  n = Math.floor(n);
  if (n < 1000) return String(n);
  if (n < 1e6) return (n/1000).toFixed(2).replace(/\.?0+$/, '') + 'K';
  if (n < 1e9) return (n/1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  return (n/1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
}
