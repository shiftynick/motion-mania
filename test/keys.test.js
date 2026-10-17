import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Readable } from 'node:stream';
import { credentialsPath, keyProvider, maskKey, readCredentials, removeKey, resolveKey, setKey } from '../src/credentials.js';
import { keysCommand, readKey } from '../src/keys.js';
import { searchMedia } from '../src/media.js';

const secret = 'dummy-private-provider-key-7392';
const input = (key = secret) => Readable.from([key]);
async function sandbox(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'motion-keys-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { env: { XDG_CONFIG_HOME: root } };
}
function cli(args, options, key = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/cli.js', ...args], { env: { ...process.env, PEXELS_API_KEY: '', ...options.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.on('data', data => { stderr += data; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, stdout, stderr }));
    child.stdin.on('error', () => {});
    child.stdin.end(key);
  });
}
const noSecret = value => assert.equal(JSON.stringify(value).includes(secret), false);

test('credentials paths use injected platform, home and environment without a project path', () => {
  for (const platform of ['linux', 'darwin']) {
    assert.equal(credentialsPath({ platform, env: {}, home: '/users/person' }), '/users/person/.config/motion-mania/credentials.json');
    assert.equal(credentialsPath({ platform, env: { XDG_CONFIG_HOME: '/settings' }, home: '/unused' }), '/settings/motion-mania/credentials.json');
    assert.equal(credentialsPath({ platform, env: { XDG_CONFIG_HOME: 'relative' }, home: '/users/person' }), '/users/person/.config/motion-mania/credentials.json');
  }
  const windows = { platform: 'win32', home: 'C:\\Users\\Person' };
  assert.equal(credentialsPath({ ...windows, env: { APPDATA: 'C:\\Roaming' } }), 'C:\\Roaming\\motion-mania\\credentials.json');
  assert.equal(credentialsPath({ ...windows, env: {} }), 'C:\\Users\\Person\\AppData\\Roaming\\motion-mania\\credentials.json');
  assert.equal(credentialsPath({ ...windows, env: { XDG_CONFIG_HOME: 'D:\\Config', APPDATA: 'C:\\Roaming' } }), 'D:\\Config\\motion-mania\\credentials.json');
  assert.throws(() => credentialsPath({ platform: 'linux', env: {}, home: 'relative' }), /absolute/);
});

test('credential writes are private and atomic, preserve other providers and support removal', async t => {
  const options = await sandbox(t), file = credentialsPath(options), directory = path.dirname(file);
  assert.deepEqual(await readCredentials(options), { schemaVersion: 1 });
  await setKey('pexels', ` ${secret}\n`, options);
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { schemaVersion: 1, pexels: secret });
  if (process.platform !== 'win32') {
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
  }
  await writeFile(file, JSON.stringify({ pexels: 'old', future: 'preserved' }));
  await setKey('pexels', secret, options);
  assert.equal((await readCredentials(options)).future, 'preserved');
  assert.deepEqual(await readdir(directory), ['credentials.json']);
  assert.equal(await removeKey('pexels', options), true);
  assert.equal(await removeKey('pexels', options), false);
  assert.deepEqual(await readCredentials(options), { schemaVersion: 1, future: 'preserved' });
  assert.deepEqual(await readdir(directory), ['credentials.json']);
});

test('environment overrides the stored key, including when the file is broken', async t => {
  const options = await sandbox(t);
  assert.deepEqual(await resolveKey('pexels', options), { key: null, source: null });
  await setKey('pexels', secret, options);
  assert.deepEqual(await resolveKey('pexels', options), { key: secret, source: 'file' });
  const env = { ...options.env, PEXELS_API_KEY: 'environment-value' };
  assert.deepEqual(await resolveKey('pexels', { env }), { key: 'environment-value', source: 'environment' });
  assert.equal((await resolveKey('pexels', { env: { ...options.env, PEXELS_API_KEY: ' \n' } })).source, 'file');
  await writeFile(credentialsPath(options), secret);
  assert.equal((await resolveKey('pexels', { env })).source, 'environment');
  await assert.rejects(readCredentials(options), error => { noSecret(error.message); return /invalid JSON/.test(error.message); });
});

