import { afterEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CUSTOMER_BASELINE, REVIEWED_DOMAIN_BASELINE, V2_RELEASE_BASELINE, selectGuardedCustomerBaseline } from '../../scripts/admin-customer-baseline.mjs';

const directories = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

function fixture() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'admin-customer-baseline-'));
  directories.push(cwd);
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'user.name', 'Fixture');
  const commit = (file, text) => {
    writeFileSync(path.join(cwd, file), text);
    git('add', '--', file);
    git('commit', '-m', file);
    return git('rev-parse', 'HEAD');
  };
  const originalBaseline = commit('worker.ts', 'legacy\n');
  git('update-ref', 'refs/remotes/origin/main', originalBaseline);
  git('checkout', '-b', 'domain');
  const reviewedBaseline = commit('worker.ts', 'reviewed domain\n');
  const select = (options = {}) => selectGuardedCustomerBaseline({ git, originalBaseline, reviewedBaseline, guardedPaths: ['worker.ts'], ...options });
  const changed = () => git('diff', '--name-only', select().baseline, '--', 'worker.ts');
  return { cwd, git, commit, originalBaseline, reviewedBaseline, select, changed };
}

describe('immutable customer release baselines', () => {
  it('keeps the exact production and reviewed domain commits pinned in preflight', () => {
    expect(CUSTOMER_BASELINE).toBe('526596a8cd857984ad2b69901a8c7b0e9d6bccc2');
    expect(REVIEWED_DOMAIN_BASELINE).toBe('352a4211afe7f70bf75115e0688ff9f4e1e232ee');
    expect(V2_RELEASE_BASELINE).toBe('9b031f05c34a3f27f7a5d9958c65eb8a4405d227');
    const preflight = readFileSync('scripts/admin-release-preflight.mjs', 'utf8');
    expect(preflight).toContain('originalBaseline: CUSTOMER_BASELINE, reviewedBaseline: REVIEWED_DOMAIN_BASELINE');
    expect(preflight).toContain("git('diff', '--name-only', customerBaseline, '--', ...protectedPaths)");
    expect(preflight).toContain('releaseBaseline: V2_RELEASE_BASELINE');
    const matrix = readFileSync('scripts/admin-migration-matrix.mjs', 'utf8');
    expect(matrix).toContain('releaseBaseline: V2_RELEASE_BASELINE');
    expect(matrix).toContain('headManifest.sha256 === candidateManifest.sha256 && workingManifest.sha256 === candidateManifest.sha256');
    expect(matrix).toContain("git('diff', '--name-only', customerBaseline, '--', 'migrations', 'scripts/d1-schema-gate.sql')");
  });

  it('accepts reviewed domain bytes across a parallel metadata-only main merge', () => {
    const f = fixture();
    f.git('checkout', 'main');
    const advancedMain = f.commit('admin.txt', 'disabled admin\n');
    f.git('update-ref', 'refs/remotes/origin/main', advancedMain);
    f.git('checkout', 'domain');
    f.git('merge', '--no-edit', 'main');
    expect(f.select()).toEqual({ baseline: f.reviewedBaseline, mainBase: advancedMain });
    expect(f.changed()).toBe('');
  });

  it('keeps the reviewed baseline after the normal feature-to-main merge', () => {
    const f = fixture();
    f.git('checkout', 'main');
    f.git('merge', '--no-ff', '--no-edit', 'domain');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    expect(f.select().baseline).toBe(f.reviewedBaseline);
    expect(f.changed()).toBe('');
  });

  it.each(['working', 'committed'])('still reports unreviewed %s customer edits', (kind) => {
    const f = fixture();
    if (kind === 'committed') f.commit('worker.ts', 'unreviewed\n');
    else writeFileSync(path.join(f.cwd, 'worker.ts'), 'unreviewed\n');
    expect(f.changed()).toBe('worker.ts');
  });

  it('rejects protected changes on parallel main even if the merge chooses reviewed bytes', () => {
    const f = fixture();
    f.git('checkout', 'main');
    const advancedMain = f.commit('worker.ts', 'other customer change\n');
    f.git('update-ref', 'refs/remotes/origin/main', advancedMain);
    f.git('checkout', 'domain');
    try { f.git('merge', '--no-commit', 'main'); } catch { /* Expected fixture conflict. */ }
    f.commit('worker.ts', 'reviewed domain\n');
    expect(() => f.select()).toThrow('Protected customer history changed on main: worker.ts');
  });

  it('retains original bytes when the reviewed commit is not in HEAD ancestry', () => {
    const f = fixture();
    f.git('checkout', 'main');
    f.commit('admin.txt', 'metadata only\n');
    expect(f.select().baseline).toBe(f.originalBaseline);
    expect(f.changed()).toBe('');
  });

  it('allows only unchanged pinned main contracts when no reviewed exception is supplied', () => {
    const f = fixture();
    f.git('checkout', 'main');
    const advancedMain = f.commit('admin.txt', 'metadata only\n');
    f.git('update-ref', 'refs/remotes/origin/main', advancedMain);
    expect(f.select({ reviewedBaseline: undefined }).baseline).toBe(f.originalBaseline);
    const changedMain = f.commit('worker.ts', 'changed contract\n');
    f.git('update-ref', 'refs/remotes/origin/main', changedMain);
    expect(() => f.select({ reviewedBaseline: undefined })).toThrow('Protected customer history changed on main');
  });

  it('fails closed for missing main or an unrelated original baseline', () => {
    const f = fixture();
    expect(() => f.select({ originalBaseline: 'a'.repeat(40) })).toThrow();
    f.git('update-ref', '-d', 'refs/remotes/origin/main');
    expect(() => f.select()).toThrow();
  });
});


