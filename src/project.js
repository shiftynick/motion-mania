import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { backendVersion } from './process.js';
import { synthesize } from './sound.js';
import { analyzeCaptions, injectCaptions } from './captions.js';

const require = createRequire(import.meta.url);
const starter = fileURLToPath(new URL('../templates/starter/', import.meta.url));
const gsapVersion = require('gsap/package.json').version;
export const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
export const exists = async file => access(file).then(() => true, () => false);

export function validateManifest(m) {
  if (!m || m.schemaVersion !== 1) throw new Error('motion.json requires schemaVersion: 1');
  if (m.engine !== `hyperframes@${backendVersion}`) throw new Error(`This CLI requires engine hyperframes@${backendVersion}`);
  if (typeof m.name !== 'string' || !m.name.trim()) throw new Error('name must be a nonempty string');
  if (!Number.isFinite(m.duration) || m.duration <= 0 || m.duration > 600) throw new Error('duration must be > 0 and <= 600 seconds');
  if (!Number.isInteger(m.fps) || m.fps < 1 || m.fps > 120) throw new Error('fps must be an integer from 1 to 120');
  if (!m.formats || typeof m.formats !== 'object' || Array.isArray(m.formats) || !Object.keys(m.formats).length) throw new Error('formats must contain at least one layout');
  for (const [name, f] of Object.entries(m.formats)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || name === 'all') throw new Error(`Invalid format name: ${name}`);
    for (const key of ['width', 'height']) {
      if (!Number.isInteger(f?.[key]) || f[key] < 64 || f[key] > 3840 || f[key] % 2) throw new Error(`${name}.${key} must be an even integer from 64 to 3840`);
    }
  }
  if (m.audioRequired !== undefined && typeof m.audioRequired !== 'boolean') throw new Error('audioRequired must be boolean');
  if (m.loudness !== undefined) {
    const l = m.loudness, range = (key, min, max) => l[key] === undefined || (Number.isFinite(l[key]) && l[key] >= min && l[key] <= max);
    if (!l || typeof l !== 'object' || Array.isArray(l) || Object.keys(l).some(k => !['integrated', 'truePeak', 'tolerance'].includes(k))) throw new Error('loudness may contain only integrated, truePeak, and tolerance');
    if (!range('integrated', -40, -5) || !range('truePeak', -10, 0) || !range('tolerance', 0.1, 6)) throw new Error('loudness.integrated must be -40..-5 LUFS, truePeak -10..0 dBTP, tolerance 0.1..6 LU');
  }
  return m;
}

export async function loadProject(directory) {
  const root = await realpath(path.resolve(directory));
  const manifest = validateManifest(JSON.parse(await readFile(path.join(root, 'motion.json'), 'utf8')));
  await access(path.join(root, 'src/index.html'));
  return { root, manifest };
}

export function selectFormats(project, selected) {
  const names = Object.keys(project.manifest.formats);
  if (selected === 'all') return names;
  const name = selected ?? names[0];
  if (!names.includes(name)) throw new Error(`Unknown format '${name}'. Choose ${names.join(', ')} or all.`);
  return [name];
}

export async function initProject(directory) {
  const root = path.resolve(directory);
  if (await exists(root) && (await readdir(root)).length) throw new Error(`Refusing to initialize nonempty directory: ${root}`);
  await mkdir(path.dirname(root), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(root), '.motion-init-'));
  try {
    await cp(starter, staging, { recursive: true });
    await rename(path.join(staging, 'gitignore'), path.join(staging, '.gitignore'));
    await mkdir(path.join(staging, 'assets/vendor'), { recursive: true });
    await cp(require.resolve('gsap/dist/gsap.min.js'), path.join(staging, 'assets/vendor/gsap.min.js'));
    await writeFile(path.join(staging, 'assets/vendor/GSAP-LICENSE.txt'), `GSAP ${gsapVersion}. Copyright GreenSock. Original license header preserved in gsap.min.js.\nLicense terms: https://gsap.com/standard-license/\n`);
    const assetsManifestPath = path.join(staging, 'assets/manifest.json');
    const assetsManifest = JSON.parse(await readFile(assetsManifestPath, 'utf8'));
    assetsManifest.assets.find(asset => asset.path === 'vendor/gsap.min.js').origin = `gsap npm package ${gsapVersion}`;
    await writeJson(assetsManifestPath, assetsManifest);
    await synthesize(path.join(staging, 'assets/score.wav'));
    await rename(staging, root);
    return { ok: true, project: root, manifest: path.join(root, 'motion.json') };
  } finally { await rm(staging, { recursive: true, force: true }); }
}

