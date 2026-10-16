import { readFileSync } from 'node:fs';
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
    subdomain: { enabled: false, previews_enabled: false }, routes: [], zones: [{ id: target.zoneId, account: { id: target.accountId } }] };
  mutate(facts);
  return vi.fn(async url => {
    const route = new URL(url).pathname;
    if (route.endsWith(`/d1/database/${target.adminDatabaseId}`)) return cloudflare({ uuid: target.adminDatabaseId, name: target.adminDatabaseName });
    if (route.endsWith(`/d1/database/${target.customerDatabaseId}`)) return cloudflare({ uuid: target.customerDatabaseId, name: target.customerDatabaseName });
    if (route.endsWith('/storage/kv/namespaces')) return cloudflare([{ id: target.kvId }]);
    if (route.endsWith(`/access/apps/${target.accessApplicationId}`)) return cloudflare({ id: target.accessApplicationId, aud: target.audience, domain: target.hostname, type: 'self_hosted' });
    if (route.endsWith('/zones')) return cloudflare(facts.zones);
    if (route.endsWith('/workers/routes')) return cloudflare(facts.routes);
    if (route.endsWith('/workers/domains')) return cloudflare(facts.domains);
    if (route.endsWith(`/zones/${target.zoneId}`)) return cloudflare({ id: target.zoneId, account: { id: target.accountId }, name: 'takosan.com' });
    if (route.endsWith('/access/organizations')) return cloudflare({ auth_domain: 'team.cloudflareaccess.com' });
    if (route.endsWith('/subdomain')) return cloudflare(facts.subdomain);
    if (route.endsWith(`/scripts/${target.adminWorker}/settings`)) return cloudflare(facts.a);
    if (route.endsWith(`/scripts/${target.facadeWorker}/settings`)) return cloudflare(facts.f);
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

  it.each([
    ['missing mapping', f => { f.domains = []; }],
    ['wrong Worker mapping', f => { f.domains[0].service = 'unrelated-worker'; }],
    ['wrong zone mapping', f => { f.domains[0].zone_id = 'f'.repeat(32); }],
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
    status: 'completed', conclusion: 'success', repository: { id: 1385308553 } } });
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
    repository: { id: 1385308553, full_name: 'lol-vn/Tako-san', default_branch: 'main' },
    branch: { commit: { sha: ctx.sourceSha }, protected: true },
    protection: { enforce_admins: { enabled: true }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true },
      required_status_checks: { strict: true, contexts: ['validate-admin'] } },
    environment: { id: 1, can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [1] }],
      deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } },
    run: { id: 42, run_attempt: 1, event: 'workflow_dispatch', head_sha: ctx.sourceSha, head_branch: 'main',
      path: '.github/workflows/admin-staging-deploy.yml', actor: { id: 1, type: 'User' }, triggering_actor: { id: 1 }, repository: { id: 1385308553 } },
    ci: [{ head_sha: ctx.sourceSha, path: '.github/workflows/admin-ci.yml', status: 'completed', conclusion: 'success', event: 'push', repository: { id: 1385308553 } }],
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
