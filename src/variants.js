import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { hf, probe } from './process.js';
import { withBuild, buildProject, writeJson } from './project.js';
import { writeMotionAssertions } from './motion-assertions.js';
import { preflightDelivery } from './delivery.js';
import { validateMedia } from './operations.js';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const primitive = value => ['string', 'boolean'].includes(typeof value) || typeof value === 'number' && Number.isFinite(value);
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

export function variableDeclarations(html) {
  const match = html.match(/\bdata-composition-variables\s*=\s*(["'])([\s\S]*?)\1/i);
  if (!match) throw new Error('Declare data-composition-variables as a JSON array on the composition root before rendering variants');
  let declarations;
  try { declarations = JSON.parse(decode(match[2])); } catch { throw new Error('data-composition-variables must be a valid JSON array'); }
  if (!Array.isArray(declarations) || !declarations.length) throw new Error('data-composition-variables must be a nonempty JSON array');
  const names = new Set();
  for (const declaration of declarations) {
    if (!record(declaration) || typeof declaration.id !== 'string' || !/^[a-zA-Z][\w-]*$/.test(declaration.id) || names.has(declaration.id) || !['string', 'number', 'boolean', 'color', 'enum', 'font', 'image'].includes(declaration.type) || !primitive(declaration.default)) throw new Error('Variable declarations need unique ids, supported types, and scalar defaults');
    names.add(declaration.id);
    validateValue(declaration, declaration.default);
  }
  return declarations;
}

function validateValue(declaration, value) {
  const { id, type } = declaration;
  const expected = type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'string';
  if (!primitive(value) || typeof value !== expected) throw new Error(`Variable ${id} must be ${expected}`);
  if (type === 'number' && (declaration.min !== undefined && value < declaration.min || declaration.max !== undefined && value > declaration.max)) throw new Error(`Variable ${id} is outside its declared range`);
  if (type === 'enum' && (!Array.isArray(declaration.options) || !declaration.options.some(option => (typeof option === 'string' ? option : option?.value) === value))) throw new Error(`Variable ${id} must match a declared enum option`);
}

export function validateVariants(value, declarations) {
  if (!record(value) || value.schemaVersion !== 1 || Object.keys(value).some(key => !['schemaVersion', 'variants', 'reviewAt'].includes(key)) || !Array.isArray(value.variants) || value.variants.length < 2 || value.variants.length > 12) throw new Error('variants.json requires schemaVersion: 1 and 2–12 variants (optional reviewAt)');
  if (value.reviewAt !== undefined && (!Number.isFinite(value.reviewAt) || value.reviewAt < 0)) throw new Error('variants.json reviewAt must be a nonnegative time');
  const names = new Set(), schema = new Map(declarations.map(declaration => [declaration.id, declaration]));
  for (const variant of value.variants) {
    if (!record(variant) || Object.keys(variant).some(key => !['name', 'label', 'variables'].includes(key)) || typeof variant.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(variant.name) || names.has(variant.name) || !record(variant.variables) || !Object.keys(variant.variables).length) throw new Error('Each variant needs a unique lowercase name and a nonempty variables object');
    if (variant.label !== undefined && (typeof variant.label !== 'string' || !variant.label.trim() || /[,\r\n]/.test(variant.label) || variant.label.length > 80)) throw new Error('Variant labels must be 1–80 characters without commas or newlines');
    names.add(variant.name);
    for (const [key, variable] of Object.entries(variant.variables)) {
      if (!schema.has(key)) throw new Error(`Undeclared variant variable: ${key}`);
      validateValue(schema.get(key), variable);
    }
  }
  return value;
}

export function parseBatchOutput(stdout) {
  const last = String(stdout).trim().split(/\r?\n/).at(-1);
  let result;
  try { result = JSON.parse(last); } catch { throw new Error('HyperFrames batch output must end with a JSON completion record'); }
  if (result?.type !== 'batch-complete' || !Array.isArray(result.rows) || !Number.isInteger(result.total) || result.total !== result.rows.length || result.completed !== result.total || result.failed !== 0 || result.skipped !== 0 || result.rows.some(row => row.status !== 'completed')) throw new Error(`HyperFrames batch incomplete: ${last}`);
  return result;
}

export async function renderVariants(project, format, quality = 'looks', at) {
  if (!['draft', 'looks', 'delivery'].includes(quality)) throw new Error('quality must be draft, looks, or delivery');
  const config = JSON.parse(await readFile(path.join(project.root, 'variants.json'), 'utf8'));
  const declarations = variableDeclarations(await readFile(path.join(project.root, 'src/index.html'), 'utf8'));
  validateVariants(config, declarations);
  const time = at ?? config.reviewAt ?? Math.min(1, project.manifest.duration / 2);
  if (!Number.isFinite(time) || time < 0 || time >= project.manifest.duration) throw new Error(`Variant review time must be >= 0 and < ${project.manifest.duration}`);
  const parent = path.join(project.root, 'out/variants');
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, `.${format}-`)), output = path.join(parent, path.basename(staging).slice(1));
  try {
    const result = await withBuild(project, format, async build => {
      await writeMotionAssertions(project, build);
      const batchFile = path.join(build, 'variant-rows.json');
      await writeJson(batchFile, config.variants.map(variant => variant.variables));
      const backend = await hf(['render', build, '--batch', batchFile, '--output', path.join(staging, 'variant-{index}.mp4'), '--fps', String(project.manifest.fps), '--quality', quality, '--workers', '1', '--batch-concurrency', '1', '--no-browser-gpu', '--strict', '--strict-variables', '--json']);
      const batch = parseBatchOutput(backend.stdout);
      if (batch.total !== config.variants.length) throw new Error('HyperFrames returned the wrong number of variants');
      const variants = [];
      for (const [index, variant] of config.variants.entries()) {
        const temp = path.join(staging, `variant-${index}.mp4`);
        const delivery = await preflightDelivery(temp, project.manifest, project.manifest.formats[format]);
        const metadata = validateMedia(await probe(temp), project.manifest, format);
        await rename(temp, path.join(staging, `${variant.name}.mp4`));
        variants.push({ ...variant, label: variant.label ?? variant.name, output: path.join(output, `${variant.name}.mp4`), ...metadata, delivery, warnings: delivery.warnings });
      }
      const builds = [], comparisonParent = await mkdtemp(path.join(project.root, '.motion/variant-compare-'));
      try {
        for (const [index, variant] of config.variants.entries()) {
          const prepared = await buildProject(project, format, path.join(comparisonParent, String(index)));
          const file = path.join(prepared, 'index.html'), html = await readFile(file, 'utf8');
          const variables = { ...Object.fromEntries(declarations.map(declaration => [declaration.id, declaration.default])), ...variant.variables };
          const json = JSON.stringify(variables).replaceAll('<', '\\u003c');
          await writeFile(file, html.replace(/<head\b[^>]*>/i, match => `${match}<script>window.__hfVariables=${json};</script>`));
          builds.push(prepared);
        }
        await hf(['compare', ...builds, '--at', String(time), '--labels', variants.map(variant => variant.label).join(','), '--cols', '2', '--out', path.join(staging, 'comparison.png'), '--json']);
      } finally { await rm(comparisonParent, { recursive: true, force: true }); }
      const manifest = path.join(output, 'manifest.json');
      await writeJson(path.join(staging, 'manifest.json'), { ...batch, version: 1, batchPath: path.join(project.root, 'variants.json'), manifestPath: manifest, rows: batch.rows.map((row, index) => ({ ...row, outputPath: variants[index].output })) });
      return { ok: true, format, manifest, createdAt: new Date().toISOString(), quality, at: time, output, variants, comparison: path.join(output, 'comparison.png'), batch: { total: batch.total, completed: batch.completed, failed: batch.failed }, notes: 'Comparison stills do not establish motion, sound quality, or a winning variant. Inspect each MP4 and measure audio separately.' };
    });
    await writeJson(path.join(staging, 'report.json'), result);
    await rename(staging, output);
    return { ...result, report: path.join(output, 'report.json') };
  } finally { await rm(staging, { recursive: true, force: true }); }
}
