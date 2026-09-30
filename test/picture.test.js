import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { analyzePicture, blockChange, pictureFindings } from '../src/picture.js';
import { run } from '../src/process.js';

test('block change notices one small moving element that a whole-frame average would miss', () => {
  const width = 32, height = 16, before = new Uint8Array(width * height), after = new Uint8Array(width * height);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) after[y * width + x] = 64;
  assert.equal(blockChange(before, after, width, height), 16);
  assert.equal(blockChange(before, before, width, height), 0);
  // Partial blocks at the right and bottom edges still count.
  assert.equal(blockChange(new Uint8Array(10 * 10), new Uint8Array(10 * 10).fill(3), 10, 10), 3);
});

test('frozen holds are reported by shot, with final and intended holds left unflagged', () => {
  const rate = 10, seconds = 8, lag = 1;
  const change = Array.from({ length: rate * seconds }, (_, i) => i < lag ? null : (i >= 20 && i < 35) || (i >= 50 && i < 60) || i >= 72 ? 0 : 5);
  const luma = Array.from({ length: rate * seconds }, () => 200);
  const shots = [{ index: 1, name: 'Open', from: 0, to: 4 }, { index: 2, name: 'Read', from: 4, to: 6.5, hold: 'Reading time' }, { index: 3, name: 'End', from: 6.5, to: 8 }];
  const result = pictureFindings({ rate, luma, change }, { duration: seconds, shots });
  assert.deepEqual(result.holds.map(h => [h.from, h.to, h.intended, h.final]), [[1.9, 3.5, false, false], [4.9, 6, true, false], [7.1, 8, false, true]]);
  assert.equal(result.heldSeconds, 3.6);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /1\.9s to 3\.5s.*Open/);
  assert.deepEqual(result.shots.map(s => s.heldSeconds), [1.6, 1.1, 0.9]);
});

test('near-black frames are flagged in a bright film and only listed in a dark one', () => {
  const rate = 10, change = Array.from({ length: 40 }, (_, i) => i ? 5 : null);
  const bright = Array.from({ length: 40 }, (_, i) => i < 2 || (i >= 20 && i < 23) ? 4 : 180);
  const result = pictureFindings({ rate, luma: bright, change }, { duration: 4 });
  assert.deepEqual(result.dark.map(d => [d.from, d.to]), [[0, 0.2], [2, 2.3]]);
  assert.match(result.warnings[0], /opens on near-black/);
  assert.match(result.warnings[1], /2s to 2\.3s/);
  const dim = pictureFindings({ rate, luma: bright.map(l => l === 180 ? 30 : l), change }, { duration: 4 });
  assert.equal(dim.dark.length, 2);
  assert.deepEqual(dim.warnings.length, 1);
  assert.match(dim.warnings[0], /mostly dark/);
});

test('an encoded film yields its frozen stretch, black flash, and an activity chart', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'motion-picture-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'film.mp4');
  // A box moves for 1 s, stops until 2.5 s, the frame flashes black for 0.3 s, then the box moves again.
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=white:s=320x180:d=4:r=30', '-f', 'lavfi', '-i', 'color=red:s=40x40:d=4:r=30', '-filter_complex',
    "[0][1]overlay=x='if(lt(t,1),t*120,if(lt(t,2.5),120,120+(t-2.5)*60))':y=60,drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,2.5,2.79)'",
    '-pix_fmt', 'yuv420p', file], { quiet: true });
  const shots = [{ index: 1, name: 'Move', from: 0, to: 2.5 }, { index: 2, name: 'Again', from: 2.5, to: 4 }];
  const result = await analyzePicture(file, { manifest: { duration: 4, fps: 30 }, storyboard: { shots }, output: dir, label: 'fixture' });
  assert.equal(result.holds.length, 1);
  assert.ok(Math.abs(result.holds[0].from - 1) < 0.1 && Math.abs(result.holds[0].to - 2.5) < 0.1, JSON.stringify(result.holds));
  assert.equal(result.dark.length, 1);
  assert.ok(Math.abs(result.dark[0].from - 2.5) < 0.05 && Math.abs(result.dark[0].to - 2.8) < 0.05, JSON.stringify(result.dark));
  assert.equal(result.warnings.length, 2);
  assert.ok((await readFile(result.chart)).length > 1000);
});
