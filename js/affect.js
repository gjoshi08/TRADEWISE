// Affect estimation.
// Camera mode: @vladmandic/face-api finds the face (TinyFaceDetector + 68-point tiny landmarks). The TRADEWISE
// affect model (js/affect-model.js; trained in ml/) then estimates expression probabilities and valence/arousal
// directly from the face crop, on face-api's own TensorFlow.js. If that model cannot load, the original heuristic
// (face-api FER expressions x fixed circumplex coordinates) is used instead, and the UI says so.
// Everything runs locally in the browser. Nothing is recorded, stored or sent anywhere.
// Estimates describe what a face displays to the camera. Live-webcam accuracy has NOT been validated.
// Demo mode: no camera; the presenter chooses a simulated affect point. Clearly labelled as simulated.
import { clamp } from './data.js';
import { store } from './store.js';
const LABELS = ['neutral', 'happiness', 'sadness', 'surprise', 'fear', 'disgust', 'anger', 'contempt'];   // model output order

// Approximate circumplex positions (valence, arousal) for the FER categories, after Russell (1980).
const COORD = { neutral: [0, 0], happy: [0.8, 0.35], surprised: [0.25, 0.8], angry: [-0.6, 0.7], fearful: [-0.55, 0.75], disgusted: [-0.7, 0.3], sad: [-0.65, -0.4] };
export const PRESETS = {
  'pleasant-low': { v: 0.42, a: -0.3, label: 'Pleasant · low activation' },
  'pleasant-high': { v: 0.5, a: 0.6, label: 'Pleasant · high activation' },
  'unpleasant-low': { v: -0.45, a: -0.35, label: 'Unpleasant · low activation' },
  'unpleasant-high': { v: -0.5, a: 0.62, label: 'Unpleasant · high activation' },
  'uncertain': { v: 0.04, a: 0.06, label: 'Uncertain / neutral' },
};

