// 04 My Psychology — implementation of Figma frame 55:651.
// Live camera estimate (memory only) · your check-ins (user-reported, separate) · camera & privacy · today's timeline ·
// personal trading patterns from check-ins + trading behaviour only (camera estimates are never part of history).
import { store } from '../store.js';
import { engine } from '../engine.js';
import { affect } from '../affect.js';
import { esc, inr } from '../data.js';
import { shell, pageTitle, cmaSvg, metric, tag, status, obsItem, camStatus, toast } from '../ui.js';
import { checkins, GRID, closedTrades, checkinBefore, reportGroup, simSec } from '../behaviour.js';

const P = { root: null, sel: null, resp: null, unsub: [], last: 0, k: 0 };
const q4 = (v, a) => (v >= 0 ? 'pleasant' : 'unpleasant') + '-' + (a >= 0 ? 'high' : 'low');
const sgn = x => (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(2);
const hhmm = sec => { const d = new Date(sec * 1000); return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0'); };
const DAY0 = Date.UTC(2026, 10, 4, 9, 15) / 1000;

// Figma example (shown, labelled "Example data", until there are at least 5 closed trades of your own).
const EXAMPLE = {
  pts: [[0.3, -0.4, 1], [0.42, -0.25, 1], [0.15, -0.5, 1], [0.5, -0.45, 1], [0.25, -0.18, 0], [0.38, -0.6, 1], [-0.35, 0.45, 0], [-0.5, 0.3, 0], [-0.22, 0.55, 1], [-0.4, 0.62, 0], [-0.3, 0.25, 0], [0.35, 0.42, 1], [0.48, 0.3, 1], [0.25, 0.55, 0]],
  rows: [['Calm or relaxed (your words)', 'Self-report', 6, 5, 6, 160], ['Tense or unsettled (your words)', 'Self-report', 5, 1, 2, -150], ['Alert or excited (your words)', 'Self-report', 3], ['No check-in before entry', '—', 3], ['A behavioural signal active', 'Behaviour', 6, 2, 2, -140], ['No signal active', 'Behaviour', 11, 7, 9, 190]],
  obs: [['Trades entered while a behavioural signal was active were within plan less often: 2 of 6, compared with 9 of 11 otherwise.', 17], ['After check-ins you described as tense or unsettled, 1 of 5 trades was profitable, compared with 5 of 6 after calm or relaxed check-ins.', 11]],
  total: 17, sessions: 4, withCk: 14,
};

export const myPsych = {
  render(root) {
    P.root = root; P.sel = null; P.resp = null;
    root.innerHTML = shell('my-psychology') + `<main class="page" style="padding-top:0">${pageTitle('My psychology', 'Private to this device. Live camera estimates stay in memory and are discarded when the session ends. Your check-ins are saved only if you allow it. Neither is a measurement of how you feel.', `<span data-part="hstatus"></span>`)}
      <section class="ps-sec"><div class="two-h"><h2 class="t-section">Right now</h2></div><div class="states ps-now" data-part="now"></div></section>
      <section class="ps-sec" data-part="timeline"></section>
      <section class="ps-sec" data-part="patterns"></section></main>`;
    drawNow(); drawTimeline(); drawPatterns();
    root.addEventListener('click', onClick);
    P.unsub.push(affect.on(() => { const n = Date.now(); if (n - P.last > 1000) { P.last = n; drawCam(); drawPrivacy(); drawHStatus(); } }));
    P.unsub.push(store.on(t => { if (t === 'checkin' || t === 'trade') { drawNow(); drawTimeline(); drawPatterns(); } }));
  },
  unmount() { P.unsub.forEach(u => u()); P.unsub = []; P.root = null; },
  tick() { if (P.root && ++P.k % 12 === 0) drawTimeline(); },   // redraw once per simulated minute
};

function drawHStatus() { const el = P.root && P.root.querySelector('[data-part="hstatus"]'); if (!el) return; const s = affect.state; el.innerHTML = status(s.mode === 'camera' ? 'live' : s.mode === 'demo' ? 'attn' : '', s.mode === 'camera' ? 'Camera on · processed on this device' : s.mode === 'demo' ? 'Demonstration mode · simulated' : 'Camera off'); }
function drawNow() {
  P.root.querySelector('[data-part="now"]').innerHTML = `<div class="cell col" data-part="cam"></div><div class="cell col" data-part="ck"></div><div class="cell col" data-part="priv"></div>`;
  drawCam(); drawCk(); drawPrivacy(); drawHStatus();
}
function camLive(s) { return (s.mode === 'camera' && s.face && !s.stale && s.quadrant !== 'uncertain') || (s.mode === 'demo' && s.quadrant !== 'uncertain'); }
function drawCam() {
  const el = P.root && P.root.querySelector('[data-part="cam"]'); if (!el) return; const s = affect.state, live = camLive(s);
  el.innerHTML = `<div class="row" style="gap:8px"><b class="t-sub" style="flex:1">Camera estimate</b>${tag('trader', 'Estimated cue')}</div>
    <div class="cx" style="align-self:center">${cmaSvg({ size: 280, kind: 'trader', v: s.v, a: s.a, unc: s.unc, trail: live ? s.trail : [], words: true, active: live, id: 'pscma' })}
      <div class="readout">${metric('Valence', live ? sgn(s.v) : '—')}${metric('Arousal', live ? sgn(s.a) : '—')}${metric('Confidence', live ? (s.conf >= 0.6 ? 'High' : s.conf >= 0.4 ? 'Moderate' : 'Low') : '—')}</div></div>
    <p class="t-meta mute">${s.mode === 'off' || s.mode === 'error' ? 'Camera off — no estimate is being made. ' : s.mode === 'demo' ? 'Demonstration mode: simulated values. ' : ''}Live only: from facial expression, smoothed over ~10 s against your personal baseline. Kept in memory and discarded when the session ends. Used only to choose wording — it never triggers an observation.</p>`;
}
function drawCk() {
  const el = P.root.querySelector('[data-part="ck"]'), ck = checkins.latest(), s = affect.state, live = camLive(s);
  const cmp = ck && live ? (q4(ck.v, ck.a) === q4(s.v, s.a) ? ['Same area', ''] : ['Different area', 'caution']) : ['—', ''];
  const P_ = store.s.privacy || { saveCheckins: true };
  el.innerHTML = `<div class="row" style="gap:8px"><b class="t-sub" style="flex:1">Your check-in</b>${tag('accent', 'User reported')}</div>
    <div class="kvrow"><span class="k">Last check-in${ck ? ' · ' + ck.clock : ''}</span><span class="v" style="font-weight:400">${ck ? esc(ck.label) : 'None yet'}</span></div>
    <div class="kvrow"><span class="k">Compared with camera now</span><span class="v ${cmp[1]}" style="font-weight:400">${cmp[0]}</span></div>
    <div class="ckform"><b class="t-sub">How do you feel right now?</b>
      <div class="row" style="gap:8px;align-items:stretch"><div class="col" style="justify-content:space-between;width:64px"><span class="t-meta mute">Activated</span><span class="t-meta mute">Calm</span></div>
        <div class="ckgrid" role="radiogroup" aria-label="How you feel: valence and arousal">${GRID.map((row, r) => row.map((c, k) => `<button role="radio" aria-checked="${!!(P.sel && P.sel[0] === r && P.sel[1] === k)}" aria-label="${c[2]}" class="${P.sel && P.sel[0] === r && P.sel[1] === k ? 'on' : ''}" data-ck="${r},${k}"></button>`).join('')).join('')}</div></div>
      <div class="row between" style="width:248px;padding-left:72px"><span class="t-meta mute">Unpleasant</span><span class="t-meta mute">Pleasant</span></div>
      ${P.sel ? `<p class="small">Selected: <b>${GRID[P.sel[0]][P.sel[1]][2]}</b></p>` : ''}
      <span class="t-label ink2">How are you responding to market moves?</span>
      <div class="seg boxed" style="align-self:flex-start">${['Following my plan', 'Taking time to analyse', 'Feeling unsettled'].map(x => `<button class="${P.resp === x ? 'on' : ''}" data-resp="${x}" aria-pressed="${P.resp === x}">${x}</button>`).join('')}</div>
      <button class="btn sm primary" data-ps="save" style="align-self:flex-start" ${P.sel ? '' : 'disabled'}>Save check-in</button>
      <p class="t-meta mute">${P_.saveCheckins ? 'Saved in this browser only if you allow it (Profile → Privacy).' : 'Saving is off: kept for this session only (Profile → Privacy).'} Never combined with the camera estimate.</p></div>`;
}
function drawPrivacy() {
  const el = P.root && P.root.querySelector('[data-part="priv"]'); if (!el) return; const s = affect.state, on = s.mode === 'camera' || s.mode === 'demo' || s.mode === 'loading';
  const face = s.mode === 'camera' ? (s.face ? 'Visible' : 'Not in view') : '—', light = s.mode === 'camera' ? (/light|dark|bright/i.test(s.quality || '') ? (s.quality.match(/[^·]*(light|dark|bright)[^·]*/i) || ['Check lighting'])[0].trim() : s.face ? 'Good' : '—') : '—';
  const kv = (k, v) => `<div class="kvrow"><span class="k">${k}</span><span class="v" style="font-weight:400">${esc(v)}</span></div>`;
  el.innerHTML = `<b class="t-sub">Camera &amp; privacy</b>${kv('Camera', s.mode === 'camera' ? 'On · this device' : s.mode === 'demo' ? 'Demonstration mode' : s.mode === 'loading' ? 'Starting…' : 'Off')}${kv('Face', face)}${kv('Lighting', light)}${kv('Personal baseline', s.calibrated ? 'Set (memory only)' : s.calibrating != null ? 'Calibrating…' : 'Not set')}${kv('Estimate updates', s.mode === 'camera' ? `Every ~${Math.max(0.3, (s.modelEvery || 300) / 1000).toFixed(1)} s` : '—')}
    <div class="ps-priv"><span class="t-label ink2">What happens to your data</span><ul>
      <li>Camera video and images: never stored or uploaded.</li><li>Live estimates and today’s camera timeline: memory only, discarded when the session ends.</li><li>Personal baseline (7 averaged numbers): memory only, discarded when the camera stops.</li><li>Your check-ins: saved in this browser only if you allow it.</li><li>Trades, results and notes: saved in Trade History in this browser.</li></ul></div>
    <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn sm" data-ps="cam">${on ? 'Turn camera off' : 'Turn camera on'}</button><button class="btn sm ghost" data-ps="recal" ${s.mode === 'camera' ? '' : 'disabled'}>Recalibrate</button><a class="btn sm ghost" href="#profile/privacy">Privacy settings</a></div>`;
}

// ---- Today's timeline: three separate tracks (camera · self-reports · trading), never combined ----
function drawTimeline() {
  const el = P.root && P.root.querySelector('[data-part="timeline"]'); if (!el) return;
  const now = engine.nowSec(), W = 1360, X0 = 150, X1 = 1330, x = sec => X0 + (sec - DAY0) / Math.max(1, now - DAY0) * (X1 - X0);
  const tr = { cam: [8, 96], self: [116, 148], trade: [168, 206] }, mid = (tr.cam[0] + tr.cam[1]) / 2, half = (tr.cam[1] - tr.cam[0]) / 2 - 6, yC = v => mid - Math.max(-1, Math.min(1, v / 0.7)) * half;
  const s = affect.state, hist = (s.hist || []).map(h => ({ sec: simSec(h.t), v: h.v, a: h.a, t: h.t }));
  const seg = k => { let d = '', pen = false, prev = null; for (const h of hist) { const gap = prev && h.t - prev.t > 3000; d += (pen && !gap ? ' L' : ' M') + x(h.sec).toFixed(1) + ' ' + yC(h[k]).toFixed(1); pen = true; prev = h; } return d; };
  const cks = checkins.list().filter(c => simSec(c.t) >= DAY0), trades = store.s.trades;
  const T = (X, Y, t, c = '#737780', fs = 11, w = 400) => `<text x="${X}" y="${Y}" font-size="${fs}" font-weight="${w}" fill="${c}">${esc(t)}</text>`;
  let svg = `<svg width="${W}" height="236" viewBox="0 0 ${W} 236" role="img" aria-label="Today’s timeline: camera estimate, self-reports and trading as separate tracks" font-family="Inter, system-ui, sans-serif">`;
  svg += T(0, 44, 'Camera estimate', '#7A4F8F', 12, 500) + T(0, 59, 'valence ─  arousal ┄') + T(0, 128, 'Self-reports', '#2E4BA8', 12, 500) + T(0, 143, 'your check-ins') + T(0, 184, 'Trading', '#454952', 12, 500) + T(0, 199, 'orders · results · signals');
  for (const [a, b] of Object.values(tr)) svg += `<rect x="${X0}" y="${a}" width="${X1 - X0}" height="${b - a}" fill="#F7F8FA"/>`;
  svg += `<path d="M${X0} ${yC(0)}H${X1}" stroke="#D5D7DC"/>` + T(X1 + 6, yC(0) + 4, '0', '#737780', 10) + T(X1 + 6, tr.cam[0] + 10, '+', '#737780', 10) + T(X1 + 6, tr.cam[1] - 2, '−', '#737780', 10);
  if (hist.length > 1) svg += `<path d="${seg('v')}" stroke="#7A4F8F" stroke-width="1.5" fill="none"/><path d="${seg('a')}" stroke="#7A4F8F" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>`;
  else svg += T(X0 + 12, mid + 4, s.mode === 'off' || s.mode === 'error' ? 'Camera off — no estimate this session' : 'Estimate starting…');
  let lastLbl = -1e9; cks.forEach(c => { const cx = x(simSec(c.t)); svg += `<rect x="${(cx - 5).toFixed(1)}" y="127" width="10" height="10" rx="1" fill="#2E4BA8"><title>${esc(c.label)} · ${c.clock}</title></rect>`; if (cx - lastLbl > 110 && cx < X1 - 60) { svg += T((cx + 9).toFixed(1), 136, c.label, '#454952'); lastLbl = cx; } });   // labels that would overlap stay available as tooltips
  trades.forEach(t => { const cx = x(simSec(t.t)).toFixed(1), loss = t.side === 'SELL' && t.pnl < 0; svg += `<path d="M${cx} ${tr.trade[0] + 8}V${tr.trade[1] - 14}" stroke="#454952"/>` + T((cx - 3.5), tr.trade[1] - 2, t.side === 'BUY' ? 'B' : 'S', loss ? '#B8433B' : '#454952', 10); if (t.signals && t.signals.length) svg += `<circle cx="${cx}" cy="${tr.trade[0] + 5}" r="4" fill="#9A6416"><title>${esc(t.signals.join(', '))}</title></circle>`; });
  if (!trades.length) svg += T(X0 + 12, tr.trade[0] + 24, 'No orders yet this session');
  for (let h = 9; h <= 15; h++) { const sec = Date.UTC(2026, 10, 4, h, 15) / 1000; if (sec <= now) svg += `<text x="${x(sec).toFixed(1)}" y="230" font-size="11" fill="#737780" text-anchor="middle">${String(h).padStart(2, '0')}:15</text>`; }
  svg += '</svg>';
  el.innerHTML = `<div class="two-h"><h2 class="t-section">Today’s timeline</h2><p class="small mute">This session only · 09:15 – ${hhmm(now)} · the camera track is discarded when the session ends</p></div>
    <div class="mp-chart">${svg}</div>
    <div class="row" style="gap:20px"><span class="t-meta mute">B / S = buy / sell order (red = closed at a loss)</span><span class="t-meta mute">● = behavioural signal present</span><span class="t-meta mute">Gaps = no face visible; estimate paused, not guessed</span></div>`;
}

// ---- Personal trading patterns: self-reports + behaviour only, with sample sizes, no causal claims ----
function realPatterns() {
  const ct = closedTrades('all').filter(c => c.entry); if (ct.length < 5) return null;
  const rows = ct.map(c => { const ck = checkinBefore(c.entry.t); return { ...c, ck, grp: reportGroup(ck) || 'No check-in before entry', sig: c.signals.length > 0 }; });
  const stat = xs => xs.length ? [xs.length, xs.filter(r => r.pnl > 0).length, xs.filter(r => r.withinPlan).length, [...xs.map(r => r.pnl)].sort((a, b) => a - b)[xs.length >> 1]] : [0];
  const G = ['Calm or relaxed (your words)', 'Tense or unsettled (your words)', 'Alert or excited (your words)', 'Low or tired (your words)', 'No check-in before entry'];
  const table = G.map(g => [g, g.startsWith('No') ? '—' : 'Self-report', ...stat(rows.filter(r => r.grp === g))]).filter(r => r[2] > 0)
    .concat([['A behavioural signal active', 'Behaviour', ...stat(rows.filter(r => r.sig))], ['No signal active', 'Behaviour', ...stat(rows.filter(r => !r.sig))]]);
  const obs = []; const a = rows.filter(r => r.sig), b = rows.filter(r => !r.sig);
  if (a.length >= 5 && b.length >= 5) obs.push([`Trades entered while a behavioural signal was active were within plan ${a.filter(r => r.withinPlan).length / a.length < b.filter(r => r.withinPlan).length / b.length ? 'less' : 'more'} often: ${a.filter(r => r.withinPlan).length} of ${a.length}, compared with ${b.filter(r => r.withinPlan).length} of ${b.length} otherwise.`, a.length + b.length]);
  const t = rows.filter(r => r.grp.startsWith('Tense')), c = rows.filter(r => r.grp.startsWith('Calm'));
  if (t.length >= 5 && c.length >= 5) obs.push([`After check-ins you described as tense or unsettled, ${t.filter(r => r.pnl > 0).length} of ${t.length} trades were profitable, compared with ${c.filter(r => r.pnl > 0).length} of ${c.length} after calm or relaxed check-ins.`, t.length + c.length]);
  const pts = rows.filter(r => r.ck).map(r => [r.ck.v, r.ck.a, r.pnl > 0 ? 1 : 0]);
  const sessions = new Set(ct.map(c => c.exit.session || 'current')).size;
  return { rows: table, obs, pts, total: ct.length, sessions, withCk: pts.length, real: true };
}
function drawPatterns() {
  const el = P.root && P.root.querySelector('[data-part="patterns"]'); if (!el) return;
  const R = realPatterns() || EXAMPLE, ex = !R.real, prelim = R.total < 20;
  const S = 440, Rr = 180, c0 = 220, Pt = (v, a) => [c0 + v * Rr, c0 - a * Rr];
  const t = (X, Y, s, a = 'middle', fs = 11) => `<text x="${X}" y="${Y}" font-size="${fs}" fill="#737780" text-anchor="${a}">${s}</text>`;
  let svg = `<svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" role="img" aria-label="Historical Trader Circumplex: how you said you felt before each trade" font-family="Inter, system-ui, sans-serif"><circle cx="${c0}" cy="${c0}" r="${Rr}" fill="#F7F8FA" stroke="#E9EAED"/><circle cx="${c0}" cy="${c0}" r="${Rr / 2}" fill="none" stroke="#E9EAED" stroke-dasharray="2 3"/><path d="M${c0 - Rr} ${c0}H${c0 + Rr}M${c0} ${c0 - Rr}V${c0 + Rr}" stroke="#D5D7DC"/>`;
  svg += t(c0, c0 - Rr - 10, 'Activated') + t(c0, c0 + Rr + 20, 'Calm') + t(c0 - Rr + 6, c0 - 8, 'Unpleasant', 'start') + t(c0 + Rr - 6, c0 - 8, 'Pleasant', 'end') + t(c0 - 92, c0 - 138, 'Tense · unsettled', 'middle', 12) + t(c0 + 92, c0 - 138, 'Alert · excited', 'middle', 12) + t(c0 - 92, c0 + 150, 'Low · tired', 'middle', 12) + t(c0 + 92, c0 + 150, 'Calm · relaxed', 'middle', 12);
  // Grid check-ins share positions; a small deterministic offset keeps every trade visible.
  R.pts.forEach(([v, a, p], i) => { const [X, Y] = Pt(v + (R.real ? ((i * 37) % 9 - 4) / 60 : 0), a + (R.real ? ((i * 53) % 9 - 4) / 60 : 0)); svg += `<rect x="${(X - 5.5).toFixed(1)}" y="${(Y - 5.5).toFixed(1)}" width="11" height="11" rx="1.5" fill="${p ? '#2E4BA8' : '#FFFFFF'}" stroke="#2E4BA8" stroke-width="1.75"/>`; });
  svg += '</svg>';
  const row = r => r.length < 4 || r[2] < 5 ? `<tr><td>${esc(r[0])}</td><td class="${r[1] === 'Self-report' ? 'acc' : ''}">${r[1]}</td><td>${r[2]}</td><td class="mute" colspan="3">Not enough trades yet (${r[2]} of 5)</td></tr>`
    : `<tr><td>${esc(r[0])}</td><td class="${r[1] === 'Self-report' ? 'acc' : ''}">${r[1]}</td><td>${r[2]}</td><td>${r[3]} of ${r[2]}</td><td>${r[4]} of ${r[2]}</td><td>${inr(r[5], 0).replace('₹', r[5] >= 0 ? '+₹' : '₹')}</td></tr>`;
  el.innerHTML = `<div class="two-h" style="align-items:center"><h2 class="t-section">Personal trading patterns</h2><p class="small mute">${R.total} simulated trades · ${R.sessions} session${R.sessions === 1 ? '' : 's'} · your check-ins and trading behaviour</p><span class="sp"></span>${prelim ? tag('caution', 'Preliminary') : ''}${ex ? tag('n', 'Example data') : ''}</div>
    <div class="ps-pat"><div class="ps-hist"><b class="t-sub">How you said you felt before each trade</b>${svg}
        <div class="col" style="gap:6px"><div class="row" style="gap:8px"><svg width="28" height="12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="#2E4BA8" stroke="#2E4BA8" stroke-width="1.5"/><rect x="16.5" y="1.5" width="9" height="9" rx="1" fill="#fff" stroke="#2E4BA8" stroke-width="1.5"/></svg><span class="t-meta ink2">Your check-in within 10 min before entry — filled: profitable, hollow: loss (${R.withCk} of ${R.total} trades)</span></div>
        <p class="t-meta mute">Camera estimates are not kept after a session, so they are not part of your history. Only what you reported is shown here.${ex ? ' Example data is shown until you have at least 5 closed trades of your own.' : ''}</p></div></div>
      <div class="ps-obs"><b class="t-sub">What happened together</b>
        ${R.obs.length ? R.obs.map(([o, n]) => obsItem('interp', `${n} trades${n < 20 ? ' · preliminary' : ''}`, o, 'Association only — this does not show that one caused the other.')).join('') : '<p class="small mute">Not enough closed trades in each group to compare yet (at least 5 per group).</p>'}
        <table class="dtable ps-tbl"><thead><tr><th>State or behaviour at entry</th><th>Source</th><th>Trades</th><th>Profitable</th><th>Within plan</th><th>Median result</th></tr></thead><tbody>${R.rows.map(row).join('')}</tbody></table></div></div>
    <p class="t-meta mute">Patterns show what happened together, not what caused it. Groups under 5 trades are not summarised; groups of 5–19 trades are labelled preliminary. Based on your check-ins and trading behaviour only.${ex ? ' Example data until you have enough trades of your own.' : ''}</p>`;
}

async function onClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ck) { P.sel = b.dataset.ck.split(',').map(Number); drawCk(); return; }
  if (b.dataset.resp) { P.resp = P.resp === b.dataset.resp ? null : b.dataset.resp; drawCk(); return; }
  const a = b.dataset.ps;
  if (a === 'save' && P.sel) { const [v, av, label] = GRID[P.sel[0]][P.sel[1]]; checkins.add({ v, a: av, label, responding: P.resp }); store.log('checkin', `Check-in: ${label}${P.resp ? ' · ' + P.resp : ''}`); P.sel = null; P.resp = null; toast('Check-in saved. It stays separate from the camera estimate.'); }
  if (a === 'cam') { const m = affect.state.mode; if (m === 'camera' || m === 'demo' || m === 'loading') { affect.stop(); toast('Camera off. Live estimates were discarded.'); } else { const ok = await affect.startCamera(); if (!ok) toast('Camera unavailable: ' + affect.state.error); } drawPrivacy(); drawCam(); }
  if (a === 'recal') { affect.calibrate(5000); toast('Calibrating for 5 seconds. Look at the screen with a relaxed face.'); }
}
