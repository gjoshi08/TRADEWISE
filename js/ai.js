// TRADEWISE AI: observe → interpret → provide input → human decides.
// Input is triggered ONLY by trading behaviour + plan + market context. The affect estimate (camera or demo)
// never triggers input by itself; it only adjusts wording (Circumplex rules A–E) and is shown with its confidence.
// The AI never places, blocks or changes an order.
import { store } from './store.js';
import { engine } from './engine.js';
import { affect } from './affect.js';
import { inr, fmt, pct } from './data.js';

const AI = { draft: null, edits: [], prompt: null, feed: [], last: {}, cooldown: {}, listeners: new Set(), lastQuadrant: 'none' };
const emit = () => AI.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

export const RULES = {
  A: { name: 'Pleasant · low activation', action: 'No interruption. Information only when asked.' },
  B: { name: 'Pleasant · high activation', action: 'If behaviour supports it: “Before increasing your position, would you like to check your original investment limit?”' },
  C: { name: 'Unpleasant · low activation', action: 'No automatic interruption from affect. Offer simple explanations when asked.' },
  D: { name: 'Unpleasant · high activation', action: 'If behaviour supports it: “Your order quantity has changed several times. Would you like to review your original strategy before continuing?”' },
  E: { name: 'Uncertain / neutral / camera off', action: 'No affect inference. Use trading behaviour and market context only.' },
};
export function ruleFor(q) { return { 'pleasant-low': 'A', 'pleasant-high': 'B', 'unpleasant-low': 'C', 'unpleasant-high': 'D' }[q] || 'E'; }

// src: 'behaviour' (observed behaviour) | 'interp' (interpretation/prompt) | 'estimate' (camera cue) | 'market' (market context) | 'system'
function say(key, kind, text, minGap = 15000, src = 'system') {
  const now = Date.now(); if (AI.last[key] && now - AI.last[key] < minGap) return; AI.last[key] = now;
  AI.feed.unshift({ t: engine.clockStr(), kind, text, src, id: now + Math.random() }); if (AI.feed.length > 40) AI.feed.pop(); emit();
}

export function signals(draft = AI.draft) {
  const sym = draft ? draft.sym : null; const s = affect.state; const out = { deviation: { on: false, diffs: [] }, churn: { on: false, n: 0 }, market: { on: false, move: 0 }, affect: s };
  if (!sym) return out;
  const price = engine.price(sym);
  if (draft.qty > 0) { const c = engine.compare(draft.side, sym, draft.qty, price); out.deviation = { on: c.diffs.length > 0, diffs: c.diffs, plan: c.plan }; }
  const recent = AI.edits.filter(e => e.sym === sym && Date.now() - e.t < 120000); out.churn = { on: recent.length >= 3, n: recent.length };
  const mv = engine.move(sym, 60); out.market = { on: Math.abs(mv) >= 1.2, move: mv };
  return out;
}

