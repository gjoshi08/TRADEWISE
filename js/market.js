// Market Circumplex — a Circumplex-INSPIRED interpretation of market sentiment (valence) and activity (arousal).
// It is NOT a measurement of collective human emotion. All inputs come from the simulated market.
// Prototype logic (Figma 03 "Contributing inputs"): each input is scaled to −1…+1 against a usual range, weighted,
// summed per axis and clipped to −1…+1. Weights and scales are design assumptions chosen for demonstration, not validated.
import { engine } from './engine.js';
import { STOCKS, WATCH, NEWS } from './data.js';
import { group, atr } from './indicators.js';

export const WEIGHTS = { momentum: 0.45, breadth: 0.30, news: 0.25, volume: 0.50, volatility: 0.50 };
const clip = x => Math.max(-1, Math.min(1, x));
const hhmm = t => { const d = new Date(t * 1000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

// State of `sym` at 1-minute candle index i (default: now).
export function compute(sym, i) {
  const c1 = engine.candles(sym, '1m'); if (i == null || i >= c1.length) i = c1.length - 1; i = Math.max(1, i);
  const bars = c1.slice(0, i + 1), price = bars[bars.length - 1].close, at = bars[bars.length - 1].time;
  // 1) Momentum · 5 days: price now vs the close 5 sessions ago.
  const day = engine.candles(sym, '1D'); const ref = day[Math.max(0, day.length - 6)].close; const momentum = (price - ref) / ref * 100;
  // 2) Breadth: how many stocks in the (simulated) market are up on the day at the same time.
  let up = 0; for (const s of WATCH) { const c = engine.candles(s, '1m'); const p = (c[Math.min(i, c.length - 1)] || c[c.length - 1]).close; if (p > STOCKS[s].prev) up++; }
  const breadth = (up - (WATCH.length - up)) / WATCH.length;
  // 3) News sentiment: mean sentiment of simulated headlines published so far today.
  const items = (NEWS[sym] || []).filter(n => n[0] <= hhmm(at)); const news = items.length ? items.reduce((a, n) => a + n[2], 0) / items.length : 0;
  // 4) Volume: average volume of the last 30 minutes vs the session average.
  const vols = bars.map(b => b.volume); const recent = vols.slice(-31, -1); const sessAvg = vols.slice(0, -1).reduce((a, b) => a + b, 0) / Math.max(1, vols.length - 1);
  const volRatio = recent.length ? (recent.reduce((a, b) => a + b, 0) / recent.length) / sessAvg : 1;
  // 5) Volatility: ATR(14) of 5-minute candles vs the session's average 5-minute range.
  const c5 = group(bars, 5); const a14 = atr(c5, 14), aAll = atr(c5, c5.length); const atrRatio = a14 && aAll ? a14 / aAll : 1; const atrPct = a14 ? a14 / price * 100 : 0;

  const s = { momentum: clip(momentum / 4), breadth, news, volume: clip(volRatio - 1), volatility: clip(atrRatio - 1) };
  const sentiment = clip(WEIGHTS.momentum * s.momentum + WEIGHTS.breadth * s.breadth + WEIGHTS.news * s.news);
  const activity = clip(WEIGHTS.volume * s.volume + WEIGHTS.volatility * s.volatility);
  const inputs = [
    { key: 'momentum', label: 'Momentum · 5 days', value: (momentum >= 0 ? '+' : '−') + Math.abs(momentum).toFixed(1) + '%', dir: Math.sign(momentum), usual: '−2% to +2%', axis: 'Valence · sentiment', contribution: WEIGHTS.momentum * s.momentum, meaning: Math.abs(momentum) > 2 ? `Price has ${momentum > 0 ? 'risen' : 'fallen'} more than it usually does over a week.` : 'Price is within its usual weekly range.' },
    { key: 'breadth', label: 'Breadth · market', value: `${up} of ${WATCH.length} up`, dir: Math.sign(breadth), usual: 'about half up', axis: 'Valence · sentiment', contribution: WEIGHTS.breadth * s.breadth, meaning: breadth > 0.2 ? 'Most stocks are rising, not just this one.' : breadth < -0.2 ? 'Most stocks are falling, not just this one.' : 'Rising and falling stocks are roughly balanced.' },
    { key: 'news', label: 'News sentiment', value: items.length ? (news > 0.2 ? 'Mildly positive' : news < -0.2 ? 'Mildly negative' : 'Mixed') : 'No headlines yet', dir: Math.sign(news), usual: '—', axis: 'Valence · sentiment', contribution: WEIGHTS.news * s.news, meaning: `${items.filter(n => n[2] > 0).length} positive, ${items.filter(n => n[2] < 0).length} negative of ${items.length} simulated headlines today.`, simulated: true },
    { key: 'volume', label: 'Volume vs session', value: volRatio.toFixed(1) + '×', dir: 0, usual: '0.8–1.2×', axis: 'Arousal · activity', contribution: WEIGHTS.volume * s.volume, meaning: volRatio > 1.2 ? 'More shares are changing hands than usual.' : volRatio < 0.8 ? 'Fewer shares are changing hands than usual.' : 'Trading volume is ordinary.' },
    { key: 'volatility', label: 'Volatility · ATR 14', value: atrPct.toFixed(2) + '%', dir: 0, caution: atrRatio > 1.2, usual: `${(atrPct / atrRatio * 0.8).toFixed(2)}–${(atrPct / atrRatio * 1.2).toFixed(2)}%`, axis: 'Arousal · activity', contribution: WEIGHTS.volatility * s.volatility, meaning: atrRatio > 1.2 ? 'Prices are swinging more widely than usual.' : atrRatio < 0.8 ? 'Prices are moving less than usual.' : 'Price swings are about usual.' },
  ];
  return { sym, at: hhmm(at), sentiment, activity, quadrant: quadrant(sentiment, activity), inputs, coverage: `${items.length ? 5 : 4} of 5 inputs`, volRatio, atrPct };
}
export function quadrant(s, a) { return s >= 0 ? (a >= 0 ? 'Euphoria' : 'Optimism') : (a >= 0 ? 'Panic' : 'Apathy'); }
export const describe = (s, a) => `${s >= 0 ? 'Positive' : 'Negative'} · ${a >= 0 ? 'high' : 'low'} activity`;
// Trajectory over the last `mins` simulated minutes (one point per `step` minutes).
export function trail(sym, mins = 20, step = 4) { const n = engine.candles(sym, '1m').length - 1; const out = []; for (let k = mins; k >= 0; k -= step) { const st = compute(sym, n - k); out.push([st.sentiment, st.activity]); } return out; }
