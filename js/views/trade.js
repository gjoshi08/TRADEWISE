import { store } from '../store.js';
import { engine } from '../engine.js';
import { affect, PRESETS } from '../affect.js';
import { ai, signals, RULES, ruleFor } from '../ai.js';
import { voice } from '../voice.js';
import { STOCKS, WATCH, INDICES, DEFAULT_PLAN, inr, sinr, fmt, pct, cls, esc } from '../data.js';
import { shell, ICON, toast, cmaSvg, vbar, quadLabel, openDrawer, closeDrawer, $, nav, camStatus } from '../ui.js';
import { makeChart } from '../chart.js';

const T = { sym: 'SHYINFO', tf: '1m', side: 'buy', qty: 8, tab: 'holdings', chart: null, raf: null, root: null, unsub: [], editTimer: null, demoOpen: false, tfShown: null };

export const trade = {
  render(root) {
    T.root = root; if (nav.pendingSym && STOCKS[nav.pendingSym]) { T.sym = nav.pendingSym; T.qtyInit = false; } nav.pendingSym = null; const plan = store.s.strategies[T.sym];
    if (!T.qtyInit) { T.qty = plan ? Math.max(1, Math.floor(plan.maxInvest / engine.price(T.sym))) : 1; T.qtyInit = true; }
    root.innerHTML = shell('dashboard') + `<main class="page wide"><div class="terminal">
      <aside class="panel wl" aria-label="Watchlist"><div class="wl-head"><b>Watchlist</b><span class="small mute">${WATCH.length} stocks</span></div>
        <div class="wl-list">${WATCH.map(s => `<button class="wl-item ${s === T.sym ? 'on' : ''}" data-sym="${s}"><b>${s}</b><span class="p" data-wp="${s}">${fmt(engine.price(s))}</span><span class="nm">${STOCKS[s].name}</span><span class="c" data-wc="${s}"></span></button>`).join('')}</div>
        <div class="idx">${INDICES.map(i => `<div><span class="n">${i.name}</span><div class="num small">${fmt(i.v)}</div><div class="num small ${cls(i.c)}">${pct(i.c)}</div></div>`).join('')}</div></aside>
      <section class="centre">
        <div class="panel chartcard"><div class="stockhead"><div><div class="row" style="gap:10px;align-items:baseline"><h1 class="h-m">${T.sym}</h1><span class="mute">${STOCKS[T.sym].name} · ${STOCKS[T.sym].sector} · NSE (simulated)</span></div>
          <div class="row" style="gap:14px;align-items:baseline"><span class="price" data-live="price">${inr(engine.price(T.sym))}</span><span class="num" data-live="chg"></span><span class="small mute" data-live="clock">${engine.clockStr()} IST</span></div></div>
          <div class="seg" role="group" aria-label="Timeframe">${['1m', '5m', '15m', '1D'].map(t => `<button class="${T.tf === t ? 'on' : ''}" data-tf="${t}">${t}</button>`).join('')}</div></div>
          <div class="chartbox" id="chart"></div></div>
        <div class="panel planstrip" data-part="planstrip"></div>
        <div class="panel dock" aria-label="TRADEWISE AI">
          <div class="cam" data-part="cam"></div>
          <div class="cma-mini" data-part="cma"></div>
          <div class="feed"><div class="feed-head"><b>TRADEWISE AI</b><span class="sp" style="flex:1"></span><button class="btn ghost sm" data-act="explain">Explain move</button></div><div class="feed-list" data-part="feed" aria-live="polite"></div></div>
          <div class="dock-ctrl" data-part="ctrl"></div>
        </div>
      </section>
      <aside class="right">
        <div data-part="iv"></div>
        <div class="panel order col" style="gap:14px" data-part="order"></div>
        <div class="panel port col" style="gap:12px" data-part="port"></div>
      </aside></div></main>
      <div class="demo"><button class="btn sm" data-act="demo" style="border-style:dashed">Presenter controls</button>${T.demoOpen ? demoPanel() : ''}</div>`;
    T.chart = makeChart(root.querySelector('#chart'), { height: 380 }); setChart(true);
    drawPlan(); drawOrder(); drawPort(); drawIV(); drawCam(); drawCMA(); drawFeed(); drawCtrl(); liveTick();
    bind(root);
    T.unsub.push(ai.on(() => { drawFeed(); drawIV(); refreshStatus(); }));
    T.unsub.push(affect.on(() => { drawCMA(); drawCamMeta(); drawCtrl(); refreshStatus(); }));
    T.unsub.push(voice.on(() => drawCtrl()));
    T.unsub.push(store.on((t, d) => { if (t === 'trade') { drawPort(); drawPlan(); updOrderLive(); }
      if (t === 'prompt-closed') { if (d.r === 'review') { if (d.p.plan) openReview(d.p); else { store.s._planSym = d.p.sym; store.save(); location.hash = 'strategy'; } } if (d.r === 'continue' && d.p.kind === 'precheck') place(true); } }));
    ai.welcome(); loopOverlay();
    if (!store.s.strategies[T.sym] && !store.s._planHint) { store.s._planHint = 1; ai.say('noplan', 'info', `There’s no saved plan for ${T.sym} yet. Save one on the Plan screen so I can compare your trades with it.`, 0); }
  },
  unmount() { T.unsub.forEach(u => u()); T.unsub = []; cancelAnimationFrame(T.raf); if (T.chart) T.chart.destroy(); T.chart = null; },
  tick() { liveTick(); },
};
// ---------- chart ----------
function setChart(fit) { if (!T.chart) return; T.chart.set(engine.candles(T.sym, T.tf)); T.chart.levels(store.s.strategies[T.sym]); if (fit) { T.chart.fit(); if (T.tf === '1m') T.chart.showRecent(120); } T.tfShown = T.tf; }
function liveTick() {
  const r = T.root; if (!r) return; const p = engine.price(T.sym), ch = engine.change(T.sym);
  const set = (sel, html, c) => { const el = r.querySelector(sel); if (el) { el.innerHTML = html; if (c != null) el.className = c; } };
  set('[data-live="price"]', inr(p)); set('[data-live="chg"]', `${sinr(p - STOCKS[T.sym].prev)} (${pct(ch)}) today`, 'num ' + cls(ch)); set('[data-live="clock"]', engine.clockStr(true) + ' IST');
  WATCH.forEach(s => { set(`[data-wp="${s}"]`, fmt(engine.price(s))); const c = engine.change(s); set(`[data-wc="${s}"]`, pct(c), 'c ' + cls(c)); });
  if (T.chart) T.chart.update(engine.lastBar(T.sym, T.tf));
  const pf = engine.portfolio(); set('[data-live="cash"]', inr(pf.cash, 0));
  updOrderLive(); drawPortLive(); drawPlanLive(); ai.tickNotes(T.sym); ai.evaluate();
}
// ---------- plan strip ----------
function drawPlan() {
  const el = T.root.querySelector('[data-part="planstrip"]'); const p = store.s.strategies[T.sym];
  el.innerHTML = p ? `<b>Your plan</b><span><span class="k">Entry</span> <span class="v">${inr(p.entry, 0)}</span></span><span><span class="k">Stop-loss</span> <span class="v">${inr(p.stop, 0)}</span></span><span><span class="k">Target</span> <span class="v">${inr(p.target, 0)}</span></span><span><span class="k">Max</span> <span class="v">${inr(p.maxInvest, 0)}</span></span><span style="flex:1"></span><span data-live="planstatus"></span><span class="small mute legend"><span class="legend-line"></span>on the chart</span>`
    : `<span>No saved plan for <b>${T.sym}</b>. The AI needs a plan to compare against.</span><span style="flex:1"></span><a class="btn sm primary" href="#strategy">Create a plan</a>${T.sym === 'SHYINFO' ? '<button class="btn sm" data-act="loadplan">Use example plan</button>' : ''}`;
  drawPlanLive(); const lp = el.querySelector('[data-act="loadplan"]'); if (lp) lp.onclick = () => loadExamplePlan();
}
function drawPlanLive() { const el = T.root.querySelector('[data-live="planstatus"]'); if (!el) return; const p = store.s.strategies[T.sym]; const exp = engine.exposure(T.sym); const price = engine.price(T.sym);
  el.innerHTML = exp > p.maxInvest + 1 ? '<span class="tag plan">Above your limit</span>' : price <= p.stop ? '<span class="tag plan">At or below your stop-loss</span>' : '<span class="tag n">Within plan</span>'; }
