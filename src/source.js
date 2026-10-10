import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const lineAt = (source, offset) => source.slice(0, offset).split('\n').length;

export async function authoredSources(project, directory = 'src') {
  const files = [];
  for (const entry of await readdir(path.join(project.root, directory), { withFileTypes: true })) {
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await authoredSources(project, file));
    else if (entry.isFile() && /\.(js|html|css)$/.test(file)) files.push({ file, source: await readFile(path.join(project.root, file), 'utf8') });
  }
  return files;
}

// A lexical scan, not a JavaScript parser: preserve offsets and keep comments/strings inert.
export function jsTokens(source, offset = 0) {
  const tokens = [], pattern = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`|[\w$]+|=>|\.\.\.|[^\s]/g;
  for (const m of source.matchAll(pattern)) {
    if (/^\/[/\*]/.test(m[0])) continue;
    const quoted = /^["'`]/.test(m[0]);
    tokens.push({ value: quoted ? m[0].slice(1, -1) : m[0], quoted, at: offset + m.index, end: offset + m.index + m[0].length });
  }
  return tokens;
}

export function scriptRegions(source, file) {
  if (file.endsWith('.js')) return [{ source, offset: 0 }];
  if (!file.endsWith('.html')) return [];
  return [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map(m => ({ source: m[1], offset: m.index + m[0].indexOf('>') + 1 }));
}

export function waiverReason(source, line, rule) {
  const lines = source.split('\n');
  for (const index of [line - 1, line - 2]) {
    const value = lines[index] ?? '';
    const comment = value.match(/(?:\/\/|\/\*|<!--)\s*motion-mania-ignore\s+([\w-]+)\s*:\s*(.+?)(?:\*\/|-->)?\s*$/);
    if (comment?.[1] === rule && comment[2].replace(/\*\/|-->/g, '').trim()) return comment[2].replace(/\*\/|-->/g, '').trim();
  }
  return null;
}

export function applyWaivers(findings, sources) {
  const waived = [], active = [];
  for (const f of findings) {
    const source = sources.find(s => s.file === f.file)?.source;
    const reason = source !== undefined ? waiverReason(source, f.line, f.rule ?? f.code) : null;
    (reason ? waived : active).push(reason ? { ...f, waiver: reason } : f);
  }
  return { findings: active, waived };
}