// Reject symlinks in source trees: builds must remain portable and self-contained.
async function assertLocalTree(directory) {
  if ((await lstat(directory)).isSymbolicLink()) throw new Error(`Use local copies instead of symlinks: ${directory}`);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`Use local copies instead of symlinks: ${path.join(directory, entry.name)}`);
    if (entry.isDirectory()) await assertLocalTree(path.join(directory, entry.name));
  }
}

export async function buildProject(project, format, destination) {
  const dimensions = project.manifest.formats[format];
  if (!dimensions) throw new Error(`Unknown format: ${format}`);
  for (const directory of ['src', 'assets']) await assertLocalTree(path.join(project.root, directory));
  await mkdir(destination, { recursive: true });
  await cp(path.join(project.root, 'src'), destination, { recursive: true });
  await cp(path.join(project.root, 'assets'), path.join(destination, 'assets'), { recursive: true });
  const filename = path.join(destination, 'index.html');
  let html = await readFile(filename, 'utf8');
  // HyperFrames' static contract checker reads inline authoring code. Keep editable
  // JS separate in source, but embed this known entry in the prepared composition.
  if (html.includes('<script src="scene.js"></script>')) {
    const script = await readFile(path.join(destination, 'scene.js'), 'utf8');
    html = html.replace('<script src="scene.js"></script>', () => `<script>${script.replaceAll('</script', '<\\/script')}</script>`);
  }
  const replacements = { WIDTH: dimensions.width, HEIGHT: dimensions.height, DURATION: project.manifest.duration, FPS: project.manifest.fps };
  for (const [key, value] of Object.entries(replacements)) {
    if (!html.includes(`__${key}__`)) throw new Error(`src/index.html must contain __${key}__`);
    html = html.replaceAll(`__${key}__`, String(value));
  }
  let captions;
  try { captions = JSON.parse(await readFile(path.join(project.root, 'captions.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error(`captions.json: ${error.message}`); }
  if (captions) {
    analyzeCaptions(captions, project.manifest);
    html = injectCaptions(html, captions);
  }
  await writeFile(filename, html);
  return destination;
}

export async function withBuild(project, format, action) {
  const parent = path.join(project.root, '.motion');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'build-'));
  try { return await action(await buildProject(project, format, directory)); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

export async function installSkill(directory) {
  const root = path.resolve(directory);
  if (await exists(root) && (await readdir(root)).length) throw new Error(`Refusing to replace nonempty skill directory: ${root}`);
  await mkdir(path.dirname(root), { recursive: true });
  const staging = await mkdtemp(path.join(path.dirname(root), '.motion-skill-'));
  try {
    await cp(fileURLToPath(new URL('../skills/motion-mania/', import.meta.url)), staging, { recursive: true });
    await rename(staging, root);
    return { ok: true, directory: root, skill: path.join(root, 'SKILL.md'), note: 'Skill installed. The agent can invoke the CLI with npx motion-mania or a global install.' };
  } finally { await rm(staging, { recursive: true, force: true }); }
}

async function listFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await listFiles(path.join(directory, entry.name), relative));
    else files.push(relative);
  }
  return files;
}

// Provenance gaps in assets/manifest.json. Warnings only: the agent decides what to record.
export async function provenanceWarnings(project) {
  const assets = path.join(project.root, 'assets');
  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(assets, 'manifest.json'), 'utf8')); }
  catch (error) { return [error.code === 'ENOENT' ? 'assets/manifest.json is missing; record the origin of each asset.' : `assets/manifest.json: ${error.message}`]; }
  const entries = Array.isArray(manifest?.assets) ? manifest.assets : [];
  if (!Array.isArray(manifest?.assets)) return ['assets/manifest.json must contain an assets array.'];
  const files = await listFiles(assets);
  const listed = new Set(entries.map(e => e?.path)), licenses = new Set(entries.map(e => e?.license));
  const warnings = [];
  for (const file of files) if (file !== 'manifest.json' && !listed.has(file) && !licenses.has(file)) warnings.push(`assets/${file} has no provenance entry in assets/manifest.json.`);
  for (const entry of entries) {
    const name = typeof entry?.path === 'string' ? entry.path : JSON.stringify(entry);
    if (typeof entry?.path !== 'string' || !files.includes(entry.path)) { warnings.push(`Provenance entry ${name} does not match a file in assets/.`); continue; }
    if (!entry.origin) warnings.push(`assets/${name}: record its origin.`);
    if (entry.sourceUrl && !entry.license) warnings.push(`assets/${name}: external source without a license.`);
    if (/^CC[ -]BY/i.test(entry.license ?? '') && !entry.attribution) warnings.push(`assets/${name}: ${entry.license} requires attribution.`);
    if (entry.generator && (!entry.generator.model || !entry.generator.prompt)) warnings.push(`assets/${name}: generated media should record generator.model and generator.prompt.`);
  }
  return warnings;
}
