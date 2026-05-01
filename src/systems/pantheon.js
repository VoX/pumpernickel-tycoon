// Pantheon slot mutations. Pure logic — UI render is wired by main.js.
// pantheonMod() lives in rate.js (computed every tick).
import { PANTHEON_SWAP_COST } from '../content/temperaments.js';
import { state, save } from './state.js';

// Returns true on success, false if blocked (e.g. insufficient crumbs).
export function pantheonSlot(slotIdx, tempId) {
  if (slotIdx < 0 || slotIdx > 2) return false;
  const occupied = !!state.pantheon[slotIdx];
  if (occupied && (state.crumbs || 0) < PANTHEON_SWAP_COST) return false;
  if (occupied) state.crumbs -= PANTHEON_SWAP_COST;
  // Remove this temperament from any other slot first (no duplicates).
  for (let i = 0; i < 3; i++) if (state.pantheon[i] === tempId) state.pantheon[i] = null;
  state.pantheon[slotIdx] = tempId;
  save();
  return true;
}

export function pantheonUnslot(slotIdx) {
  if (slotIdx < 0 || slotIdx > 2) return;
  if (!state.pantheon[slotIdx]) return;
  state.pantheon[slotIdx] = null;
  save();
}
