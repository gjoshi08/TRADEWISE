// Behavioural signals (Figma 08 "Behavioural signals — definitions") and self-report check-ins.
// Signals describe observable actions and the data behind them — never motives or emotions. Each is present/absent; no scores.
// Thresholds are PROTOTYPE DEFAULTS (design assumptions for demonstration), not research findings and not validated.
// Camera estimates and self-reports can never trigger a signal.
import { store } from './store.js';
import { engine } from './engine.js';
import { inr } from './data.js';

const SIM_MIN_PER_REAL_SEC = 5 / 60;                       // engine: 5 simulated seconds per real second
export const simMinAgo = t => (Date.now() - t) / 1000 * SIM_MIN_PER_REAL_SEC;
export const prefs = () => store.s.profile.prefs || { maxPerTrade: 10000, maxDailyLoss: 2000, tradesPerDay: 8, risk: 'Moderate', holding: 'Intraday', isDefault: true };
const median = xs => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export function stats() {
  const tr = store.s.trades; const buys = tr.filter(t => t.side === 'BUY');
  const in20 = tr.filter(t => simMinAgo(t.t) <= 20).length, in2 = tr.filter(t => simMinAgo(t.t) <= 2).length;
  const sells = tr.filter(t => t.side === 'SELL'); const lastLoss = [...sells].reverse().find(t => t.pnl < 0) || null;
  const realisedLoss = -sells.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0);
  let gainsInRow = 0; for (const t of [...sells].reverse()) { if (t.pnl > 0) gainsInRow++; else break; }
  const usual = null;   // median orders per 20 min over the last 5 sessions — needs per-session order times (not yet recorded)
  return { in20, in2, usual, medianBuy: buys.length >= 3 ? median(buys.map(t => t.value)) : null, lastLoss, realisedLoss, gainsInRow, positionsToday: buys.length };
}

// All five order-time signals for a draft { side, sym, qty }.
export function signals(d) {
  const st = stats(), p = prefs(), plan = store.s.strategies[d.sym], price = engine.price(d.sym), value = d.qty * price;
  const maxPer = plan ? plan.maxInvest : p.maxPerTrade; const mv = engine.move(d.sym, 60);
  const out = [];
  const big = d.side === 'BUY' && (value > maxPer || (st.medianBuy && value > 1.5 * st.medianBuy));
  out.push({ key: 'size', name: 'Position-size deviation', present: big, evidence: `${inr(value, 0)} order. Your maximum per trade is ${inr(maxPer, 0)}${st.medianBuy ? ` and your median order is ${inr(st.medianBuy, 0)}` : ''}.`, threshold: '> max, or > 1.5× median' });
  const lossAgo = st.lastLoss ? simMinAgo(st.lastLoss.t) : null;
  out.push({ key: 'afterloss', name: 'Repeated trading after a loss', present: lossAgo != null && lossAgo <= 15, evidence: st.lastLoss ? `New order ${Math.round(lossAgo)} minutes after a ${inr(st.lastLoss.pnl, 0)} result on ${st.lastLoss.sym} (${st.lastLoss.clock}).` : 'No losing trade this session.', threshold: 'Within 15 min' });
  const freq = st.usual ? st.in20 + 1 >= 2 * st.usual : st.in2 + 1 >= 3;
  out.push({ key: 'freq', name: 'Unusual trading frequency', present: freq, evidence: `This would be order ${st.in20 + 1} in the last 20 minutes${st.usual ? `. Your usual pace is ${st.usual}.` : '. Not enough sessions yet to know your usual pace, so the fixed rule applies (3 orders in 2 minutes).'}`, threshold: st.usual ? '≥ 2× usual pace' : '≥ 3 orders in 2 min (until 5 sessions)' });
  const above = plan && d.side === 'BUY' && price > plan.entry * 1.005;
  out.push({ key: 'momentum', name: 'Rapid-momentum entry', present: d.side === 'BUY' && (mv >= 1.2 || above), evidence: `Price moved ${Math.abs(mv) < 0.05 ? '' : mv > 0 ? '+' : '−'}${Math.abs(mv).toFixed(1)}% in the last 5 minutes${plan ? `; order is ${price > plan.entry ? 'above' : 'at or below'} your planned entry of ${inr(plan.entry, 0)}` : ''}.`, threshold: '≥ 1.2% in 5 min, or > 0.5% above entry' });
  out.push({ key: 'gains', name: 'Size increase after gains', present: d.side === 'BUY' && st.gainsInRow >= 2 && st.medianBuy && value > 1.5 * st.medianBuy, evidence: st.gainsInRow >= 2 ? `${st.gainsInRow} profitable sells in a row today.` : 'No consecutive profitable sells today.', threshold: '≥ 2 gains in a row + > 1.5× median' });
  return out;
}

