import { RULES, ruleFor } from '../ai.js';
import { RESEARCH, esc, clamp } from '../data.js';
import { shell, cmaSvg, quadLabel, ICON } from '../ui.js';

const quad = (v, a, conf) => conf < 0.4 || (Math.abs(v) < 0.15 && Math.abs(a) < 0.15) ? 'uncertain' : `${v >= 0 ? 'pleasant' : 'unpleasant'}-${a >= 0 ? 'high' : 'low'}`;

export const howAI = {
  render(root, opts = {}) {
    const S = { v: 0.5, a: 0.5, conf: 0.65, dev: true, churn: true, market: false };
    root.innerHTML = (opts.embedded ? '' : shell('profile')) + `<main class="${opts.embedded ? '' : 'page'}"><div class="col" style="gap:30px">
      <div><span class="eyebrow ai">How the AI decides</span><h1 class="h-l" style="margin-top:6px">Observe → interpret → offer input → you decide</h1>
        <p class="lead" style="margin-top:8px">Input appears only when your trading differs from your saved plan <b>and</b> another trading signal is present, or when you place an order that differs from your plan. The optional affect estimate changes only the wording. It never triggers input by itself, and the AI never places, blocks or changes an order.</p></div>
      <section class="panel" style="padding:26px"><div class="grid2" style="grid-template-columns:auto 1fr;gap:34px;align-items:start">
        <div class="col" style="gap:10px;align-items:center"><div id="cmawrap" style="cursor:crosshair;touch-action:none"></div><span class="small mute">Drag the point to try an affect estimate</span>
          <label class="small" style="width:100%">Confidence <b class="num" data-o="conf"></b><input type="range" min="0" max="100" value="65" data-k="conf" style="width:100%"></label></div>
        <div class="col" style="gap:16px"><b class="h-s">Try the decision rules</b>
          <div class="col" style="gap:8px">${[['dev', 'Draft order differs from the saved plan'], ['churn', 'Order size changed 3+ times in 2 minutes'], ['market', 'Price moved 1.2%+ in 5 minutes']].map(([k, l]) => `<label class="row small" style="gap:10px"><input type="checkbox" data-k="${k}" ${S[k] ? 'checked' : ''}> ${l}</label>`).join('')}</div>
          <div data-o="result"></div></div></div></section>
      <section class="panel" style="padding:26px"><b class="h-s">The five affect rules</b><p class="small mute" style="margin:4px 0 14px">Based on Russell’s Circumplex Model of Affect (valence × arousal).</p>
        <table class="ruletable"><thead><tr><th>Rule</th><th>Estimate</th><th>What the AI does</th></tr></thead><tbody data-o="rules"></tbody></table></section>
      <div class="grid2">
        <section class="panel" style="padding:26px"><b class="h-s">What is real and what is simulated</b><ul class="col" style="gap:10px;margin:14px 0 0 18px;font-size:14.5px">
          <li><b>Real:</b> face detection, 68 landmarks and expression probabilities from the pretrained open-source <b>@vladmandic/face-api</b> (MIT), running in your browser. It was not trained for TRADEWISE.</li>
          <li><b>Heuristic:</b> mapping expression probabilities onto valence/arousal with fixed coordinates. This is not a validated emotion measure, so confidence and uncertainty are always shown.</li>
          <li><b>Real:</b> rule-based detection of plan deviation, repeated order changes and fast price moves.</li>
          <li><b>Simulated:</b> all stocks, prices, balances and orders. Demonstration mode values are simulated and labelled.</li>
          <li><b>Browser APIs:</b> speech synthesis reads important alerts aloud (can be muted). There is no microphone and no speech recognition.</li></ul></section>
        <section class="panel" style="padding:26px"><b class="h-s">Privacy</b><ul class="col" style="gap:10px;margin:14px 0 0 18px;font-size:14.5px">
          <li>The camera is optional. You can continue without it and turn it off at any time.</li>
          <li>Video frames are processed on this device and never recorded, uploaded or stored.</li>
          <li>No model is trained on your face. No facial data is collected.</li>
          <li>Estimates are never shown as facts about how you feel, and they’re not kept between sessions.</li>
          <li>No microphone is used. Spoken alerts use your browser’s speech synthesis and can be muted.</li></ul></section></div>
    </div></main>`;
    const wrap = root.querySelector('#cmawrap');
    const draw = () => {
      wrap.innerHTML = cmaSvg({ size: 300, v: S.v, a: S.a, unc: 0.12 + (1 - S.conf) * 0.4, words: true, id: 'playcma' });
      const q = quad(S.v, S.a, S.conf), rule = ruleFor(q); const trig = S.dev && (S.churn || S.market);
      let wording = 'Your recent trading activity differs from your original strategy. Before increasing your position, would you like to review your plan?';
      if (rule === 'B') wording = 'Before increasing your position, would you like to check your original investment limit?';
      if (rule === 'D' && S.churn) wording = 'Your order quantity has changed several times. Would you like to review your original strategy before continuing?';
      root.querySelector('[data-o="conf"]').textContent = Math.round(S.conf * 100) + '%';
      root.querySelector('[data-o="result"]').innerHTML = `<div class="callout n"><span>Estimate: <b>${quadLabel(q)}</b> → rule <b>${rule}</b></span></div>
        ${trig ? `<div class="intervene" style="padding:16px"><span class="eyebrow ai">AI input would appear</span><p style="margin-top:6px">“${esc(wording)}”</p><span class="small mute">Buttons: Review Strategy · Continue. Nothing is blocked.</span></div>`
          : `<div class="callout ai"><span><b>No input.</b> ${S.dev ? 'A plan deviation alone shows a quiet note in the feed. A second trading signal is needed before the AI offers input (or you press Place order).' : 'Your activity matches your plan, so the AI stays quiet, whatever the affect estimate says.'}</span></div>`}`;
      root.querySelector('[data-o="rules"]').innerHTML = Object.entries(RULES).map(([k, r]) => `<tr class="${k === rule ? 'on' : ''}"><td><b>${k}</b></td><td>${r.name}</td><td>${esc(r.action)}</td></tr>`).join('');
    };
    const move = e => { const svg = wrap.querySelector('svg'); const b = svg.getBoundingClientRect(); const R = b.width / 2 - 26; S.v = clamp((e.clientX - b.left - b.width / 2) / R, -1, 1); S.a = clamp(-(e.clientY - b.top - b.height / 2) / R, -1, 1); const m = Math.hypot(S.v, S.a); if (m > 1) { S.v /= m; S.a /= m; } draw(); };
    let drag = false; wrap.addEventListener('pointerdown', e => { drag = true; wrap.setPointerCapture(e.pointerId); move(e); }); wrap.addEventListener('pointermove', e => drag && move(e)); wrap.addEventListener('pointerup', () => drag = false);
    root.querySelectorAll('[data-k]').forEach(i => i.addEventListener('input', () => { const k = i.dataset.k; S[k] = k === 'conf' ? i.value / 100 : i.checked; draw(); }));
    draw();
  },
};

