// Event banner queue — chaos events, phase transitions, insurance blocks.
// Caps at 5 to avoid background-tab pile-up ambushes on focus.
const BANNER_MS = 4500;
const BANNER_GAP_MS = 350;
let bannerQueue = [];
let bannerShowing = false;

export function showBanner(text, kind) {
  if (bannerQueue.length >= 5) bannerQueue.shift();
  bannerQueue.push({ text, kind });
  if (!bannerShowing) drainBanner();
}

function drainBanner() {
  if (!bannerQueue.length) { bannerShowing = false; return; }
  bannerShowing = true;
  const { text, kind } = bannerQueue.shift();
  const el = document.getElementById('event-banner');
  el.className = 'event-banner kind-' + kind;
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(drainBanner, BANNER_GAP_MS);
  }, BANNER_MS);
}
