import { createHmac } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const targets = {
  staging: 'https://frigo-staging.tungbipdz.workers.dev',
  production: 'https://frigo.tungjpstore.net',
};
const endpoint = '/api/v1/billing/payos/webhook';
const provider = 'https://api-merchant.payos.vn';

export function readCredentials(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.size > 4096) {
    throw new Error('Credential file must be a private regular file (0600)');
  }
  const value = JSON.parse(readFileSync(path, 'utf8'));
  const keys = ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY'];
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || keys.some((key) =>
        typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 512)) {
    throw new Error('Invalid credential file');
  }
  return value;
}

export function channelPlan(environment) {
  if (!Object.hasOwn(targets, environment)) throw new Error('Expected staging or production');
  return { environment, webhookUrl: targets[environment] + endpoint };
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Invalid provider response');
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64 * 1024) throw new Error('Invalid provider response');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function confirmChannel(environment, credentials, fetcher = fetch) {
  const plan = channelPlan(environment);
  // Verify this deployment accepts signed probes without submitting a purchase.
  const data = { orderCode: 123, amount: 3000, currency: 'VND', description: 'VQRIO123',
    reference: 'TF230204212323', code: '00' };
  const canonical = Object.keys(data).sort().map((key) => `${key}=${data[key]}`).join('&');
  const signature = createHmac('sha256', credentials.PAYOS_CHECKSUM_KEY).update(canonical).digest('hex');
  const probe = await fetcher(plan.webhookUrl, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data, signature }),
  });
  const probeBody = await boundedJson(probe);
  if (probe.status !== 200 || probeBody?.success !== true) throw new Error('Signed webhook preflight failed');
  const response = await fetcher(`${provider}/confirm-webhook`, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { 'Content-Type': 'application/json', 'x-client-id': credentials.PAYOS_CLIENT_ID,
      'x-api-key': credentials.PAYOS_API_KEY }, body: JSON.stringify({ webhookUrl: plan.webhookUrl }),
  });
  const result = await boundedJson(response);
  if (!response.ok || result?.code !== '00' || result?.data?.webhookUrl !== plan.webhookUrl) {
    throw new Error('Provider webhook confirmation failed');
  }
  return { ...plan, confirmed: true };
}

export async function main(args) {
  const values = new Map();
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--confirm-webhook' || args[i] === '--dry-run') {
      if (values.has(args[i])) throw new Error('Duplicate option');
      values.set(args[i], true);
    } else if (['--env', '--credentials'].includes(args[i]) && args[i + 1] && !args[i + 1].startsWith('--')) {
      if (values.has(args[i])) throw new Error('Duplicate option');
      values.set(args[i], args[++i]);
    } else throw new Error('Invalid option');
  }
  const plan = channelPlan(values.get('--env'));
  if (!values.has('--confirm-webhook') || values.has('--dry-run')) return { ...plan, confirmed: false, dryRun: true };
  if (!values.has('--credentials')) throw new Error('A private credential file is required');
  return confirmChannel(plan.environment, readCredentials(values.get('--credentials')));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).then((result) => console.log(JSON.stringify(result))).catch(() => {
    // Provider payloads, credential paths and arbitrary errors must never reach logs.
    console.error('payOS channel setup failed; verify deployment, private credentials and webhook health.');
    process.exitCode = 1;
  });
}
