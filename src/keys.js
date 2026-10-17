import { checkedKey, keyProvider, keyProviders, credentialsPath, maskKey, readCredentials, removeKey, setKey } from './credentials.js';

export async function readKey({ input = process.stdin, output = process.stderr } = {}) {
  if (!input.isTTY) {
    let key = '';
    try { for await (const chunk of input) key += chunk; }
    catch { throw new Error('Cannot read API key from stdin.'); }
    return key;
  }
  output.write('API key (hidden): ');
  const wasRaw = Boolean(input.isRaw), wasPaused = input.isPaused();
  try {
    input.setRawMode(true);
    return await new Promise((resolve, reject) => {
      let key = '';
      const cleanup = () => { input.off('data', onData); input.off('end', onEnd); input.off('error', onError); };
      const finish = (error) => { cleanup(); error ? reject(error) : resolve(key); };
      const onEnd = () => finish(new Error('API key input ended before confirmation.'));
      const onError = () => finish(new Error('Cannot read API key from stdin.'));
      const onData = chunk => {
        for (const char of chunk.toString('utf8')) {
          if (char === '\x03' || char === '\x04') { finish(new Error('API key input cancelled.')); return; }
          if (char === '\r' || char === '\n') { finish(); return; }
          if (char === '\x7f' || char === '\b') key = [...key].slice(0, -1).join('');
          else if (char >= ' ' && char !== '\x1b') key += char;
        }
      };
      input.on('data', onData);
      input.once('end', onEnd);
      input.once('error', onError);
      input.resume();
    });
  } finally {
    input.setRawMode(wasRaw);
    if (wasPaused) input.pause();
    output.write('\n');
  }
}

export async function validateKey(provider, key, { fetch: fetcher = globalThis.fetch } = {}) {
  const config = keyProvider(provider);
  let response;
  try {
    response = await fetcher(config.validationUrl, { headers: { Authorization: key, Accept: 'application/json', 'User-Agent': 'motion-mania/0.4.0 (https://github.com/shiftynick/motion-mania)' }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  } catch { return { status: 'unverified', message: 'Network request failed or timed out; key stored without validation.' }; }
  await response.body?.cancel().catch(() => {});
  if (response.ok) return { status: 'accepted', message: 'Provider accepted the key.' };
  if ([401, 403].includes(response.status)) return { status: 'rejected', message: `Provider rejected the key (HTTP ${response.status}); existing stored key kept.` };
  return { status: 'unverified', message: `Provider unavailable (HTTP ${response.status}); key stored without validation.` };
}

export async function keysCommand(action, provider, { validate = false, input, output, fetch, ...options } = {}) {
  if (action === 'path') return { ok: true, command: 'keys path', path: credentialsPath(options) };
  if (action === 'list') {
    const data = await readCredentials(options), env = options.env ?? process.env;
    const providers = Object.entries(keyProviders).map(([name, config]) => {
      const environment = env[config.environment]?.trim(), stored = data[name]?.trim(), key = environment || stored;
      return { provider: name, configured: Boolean(key), source: environment ? 'environment' : stored ? 'file' : null, masked: key ? maskKey(key) : null };
    });
    return { ok: true, command: 'keys list', providers };
  }
  keyProvider(provider);
  if (action === 'remove') {
    const removed = await removeKey(provider, options), overridden = Boolean((options.env ?? process.env)[keyProvider(provider).environment]?.trim());
    return { ok: true, command: 'keys remove', provider, removed, message: overridden ? 'File key removed if present; environment key remains active.' : removed ? 'Stored key removed.' : 'No stored key to remove.' };
  }
  if (action !== 'set') throw new Error('Usage: motion-mania keys set <provider> [--validate] | list | remove <provider> | path');
  const key = checkedKey(await readKey({ input, output }));
  const validation = validate ? await validateKey(provider, key, { fetch }) : { status: 'skipped', message: 'Key stored without validation; use --validate to check with the provider.' };
  if (validation.status !== 'rejected') await setKey(provider, key, options);
  return { ok: validation.status !== 'rejected', command: 'keys set', provider, stored: validation.status !== 'rejected', validation, message: (options.env ?? process.env)[keyProvider(provider).environment]?.trim() ? 'Environment key takes precedence over the stored key.' : undefined };
}
