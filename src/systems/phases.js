// Sourdough Phases — global rule cycler. Each phase rewires globals (rate,
// tap value, event pace, etc) for ~30 minutes of play time before advancing.
import { PHASES } from '../content/phases.js';
import { state } from './state.js';

export function currentPhase() {
  return PHASES[(state.phaseIndex || 0) % PHASES.length];
}
export function phaseRateMult()      { return currentPhase().rateMult || 1; }
export function phaseTapMult()       { return currentPhase().tapMult || 1; }
export function phaseComboMult()     { return currentPhase().comboMult || 1; }
export function phaseTreatDiscount() { return currentPhase().treatDiscount || 1; }
