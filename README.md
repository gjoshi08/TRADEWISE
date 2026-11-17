# TRADEWISE

An affect-aware, **simulated** trading companion for beginners, built as an HCI master's research prototype.

TRADEWISE pairs a simulated stock market with an AI Observer that notices trading behaviour (for example, entering on rapid momentum, increasing position size after gains, or trading again straight after a loss) and explains, in plain language, what it saw and why it is relevant. A *Market Circumplex* shows the market's estimated mood, and an optional camera-based estimate of displayed affect (valence and arousal, using the Circumplex Model of Affect) can shape the wording of the AI's observations.

> **Simulated trading only.** All stocks, prices, indices, news, balances and orders are fictional. There is no brokerage connection and no real money. Nothing here is financial advice.

## Screens

| Route | Screen |
|---|---|
| `#welcome`, `#onboarding`, `#camera` | First-run set-up and camera consent |
| `#dashboard` | Chart, Market × Trader circumplex, AI Observer, positions |
| `#markets` | Stock list and stock detail |
| `#market-psychology` | Market Circumplex and its inputs |
| `#my-psychology` | Check-ins, live estimate (if the camera is on), behavioural patterns |
| `#strategy` | Trading plans and rules |
| `#trade-check` | Order review against your plan before Buy/Sell |
| `#history` | Trades, reflections and session summaries |
| `#profile/…` | Privacy & camera, account, How the AI works, Research, About |

Older links (`#trade`, `#learn`, `#plan`, `#reflect`, `#insights`, `#how-ai-works`, `#research`) redirect to the current screens.

**Presenter controls** (Dashboard, dashed button) are kept for live demonstrations: they load an example plan, place an example order, move simulated prices and switch on *demonstration mode*, which uses simulated affect values (clearly labelled) instead of a camera.

## Running locally

The site is static: plain HTML, CSS and ES modules, with no build step and no dependencies to install.

It **must be served over HTTP**. Opening `index.html` directly (`file://`) leaves the page stuck on "Loading TRADEWISE…", because browsers block ES modules loaded from `file://`.

```bash
# from this folder, any static server works, for example:
python -m http.server 8000
# then open http://localhost:8000
```

The camera works on `http://localhost` and on any HTTPS address. It does not work on plain-HTTP addresses other than localhost.

## Deploying (Vercel)

Import the repository with **Framework preset: Other**, no build command, and the repository root as the output directory. No configuration file is needed. Vercel serves over HTTPS, which the camera requires.

## Privacy

- Camera frames are analysed **on the device**, in memory. Video and images are never stored or uploaded.
- Live camera estimates, the camera timeline and the personal baseline live in memory only and are discarded when the camera stops or the session ends. They are **never linked to trades**.
- The camera alone never triggers an observation or blocks an order. Observations come from trading behaviour; the estimate only changes the wording.
- Trades, plans, notes and (if you allow it) self-report check-ins are kept in this browser's `localStorage` (`tradewise.v1`). They can be deleted under *Profile → Privacy & camera*.
- No microphone is used. Read-aloud uses the browser's speech synthesis and can be muted.
- The only external request is the Inter font from Google Fonts. No trading or camera data is sent with it.

## The affect model

`models/tradewise_affect_tfjs/` is a TensorFlow.js graph model (MobileNetV2, 224 × 224 input):

- **Expression head:** trained for this project on RAF-DB (8 outputs; *contempt* disabled because there was no training data).
- **Valence/arousal head:** the original pretrained AffectNet MobileNetV2 regressor (D. Batic, 2020, MIT), unchanged.

Face detection uses `@vladmandic/face-api` with its bundled weights (`models/weights.js`).

**Limitations.** The outputs estimate what a face *displays* to a camera. They are not a measurement of how someone feels. Accuracy on live webcam input has not been validated. Behavioural signal thresholds and Market Circumplex weights are prototype defaults chosen for demonstration, not research findings.

**Dataset terms.** RAF-DB and AffectNet are released under their own research agreements, which third-party listings describe as non-commercial. Whether those agreements allow distributing models trained on the data has not been confirmed. Check them before reusing or redistributing the model weights in this folder.

## Research

The *Research* page (`#profile/research`) summarises a user survey of **24 respondents**. Only aggregate counts are included (in `js/data.js`). No names, emails or individual answers are part of this repository.

## Project structure

```
index.html            entry point
favicon.svg/.ico      site icon (TRADEWISE logo mark)
css/app.css           design system (V2 tokens) and all styles
js/main.js            hash router, global events
js/ui.js              shared components (shell, circumplex, observations, …)
js/views/             one module per screen
js/affect*.js         camera pipeline and model loading
js/ai.js, behaviour.js, market.js, indicators.js   AI Observer, signals, Market Circumplex
js/engine.js, store.js, data.js                    simulated market, local storage, static data
models/               affect model (TF.js) and face-api weights
vendor/               third-party libraries with their licences
```

`js/views/learn.js`, `plan.js`, `reflect.js`, `trade.js` and `interim.js` are earlier screens that are no longer routed. They are kept for reference.

## Third-party licences

- [@vladmandic/face-api](https://github.com/vladmandic/face-api) 1.7.15: MIT (`vendor/LICENSE-face-api.txt`)
- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) 4.2.3: Apache-2.0 (`vendor/LICENSE-lightweight-charts.txt`); attribution is shown on the chart
- [Inter](https://rsms.me/inter/) typeface: SIL Open Font License, loaded from Google Fonts
- AffectNet MobileNetV2 regressor (D. Batic, 2020): MIT
