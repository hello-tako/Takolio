import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { matchesGlob } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { load } = createRequire(require.resolve('eslint/package.json'))('js-yaml');

for (const [file, jobName] of [['recipe-v3-ci.yml', 'validate'], ['admin-ci.yml', 'validate-admin']]) {
  describe(`V3 branch validation in ${file}`, () => {
    const source = readFileSync(`.github/workflows/${file}`, 'utf8');
    const workflow = load(source);
    const triggers = (branch) => workflow.on.push.branches.some((pattern) => matchesGlob(branch, pattern));

    it('validates stacked V3 pushes while preserving main validation', () => {
      for (const branch of ['codex/recipe-v3-source-scan', 'codex/recipe-v3-safety-07', 'codex/recipe-v3-release-patches']) {
        expect(triggers(branch), branch).toBe(true);
      }
      expect(triggers('unrelated-branch')).toBe(false);
      const mainWorkflow = file === 'recipe-v3-ci.yml'
        ? load(readFileSync('.github/workflows/ci.yml', 'utf8')) : workflow;
      expect(mainWorkflow.on.push.branches).toContain('main');
      expect(mainWorkflow.on.pull_request.branches).toContain('main');
      if (file === 'recipe-v3-ci.yml') expect(triggers('main')).toBe(false);
    });

    it('retains validation-only permissions and the complete check sequence', () => {
      expect(workflow.permissions).toEqual({ contents: 'read' });
      expect(workflow.on.pull_request_target).toBeUndefined();
      const job = workflow.jobs[jobName];
      expect(job.environment).toBeUndefined();
      const commands = job.steps.map((step) => step.run).filter(Boolean).join('\n');
      for (const command of ['pnpm install --frozen-lockfile', 'pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm check:migrations', 'pnpm build']) {
        expect(commands).toContain(command);
      }
      expect(source).not.toMatch(/secrets\.|continue-on-error|wrangler deploy/);
      for (const step of job.steps) {
        if (step.uses) expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
        if (step.uses?.startsWith('actions/checkout@')) expect(step.with['persist-credentials']).toBe(false);
      }
    });
  });
}
