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
  const globalPhase1Tables = ['catalog_manifest', 'recipe_search_documents', 'recipe_search_fts'];
  const globalPhase2Tables = ['barcode_products', 'recipe_content_localizations'];
  const globalPhase3Tables = ['billing_webhook_events', 'global_payment_intents', 'oauth_identities'];
  const globalPhase4Tables = ['consent_records', 'financial_tax_archive', 'privacy_requests'];
  const globalTables = [...globalPhase1Tables, ...globalPhase2Tables, ...globalPhase3Tables, ...globalPhase4Tables];
  const globalPhase1Columns = [
    'catalog_manifest.catalog_revision',
    'catalog_manifest.manifest_token',
    'households.country_code',
    'households.currency',
    'households.is_default_name',
    'households.locale',
    'households.timezone',
    'households.week_start_day',
    'recipe_search_documents.locale',
    'recipe_search_documents.normalized_title',
    'recipe_search_documents.recipe_id',
    'recipe_search_documents.search_tokens',
    'shopping_lists.is_default_name',
    'user_preferences.country_code',
    'user_preferences.currency',
    'user_preferences.locale',
    'user_preferences.timezone',
    'user_preferences.week_start_day',
  ];
  const globalPhase2Columns = [
    'barcode_products.allergen_tags_json',
    'barcode_products.barcode',
    'barcode_products.barcode_symbology',
    'barcode_products.expires_at',
    'barcode_products.product_name',
    'nutrition_profiles.edible_yield_ratio',
    'nutrition_profiles.energy_kj',
    'nutrition_profiles.salt_g',
    'nutrition_profiles.saturated_fat_g',
    'recipe_content_localizations.fingerprint',
    'recipe_content_localizations.locale',
    'recipe_content_localizations.localized_slug',
    'recipe_content_localizations.steps_json',
    'recipe_content_localizations.title',
    'scan_items.barcode',
    'scan_items.currency',
    'scan_items.discount_amount_minor',
    'scan_items.expiry_regime',
    'scan_items.storage_zone',
    'scan_items.total_price_minor',
    'scan_items.unit_price_minor',
    'scans.ai_region',
    'scans.currency',
    'scans.discount_amount_minor',
    'scans.tax_amount_minor',
    'scans.total_amount_minor',
  ];
  const globalPhase3Columns = [
    'billing_webhook_events.event_id',
    'billing_webhook_events.provider',
    'global_payment_intents.amount_minor',
    'global_payment_intents.currency',
    'global_payment_intents.eu_withdrawal_waiver_at',
    'global_payment_intents.minor_digits',
    'global_payment_intents.provider',
    'global_payment_intents.status',
    'oauth_identities.is_private_relay',
    'oauth_identities.provider',
    'oauth_identities.provider_subject',
    'oauth_identities.user_id',
    'subscriptions.billing_currency',
    'subscriptions.cancel_at_period_end',
    'subscriptions.dodo_customer_id',
    'subscriptions.grace_period_ends_at',
    'subscriptions.provider',
    'subscriptions.provider_subscription_id',
  ];
  const globalPhase4Columns = [
    'consent_records.consent_type',
    'consent_records.granted',
    'consent_records.jurisdiction',
    'consent_records.policy_version',
    'consent_records.user_id',
    'financial_tax_archive.amount_minor',
    'financial_tax_archive.country_code',
    'financial_tax_archive.provider',
    'financial_tax_archive.retention_until',
    'financial_tax_archive.source_intent_hash',
    'privacy_requests.deadline_at',
    'privacy_requests.jurisdiction',
    'privacy_requests.r2_keys_json',
    'privacy_requests.request_type',
    'privacy_requests.status',
    'privacy_requests.subject_hash',
    'users.erased_at',
  ];
  const globalColumns = [...globalPhase1Columns, ...globalPhase2Columns, ...globalPhase3Columns, ...globalPhase4Columns];
  const missingGlobalPhase2Columns = globalPhase2Columns.map(detail => ({ issue: 'missing_column', detail }));
  const missingGlobalPhase3Columns = globalPhase3Columns.map(detail => ({ issue: 'missing_column', detail }));
  const missingGlobalPhase4Columns = globalPhase4Columns.map(detail => ({ issue: 'missing_column', detail }));
  const missingGlobalColumns = globalColumns.map(detail => ({ issue: 'missing_column', detail }));
  const globalPhase1Indexes = [
    'idx_household_members_user_household',
    'idx_recipe_search_docs_locale_title',
    'idx_scans_household_created',
    'idx_shopping_lists_household_created',
  ];
  const globalPhase2Indexes = [
    'idx_barcode_products_expires_at',
    'idx_barcode_products_ingredient',
    'idx_recipe_content_localizations_locale_slug',
  ];
  const globalPhase3Indexes = [
    'idx_global_payment_intents_provider_ref',
    'idx_global_payment_intents_provider_session',
    'idx_global_payment_intents_user_idem',
    'idx_global_payment_intents_user_status',
    'idx_oauth_identities_user',
  ];
  const globalPhase4Indexes = [
    'idx_consent_records_user_type',
    'idx_financial_tax_archive_retention',
    'idx_privacy_requests_status_deadline',
  ];
  const globalIndexes = [...globalPhase1Indexes, ...globalPhase2Indexes, ...globalPhase3Indexes, ...globalPhase4Indexes];
  const globalTriggers = [
    'trg_catalog_manifest_no_delete',
    'trg_catalog_rev_recipes_del',
    'trg_catalog_rev_recipes_ins',
    'trg_catalog_rev_recipes_upd',
    'trg_recipe_search_docs_del',
    'trg_recipe_search_docs_ins',
    'trg_recipe_search_docs_upd',
  ];
  const standardV4Tables = [
    'culinary_standard_v4_ingredients',
    'recipe_standard_v4_catalog',
    'recipe_standard_v4_ingredients',
    'recipe_standard_v4_steps',
  ];
  const standardV4Columns = [
    'culinary_standard_v4_ingredients.edible_yield_ratio',
    'culinary_standard_v4_ingredients.energy_kcal',
    'recipe_standard_v4_catalog.allergen_tags_json',
    'recipe_standard_v4_catalog.runtime_order',
    'recipe_standard_v4_ingredients.culinary_measure',
    'recipe_standard_v4_ingredients.edible_grams',
    'recipe_standard_v4_steps.instruction',
    'recipe_standard_v4_steps.phase',
  ];
  const missingStandardV4Columns = standardV4Columns.map(detail => ({ issue: 'missing_column', detail }));
  const standardV4Indexes = [
    'idx_recipe_standard_v4_ingredients_recipe',
    'idx_recipe_standard_v4_steps_recipe',
  ];

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
      'checkout_admissions', 'payment_reconciliation_records', ...familyTables, 'recipe_content_access', 'recipe_content_versions', 'week_swap_receipts', ...globalTables, ...standardV4Tables,
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
      'checkout_admissions', 'payment_reconciliation_records', ...familyTables, 'recipe_content_access', 'recipe_content_versions', 'week_swap_receipts', ...globalTables, ...standardV4Tables,
    ].sort());
    expect(issues.filter((row) => row.issue === 'missing_index').map((row) => row.detail)).toEqual([
      'idx_checkout_admissions_user_state', 'idx_recipe_content_versions_recipe', 'idx_saved_recipe_entries_recent', 'idx_shopping_demand_reviews_item', ...globalIndexes, ...standardV4Indexes,
    ].sort());
  });

  it('rejects a 0041 database until family meal, saved dish and shopping persistence exists', () => {
    const tip = '0041_checkout_admission.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{issue:string;detail:string}>(gate);
    expect(issues.filter(row=>row.issue==='missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row=>row.issue==='missing_table').map(row=>row.detail)).toEqual([...familyTables, 'recipe_content_access', 'recipe_content_versions', 'week_swap_receipts', ...globalTables, ...standardV4Tables].sort());
    expect(issues.filter(row=>row.issue==='missing_index').map(row=>row.detail)).toEqual(['idx_recipe_content_versions_recipe', 'idx_saved_recipe_entries_recent', 'idx_shopping_demand_reviews_item', ...globalIndexes, ...standardV4Indexes].sort());
  });
  it('rejects a 0042 database until unknown shopping demand review persistence exists', () => {
    const tip = '0042_family_meals_preferences_saved_shopping.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{issue:string;detail:string}>(gate);
    expect(issues.filter(row=>row.issue==='missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row=>row.issue==='missing_table').map(row=>row.detail)).toEqual(['recipe_content_access', 'recipe_content_versions', 'shopping_demand_review_commands', 'shopping_demand_reviews', 'week_swap_receipts', ...globalTables, ...standardV4Tables].sort());
    expect(issues.filter(row=>row.issue==='missing_index').map(row=>row.detail)).toEqual(['idx_recipe_content_versions_recipe', 'idx_shopping_demand_reviews_item', ...globalIndexes, ...standardV4Indexes].sort());
    expect(issues.filter(row=>row.issue==='missing_trigger').map(row=>row.detail)).toEqual([
      ...contentTriggers, ...savedContentTriggers, ...categoryTriggers, 'trg_shopping_demand_review_commands_immutable_delete', 'trg_shopping_demand_review_commands_immutable_update', ...receiptTriggers, ...globalTriggers,
    ].sort());
  });
  it('rejects a 0043 database until authoritative category storage and guards exist', () => {
    const tip = '0043_shopping_demand_review.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter(row => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row => row.issue === 'missing_column')).toEqual([
      ...missingContentColumns, missingSavedContentColumn, { issue: 'missing_column', detail: 'inventory_lots.display_category' }, ...missingReceiptColumns, ...missingGlobalColumns, ...missingStandardV4Columns,
    ].sort((a, b) => a.detail.localeCompare(b.detail)));
    expect(issues.filter(row => row.issue === 'missing_trigger').map(row => row.detail)).toEqual([...contentTriggers, ...savedContentTriggers, ...categoryTriggers, ...receiptTriggers, ...globalTriggers].sort());
  });
  it('rejects a 0044 database until immutable keyed swap receipts exist', () => {
    const tip = '0044_inventory_display_category.sql'; const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    const issues = db.query<{ issue: string; detail: string }>(gate);
    expect(issues.filter(row => row.issue === 'missing_migration')).toEqual(missingMigrationsAfter(tip));
    expect(issues.filter(row => row.issue === 'missing_table')).toEqual(['recipe_content_access', 'recipe_content_versions', 'week_swap_receipts', ...globalTables, ...standardV4Tables].sort().map(detail => ({ issue: 'missing_table', detail })));
    expect(issues.filter(row => row.issue === 'missing_column')).toEqual([...missingContentColumns, missingSavedContentColumn, ...missingReceiptColumns, ...missingGlobalColumns, ...missingStandardV4Columns].sort((a, b) => a.detail.localeCompare(b.detail)));
    expect(issues.filter(row => row.issue === 'missing_trigger').map(row => row.detail)).toEqual([...contentTriggers, ...savedContentTriggers, ...receiptTriggers, ...globalTriggers].sort());
  });
  it('rejects a 0045 database until content archive and receipt references exist', () => {
    const tip = '0045_week_swap_receipts.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      { issue: 'missing_migration', detail: '0046_recipe_content_versions.sql' },
      { issue: 'missing_migration', detail: '0047_saved_recipe_content.sql' },
      { issue: 'missing_migration', detail: '0048_global_locale_timezone_and_search_foundation.sql' },
      { issue: 'missing_migration', detail: '0049_global_culinary_allergens_units_barcode_and_ocr.sql' },
      { issue: 'missing_migration', detail: '0050_global_billing_subscriptions_and_oauth_identities.sql' },
      { issue: 'missing_migration', detail: '0051_privacy_erasure_portability_and_consent_ledger.sql' },
      { issue: 'missing_migration', detail: '0052_culinary_standard_v4_catalog_500.sql' },
      { issue: 'missing_table', detail: 'recipe_content_access' },
      { issue: 'missing_table', detail: 'recipe_content_versions' },
      ...[...globalTables, ...standardV4Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...missingContentColumns,
      missingSavedContentColumn,
      ...missingGlobalColumns,
      ...missingStandardV4Columns,
      { issue: 'missing_index', detail: 'idx_recipe_content_versions_recipe' },
      ...[...globalIndexes, ...standardV4Indexes].map(detail => ({ issue: 'missing_index', detail })),
      ...[...contentTriggers, ...savedContentTriggers, ...globalTriggers].map(detail => ({ issue: 'missing_trigger', detail })),
    ].sort((a, b) => a.issue.localeCompare(b.issue) || a.detail.localeCompare(b.detail)));
  });
  it('rejects a 0046 database until saved composition content is applied', () => {
    const tip = '0046_recipe_content_versions.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      missingSavedContentColumn,
      ...missingGlobalColumns,
      ...missingStandardV4Columns,
      { issue: 'missing_migration', detail: '0047_saved_recipe_content.sql' },
      { issue: 'missing_migration', detail: '0048_global_locale_timezone_and_search_foundation.sql' },
      { issue: 'missing_migration', detail: '0049_global_culinary_allergens_units_barcode_and_ocr.sql' },
      { issue: 'missing_migration', detail: '0050_global_billing_subscriptions_and_oauth_identities.sql' },
      { issue: 'missing_migration', detail: '0051_privacy_erasure_portability_and_consent_ledger.sql' },
      { issue: 'missing_migration', detail: '0052_culinary_standard_v4_catalog_500.sql' },
      ...[...globalTables, ...standardV4Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...[...globalIndexes, ...standardV4Indexes].map(detail => ({ issue: 'missing_index', detail })),
      ...[...savedContentTriggers, ...globalTriggers].map(detail => ({ issue: 'missing_trigger', detail })),
    ].sort((a, b) => a.issue.localeCompare(b.issue) || a.detail.localeCompare(b.detail)));
  });
  it('rejects a 0047 database until global locale/timezone/FTS5 foundation is applied', () => {
    const tip = '0047_saved_recipe_content.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingGlobalColumns,
      ...missingStandardV4Columns,
      { issue: 'missing_migration', detail: '0048_global_locale_timezone_and_search_foundation.sql' },
      { issue: 'missing_migration', detail: '0049_global_culinary_allergens_units_barcode_and_ocr.sql' },
      { issue: 'missing_migration', detail: '0050_global_billing_subscriptions_and_oauth_identities.sql' },
      { issue: 'missing_migration', detail: '0051_privacy_erasure_portability_and_consent_ledger.sql' },
      { issue: 'missing_migration', detail: '0052_culinary_standard_v4_catalog_500.sql' },
      ...[...globalTables, ...standardV4Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...[...globalIndexes, ...standardV4Indexes].map(detail => ({ issue: 'missing_index', detail })),
      ...globalTriggers.map(detail => ({ issue: 'missing_trigger', detail })),
    ].sort((a, b) => a.issue.localeCompare(b.issue) || a.detail.localeCompare(b.detail)));
  });
  it('rejects a 0048 database until global Phase 2 culinary/barcode/OCR tables and columns are applied', () => {
    const tip = '0048_global_locale_timezone_and_search_foundation.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingGlobalPhase2Columns,
      ...missingGlobalPhase3Columns,
      ...missingGlobalPhase4Columns,
      ...missingStandardV4Columns,
      { issue: 'missing_migration', detail: '0049_global_culinary_allergens_units_barcode_and_ocr.sql' },
      { issue: 'missing_migration', detail: '0050_global_billing_subscriptions_and_oauth_identities.sql' },
      { issue: 'missing_migration', detail: '0051_privacy_erasure_portability_and_consent_ledger.sql' },
      { issue: 'missing_migration', detail: '0052_culinary_standard_v4_catalog_500.sql' },
      ...[...globalPhase2Tables, ...globalPhase3Tables, ...globalPhase4Tables, ...standardV4Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...[...globalPhase2Indexes, ...globalPhase3Indexes, ...globalPhase4Indexes, ...standardV4Indexes].map(detail => ({ issue: 'missing_index', detail })),
    ].sort((a, b) => a.issue.localeCompare(b.issue) || a.detail.localeCompare(b.detail)));
  });
  it('rejects a 0049 database until global Phase 3 billing & OAuth tables and columns are applied', () => {
    const tip = '0049_global_culinary_allergens_units_barcode_and_ocr.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingGlobalPhase3Columns,
      ...missingGlobalPhase4Columns,
      ...missingStandardV4Columns,
      { issue: 'missing_migration', detail: '0050_global_billing_subscriptions_and_oauth_identities.sql' },
      { issue: 'missing_migration', detail: '0051_privacy_erasure_portability_and_consent_ledger.sql' },
      { issue: 'missing_migration', detail: '0052_culinary_standard_v4_catalog_500.sql' },
      ...[...globalPhase3Tables, ...globalPhase4Tables, ...standardV4Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...[...globalPhase3Indexes, ...globalPhase4Indexes, ...standardV4Indexes].map(detail => ({ issue: 'missing_index', detail })),
    ].sort((a, b) => a.issue.localeCompare(b.issue) || a.detail.localeCompare(b.detail)));
  });
  it('rejects a 0050 database until global Phase 4 privacy erasure/portability/consent tables and columns are applied', () => {
    const tip = '0050_global_billing_subscriptions_and_oauth_identities.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingGlobalPhase4Columns,
      ...missingStandardV4Columns,
      { issue: 'missing_migration', detail: '0051_privacy_erasure_portability_and_consent_ledger.sql' },
      { issue: 'missing_migration', detail: '0052_culinary_standard_v4_catalog_500.sql' },
      ...[...globalPhase4Tables, ...standardV4Tables].map(detail => ({ issue: 'missing_table', detail })),
      ...[...globalPhase4Indexes, ...standardV4Indexes].map(detail => ({ issue: 'missing_index', detail })),
    ].sort((a, b) => a.issue.localeCompare(b.issue) || a.detail.localeCompare(b.detail)));
  });
  it('rejects a 0051 database until Culinary Standard V4 catalog tables and indexes are applied', () => {
    const tip = '0051_privacy_erasure_portability_and_consent_ledger.sql';
    const names = listMigrations();
    const db = withLedger(names.slice(0, names.indexOf(tip) + 1), tip);
    expect(db.query(gate)).toEqual([
      ...missingStandardV4Columns,
      { issue: 'missing_migration', detail: '0052_culinary_standard_v4_catalog_500.sql' },
      ...standardV4Tables.map(detail => ({ issue: 'missing_table', detail })),
      ...standardV4Indexes.map(detail => ({ issue: 'missing_index', detail })),
    ].sort((a, b) => a.issue.localeCompare(b.issue) || a.detail.localeCompare(b.detail)));
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
