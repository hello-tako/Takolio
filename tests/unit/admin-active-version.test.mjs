import { describe, expect, it, vi } from 'vitest';
import { createProvider } from '../../scripts/admin-release-provider.mjs';

const worker = 'takosan-admin-staging';
const versionId = '11111111-2222-4333-8444-555555555555';
const deploymentId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const context = { environment: 'staging', sourceSha: 'e'.repeat(40), operation: 'rollback-disabled' };
const target = { accountId: 'a'.repeat(32), adminWorker: worker, hostname: 'admin.takosan.com', issuer: 'https://team.cloudflareaccess.com' };
const activeBindings = [
  { name: 'ENVIRONMENT', type: 'plain_text', text: 'staging' },
  { name: 'ADMIN_CONSOLE_ENABLED', type: 'plain_text', text: 'false' },
  { name: 'ADMIN_AUTH_MODE', type: 'plain_text', text: 'cloudflare_access' },
];
const cf = result => Response.json({ success: true, result });

function fixture(change = () => {}) {
  const facts = {
    deployments: [{ id: deploymentId, versions: [{ version_id: versionId, percentage: 100 }] }],
    version: { id: versionId, resources: { bindings: structuredClone(activeBindings) } },
    reads: 0,
  };
  change(facts);
  const fetcher = vi.fn(async url => {
    if (url.endsWith('/deployments')) {
      facts.reads++;
      return cf({ deployments: typeof facts.deployments === 'function' ? facts.deployments(facts.reads) : facts.deployments });
    }
    if (url.endsWith(`/versions/${versionId}`)) return cf(facts.version);
    if (url.endsWith('/settings')) return cf({ bindings: [
      ...structuredClone(activeBindings),
      { name: 'ADMIN_SHUTDOWN', type: 'plain_text', text: 'true' },
    ] });
    throw new Error('Unexpected provider endpoint');
  });
  const command = vi.fn();
  const provider = createProvider({ target }, context, { CLOUDFLARE_API_TOKEN: 'synthetic' }, fetcher, command);
  return { provider, fetcher, command };
}

describe('Active deployed Worker binding verification', () => {
  it('uses the serving version when script settings still describe the latest shutdown upload', async () => {
    const { provider, fetcher, command } = fixture();
    await expect(provider.verifyConsoleDisabled(target)).resolves.toBeUndefined();
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/settings'))).toBe(false);
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/deployments'))).toHaveLength(2);
    expect(command).not.toHaveBeenCalled();
  });

  it.each([
    ['missing deployment', f => { f.deployments = []; }],
    ['split traffic', f => { f.deployments[0].versions = [{ version_id: versionId, percentage: 50 }, { version_id: '22222222-2222-4222-8222-222222222222', percentage: 50 }]; }],
    ['partial traffic', f => { f.deployments[0].versions[0].percentage = 99; }],
    ['string percentage', f => { f.deployments[0].versions[0].percentage = '100'; }],
    ['invalid version ID', f => { f.deployments[0].versions[0].version_id = '../settings'; }],
    ['missing deployment ID', f => { delete f.deployments[0].id; }],
    ['wrong version response', f => { f.version.id = '22222222-2222-4222-8222-222222222222'; }],
    ['missing bindings', f => { delete f.version.resources.bindings; }],
    ['duplicate binding', f => { f.version.resources.bindings.push({ ...activeBindings[0] }); }],
    ['enabled serving version', f => { f.version.resources.bindings[1].text = 'true'; }],
    ['foreign serving environment', f => { f.version.resources.bindings[0].text = 'production'; }],
  ])('fails closed for %s without mutation or settings fallback', async (_label, change) => {
    const { provider, fetcher, command } = fixture(change);
    await expect(provider.verifyConsoleDisabled(target)).rejects.toThrow();
    expect(command).not.toHaveBeenCalled();
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/settings'))).toBe(false);
  });

  it('rejects a deployment changed between reading its version and confirming its identity', async () => {
    const { provider } = fixture(f => {
      f.deployments = read => [{ id: read === 1 ? deploymentId : 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', versions: [{ version_id: versionId, percentage: 100 }] }];
    });
    await expect(provider.verifyConsoleDisabled(target)).rejects.toThrow('changed');
  });

  it('returns only the verified active version in the release receipt', async () => {
    const { provider } = fixture();
    await expect(provider.deploymentVersions([worker])).resolves.toEqual({ [worker]: versionId });
  });
});
