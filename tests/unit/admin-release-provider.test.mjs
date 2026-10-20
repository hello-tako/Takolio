import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import shutdownWorker from '../../src/worker/admin-shutdown-worker.mjs';
import { createProvider } from '../../scripts/admin-release-provider.mjs';

const target = { accountId: 'a'.repeat(32), adminWorker: 'takosan-admin-staging', facadeWorker: 'takosan-admin-read-facade-staging',
  adminDatabaseId: '11111111-1111-4111-8111-111111111111', adminDatabaseName: 'admin-staging-db',
  customerDatabaseId: '22222222-2222-4222-8222-222222222222', customerDatabaseName: 'customer-staging-db',
  kvId: 'b'.repeat(32), zoneId: 'c'.repeat(32), hostname: 'admin.takosan.com', issuer: 'https://team.cloudflareaccess.com',
  accessApplicationId: '33333333-3333-4333-8333-333333333333', audience: 'd'.repeat(64) };
const context = { sourceSha: 'e'.repeat(40), runId: '42', environment: 'staging', operation: 'deploy-disabled' };
const authorized = { target, manifest: { expiresAt: new Date(Date.now() + 3600000).toISOString() } };
const cloudflare = result => new Response(JSON.stringify({ success: true, result }), { headers: { 'Content-Type': 'application/json' } });
const d1 = rows => cloudflare([{ success: true, results: rows }]);

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint/package.json'))('js-yaml');

