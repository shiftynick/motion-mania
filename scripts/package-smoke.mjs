// Exercise what npm consumers receive, not the working checkout.
import { mkdtemp, readFile, rm, mkdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { run } from '../src/process.js';
const root = path.resolve(import.meta.dirname, '..');
const sandbox = await mkdtemp(path.join(tmpdir(), 'motion-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
try {
  const packed = JSON.parse((await run(npm, ['pack', '--json', '--pack-destination', sandbox], { cwd: root, quiet: true })).stdout)[0];
  const files = packed.files.map(f => f.path);
  for (const needed of ['LICENSE','THIRD_PARTY_NOTICES.md','src/cli.js','templates/starter/gitignore','templates/starter/assets/fonts/OFL.txt','skills/motion-mania/references/creative-direction.md']) assert.ok(files.includes(needed), `Missing ${needed}`);
  assert.ok(!files.some(f => /(^|\/)(\.env[^/]*|\.npmrc|out|reviews|node_modules|examples)(\/|$)/.test(f)), 'Unexpected private or generated files in tarball');
  const consumer = path.join(sandbox, 'consumer');
  await mkdir(consumer);
  await run(npm, ['install', '--prefix', consumer, '--no-audit', '--no-fund', path.join(sandbox, packed.filename)], { quiet: true });
  const cli = path.join(consumer, 'node_modules/motion-mania/src/cli.js');
  const invoke = async args => JSON.parse((await run(process.execPath, [cli, ...args, '--json'], { cwd: consumer, quiet: true })).stdout);
  const version = JSON.parse(await readFile(path.join(root, 'package.json'))).version;
  assert.equal((await invoke(['--version'])).version, version);
  const npx = await run(npm, ['exec', '--offline', '--', 'motion-mania', '--version'], { cwd: consumer, quiet: true });
  assert.equal(npx.stdout.trim(), version);
  assert.equal((await invoke(['init', 'film'])).ok, true);
  assert.equal((await invoke(['skill', 'agent-skill'])).ok, true);
  await access(path.join(consumer, 'agent-skill/references/storyboard.md'));
  assert.equal((await invoke(['plan', '--project', 'film'])).ok, true);
  const frame = await invoke(['frame', '--project', 'film', '--at', '4']);
  await access(frame.results[0].frames[0].path);
  console.log(JSON.stringify({ ok: true, version, packageBytes: packed.size, files: files.length, checks: ['tarball contents','isolated install','npm exec / npx','init','skill','plan','browser capture'] }, null, 2));
} finally { await rm(sandbox, { recursive: true, force: true }); }
