// Fictional market data and verified research aggregates. No respondent personal data is included.
export const START_BALANCE = 100000;

export const STOCKS = {
  SHYINFO: { sym: 'SHYINFO', name: 'Sahyadri Infotech', sector: 'IT services', open: 1174.70, prev: 1174.70, start: 1150.20, vol: 0.0011, about: 'Builds software for banks and insurers. Fictional company.' },
  NRMPWR: { sym: 'NRMPWR', name: 'Narmada Power Grid', sector: 'Power', open: 316.10, prev: 316.10, start: 318.75, vol: 0.0008, about: 'Runs electricity transmission lines in western India. Fictional company.' },
  KVRPH: { sym: 'KVRPH', name: 'Kaveri Pharma', sector: 'Pharma', open: 1633.80, prev: 1633.80, start: 1652.10, vol: 0.0009, about: 'Makes generic medicines. Fictional company.' },
  GNGFIN: { sym: 'GNGFIN', name: 'Ganga Financial', sector: 'Finance', open: 485.60, prev: 485.60, start: 486.90, vol: 0.0010, about: 'Lends to small businesses. Fictional company.' },
  KONKAN: { sym: 'KONKAN', name: 'Konkan Logistics', sector: 'Logistics', open: 153.15, prev: 153.15, start: 158.35, vol: 0.0016, about: 'Port warehousing and coastal shipping. Fictional company.' },
  DCNCEM: { sym: 'DCNCEM', name: 'Deccan Cement', sector: 'Cement', open: 2235.45, prev: 2235.45, start: 2214.00, vol: 0.0009, about: 'Cement plants in South India. Fictional company.' },
};
export const WATCH = Object.keys(STOCKS);

export const INDICES = [
  { name: 'NIFTY 50', v: 24286.15, c: -0.62 },
  { name: 'SENSEX', v: 79941.30, c: -0.58 },
  { name: 'NIFTY IT', v: 37904.10, c: 1.12 },     // simulated, static (as in Figma 01 Dashboard market overview)
  { name: 'NIFTY BANK', v: 51620.30, c: -0.18 },  // simulated, static
];

export const DEFAULT_PLAN = { sym: 'SHYINFO', entry: 1150, target: 1210, stop: 1120, maxInvest: 10000, reason: 'The price is near a level where buyers stepped in last month. I will buy only near ₹1,150 and exit if it falls below ₹1,120.' };

// Recalculated from "User Research Survey (Responses).xlsx" (24 responses, Google Forms export). Aggregate counts only —
// no names, emails or individual answers. Multi-select questions can sum to more than n.
export const RESEARCH = {
  n: 24,
  traded: 17,                                   // answered anything other than "I have never traded" to the experience question
  experience: [['Never traded, want to learn', 7], ['Experienced (3+ years)', 7], ['Intermediate (1–3 years)', 4], ['Beginner (<1 year)', 4], ['Used to trade, stopped', 2]],
  explanationsUseful: { yes: 19, maybe: 5, no: 0 },
  aiUseful: { yes: 11, maybe: 10, no: 3 },
  impulsiveRegret: { occasionally: 11, rarely: 4, never: 2, neverTraded: 7 },        // all 24 respondents
  impulsiveRegretTraded: { occasionally: 10, rarely: 4, never: 2, inconsistent: 1 },  // the 17 who have traded (1 answered "I have never traded" here)
  planBeforeTrade: { always: 7, sometimes: 7, rarely: 4, never: 6 },
  difficulties: [['Identifying suitable trading opportunities', 10], ['Understanding charts and indicators', 9], ['Analysing price movements', 9], ['Developing a trading strategy', 9], ['Understanding financial terminology', 7], ['Understanding market news and trends', 5]],
  situations: [['Buying because a stock was rising rapidly (FOMO)', 6], ['Increasing investment after a run of wins', 5], ['Panic selling after a sudden drop', 2], ['Trading again to recover a loss', 2], ['Abandoning the original strategy', 2]],
  fluctuations: [['Become anxious or uncertain', 4], ['Tend to overanalyse', 4], ['Follow a predefined strategy', 4], ['Decide quickly without much analysis', 1]],
  afterLoss: [['Review the original strategy', 6], ['Wait and analyse', 4], ['Look for another trade immediately', 3], ['Stop trading for a while', 3]],
  barriers: [["Don't feel confident making financial decisions", 4], ["Haven't had time to learn", 3], ["Don't understand how the market works", 3], ["Don't know how to analyse stocks or charts", 2]],
};

