import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hf } from './process.js';
import { withBuild } from './project.js';
import { applyWaivers, authoredSources, jsTokens, lineAt, scriptRegions } from './source.js';

const explanations = {
  non_deterministic_code: 'Clock time and unseeded random values differ between fresh render workers; derive state from timeline time or fixed, seeded inputs.',
  state_timer: 'A wall-clock callback can drive state outside the paused timeline; arbitrary seeks do not replay elapsed browser time. If this only waits for readiness, waive it with that reason.',
  gsap_random_stagger: 'Random stagger order can differ in each render worker; use a fixed order.',
  gsap_relative_value: 'Relative property values capture a base on first render; use explicit endpoints, or document why this writer has a stable base.',
  gsap_function_value: 'Function-valued tween properties run at tween initialization; precompute values, or document that the function depends only on stable inputs.',
  gsap_infinite_repeat: 'Infinite repeats obscure the finite film window; use a finite count or document the bounded loop.',
  gsap_non_transform_motion: 'Layout properties trigger layout and pixel snapping; use x/y/scale transforms, or document why geometry must change.',
  linear_spatial_ease: 'Constant-speed spatial movement may drift through a reading hold; use an arrival/departure ease or document an intentional push, progress indicator, or shake.',
  css_transition_used: 'CSS transitions advance on browser time rather than an arbitrary timeline seek; put the transition on the paused timeline.',
  css_animation: 'CSS animations run independently unless their play state/time is controlled; put motion on the paused timeline or document the seek controller.',
};

function split(tokens, start, stop) {
  const parts = [], stack = [], close = { '(': ')', '{': '}', '[': ']' };
  let begin = start;
  for (let i = start; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.quoted && !stack.length && (t.value === ',' || t.value === stop)) {
      parts.push(tokens.slice(begin, i)); begin = i + 1;
      if (t.value === stop) return { parts, end: i };
    } else if (!t.quoted && close[t.value]) stack.push(close[t.value]);
    else if (!t.quoted && t.value === stack.at(-1)) stack.pop();
  }
  return { parts, end: tokens.length - 1 };
}

function props(tokens) {
  if (tokens[0]?.value !== '{' || tokens[0].quoted) return [];
  return split(tokens, 1, '}').parts.filter(p => p[1]?.value === ':').map(p => ({ key: p[0].value, value: p.slice(2), at: p[0].at }));
}

