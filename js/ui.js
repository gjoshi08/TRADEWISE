// Shared UI: V2 application shell (Figma "App header"), Circumplex SVG, drawers, popovers, toasts.
import { store } from './store.js';
import { engine } from './engine.js';
import { affect, PRESETS } from './affect.js';
import { ai } from './ai.js';
import { voice } from './voice.js';
import { WATCH, STOCKS, INDICES, esc, clamp, fmt, pct, cls } from './data.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// Figma logo mark: outlined square + blue trend line.
export const LOGO = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x=".5" y=".5" width="19" height="19" rx="4.5" stroke="#17191C"/><path d="M4 13.5 8 9.5l3 2.5 5-6" stroke="#2E4BA8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const sv = (d, w = 16) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  cam: sv('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/>'),
  camOff: sv('<path d="M3 3l18 18"/><path d="M7 7h7a2 2 0 0 1 2 2v1l5-3v8"/><path d="M16 16.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 1.5-1.9"/>'),
  speak: sv('<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'),
  mute: sv('<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="m16 9 5 6M21 9l-5 6"/>'),
  search: sv('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 14),
  user: sv('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 14),
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5.25" stroke="currentColor"/><path d="M6 5.4v3" stroke="currentColor" stroke-linecap="round"/><circle cx="6" cy="3.6" r=".6" fill="currentColor"/></svg>',
  x: sv('<path d="M6 6l12 12M18 6 6 18"/>'),
};

export function toast(msg) { document.querySelectorAll('.toast').forEach(t => t.remove()); const d = document.createElement('div'); d.className = 'toast'; d.setAttribute('role', 'status'); d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 3600); }

export function openDrawer(html, onMount) {
  closeDrawer(); const b = document.createElement('div'); b.className = 'backdrop'; b.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true">${html}</aside>`;
  b.addEventListener('click', e => { if (e.target === b) closeDrawer(); }); document.body.appendChild(b); if (onMount) onMount(b.querySelector('.drawer'));
  const f = b.querySelector('button, input, a'); if (f) f.focus();
}
export function closeDrawer() { document.querySelectorAll('.backdrop').forEach(b => b.remove()); }

