import { store } from '../store.js';
import { engine } from '../engine.js';
import { GLOSSARY, inr, fmt, pct, esc, cls } from '../data.js';
import { shell, ICON, toast } from '../ui.js';

const MODS = [
  { k: 'basics', t: 'Market basics', s: 'Shares, exchanges, indices', help: [] },
  { k: 'charts', t: 'Reading a chart', s: 'Candles, time, volume', help: ['Understanding charts'] },
  { k: 'terms', t: 'Key terms', s: 'A plain-language glossary', help: ['Financial terms'] },
  { k: 'moves', t: 'Why prices move', s: 'Buyers, sellers and news', help: ['Why prices move', 'Finding opportunities'] },
  { k: 'indicators', t: 'Basic indicators', s: 'Moving average and volume', help: ['Understanding charts', 'Finding opportunities'] },
];
const QUIZ = {
  basics: ['If NIFTY 50 is down 0.6%, what does that mean?', ['Every stock fell 0.6%', 'The 50 stocks it tracks fell about 0.6% on average', 'The market will keep falling'], 1],
  charts: ['A red candle means…', ['The price closed lower than it opened in that period', 'The stock is a bad investment', 'Trading stopped'], 0],
  terms: ['You set a stop-loss at ₹1,120 after buying at ₹1,150. What is it for?', ['To sell automatically for a profit', 'To decide in advance where you’ll exit to limit a loss', 'To buy more if the price falls'], 1],
  moves: ['A price falls on very high volume. What can you say?', ['Many people were selling', 'It will bounce back tomorrow', 'The company is in trouble'], 0],
  indicators: ['The price is above its 20-period average. This means…', ['Recent prices are higher than the average of the last 20', 'It is a guaranteed buy signal', 'Volume is high'], 0],
};
let cur = null, st = { shares: 50, move: 0, part: 'body', q: '', buyers: 60, sma: 10, quiz: {} };

export const learn = {
  render(root) {
    const help = store.s.profile.help || [];
    const order = [...MODS].sort((a, b) => (b.help.some(h => help.includes(h)) ? 1 : 0) - (a.help.some(h => help.includes(h)) ? 1 : 0));
    if (!cur) cur = order[0].k;
    const draw = () => {
      const done = store.s.lessonsDone;
      root.innerHTML = shell('markets') + `<main class="page col" style="gap:24px">
        <div class="callout n">${ICON.info}<span><b>Interim content.</b> The full Markets screen (watchlist, stock analysis, indicators in plain language, simulated news) is built in Phase 2. Until then, the existing lessons are kept here; in V2 they become contextual explanations across the app.</span></div>
        <div class="row between" style="align-items:flex-end;flex-wrap:wrap"><div class="col" style="gap:6px"><span class="eyebrow">Learn</span><h1 class="h-l">Learn the market, one idea at a time</h1><p class="lead">Short, interactive lessons with examples from the simulated market. ${help.length ? 'Ordered by what you asked for help with.' : ''}</p></div>
        <span class="tag n">${done.length} of ${MODS.length} done</span></div>
        <div class="lessons">${order.map(m => `<button class="lesson-tab ${cur === m.k ? 'on' : ''}" data-mod="${m.k}"><b>${m.t}</b><span class="s">${m.s}</span>${done.includes(m.k) ? `<span class="done">Done</span>` : m.help.some(h => help.includes(h)) ? '<span class="tag ai" style="align-self:flex-start">For you</span>' : ''}</button>`).join('')}</div>
        <section class="card pad col" style="gap:20px" aria-live="polite">${body(cur)}${quiz(cur)}
          <div class="row between"><span class="small mute">Fictional examples. Prices come from the simulated market.</span><div class="row">${done.includes(cur) ? '<span class="tag up">Lesson done</span>' : `<button class="btn primary" data-act="done">Mark as done</button>`}<a class="btn" href="#strategy">Build a strategy</a></div></div></section>
      </main>`;
      root.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { cur = b.dataset.mod; draw(); });
      const d = root.querySelector('[data-act="done"]'); if (d) d.onclick = () => { store.s.lessonsDone.push(cur); store.save(); store.log('learn', `Finished lesson: ${MODS.find(m => m.k === cur).t}`); toast('Nice. Lesson marked as done.'); draw(); };
      root.querySelectorAll('input[data-k]').forEach(inp => inp.oninput = () => { st[inp.dataset.k] = inp.type === 'range' ? +inp.value : inp.value; const keepFocus = inp.type !== 'range' ? inp.selectionStart : null; draw(); const n = root.querySelector(`input[data-k="${inp.dataset.k}"]`); if (n) { n.focus(); if (keepFocus != null) n.setSelectionRange(keepFocus, keepFocus); } });
      root.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { st.part = b.dataset.part; draw(); });
      root.querySelectorAll('[data-quiz]').forEach(b => b.onclick = () => { st.quiz[cur] = +b.dataset.quiz; draw(); });
    };
    draw();
  },
};
function quiz(k) { const [q, opts, a] = QUIZ[k]; const pick = st.quiz[k];
  return `<div class="soft pad col" style="gap:10px"><b>Quick check: ${q}</b>${opts.map((o, i) => `<button class="option ${pick === i ? 'on' : ''}" data-quiz="${i}" style="padding:12px 16px"><span class="radio"></span><span>${o}${pick != null && i === a ? ' <span class="tag up">Correct</span>' : pick === i && i !== a ? ' <span class="tag n">Not quite</span>' : ''}</span></button>`).join('')}</div>`; }
