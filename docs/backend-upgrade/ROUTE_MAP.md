# B00: API và ownership map

Source `652e0d7632745e9b77cda4b5b3caac83a3ec1015`; 79 explicit endpoints. Đây là static source evidence, không chứng nhận runtime route journeys. OPTIONS/CORS và SPA wildcard không tính vào endpoints.

Cookie auth/expected-owner/production CSRF đến từ global middleware. Guest bypass và default-household auto-link là policy cần B01c kiểm chứng. T20 MealRole không phải quyền gia đình.

Group metadata dùng dependency superset; không phải per-route SQL call graph. Tables/flags gồm service dependencies đại diện. Direct Env names ghi bindings/config/secret names, không đọc values. Production dùng cookie; signed bearer compatibility chỉ ngoài production. GET domain reads vẫn có thể cập nhật session last_seen/default-household qua middleware.

## auth

Owner: Security. Scope: account; public auth bootstrap except /me and Plus compatibility.
Tenant: session household; registration/guest transfer commands. Idempotency/concurrency: none; one-time OTP consume, session revoke; strict admission is B01a target.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/me` | cookie session | not required for read | `src/worker/routes/auth.ts:213` |
| POST | `/api/v1/auth/register` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:267` |
| POST | `/api/v1/auth/verify-otp` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:406` |
| POST | `/api/v1/auth/resend-otp` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:541` |
| POST | `/api/v1/auth/login` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:636` |
| POST | `/api/v1/auth/forgot-password` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:751` |
| POST | `/api/v1/auth/reset-password` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:775` |
| POST | `/api/v1/auth/google` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:887` |
| POST | `/api/v1/auth/guest` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:1050` |
| POST | `/api/v1/auth/logout` | public | production bootstrap trusted Origin | `src/worker/routes/auth.ts:1131` |
| POST | `/api/v1/auth/plus/activate` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/auth.ts:1150` |

Tables: users, profiles, households, household_members, sessions_v2, auth_otps, subscriptions, user_preferences, shopping_lists.
Flags (source, chưa phải observed runtime): ENVIRONMENT, APP_URL.
Callers: src/web/services/auth.ts.
Tests: tests/integration/auth-hardening.test.ts, tests/unit/auth.test.ts.
Background/external effects (group): OTP email dispatch; forgot uses waitUntil; sessions and guest household transfer; soft KV limiter/cooldown; /me quota read. No queue. Google signed credential token-verification network dependency.
Direct Env names in route source (không phải runtime values): CACHE, DB, ENVIRONMENT, GOOGLE_CLIENT_ID, OTP_HASH_SECRET.


## billing

Owner: Billing (protected). Scope: registered user; webhook is HMAC service callback.
Tenant: user_id payment ownership; household RBAC not applicable. Idempotency/concurrency: webhook reference + intent transition/grant transaction; creation has no server key.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/billing/plans` | cookie session | not required for read | `src/worker/routes/billing.ts:31` |
| POST | `/api/v1/billing/payment-intents` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/billing.ts:33` |
| GET | `/api/v1/billing/payment-intents/:id` | cookie session | not required for read | `src/worker/routes/billing.ts:66` |
| POST | `/api/v1/billing/payos/webhook` | public route + PayOS HMAC | service signature; no browser Origin | `src/worker/routes/billing.ts:74` |

Tables: users, payment_intents, subscriptions.
Flags (source, chưa phải observed runtime): ENVIRONMENT, APP_URL.
Callers: src/web/services/billing.ts.
Tests: tests/integration/payment-authority.test.ts, tests/unit/billing-service.test.ts.
Background/external effects (group): PayOS network create/reconcile callback; transactional payment intent and Plus grants. Protected; B00 only source mapping.
Direct Env names in route source (không phải runtime values): DB, PAYOS_CHECKSUM_KEY.


## health

