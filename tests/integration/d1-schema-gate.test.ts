import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listMigrations, migrationTip, renderSchemaGateCommand, renderSchemaGateSql } from '../../scripts/d1-schema-gate.mjs';
import { MIGRATION_LEDGER, SqliteD1 } from '../helpers/sqlite-d1';

// T15A: the production schema gate derives its required migrations from the repository, so it
// can never silently accept a database that is behind (or ahead of) the release it guards.
describe('D1 schema gate — migration ledger equality derived from migrations/', () => {
  const familyTables = ['family_meal_preferences', 'generated_family_meal_plans', 'saved_recipe_entries', 'shopping_demand_review_commands', 'shopping_demand_reviews', 'shopping_generated_item_state', 'shopping_item_metadata', 'shopping_plan_commands', 'shopping_plan_demands', 'shopping_plan_item_dismissals', 'shopping_plan_sources'];
  const databases: SqliteD1[] = [];
  const gate = renderSchemaGateSql();
  const withLedger = (names: readonly string[], through?: string) => {
    const db = new SqliteD1(through ? { through } : {});
    databases.push(db);
    db.seed('CREATE TABLE d1_migrations (name TEXT PRIMARY KEY NOT NULL)');
    for (const name of names) db.execute('INSERT INTO d1_migrations VALUES (?)', [name]);
    return db;
  };
  const missingMigrationsAfter = (tip: string) => {
    const names = listMigrations();
    const index = names.indexOf(tip);
    expect(index).toBeGreaterThanOrEqual(0);
    return names.slice(index + 1).map((detail) => ({ issue: 'missing_migration', detail }));
  };
  afterEach(() => { for (const db of databases.splice(0)) db.close(); });

  it('requires exactly the repository migration list, including post-catalog auth, T20 composition, and strict OTP foundation', () => {
    const names = listMigrations();
    expect(names).toHaveLength(MIGRATION_LEDGER.count);
    expect(names.at(-1)).toBe(MIGRATION_LEDGER.tip);
    expect(migrationTip()).toBe(MIGRATION_LEDGER.tip);
    for (const name of names) expect(gate).toContain(`('${name}')`);
    expect(gate).not.toContain('@required_migrations');
    // D1 caps compound SELECTs at five terms; the CTE keeps the top-level query at five branches.
    expect(gate.split('\n').filter((line) => /^UNION ALL$/.test(line.trim()))).toHaveLength(4 + 1);
    expect(renderSchemaGateCommand()).not.toMatch(/\n|--/);
  });

  it(`passes only when the ledger equals the repository list (tip ${MIGRATION_LEDGER.tip} with 500 recipes)`, () => {
    const db = withLedger(listMigrations());
    expect(db.query(gate)).toEqual([]);
    expect(db.query<{ n: number }>('SELECT COUNT(*) AS n FROM recipes')[0].n).toBe(500);
  });

  it.each(['idx_auth_otp_tickets_scope_admitted', 'idx_auth_otp_requests_retained_until'])('fails closed when strict OTP index %s is missing despite a complete ledger', (index) => {
    const db = withLedger(listMigrations());
    db.seed(`DROP INDEX ${index}`);
    expect(db.query(gate)).toEqual([{ issue: 'missing_index', detail: index }]);
  });

  it('fails closed when the ledger stops at the 0037 catalog tip', () => {
    const tip = '0037_recipe_catalog_scale.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter((row) => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.some((row) => row.issue === 'unexpected_migration')).toBe(false);
  });

  it('fails closed when the ledger stops at the 0038 production tip (T20 migration not applied)', () => {
    const tip = '0038_auth_onboarding_completion.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter((row) => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.some((row) => row.issue === 'unexpected_migration')).toBe(false);
  });

  it('fails closed when the ledger stops at 0039 before strict OTP foundation', () => {
    const tip = '0039_meal_composition_v2.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter((row) => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter((row) => row.issue === 'missing_table').map((row) => row.detail)).toEqual([
      'auth_otp_assertions', 'auth_otp_claims', 'auth_otp_issuances',
      'auth_otp_requests', 'auth_otp_scopes', 'auth_otp_tickets',
      'checkout_admissions', 'payment_reconciliation_records', ...familyTables,
    ].sort());
    expect(issues.some((row) => row.issue === 'unexpected_migration')).toBe(false);
  });

  it('rejects an unchanged 0040 database until checkout admission is applied', () => {
    const tip = '0040_strict_otp_foundation.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter((row) => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter((row) => row.issue === 'missing_table').map((row) => row.detail)).toEqual([
      'checkout_admissions', 'payment_reconciliation_records', ...familyTables,
    ].sort());
    expect(issues.filter((row) => row.issue === 'missing_index').map((row) => row.detail)).toEqual([
      'idx_checkout_admissions_user_state', 'idx_saved_recipe_entries_recent', 'idx_shopping_demand_reviews_item',
    ]);
  });

  it('rejects a 0041 database until family meal, saved dish and shopping persistence exists', () => {
    const tip = '0041_checkout_admission.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{issue:string;detail:string}>(gate);
    expect(issues.filter(row=>row.issue==='missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row=>row.issue==='missing_table').map(row=>row.detail)).toEqual(familyTables);
    expect(issues.filter(row=>row.issue==='missing_index').map(row=>row.detail)).toEqual(['idx_saved_recipe_entries_recent', 'idx_shopping_demand_reviews_item']);
  });
  it('rejects a 0042 database until unknown shopping demand review persistence exists', () => {
    const tip = '0042_family_meals_preferences_saved_shopping.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{issue:string;detail:string}>(gate);
    expect(issues.filter(row=>row.issue==='missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row=>row.issue==='missing_table').map(row=>row.detail)).toEqual(['shopping_demand_review_commands', 'shopping_demand_reviews']);
    expect(issues.filter(row=>row.issue==='missing_index').map(row=>row.detail)).toEqual(['idx_shopping_demand_reviews_item']);
    expect(issues.filter(row=>row.issue==='missing_trigger').map(row=>row.detail)).toEqual([
      'trg_shopping_demand_review_commands_immutable_delete', 'trg_shopping_demand_review_commands_immutable_update',
    ]);
  });
  it('fails closed when the ledger stops at 0034 or 0035 (legacy production tips)', () => {
    for (const tip of ['0034_global_recipe_catalog_parity.sql', '0035_recipe_media_layer.sql']) {
      const names = listMigrations();
      const applied = names.slice(0, names.indexOf(tip) + 1);
      const db = withLedger(applied, tip);
      const issues = db.query<{ issue: string; detail: string }>(gate);
      // Ledger gap plus schema objects introduced after the applied tip.
      expect(issues.filter((row) => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
      expect(issues.some((row) => row.issue === 'unexpected_migration')).toBe(false);
    }
  });

  it('fails closed when a ledger entry is missing from the middle of the chain', () => {
    const db = withLedger(listMigrations().filter((name) => !name.startsWith('0036_')));
    expect(db.query(gate)).toEqual([{ issue: 'missing_migration', detail: '0036_recipe_catalog_pilot.sql' }]);
  });

  it('fails closed when the database is ahead of the repository (unknown future migration)', () => {
    const db = withLedger([...listMigrations(), '0041_unknown_future.sql']);
    expect(db.query(gate)).toEqual([{ issue: 'unexpected_migration', detail: '0041_unknown_future.sql' }]);
  });

  it('fails closed when the ledger names a migration the repository never had', () => {
    const db = withLedger([...listMigrations().slice(0, -1), '0040_strict_otp_foundation_v2.sql']);
    expect(db.query(gate)).toEqual([
      { issue: 'missing_migration', detail: migrationTip() },
      { issue: 'unexpected_migration', detail: '0040_strict_otp_foundation_v2.sql' },
    ]);
  });

  it('refuses to render when the migration directory has a gap, a duplicate number, or no marker', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'frigo-gate-'));
    try {
      writeFileSync(path.join(dir, '0001_a.sql'), 'SELECT 1;');
      writeFileSync(path.join(dir, '0003_c.sql'), 'SELECT 1;');
      expect(() => listMigrations(dir)).toThrow('gap');
      writeFileSync(path.join(dir, '0002_b.sql'), 'SELECT 1;');
      writeFileSync(path.join(dir, '0002_dup.sql'), 'SELECT 1;');
      expect(() => listMigrations(dir)).toThrow('gap');
      const template = path.join(dir, 'gate.sql');
      writeFileSync(template, 'SELECT 1;');
      expect(() => renderSchemaGateSql({ template })).toThrow('exactly one');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