describe('Admin release provider boundaries', () => {
  it('constructs the provider without any network call or command', () => {
    const fetcher = vi.fn(), command = vi.fn();
    createProvider(authorized, context, {}, fetcher, command);
    expect(fetcher).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it('reads GitHub facts only from the migrated repository API', async () => {
    const fetcher = vi.fn(async () => Response.json({}));
    const provider = createProvider(authorized, context, { GH_TOKEN: 'synthetic' }, fetcher, vi.fn());
    await provider.githubFacts();
    expect(fetcher).toHaveBeenCalledTimes(8);
    for (const [url] of fetcher.mock.calls) {
      expect(new URL(url).origin).toBe('https://api.github.com');
      expect(new URL(url).pathname).toMatch(/^\/repos\/hello-tako\/Takolio(?:\/|$)/);
    }
  });

  it('fails before an HTTP request when the credential is missing', async () => {
    const fetcher = vi.fn(), command = vi.fn();
    const provider = createProvider(authorized, context, {}, fetcher, command);
    await expect(provider.githubFacts()).rejects.toThrow('credential');
    await expect(provider.verifyTargets(target)).rejects.toThrow('credential');
    expect(fetcher).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it('uses only the allowlisted Admin D1 query endpoint for ledger checks', async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.sql.includes('sqlite_master')) return d1([]);
      throw new Error('unexpected SQL');
    });
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic-token' }, fetcher, vi.fn());
    await provider.verifyLedger(target, [], false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/d1/database/${target.adminDatabaseId}/query`);
    expect(fetcher.mock.calls[0][0]).not.toContain(target.customerDatabaseId);
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  });

  it('rejects a mismatched existing authority before any insert', async () => {
    const fetcher = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      return body.sql.includes('sqlite_master') ? d1([{ name: 'admin_database_identity' }]) : d1([{ identity: 'wrong', environment: 'production' }]);
    });
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic-token' }, fetcher, vi.fn());
    await expect(provider.verifyExistingDatabaseIdentity(target, 'staging')).rejects.toThrow('mismatch');
    expect(fetcher.mock.calls.every(([, init]) => JSON.parse(init.body).sql.startsWith('SELECT'))).toBe(true);
  });

  it('rejects incomplete or unsuccessful D1 results', async () => {
    for (const result of [[], [{}], [{ success: false, results: [] }], [{ success: true }]]) {
      const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic-token' }, async () => cloudflare(result), vi.fn());
      await expect(provider.verifyDatabaseIdentity(target, 'staging')).rejects.toThrow();
    }
  });

  it('does not switch an enabled or unrelated rollback version', async () => {
    const command = vi.fn();
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic-token' }, async () => cloudflare({ id: 'version', resources: { bindings: [] } }), command);
    await expect(provider.verifyRollback(target, { adminVersion: 'version', facadeVersion: 'another', previousSha: context.sourceSha })).rejects.toThrow();
    expect(command.mock.calls.every(([executable]) => executable === 'git')).toBe(true);
  });

  it.each(['admin-staging-deploy.yml', 'admin-production-deploy.yml', 'admin-d1-migrate.yml', 'admin-breakglass.yml', 'admin-emergency-disable.yml'])('keeps %s manual, pinned, default-off and independently gated', file => {
    const source = readFileSync(`.github/workflows/${file}`, 'utf8');
    const workflow = load(source);
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs.execute.default).toBe(false);
    expect(workflow.permissions).toEqual({ contents: 'read', actions: 'read' });
    expect(workflow.jobs.execute.environment).toMatch(/^admin-/);
    expect(workflow.jobs.execute.if).toContain("vars.ADMIN_RELEASE_EXECUTION_ENABLED == 'true'");
    expect(workflow.jobs.execute.if).toContain("github.ref == 'refs/heads/main'");
    expect(workflow.jobs.execute.if).toContain('github.run_attempt == 1');
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps) if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    }
    const steps = workflow.jobs.execute.steps;
    const audit = steps.findIndex(s => s.name?.startsWith('Persist pre-action'));
    const mutate = steps.findIndex(s => s.name?.startsWith('Execute fixed'));
    expect(audit).toBeGreaterThan(0);
    expect(mutate).toBeGreaterThan(audit);
    expect(steps.slice(0, mutate).some(s => Object.keys(s.env ?? {}).includes('CLOUDFLARE_API_TOKEN'))).toBe(false);
    expect(source).not.toContain('wrangler d1 execute');
    expect(source).not.toContain('pull_request_target');
    expect(workflow.concurrency['cancel-in-progress']).toBe(false);
    expect(workflow.concurrency.group).not.toContain('github.ref');
  });
});

function providerFacts(mutate = () => {}) {
  const a = { bindings: [
    { name: 'ENVIRONMENT', type: 'plain_text', text: context.environment },
    { name: 'ADMIN_DB', type: 'd1', id: target.adminDatabaseId },
    { name: 'CACHE', type: 'kv_namespace', namespace_id: target.kvId },
    { name: 'CUSTOMER_READ', type: 'service', service: target.facadeWorker, entrypoint: 'AdminCustomerReadFacade' },
  ] };
  const f = { bindings: [{ name: 'DB', type: 'd1', id: target.customerDatabaseId }] };
  const facts = { a, f, domains: [{ hostname: target.hostname, service: target.adminWorker, zone_id: target.zoneId }],
    subdomain: { enabled: false, previews_enabled: false }, workers: [], dns: [], routes: [], zones: [{ id: target.zoneId, account: { id: target.accountId } }] };
  mutate(facts);
  return vi.fn(async url => {
    const route = new URL(url).pathname;
    if (route.endsWith(`/d1/database/${target.adminDatabaseId}`)) return cloudflare({ uuid: target.adminDatabaseId, name: target.adminDatabaseName });
    if (route.endsWith(`/d1/database/${target.customerDatabaseId}`)) return cloudflare({ uuid: target.customerDatabaseId, name: target.customerDatabaseName });
    if (route.endsWith('/storage/kv/namespaces')) return cloudflare([{ id: target.kvId }]);
    if (route.endsWith(`/access/apps/${target.accessApplicationId}`)) return cloudflare({ id: target.accessApplicationId, aud: target.audience, domain: target.hostname, type: 'self_hosted' });
    if (route.endsWith('/zones')) return cloudflare(facts.zones);
    if (route.endsWith('/dns_records')) return cloudflare(facts.dns);
    if (route.endsWith('/workers/scripts')) return cloudflare(facts.workers);
    if (route.endsWith('/workers/routes')) return cloudflare(facts.routes);
    if (route.endsWith('/workers/domains')) return cloudflare(facts.domains);
    if (route.endsWith(`/zones/${target.zoneId}`)) return cloudflare({ id: target.zoneId, account: { id: target.accountId }, name: 'takosan.com' });
    if (route.endsWith('/access/organizations')) return cloudflare({ auth_domain: 'team.cloudflareaccess.com' });
    if (route.endsWith('/subdomain')) return cloudflare(facts.subdomain);
    if (route.endsWith(`/scripts/${target.adminWorker}/settings`)) return cloudflare(facts.a);
    if (route.endsWith(`/scripts/${target.facadeWorker}/settings`)) return cloudflare(facts.f);
    for (const [worker, bindings, versionId] of [[target.adminWorker, facts.a.bindings, '11111111-1111-4111-8111-111111111111'],
      [target.facadeWorker, facts.f.bindings, '22222222-2222-4222-8222-222222222222']]) {
      if (route.endsWith(`/scripts/${worker}/deployments`)) return cloudflare({ deployments: [{
        id: '33333333-3333-4333-8333-333333333333', versions: [{ version_id: versionId, percentage: 100 }],
      }] });
      if (route.endsWith(`/scripts/${worker}/versions/${versionId}`)) return cloudflare({ id: versionId, resources: { bindings } });
    }
    throw new Error('Unexpected provider endpoint');
  });
}

describe('Admin provider live-identity contract with offline provider fixtures', () => {
  it('accepts only the exact account, zone, custom domain, Access and binding identities', async () => {
    const fetcher = providerFacts();
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic-token' }, fetcher, vi.fn());
    await expect(provider.verifyTargets(target)).resolves.toBeUndefined();
    expect(fetcher.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });

  it('allows first initialization only when both Workers and the hostname are absent', async () => {
    const fetcher = providerFacts(f => { f.domains = []; });
    const command = vi.fn();
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, command);
    await expect(provider.verifyInitialTargets(target)).resolves.toBeUndefined();
    expect(command).not.toHaveBeenCalled();
  });

  it.each([
    ['Admin exists', f => { f.domains = []; f.workers = [{ id: target.adminWorker }]; }],
    ['facade exists', f => { f.domains = []; f.workers = [{ id: target.facadeWorker }]; }],
    ['hostname exists', () => {}],
    ['DNS record exists', f => { f.domains = []; f.dns = [{ name: target.hostname }]; }],
    ['facade has a route', f => { f.domains = []; f.routes = [{ script: target.facadeWorker }]; }],
  ])('refuses initialization when %s', async (_name, change) => {
    const command = vi.fn();
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, providerFacts(change), command);
    await expect(provider.verifyInitialTargets(target)).rejects.toThrow();
    expect(command).not.toHaveBeenCalled();
  });

  it.each([
    ['missing mapping', f => { f.domains = []; }],
    ['wrong Worker mapping', f => { f.domains[0].service = 'unrelated-worker'; }],
    ['wrong zone mapping', f => { f.domains[0].zone_id = 'f'.repeat(32); }],
    ['unrelated Admin custom domain', f => { f.domains.push({ service: target.adminWorker, hostname: 'unrelated.takosan.com' }); }],
    ['Admin zone route', f => { f.routes.push({ script: target.adminWorker }); }],
    ['public facade custom domain', f => { f.domains.push({ service: target.facadeWorker }); }],
    ['public facade route', f => { f.routes.push({ script: target.facadeWorker }); }],
    ['workers.dev facade', f => { f.subdomain.enabled = true; }],
    ['preview facade', f => { f.subdomain.previews_enabled = true; }],
    ['wrong Admin DB binding', f => { f.a.bindings[1].id = target.customerDatabaseId; }],
    ['wrong facade DB binding', f => { f.f.bindings[0].id = target.adminDatabaseId; }],
    ['extra Admin customer DB', f => { f.a.bindings.push({ name: 'DB', type: 'd1', id: target.customerDatabaseId }); }],
    ['wrong service entrypoint', f => { f.a.bindings[3].entrypoint = 'UnrestrictedFacade'; }],
  ])('rejects %s with no mutation', async (_name, mutate) => {
    const command = vi.fn();
    const fetcher = providerFacts(mutate);
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic-token' }, fetcher, command);
    await expect(provider.verifyTargets(target)).rejects.toThrow();
    expect(command).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.every(([, options]) => !options.method || options.method === 'GET')).toBe(true);
  });
});

describe('Containment and disabled smoke', () => {
  const shutdownSettings = () => ({ bindings: [
    ...Object.entries({ ENVIRONMENT: context.environment, ADMIN_CONSOLE_ENABLED: 'false', GIT_COMMIT: context.sourceSha, ADMIN_SHUTDOWN: 'true' })
      .map(([name, text]) => ({ name, text, type: 'plain_text' })),
    { name: 'ADMIN_AUDIT_HMAC_SECRET', type: 'secret_text' },
  ] });
  const smokeFixture = (response = () => shutdownWorker.fetch(), settings = shutdownSettings()) => {
    const base = providerFacts(f => { f.a = settings; });
    return vi.fn((url, options) => new URL(url).hostname === target.hostname ? response(url, options) : base(url, options));
  };

  it('denies every method and path without accessing environment dependencies', async () => {
    for (const method of ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']) {
      const response = shutdownWorker.fetch(new Request(`https://${target.hostname}/api/v1/admin/me`, { method }), new Proxy({}, { get() { throw new Error('Dependency accessed'); } }));
      expect(response.status).toBe(404);
      expect(response.headers.get('x-admin-disabled')).toBe('true');
      expect(await response.text()).toBe('Not Found');
    }
  });

  it('probes the real API and protected built favicon without a database, facade, or build', async () => {
    const fetcher = smokeFixture();
    const provider = createProvider(authorized, { ...context, operation: 'disable' }, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, vi.fn());
    await provider.verifyDisabled(target, context.sourceSha, true);
    expect(fetcher.mock.calls.filter(([url]) => new URL(url).hostname === target.hostname).map(([url]) => new URL(url).pathname))
      .toEqual(['/admin', '/admin/login', '/api/v1/admin/me', '/admin/favicon.svg']);
    expect(fetcher.mock.calls.every(([url]) => !/\/d1\/|\/access\/|facade|\/kv\//.test(url))).toBe(true);
  });

  it.each([
    ['unrelated 404', () => new Response('Not Found', { status: 404 })],
    ['unrelated 403', () => new Response('Forbidden', { status: 403 })],
    ['public page', () => new Response('Admin secrets')],
    ['unrelated tenant path', () => new Response(null, { status: 302, headers: { location: `${target.issuer}/cdn-cgi/access/loginevil` } })],
    ['foreign Access redirect', () => new Response(null, { status: 302, headers: { location: 'https://evil.cloudflareaccess.com/cdn-cgi/access/login' } })],
  ])('rejects %s as shutdown evidence', async (_name, response) => {
    const provider = createProvider(authorized, { ...context, operation: 'disable' }, { CLOUDFLARE_API_TOKEN: 'synthetic' }, smokeFixture(response), vi.fn());
    await expect(provider.verifyDisabled(target, context.sourceSha, true)).rejects.toThrow('smoke');
  });

  it('accepts only the exact tenant Access login redirect', async () => {
    const provider = createProvider(authorized, { ...context, operation: 'disable' }, { CLOUDFLARE_API_TOKEN: 'synthetic' },
      smokeFixture(() => new Response(null, { status: 302, headers: { location: `${target.issuer}/cdn-cgi/access/login` } })), vi.fn());
    await expect(provider.verifyDisabled(target, context.sourceSha, true)).resolves.toBeUndefined();
  });

  it('rejects a shutdown deployment retaining data or service capabilities', async () => {
    const settings = shutdownSettings();
    settings.bindings.push({ name: 'ADMIN_DB', type: 'd1', id: target.adminDatabaseId });
    const provider = createProvider(authorized, { ...context, operation: 'disable' }, { CLOUDFLARE_API_TOKEN: 'synthetic' }, smokeFixture(undefined, settings), vi.fn());
    await expect(provider.verifyDisabled(target, context.sourceSha, true)).rejects.toThrow('metadata');
  });

  it('can restore approved disabled versions after shutdown without accepting that state for ordinary deployment', async () => {
    const fetcher = providerFacts(f => { f.a = shutdownSettings(); });
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, vi.fn());
    await expect(provider.verifyTargets(target, context.environment, true)).resolves.toBeUndefined();
    await expect(provider.verifyTargets(target)).rejects.toThrow('binding');
  });

  it('verifies restored data bindings from the serving version even while latest-upload settings still show shutdown', async () => {
    const active = providerFacts();
    const fetcher = vi.fn((url, options) => url.endsWith('/settings') ? cloudflare(shutdownSettings()) : active(url, options));
    const command = vi.fn();
    const provider = createProvider(authorized, { ...context, operation: 'rollback-disabled' }, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, command);
    await expect(provider.verifyTargets(target)).resolves.toBeUndefined();
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/settings'))).toBe(false);
    expect(command).not.toHaveBeenCalled();
  });

  it('enumerates subsequent account zones and rejects facade routes outside the Admin zone', async () => {
    const base = providerFacts();
    const otherZone = 'f'.repeat(32);
    const fetcher = vi.fn((url, options) => {
      const u = new URL(url);
      if (u.pathname.endsWith('/zones')) return new Response(JSON.stringify({ success: true,
        result: [{ id: u.searchParams.get('page') === '1' ? target.zoneId : otherZone, account: { id: target.accountId } }],
        result_info: { page: Number(u.searchParams.get('page')), total_pages: 2 } }));
      if (u.pathname.endsWith(`/zones/${otherZone}/workers/routes`)) return cloudflare([{ script: target.facadeWorker }]);
      return base(url, options);
    });
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, vi.fn());
    await expect(provider.verifyTargets(target)).rejects.toThrow('public route');
    expect(fetcher.mock.calls.some(([url]) => url.includes('page=2'))).toBe(true);
  });

  it('leaves containment active when a shutdown baseline must be restored', async () => {
    const provider = createProvider(authorized, { ...context, operation: 'disable' }, {}, vi.fn(), vi.fn());
    vi.spyOn(provider, 'shutdown').mockResolvedValue();
    vi.spyOn(provider, 'verifyDisabled').mockResolvedValue();
    await provider.restoreRollback({ shutdown: true });
    expect(provider.shutdown).toHaveBeenCalledOnce();
    expect(provider.verifyDisabled).toHaveBeenCalledWith(target, context.sourceSha, true);
  });

  it('uses an independent containment workflow lane without a frontend build or staging certificate', () => {
    const workflow = load(readFileSync('.github/workflows/admin-emergency-disable.yml', 'utf8'));
    expect(workflow.jobs.execute.needs).toBeUndefined();
    expect(workflow.concurrency.group).toContain('admin-containment-');
    expect(workflow.jobs.execute.steps.some(s => /build|dry-run/.test(s.run ?? ''))).toBe(false);
    expect(workflow.jobs.execute.steps.some(s => s.env?.ADMIN_STAGING_CERTIFICATION)).toBe(false);
  });
});


