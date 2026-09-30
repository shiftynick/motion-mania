import { writeFile } from 'node:fs/promises';

// Original, deterministic 120 BPM demo score. No model API or external music.
// Soft saturation keeps peaks under the ceiling while the rendered mix lands near -14 LUFS.
export async function synthesize(file, duration = 15) {
  const rate = 48000, samples = Math.round(duration * rate);
  const signal = new Float64Array(samples);
  const voice = (start, length, frequency, gain, decay, kind = 'tone') => {
    for (let j = 0; j < Math.round(length * rate); j++) {
      const i = Math.round(start * rate) + j;
      if (i >= samples) break;
      const t = j / rate, attack = Math.min(1, t / 0.006);
      const phase = kind === 'kick' ? 2 * Math.PI * (48 * t + 1.8 * (1 - Math.exp(-t * 30))) : 2 * Math.PI * frequency * t;
      signal[i] += Math.sin(phase) * Math.exp(-decay * t) * gain * attack;
    }
  };
  const notes = [220, 261.6256, 329.6276, 391.9954, 440, 391.9954, 329.6276, 261.6256];
  // The arrangement follows the starter storyboard: a sparse hook, a build, the full groove, then a
  // resolving chord that rings out. Sections at different levels keep the mix from being a flat wall.
  const resolve = duration - 2;
  const level = t => t < 3 ? 0.65 : t < 6.5 ? 0.65 + 0.35 * (t - 3) / 3.5 : 1;
  for (let beat = 0; beat < resolve * 2; beat++) {
    const t = beat / 2, g = level(t);
    voice(t, 0.35, 60, 0.36 * g, 13, 'kick');
    voice(t, 0.7, notes[beat % notes.length], 0.11 * g, 6);
    if (t >= 3) voice(t + 0.25, 0.22, notes[(beat + 2) % notes.length] * 2, 0.045 * g, 20);
    if (t >= 3 && beat % 2) voice(t, 0.04, 1700, 0.04 * g, 75);
  }
  voice(resolve, 0.35, 60, 0.36, 13, 'kick');
  for (const frequency of [110, 220, 261.6256, 329.6276]) voice(resolve, 2, frequency, 0.09, 1.6);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / (rate * 0.02), (samples - i) / (rate * 0.5));
    wav.writeInt16LE(Math.round(Math.tanh(signal[i] * 5) * fade * 29000), 44 + i * 2);
  }
  await writeFile(file, wav);
}