Owner: Platform. Scope: public readiness/liveness/config; authority endpoint release-token-only.
Tenant: no household data. Idempotency/concurrency: read-only.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/health` | public | not required for read | `src/worker/routes/health.ts:21` |
| GET | `/api/v1/health/ready` | public | not required for read | `src/worker/routes/health.ts:32` |
| GET | `/api/v1/health/recipe-authority` | RELEASE_VERIFY_TOKEN bearer | not required for read | `src/worker/routes/health.ts:103` |
| GET | `/api/v1/config` | public | not required for read | `src/worker/routes/health.ts:115` |

Tables: D1 readiness and catalog metadata.
Flags (source, chưa phải observed runtime): ENVIRONMENT, GIT_COMMIT, RECIPE_CATALOG_MODE.
Callers: platform/asset consumers.
Tests: tests/unit/health.test.ts.
Background/external effects (group): Public config and dependency readiness probes; release-token authority fingerprint checks. No user-domain command.
Direct Env names in route source (không phải runtime values): CACHE, DB, ENVIRONMENT, GIT_COMMIT, GOOGLE_CLIENT_ID, RATE_LIMIT_ENFORCEMENT, RELEASE_VERIFY_TOKEN, RESEND_API_KEY, SCAN_QUEUE, SCAN_QUEUE_MODE, SEND_EMAIL, TURNSTILE_SITE_KEY.


## inventory-truth

Owner: Inventory. Scope: household.
Tenant: tenancyGuard and actor membership. Idempotency/concurrency: decisionKey + observation version; other routes read-only.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/inventory/summary` | cookie session | not required for read | `src/worker/routes/inventory-truth.ts:151` |
| GET | `/api/v1/inventory/lots/:lotId` | cookie session | not required for read | `src/worker/routes/inventory-truth.ts:178` |
| GET | `/api/v1/inventory/observations` | cookie session | not required for read | `src/worker/routes/inventory-truth.ts:214` |
| POST | `/api/v1/inventory/observations/:observationId/decision` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/inventory-truth.ts:273` |

Tables: inventory_lots, inventory_observations, inventory_reconciliation_decisions, inventory_adoption_receipts.
Flags (source, chưa phải observed runtime): none; inventory authority is receipt-based.
Callers: src/web/services/inventory-truth.ts.
Tests: tests/integration/inventory-observation-concurrency.test.ts, tests/integration/inventory-reconciliation-fence.test.ts.
Background/external effects (group): Observation/reconciliation decisions with version/fence; native membership check. No provider call.
Direct Env names in route source (không phải runtime values): CACHE, DB.


## inventory

Owner: Inventory. Scope: household members and guest-owned household.
Tenant: tenancyGuard + actor membership for native lot commands. Idempotency/concurrency: create client ID/fingerprint; PATCH version; DELETE If-Match; optional command key; adoption receipt.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/inventory` | cookie session | not required for read | `src/worker/routes/inventory.ts:546` |
| POST | `/api/v1/inventory` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/inventory.ts:561` |
| PATCH | `/api/v1/inventory/:id` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/inventory.ts:721` |
| DELETE | `/api/v1/inventory/:id` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/inventory.ts:965` |
| POST | `/api/v1/inventory/adopt` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/inventory.ts:1125` |

Tables: households, household_members, inventory_items, inventory_lots, inventory_commands, inventory_events, storage_locations, inventory_adoption_receipts.
Flags (source, chưa phải observed runtime): none; inventory authority is receipt-based.
Callers: src/web/services/inventory.ts.
Tests: tests/integration/inventory-concurrency.test.ts, tests/unit/inventory-idempotency.test.ts.
Background/external effects (group): Lot/item commands, events and compatibility projection; authority/adoption receipt reads; legacy KV compatibility. No AI.
Direct Env names in route source (không phải runtime values): CACHE, DB.


## meal-planning

