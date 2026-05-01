// Pump tap visual feedback: a one-shot bounce animation, an aura burst on
// combo tier-up, and a 1D spring-damper "depth" pushing the bread back when
// clicked. Each click adds velocity; gravity returns it to rest. Frame loop
// self-suspends when settled and re-arms on tap.

let pumpEl = null;
let pumpInnerEl = null;
let auraEl = null;

const PUMP_SPRING = 140;        // depth-units / s² per depth unit (k)
const PUMP_DRAG = 9;            // velocity damping coefficient (c)
const PUMP_CLICK_IMPULSE = 4.5; // velocity added per click (depth-units / s)
const PUSH_MAX = 1.5;           // depth ceiling — bread can't be pushed past this
const PUSH_SCALE_AT_MAX = 0.6;  // visual scale at max depth

let bounceClearTimer = null;
let pumpDepth = 0;
let pumpVelocity = 0;
let pumpDepthLast = performance.now();
let pumpFrameActive = false;

export function initPumpPhysics(els) {
  pumpEl = els.pump;
  pumpInnerEl = els.inner;
  auraEl = els.aura;
}

export function bouncePump() {
  if (!pumpInnerEl) return;
  if (bounceClearTimer) clearTimeout(bounceClearTimer);
  pumpInnerEl.style.animation = 'none';
  void pumpInnerEl.offsetWidth;
  pumpInnerEl.style.animation = 'tap-bounce 280ms cubic-bezier(0.34, 1.2, 0.4, 1)';
  bounceClearTimer = setTimeout(() => { pumpInnerEl.style.animation = ''; bounceClearTimer = null; }, 300);
}

export function fireAura() {
  if (!auraEl) return;
  auraEl.classList.remove('fire');
  void auraEl.offsetWidth;
  auraEl.classList.add('fire');
}

function pumpDepthFrame(now) {
  let dt = (now - pumpDepthLast) / 1000;
  if (dt > 0.1) dt = 0.1; // clamp huge dt after tab-blur
  pumpDepthLast = now;
  const accel = -PUMP_SPRING * pumpDepth - PUMP_DRAG * pumpVelocity;
  pumpVelocity += accel * dt;
  pumpDepth += pumpVelocity * dt;
  if (pumpDepth < 0) { pumpDepth = 0; if (pumpVelocity < 0) pumpVelocity = 0; }
  if (pumpDepth > PUSH_MAX) { pumpDepth = PUSH_MAX; if (pumpVelocity > 0) pumpVelocity = 0; }
  const scale = 1 - (pumpDepth / PUSH_MAX) * (1 - PUSH_SCALE_AT_MAX);
  const moving = pumpDepth > 0.001 || Math.abs(pumpVelocity) > 0.005;
  if (pumpEl) pumpEl.style.transform = moving ? `scale(${scale})` : '';
  if (moving) requestAnimationFrame(pumpDepthFrame);
  else pumpFrameActive = false;
}

export function pumpClickImpulse() {
  pumpVelocity += PUMP_CLICK_IMPULSE;
  if (!pumpFrameActive) {
    pumpFrameActive = true;
    pumpDepthLast = performance.now();
    requestAnimationFrame(pumpDepthFrame);
  }
}
