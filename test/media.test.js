import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { provenanceWarnings } from '../src/project.js';
import { attributionText, classifyLicense, licenseAllowed } from '../src/media-licenses.js';
import { checkedMediaUrl, fetchMedia, mediaAssetEntry, mediaCredits, mediaIdentifier, mediaUserAgent, parseOpenverse, parsePexels, searchMedia } from '../src/media.js';

const fixture = async name => JSON.parse(await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const sfx = await fixture('openverse-sfx'), music = await fixture('openverse-music'), video = await fixture('pexels-video');
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const publicLookup = async () => [{ address: '8.8.8.8', family: 4 }];
async function project(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-media-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'assets/manifest.json'), JSON.stringify({ note: 'preserved', assets: [] }));
  return { root };
}

test('licences allow commercial derivatives by default and fail closed for unknown terms', () => {
  for (const value of ['by', 'by-sa', 'cc0', 'pdm', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC0 1.0', 'Pexels']) assert.equal(licenseAllowed(value), true, value);
  for (const value of ['by-nc', 'by-nd', 'by-nc-sa', 'by-nc-nd', 'nc-sampling+', 'sampling+']) {
    assert.equal(licenseAllowed(value), false, value);
    assert.equal(licenseAllowed(value, true), true, value);
  }
  for (const value of ['', null, 'unknown', 'all rights reserved']) assert.equal(licenseAllowed(value, true), false, value);
  const policy = classifyLicense('Creative Commons Attribution-NonCommercial-NoDerivatives 4.0');
  assert.equal(policy.nonCommercial, true);
  assert.equal(policy.noDerivatives, true);
  assert.equal(policy.attributionRequired, true);
  assert.equal(classifyLicense('https://creativecommons.org/licenses/by-sa/4.0/').shareAlike, true);
});

test('Openverse parsing preserves licence metadata, normalizes duration and labels previews', () => {
  const item = parseOpenverse(sfx, 'audio');
  assert.equal(item.duration, 3.155);
  assert.equal(item.previewOnly, true);
  assert.equal(item.fileType, 'mp3');
  assert.equal(item.license, 'CC0');
  assert.equal(item.licenseVersion, '1.0');
  assert.equal(item.sourceUrl, sfx.foreign_landing_url);
  assert.match(item.warnings.join(' '), /MP3 preview/);
  assert.equal(parseOpenverse(music, 'audio').fileType, 'mp3');
  const incomplete = parseOpenverse({ id: sfx.id }, 'image');
  assert.equal(incomplete.width, null);
  assert.equal(incomplete.licensePolicy.filmSafe, false);
  assert.match(incomplete.warnings.join(' '), /Creator metadata is missing/);
});

test('search sends an explicit licence allowlist and locally rejects restricted results', async () => {
  const result = await searchMedia('ambient', { type: 'audio', category: 'music', limit: 3, fetch: async (url, options) => {
    assert.equal(url.searchParams.get('license'), 'by,by-sa,cc0,pdm');
    assert.equal(url.searchParams.get('category'), 'music');
    assert.equal(url.searchParams.get('page_size'), '3');
    assert.equal(options.headers['User-Agent'], mediaUserAgent);
    return json({ results: [music, { ...music, license: 'by-nc' }, { ...music, license: 'by-nd' }] });
  } });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.filter.commercialUse, true);
  assert.equal(result.filter.modification, true);
  const personal = await searchMedia('ambient', { type: 'audio', allowRestricted: true, fetch: async () => json({ results: [{ ...music, license: 'by-nc' }] }) });
  assert.equal(personal.candidates.length, 1);
  assert.equal(personal.filter.allowRestricted, true);
  assert.match(personal.filter.note, /ND still prohibits/);
});

test('sound effects report a Freesound fallback only when the category search is empty', async () => {
  let calls = 0;
  const result = await searchMedia('whoosh', { type: 'audio', category: 'sfx', fetch: async url => {
    calls++;
    if (calls === 1) { assert.equal(url.searchParams.get('category'), 'sound_effect'); return json({ results: [] }); }
    assert.equal(url.searchParams.get('category'), null);
    assert.equal(url.searchParams.get('source'), 'freesound');
    assert.equal(url.searchParams.get('license'), 'by,by-sa,cc0,pdm');
    return json({ results: [sfx] });
  } });
  assert.equal(calls, 2);
  assert.equal(result.candidates.length, 1);
  assert.match(result.filter.category, /fallback/);
  assert.equal(result.warnings.length, 1);
});

test('Pexels documentation fixture parses an MP4 variant and its own licence', () => {
  const item = parsePexels(video);
  assert.equal(item.id, 'pexels:video:2499611');
  assert.equal(item.duration, 22);
  assert.equal(item.width, 1080);
  assert.equal(item.height, 1920);
  assert.equal(item.fileUrl, video.video_files[0].link);
  assert.equal(item.previewUrl, video.image);
  assert.equal(item.license, 'Pexels');
  assert.equal(item.licenseVersion, null);
  assert.equal(item.licenseUrl, 'https://www.pexels.com/license/');
  assert.match(item.warnings.join(' '), /Attribution appreciated but not required/);
  assert.equal(parsePexels({ ...video, video_files: [] }).fileUrl, null);
});

test('Pexels search and detail use documented endpoints; credentials stay out of files and results', async t => {
  const p = await project(t), requests = [], apiKey = 'test-private-key';
  const fetch = async (url, options) => {
    requests.push(String(url));
    if (String(url).startsWith('https://api.pexels.com/')) {
      assert.equal(options.headers.Authorization, apiKey);
      return json(String(url).includes('/search?') ? { videos: [video] } : video);
    }
    assert.equal(options.headers.Authorization, undefined);
    return new Response('fake mp4 bytes', { headers: { 'Content-Type': 'video/mp4' } });
  };
  const result = await searchMedia('nature', { type: 'video', fetch, apiKey });
  assert.match(requests[0], /^https:\/\/api.pexels.com\/v1\/videos\/search\?/);
  const imported = await fetchMedia(p, result.candidates[0].id, { fetch, apiKey, lookup: publicLookup });
  assert.equal(requests[1], 'https://api.pexels.com/v1/videos/videos/2499611');
  assert.deepEqual(imported.filter.licenses, ['Pexels']);
  assert.equal(JSON.stringify(imported).includes(apiKey), false);
  assert.equal((await readFile(path.join(p.root, 'assets/manifest.json'), 'utf8')).includes(apiKey), false);
});

test('missing Pexels key fails before networking, also as a structured CLI error', async t => {
  const fetch = async () => { throw new Error('must not call network'); };
  await assert.rejects(searchMedia('nature', { type: 'video', apiKey: '', fetch }), /free API key.*PEXELS_API_KEY/);
  await assert.rejects(fetchMedia({ root: '/unused' }, 'pexels:video:2499611', { apiKey: '', fetch }), /PEXELS_API_KEY/);
  const config = await mkdtemp(path.join(os.tmpdir(), 'motion-media-config-'));
  t.after(() => rm(config, { recursive: true, force: true }));
  const result = spawnSync(process.execPath, ['src/cli.js', 'media', 'search', 'nature', '--type', 'video', '--json'], { env: { ...process.env, XDG_CONFIG_HOME: config, PEXELS_API_KEY: '' }, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).ok, false);
  assert.match(JSON.parse(result.stdout).error, /motion-mania keys set pexels.*PEXELS_API_KEY/);
});

test('network, JSON, HTTP and rate-limit errors have actionable messages', async () => {
  await assert.rejects(searchMedia('whoosh', { type: 'audio', fetch: async () => { throw new TypeError('secret internals'); } }), /openverse network request failed/);
  await assert.rejects(searchMedia('whoosh', { type: 'audio', fetch: async () => new Response('broken') }), /invalid JSON/);
  await assert.rejects(searchMedia('whoosh', { type: 'audio', fetch: async () => new Response('', { status: 429, headers: { 'Retry-After': '60' } }) }), /HTTP 429.*Retry after 60/);
  await assert.rejects(searchMedia('whoosh', { type: 'audio', fetch: async () => new Response('', { status: 503 }) }), /HTTP 503/);
  await assert.rejects(searchMedia('whoosh', { type: 'audio', limit: 21 }), /1 to 20/);
  await assert.rejects(searchMedia('whoosh', { type: 'image', category: 'sfx' }), /only for audio/);
});

test('identifiers cannot select arbitrary endpoints or conflict with --type', () => {
  assert.equal(mediaIdentifier(`openverse:audio:${sfx.id}`).id, sfx.id);
  assert.equal(mediaIdentifier(sfx.id, 'image').type, 'image');
  assert.equal(mediaIdentifier('2499611', 'video').provider, 'pexels');
  for (const id of ['https://localhost', 'openverse:audio:../../secret', '2499611']) assert.throws(() => mediaIdentifier(id));
  assert.throws(() => mediaIdentifier(`openverse:audio:${sfx.id}`, 'image'), /conflicts/);
});

test('manifest entries and attribution retain creator, source, licence version, hash and retrieval date', () => {
  const entry = mediaAssetEntry(parseOpenverse(music, 'audio'), 'media/music.mp3', 'a'.repeat(64), '2026-10-17T00:00:00.000Z');
  assert.equal(entry.creatorUrl, music.creator_url);
  assert.equal(entry.sourceUrl, music.foreign_landing_url);
  assert.equal(entry.license, 'CC BY');
  assert.equal(entry.licenseVersion, '3.0');
  assert.equal(entry.licenseUrl, music.license_url);
  assert.equal(entry.provider, 'openverse');
  assert.equal(entry.sourceProvider, 'jamendo');
  assert.equal(entry.retrievedAt, '2026-10-17T00:00:00.000Z');
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  for (const value of [entry.title, entry.creator, entry.creatorUrl, entry.sourceUrl, 'CC BY 3.0', entry.licenseUrl]) assert.ok(entry.attribution.includes(value));
  assert.match(attributionText(parsePexels(video)), /Attribution appreciated but not required/);
});

test('fetch writes complete files and provenance, refuses overwrites, cleans staging', async t => {
  const p = await project(t), bytes = Buffer.from('test audio bytes');
  const fetch = async url => String(url).startsWith('https://api.openverse.org') ? json(music) : new Response(bytes, { headers: { 'Content-Type': 'audio/mpeg' } });
  const result = await fetchMedia(p, `openverse:audio:${music.id}`, { name: 'music.mp3', fetch, lookup: publicLookup });
  assert.deepEqual(await readFile(result.output), bytes);
  assert.equal(result.asset.sha256, createHash('sha256').update(bytes).digest('hex'));
  const manifest = JSON.parse(await readFile(path.join(p.root, 'assets/manifest.json')));
  assert.equal(manifest.note, 'preserved');
  assert.deepEqual(manifest.assets, [result.asset]);
  await assert.rejects(fetchMedia(p, result.asset.mediaId, { name: 'music.mp3', fetch, lookup: publicLookup }), /Refusing to replace existing provenance/);
  await writeFile(path.join(p.root, 'assets/media/existing.mp3'), 'keep');
  await assert.rejects(fetchMedia(p, result.asset.mediaId, { name: 'existing.mp3', fetch, lookup: publicLookup }), /overwrite/);
  assert.deepEqual(await readdir(path.join(p.root, 'assets/media')), ['existing.mp3', 'music.mp3']);
});

test('fetch rechecks licences and metadata, even without a prior search', async t => {
  const p = await project(t);
  const options = { fetch: async () => json({ ...music, license: 'by-nc' }), lookup: publicLookup };
  await assert.rejects(fetchMedia(p, music.id, { ...options, type: 'audio' }), /--allow-restricted/);
  await assert.rejects(fetchMedia(p, music.id, { type: 'audio', fetch: async () => json({ ...music, license_url: null }) }), /missing file, source, or licence/);
  await assert.rejects(fetchMedia(p, music.id, { type: 'audio', name: '../escape.mp3', fetch: async () => json(music) }), /no directories/);
  await assert.rejects(fetchMedia(p, music.id, { type: 'audio', fetch: async () => json({ ...music, id: sfx.id }) }), /did not match/);
});

test('fetch rejects traversal, symlinks, HTML downloads and leaves no partial files', async t => {
  const p = await project(t), outside = await mkdtemp(path.join(os.tmpdir(), 'motion-media-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const fetch = async url => String(url).startsWith('https://api.openverse.org') ? json(music) : new Response('<html>not audio</html>', { headers: { 'Content-Type': 'text/html' } });
  await symlink(outside, path.join(p.root, 'assets/media'));
  await assert.rejects(fetchMedia(p, music.id, { type: 'audio', fetch, lookup: publicLookup }), /not symlinks/);
  assert.deepEqual(await readdir(outside), []);
  await rm(path.join(p.root, 'assets/media'));
  await assert.rejects(fetchMedia(p, music.id, { type: 'audio', fetch, lookup: publicLookup }), /text\/html/);
  assert.deepEqual(await readdir(path.join(p.root, 'assets/media')), []);
  assert.deepEqual(JSON.parse(await readFile(path.join(p.root, 'assets/manifest.json'))).assets, []);
});

test('redirect refusal and interrupted streams leave no partial file or provenance', async t => {
  const p = await project(t), identity = `openverse:audio:${music.id}`;
  let downloads = 0;
  await assert.rejects(fetchMedia(p, identity, { lookup: publicLookup, fetch: async url => {
    if (String(url).startsWith('https://api.openverse.org')) return json(music);
    downloads++;
    return new Response(null, { status: 302, headers: { Location: 'https://unexpected.example/audio.mp3' } });
  } }), /unexpected host/);
  assert.equal(downloads, 1);
  await assert.rejects(fetchMedia(p, identity, { lookup: publicLookup, fetch: async url => {
    if (String(url).startsWith('https://api.openverse.org')) return json(music);
    let chunks = 0;
    return new Response(new ReadableStream({ pull(controller) {
      if (chunks++) controller.error(new Error('connection interrupted'));
      else controller.enqueue(Buffer.from('partial'));
    } }), { headers: { 'Content-Type': 'audio/mpeg' } });
  } }), /Media download failed: connection interrupted/);
  assert.deepEqual(await readdir(path.join(p.root, 'assets/media')), []);
  assert.deepEqual(JSON.parse(await readFile(path.join(p.root, 'assets/manifest.json'))).assets, []);
});

test('manifest update failure rolls back a published media file', async t => {
  const p = await project(t);
  await assert.rejects(fetchMedia(p, `openverse:audio:${music.id}`, { lookup: publicLookup, fetch: async url => {
    if (String(url).startsWith('https://api.openverse.org')) return json(music);
    await writeFile(path.join(p.root, 'assets/manifest.json'), '{"assets":false}');
    return new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } });
  } }), /must contain an assets array/);
  assert.deepEqual(await readdir(path.join(p.root, 'assets/media')), []);
});

