import { link, lstat, mkdir, open, readFile, realpath, rm } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import path from 'node:path';
import { recordAssets } from './asset-records.js';
import { attributionText, classifyLicense, commercialLicenses, licenseAllowed } from './media-licenses.js';
import { resolveKey } from './credentials.js';

export const mediaUserAgent = 'motion-mania/0.4.0 (https://github.com/shiftynick/motion-mania)';
const openverse = 'https://api.openverse.org/v1/', pexels = 'https://api.pexels.com/v1/videos/';
const maxBytes = 250 * 1024 * 1024;
const keyError = 'Video requires a Pexels API key. Run motion-mania keys set pexels with a free API key from https://www.pexels.com/api/; alternatively set PEXELS_API_KEY in your environment.';
const types = ['audio', 'image', 'video'];
const finite = value => Number.isFinite(value) && value > 0 ? value : null;
const filter = allowRestricted => ({ commercialUse: !allowRestricted, modification: !allowRestricted, allowRestricted: Boolean(allowRestricted), licenses: allowRestricted ? 'all indexed licences (including NC/ND)' : [...commercialLicenses], note: allowRestricted ? 'Personal-project opt-out: NC still prohibits commercial use; ND still prohibits sharing derivatives, including synchronized film audio.' : 'Commercial use and modification allowed; BY attribution and BY-SA obligations still apply.' });

async function apiHeaders(provider, apiKey) {
  if (provider === 'pexels' && apiKey === undefined) apiKey = (await resolveKey(provider)).key;
  if (provider === 'pexels' && !apiKey?.trim()) throw new Error(keyError);
  return { 'User-Agent': mediaUserAgent, Accept: 'application/json', ...(provider === 'pexels' ? { Authorization: apiKey } : {}) };
}

function httpError(response, provider) {
  const value = response.headers.get('retry-after'), retry = /^\d{1,8}$/.test(value ?? '') ? value : null;
  if (response.status === 429) return new Error(`${provider} rate limit reached (HTTP 429). ${retry ? `Retry after ${retry}.` : 'Wait before retrying; check your provider quota.'}`);
  if (provider === 'pexels' && [401, 403].includes(response.status)) return new Error(`pexels rejected the API key or denied access (HTTP ${response.status}); invalid key or provider restrictions. Run motion-mania keys set pexels to replace it; check PEXELS_API_KEY if set.`);
  return new Error(`${provider} request failed (HTTP ${response.status})${response.status === 401 || response.status === 403 ? '; check access, credentials, or provider restrictions' : ''}.`);
}

async function apiJson(url, provider, options) {
  const headers = await apiHeaders(provider, options.apiKey);
  let response;
  try { response = await options.fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(30_000) }); }
  catch { throw new Error(`${provider} network request failed or timed out; retry later.`); }
  if (!response.ok) throw httpError(response, provider);
  try { return await response.json(); }
  catch { throw new Error(`${provider} returned invalid JSON.`); }
}

export function parseOpenverse(item, type) {
  const license = item.license === 'cc0' ? 'CC0' : item.license === 'pdm' ? 'PDM' : `CC ${String(item.license ?? '').toUpperCase()}`;
  const previewOnly = type === 'audio' && (item.provider === 'freesound' || item.source === 'freesound');
  let fileType = item.filetype === 'mp32' ? 'mp3' : item.filetype || null;
  if (!fileType && item.url) { try { fileType = path.extname(new URL(item.url).pathname).slice(1).toLowerCase() || null; } catch {} }
  return { id: `openverse:${type}:${item.id}`, type, title: item.title || 'Untitled', creator: item.creator || null, creatorUrl: item.creator_url || null, source: item.source || null, provider: 'openverse', sourceProvider: item.provider || null, license, licenseVersion: item.license_version || null, licenseUrl: item.license_url || null, sourceUrl: item.foreign_landing_url || null, fileUrl: item.url || null, fileType, duration: type === 'audio' && finite(item.duration) ? item.duration / 1000 : null, width: finite(item.width), height: finite(item.height), previewUrl: type === 'audio' ? item.url || null : item.thumbnail || item.url || null, previewOnly, category: item.category || null, licensePolicy: classifyLicense(license), warnings: [...(previewOnly ? ['Freesound via Openverse supplies an MP3 preview, not the original file.'] : []), ...(!item.creator ? ['Creator metadata is missing; verify the source before use.'] : [])] };
}

