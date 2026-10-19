#!/usr/bin/env node
// Read-only metadata inventory. Never exports tokens, policy identities or DB rows.
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const ADMIN_ACCOUNT_ID = 'ef250a88911fd24073cb73d1c07e0218';
const relevantWorker = name => /^(?:takosan-admin|takolio-admin)(?:-|$)/.test(name) || ['frigo', 'frigo-staging'].includes(name);

export async function auditAdminInfrastructure(token, fetcher = fetch) {
  if (!token) throw new Error('Cloudflare audit credential unavailable');
  const base = `/accounts/${ADMIN_ACCOUNT_ID}`;
  const read = async route => {
    const response = await fetcher(`https://api.cloudflare.com/client/v4${route}`, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Metadata endpoint unavailable (HTTP ${response.status})`);
    const value = await response.json();
    if (value.success !== true) throw new Error('Metadata endpoint rejected request');
    return value;
  };
  const list = async (route, singlePage = false) => {
    const rows = [];
    for (let page = 1; page <= 100; page++) {
      const value = await read(singlePage ? route : `${route}${route.includes('?') ? '&' : '?'}page=${page}&per_page=50`);
      if (!Array.isArray(value.result)) throw new Error('Invalid metadata inventory');
      rows.push(...value.result);
      const info = value.result_info;
      if (singlePage) {
        if (info?.total_pages > 1 || (info?.total_count !== undefined && info.total_count !== rows.length)) throw new Error('Truncated metadata inventory');
        return rows;
      }
      if (info?.page !== undefined && info.page !== page) throw new Error('Invalid metadata pagination');
      if (info?.total_pages !== undefined) {
        if (!Number.isInteger(info.total_pages) || info.total_pages < 0 || (info.total_pages === 0 && (page !== 1 || rows.length))) throw new Error('Invalid metadata pagination');
        if (page >= info.total_pages) {
          if (info.total_count !== undefined && info.total_count !== rows.length) throw new Error('Truncated metadata inventory');
          return rows;
        }
      } else if (value.result.length < 50) return rows;
    }
    throw new Error('Metadata inventory limit exceeded');
  };
  const sections = {};
  const capture = async (name, task) => {
    try { sections[name] = { status: 'OBSERVED', value: await task() }; }
    catch (error) { sections[name] = { status: 'PENDING_EXTERNAL_EVIDENCE', reason: /^Metadata endpoint unavailable \(HTTP [0-9]{3}\)$/.test(error.message) ? error.message : 'Metadata inventory could not be verified' }; }
  };
  await Promise.all([
    capture('databases', async () => (await list(`${base}/d1/database`)).filter(d => /^(?:frigo|takosan-admin|takolio-admin)/.test(d.name ?? '')).map(d => ({ id: d.uuid, name: d.name }))),
    capture('kvNamespaces', async () => (await list(`${base}/storage/kv/namespaces`)).filter(k => /^(?:frigo|takosan|takolio)/i.test(k.title ?? '')).map(k => ({ id: k.id, title: k.title }))),
    capture('accessApplications', async () => (await list(`${base}/access/apps`)).filter(a => /^(?:takosan|takolio) admin/i.test(a.name ?? '') || /^(?:admin|admin-staging)\.takolio\.app$/.test(a.domain ?? ''))
      .map(a => ({ id: a.id, name: a.name, domain: a.domain, type: a.type, audience: a.aud }))),
    capture('accessOrganization', async () => ({ authDomain: (await read(`${base}/access/organizations`)).result?.auth_domain })),
    capture('domains', async () => (await list(`${base}/workers/domains`, true)).filter(d => relevantWorker(d.service ?? '') || /^(?:admin|admin-staging)\.takolio\.app$/.test(d.hostname ?? ''))
      .map(d => ({ id: d.id, hostname: d.hostname, worker: d.service, zoneId: d.zone_id }))),
    capture('zones', async () => (await list(`/zones?account.id=${ADMIN_ACCOUNT_ID}`)).filter(z => z.name === 'takolio.app').map(z => ({ id: z.id, name: z.name, status: z.status }))),
    capture('workers', async () => {
      const workers = (await list(`${base}/workers/scripts`, true)).filter(w => relevantWorker(w.id ?? ''));
      return Promise.all(workers.map(async w => {
        const { result: settings } = await read(`${base}/workers/scripts/${w.id}/settings`);
        return { name: w.id, bindings: (settings.bindings ?? []).flatMap(b => {
          if (b.type === 'd1') return [{ name: b.name, type: b.type, id: b.id }];
          if (b.type === 'kv_namespace') return [{ name: b.name, type: b.type, id: b.namespace_id }];
          if (b.type === 'service') return [{ name: b.name, type: b.type, service: b.service, entrypoint: b.entrypoint }];
          if (b.type === 'plain_text' && ['ENVIRONMENT', 'GIT_COMMIT', 'ADMIN_SCHEMA_VERSION', 'ADMIN_CONSOLE_ENABLED', 'ADMIN_AUTH_MODE', 'ADMIN_SHUTDOWN'].includes(b.name)) return [{ name: b.name, type: b.type, value: b.text }];
          return [];
        }) };
      }));
    }),
  ]);
  return { version: 1, accountId: ADMIN_ACCOUNT_ID, observedAt: new Date().toISOString(), mode: 'read-only-metadata',
    remoteMutations: false, readyForDeployment: false, sections };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw new Error('No endpoint or command arguments accepted');
    const report = await auditAdminInfrastructure(process.env.CLOUDFLARE_API_TOKEN);
    mkdirSync('.artifacts/admin-infrastructure', { recursive: true });
    writeFileSync('.artifacts/admin-infrastructure/audit.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    console.log(JSON.stringify({ mode: report.mode, remoteMutations: false,
      sections: Object.fromEntries(Object.entries(report.sections).map(([name, section]) => [name, section.status])) }));
  } catch {
    console.error('Admin metadata audit failed; credential values and provider bodies are suppressed');
    process.exitCode = 1;
  }
}