function body(k) {
  if (k === 'basics') { const price = 200, total = 100000, sh = st.shares, mv = st.move; const cost = sh * price, val = cost * (1 + mv / 100);
    return `<div class="grid2" style="gap:32px"><div class="col" style="gap:12px"><h2 class="h-m">A share is a small piece of a company</h2><p class="ink2">Companies split their ownership into shares. When you buy shares on an exchange (like NSE or BSE), you buy them from someone who is selling. An <b>index</b> such as NIFTY 50 tracks a group of large companies with one number.</p>
      <div class="callout n">Today in the simulator, NIFTY 50 is −0.62%. That means its 50 companies fell about 0.6% on average. Some rose, some fell more.</div></div>
      <div class="soft pad col" style="gap:14px"><b>Try it: Example Foods Ltd has ${fmt(total, 0)} shares at ₹200</b>
      <label class="field"><span>Shares you buy: <b class="num">${sh}</b></span><input type="range" min="1" max="1000" value="${sh}" data-k="shares" aria-label="Shares to buy"></label>
      <label class="field"><span>Price change: <b class="num ${cls(mv)}">${pct(mv, 0)}</b></span><input type="range" min="-10" max="10" value="${mv}" data-k="move" aria-label="Price change"></label>
      <div class="grid3"><div><span class="small mute">You pay</span><div class="num h-s">${inr(cost, 0)}</div></div><div><span class="small mute">You own</span><div class="num h-s">${fmt(sh / total * 100, 3)}%</div></div><div><span class="small mute">Now worth</span><div class="num h-s ${cls(val - cost)}">${inr(val, 0)}</div></div></div></div></div>`; }
  if (k === 'charts') { const P = st.part; const hi = p => P === p ? '#A15C07' : null;
    return `<div class="grid2" style="gap:32px;align-items:center"><svg viewBox="0 0 320 240" width="100%" style="max-width:380px" role="img" aria-label="Two candlesticks, one rising and one falling">
      <line x1="90" x2="90" y1="24" y2="214" stroke="${hi('wick') || '#0A7F55'}" stroke-width="${P === 'wick' ? 5 : 3}"/><rect x="66" y="68" width="48" height="104" rx="4" fill="#0A7F55" stroke="${hi('body') || 'none'}" stroke-width="4"/>
      <line x1="230" x2="230" y1="36" y2="204" stroke="${hi('wick') || '#C2372F'}" stroke-width="${P === 'wick' ? 5 : 3}"/><rect x="206" y="60" width="48" height="118" rx="4" fill="#C2372F" stroke="${hi('body') || 'none'}" stroke-width="4"/>
      <g font-size="12" fill="#454A66"><text x="122" y="72">Close</text><text x="122" y="174">Open</text><text x="98" y="28">High</text><text x="98" y="214">Low</text><text x="262" y="64">Open</text><text x="262" y="180">Close</text></g>
      <text x="90" y="236" text-anchor="middle" font-size="13" font-weight="700" fill="#0A7F55">Rose</text><text x="230" y="236" text-anchor="middle" font-size="13" font-weight="700" fill="#C2372F">Fell</text></svg>
      <div class="col" style="gap:14px"><h2 class="h-m">Each candle is one slice of time</h2><div class="seg">${[['body', 'Body'], ['wick', 'Wicks'], ['colour', 'Colour'], ['volume', 'Volume']].map(([p, l]) => `<button class="${P === p ? 'on' : ''}" data-part="${p}">${l}</button>`).join('')}</div>
      <p class="ink2" style="font-size:16px">${{ body: 'The thick <b>body</b> runs from the opening price to the closing price for that period. A tall body means the price moved a lot.', wick: 'The thin <b>wicks</b> show the highest and lowest prices reached. A long lower wick means sellers pushed the price down but buyers brought it back.', colour: '<b>Green</b> closed higher than it opened; <b>red</b> closed lower. Colour shows direction, not whether the stock is good or bad.', volume: 'Under the candles, <b>volume bars</b> show how many shares traded. Big bars mean many people were buying and selling.' }[P]}</p>
      <div class="callout n">On the Trade screen you can switch each candle between 1 minute, 5 minutes, 15 minutes and 1 day.</div></div></div>`; }
  if (k === 'terms') { const q = st.q.toLowerCase(); const list = GLOSSARY.filter(g => (g[0] + g[1]).toLowerCase().includes(q));
    return `<div class="col" style="gap:14px"><h2 class="h-m">Key terms in plain language</h2><input class="input" placeholder="Search, e.g. stop-loss" value="${esc(st.q)}" data-k="q" aria-label="Search terms" style="max-width:420px">
      <div class="gloss">${list.map(([t, d, e]) => `<div class="card"><b>${t}</b><p class="ink2 small" style="margin-top:4px">${d}</p><p class="small mute" style="margin-top:8px">Example: ${e}</p></div>`).join('') || '<p class="mute">No terms match. Try another word.</p>'}</div></div>`; }
  if (k === 'moves') { const b = st.buyers, sl = 100 - b, dir = b - sl; const p = engine.price('SHYINFO'), ch = engine.change('SHYINFO');
    return `<div class="grid2" style="gap:32px"><div class="col" style="gap:12px"><h2 class="h-m">Prices move when buyers and sellers disagree</h2><p class="ink2">If more people want to buy than sell, buyers have to offer higher prices, and the price rises. If more want to sell, the price falls. News, results and the wider market change how many people want to buy or sell.</p>
      <div class="callout n">Right now in the simulator, Sahyadri Infotech is <b class="num">${inr(p)}</b>, <span class="${cls(ch)}">${pct(ch)}</span> today. The company updated its yearly forecast this morning (simulated news). We can’t say for certain that this caused the move.</div></div>
      <div class="soft pad col" style="gap:14px"><b>Try it: how keen are buyers vs sellers?</b><label class="field"><span>Buyers <b class="num">${b}%</b> · Sellers <b class="num">${sl}%</b></span><input type="range" min="10" max="90" value="${b}" data-k="buyers" aria-label="Share of buyers"></label>
      <div class="row" style="gap:16px"><span class="statbig ${dir > 0 ? 'up' : dir < 0 ? 'down' : 'mute'}">${dir > 0 ? '↑' : dir < 0 ? '↓' : '→'}</span><p class="ink2">${dir > 20 ? 'Strong buying. Prices tend to rise quickly, and that is when FOMO tempts people to chase.' : dir > 0 ? 'Slightly more buyers. Prices drift up.' : dir === 0 ? 'Balanced. Prices move sideways.' : dir > -20 ? 'Slightly more sellers. Prices drift down.' : 'Strong selling. Prices can fall fast, and that is when panic selling tempts people.'}</p></div></div></div>`; }
  if (k === 'indicators') { const n = st.sma; const pts = engine.spark('SHYINFO'); const avg = pts.map((_, i) => i < n - 1 ? null : pts.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
    const lo = Math.min(...pts) - 1, hi = Math.max(...pts) + 1, W = 520, H = 200, X = i => i / (pts.length - 1) * W, Y = v => 10 + (hi - v) / (hi - lo) * (H - 20);
    const line = arr => arr.map((v, i) => v == null ? '' : `${arr[i - 1] == null ? 'M' : 'L'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(''); const last = pts[pts.length - 1], la = avg[avg.length - 1];
    return `<div class="grid2" style="gap:32px;align-items:center"><div class="col" style="gap:12px"><h2 class="h-m">A moving average smooths out the noise</h2><p class="ink2">It is the average of the last few prices, redrawn at every point. When the price is above its average, recent prices are higher than before. It describes the past; it doesn’t predict.</p>
      <label class="field"><span>Average of the last <b class="num">${n}</b> candles</span><input type="range" min="3" max="30" value="${n}" data-k="sma" aria-label="Moving average length"></label>
      <div class="callout n">Sahyadri Infotech is ${last > la ? '<b>above</b>' : '<b>below</b>'} its ${n}-candle average (${inr(last)} vs ${inr(la)}).</div></div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Price line with moving average"><path d="${line(pts)}" fill="none" stroke="#14162B" stroke-width="2"/><path d="${line(avg)}" fill="none" stroke="#5646E8" stroke-width="2.5"/><text x="8" y="${H - 6}" font-size="12" fill="#454A66">Black: price · Purple: ${n}-candle average</text></svg></div>`; }
  return '';
}
