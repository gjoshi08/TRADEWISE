// 09 Profile (Figma) — privacy & camera settings, plus How the AI works and Research (moved here from top-level routes).
import { store } from '../store.js';
import { affect } from '../affect.js';
import { voice } from '../voice.js';
import { levelLabel, esc } from '../data.js';
import { shell, pageTitle, toast } from '../ui.js';
import { howAI, research } from './about.js';

const SECTIONS = [['privacy', 'Privacy & camera', ''], ['account', 'Account & onboarding', 'Experience level, topics'], ['how-ai-works', 'How the AI works', 'Circumplex, rules, signals'], ['research', 'Research', 'Survey, n = 24'], ['about', 'About this prototype', 'Simulated data, licences']];
let unsub = null;

export const profile = {
  render(root, sub) {
    const key = SECTIONS.some(s => s[0] === sub) ? sub : 'privacy';
    root.innerHTML = shell('profile') + `<main class="page" style="padding-top:0">${pageTitle('Profile', 'Your settings, how TRADEWISE handles your data, and how the AI works.')}
      <div class="profile"><nav class="subnav" aria-label="Profile sections">${SECTIONS.map(([k, t, m]) => `<a href="#profile/${k}" class="${k === key ? 'on' : ''}" ${k === key ? 'aria-current="page"' : ''}><b>${t}</b>${m ? `<span>${m}</span>` : ''}</a>`).join('')}</nav>
      <section data-part="content" aria-live="polite"></section></div></main>`;
    const c = root.querySelector('[data-part="content"]');
    if (key === 'how-ai-works') howAI.render(c, { embedded: true });
    else if (key === 'research') research.render(c, { embedded: true });
    else if (key === 'account') account(c);
    else if (key === 'about') about(c);
    else { privacy(c); unsub = affect.on(() => { const el = root.querySelector('[data-part="camstate"]'); if (el) el.replaceWith(camState()); }); }
  },
  unmount() { if (unsub) unsub(); unsub = null; },
};

const group = (title, desc, body) => `<div class="sgroup"><div class="col" style="gap:6px"><b class="t-sub">${title}</b><p class="small mute">${desc}</p></div><div class="col" style="gap:14px">${body}</div></div>`;
const trow = (on, act, label, hint) => `<div class="trow"><button class="toggle ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-pact="${act}"></button><div class="col" style="gap:2px"><span>${label}</span>${hint ? `<span class="t-meta mute">${hint}</span>` : ''}</div></div>`;
function camState() {
  const s = affect.state; const d = document.createElement('span'); d.dataset.part = 'camstate';
  const map = { camera: ['live', 'On · processed on this device'], demo: ['attn', 'Demonstration mode · simulated values'], loading: ['paused', 'Starting camera…'], error: ['attn', 'Unavailable: ' + s.error], off: ['', 'Off'] };
  const [c, t] = map[s.mode] || map.off; d.className = 'status ' + c; d.innerHTML = `<span class="d"></span>${esc(t)}`; return d;
}

