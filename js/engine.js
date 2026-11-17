// Simulated market + order engine. Fictional prices; nothing connects to a broker.
// Time: the market clock runs at 5 simulated seconds per real second; 1-minute candles close every 12 ticks.
import { STOCKS, WATCH } from './data.js';
import { store } from './store.js';

const DAY0 = Date.UTC(2026, 10, 4, 9, 15) / 1000;       // 09:15 "IST" expressed as UTC so the chart prints local market time
const START_MIN = 255;                                    // 13:30
const TICK_SIM_SEC = 5, TICKS_PER_CANDLE = 12;
function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

const M = { clock: DAY0 + START_MIN * 60, tick: 0, data: {}, scenario: null, listeners: new Set(), timer: null };

function bridge(n, from, to, vol, r, shape) {
  const w = [0]; for (let i = 1; i < n; i++) w.push(w[i - 1] + (r() - .5) * 2 * vol);
  const end = w[n - 1];
  return w.map((x, i) => { const lin = from + (to - from) * i / (n - 1); const base = shape ? shape(i, n) : lin; return base + (x - end * i / (n - 1)); });
}
function shyShape(i, n) { // fell after a morning forecast update, then steadied near ₹1,150
  if (i < 15) return 1174.7 - i * 0.3; if (i < 95) return 1170 - (i - 15) * 0.24; return 1150.6 + Math.sin(i / 9) * 1.2;
}
function build(sym) {
  const s = STOCKS[sym], r = rng(hash(sym)), n = START_MIN;
  const closes = bridge(n, s.open, s.start, s.start * s.vol * 1.6, r, sym === 'SHYINFO' ? shyShape : null);
  closes[n - 1] = s.start;
  const c1 = []; let prev = s.open;
  for (let i = 0; i < n; i++) { const o = prev, c = closes[i]; const h = Math.max(o, c) + r() * s.start * s.vol * 1.2, l = Math.min(o, c) - r() * s.start * s.vol * 1.2;
    const v = Math.round((800 + r() * 1400 + Math.abs(c - o) / s.start * 2e6) * (sym === 'SHYINFO' && i > 15 && i < 95 ? 1.9 : 1));
    c1.push({ time: DAY0 + i * 60, open: o, high: h, low: l, close: c, volume: v }); prev = c; }
  const day = []; let dp = s.prev; const rd = rng(hash(sym + 'd'));
  const dcl = bridge(90, s.prev * (sym === 'SHYINFO' ? 1.12 : 0.95 + rd() * 0.1), s.prev, s.prev * 0.012, rd); dp = dcl[0];
  for (let i = 0; i < 90; i++) { const o = dp, c = dcl[i]; day.push({ time: DAY0 - (90 - i) * 86400, open: o, high: Math.max(o, c) * (1 + rd() * .008), low: Math.min(o, c) * (1 - rd() * .008), close: c, volume: Math.round(2e5 + rd() * 3e5) }); dp = c; }
  return { c1, day, price: s.start, ticks: Array(60).fill(s.start), anchor: s.start, cur: null };
}
function notify(t) { M.listeners.forEach(fn => { try { fn(t); } catch (e) { console.error(e); } }); }

