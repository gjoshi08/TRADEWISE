// 01 Dashboard — implementation of Figma frame 40:39 ("01 Dashboard", page "TRADEWISE — Redesign V2").
// Layout: App header · [Selected stock 896 | AI Observer rail 440] · "The market and you" (interpretation band + two Circumplexes).
// All numbers are computed live from the simulated market, the on-device affect model and the user's own check-ins.
import { store } from '../store.js';
import { engine } from '../engine.js';
import { affect, PRESETS } from '../affect.js';
import { ai } from '../ai.js';
import { STOCKS, DEFAULT_PLAN, inr, sinr, fmt, pct, cls, esc } from '../data.js';
import { shell, nav, ICON, toast, cmaSvg, quadLabel, openDrawer, closeDrawer, obsItem, disclosure, alignment, metric, tag, status, showExplain, hideExplain, srcLabel } from '../ui.js';
import { stockPanel, panelHTML } from './stockpanel.js';
import { compute as marketCompute, trail as marketTrail, describe as marketDescribe, WEIGHTS } from '../market.js';
import { stats, prefs, checkins, GRID } from '../behaviour.js';

const D = { sym: 'SHYINFO', open: {}, bandDismissed: false, root: null, panel: null, unsub: [], mk: null, mkAt: -1, lastTwo: 0, demoOpen: false };

export const dashboard = {
  render(root) {
    D.root = root; if (nav.pendingSym && STOCKS[nav.pendingSym]) nav.sym = nav.pendingSym; nav.pendingSym = null; D.mkAt = -1;
    root.innerHTML = shell('dashboard') + `<main>
      <div class="dash-main">
        <section class="dash-left" aria-label="Selected stock">${panelHTML()}</section>
        <aside class="rail" data-part="rail" aria-label="AI Observer"></aside>
      </div>
      <section class="two" id="market-and-you" data-part="two" aria-label="The market and you"></section>
    </main>
    <div class="demo" data-part="demo"></div>`;
    D.panel = stockPanel(root.querySelector('.dash-left')); D.sym = D.panel.sym; D.panel.render();
    drawRail(); drawTwo(true); drawDemo();
    bind(root);
    D.unsub.push(ai.on(() => { drawRail(); drawTwo(); }));
    // Value updates are throttled (~1/s); a change in whether an estimate may be shown (mode, face, paused) redraws at once,
    // so a paused estimate is never displayed as current.
    D.unsub.push(affect.on(s => { const key = [s.mode, s.face, s.stale, s.quadrant === 'uncertain'].join('|'), now = Date.now();
      if (key !== D.affKey || now - D.lastTwo > 900) { D.affKey = key; drawTwo(); safeRail(); } }));
    D.unsub.push(store.on((t, d) => { if (t === 'trade' && d && d.side === 'SELL' && d.pnl < 0) { D.reflect = d.t; D.reflectDraft = { answer: null, note: '' }; }
      if (t === 'trade' || t === 'checkin' || t === 'prompt-closed') { drawRail(); drawTwo(true); D.panel.refreshPlan(); } }));
    ai.welcome();
  },
  unmount() { D.unsub.forEach(u => u()); D.unsub = []; if (D.panel) D.panel.destroy(); D.panel = null; D.root = null; },
  tick() {
    if (!D.root) return; const changed = D.panel.tick(); ai.tickNotes(D.sym);
    if (changed) { drawTwo(true); safeRail(); }
  },
};

// ---------- market + trader state ----------
const plan = () => store.s.strategies[D.sym];
function market() { const n = engine.candles(D.sym, '1m').length; if (n !== D.mkAt || !D.mk) { D.mk = marketCompute(D.sym); D.mk.trail = marketTrail(D.sym); D.mkAt = n; } return D.mk; }
function trader() {
  const s = affect.state, ck = checkins.latest();
  const camLive = (s.mode === 'camera' && s.face && !s.stale && s.quadrant !== 'uncertain') || (s.mode === 'demo' && s.quadrant !== 'uncertain');
  const ref = camLive ? { v: s.v, a: s.a, src: s.mode === 'demo' ? 'demo' : 'camera' } : ck ? { v: ck.v, a: ck.a, src: 'checkin' } : null;
  return { s, ck, camLive, ref };
}
const q4 = (v, a) => (v >= 0 ? 'pleasant' : 'unpleasant') + '-' + (a >= 0 ? 'high' : 'low');
const TQ = { 'unpleasant-high': 'Tense · stressed (upper left)', 'pleasant-high': 'Alert · excited (upper right)', 'unpleasant-low': 'Low · fatigued (lower left)', 'pleasant-low': 'Calm · relaxed (lower right)' };
const MQ = { Euphoria: 'upper right', Optimism: 'lower right', Panic: 'upper left', Apathy: 'lower left' };
// Alignment from the two Circumplex positions only (Figma 08 "Alignment" definition).
function align(m, ref) {
  if (!ref) return null;
  if (Math.abs(m.sentiment) >= 0.15 && Math.abs(ref.v) >= 0.15 && Math.sign(m.sentiment) !== Math.sign(ref.v)) return 'Mismatch';
  return q4(m.sentiment, m.activity) === q4(ref.v, ref.a) ? 'Aligned' : 'Divergent';
}
function moveText(tr, va = ['sentiment', 'activity']) {
  if (!tr || tr.length < 2) return 'Not enough history yet';
  const [a0, b0] = tr[0], [a1, b1] = tr[tr.length - 1], dv = a1 - a0, da = b1 - b0;
  if (Math.abs(dv) < 0.05 && Math.abs(da) < 0.05) return 'Little change';
  return Math.abs(da) >= Math.abs(dv) ? `Moving towards ${da > 0 ? 'higher' : 'lower'} ${va[1]}` : `Moving towards ${dv > 0 ? 'positive' : 'negative'} ${va[0]}`;
}

