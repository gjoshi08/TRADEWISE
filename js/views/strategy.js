// 05 Strategy — implementation of Figma frame 57:808. Settings (8 col) · How TRADEWISE uses this (4 col).
// Limits / risk & pace / personal rules are saved with "Save changes" (Discard reverts). Stock plans are edited in a
// drawer that keeps the previous plan builder's rules (suggested values, validation, one-sentence summary).
import { store } from '../store.js';
import { engine } from '../engine.js';
import { voice } from '../voice.js';
import { STOCKS, WATCH, inr, fmt, esc } from '../data.js';
import { shell, pageTitle, toast, openDrawer, closeDrawer, tag, ICON } from '../ui.js';
import { prefs } from '../behaviour.js';

const DEFAULT_RULES = [{ on: true, text: 'Wait 15 minutes after a losing trade before the next order', sig: 'Repeated trading after a loss' }, { on: true, text: 'Write a short note when I exit before my stop-loss or target', sig: 'Strategy deviation' }, { on: false, text: 'No new positions after 15:00', sig: 'Strategy deviation' }];
const PACE = ['About 1 per 20 min', 'About 1 per hour', 'A few per day'];
const ST = { root: null, d: null, dirty: false };
const fresh = () => { const p = prefs(); return { maxPerTrade: p.maxPerTrade, maxDailyLoss: p.maxDailyLoss, tradesPerDay: p.tradesPerDay, risk: p.risk || 'Moderate', pace: p.pace || PACE[0], holding: p.holding || 'Intraday', showPlan: p.showPlan !== false, rules: JSON.parse(JSON.stringify(store.s.rules || DEFAULT_RULES)) }; };

export const strategy = {
  render(root) {
    ST.root = root; ST.d = fresh(); ST.dirty = false;
    root.innerHTML = shell('strategy') + `<main class="page" style="padding-top:0">${pageTitle('Strategy', 'Your rules for simulated trading. Trade Check compares each order with them — nothing is enforced, and you can change them at any time.', '<div class="row" style="gap:8px"><button class="btn ghost" data-st="discard">Discard</button><button class="btn primary" data-st="save">Save changes</button></div>')}
      <div class="st-body"><section class="st-set" data-part="set"></section><aside class="st-use" data-part="use"></aside></div></main>`;
    draw(); root.addEventListener('click', onClick); root.addEventListener('change', onChange);
    if (store.s._planSym) { const sy = store.s._planSym; delete store.s._planSym; store.save(); editPlan(sy); }   // from Trade Check "Pause & review"
  },
  unmount() { ST.root = null; },
};

const segs = (key, opts) => `<div class="seg boxed" role="radiogroup">${opts.map(o => `<button role="radio" aria-checked="${ST.d[key] === o}" class="${ST.d[key] === o ? 'on' : ''}" data-seg="${key}" data-v="${o}">${o}</button>`).join('')}</div>`;
const group = (title, desc, feeds, body, cls = '') => `<div class="st-g"><div class="about"><b class="t-sub">${title}</b><p class="small mute">${desc}</p><div class="row" style="gap:4px;flex-wrap:wrap">${feeds.map(f => tag('n', f)).join('')}</div></div><div class="fields ${cls}">${body}</div></div>`;
const field = (k, l, h, pre = '₹') => `<div class="field"><label for="st-${k}">${l}</label><div class="inwrap">${pre ? `<span class="pre">${pre}</span>` : ''}<input id="st-${k}" class="input" inputmode="numeric" data-num="${k}" value="${ST.d[k]}" ${pre ? '' : 'style="padding-left:10px"'}></div><span class="hint">${h}</span></div>`;
const labelled = (l, node, h) => `<div class="field"><span class="t-label ink2">${l}</span>${node}${h ? `<span class="hint">${h}</span>` : ''}</div>`;