describe('immutable V2 release checkpoint', () => {
  function releaseFixture() {
    const f = fixture();
    const releaseBaseline = f.commit('worker.ts', 'frozen V2 candidate\n');
    const select = () => f.select({ releaseBaseline });
    const changed = () => f.git('diff', '--name-only', select().baseline, '--', 'worker.ts');
    return { ...f, releaseBaseline, selectRelease: select, changedRelease: changed };
  }

  it('selects the exact V2 checkpoint across a parallel metadata-only main merge', () => {
    const f = releaseFixture();
    f.git('checkout', 'main');
    const advancedMain = f.commit('admin.txt', 'disabled admin\n');
    f.git('update-ref', 'refs/remotes/origin/main', advancedMain);
    f.git('checkout', 'domain');
    f.git('merge', '--no-edit', 'main');
    expect(f.selectRelease()).toEqual({ baseline: f.releaseBaseline, mainBase: advancedMain });
    expect(f.changedRelease()).toBe('');
  });

  it('retains the same immutable checkpoint after a normal merge onto main', () => {
    const f = releaseFixture();
    f.git('checkout', 'main');
    f.git('merge', '--no-ff', '--no-edit', 'domain');
    f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    expect(f.selectRelease().baseline).toBe(f.releaseBaseline);
    expect(f.changedRelease()).toBe('');
  });

  it.each(['working', 'committed'])('rejects post-checkpoint %s customer bytes', (mode) => {
    const f = releaseFixture();
    if (mode === 'committed') f.commit('worker.ts', 'unreviewed later change\n');
    else writeFileSync(path.join(f.cwd, 'worker.ts'), 'unreviewed later change\n');
    expect(f.selectRelease().baseline).toBe(f.releaseBaseline);
    expect(f.changedRelease()).toBe('worker.ts');
  });

  it('rejects parallel main history drift even when the merge restores pinned V2 bytes', () => {
    const f = releaseFixture();
    f.git('checkout', 'main');
    const advancedMain = f.commit('worker.ts', 'unreviewed main change\n');
    f.git('update-ref', 'refs/remotes/origin/main', advancedMain);
    f.git('checkout', 'domain');
    try { f.git('merge', '--no-commit', 'main'); } catch { /* Expected fixture conflict. */ }
    f.commit('worker.ts', 'frozen V2 candidate\n');
    expect(() => f.selectRelease()).toThrow('Protected customer history changed on main: worker.ts');
  });

  it('rejects main changes after a normal V2 merge', () => {
    const f = releaseFixture();
    f.git('checkout', 'main');
    f.git('merge', '--no-ff', '--no-edit', 'domain');
    const changedMain = f.commit('worker.ts', 'unreviewed future main\n');
    f.git('update-ref', 'refs/remotes/origin/main', changedMain);
    expect(() => f.selectRelease()).toThrow('Protected customer history changed on main');
  });

  it('never selects a V2 checkpoint absent from HEAD ancestry', () => {
    const f = fixture();
    f.git('checkout', '-b', 'v2');
    const releaseBaseline = f.commit('worker.ts', 'frozen V2 candidate\n');
    f.git('checkout', 'domain');
    expect(f.select({ releaseBaseline }).baseline).toBe(f.reviewedBaseline);
    f.git('checkout', 'main');
    expect(f.select({ releaseBaseline }).baseline).toBe(f.originalBaseline);
  });
});
