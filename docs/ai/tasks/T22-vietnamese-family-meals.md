# T22 - Vietnamese family meals, saved dishes and practical shopping

Status: LOCAL_IMPLEMENTED_VERIFIED (2026-10-13).
Branch: codex/vietnamese-family-meals-20261013.
Base: 332a24f468d5360b6cefc57b9451228585457131.
ADR: ADR-058 in DECISIONS.md.

## Authorized Outcome

The user requests a comprehensive backend and frontend fix for Vietnamese
household weekly menus and shopping. Lunch/dinner generation must produce a
meal, rather than requiring the household to manually append each companion.
Vietnamese habits, actual cooking days, household size, regional preferences,
familiar cuisines and shopping cadence determine defaults. Retain the current
Takosan brand. No deployment, remote migration, payment, auth or infrastructure
changes are included in this task.

## Implementation Decisions

- Add an explicit revisioned member family profile, connected to existing T03
  ranking. New profiles default to Vietnamese family meals and zero generated
  international main dishes. Regions are soft preferences, never safety claims.
- Keep strict V1 DTO/read compatibility. Add a V2 whole-week composed envelope
  with main, vegetable, soup and staple for family lunch/dinner; breakfast and
  explicitly selected quick/one-pot meals use their own templates.
- Generate the whole week against sequential inventory projection. Never mutate
  physical stock while planning or shopping. Preserve locked component identity.
- Enforce deterministic ingredient/allergen policy and conservative whole-meal
  time; missing safety data must not become an assurance. Report incomplete
  meals and bounded search truthfully.
- Store personal saved recipes with canonical identities and tombstone
  revisions. Saving does not grant global catalog write authority.
- Materialize shared shopping demand from trusted composed shortages and a
  selected trip horizon. Preserve manual entries, purchase edits and checked
  state. Unknown quantities remain visible separately. Convert only compatible
  standard units and retain each dish's attribution.
- One active projected plan contributes demand per household shopping list.
  Replacing the current user's plan retires their prior active demand; another
  member's different active plan requires an explicit conflict rather than
  independently spending the same stock twice.
- Use additive migration 0042; never rewrite an applied migration.

## Acceptance Criteria

1. A fresh family profile generates complete Vietnamese lunch/dinner meals
   without manual addition of the companion dishes when eligible recipes exist.
2. Day/meal schedule, servings, regions, familiar cuisine policy and safety fields
   survive reload and reach the actual planner context.
3. Regeneration preserves every locked component and fills unlocked roles.
   Revision, membership and snapshot races roll back atomically.
4. UI shows individual dishes with save, swap and lock actions; partial states
   cannot be labelled complete. Legacy current plans remain accessible.
5. Favorites persist, remain private, survive unsave/resave, and filter the
   component picker from current authority.
6. Shared shopping has canonical ingredient/recipe identities, source dishes,
   selected horizon, editable purchase quantities and durable checked/cannot-buy
   states. Replay never duplicates demand or overwrites user edits.
7. Existing Week, stock, tenancy and protected-path regressions remain green.
8. Lint, both typechecks, full tests, migration smoke, build and local D1
   apply/schema gate run. Actual app interactions and overflow checks run at
   phone/tablet/desktop widths; record synthetic fixtures as synthetic.

## Limits And Release Follow-Up

This local implementation does not implement clinical nutrition advice, infer
missing recipe mass or allergy metadata, or claim verified provenance for every
regional catalog tag. Region preference is based on existing catalog data.
The richer preview/apply proposal remains separate from current explicit
regeneration confirmation. Hosted release and runtime flags must follow the
existing release process only after separate operator authorization. Apply 0042
before this Worker serves traffic, even with planner flags off: the shopping,
favorites and family-profile routes use the new tables independently. Keep the
additive schema during rollback. Use paired flag-off on this guarded Worker; a
pre-T22 Worker after family plans exist has not been certified for rollback.

## Validation

Final source gates PASS: lint, both TypeScript projects, 347 test files / 8180
Vitest tests, 42-migration smoke, default and paired-feature builds, local D1 apply
and schema gate, dependency audit, diff whitespace and protected-path checks.

Actual Chromium app + Worker HTTP + synthetic SQLite/catalog: 4/4 PASS in 1.2
minutes at 320/390/768/1280. Board/composer/favorites/shopping axe audits have no
violations in the tested surfaces; no horizontal overflow. Separate actual local
workerd/D1 created 7/7 four-role dinners, zero generated international mains,
retained purchase edits, bought/cannot-buy and favorites after reread, and left
physical stock unchanged. Screenshots and receipts are delivered in the calling
chat's outputs/implemented-app directory. No hosted acceptance is claimed.

Earlier failed runs remain in local artifacts. The concurrent build token failure
and blank-browser attempt have an unproven cause; both final builds and the final
browser matrix ran sequentially and passed. See CURRENT_STATE.md, TASK_BOARD.md
and HANDOFF.md for retained history and the implementation checkpoint.
