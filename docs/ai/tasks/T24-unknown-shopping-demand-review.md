# T24 - Review unknown shopping demand directly in the family list

**Status:** LOCAL_IMPLEMENTED_VERIFIED (2026-10-14 JST). Branch
`codex/vietnamese-family-meals-20261013`. Implementation checkpoint
`cf54910f5ebf64293517b855f0da6cbe0f8f9582`; accepted ADR-060; no push, merge,
remote migration or deployment.

## Scope and delivered behavior

Unknown shared shopping demand remains unknown. A current household member can
choose a positive buying amount/unit, skip only the exact current trip snapshot,
or reopen a previous decision. The selected amount is buying intent, not a guessed
package/bunch/piece mass, recipe coverage, inventory quantity, or nutrition claim.
The GET DTO exposes pending/purchased/skipped state, source meal/date/type/title,
known per-source contributions and a separate unknown aggregate. Recipe links use
canonical recipe identities and do not open a creator's private planner.

Migration `0043_shopping_demand_review.sql` adds review rows and immutable list-scoped
command receipts. The Worker uses complete demand/review/purchase witnesses,
monotonic revisions, membership guards and atomic D1 batches. Replay returns the
original result for the same request key/payload; key reuse with a different
payload conflicts. Review, purchase checkbox and materialization never change
physical inventory. Deleting an unchecked reviewed purchase reopens the review and
cannot create a legacy indefinite same-plan dismissal; checked purchase history is
preserved. Unchanged re-sharing keeps decisions, while changed source revision,
horizon or attribution requires review again.

The UI labels `Tổng lượng theo thực đơn chưa xác định` separately from `Lượng bạn
chọn`, starts the purchase amount blank, shows known contribution amounts, gives
clear `Chọn lượng mua`, `Tạm bỏ qua`, and `Xem lại` actions, and freezes source links
while a request is pending/uncertain/stale. Cached reads remain useful but review
requires a live server snapshot; uncertain requests keep the exact payload/key for
retry, while stale/auth failures require explicit reload and a new action.

## Acceptance coverage

1. Unknown rows offer purchase/skip with collapsed meal sources; no amount is inferred.
2. Underlying demand remains `NULL`; manual duplicate rows do not resolve it; live purchase intent is distinct.
3. Full snapshot CAS, membership and atomic guards prevent stale/concurrent overwrite; immutable receipts survive edits and lost responses.
4. Shared review preserves purchase/history across skip/reopen and source changes; no physical inventory change.
5. Offline/device mode is truthful; uncertain payload/key recovery and stale reload are explicit.
6. Source links retain date/meal/title and known amounts; missing recipe IDs remain text; links do not claim planned servings.
7. Tests, migration/schema checks, local HTTP and browser checks run sequentially at phone/tablet/desktop.
8. Docs, source receipt and local implementation checkpoint are updated; release evidence remains separate.

## Verification executed

- `pnpm lint` PASS; `pnpm typecheck` PASS (app + Worker).
- `TMPDIR=/private/tmp pnpm test --maxWorkers=4`: 357 files / 8,386 tests PASS.
- Focused T24 tests: 7 files / 98 tests PASS; explicit review label UI tests: 2 files / 13 tests PASS.
- `pnpm check:migrations` PASS; `pnpm schema:check:local` PASS at tip 0043.
- Local workerd/D1 HTTP smoke: 8/8 PASS, including stale 409, idempotent replay, skip/reopen, checked history, delete reopen, demand NULL and stock unchanged.
- `GIT_COMMIT=local-t24-shopping-review pnpm build` PASS; paired `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` PASS.
- `PORT=3101 PREVIEW_API_PORT=8891 pnpm exec playwright test -c playwright.family.config.ts`: 12/12 PASS at 320/390/768/1280; screenshots reviewed.
- `pnpm audit --audit-level=high`, `git diff --check`, protected-path/source receipt checks PASS. Previous failed browser attempts remain in `work/`; the final isolated rerun passed.

**Failures retained:** the earlier full suite had one Wrangler 5-second timeout
(8,385 passed); the later frozen-source full run passed all 8,386. An early
workerd HTTP DELETE returned 409 after a successful cascade delete; actual D1
`meta.changes=3` proved the exact-one guard wrong, and the positive-count guard
plus regression/HTTP rerun fixed it. Earlier browser runs retained 11 passed/1
navigation timeout and 7 passed/5 failed (four incorrect assumptions that more
than one unknown demand must exist, plus one ERR_ABORTED while source edits were
in progress). The final test exercises one demand through its full lifecycle;
no workspace edits ran during final2, which passed 12/12. Earlier checkbox and
ReactNode/test-typing failures are retained; explicit labels/locators and final
lint/type/UI/browser checks passed. The 8,386-test full run preceded the final
label-only markup refinement; the subsequent 13 UI tests, typecheck, lint,
12-browser matrix and both builds cover that final refinement.

## Schema, rollout and limitations

Apply 0042 then 0043 before this Worker serves shopping traffic, independently of
planner flags. Keep 0043 additive tables on rollback. The current Worker with paired
flags OFF is locally covered. A binary rollback to T23/pre-T24 is not certified after
reviewed purchases because the older DELETE path can create a same-plan dismissal
for unknown demand and the older UI has no review/skip/reopen experience. No hosted
or production success is claimed. No nationwide Vietnamese user research,
independently verified regional provenance, clinical nutrition/allergy certification,
retention proof, package/bunch/piece mass inference, leftovers/shared prep, vendor
allocation, or future-only whole-week regeneration is included.

**Next action:** separately authorize normal PR/exact-head CI, migration-first staging
and hosted smoke. Keep payment/auth/infrastructure/config/dependencies and remote
D1 mutation outside this task.
