export const effects = { whoosh: 0.55, click: 0.055, tick: 0.055, pop: 0.18, impact: 0.65, riser: 1.5, pad: 2.5, swell: 2.5 };
const TAU = 2 * Math.PI;
const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function peakIndex(samples) {
  let peak = 0, index = 0;
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i]) > peak) { peak = Math.abs(samples[i]); index = i; }
  return index;
}

export function effect(kind, { seed = 1, duration = effects[kind], rate = 48000 } = {}) {
  if (!Object.hasOwn(effects, kind)) throw new Error(`Unknown effect '${kind}'; choose ${Object.keys(effects).join(', ')}`);
  if (!finite(duration, 0.02, 30) || !Number.isInteger(rate) || rate < 8000 || rate > 96000 || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Effect duration must be 0.02..30s, rate 8000..96000, seed an unsigned 32-bit integer.');
  const samples = new Float32Array(Math.round(duration * rate));
  let state = seed >>> 0, low = 0, previous = 0, high = 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 2147483648 - 1; };
  const phase = (seed % 1000) / 1000 * TAU;
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate, x = i / (samples.length - 1), n = random();
    const attack = Math.min(1, t / 0.003), tail = Math.min(1, (duration - t) / 0.02);
    let value;
    if (kind === 'whoosh' || kind === 'riser') {
      low += (0.03 + 0.3 * x) * (n - low);
      high = 0.97 * (high + low - previous); previous = low;
      value = kind === 'whoosh' ? high * Math.sin(Math.PI * x) ** 2 : (high + 0.2 * Math.sin(TAU * (180 * t + 160 * t * x))) * x ** 2;
    } else if (kind === 'click' || kind === 'tick') value = (0.75 * Math.sin(TAU * (2100 + seed % 700) * t) + n * 0.25) * Math.exp(-70 * t);
    else if (kind === 'pop') value = Math.sin(TAU * ((170 + seed % 30) * t + 8 * (1 - Math.exp(-30 * t)))) * Math.exp(-25 * t);
    else if (kind === 'impact') { low += 0.12 * (n - low); value = Math.sin(TAU * (45 * t + 2 * (1 - Math.exp(-35 * t)))) * Math.exp(-9 * t) + low * Math.exp(-18 * t) * 0.5; }
    else value = (Math.sin(TAU * 220 * t + phase) + 0.5 * Math.sin(TAU * 277.18 * t) + 0.35 * Math.sin(TAU * 329.63 * t)) * Math.sin(Math.PI * x) ** 2;
    samples[i] = value * attack * tail;
  }
  const maximum = Math.abs(samples[peakIndex(samples)]);
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i] / maximum * 0.7;
  return { samples, rate, peakAt: peakIndex(samples) / rate, duration: samples.length / rate };
}

export function renderCues(sheet, { duration = sheet?.duration, fps = sheet?.fps ?? 30, rate = 48000 } = {}) {
  if (!sheet || !Array.isArray(sheet.cues) || sheet.cues.length > 1000 || !finite(duration, 0.02, 600) || !Number.isInteger(fps) || fps < 1 || fps > 120 || !Number.isInteger(rate) || rate < 8000 || rate > 96000) throw new Error('Cue sheet requires cues (up to 1000), duration 0.02..600s, fps 1..120, and rate 8000..96000.');
  const seed = sheet.seed ?? 1;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Cue sheet seed must be an unsigned 32-bit integer.');
  const samples = new Float32Array(Math.round(duration * rate)), cues = [], warnings = [];
  for (const [index, cue] of sheet.cues.entries()) {
    if (!cue || !finite(cue.at, 0, duration) || cue.at >= duration || !finite(cue.gainDb ?? 0, -60, 12) || !Number.isInteger(cue.leadFrames ?? 0) || (cue.leadFrames ?? 0) < 0 || (cue.leadFrames ?? 0) > 120) throw new Error(`Cue ${index + 1}: at must be within the film, gainDb -60..12, leadFrames 0..120.`);
    const generated = effect(cue.effect, { seed: cue.seed ?? ((seed + index) >>> 0), duration: cue.duration ?? effects[cue.effect], rate });
    const peakSample = Math.round((cue.at - (cue.leadFrames ?? 0) / fps) * rate);
    if (peakSample < 0) throw new Error(`Cue ${index + 1}: leadFrames places its peak before the film starts.`);
    const start = peakSample - peakIndex(generated.samples), gain = 10 ** ((cue.gainDb ?? 0) / 20);
    for (let i = 0; i < generated.samples.length; i++) if (start + i >= 0 && start + i < samples.length) samples[start + i] += generated.samples[i] * gain;
    if (start < 0 || start + generated.samples.length > samples.length) warnings.push(`Cue ${index + 1}: tail or lead-in trimmed at the film boundary.`);
    cues.push({ ...cue, seed: cue.seed ?? ((seed + index) >>> 0), start: start / rate, peakAt: peakSample / rate, peakOffsetMs: (peakSample / rate - cue.at) * 1000, effectPeakAt: generated.peakAt });
  }
  const peak = Math.abs(samples[peakIndex(samples)]), scale = peak > 0.95 ? 0.95 / peak : 1;
  if (scale < 1) { for (let i = 0; i < samples.length; i++) samples[i] *= scale; warnings.push('Overlapping cues exceeded headroom; the entire stem was reduced without limiting.'); }
  return { samples, rate, cues, gainDb: 20 * Math.log10(scale), warnings };
}

export function wavBuffer(samples, rate = 48000) {
  const wav = Buffer.alloc(44 + samples.length * 4);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(3, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(32, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples.length * 4, 40);
  for (let i = 0; i < samples.length; i++) wav.writeFloatLE(samples[i], 44 + i * 4);
  return wav;
}
