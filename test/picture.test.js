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

test('one-frame pops and flashes require two spikes and matching neighbours; a cut is exempt', async () => {
  const { transientFindings } = await import('../src/picture.js');
  const rate = 30, luma = Array(60).fill(100), adjacent = Array(60).fill(2), bridge = Array(60).fill(4);
  adjacent[0] = bridge[0] = bridge[1] = null;
  adjacent[15] = adjacent[16] = 60;
  bridge[16] = 1;
  let result = transientFindings({ rate, luma, adjacent, bridge });
  assert.deepEqual(result.map(f => [f.frame, f.at, f.type]), [[15, 0.5, 'pop']]);
  luma[15] = 240;
  assert.equal(transientFindings({ rate, luma, adjacent, bridge })[0].type, 'flash');
  adjacent[16] = 2;
  assert.deepEqual(transientFindings({ rate, luma, adjacent, bridge }, [{ from: 0.5 }]), []);
  adjacent[16] = 60;
  result = transientFindings({ rate, luma, adjacent, bridge }, [{ from: 0.5 }]);
  assert.equal(result[0].frame, 15);
  assert.equal(result[0].adjacentToCut, true);
  // Last frame before the cut still gets inspected too.
  adjacent[14] = 60;
  bridge[15] = 1;
  adjacent[16] = 2;
  assert.equal(transientFindings({ rate, luma, adjacent, bridge }, [{ from: 0.5 }])[0].frame, 14);
  // Fast continuing movement has dissimilar neighbours, unlike an isolated pop.
  adjacent[14] = 2;
  adjacent[16] = 60;
  bridge[16] = 80;
  assert.deepEqual(transientFindings({ rate, luma, adjacent, bridge }), []);
});

test('loop seams allow ordinary motion but report jumps and changes in signed motion', async () => {
  const { loopFindings } = await import('../src/picture.js');
  assert.deepEqual(loopFindings({ seam: 3, entering: 3, leaving: 3, velocityDifference: 0 }).warnings, []);
  assert.equal(loopFindings({ seam: 80, entering: 2, leaving: 2, velocityDifference: 0 }).jump, true);
  assert.equal(loopFindings({ seam: 4, entering: 4, leaving: 4, velocityDifference: 8 }).velocityMismatch, true);
  assert.equal(loopFindings({ seam: 0, entering: 0, leaving: 0, velocityDifference: 0 }).velocityMismatch, false);
});

test('native-rate decoding finds a single-frame flash above 30 fps and optionally checks the loop', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'motion-picture-pop-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'pop.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=gray:s=160x90:d=1:r=60', '-vf', "drawbox=color=white:t=fill:enable='eq(n,31)'", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file], { quiet: true });
  const result = await analyzePicture(file, { manifest: { duration: 1, fps: 60, loop: true }, output: dir, label: 'pop fixture' });
  assert.equal(result.rate, 60);
  assert.deepEqual(result.transients.map(f => [f.frame, f.at, f.type]), [[31, 0.516667, 'flash']]);
  assert.equal(result.loop.jump, false);
  assert.equal(result.loop.velocityMismatch, false);
});

test('a pop in an unchanged region adjacent to a hard cut is measured without flagging the cut', async () => {
  const { isolatedChange, transientFindings } = await import('../src/picture.js');
  const width = 32, height = 16, before = new Uint8Array(width * height).fill(100), clean = Uint8Array.from(before), pop = Uint8Array.from(before);
  // Left half changes at the cut; the pop occupies a block in the unchanged right half.
  for (let y = 0; y < height; y++) for (let x = 0; x < 16; x++) clean[y * width + x] = 240;
  for (let y = 0; y < 8; y++) for (let x = 24; x < 32; x++) pop[y * width + x] = 200;
  assert.equal(isolatedChange(before, before, clean, width, height), 0);
  assert.equal(isolatedChange(before, pop, clean, width, height), 100);
  const adjacent = Array(40).fill(2), bridge = Array(40).fill(4), isolated = Array(40).fill(0), luma = Array(40).fill(100);
  adjacent[19] = 100; adjacent[20] = 140; bridge[20] = 140; isolated[19] = 100;
  const result = transientFindings({ rate: 30, luma, adjacent, bridge, isolated }, [{ from: 20 / 30 }]);
  assert.deepEqual(result.map(f => [f.frame, f.adjacentToCut]), [[19, true]]);
});

test('opening-state pops and bright empty gaps are warnings without requiring black pixels', () => {
  const count = 90, luma = Array(count).fill(230), change = Array(count).fill(2), adjacent = Array(count).fill(1), detail = Array(count).fill(25), isolated = Array(count).fill(0);
  adjacent[0] = null; adjacent[1] = 50; isolated[0] = 50;
  detail.fill(0, 60, 72);
  const result = pictureFindings({ rate: 30, luma, change, adjacent, detail, isolated }, { duration: 3 });
  assert.equal(result.transients[0].frame, 0);
  assert.equal(result.transients[0].endpoint, true);
  assert.deepEqual(result.blank, [{ from: 2, to: 2.4 }]);
  assert.equal(result.dark.length, 0);
});
