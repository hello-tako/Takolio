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
  const categoryTriggers = ['trg_inventory_adoption_category_authority_insert',
    'trg_inventory_commands_category_authority_insert', 'trg_inventory_events_category_authority_insert',
    'trg_inventory_lots_display_category_insert', 'trg_inventory_lots_display_category_update'];
  const receiptColumns = ['id', 'household_id', 'actor_id', 'plan_id', 'meal_id', 'client_key', 'fingerprint', 'created_at'];
  const missingReceiptColumns = receiptColumns.map(column => ({ issue: 'missing_column', detail: `week_swap_receipts.${column}` })).sort((a, b) => a.detail.localeCompare(b.detail));
  const receiptTriggers = ['trg_week_swap_receipts_immutable_delete', 'trg_week_swap_receipts_immutable_insert', 'trg_week_swap_receipts_immutable_update'];
  const contentColumns = ['cooked_meals.recipe_content_fingerprint', 'cooked_meals.request_fingerprint', ...['created_at', 'fingerprint', 'household_id'].map(column => `recipe_content_access.${column}`), ...['content_json', 'created_at', 'fingerprint', 'recipe_id', 'slug'].map(column => `recipe_content_versions.${column}`)];
  const missingContentColumns = contentColumns.map(detail => ({ issue: 'missing_column', detail }));
  const contentTriggers = ['trg_cooked_meals_content_insert', 'trg_cooked_meals_content_update', 'trg_cooked_meals_request_update', 'trg_recipe_content_versions_delete', 'trg_recipe_content_versions_insert', 'trg_recipe_content_versions_update'];
  const savedContentColumn = 'generated_meal_plan_components.recipe_content_fingerprint';
  const savedContentTriggers = ['trg_meal_components_content_insert', 'trg_meal_components_content_update'];
  const missingSavedContentColumn = { issue: 'missing_column', detail: savedContentColumn };
  const v4Tables = ['cooking_sessions', 'household_invites', 'user_notifications'];
  const v4Indexes = [
    'idx_ai_requests_created_at',
    'idx_cooked_meals_hh_completed',
    'idx_cooking_sessions_hh_status_updated',
    'idx_household_invites_household_id',
    'idx_household_invites_invite_code',
    'idx_household_members_user_id',
    'idx_inventory_obs_hh_status',
    'idx_scans_household_created_at',
    'idx_scans_status_created_at',
    'idx_shopping_lists_household_id',
    'idx_user_notifications_hh_read_created',
  ];
  const v6Tables = [
    'custom_household_recipes',
    'd1_idempotency_keys',
    'household_activity_events',
    'household_budget_entries',
    'household_waste_events',
    'pantry_staple_thresholds',
  ];
  const v6Indexes = [
    'idx_activity_events_hh_created',
    'idx_budget_entries_hh_spent',
    'idx_custom_hh_recipes_hh_updated',
    'idx_d1_idempotency_expires',
    'idx_pantry_thresholds_hh',
    'idx_waste_events_hh_occurred',
  ];
  const asciiSort = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const issueSort = (a: { issue: string; detail: string }, b: { issue: string; detail: string }) =>
    asciiSort(a.issue, b.issue) || asciiSort(a.detail, b.detail);

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
      'checkout_admissions', 'payment_reconciliation_records', ...familyTables, 'recipe_content_access', 'recipe_content_versions', ...v4Tables, ...v6Tables, 'week_swap_receipts',
    ].sort(asciiSort));
    expect(issues.some((row) => row.issue === 'unexpected_migration')).toBe(false);
  });

  it('rejects an unchanged 0040 database until checkout admission is applied', () => {
    const tip = '0040_strict_otp_foundation.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter((row) => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter((row) => row.issue === 'missing_table').map((row) => row.detail)).toEqual([
      'checkout_admissions', 'payment_reconciliation_records', ...familyTables, 'recipe_content_access', 'recipe_content_versions', ...v4Tables, ...v6Tables, 'week_swap_receipts',
    ].sort(asciiSort));
    expect(issues.filter((row) => row.issue === 'missing_index').map((row) => row.detail)).toEqual([
      'idx_checkout_admissions_user_state', 'idx_recipe_content_versions_recipe', 'idx_saved_recipe_entries_recent', 'idx_shopping_demand_reviews_item', ...v4Indexes, ...v6Indexes,
    ].sort(asciiSort));
  });

  it('rejects a 0041 database until family meal, saved dish and shopping persistence exists', () => {
    const tip = '0041_checkout_admission.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{issue:string;detail:string}>(gate);
    expect(issues.filter(row=>row.issue==='missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row=>row.issue==='missing_table').map(row=>row.detail)).toEqual([...familyTables, 'recipe_content_access', 'recipe_content_versions', ...v4Tables, ...v6Tables, 'week_swap_receipts'].sort(asciiSort));
    expect(issues.filter(row=>row.issue==='missing_index').map(row=>row.detail)).toEqual(['idx_recipe_content_versions_recipe', 'idx_saved_recipe_entries_recent', 'idx_shopping_demand_reviews_item', ...v4Indexes, ...v6Indexes].sort(asciiSort));
  });
  it('rejects a 0042 database until unknown shopping demand review persistence exists', () => {
    const tip = '0042_family_meals_preferences_saved_shopping.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{issue:string;detail:string}>(gate);
    expect(issues.filter(row=>row.issue==='missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row=>row.issue==='missing_table').map(row=>row.detail)).toEqual(['recipe_content_access', 'recipe_content_versions', 'shopping_demand_review_commands', 'shopping_demand_reviews', ...v4Tables, ...v6Tables, 'week_swap_receipts'].sort(asciiSort));
    expect(issues.filter(row=>row.issue==='missing_index').map(row=>row.detail)).toEqual(['idx_recipe_content_versions_recipe', 'idx_shopping_demand_reviews_item', ...v4Indexes, ...v6Indexes].sort(asciiSort));
    expect(issues.filter(row=>row.issue==='missing_trigger').map(row=>row.detail)).toEqual([
      ...contentTriggers, ...savedContentTriggers, ...categoryTriggers, 'trg_shopping_demand_review_commands_immutable_delete', 'trg_shopping_demand_review_commands_immutable_update', ...receiptTriggers,
    ].sort(asciiSort));
  });
  it('rejects a 0043 database until authoritative category storage and guards exist', () => {
    const tip = '0043_shopping_demand_review.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter(row => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row => row.issue === 'missing_column')).toEqual([
      ...missingContentColumns, missingSavedContentColumn, { issue: 'missing_column', detail: 'inventory_lots.display_category' }, ...missingReceiptColumns,
    ].sort(issueSort));
    expect(issues.filter(row => row.issue === 'missing_trigger').map(row => row.detail)).toEqual([...contentTriggers, ...savedContentTriggers, ...categoryTriggers, ...receiptTriggers].sort(asciiSort));
  });
  it('rejects a 0044 database until immutable keyed swap receipts exist', () => {
    const tip = '0044_inventory_display_category.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter(row => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row => row.issue === 'missing_table')).toEqual(['recipe_content_access', 'recipe_content_versions', ...v4Tables, ...v6Tables, 'week_swap_receipts'].sort(asciiSort).map(detail => ({ issue: 'missing_table', detail })));
    expect(issues.filter(row => row.issue === 'missing_column')).toEqual([...missingContentColumns, missingSavedContentColumn, ...missingReceiptColumns].sort(issueSort));
    expect(issues.filter(row => row.issue === 'missing_trigger').map(row => row.detail)).toEqual([...contentTriggers, ...savedContentTriggers, ...receiptTriggers].sort(asciiSort));
  });
  it('rejects a 0045 database until content archive and receipt references exist', () => {
    const tip = '0045_week_swap_receipts.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingMigrationsAfter(tip),
      ...['recipe_content_access', 'recipe_content_versions', ...v4Tables, ...v6Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...missingContentColumns,
      missingSavedContentColumn,
      ...['idx_recipe_content_versions_recipe', ...v4Indexes, ...v6Indexes].map(detail => ({ issue: 'missing_index', detail })),
      ...[...contentTriggers, ...savedContentTriggers].map(detail => ({ issue: 'missing_trigger', detail })),
    ].sort(issueSort));
  });
  it('rejects a 0046 database until saved composition content is applied', () => {
    const tip = '0046_recipe_content_versions.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      missingSavedContentColumn,
      ...missingMigrationsAfter(tip),
      ...[...v4Tables, ...v6Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...[...v4Indexes, ...v6Indexes].map(detail => ({ issue: 'missing_index', detail })),
      ...savedContentTriggers.map(detail => ({ issue: 'missing_trigger', detail })),
    ].sort(issueSort));
  });
  it('rejects a 0047 database until Takolio V4 unified platform tables and indexes exist', () => {
    const tip = '0047_saved_recipe_content.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingMigrationsAfter(tip),
      ...[...v4Tables, ...v6Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...[...v4Indexes, ...v6Indexes].map(detail => ({ issue: 'missing_index', detail })),
    ].sort(issueSort));
  });
  it('rejects a 0048 database until Takolio V6 culinary OS and backend power tables and indexes exist', () => {
    const tip = '0048_takolio_v4_unified_platform.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingMigrationsAfter(tip),
      ...v6Tables.map(detail => ({ issue: 'missing_table', detail })),
      ...v6Indexes.map(detail => ({ issue: 'missing_index', detail })),
    ].sort(issueSort));
  });
  it.each([...contentColumns, savedContentColumn])('rejects a complete ledger with missing content column %s', (qualified) => {
    const [table, column] = qualified.split('.');
    const db = withLedger(listMigrations());
    db.seed(`ALTER TABLE ${table} RENAME COLUMN ${column} TO missing_${column}`);
    expect(db.query(gate)).toEqual([{ issue: 'missing_column', detail: qualified }]);
  });
  it.each(receiptColumns)('rejects a complete ledger with missing receipt column %s', (column) => {
    const db = withLedger(listMigrations());
    db.seed(`ALTER TABLE week_swap_receipts RENAME COLUMN ${column} TO missing_${column}`);
    expect(db.query(gate)).toEqual([{ issue: 'missing_column', detail: `week_swap_receipts.${column}` }]);
  });
  it.each([...contentTriggers, ...savedContentTriggers, ...categoryTriggers, ...receiptTriggers])('rejects a complete ledger with missing guard %s', (trigger) => {
    const db = withLedger(listMigrations());
    db.seed(`DROP TRIGGER ${trigger}`);
    expect(db.query(gate)).toEqual([{ issue: 'missing_trigger', detail: trigger }]);
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