export const engine = {
  init() { store.clockFn = () => this.clockStr(); WATCH.forEach(s => { M.data[s] = build(s); }); this.newCandle(); },
  start() { if (!M.timer) M.timer = setInterval(() => this.step(), 1000); },
  stop() { clearInterval(M.timer); M.timer = null; },
  on(fn) { M.listeners.add(fn); return () => M.listeners.delete(fn); },
  newCandle() { WATCH.forEach(s => { const d = M.data[s]; d.cur = { time: M.clock - (M.clock - DAY0) % 60, open: d.price, high: d.price, low: d.price, close: d.price, volume: 0 }; d.c1.push(d.cur); }); },
  step() {
    M.clock += TICK_SIM_SEC; M.tick++;
    const sc = M.scenario;
    WATCH.forEach(sym => {
      const d = M.data[sym], s = STOCKS[sym]; let p = d.price; const noise = (Math.random() - .5) * 2 * p * s.vol;
      if (sc && sc.sym === sym && sc.left > 0) { p += (sc.target - p) * 0.11 + noise * 0.6; sc.left--; if (sc.left === 0) d.anchor = sc.target; }
      else p += noise + (d.anchor - p) * 0.03;
      p = Math.round(p * 20) / 20; d.price = p; d.ticks.push(p); if (d.ticks.length > 240) d.ticks.shift();
      const c = d.cur; c.close = p; c.high = Math.max(c.high, p); c.low = Math.min(c.low, p); c.volume += Math.round(60 + Math.random() * 120 + (sc && sc.sym === sym && sc.left > 0 ? 320 : 0));
    });
    if (sc && sc.left <= 0) M.scenario = null;
    if (M.tick % TICKS_PER_CANDLE === 0) this.newCandle();
    notify(M.tick);
  },
  scenario(kind, sym) {
    const p = M.data[sym].price; const target = kind === 'drop' ? p * 0.982 : p * 1.028;
    M.scenario = { kind, sym, target: Math.round(target * 20) / 20, left: 30 };
    store.log('market', kind === 'drop' ? `${sym} started falling quickly (demo scenario)` : `${sym} started rising quickly (demo scenario)`, { sym });
  },
  get scenarioActive() { return M.scenario; },
  price: sym => M.data[sym].price,
  prevClose: sym => STOCKS[sym].prev,
  change: sym => (M.data[sym].price - STOCKS[sym].prev) / STOCKS[sym].prev * 100,
  move(sym, n = 60) { const t = M.data[sym].ticks; const a = t[Math.max(0, t.length - n)], b = t[t.length - 1]; return (b - a) / a * 100; },
  spark(sym) { return M.data[sym].c1.slice(-40).map(c => c.close); },
  candles(sym, tf) {
    const d = M.data[sym]; if (tf === '1D') return d.day.concat([{ time: DAY0, open: STOCKS[sym].open, high: Math.max(...d.c1.map(c => c.high)), low: Math.min(...d.c1.map(c => c.low)), close: d.price, volume: d.c1.reduce((a, c) => a + c.volume, 0) }]);
    const k = { '1m': 1, '5m': 5, '15m': 15 }[tf] || 1; if (k === 1) return d.c1.map(c => ({ ...c }));
    const out = []; for (let i = 0; i < d.c1.length; i += k) { const g = d.c1.slice(i, i + k); out.push({ time: g[0].time, open: g[0].open, high: Math.max(...g.map(c => c.high)), low: Math.min(...g.map(c => c.low)), close: g[g.length - 1].close, volume: g.reduce((a, c) => a + c.volume, 0) }); }
    return out;
  },
  lastBar(sym, tf) { const all = this.candles(sym, tf); return all[all.length - 1]; },
  nowSec() { return M.clock; },   // simulated clock, seconds (UTC-encoded IST)
  clockStr(full) { const d = new Date(M.clock * 1000); const h = String(d.getUTCHours()).padStart(2, '0'), m = String(d.getUTCMinutes()).padStart(2, '0'), s = String(d.getUTCSeconds()).padStart(2, '0'); return full ? `${h}:${m}:${s}` : `${h}:${m}`; },

  // ----- orders -----
  exposure(sym) { const h = store.s.holdings[sym]; return h ? h.qty * h.avg : 0; },
  compare(side, sym, qty, price) {
    const plan = store.s.strategies[sym]; if (!plan) return { tag: 'No saved plan', diffs: [] };
    const diffs = [];
    if (side === 'BUY') {
      const after = this.exposure(sym) + qty * price;
      if (after > plan.maxInvest + 1) diffs.push({ k: 'limit', text: `Investment would be ${fmtInr(after)}, above your ${fmtInr(plan.maxInvest)} limit` });
      if (price > plan.entry * 1.015) diffs.push({ k: 'chase', text: `Price ${fmtInr(price)} is well above your planned entry of ${fmtInr(plan.entry)}` });
    } else {
      if (price > plan.stop + 0.5 && price < plan.entry * 0.995 && price < plan.target - 0.5) diffs.push({ k: 'early', text: `Selling at ${fmtInr(price)}, before your stop-loss of ${fmtInr(plan.stop)} is reached` });
    }
    return { tag: diffs.length ? 'Differs from plan' : side === 'BUY' ? 'Matches plan' : 'Planned exit', diffs, plan };
  },
  order(side, sym, qty) {
    qty = Math.floor(qty); if (!(qty > 0)) return { ok: false, msg: 'Choose a quantity of at least 1 share.' };
    const s = store.s, price = this.price(sym), value = qty * price; const cmp = this.compare(side, sym, qty, price);
    if (side === 'BUY') {
      if (value > s.balance) return { ok: false, msg: `Not enough virtual cash. You have ${fmtInr(s.balance)}.` };
      const h = s.holdings[sym] || { qty: 0, avg: 0 }; h.avg = (h.avg * h.qty + value) / (h.qty + qty); h.qty += qty; s.holdings[sym] = h; s.balance -= value;
    } else {
      const h = s.holdings[sym]; if (!h || h.qty < qty) return { ok: false, msg: `You hold ${h ? h.qty : 0} shares of ${sym}.` };
      var pnl = (price - h.avg) * qty; h.qty -= qty; if (!h.qty) delete s.holdings[sym]; s.balance += value;
    }
    const tr = { t: Date.now(), clock: this.clockStr(), sym, side, qty, price, value, tag: cmp.tag, plan: !!cmp.plan, pnl: side === 'SELL' ? pnl : null, diffs: cmp.diffs.map(d => d.text) };
    s.trades.push(tr); store.save();
    store.log('trade', `${side === 'BUY' ? 'Bought' : 'Sold'} ${qty} ${sym} at ${fmtInr(price)} · ${cmp.tag}`, { sym, tag: cmp.tag });
    store.emit('trade', tr); return { ok: true, trade: tr };
  },
  portfolio() {
    const s = store.s; let invested = 0, value = 0, day = 0;
    Object.entries(s.holdings).forEach(([sym, h]) => { const p = this.price(sym); invested += h.qty * h.avg; value += h.qty * p; day += h.qty * (p - STOCKS[sym].prev); });
    const realised = s.trades.filter(t => t.pnl != null).reduce((a, t) => a + t.pnl, 0);
    return { cash: s.balance, invested, value, unrealised: value - invested, realised, total: s.balance + value, day };
  },
};
function fmtInr(n) { return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
