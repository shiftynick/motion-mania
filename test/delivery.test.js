import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomHeader, deliveryFindings, mp4Atoms, preflightDelivery } from '../src/delivery.js';
import { probe, run } from '../src/process.js';

const manifest = { duration: 2, fps: 30, audioRequired: true }, dimensions = { width: 320, height: 180 };
const video = { codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p', ...dimensions, avg_frame_rate: '30/1', duration: '2', color_primaries: 'bt709', color_transfer: 'bt709', color_space: 'bt709', color_range: 'tv' };
const metadata = () => ({ streams: [{ ...video }, { codec_type: 'audio', codec_name: 'aac', duration: '2' }], format: { duration: '2' } });
const atoms = [{ type: 'moov', offset: 32 }, { type: 'mdat', offset: 100 }];

test('delivery parsing separates broken outputs from compatibility warnings and lossless repairs', () => {
  assert.deepEqual(deliveryFindings(metadata(), manifest, dimensions, atoms).warnings, []);
  const bad = metadata();
  Object.assign(bad.streams[0], { width: 100, avg_frame_rate: '0/0', duration: '7', codec_name: 'hevc', pix_fmt: 'yuv444p', color_range: 'pc' });
  bad.streams.push({ codec_type: 'audio', codec_name: 'mp3' });
  const result = deliveryFindings(bad, manifest, dimensions, [...atoms].reverse().map((a, i) => ({ ...a, offset: i * 100 })));
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
  assert.equal(result.warnings.length, 4);
  assert.equal(result.repairableColor, false);
  const missing = metadata();
  delete missing.streams[0].color_primaries;
  assert.equal(deliveryFindings(missing, manifest, dimensions, atoms).repairableColor, true);
  missing.streams[0].color_transfer = 'smpte2084';
  assert.equal(deliveryFindings(missing, manifest, dimensions, atoms).repairableColor, false);
  assert.equal(deliveryFindings({ streams: [{ ...video }], format: { duration: '2' } }, manifest, dimensions, atoms).ok, false);
  assert.equal(deliveryFindings(metadata(), manifest, dimensions, []).ok, false);
  const longContainer = metadata();
  longContainer.format.duration = '4';
  assert.equal(deliveryFindings(longContainer, manifest, dimensions, atoms).ok, false);
});

test('MP4 header parsing handles extended and zero sizes without scanning payload bytes', () => {
  const header = Buffer.alloc(16);
  header.writeUInt32BE(1); header.write('mdat', 4); header.writeBigUInt64BE(9000000000n, 8);
  assert.deepEqual(atomHeader(header), { type: 'mdat', size: 9000000000 });
  header.writeUInt32BE(0);
  assert.deepEqual(atomHeader(header, 0, 120), { type: 'mdat', size: 120 });
  header.writeUInt32BE(4);
  assert.throws(() => atomHeader(header), /Invalid/);
  assert.throws(() => atomHeader(Buffer.alloc(7)), /Truncated/);
});

test('missing SDR tags and late moov are repaired without changing decoded frames or audio', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'motion-delivery-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'film.mp4');
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=30:duration=2', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file], { quiet: true });
  const hash = async () => (await run('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v:0', '-map', '0:a:0', '-f', 'framemd5', '-'], { quiet: true })).stdout;
  const before = await hash();
  const result = await preflightDelivery(file, manifest, dimensions);
  assert.deepEqual(result.repairs, ['faststart', 'bt709-tv-tags']);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.faststart, true);
  assert.equal(result.video.color_primaries, 'bt709');
  assert.equal(await hash(), before);
  assert.equal((await probe(file)).streams[0].color_range, 'tv');
  const parsed = await mp4Atoms(file);
  assert.ok(parsed.find(a => a.type === 'moov').offset < parsed.find(a => a.type === 'mdat').offset);
});