const A = {
  mode: 'off',            // 'off' | 'loading' | 'camera' | 'demo' | 'error'
  error: '', v: 0, a: 0, conf: 0, unc: 0.5, face: false, attentive: true, lastAttentive: Date.now(),
  box: null, points: null, expr: null, trail: [], hist: [], preset: 'pleasant-low', lookAway: false,
  video: null, stream: null, timer: null, faceapi: null, loaded: false, listeners: new Set(), quality: '',
  baseline: null, calib: null, // personal neutral baseline: averaged expression probabilities only, kept in memory, never stored
  backend: '',
  // TRADEWISE model state
  am: null, engine: '', modelErr: '', stale: false, top: '', inferMs: 0, modelEvery: 300, lastModel: 0, prevBox: null,
  frames: 0, modelRuns: 0,
};
const emit = () => A.listeners.forEach(fn => { try { fn(snapshot()); } catch (e) { console.error(e); } });
export function snapshot() {
  return { mode: A.mode, error: A.error, v: A.v, a: A.a, conf: A.conf, unc: A.unc, face: A.face, attentive: A.attentive, inattentiveFor: A.attentive ? 0 : (Date.now() - A.lastAttentive) / 1000, box: A.box, points: A.points, expr: A.expr, trail: A.trail.slice(), hist: A.hist.slice(), preset: A.preset, quadrant: quadrant(), quality: A.quality, lookAway: A.lookAway, calibrated: !!A.baseline, calibrating: A.calib ? Math.min(0.99, Math.min((Date.now() - A.calib.start) / A.calib.ms, A.calib.samples.length / 8)) : null,
    engine: A.engine, modelErr: A.modelErr, stale: A.stale, top: A.top, inferMs: A.inferMs, modelEvery: A.modelEvery, backend: A.backend,
    modelRuns: A.modelRuns };
}
export function quadrant() {
  if (A.mode !== 'camera' && A.mode !== 'demo') return 'none';
  if (A.mode === 'camera' && (A.stale || !A.face)) return 'uncertain';   // never present a paused estimate as current
  if (A.conf < 0.4 || (Math.abs(A.v) < 0.15 && Math.abs(A.a) < 0.15)) return 'uncertain';
  return (A.v >= 0 ? 'pleasant' : 'unpleasant') + '-' + (A.a >= 0 ? 'high' : 'low');
}
export const affect = {
  on(fn) { A.listeners.add(fn); fn(snapshot()); return () => A.listeners.delete(fn); },
  get state() { return snapshot(); },
  get video() { return A.video; },
  async startCamera() {
    this.stop(true); A.mode = 'loading'; A.error = ''; emit();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('This browser or page does not allow camera access.');
      A.stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' }, audio: false });
      if (!A.video) { A.video = document.createElement('video'); A.video.muted = true; A.video.playsInline = true; A.video.setAttribute('playsinline', ''); }
      A.video.srcObject = A.stream; await A.video.play();
      await loadModels();
      A.mode = 'camera'; store.s.camera.choice = 'camera'; store.save(); store.log('ai', 'Camera observation turned on (processed on this device)');
      A.timer = setInterval(detect, 300); A.calib = { start: Date.now(), ms: 5000, samples: [] }; emit(); return true;
    } catch (e) {
      this.stop(true); A.mode = 'error';
      A.error = (e && e.name === 'NotAllowedError') ? 'Camera permission was not given, or this page is not allowed to use the camera.' : (e && e.message) || 'The camera could not start.';
      emit(); return false;
    }
  },
  startDemo(preset) { this.stop(true); A.mode = 'demo'; if (preset) A.preset = preset; const p = PRESETS[A.preset]; A.v = p.v; A.a = p.a; A.conf = 0.62; A.face = true; store.s.camera.choice = 'demo'; store.save(); store.log('ai', 'Demonstration mode on: affect values are simulated, no camera'); A.timer = setInterval(demoStep, 450); emit(); },
  setPreset(p) { A.preset = p; emit(); },
  // Personal calibration: for a few seconds the user looks at the screen with a relaxed face. We average the
  // model's expression probabilities and treat that as this person's 'neutral'. Only 7 numbers are kept, in memory.
  calibrate(ms = 5000) { if (A.mode !== 'camera') return false; A.calib = { start: Date.now(), ms, samples: [] }; A.baseline = null; emit(); return true; },
  clearCalibration() { A.baseline = null; A.calib = null; emit(); },
  setLookAway(b) { A.lookAway = b; emit(); },
  stop(silent) {
    A.baseline = null; A.calib = null;
    clearInterval(A.timer); A.timer = null;
    if (A.stream) { A.stream.getTracks().forEach(t => t.stop()); A.stream = null; }
    if (A.video) A.video.srcObject = null;
    // Privacy (V2): camera-derived session data lives only in memory and is cleared when the camera stops.
    const was = A.mode; A.mode = 'off'; A.face = false; A.conf = 0; A.box = null; A.points = null; A.expr = null; A.trail = []; A.hist = []; A.v = 0; A.a = 0; A.unc = 0.5; A.attentive = true;
    A.stale = false; A.prevBox = null; A.top = ''; A.lastModel = 0;
    if (!silent) { store.s.camera.choice = 'none'; store.save(); if (was === 'camera' || was === 'demo') store.log('ai', 'Affect observation turned off'); }
    emit();
  },
};

