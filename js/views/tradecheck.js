// 06 Trade Check — implementation of Figma frame 58:907. The step between pressing Buy/Sell and a simulated order.
// TRADEWISE gives input; the user decides. Both actions are always available; nothing is blocked, delayed or changed.
import { store } from '../store.js';
import { engine } from '../engine.js';
import { affect } from '../affect.js';
import { ai } from '../ai.js';
import { STOCKS, inr, esc } from '../data.js';
import { shell, nav, pageTitle, toast, quadLabel, tag } from '../ui.js';
import { signals, adherence, stats, checkins, simMinAgo } from '../behaviour.js';
import { compute as marketCompute, describe as marketDescribe } from '../market.js';

const TC = { root: null, d: null, note: '', noteOpen: false, unsub: [], k: 0 };
const tick = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="m3 7.2 2.6 2.6L11 4.4" stroke="#737780" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const warn = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.5" stroke="#9A6416" stroke-width="1.5"/><path d="M7 4.2v3.4" stroke="#9A6416" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="9.9" r=".8" fill="#9A6416"/></svg>';

export const tradeCheck = {
  render(root) {
    TC.root = root; TC.d = nav.draft || TC.d; TC.note = ''; TC.noteOpen = false;
    if (!TC.d) { root.innerHTML = shell('dashboard') + `<main class="page">${pageTitle('Trade Check', 'Before your simulated order. TRADEWISE gives input; you decide.', '', 'Dashboard  /  Trade Check')}<div class="empty"><b class="t-section">No order to check</b><p class="ink2">Choose Buy or Sell on the Dashboard. The Trade Check opens before any simulated order.</p><a class="btn sm" href="#dashboard" style="align-self:flex-start">Back to the Dashboard</a></div></main>`; return; }
    ai.setDraft({ ...TC.d });
    root.innerHTML = shell('dashboard') + `<main class="page" style="padding-top:0">${pageTitle(`Trade Check · ${TC.d.side === 'BUY' ? 'Buy' : 'Sell'} ${TC.d.sym}`, 'Before your simulated order. TRADEWISE gives input; you decide. Nothing is executed until you continue.', tag('sim', 'Simulated order'), 'Dashboard  /  Trade Check')}
      <div class="tc"><section class="tc-l" data-part="left" aria-label="Check"></section><aside class="tc-r" data-part="order" aria-label="Order"></aside></div></main>`;
    draw();
    root.addEventListener('click', onClick); root.addEventListener('input', onInput);
    TC.unsub.push(affect.on(() => drawStates()));
  },
  unmount() { TC.unsub.forEach(u => u()); TC.unsub = []; TC.root = null; },
  // Prices are live: refresh the order panel every tick and the check rows every 5 s (not while a note is being typed).
  tick(n) { if (!TC.root || !TC.d) return; drawOrderLive(); if (++TC.k % 5 === 0 && !TC.noteOpen) drawLeft(); },
};