export const GLOSSARY = [
  ['Share', 'A small piece of ownership in a company.', 'Owning 10 shares of a company with 1,000 shares means you own 1% of it.'],
  ['Stock exchange', 'The marketplace where shares are bought and sold, such as NSE or BSE.', 'When you buy on NSE, another person or firm is selling to you.'],
  ['Index', 'A single number that tracks a group of stocks.', 'NIFTY 50 tracks 50 large companies. If it is down 0.6%, those stocks fell on average.'],
  ['Candlestick', 'One bar on a chart that shows the open, high, low and close for a period.', 'A green candle closed higher than it opened.'],
  ['Volume', 'How many shares were traded in a period.', 'High volume on a fall means many people sold.'],
  ['Moving average', 'The average of recent prices, drawn as a smooth line.', 'Price above its 20-period average means recent prices are higher than before.'],
  ['Entry price', 'The price you plan to buy at.', 'Entry ₹1,150 means you wait for the price to be near ₹1,150.'],
  ['Target price', 'Where you plan to sell to take a profit.', 'Target ₹1,210 on an entry of ₹1,150 is a ₹60 gain per share.'],
  ['Stop-loss', 'Where you plan to sell to limit a loss. Decided before you buy.', 'Stop-loss ₹1,120 limits the loss to ₹30 per share.'],
  ['Position size', 'How many shares you hold in one stock.', '₹10,000 at ₹1,150 is 8 shares.'],
  ['Exposure', 'How much of your money depends on one stock.', '₹22,000 in one stock is more exposure than ₹10,000.'],
  ['Volatility', 'How much and how quickly a price moves.', 'A stock moving 3% in an hour is more volatile than one moving 0.3%.'],
  ['Market order', 'Buy or sell now at the best available price.', 'A market buy fills straight away at the current price.'],
  ['Profit and loss (P&L)', 'How much you have gained or lost.', 'Bought at ₹1,150, now ₹1,160: P&L is +₹10 per share.'],
  ['FOMO', 'Fear of missing out: buying because a price is rising fast.', 'Buying after a 5% jump without a plan.'],
];

// Figma 00 Onboarding options.
export const HELP_OPTIONS = ['Reading charts', 'Indicators and terms', 'Why prices move', 'Building a strategy', 'Noticing my trading patterns'];
export const LEVELS = [
  ['new', 'New to trading', 'I have never placed a trade.'],
  ['some', 'Some experience', 'I have made some trades and know the basics.'],
  ['experienced', 'Experienced', 'I trade regularly.'],
];
// Earlier versions stored 'beginner' / 'intermediate'; both map to “Some experience”.
export const levelLabel = k => (LEVELS.find(l => l[0] === (k === 'beginner' || k === 'intermediate' ? 'some' : k)) || [, 'Not set'])[1];

export const fmt = (n, d = 2) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
export const inr = (n, d = 2) => (n < 0 ? '−₹' : '₹') + fmt(Math.abs(n), d);
export const sinr = (n, d = 2) => (n > 0 ? '+₹' : n < 0 ? '−₹' : '₹') + fmt(Math.abs(n), d);
export const pct = (n, d = 2) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), d) + '%';
export const cls = n => n > 0 ? 'up' : n < 0 ? 'down' : 'mute';
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// Simulated headlines (fictional companies; generated for the prototype, labelled "simulated" wherever shown).
// sentiment: +1 positive, 0 mixed/neutral, −1 negative. Feeds the "news sentiment" input of the Market Circumplex.
export const NEWS = {
  SHYINFO: [['09:40', 'Analysts flag margin pressure across mid-size IT firms', 0], ['11:05', 'IT services index steadies as large-cap peers report stable orders', 1], ['12:20', 'Sahyadri Infotech trims full-year growth outlook in a morning update', -1]],
  NRMPWR: [['10:10', 'Narmada Power Grid commissions a new transmission corridor', 1], ['12:45', 'Power demand in western states holds near seasonal average', 0]],
  KVRPH: [['09:55', 'Kaveri Pharma receives approval for two generic medicines', 1], ['11:30', 'Pharma exporters watch currency moves closely', 0]],
  GNGFIN: [['10:30', 'Ganga Financial reports steady small-business loan growth', 1], ['12:05', 'Lenders note slightly higher funding costs this quarter', -1]],
  KONKAN: [['10:00', 'Konkan Logistics wins a port warehousing contract', 1], ['11:50', 'Coastal shipping volumes rise for a third month', 1]],
  DCNCEM: [['09:50', 'Cement prices ease in southern markets', -1], ['12:30', 'Deccan Cement plans maintenance shutdown at one plant', -1]],
};
