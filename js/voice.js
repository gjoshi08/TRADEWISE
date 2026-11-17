// Voice output only: browser speech synthesis reads a pending AI prompt aloud when the user does not seem to be
// looking at the screen (camera: no face / head turned for 4 s; demo: "look away" toggle; any mode: browser tab hidden).
// There is NO microphone or speech recognition (removed in Redesign V2, Phase 1). Speech can be muted at any time.
import { store } from './store.js';
import { affect } from './affect.js';
import { ai } from './ai.js';

const V = { supportedSpeak: 'speechSynthesis' in window, listeners: new Set() };
const emit = () => V.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

export const voice = {
  on(fn) { V.listeners.add(fn); return () => V.listeners.delete(fn); },
  get state() { return { canSpeak: V.supportedSpeak, speak: store.s.voice.speak }; },
  speak(text) {
    if (!V.supportedSpeak || !store.s.voice.speak) return false;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.pitch = 1; u.lang = 'en-IN'; speechSynthesis.speak(u); return true; } catch (e) { return false; }
  },
  setSpeak(b) { store.s.voice.speak = b; store.save(); if (!b && V.supportedSpeak) speechSynthesis.cancel(); emit(); },
};
// Attention watcher: speak a pending prompt once if the user seems to be looking away.
setInterval(() => {
  const p = ai.prompt; if (!p || p.spoken) return; const s = affect.state;
  const away = document.hidden || ((s.mode === 'camera' || s.mode === 'demo') && !s.attentive && s.inattentiveFor >= 4);
  if (away) { const said = voice.speak(`TRADEWISE. ${p.title} ${p.message}`); p.spoken = true; ai.say('spoken' + p.id, 'info', said ? 'You seemed to be looking away, so I read the input aloud.' : 'You seemed to be looking away. (Speech is muted or unavailable.)', 0); store.log('ai', 'Input read aloud because attention seemed elsewhere'); }
}, 1000);