function interpretation(d) {
  const adh = adherence(d), sig = signals(d), diffs = adh.filter(r => !r.ok), present = sig.filter(s => s.present), s = affect.state;
  if (!diffs.length && !present.length) return { tone: 'ok', title: 'This order matches your plan', text: 'No strategy differences and no behavioural signals were found for this order.', why: 'Shown for every order. Nothing here is a recommendation.' };
  const parts = [];
  for (const r of diffs) parts.push(r.rule === 'Within maximum per trade' || r.rule.startsWith('Within your') ? `it takes your ${d.sym} investment to ${r.value.replace(' vs ', ', above your ')} limit` : r.rule === 'At or near planned entry' ? `the price is above your planned entry (${r.value})` : r.rule.startsWith('Plan saved') ? `there is no saved plan for ${d.sym}` : r.rule.toLowerCase() + ` (${r.value})`);
  const sigTxt = present.map(x => x.name.toLowerCase());
  const tense = (s.mode === 'camera' || s.mode === 'demo') && s.quadrant === 'unpleasant-high';   // wording only (never a trigger)
  const title = diffs.length ? `This order differs from your plan${present.some(x => x.key === 'afterloss') ? ', and follows a recent loss' : ''}` : 'This order shows a behavioural signal';
  const text = (parts.length ? parts.map((x, i) => i ? x : x[0].toUpperCase() + x.slice(1)).join('; ') + '. ' : '') + (sigTxt.length ? `Signals present: ${sigTxt.join(', ')}. ` : '') + (tense ? 'You may want to take a moment to check the quantity before continuing.' : 'You may want to check the quantity before continuing.');
  const why = diffs.length && present.length ? 'Shown because a strategy difference occurred together with another behavioural signal.' : diffs.length ? 'Shown because this order differs from your saved plan.' : 'Shown because a behavioural signal is present.';
  return { tone: 'note', title, text, why: why + (tense ? ' Your live camera estimate (elevated arousal) only shaped the wording and is not stored with the order.' : ' The camera estimate never triggers this.') + ' Decision support, not financial advice.' };
}
function draw() { drawLeft(); drawOrder(); }
function drawLeft() {
  const d = TC.d, el = TC.root.querySelector('[data-part="left"]'), it = interpretation(d), adh = adherence(d), sig = signals(d);
  el.innerHTML = `<div class="tc-int ${it.tone}"><div class="row" style="gap:10px"><span class="t-over" style="color:${it.tone === 'ok' ? 'var(--v2-text-2)' : 'var(--v2-caution)'}">Interpretation</span><span class="t-meta mute">based on the rows below</span></div>
      <h2 class="hl">${esc(it.title)}</h2><p class="ink2">${esc(it.text)}</p><p class="t-meta mute">${esc(it.why)}</p></div>
    <div class="tc-b"><div class="tc-h"><h3 class="t-section">Your strategy</h3><span class="small mute">Observed behaviour · compared with ${store.s.strategies[d.sym] ? 'your saved plan for ' + d.sym : 'your starting limits'}</span></div>
      ${adh.map(r => `<div class="chk ${r.ok ? '' : 'diff'}">${r.ok ? tick : warn}<span class="r">${esc(r.rule)}</span><span class="v">${esc(r.value)}</span></div>`).join('')}
      ${TC.noteOpen ? `<div class="field" style="padding-top:10px"><label for="tcnote">Note about this difference (optional)</label><textarea id="tcnote" class="input" data-note placeholder="e.g. why this order differs from your plan">${esc(TC.note)}</textarea></div>` : `<button class="btn sm ghost" data-tc="note" style="padding-left:0;margin-top:8px;align-self:flex-start">+ Add a note about this difference (optional)</button>`}</div>
    <div class="tc-b"><div class="tc-h"><h3 class="t-section">Recent behaviour</h3><span class="small mute">Behavioural signals · prototype thresholds</span></div>
      ${sig.map(s => `<div class="sig ${s.present ? 'on' : ''}"><span class="dot"></span><div class="b"><b class="t-sub">${esc(s.name)}</b><span class="small">${esc(s.evidence)}</span></div><span class="t-meta mute th">Threshold: ${esc(s.threshold)}</span></div>`).join('')}</div>
    <div class="tc-b" data-part="states"></div>`;
  drawStates();
}
function drawStates() {
  const el = TC.root && TC.root.querySelector('[data-part="states"]'); if (!el) return; const d = TC.d;
  const m = marketCompute(d.sym), s = affect.state, ck = checkins.latest();
  const camLive = (s.mode === 'camera' && s.face && !s.stale && s.quadrant !== 'uncertain') || (s.mode === 'demo' && s.quadrant !== 'uncertain');
  const P = (v, a) => [64 + v * 52, 64 - a * 52]; const [mx, my] = P(m.sentiment, m.activity); const c = camLive ? P(s.v, s.a) : null, k = ck ? P(ck.v, ck.a) : null;
  const svg = `<svg width="128" height="128" viewBox="0 0 128 128" fill="none" role="img" aria-label="Market, camera estimate and check-in positions"><circle cx="64" cy="64" r="52" fill="#F7F8FA" stroke="#E9EAED"/><path d="M12 64H116M64 12V116" stroke="#D5D7DC"/><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="5" fill="#2E4BA8"/>${c ? `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="4.5" fill="#fff" stroke="#7A4F8F" stroke-width="2.5"/>` : ''}${k ? `<rect x="${(k[0] - 4.5).toFixed(1)}" y="${(k[1] - 4.5).toFixed(1)}" width="9" height="9" rx="1" fill="#2E4BA8" fill-opacity=".15" stroke="#2E4BA8" stroke-width="1.5"/>` : ''}</svg>`;
  const g = { m: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#2E4BA8"/></svg>', c: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.25" fill="#fff" stroke="#7A4F8F" stroke-width="2.5"/></svg>', k: '<svg width="12" height="12" viewBox="0 0 12 12"><rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="#2E4BA8" fill-opacity=".15" stroke="#2E4BA8" stroke-width="1.5"/></svg>' };
  const age = ck ? Math.round(simMinAgo(ck.t)) : null;
  const row = (gl, src, val, meta) => `<div class="strow">${gl}<span class="s">${src}</span><span class="val">${esc(val)}</span><span class="sp"></span><span class="t-meta mute">${esc(meta)}</span></div>`;
  el.innerHTML = `<div class="tc-h"><h3 class="t-section">States right now</h3><span class="small mute">Market, camera estimate and your check-in — shown side by side, never combined</span></div>
    <div class="row" style="gap:32px;align-items:center;padding-top:12px">${svg}<div style="flex:1">
      ${row(g.m, 'Market · ' + d.sym, marketDescribe(m.sentiment, m.activity), `sentiment ${m.sentiment >= 0 ? '+' : '−'}${Math.abs(m.sentiment).toFixed(2)} · activity ${m.activity >= 0 ? '+' : '−'}${Math.abs(m.activity).toFixed(2)}`)}
      ${row(g.c, 'Camera estimate', camLive ? quadLabel(s.quadrant) : s.mode === 'camera' ? 'No face · paused' : 'Camera off', camLive ? `confidence ${s.conf >= 0.6 ? 'high' : s.conf >= 0.4 ? 'moderate' : 'low'} (${Math.round(s.conf * 100)}%) · live, not saved with this order${s.mode === 'demo' ? ' · simulated' : ''}` : 'not used')}
      ${row(g.k, 'Your check-in', ck ? ck.label : 'No check-in yet', ck ? `${ck.clock} · ${age} min ago${age > 30 ? ' — may be out of date' : ''}` : 'optional')}
      <a class="btn sm ghost" href="#dashboard" style="padding-left:0;margin-top:8px">Check in on the Dashboard (optional)</a></div></div>`;
}
function drawOrder() {
  const d = TC.d, el = TC.root.querySelector('[data-part="order"]'), h = store.s.holdings[d.sym], pl = store.s.strategies[d.sym];
  el.innerHTML = `<div class="row between"><h2 class="t-section">${d.side === 'BUY' ? 'Buy' : 'Sell'} · ${d.sym}</h2>${tag('sim', 'Simulated')}</div>
    <div class="field"><label for="tcqty">Quantity</label><input id="tcqty" class="input" inputmode="numeric" value="${d.qty}" data-qty><span class="hint" data-live="qhint"></span></div>
    <div class="col" style="gap:8px" data-live="okv"></div>
    <div class="col tc-dec"><button class="btn block" data-tc="pause">Pause &amp; review</button><button class="btn block" data-tc="go">Continue to simulated trade</button>
      <p class="t-meta mute">Both options are always available. TRADEWISE never blocks, delays or changes an order — the decision is yours.</p></div>
    <p class="t-meta mute">Pause &amp; review opens your ${d.sym} plan and keeps this order as a draft.${d.side === 'SELL' ? ` You hold ${h ? h.qty : 0} shares.` : ''}</p>`;
  drawOrderLive();
}
function drawOrderLive() {
  const r = TC.root; if (!r) return; const d = TC.d, p = engine.price(d.sym), v = d.qty * p, pl = store.s.strategies[d.sym], pf = engine.portfolio();
  const maxPer = pl ? pl.maxInvest : (store.s.profile.prefs || { maxPerTrade: 10000 }).maxPerTrade, maxQ = Math.max(0, Math.floor((maxPer - engine.exposure(d.sym)) / p));
  const h = r.querySelector('[data-live="qhint"]'); if (h) h.textContent = d.side === 'BUY' ? `At this price, your maximum ${pl ? 'for ' + d.sym : 'per trade'} allows ${maxQ}.` : `You hold ${(store.s.holdings[d.sym] || { qty: 0 }).qty}.`;
  const o = r.querySelector('[data-live="okv"]'); if (o) o.innerHTML = [['Price', inr(p), ''], ['Order value', inr(v, 0), d.side === 'BUY' && v > maxPer ? 'caution' : ''], ['Virtual balance', `${inr(pf.cash, 0)} → ${inr(d.side === 'BUY' ? pf.cash - v : pf.cash + v, 0)}`, ''], [`Plan for ${d.sym}`, pl ? `Entry ${inr(pl.entry, 0)} · stop ${inr(pl.stop, 0)}` : 'No plan saved', 'ink2']].map(([k, val, c]) => `<div class="kvrow"><span class="k">${k}</span><span class="v ${c}">${val}</span></div>`).join('');
}
let editT = null;
function onInput(e) {
  if (e.target.matches('[data-qty]')) { const q = Math.max(0, parseInt(e.target.value, 10) || 0); TC.d.qty = q; nav.draft = TC.d; ai.setDraft({ ...TC.d }); drawOrderLive(); clearTimeout(editT); editT = setTimeout(() => { ai.noteEdit(TC.d.sym, q); drawLeft(); }, 600); }
  if (e.target.matches('[data-note]')) TC.note = e.target.value;
}
function onClick(e) {
  const b = e.target.closest('[data-tc]'); if (!b) return; const a = b.dataset.tc, d = TC.d;
  if (a === 'note') { TC.noteOpen = true; drawLeft(); const t = TC.root.querySelector('#tcnote'); if (t) t.focus(); return; }
  const differs = adherence(d).some(r => !r.ok) || signals(d).some(s => s.present);
  if (a === 'pause') { if (differs && ai.precheck({ ...d })) ai.respond('review'); else store.log('choice', `Paused to review before ${d.side === 'BUY' ? 'buying' : 'selling'} ${d.sym}`, { sym: d.sym }); nav.draft = d; store.s._planSym = d.sym; store.save(); location.hash = 'strategy'; return; }
  if (a === 'go') {
    if (!(d.qty > 0)) { toast('Choose a quantity of at least 1 share.'); return; }
    if (differs) { const p = ai.precheck({ ...d }); if (p) ai.respond('continue'); }
    const present = signals(d).filter(s => s.present).map(s => s.name), mk = marketCompute(d.sym);
    const res = engine.order(d.side, d.sym, d.qty);
    if (!res.ok) { toast(res.msg); return; }
    // Recorded with the trade: observed signals and the market state at the time (no camera data).
    res.trade.signals = present; res.trade.market = { s: +mk.sentiment.toFixed(2), a: +mk.activity.toFixed(2), q: mk.quadrant }; store.save();
    if (TC.note.trim()) { res.trade.note = TC.note.trim(); store.save(); store.log('note', `Note on ${d.side === 'BUY' ? 'buying' : 'selling'} ${d.sym}: ${TC.note.trim()}`, { sym: d.sym }); }
    toast(`${d.side === 'BUY' ? 'Bought' : 'Sold'} ${d.qty} ${d.sym} at ${inr(res.trade.price)} (simulated)`);
    nav.draft = null; TC.d = null; ai.setDraft(null); location.hash = 'dashboard';
  }
}
