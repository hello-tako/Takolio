import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const origins = new Set(['https://staging.takolio.app', 'https://api-staging.takolio.app',
  'https://frigo-staging.tungbipdz.workers.dev']);

export function accessHeaders(url, env = process.env) {
  const id = env.CF_ACCESS_CLIENT_ID;
  const secret = env.CF_ACCESS_CLIENT_SECRET;
  if (!id && !secret) return {};
  if (!id || !secret || !/^[A-Za-z0-9_.-]{20,256}$/.test(id) || !/^[A-Za-z0-9_.-]{20,256}$/.test(secret)) {
    throw new Error('Incomplete or invalid staging Access credentials');
  }
  const target = new URL(url);
  if (!origins.has(target.origin) || target.username || target.password) {
    throw new Error('Access credentials may only be sent to approved staging origins');
  }
  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret };
}

function validateCurlArgs(args) {
  const url = args.at(-1);
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Release curl requires one HTTPS URL');
  const switches = new Set(['--disable', '--silent', '-sS', '--show-error', '--fail', '--suppress-connect-headers']);
  const values = {
    '--max-time': (v) => /^(?:[0-9]+)(?:\.[0-9]+)?$/.test(v) && Number(v) > 0 && Number(v) <= 30,
    '--request': (v) => v === 'GET',
    '--proto': (v) => v === '=https',
    '--dump-header': (v) => v === '-', '-D': (v) => v === '-',
    '--output': (v) => v === '/dev/null', '-o': (v) => v === '/dev/null',
    '--write-out': (v) => v === '%{http_code}', '-w': (v) => v === '%{http_code}',
    '--header': (v) => /^(?:Accept|Cache-Control): [A-Za-z0-9, /;*=-]+$/.test(v),
  };
  for (let index = 0; index < args.length - 1; index++) {
    const flag = args[index];
    if (switches.has(flag)) continue;
    if (!Object.hasOwn(values, flag) || index + 1 >= args.length - 1 || !values[flag](args[++index])) {
      throw new Error('Release curl only permits read-only smoke options and forbids redirects');
    }
  }
  return url;
}

// Credentials go through stdin, never curl argv, a file, a URL or an error message.
export async function accessCurl(args, { env = process.env, spawnImpl = spawn } = {}) {
  const url = validateCurlArgs(args);
  const headers = accessHeaders(url, env);
  const lines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\n');
  const child = spawnImpl('curl', ['--disable', '--proto', '=https',
    ...(lines ? ['--header', '@-'] : []), ...args], { env, stdio: ['pipe', 'inherit', 'pipe'] });
  let stderrBytes = 0;
  child.stderr.on('data', (chunk) => { stderrBytes += chunk.length; });
  const code = await new Promise((resolve) => {
    child.once('error', () => resolve(1));
    child.once('close', (value) => resolve(value ?? 1));
    child.stdin.on('error', () => {});
    child.stdin.end(lines ? `${lines}\n` : '');
  });
  if (code !== 0) throw new Error(`Release curl failed (exit ${code}; diagnostic bytes ${stderrBytes})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  accessCurl(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'Release curl failed');
    process.exitCode = 1;
  });
}

export async function stagingFetch(url, init = {}, { env = process.env, fetchImpl = fetch } = {}) {
  if (!env.CF_ACCESS_CLIENT_ID || !env.CF_ACCESS_CLIENT_SECRET) throw new Error('Staging Access credentials are required');
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries(accessHeaders(url, env))) headers.set(name, value);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(init.method ?? 'GET') || init.body !== undefined) {
    throw new Error('Staging release transport permits read-only requests only');
  }
  let response;
  try {
    response = await fetchImpl(url, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(15000), redirect: 'manual', credentials: 'omit' });
  } catch { throw new TypeError('Staging Access request failed'); }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Staging Access rejected a redirect (HTTP ${response.status}); credentials were not forwarded`);
  }
  return response;
}

export async function stagingCurlExecute(command, args, options, url, env = process.env) {
  if (command !== 'curl') throw new Error('Staging native transport only supports curl');
  if (validateCurlArgs(args) !== String(url) || !Number.isSafeInteger(options.maxBuffer) || options.maxBuffer < 1 || options.maxBuffer > 1024 * 1024) {
    throw new Error('Invalid native staging request');
  }
  const headers = accessHeaders(url, env);
  if (!Object.keys(headers).length) throw new Error('Staging Access credentials are required');
  const lines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`).join('\n');
  return new Promise((resolve, reject) => {
    const child = spawn('curl', ['--disable', '--header', '@-', ...args], { env, stdio: ['pipe', 'pipe', 'pipe'], signal: options.signal });
    const chunks = [];
    let size = 0;
    let failed = false;
    child.stdout.on('data', (chunk) => {
      size += chunk.length;
      if (size > options.maxBuffer) { failed = true; child.kill(); } else chunks.push(chunk);
    });
    child.stderr.on('data', () => {});
    child.once('error', () => { failed = true; });
    child.once('close', (code) => {
      if (code !== 0 || failed) reject(new Error('Staging native request failed'));
      else resolve({ stdout: Buffer.concat(chunks) });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(`${lines}\n`);
  });
}
