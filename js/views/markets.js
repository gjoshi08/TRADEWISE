// 02 Markets — implementation of Figma frame 52:337. Discovery (4 col, 440) · Stock analysis (8 col, 896).
import { engine } from '../engine.js';
import { STOCKS, WATCH, NEWS, fmt, pct, esc } from '../data.js';
import { shell, nav, cmaSvg, metric, tag, toast } from '../ui.js';
import { stockPanel, panelHTML, rsiText, smaText, vwapText } from './stockpanel.js';
import { compute as marketCompute, trail as marketTrail, describe as marketDescribe } from '../market.js';
import { inr } from '../data.js';

const M = { list: 'Watchlist', q: '', root: null, panel: null, mkAt: -1 };
const LISTS = ['Watchlist', 'Top movers', 'IT services', 'All stocks'];
const MQ = { Euphoria: 'upper-right', Optimism: 'lower-right', Panic: 'upper-left', Apathy: 'lower-left' };

export const markets = {
  render(root) {
    M.root = root; if (nav.pendingSym && STOCKS[nav.pendingSym]) nav.sym = nav.pendingSym; nav.pendingSym = null; M.mkAt = -1;
    root.innerHTML = shell('markets') + `<main><div class="mk-body">
      <section class="mk-disc" aria-label="Discovery">
        <form class="search block" data-form="mksearch" role="search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input name="q" placeholder="Search stocks or sectors" aria-label="Search stocks or sectors" autocomplete="off" value="${esc(M.q)}"></form>
        <div class="seg" role="tablist" aria-label="Lists" data-part="lists"></div>
        <div class="wlist" data-part="list" role="list"></div>
        <button class="btn sm ghost" data-mk="add" style="align-self:flex-start;padding-left:0">+ Add to watchlist</button>
        <div class="mk-psy" data-part="psy"></div>
      </section>
      <section class="mk-main" aria-label="Stock analysis">${panelHTML()}<div class="mk-in" data-part="inews"></div></section>
    </div></main>`;
    M.panel = stockPanel(root.querySelector('.mk-main')); M.panel.render();
    drawLists(); drawList(); drawPsy(); drawIN();
    root.addEventListener('click', onClick); root.addEventListener('input', onInput);
    root.querySelector('[data-form="mksearch"]').addEventListener('submit', e => { e.preventDefault(); const r = filtered()[0]; if (r) select(r); });
  },
  unmount() { if (M.panel) M.panel.destroy(); M.panel = null; M.root = null; },
  tick() { if (!M.root) return; const changed = M.panel.tick(); liveList(); if (changed) { drawPsy(); drawIN(); } },
};

function filtered() {
  const q = M.q.trim().toLowerCase(); let xs = [...WATCH];
  if (M.list === 'Top movers') xs.sort((a, b) => Math.abs(engine.change(b)) - Math.abs(engine.change(a)));
  if (M.list === 'IT services') xs = xs.filter(s => STOCKS[s].sector === 'IT services');
  if (q) xs = xs.filter(s => s.toLowerCase().includes(q) || STOCKS[s].name.toLowerCase().includes(q) || STOCKS[s].sector.toLowerCase().includes(q));
  return xs;
}
function drawLists() { M.root.querySelector('[data-part="lists"]').innerHTML = LISTS.map(l => `<button role="tab" aria-selected="${M.list === l}" class="${M.list === l ? 'on' : ''}" data-list="${l}">${l}</button>`).join(''); }
function drawList() {
  const xs = filtered(), el = M.root.querySelector('[data-part="list"]');
  el.innerHTML = xs.length ? xs.map(s => `<button class="irow ${s === M.panel.sym ? 'on' : ''}" role="listitem" data-sym="${s}"><span class="id"><b>${s}</b><span>${esc(STOCKS[s].name)}</span></span><span class="qt"><span class="p" data-wp="${s}"></span><span class="c" data-wc="${s}"></span></span></button>`).join('')
    : `<p class="small mute" style="padding:12px">No simulated stock matches “${esc(M.q)}”.</p>`;
  liveList();
}
function liveList() { for (const s of WATCH) { const p = M.root.querySelector(`[data-wp="${s}"]`), c = M.root.querySelector(`[data-wc="${s}"]`); if (p) p.textContent = fmt(engine.price(s)); if (c) { const ch = engine.change(s); c.textContent = pct(ch); c.className = 'c ' + (ch >= 0 ? 'up' : 'down'); } } }
function select(sym) { M.panel.setSym(sym); drawList(); drawPsy(); drawIN(); }