Owner: Planner. Scope: registered household/current creator; shared stock input.
Tenant: tenancyGuard + household and creator user repository scope; no family RBAC. Idempotency/concurrency: generate/feedback key required; mutations expected revision; assist/auto proposal apply fenced.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/meal-planning/plans` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:93` |
| GET | `/api/v1/meal-planning/plans/current` | cookie session | not required for read | `src/worker/routes/meal-planning.ts:95` |
| GET | `/api/v1/meal-planning/plans/:id` | cookie session | not required for read | `src/worker/routes/meal-planning.ts:96` |
| GET | `/api/v1/meal-planning/plans/:id/alternatives` | cookie session | not required for read | `src/worker/routes/meal-planning.ts:97` |
| POST | `/api/v1/meal-planning/plans/:id/explanation` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:104` |
| POST | `/api/v1/meal-planning/plans/:id/regenerate` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:106` |
| POST | `/api/v1/meal-planning/plans/:id/swap` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:108` |
| POST | `/api/v1/meal-planning/plans/:id/shopping` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:110` |
| GET | `/api/v1/meal-planning/plans/:id/compositions` | cookie session | not required for read | `src/worker/routes/meal-planning.ts:135` |
| GET | `/api/v1/meal-planning/plans/:id/slots/:slotId/composition` | cookie session | not required for read | `src/worker/routes/meal-planning.ts:137` |
| PUT | `/api/v1/meal-planning/plans/:id/slots/:slotId/composition` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:139` |
| POST | `/api/v1/meal-planning/plans/:id/slots/:slotId/components` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:141` |
| POST | `/api/v1/meal-planning/plans/:id/slots/:slotId/components/:componentId/swap` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:143` |
| PATCH | `/api/v1/meal-planning/plans/:id/slots/:slotId/components/:componentId` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:145` |
| DELETE | `/api/v1/meal-planning/plans/:id/slots/:slotId/components/:componentId` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:147` |
| POST | `/api/v1/meal-planning/plans/:id/slots/:slotId/assist` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:154` |
| POST | `/api/v1/meal-planning/plans/:id/slots/:slotId/assist/apply` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:156` |
| POST | `/api/v1/meal-planning/plans/:id/slots/:slotId/auto` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:158` |
| POST | `/api/v1/meal-planning/plans/:id/slots/:slotId/auto/apply` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:160` |
| GET | `/api/v1/meal-planning/compositions/picker` | cookie session | not required for read | `src/worker/routes/meal-planning.ts:162` |
| POST | `/api/v1/meal-planning/plans/:id/feedback` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/meal-planning.ts:170` |

Tables: generated_meal_plans, generated_meal_plan_compositions, generated_meal_plan_components, generated_meal_plan_annotations, recipe_feedback_events, recipe_role_assignments, inventory_lots, household_members.
Flags (source, chưa phải observed runtime): MEAL_PLANNER_ENABLED, MEAL_PLANNER_AI_ENABLED, MEAL_COMPOSITION_V2_ENABLED, RECIPE_CATALOG_MODE.
Callers: src/web/services/meal-planning.ts, src/web/services/meal-composition.ts.
Tests: tests/integration/meal-planning-http.test.ts, tests/integration/meal-planning-persistence.test.ts.
Background/external effects (group): Application service generate/compose/revise/feedback; optional governed AI assistance; plan revisions/snapshots. No actual stock consumption during generate.
Direct Env names in route source (không phải runtime values): DB, MEAL_COMPOSITION_V2_ENABLED, MEAL_PLANNER_AI_ENABLED, MEAL_PLANNER_ENABLED.


## notifications

Owner: Notifications. Scope: session household.
Tenant: no route tenancyGuard; legacy membership revoke test target. Idempotency/concurrency: read-only synthesized notifications.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/notifications` | cookie session | not required for read | `src/worker/routes/notifications.ts:8` |

Tables: inventory_items, inventory_lots, shopping_lists, shopping_items.
Flags (source, chưa phải observed runtime): none; inventory authority is receipt-based.
Callers: src/web/services/notifications.ts.
Tests: tests/integration/frontend-ui-integration.test.tsx.
Background/external effects (group): Synthesized stock/shopping reads, not actual scheduled notification delivery.
Direct Env names in route source (không phải runtime values): DB.


## preferences

Owner: Identity/Planner. Scope: current user.
Tenant: user_id predicates; no route tenancyGuard. Idempotency/concurrency: PATCH replacement/upsert; no key/revision.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/preferences` | cookie session | not required for read | `src/worker/routes/preferences.ts:26` |
| PATCH | `/api/v1/preferences` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/preferences.ts:59` |

Tables: user_preferences, profiles.
Flags (source, chưa phải observed runtime): none; inventory authority is receipt-based.
Callers: src/web/services/auth.ts.
Tests: tests/unit/onboarding-contract.test.tsx.
Background/external effects (group): Current-user preferences/profile upserts; no family RBAC or catalog mutation.
Direct Env names in route source (không phải runtime values): DB.


## recipe-media

Owner: Media. Scope: public GET/HEAD canonical media.
Tenant: global catalog only; trusted D1-derived R2 key. Idempotency/concurrency: read-only immutable version/cache.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/recipe-media/:recipeId/:role/:version` | public | not required for read | `src/worker/routes/recipe-media.ts:122` |
| HEAD | `/api/v1/recipe-media/:recipeId/:role/:version` | public | not required for read | `src/worker/routes/recipe-media.ts:123` |

