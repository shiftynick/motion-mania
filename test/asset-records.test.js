import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { recordAssets } from '../src/asset-records.js';

test('provenance additions preserve existing licenses and project metadata and avoid duplicate references', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-assets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets'));
  const file = path.join(root, 'assets/manifest.json');
  await writeFile(file, JSON.stringify({ note: 'approved assets', assets: [{ path: 'logo.svg', origin: 'Product team', license: 'authorized' }] }));
  await recordAssets({ root }, [{ path: 'logo.svg', origin: 'New origin' }, { path: 'capture/page.png', origin: 'Website', sourceUrl: 'https://example.com' }], [{ path: 'out/reference.mp4', usage: 'Reference only' }]);
  await recordAssets({ root }, [], [{ path: 'out/reference.mp4' }]);
  const result = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(result.note, 'approved assets');
  assert.equal(result.assets.length, 2);
  assert.equal(result.assets[0].origin, 'Product team');
  assert.equal(result.assets[0].license, 'authorized');
  assert.equal(result.references.length, 1);
  assert.deepEqual((await readdir(path.join(root, 'assets'))).filter(file => file.endsWith('.tmp')), []);
});