// ---------- Circumplex (SVG), V2 style: neutral field, labelled axes, uncertainty halo, 20-min trail ----------
// kind 'trader' = camera/demo estimate (plum ring marker); kind 'market' = market interpretation (blue filled dot).
export function cmaSvg({ size = 280, v = 0, a = 0, unc = 0.3, trail = [], labels = true, words = false, active = true, id = 'cma', kind = 'trader', self = null, scale = 1 } = {}) {
  const C = size / 2, R = size / 2 - (labels ? 22 * scale : 4); const X = x => C + x * R, Y = y => C - y * R; const fs = +(11 * scale).toFixed(1);
  const col = kind === 'market' ? '#2E4BA8' : '#7A4F8F';
  const L = kind === 'market' ? ['High activity', 'Low activity', 'Negative', 'Positive'] : ['High arousal', 'Low arousal', 'Unpleasant', 'Pleasant'];
  const Q = kind === 'market' ? ['Euphoria', 'Panic', 'Apathy', 'Optimism'] : ['Alert · excited', 'Tense · stressed', 'Low · fatigued', 'Calm · relaxed'];
  const tr = trail.length > 1 ? `<polyline points="${trail.map(([tv, ta]) => `${X(tv).toFixed(1)},${Y(ta).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-opacity=".45" stroke-width="1.5" stroke-linejoin="round"/>` : '';
  const marker = kind === 'market'
    ? `<circle cx="${X(v)}" cy="${Y(a)}" r="${Math.max(4, size / 46)}" fill="${col}" stroke="#fff" stroke-width="2"/>`
    : `<circle cx="${X(v)}" cy="${Y(a)}" r="${Math.max(4, size / 46)}" fill="#fff" stroke="${col}" stroke-width="2.5"/>`;
  return `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${kind === 'market' ? 'Market Circumplex: sentiment' : 'Circumplex estimate: valence'} ${v.toFixed(2)}, ${kind === 'market' ? 'activity' : 'arousal'} ${a.toFixed(2)}" font-family="Inter, system-ui, sans-serif">
  <circle cx="${C}" cy="${C}" r="${R}" fill="#F7F8FA" stroke="#E9EAED"/><circle cx="${C}" cy="${C}" r="${R / 2}" fill="none" stroke="#E9EAED" stroke-dasharray="2 3"/>
  <line x1="${C - R}" x2="${C + R}" y1="${C}" y2="${C}" stroke="#D5D7DC"/><line y1="${C - R}" y2="${C + R}" x1="${C}" x2="${C}" stroke="#D5D7DC"/>
  ${labels ? `<text x="${C}" y="${fs + 1}" font-size="${fs}" text-anchor="middle" fill="#737780">${L[0]}</text><text x="${C}" y="${size - 2}" font-size="${fs}" text-anchor="middle" fill="#737780">${L[1]}</text><text x="${C - R + 4}" y="${C - 5}" font-size="${fs}" fill="#737780">${L[2]}</text><text x="${C + R - 4}" y="${C - 5}" font-size="${fs}" text-anchor="end" fill="#737780">${L[3]}</text>` : ''}
  ${words ? `<g font-size="${size < 300 ? 10.5 : +(12 * scale).toFixed(1)}" font-weight="500" fill="#737780" text-anchor="middle"><text x="${C + R * .53}" y="${C - R * .7}">${Q[0]}</text><text x="${C - R * .53}" y="${C - R * .7}">${Q[1]}</text><text x="${C - R * .53}" y="${C + R * .8}">${Q[2]}</text><text x="${C + R * .53}" y="${C + R * .8}">${Q[3]}</text></g>` : ''}
  <circle cx="${C}" cy="${C}" r="2.5" fill="#737780"/>
  ${tr}
  ${self ? `<rect x="${(X(self.v) - 5).toFixed(1)}" y="${(Y(self.a) - 5).toFixed(1)}" width="10" height="10" rx="1.5" fill="#2E4BA8" fill-opacity=".15" stroke="#2E4BA8" stroke-width="1.5"><title>Your check-in${self.clock ? ' · ' + self.clock : ''}</title></rect>` : ''}
  ${active ? `<circle cx="${X(v)}" cy="${Y(a)}" r="${Math.max(6, unc * R)}" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-opacity=".45" stroke-dasharray="3 3"/>${marker}` : (self ? '' : `<text x="${C}" y="${C + 16}" font-size="${fs}" text-anchor="middle" fill="#737780">off</text>`)}
  </svg>`;
}
export function vbar(label, val, unc, lo, hi) {
  const pos = (clamp(val, -1, 1) + 1) / 2 * 100, ul = (clamp(val - unc, -1, 1) + 1) / 2 * 100, ur = (clamp(val + unc, -1, 1) + 1) / 2 * 100;
  return `<div class="vbar"><div class="t"><span>${label}</span><b class="num">${val >= 0 ? '+' : '−'}${Math.abs(val).toFixed(2)} ± ${unc.toFixed(2)}</b></div><div class="track"><span class="z"></span><span class="u" style="left:${ul}%;width:${ur - ul}%"></span><span class="p" style="left:${pos}%"></span></div><div class="ends"><span>${lo}</span><span>${hi}</span></div></div>`;
}
export const quadLabel = q => ({ 'pleasant-low': 'Pleasant · low activation', 'pleasant-high': 'Pleasant · high activation', 'unpleasant-low': 'Unpleasant · low activation', 'unpleasant-high': 'Unpleasant · high activation', uncertain: 'Uncertain · not used', none: 'Camera off' }[q]);

// ---------- Shell (Figma: App header = simulation notice + top navigation + market overview) ----------
export const NAV = [['dashboard', 'Dashboard'], ['markets', 'Markets'], ['market-psychology', 'Market Psychology'], ['my-psychology', 'My Psychology'], ['strategy', 'Strategy'], ['history', 'Trade History']];
export const nav = { sym: 'SHYINFO', pendingSym: null, draft: null };   // selected stock (shared by Dashboard, Markets, Market Psychology) · header search → stock · Buy/Sell → Trade Check draft

export function camStatus() {
  const s = affect.state, p = ai.prompt;
  if (p) return { cls: 'attn alert', txt: 'AI has input' };
  if (s.mode === 'camera') return { cls: s.face && !s.stale ? 'live' : 'paused', txt: s.face && !s.stale ? 'Camera on · this device' : 'Camera on · no face' };
  if (s.mode === 'demo') return { cls: 'attn', txt: 'Demo mode · simulated' };
  if (s.mode === 'loading') return { cls: 'paused', txt: 'Starting camera…' };
  return { cls: '', txt: 'Camera off' };
}
export function marketStatus() { return `Market open · simulated clock ${engine.clockStr()} IST`; }

export function shell(active) {
  const st = camStatus(), speak = voice.state.speak;
  return `<div class="simbar" role="note"><b>Simulated trading · virtual money · fictional stocks and prices · no real orders are placed</b></div>
  <header class="nav"><a class="logo" href="#dashboard" aria-label="TRADEWISE home">${LOGO}TRADEWISE</a>
  <nav class="navlinks" aria-label="Main">${NAV.map(([r, l]) => `<a href="#${r}" class="${active === r ? 'on' : ''}" ${active === r ? 'aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
  <span class="sp"></span>
  <form class="search" role="search" data-form="search">${ICON.search}<input name="q" list="tw-stocks" placeholder="Search stocks" aria-label="Search stocks" autocomplete="off"><datalist id="tw-stocks">${WATCH.map(s => `<option value="${s}">${esc(STOCKS[s].name)}</option>`).join('')}</datalist></form>
  <button class="status aistatus ${st.cls}" data-act="aipop" aria-haspopup="dialog" title="Camera and AI observer settings"><span class="d"></span><span data-live="aistatus">${st.txt}</span></button>
  <button class="iconswitch" data-act="speak" role="switch" aria-checked="${speak}" aria-label="Read important alerts aloud" title="Read important alerts aloud (speech only, no microphone)"><span data-live="speakicon">${speak ? ICON.speak : ICON.mute}</span><span class="toggle ${speak ? 'on' : ''}" data-live="speaktoggle"></span></button>
  <a class="avatar ${active === 'profile' ? 'on' : ''}" href="#profile" aria-label="Profile, privacy and camera settings">${ICON.user}</a></header>
  <div class="mstrip" aria-label="Market overview">${INDICES.map(i => `<span class="ticker-i"><span class="n">${i.name}</span><span class="v">${fmt(i.v)}</span><span class="c ${cls(i.c)}">${pct(i.c)}</span></span>`).join('')}
  <span class="sp"></span><span class="status live"><span class="d"></span><span data-live="mstatus">${marketStatus()}</span></span></div>`;
}
// Page title row (Figma "Page title").
export const pageTitle = (title, sub = '', right = '', crumb = '') => `<div class="ptitle"><div class="l">${crumb ? `<span class="crumb">${crumb}</span>` : ''}<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div><span class="sp"></span>${right}</div>`;

let pop = null;
export function closePopover() { if (pop) { pop.remove(); pop = null; } }
export function openAIPopover() {
  closePopover(); const s = affect.state, vs = voice.state;
  pop = document.createElement('div'); pop.className = 'popover'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Camera and AI observer');
  pop.innerHTML = `<div class="row between"><b class="t-sub">Camera and AI observer</b><button class="btn ghost sm" data-act="closepop" aria-label="Close">${ICON.x}</button></div>
  <p class="small ink2">The AI observes your trading and the market. The camera is optional and only shapes wording; it never triggers input.</p>
  <div class="col" style="gap:8px">
   <button class="option ${s.mode === 'camera' ? 'on' : ''}" data-act="cam-on"><span class="radio"></span><span><b>Camera on</b><span class="d">Live estimate on this device. Nothing is recorded or stored.</span></span></button>
   <button class="option ${s.mode === 'demo' ? 'on' : ''}" data-act="cam-demo"><span class="radio"></span><span><b>Demonstration mode</b><span class="d">No camera. Simulated values, labelled as simulated.</span></span></button>
   <button class="option ${s.mode === 'off' || s.mode === 'error' ? 'on' : ''}" data-act="cam-off"><span class="radio"></span><span><b>Camera off</b><span class="d">Trading activity and market context only.</span></span></button>
  </div>
  ${s.mode === 'camera' ? `<button class="btn sm" data-act="recal">${s.calibrating != null ? 'Calibrating… keep a relaxed face' : s.calibrated ? 'Recalibrate baseline (5 s)' : 'Calibrate baseline (5 s)'}</button>` : ''}
  ${s.mode === 'error' ? `<div class="callout plan">${esc(s.error)} You can use demonstration mode instead.</div>` : ''}
  ${s.mode === 'demo' ? `<div class="field"><label for="preset">Simulated affect</label><select id="preset" class="input" data-act="preset">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}" ${s.preset === k ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
  <label class="row small"><input type="checkbox" data-act="lookaway" ${s.lookAway ? 'checked' : ''}> Simulate looking away from the screen</label>` : ''}
  <div class="row between"><span class="small">Read important alerts aloud${vs.canSpeak ? '' : ' <span class="mute">(not supported here)</span>'}</span><button class="toggle ${vs.speak ? 'on' : ''}" role="switch" aria-checked="${vs.speak}" aria-label="Read important alerts aloud" data-act="speak"></button></div>
  <a href="#profile" class="btn sm" data-act="closepop">Privacy and camera settings</a>`;
  document.body.appendChild(pop);
}

// ---------- V2 components (Figma 08 Design System) ----------
const SRC = { behaviour: ['', 'Observed behaviour'], estimate: ['est', 'Estimated cue'], user: ['user', 'User reported'], interp: ['interp', 'Interpretation'], market: ['', 'Market context'], system: ['', 'TRADEWISE'] };
export const srcLabel = k => (SRC[k] || SRC.system)[1];
// Observer item: left rule + overline naming the data source.
export const obsItem = (src, time, title, detail = '', extra = '') => `<div class="obs ${(SRC[src] || SRC.system)[0]}"><div class="row" style="gap:8px"><span class="src">${srcLabel(src)}</span>${time ? `<span class="t-meta mute">${esc(time)}</span>` : ''}</div><b class="t-sub">${esc(title)}</b>${detail ? `<p class="small ink2">${esc(detail)}</p>` : ''}${extra}</div>`;
// Disclosure: collapsible row; content is folded, never removed.
export const disclosure = (id, label, summary, open, body) => `<div class="disc ${open ? 'open' : ''}" data-disc="${id}"><button class="disc-h" aria-expanded="${!!open}" data-disc-toggle="${id}"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="${open ? 'M3 4.5 6 7.5 9 4.5' : 'M4.5 3 7.5 6 4.5 9'}" stroke="#737780" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="disc-l">${esc(label)}</span><span class="disc-s">${esc(summary)}</span></button>${open ? `<div class="disc-b">${body}</div>` : ''}</div>`;
// Alignment indicator: Aligned / Divergent / Mismatch (one active, or none when a state is unavailable).
export const alignment = state => `<span class="align" role="img" aria-label="Alignment: ${state || 'not available'}">${['Aligned', 'Divergent', 'Mismatch'].map(k => `<span class="${k === state ? 'on ' + (k === 'Aligned' ? 'a' : 'c') : ''}">${k === state ? '<i></i>' : ''}${k}</span>`).join('')}</span>`;
// Metric: label over value, optional ⓘ that opens an explain popover.
export const metric = (label, value, explain, valCls = '') => `<div class="metric"><span class="m-l">${esc(label)}${explain ? ` <button class="info" data-explain="${esc(explain)}" aria-label="Explain ${esc(label)}">${ICON.info}</button>` : ''}</span><span class="m-v ${valCls}">${value}</span></div>`;
export const tag = (tone, text) => `<span class="tag ${tone}">${esc(text)}</span>`;
export const status = (cls, text) => `<span class="status ${cls}"><span class="d"></span>${esc(text)}</span>`;
// Explain popover (hover/focus on an ⓘ). Content: general meaning + what it means here; never a recommendation.
let xpop = null;
export function showExplain(btn, title, value, general, here) {
  hideExplain(); xpop = document.createElement('div'); xpop.className = 'xpop'; xpop.setAttribute('role', 'tooltip');
  xpop.innerHTML = `<div class="row between"><b class="t-sub">${esc(title)}</b><span class="t-num">${esc(value)}</span></div><p class="small ink2">${esc(general)}</p>${here ? `<p class="small">${esc(here)}</p>` : ''}<p class="t-meta mute">General explanation — not a signal to buy or sell.</p>`;
  document.body.appendChild(xpop); const r = btn.getBoundingClientRect(); const w = 300;
  xpop.style.left = Math.min(window.innerWidth - w - 16, Math.max(16, r.left - 12)) + 'px'; xpop.style.top = (r.top + window.scrollY - xpop.offsetHeight - 8 < window.scrollY ? r.bottom + window.scrollY + 8 : r.top + window.scrollY - xpop.offsetHeight - 8) + 'px';
}
export function hideExplain() { if (xpop) { xpop.remove(); xpop = null; } }
