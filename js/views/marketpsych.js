// 03 Market Psychology — implementation of Figma frame 53:544.
// A Circumplex-INSPIRED interpretation of market sentiment (valence) and activity (arousal); prototype logic, not a measurement
// of collective emotion. All values are computed from the simulated market by market.js.
import { engine } from '../engine.js';
import { STOCKS, esc } from '../data.js';
import { shell, nav, cmaSvg, metric, tag, pageTitle } from '../ui.js';
import { compute, trail, describe, WEIGHTS } from '../market.js';

const S = { root: null, at: -1, sess: null, sessAt: -1 };
const MQ = { Euphoria: 'upper-right', Optimism: 'lower-right', Panic: 'upper-left', Apathy: 'lower-left' };
const GUIDE = [['Euphoria', 'Positive sentiment, high activity. Rising prices with heavy trading; moves can be fast in both directions.'], ['Optimism', 'Positive sentiment, low activity. Prices drifting up on ordinary volume.'], ['Apathy', 'Negative sentiment, low activity. Prices drifting down with little interest.'], ['Panic', 'Negative sentiment, high activity. Falling prices with heavy trading and wide swings.']];
const sgn = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const hhmm = t => { const d = new Date(t * 1000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };

export const marketPsych = {
  render(root) {
    S.root = root; if (nav.pendingSym && STOCKS[nav.pendingSym]) nav.sym = nav.pendingSym; nav.pendingSym = null; S.at = -1; S.sessAt = -1;
    const scope = `<div class="row" style="gap:24px"><div class="seg" aria-label="Scope"><button class="on" aria-pressed="true">${nav.sym}</button><button disabled title="Index data is static in this simulation, so no Circumplex can be calculated for it">NIFTY IT</button><button disabled title="Index data is static in this simulation, so no Circumplex can be calculated for it">NIFTY 50</button></div>
      <div class="seg" aria-label="Time range"><button class="on" aria-pressed="true">Session</button><button disabled title="Needs multi-day breadth and news history, which the simulation does not generate">5 days</button><button disabled title="Needs multi-day breadth and news history, which the simulation does not generate">1 month</button></div></div>`;
    root.innerHTML = shell('market-psychology') + `<main class="page" style="padding-top:0">${pageTitle('Market psychology', 'A Circumplex-inspired interpretation of market sentiment and activity, on the same two axes as your own state. Stock indicators do not measure collective human emotion; the quadrant names are labels for combinations of inputs.', scope)}
      <div class="mp-top"><section class="mp-pos" data-part="pos" aria-label="Current position"></section><section class="mp-guide" data-part="guide" aria-label="Reading the four areas"></section></div>
      <section class="mp-sec" data-part="inputs" aria-label="Contributing inputs"></section>
      <section class="mp-sec" data-part="traj" aria-label="Session trajectory"></section></main>`;
    draw();
  },
  unmount() { S.root = null; },
  tick() { if (!S.root) return; const n = engine.candles(nav.sym, '1m').length; if (n !== S.at) draw(); },
};

// Session history: position every 5 simulated minutes from 09:15 to now (one Market Circumplex calculation per point).
function session() {
  const n = engine.candles(nav.sym, '1m').length; if (S.sess && S.sessAt === n) return S.sess;
  const c1 = engine.candles(nav.sym, '1m'), pts = [];
  for (let i = 5; i < n; i += 5) { const st = compute(nav.sym, i); pts.push({ i, t: c1[i].time, s: st.sentiment, a: st.activity, q: st.quadrant }); }
  const last = compute(nav.sym); pts.push({ i: n - 1, t: c1[n - 1].time, s: last.sentiment, a: last.activity, q: last.quadrant });
  S.sess = pts; S.sessAt = n; return pts;
}
function draw() {
  const sym = nav.sym, m = compute(sym), tr = trail(sym), ses = session(); S.at = engine.candles(sym, '1m').length;
  const inp = k => m.inputs.find(x => x.key === k);
  const why = `Sentiment is ${m.sentiment >= 0 ? 'positive' : 'negative'} because the price has ${inp('momentum').dir >= 0 ? 'risen' : 'fallen'} ${inp('momentum').value.replace(/^[+−]/, '')} over five days, ${inp('breadth').value} in the simulated market, and simulated news is ${inp('news').value.toLowerCase()}. Activity is ${m.activity >= 0 ? 'high' : 'low'} because volume is ${inp('volume').value} the session average and price swings (ATR ${inp('volatility').value}) are ${inp('volatility').caution ? 'wider than' : m.activity >= 0 ? 'near' : 'within'} normal. ${m.sentiment >= 0 ? 'Positive' : 'Negative'} sentiment with ${m.activity >= 0 ? 'high' : 'low'} activity falls in the ${MQ[m.quadrant]} area, labelled ${m.quadrant}.`;
  const t0 = tr[0], t1 = tr[tr.length - 1]; const changes = ses.filter((p, k) => k && p.q !== ses[k - 1].q); const lastCh = changes[changes.length - 1];
  const mv = `Sentiment ${sgn(t0[0])} → ${sgn(t1[0])} and activity ${sgn(t0[1])} → ${sgn(t1[1])}.${lastCh ? ` ${sym} entered the ${lastCh.q} area at ${hhmm(lastCh.t)}.` : ` ${sym} has stayed in the ${m.quadrant} area all session.`}`;
  S.root.querySelector('[data-part="pos"]').innerHTML = `<div class="cx lg">${cmaSvg({ size: 364, scale: 1.3, kind: 'market', v: m.sentiment, a: m.activity, unc: 0.08, trail: tr, words: true, id: 'mpcma' })}
      <div class="readout lg">${metric('Sentiment', sgn(m.sentiment))}${metric('Activity', sgn(m.activity))}${metric('Data coverage', m.coverage)}</div></div>
    <div class="mp-read"><span class="t-over">Current position · ${m.at}</span><div class="row" style="gap:10px"><h2 class="t-page">${m.quadrant}</h2>${tag('accent', describe(m.sentiment, m.activity))}</div>
      <div class="blk"><b class="t-sub">The two axes</b><div class="ax"><span>Valence</span><span>Market sentiment — negative to positive. From momentum, breadth and news.</span></div><div class="ax"><span>Arousal</span><span>Market activity — low to high. From volume and volatility.</span></div></div>
      <div class="blk"><b class="t-sub">Why this quadrant</b><p class="small ink2">${esc(why)}</p><p class="t-meta mute">“${m.quadrant}” is a label for ${m.sentiment >= 0 ? 'positive' : 'negative'} sentiment with ${m.activity >= 0 ? 'high' : 'low'} activity. It is not a forecast and does not describe how traders feel.</p></div>
      <div class="blk"><b class="t-sub">Last 20 minutes</b><p class="small ink2">${esc(mv)}</p></div></div>`;
  S.root.querySelector('[data-part="guide"]').innerHTML = `<b class="t-sub">Reading the four areas</b>${GUIDE.map(([q, d]) => `<div class="g"><div class="row" style="gap:8px"><b class="t-sub">${q}</b>${q === m.quadrant ? tag('accent', 'Now') : ''}</div><p class="small ink2">${d}</p></div>`).join('')}<p class="t-meta mute">Quadrant names are conventions from market commentary, used here only as labels for the two axes.</p>`;
  const row = (c, cl = []) => `<tr>${c.map((x, i) => `<td class="${cl[i] || ''}">${x}</td>`).join('')}</tr>`;
  S.root.querySelector('[data-part="inputs"]').innerHTML = `<div class="row" style="gap:12px;align-items:baseline"><h2 class="t-section">Contributing inputs</h2><span class="small mute">How the position is calculated</span>${tag('caution', 'Prototype logic')}</div>
    <table class="mp-tbl"><colgroup><col style="width:200px"><col style="width:150px"><col style="width:130px"><col style="width:200px"><col style="width:130px"><col></colgroup>
      <thead><tr><th>Input</th><th>Current</th><th>Usual range</th><th>Axis (valence / arousal)</th><th>Contribution</th><th>What it means</th></tr></thead>
      <tbody>${m.inputs.map(x => row([esc(x.label) + (x.simulated ? ' <span class="t-meta mute">simulated</span>' : ''), esc(x.value), esc(x.usual), esc(x.axis), sgn(x.contribution), esc(x.meaning)], ['n', x.caution ? 'caution' : x.key === 'momentum' ? (x.dir > 0 ? 'up' : x.dir < 0 ? 'down' : '') : '', '', '', '', 'w'])).join('')}
      ${row(['Total', '', '', 'Valence / arousal', `${sgn(m.sentiment)} / ${sgn(m.activity)}`, 'Each axis is clipped to −1…+1.'], ['n', '', '', '', '', 'w'])}</tbody></table>
    <p class="t-meta mute">Prototype logic, not a validated measurement. Each input is scaled against a usual range, multiplied by a weight and summed per axis, then clipped to −1…+1. Weights — sentiment: momentum ${WEIGHTS.momentum.toFixed(2)}, breadth ${WEIGHTS.breadth.toFixed(2)}, news ${WEIGHTS.news.toFixed(2)}; activity: volume ${WEIGHTS.volume.toFixed(2)}, volatility ${WEIGHTS.volatility.toFixed(2)} — are design assumptions chosen for demonstration. Prices, breadth and news are simulated.</p>`;
  drawTrajectory(ses, changes);
}
function drawTrajectory(ses, changes) {
  const W = 1360, H = 200, top = 10, ph = 160, X0 = 48, X1 = W - 62, t0 = ses[0].t - 300, tN = ses[ses.length - 1].t;
  const X = t => X0 + (t - t0) / Math.max(1, tN - t0) * (X1 - X0), Y = v => top + (1 - v) / 2 * ph;
  const path = k => 'M' + ses.map(p => `${X(p.t).toFixed(1)} ${Y(p[k]).toFixed(1)}`).join(' L');
  const ticks = []; for (let h = 9; h <= 15; h++) { const t = Date.UTC(2026, 10, 4, h, 15) / 1000; if (t >= t0 && t <= tN) ticks.push([t, `${String(h).padStart(2, '0')}:15`]); }
  const txt = (x, y, s, c = '#737780', a = 'start') => `<text x="${x}" y="${y}" font-size="11" fill="${c}" text-anchor="${a}">${s}</text>`;
  const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sentiment and activity during the session" font-family="Inter, system-ui, sans-serif">
    <rect x="${X0}" y="${top}" width="${X1 - X0}" height="${ph / 2}" fill="#F7F8FA"/>
    ${[1, 0.5, 0, -0.5, -1].map(v => `<path d="M${X0} ${Y(v)}H${X1}" stroke="${v === 0 ? '#D5D7DC' : '#E9EAED'}"/>${txt(W - 54, Y(v) + 4, (v > 0 ? '+' : '') + v.toFixed(1))}`).join('')}
    <path d="${path('s')}" stroke="#2E4BA8" stroke-width="1.5" fill="none" stroke-linejoin="round"/><path d="${path('a')}" stroke="#2E4BA8" stroke-width="1.5" stroke-dasharray="4 3" fill="none" stroke-linejoin="round"/>
    ${changes.slice(-2).map((c, k) => `<path d="M${X(c.t).toFixed(1)} ${top}V${top + ph}" stroke="#737780" stroke-dasharray="2 3"/>${txt((X(c.t) + 6).toFixed(1), top + 12 + (k % 2) * 14, `${hhmm(c.t)} · ${ses[ses.indexOf(c) - 1].q} → ${c.q}`, '#454952')}`).join('')}
    ${ticks.map(([t, l]) => txt(X(t).toFixed(1), top + ph + 22, l, '#737780', 'middle')).join('')}
    ${txt(0, top + 14, 'Positive /')}${txt(0, top + 27, 'high')}${txt(0, top + ph - 4, 'Negative /')}${txt(0, top + ph + 9, 'low')}</svg>`;
  S.root.querySelector('[data-part="traj"]').innerHTML = `<div class="row" style="gap:12px"><h2 class="t-section">Session trajectory</h2><span class="small mute">${hhmm(ses[0].t - 300)} – ${hhmm(tN)}</span><span class="sp"></span>
      <span class="lg-i"><svg width="16" height="4"><path d="M0 2H16" stroke="#2E4BA8" stroke-width="1.5"/></svg>Sentiment</span><span class="lg-i"><svg width="16" height="4"><path d="M0 2H16" stroke="#2E4BA8" stroke-width="1.5" stroke-dasharray="3 3"/></svg>Activity</span></div>
    <div class="mp-chart">${svg}</div><p class="t-meta mute">Shaded band = above zero. Vertical markers show when the position crossed into a different area. Calculated every 5 simulated minutes.</p>`;
}