export function parsePexels(item) {
  const files = (item.video_files ?? []).filter(file => file.file_type === 'video/mp4' && file.link && finite(file.width) && finite(file.height));
  files.sort((a, b) => b.width * b.height - a.width * a.height || a.id - b.id);
  const selected = files.find(file => file.width <= 1920 && file.height <= 1920) ?? files.at(-1);
  let title;
  try { title = new URL(item.url).pathname.split('/').filter(Boolean).at(-1).replace(/-?\d+$/, '').replaceAll('-', ' ').trim(); } catch {}
  return { id: `pexels:video:${item.id}`, type: 'video', title: title || `Pexels video ${item.id}`, creator: item.user?.name || null, creatorUrl: item.user?.url || null, source: 'pexels', provider: 'pexels', sourceProvider: 'pexels', license: 'Pexels', licenseVersion: null, licenseUrl: 'https://www.pexels.com/license/', sourceUrl: item.url || null, fileUrl: selected?.link || null, fileType: selected ? 'mp4' : null, duration: finite(item.duration), width: selected?.width ?? null, height: selected?.height ?? null, previewUrl: item.image || null, previewOnly: false, category: null, licensePolicy: classifyLicense('Pexels'), warnings: ['Videos provided by Pexels (https://www.pexels.com). Attribution appreciated but not required; Pexels licence restrictions still apply.'] };
}

export async function searchMedia(query, { type, category, limit = 10, allowRestricted = false, fetch: fetcher = globalThis.fetch, apiKey } = {}) {
  if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new Error('media search requires a query of 1–200 characters');
  if (!types.includes(type)) throw new Error('media search requires --type audio|image|video');
  if (category !== undefined && (type !== 'audio' || !['music', 'sfx'].includes(category))) throw new Error('--category music|sfx is supported only for audio');
  limit = Number(limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('--limit must be an integer from 1 to 20 (default 10; Openverse anonymous page limit)');
  const provider = type === 'video' ? 'pexels' : 'openverse', url = new URL(type === 'video' ? `${pexels}search` : `${openverse}${type === 'image' ? 'images' : 'audio'}/`);
  url.searchParams.set(type === 'video' ? 'query' : 'q', query);
  url.searchParams.set(type === 'video' ? 'per_page' : 'page_size', limit);
  if (type !== 'video') {
    url.searchParams.set('license', allowRestricted ? 'by,by-sa,cc0,pdm,by-nc,by-nc-sa,by-nd,by-nc-nd,nc-sampling+,sampling+' : commercialLicenses.join(','));
    if (category) url.searchParams.set('category', category === 'sfx' ? 'sound_effect' : 'music');
  }
  const options = { fetch: fetcher, apiKey }, warnings = [];
  const once = async q => {
    const u = new URL(url); u.searchParams.set(type === 'video' ? 'query' : 'q', q);
    let data = await apiJson(u, provider, options), categoryFilter = category ? u.searchParams.get('category') : null;
    if (category === 'sfx' && data.results?.length === 0) {
      u.searchParams.delete('category');
      u.searchParams.set('source', 'freesound');
      data = await apiJson(u, provider, options);
      categoryFilter = 'source=freesound (uncategorized sound-effect fallback)';
      if (!warnings.length) warnings.push('Openverse returned no sound_effect category matches; searched Freesound instead because many sound effects have no category.');
    }
    const items = type === 'video' ? data.videos : data.results;
    if (!Array.isArray(items)) throw new Error(`${provider} returned an invalid search response.`);
    return { items, categoryFilter };
  };
  let { items, categoryFilter } = await once(query), queryFallback = null;
  // Openverse requires every word to match; retry the longest words separately and rank items found by more of them first.
  const words = [...new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 2))].sort((a, b) => b.length - a.length).slice(0, 3);
  if (!items.length && type !== 'video' && words.length > 1) {
    const hits = new Map();
    for (const word of words) for (const [rank, item] of (await once(word)).items.entries()) {
      const hit = hits.get(item.id) ?? { item, count: 0, rank };
      hit.count++; hit.rank = Math.min(hit.rank, rank); hits.set(item.id, hit);
    }
    items = [...hits.values()].sort((a, b) => b.count - a.count || a.rank - b.rank).map(hit => hit.item);
    queryFallback = words;
    warnings.push(`No result matched every word of "${query}"; showing results for ${words.map(w => `"${w}"`).join(', ')} separately, those matching more words first.`);
  }
  const candidates = items.map(item => type === 'video' ? parsePexels(item) : parseOpenverse(item, type)).filter(item => licenseAllowed(item.license, allowRestricted)).slice(0, limit);
  return { ok: true, command: 'media search', query, type, category: category ?? null, limit, provider, filter: { ...filter(allowRestricted), ...(type === 'video' ? { licenses: ['Pexels'] } : {}), category: categoryFilter, ...(queryFallback ? { queryFallback } : {}) }, candidates, warnings };
}

