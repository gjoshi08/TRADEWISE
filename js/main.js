// TRADEWISE — hash router (Redesign V2 routes), global controls and the simulated market clock.
import { store } from './store.js';
import { engine } from './engine.js';
import { affect } from './affect.js';
import { ai } from './ai.js';
import { voice } from './voice.js';
import { inr, WATCH, STOCKS } from './data.js';
import { openAIPopover, closePopover, closeDrawer, toast, camStatus, marketStatus, nav, ICON } from './ui.js';
import { welcome, onboarding, camera } from './views/onboard.js';
import { markets } from './views/markets.js';               // 02 — Figma 52:337
import { marketPsych } from './views/marketpsych.js';       // 03 — Figma 53:544
import { strategy } from './views/strategy.js';             // 05 — Figma 57:808
import { myPsych } from './views/mypsych.js';               // 04 — Figma 55:651
import { history as tradeHistory } from './views/history.js';   // (renamed: must not shadow window.history)               // 07 — Figma 63:1167
import { dashboard } from './views/dashboard.js';           // 01 — Figma 40:39
import { tradeCheck } from './views/tradecheck.js';         // 06 — Figma 58:907
import { profile } from './views/profile.js';

// V2 routes. Screens without a V2 implementation yet reuse the existing, fully working views (Phase 1).
const ROUTES = {
  welcome, onboarding, camera,                      // first-run flow (00 screens)
  dashboard,                                        // 01 — rebuilt from Figma
  markets,                                          // 02 — rebuilt from Figma
  'market-psychology': marketPsych,                 // 03 — rebuilt from Figma
  'my-psychology': myPsych,                         // 04 — rebuilt from Figma
  strategy,                                         // 05 — rebuilt from Figma (plan builder kept as the stock-plan editor)
  'trade-check': tradeCheck,                        // 06 — rebuilt from Figma (Buy/Sell open it first)
  history: tradeHistory,                            // 07 — rebuilt from Figma (absorbs Reflect)
  profile,                                          // 09 — privacy & camera, How the AI works, Research
};
// Old hashes keep working.
const REDIRECTS = { trade: 'dashboard', learn: 'markets', plan: 'strategy', reflect: 'history', insights: 'my-psychology', 'how-ai-works': 'profile/how-ai-works', research: 'profile/research' };

const app = document.getElementById('app');
let current = null, root = null;

