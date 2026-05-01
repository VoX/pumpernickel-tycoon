// Web Audio synth — no asset hosting, all tones generated from oscillators.
// AudioContext lazy-initializes on first user gesture (autoplay policy).
// Mute state persists in localStorage.
const SFX_MUTE_KEY = 'pumpernickel_muted_v1';
let muted = localStorage.getItem(SFX_MUTE_KEY) === '1';
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { audioCtx = null; }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playTone(freq, dur = 60, type = 'sine', vol = 0.08) {
  if (muted) return;
  const ctx = initAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / 1000);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0);
  o.stop(t0 + dur / 1000 + 0.02);
}

export function playSequence(notes, gap = 0) {
  let delay = 0;
  for (const n of notes) {
    setTimeout(() => playTone(n.f, n.d || 60, n.t || 'sine', n.v || 0.08), delay);
    delay += (n.d || 60) + gap;
  }
}

export const SFX = {
  tap:    () => playTone(220, 28, 'sine', 0.04),
  crit:   () => playTone(880, 90, 'triangle', 0.12),
  buy:    () => playSequence([{ f: 660, d: 40, t: 'square', v: 0.06 }, { f: 880, d: 60, t: 'square', v: 0.06 }]),
  ach:    () => playSequence([{ f: 523, d: 80, v: 0.1 }, { f: 659, d: 80, v: 0.1 }, { f: 784, d: 140, v: 0.1 }]),
  golden: () => playSequence([{ f: 1200, d: 50, t: 'triangle', v: 0.1 }, { f: 1500, d: 50, t: 'triangle', v: 0.1 }, { f: 1800, d: 80, t: 'triangle', v: 0.1 }]),
  ascend: () => { playTone(262, 700, 'sine', 0.1); playTone(330, 700, 'sine', 0.08); playTone(392, 700, 'sine', 0.06); },
  buff:   () => playSequence([{ f: 330, d: 60, v: 0.06 }, { f: 440, d: 60, v: 0.06 }, { f: 587, d: 100, v: 0.07 }]),
  debuff: () => playSequence([{ f: 330, d: 80, t: 'sawtooth', v: 0.06 }, { f: 220, d: 120, t: 'sawtooth', v: 0.07 }]),
  chime:  () => playSequence([{ f: 1320, d: 130, t: 'triangle', v: 0.14 }, { f: 1760, d: 220, t: 'triangle', v: 0.14 }]),
};

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = v;
  localStorage.setItem(SFX_MUTE_KEY, v ? '1' : '0');
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = v ? '🔇' : '🔊';
  if (audioCtx && v && audioCtx.state === 'running') audioCtx.suspend();
}
