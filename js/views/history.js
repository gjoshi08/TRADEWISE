// 07 Trade History — implementation of Figma frame 63:1167 (absorbs the previous Reflect screen).
// Closed simulated trades with plan comparison, signals at entry, your check-ins before entry / after exit and reflections.
// Camera estimates are never stored with trades.
import { store } from '../store.js';
import { engine } from '../engine.js';
import { inr, esc } from '../data.js';
import { shell, toast, tag, metric, obsItem } from '../ui.js';
import { closedTrades, checkinBefore, checkinAfter, linkCheckins } from '../behaviour.js';

const H = { root: null, scope: 'today', filter: 'All', q: '', open: null, unsub: null };
const SCOPES = [['today', 'Today'], ['week', 'This week'], ['all', 'All']], FILTERS = ['All', 'Profitable', 'Loss', 'Signal at entry', 'Differs from plan'];
const sq = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="#2E4BA8" fill-opacity=".15" stroke="#2E4BA8" stroke-width="1.5"/></svg>';
const dot = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill="#2E4BA8"/></svg>';
const sgn = n => (n > 0 ? '+' : n < 0 ? '−' : '') + inr(Math.abs(n), 0);

export const history = {
  render(root) {
    H.root = root;
    root.innerHTML = shell('history') + `<main class="page" style="padding-top:0">
      <div class="ptitle"><div class="l"><div class="row" style="gap:10px"><h1>Trade history</h1>${tag('n', 'Simulated trades')}</div><p>What you traded, how it compared with your plan, and what you reported before entry and after exit.</p></div><span class="sp"></span><div class="seg" data-part="scope"></div></div>
      <div class="th-sum" data-part="sum"></div>
      <div class="th-filters"><div class="seg" data-part="filters"></div><span class="sp"></span><form class="search" data-form="thsearch" role="search" style="width:220px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input name="q" placeholder="Filter by stock" aria-label="Filter by stock" autocomplete="off"></form></div>
      <div data-part="table"></div>
      <section class="th-session" data-part="session"></section>
      <p class="t-meta mute th-foot">Stored in this browser: trades, results, plan comparison, your check-ins (if allowed), reflections and notes. Camera estimates are never stored with trades. Signals describe actions and data, not motives. “Differs from plan” is neutral — add a note to explain any trade.</p></main>`;
    draw();
    root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
    root.querySelector('[data-form="thsearch"]').addEventListener('submit', e => e.preventDefault());
    // Live: a trade closed or a check-in saved while this page is open updates it (not while a note is being typed).
    H.unsub = store.on(t => { if (!H.root || !['trade', 'checkin', 'prompt', 'prompt-closed', 'state'].includes(t)) return; const a = document.activeElement; if (a && a.matches && a.matches('[data-note-for], [data-sessnote]')) return; draw(); });
  },
  unmount() { if (H.unsub) H.unsub(); H.unsub = null; H.root = null; },
};

