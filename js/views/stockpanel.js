// Shared "Selected stock" column used by 01 Dashboard (40:39) and 02 Markets (52:337):
// stock header · chart toolbar · 384 px price chart · key-data row with ⓘ explanations.
import { store } from '../store.js';
import { engine } from '../engine.js';
import { STOCKS, inr, sinr, pct, cls, esc } from '../data.js';
import { nav, ICON, metric, tag, showExplain, hideExplain } from '../ui.js';
import { makeChart } from '../chart.js';
import { group, smaSeries, rsi, vwap } from '../indicators.js';
import { compute as marketCompute } from '../market.js';

const TF = { '1D': null, '1W': 6, '1M': 22, '3M': 91 };
export const panelHTML = () => `<div class="shead" data-part="head"></div><div class="toolbar" data-part="toolbar"></div><div class="dchart" data-part="chart" aria-label="Price chart, simulated"></div><div class="keydata" data-part="keydata"></div>`;

export function stockPanel(el, { onPlanChange } = {}) {
  const P = { sym: nav.sym || 'SHYINFO', tf: '1D', sma: true, chart: null, mk: null, mkAt: -1, EX: {} };
  const q = s => el.querySelector(s);
  const plan = () => store.s.strategies[P.sym];
  const market = () => { const n = engine.candles(P.sym, '1m').length; if (n !== P.mkAt || !P.mk) { P.mk = marketCompute(P.sym); P.mkAt = n; } return P.mk; };
  function explanation() {
    const p = engine.price(P.sym), ch = engine.change(P.sym), c1 = engine.candles(P.sym, '1m');
    const hi = Math.max(...c1.map(c => c.high)), lo = Math.min(...c1.map(c => c.low)), rng = hi - lo || 1, vr = market().volRatio;
    let t = `${ch >= 0 ? 'Up' : 'Down'} ${Math.abs(ch).toFixed(2)}% today`;
    if (vr >= 1.3) t += ` on about ${vr.toFixed(1)}× this session’s usual volume`; else if (vr <= 0.7) t += ' on lighter volume than usual';
    if (p - lo > rng * 0.6 && ch < 0.5) t += `, recovering from a low of ${inr(lo)}`; else if (hi - p > rng * 0.6) t += `, below today’s high of ${inr(hi)}`;
    t += '.'; const pl = plan();
    if (pl) { const d = (p - pl.entry) / pl.entry * 100; t += Math.abs(d) < 0.3 ? ' Now trading at your planned entry.' : ` Now ${Math.abs(d).toFixed(1)}% ${d > 0 ? 'above' : 'below'} your planned entry.`; }
    else t += ` No plan saved for ${P.sym}.`;
    return t;
  }
  function drawHead() {
    const s = STOCKS[P.sym];
    q('[data-part="head"]').innerHTML = `<div class="id"><div class="nm"><h1 class="t-section">${esc(s.name)}</h1><span class="t-label mute">${s.sym} · NSE</span>${tag('n', 'Simulated')}</div>
      <div class="pr"><span class="t-price" data-live="price"></span><span class="t-num" data-live="chg"></span><span class="t-meta mute" data-live="clock"></span></div>
      <div class="mexpl"><span data-live="expl"></span><button class="info" data-explain="move" aria-label="How this move is described">${ICON.info}</button></div></div>
      <span class="sp"></span><div class="row" style="gap:8px"><span class="t-meta mute">Opens Trade Check first</span><button class="btn sm" data-order="SELL">Sell</button><button class="btn sm primary" data-order="BUY">Buy</button></div>`;
    liveHead();
  }
  function liveHead() {
    const s = STOCKS[P.sym], p = engine.price(P.sym), ch = engine.change(P.sym);
    const set = (k, v, c) => { const e = q(`[data-live="${k}"]`); if (e) { e.textContent = v; if (c != null) e.className = c; } };
    set('price', inr(p)); set('chg', `${sinr(p - s.prev)}  ${pct(ch)}`, 't-num ' + cls(ch)); set('clock', 'today · ' + engine.clockStr());
  }
  function drawToolbar() {
    const pl = plan(); const L = (c, t) => `<span><i style="background:${c}"></i>${t}</span>`;
    q('[data-part="toolbar"]').innerHTML = `<div class="seg" role="group" aria-label="Time range">${Object.keys(TF).map(k => `<button class="${P.tf === k ? 'on' : ''}" data-tf="${k}" aria-pressed="${P.tf === k}">${k}</button>`).join('')}<button disabled title="The simulated history covers 90 days">1Y</button><button disabled title="The simulated history covers 90 days">5Y</button></div>
      <span class="sp"></span><div class="legend">${P.sma ? L('#2E4BA8', 'SMA 20') : ''}${pl ? L('#737780', 'Entry ' + inr(pl.entry, 0)) + L('#B8433B', 'Stop ' + inr(pl.stop, 0)) + L('#1F7A55', 'Target ' + inr(pl.target, 0)) : ''}</div>
      <div class="seg"><button data-indicators aria-pressed="${P.sma}" title="Show or hide the 20-period moving average">Indicators</button></div>`;
  }
  const bars = () => P.tf === '1D' ? group(engine.candles(P.sym, '1m'), 5) : engine.candles(P.sym, '1D');
  function setChart(fit) {
    if (!P.chart) return; const all = bars(), n = TF[P.tf], shown = n ? all.slice(-n) : all;
    P.chart.set(shown); P.chart.levels(plan()); P.chart.sma(smaSeries(all, 20).filter(x => x.time >= shown[0].time)); P.chart.smaVisible(P.sma);
    if (fit) P.chart.fit();
  }
  function indicators() {
    const c1 = engine.candles(P.sym, '1m'), c5 = group(c1, 5), s = STOCKS[P.sym], p = engine.price(P.sym), m = market();
    const r = rsi(c5.map(b => b.close), 14), sm = smaSeries(c5, 20), sma20 = sm.length ? sm[sm.length - 1].value : null, vw = vwap(c1);
    return { c1, s, p, m, r, sma20, vw, hi: Math.max(...c1.map(c => c.high)), lo: Math.min(...c1.map(c => c.low)), vr: m.volRatio, atrPct: m.atrPct, atrUsual: m.inputs.find(x => x.key === 'volatility').usual };
  }
  function drawKey() {
    const I = indicators(), { s, p, r, sma20, vw, vr } = I;
    P.EX = {
      move: ['Today’s move', pct(engine.change(P.sym)), 'Change since yesterday’s close, how busy trading is compared with this session, and where the price sits in today’s range.', explanation()],
      prev: ['Previous close', inr(s.prev), 'Yesterday’s closing price. Today’s change is measured from it.', `The price is ${Math.abs((p - s.prev) / s.prev * 100).toFixed(2)}% ${p >= s.prev ? 'above' : 'below'} it.`],
      volume: ['Volume', vr.toFixed(1) + '× avg', 'Shares traded in the last 30 minutes compared with this session’s average.', vr > 1.2 ? 'More participants than usual right now.' : vr < 0.8 ? 'Fewer participants than usual right now.' : 'Ordinary participation.'],
      rsi: ['RSI 14', r == null ? '—' : r.toFixed(0), 'Compares recent up-moves with down-moves on a 0–100 scale. Readings above 70 are often described as stretched, below 30 as weak.', r == null ? '' : rsiText(r)],
      sma: ['SMA 20', sma20 ? inr(sma20) : '—', 'The average of the last 20 five-minute closes.', sma20 ? smaText(p, sma20) : ''],
      vwap: ['VWAP', vw ? inr(vw) : '—', 'The average price paid today, weighted by volume.', vw ? vwapText(p, vw) : ''],
    };
    const cells = [['Open', inr(s.open)], ['High', inr(I.hi)], ['Low', inr(I.lo)], ['Prev. close', inr(s.prev), 'prev'], ['Volume', vr.toFixed(1) + '× avg', 'volume'], ['RSI 14', r == null ? '—' : r.toFixed(0), 'rsi'], ['SMA 20', sma20 ? inr(sma20) : '—', 'sma'], ['VWAP', vw ? inr(vw) : '—', 'vwap']];
    q('[data-part="keydata"]').innerHTML = cells.map(([l, v, e]) => `<div>${metric(l, v, e)}</div>`).join('');
    const ex = q('[data-live="expl"]'); if (ex) ex.textContent = explanation();
  }
  const api = {
    get sym() { return P.sym; }, market, plan, indicators,
    render() { drawHead(); drawToolbar(); P.chart = makeChart(q('[data-part="chart"]'), { height: 384 }); setChart(true); drawKey(); },
    setSym(s) { P.sym = s; nav.sym = s; P.mkAt = -1; drawHead(); drawToolbar(); setChart(true); drawKey(); },
    refreshPlan() { drawToolbar(); setChart(false); drawKey(); },
    tick() { liveHead(); if (P.chart && P.tf === '1D') { const b = group(engine.candles(P.sym, '1m'), 5); P.chart.update(b[b.length - 1]); } const n = engine.candles(P.sym, '1m').length; if (n !== P.mkAt) { drawKey(); if (P.tf === '1D') setChart(false); return true; } return false; },
    destroy() { hideExplain(); if (P.chart) P.chart.destroy(); P.chart = null; },
  };
  el.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.tf) { P.tf = t.dataset.tf; drawToolbar(); setChart(true); }
    else if (t.dataset.order) { const h = store.s.holdings[P.sym], pl = plan(); const qty = t.dataset.order === 'SELL' ? (h ? h.qty : 0) : pl ? Math.max(1, Math.floor((pl.maxInvest - engine.exposure(P.sym)) / engine.price(P.sym))) : 1; nav.draft = { side: t.dataset.order, sym: P.sym, qty }; location.hash = 'trade-check'; }
    else if (t.hasAttribute('data-indicators')) { P.sma = !P.sma; drawToolbar(); if (P.chart) P.chart.smaVisible(P.sma); }
  });
  const show = e => { const b = e.target.closest && e.target.closest('[data-explain]'); if (b && P.EX[b.dataset.explain]) showExplain(b, ...P.EX[b.dataset.explain]); };
  el.addEventListener('mouseover', show); el.addEventListener('focusin', show);
  el.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-explain]')) hideExplain(); });
  el.addEventListener('focusout', e => { if (e.target.closest && e.target.closest('[data-explain]')) hideExplain(); });
  return api;
}
// Plain-language indicator readings (shared by the key-data popovers and the Markets "Technical indicators" list).
export const rsiText = r => `${r > 55 ? 'Buying has been stronger than selling' : r < 45 ? 'Selling has been stronger than buying' : 'Buying and selling have been roughly balanced'} over the last 14 five-minute candles.${r >= 70 ? ' This is in the often-cited “stretched” zone above 70.' : r <= 30 ? ' This is in the often-cited “weak” zone below 30.' : ' Not in the often-cited “stretched” (above 70) or “weak” (below 30) zones.'}`;
export const smaText = (p, s) => `The average of the last 20 five-minute closes. Price is ${inr(Math.abs(p - s), 0)} ${p >= s ? 'above' : 'below'} it — the short-term trend is ${p >= s ? 'up' : 'down'}.`;
export const vwapText = (p, v) => `The average price paid today, weighted by volume. Most of today’s buyers paid ${v < p ? 'less' : 'more'} than the current price.`;