// ---------- AI Observer rail ----------
function topObservation() {
  const p = ai.prompt;
  if (p) return { src: 'interp', t: p.t, title: p.title, detail: p.message, prompt: p };
  const f = ai.feed.find(m => m.src === 'behaviour') || ai.feed.find(m => m.src === 'market');
  if (f) { const i = f.text.indexOf('. '); return { src: f.src, t: f.t, title: i > 0 ? f.text.slice(0, i + 1) : f.text, detail: i > 0 ? f.text.slice(i + 2) : '', feed: f }; }
  return null;
}
function drawRail() {
  const el = D.root && D.root.querySelector('[data-part="rail"]'); if (!el) return;
  const o = topObservation(), pl = plan(), st = stats(), pf = prefs(), n = ai.feed.filter(m => m.src !== 'system').length + (ai.prompt ? 0 : 0);
  let details = '';
  if (o && o.prompt) details = disclosure('evidence', 'Details', o.prompt.why || 'Why this appeared', D.open.evidence, o.prompt.observed.map(x => `<div class="kvrow"><span class="k">${esc(x.title)}</span><span class="v" style="font-weight:400">${esc(x.detail)}</span></div>`).join('') + `<p class="t-meta mute">A prompt needs a strategy deviation plus another trading signal. The camera estimate can only shape the wording.</p>`);
  else if (o) details = disclosure('evidence', 'Details', o.src === 'market' ? 'Based on simulated market data · camera not used' : 'Based on your order activity · camera not used', D.open.evidence, `<p class="small ink2">${esc(o.feed.text)}</p><p class="t-meta mute">Observations describe what happened and the data behind it. They never place, block or change an order.</p>`);
  const lossT = D.reflect && store.s.trades.find(x => x.t === D.reflect && !x.reflection);
  const obs = lossT ? reflectionBlock(lossT) : o ? obsItem(o.src, o.t, o.title, o.detail, o.prompt ? `<div class="obs-actions"><button class="btn sm" data-respond="review">Review my plan</button><button class="btn sm ghost" data-respond="dismiss">Dismiss</button></div>` : '')
    : `<div class="obs"><span class="src">TRADEWISE</span><b class="t-sub">Observing quietly</b><p class="small ink2">Nothing in your trading needs a note right now. Observations appear here with the data behind them.</p></div>`;
  const planBody = pl ? `<div class="kvrow"><span class="k">Entry · stop-loss · target</span><span class="v">${inr(pl.entry, 0)} · ${inr(pl.stop, 0)} · ${inr(pl.target, 0)}</span></div>
      <div class="kvrow"><span class="k">Maximum for ${D.sym}</span><span class="v">${inr(pl.maxInvest, 0)}</span></div>
      <div class="kvrow"><span class="k">Invested now</span><span class="v">${inr(engine.exposure(D.sym), 0)}</span></div>
      <div class="kvrow"><span class="k">Daily loss limit</span><span class="v">${inr(st.realisedLoss, 0)} used of ${inr(pf.maxDailyLoss, 0)}</span></div>
      <div class="kvrow"><span class="k">Positions opened today</span><span class="v ${st.positionsToday >= pf.tradesPerDay ? 'caution' : ''}">${st.positionsToday} of ${pf.tradesPerDay}</span></div>
      <a class="btn sm ghost" href="#strategy" style="align-self:flex-start;padding-left:0">Edit strategy</a>`
    : `<p class="small ink2">There’s no saved plan for ${D.sym}, so orders can’t be compared with one.</p><div class="row" style="gap:8px"><a class="btn sm" href="#strategy">Create a plan</a>${D.sym === 'SHYINFO' ? '<button class="btn sm ghost" data-act2="exampleplan">Use example plan</button>' : ''}</div>`;
  el.innerHTML = nowBlock() + `<div class="rblock"><div class="rhead"><b class="t-sub">AI Observer</b>${status('live', 'Observing')}</div>${obs}${details}
      <div class="row between"><button class="btn sm ghost" data-act2="allobs" style="padding-left:0">View all observations (${ai.feed.filter(m => m.src !== 'system').length})</button><span class="t-meta mute">You decide · dismiss any time</span></div></div>
    ${(store.s.profile.prefs || {}).showPlan === false ? '' : `<div class="rblock tight">${disclosure('plan', `Your plan · ${D.sym}`, pl ? `Max ${inr(pl.maxInvest, 0)} · entry ${inr(pl.entry, 0)} · stop ${inr(pl.stop, 0)} · ${st.positionsToday} of ${pf.tradesPerDay} positions today` : 'No plan saved', D.open.plan, planBody)}</div>`}`;
}
// Live redraws skip the rail while the user is typing a reflection note.
const safeRail = () => { const a = document.activeElement; if (a && a.matches && a.matches('[data-refl-note]')) return; drawRail(); };
// Figma 49:306 "Post-loss reflection" — replaces the top observation after a losing simulated sell, until dismissed.
function reflectionBlock(t) {
  const entry = [...store.s.trades].reverse().find(b => b.side === 'BUY' && b.sym === t.sym && b.t < t.t), pl = store.s.strategies[t.sym], R = D.reflectDraft || (D.reflectDraft = { answer: null, note: '' });
  const pctv = entry ? t.pnl / (entry.price * t.qty) * 100 : null;
  const exitTxt = pl ? (Math.abs(t.price - pl.stop) <= pl.stop * 0.003 ? `${inr(Math.abs(t.price - pl.stop), 0)} ${t.price >= pl.stop ? 'above' : 'below'} your stop-loss — close to plan` : t.price > pl.stop ? `Before your stop-loss (${inr(pl.stop, 0)}) was reached` : `Below your stop-loss (${inr(pl.stop, 0)})`) : 'No saved plan for this stock';
  const kv = (k, v) => `<div class="kvrow"><span class="k" style="width:72px;flex:none">${k}</span><span style="flex:1">${esc(v)}</span></div>`;
  return `<div class="obs refl"><div class="row" style="gap:8px"><span class="src">Observed behaviour</span><span class="t-meta mute">${t.clock}</span></div>
    <b class="t-sub">Position closed · ${t.sym} ${inr(t.pnl, 0)}${pctv != null ? ` (${pctv.toFixed(1)}%)` : ''}</b>
    ${kv('Trade', `${entry ? `Bought ${entry.qty} at ${inr(entry.price, 0)} · ` : ''}sold ${t.qty} at ${inr(t.price, 0)}`)}${kv('Your plan', pl ? `Stop-loss ${inr(pl.stop, 0)} · target ${inr(pl.target, 0)}` : '—')}${kv('Exit', exitTxt)}
    <div class="refl-q"><span class="t-label ink2">How did this exit relate to your plan?</span>
      <div class="row" style="gap:6px;flex-wrap:wrap">${['As planned', 'Changed my plan', 'Not sure'].map(a => `<button class="btn sm ${R.answer === a ? 'on-choice' : ''}" data-refl="${a}" aria-pressed="${R.answer === a}">${a}</button>`).join('')}</div>
      <input class="input" data-refl-note placeholder="Add a note (optional) — e.g. why you exited" value="${esc(R.note)}" aria-label="Note about this exit"></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><a class="btn sm" href="#strategy" data-refl-save>Review original strategy</a><button class="btn sm ghost" data-act2="checkin">Check in (optional)</button><button class="btn sm ghost" data-refl-done>Dismiss</button></div>
    <p class="t-meta mute">For reflection only. Trading stays available. An order in the next 15 min is noted as “Repeated trading after a loss” (prototype default).</p></div>`;
}
function saveReflection(close) {
  const t = store.s.trades.find(x => x.t === D.reflect); const R = D.reflectDraft || {};
  if (t && (R.answer || (R.note || '').trim())) { t.reflection = { answer: R.answer || null, note: (R.note || '').trim() || null, clock: engine.clockStr() }; store.save(); store.log('reflection', `Reflection on ${t.sym} exit: ${R.answer || 'no answer'}${R.note ? ' · note added' : ''}`, { sym: t.sym }); }
  if (close) { D.reflect = null; D.reflectDraft = null; drawRail(); }
}
// Figma 01 rail, first block "Market × Trader · now": both current states in one line each + alignment.
function nowBlock() {
  const m = market(), T = trader(), s = T.s, al = align(m, T.ref);
  const num = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
  const dot = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="#2E4BA8"/></svg>';
  const ring = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.75" fill="#fff" stroke="#7A4F8F" stroke-width="2.5"/></svg>';
  const sq = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" rx="1" fill="#2E4BA8" fill-opacity=".15" stroke="#2E4BA8" stroke-width="1.5"/></svg>';
  const line = (g, k, v, n) => `<div class="nowline">${g}<span class="k">${k}</span><span class="v">${esc(v)}</span><span class="n">${n}</span></div>`;
  const you = T.camLive ? line(ring, 'You (estimate)', `${s.v >= 0 ? 'Positive' : 'Negative'} · ${s.a >= 0.15 ? 'elevated' : s.a <= -0.15 ? 'low' : 'moderate'} arousal`, `${num(s.v)} / ${num(s.a)}`)
    : T.ck ? line(sq, 'You (check-in)', T.ck.label, T.ck.clock) : line(ring, 'You (estimate)', s.mode === 'camera' ? 'No face · paused' : 'Camera off', '—');
  return `<div class="rblock" aria-label="Market × Trader now"><div class="rhead"><b class="t-sub">Market × Trader</b>${alignment(al)}</div>
    ${line(dot, 'Market', marketDescribe(m.sentiment, m.activity), `${num(m.sentiment)} / ${num(m.activity)}`)}${you}
    <a class="btn sm ghost" href="#market-and-you" data-act2="compare" style="align-self:flex-start;padding-left:0">Compare both states ↓</a></div>`;
}
function openAllObservations() {
  const f = ai.feed.filter(m => m.src !== 'system');
  openDrawer(`<div class="dh"><div><span class="t-over">AI Observer</span><h2 class="t-section" style="margin-top:4px">All observations this session</h2><p class="small mute">Each item names its source. Observations never place, block or change an order.</p></div><button class="btn ghost sm" data-act="x" aria-label="Close">${ICON.x}</button></div>
    <div class="db">${f.length ? f.map(m => obsItem(m.src, m.t, m.text)).join('') : '<p class="small mute">No observations yet.</p>'}</div>`, d => d.querySelectorAll('[data-act="x"]').forEach(b => b.onclick = closeDrawer));
}