test('masking never reveals a whole short key; list reports only the effective source', async t => {
  for (const key of ['a', 'abcd', secret]) assert.equal(maskKey(key).includes(key), false);
  assert.equal(maskKey(secret), '****7392');
  const options = await sandbox(t);
  assert.deepEqual((await keysCommand('list', undefined, options)).providers, [{ provider: 'pexels', configured: false, source: null, masked: null }]);
  await setKey('pexels', secret, options);
  const stored = await keysCommand('list', undefined, options);
  assert.deepEqual(stored.providers, [{ provider: 'pexels', configured: true, source: 'file', masked: '****7392' }]);
  noSecret(stored);
  const override = await keysCommand('list', undefined, { env: { ...options.env, PEXELS_API_KEY: 'override-5123' } });
  assert.equal(override.providers[0].source, 'environment');
  assert.equal(override.providers[0].masked, '****5123');
  assert.equal(JSON.stringify(override).includes('override-5123'), false);
});

test('readable credentials warn on POSIX without failing or exposing their contents', { skip: process.platform === 'win32' }, async t => {
  const options = await sandbox(t), warnings = [], file = credentialsPath(options);
  await setKey('pexels', secret, options);
  for (const mode of [0o640, 0o604]) {
    await chmod(file, mode);
    assert.equal((await readCredentials({ ...options, warn: message => warnings.push(message) })).pexels, secret);
  }
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /readable by group or others/);
  noSecret(warnings);
  await setKey('pexels', secret, { ...options, warn: () => {} });
  assert.equal((await stat(file)).mode & 0o777, 0o600);
});

test('provider typos, empty keys, multiline keys, bad schemas and symlinks fail safely', async t => {
  const options = await sandbox(t);
  for (const provider of ['pexel', 'pixabay', '__proto__', 'constructor', secret]) {
    assert.throws(() => keyProvider(provider), error => { noSecret(error.message); return /supported providers: pexels/.test(error.message); });
    await assert.rejects(setKey(provider, secret, options), /Unknown key provider/);
    await assert.rejects(removeKey(provider, options), /Unknown key provider/);
    await assert.rejects(resolveKey(provider, options), /Unknown key provider/);
  }
  for (const key of ['', ' \n\t']) await assert.rejects(keysCommand('set', 'pexels', { ...options, input: input(key) }), /must not be empty/);
  await assert.rejects(setKey('pexels', `${secret}\nsecond`, options), /single line/);
  await assert.rejects(stat(path.dirname(credentialsPath(options))), { code: 'ENOENT' });
  await setKey('pexels', secret, options);
  const file = credentialsPath(options);
  for (const data of [[], null, { schemaVersion: 2, pexels: secret }, { pexels: { secret } }]) {
    await writeFile(file, JSON.stringify(data));
    await assert.rejects(readCredentials(options), error => { noSecret(error.message); return /Unsupported/.test(error.message); });
  }
  if (process.platform !== 'win32') {
    await rm(file);
    const target = path.join(options.env.XDG_CONFIG_HOME, 'outside');
    await writeFile(target, secret);
    await symlink(target, file);
    await assert.rejects(setKey('pexels', secret, options), /Cannot read/);
    assert.equal(await readFile(target, 'utf8'), secret);
  }
});