function privacy(c) {
  const P = store.s.privacy || (store.s.privacy = { saveCheckins: true, linkCheckins: true });
  const s = affect.state, camOn = s.mode === 'camera' || s.mode === 'loading';
  c.innerHTML = group('Camera', 'Optional. TRADEWISE works fully without it.', `<div data-cam></div>
      ${trow(camOn, 'camera', 'Use the camera for live affect estimates', 'Frames are analysed on this device in memory. Estimates only shape wording; they never trigger an observation or block an order.')}
      <div class="row" style="gap:8px"><button class="btn sm" data-pact="recal" ${s.mode === 'camera' ? '' : 'disabled'}>Recalibrate baseline</button><button class="btn sm" data-pact="withdraw">Withdraw camera consent</button></div>`)
    + group('What is stored', 'Exactly what is kept, where, and for how long. Nothing is uploaded to a server.', `<table class="dtable"><thead><tr><th>Data</th><th>Where</th><th>Kept for</th><th>Linked to trades</th></tr></thead><tbody>
      ${[['Camera video and images', 'Not stored', '—', 'Never'], ['Live camera estimates', 'Memory only', 'Until the session ends', 'Never'], ['Camera session timeline', 'Memory only', 'Until the session ends', 'Never'], ['Personal baseline (7 averaged values)', 'Memory only', 'Until the camera stops', 'Never'], ['Self-report check-ins', 'This browser', 'Until you delete them', 'Only if allowed below'], ['Trades, results, plan comparison', 'This browser', 'Until you delete them', '—'], ['Reflections and notes', 'This browser', 'Until you delete them', 'Yes']].map(r => `<tr>${r.map(x => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <p class="t-meta mute">“This browser” means local storage on this device. Fonts are loaded from Google Fonts; no trading or camera data is sent with that request.</p>`)
    + group('Your choices', 'Change any of these at any time.', trow(P.saveCheckins, 'saveCheckins', 'Save my check-ins', 'Needed for check-ins in Trade History and personal patterns. When off, check-ins are used only during the session.')
      + trow(P.linkCheckins, 'linkCheckins', 'Show check-ins next to trades', 'Lets Trade History and My Psychology relate your reported state to your trades.')
      + trow(voice.state.speak, 'speak', 'Read important observations aloud', 'Uses your browser’s speech synthesis. No microphone is used; there is a mute control in the header.'))
    + group('Delete data', 'Removes data from this browser immediately.', `<div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-pact="del-checkins">Delete check-ins</button><button class="btn sm" data-pact="del-history">Delete trade history</button><button class="btn sm" data-pact="start-over">Start over (delete everything)</button></div>`);
  c.querySelector('[data-cam]').replaceWith(camState());
  c.onclick = async e => {
    const b = e.target.closest('[data-pact]'); if (!b) return; const a = b.dataset.pact;
    if (a === 'camera') { if (affect.state.mode === 'camera' || affect.state.mode === 'loading') { affect.stop(); toast('Camera off. Live estimates were discarded.'); } else { const ok = await affect.startCamera(); toast(ok ? 'Camera on. Look at the screen with a relaxed face for 5 seconds to set your baseline.' : 'Camera unavailable: ' + affect.state.error); } privacy(c); }
    if (a === 'recal') { affect.calibrate(5000); toast('Calibrating for 5 seconds. Look at the screen with a relaxed face.'); }
    if (a === 'withdraw') { affect.stop(); store.s.camera.choice = 'none'; store.save(); store.log('ai', 'Camera consent withdrawn. The AI uses trading activity only.'); toast('Camera consent withdrawn. Everything else keeps working.'); privacy(c); }
    if (a === 'saveCheckins' || a === 'linkCheckins') { P[a] = !P[a]; store.save(); privacy(c); }
    if (a === 'speak') { voice.setSpeak(!voice.state.speak); privacy(c); }
    if (a === 'del-checkins') { store.s.checkins = []; store.save(); toast('Check-ins deleted.'); }
    if (a === 'del-history') { if (!confirm('Delete your simulated trades, holdings, AI input records, notes and session summaries from this browser? Your strategy and settings are kept.')) return; const keep = { profile: store.s.profile, camera: store.s.camera, voice: store.s.voice, strategies: store.s.strategies, privacy: store.s.privacy, lessonsDone: store.s.lessonsDone }; store.wipe(); Object.assign(store.s, keep); store.save(); toast('Trade history deleted. Virtual balance reset to ₹1,00,000.'); }
    if (a === 'start-over') { if (!confirm('Delete everything TRADEWISE stored in this browser and return to the welcome screen?')) return; affect.stop(); store.wipe(); location.hash = 'welcome'; }
  };
}

function account(c) {
  const pr = store.s.profile;
  c.innerHTML = group('Experience', 'Changes how much detail explanations include.', `<p>${esc(levelLabel(pr.level))}</p>`)
    + group('Help topics', 'Chosen during onboarding.', `<p>${pr.help && pr.help.length ? pr.help.map(esc).join(' · ') : 'None selected'}</p>`)
    + group('Starting preferences', 'From onboarding. Change them on the Strategy page.', pr.prefs ? `<table class="dtable"><tbody>${[['Maximum per trade', '₹' + Number(pr.prefs.maxPerTrade).toLocaleString('en-IN')], ['Maximum daily loss', '₹' + Number(pr.prefs.maxDailyLoss).toLocaleString('en-IN')], ['Trades per day', pr.prefs.tradesPerDay], ['Preferred risk level', pr.prefs.risk], ['Holding period', pr.prefs.holding]].map(([k, v]) => `<tr><td>${k}</td><td>${esc(String(v))}</td></tr>`).join('')}</tbody></table>` : '<p class="mute">Not set yet.</p>')
    + group('Set-up', 'Run the welcome and onboarding steps again.', `<a class="btn sm" href="#onboarding">Edit preferences</a>`);
}

function about(c) {
  c.innerHTML = group('Simulated trading', 'Nothing here is real money.', `<p class="ink2">TRADEWISE is an HCI research prototype. All stocks, prices, indices, balances and orders are fictional. There is no brokerage connection. Nothing here is financial advice.</p>`)
    + group('Affect estimate', 'What runs on your device.', `<p class="ink2">Face detection uses the pretrained @vladmandic/face-api (MIT). The TRADEWISE affect model (MobileNetV2; expression head trained on RAF-DB; valence/arousal from a pretrained AffectNet regressor) runs in your browser with TensorFlow.js. Live-webcam accuracy has not been validated. Estimates are not a measurement of how you feel.</p>`)
    + group('Licences', 'Third-party components.', `<p class="ink2">face-api: MIT. TradingView Lightweight Charts: Apache-2.0 (attribution kept on the chart). Inter typeface: SIL Open Font License.</p>`);
}