export function mediaIdentifier(id, type) {
  if (type !== undefined && !types.includes(type)) throw new Error('--type must be audio|image|video');
  const match = /^(openverse):(audio|image):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$|^(pexels):(video):(\d+)$/.exec(id ?? '');
  if (match) {
    const result = match[1] ? { provider: match[1], type: match[2], id: match[3] } : { provider: match[4], type: match[5], id: match[6] };
    if (type && result.type !== type) throw new Error('--type conflicts with the media id');
    return result;
  }
  if (type && (type === 'video' ? /^\d+$/.test(id) : /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))) return { provider: type === 'video' ? 'pexels' : 'openverse', type, id };
  throw new Error('Use an id returned by media search (openverse:audio:<uuid>, openverse:image:<uuid>, pexels:video:<number>), or a raw provider id with --type');
}

export function mediaAssetEntry(candidate, relative, sha256, retrievedAt = new Date().toISOString()) {
  const entry = { path: relative, origin: `${candidate.provider} media search (${candidate.sourceProvider ?? candidate.source})`, mediaId: candidate.id, type: candidate.type, title: candidate.title, sourceUrl: candidate.sourceUrl, creator: candidate.creator, creatorUrl: candidate.creatorUrl, license: candidate.license, licenseVersion: candidate.licenseVersion, licenseUrl: candidate.licenseUrl, provider: candidate.provider, source: candidate.source, sourceProvider: candidate.sourceProvider, retrievedAt, sha256, fileUrl: candidate.fileUrl, fileType: candidate.fileType, duration: candidate.duration, width: candidate.width, height: candidate.height, previewOnly: candidate.previewOnly, modifications: 'None at import; describe subsequent edits in the final credit.' };
  return { ...entry, attribution: attributionText(entry) };
}

function publicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224);
  }
  return isIP(address) === 6 && /^2[0-9a-f]{3}:/i.test(address) && !/^2001:(db8|0):/i.test(address);
}

export async function checkedMediaUrl(value, initial, candidate, resolver = lookup) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Provider returned an invalid media URL'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) throw new Error('Media URLs must use HTTP(S), standard ports, and no credentials');
  if (initial) {
    const first = new URL(initial), family = candidate.provider === 'pexels' ? ['pexels.com', 'vimeocdn.com', 'player.vimeo.com', 'vod-progressive.akamaized.net'] : candidate.source === 'jamendo' ? ['jamendo.com', 'jamendo.net'] : candidate.source === 'freesound' ? ['freesound.org'] : [];
    const trusted = family.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
    if ((url.hostname !== first.hostname && !trusted) || (first.protocol === 'https:' && url.protocol !== 'https:')) throw new Error(`Refusing media redirect to unexpected host or protocol: ${url.hostname}`);
  }
  let addresses;
  try { addresses = await resolver(url.hostname.replace(/^\[|\]$/g, ''), { all: true }); } catch { throw new Error(`Cannot resolve media host ${url.hostname}`); }
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error(`Refusing non-public media host: ${url.hostname}`);
  return url;
}

async function download(candidate, temp, options) {
  let url = await checkedMediaUrl(candidate.fileUrl, null, candidate, options.lookup), response;
  const initial = url.href, signal = AbortSignal.timeout(120_000);
  for (let redirects = 0; redirects <= 5; redirects++) {
    try { response = await options.fetch(url, { headers: { 'User-Agent': mediaUserAgent }, redirect: 'manual', signal }); }
    catch { throw new Error('Media download failed or timed out; retry later.'); }
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    await response.body?.cancel();
    const location = response.headers.get('location');
    if (!location || redirects === 5) throw new Error('Media download has invalid or too many redirects');
    url = await checkedMediaUrl(new URL(location, url).href, initial, candidate, options.lookup);
  }
  if (!response.ok) throw httpError(response, candidate.source ?? candidate.provider);
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (contentType && !contentType.startsWith(`${candidate.type}/`) && !['application/octet-stream', 'binary/octet-stream', 'application/ogg'].includes(contentType)) throw new Error(`Provider returned ${contentType} instead of ${candidate.type} media`);
  if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Media download exceeds the 250 MiB limit');
  const hash = createHash('sha256'), file = await open(temp, 'wx');
  let bytes = 0;
  try {
    if (!response.body) throw new Error('Provider returned an empty media download');
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > maxBytes) throw new Error('Media download exceeds the 250 MiB limit');
      hash.update(chunk);
      await file.writeFile(chunk);
    }
    if (!bytes) throw new Error('Provider returned an empty media download');
    await file.sync();
  } catch (error) {
    if (signal.aborted || !(error instanceof Error)) throw new Error('Media download failed or timed out; retry later.');
    throw new Error(`Media download failed: ${error.message}`);
  } finally { await file.close(); }
  return { sha256: hash.digest('hex'), bytes };
}