test('optional validation accepts one request, preserves a key on rejection, and stores on network failure', async t => {
  const options = await sandbox(t);
  let requests = 0;
  const accepted = await keysCommand('set', 'pexels', { ...options, input: input(), validate: true, fetch: async (url, request) => {
    requests++;
    assert.equal(new URL(url).searchParams.get('per_page'), '1');
    assert.equal(request.headers.Authorization, secret);
    assert.equal(String(url).includes(secret), false);
    assert.equal(request.redirect, 'error');
    return new Response(secret);
  } });
  assert.equal(requests, 1);
  assert.equal(accepted.validation.status, 'accepted');
  noSecret(accepted);
  for (const status of [401, 403]) {
    const rejected = await keysCommand('set', 'pexels', { ...options, input: input('replacement'), validate: true, fetch: async () => new Response(secret, { status }) });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.stored, false);
    assert.equal((await readCredentials(options)).pexels, secret);
    noSecret(rejected);
  }
  await removeKey('pexels', options);
  const network = await keysCommand('set', 'pexels', { ...options, input: input(), validate: true, fetch: async () => { throw new Error(`header Authorization: ${secret}`); } });
  assert.equal(network.stored, true);
  assert.equal(network.validation.status, 'unverified');
  assert.match(network.validation.message, /Network.*stored/);
  assert.equal((await readCredentials(options)).pexels, secret);
  noSecret(network);
  const unavailable = await keysCommand('set', 'pexels', { ...options, input: input(), validate: true, fetch: async () => new Response(secret, { status: 503 }) });
  assert.equal(unavailable.validation.status, 'unverified');
  noSecret(unavailable);
});

test('TTY input stays hidden and restores raw mode on confirmation and cancellation', async () => {
  for (const cancel of [false, true]) {
    const tty = new PassThrough(), modes = [], output = [];
    tty.isTTY = true;
    tty.setRawMode = value => { modes.push(value); tty.isRaw = value; };
    const pending = readKey({ input: tty, output: { write: value => output.push(value) } });
    tty.write(cancel ? `${secret}\x03` : `${secret}x\x7f\r`);
    if (cancel) await assert.rejects(pending, /cancelled/);
    else assert.equal(await pending, secret);
    assert.deepEqual(modes, [true, false]);
    assert.equal(tty.listenerCount('data'), 0);
    noSecret(output);
    tty.destroy();
  }
});

test('CLI set/list/path/remove use JSON, reject argument keys, and never echo the key', async t => {
  const options = await sandbox(t);
  const set = await cli(['keys', 'set', 'pexels', '--json'], options, `${secret}\n`);
  assert.equal(set.code, 0);
  assert.equal(JSON.parse(set.stdout).stored, true);
  noSecret(set);
  const list = await cli(['keys', 'list', '--json'], options);
  assert.equal(JSON.parse(list.stdout).providers[0].masked, '****7392');
  noSecret(list);
  assert.equal(JSON.parse((await cli(['keys', 'path', '--json'], options)).stdout).path, credentialsPath(options));
  for (const args of [['keys', 'set', 'pexels', secret], ['--json', 'keys', 'set', 'pexels', `--${secret}`], ['keys', 'remove', secret], ['keys', 'list', '--validate']]) {
    const failed = await cli([...args, '--json'], options);
    assert.equal(failed.code, 1);
    noSecret(failed);
  }
  const empty = await cli(['keys', 'set', 'pexels', '--json'], options, '\n');
  assert.equal(empty.code, 1);
  assert.match(JSON.parse(empty.stdout).error, /must not be empty/);
  const remove = await cli(['keys', 'remove', 'pexels', '--json'], options);
  assert.equal(JSON.parse(remove.stdout).removed, true);
  noSecret(remove);
  const missing = await cli(['media', 'search', 'ocean', '--type', 'video', '--json'], options);
  assert.equal(missing.code, 1);
  assert.match(JSON.parse(missing.stdout).error, /motion-mania keys set pexels.*PEXELS_API_KEY/);
});

test('provider request errors cannot echo keys through exceptions, bodies or retry headers', async () => {
  for (const fetch of [
    async () => { throw new Error(`https://provider.example/?key=${secret}`); },
    async () => new Response(secret, { status: 401 }),
    async () => new Response(secret, { status: 403 }),
    async () => new Response(secret, { status: 429, headers: { 'Retry-After': secret } }),
    async () => new Response(secret),
  ]) await assert.rejects(searchMedia('ocean', { type: 'video', apiKey: secret, fetch }), error => { noSecret(error.message); return true; });
});
