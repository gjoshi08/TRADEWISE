import { store } from '../store.js';
import { engine } from '../engine.js';
import { STOCKS, WATCH, DEFAULT_PLAN, inr, fmt, esc } from '../data.js';
import { shell, toast, ICON } from '../ui.js';
import { makeChart } from '../chart.js';

let draft = null, chart = null;
export const plan = {
  render(root) {
    const saved = store.s.strategies; if (store.s._planSym) { const sy = store.s._planSym; delete store.s._planSym; store.save(); draft = { ...(saved[sy] || suggest(sy)) }; } if (!draft) draft = { ...(saved.SHYINFO || DEFAULT_PLAN) };
    root.innerHTML = shell('strategy') + `<main class="page col" style="gap:26px">
      <div class="col" style="gap:6px"><span class="eyebrow">Plan before you trade</span><h1 class="h-l">Build your trading strategy</h1><p class="lead">Decide your numbers now, while things are calm. TRADEWISE compares your trades with this plan, and that is the <b>only</b> thing that can make the AI speak up.</p></div>
      <div class="research">${ICON.info}<span>In our survey, <b>6</b> of 21 never plan before a trade and <b>4</b> rarely do. Saving a plan here takes about a minute.</span></div>
      <div class="grid2" style="grid-template-columns:1.05fr 1fr;gap:28px;align-items:start">
        <form class="card pad col" style="gap:18px" data-form="plan" novalidate>
          <div class="field"><label for="p-sym">Stock</label><select id="p-sym" class="input" data-f="sym">${WATCH.map(s => `<option value="${s}" ${draft.sym === s ? 'selected' : ''}>${s} · ${STOCKS[s].name}</option>`).join('')}</select><span class="hint">Current price <b class="num" data-live="planprice">${inr(engine.price(draft.sym))}</b> (simulated)</span></div>
          <div class="grid2" style="gap:16px">
            ${fld('entry', 'Entry price', 'The price you plan to buy at.')}
            ${fld('target', 'Target price', 'Where you’ll sell to take a profit.')}
            ${fld('stop', 'Stop-loss', 'Where you’ll sell to limit a loss. Deciding now means you don’t decide under pressure.')}
            ${fld('maxInvest', 'Maximum investment', 'The most money you’ll put into this trade.')}
          </div>
          <div class="field"><label for="p-reason">Why are you entering this trade?</label><textarea id="p-reason" class="input" rows="3" data-f="reason">${esc(draft.reason)}</textarea><span class="hint">You’ll see this again if your trading starts to drift from your plan.</span></div>
          <div data-part="errors"></div>
          <div class="row"><button class="btn primary lg" type="submit">Save My Strategy</button><a class="btn" href="#dashboard">Go to Dashboard</a></div>
        </form>
        <div class="col" style="gap:16px">
          <section class="card pad col" style="gap:14px" data-part="summary"></section>
          ${Object.keys(saved).length ? `<section class="card pad col" style="gap:10px"><b>Saved strategies</b>${Object.values(saved).map(p => `<div class="row between small"><span><b>${p.sym}</b> <span class="mute">entry ${inr(p.entry, 0)} · stop ${inr(p.stop, 0)} · target ${inr(p.target, 0)} · max ${inr(p.maxInvest, 0)}</span></span><button class="btn ghost sm" data-load="${p.sym}">Edit</button></div>`).join('')}</section>` : ''}
        </div>
      </div></main>`;
    const sumEl = root.querySelector('[data-part="summary"]');
    const update = () => {
      const d = draft, shares = Math.floor(d.maxInvest / d.entry) || 0, invest = shares * d.entry, loss = shares * (d.entry - d.stop), gain = shares * (d.target - d.entry), rr = (d.target - d.entry) / Math.max(0.01, d.entry - d.stop);
      const errs = []; if (!(d.stop < d.entry)) errs.push('Stop-loss should be below your entry price.'); if (!(d.target > d.entry)) errs.push('Target should be above your entry price.'); if (!(d.maxInvest >= d.entry)) errs.push('Maximum investment should allow at least one share.');
      root.querySelector('[data-part="errors"]').innerHTML = errs.map(e => `<div class="callout plan">${e}</div>`).join('');
      sumEl.innerHTML = `<span class="eyebrow">Your plan in one sentence</span><p class="h-s" style="font-weight:600;line-height:1.45">Buy up to <b>${shares} shares</b> of ${d.sym} near <b>${inr(d.entry, 0)}</b>. Sell at <b>${inr(d.target, 0)}</b> to take a profit, or at <b>${inr(d.stop, 0)}</b> to limit the loss.</p>
        <div id="planchart" style="height:220px"></div>
        <div class="grid3"><div><span class="small mute">You’ll invest</span><div class="num h-s">${inr(invest, 0)}</div></div><div><span class="small mute">Most you could lose</span><div class="num h-s down">${inr(loss, 0)}</div></div><div><span class="small mute">Possible gain</span><div class="num h-s up">${inr(gain, 0)}</div></div></div>
        <p class="small mute">Reward-to-risk ${fmt(rr, 1)} : 1. This compares the possible gain with the possible loss; it says nothing about which is more likely.</p>`;
      if (chart) chart.destroy(); chart = makeChart(sumEl.querySelector('#planchart'), { height: 220, small: true }); if (chart) { chart.set(engine.candles(d.sym, '15m')); chart.levels(d); chart.fit(); }
      return errs;
    };
    root.querySelectorAll('[data-f]').forEach(el => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      const k = el.dataset.f; if (k === 'sym') { draft = { ...(saved[el.value] || suggest(el.value)) }; plan.render(root); return; }
      draft[k] = k === 'reason' ? el.value : parseFloat(el.value.replace(/[^\d.]/g, '')) || 0; if (k !== 'reason') update();
    }));
    root.querySelectorAll('[data-load]').forEach(b => b.onclick = () => { draft = { ...saved[b.dataset.load] }; plan.render(root); });
    root.querySelector('[data-form="plan"]').addEventListener('submit', e => { e.preventDefault(); if (update().length) { toast('Please fix the highlighted values first.'); return; }
      store.s.strategies[draft.sym] = { ...draft, savedAt: engine.clockStr(), savedReal: Date.now() }; store.save(); store.log('plan', `Saved strategy for ${draft.sym}: entry ${inr(draft.entry, 0)}, stop ${inr(draft.stop, 0)}, target ${inr(draft.target, 0)}, max ${inr(draft.maxInvest, 0)}`, { sym: draft.sym });
      toast('Strategy saved. The AI will compare your trades with it.'); location.hash = 'dashboard'; });
    update();
  },
  unmount() { if (chart) { chart.destroy(); chart = null; } },
  tick(root) { const el = root.querySelector('[data-live="planprice"]'); if (el && draft) el.textContent = inr(engine.price(draft.sym)); },
};
function fld(k, l, h) { return `<div class="field"><label for="p-${k}">${l}</label><div class="inwrap"><span class="pre">₹</span><input id="p-${k}" class="input num" inputmode="decimal" value="${draft[k]}" data-f="${k}"></div><span class="hint">${h}</span></div>`; }
function suggest(sym) { const p = engine.price(sym); const r = v => Math.round(v); return { sym, entry: r(p), target: r(p * 1.05), stop: r(p * 0.975), maxInvest: 10000, reason: '' }; }