test('download permits known CDN redirects and blocks unexpected hosts and private addresses', async () => {
  const candidate = parseOpenverse(music, 'audio');
  assert.equal((await checkedMediaUrl('https://prod-2.storage.jamendo.com/song.mp3', music.url, candidate, publicLookup)).hostname, 'prod-2.storage.jamendo.com');
  assert.equal((await checkedMediaUrl('https://vod-progressive.akamaized.net/song.mp4', video.video_files[0].link, parsePexels(video), publicLookup)).protocol, 'https:');
  await assert.rejects(checkedMediaUrl('https://evil.example.com/song.mp3', music.url, candidate, publicLookup), /unexpected host/);
  await assert.rejects(checkedMediaUrl('http://prod-1.storage.jamendo.com/song.mp3', music.url, candidate, publicLookup), /protocol/);
  for (const address of ['127.0.0.1', '10.1.1.1', '169.254.169.254', '192.168.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1']) await assert.rejects(checkedMediaUrl('https://example.com/a', null, candidate, async () => [{ address }]), /non-public/);
  await assert.rejects(checkedMediaUrl('https://user:secret@example.com/a', null, candidate, publicLookup), /no credentials/);
});

test('credits combine BY assets; plan warnings flag restrictions and required credits without failing', async t => {
  const p = await project(t);
  const assets = [
    mediaAssetEntry(parseOpenverse(music, 'audio'), 'music.mp3', 'a'.repeat(64)),
    { path: 'restricted.mp3', origin: 'Manual', license: 'CC BY-NC-ND 4.0', title: 'Restricted', creator: 'Person', sourceUrl: 'https://example.com' },
    { path: 'share.mp3', origin: 'Manual', license: 'by-sa', attribution: 'Share credit' },
    mediaAssetEntry(parseOpenverse(sfx, 'audio'), 'whoosh.mp3', 'b'.repeat(64)),
  ];
  for (const asset of assets) await writeFile(path.join(p.root, 'assets', asset.path), 'test');
  await writeFile(path.join(p.root, 'assets/manifest.json'), JSON.stringify({ assets }));
  const credits = await mediaCredits(p), warnings = await provenanceWarnings(p);
  assert.equal(credits.assets.length, 3);
  assert.ok(credits.text.includes(assets[0].attribution));
  assert.match(credits.text, /Share credit/);
  assert.equal(credits.assets[1].missingAttribution, true);
  const all = await mediaCredits(p, { all: true });
  assert.deepEqual(all.assets.map(a => [a.path, a.required]), [['music.mp3', true], ['whoosh.mp3', false]]);
  assert.ok(warnings.some(w => /restricted.mp3.*NonCommercial/.test(w)));
  assert.ok(warnings.some(w => /restricted.mp3.*NoDerivatives/.test(w)));
  assert.ok(warnings.some(w => /music.mp3.*include the recorded credit/.test(w)));
  assert.ok(warnings.some(w => /share.mp3.*ShareAlike/.test(w)));
  assert.ok(!warnings.some(w => /whoosh.mp3/.test(w)));
});

test('a multi-word search with no full match retries words separately, ranking items that match more words first', async () => {
  const queries = [];
  const result = await searchMedia('ambient ocean', { type: 'audio', category: 'music', fetch: async url => {
    const q = new URL(url).searchParams.get('q'); queries.push(q);
    const results = { ambient: [{ ...music, id: 'a' }, { ...music, id: 'both' }], ocean: [{ ...music, id: 'both' }, { ...music, id: 'o' }] }[q] ?? [];
    return json({ results });
  } });
  assert.deepEqual(queries, ['ambient ocean', 'ambient', 'ocean']);
  assert.deepEqual(result.candidates.map(c => c.id.split(':').pop()), ['both', 'a', 'o']);
  assert.deepEqual(result.filter.queryFallback, ['ambient', 'ocean']);
  assert.match(result.warnings.join(' '), /No result matched every word/);
});