function loadExamplePlan() { store.s.strategies.SHYINFO = { ...DEFAULT_PLAN, savedAt: engine.clockStr(), savedReal: Date.now() }; store.save(); store.log('plan', 'Saved the example strategy for SHYINFO: entry ₹1,150, stop ₹1,120, target ₹1,210, max ₹10,000', { sym: 'SHYINFO' }); if (T.sym === 'SHYINFO') { T.qty = 8; } drawPlan(); drawOrder(); setChart(false); toast('Example plan saved for SHYINFO.'); }
// ---------- order panel ----------
function drawOrder() {
  const el = T.root.querySelector('[data-part="order"]'); const buy = T.side === 'buy'; const h = store.s.holdings[T.sym];
  el.innerHTML = `<div class="row between"><b class="h-s">Simulated order</b><span class="tag sim">VIRTUAL</span></div>
    <div class="bs" role="group" aria-label="Order side"><button class="b ${buy ? 'on' : ''}" data-side="buy">Buy</button><button class="s ${!buy ? 'on' : ''}" data-side="sell">Sell</button></div>
    <div class="field"><label for="qty">Quantity <span class="mute small">${!buy ? `· you hold ${h ? h.qty : 0}` : ''}</span></label><div class="qty"><button data-q="-1" aria-label="Decrease quantity">−</button><input id="qty" class="input" inputmode="numeric" value="${T.qty}"><button data-q="1" aria-label="Increase quantity">+</button></div></div>
    <div><div class="kv"><span class="mute">Market price</span><span class="v" data-live="mkt"></span></div><div class="kv"><span class="mute">Estimated value</span><span class="v" data-live="est"></span></div><div class="kv"><span class="mute">Virtual cash</span><span class="v" data-live="cash2"></span></div></div>
    <div data-live="limit"></div>
    <button class="btn lg block ${buy ? 'buy' : 'sell'}" data-act="place">Place simulated ${buy ? 'buy' : 'sell'}</button>
    <p class="small mute">Virtual money only. The AI never places, blocks or changes orders.</p>`;
  updOrderLive(); ai.setDraft({ sym: T.sym, side: buy ? 'BUY' : 'SELL', qty: T.qty });
}
function updOrderLive() {
  const r = T.root; if (!r) return; const p = engine.price(T.sym), pf = engine.portfolio(); const set = (s, h) => { const e = r.querySelector(s); if (e) e.innerHTML = h; };
  set('[data-live="mkt"]', inr(p)); set('[data-live="est"]', inr(T.qty * p)); set('[data-live="cash2"]', inr(pf.cash, 0));
  const plan = store.s.strategies[T.sym]; const lim = r.querySelector('[data-live="limit"]'); if (!lim) return;
  if (plan && T.side === 'buy') { const after = engine.exposure(T.sym) + T.qty * p; const over = after > plan.maxInvest + 1;
    lim.innerHTML = `<div class="kv small"><span class="${over ? '' : 'mute'}" style="${over ? 'color:var(--plan);font-weight:600' : ''}">In ${T.sym} after this order</span><span class="v" style="${over ? 'color:var(--plan);font-weight:600' : ''}">${inr(after, 0)} / ${inr(plan.maxInvest, 0)}</span></div><div class="planbar"><i class="${over ? 'over' : ''}" style="width:${Math.min(100, after / plan.maxInvest * 100)}%"></i></div>`;
  } else lim.innerHTML = plan ? '' : `<p class="small mute">No plan for ${T.sym}. Orders can’t be compared with a plan.</p>`;
}
function setQty(q, typed) { q = Math.max(0, Math.floor(q) || 0); if (q === T.qty && !typed) return; T.qty = q; const i = T.root.querySelector('#qty'); if (i && !typed) i.value = q; updOrderLive(); ai.setDraft({ sym: T.sym, side: T.side === 'buy' ? 'BUY' : 'SELL', qty: q }); clearTimeout(T.editTimer); T.editTimer = setTimeout(() => ai.noteEdit(T.sym, q), typed ? 700 : 250); }
function place(force) {
  const d = { sym: T.sym, side: T.side === 'buy' ? 'BUY' : 'SELL', qty: T.qty };
  if (!force) { const p = ai.precheck(d); if (p) { toast('Before you place this, the AI has a quick note. Nothing is blocked.'); return; } }
  const res = engine.order(d.side, d.sym, d.qty); toast(res.ok ? `${d.side === 'BUY' ? 'Bought' : 'Sold'} ${d.qty} ${d.sym} at ${inr(res.trade.price)} (simulated)` : res.msg);
  if (res.ok) { drawOrder(); drawPort(); drawPlan(); }
}
// ---------- portfolio ----------
function drawPort() {
  const el = T.root.querySelector('[data-part="port"]'); const s = store.s;
  el.innerHTML = `<div class="row between"><b class="h-s">Portfolio</b><div class="seg"><button class="${T.tab === 'holdings' ? 'on' : ''}" data-tab="holdings">Holdings</button><button class="${T.tab === 'history' ? 'on' : ''}" data-tab="history">History</button></div></div>
    <div data-live="pfsum"></div><div class="hist">${T.tab === 'holdings' ? (Object.keys(s.holdings).length ? `<table class="tbl"><thead><tr><th>Stock</th><th class="r">Qty</th><th class="r">Avg</th><th class="r">P&amp;L</th></tr></thead><tbody>${Object.entries(s.holdings).map(([k, h]) => `<tr><td><b>${k}</b></td><td class="r">${h.qty}</td><td class="r">${fmt(h.avg)}</td><td class="r" data-hp="${k}"></td></tr>`).join('')}</tbody></table>` : '<p class="small mute">No holdings yet. Your simulated buys will appear here.</p>')
      : (s.trades.length ? `<table class="tbl"><tbody>${[...s.trades].reverse().map(t => `<tr><td class="num small mute">${t.clock}</td><td><b class="${t.side === 'BUY' ? 'up' : 'down'}">${t.side}</b> ${t.qty} ${t.sym}<div class="small mute">${esc(t.tag)}</div></td><td class="r">${fmt(t.price)}</td></tr>`).join('')}</tbody></table>` : '<p class="small mute">No trades yet.</p>')}</div>`;
  el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { T.tab = b.dataset.tab; drawPort(); }); drawPortLive();
}
function drawPortLive() { const r = T.root; if (!r) return; const pf = engine.portfolio(); const el = r.querySelector('[data-live="pfsum"]'); if (el) el.innerHTML = `<div class="grid2" style="gap:10px"><div><span class="small mute">Total value</span><div class="num h-s">${inr(pf.total, 0)}</div></div><div><span class="small mute">P&amp;L (open + closed)</span><div class="num h-s ${cls(pf.unrealised + pf.realised)}">${sinr(pf.unrealised + pf.realised, 0)}</div></div></div>`;
  Object.entries(store.s.holdings).forEach(([k, h]) => { const c = r.querySelector(`[data-hp="${k}"]`); if (c) { const v = (engine.price(k) - h.avg) * h.qty; c.innerHTML = `<span class="${cls(v)}">${sinr(v, 0)}</span>`; } }); }