function build(kind, sg) {
  const d = AI.draft, sym = d.sym, plan = sg.deviation.plan, price = engine.price(sym), q = sg.affect.quadrant; const rule = ruleFor(q);
  const afterValue = engine.exposure(sym) + (d.side === 'BUY' ? d.qty * price : 0);
  let title = 'Your recent trading activity differs from your original strategy.';
  let message = d.side === 'BUY' ? `You planned to limit your investment to ${inr(plan.maxInvest, 0)}. Before increasing your position, would you like to review your plan?` : `Your plan’s exit for a loss is the stop-loss at ${inr(plan.stop, 0)}. Before selling now, would you like to review your plan?`;
  if (rule === 'B' && d.side === 'BUY') { title = 'A quick check before you add more.'; message = `Before increasing your position, would you like to check your original investment limit of ${inr(plan.maxInvest, 0)}?`; }
  if (rule === 'D' && sg.churn.on) { message = 'Your order quantity has changed several times. Would you like to review your original strategy before continuing?'; }
  const observed = [
    { state: sg.deviation.on ? 'met' : 'no', title: 'Strategy deviation', detail: sg.deviation.diffs.map(x => x.text).join('; ') || 'Within your plan' },
    { state: sg.churn.on ? 'met' : 'no', title: 'Repeated order changes', detail: sg.churn.n ? `Order size changed ${sg.churn.n} time${sg.churn.n > 1 ? 's' : ''} in the last 2 minutes` : 'No recent changes' },
    { state: sg.market.on ? 'met' : 'no', title: 'Market movement', detail: `${sym} ${pct(sg.market.move, 1)} in the last 5 minutes` },
    { state: 'sup', title: 'Affect estimate · supporting only', detail: sg.affect.mode === 'camera' || sg.affect.mode === 'demo' ? (q === 'uncertain' ? `Uncertain (${Math.round(sg.affect.conf * 100)}% confidence), so not used` : `${RULES[rule].name} · ${Math.round(sg.affect.conf * 100)}% confidence${sg.affect.mode === 'demo' ? ' · simulated' : ''}`) : 'Camera off · not used' },
  ];
  const why = kind === 'precheck' ? 'You pressed Place order, and this order differs from the plan you saved.' : `Your draft order differs from your saved plan${sg.churn.on ? ', its size has changed several times' : ''}${sg.market.on ? ', and the price is moving quickly' : ''}.`;
  return { id: Date.now(), kind, rule, sym, title, message, why, observed, offerExplain: rule === 'C', plan, order: { side: d.side, qty: d.qty, price, value: d.qty * price, afterValue }, affect: { mode: sg.affect.mode, v: sg.affect.v, a: sg.affect.a, conf: sg.affect.conf, quadrant: q, stale: sg.affect.mode === 'camera' && (sg.affect.stale || !sg.affect.face) }, t: engine.clockStr(), spoken: false };
}


// ---- Behaviour without a saved plan (FOMO, large unplanned orders, panic selling, overtrading) ----
const TRADES = [];
store.on(t => { if (t === 'trade') TRADES.push(Date.now()); });
function genericSignals(d) {
  const price = engine.price(d.sym), value = d.qty * price, mv = engine.move(d.sym, 60), pf = engine.portfolio();
  const plan = store.s.strategies[d.sym];
  const churnN = AI.edits.filter(e => e.sym === d.sym && Date.now() - e.t < 120000).length;
  return { plan, price, value, mv, share: value / Math.max(1, pf.total), recent: TRADES.filter(t => Date.now() - t < 120000).length, churnN,
    fastUp: mv >= 1.2, fastDown: mv <= -1.2, big: d.side === 'BUY' && value > 0.25 * pf.total };
}
function buildGeneric(kindOf, d, g, when) {
  const sg = { affect: affect.state }; const q = sg.affect.quadrant; const rule = ruleFor(q); const sym = d.sym;
  const pctTxt = Math.round(g.share * 100) + '%';
  const T = {
    fomo: [`${sym} is rising quickly and you don’t have a plan for it.`, rule === 'B' ? 'Before buying, would you like to check how much you want to put into this stock?' : 'Would you like to set an entry, stop-loss and limit before buying?'],
    big: [`This order would use ${pctTxt} of your virtual money, and there’s no plan for ${sym}.`, 'Would you like to set a limit for this stock first?'],
    panic: [`${sym} dropped quickly and you’re about to sell.`, 'Is this part of your plan, or would you like to look at your plan first?'],
    over: [`You’ve placed ${g.recent} orders in the last 2 minutes.`, 'Would you like to pause and check your plan before another one?'],
  }[kindOf];
  let [title, message] = T;
  if (rule === 'D' && g.churnN >= 3) message = 'Your order quantity has changed several times. Would you like to review your plan before continuing?';
  const observed = [
    { state: !g.plan ? 'met' : 'no', title: 'No saved plan', detail: g.plan ? 'A plan exists for ' + sym : `You haven’t saved a plan for ${sym}` },
    { state: (kindOf === 'fomo' && g.fastUp) || (kindOf === 'panic' && g.fastDown) ? 'met' : 'no', title: 'Market movement', detail: `${sym} ${pct(g.mv, 1)} in the last 5 minutes` },
    { state: g.big || g.recent >= 3 || g.churnN >= 3 ? 'met' : 'no', title: 'Trading behaviour', detail: [g.big ? `order is ${pctTxt} of your money` : '', g.recent >= 3 ? `${g.recent} orders in 2 minutes` : '', g.churnN >= 3 ? `size changed ${g.churnN} times` : ''].filter(Boolean).join(' · ') || 'Nothing unusual' },
    { state: 'sup', title: 'Affect estimate · supporting only', detail: sg.affect.mode === 'camera' || sg.affect.mode === 'demo' ? (q === 'uncertain' ? `Uncertain (${Math.round(sg.affect.conf * 100)}% confidence), so not used` : `${RULES[rule].name} · ${Math.round(sg.affect.conf * 100)}% confidence${sg.affect.mode === 'demo' ? ' · simulated' : ''}`) : 'Camera off · not used' },
  ];
  const facts = [['Stock', sym], ['Order', `${d.side === 'BUY' ? 'Buy' : 'Sell'} ${d.qty} at ${inr(g.price)}`], ['Value', inr(g.value, 0) + ` (${pctTxt} of your money)`], ['Last 5 minutes', pct(g.mv, 1)]];
  const why = when === 'precheck' ? 'You pressed Place order, and more than one sign suggests this may be a quick decision.' : 'Your draft order and the market together suggest this may be a quick decision.';
  return { id: Date.now(), kind: when, generic: kindOf, rule, sym, title, message, why, observed, facts, offerExplain: rule === 'C', plan: null, order: { side: d.side, qty: d.qty, price: g.price, value: g.value, afterValue: engine.exposure(sym) + (d.side === 'BUY' ? g.value : 0) }, affect: { mode: sg.affect.mode, v: sg.affect.v, a: sg.affect.a, conf: sg.affect.conf, quadrant: q, stale: sg.affect.mode === 'camera' && (sg.affect.stale || !sg.affect.face) }, t: engine.clockStr(), spoken: false };
}
function genericKind(d, g, atPlace) {
  if (d.side === 'BUY' && !g.plan && g.fastUp && (atPlace || g.churnN >= 2 || g.big)) return 'fomo';
  if (d.side === 'BUY' && !g.plan && g.big && atPlace) return 'big';
  if (d.side === 'SELL' && g.fastDown && !g.plan && atPlace) return 'panic';
  if (atPlace && g.recent >= 3) return 'over';
  return null;
}

