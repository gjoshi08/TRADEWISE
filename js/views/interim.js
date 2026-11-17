// Phase 1 placeholders for V2 screens that have no equivalent in the previous website.
// They render the approved page header and say plainly what arrives in Phase 2 and where the existing feature lives now.
import { ai } from '../ai.js';
import { esc } from '../data.js';
import { shell, pageTitle, ICON } from '../ui.js';

export const marketPsych = {
  render(root) {
    root.innerHTML = shell('market-psychology') + `<main class="page">${pageTitle('Market psychology', 'A Circumplex-inspired interpretation of market sentiment (valence, negative → positive) and market activity (arousal, low → high). Stock indicators do not measure collective human emotion.')}
      <div class="empty"><span class="t-over">Arrives in Phase 2</span><b class="t-section">Market Circumplex, contributing inputs and session trajectory</b>
      <p class="ink2">This screen will show the market’s position on the Circumplex, the inputs behind it (momentum, breadth, simulated news, volume, volatility) with the prototype calculation and weights labelled as design assumptions, and how the position moved during the session.</p>
      <p class="small mute">Until then, price movement and volume are on the <a href="#dashboard">Dashboard</a> chart.</p></div></main>`;
  },
};

export const tradeCheck = {
  render(root) {
    const p = ai.prompt;
    root.innerHTML = shell('dashboard') + `<main class="page">${pageTitle('Trade Check', 'Before your simulated order. TRADEWISE gives input; you decide. Nothing is executed until you continue.', '<span class="tag sim">Simulated order</span>', 'Dashboard  /  Trade Check')}
      ${p ? `<div class="intervene" style="max-width:760px"><span class="t-over" style="color:var(--v2-caution)">Current AI input · ${esc(p.t)}</span><b class="t-section">${esc(p.title)}</b><p class="ink2">${esc(p.message)}</p><a class="btn sm" href="#dashboard" style="align-self:flex-start">Back to the order on the Dashboard</a></div>` : ''}
      <div class="empty" style="margin-top:${p ? '24px' : '0'}"><span class="t-over">Arrives in Phase 2</span><b class="t-section">Full pre-trade check</b>
      <p class="ink2">This step will compare the order with your strategy, list each behavioural signal with its data and prototype threshold, and show the market, camera estimate and your check-in side by side — with Pause &amp; review and Continue always available.</p>
      <p class="small mute">${ICON.info} Today the existing pre-check still runs: when you press Place on the <a href="#dashboard">Dashboard</a> and the order differs from your plan, the AI input appears beside the order. It never blocks the order.</p></div></main>`;
  },
};
