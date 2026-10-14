import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

function jsonc(file: string) {
  return JSON.parse(readFileSync(file, 'utf8').split('\n').filter((line) => !/^\s*\/\//.test(line)).join('\n'));
}

describe('admin deployment configuration', () => {
  const production = jsonc('wrangler.admin.jsonc');
  const local = jsonc('wrangler.admin-local.jsonc');

  it('the admin Worker runs before static assets, so the asset layer never answers for it', () => {
    for (const config of [production, local]) {
      expect(config.main).toBe('src/worker/admin-worker.ts');
      expect(config.assets).toMatchObject({ directory: './dist/admin', binding: 'ASSETS', run_worker_first: true, not_found_handling: 'none' });
      expect(config.workers_dev).toBe(false);
    }
  });

  it('the production template is disabled, Access-only, and never compiles the local password login', () => {
    expect(production.define).toBeUndefined();
    expect(JSON.stringify(production)).not.toContain('__ADMIN_LOCAL_AUTH__');
    expect(production.vars).toMatchObject({ ENVIRONMENT: 'production', ADMIN_CONSOLE_ENABLED: 'false', ADMIN_AUTH_MODE: 'cloudflare_access' });
    expect(production.routes).toBeUndefined();
    expect(production.d1_databases.map((db: { binding: string }) => db.binding)).toEqual(['DB', 'ADMIN_DB']);
    expect(production.d1_databases[1].migrations_dir).toBe('migrations-admin');
  });

  it('the local config binds the console to loopback only', () => {
    expect(local.define).toEqual({ __ADMIN_LOCAL_AUTH__: 'true' });
    expect(new URL(local.vars.ADMIN_ORIGIN).hostname).toBe('127.0.0.1');
    expect(local.vars.ENVIRONMENT).toBe('development');
  });

  it('customer Worker configuration has no admin bindings, variables or assets', () => {
    for (const file of ['wrangler.jsonc', 'wrangler.staging.jsonc']) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/ADMIN_|admin-worker|takosan-admin|run_worker_first/);
      expect(jsonc(file).assets.directory).toBe('./dist/client');
    }
  });

  it('no admin migration lives in the customer ledger', () => {
    const customer = readdirSync('migrations').filter((name) => name.endsWith('.sql'));
    expect(customer.some((name) => /admin/i.test(name))).toBe(false);
    expect(readdirSync('migrations-admin')).toEqual(['0001_admin_console_foundation.sql']);
  });

  it('the customer Worker entry and config files are unchanged from the pre-admin baseline when that commit is available', () => {
    let baseline: string | null = null;
    try {
      execFileSync('git', ['cat-file', '-e', '186a9cf05de7c91ed3289e13130feb3b38a264ac^{commit}'], { stdio: 'ignore' });
      baseline = '186a9cf05de7c91ed3289e13130feb3b38a264ac';
    } catch {
      baseline = null;
    }
    if (!baseline) {
      const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim();
      expect(shallow, 'baseline commit missing from a full clone').toBe('true');
      return;
    }
    for (const file of ['src/worker/index.ts', 'src/worker/types.ts', 'src/worker/config/csp.ts', 'src/worker/middleware/rate-limit.ts', 'wrangler.jsonc', 'wrangler.staging.jsonc', 'public/sw.js', 'vite.config.ts']) {
      const before = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 24 });
      expect(readFileSync(file, 'utf8'), file).toBe(before);
    }
  });
});
