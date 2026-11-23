// Optional camera preview. It shows the SAME <video> element the affect model already reads from (affect.video),
// so no second camera stream is ever opened. Hiding the preview only moves that element back into an invisible
// host; the camera, the model and the estimates keep running until the user turns the camera off.
// Nothing here records, copies, stores or uploads frames. The only thing saved is the on/off preference.
import { affect } from './affect.js';
import { store } from './store.js';

// The on-device model needs a playing <video> even when nothing displays it. Park it in an invisible 2×2 px host
// whenever no screen (preview, onboarding calibration) is showing it.
const host = document.createElement('div'); host.id = 'tw-video-host'; host.setAttribute('aria-hidden', 'true');
let el = null;

export const previewWanted = () => !!(store.s.camera && store.s.camera.preview);
export function setPreview(on) { store.s.camera.preview = !!on; store.save(); syncPreview(); }

function park(v) { if (v.parentElement !== host) { host.appendChild(v); v.play().catch(() => { }); } }

export function syncPreview() {
  const s = affect.state, v = affect.video;
  const show = previewWanted() && s.mode === 'camera' && v && !!document.querySelector('header.nav');   // app screens only, not set-up
  if (!show) {
    if (el) { el.remove(); el = null; document.body.classList.remove('has-cp'); }
    if (v && s.mode === 'camera' && (!v.isConnected)) park(v);   // keep the model's video playing, invisibly
    return;
  }
  if (!el) {
    el = document.createElement('aside'); el.className = 'campreview'; el.setAttribute('aria-label', 'Camera preview');
    el.innerHTML = `<div class="cp-frame" data-cp="frame"><span class="cp-live"><i></i>Camera on</span></div>
      <p class="cp-q" data-cp="q" aria-live="polite"></p>
      <div class="cp-acts"><button class="btn link" data-act="cam-preview-hide" title="Hides the picture only. The camera stays on.">Hide preview</button><button class="btn link" data-act="cam-off" title="Stops the camera and releases it">Turn camera off</button></div>
      <p class="cp-note">Hiding the preview keeps the camera on.</p>`;
    document.body.appendChild(el); document.body.classList.add('has-cp');
  }
  const frame = el.querySelector('[data-cp="frame"]');
  if (v.parentElement !== frame) {
    v.setAttribute('aria-label', 'Your camera, shown only to you and processed on this device. Not recorded.');
    frame.prepend(v); v.play().catch(() => { });
  }
  const q = !s.face || s.stale ? 'No face in view · estimate paused' : (s.calibrating != null ? 'Calibrating… keep a relaxed face' : 'Face found · estimating on this device');
  const qe = el.querySelector('[data-cp="q"]'); if (qe.textContent !== q) qe.textContent = q;
  el.classList.toggle('noface', !s.face || !!s.stale);
}

export function initPreview() {
  document.body.appendChild(host);
  affect.on(syncPreview);
  window.addEventListener('hashchange', () => setTimeout(syncPreview, 0));   // after the router has drawn the new screen
  // Leaving the page (close, reload, navigate away): stop every track so the camera light goes off at once.
  // stop(true) keeps the user's consent choice; the camera still needs a fresh click to start next time.
  window.addEventListener('pagehide', () => { const m = affect.state.mode; if (m === 'camera' || m === 'loading') affect.stop(true); });
}
