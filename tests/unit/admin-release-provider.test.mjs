import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
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

  it.each(['admin-staging-deploy.yml', 'admin-production-deploy.yml', 'admin-d1-migrate.yml', 'admin-breakglass.yml'])('keeps %s manual, pinned, default-off and independently gated', file => {
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