function draw() {
  const plans = Object.values(store.s.strategies);
  ST.root.querySelector('[data-part="set"]').innerHTML =
    group('Limits', 'Money you are willing to put into one trade and to lose in one day.', ['Position-size deviation', 'Strategy deviation'], `<div class="limits">${field('maxPerTrade', 'Maximum per trade', 'Larger orders show a position-size note in Trade Check.')}${field('maxDailyLoss', 'Maximum daily loss', 'Orders after this are noted as a strategy deviation.')}${field('tradesPerDay', 'Maximum trades per day', 'Counts new positions opened, not individual orders.', '')}</div>`)
    + group('Risk and pace', 'How much price movement you accept, how often you expect to trade, and how long you usually hold.', ['Unusual trading frequency', 'Strategy deviation'],
      labelled('Preferred risk level', segs('risk', ['Low', 'Moderate', 'High']), `${ST.d.risk}: stop-loss usually ${{ Low: '1–2%', Moderate: '2–3%', High: '3–5%' }[ST.d.risk]} below entry. Used to suggest stop-loss values; you can always set your own.`)
      + labelled('Usual trading pace', segs('pace', PACE), 'Unusual trading frequency compares your recent pace with this (or with your median once you have 5 sessions).')
      + labelled('Holding period', segs('holding', ['Intraday', 'A few days', 'Weeks']), ST.d.holding === 'Intraday' ? 'Intraday: positions are expected to close before 15:30 (simulated clock).' : 'Positions may be held across sessions.'))
    + group('Stock plans', 'Entry, stop-loss, target and maximum for specific stocks, with your reason.', ['Rapid-momentum entry', 'Strategy deviation'],
      `${plans.length ? `<table class="dtable st-plans"><colgroup><col style="width:90px"><col style="width:80px"><col style="width:80px"><col style="width:80px"><col style="width:90px"><col></colgroup><thead><tr><th>Stock</th><th>Entry</th><th>Stop-loss</th><th>Target</th><th>Max</th><th>Reason</th></tr></thead>
        <tbody>${plans.map(p => `<tr data-edit="${p.sym}" tabindex="0" title="Edit the ${p.sym} plan"><td><b class="t-sub">${p.sym}</b></td><td>${inr(p.entry, 0)}</td><td>${inr(p.stop, 0)}</td><td>${inr(p.target, 0)}</td><td>${inr(p.maxInvest, 0)}</td><td class="w">${esc(p.reason || '—')}</td></tr>`).join('')}</tbody></table>` : '<p class="small mute">No stock plans yet. Orders can only be compared with your general limits.</p>'}
      <button class="btn sm ghost" data-st="addplan" style="align-self:flex-start;padding-left:0">+ Add stock plan</button>`)
    + group('Personal rules', 'Rules in your own words. TRADEWISE reminds you of them; it never stops an order.', ['Repeated trading after a loss', 'Strategy deviation'],
      ST.d.rules.map((r, i) => `<div class="st-rule"><button class="toggle ${r.on ? 'on' : ''}" role="switch" aria-checked="${r.on}" aria-label="${esc(r.text)}" data-rule="${i}"></button><span class="${r.on ? '' : 'mute'}" style="flex:1">${esc(r.text)}</span><span class="t-meta mute">→ ${esc(r.sig)}</span></div>`).join('')
      + `<div class="st-rule" data-part="newrule" hidden><input class="input" data-newrule placeholder="Write a rule in your own words" aria-label="New rule"><button class="btn sm" data-st="addrule-save">Add</button></div><button class="btn sm ghost" data-st="addrule" style="align-self:flex-start;padding-left:0;margin-top:8px">+ Add a rule</button>`, 'rules');
  ST.root.querySelector('[data-part="use"]').innerHTML = `<b class="t-sub">How TRADEWISE uses your strategy</b><p class="small ink2">Each setting feeds one or more behavioural signals. A signal describes what happened and the data behind it; it never blocks an order.</p>
    <div class="st-map">${[['Position-size deviation', 'Maximum per trade', '> max, or > 1.5× your median order'], ['Unusual trading frequency', 'Usual trading pace', '≥ 2× your usual pace'], ['Rapid-momentum entry', 'Stock plan entry', '≥ 1.2% rise in 5 min, or > 0.5% above entry'], ['Repeated trading after a loss', 'Personal rule', 'Within 15 min of a losing sell'], ['Strategy deviation', 'Stop-loss, target, daily limits, rules', 'Any difference — you can add a note']].map(([s, f, t]) => `<div class="m"><b class="t-sub">${s}</b><span class="small ink2">From: ${f}</span><span class="t-meta mute">Threshold: ${t}</span></div>`).join('')}</div>
    <p class="t-meta mute">Thresholds are prototype defaults chosen for demonstration — not research findings and not scientifically validated.</p>
    <div class="st-rem"><span class="t-label ink2">Reminders</span>
      <div class="trow"><button class="toggle ${ST.d.showPlan ? 'on' : ''}" role="switch" aria-checked="${ST.d.showPlan}" aria-label="Show my plan in the AI Observer" data-st="showplan"></button><span class="small">Show my plan in the AI Observer</span></div>
      <div class="trow"><button class="toggle ${voice.state.speak ? 'on' : ''}" role="switch" aria-checked="${voice.state.speak}" aria-label="Read important observations aloud" data-st="speak"></button><span class="small">Read important observations aloud (speech only, no microphone)</span></div></div>`;
  ST.root.querySelector('[data-st="save"]').disabled = !ST.dirty;
}

