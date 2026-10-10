import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { applyWaivers, authoredSources, jsTokens, lineAt, scriptRegions } from './source.js';

const normalize = text => String(text).toLowerCase().replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, m => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[m]).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const strings = value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(strings) : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];

export function visibleText(html, offset = 0) {
  const stack = [], found = [], blocks = /^(p|h[1-6]|li|button|label|figcaption|td|th)$/i;
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<[^>]*>|[^<]+/g)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[0].startsWith('<')) {
      const tag = m[0].match(/^<\/?([\w-]+)/)?.[1]?.toLowerCase();
      if (!tag) continue;
      if (m[0].startsWith('</')) {
        const index = stack.findLastIndex(s => s.tag === tag);
        if (index < 0) continue;
        for (const s of stack.splice(index).reverse()) {
          if (s.text.trim() && !s.skip && (blocks.test(s.tag) || !s.child)) found.push({ text: s.text.replace(/\s+/g, ' ').trim(), at: s.at });
          if (stack.length && !s.skip && !blocks.test(s.tag) && !/^(div|section|main|article|aside|header|footer)$/.test(s.tag)) stack.at(-1).text += ` ${s.text}`;
          if (stack.length && (blocks.test(s.tag) || s.child || /^(div|section|main|article|aside|header|footer)$/.test(s.tag))) stack.at(-1).child = true;
        }
      } else if (!/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag) && !m[0].endsWith('/>')) {
        const skip = stack.at(-1)?.skip || /^(head|script|style|template|pre|code)$/.test(tag) || /\bhidden(?:\s|>|=)/i.test(m[0]) || /aria-hidden\s*=\s*["']true/i.test(m[0]) || /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(m[0]);
        stack.push({ tag, skip, text: '', at: offset + m.index, child: false });
      } else if (tag === 'br' && stack.length) stack.at(-1).text += ' ';
    } else if (stack.length) stack.at(-1).text += ` ${m[0]}`;
  }
  // Prefer the containing line when inline spans contributed the same words.
  return found.filter((s, i) => !found.some((p, j) => j !== i && p.at < s.at && normalize(p.text).includes(normalize(s.text)) && p.text.length > s.text.length));
}

export function sourceText(source, file) {
  const found = file.endsWith('.html') ? visibleText(source) : [];
  for (const region of scriptRegions(source, file)) {
    const tokens = jsTokens(region.source, region.offset);
    for (let i = 0; i < tokens.length - 2; i++) {
      if (!['textContent', 'innerText', 'innerHTML'].includes(tokens[i].value) || tokens[i + 1].value !== '=' || !tokens[i + 2].quoted || tokens[i + 2].value.includes('${')) continue;
      const token = tokens[i + 2];
      found.push(...(tokens[i].value === 'innerHTML' ? visibleText(`<div>${token.value}</div>`, token.at - 5) : [{ text: token.value, at: tokens[i].at }]));
    }
  }
  return found.map(s => ({ text: s.text, line: lineAt(source, s.at) }));
}

export function copyFindings(source, file, context) {
  const known = context.map(normalize).filter(Boolean), findings = [], seen = new Set();
  for (const { text, line } of sourceText(source, file)) {
    const value = normalize(text), words = value.split(' ');
    if (!value || seen.has(value)) continue; seen.add(value);
    const category = /\bv\d+\.\d+(?:\.\d+)?\b|\b(?:BETA|ALPHA|PREVIEW)\b/.test(text) ? 'version'
      : /\b\d{2}:\d{2}(?::\d{2})?(?:[.:]\d{2})?\b/.test(text) ? 'timecode'
      : /\b\d+(?:\.\d+)?\s*(?:%|(?:ms|fps|users|requests|downloads)\b)/.test(text) ? 'metric'
      : /\b\d{2}\s*(?:\/|·|\|)\s*(?:\d{2}|\w)|^0\d(?:\s|$)|\b(?:shot|scene)\s*\d{1,2}\b/i.test(text) ? 'numbering' : 'secondary';
    const inContext = known.some(k => ` ${k} `.includes(` ${value} `));
    if (category !== 'secondary' || (!inContext && (words.length >= 2 || value.length >= 10))) findings.push({ file, line, rule: 'copy_provenance', code: 'copy_provenance', severity: 'warning', category, text, message: category !== 'secondary' ? `On-screen ${category} "${text}": intended and sourced?` : 'Other unlisted on-screen text; confirm illustrative copy during review.' });
  }
  const report = applyWaivers(findings, [{ file, source }]);
  return { ...report, findings: groupCopyFindings(report.findings) };
}

export function groupCopyFindings(findings) {
  const groups = new Map();
  for (const f of findings) {
    const group = groups.get(f.category) ?? { ...f, occurrences: 0, examples: [], files: [] };
    group.occurrences += f.occurrences ?? 1;
    for (const text of f.examples ?? [f.text]) if (group.examples.length < 3 && !group.examples.includes(text)) group.examples.push(text);
    for (const file of f.files ?? [f.file]) if (!group.files.includes(file)) group.files.push(file);
    groups.set(f.category, group);
  }
  return [...groups.values()].map(f => ({ ...f, message: f.category === 'secondary' ? `${f.occurrences} other unlisted text line(s); confirm illustrative copy during review (e.g. ${f.examples.map(t => `"${t}"`).join(', ')}).` : `${f.occurrences} on-screen ${f.category} label(s): intended and sourced? Examples: ${f.examples.map(t => `"${t}"`).join(', ')}.` }));
}

export async function copyProvenance(project, board, captions) {
  const context = board.shots.flatMap(s => [...strings(s.copy), ...strings(s.narration)]);
  if (captions) context.push(captions.groups.flatMap(g => g.words.map(w => w.text)).join(' '));
  for (const file of ['brief.md', 'brand.json']) {
    try { const source = await readFile(path.join(project.root, file), 'utf8'); context.push(...(file.endsWith('.json') ? strings(JSON.parse(source)) : [source])); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const sources = await authoredSources(project), reports = sources.filter(s => !s.file.endsWith('.css')).map(s => copyFindings(s.source, s.file, context));
  return { findings: groupCopyFindings(reports.flatMap(r => r.findings)), waived: reports.flatMap(r => r.waived), note: 'Version stamps, numbering, timecodes and metrics get grouped sourcing questions; other unlisted text gets one aggregate reminder. Visible HTML lines and literal JS text assignments only. Animation visibility, interpolated strings, images and computed labels require review. A question does not establish that copy is invented.' };
}
