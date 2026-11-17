// App state with best-effort localStorage persistence (wrapped in try/catch: the app works without it).
import { START_BALANCE } from './data.js';

const KEY = 'tradewise.v1';
const fresh = () => ({
  profile: { level: null, help: [], onboarded: false, prefs: null },   // prefs: onboarding starting preferences (V2)
  camera: { choice: null },            // consent choice only: 'camera' | 'demo' | 'none' — never estimates
  voice: { speak: true },              // speech synthesis only (no microphone)
  balance: START_BALANCE,
  holdings: {},                        // sym -> { qty, avg }
  trades: [],                          // { t, sym, side, qty, price, value, tag, plan }
  strategies: {},                      // sym -> plan
  events: [],                          // session log for Reflect
  prompts: [],                         // { id, t, rule, sym, message, response }
  reflections: [],
  lessonsDone: [],
  draftEdits: 0,
  sessions: [],                        // summary per finished session (for Insights)
  archive: [],                         // V2: trade records from earlier sessions (trades/results only; never camera data)
  checkins: [],                        // V2: self-reports, only if the user allows saving (Profile → Privacy)
  rules: null,                         // V2: personal rules (Strategy)
  sessionNote: '',
});

// Privacy (V2): camera-derived values must never persist. Older versions stored the affect rule letter (A–E, which
// encodes the camera quadrant) and an "affect used" flag on prompt/event records; strip them when loading.
function scrub(s) {
  let changed = false;
  for (const p of s.prompts || []) { if ('rule' in p || 'affectUsed' in p) { delete p.rule; delete p.affectUsed; changed = true; } }
  for (const e of s.events || []) { if ('rule' in e) { delete e.rule; changed = true; } }
  if (s.voice && 'listen' in s.voice) { delete s.voice.listen; changed = true; }   // speech recognition removed
  return changed;
}

let state = fresh();
try { const raw = localStorage.getItem(KEY); if (raw) { state = Object.assign(fresh(), JSON.parse(raw)); if (scrub(state)) localStorage.setItem(KEY, JSON.stringify(state)); } } catch (e) { /* storage unavailable */ }

const subs = new Set();
export const store = {
  clockFn: null,
  get s() { return state; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } },
  set(patch) { Object.assign(state, patch); this.save(); this.emit('state'); },
  on(fn) { subs.add(fn); return () => subs.delete(fn); },
  emit(type, data) { subs.forEach(fn => { try { fn(type, data); } catch (e) { console.error(e); } }); },
  log(kind, text, extra = {}) {
    const ev = { t: Date.now(), clock: this.clockFn ? this.clockFn() : null, kind, text, ...extra };
    state.events.push(ev); if (state.events.length > 400) state.events.shift();
    this.save(); this.emit('event', ev); return ev;
  },
  reset() {
    const keep = { profile: state.profile, camera: state.camera, lessonsDone: state.lessonsDone, sessions: state.sessions, archive: state.archive || [], checkins: state.checkins || [], privacy: state.privacy, rules: state.rules, voice: state.voice };
    if (state.trades.length || state.prompts.length) state.sessions.push(summarise(state));
    const sid = new Date().toISOString(); keep.archive = keep.archive.concat(state.trades.map(t => ({ ...t, session: t.session || sid })));
    state = Object.assign(fresh(), keep); this.save(); this.emit('state');
  },
  wipe() { state = fresh(); try { localStorage.removeItem(KEY); } catch (e) { } this.emit('state'); },
};

export function summarise(s) {
  const buys = s.trades.filter(t => t.side === 'BUY');
  return {
    date: new Date().toISOString(),
    trades: s.trades.length,
    deviations: s.trades.filter(t => t.tag === 'Differs from plan').length,
    edits: s.draftEdits,
    prompts: s.prompts.length,
    reviewed: s.prompts.filter(p => p.response === 'review').length,
    continued: s.prompts.filter(p => p.response === 'continue').length,
    planned: buys.filter(t => t.plan).length,
  };
}