async function loadModels() {
  if (A.loaded) return;
  const [{ WEIGHTS }, faceapi] = await Promise.all([import('../models/weights.js'), import('../vendor/face-api.esm.js')]);
  A.faceapi = faceapi; const tf = faceapi.tf;
  let ok = false; try { ok = await tf.setBackend('webgl'); } catch (e) { ok = false; }
  if (!ok) { await tf.setBackend('cpu'); } // no WebGL: slower CPU backend
  await tf.ready(); A.backend = tf.getBackend();
  const load = async (net, key) => { const w = WEIGHTS[key]; const bin = Uint8Array.from(atob(w.b64), c => c.charCodeAt(0)); const map = tf.io.decodeWeights(bin.buffer, w.specs); await net.loadFromWeightMap(map); };
  await load(faceapi.nets.tinyFaceDetector, 'tiny_face_detector_model');
  await load(faceapi.nets.faceLandmark68TinyNet, 'face_landmark_68_tiny_model');
  await load(faceapi.nets.faceExpressionNet, 'face_expression_model');   // kept for the fallback path
  A.loaded = true;
  // TRADEWISE affect model on face-api's own TF.js instance. Failure is not fatal: fall back to the heuristic.
  try {
    const { AffectModel } = await import('./affect-model.js');
    A.am = await AffectModel.load(tf);
    A.engine = 'tradewise'; A.modelErr = '';
    A.modelEvery = A.backend === 'webgl' ? 300 : 900;   // CPU fallback: start slower; adapts to measured speed
    store.log('ai', `TRADEWISE affect model loaded on this device (${A.backend}, warm-up ${Math.round(A.am.warmupMs)} ms)`);
  } catch (e) {
    console.warn('TRADEWISE affect model unavailable, using heuristic fallback:', e);
    A.am = null; A.engine = 'heuristic'; A.modelErr = (e && e.message) || String(e);
    store.log('ai', 'Affect model could not load; using the simpler expression heuristic instead');
  }
}

// Quality of the current face observation, 0..1, plus human-readable reasons (neutral language).
function faceQuality(res, b, vw, facing, brightness) {
  const reasons = []; let q = 1;
  const det = res.detection.score; if (det < 0.6) { q *= 0.6; reasons.push('low face-detection confidence'); }
  const size = b.width / vw; if (size < 0.18) { q *= 0.6 + 0.4 * size / 0.18; reasons.push('face small in frame'); }
  if (!facing) { q *= 0.6; reasons.push('head turned'); }
  if (brightness != null && brightness < 55) { q *= 0.5; reasons.push('low light'); }
  if (brightness != null && brightness > 215) { q *= 0.6; reasons.push('very bright light'); }
  if (A.prevBox) {
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2, px = A.prevBox.x + A.prevBox.width / 2, py = A.prevBox.y + A.prevBox.height / 2;
    if (Math.hypot(cx - px, cy - py) / b.width > 0.25) { q *= 0.5; reasons.push('large head movement'); }
  }
  return { q: q * Math.min(1, det / 0.8), reasons };
}