// ---------- intervention ----------
function drawIV() {
  const el = T.root && T.root.querySelector('[data-part="iv"]'); if (!el) return; const p = ai.prompt; if (!p) { el.innerHTML = ''; return; }
  if (el.dataset.pid !== String(p.id)) { el.dataset.pid = p.id; const rc = T.root.querySelector('.right'); if (rc) requestAnimationFrame(() => rc.scrollTo({ top: 0, behavior: 'smooth' })); }
  const plan = p.plan, ord = p.order, buy = ord.side === 'BUY';
  el.innerHTML = `<section class="intervene" role="region" aria-label="AI input">
    <div class="meta"><span class="eyebrow ai">AI input · ${p.t}</span><span class="mute">You didn’t ask for this</span></div>
    <div class="flow" aria-label="AI process"><span class="on"><i></i>Observe</span><span class="on"><i></i>Interpret</span><span class="on"><i></i>Input</span><span class="on me"><i></i>You decide</span></div>
    <h2 class="h-s">${esc(p.title)}</h2><p class="ink2">${esc(p.message)}</p>
    ${!plan ? `<table class="cmp">${p.facts.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${esc(v)}</td></tr>`).join('')}</table>` : `<table class="cmp"><tr><th></th><th>Your plan</th><th>${buy ? 'This order' : 'Selling now'}</th></tr>
      ${buy ? `<tr><td>Investment in ${p.sym}</td><td class="r">${inr(plan.maxInvest, 0)} max</td><td class="r ${ord.afterValue > plan.maxInvest ? 'diff' : ''}">${inr(ord.afterValue, 0)}</td></tr><tr><td>Price</td><td class="r">entry ${inr(plan.entry, 0)}</td><td class="r ${ord.price > plan.entry * 1.015 ? 'diff' : ''}">${inr(ord.price)}</td></tr>` : `<tr><td>Exit for a loss</td><td class="r">stop ${inr(plan.stop, 0)}</td><td class="r diff">${inr(ord.price)}</td></tr>`}
      <tr><td>Stop-loss</td><td class="r">${inr(plan.stop, 0)}</td><td class="r">${inr(plan.stop, 0)}</td></tr></table>`}
    <div class="col" style="gap:8px"><span class="eyebrow">What the AI observed</span>${p.observed.map(o => `<div class="reason"><span class="ic ${o.state}">${o.state === 'met' ? ICON.check : ''}</span><span><b>${o.title}</b><span class="small mute">${esc(o.detail)}</span></span></div>`).join('')}</div>
    ${p.affect.mode !== 'off' && p.affect.quadrant !== 'none' && !p.affect.stale ? `<div class="row" style="gap:12px;align-items:center">${cmaSvg({ size: 84, v: p.affect.v, a: p.affect.a, unc: 0.3, labels: false, id: 'ivcma' })}<p class="small ink2">Optional affect estimate${p.affect.mode === 'demo' ? ' (simulated)' : ''}: <b>${quadLabel(p.affect.quadrant)}</b>, ${Math.round(p.affect.conf * 100)}% confidence. It only shaped the wording (rule ${p.rule}); it can’t trigger input.</p></div>` : ''}
    <details class="small"><summary style="cursor:pointer;color:var(--ai-ink);font-weight:600">Why did this appear?</summary><p class="ink2" style="margin-top:6px">${esc(p.why)} ${plan ? `Input only appears when your activity differs from your saved plan ${p.kind === 'proactive' ? 'and another trading signal is present (repeated changes or a fast price move)' : 'at the moment you place an order'}.` : 'Without a plan, input only appears when at least two signs point to a quick decision (for example a fast price move plus a large or repeated order).'}</p></details>
    ${p.offerExplain ? '<button class="btn ghost sm" data-act="explain">Explain what’s happening in plain words</button>' : ''}
    <div class="row"><button class="btn ai" style="flex:1" data-act="review">${plan ? 'Review Strategy' : 'Set a plan first'}</button><button class="btn" style="flex:1" data-act="continue">${p.kind === 'precheck' ? 'Continue and place' : 'Continue'}</button></div>
    <p class="small mute">The AI won’t place, block or change this order. You decide.</p></section>`;
  el.querySelector('[data-act="review"]').onclick = () => ai.respond('review');
  el.querySelector('[data-act="continue"]').onclick = () => ai.respond('continue');
}
function openReview(p) {
  const plan = p.plan, maxQ = Math.max(0, Math.floor((plan.maxInvest - engine.exposure(p.sym)) / engine.price(p.sym)));
  openDrawer(`<div class="dh"><div><span class="eyebrow">Strategy review · ${p.sym}</span><h2 class="h-m" style="margin-top:4px">Your plan, side by side</h2><p class="small mute">Nothing changes unless you choose below.</p></div><button class="btn ghost sm" data-act="x" aria-label="Close">${ICON.x}</button></div>
  <div class="db"><div class="callout n"><span><b>You wrote${plan.savedAt ? ' at ' + plan.savedAt : ''}:</b> “${esc(plan.reason || 'No reason written.')}”</span></div>
  <table class="cmp"><tr><th></th><th>Your plan</th><th>Now</th></tr><tr><td>Entry</td><td class="r">${inr(plan.entry, 0)}</td><td class="r">${inr(engine.price(p.sym))}</td></tr><tr><td>Stop-loss</td><td class="r">${inr(plan.stop, 0)}</td><td class="r">${inr(plan.stop, 0)}</td></tr><tr><td>Target</td><td class="r">${inr(plan.target, 0)}</td><td class="r">${inr(plan.target, 0)}</td></tr><tr><td>Invested in ${p.sym}</td><td class="r">up to ${inr(plan.maxInvest, 0)}</td><td class="r">${inr(engine.exposure(p.sym), 0)}${p.order.side === 'BUY' ? ` → <span style="color:var(--plan);font-weight:600">${inr(p.order.afterValue, 0)}</span> with this order` : ''}</td></tr></table>
  <b>What would you like to do?</b>
  <div class="col" style="gap:10px">${p.order.side === 'BUY' ? `<button class="option" data-c="keep"><span class="radio"></span><span><b>Keep my plan</b><span class="d">${maxQ > 0 ? `Set the quantity to ${maxQ}, the most that fits your limit.` : 'Clear this order. You’re already at your limit.'}</span></span></button>` : `<button class="option" data-c="keep"><span class="radio"></span><span><b>Keep my plan</b><span class="d">Don’t sell now; your stop-loss stays at ${inr(plan.stop, 0)}.</span></span></button>`}
  <button class="option" data-c="edit"><span class="radio"></span><span><b>Update my plan</b><span class="d">Change your numbers and note why. The change is recorded.</span></span></button>
  <button class="option" data-c="anyway"><span class="radio"></span><span><b>Place the order anyway</b><span class="d">${p.order.side === 'BUY' ? 'Buy' : 'Sell'} ${p.order.qty} ${p.sym} now. Nothing is blocked.</span></span></button></div></div>
  <div class="df"><span class="small mute" style="margin-right:auto;align-self:center">Your choice is saved for reflection, not judged.</span><button class="btn" data-act="x">Close</button></div>`, d => {
    d.querySelectorAll('[data-act="x"]').forEach(b => b.onclick = closeDrawer);
    d.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = b.dataset.c; closeDrawer();
      if (c === 'keep') { if (p.order.side === 'BUY') setQty(maxQ); store.log('choice', 'After reviewing, you kept your original plan', { sym: p.sym }); toast('Kept your plan.'); }
      if (c === 'edit') { store.log('choice', 'After reviewing, you chose to update your plan', { sym: p.sym }); location.hash = 'strategy'; }
      if (c === 'anyway') { store.log('choice', 'After reviewing, you placed the order anyway', { sym: p.sym }); place(true); } });
  });
}
// ---------- AI dock ----------
function drawCam() {
  const el = T.root.querySelector('[data-part="cam"]'); const s = affect.state; el.innerHTML = '';
  if (s.mode === 'camera' && affect.video) { const v = affect.video; v.setAttribute('aria-label', 'Your camera, processed on this device'); el.appendChild(v); const c = document.createElement('canvas'); c.width = 168; c.height = 126; el.appendChild(c); el.insertAdjacentHTML('beforeend', '<div class="scan"></div><span class="badge"><span class="dot pulse" style="color:#9F95FF"></span>Live · on device</span><span class="badge2" data-part="q"></span>'); v.play().catch(() => { }); }
  else if (s.mode === 'demo') el.innerHTML = `<svg viewBox="0 0 168 126" width="168" height="126" aria-hidden="true"><ellipse cx="84" cy="56" rx="22" ry="27" fill="#34405A"/><path d="M38 126c5-26 24-38 46-38s41 12 46 38z" fill="#34405A"/><g stroke="#8F84FF" stroke-width="2" fill="none" stroke-linecap="round"><path d="M56 34V24h10M102 24h10v10M112 82v10h-10M66 92H56V82"/></g></svg><div class="scan"></div><span class="badge">Demo · simulated</span><span class="badge2" data-part="q"></span>`;
  else el.innerHTML = `<div class="off"><div class="col" style="gap:6px;align-items:center">${ICON.camOff}<span>${s.mode === 'loading' ? 'Starting camera…' : 'Camera off'}</span><button class="btn sm" data-act="camon" style="height:28px;font-size:12px">Turn on</button></div></div>`;
  drawCamMeta(); const b = el.querySelector('[data-act="camon"]'); if (b) b.onclick = async () => { await affect.startCamera(); if (affect.state.mode === 'error') { toast(affect.state.error + ' Try demonstration mode from the AI status.'); } drawCam(); };
}
function drawCamMeta() { const q = T.root && T.root.querySelector('[data-part="q"]'); const s = affect.state; if (q) q.textContent = s.quality || (s.face ? 'Face found' : 'Looking for a face…');
  const m = T.root && T.root.querySelector('[data-part="mode"]'); if (m) m.textContent = s.mode === 'camera' ? 'camera on' : s.mode === 'demo' ? 'demo mode' : 'camera off';
  const cam = T.root && T.root.querySelector('[data-part="cam"]'); if (cam && s.mode === 'camera') { let cb = cam.querySelector('.calbar'); if (s.calibrating != null) { if (!cb) { cam.insertAdjacentHTML('beforeend', '<div class="calbar"><i></i></div>'); cb = cam.querySelector('.calbar'); } cb.firstChild.style.width = Math.round(s.calibrating * 100) + '%'; } else if (cb) cb.remove(); }
  if (cam) { const has = !!cam.querySelector('video, svg, .off'); const want = s.mode === 'camera' ? 'video' : s.mode === 'demo' ? 'svg' : '.off'; if (!cam.querySelector(want) && has) drawCam(); } }
function drawCMA() { const el = T.root && T.root.querySelector('[data-part="cma"]'); if (!el) return; const s = affect.state; const on = s.mode === 'camera' || s.mode === 'demo';
  const paused = s.mode === 'camera' && (s.stale || !s.face);   // never show a paused estimate as current
  el.innerHTML = cmaSvg({ size: 118, v: s.v, a: s.a, unc: s.unc, trail: s.trail, labels: false, active: on && !paused, id: 'minicma' }) + `<span>${on ? (paused ? '<b style="color:var(--ink)">No face · estimate paused</b>' : `<b style="color:var(--ink)">${quadLabel(s.quadrant)}</b>`) : 'No estimate'}</span><span>${on ? (paused ? 'Not used' : `${Math.round(s.conf * 100)}% confidence · ±${s.unc.toFixed(2)}${s.mode === 'demo' ? ' · simulated' : ''}`) : 'Trading data only'}</span>`; }
function modelNote(s) {
  if (s.mode === 'demo') return 'Demonstration mode: simulated values, no camera.';
  if (s.engine === 'tradewise') return `Model: TRADEWISE affect model (MobileNetV2; expression head trained on RAF-DB; valence/arousal from a pretrained AffectNet regressor), running in your browser on face-api's TensorFlow.js (${s.backend}, ~${Math.round(s.inferMs)} ms per estimate, every ${(s.modelEvery / 1000).toFixed(1)} s). Face detection: face-api TinyFaceDetector. Accuracy on live webcam video has not been validated. No frames are stored or uploaded.`;
  return `Model: pretrained @vladmandic/face-api (TinyFaceDetector, 68-point tiny landmarks, FER expression classifier), running in your browser. Expression probabilities are mapped to valence/arousal with fixed circumplex coordinates, a heuristic and not a validated measure of emotion.${s.modelErr ? ' (The TRADEWISE affect model could not load, so this fallback is used.)' : ''} No frames are stored.`;
}
function exprNote(s) {
  if (s.mode !== 'camera' || s.engine !== 'tradewise' || !s.expr || s.stale || !s.face) return '';
  const rows = Object.entries(s.expr).filter(([k]) => k !== 'contempt').sort((x, y) => y[1] - x[1]).slice(0, 3);
  return `<p class="small mute"><b>Facial-configuration estimate</b> (what the camera sees, not how you feel): ${rows.map(([k, p]) => `${k}-like ${Math.round(p * 100)}%`).join(' · ')}</p>`;
}
function drawFeed() { const el = T.root && T.root.querySelector('[data-part="feed"]'); if (!el) return; const f = ai.feed;
  el.innerHTML = f.length ? f.map((m, i) => `<div class="fmsg ${m.kind} ${i === 0 ? 'first' : ''}"><time>${m.t}</time><span>${esc(m.text)}</span></div>`).join('') : '<div class="fmsg info"><span>Observing quietly.</span></div>'; }