async function localDirectory(root, relative) {
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    await mkdir(current).catch(error => { if (error.code !== 'EEXIST') throw error; });
    if ((await lstat(current)).isSymbolicLink() || !(await lstat(current)).isDirectory()) throw new Error(`Media output must use local directories, not symlinks: ${current}`);
  }
  return current;
}

export async function fetchMedia(project, id, { type, name, allowRestricted = false, fetch: fetcher = globalThis.fetch, apiKey, lookup: resolver = lookup } = {}) {
  const identity = mediaIdentifier(id, type), options = { fetch: fetcher, apiKey, lookup: resolver };
  const data = await apiJson(identity.provider === 'pexels' ? `${pexels}videos/${identity.id}` : `${openverse}${identity.type === 'image' ? 'images' : 'audio'}/${identity.id}/`, identity.provider, options);
  const candidate = identity.provider === 'pexels' ? parsePexels(data) : parseOpenverse(data, identity.type);
  if (String(data.id) !== identity.id) throw new Error('Provider detail response did not match the requested media id');
  if (!licenseAllowed(candidate.license, allowRestricted)) throw new Error(`${candidate.license} is not allowed for commercial, modified film use. NC/ND requires an explicit --allow-restricted opt-out; unknown licences are never imported.`);
  if (!candidate.fileUrl || !candidate.sourceUrl || !candidate.licenseUrl || (identity.provider === 'openverse' && !candidate.licenseVersion)) throw new Error('Provider detail is missing file, source, or licence metadata; cannot record provenance safely');
  const extension = candidate.fileType?.toLowerCase().replace(/^.*\//, '') || path.extname(new URL(candidate.fileUrl).pathname).slice(1).toLowerCase();
  if (!/^[a-z0-9]{2,5}$/.test(extension)) throw new Error('Provider has no usable file type');
  candidate.fileType = extension;
  const filename = name ?? `${identity.provider}-${identity.type}-${identity.id}.${extension}`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,179}$/.test(filename)) throw new Error('--name must be a filename of 1–180 characters using letters, digits, dots, underscores or hyphens; no directories');
  const root = await realpath(project.root), directory = await localDirectory(root, 'assets/media'), output = path.join(directory, filename), relative = `media/${filename}`;
  const manifestPath = path.join(root, 'assets/manifest.json');
  if ((await lstat(manifestPath)).isSymbolicLink()) throw new Error('assets/manifest.json must not be a symlink');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.assets)) throw new Error('assets/manifest.json must contain an assets array');
  if (manifest.assets.some(entry => entry.path === relative)) throw new Error(`Refusing to replace existing provenance: assets/${relative}`);
  try { await lstat(output); throw new Error(`Refusing to overwrite existing file: ${output}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temp = path.join(directory, `.${randomUUID()}.tmp`);
  let published = false;
  process.stderr.write(`Downloading ${candidate.title} from ${candidate.source ?? candidate.provider} (${candidate.license}); recording provenance.\n`);
  try {
    const { sha256, bytes } = await download(candidate, temp, options), entry = mediaAssetEntry(candidate, relative, sha256);
    try { await link(temp, output); } catch (error) { if (error.code === 'EEXIST') throw new Error(`Refusing to overwrite existing file: ${output}`); throw error; }
    published = true;
    await recordAssets({ root }, [entry]);
    return { ok: true, command: 'media fetch', project: root, output, bytes, asset: entry, filter: { ...filter(allowRestricted), ...(identity.provider === 'pexels' ? { licenses: ['Pexels'] } : {}) }, warnings: candidate.warnings };
  } catch (error) { if (published) await rm(output, { force: true }); throw error; }
  finally { await rm(temp, { force: true }); }
}

const meaningfulLicense = value => typeof value === 'string' && value.trim().length > 0;

export async function mediaCredits(project, { all = false } = {}) {
  const manifest = JSON.parse(await readFile(path.join(project.root, 'assets/manifest.json'), 'utf8'));
  if (!Array.isArray(manifest.assets)) throw new Error('assets/manifest.json must contain an assets array');
  const assets = manifest.assets.filter(asset => all ? meaningfulLicense(asset.mediaId) : classifyLicense(asset.license).attributionRequired).map(asset => ({ path: asset.path, license: asset.license, required: classifyLicense(asset.license).attributionRequired, attribution: asset.attribution || attributionText(asset), missingAttribution: !asset.attribution }));
  return { ok: true, command: 'media credits', project: project.root, assets, text: assets.map(asset => asset.attribution).join('\n\n'), note: (all ? 'Includes every asset imported with media fetch, whether used or not; required marks licences that oblige credit.' : 'Includes every recorded BY asset, whether used or not; add --all to include credit-optional assets.') + ' Place credits in the film or description; add actual modifications and honour ShareAlike where applicable.' };
}