// One model observation -> calibrated, smoothed V/A, expression probabilities and confidence.
function applyModel(est, qual) {
  let v = est.valence, a = est.arousal; const probs = est.probs.slice();
  if (A.calib) {
    A.calib.samples.push({ v, a, probs });
    if (Date.now() - A.calib.start >= A.calib.ms && A.calib.samples.length >= 8) {
      const n = A.calib.samples.length; const mean = f => A.calib.samples.reduce((s, x) => s + f(x), 0) / n;
      A.baseline = { v: mean(x => x.v), a: mean(x => x.a), probs: probs.map((_, i) => mean(x => x.probs[i])) };
      A.calib = null; store.log('ai', `Camera calibrated to your neutral face (${n} observations, numbers only, not stored)`);
    }
  }
  if (A.baseline && A.baseline.probs) {   // personal neutral: remove this person's resting offset
    v = clamp(v - A.baseline.v, -1, 1); a = clamp(a - A.baseline.a, -1, 1);
    let moved = 0; for (let i = 1; i < probs.length; i++) { const adj = Math.max(0, probs[i] - A.baseline.probs[i]); moved += probs[i] - adj; probs[i] = adj; }
    probs[0] += moved;
  }
  const frameConf = clamp((1 - 0.7 * est.entropy) * qual.q, 0, 0.95);
  // Confidence-weighted exponential smoothing; after a pause, start from the new observation (no stale carry-over).
  const k = A.stale || !A.expr ? 1 : 0.3 * Math.max(0.2, frameConf);
  A.v += (v - A.v) * k; A.a += (a - A.a) * k;
  const prev = A.expr ? LABELS.map(l => A.expr[l] || 0) : probs;
  A.expr = Object.fromEntries(LABELS.map((l, i) => [l, prev[i] + (probs[i] - prev[i]) * (k === 1 ? 1 : 0.35)]));
  A.conf = A.stale ? frameConf * 0.7 : A.conf + (frameConf - A.conf) * 0.3;
  const sm = LABELS.map(l => A.expr[l]); A.top = LABELS[sm.indexOf(Math.max(...sm))];
  A.stale = false; A.modelRuns++;
}
let busy = false;
async function detect() {
  if (busy || A.mode !== 'camera' || !A.video || A.video.readyState < 2) return; busy = true;
  try {
    const f = A.faceapi; let q = f.detectSingleFace(A.video, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })).withFaceLandmarks(true);
    if (!A.am) q = q.withFaceExpressions();   // FER expressions only needed for the fallback path
    const res = await q;
    if (A.mode !== 'camera') return;          // camera was turned off while detecting
    A.frames++;
    if (!res) {                               // no face: pause the estimate instead of showing an old one as current
      A.face = false; A.box = null; A.points = null; A.prevBox = null; A.conf *= 0.6; A.trail = [];
      if (A.am) A.stale = true;
      A.quality = A.am ? 'No face in view · estimate paused' : 'No face in view'; setAttentive(false);
    }
    else if (A.am) {
      A.face = true; const b = res.detection.box, vw = A.video.videoWidth, vh = A.video.videoHeight;
      A.box = { x: b.x / vw, y: b.y / vh, w: b.width / vw, h: b.height / vh };
      const pts = res.landmarks.positions; A.points = pts.filter((p, i) => i % 3 === 0).map(p => [p.x / vw, p.y / vh]);
      const le = res.landmarks.getLeftEye(), re = res.landmarks.getRightEye(), nose = res.landmarks.getNose();
      const c = arr => arr.reduce((acc, p) => [acc[0] + p.x / arr.length, acc[1] + p.y / arr.length], [0, 0]);
      const L = c(le), R = c(re), mid = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2], eyeD = Math.hypot(R[0] - L[0], R[1] - L[1]);
      const facing = Math.abs((nose[3].x - mid[0]) / eyeD) < 0.32; setAttentive(facing);
      const now = Date.now();
      if (A.stale || now - A.lastModel >= A.modelEvery) {      // throttled model inference
        A.lastModel = now;
        const est = A.am.estimate(A.video, b);
        A.inferMs = A.inferMs ? A.inferMs * 0.8 + est.ms * 0.2 : est.ms;
        A.modelEvery = Math.round(clamp(A.inferMs * 4, 300, 8000));   // keep model work <= ~25% of the time (slow CPU: fewer updates)
        const qual = faceQuality(res, b, vw, facing, est.brightness);
        applyModel(est, qual);
        A.quality = A.calib ? 'Calibrating… keep a relaxed face' : qual.reasons.length ? 'Face found · ' + qual.reasons.join(' · ') : `Face found · ${Math.round(res.detection.score * 100)}%${A.baseline ? ' · calibrated' : ''}`;
        if (A.modelEvery > 1500) A.quality += ` · slow device: estimate every ${(A.modelEvery / 1000).toFixed(1)} s`;
      }
      A.prevBox = { x: b.x, y: b.y, width: b.width, height: b.height };
    }
    else {
      A.face = true; const b = res.detection.box, vw = A.video.videoWidth, vh = A.video.videoHeight;
      A.box = { x: b.x / vw, y: b.y / vh, w: b.width / vw, h: b.height / vh };
      const pts = res.landmarks.positions; A.points = pts.filter((p, i) => i % 3 === 0).map(p => [p.x / vw, p.y / vh]);
      // head yaw: nose tip vs eye midpoint, normalised by eye distance
      const le = res.landmarks.getLeftEye(), re = res.landmarks.getRightEye(), nose = res.landmarks.getNose();
      const c = arr => arr.reduce((a, p) => [a[0] + p.x / arr.length, a[1] + p.y / arr.length], [0, 0]);
      const L = c(le), R = c(re), mid = [(L[0] + R[0]) / 2, (L[1] + R[1]) / 2], eyeD = Math.hypot(R[0] - L[0], R[1] - L[1]);
      const yaw = (nose[3].x - mid[0]) / eyeD; const facing = Math.abs(yaw) < 0.32;
      setAttentive(facing);
      let ex = { ...res.expressions };
      if (A.calib) { A.calib.samples.push(ex); if (Date.now() - A.calib.start >= A.calib.ms && A.calib.samples.length >= 8) { const n = A.calib.samples.length || 1; A.baseline = {}; Object.keys(COORD).forEach(k => { A.baseline[k] = A.calib.samples.reduce((s2, e) => s2 + (e[k] || 0), 0) / n; }); A.calib = null; store.log('ai', `Camera calibrated to your neutral face (${n} frames, numbers only, not stored)`); } }
      if (A.baseline) { let moved = 0; Object.keys(COORD).forEach(k => { if (k === 'neutral') return; const adj = Math.max(0, (ex[k] || 0) - A.baseline[k]); moved += (ex[k] || 0) - adj; ex[k] = adj; }); ex.neutral = (ex.neutral || 0) + moved; }
      A.expr = ex;
      let v = 0, a = 0; const probs = Object.entries(COORD).map(([k]) => ex[k] || 0); const sum = probs.reduce((x, y) => x + y, 0) || 1;
      Object.entries(COORD).forEach(([k, [cv, ca]]) => { const p = (ex[k] || 0) / sum; v += p * cv; a += p * ca; });
      const ent = -probs.reduce((s, p) => { const q = p / sum; return s + (q > 0 ? q * Math.log(q) : 0); }, 0) / Math.log(7);
      const sizeOk = clamp(b.width / vw / 0.25, 0, 1);
      const conf = clamp(res.detection.score * (1 - 0.6 * ent) * (0.6 + 0.4 * sizeOk) * (facing ? 1 : 0.7), 0, 0.92);
      const k = 0.25; A.v = A.v + (v - A.v) * k; A.a = A.a + (a - A.a) * k; A.conf = A.conf + (conf - A.conf) * k;
      A.quality = A.calib ? 'Calibrating… keep a relaxed face' : `Face found · ${Math.round(res.detection.score * 100)}%${A.baseline ? ' · calibrated' : ''}${facing ? '' : ' · head turned'}`;
    }
    finishFrame();
  } catch (e) { console.warn(e); } finally { busy = false; }
}
function demoStep() {
  const p = PRESETS[A.preset]; const j = () => (Math.random() - .5) * 0.06;
  A.v += (p.v - A.v) * 0.2 + j(); A.a += (p.a - A.a) * 0.2 + j(); A.conf += ((A.preset === 'uncertain' ? 0.32 : 0.62) - A.conf) * 0.2;
  A.face = !A.lookAway; setAttentive(!A.lookAway); A.quality = A.lookAway ? 'Simulated: looking away' : 'Simulated face'; finishFrame();
}
function setAttentive(b) { if (b) { A.attentive = true; A.lastAttentive = Date.now(); } else A.attentive = false; }
function finishFrame() {
  A.v = clamp(A.v, -1, 1); A.a = clamp(A.a, -1, 1); A.unc = clamp(0.12 + (1 - A.conf) * 0.38, 0.12, 0.5);
  if (!A.stale && (A.mode !== 'camera' || A.face)) {   // paused estimates are not added to the trail/history
    A.trail.push([A.v, A.a]); if (A.trail.length > 14) A.trail.shift();
    A.hist.push({ t: Date.now(), v: A.v, a: A.a, c: A.conf }); if (A.hist.length > 160) A.hist.shift();
  }
  emit();
}
// Attention without a camera: page hidden counts as not looking.
document.addEventListener('visibilitychange', () => { if (document.hidden) { A.attentive = false; } else if (A.mode !== 'camera' || A.face) { setAttentive(true); } emit(); });
