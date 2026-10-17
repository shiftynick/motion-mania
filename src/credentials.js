import { chmod, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';

export const keyProviders = { pexels: { environment: 'PEXELS_API_KEY', validationUrl: 'https://api.pexels.com/v1/videos/search?query=nature&per_page=1' } };

export function keyProvider(provider) {
  if (!Object.hasOwn(keyProviders, provider)) throw new Error(`Unknown key provider; supported providers: ${Object.keys(keyProviders).join(', ')}.`);
  return keyProviders[provider];
}

export function credentialsPath({ env = process.env, platform = process.platform, home = homedir() } = {}) {
  const paths = platform === 'win32' ? path.win32 : path.posix;
  const fallback = platform === 'win32' ? env.APPDATA || paths.join(home, 'AppData', 'Roaming') : paths.join(home, '.config');
  const base = env.XDG_CONFIG_HOME && paths.isAbsolute(env.XDG_CONFIG_HOME) ? env.XDG_CONFIG_HOME : fallback;
  if (!paths.isAbsolute(base)) throw new Error('Credentials require an absolute user configuration directory.');
  return paths.join(base, 'motion-mania', 'credentials.json');
}

export const maskKey = key => key.length > 4 ? `****${key.slice(-4)}` : '****';

export function checkedKey(value) {
  const key = value.trim();
  if (!key) throw new Error('API key must not be empty.');
  if (/[\x00-\x1f\x7f]/.test(key)) throw new Error('API key must be a single line without control characters.');
  return key;
}

export async function readCredentials(options = {}) {
  const file = credentialsPath(options), platform = options.platform ?? process.platform;
  let contents;
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Credentials must be a regular file, not a symlink.');
    if (platform !== 'win32' && (info.mode & 0o044)) (options.warn ?? (message => process.stderr.write(`${message}\n`)))('Warning: credentials file is readable by group or others; run chmod 600 on the path from motion-mania keys path.');
    contents = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1 };
    throw new Error('Cannot read credentials file; check its path and permissions.');
  }
  let data;
  try { data = JSON.parse(contents); } catch { throw new Error('Credentials file contains invalid JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || (data.schemaVersion !== undefined && data.schemaVersion !== 1) || Object.entries(data).some(([name, value]) => name !== 'schemaVersion' && typeof value !== 'string')) throw new Error('Unsupported credentials file format; expected schemaVersion 1 and provider keys as strings.');
  return { ...data, schemaVersion: 1 };
}

async function writeCredentials(data, options) {
  const file = credentialsPath(options), directory = path.dirname(file), temp = path.join(directory, `.${randomUUID()}.tmp`);
  const posix = (options.platform ?? process.platform) !== 'win32';
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!(await lstat(directory)).isDirectory()) throw new Error('Invalid directory');
    if (posix) await chmod(directory, 0o700);
    const handle = await open(temp, 'wx', 0o600);
    try {
      if (posix) await handle.chmod(0o600);
      await handle.writeFile(JSON.stringify(data, null, 2) + '\n');
      await handle.sync();
    } finally { await handle.close(); }
    await rename(temp, file);
  } catch { throw new Error('Cannot write credentials file; check its path and permissions.'); }
  finally { await rm(temp, { force: true }).catch(() => {}); }
}

export async function resolveKey(provider, options = {}) {
  const config = keyProvider(provider), value = (options.env ?? process.env)[config.environment]?.trim();
  if (value) return { key: value, source: 'environment' };
  const data = await readCredentials(options), key = data[provider]?.trim();
  return key ? { key, source: 'file' } : { key: null, source: null };
}

export async function setKey(provider, value, options = {}) {
  keyProvider(provider);
  const key = checkedKey(value);
  const data = await readCredentials(options);
  data[provider] = key;
  await writeCredentials(data, options);
}

export async function removeKey(provider, options = {}) {
  keyProvider(provider);
  const data = await readCredentials(options), removed = Object.hasOwn(data, provider);
  if (removed) { delete data[provider]; await writeCredentials(data, options); }
  return removed;
}