describe('Staging artifact authority', () => {
  const certificate = { artifactId: '123', artifactDigest: 'a'.repeat(64) };
  const fixture = () => ({ artifact: { name: 'admin-staging-certification-77', expired: false, digest: 'sha256:' + certificate.artifactDigest,
    workflow_run: { id: 77, head_sha: context.sourceSha } }, run: { id: 77, head_sha: context.sourceSha,
    path: '.github/workflows/admin-staging-deploy.yml', event: 'workflow_dispatch', run_attempt: 1, head_branch: 'main',
    status: 'completed', conclusion: 'success', repository: { id: 1422954151 } } });
  const providerFor = facts => createProvider(authorized, context, { GH_TOKEN: 'synthetic' },
    async url => new Response(JSON.stringify(url.includes('/artifacts/') ? facts.artifact : facts.run)), vi.fn());
  it('accepts only the signed artifact digest from the dedicated successful staging dispatch', async () => {
    await expect(providerFor(fixture()).verifyStagingArtifact(certificate)).resolves.toBeUndefined();
  });
  it.each([
    ['unrelated workflow', f => { f.run.path = '.github/workflows/ci.yml'; }],
    ['rerun', f => { f.run.run_attempt = 2; }],
    ['pull request', f => { f.run.event = 'pull_request'; }],
    ['wrong artifact digest', f => { f.artifact.digest = 'sha256:' + 'b'.repeat(64); }],
    ['wrong artifact name', f => { f.artifact.name = 'admin-staging-certification-99'; }],
    ['expired artifact', f => { f.artifact.expired = true; }],
    ['failed run', f => { f.run.conclusion = 'failure'; }],
    ['former repository', f => { f.run.repository.id = 1385308553; }],
  ])('rejects %s', async (_name, mutate) => {
    const facts = fixture();
    mutate(facts);
    await expect(providerFor(facts).verifyStagingArtifact(certificate)).rejects.toThrow();
  });
});

