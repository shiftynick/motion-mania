import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzeAudio, audioAdvice, audioChecks, cutAccents, defaultLoudness, envelope, parseLoudness, silences } from '../src/audio.js';
import { validateManifest } from '../src/project.js';
import { synthesize } from '../src/sound.js';

const summary = `[Parsed_ebur128_0 @ 0x1] t: 14.9 M: -27.2
[Parsed_ebur128_0 @ 0x1] Summary:

  Integrated loudness:
    I:         -19.3 LUFS
    Threshold: -29.6 LUFS

  Loudness range:
    LRA:         5.5 LU
    Threshold: -39.7 LUFS

  Sample peak:
    Peak:       -2.1 dBFS

  True peak:
    Peak:       -0.4 dBFS
`;

test('ebur128 summaries parse, and silence reports null rather than a number', () => {
  assert.deepEqual(parseLoudness(summary), { integrated: -19.3, range: 5.5, samplePeak: -2.1, truePeak: -0.4 });
  const silent = parseLoudness(summary.replace('-19.3', '-inf').replaceAll(/-2\.1|-0\.4/g, '-inf'));
  assert.equal(silent.integrated, null);
  assert.equal(silent.truePeak, null);
  assert.throws(() => parseLoudness('no summary here'), /summary/);
});

test('loudness checks gate the target and advice accounts for peak headroom', () => {
  const quiet = { integrated: -26, truePeak: -11.8 }, hot = { integrated: -14.2, truePeak: -0.3 };
  assert.deepEqual(audioChecks(quiet, defaultLoudness).map(c => c.ok), [false, true]);
  assert.deepEqual(audioChecks(hot, defaultLoudness).map(c => c.ok), [true, false]);
  assert.deepEqual(audioChecks({ integrated: -14.5, truePeak: -2 }, defaultLoudness).map(c => c.ok), [true, true]);
  assert.match(audioAdvice(quiet, defaultLoudness), /12 dB.*peaks would reach/);
  assert.match(audioAdvice({ integrated: -20, truePeak: -12 }, defaultLoudness), /about 6 dB of gain/);
  assert.match(audioAdvice({ integrated: null, truePeak: null }, defaultLoudness), /silent/);
});

test('envelope finds silent gaps and energy rises near cuts', () => {
  const rate = 8000, samples = new Float32Array(rate * 4);
  for (let i = 0; i < samples.length; i++) {
    const t = i / rate;
    if (t < 1 || (t >= 2.03 && t < 3.5)) samples[i] = 0.3 * Math.sin(2 * Math.PI * 220 * t);
  }
  const env = envelope(samples, rate);
  assert.equal(env.db.length, 400);
  assert.deepEqual(silences(env), [{ from: 1, to: 2.03 }, { from: 3.5, to: 4 }]);
  const [near, far] = cutAccents(env, [2, 3]);
  assert.equal(near.offsetMs, 30);
  assert.ok(near.riseDb > 30);
  assert.equal(far.accentAt, null);
});

test('manifest loudness targets are optional but validated', () => {
  const base = { schemaVersion: 1, name: 'x', engine: 'hyperframes@0.8.81', duration: 2, fps: 30, formats: { a: { width: 64, height: 64 } } };
  assert.doesNotThrow(() => validateManifest({ ...base, loudness: { integrated: -16, truePeak: -1.5 } }));
  for (const loudness of [{ integrated: -2 }, { truePeak: 1 }, { tolerance: 0 }, { gain: 3 }, null, []]) assert.throws(() => validateManifest({ ...base, loudness }), /loudness/);
});

test('the starter score meets the default target once mixed to stereo', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'motion-audio-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'score.wav');
  await synthesize(file);
  const shots = [{ index: 1, name: 'A', from: 0, to: 7.5 }, { index: 2, name: 'B <&>', from: 7.5, to: 15 }];
  const result = await analyzeAudio(file, { manifest: { duration: 15, fps: 30 }, storyboard: { shots }, output: dir, label: 'starter' });
  // The mono file measures ~3 LU below a stereo render of the same signal.
  assert.ok(result.loudness.integrated > -17.5 && result.loudness.integrated < -14.5, `${result.loudness.integrated}`);
  assert.ok(result.loudness.truePeak <= -1);
  assert.deepEqual(result.silences, []);
  assert.equal(result.cuts[0].cut, 7.5);
  assert.equal(result.shots.length, 2);
  assert.deepEqual(result.warnings, []);
  assert.ok((await readFile(result.waveform)).length > 1000);
  const silent = await analyzeAudio(file, { manifest: { duration: 15, fps: 30, loudness: { integrated: -30 } }, output: dir, label: 'strict' });
  assert.equal(silent.ok, false);
  assert.equal(silent.checks[0].ok, false);
});