function save() {
  const d = ST.d, cur = store.s.profile.prefs || {};
  store.s.profile.prefs = { ...cur, maxPerTrade: d.maxPerTrade, maxDailyLoss: d.maxDailyLoss, tradesPerDay: d.tradesPerDay, risk: d.risk, pace: d.pace, holding: d.holding, showPlan: d.showPlan };
  store.s.rules = d.rules; store.save(); store.log('plan', `Strategy settings saved: max ${inr(d.maxPerTrade, 0)} per trade, daily loss ${inr(d.maxDailyLoss, 0)}, ${d.tradesPerDay} positions a day`);
  ST.dirty = false; draw(); toast('Strategy saved. Trade Check compares each order with it.');
}
function onChange(e) { const t = e.target; if (t.dataset.num) { const v = parseInt(String(t.value).replace(/[^0-9]/g, ''), 10); if (v > 0) { ST.d[t.dataset.num] = v; ST.dirty = true; } draw(); } }
function onClick(e) {
  const tr = e.target.closest('[data-edit]'); if (tr) { editPlan(tr.dataset.edit); return; }
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.seg) { ST.d[b.dataset.seg] = b.dataset.v; ST.dirty = true; draw(); return; }
  if (b.dataset.rule) { const r = ST.d.rules[+b.dataset.rule]; r.on = !r.on; ST.dirty = true; draw(); return; }
  const a = b.dataset.st;
  if (a === 'save') save();
  if (a === 'discard') { ST.d = fresh(); ST.dirty = false; draw(); toast('Changes discarded.'); }
  if (a === 'showplan') { ST.d.showPlan = !ST.d.showPlan; ST.dirty = true; draw(); }
  if (a === 'speak') { voice.setSpeak(!voice.state.speak); draw(); }
  if (a === 'addplan') editPlan(null);
  if (a === 'addrule') { const n = ST.root.querySelector('[data-part="newrule"]'); n.hidden = false; n.querySelector('input').focus(); b.hidden = true; }
  if (a === 'addrule-save') { const i = ST.root.querySelector('[data-newrule]'); const txt = i.value.trim(); if (!txt) return; ST.d.rules.push({ on: true, text: txt, sig: 'Strategy deviation' }); ST.dirty = true; draw(); }
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest && e.target.closest('[data-edit]') && ST.root) editPlan(e.target.closest('[data-edit]').dataset.edit); });

