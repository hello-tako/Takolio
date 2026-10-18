import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../../.github/workflows/admin-credential-audit.yml', import.meta.url), 'utf8');

describe('dedicated Admin credential audit workflow', () => {
  it('requires a protected exact-main job in one of the two Admin Environments', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('options: [admin-staging, admin-production]');
    expect(workflow).toContain("github.ref == 'refs/heads/main'");
    expect(workflow).toContain("inputs.environment == 'admin-staging' || inputs.environment == 'admin-production'");
    expect(workflow).toContain('environment: ${{ inputs.environment }}');
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(workflow).toContain('persist-credentials: false');
  });

  it('uses only the dedicated Admin credential and the GET-only metadata entry point', () => {
    expect(workflow).toContain('${{ secrets.ADMIN_RELEASE_CLOUDFLARE_TOKEN }}');
    expect(workflow).not.toContain('${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect([...workflow.matchAll(/^\s+run: (.+)$/gm)].map(match => match[1]))
      .toEqual(['node scripts/admin-infrastructure-audit.mjs']);
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toMatch(/write|wrangler|pnpm|npm |ADMIN_RELEASE_EXECUTION_ENABLED|ADMIN_RELEASE_AUTHORIZATION/);
    expect(workflow).toContain('.artifacts/admin-infrastructure/audit.json');
  });
});
