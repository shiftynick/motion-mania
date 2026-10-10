import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { hf } from './process.js';
import { writeJson } from './project.js';
import { recordAssets } from './asset-records.js';

export const captureRights = "Captured assets belong to the site's owner and need authorization to use. Capture does not establish a license, brand approval, or permission to reuse.";

export function captureUrl(value) {
  if (!value) throw new Error('capture requires an explicit URL');
  let url;
  try { url = new URL(value); } catch { throw new Error('capture requires an absolute http:// or https:// URL'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('capture requires HTTP(S) without embedded credentials');
  return url.href;
}

export function summarizeCapture(report, tokens = {}, files = []) {
  const paletteCandidates = [...new Set([...(tokens.colors ?? []).filter(color => typeof color === 'string'), ...Object.values(tokens.cssVariables ?? {}).filter(value => typeof value === 'string' && /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(value.trim()))].map(color => /^#[0-9a-f]+$/i.test(color.trim()) ? color.trim().toUpperCase() : color.trim()))];
  const fontFamilies = [...new Set([...(tokens.fonts ?? []).map(font => typeof font === 'string' ? font : font.family), ...(report.fonts ?? [])].filter(family => typeof family === 'string' && family.trim()))];
  const screenshots = files.filter(file => file.startsWith('screenshots/') && /\.(png|jpe?g|webp)$/i.test(file));
  const imageCandidates = files.filter(file => file.startsWith('assets/') && /\.(svg|png|jpe?g|webp|gif|avif)$/i.test(file) && !/contact-sheet/.test(file));
  const logoCandidates = imageCandidates.filter(file => /logo|brand|mark|icon/i.test(file));
  return { paletteCandidates, fontFamilies, logoCandidates, imageCandidates, screenshots, fonts: files.filter(file => /\.(woff2?|ttf|otf)$/i.test(file)), dropped: report.dropped ?? {}, warnings: report.warnings ?? [], httpStatus: report.httpStatus ?? null, title: report.title ?? tokens.title ?? '', brandProposal: { name: report.title ?? tokens.title ?? '', palette: Object.fromEntries(paletteCandidates.slice(0, 8).map((color, i) => [`candidate${i + 1}`, color])), ...(fontFamilies.length ? { font: fontFamilies[0] } : {}), ...(logoCandidates.length ? { logo: logoCandidates[0] } : {}), provenance: `Captured from ${report.url ?? 'supplied URL'}; candidates require inspection and authorization` } };
}

async function filesIn(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}

export async function captureBrand(project, value) {
  const url = captureUrl(value), capturedAt = new Date().toISOString(), parent = path.join(project.root, 'assets/captures');
  await mkdir(parent, { recursive: true });
  const output = await mkdtemp(path.join(parent, 'site-'));
  process.stderr.write(`Capturing ${url}; network requests and third-party downloads are explicit. ${captureRights}\n`);
  const backend = await hf(['capture', url, '--output', output, '--skip-vision', '--max-screenshots', '8', '--timeout', '30000', '--capture-budget', '30000', '--json'], { allowFailure: true, timeout: 180_000 });
  let report;
  try { report = JSON.parse(backend.stdout.trim()); }
  catch { throw new Error(`Capture returned invalid JSON; partial files remain at ${output}: ${backend.stderr.slice(-1000)}`); }
  let tokens = {};
  try { tokens = JSON.parse(await readFile(path.join(output, 'extracted/tokens.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const files = await filesIn(output), summary = summarizeCapture(report, tokens, files), prefix = path.relative(path.join(project.root, 'assets'), output).split(path.sep).join('/');
  if (summary.brandProposal.logo) summary.brandProposal.logo = `assets/${prefix}/${summary.brandProposal.logo}`;
  summary.brandProposal.provenance = `Captured from ${url} on ${capturedAt}; candidates require inspection and authorization`;
  const proposal = path.join(output, 'brand-proposal.json'), summaryPath = path.join(output, 'summary.json'), backendReport = path.join(output, 'backend-report.json');
  const result = { ok: backend.code === 0 && report.ok === true, url, capturedAt, output, ...summary, rights: captureRights, proposal, report: summaryPath, backendReport, brandApplied: false, lastPhase: report.lastPhase ?? null, ...(report.error ? { error: report.error } : {}) };
  await writeJson(backendReport, report);
  await writeJson(proposal, summary.brandProposal);
  await writeJson(summaryPath, result);
  await recordAssets(project, [...files, 'brand-proposal.json', 'summary.json', 'backend-report.json'].map(file => ({ path: `${prefix}/${file}`, origin: `HyperFrames website capture of ${url}`, sourceUrl: url, capturedAt, usage: 'Brand research; authorization required before reuse', rights: 'authorization-required' })));
  return result;
}
