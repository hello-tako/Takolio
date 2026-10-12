import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { load: parse } = createRequire(require.resolve('eslint/package.json'))('js-yaml');
const path = '.github/workflows/backend-security.yml';
const source = readFileSync(path, 'utf8');
const workflow = parse(source);
describe('isolated scanner CI without deployment credentials', () => {
  it('has immutable actions, least permissions and only unprivileged events', () => {
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'workflow_dispatch']);
    const job = workflow.jobs.security;
    expect(job.environment).toBeUndefined();
    expect(job['timeout-minutes']).toBe(25);
    for (const step of job.steps) if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    expect(job.steps[0].with['persist-credentials']).toBe(false);
    expect(source).not.toMatch(/secrets\.|pull_request_target|continue-on-error|--remote|wrangler deploy/);
  });
  it('runs detection fixtures and preserves scanner/audit failures and private reports', () => {
    const job = workflow.jobs.security;
    expect(job.steps.some((step) => step.run?.includes('runner.py selftest'))).toBe(true);
    expect(job.steps.some((step) => step.run?.includes('runner.py scan'))).toBe(true);
    const upload = job.steps.find((step) => step.uses?.startsWith('actions/upload-artifact@'));
    expect(upload.with.path.trim().split('\n')).toEqual(['.artifacts/b08-selftest/receipt.json', '.artifacts/b08-scan/receipt.json', '.artifacts/b08-context-status.json']);
    expect(upload.with['retention-days']).toBe(7);
    const context = job.steps.find((step) => step.name === 'Read previously reviewed context from the trusted base');
    expect(context.env.TRUSTED_POLICY_SHA).toBe('${{ github.event.pull_request.base.sha || github.sha }}');
    expect(context.run).toContain('git show "$TRUSTED_POLICY_SHA:');
    expect(source).toContain('--context .artifacts/b08-trusted-context.json');
    expect(source).not.toContain('--context docs/backend-upgrade/nine-region-offline/security-context.json');
    expect(source).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(source).toContain("raise SystemExit(1 if failed else 0)");
  });
});