// ---------- The market and you ----------
function drawTwo(force) {
  const el = D.root && D.root.querySelector('[data-part="two"]'); if (!el) return; D.lastTwo = Date.now();
  const m = market(), T = trader(), s = T.s, al = align(m, T.ref), st = stats(), pl = plan();
  const camOn = s.mode === 'camera' || s.mode === 'demo' || s.mode === 'loading';
  // Interpretation band
  let hl, body;
  if (!T.ref) { hl = 'Your state isn’t available yet'; body = 'Turn on the camera or check in to compare your state with the market. Trading works the same either way.'; }
  else {
    const who = T.ref.src === 'checkin' ? 'your latest check-in' : T.ref.src === 'demo' ? 'the simulated estimate' : 'the camera estimate';
    hl = `Market ${m.sentiment >= 0 ? 'positive' : 'negative'}, your ${T.ref.src === 'checkin' ? 'check-in' : 'estimated state'} ${T.ref.v >= 0 ? 'positive' : 'negative'}`;
    body = `The market is showing ${marketDescribe(m.sentiment, m.activity).toLowerCase()} (${m.quadrant}), while ${who} shows ${T.ref.v >= 0 ? 'positive' : 'negative'} valence and ${T.ref.a >= 0.15 ? 'elevated' : T.ref.a <= -0.15 ? 'low' : 'moderate'} arousal.`;
    if (st.in20 >= 3) body += ` You have also placed ${st.in20} orders in the last 20 minutes.`;
    if (al === 'Mismatch' || (al === 'Divergent' && st.in20 >= 3)) body += ' You may want to review your position size and risk limits before the next order.';
    else if (al === 'Aligned' && m.activity > 0.15 && T.ref.a > 0.15) body += ' Both are in high-activity areas; aligned states are not necessarily safe, as quick decisions are more likely when activity is high.';
  }
  const R = 64, C = 80, P = (v, a) => [C + v * R, C - a * R]; const [mx, my] = P(m.sentiment, m.activity);
  const cam = T.camLive ? P(s.v, s.a) : null, ck = T.ck ? P(T.ck.v, T.ck.a) : null, refP = cam || ck;
  const overlay = `<svg width="160" height="160" viewBox="0 0 160 160" fill="none" role="img" aria-label="Both positions on the Circumplex"><circle cx="80" cy="80" r="64" fill="#F7F8FA" stroke="#E9EAED"/><path d="M16 80H144M80 16V144" stroke="#D5D7DC"/>${refP ? `<path d="M${refP[0].toFixed(1)} ${refP[1].toFixed(1)} L${mx.toFixed(1)} ${my.toFixed(1)}" stroke="#9A6416" stroke-width="1.25" stroke-dasharray="3 3"/>` : ''}<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#2E4BA8"/>${ck ? `<rect x="${(ck[0] - 4.5).toFixed(1)}" y="${(ck[1] - 4.5).toFixed(1)}" width="9" height="9" rx="1" fill="#2E4BA8" fill-opacity=".15" stroke="#2E4BA8" stroke-width="1.5"/>` : ''}${cam ? `<circle cx="${cam[0].toFixed(1)}" cy="${cam[1].toFixed(1)}" r="4.5" fill="#fff" stroke="#7A4F8F" stroke-width="2.5"/>` : ''}</svg>`;
  const gap = (a, b) => T.ref ? Math.abs(a - b).toFixed(2) : '—';
  const devToday = store.s.trades.filter(t => t.sym === D.sym && t.tag === 'Differs from plan').length, ordToday = store.s.trades.filter(t => t.sym === D.sym).length;
  const agree = T.camLive && T.ck ? (q4(s.v, s.a) === q4(T.ck.v, T.ck.a) ? 'agrees with the camera estimate' : 'differs from the camera estimate') : '';
  const evid = `<div class="disc-h" style="cursor:default"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" stroke="#737780" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="disc-l">Evidence</span><span class="disc-s">4 sources</span></div>
    <div class="erow"><span class="s">Observed behaviour<span class="w">Order activity</span></span><span class="small">${st.in20} order${st.in20 === 1 ? '' : 's'} in the last 20 minutes · usual pace not known yet</span></div>
    <div class="erow"><span class="s">Observed behaviour<span class="w">Strategy</span></span><span class="small">${!pl ? `No plan saved for ${D.sym}` : ordToday ? `${devToday} of ${ordToday} ${D.sym} orders differed from your plan today` : `No ${D.sym} orders yet today · plan saved`}</span></div>
    <div class="erow est"><span class="s">Estimated cue<span class="w">${s.mode === 'demo' ? 'Demo · simulated' : 'Camera'}</span></span><span class="small">${T.camLive ? `${quadLabel(s.quadrant)} · confidence ${s.conf >= 0.6 ? 'high' : s.conf >= 0.4 ? 'moderate' : 'low'} (${Math.round(s.conf * 100)}%)` : s.mode === 'camera' ? 'No face in view · estimate paused, not used' : 'Camera off · not used'}</span></div>
    <div class="erow user"><span class="s">User reported<span class="w">${T.ck ? 'Check-in · ' + T.ck.clock : 'Check-in'}</span></span><span class="small">${T.ck ? esc(T.ck.label) + (agree ? ' — ' + agree : '') : 'No check-in yet'}</span></div>
    <p class="t-meta mute">This is an observation, not a prompt: a prompt before an order needs a strategy deviation plus another behavioural signal. Camera and self-report only shape the wording.</p>`;
  const band = D.bandDismissed ? `<div class="band dismissed"><span class="t-over">MARKET × TRADER</span>${alignment(al)}<span class="small mute">Interpretation dismissed for this session.</span><span class="sp"></span><button class="btn sm ghost" data-act2="showband">Show again</button></div>`
    : `<div class="band" aria-label="Market × Trader interpretation"><div class="interp"><div class="row" style="gap:12px"><span class="t-over">MARKET × TRADER</span>${alignment(al)}</div>
        <h2 class="hl">${esc(hl)}</h2><p class="ink2">${esc(body)}</p>
        <div class="row" style="gap:8px;padding-top:6px">${T.ref ? '<a class="btn sm" href="#strategy">Review my plan</a><button class="btn sm ghost" data-act2="dismissband">Dismiss</button>' : '<button class="btn sm" data-act2="checkin">Check in</button>' + (camOn ? '' : '<button class="btn sm ghost" data-act="camtoggle">Turn camera on</button>')}<span class="t-meta mute">An observation to support your decision — not a prediction or financial advice.</span></div></div>
      <div class="cmp2">${overlay}<div class="gaps"><div class="metric"><span class="m-l">Valence gap</span><span class="m-v caution">${gap(m.sentiment, T.ref ? T.ref.v : 0)}</span></div><div class="metric"><span class="m-l">Arousal gap</span><span class="m-v">${gap(m.activity, T.ref ? T.ref.a : 0)}</span></div></div></div>
      <div class="evid">${evid}</div></div>`;
  // Market cell
  const inputsBody = `<table class="dtable"><thead><tr><th>Input</th><th>Current</th><th>Contribution</th></tr></thead><tbody>${m.inputs.map(x => `<tr><td>${esc(x.label)}${x.simulated ? ' <span class="t-meta mute">simulated</span>' : ''}</td><td class="${x.caution ? 'caution' : x.dir > 0 && x.key === 'momentum' ? 'up' : x.dir < 0 && x.key === 'momentum' ? 'down' : ''}">${esc(x.value)}</td><td>${x.contribution >= 0 ? '+' : '−'}${Math.abs(x.contribution).toFixed(2)} ${x.axis.startsWith('Valence') ? 'sentiment' : 'activity'}</td></tr>`).join('')}</tbody></table>
    <p class="t-meta mute">Prototype logic, not a validated measurement. Weights: momentum ${WEIGHTS.momentum}, breadth ${WEIGHTS.breadth}, news ${WEIGHTS.news} (sentiment); volume ${WEIGHTS.volume}, volatility ${WEIGHTS.volatility} (activity). <a href="#market-psychology">How it is calculated</a></p>`;
  const mcell = `<div class="cell" aria-label="Market psychology"><div class="cx">${cmaSvg({ size: 280, kind: 'market', v: m.sentiment, a: m.activity, unc: 0.08, trail: m.trail, words: true, id: 'mcma' })}
      <div class="readout">${metric('Sentiment', (m.sentiment >= 0 ? '+' : '−') + Math.abs(m.sentiment).toFixed(2))}${metric('Activity', (m.activity >= 0 ? '+' : '−') + Math.abs(m.activity).toFixed(2))}${metric('Data coverage', m.coverage)}</div></div>
    <div class="det"><b class="t-sub">Market psychology · ${D.sym}</b><span>${tag('accent', marketDescribe(m.sentiment, m.activity))}</span>
      <dl class="kvl"><dt>Quadrant</dt><dd>${m.quadrant} (${MQ[m.quadrant]})</dd><dt>Last 20 min</dt><dd>${moveText(m.trail)}</dd></dl>
      ${disclosure('inputs', 'Contributing inputs', m.inputs.map(x => `${x.label.split(' · ')[0]} ${x.value}`).join(' · '), D.open.inputs, inputsBody)}
      <p class="t-meta mute">A Circumplex-inspired interpretation of market sentiment and activity — not a measure of collective emotion.</p></div></div>`;
  // Trader cell
  const tq = T.camLive ? TQ[q4(s.v, s.a)] : null; const htr = (s.hist || []).filter(h => Date.now() - h.t <= 240000).map(h => [h.v, h.a]);
  const model = s.mode === 'camera' ? (s.engine === 'tradewise' ? `TRADEWISE affect model in your browser (${s.backend}, ~${Math.round(s.inferMs)} ms per estimate). Live-webcam accuracy has not been validated.` : 'Fallback expression heuristic (the TRADEWISE model could not load).') : s.mode === 'demo' ? 'Demonstration mode: simulated values, no camera.' : 'Camera off: no estimate is made.';
  const srcBody = `<div class="kvrow"><span class="k">Camera</span><span class="v">${s.mode === 'camera' ? 'On · this device' : s.mode === 'demo' ? 'Demo · simulated' : s.mode === 'loading' ? 'Starting…' : 'Off'}</span></div>
    ${s.mode === 'camera' ? `<div class="kvrow"><span class="k">Face and light</span><span class="v" style="font-weight:400">${esc(s.quality || '—')}</span></div><div class="kvrow"><span class="k">Personal baseline</span><span class="v">${s.calibrated ? 'Set (7 numbers, memory only)' : s.calibrating != null ? 'Calibrating…' : 'Not set'}</span></div>` : ''}
    <div class="kvrow"><span class="k">Confidence</span><span class="v">${T.camLive ? Math.round(s.conf * 100) + '% · ±' + s.unc.toFixed(2) : '—'}</span></div>
    <div class="kvrow"><span class="k">Last check-in</span><span class="v">${T.ck ? esc(T.ck.label) + ' · ' + T.ck.clock : 'None'}</span></div>
    <div class="kvrow"><span class="k">Agreement</span><span class="v ${agree.startsWith('differs') ? 'caution' : ''}">${agree ? (agree.startsWith('agrees') ? 'Camera and check-in agree' : 'Camera and check-in differ') : '—'}</span></div>
    <p class="t-meta mute">${esc(model)}</p>${s.mode === 'camera' && s.engine === 'tradewise' && s.expr && s.face && !s.stale ? `<p class="t-meta mute">Facial-configuration estimate (what the camera sees, not how you feel): ${Object.entries(s.expr).filter(([k]) => k !== 'contempt').sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, p]) => `${k}-like ${Math.round(p * 100)}%`).join(' · ')}</p>` : ''}`;
  const tcell = `<div class="cell" aria-label="Your estimated state"><div class="cx" data-part="cma">${cmaSvg({ size: 280, kind: 'trader', v: s.v, a: s.a, unc: s.unc, trail: T.camLive ? s.trail : [], words: true, active: T.camLive, id: 'tcma', self: T.ck ? { v: T.ck.v, a: T.ck.a, clock: T.ck.clock } : null })}
      <div class="readout">${metric('Valence', T.camLive ? (s.v >= 0 ? '+' : '−') + Math.abs(s.v).toFixed(2) : '—')}${metric('Arousal', T.camLive ? (s.a >= 0 ? '+' : '−') + Math.abs(s.a).toFixed(2) : '—')}${metric('Confidence', T.camLive ? (s.conf >= 0.6 ? 'High' : s.conf >= 0.4 ? 'Moderate' : 'Low') : '—')}</div>
      <span class="t-meta mute" data-part="cmanote">${T.camLive ? (s.mode === 'demo' ? 'Simulated estimate' : 'Live estimate') : s.mode === 'camera' ? 'No face · estimate paused' : 'No estimate · trading data only'}</span></div>
    <div class="det"><b class="t-sub">Your estimated state</b><span>${T.camLive ? tag('trader', (s.v >= 0 ? 'Positive' : 'Negative') + ' valence · ' + (s.a >= 0.15 ? 'elevated' : s.a <= -0.15 ? 'low' : 'moderate') + ' arousal' + (s.mode === 'demo' ? ' · simulated' : '')) : tag('n', s.mode === 'camera' ? 'Estimate paused' : 'Camera off')}</span>
      <dl class="kvl"><dt>Quadrant</dt><dd>${tq || '—'}</dd><dt>Last 20 min</dt><dd>${T.camLive ? moveText(htr, ['valence', 'arousal']) : '—'}</dd></dl>
      ${disclosure('sources', 'Sources & confidence', `Camera ${s.mode === 'camera' ? 'on' : s.mode === 'demo' ? 'demo' : 'off'}${s.mode === 'camera' && s.quality ? ' · ' + s.quality.replace(/^Face found · /, 'face found · ') : ''} · ${T.ck ? 'check-in at ' + T.ck.clock : 'no check-in'}`, D.open.sources, srcBody)}
      <div class="row" style="gap:8px"><button class="btn sm" data-act2="checkin">Check in</button><button class="btn sm ghost" data-act="camtoggle">${camOn ? 'Turn camera off' : 'Turn camera on'}</button></div>
      <p class="t-meta mute">Estimated live from facial expression on this device. Not saved after the session. Not a measure of how you feel. Your check-ins (square) are shown separately and never combined with it.</p></div></div>`;
  el.innerHTML = `<div class="two-h"><h2 class="t-section">The market and you</h2><p class="small mute">Where the market is, where you might be, and what that combination suggests. Updated as prices and your estimate change.</p></div>${band}<div class="states">${mcell}${tcell}</div>`;
}