function drawCtrl() { const el = T.root && T.root.querySelector('[data-part="ctrl"]'); if (!el) return; const s = affect.state, v = voice.state; const camOn = s.mode === 'camera' || s.mode === 'demo';
  const key = [s.mode, v.speak].join('|'); if (el.dataset.key === key) return; el.dataset.key = key;
  el.innerHTML = `<button class="iconbtn ${camOn ? 'on' : ''}" data-act="camtoggle">${camOn ? ICON.cam : ICON.camOff}${camOn ? 'Camera on' : 'Camera off'}</button><button class="iconbtn ${v.speak ? 'on' : ''}" data-act="speaktoggle" title="Read input aloud if I look away (speech only, no microphone)">${v.speak ? ICON.speak : ICON.mute}Speech ${v.speak ? 'on' : 'off'}</button><button class="iconbtn" data-act="details">Details</button>`;
  el.querySelector('[data-act="camtoggle"]').onclick = async () => { if (camOn) { affect.stop(); } else { await affect.startCamera(); if (affect.state.mode === 'error') toast('Camera unavailable here. ' + affect.state.error); } drawCam(); };
  el.querySelector('[data-act="speaktoggle"]').onclick = () => voice.setSpeak(!v.speak);
  el.querySelector('[data-act="details"]').onclick = openDetails; }
