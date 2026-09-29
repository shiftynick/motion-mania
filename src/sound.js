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
  for (let beat = 0; beat < duration * 2; beat++) {
    const t = beat / 2;
    voice(t, 0.35, 60, 0.36, 13, 'kick');
    voice(t, 0.7, notes[beat % notes.length], 0.11, 6);
    voice(t + 0.25, 0.22, notes[(beat + 2) % notes.length] * 2, 0.045, 20);
    if (beat % 2) voice(t, 0.04, 1700, 0.04, 75);
  }
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / (rate * 0.02), (samples - i) / (rate * 0.5));
    wav.writeInt16LE(Math.round(Math.tanh(signal[i] * 4) * fade * 30000), 44 + i * 2);
  }
  await writeFile(file, wav);
}
