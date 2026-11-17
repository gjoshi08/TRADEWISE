// First-run flow (Figma: 00 Welcome → 00 Onboarding → 00 Camera Consent → calibration → Dashboard).
// Logic preserved from the previous version: profile level/help, camera start + 5 s personal calibration, demo mode, finish().
import { store } from '../store.js';
import { affect } from '../affect.js';
import { LEVELS, HELP_OPTIONS, esc } from '../data.js';
import { LOGO, ICON, cmaSvg, toast } from '../ui.js';

const setupHeader = step => `<div class="simbar" role="note"><b>Simulated trading · virtual money · fictional stocks and prices · no real orders are placed</b></div>
  <div class="setup-bar"><span class="logo">${LOGO}TRADEWISE</span><span class="step">${step}</span></div>`;
const G = {
  market: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.5" fill="#2E4BA8"/></svg>',
  ring: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="#fff" stroke="#7A4F8F" stroke-width="2.5"/></svg>',
  square: '<svg width="16" height="16" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" rx="1.5" fill="#2E4BA8" fill-opacity=".15" stroke="#2E4BA8" stroke-width="1.5"/></svg>',
  lines: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1.5" y="3" width="11" height="1.5" rx=".75" fill="#454952"/><rect x="1.5" y="6.25" width="8" height="1.5" rx=".75" fill="#454952"/><rect x="1.5" y="9.5" width="5" height="1.5" rx=".75" fill="#454952"/></svg>',
  obs: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M1.5 7h3l1.5-4 2 8 1.5-4h3" stroke="#9A6416" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cam: '<svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true"><rect x="1" y="3.5" width="8.5" height="7" rx="1.5" stroke="#7A4F8F" stroke-width="1.4"/><path d="m9.5 6 3.5-2v6l-3.5-2" stroke="#7A4F8F" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};

export const welcome = {
  bare: true,
  render(root) {
    const layer = (g, t, d) => `<div class="layer"><span class="g">${g}</span><div class="col" style="gap:2px"><b class="t-sub">${t}</b><p class="small ink2">${d}</p></div></div>`;
    root.innerHTML = setupHeader('Step 1 of 3') + `<main class="setup hero2">
      <div class="col" style="gap:20px">
        <span class="t-over">SIMULATED TRADING COMPANION</span>
        <h1 class="t-hero">Understand the market.<br>Understand yourself.</h1>
        <p class="ink2" style="font-size:15px;line-height:24px">TRADEWISE helps you see how three things relate before you make a decision: what the market is doing, your estimated affective state, and how you are actually trading compared with your plan.</p>
        <p class="mute">Practise with virtual money on fictional stocks. The AI observes and explains; it never places, blocks or changes an order — you decide.</p>
        <div class="row" style="gap:12px;padding-top:8px"><a class="btn primary" href="#onboarding" data-act="get-started">Get started</a><a class="btn ghost" href="#profile/privacy">How your data is handled</a></div>
        <span class="t-meta mute">About 2 minutes to set up. The camera is optional.</span>
      </div>
      <aside class="layers" aria-label="The three things TRADEWISE relates">
        <div class="pair">${cmaSvg({ size: 248, kind: 'market', v: 0.42, a: 0.58, unc: 0.08, trail: [[0.22, 0.18], [0.27, 0.28], [0.31, 0.38], [0.36, 0.48], [0.42, 0.58]], words: true, id: 'wmkt' })}${cmaSvg({ size: 248, kind: 'trader', v: -0.31, a: 0.46, unc: 0.2, trail: [[0.06, 0.02], [0.01, 0.12], [-0.12, 0.24], [-0.22, 0.37], [-0.31, 0.46]], words: true, id: 'wtrd' })}</div>
        ${layer(G.market, 'Market psychology', 'Sentiment and activity of the market, shown on a Circumplex-inspired map.')}
        ${layer(G.ring, 'Your estimated state', 'From the optional camera, live only — or from check-ins you choose to give.')}
        ${layer(G.lines, 'Your trading behaviour', 'Your orders compared with your own plan, with the data behind every observation.')}
      </aside></main>
      <footer class="setup-foot"><span>An HCI research prototype</span><span>Virtual money · fictional stocks · no real orders</span><span>Not financial advice</span></footer>`;
  },
};

export const onboarding = {
  bare: true,
  render(root) {
    const pr = store.s.profile; if (!pr.level || pr.level === 'beginner' || pr.level === 'intermediate') pr.level = 'some';
    const prefs = pr.prefs || (pr.prefs = { maxPerTrade: 10000, maxDailyLoss: 2000, tradesPerDay: 8, risk: 'Moderate', holding: 'Intraday' });
    const seg = (key, opts) => `<div class="seg boxed" role="radiogroup">${opts.map(o => `<button type="button" role="radio" aria-checked="${prefs[key] === o}" class="${prefs[key] === o ? 'on' : ''}" data-pref="${key}" data-v="${o}">${o}</button>`).join('')}</div>`;
    const draw = () => {
      root.innerHTML = setupHeader('Step 2 of 3') + `<main class="setup split s57">
        <section class="col" style="gap:24px">
          <div class="col" style="gap:6px"><span class="t-over">HOW IT WORKS</span><h1 class="t-page">What TRADEWISE does</h1><p class="ink2">A practice space for learning to trade with a plan — and for noticing how market conditions, your state and your decisions interact.</p></div>
          <div class="concepts">${[[G.market, 'Market psychology', 'A Circumplex-inspired map of market sentiment (negative → positive) and activity (low → high), built from price, volume, volatility, breadth and simulated news.'], [G.ring, 'Trader psychology', 'Your estimated state on the same two axes — from the optional camera (live only) or from check-ins you give. An estimate, never a reading of how you feel.'], [G.obs, 'AI observations', 'The AI notices what you do compared with your plan and shows the data behind each observation. It offers decision support; it never places, blocks or changes an order. You stay in control.']].map(([g, t, d]) => `<div class="c"><span style="padding-top:3px">${g}</span><div class="col" style="gap:4px"><b class="t-sub">${t}</b><p class="small ink2">${d}</p></div></div>`).join('')}</div>
        </section>
        <section class="formcard" aria-label="Your starting preferences">
          <div class="col" style="gap:4px"><h2 class="t-section">Your starting preferences</h2><p class="small mute">Used to tailor explanations and to set up your first strategy. You can change everything later in Strategy and Profile.</p></div>
          <div class="q"><span class="ql" id="lvl">Your trading experience</span><div class="seg boxed" role="radiogroup" aria-labelledby="lvl">${LEVELS.map(([k, t]) => `<button type="button" role="radio" aria-checked="${pr.level === k}" class="${pr.level === k ? 'on' : ''}" data-level="${k}">${t}</button>`).join('')}</div><span class="t-meta mute">Changes how much detail explanations include.</span></div>
          <div class="q"><span class="ql">What would you like help with?</span><div class="row" style="flex-wrap:wrap;gap:8px">${HELP_OPTIONS.map(h => `<button type="button" class="chip ${pr.help.includes(h) ? 'on' : ''}" aria-pressed="${pr.help.includes(h)}" data-help="${esc(h)}">${pr.help.includes(h) ? ICON.check : ''}${h}</button>`).join('')}</div></div>
          <div class="q"><span class="ql">Starting limits</span><div class="limits">
            ${[['maxPerTrade', 'Maximum per trade', 'Of ₹1,00,000 virtual money', '₹'], ['maxDailyLoss', 'Maximum daily loss', 'Further orders are noted', '₹'], ['tradesPerDay', 'Trades per day', 'New positions opened', '']].map(([k, l, h, pre]) => `<div class="field"><label for="p-${k}">${l}</label><div class="inwrap">${pre ? `<span class="pre">${pre}</span>` : ''}<input id="p-${k}" class="input" inputmode="numeric" data-num="${k}" value="${pre ? Number(prefs[k]).toLocaleString('en-IN') : prefs[k]}" ${pre ? '' : 'style="padding-left:10px"'}></div><span class="hint">${h}</span></div>`).join('')}
          </div><span class="t-meta mute">Prototype defaults — adjust them to suit you.</span></div>
          <div class="row" style="gap:32px;align-items:flex-start"><div class="q"><span class="ql">Preferred risk level</span>${seg('risk', ['Low', 'Moderate', 'High'])}</div><div class="q"><span class="ql">Holding period</span>${seg('holding', ['Intraday', 'A few days', 'Weeks'])}</div></div>
          <div class="actions"><a class="btn ghost" href="#welcome">Back</a><span class="sp"></span><span class="t-meta mute">Next: camera (optional)</span><button class="btn primary" data-act="next">Continue</button></div>
        </section></main>`;
      root.querySelectorAll('[data-level]').forEach(b => b.onclick = () => { pr.level = b.dataset.level; store.save(); draw(); });
      root.querySelectorAll('[data-help]').forEach(b => b.onclick = () => { const h = b.dataset.help; pr.help = pr.help.includes(h) ? pr.help.filter(x => x !== h) : [...pr.help, h]; store.save(); draw(); });
      root.querySelectorAll('[data-pref]').forEach(b => b.onclick = () => { prefs[b.dataset.pref] = b.dataset.v; store.save(); draw(); });
      root.querySelectorAll('[data-num]').forEach(i => i.onchange = () => { const v = parseInt(String(i.value).replace(/[^0-9]/g, ''), 10); if (v > 0) prefs[i.dataset.num] = v; i.value = i.dataset.num === 'tradesPerDay' ? prefs[i.dataset.num] : Number(prefs[i.dataset.num]).toLocaleString('en-IN'); store.save(); });
      root.querySelector('[data-act="next"]').onclick = () => { store.log('profile', `Profile: ${pr.level}; wants help with ${pr.help.join(', ') || 'nothing specific'}; starting limits saved`); location.hash = 'camera'; };
    };
    draw();
  },
};

export const camera = {
  bare: true,
  render(root) {
    let unsub = null;
    const draw = () => {
      const s = affect.state;
      const rows = (t, rs) => `<div class="cgroup"><span class="t-over">${t}</span>${rs.map(([a, b]) => `<div class="r"><b class="t-sub">${a}</b><p class="small ink2">${b}</p></div>`).join('')}</div>`;
      root.innerHTML = setupHeader('Step 3 of 3') + `<main class="setup split s75">
        <section class="col" style="gap:24px">
          <div class="col" style="gap:6px"><span class="t-over">CAMERA · OPTIONAL</span><h1 class="t-page">Would you like to use your camera?</h1><p class="ink2">TRADEWISE can estimate your affective state from facial cues during this session. It is entirely optional — every trading feature works without it.</p></div>
          ${rows('Why we ask', [['Context for your decisions', 'The estimate is placed next to the Market Circumplex so you can compare the two states before trading.'], ['It shapes wording only', 'Camera estimates never trigger an observation, block an order or change your plan on their own.']])}
          ${rows('What the camera does', [['Estimates valence and arousal', 'Facial cues are mapped to the Circumplex Model: valence (unpleasant ↔ pleasant) and arousal (calm ↔ activated), with a confidence level.'], ['An estimate, not a reading', 'Facial expressions do not reveal how you really feel. The estimate can be wrong — your own check-ins always carry equal weight.']])}
          ${rows('Your privacy', [['Processed on this device', 'Analysis runs locally in your browser. Nothing is sent to a server.'], ['No footage or images stored', 'Camera video and facial images are never recorded, saved or uploaded.'], ['Temporary estimates', 'Live estimates stay in memory and are discarded when the session ends. They are never linked to your trades.'], ['Off at any time', 'Turn the camera off from the header, My Psychology or Profile — at any moment.']])}
        </section>
        <section class="col" style="gap:16px" aria-label="Your choice">
          <h2 class="t-section">Choose how to continue</h2>
          <p class="small mute">Both options lead to the same dashboard. You can change this later in Profile → Privacy &amp; camera.</p>
          ${s.mode === 'error' ? `<div class="callout plan">${esc(s.error)} You can continue without the camera.</div>` : ''}
          <div class="choice"><div class="row" style="gap:10px">${G.cam}<b class="t-sub">Enable camera</b></div><ul><li>Your browser will ask for permission.</li><li>Then look at the screen with a relaxed face for ~5 s to set your personal baseline (7 numbers, memory only).</li><li>Live estimate appears next to the Market Circumplex.</li></ul>
            <button class="btn block" data-act="enable" ${s.mode === 'loading' ? 'disabled' : ''}>${s.mode === 'loading' ? 'Starting camera and loading the model…' : 'Enable camera'}</button></div>
          <div class="choice"><div class="row" style="gap:10px">${G.square}<b class="t-sub">Continue without camera</b></div><ul><li>All trading, charts, explanations and observations work as normal.</li><li>You can describe how you feel with optional check-ins.</li><li>You can enable the camera later.</li></ul>
            <button class="btn block" data-act="none">Continue without camera</button></div>
          <div class="row"><a class="btn ghost sm" href="#onboarding" style="padding-left:0">Back</a><span class="sp"></span><span class="t-meta mute">Neither option is recommended over the other.</span></div>
          <button class="btn link small" data-act="demo" style="align-self:flex-start">Presenting without a camera? Use demonstration mode (simulated values, labelled)</button>
        </section></main>`;
      root.querySelector('[data-act="enable"]').onclick = async () => { const b = root.querySelector('[data-act="enable"]'); b.textContent = 'Starting camera and loading the model…'; b.disabled = true; const ok = await affect.startCamera(); if (ok) calibrate(); else draw(); };
      root.querySelector('[data-act="none"]').onclick = () => { affect.stop(); finish('none'); };
      root.querySelector('[data-act="demo"]').onclick = () => { affect.startDemo('pleasant-low'); finish('demo'); };
    };
    const calibrate = () => {
      root.innerHTML = setupHeader('Personal baseline · 5 seconds') + `<main class="setup col" style="align-items:center;gap:20px;max-width:760px">
        <span class="t-over">Camera on · processed on this device</span>
        <h1 class="t-page" style="text-align:center">Look at the screen with a relaxed face</h1>
        <p class="ink2" style="text-align:center;max-width:62ch">Everyone’s resting face is different. TRADEWISE averages the model’s readings for five seconds and treats that as your neutral. Only seven numbers are kept, in memory, and they’re discarded when the camera turns off.</p>
        <div data-cal class="cam" style="width:420px;height:315px;border-radius:8px"></div>
        <div style="width:420px" class="col"><div class="planbar"><i data-calbar style="width:0%;background:var(--v2-accent)"></i></div><span class="small mute" data-calmsg>Looking for your face…</span></div>
        <div class="row"><button class="btn primary" data-act="done">Skip for now</button><button class="btn" data-act="recal">Recalibrate</button></div>
      </main>`;
      const box = root.querySelector('[data-cal]'); const v = affect.video; if (v) { box.appendChild(v); v.play().catch(() => { }); }
      const cv = document.createElement('canvas'); cv.width = 420; cv.height = 315; box.appendChild(cv); box.insertAdjacentHTML('beforeend', '<span class="badge">Live · on this device · not recorded</span>');
      const g = cv.getContext('2d');
      const upd = st => { const bar = root.querySelector('[data-calbar]'), msg = root.querySelector('[data-calmsg]'), done = root.querySelector('[data-act="done"]'); if (!bar) return;
        bar.style.width = (st.calibrated ? 100 : Math.round((st.calibrating || 0) * 100)) + '%';
        msg.textContent = st.calibrated ? 'Baseline set. You can continue.' : !st.face ? 'Looking for your face… move into good light.' : 'Calibrating… keep a relaxed face.';
        done.textContent = st.calibrated ? 'Continue' : 'Skip for now';
        g.clearRect(0, 0, 420, 315); if (st.box) { g.strokeStyle = '#FFFFFF'; g.lineWidth = 2; g.strokeRect(st.box.x * 420, st.box.y * 315, st.box.w * 420, st.box.h * 315); } };
      unsub = affect.on(upd);
      root.querySelector('[data-act="recal"]').onclick = () => affect.calibrate(5000);
      root.querySelector('[data-act="done"]').onclick = () => { if (unsub) unsub(); unsub = null; finish('camera'); };
    };
    const finish = c => { store.s.camera.choice = c; store.s.profile.onboarded = true; store.save(); toast(c === 'camera' ? 'Camera on. You can turn it off from the header at any time.' : c === 'demo' ? 'Demonstration mode on. Affect values are simulated.' : 'Camera off. The AI uses your trading activity only.'); location.hash = 'dashboard'; };
    this._unsub = () => { if (unsub) unsub(); unsub = null; };
    draw();
  },
  unmount() { if (this._unsub) this._unsub(); },
};
