// Toast queue — multiple acks within ~1s queue instead of clobbering. Caps at 4
// pending so an ascend-with-many-ach burst doesn't loop forever.
const TOAST_MS = 1800;
let toastQueue = [];
let toastShowing = false;

function drainToast() {
  if (!toastQueue.length) { toastShowing = false; return; }
  toastShowing = true;
  const msg = toastQueue.shift();
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(drainToast, 200); }, TOAST_MS);
}

export function toast(msg) {
  if (toastQueue.length >= 4) toastQueue.shift();
  toastQueue.push(msg);
  if (!toastShowing) drainToast();
}