// ---------- check-in (user-reported; separate from the camera) ----------
function openCheckin() {
  let sel = null, resp = null;
  const draw = d => { d.innerHTML = `<div class="dh"><div><span class="t-over" style="color:var(--v2-accent)">User reported</span><h2 class="t-section" style="margin-top:4px">How do you feel right now?</h2><p class="small mute">Your own words on the same two axes. Never combined with the camera estimate.</p></div><button class="btn ghost sm" data-act="x" aria-label="Close">${ICON.x}</button></div>
    <div class="db"><div class="row" style="gap:8px;align-items:stretch"><div class="col" style="justify-content:space-between;width:64px"><span class="t-meta mute">Activated</span><span class="t-meta mute">Calm</span></div><div class="ckgrid" role="radiogroup" aria-label="Valence and arousal">${GRID.map((row, r) => row.map((c, k) => `<button role="radio" aria-checked="${sel && sel[0] === r && sel[1] === k}" aria-label="${c[2]}" class="${sel && sel[0] === r && sel[1] === k ? 'on' : ''}" data-ck="${r},${k}"></button>`).join('')).join('')}</div></div>
      <div class="row between" style="width:244px;padding-left:72px"><span class="t-meta mute">Unpleasant</span><span class="t-meta mute">Pleasant</span></div>
      <p class="small">${sel ? 'Selected: <b>' + GRID[sel[0]][sel[1]][2] + '</b>' : 'Choose the cell closest to how you feel.'}</p>
      <div class="q"><span class="ql">How are you responding to market moves? (optional)</span><div class="seg boxed">${['Following my plan', 'Taking time to analyse', 'Feeling unsettled'].map(x => `<button class="${resp === x ? 'on' : ''}" data-resp="${x}">${x}</button>`).join('')}</div></div>
      <p class="t-meta mute">${(store.s.privacy || { saveCheckins: true }).saveCheckins ? 'Saved in this browser (you can turn this off in Profile → Privacy).' : 'Not saved: kept for this session only (Profile → Privacy).'}</p></div>
    <div class="df"><button class="btn" data-act="x">Cancel</button><button class="btn primary" data-save ${sel ? '' : 'disabled'}>Save check-in</button></div>`;
    d.querySelectorAll('[data-act="x"]').forEach(b => b.onclick = closeDrawer);
    d.querySelectorAll('[data-ck]').forEach(b => b.onclick = () => { sel = b.dataset.ck.split(',').map(Number); draw(d); });
    d.querySelectorAll('[data-resp]').forEach(b => b.onclick = () => { resp = resp === b.dataset.resp ? null : b.dataset.resp; draw(d); });
    const sv = d.querySelector('[data-save]'); if (sv) sv.onclick = () => { const [v, a, label] = GRID[sel[0]][sel[1]]; checkins.add({ v, a, label, responding: resp }); store.log('checkin', `Check-in: ${label}${resp ? ' · ' + resp : ''}`); closeDrawer(); toast('Check-in saved. It is shown as a square, separate from the camera estimate.'); };
  };
  openDrawer('', d => draw(d));
}