it('constructs a real shutdown config when rollback compensation starts from containment', async () => {
  const ctx = { ...context, operation: 'rollback-disabled', auditArtifactDigest: 'sha256:' + 'f'.repeat(64) };
  const command = vi.fn((_executable, args) => {
    const config = JSON.parse(readFileSync(args[args.indexOf('--config') + 1], 'utf8'));
    expect(config.name).toBe(target.adminWorker);
    expect(config.main).toMatch(/admin-shutdown-worker\.mjs$/);
    expect(config.vars.ADMIN_SHUTDOWN).toBe('true');
    for (const binding of ['d1_databases', 'kv_namespaces', 'services', 'assets']) expect(config[binding]).toBeUndefined();
    return '';
  });
  const provider = createProvider(authorized, ctx, {}, vi.fn(), command);
  vi.spyOn(provider, 'githubFacts').mockResolvedValue({
    repository: { id: 1422954151, full_name: 'hello-tako/Takolio', default_branch: 'main' },
    branch: { commit: { sha: ctx.sourceSha }, protected: true },
    protection: { enforce_admins: { enabled: true }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true },
      required_status_checks: { strict: true, contexts: ['validate-admin'] } },
    environment: { id: 1, can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [1] }],
      deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } },
    run: { id: 42, run_attempt: 1, event: 'workflow_dispatch', head_sha: ctx.sourceSha, head_branch: 'main',
      path: '.github/workflows/admin-staging-deploy.yml', actor: { id: 1, type: 'User' }, triggering_actor: { id: 1 }, repository: { id: 1422954151 } },
    ci: [{ head_sha: ctx.sourceSha, path: '.github/workflows/admin-ci.yml', status: 'completed', conclusion: 'success', event: 'push', repository: { id: 1422954151 } }],
    approvals: [{ state: 'approved', user: { type: 'User', id: 2 }, environments: [{ id: 1 }] }],
    artifact: { name: 'admin-pre-action-42', expired: false, digest: ctx.auditArtifactDigest, workflow_run: { id: 42, head_sha: ctx.sourceSha } },
  });
  vi.spyOn(provider, 'verifyDisabled').mockResolvedValue();
  await provider.restoreRollback({ shutdown: true });
  expect(command).toHaveBeenCalledOnce();
});

it('reads single-page domain and route inventories once even when they contain fifty entries', async () => {
  const base = providerFacts();
  const fetcher = vi.fn((url, options) => {
    const u = new URL(url);
    if (u.pathname.endsWith('/workers/domains')) {
      expect(u.search).toBe('');
      return cloudflare([{ hostname: target.hostname, service: target.adminWorker, zone_id: target.zoneId },
        ...Array.from({ length: 50 }, (_, i) => ({ hostname: `service-${i}.takosan.com`, service: `safe-${i}` }))]);
    }
    if (u.pathname.endsWith('/workers/routes')) {
      expect(u.search).toBe('');
      return cloudflare(Array.from({ length: 50 }, (_, i) => ({ script: `safe-${i}` })));
    }
    return base(url, options);
  });
  const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, vi.fn());
  await expect(provider.verifyTargets(target)).resolves.toBeUndefined();
  expect(fetcher.mock.calls.filter(([url]) => url.includes('/workers/routes')).length).toBe(1);
});

it('rejects an explicitly truncated domain inventory', async () => {
  const base = providerFacts();
  const fetcher = vi.fn((url, options) => url.includes('/workers/domains') ? new Response(JSON.stringify({ success: true,
    result: [{ hostname: target.hostname, service: target.adminWorker, zone_id: target.zoneId }], result_info: { total_count: 2 } })) : base(url, options));
  const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, vi.fn());
  await expect(provider.verifyTargets(target)).rejects.toThrow('Truncated');
});


it('produces only a validated, opt-in, protected staging report in the exact staging workflow', () => {
  const workflow = load(readFileSync('.github/workflows/admin-staging-deploy.yml', 'utf8'));
  expect(workflow.on.workflow_dispatch.inputs.certify.default).toBe(false);
  const job = workflow.jobs.certify;
  expect(job.environment).toBe('admin-staging');
  expect(job.if).toContain('inputs.certify == true');
  expect(job.steps.find(s => s.run?.includes('admin-staging-attest.mjs')).env.ADMIN_STAGING_REPORT).toContain('secrets.ADMIN_STAGING_REPORT');
  expect(job.steps.at(-1).with.name).toBe('admin-staging-certification-${{ github.run_id }}');
  expect(job.steps.some(s => s.env?.CLOUDFLARE_API_TOKEN)).toBe(false);
});