export function lintSource(source, file = 'src/scene.js') {
  const findings = [], seen = new Set();
  const add = (rule, at, detail = '') => {
    const line = lineAt(source, at), key = `${line}:${rule}:${detail}`;
    if (seen.has(key)) return; seen.add(key);
    findings.push({ file, line, rule, code: rule, severity: ['non_deterministic_code', 'css_transition_used'].includes(rule) ? 'error' : 'warning', origin: 'motion-mania', message: `${detail ? `${detail}: ` : ''}${explanations[rule]}` });
  };
  for (const region of scriptRegions(source, file)) {
    const tokens = jsTokens(region.source, region.offset), v = i => tokens[i]?.value;
    const timelines = new Set(['gsap']);
    for (let i = 0; i < tokens.length; i++) if (v(i + 1) === '=' && v(i + 2) === 'gsap' && v(i + 3) === '.' && v(i + 4) === 'timeline') timelines.add(v(i));
    const objects = new Map(), functions = new Set();
    for (let i = 0; i < tokens.length; i++) {
      if (['const', 'let', 'var'].includes(v(i)) && v(i + 2) === '=') {
        if (v(i + 3) === '{') objects.set(v(i + 1), tokens.slice(i + 3, split(tokens, i + 4, '}').end + 1));
        if (v(i + 3) === 'function' || (v(i + 3) === '(' && v(split(tokens, i + 4, ')').end + 1) === '=>') || v(i + 4) === '=>') functions.add(v(i + 1));
      }
      if (v(i) === 'function' && v(i + 2) === '(') functions.add(v(i + 1));
      if (tokens[i].quoted) continue;
      const clock = ['Math', 'Date', 'performance'].includes(v(i)) && v(i + 1) === '.' && ['random', 'now'].includes(v(i + 2)) && v(i + 3) === '(';
      const random = v(i) === 'gsap' && v(i + 1) === '.' && v(i + 2) === 'utils' && v(i + 3) === '.' && v(i + 4) === 'random' && v(i + 5) === '(';
      if (clock || random) add('non_deterministic_code', tokens[i].at, clock ? `${v(i)}.${v(i + 2)}()` : 'gsap.utils.random()');
      if (['setTimeout', 'setInterval', 'requestAnimationFrame'].includes(v(i)) && v(i + 1) === '(') add('state_timer', tokens[i].at, v(i));
      if (v(i) !== '.' || !timelines.has(v(i - 1)) || !['to', 'from', 'fromTo', 'set'].includes(v(i + 1)) || v(i + 2) !== '(') continue;
      const { parts } = split(tokens, i + 3, ')'), method = v(i + 1), at = tokens[i - 1].at;
      const vars = (method === 'fromTo' ? parts.slice(1, 3) : parts.slice(1, 2)).flatMap(p => props(p.length === 1 && objects.has(p[0].value) ? objects.get(p[0].value) : p));
      for (const p of vars) {
        const value = p.value, first = value[0];
        if (!first) continue;
        if (first.quoted && /^(?:[+-]=)?random\(/.test(first.value)) add('non_deterministic_code', at, 'random(...) tween value');
        if (first.quoted && /^[+-]=/.test(first.value) && !/random\(/.test(first.value)) add('gsap_relative_value', at, p.key);
        if (!/^on[A-Z]/.test(p.key) && (value.some(t => !t.quoted && (t.value === '=>' || t.value === 'function')) || (value.length === 1 && functions.has(first.value)))) add('gsap_function_value', at, p.key);
        if (p.key === 'repeat' && first.value === '-' && value[1]?.value === '1') add('gsap_infinite_repeat', at);
        if (method !== 'set' && /^(left|top|right|bottom|width|height|margin\w*)$/.test(p.key)) add('gsap_non_transform_motion', at, p.key);
        if (p.key === 'stagger' && props(value).some(p => p.key === 'from' && p.value[0]?.quoted && p.value[0].value === 'random')) add('gsap_random_stagger', at);
      }
      if (method !== 'set' && vars.some(p => p.key === 'ease' && p.value[0]?.quoted && /^(none|linear)$/.test(p.value[0].value)) && vars.some(p => /^(x|y|z|xPercent|yPercent|scale[XYZ]?|rotation[XYZ]?|left|top|width|height)$/.test(p.key))) add('linear_spatial_ease', at);
    }
  }
  const css = file.endsWith('.css') ? [{ source, offset: 0 }] : file.endsWith('.html') ? [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>|\bstyle\s*=\s*(["'])(.*?)\2/gi)].map(m => ({ source: m[1] ?? m[3], offset: m.index + (m[1] !== undefined ? m[0].indexOf('>') + 1 : m[0].indexOf(m[3])) })) : [];
  for (const region of css) {
    const clean = region.source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    for (const m of clean.matchAll(/\b(transition(?:-property|-duration)?|animation(?:-name)?)\s*:\s*([^;}]+)/g)) {
      if (/^(none|0(?:s|ms)?)(?:\s*!important)?\s*$/.test(m[2].trim())) continue;
      if (m[1].startsWith('transition')) add('css_transition_used', region.offset + m.index);
      else if (!/animation-play-state\s*:\s*paused/.test(clean.slice(Math.max(0, clean.lastIndexOf('{', m.index)), clean.indexOf('}', m.index) < 0 ? clean.length : clean.indexOf('}', m.index)))) add('css_animation', region.offset + m.index);
    }
  }
  return applyWaivers(findings, [{ source, file }]);
}

export function mergeLintFindings(local, backend) {
  const equivalent = { gsap_relative_value: ['gsap_relative_value_second_writer', 'gsap_repeat_refresh_relative_value'], gsap_function_value: ['gsap_function_value_hazard'], state_timer: ['requestanimationframe_in_composition'] };
  return [...backend, ...local.filter(f => !backend.some(b => (b.code === f.code || equivalent[f.code]?.includes(b.code)) && (f.code !== 'state_timer' || b.code !== 'requestanimationframe_in_composition' || f.message.startsWith('requestAnimationFrame:')) && b.file === f.file && b.line === f.line))];
}

export function groupLintAdvice(findings) {
  const grouped = [], structural = new Map();
  for (const f of findings) {
    if (f.code !== 'nested_structure_needs_subcomposition' || f.severity !== 'warning') { grouped.push(f); continue; }
    const key = `${f.file ?? f.sourceFile}:${f.section ?? 'lint'}`;
    const group = structural.get(key) ?? { ...f, occurrences: 0, selectors: [] };
    group.occurrences++; if (group.selectors.length < 3) group.selectors.push(f.selector);
    structural.set(key, group);
  }
  return [...grouped, ...[...structural.values()].map(f => ({ ...f, message: `${f.occurrences} nested scene(s) could be split into sub-compositions for easier editing. This is structural advice, not a render defect.` }))];
}

export async function lint(project, format) {
  const sources = await authoredSources(project), local = sources.map(s => lintSource(s.source, s.file));
  const candidates = local.flatMap(r => [...r.findings, ...r.waived]);
  return withBuild(project, format, async build => {
    const index = path.join(build, 'index.html');
    let html = await readFile(index, 'utf8');
    const scene = sources.find(s => s.file === 'src/scene.js');
    const embeddedLine = scene ? lineAt(html, html.indexOf(`<script>${scene.source.replaceAll('</script', '<\\/script')}`)) : 0;
    const extras = [];
    for (const s of sources.filter(s => s.file.endsWith('.js') && s !== scene)) {
      const start = html.split('\n').length + 1;
      html += `\n<script>\n${s.source.replaceAll('</script', '<\\/script')}\n</script>`;
      extras.push({ file: s.file, start: start + 1, lines: s.source.split('\n').length });
    }
    await writeFile(index, html);
    const result = await hf(['lint', build, '--json'], { quiet: true, allowFailure: true });
    let payload;
    try { payload = JSON.parse(result.stdout); } catch { throw new Error('HyperFrames returned invalid lint JSON'); }
    const mapped = (payload.findings ?? []).map(f => {
      let file = f.file && path.relative(build, f.file), line = f.line;
      const preparedLine = line ? html.split('\n')[line - 1]?.trim() : null;
      if (file === 'index.html' && line >= embeddedLine && embeddedLine > 0 && line < embeddedLine + scene.source.split('\n').length) { file = 'scene.js'; line -= embeddedLine - 1; }
      const extra = file === 'index.html' && extras.find(e => line >= e.start && line < e.start + e.lines);
      if (extra) { file = extra.file.slice(4); line -= extra.start - 1; }
      if (file === 'index.html' && preparedLine) {
        const original = sources.find(s => s.file === 'src/index.html')?.source.split('\n').findIndex(s => s.trim() === preparedLine);
        if (original >= 0) line = original + 1;
      }
      if (!line && f.snippet) {
        const normalized = f.snippet.replace(/\.\.\.$/, '').trim();
        const found = sources.find(s => s.source.includes(normalized));
        if (found) { file = found.file.slice(4); line = lineAt(found.source, found.source.indexOf(normalized)); }
      }
      if (!line) {
        const rule = { gsap_relative_value_second_writer: 'gsap_relative_value', gsap_repeat_refresh_relative_value: 'gsap_relative_value', gsap_function_value_hazard: 'gsap_function_value', requestanimationframe_in_composition: 'state_timer' }[f.code] ?? f.code;
        const matches = candidates.filter(c => c.rule === rule && (!f.selector || sources.find(s => s.file === c.file)?.source.split('\n')[c.line - 1]?.includes(f.selector)));
        if (matches.length === 1) { file = matches[0].file.slice(4); line = matches[0].line; }
      }
      return { ...f, ...(line ? {} : { location: 'file' }), file: `src/${file || 'index.html'}`, line: line ?? 1, rule: f.code, origin: 'hyperframes' };
    });
    const waivedBackend = applyWaivers(mapped, sources);
    const findings = groupLintAdvice(mergeLintFindings(local.flatMap(r => r.findings), waivedBackend.findings));
    const waived = [...local.flatMap(r => r.waived), ...waivedBackend.waived];
    return { ok: !findings.some(f => f.severity === 'error') && !(result.code !== 0 && !payload.findings?.length), format, findings, waived, errorCount: findings.filter(f => f.severity === 'error').length, warningCount: findings.filter(f => f.severity === 'warning').length, filesScanned: sources.length, note: 'Static heuristics over authored JS/HTML/CSS plus HyperFrames lint. Inspect warnings; this does not establish seek stability or readability.' };
  });
}
