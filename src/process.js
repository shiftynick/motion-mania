import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
export const backendVersion = '0.8.81';
export const backendPath = path.join(path.dirname(require.resolve('hyperframes/package.json')), 'bin/hyperframes.mjs');

// All subprocesses use argument arrays. Backend chatter never contaminates JSON stdout.
export function run(command, args, { cwd, quiet = false, allowFailure = false, timeout = 600_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd, shell: false, env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', expired = false;
    const timer = setTimeout(() => { expired = true; child.kill('SIGTERM'); }, timeout);
    const interrupt = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    const cleanup = () => { clearTimeout(timer); process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); };
    child.stdout.on('data', data => { stdout += data; if (!quiet) process.stderr.write(data); });
    child.stderr.on('data', data => { stderr += data; if (!quiet) process.stderr.write(data); });
    child.on('error', error => { cleanup(); reject(new Error(`${command}: ${error.message}`)); });
    child.on('close', (code, signal) => {
      cleanup();
      const result = { code, signal, stdout, stderr };
      if (expired || signal || (code !== 0 && !allowFailure)) {
        reject(new Error(`${path.basename(command)} ${args[0] ?? ''} ${expired ? 'timed out' : `failed (${signal ?? code})`}: ${(stderr || stdout).slice(-3000)}`));
      } else resolve(result);
    });
  });
}

export const hf = (args, options) => run(process.execPath, [backendPath, ...args], options);

export async function probe(file) {
  const result = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { quiet: true });
  return JSON.parse(result.stdout);
}
