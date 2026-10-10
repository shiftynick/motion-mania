import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { effect, effects, peakIndex, renderCues, soundReport, wavBuffer } from '../src/sound.js';
import { beatSummary, musicMoments } from '../src/beats.js';
import { run } from '../src/process.js';

test('every effect is deterministic, finite, non-silent and safely peaked', () => {
  for (const kind of Object.keys(effects)) {
    const a = effect(kind, { seed: 19 }), b = effect(kind, { seed: 19 });
    assert.deepEqual(a.samples, b.samples);
    assert.ok(a.samples.every(Number.isFinite));
    assert.ok(Math.abs(a.samples[peakIndex(a.samples)]) > 0.69);
    assert.notDeepEqual(a.samples, effect(kind, { seed: 20 }).samples);
  }
});

test('cues align measured peaks and an entrance can lead by two frames', () => {
  for (const kind of Object.keys(effects)) {
    const result = renderCues({ seed: 9, cues: [{ at: 3, effect: kind, leadFrames: 2 }] }, { duration: 6, fps: 30 });
    assert.equal(peakIndex(result.samples), Math.round((3 - 2 / 30) * result.rate));
    assert.ok(Math.abs(result.cues[0].peakOffsetMs + 2000 / 30) < 0.001);
    assert.equal(wavBuffer(result.samples).readUInt16LE(20), 3);
  }
  const overlap = renderCues({ cues: [{ at: 1, effect: 'impact', gainDb: 12 }, { at: 1, effect: 'impact', gainDb: 12 }] }, { duration: 2 });
  assert.ok(Math.abs(overlap.samples[peakIndex(overlap.samples)]) <= 0.951);
  assert.ok(overlap.gainDb < 0);
});

test('cue options reject invalid timing, effects, seeds and gains', () => {
  for (const cue of [{ at: 2, effect: 'click' }, { at: 1, effect: 'unknown' }, { at: 0, effect: 'click', leadFrames: 2 }, { at: 1, effect: 'pop', gainDb: NaN }, { at: 1, effect: 'pad', seed: -1 }, { at: 1, effect: 'riser', duration: 0 }]) assert.throws(() => renderCues({ cues: [cue] }, { duration: 2 }));
  assert.throws(() => effect('toString'), /Unknown effect/);
  assert.throws(() => renderCues({ cues: [], seed: '7' }, { duration: 2 }), /seed/);
});

test('sound writes reusable audio and complete reproducible provenance', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-cues-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets'));
  const input = path.join(root, 'cues.json');
  await writeFile(input, JSON.stringify({ seed: 7, cues: [{ at: 1, effect: 'whoosh' }] }));
  const project = { root, manifest: { duration: 2, fps: 30 } };
  const result = await soundReport(project, input);
  assert.equal(result.ok, true);
  const manifest = JSON.parse(await readFile(result.provenance, 'utf8'));
  assert.equal(manifest.assets[0].generator.model, 'sound-kit-v1');
  assert.equal(JSON.parse(manifest.assets[0].generator.prompt).seed, 7);
  await soundReport(project, input);
  assert.equal(JSON.parse(await readFile(result.provenance, 'utf8')).assets.length, 1);
  await assert.rejects(soundReport(project, input, '../outside.wav'), /inside/);
});

test('beat output states tempo and offset, and keeps unsupported downbeats unknown', () => {
  const result = beatSummary({ bpm: 120 }, { beats: [{ time: 0.25, strength: 0.9 }, { time: 0.75, strength: 0.5 }] });
  assert.equal(result.bpm, 120); assert.equal(result.beatOffset, 0.25); assert.equal(result.downbeats, null);
  assert.throws(() => beatSummary({ bpm: null }, { beats: [] }), /usable/);
  const moments = musicMoments({ window: 0.01, db: [...Array(100).fill(-50), ...Array(100).fill(-12)] });
  assert.ok(moments.loudestMoment.at >= 1);
  assert.equal(moments.drop.at, 1);
  assert.equal(musicMoments({ window: 0.01, db: [] }).drop, null);
});

test('CLI arguments fail clearly before doing sound work', async () => {
  const cli = path.resolve('src/cli.js');
  for (const args of [['sound', '--master'], ['beats', '--format', 'all'], ['audio', '--output', 'x.wav'], ['sound', '--project', 'examples/loop']]) {
    const result = await run(process.execPath, [cli, ...args, '--json'], { quiet: true, allowFailure: true });
    assert.equal(result.code, 1); assert.equal(JSON.parse(result.stdout).ok, false);
  }
});