function drawPsy() {
  const sym = M.panel.sym, m = marketCompute(sym), tr = marketTrail(sym);
  const sv = m.inputs.find(x => x.key === 'momentum'), br = m.inputs.find(x => x.key === 'breadth'), vo = m.inputs.find(x => x.key === 'volume');
  const why = `${sv.dir >= 0 ? 'Rising' : 'Falling'} price over five days (${sv.value}), ${br.value.replace(' up', ' stocks up')} and ${vo.value} the session’s average volume place ${sym} in the ${MQ[m.quadrant]} (${m.quadrant.toLowerCase()}) area. ${movement(tr)}`;
  M.root.querySelector('[data-part="psy"]').innerHTML = `<div class="row" style="gap:8px"><b class="t-sub" style="flex:1">Market psychology · ${sym}</b>${tag('accent', marketDescribe(m.sentiment, m.activity))}</div>
    <div class="cx">${cmaSvg({ size: 280, kind: 'market', v: m.sentiment, a: m.activity, unc: 0.08, trail: tr, words: true, id: 'mkcma' })}<div class="readout">${metric('Sentiment', sgn(m.sentiment))}${metric('Activity', sgn(m.activity))}${metric('Data coverage', m.coverage)}</div></div>
    <p class="small ink2">${esc(why)}</p>
    <a class="btn sm ghost" href="#market-psychology" style="align-self:flex-start;padding-left:0">Open Market Psychology →</a>
    <p class="t-meta mute">A Circumplex-inspired interpretation of market sentiment and activity — not a measure of collective emotion.</p>`;
}
const sgn = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
function movement(tr) { const [a, b] = [tr[0], tr[tr.length - 1]]; const dv = b[0] - a[0], da = b[1] - a[1]; if (Math.abs(dv) < 0.05 && Math.abs(da) < 0.05) return 'The position has changed little over the last 20 minutes.'; return Math.abs(da) >= Math.abs(dv) ? `Activity has ${da > 0 ? 'increased' : 'decreased'} over the last 20 minutes.` : `Sentiment has turned more ${dv > 0 ? 'positive' : 'negative'} over the last 20 minutes.`; }

function drawIN() {
  const sym = M.panel.sym, I = M.panel.indicators(), now = engine.clockStr();
  const rows = [['RSI 14', I.r == null ? '—' : I.r.toFixed(0), I.r == null ? 'Not enough candles yet.' : rsiText(I.r)], ['SMA 20', I.sma20 ? inr(I.sma20) : '—', I.sma20 ? smaText(I.p, I.sma20) : ''], ['VWAP', I.vw ? inr(I.vw) : '—', I.vw ? vwapText(I.p, I.vw) : ''],
    ['Volume', I.vr.toFixed(1) + '× avg', `Shares traded in the last 30 minutes compared with this session’s average — ${I.vr > 1.2 ? 'more participants than normal' : I.vr < 0.8 ? 'fewer participants than normal' : 'ordinary participation'}.`],
    ['ATR 14', I.atrPct.toFixed(2) + '%', `Typical range of a five-minute candle. This session’s usual range is ${I.atrUsual} — prices are moving ${I.m.inputs.find(x => x.key === 'volatility').caution ? 'more than' : 'about as much as'} normal.`]];
  const news = (NEWS[sym] || []).filter(n => n[0] <= now).slice().reverse();
  const tone = s => s > 0 ? ['up', 'Positive'] : s < 0 ? ['down', 'Negative'] : ['n', 'Mixed'];
  M.root.querySelector('[data-part="inews"]').innerHTML = `<div class="mk-ind"><div class="row" style="gap:8px;padding-bottom:8px;align-items:baseline"><b class="t-sub">Technical indicators</b><span class="t-meta mute">in plain language</span></div>
      ${rows.map(([n, v, e]) => `<div class="indrow"><div class="k"><span class="t-label mute">${n}</span><span class="t-num">${v}</span></div><p class="small ink2">${esc(e)}</p></div>`).join('')}
      <p class="t-meta mute">General explanations — not signals to buy or sell.</p></div>
    <div class="mk-news"><div class="row" style="gap:8px;padding-bottom:8px"><b class="t-sub">News</b>${tag('n', 'Simulated headlines')}</div>
      ${news.length ? news.map(n => { const [c, l] = tone(n[2]); return `<div class="nrow"><p class="small">${esc(n[1])}</p><div class="row" style="gap:8px"><span class="t-meta mute">${n[0]}</span>${tag(c, l)}</div></div>`; }).join('') : '<p class="small mute" style="padding:10px 0;border-top:1px solid var(--v2-border)">No simulated headlines yet today.</p>'}
      <p class="t-meta mute">Sentiment tags are generated by the simulation and feed the Market Circumplex (news sentiment input).</p></div>`;
}
function onClick(e) {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.list) { M.list = t.dataset.list; drawLists(); drawList(); }
  else if (t.dataset.sym) select(t.dataset.sym);
  else if (t.dataset.mk === 'add') toast(`All ${WATCH.length} simulated stocks are already in your watchlist.`);
}
function onInput(e) { if (e.target.closest('[data-form="mksearch"]')) { M.q = e.target.value; drawList(); } }
