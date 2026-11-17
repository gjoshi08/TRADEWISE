// Standard technical indicators on simulated candles (no external data).
export const sma = (xs, n) => xs.length < n ? null : xs.slice(-n).reduce((a, b) => a + b, 0) / n;
export function smaSeries(bars, n) { const out = []; for (let i = n - 1; i < bars.length; i++) { let s = 0; for (let k = i - n + 1; k <= i; k++) s += bars[k].close; out.push({ time: bars[i].time, value: s / n }); } return out; }
// Wilder's RSI.
export function rsi(closes, n = 14) {
  if (closes.length <= n) return null; let g = 0, l = 0;
  for (let i = 1; i <= n; i++) { const d = closes[i] - closes[i - 1]; if (d > 0) g += d; else l -= d; }
  g /= n; l /= n;
  for (let i = n + 1; i < closes.length; i++) { const d = closes[i] - closes[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
export function vwap(bars) { let pv = 0, v = 0; for (const b of bars) { const tp = (b.high + b.low + b.close) / 3; pv += tp * b.volume; v += b.volume; } return v ? pv / v : null; }
// Average true range over the last n bars.
export function atr(bars, n = 14) {
  if (bars.length < 2) return null; const tr = [];
  for (let i = 1; i < bars.length; i++) { const b = bars[i], p = bars[i - 1].close; tr.push(Math.max(b.high - b.low, Math.abs(b.high - p), Math.abs(b.low - p))); }
  const k = tr.slice(-n); return k.reduce((a, b) => a + b, 0) / k.length;
}
// Group 1-minute candles into k-minute candles.
export function group(c1, k) { const out = []; for (let i = 0; i < c1.length; i += k) { const g = c1.slice(i, i + k); out.push({ time: g[0].time, open: g[0].open, high: Math.max(...g.map(c => c.high)), low: Math.min(...g.map(c => c.low)), close: g[g.length - 1].close, volume: g.reduce((a, c) => a + c.volume, 0) }); } return out; }