// Strategy adherence rows for a draft (Figma 06 "Your strategy").
export function adherence(d) {
  const st = stats(), p = prefs(), plan = store.s.strategies[d.sym], price = engine.price(d.sym), value = d.qty * price;
  const maxPer = plan ? plan.maxInvest : p.maxPerTrade; const after = d.side === 'BUY' ? engine.exposure(d.sym) + value : engine.exposure(d.sym);
  const rows = [{ ok: d.side !== 'BUY' || after <= maxPer + 1, rule: plan ? `Within your ${d.sym} limit` : 'Within maximum per trade', value: `${inr(after, 0)} vs ${inr(maxPer, 0)}` }];
  if (plan) {
    if (d.side === 'BUY') rows.push({ ok: price <= plan.entry * 1.005, rule: 'At or near planned entry', value: `${inr(price)} vs ${inr(plan.entry, 0)}` });
    else rows.push({ ok: !(price > plan.stop + 0.5 && price < plan.target - 0.5), rule: 'Exit at stop-loss or target', value: `${inr(price)} · stop ${inr(plan.stop, 0)} · target ${inr(plan.target, 0)}` });
    rows.push({ ok: true, rule: 'Stop-loss set', value: `${inr(plan.stop, 0)} · ${((price - plan.stop) / price * 100).toFixed(1)}% below price` });
  } else rows.push({ ok: false, rule: `Plan saved for ${d.sym}`, value: 'No plan' });
  if (d.side === 'BUY') rows.push({ ok: st.positionsToday + 1 <= p.tradesPerDay, rule: 'Within daily trade limit', value: `${st.positionsToday + 1} of ${p.tradesPerDay}` });
  rows.push({ ok: st.realisedLoss <= p.maxDailyLoss, rule: 'Within daily loss limit', value: `${inr(st.realisedLoss, 0)} of ${inr(p.maxDailyLoss, 0)}` });
  return rows;
}

// ---- Self-report check-ins (user-reported; never combined with camera estimates) ----
const memory = [];   // used when the user has not allowed saving
export const checkins = {
  list() { return [...(store.s.checkins || []), ...memory].sort((a, b) => a.t - b.t); },
  latest() { const l = this.list(); return l[l.length - 1] || null; },
  add(c) { const rec = { t: Date.now(), clock: engine.clockStr(), ...c }; const P = store.s.privacy || { saveCheckins: true };
    if (P.saveCheckins) { (store.s.checkins || (store.s.checkins = [])).push(rec); store.save(); } else memory.push(rec);
    store.emit('checkin', rec); return rec; },
};
// 3×3 check-in grid on the Circumplex axes (row 0 = activated … row 2 = calm; col 0 = unpleasant … col 2 = pleasant).
export const GRID = [[[-0.6, 0.6, 'Tense'], [0, 0.6, 'Activated'], [0.6, 0.6, 'Excited']], [[-0.6, 0, 'Unpleasant'], [0, 0, 'Neutral'], [0.6, 0, 'Pleasant']], [[-0.6, -0.6, 'Low, tired'], [0, -0.6, 'Calm'], [0.6, -0.6, 'Calm, content']]];

// ---- Closed trades (each sell matched with the latest earlier buy of the same stock) ----
// scope: 'today' = this session · 'week' = last 7 days · 'all'. Uses archived sessions + this session. No camera data.
export function closedTrades(scope = 'today') {
  const now = Date.now(), cur = store.s.trades.map(t => ({ ...t, _cur: true }));
  let all = scope === 'today' ? cur : [...(store.s.archive || []), ...cur];
  if (scope === 'week') all = all.filter(t => now - t.t <= 7 * 864e5);
  const out = [];
  all.forEach((t, i) => { if (t.side !== 'SELL') return; const entry = [...all.slice(0, i)].reverse().find(b => b.side === 'BUY' && b.sym === t.sym) || null;
    out.push({ exit: t, entry, pnl: t.pnl || 0, pct: entry ? (t.pnl || 0) / (entry.price * t.qty) * 100 : null, withinPlan: t.tag !== 'Differs from plan' && (!entry || entry.tag !== 'Differs from plan'), signals: entry && entry.signals ? entry.signals : [] }); });
  return out.reverse();
}
// Check-ins near a moment (10 simulated minutes = 2 real minutes). Only when the user allows linking them to trades.
const TEN_SIM_MIN_MS = 10 / SIM_MIN_PER_REAL_SEC * 1000;
const linkAllowed = () => (store.s.privacy || { linkCheckins: true }).linkCheckins !== false;
export function checkinBefore(t) { if (!linkAllowed()) return null; return checkins.list().filter(c => c.t <= t && t - c.t <= TEN_SIM_MIN_MS).pop() || null; }
export function checkinAfter(t) { if (!linkAllowed()) return null; return checkins.list().find(c => c.t >= t && c.t - t <= TEN_SIM_MIN_MS) || null; }
export const linkCheckins = linkAllowed;
// Self-report groups used by personal patterns (your words, never the camera).
export function reportGroup(c) { if (!c) return null; return c.v >= 0 ? (c.a > 0 ? 'Alert or excited (your words)' : 'Calm or relaxed (your words)') : (c.a > 0 ? 'Tense or unsettled (your words)' : 'Low or tired (your words)'); }
// Real time → simulated clock seconds.
export const simSec = t => engine.nowSec() - (Date.now() - t) / 1000 * 5;