function rows() {
  let xs = closedTrades(H.scope);
  if (H.filter === 'Profitable') xs = xs.filter(r => r.pnl > 0); if (H.filter === 'Loss') xs = xs.filter(r => r.pnl < 0);
  if (H.filter === 'Signal at entry') xs = xs.filter(r => r.signals.length); if (H.filter === 'Differs from plan') xs = xs.filter(r => !r.withinPlan);
  if (H.q) xs = xs.filter(r => r.exit.sym.toLowerCase().includes(H.q.toLowerCase()));
  return xs;
}
function planCell(r) { const note = (r.exit.reflection && r.exit.reflection.note) || r.exit.note || (r.entry && r.entry.note); return r.withinPlan ? ['Matches plan' + (note ? ' · note' : ''), ''] : ['Differs' + (note ? ' · note' : ''), 'caution']; }
function draw() {
  H.root.querySelector('[data-part="scope"]').innerHTML = SCOPES.map(([k, l]) => `<button class="${H.scope === k ? 'on' : ''}" aria-pressed="${H.scope === k}" data-scope="${k}">${l}</button>`).join('');
  H.root.querySelector('[data-part="filters"]').innerHTML = FILTERS.map(f => `<button class="${H.filter === f ? 'on' : ''}" aria-pressed="${H.filter === f}" data-filter="${f}">${f}</button>`).join('');
  const all = closedTrades(H.scope), pnl = all.reduce((a, r) => a + r.pnl, 0), notes = all.filter(r => r.exit.reflection || r.exit.note || (r.entry && r.entry.note)).length;
  H.root.querySelector('[data-part="sum"]').innerHTML = [['Closed trades', all.length], ['Profitable', `${all.filter(r => r.pnl > 0).length} of ${all.length}`], ['Realised result', sgn(pnl), pnl < 0 ? 'down' : pnl > 0 ? 'up' : ''], ['Within plan', `${all.filter(r => r.withinPlan).length} of ${all.length}`], ['With a signal at entry', `${all.filter(r => r.signals.length).length} of ${all.length}`], ['Reflections and notes', notes]].map(([l, v, c]) => `<div>${metric(l, v, null, c || '')}</div>`).join('');
  drawTable(); drawSession();
}
function drawTable() {
  const xs = rows(), link = linkCheckins(), open = Object.keys(store.s.holdings).length;
  const ck = c => c ? `${sq}<span>${esc(c.label)}</span>` : `<span class="mute">${link ? '—' : 'Not linked'}</span>`;
  const head = `<tr><th style="width:64px">Exit</th><th style="width:100px">Stock</th><th style="width:230px">Trade</th><th style="width:90px">Result</th><th style="width:200px">Your check-in before entry</th><th style="width:170px">You after exit</th><th style="width:210px">Signals at entry</th><th>Plan</th></tr>`;
  const body = xs.map(r => { const id = r.exit.t, [pl, pc] = planCell(r), ckB = r.entry ? checkinBefore(r.entry.t) : null, ckA = checkinAfter(r.exit.t), isOpen = H.open === id;
    return `<tr class="${isOpen ? 'open' : ''}" data-row="${id}" tabindex="0" aria-expanded="${isOpen}"><td class="t-num mute">${r.exit.clock}</td><td><b class="t-sub">${r.exit.sym}</b></td><td class="ink2">${r.entry ? `Buy ${r.exit.qty} @ ${inr(r.entry.price, 0)} → ${inr(r.exit.price, 0)}` : `Sell ${r.exit.qty} @ ${inr(r.exit.price, 0)}`}</td><td class="t-num ${r.pnl >= 0 ? 'up' : 'down'}">${sgn(r.pnl)}</td>
      <td><span class="ckc">${ck(ckB)}</span></td><td><span class="ckc">${ck(ckA)}</span></td><td>${r.signals.length ? r.signals.map(s => tag('caution', s)).join(' ') : '<span class="mute">None</span>'}</td><td class="${pc || 'ink2'}">${pl}</td></tr>${isOpen ? expanded(r, ckB, ckA) : ''}`; }).join('');
  H.root.querySelector('[data-part="table"]').innerHTML = `<table class="th-tbl">${head}${body || `<tr><td colspan="8" class="mute" style="padding:20px 12px">No closed trades ${H.scope === 'today' ? 'this session' : 'in this period'}${H.filter !== 'All' || H.q ? ' match this filter' : ''}. A trade appears here when you sell a position${open ? ` · ${open} open position${open > 1 ? 's' : ''}` : ''}.</td></tr>`}</table>`;
}
function expanded(r, ckB, ckA) {
  const e = r.entry, x = r.exit, pl = store.s.strategies[x.sym], R = x.reflection || {};
  const kv = (g, k, v, c = '') => `<div class="kvrow" style="align-items:flex-start"><span style="width:12px;flex:none;line-height:0;padding-top:3px">${g || ''}</span><span class="k" style="width:104px;flex:none">${k}</span><span class="${c}" style="flex:1">${v}</span></div>`;
  const exitVs = pl ? (x.price <= pl.stop + pl.stop * 0.003 && x.price >= pl.stop - pl.stop * 0.003 ? `Sold ${inr(Math.abs(x.price - pl.stop), 0)} ${x.price >= pl.stop ? 'above' : 'below'} stop-loss (${inr(pl.stop, 0)})` : x.price >= pl.target ? `At or above target (${inr(pl.target, 0)})` : x.price > pl.stop ? `Before stop-loss (${inr(pl.stop, 0)}) and target (${inr(pl.target, 0)})` : `Below stop-loss (${inr(pl.stop, 0)})`) : 'No plan saved';
  return `<tr class="exp"><td colspan="8"><div class="th-exp">
    <div class="col" style="gap:10px"><span class="t-over">At entry${e ? ' · ' + e.clock : ''}</span>
      ${kv(dot, 'Market', e && e.market ? `${e.market.s >= 0 ? 'Positive' : 'Negative'} sentiment · ${e.market.a >= 0 ? 'high' : 'low'} activity (${e.market.q})` : 'Not recorded for this trade')}${kv(sq, 'Your check-in', ckB ? `${esc(ckB.label)} (${ckB.clock})` : linkCheckins() ? 'None within 10 min' : 'Not linked (Profile → Privacy)')}${kv('', 'Plan', pl ? `Entry ${inr(pl.entry, 0)} · stop ${inr(pl.stop, 0)} · target ${inr(pl.target, 0)} (current plan)` : 'No plan saved')}
      <p class="t-meta mute">Camera estimates are not stored with trades.</p></div>
    <div class="col" style="gap:10px"><span class="t-over">Observed at the time</span>${r.signals.length ? r.signals.map(s => obsItem('behaviour', e ? e.clock : '', s)).join('') : '<p class="small mute">No behavioural signals were present at entry.</p>'}${x.diffs && x.diffs.length ? `<p class="small ink2">${esc(x.diffs.join('; '))}</p>` : ''}</div>
    <div class="col" style="gap:10px"><span class="t-over">After exit · your reflection</span>
      ${kv('', 'Exit vs plan', exitVs)}${kv('', 'Your answer', R.answer ? esc(R.answer) : '—')}${kv('', 'Your note', R.note ? `“${esc(R.note)}”` : '—')}${kv(sq, 'How you felt', ckA ? `${esc(ckA.label)} (check-in ${ckA.clock})` : '—')}
      <div class="row" style="gap:8px"><input class="input" data-note-for="${x.t}" placeholder="${R.note ? 'Replace your note' : 'Add a note (optional)'}" aria-label="Note about this trade" style="height:28px;font-size:12px"><button class="btn sm" data-save-note="${x.t}">Save note</button></div>
      <a class="btn sm" href="#strategy" style="align-self:flex-start">Review original strategy</a></div></div></td></tr>`;
}
function drawSession() {
  const s = store.s, items = [...s.prompts.map(p => ({ t: p.t, src: 'interp', what: p.kind === 'precheck' ? `Trade Check · ${p.title}` : p.title, sym: p.sym, choice: p.response === 'review' ? 'Paused and reviewed' : p.response === 'continue' ? 'Continued' : p.response === 'dismiss' ? 'Dismissed' : 'No response' })),
    ...s.trades.filter(t => t.reflection).map(t => ({ t: t.reflection.clock || t.clock, src: 'behaviour', what: `Post-loss reflection · ${t.sym}`, choice: `Answered “${t.reflection.answer || '—'}”${t.reflection.note ? ' · added a note' : ''}` }))].sort((a, b) => String(b.t).localeCompare(String(a.t)));
  const ct = closedTrades('today'), differs = ct.filter(r => !r.withinPlan), noted = differs.filter(r => r.exit.reflection || r.exit.note || (r.entry && r.entry.note)).length, afterLoss = s.trades.filter(t => (t.signals || []).includes('Repeated trading after a loss')).length;
  H.root.querySelector('[data-part="session"]').innerHTML = `<div class="two-h"><h2 class="t-section">Today’s session</h2><p class="small mute">AI input you received and what you chose · plan vs actions</p></div>
    <div class="th-sess"><div class="th-ai">${items.length ? items.map(i => `<div class="r"><span class="t-num mute" style="width:48px;flex:none">${esc(i.t)}</span><div class="col" style="gap:2px;flex:1"><span class="t-over" style="color:${i.src === 'interp' ? 'var(--v2-caution)' : 'var(--v2-text-2)'}">${i.src === 'interp' ? 'Interpretation' : 'Observed behaviour'}</span><span class="small">${esc(i.what)}</span></div><span class="small ink2">${esc(i.choice)}</span></div>`).join('') : '<p class="small mute" style="padding:10px 0">No AI input this session yet.</p>'}
      <p class="t-meta mute">Whether a live camera estimate shaped the wording is not stored.</p></div>
      <div class="th-notes"><b class="t-sub">Plan vs actions</b>
        <div class="kvrow"><span class="k">Trades within plan</span><span class="v">${ct.length - differs.length} of ${ct.length}</span></div>
        <div class="kvrow"><span class="k">Notes explaining a difference</span><span class="v">${noted} of ${differs.length}</span></div>
        <div class="kvrow"><span class="k">Orders after a loss (within 15 min)</span><span class="v">${afterLoss}</span></div>
        <div class="field"><label for="th-note">Session note (optional)</label><textarea id="th-note" class="input" rows="2" data-sessnote placeholder="e.g. what you noticed about today’s trading">${esc(s.sessionNote || '')}</textarea><span class="hint">Saved with this session in this browser.</span></div>
        <button class="btn sm ghost" data-th="newsession" style="align-self:flex-start;padding-left:0">Finish this session and start a new one</button></div></div>`;
}