export const ai = {
  on(fn) { AI.listeners.add(fn); return () => AI.listeners.delete(fn); },
  get feed() { return AI.feed; },
  get prompt() { return AI.prompt; },
  get draft() { return AI.draft; },
  setDraft(d) { AI.draft = d; },
  noteEdit(sym, qty) {
    AI.edits.push({ sym, qty, t: Date.now() }); store.s.draftEdits++; store.save();
    const n = AI.edits.filter(e => e.sym === sym && Date.now() - e.t < 120000).length;
    if (n >= 2) say('edits', 'notice', `Order size changed ${n} times in the last 2 minutes. I’m noting this.`, 8000, 'behaviour');
    this.evaluate();
  },
  evaluate() {
    const d = AI.draft; if (!d || !d.qty) return; const sg = signals(d);
    if (sg.deviation.on && d.side === 'BUY') say('dev' + d.sym, 'notice', `This draft would take ${d.sym} above your plan: ${sg.deviation.diffs[0].text.toLowerCase()}.`, 20000, 'behaviour');
    const cd = AI.cooldown[d.sym]; const cooled = !cd || Date.now() - cd.t > 60000 || d.qty > cd.qty;
    if (!AI.prompt && cooled && sg.deviation.on && (sg.churn.on || sg.market.on)) this.open(build('proactive', sg));
    else if (!AI.prompt && cooled && !sg.deviation.on) { const g = genericSignals(d); const k = genericKind(d, g, false); if (k) this.open(buildGeneric(k, d, g, 'proactive')); }
  },
  // Called when the user presses Place order. Returns a prompt if one should be shown first (never blocks).
  precheck(d) {
    AI.draft = d; if (AI.prompt && AI.prompt.sym === d.sym) return AI.prompt; const sg = signals(d);
    const cd = AI.cooldown[d.sym]; if (cd && cd.response === 'continue' && Date.now() - cd.t < 20000 && d.qty <= cd.qty) return null; // user just chose to continue
    if (!sg.deviation.on) { const g = genericSignals(d); const k = genericKind(d, g, true); if (!k) return null; const gp = buildGeneric(k, d, g, 'precheck'); this.open(gp); return gp; }
    const p = build('precheck', sg); this.open(p); return p;
  },
  // Privacy (V2): the persisted record holds only behaviour/plan facts. The camera-derived rule letter (A–E encodes the
  // affect quadrant) and whether affect shaped the wording stay on the in-memory prompt object and are never stored.
  open(p) { AI.prompt = p; store.s.prompts.push({ id: p.id, t: p.t, sym: p.sym, title: p.title, message: p.message, kind: p.kind, response: null });
    store.save(); store.log('ai', `AI offered input: ${p.title}`, { sym: p.sym }); say('p' + p.id, 'prompt', p.title + ' ' + p.message, 0, 'interp'); emit(); store.emit('prompt', p); },
  respond(r) {
    const p = AI.prompt; if (!p) return; const rec = store.s.prompts.find(x => x.id === p.id); if (rec) rec.response = r; store.save();
    AI.cooldown[p.sym] = { t: Date.now(), qty: p.order.qty, response: r }; AI.prompt = null;
    store.log('choice', r === 'review' ? 'You chose to review your strategy' : r === 'continue' ? 'You chose to continue' : 'You dismissed the input', { sym: p.sym });
    say('r' + p.id, 'info', r === 'review' ? 'Opening your plan side by side. Nothing has been changed.' : r === 'continue' ? 'Understood. Your order is unchanged. The decision is yours.' : 'Dismissed. I’ll keep observing quietly.', 0);
    emit(); store.emit('prompt-closed', { p, r });
  },
  tickNotes(sym) {
    const plan = store.s.strategies[sym]; const mv = engine.move(sym, 60); const price = engine.price(sym);
    if (Math.abs(mv) >= 1.2) say('mv' + sym, 'notice', `${sym} is ${mv < 0 ? 'down' : 'up'} ${fmt(Math.abs(mv), 1)}% in the last 5 minutes.${plan ? ` Your stop-loss is ${inr(plan.stop, 0)} (${inr(price - plan.stop, 0)} away).` : ''}`, 25000, 'market');
    if (plan && price <= plan.stop * 1.004 && price > plan.stop * 0.99) say('stop' + sym, 'notice', `${sym} is close to your stop-loss of ${inr(plan.stop, 0)}. Your plan says to exit there.`, 30000, 'market');
    if (plan && price >= plan.target * 0.996) say('tgt' + sym, 'notice', `${sym} reached your target area of ${inr(plan.target, 0)}.`, 30000, 'market');
    const q = affect.state.quadrant;
    if (q !== AI.lastQuadrant) { AI.lastQuadrant = q; const s = affect.state;
      if (q === 'uncertain') say('q', 'info', 'Affect estimate is uncertain right now, so it isn’t being used.', 20000, 'estimate');
      else if (q !== 'none') say('q', 'info', `Estimate: ${RULES[ruleFor(q)].name.toLowerCase()} (${Math.round(s.conf * 100)}% confidence). Not used on its own.`, 20000, 'estimate');
    }
    if (q === 'unpleasant-low') say('offer', 'info', 'If anything on the chart is unclear, ask me to explain it in plain words.', 120000);
  },
  explain(sym) {
    const mv = engine.move(sym, 60), ch = engine.change(sym); const plan = store.s.strategies[sym];
    say('ex' + Date.now(), 'info', `${sym} is ${pct(ch, 1)} today and ${pct(mv, 1)} in the last 5 minutes. A fall like this means more people are selling than buying right now; it doesn’t tell us what happens next.${plan ? ` Your plan exits at ${inr(plan.stop, 0)} for a loss and ${inr(plan.target, 0)} for a gain.` : ''}`, 0, 'market');
  },
  say,
  welcome() { say('hello', 'info', 'Observing quietly. I’ll only speak up if your trading starts to differ from your plan.', 60000); },
};