describe('Enabled Admin release checks', () => {
  function enabledFixture({ ownerCount = 1, marker = true, publicResponse, facadeSha = context.sourceSha } = {}) {
    const base = providerFacts(f => {
      f.a.bindings.push(...Object.entries({ ADMIN_CONSOLE_ENABLED: 'true', ADMIN_AUTH_MODE: 'cloudflare_access', GIT_COMMIT: context.sourceSha, ADMIN_SCHEMA_VERSION: '4' })
        .map(([name, text]) => ({ name, text, type: 'plain_text' })));
      f.f.bindings.push({ name: 'GIT_COMMIT', type: 'plain_text', text: facadeSha }, { name: 'ADMIN_SCHEMA_VERSION', type: 'plain_text', text: '4' });
    });
    return vi.fn((url, options) => {
      if (new URL(url).hostname === target.hostname) return publicResponse ? publicResponse() : new Response(null, { status: 302, headers: { location: `${target.issuer}/cdn-cgi/access/login/${target.hostname}` } });
      if (url.endsWith('/query')) {
        const { sql, params } = JSON.parse(options.body);
        if (sql.includes('admin_active_super_operators')) {
          expect(params).toEqual([target.issuer]);
          return d1([{ n: ownerCount }]);
        }
        if (sql.includes('bootstrap_completed_at')) return d1(marker ? [{ value: 'now' }] : []);
        throw new Error('Unexpected enablement query');
      }
      return base(url, options);
    });
  }

  it('requires a real enrolled owner and exact-source facade, and probes anonymous Access denial', async () => {
    const fetcher = enabledFixture();
    const command = vi.fn();
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, command);
    await expect(provider.verifyEnabled(target, context.sourceSha)).resolves.toBeUndefined();
    expect(fetcher.mock.calls.filter(([url]) => new URL(url).hostname === target.hostname)).toHaveLength(3);
    expect(command).not.toHaveBeenCalled();
  });

  it.each([
    ['missing owner', { ownerCount: 0 }],
    ['unbootstrapped owner', { marker: false }],
    ['old facade source', { facadeSha: 'f'.repeat(40) }],
    ['public Admin', { publicResponse: () => new Response('Admin') }],
    ['foreign issuer', { publicResponse: () => new Response(null, { status: 302, headers: { location: 'https://foreign.cloudflareaccess.com/cdn-cgi/access/login' } }) }],
    ['generic denial', { publicResponse: () => new Response(null, { status: 403 }) }],
  ])('fails enabled certification with %s', async (_name, options) => {
    const command = vi.fn();
    const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, enabledFixture(options), command);
    await expect(provider.verifyEnabled(target, context.sourceSha)).rejects.toThrow();
    expect(command).not.toHaveBeenCalled();
  });
});

