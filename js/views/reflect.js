import { store, summarise } from '../store.js';
import { engine } from '../engine.js';
import { RULES } from '../ai.js';
import { RESEARCH, inr, sinr, cls, esc } from '../data.js';
import { shell, toast, ICON } from '../ui.js';

const dotColor = k => ({ trade: 'var(--ink)', ai: 'var(--ai)', choice: 'var(--ai)', plan: 'var(--plan)', market: 'var(--mute)' }[k] || 'var(--mute)');
const time = t => new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

export const reflect = {
  render(root) {
    const s = store.s, sum = summarise(s), pf = engine.portfolio();
    const ev = s.events.filter(e => ['trade', 'ai', 'choice', 'plan', 'market'].includes(e.kind) && !/Demonstration mode|Voice commands/.test(e.text));
    const matched = s.trades.filter(t => t.tag === 'Matches plan' || t.tag === 'Planned exit').length;
    const empty = !s.trades.length && !s.prompts.length;
    root.innerHTML = shell('history') + `<main class="page"><div class="col" style="gap:28px">
      <div class="row between" style="align-items:flex-end;flex-wrap:wrap"><div><span class="eyebrow">Reflect · this session</span><h1 class="h-l" style="margin-top:6px">How did your trading compare with your plan?</h1><p class="lead" style="margin-top:8px">A calm look back. Nothing here is a judgement. It shows what you planned, what you did, and when the AI offered input.</p></div>
        <div class="row"><a class="btn" href="#my-psychology">See insights across sessions</a><button class="btn primary" data-act="newsession">Finish and start a new session</button></div></div>
      ${empty ? `<div class="callout n">${ICON.info}<span>No trades yet in this session. Place a few simulated orders on the <a href="#dashboard"><b>Dashboard</b></a>, or open <b>Presenter controls</b> there to run the example scenario.</span></div>` : ''}
      <div class="grid3" style="grid-template-columns:repeat(4,1fr)">
        ${stat('Simulated trades', s.trades.length, `${matched} matched your plan`)}
        ${stat('Differed from plan', sum.deviations, 'orders outside your saved numbers')}
        ${stat('AI input offered', s.prompts.length, `${sum.reviewed} reviewed · ${sum.continued} continued`)}
        ${stat('Session P&L', sinr(pf.unrealised + pf.realised, 0), 'virtual money', cls(pf.unrealised + pf.realised))}
      </div>
      <div class="grid2" style="grid-template-columns:1.25fr 1fr;align-items:start">
        <section class="panel" style="padding:24px"><b class="h-s">Session timeline</b><p class="small mute" style="margin:4px 0 18px">From your actual activity in this session.</p>
          <div class="timeline">${ev.length ? ev.slice(-30).map(e => `<div class="tl-item"><time>${e.clock || time(e.t)}</time><span class="d" style="background:${dotColor(e.kind)}"></span><span>${esc(e.text)}${e.rule ? ` <span class="tag ai">rule ${e.rule}</span>` : ''}</span></div>`).join('') : '<p class="small mute">Your session events will appear here.</p>'}</div></section>
        <div class="col" style="gap:20px">
          <section class="panel" style="padding:24px"><b class="h-s">When the AI offered input</b>
            <div class="col" style="gap:12px;margin-top:14px">${s.prompts.length ? s.prompts.map(p => `<div style="border-left:3px solid var(--ai);padding-left:12px"><div class="small mute">${p.t} · ${p.sym} · ${p.kind === 'precheck' ? 'when placing an order' : 'while editing the order'}</div><div><b>${esc(p.title)}</b></div><div class="small">Your choice: <b>${p.response === 'review' ? 'Reviewed strategy' : p.response === 'continue' ? 'Continued' : p.response === 'dismiss' ? 'Dismissed' : 'No response yet'}</b></div></div>`).join('') : '<p class="small mute">The AI hasn’t offered input this session.</p>'}</div></section>
          <section class="panel" style="padding:24px"><b class="h-s">Your plans</b>
            <div class="col" style="gap:10px;margin-top:12px">${Object.values(s.strategies).length ? Object.values(s.strategies).map(p => { const exp = engine.exposure(p.sym); return `<div><div class="row between"><b>${p.sym}</b><span class="small num">${inr(exp, 0)} / ${inr(p.maxInvest, 0)}</span></div><div class="planbar"><i class="${exp > p.maxInvest ? 'over' : ''}" style="width:${Math.min(100, exp / p.maxInvest * 100)}%"></i></div><div class="small mute">Entry ${inr(p.entry, 0)} · stop ${inr(p.stop, 0)} · target ${inr(p.target, 0)}</div></div>`; }).join('') : '<p class="small mute">No saved plans. <a href="#strategy">Create one</a>.</p>'}</div></section>
        </div></div>
      <section class="panel" style="padding:24px"><b class="h-s">A note to yourself</b><p class="small mute" style="margin:4px 0 14px">Optional. Saved in this browser only.</p>
        <div class="col" style="gap:12px"><div class="row" style="flex-wrap:wrap">${['I followed my plan', 'I changed my mind under pressure', 'I wasn’t sure what the chart meant', 'The AI’s check was useful', 'The AI’s check wasn’t needed'].map(c => `<button class="chip" data-chip="${esc(c)}">${c}</button>`).join('')}</div>
        <textarea class="input" id="note" rows="3" placeholder="What would you do the same or differently next time?" style="height:auto;padding:12px;resize:vertical"></textarea>
        <div class="row"><button class="btn primary" data-act="savenote">Save reflection</button><span class="small mute">${s.reflections.length} saved</span></div></div></section>
      <div class="research">${ICON.info}<span>Why this screen: after a loss, the most common response in our survey was to <b>review the original strategy</b> (${RESEARCH.afterLoss[0][1]} people). Reflect makes that easy, using your own session data.</span></div>
    </div></main>`;
    const chosen = new Set();
    root.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => { const c = b.dataset.chip; chosen.has(c) ? chosen.delete(c) : chosen.add(c); b.classList.toggle('on'); });
    root.querySelector('[data-act="savenote"]').onclick = () => { const txt = root.querySelector('#note').value.trim(); if (!txt && !chosen.size) { toast('Pick a chip or write a note first.'); return; } s.reflections.push({ t: Date.now(), text: txt, tags: [...chosen] }); store.save(); store.log('reflect', 'Saved a reflection'); toast('Reflection saved.'); reflect.render(root); };
    root.querySelector('[data-act="newsession"]').onclick = () => { if (empty) { toast('Nothing to summarise yet.'); return; } store.reset(); toast('Session saved to Insights. Your virtual balance is reset.'); location.hash = 'my-psychology'; };
  },
};
function stat(label, v, sub, c = '') { return `<div class="panel" style="padding:20px"><span class="small mute">${label}</span><div class="statbig ${c}" style="font-size:36px">${v}</div><span class="small mute">${sub}</span></div>`; }

