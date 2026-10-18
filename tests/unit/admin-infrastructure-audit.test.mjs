import { describe, expect, it, vi } from 'vitest';
import { auditAdminInfrastructure, ADMIN_ACCOUNT_ID } from '../../scripts/admin-infrastructure-audit.mjs';

const response = (result, result_info) => Response.json({ success: true, result, result_info });
const fixture = () => vi.fn(async url => {
  const path = new URL(url).pathname;
  if (path.endsWith('/d1/database')) return response([{ uuid: 'admin-id', name: 'takolio-admin-db', internal: 'private' }, { uuid: 'other', name: 'private-unrelated' }]);
  if (path.endsWith('/namespaces')) return response([{ id: 'admin-kv', title: 'takolio-admin', secret: 'private' }]);
  if (path.endsWith('/access/apps')) return response([{ id: 'app', name: 'Takolio Admin', domain: 'admin.takolio.app', type: 'self_hosted', aud: 'aud', policies: [{ email: 'private@example.test' }] }, { name: 'Unrelated Admin', domain: 'other.example.com' }]);
  if (path.endsWith('/organizations')) return response({ auth_domain: 'team.cloudflareaccess.com', private: 'hidden' });
  if (path.endsWith('/domains')) return response([]);
  if (path.endsWith('/zones')) return response([{ id: 'zone', name: 'takolio.app', status: 'active' }, { name: 'unrelated.example.com' }]);
  if (path.endsWith('/scripts')) return response([{ id: 'frigo' }, { id: 'unrelated' }]);
  if (path.endsWith('/settings')) return response({ bindings: [
    { name: 'DB', type: 'd1', id: 'customer-id' },
    { name: 'GIT_COMMIT', type: 'plain_text', text: 'a'.repeat(40) },
    { name: 'SECRET_IN_PLAIN_TEXT', type: 'plain_text', text: 'hidden-value' },
    { name: 'SECRET_TOKEN', type: 'secret_text', text: 'hidden-value' },
  ] });
  throw new Error('Unexpected endpoint');
});

describe('read-only Admin infrastructure metadata', () => {
  it('uses fixed account endpoints and exports only the sanitized project inventory', async () => {
    const read = fixture();
    const report = await auditAdminInfrastructure('synthetic-private-token', read);
    expect(report.remoteMutations).toBe(false);
    expect(report.readyForDeployment).toBe(false);
    expect(Object.values(report.sections).every(s => s.status === 'OBSERVED')).toBe(true);
    const publicText = JSON.stringify(report);
    for (const privateValue of ['synthetic-private-token', 'private@example.test', 'hidden-value', 'unrelated', 'private-unrelated', 'policies']) expect(publicText).not.toContain(privateValue);
    for (const [url, options] of read.mock.calls) {
      expect(options.method).toBe('GET');
      expect(options.redirect).toBe('error');
      expect(options.body).toBeUndefined();
      expect(new URL(url).origin).toBe('https://api.cloudflare.com');
      expect(new URL(url).pathname).toMatch(new RegExp(`^/client/v4/(?:accounts/${ADMIN_ACCOUNT_ID}/|zones$)`));
      expect(url).not.toMatch(/\/query|\/execute/);
    }
  });

  it('records missing API scopes as pending evidence without leaking response bodies', async () => {
    const report = await auditAdminInfrastructure('synthetic-token', async () => new Response('secret provider details', { status: 403 }));
    expect(Object.values(report.sections).every(s => s.status === 'PENDING_EXTERNAL_EVIDENCE')).toBe(true);
    expect(JSON.stringify(report)).not.toContain('secret provider details');
  });

  it('refuses to call any endpoint without a credential', async () => {
    const read = vi.fn();
    await expect(auditAdminInfrastructure('', read)).rejects.toThrow('credential');
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects incomplete paginated inventories', async () => {
    const report = await auditAdminInfrastructure('synthetic-token', async () => response([], { page: 1, total_pages: 1, total_count: 10 }));
    expect(report.sections.databases.status).toBe('PENDING_EXTERNAL_EVIDENCE');
    expect(report.sections.workers.status).toBe('PENDING_EXTERNAL_EVIDENCE');
  });
});
