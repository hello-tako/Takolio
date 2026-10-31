WITH
-- Populated by scripts/d1-schema-gate.mjs from the migrations/ directory of the checked-out
-- commit (0001..tip, contiguous). The payment migration 0018 and production 0023 are part of
-- that list and remain immutable/protected. Never hand-edit the list here.
required_migrations(name) AS (
  VALUES
-- @required_migrations
),
-- Ledger must equal the required list exactly: a missing migration means the schema is
-- behind the release; an unexpected entry means the database is ahead of (or diverged
-- from) the repository and needs an explicit migration/rollback owner review.
migration_ledger_issues(issue, detail) AS (
  SELECT 'missing_migration', migration.name
  FROM required_migrations migration
  WHERE NOT EXISTS (
    SELECT 1 FROM d1_migrations applied WHERE applied.name = migration.name
  )
  UNION ALL
  SELECT 'unexpected_migration', applied.name
  FROM d1_migrations applied
  WHERE NOT EXISTS (
    SELECT 1 FROM required_migrations migration WHERE migration.name = applied.name
  )
),
required_tables(name) AS (
  VALUES
    ('users'),
    ('households'),
    ('inventory_items'),
    ('inventory_events'),
    ('inventory_commands'),
    ('inventory_lots'),
    ('storage_locations'),
    ('inventory_observations'),
    ('inventory_reconciliation_decisions'),
    ('scans'),
    ('meal_plans'),
    ('shopping_import_commands'),
    ('meal_plan_days_v2'),
    ('meal_plan_slots_v2'),
    ('meal_plan_shopping_items_v2')
    ,('scan_queue_jobs')
    ,('sessions_v2')
    ,('auth_otps')
    ,('auth_otp_scopes')
    ,('auth_otp_requests')
    ,('auth_otp_issuances')
    ,('auth_otp_tickets')
    ,('auth_otp_claims')
    ,('auth_otp_assertions')
    ,('checkout_admissions')
    ,('payment_reconciliation_records')
    ,('scan_quota_periods')
    ,('scan_quota_ledger')
    ,('measurement_units')
    ,('ingredient_tags')
    ,('ingredient_storage_guidelines')
    ,('nutrition_profiles')
    ,('ingredient_nutrition')
    ,('recipe_families')
    ,('recipe_family_slots')
    ,('recipe_family_options')
    ,('recipe_nutrition')
    ,('recipe_classifications')
    ,('recipe_runtime_fields')
    ,('recipe_runtime_ingredient_order')
    ,('recipe_media')
    ,('household_ranking_preferences')
    ,('member_ranking_preferences')
    ,('recipe_feedback_events')
    ,('generated_meal_plans')
    ,('generated_meal_plan_annotations')
    ,('family_meal_preferences')
    ,('saved_recipe_entries')
    ,('generated_family_meal_plans')
    ,('shopping_plan_sources')
    ,('shopping_plan_demands')
    ,('shopping_generated_item_state')
    ,('shopping_plan_commands')
    ,('shopping_item_metadata')
    ,('shopping_plan_item_dismissals')
    ,('shopping_demand_reviews')
    ,('shopping_demand_review_commands')
    ,('week_swap_receipts')
    ,('recipe_content_versions')
    ,('recipe_content_access')
    ,('generated_meal_plan_components')
),
required_columns(table_name, column_name) AS (
  VALUES
    ('inventory_items', 'version'),
    ('households', 'inventory_version'),
    ('inventory_events', 'command_id'),
    ('inventory_lots', 'legacy_item_id'),
    ('inventory_lots', 'quantity_milli'),
    ('inventory_lots', 'canonical_unit'),
    ('inventory_lots', 'storage_location_id'),
    ('inventory_lots', 'source_id'),
    ('inventory_lots', 'version'),
    ('inventory_lots', 'display_category'),
    ('inventory_items', 'opened_at'),
    ('inventory_items', 'expiry_kind'),
    ('inventory_items', 'expiry_source'),
    ('ingredients', 'default_name'),
    ('ingredients', 'subcategory'),
    ('ingredients', 'allergen_review_state'),
    ('ingredient_aliases', 'language'),
    ('ingredient_aliases', 'normalized_alias'),
    ('recipes', 'family_id'),
    ('recipes', 'prep_time_minutes'),
    ('recipes', 'source_type'),
    ('recipes', 'source_reference'),
    ('recipes', 'verification_state'),
    ('recipes', 'version'),
    ('meal_plans', 'snapshot_json'),
    ('shopping_import_commands', 'request_fingerprint'),
    ('shopping_import_commands', 'lock_token'),
    ('meal_plan_days_v2', 'day_type'),
    ('meal_plan_days_v2', 'snapshot_json'),
    ('meal_plan_slots_v2', 'source'),
    ('meal_plan_slots_v2', 'is_locked'),
    ('meal_plan_slots_v2', 'leftover_source_id'),
    ('meal_plan_slots_v2', 'snapshot_json'),
    ('meal_plan_shopping_items_v2', 'required_quantity'),
    ('meal_plan_shopping_items_v2', 'inventory_quantity'),
    ('meal_plan_shopping_items_v2', 'missing_quantity'),
    ('meal_plan_shopping_items_v2', 'purchase_quantity'),
    ('meal_plan_shopping_items_v2', 'estimated_price_min'),
    ('meal_plan_shopping_items_v2', 'estimated_price_max'),
    ('meal_plan_shopping_items_v2', 'snapshot_json')
    ,('checkout_admissions', 'user_id')
    ,('checkout_admissions', 'request_key')
    ,('checkout_admissions', 'intent_id')
    ,('checkout_admissions', 'plan')
    ,('checkout_admissions', 'state')
    ,('checkout_admissions', 'attempt_id')
    ,('checkout_admissions', 'deadline_at')
    ,('checkout_admissions', 'instructions_json')
    ,('checkout_admissions', 'created_at')
    ,('checkout_admissions', 'updated_at')
    ,('payment_reconciliation_records', 'intent_id')
    ,('payment_reconciliation_records', 'reason')
    ,('payment_reconciliation_records', 'first_observed_at')
    ,('payment_reconciliation_records', 'last_observed_at')
    ,('auth_otp_scopes', 'scope_hash')
    ,('auth_otp_scopes', 'account_hash')
    ,('auth_otp_scopes', 'purpose')
    ,('auth_otp_scopes', 'generation')
    ,('auth_otp_scopes', 'current_issuance_id')
    ,('auth_otp_scopes', 'cooldown_until')
    ,('auth_otp_scopes', 'locked_until')
    ,('auth_otp_scopes', 'initialized_at')
    ,('auth_otp_scopes', 'legacy_weight')
    ,('auth_otp_requests', 'id')
    ,('auth_otp_requests', 'account_hash')
    ,('auth_otp_requests', 'scope_hash')
    ,('auth_otp_requests', 'request_key')
    ,('auth_otp_requests', 'operation')
    ,('auth_otp_requests', 'purpose')
    ,('auth_otp_requests', 'fingerprint')
    ,('auth_otp_requests', 'generation')
    ,('auth_otp_requests', 'issuance_id')
    ,('auth_otp_requests', 'owner_id')
    ,('auth_otp_requests', 'status')
    ,('auth_otp_requests', 'created_at')
    ,('auth_otp_requests', 'retained_until')
    ,('auth_otp_requests', 'proof_expires_at')
    ,('auth_otp_issuances', 'id')
    ,('auth_otp_issuances', 'scope_hash')
    ,('auth_otp_issuances', 'generation')
    ,('auth_otp_issuances', 'request_id')
    ,('auth_otp_issuances', 'state')
    ,('auth_otp_issuances', 'expected_digest')
    ,('auth_otp_issuances', 'digest_version')
    ,('auth_otp_issuances', 'account_id')
    ,('auth_otp_issuances', 'user_id')
    ,('auth_otp_issuances', 'created_at')
    ,('auth_otp_issuances', 'expires_at')
    ,('auth_otp_issuances', 'used')
    ,('auth_otp_tickets', 'id')
    ,('auth_otp_tickets', 'scope_hash')
    ,('auth_otp_tickets', 'request_id')
    ,('auth_otp_tickets', 'issuance_id')
    ,('auth_otp_tickets', 'generation')
    ,('auth_otp_tickets', 'owner_id')
    ,('auth_otp_tickets', 'operation')
    ,('auth_otp_tickets', 'state')
    ,('auth_otp_tickets', 'weight')
    ,('auth_otp_tickets', 'admitted_at')
    ,('auth_otp_tickets', 'deadline')
    ,('auth_otp_tickets', 'proof_expires_at')
    ,('auth_otp_claims', 'id')
    ,('auth_otp_claims', 'kind')
    ,('auth_otp_claims', 'now_sec')
    ,('auth_otp_assertions', 'command_id')
    ,('auth_otp_assertions', 'ok')
    ,('scan_queue_jobs', 'status')
    ,('scan_queue_jobs', 'attempts')
    ,('scan_queue_jobs', 'max_attempts')
    ,('scan_queue_jobs', 'idempotency_key')
    ,('scan_queue_jobs', 'claim_token')
    ,('scan_queue_jobs', 'claim_attempt')
    ,('sessions_v2', 'token_hash')
    ,('sessions_v2', 'revoked_at')
    ,('auth_otps', 'code_digest')
    ,('auth_otps', 'digest_version')
    ,('auth_otps', 'attempt_count')
    ,('auth_otps', 'locked_until')
    ,('auth_otps', 'used_at')
    ,('scan_quota_ledger', 'idempotency_key')
    ,('scan_quota_ledger', 'status')
    ,('scan_quota_periods', 'used_count')
    ,('scans', 'merchant_name')
    ,('scans', 'invoice_number')
    ,('scans', 'purchase_date')
    ,('scans', 'total_amount_vnd')
    ,('scan_items', 'unit_price_vnd')
    ,('scan_items', 'total_price_vnd')
    ,('scans', 'request_fingerprint')
    ,('scans', 'image_mime_type')
    -- T13 bridge (0032): raw OCR/vision evidence retained separately from the
    -- reviewable values, plus the explicit per-line review lifecycle.
    ,('scan_items', 'ocr_raw_name')
    ,('scan_items', 'ocr_quantity')
    ,('scan_items', 'ocr_unit')
    ,('scan_items', 'ocr_confidence')
    ,('scan_items', 'review_state')
    -- T13R-A bridge (0033): complete raw mapping evidence and reviewed expiry.
    ,('scan_items', 'ocr_canonical_id')
    ,('scan_items', 'ocr_category')
    ,('scan_items', 'ocr_storage')
    ,('scan_items', 'reviewed_expiry_date')
    ,('scan_items', 'reviewed_expiry_kind')
    -- T14B-B (0034): persisted canonical runtime order and explicit ingredient ordinals.
    ,('recipe_runtime_fields', 'runtime_order')
    ,('recipe_runtime_ingredient_order', 'position')
    -- T14C (0035): versioned media metadata; bytes live in R2 under the trusted storage_key.
    ,('recipe_media', 'role')
    ,('recipe_media', 'version')
    ,('recipe_media', 'status')
    ,('recipe_media', 'storage_key')
    ,('recipe_media', 'content_hash')
    ,('family_meal_preferences', 'revision')
    ,('family_meal_preferences', 'preferences_json')
    ,('saved_recipe_entries', 'revision')
    ,('saved_recipe_entries', 'is_saved')
    ,('saved_recipe_entries', 'display_json')
    ,('generated_family_meal_plans', 'schema_version')
    ,('generated_family_meal_plans', 'profile_revision')
    ,('generated_family_meal_plans', 'profile_fingerprint')
    ,('generated_family_meal_plans', 'policy_json')
    ,('generated_family_meal_plans', 'diagnostics_json')
    ,('shopping_plan_sources', 'plan_revision')
    ,('shopping_plan_sources', 'start_date')
    ,('shopping_plan_sources', 'end_date')
    ,('shopping_plan_sources', 'creator_user_id')
    ,('shopping_plan_demands', 'demand_key')
    ,('shopping_plan_demands', 'quantity')
    ,('shopping_plan_demands', 'contributions_json')
    ,('shopping_generated_item_state', 'demand_key')
    ,('shopping_generated_item_state', 'is_overridden')
    ,('shopping_plan_commands', 'request_fingerprint')
    ,('shopping_plan_commands', 'response_json')
    ,('shopping_item_metadata', 'ingredient_identity')
    ,('shopping_item_metadata', 'recipe_identity')
    ,('shopping_item_metadata', 'recipe_title')
    ,('shopping_item_metadata', 'cannot_buy')
    ,('shopping_plan_item_dismissals', 'demand_key')
    ,('shopping_plan_item_dismissals', 'plan_id')
    ,('shopping_demand_reviews', 'source_id')
    ,('shopping_demand_reviews', 'demand_key')
    ,('shopping_demand_reviews', 'revision')
    ,('shopping_demand_reviews', 'demand_fingerprint')
    ,('shopping_demand_reviews', 'decision')
    ,('shopping_demand_reviews', 'item_id')
    ,('shopping_demand_review_commands', 'request_fingerprint')
    ,('shopping_demand_review_commands', 'response_json')
    ,('week_swap_receipts', 'id')
    ,('week_swap_receipts', 'household_id')
    ,('week_swap_receipts', 'actor_id')
    ,('week_swap_receipts', 'plan_id')
    ,('week_swap_receipts', 'meal_id')
    ,('week_swap_receipts', 'client_key')
    ,('week_swap_receipts', 'fingerprint')
    ,('week_swap_receipts', 'created_at')
    ,('recipe_content_versions', 'fingerprint')
    ,('recipe_content_versions', 'recipe_id')
    ,('recipe_content_versions', 'slug')
    ,('recipe_content_versions', 'content_json')
    ,('recipe_content_versions', 'created_at')
    ,('cooked_meals', 'recipe_content_fingerprint')
    ,('cooked_meals', 'request_fingerprint')
    ,('recipe_content_access', 'household_id')
    ,('recipe_content_access', 'fingerprint')
    ,('recipe_content_access', 'created_at')
    ,('generated_meal_plan_components', 'recipe_content_fingerprint')
),
-- Indexes and triggers share one sqlite_master lookup: D1 (workerd) caps compound SELECTs at
-- 5 terms (SQLITE_LIMIT_COMPOUND_SELECT), so the gate must stay at five UNION ALL branches.
required_schema_objects(type, name) AS (
  VALUES
    ('trigger', 'trg_meal_components_content_insert'),
    ('trigger', 'trg_meal_components_content_update'),
    ('index', 'idx_recipe_content_versions_recipe'),
    ('trigger', 'trg_recipe_content_versions_insert'),
    ('trigger', 'trg_recipe_content_versions_update'),
    ('trigger', 'trg_recipe_content_versions_delete'),
    ('trigger', 'trg_cooked_meals_content_insert'),
    ('trigger', 'trg_cooked_meals_content_update'),
    ('trigger', 'trg_cooked_meals_request_update'),
    ('index', 'idx_saved_recipe_entries_recent'),
    ('index', 'idx_shopping_demand_reviews_item'),
    ('trigger', 'trg_shopping_demand_review_commands_immutable_update'),
    ('trigger', 'trg_shopping_demand_review_commands_immutable_delete'),
    ('trigger', 'trg_week_swap_receipts_immutable_insert'),
    ('trigger', 'trg_week_swap_receipts_immutable_update'),
    ('trigger', 'trg_week_swap_receipts_immutable_delete'),
    ('index', 'idx_auth_otp_tickets_scope_admitted'),
    ('index', 'idx_auth_otp_requests_retained_until'),
    ('index', 'idx_checkout_admissions_user_state'),
    -- T14C (0035): at most one current-ready version per recipe/role; bounded bulk lookups.
    ('index', 'idx_recipe_media_current_ready'),
    ('index', 'idx_recipe_media_recipe_role_status'),
    ('index', 'idx_recipe_media_content_hash'),
    ('trigger', 'trg_meal_plans_household_immutable'),
    -- T14C (0035): ready media versions are immutable.
    ('trigger', 'trg_recipe_media_ready_immutable_update'),
    -- T13 (0031): CONFIRMED review state and is_confirmed must stay one fact.
    ('trigger', 'trg_scan_items_review_state_insert'),
    ('trigger', 'trg_scan_items_review_state_update'),
    -- T13R-A (0032): reviewed expiry kind/date pairing is fail-closed.
    ('trigger', 'trg_scan_items_reviewed_expiry_insert'),
    ('trigger', 'trg_scan_items_reviewed_expiry_update'),
    ('trigger', 'trg_inventory_lots_display_category_insert'),
    ('trigger', 'trg_inventory_lots_display_category_update'),
    ('trigger', 'trg_inventory_commands_category_authority_insert'),
    ('trigger', 'trg_inventory_events_category_authority_insert'),
    ('trigger', 'trg_inventory_adoption_category_authority_insert'),
    ('trigger', 'trg_inventory_commands_immutable_update'),
    ('trigger', 'trg_inventory_commands_immutable_insert'),
    ('trigger', 'trg_inventory_commands_immutable_delete'),
    ('trigger', 'trg_inventory_lots_live_insert'),
    ('trigger', 'trg_inventory_lots_no_live_replace'),
    ('trigger', 'trg_inventory_lots_backfill_after_live'),
    ('trigger', 'trg_inventory_lots_live_update'),
    ('trigger', 'trg_inventory_lots_live_delete'),
    ('trigger', 'trg_inventory_items_projection_owner'),
    ('trigger', 'trg_inventory_items_projection_replace'),
    ('trigger', 'trg_inventory_events_command_insert'),
    ('trigger', 'trg_inventory_events_command_authority_insert'),
    ('trigger', 'trg_inventory_events_command_poststate_insert'),
    ('trigger', 'trg_inventory_commands_fefo_authority_insert'),
    ('trigger', 'trg_inventory_commands_fefo_envelope_insert'),
    ('trigger', 'trg_inventory_events_command_fefo_authority_insert'),
    ('trigger', 'trg_inventory_observations_immutable_update'),
    ('trigger', 'trg_inventory_observations_immutable_delete'),
    ('trigger', 'trg_inventory_observations_lot_household_insert'),
    ('trigger', 'trg_inventory_observations_lot_household_update'),
    ('trigger', 'trg_inventory_observations_projection_household_insert'),
    ('trigger', 'trg_inventory_reconciliation_decisions_observation_guard'),
    ('trigger', 'trg_inventory_reconciliation_decisions_immutable_update'),
    ('trigger', 'trg_inventory_reconciliation_decisions_immutable_delete'),
    ('trigger', 'trg_inventory_events_command_update'),
    ('trigger', 'trg_inventory_events_command_replace'),
    ('trigger', 'trg_inventory_events_command_delete'),
    ('trigger', 'trg_inventory_items_revision_insert'),
    ('trigger', 'trg_inventory_items_revision_update'),
    ('trigger', 'trg_inventory_items_revision_delete'),
    ('trigger', 'trg_inventory_lots_revision_insert'),
    ('trigger', 'trg_inventory_lots_revision_update'),
    ('trigger', 'trg_inventory_lots_revision_delete'),
    ('trigger', 'trg_storage_locations_revision_insert'),
    ('trigger', 'trg_storage_locations_revision_update'),
    ('trigger', 'trg_storage_locations_revision_delete'),
    ('trigger', 'trg_ingredients_canonical_id_insert'),
    ('trigger', 'trg_ingredients_canonical_id_update'),
    ('trigger', 'trg_recipe_nutrition_version_insert'),
    ('trigger', 'trg_recipe_nutrition_version_update'),
    ('trigger', 'trg_recipes_nutrition_version_insert'),
    ('trigger', 'trg_recipes_nutrition_version_update'),
    ('trigger', 'trg_recipes_source_reference_insert'),
    ('trigger', 'trg_recipes_source_reference_update'),
    ('trigger', 'trg_recipe_families_source_reference_insert'),
    ('trigger', 'trg_recipe_families_source_reference_update')
)
SELECT issue, detail
FROM migration_ledger_issues
UNION ALL
SELECT 'missing_table', required.name
FROM required_tables required
WHERE NOT EXISTS (
  SELECT 1
  FROM sqlite_master existing
  WHERE existing.type = 'table' AND existing.name = required.name
)
UNION ALL
SELECT 'missing_column', required.table_name || '.' || required.column_name
FROM required_columns required
WHERE NOT EXISTS (
  SELECT 1
  FROM pragma_table_info(required.table_name) column_info
  WHERE column_info.name = required.column_name
)
UNION ALL
SELECT 'missing_' || required.type, required.name
FROM required_schema_objects required
WHERE NOT EXISTS (
  SELECT 1 FROM sqlite_master
  WHERE type = required.type AND name = required.name
)
UNION ALL
SELECT 'foreign_key_violation',
       foreign_keys."table" || '[rowid=' || foreign_keys.rowid || '] -> ' || foreign_keys.parent
FROM pragma_foreign_key_check foreign_keys
ORDER BY issue, detail;