describe('Protected initial HMAC provisioning', () => {
  function fixture({ authority = 0, failWrite = 0, mutate, invalidGitHub = false, staleUpload = false } = {}) {
    const ctx = { ...context, operation: 'provision-hmac', runAttempt: '1', auditArtifactDigest: 'sha256:' + 'f'.repeat(64) };
    const facts = {
      repository: { id: 1422954151, full_name: 'hello-tako/Takolio', default_branch: 'main' },
      branch: { protected: true, commit: { sha: ctx.sourceSha } },
      protection: { enforce_admins: { enabled: true }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true },
        required_status_checks: { strict: true, contexts: ['validate-admin'] } },
      environment: { id: 1, can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [1] }],
        deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } },
      run: { id: 42, run_attempt: 1, event: 'workflow_dispatch', head_sha: ctx.sourceSha, head_branch: 'main',
        path: '.github/workflows/admin-breakglass.yml', actor: { id: 1, type: 'User' }, triggering_actor: { id: 1 }, repository: { id: 1422954151 } },
      ci: [{ head_sha: ctx.sourceSha, path: '.github/workflows/admin-ci.yml', status: 'completed', conclusion: 'success', event: 'push', repository: { id: 1422954151 } }],
      approvals: invalidGitHub ? [] : [{ state: 'approved', user: { type: 'User', id: 2 }, environments: [{ id: 1 }] }],
      artifact: { name: 'admin-pre-action-42', expired: false, digest: ctx.auditArtifactDigest, workflow_run: { id: 42, head_sha: ctx.sourceSha } },
    };
    const base = providerFacts(f => {
      f.a.bindings.push({ name: 'ADMIN_CONSOLE_ENABLED', type: 'plain_text', text: 'false' }, { name: 'ADMIN_AUTH_MODE', type: 'plain_text', text: 'cloudflare_access' });
      mutate?.(f);
    });
    const writes = [];
    let checks = 0;
    const fetcher = vi.fn(async (url, options) => {
      if (staleUpload && url.endsWith('/settings')) return cloudflare({ bindings: [] });
      if (url.endsWith(`/d1/database/${target.adminDatabaseId}/query`)) {
        const { sql } = JSON.parse(options.body);
        expect(sql).toContain('admin_audit_events');
        expect(sql).toContain('admin_owner_enrollments');
        expect(sql.trim().startsWith('SELECT')).toBe(true);
        return d1([{ n: typeof authority === 'function' ? authority(checks++) : authority }]);
      }
      if (url.endsWith('/secrets')) {
        writes.push({ url, ...JSON.parse(options.body) });
        expect(options.method).toBe('PUT');
        if (failWrite === writes.length) return new Response('provider body is suppressed', { status: 503 });
        return cloudflare({ name: writes.at(-1).name, type: 'secret_text' });
      }
      return base(url, options);
    });
    const command = vi.fn();
    const provider = createProvider(authorized, ctx, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, command);
    vi.spyOn(provider, 'githubFacts').mockResolvedValue(facts);
    return { ctx, provider, fetcher, writes, command, facts };
  }

  it('generates distinct fresh secrets and writes a matching facade pair only to mapped Workers', async () => {
    const first = fixture();
    const result = await first.provider.provisionHmac();
    expect(result).toBeUndefined();
    expect(first.writes.map(w => [w.url, w.name, w.type])).toEqual([
      [`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/workers/scripts/${target.facadeWorker}/secrets`, 'ADMIN_FACADE_HMAC_SECRET', 'secret_text'],
      [`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/workers/scripts/${target.adminWorker}/secrets`, 'ADMIN_FACADE_HMAC_SECRET', 'secret_text'],
      [`https://api.cloudflare.com/client/v4/accounts/${target.accountId}/workers/scripts/${target.adminWorker}/secrets`, 'ADMIN_AUDIT_HMAC_SECRET', 'secret_text'],
    ]);
    expect(first.writes.every(w => /^[A-Za-z0-9_-]{43}$/.test(w.text))).toBe(true);
    expect(first.writes[0].text === first.writes[1].text).toBe(true);
    expect(first.writes[2].text !== first.writes[0].text).toBe(true);
    expect(first.provider.githubFacts).toHaveBeenCalledTimes(3);
    expect(first.command).not.toHaveBeenCalled();
    const second = fixture();
    await second.provider.provisionHmac();
    expect(second.writes[0].text !== first.writes[0].text).toBe(true);
    expect(second.writes[2].text !== first.writes[2].text).toBe(true);
  });

  it.each([1, '0', null, -1])('refuses nonempty or invalid authority count %s before writing', async authority => {
    const f = fixture({ authority });
    await expect(f.provider.provisionHmac()).rejects.toThrow('unused Admin authority');
    expect(f.writes).toHaveLength(0);
  });

  it('rechecks authority before every write and stops if authority appears', async () => {
    const f = fixture({ authority: check => check < 2 ? 0 : 1 });
    await expect(f.provider.provisionHmac()).rejects.toThrow('unused Admin authority');
    expect(f.writes).toHaveLength(1);
  });

  it('runs the unused-authority guard on real schema-4 and detects pre-enrollment audit history', async () => {
    const f = fixture();
    await f.provider.provisionHmac();
    const sql = JSON.parse(f.fetcher.mock.calls.find(([url]) => url.endsWith('/query'))[1].body).sql;
    const code = `import sqlite3,pathlib,sys,json
c=sqlite3.connect(':memory:')
for p in sorted(pathlib.Path('migrations-admin').iterdir()):
 if p.name.endswith('.sql'): c.executescript(p.read_text())
q=sys.stdin.read()
before=c.execute(q).fetchone()[0]
c.execute("INSERT INTO admin_audit_events(id,action,outcome) VALUES('test-audit-guard','test.guard','denied')")
print(json.dumps([before,c.execute(q).fetchone()[0]]))`;
    expect(JSON.parse(execFileSync('python3', ['-c', code], { input: sql, encoding: 'utf8' }))).toEqual([0, 1]);
  });

  it.each([
    ['enabled console', f => { f.a.bindings.find(b => b.name === 'ADMIN_CONSOLE_ENABLED').text = 'true'; }],
    ['foreign DB', f => { f.a.bindings.find(b => b.name === 'ADMIN_DB').id = target.customerDatabaseId; }],
    ['public facade', f => { f.subdomain.enabled = true; }],
  ])('refuses %s before writing', async (_name, mutate) => {
    const f = fixture({ mutate });
    await expect(f.provider.provisionHmac()).rejects.toThrow();
    expect(f.writes).toHaveLength(0);
  });

  it('requires protected independent approval before a secret write', async () => {
    const f = fixture({ invalidGitHub: true });
    await expect(f.provider.provisionHmac()).rejects.toThrow('Independent environment approval required');
    expect(f.writes).toHaveLength(0);
  });

  it('refuses a secret write when the latest upload differs from the verified serving version', async () => {
    const f = fixture({ staleUpload: true });
    await expect(f.provider.provisionHmac()).rejects.toThrow('Latest upload differs');
    expect(f.writes).toHaveLength(0);
    expect(f.command).not.toHaveBeenCalled();
  });

  it('requires the operation-specific workflow and immutable audit artifact before writes', async () => {
    for (const change of [f => { f.run.path = '.github/workflows/admin-staging-deploy.yml'; }, f => { f.artifact.expired = true; }]) {
      const f = fixture();
      change(f.facts);
      await expect(f.provider.provisionHmac()).rejects.toThrow();
      expect(f.writes).toHaveLength(0);
    }
  });

  it('stops after a partial failure without printing bodies, retrying or enabling', async () => {
    const f = fixture({ failWrite: 2 });
    await expect(f.provider.provisionHmac()).rejects.toThrow('Release provider HTTP 503');
    expect(f.writes).toHaveLength(2);
    expect(f.command).not.toHaveBeenCalled();
    expect(f.writes.every(w => !w.url.includes(target.customerDatabaseId))).toBe(true);
  });

  it('cannot provision from an unrelated operation', async () => {
    const provider = createProvider(authorized, context, {}, vi.fn(), vi.fn());
    await expect(provider.provisionHmac()).rejects.toThrow('Dedicated HMAC provisioning operation required');
  });

  it('exposes provisioning only in the protected serialized operator ceremony with no secret input', () => {
    const workflow = load(readFileSync('.github/workflows/admin-breakglass.yml', 'utf8'));
    expect(workflow.on.workflow_dispatch.inputs.operation.options).toEqual(['provision-hmac', 'enroll-owner', 'bootstrap', 'recover', 'enroll-staging-test', 'revoke-staging-test']);
    expect(Object.keys(workflow.on.workflow_dispatch.inputs).sort()).toEqual(['environment', 'execute', 'operation', 'source_sha']);
    expect(workflow.concurrency.group).toBe('admin-release-${{ inputs.environment }}');
  });
});