// ---------- presenter controls (kept from the previous dashboard; demonstration only) ----------
function drawDemo() {
  const el = D.root.querySelector('[data-part="demo"]'); const s = affect.state;
  el.innerHTML = `<button class="btn sm" data-act2="demo" style="border-style:dashed">Presenter controls</button>${D.demoOpen ? `<div class="demo-panel"><b class="small">Presenter controls</b><span class="small mute">Simulate market events and user actions for a demonstration.</span>
    <button class="btn sm" data-demo="plan">1 · Load the example plan (SHYINFO)</button><button class="btn sm" data-demo="buy8">2 · Buy 8 SHYINFO (within plan)</button>
    <button class="btn sm" data-demo="drop">3 · Make SHYINFO fall ~1.8%</button><button class="btn sm" data-demo="edits">4 · Draft quantity 4 → 8 → 12</button><button class="btn sm" data-demo="rally">Make KONKAN rise ~2.8%</button>
    <label class="small mute" for="demo-aff">Affect (demonstration mode)</label><select id="demo-aff" class="input" data-demo-aff>${['', ...Object.keys(PRESETS)].map(k => `<option value="${k}" ${s.mode === 'demo' && s.preset === k ? 'selected' : ''}>${k ? PRESETS[k].label : (s.mode === 'camera' ? 'Using real camera' : 'Off / choose…')}</option>`).join('')}</select>
    <label class="row small"><input type="checkbox" data-demo-away ${s.lookAway ? 'checked' : ''} ${s.mode === 'demo' ? '' : 'disabled'}> Simulate looking away (speech read-out)</label></div>` : ''}`;
}
function loadExamplePlan() { store.s.strategies.SHYINFO = { ...DEFAULT_PLAN, savedAt: engine.clockStr(), savedReal: Date.now() }; store.save(); store.log('plan', 'Saved the example strategy for SHYINFO: entry ₹1,150, stop ₹1,120, target ₹1,210, max ₹10,000', { sym: 'SHYINFO' }); toast('Example plan saved for SHYINFO.'); drawRail(); D.panel.refreshPlan(); drawTwo(true); }
function runDemo(k) {
  if (k === 'plan') loadExamplePlan();
  if (k === 'buy8') { if (!store.s.strategies.SHYINFO) loadExamplePlan(); const r = engine.order('BUY', 'SHYINFO', 8); toast(r.ok ? `Bought 8 SHYINFO at ${inr(r.trade.price)} (simulated)` : r.msg); }
  if (k === 'drop') engine.scenario('drop', 'SHYINFO');
  if (k === 'rally') { engine.scenario('rally', 'KONKAN'); toast('KONKAN is rising. Search for it in the header to view it.'); }
  if (k === 'edits') [4, 8, 12].forEach((q, i) => setTimeout(() => { ai.setDraft({ sym: 'SHYINFO', side: 'BUY', qty: q }); ai.noteEdit('SHYINFO', q); }, 600 + i * 900));
}

