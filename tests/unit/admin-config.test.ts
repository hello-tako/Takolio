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
    expect(production.define).toEqual({__ADMIN_LOCAL_AUTH__:'false'});
    expect(production.define.__ADMIN_LOCAL_AUTH__).not.toBe('true');
    expect(production.vars).toMatchObject({ ENVIRONMENT: 'production', ADMIN_CONSOLE_ENABLED: 'false', ADMIN_AUTH_MODE: 'cloudflare_access' });
    expect(production.routes).toBeUndefined();
    expect(production.d1_databases.map((db: { binding: string }) => db.binding)).toEqual(['ADMIN_DB']);
    expect(production.d1_databases[0].migrations_dir).toBe('migrations-admin');
  });

  it('only the internal facade binds customer D1, without public routes or preview URLs', () => {
    const customerId = jsonc('wrangler.jsonc').d1_databases[0].database_id;
    for (const config of [production, local]) {
      expect(config.d1_databases).toHaveLength(1);
      expect(config.d1_databases[0].database_id).not.toBe(customerId);
      expect(config.services[0]).toMatchObject({ binding: 'CUSTOMER_READ', entrypoint: 'AdminCustomerReadFacade' });
    }
    for (const file of ['wrangler.admin-facade.jsonc', 'wrangler.admin-facade-local.jsonc']) {
      const facade = jsonc(file);
      expect(facade.workers_dev).toBe(false);
      expect(facade.preview_urls).toBe(false);
      expect(facade.routes).toBeUndefined();
      expect(facade.d1_databases[0].binding).toBe('DB');
      if (file.endsWith('-local.jsonc')) expect(facade.d1_databases[0].database_id).toBe(customerId);
      else expect(facade.d1_databases[0].database_id).toBe('00000000-0000-4000-8000-000000000001');
    }
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
    expect(readdirSync('migrations-admin')).toEqual(['0001_admin_console_foundation.sql', '0002_admin_identity_governance_r2.sql']);
  });

  // Relative to the merge base with main, so later main commits do not trip this guard.
  it('the customer Worker entry and config files are unchanged from the merge base with main when that history is available', () => {
    let baseline: string;
    try {
      baseline = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim();
      expect(shallow, 'origin/main missing from a full clone').toBe('true');
      return;
    }
    for (const file of ['src/worker/index.ts', 'src/worker/types.ts', 'src/worker/config/csp.ts', 'src/worker/middleware/rate-limit.ts', 'wrangler.jsonc', 'wrangler.staging.jsonc', 'public/sw.js', 'vite.config.ts']) {
      const before = execFileSync('git', ['show', `${baseline}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 24 });
      expect(readFileSync(file, 'utf8'), file).toBe(before);
    }
  });
});