function onClick(e) {
  const b = e.target.closest('button');
  if (b) {
    if (b.dataset.scope) { H.scope = b.dataset.scope; H.open = null; draw(); return; }
    if (b.dataset.filter) { H.filter = b.dataset.filter; draw(); return; }
    if (b.dataset.saveNote) { const t = [...store.s.trades, ...(store.s.archive || [])].find(x => String(x.t) === b.dataset.saveNote), inp = H.root.querySelector(`[data-note-for="${b.dataset.saveNote}"]`); const v = inp && inp.value.trim(); if (!t || !v) return;
      t.reflection = { ...(t.reflection || {}), note: v, clock: (t.reflection && t.reflection.clock) || engine.clockStr() }; store.save(); store.log('note', `Note added to ${t.sym} trade`, { sym: t.sym }); toast('Note saved.'); draw(); return; }
    if (b.dataset.th === 'newsession') { if (!store.s.trades.length && !store.s.prompts.length) { toast('Nothing to summarise yet.'); return; } if (!confirm('Finish this session? Your trades move to history and your virtual balance resets.')) return; store.reset(); toast('Session saved. Your virtual balance is reset.'); H.scope = 'all'; draw(); return; }
    return;
  }
  const tr = e.target.closest('[data-row]'); if (tr && !e.target.closest('input')) { const id = +tr.dataset.row; H.open = H.open === id ? null : id; drawTable(); }
}
function onInput(e) { if (e.target.closest('[data-form="thsearch"]')) { H.q = e.target.value.trim(); drawTable(); } }
function onChange(e) { if (e.target.matches('[data-sessnote]')) { store.s.sessionNote = e.target.value; store.save(); toast('Session note saved.'); } }
