import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { initProject, loadProject, withBuild, validateManifest } from '../src/project.js';
import { parseTimes, reviewTimes, validateMedia } from '../src/operations.js';
import { run } from '../src/process.js';

async function temporary(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'motion-mania-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('initialization preserves existing files and succeeds in an empty directory', async t => {
  const root = await temporary(t), target = path.join(root, 'product with spaces');
  await mkdir(target);
  await initProject(target);
  const original = await readFile(path.join(target, 'src/index.html'));
  await assert.rejects(initProject(target), /nonempty/);
  assert.deepEqual(await readFile(path.join(target, 'src/index.html')), original);
  assert.ok((await readFile(path.join(target, 'assets/score.wav'))).length > 1000);
  assert.deepEqual((await readdir(root)).filter(p => p.startsWith('.motion-init')), []);
});

test('builds isolate formats, inline the timeline and clean up even on failure', async t => {
  const root = await temporary(t), target = path.join(root, 'video');
  await initProject(target);
  const project = await loadProject(target);
  let build;
  await assert.rejects(withBuild(project, 'landscape', async directory => {
    build = directory;
    const html = await readFile(path.join(directory, 'index.html'), 'utf8');
    assert.ok(html.includes('data-width="1280"'));
    assert.ok(html.includes("window.__timelines['motion-mania']"));
    assert.ok(!html.includes('__WIDTH__'));
    assert.ok((await readFile(path.join(directory, 'assets/fonts/LiberationSans-Bold.ttf'))).length);
    throw new Error('simulated operation failure');
  }), /simulated/);
  await assert.rejects(readFile(path.join(build, 'index.html')), /ENOENT/);
  assert.ok((await readFile(path.join(target, 'src/index.html'), 'utf8')).includes('__WIDTH__'));
});

test('asset symlinks cannot silently introduce nonportable dependencies', async t => {
  const root = await temporary(t), target = path.join(root, 'video');
  await initProject(target);
  await writeFile(path.join(root, 'external.txt'), 'outside');
  await symlink(path.join(root, 'external.txt'), path.join(target, 'assets/external.txt'));
  await assert.rejects(withBuild(await loadProject(target), 'vertical', () => {}), /symlinks/);
});

test('review samples cover a long film and boundary strips stay in range', () => {
  const times = reviewTimes(90, 30, [0, 89.99]);
  assert.equal(times.overview.length, 24);
  assert.equal(times.overview[0], 0);
  assert.ok(times.overview.at(-1) > 89.9);
  assert.ok(times.all.every(t => t >= 0 && t < 90));
  assert.ok(times.strips.every(s => s.length === 9));
  for (const invalid of ['', '1,', '-1', 'NaN', '15', 'Infinity']) assert.throws(() => parseTimes(invalid, 15));
});

test('rejects invalid manifests and misleading output metadata', async () => {
  const m = JSON.parse(await readFile(new URL('../templates/starter/motion.json', import.meta.url)));
  for (const bad of [{ ...m, fps: 0 }, { ...m, duration: -2 }, { ...m, formats: { '../outside': { width: 720, height: 1280 } } }, { ...m, formats: { test: { width: 721, height: 1280 } } }]) assert.throws(() => validateManifest(bad));
  const metadata = { streams: [{ codec_type: 'video', width: 720, height: 1280, duration: '15', avg_frame_rate: '30/1' }, { codec_type: 'audio' }] };
  assert.equal(validateMedia(metadata, m, 'vertical').audio, true);
  assert.throws(() => validateMedia({ streams: metadata.streams.slice(0,1) }, m, 'vertical'), /audio/);
  assert.throws(() => validateMedia(metadata, m, 'landscape'), /dimensions/);
});

test('subprocess arguments remain literal rather than executing shell syntax', async t => {
  const root = await temporary(t), marker = path.join(root, 'should-not-exist');
  const arg = `$(touch ${marker})`;
  const r = await run(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', arg], { quiet: true });
  assert.equal(r.stdout, arg);
  await assert.rejects(readFile(marker), /ENOENT/);
});

test('CLI rejects unknown or misplaced options with parseable error JSON', async t => {
  const cwd = await temporary(t);
  const cli = path.resolve('src/cli.js');
  for (const args of [['nonsense'], ['init'], ['doctor','--quality','draft'], ['frame','--unexpected']]) {
    const r = await run(process.execPath, [cli, ...args, '--json'], { cwd, quiet: true, allowFailure: true });
    assert.equal(r.code, 1);
    assert.equal(JSON.parse(r.stdout).ok, false);
  }
});

test('skill installation copies references and refuses to overwrite edits', async t => {
  const { installSkill } = await import('../src/project.js');
  const root = await temporary(t), target = path.join(root, 'custom skill');
  await installSkill(target);
  assert.ok((await readFile(path.join(target, 'references/storyboard.md'), 'utf8')).length > 100);
  await writeFile(path.join(target, 'SKILL.md'), 'consumer changes');
  await assert.rejects(installSkill(target), /nonempty/);
  assert.equal(await readFile(path.join(target, 'SKILL.md'), 'utf8'), 'consumer changes');
});