Tables: recipe_media.
Flags (source, chưa phải observed runtime): none; inventory authority is receipt-based.
Callers: src/web/services/recipes.ts.
Tests: tests/unit/recipe-media-presentation.test.ts.
Background/external effects (group): R2 GET/HEAD on D1-trusted canonical storage key, allowlisted MIME/cache; no write.
Direct Env names in route source (không phải runtime values): DB, IMAGES.


## recipes

Owner: Catalog/Planner/Inventory. Scope: public recipes; authenticated discovery/recommendations and cooking.
Tenant: discovery/cooking tenancyGuard; detail/recommendations legacy membership test target. Idempotency/concurrency: cook-complete optional command ID/key and fingerprint; reads no mutations.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/recipe-discovery` | cookie session | not required for read | `src/worker/routes/recipes.ts:198` |
| GET | `/api/v1/recipes` | anonymous GET allowed; cookie context when present | not required for read | `src/worker/routes/recipes.ts:221` |
| GET | `/api/v1/recipes/:id` | anonymous GET allowed; cookie context when present | not required for read | `src/worker/routes/recipes.ts:253` |
| GET | `/api/v1/recommendations` | cookie session | not required for read | `src/worker/routes/recipes.ts:274` |
| POST | `/api/v1/recipes/:id/cook/start` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/recipes.ts:317` |
| POST | `/api/v1/recipes/:id/cook/complete` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/recipes.ts:358` |

Tables: recipes, recipe_ingredients, recipe_steps, recipe_media, inventory_items, inventory_lots, inventory_events, inventory_commands, cooked_meals, user_preferences.
Flags (source, chưa phải observed runtime): RECIPE_CATALOG_MODE, RECIPE_CATALOG_CUTOVER_ENABLED, RECIPE_CATALOG_D1_CANARY_PERCENT.
Callers: src/web/services/recipes.ts.
Tests: tests/integration/recipe-authority-routing.test.ts, tests/unit/cooking-route-allocation.test.ts.
Background/external effects (group): Catalog static/D1 resolver; inventory/recommendation reads; cook-complete ledger/lot command; cook-start advisory read.
Direct Env names in route source (không phải runtime values): CACHE, DB.


## scans

Owner: AI/Inventory. Scope: upload/replay user+household; read/confirm household-shared.
Tenant: tenancyGuard and scan household predicates. Idempotency/concurrency: optional key scoped to user/household/image fingerprint; fenced lease; confirm CAS/receipt.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| POST | `/api/v1/scans/fridge` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/scans.ts:844` |
| POST | `/api/v1/scans/receipt` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/scans.ts:1077` |
| GET | `/api/v1/scans/:id` | cookie session | not required for read | `src/worker/routes/scans.ts:1317` |
| POST | `/api/v1/scans/:id/confirm` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/scans.ts:1374` |

Tables: scans, scan_items, scan_queue_jobs, scan_quota_ledger, scan_quota_periods, inventory_items, inventory_lots, inventory_commands, inventory_events.
Flags (source, chưa phải observed runtime): SCAN_QUEUE_MODE, AI_QWEN_ONLY, AI_MODEL_OCR, AI_MAX_CALLS_PER_OPERATION, AI_MAX_TOTAL_TOKENS, AI_SHADOW_CANARY_PERCENT.
Callers: src/web/services/scans.ts.
Tests: tests/unit/scans.test.ts, tests/unit/scan-queue.test.ts.
Background/external effects (group): Upload to R2; sync governed AI or SCAN_QUEUE enqueue after durable quota/job reservation; replay restores ambiguous enqueue; confirm is explicit transactional inventory command. Queue shadow/cancel new features not present.
Direct Env names in route source (không phải runtime values): AI_MAX_IMAGE_BYTES, AI_MAX_OCR_IMAGE_BYTES, CACHE, DB, IMAGES, SCAN_QUEUE, SCAN_QUEUE_MODE.


## shopping