describe('First-install restoration from containment', () => {
  function recoveryFixture(change = () => {}) {
    const state = {
      shutdown: true, enabled: false, adminSha: context.sourceSha, facadeSha: context.sourceSha,
      schema: '4', objects: [], extraAdminBinding: null, extraFacadeBinding: null,
      adminSubdomain: false, validCi: true,
    };
    change(state);
    const base = providerFacts(f => {
      f.a.bindings = Object.entries({ ENVIRONMENT: context.environment, ADMIN_AUTH_MODE: 'cloudflare_access',
        ADMIN_CONSOLE_ENABLED: String(state.enabled), GIT_COMMIT: state.adminSha, ADMIN_SHUTDOWN: String(state.shutdown) })
        .map(([name, text]) => ({ name, text, type: 'plain_text' }));
      if (state.extraAdminBinding) f.a.bindings.push(state.extraAdminBinding);
      f.f.bindings.push(...Object.entries({ ENVIRONMENT: context.environment, GIT_COMMIT: state.facadeSha, ADMIN_SCHEMA_VERSION: state.schema })
        .map(([name, text]) => ({ name, text, type: 'plain_text' })));
      if (state.extraFacadeBinding) f.f.bindings.push(state.extraFacadeBinding);
    });
    const fetcher = vi.fn((url, options) => {
      const u = new URL(url);
      if (u.origin === 'https://api.github.com') return Response.json({ workflow_runs: state.validCi ? [{
        head_sha: state.adminSha, path: '.github/workflows/admin-ci.yml', status: 'completed', conclusion: 'success',
        event: 'push', repository: { id: 1422954151 },
      }] : [] });
      if (u.pathname.endsWith(`/scripts/${target.adminWorker}/subdomain`)) return cloudflare({ enabled: state.adminSubdomain, previews_enabled: false });
      if (u.pathname.endsWith('/query')) {
        expect(u.pathname).toContain(`/d1/database/${target.adminDatabaseId}/query`);
        expect(JSON.parse(options.body).sql).toMatch(/^SELECT .*sqlite_master/);
        return d1(typeof state.objects === 'function' ? state.objects(JSON.parse(options.body).sql) : state.objects);
      }
      return base(url, options);
    });
    const command = vi.fn(() => '');
    const provider = createProvider(authorized, { ...context, operation: 'restore-initial-disabled' },
      { CLOUDFLARE_API_TOKEN: 'synthetic', GH_TOKEN: 'synthetic' }, fetcher, command);
    return { provider, fetcher, command };
  }

  it('accepts only an unused database and exact contained Admin/facade mapping with reviewed ancestry', async () => {
    const { provider, fetcher, command } = recoveryFixture();
    await provider.verifyInitialRecoveryTargets(target);
    expect(command).toHaveBeenCalledWith('git', ['merge-base', '--is-ancestor', context.sourceSha, context.sourceSha], { stdio: 'ignore' });
    expect(fetcher.mock.calls.filter(([, init]) => init.method === 'POST')).toHaveLength(1);
    expect(fetcher.mock.calls.every(([, init]) => !init.body || JSON.parse(init.body).sql.startsWith('SELECT'))).toBe(true);
  });

  it.each([
    ['no shutdown marker', s => { s.shutdown = false; }],
    ['enabled Admin', s => { s.enabled = true; }],
    ['Admin data binding', s => { s.extraAdminBinding = { name: 'ADMIN_DB', type: 'd1', id: target.adminDatabaseId }; }],
    ['previously provisioned HMAC', s => { s.extraAdminBinding = { name: 'ADMIN_AUDIT_HMAC_SECRET', type: 'secret_text' }; }],
    ['facade secret', s => { s.extraFacadeBinding = { name: 'ADMIN_FACADE_HMAC_SECRET', type: 'secret_text' }; }],
    ['mismatched source', s => { s.facadeSha = 'f'.repeat(40); }],
    ['unversioned source', s => { s.adminSha = s.facadeSha = 'unknown'; }],
    ['foreign schema', s => { s.schema = '3'; }],
    ['public Admin subdomain', s => { s.adminSubdomain = true; }],
    ['unreviewed contained source', s => { s.validCi = false; }],
    ['migration ledger already exists', s => { s.objects = [{ type: 'table', name: 'd1_migrations' }]; }],
    ['existing authority schema', s => { s.objects = [{ type: 'table', name: 'approved_human_operators' }]; }],
  ])('refuses restoration with %s before any mutation', async (_label, change) => {
    const { provider, fetcher, command } = recoveryFixture(change);
    await expect(provider.verifyInitialRecoveryTargets(target)).rejects.toThrow();
    expect(command.mock.calls.every(([executable]) => executable === 'git')).toBe(true);
    expect(fetcher.mock.calls.every(([, init]) => !init.body || JSON.parse(init.body).sql?.startsWith('SELECT'))).toBe(true);
  });

  it('accepts the new facade source between the two guarded restoration uploads', async () => {
    const { provider } = recoveryFixture(s => { s.adminSha = 'f'.repeat(40); });
    await expect(provider.verifyInitialRecoveryTargets(target)).resolves.toBeUndefined();
  });

  it('checks the real SQLite schema and rejects application objects with a system-like prefix', async () => {
    for (const occupied of [false, true]) {
      const { provider } = recoveryFixture(state => {
        state.objects = sql => {
          const code = `import sqlite3,json
c=sqlite3.connect(':memory:')
c.execute('CREATE TABLE _cf_METADATA(key TEXT PRIMARY KEY,value TEXT)')
if ${occupied ? 'True' : 'False'}: c.execute('CREATE TABLE _cf_not_a_system_table(id TEXT)')
print(json.dumps([dict(zip(['type','name','tbl_name','sql'],r)) for r in c.execute(${JSON.stringify(sql)})]))`;
          return JSON.parse(execFileSync('python3', ['-c', code], { encoding: 'utf8' }));
        };
      });
      if (occupied) await expect(provider.verifyInitialRecoveryTargets(target)).rejects.toThrow('empty Admin database');
      else await expect(provider.verifyInitialRecoveryTargets(target)).resolves.toBeUndefined();
    }
  });

  it.each([
    ['Cloudflare internal table', 'CREATE TABLE _cf_KV (\n  key TEXT PRIMARY KEY,\n  value BLOB\n) WITHOUT ROWID', true],
    ['Cloudflare internal table with metadata', 'CREATE TABLE _cf_KV (key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID; CREATE TABLE _cf_METADATA(key TEXT PRIMARY KEY,value TEXT)', true],
    ['same-name application table', 'CREATE TABLE _cf_KV(user_id TEXT,role TEXT)', false],
    ['same-name view', 'CREATE VIEW _cf_KV AS SELECT 1 AS key', false],
    ['application alongside internal table', 'CREATE TABLE _cf_KV (key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID; CREATE TABLE admin_owner_enrollments(id TEXT)', false],
    ['migration ledger alongside internal table', 'CREATE TABLE _cf_KV (key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID; CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT)', false],
    ['system-like application table alongside internal table', 'CREATE TABLE _cf_KV (key TEXT PRIMARY KEY,value BLOB) WITHOUT ROWID; CREATE TABLE _cf_not_a_system_table(id TEXT)', false],
  ])('checks real SQLite for %s during initial restoration', async (_label, schema, accepted) => {
    const { provider, command } = recoveryFixture(state => {
      state.objects = sql => {
        const code = `import sqlite3,json
c=sqlite3.connect(':memory:')
c.row_factory=sqlite3.Row
c.executescript(${JSON.stringify(schema)})
print(json.dumps([dict(r) for r in c.execute(${JSON.stringify(sql)})]))`;
        return JSON.parse(execFileSync('python3', ['-c', code], { encoding: 'utf8' }));
      };
    });
    if (accepted) await expect(provider.verifyInitialRecoveryTargets(target)).resolves.toBeUndefined();
    else await expect(provider.verifyInitialRecoveryTargets(target)).rejects.toThrow('empty Admin database');
    expect(command.mock.calls.every(([executable]) => executable === 'git')).toBe(true);
  });

  it('refuses a contained source outside the current reviewed ancestry', async () => {
    const { provider, command } = recoveryFixture();
    command.mockImplementation(() => { throw new Error('synthetic non-ancestor'); });
    await expect(provider.verifyInitialRecoveryTargets(target)).rejects.toThrow('ancestry');
  });
});