// ---- Stock plan editor (logic kept from the previous plan builder) ----
function suggest(sym) { const p = engine.price(sym), r = v => Math.round(v), risk = (ST.d && ST.d.risk) || 'Moderate', stopPct = { Low: 0.985, Moderate: 0.975, High: 0.96 }[risk]; return { sym, entry: r(p), target: r(p * 1.05), stop: r(p * stopPct), maxInvest: (ST.d && ST.d.maxPerTrade) || 10000, reason: '' }; }
function editPlan(sym) {
  const saved = store.s.strategies; let d = sym && saved[sym] ? { ...saved[sym] } : suggest(sym || WATCH.find(s => !saved[s]) || 'SHYINFO');
  const draw = el => {
    const shares = Math.floor(d.maxInvest / d.entry) || 0, loss = shares * (d.entry - d.stop), gain = shares * (d.target - d.entry), rr = (d.target - d.entry) / Math.max(0.01, d.entry - d.stop);
    const errs = []; if (!(d.stop < d.entry)) errs.push('Stop-loss should be below your entry price.'); if (!(d.target > d.entry)) errs.push('Target should be above your entry price.'); if (!(d.maxInvest >= d.entry)) errs.push('Maximum investment should allow at least one share.');
    const f = (k, l, h) => `<div class="field"><label for="pe-${k}">${l}</label><div class="inwrap"><span class="pre">₹</span><input id="pe-${k}" class="input" inputmode="decimal" value="${d[k]}" data-pf="${k}"></div><span class="hint">${h}</span></div>`;
    el.innerHTML = `<div class="dh"><div><span class="t-over">Stock plan</span><h2 class="t-section" style="margin-top:4px">${saved[d.sym] ? 'Edit' : 'Add'} a plan for ${d.sym}</h2><p class="small mute">Decide your numbers while things are calm. Trade Check compares each order with them.</p></div><button class="btn ghost sm" data-act="x" aria-label="Close">${ICON.x}</button></div>
      <div class="db"><div class="field"><label for="pe-sym">Stock</label><select id="pe-sym" class="input" data-pf="sym">${WATCH.map(s => `<option value="${s}" ${d.sym === s ? 'selected' : ''}>${s} · ${STOCKS[s].name}</option>`).join('')}</select><span class="hint">Current price ${inr(engine.price(d.sym))} (simulated)</span></div>
        <div class="grid2" style="gap:16px">${f('entry', 'Entry price', 'The price you plan to buy at.')}${f('target', 'Target price', 'Where you’ll sell to take a profit.')}${f('stop', 'Stop-loss', 'Where you’ll sell to limit a loss.')}${f('maxInvest', 'Maximum investment', 'The most money you’ll put into this stock.')}</div>
        <div class="field"><label for="pe-reason">Why are you entering this trade?</label><textarea id="pe-reason" class="input" rows="3" data-pf="reason">${esc(d.reason)}</textarea><span class="hint">You’ll see this again if your trading starts to differ from your plan.</span></div>
        ${errs.map(x => `<div class="callout plan">${x}</div>`).join('')}
        <div class="soft" style="padding:14px 16px"><p class="small">Buy up to <b>${shares} shares</b> of ${d.sym} near <b>${inr(d.entry, 0)}</b>. Sell at <b>${inr(d.target, 0)}</b> to take a profit, or at <b>${inr(d.stop, 0)}</b> to limit the loss.</p>
          <div class="row" style="gap:24px;padding-top:10px"><div class="metric"><span class="m-l">Most you could lose</span><span class="m-v down">${inr(loss, 0)}</span></div><div class="metric"><span class="m-l">Possible gain</span><span class="m-v up">${inr(gain, 0)}</span></div><div class="metric"><span class="m-l">Reward-to-risk</span><span class="m-v">${fmt(rr, 1)} : 1</span></div></div>
          <p class="t-meta mute" style="padding-top:8px">Reward-to-risk compares the possible gain with the possible loss; it says nothing about which is more likely.</p></div></div>
      <div class="df">${saved[d.sym] ? '<button class="btn ghost" data-pe="delete" style="margin-right:auto">Delete plan</button>' : ''}<button class="btn" data-act="x">Cancel</button><button class="btn primary" data-pe="save" ${errs.length ? 'disabled' : ''}>Save plan</button></div>`;
    el.querySelectorAll('[data-act="x"]').forEach(x => x.onclick = closeDrawer);
    el.querySelectorAll('[data-pf]').forEach(i => i.addEventListener('change', () => { const k = i.dataset.pf; if (k === 'sym') d = saved[i.value] ? { ...saved[i.value] } : suggest(i.value); else d[k] = k === 'reason' ? i.value : parseFloat(String(i.value).replace(/[^\d.]/g, '')) || 0; draw(el); }));
    const sv = el.querySelector('[data-pe="save"]'); if (sv) sv.onclick = () => { store.s.strategies[d.sym] = { ...d, savedAt: engine.clockStr(), savedReal: Date.now() }; store.save(); store.log('plan', `Saved strategy for ${d.sym}: entry ${inr(d.entry, 0)}, stop ${inr(d.stop, 0)}, target ${inr(d.target, 0)}, max ${inr(d.maxInvest, 0)}`, { sym: d.sym }); closeDrawer(); toast(`Plan saved for ${d.sym}.`); if (ST.root) strategyRedraw(); };
    const del = el.querySelector('[data-pe="delete"]'); if (del) del.onclick = () => { if (!confirm(`Delete your plan for ${d.sym}?`)) return; delete store.s.strategies[d.sym]; store.save(); store.log('plan', `Deleted the plan for ${d.sym}`, { sym: d.sym }); closeDrawer(); if (ST.root) strategyRedraw(); };
  };
  openDrawer('', el => draw(el));
}
function strategyRedraw() { const keep = ST.d, dirty = ST.dirty; draw(); ST.d = keep; ST.dirty = dirty; }