const bars = (rows, n = RESEARCH.n, color = 'var(--ink)') => { const max = Math.max(...rows.map(r => r[1])); return `<div class="col" style="gap:10px">${rows.map(([l, c]) => `<div><div class="row between small"><span>${esc(l)}</span><b class="num">${c}</b></div><div class="hbar"><i style="width:${c / max * 100}%;background:${color}"></i></div></div>`).join('')}</div>`; };
export const research = {
  render(root, opts = {}) {
    const R = RESEARCH;
    root.innerHTML = (opts.embedded ? '' : shell('profile')) + `<main class="${opts.embedded ? '' : 'page'}"><div class="col" style="gap:28px">
      <div><span class="eyebrow">Research behind TRADEWISE</span><h1 class="h-l" style="margin-top:6px">What ${R.n} survey respondents told us</h1><p class="lead" style="margin-top:8px">Counts from the project’s user survey (n = ${R.n}). Only aggregate counts are shown. No names, emails or individual answers.</p></div>
      <div class="grid3">
        <div class="panel" style="padding:20px"><span class="small mute">Said personalised, simple explanations would help</span><div class="statbig">${R.explanationsUseful.yes}<span class="mute" style="font-size:22px">/${R.n}</span></div><span class="small mute">${R.explanationsUseful.maybe} maybe · ${R.explanationsUseful.no} no</span></div>
        <div class="panel" style="padding:20px"><span class="small mute">Of those who have traded, regretted an impulsive decision occasionally</span><div class="statbig">${R.impulsiveRegretTraded.occasionally}<span class="mute" style="font-size:22px">/${R.traded}</span></div><span class="small mute">${R.impulsiveRegretTraded.rarely} rarely · ${R.impulsiveRegretTraded.never} never</span></div>
        <div class="panel" style="padding:20px"><span class="small mute">Found an AI that notices trading behaviour useful</span><div class="statbig">${R.aiUseful.yes}<span class="mute" style="font-size:22px">/${R.n}</span></div><span class="small mute">${R.aiUseful.maybe} maybe · ${R.aiUseful.no} no</span></div>
      </div>
      <div class="grid2">
        <section class="panel" style="padding:24px"><b class="h-s">Trading experience</b><div style="margin-top:14px">${bars(R.experience)}</div></section>
        <section class="panel" style="padding:24px"><b class="h-s">Biggest difficulties <span class="small mute">(multi-select)</span></b><div style="margin-top:14px">${bars(R.difficulties)}</div></section>
        <section class="panel" style="padding:24px"><b class="h-s">Situations people had experienced <span class="small mute">(multi-select)</span></b><div style="margin-top:14px">${bars(R.situations, R.n, 'var(--plan)')}</div></section>
        <section class="panel" style="padding:24px"><b class="h-s">Plan before trading?</b><div style="margin-top:14px">${bars([['Always', R.planBeforeTrade.always], ['Sometimes', R.planBeforeTrade.sometimes], ['Rarely', R.planBeforeTrade.rarely], ['Never', R.planBeforeTrade.never]])}</div></section>
      </div>
      <section class="panel" style="padding:24px"><b class="h-s">How the findings shaped the design</b><table class="ruletable" style="margin-top:10px"><tbody>
        <tr><td><b>Beginner learning matters</b></td><td>${R.experience[0][1]} of ${R.n} have never traded, ${R.difficulties[1][1]} found charts and indicators hard, ${R.difficulties[2][1]} price movements and ${R.difficulties[4][1]} financial terminology, so <a href="#markets">Learn</a> comes before trading and is ordered by the topics you pick.</td></tr>
        <tr><td><b>Strategy before trading</b></td><td>Only ${R.planBeforeTrade.always} always plan, and ${R.impulsiveRegretTraded.occasionally} of the ${R.traded} who have traded regretted an impulsive decision, so <a href="#strategy">Plan</a> captures entry, stop-loss, target, limit and reason, and the AI compares every order with it.</td></tr>
        <tr><td><b>Contextual, not intrusive</b></td><td>${R.aiUseful.yes} said yes, ${R.aiUseful.maybe} maybe and ${R.aiUseful.no} no to a behaviour-aware AI, so input appears only on combined trading signals, is never blocking, and the camera is optional.</td></tr>
        <tr><td><b>Explain why a prompt appears</b></td><td>${R.explanationsUseful.yes} wanted simple explanations (and ${R.explanationsUseful.maybe} said maybe), so each AI input lists what was observed, the plan versus the order, and “Why did this appear?”.</td></tr>
        <tr><td><b>Not intimidating</b></td><td>The most common barrier was not feeling confident (${R.barriers[0][1]}), so the interface uses plain language, generous spacing and virtual money.</td></tr></tbody></table>
        <p class="small mute" style="margin-top:12px">Note: the number of “never traded” answers differs slightly between questions (7 or 6), so counts are reported per question.</p></section>
    </div></main>`;
  },
};