// ---------- events ----------
function bind(root) {
  root.addEventListener('click', async e => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.discToggle) { const k = t.dataset.discToggle; D.open[k] = !D.open[k]; if (k === 'evidence' || k === 'plan') drawRail(); else drawTwo(true); return; }
    if (t.dataset.refl) { D.reflectDraft.answer = t.dataset.refl; saveReflection(false); drawRail(); return; }
    if (t.hasAttribute('data-refl-done')) { saveReflection(true); return; }
    if (t.hasAttribute('data-refl-save')) { saveReflection(true); return; }
    if (t.dataset.respond) { ai.respond(t.dataset.respond); if (t.dataset.respond === 'review') location.hash = 'strategy'; return; }
    if (t.dataset.act === 'camtoggle') { const m = affect.state.mode; if (m === 'camera' || m === 'demo' || m === 'loading') { affect.stop(); toast('Camera off. Live estimates were discarded.'); } else { const ok = await affect.startCamera(); if (!ok) toast('Camera unavailable: ' + affect.state.error); } drawTwo(true); return; }
    const a = t.dataset.act2;
    if (a === 'allobs') { openAllObservations(); return; }
    if (a === 'compare') { e.preventDefault(); D.root.querySelector('#market-and-you').scrollIntoView({ behavior: 'smooth' }); return; }
    if (a === 'exampleplan') { loadExamplePlan(); return; }
    if (a === 'checkin') { openCheckin(); return; }
    if (a === 'dismissband') { D.bandDismissed = true; store.log('choice', 'Dismissed the Market × Trader interpretation'); drawTwo(true); return; }
    if (a === 'showband') { D.bandDismissed = false; drawTwo(true); return; }
    if (a === 'demo') { D.demoOpen = !D.demoOpen; drawDemo(); return; }
    if (t.dataset.demo) { runDemo(t.dataset.demo); return; }
  });
  root.addEventListener('input', e => { if (e.target.matches('[data-refl-note]') && D.reflectDraft) D.reflectDraft.note = e.target.value; });
  root.addEventListener('change', e => {
    if (e.target.matches('[data-refl-note]')) saveReflection(false);
    if (e.target.matches('[data-demo-aff]')) { const v = e.target.value; if (v) affect.startDemo(v); drawDemo(); }
    if (e.target.matches('[data-demo-away]')) affect.setLookAway(e.target.checked);
  });
}
