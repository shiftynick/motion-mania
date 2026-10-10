import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { hf } from './process.js';

export function safeAreaMargins(manifest, dimensions) {
  const config = manifest.safeArea ?? {}, side = Math.abs(dimensions.width / dimensions.height - 9 / 16) < 0.02 ? 0.06 : 0.04;
  if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).some(k => !['top', 'bottom', 'left', 'right'].includes(k))) throw new Error('motion.json safeArea may contain only top, bottom, left, and right fractions');
  const margins = { top: 0.13, bottom: 0.19, left: side, right: side, ...config };
  if (Object.values(margins).some(v => !Number.isFinite(v) || v < 0 || v >= 0.5) || margins.top + margins.bottom >= 1 || margins.left + margins.right >= 1) throw new Error('safeArea margins must be fractions from 0 to less than 0.5');
  return margins;
}

export function safeAreaOverlay(width, height, margins) {
  const x = width * margins.left, y = height * margins.top, w = width * (1 - margins.left - margins.right), h = height * (1 - margins.top - margins.bottom);
  return Buffer.from(`<svg width="${width}" height="${height}"><path d="M0 0H${width}V${height}H0Z M${x} ${y}V${y + h}H${x + w}V${y}Z" fill="#ff5a2b" fill-opacity="0.13" fill-rule="evenodd"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ffd166" stroke-width="1.5" stroke-dasharray="6 4"/></svg>`);
}

export function safeAreaFindings(payload, edge, dimensions, margins) {
  return (payload.layout?.findings ?? []).filter(f => {
    if (f.code !== 'caption_zone_collision') return false;
    if (!dimensions) return true;
    const r = f.rect, { width, height } = dimensions;
    if (!r || ![r.left, r.top, r.width, r.height].every(Number.isFinite)) return false;
    // Backend gates on the element box, but also returns the tighter text Range box.
    // Recheck that box so centred text in a full-width wrapper is not flagged at the sides.
    return edge === 'top' ? r.top < margins.top * height - 2 && r.top + r.height > 2
      : edge === 'bottom' ? r.top + r.height > (1 - margins.bottom) * height + 2 && r.top < height - 2
      : edge === 'left' ? r.left < margins.left * width - 2 && r.left + r.width > 2
      : r.left + r.width > (1 - margins.right) * width + 2 && r.left < width - 2;
  }).map(f => ({ edge, at: f.time, selector: f.selector, text: f.text, bbox: f.bbox, rect: f.rect }));
}

export function groupSafeAreaFindings(findings) {
  const groups = new Map();
  for (const f of findings) {
    const group = groups.get(f.selector) ?? { selector: f.selector, text: f.text, edges: [], from: f.at, to: f.at, occurrences: 0 };
    if (!group.edges.includes(f.edge)) group.edges.push(f.edge);
    group.from = Math.min(group.from, f.at); group.to = Math.max(group.to, f.at); group.occurrences++;
    groups.set(f.selector, group);
  }
  return [...groups.values()];
}

export async function checkSafeArea(build, output, margins, times, duration, dimensions) {
  const zones = { top: [0, 0, 1, margins.top], bottom: [0, 1 - margins.bottom, 1, 1], left: [0, 0, margins.left, 1], right: [1 - margins.right, 0, 1, 1] };
  const findings = [], warnings = [], reports = [];
  const seek = times.map(t => Number((t / duration).toFixed(8))).join(',');
  for (const [edge, [x0, y0, x1, y1]] of Object.entries(zones)) {
    if (!margins[edge]) continue;
    const check = await hf(['check', build, '--json', '--no-contrast', '--no-browser-gpu', '--no-collapse-static', '--max-issues', '10000', '--at', times.join(','), '--caption-zone', `x0=${x0};y0=${y0};x1=${x1};y1=${y1};severity=warning;seek=${seek}`], { quiet: true, allowFailure: true });
    const file = path.join(output, `safe-area-${edge}.json`);
    await writeFile(file, check.stdout);
    await writeFile(path.join(output, `safe-area-${edge}.log`), check.stderr);
    reports.push(file);
    let payload;
    try { payload = JSON.parse(check.stdout); } catch { throw new Error(`Invalid safe-area check JSON; inspect ${file}`); }
    if (payload.browserSkipped || !payload.layout?.samples?.length || payload.runtime?.errorCount || payload.layout?.truncated) warnings.push(`Safe-area ${edge} inspection is incomplete; inspect ${file}.`);
    findings.push(...safeAreaFindings(payload, edge, dimensions, margins));
  }
  const grouped = groupSafeAreaFindings(findings);
  if (grouped.length) warnings.push(`${grouped.length} text element(s) cross the vertical safe-area guides (${findings.length} sampled collisions). Inspect the phone preview; entrances and deliberate edge typography may be intentional.`);
  return { margins, samples: times, findings: grouped, sampledFindingCount: findings.length, warnings, reports, scope: 'One finding per selector, with edges, time range and sampled collision count. Sampled DOM text Range boxes in reserved bands (2px tolerance), not a full-film guarantee or a platform specification. Background/media elements are excluded. data-layout-allow-caption-zone on a text element or wrapper waives intentional collisions.' };
}