function route() {
  let hash = location.hash.replace(/^#\/?/, '');
  if (!hash) hash = store.s.profile.onboarded ? 'dashboard' : 'welcome';
  let [name, sub] = hash.split('/');
  if (REDIRECTS[name]) { const to = REDIRECTS[name]; history.replaceState(null, '', '#' + to); [name, sub] = to.split('/'); }
  if (!ROUTES[name]) { name = store.s.profile.onboarded ? 'dashboard' : 'welcome'; history.replaceState(null, '', '#' + name); sub = undefined; }
  closePopover(); closeDrawer();
  if (current && current.unmount) { try { current.unmount(); } catch (e) { console.error(e); } }
  current = ROUTES[name]; root = document.createElement('div'); root.className = 'view view-' + name;
  app.replaceChildren(root);
  try { current.render(root, sub); } catch (e) { console.error(e); root.innerHTML = `<div class="page"><h1 class="t-page">Something went wrong</h1><p>${e.message}</p><a class="btn" href="#dashboard">Back to the dashboard</a></div>`; }
  const titles = { dashboard: 'Dashboard', markets: 'Markets', 'market-psychology': 'Market Psychology', 'my-psychology': 'My Psychology', strategy: 'Strategy', 'trade-check': 'Trade Check', history: 'Trade History', profile: 'Profile', welcome: 'Welcome', onboarding: 'Onboarding', camera: 'Camera consent' };
  document.title = 'TRADEWISE · ' + (titles[name] || name);
  window.scrollTo(0, 0);
}

// Header live state: camera status, speech toggle, market clock.
function updateStatus() {
  const el = document.querySelector('[data-live="aistatus"]');
  if (el) { const st = camStatus(); el.textContent = st.txt; el.parentElement.className = 'status aistatus ' + st.cls; }
  const sp = voice.state.speak, sw = document.querySelector('[data-act="speak"].iconswitch');
  if (sw) { sw.setAttribute('aria-checked', sp); sw.querySelector('[data-live="speakicon"]').innerHTML = sp ? ICON.speak : ICON.mute; sw.querySelector('[data-live="speaktoggle"]').classList.toggle('on', sp); }
}

// Global controls (header, popovers) via event delegation.
document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act]');
  const inPop = e.target.closest('.popover');
  if (!t) { if (!inPop && !e.target.closest('.aistatus')) closePopover(); return; }
  const a = t.dataset.act;
  const reopen = () => { if (document.querySelector('.popover')) openAIPopover(); };
  switch (a) {
    case 'aipop': e.preventDefault(); document.querySelector('.popover') ? closePopover() : openAIPopover(); break;
    case 'closepop': closePopover(); break;
    case 'cam-on': { const ok = await affect.startCamera(); if (!ok) toast('Camera unavailable: ' + affect.state.error); reopen(); break; }
    case 'cam-demo': affect.startDemo(); reopen(); break;
    case 'cam-off': affect.stop(); store.s.camera.choice = 'none'; store.save(); store.log('ai', 'Camera turned off. The AI uses trading activity only.'); reopen(); break;
    case 'recal': affect.calibrate(5000); toast('Calibrating for 5 seconds. Look at the screen with a relaxed face.'); closePopover(); break;
    case 'speak': voice.setSpeak(!voice.state.speak); reopen(); toast(voice.state.speak ? 'Important alerts will be read aloud.' : 'Spoken alerts muted.'); break;
  }
});
// Header stock search → dashboard with that stock selected.
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form="search"]'); if (!f) return; e.preventDefault();
  const q = (f.q.value || '').trim().toUpperCase();
  const sym = WATCH.find(s => s === q) || WATCH.find(s => s.startsWith(q)) || WATCH.find(s => STOCKS[s].name.toUpperCase().includes(q));
  if (!q) return; if (!sym) { toast(`No simulated stock matches “${f.q.value}”.`); return; }
  nav.pendingSym = sym; f.q.value = '';
  if (location.hash === '#dashboard') route(); else location.hash = 'dashboard';
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.closest('[data-form="search"]') && t.name === 'q' && WATCH.includes(t.value.trim().toUpperCase())) { t.form.requestSubmit(); return; }
  if (!t.closest('.popover')) return;
  if (t.dataset.act === 'preset') { affect.startDemo(t.value); }
  if (t.dataset.act === 'lookaway') affect.setLookAway(t.checked);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closePopover(); closeDrawer(); } });

engine.init(); engine.start();
engine.on(() => {
  if (current && current.tick) { try { current.tick(root); } catch (e) { console.error(e); } }
  const c = document.querySelector('[data-live="cash"]'); if (c) c.textContent = inr(engine.portfolio().cash, 0);
  const m = document.querySelector('[data-live="mstatus"]'); if (m) m.textContent = marketStatus();
});
affect.on(updateStatus); ai.on(updateStatus); voice.on(updateStatus);
// The V2 screens show no webcam preview, but the on-device model needs a playing <video>. Keep it attached to an
// invisible 2×2 px host whenever no screen (e.g. calibration) is displaying it. Frames are never stored.
const videoHost = document.createElement('div'); videoHost.id = 'tw-video-host'; videoHost.setAttribute('aria-hidden', 'true'); document.body.appendChild(videoHost);
affect.on(s => { const v = affect.video; if (v && s.mode === 'camera' && !v.isConnected) { videoHost.appendChild(v); v.play().catch(() => { }); } });
// Restore the user's earlier choice of demonstration mode (the camera needs fresh permission each visit).
if (store.s.camera.choice === 'demo') affect.startDemo();
window.addEventListener('hashchange', route);
route();
window.TRADEWISE = { store, engine, affect, ai, voice }; // for testing in the console
