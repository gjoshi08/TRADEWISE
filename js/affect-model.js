// TRADEWISE affect model (trained in ml/, exported to TF.js; see ml/STAGE_A_REPORT.md).
// Runs on the TensorFlow.js instance bundled in face-api (no extra library). Frames are processed in memory only.
// Input: face crop -> RGB 224x224 (bilinear) -> x/127.5 - 1.  Outputs: [1,8] expression probabilities (calibrated;
// contempt disabled) and [1,2] valence/arousal (original AffectNet regressor, unchanged).
// These are camera-derived ESTIMATES of what a face displays, not measurements of felt emotion.

export const LABELS = ['neutral', 'happiness', 'sadness', 'surprise', 'fear', 'disgust', 'anger', 'contempt'];
export const ACTIVE = LABELS.length - 1;   // contempt has no training data in this model

export class AffectModel {
  constructor(tf, model) { this.tf = tf; this.model = model; }

  static async load(tf, url = 'models/tradewise_affect_tfjs/model.json') {
    const model = await tf.loadGraphModel(url);
    const m = new AffectModel(tf, model);
    const t0 = performance.now();
    tf.tidy(() => { const { va, ex } = m._run(tf.zeros([1, 224, 224, 3])); va.dataSync(); ex.dataSync(); }); // warm-up
    m.warmupMs = performance.now() - t0;
    return m;
  }

  // The two graph outputs are unnamed (Identity, Identity_1); identify them by shape.
  _run(x) {
    let outs = this.model.execute(x);
    outs = Array.isArray(outs) ? outs : [outs];
    const va = outs.find(t => t.shape[1] === 2), ex = outs.find(t => t.shape[1] === 8);
    if (!va || !ex) throw new Error('Unexpected model outputs: ' + outs.map(t => t.shape).join(' / '));
    return { va, ex };
  }

  // source: <video>; box: {x, y, width, height} in source pixels (face-api detection.box).
  // margin adds context so the crop resembles the aligned training faces.
  estimate(source, box, margin = 0.12) {
    const tf = this.tf;
    const vw = source.videoWidth || source.width, vh = source.videoHeight || source.height;
    const y1 = Math.max(0, (box.y - margin * box.height) / vh), x1 = Math.max(0, (box.x - margin * box.width) / vw);
    const y2 = Math.min(1, (box.y + (1 + margin) * box.height) / vh), x2 = Math.min(1, (box.x + (1 + margin) * box.width) / vw);
    const t0 = performance.now();
    const [va, ex, lum] = tf.tidy(() => {
      const frame = tf.browser.fromPixels(source).toFloat().expandDims(0);                 // RGB, 0..255
      const crop = tf.image.cropAndResize(frame, [[y1, x1, y2, x2]], [0], [224, 224], 'bilinear');
      const { va, ex } = this._run(crop.div(127.5).sub(1));                                  // -> [-1, 1]
      const lum = crop.mean();                                                               // face brightness 0..255
      return [va.dataSync().slice(), ex.dataSync().slice(), lum.dataSync()[0]];
    });
    const ms = performance.now() - t0;
    const probs = Array.from(ex);
    const entropy = -probs.reduce((s, p) => s + (p > 1e-9 ? p * Math.log(p) : 0), 0) / Math.log(ACTIVE);
    const clip = v => Math.max(-1, Math.min(1, v));
    return { valence: clip(va[0]), arousal: clip(va[1]), probs, entropy, top: LABELS[probs.indexOf(Math.max(...probs))],
             topP: Math.max(...probs), brightness: lum, ms };
  }
}
