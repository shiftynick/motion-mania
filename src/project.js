import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { backendVersion } from './process.js';
import { synthesize } from './sound.js';

const require = createRequire(import.meta.url);
const starter = fileURLToPath(new URL('../templates/starter/', import.meta.url));
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
    await writeFile(path.join(staging, 'assets/vendor/GSAP-LICENSE.txt'), 'GSAP 3.14.2. Copyright GreenSock. Original license header preserved in gsap.min.js.\nLicense terms: https://gsap.com/standard-license/\n');
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