Owner: Shopping. Scope: shared household.
Tenant: tenancyGuard + shopping list joins. Idempotency/concurrency: create client ID replay; PATCH/DELETE no explicit revision/command key.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/shopping-list` | cookie session | not required for read | `src/worker/routes/shopping.ts:41` |
| POST | `/api/v1/shopping-list/items` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/shopping.ts:79` |
| PATCH | `/api/v1/shopping-list/items/:id` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/shopping.ts:174` |
| DELETE | `/api/v1/shopping-list/items/:id` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/shopping.ts:246` |

Tables: shopping_lists, shopping_items.
Flags (source, chưa phải observed runtime): RECIPE_CATALOG_MODE.
Callers: src/web/services/shopping.ts.
Tests: tests/unit/shopping-hardening.test.ts.
Background/external effects (group): Household list/item mutations; recipe expansion/quantity normalization; no actual inventory import in standalone shopping routes.
Direct Env names in route source (không phải runtime values): DB.


## week

Owner: Planner/Shopping. Scope: shared household.
Tenant: tenancyGuard + household plan joins. Idempotency/concurrency: optional create command key/plan ID; shopping-complete durable key/fingerprint/lease; revision semantics differ from modern planner.

| Method | API path | Auth | CSRF | Source |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/week/current` | cookie session | not required for read | `src/worker/routes/week.ts:955` |
| POST | `/api/v1/week/plans` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/week.ts:987` |
| GET | `/api/v1/week/plans/:id` | cookie session | not required for read | `src/worker/routes/week.ts:1056` |
| POST | `/api/v1/week/plans/:id/generate` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/week.ts:1074` |
| POST | `/api/v1/week/plans/:id/meals/:mealId/swap` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/week.ts:1117` |
| PATCH | `/api/v1/week/plans/:id/meals/:mealId` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/week.ts:1191` |
| GET | `/api/v1/week/plans/:id/shopping` | cookie session | not required for read | `src/worker/routes/week.ts:1234` |
| PATCH | `/api/v1/week/plans/:id/shopping/items/:itemId` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/week.ts:1253` |
| POST | `/api/v1/week/plans/:id/shopping/complete` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/week.ts:1292` |
| GET | `/api/v1/week/preferences` | cookie session | not required for read | `src/worker/routes/week.ts:1712` |
| PATCH | `/api/v1/week/preferences` | cookie session | trusted Origin/Referer with cookie | `src/worker/routes/week.ts:1759` |

Tables: meal_plans, meal_plan_days, meal_plan_slots, meal_plan_shopping_items, meal_plan_days_v2, meal_plan_slots_v2, meal_plan_shopping_items_v2, weekly_planner_preferences, shopping_import_commands, shopping_runs, shopping_run_items, inventory_events.
Flags (source, chưa phải observed runtime): WEEK_SCHEMA_MODE, RECIPE_CATALOG_MODE.
Callers: src/web/services/week.ts.
Tests: tests/integration/week-core-flow.test.ts, tests/unit/week-reconciliation.test.ts.
Background/external effects (group): Legacy/dual schema planning and shopping projection; KV compatibility, shopping-complete durable import/lot events. Separate from modern meal-planning revisions.
Direct Env names in route source (không phải runtime values): CACHE, DB, WEEK_SCHEMA_MODE.



## Background entry points

`src/worker/index.ts` queue consumer gọi `processScanJob`, ACK sau terminal success/permanent failure; retryable failures retry với delay policy. `scan-queue.ts` dùng fenced leases và quota ledger. Các flags thực tế chưa được suy từ config.

Scheduled entry gọi `runScheduledCleanup`: production fatal config thì skipped; source defaults OTP7days sau expiry, sessions30days sau expiry, ready jobs30days/failed90days sau terminal timestamp, stale scan reservation60minutes. Queue tombstone cleanup chỉ khi scan terminal matching và không reserved quota. Đây là source policy, chưa có execution/retention operational proof. R2 image lifecycle không được chứng nhận bởi cleanup code này.

Background tests: `tests/unit/cleanup.test.ts`, `tests/unit/scan-queue.test.ts`, integration scan quota/fencing suites trong tree. B01a expanded tickets/scope retention cần coordinated cleanup compatibility trước release; không âm thầm sửa cron từ baseline task.