describe('Public smoke transport handling', () => {
  const settings = { bindings: Object.entries({ ENVIRONMENT: context.environment, ADMIN_CONSOLE_ENABLED: 'false',
    GIT_COMMIT: context.sourceSha, ADMIN_SHUTDOWN: 'true' }).map(([name, text]) => ({ name, text, type: 'plain_text' })) };
  function smokeProvider(publicFetch, wait = vi.fn(async () => {})) {
    const base = providerFacts(f => { f.a = settings; });
    const fetcher = vi.fn((url, options) => new URL(url).hostname === target.hostname ? publicFetch(url, options) : base(url, options));
    return { provider: createProvider(authorized, { ...context, operation: 'disable' }, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, vi.fn(), wait), wait };
  }
  const transient = () => new TypeError('fetch failed with synthetic-private-provider-body', { cause: { code: 'ENOTFOUND' } });

  it('retries only transient public GET connection failures and still verifies each denial', async () => {
    const publicFetch = vi.fn().mockRejectedValueOnce(transient()).mockRejectedValueOnce(transient())
      .mockImplementation(async () => shutdownWorker.fetch());
    const { provider, wait } = smokeProvider(publicFetch);
    await provider.verifyDisabled(target, context.sourceSha, true);
    expect(publicFetch).toHaveBeenCalledTimes(6);
    expect(wait.mock.calls).toEqual([[1000], [3000]]);
  });

  it('stops after three connection failures and emits only the allowlisted diagnostic', async () => {
    const publicFetch = vi.fn(async () => { throw transient(); });
    const { provider } = smokeProvider(publicFetch);
    await expect(provider.verifyDisabled(target, context.sourceSha, true)).rejects.toThrow('Public Admin smoke transport failed (ENOTFOUND)');
    expect(publicFetch).toHaveBeenCalledTimes(3);
  });

  it('does not retry an unsafe HTTP response or a certificate failure', async () => {
    for (const response of [async () => new Response('Forbidden', { status: 403 }),
      async () => { throw new TypeError('private detail', { cause: { code: 'CERT_HAS_EXPIRED' } }); }]) {
      const publicFetch = vi.fn(response);
      const { provider, wait } = smokeProvider(publicFetch);
      await expect(provider.verifyDisabled(target, context.sourceSha, true)).rejects.toThrow();
      expect(publicFetch).toHaveBeenCalledOnce();
      expect(wait).not.toHaveBeenCalled();
    }
  });
});

it('suppresses provider transport detail without retrying an API write', async () => {
  const fetcher = vi.fn(async () => { throw new Error('synthetic-private-provider-detail'); });
  const provider = createProvider(authorized, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, vi.fn());
  await expect(provider.verifyLedger(target, [], false)).rejects.toThrow('Cloudflare provider transport failed');
  expect(fetcher).toHaveBeenCalledOnce();
});

it('rechecks unused containment before each upload and refuses a newly occupied database', async () => {
  const ctx = { ...context, operation: 'restore-initial-disabled', runAttempt: '1', auditArtifactDigest: 'sha256:' + 'f'.repeat(64) };
  const command = vi.fn(() => 'synthetic upload');
  const provider = createProvider(authorized, ctx, {}, vi.fn(), command);
  vi.spyOn(provider, 'githubFacts').mockResolvedValue({
    repository: { id: 1422954151, full_name: 'hello-tako/Takolio', default_branch: 'main' },
    branch: { protected: true, commit: { sha: ctx.sourceSha } },
    protection: { enforce_admins: { enabled: true }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true },
      required_status_checks: { strict: true, contexts: ['validate-admin'] } },
    environment: { id: 123, can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [{}] }],
      deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } },
    run: { id: 42, run_attempt: 1, event: 'workflow_dispatch', head_sha: ctx.sourceSha, head_branch: 'main',
      path: '.github/workflows/admin-staging-deploy.yml', actor: { id: 1, type: 'User' }, triggering_actor: { id: 1 }, repository: { id: 1422954151 } },
    ci: [{ head_sha: ctx.sourceSha, path: '.github/workflows/admin-ci.yml', status: 'completed', conclusion: 'success', event: 'push', repository: { id: 1422954151 } }],
    approvals: [{ state: 'approved', user: { id: 2, type: 'User' }, environments: [{ id: 123 }] }],
    artifact: { name: 'admin-pre-action-42', expired: false, workflow_run: { id: 42, head_sha: ctx.sourceSha }, digest: ctx.auditArtifactDigest },
  });
  const guard = vi.spyOn(provider, 'verifyInitialRecoveryTargets').mockResolvedValueOnce()
    .mockRejectedValueOnce(new Error('Initial restoration requires an unmigrated empty Admin database'));
  await provider.deploy('facade');
  await expect(provider.deploy('admin')).rejects.toThrow('empty Admin database');
  expect(guard).toHaveBeenCalledTimes(2);
  expect(command).toHaveBeenCalledOnce();
  expect(command.mock.calls[0][1].slice(0, 3)).toEqual(['exec', 'wrangler', 'deploy']);
  expect(guard.mock.invocationCallOrder[0]).toBeLessThan(command.mock.invocationCallOrder[0]);
  expect(provider.githubFacts).toHaveBeenCalledOnce();
});