function openDetails() {
  const s = affect.state, sg = signals(ai.draft || { sym: T.sym, side: 'BUY', qty: T.qty }), rule = ruleFor(s.quadrant);
  openDrawer(`<div class="dh"><div><span class="eyebrow ai">AI observer</span><h2 class="h-m" style="margin-top:4px">What the AI sees right now</h2></div><button class="btn ghost sm" data-act="x" aria-label="Close">${ICON.x}</button></div>
  <div class="db"><div class="row" style="gap:20px;align-items:center">${cmaSvg({ size: 220, v: s.v, a: s.a, unc: s.unc, trail: s.trail, active: s.mode === 'demo' || (s.mode === 'camera' && s.face && !s.stale), id: 'dcma' })}<div class="bars" style="flex:1">${vbar('Valence', s.v, s.unc, 'Unpleasant', 'Pleasant')}${vbar('Arousal', s.a, s.unc, 'Low', 'High')}<p class="small"><b>${s.mode === 'camera' && (s.stale || !s.face) ? 'No face · estimate paused' : quadLabel(s.quadrant)}</b><br><span class="mute">${Math.round(s.conf * 100)}% confidence · ${s.mode === 'demo' ? 'simulated values' : s.mode === 'camera' ? `camera estimate · ${esc(s.quality || '')}` : 'camera off'}</span></p>${exprNote(s)}</div></div>
  <div class="col" style="gap:8px"><b>Trading signals (these decide whether input appears)</b>
   <div class="reason"><span class="ic ${sg.deviation.on ? 'met' : 'no'}">${sg.deviation.on ? ICON.check : ''}</span><span><b>Strategy deviation</b><span class="small mute">${esc(sg.deviation.diffs.map(d => d.text).join('; ') || (store.s.strategies[T.sym] ? 'Current draft fits your plan' : 'No plan saved for ' + T.sym))}</span></span></div>
   <div class="reason"><span class="ic ${sg.churn.on ? 'met' : 'no'}">${sg.churn.on ? ICON.check : ''}</span><span><b>Repeated order changes</b><span class="small mute">${sg.churn.n} change(s) in the last 2 minutes (3 or more counts)</span></span></div>
   <div class="reason"><span class="ic ${sg.market.on ? 'met' : 'no'}">${sg.market.on ? ICON.check : ''}</span><span><b>Market movement</b><span class="small mute">${pct(sg.market.move, 2)} in the last 5 minutes (1.2% or more counts)</span></span></div></div>
  <div class="callout ai"><span><b>Current affect rule: ${rule}. ${RULES[rule].name}.</b> ${RULES[rule].action} The camera estimate never triggers input on its own.</span></div>
  <p class="small mute">${esc(modelNote(s))}</p>
  <a class="btn" href="#profile/how-ai-works">Read how the AI decides</a></div>`, d => d.querySelectorAll('[data-act="x"]').forEach(b => b.onclick = closeDrawer));
}
function loopOverlay() {
  const draw = () => { const c = T.root && T.root.querySelector('.cam canvas'); const s = affect.state;
    if (c) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); if (s.box) { g.strokeStyle = '#9F95FF'; g.lineWidth = 2; const x = s.box.x * c.width, y = s.box.y * c.height, w = s.box.w * c.width, h = s.box.h * c.height, k = 10;
      g.beginPath(); [[x, y + k, x, y, x + k, y], [x + w - k, y, x + w, y, x + w, y + k], [x + w, y + h - k, x + w, y + h, x + w - k, y + h], [x + k, y + h, x, y + h, x, y + h - k]].forEach(([a, b, c2, d, e, f]) => { g.moveTo(a, b); g.lineTo(c2, d); g.lineTo(e, f); }); g.stroke();
      if (s.points) { g.fillStyle = 'rgba(159,149,255,.85)'; s.points.forEach(([px, py]) => { g.fillRect(px * c.width - 1, py * c.height - 1, 2, 2); }); } } }
    T.raf = requestAnimationFrame(draw); };
  T.raf = requestAnimationFrame(draw);
}
function refreshStatus() { const el = document.querySelector('[data-live="aistatus"]'); if (!el) return; const st = camStatus(); el.textContent = st.txt; el.parentElement.className = 'status aistatus ' + st.cls; }
// ---------- presenter controls ----------
function demoPanel() { const s = affect.state; return `<div class="demo-panel"><b class="small">Presenter controls</b><span class="small mute">These simulate market events and user actions for a demonstration.</span>
  <button class="btn sm" data-demo="plan">1 · Load the example plan (SHYINFO)</button>
  <button class="btn sm" data-demo="buy8">2 · Buy 8 SHYINFO (within plan)</button>
  <button class="btn sm" data-demo="drop">3 · Make SHYINFO fall ~1.8%</button>
  <button class="btn sm" data-demo="edits">4 · Change quantity 4 → 8 → 12 (as the user)</button>
  <button class="btn sm" data-demo="rally">FOMO case · make KONKAN rise ~2.8%</button>
  <label class="small mute" for="demo-aff">Affect (demonstration mode)</label><select id="demo-aff" class="input" style="height:38px;font-size:14px" data-demo-aff>${['', ...Object.keys(PRESETS)].map(k => `<option value="${k}" ${s.mode === 'demo' && s.preset === k ? 'selected' : ''}>${k ? PRESETS[k].label : (s.mode === 'camera' ? 'Using real camera' : 'Off / choose…')}</option>`).join('')}</select>
  <label class="row small"><input type="checkbox" data-demo-away ${s.lookAway ? 'checked' : ''} ${s.mode === 'demo' ? '' : 'disabled'}> Simulate looking away (speech read-out)</label></div>`; }