// ---------- Insights ----------
const EXAMPLE = [
  { date: 'Example A', trades: 6, deviations: 3, prompts: 2, reviewed: 1, continued: 1, planned: 3, edits: 9 },
  { date: 'Example B', trades: 5, deviations: 2, prompts: 2, reviewed: 2, continued: 0, planned: 4, edits: 5 },
  { date: 'Example C', trades: 4, deviations: 1, prompts: 1, reviewed: 1, continued: 0, planned: 4, edits: 3 },
];
export const insights = {
  render(root) {
    const s = store.s; const real = s.sessions.slice(-6); const cur = (s.trades.length || s.prompts.length) ? [{ ...summarise(s), date: 'Current' }] : [];
    const rows = real.length + cur.length >= 2 ? [...real.map((x, i) => ({ ...x, date: 'Session ' + (i + 1) })), ...cur] : null;
    const data = rows || EXAMPLE; const isEx = !rows;
    const max = Math.max(1, ...data.map(d => d.trades));
    const tot = data.reduce((a, d) => ({ trades: a.trades + d.trades, dev: a.dev + d.deviations, pr: a.pr + d.prompts, rev: a.rev + d.reviewed }), { trades: 0, dev: 0, pr: 0, rev: 0 });
    const lessons = s.lessonsDone.length;
    root.innerHTML = shell('my-psychology') + `<main class="page"><div class="col" style="gap:28px">
      <div><span class="eyebrow">Insights · across sessions</span><h1 class="h-l" style="margin-top:6px">Patterns in how you trade</h1><p class="lead" style="margin-top:8px">Based on your behaviour only: plans, orders and choices. TRADEWISE does not keep any camera estimates between sessions.</p></div>
      ${isEx ? `<div class="callout plan">${ICON.info}<span><b>Example data.</b> You have fewer than two sessions, so this page shows a labelled example. Finish a session on the Reflect screen to see your own patterns here.</span></div>` : ''}
      <div class="grid3">
        <div class="panel" style="padding:20px"><span class="small mute">Orders that matched a plan</span><div class="statbig">${tot.trades ? Math.round((tot.trades - tot.dev) / tot.trades * 100) : 0}%</div><span class="small mute">${tot.trades - tot.dev} of ${tot.trades} orders</span></div>
        <div class="panel" style="padding:20px"><span class="small mute">AI input you chose to review</span><div class="statbig" style="color:var(--ai-ink)">${tot.pr ? Math.round(tot.rev / tot.pr * 100) : 0}%</div><span class="small mute">${tot.rev} of ${tot.pr} times</span></div>
        <div class="panel" style="padding:20px"><span class="small mute">Lessons completed</span><div class="statbig">${lessons}<span style="font-size:22px" class="mute">/5</span></div><span class="small mute">${lessons < 5 ? '<a href="#markets">Continue learning</a>' : 'All modules done'}</span></div>
      </div>
      <section class="panel" style="padding:24px"><div class="row between"><b class="h-s">Orders per session</b><span class="row small mute" style="gap:14px"><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--ink);display:inline-block"></i>Matched plan</span><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:var(--plan);display:inline-block"></i>Differed from plan</span></span></div>
        <div class="col" style="gap:14px;margin-top:18px">${data.map(d => `<div style="display:grid;grid-template-columns:110px 1fr 80px;gap:14px;align-items:center"><span class="small">${esc(d.date)}${isEx ? ' <span class="tag n">example</span>' : ''}</span><div class="row" style="gap:3px;height:18px"><i style="height:100%;border-radius:4px;background:var(--ink);width:${(d.trades - d.deviations) / max * 100}%"></i><i style="height:100%;border-radius:4px;background:var(--plan);width:${d.deviations / max * 100}%"></i></div><span class="small num mute">${d.trades} orders</span></div>`).join('')}</div></section>
      <div class="grid2">
        <section class="panel" style="padding:24px"><b class="h-s">What this suggests</b><ul class="col" style="gap:10px;margin:14px 0 0 18px;font-size:15px">
          <li>${tot.dev / Math.max(1, tot.trades) > 0.3 ? 'Several orders went beyond the limit you set. Consider setting the limit you are actually comfortable with when you plan.' : 'Most of your orders stayed within your plans.'}</li>
          <li>${tot.rev >= tot.pr - tot.rev ? 'When the AI offered input, you usually chose to review your plan first.' : 'You often chose to continue after the AI’s input. That’s fine. If the checks feel unnecessary, tell us in your reflection.'}</li>
          <li>${lessons < 3 ? 'Learning modules on charts and strategy could make the numbers on the Trade screen easier to read.' : 'You’ve covered most of the learning modules.'}</li></ul>
          <p class="small mute" style="margin-top:12px">These are simple rules over counts, not predictions about you.</p></section>
        <section class="panel" style="padding:24px"><b class="h-s">Your reflections</b><div class="col" style="gap:10px;margin-top:12px">${s.reflections.length ? s.reflections.slice(-4).reverse().map(r => `<div style="border-left:3px solid var(--line-2);padding-left:12px"><div class="small mute">${new Date(r.t).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>${r.tags.map(t => `<span class="tag n" style="margin-right:4px">${esc(t)}</span>`).join('')}<p class="small">${esc(r.text)}</p></div>`).join('') : '<p class="small mute">No reflections yet. Add one on the <a href="#history">Reflect</a> screen.</p>'}</div></section>
      </div>
    </div></main>`;
  },
};