function runDemo(k) {
  if (k === 'plan') loadExamplePlan();
  if (k === 'buy8') { if (T.sym !== 'SHYINFO') { T.sym = 'SHYINFO'; trade.unmount(); trade.render(T.root); } if (!store.s.strategies.SHYINFO) loadExamplePlan(); T.side = 'buy'; setQty(8); place(true); }
  if (k === 'drop') engine.scenario('drop', 'SHYINFO');
  if (k === 'rally') { engine.scenario('rally', 'KONKAN'); toast('KONKAN is rising. Select it in the watchlist to try the FOMO case.'); }
  if (k === 'edits') { if (T.sym !== 'SHYINFO') { T.sym = 'SHYINFO'; trade.unmount(); trade.render(T.root); } T.side = 'buy'; drawOrder(); [4, 8, 12].forEach((q, i) => setTimeout(() => { T.qty = q; const inp = T.root.querySelector('#qty'); if (inp) inp.value = q; updOrderLive(); ai.setDraft({ sym: 'SHYINFO', side: 'BUY', qty: q }); ai.noteEdit('SHYINFO', q); }, 600 + i * 900)); }
}
function bind(root) {
  if (root._twBound) return; root._twBound = true;
  root.addEventListener('click', e => {
    const t = e.target.closest('button, a'); if (!t) return;
    if (t.dataset.sym) { T.sym = t.dataset.sym; const pl = store.s.strategies[T.sym]; T.qty = pl ? Math.max(1, Math.floor(pl.maxInvest / engine.price(T.sym))) : 1; trade.unmount(); trade.render(root); return; }
    if (t.dataset.tf) { T.tf = t.dataset.tf; root.querySelectorAll('[data-tf]').forEach(b => b.classList.toggle('on', b.dataset.tf === T.tf)); setChart(true); return; }
    if (t.dataset.side) { T.side = t.dataset.side; const h = store.s.holdings[T.sym]; if (T.side === 'sell') T.qty = h ? h.qty : 0; drawOrder(); return; }
    if (t.dataset.q) { setQty(T.qty + +t.dataset.q); return; }
    if (t.dataset.act === 'place') { place(false); return; }
    if (t.dataset.act === 'explain') { ai.explain(T.sym); return; }
    if (t.dataset.act === 'demo') { T.demoOpen = !T.demoOpen; const d = root.querySelector('.demo'); d.innerHTML = `<button class="btn sm" data-act="demo" style="border-style:dashed">Presenter controls</button>${T.demoOpen ? demoPanel() : ''}`; return; }
    if (t.dataset.demo) { runDemo(t.dataset.demo); return; }
  });
  root.addEventListener('input', e => { if (e.target.id === 'qty') setQty(parseInt(e.target.value, 10) || 0, true); });
  root.addEventListener('change', e => {
    if (e.target.matches('[data-demo-aff]')) { const v = e.target.value; if (v) affect.startDemo(v); drawCam(); }
    if (e.target.matches('[data-demo-away]')) affect.setLookAway(e.target.checked);
  });
}
