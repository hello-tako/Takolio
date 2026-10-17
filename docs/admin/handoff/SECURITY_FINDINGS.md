# Security findings — status on `handoff/admin-v1-r2-20261015`

**Every finding below is OPEN.** No finding is marked RESOLVED: R1 code has not been independently reviewed (see `reviews/2026-10-14-r1-certification.md` §0). Severity: P0 blocks use with real data now; P1 blocks staging and production; P2 must be fixed before production launch.

Summary: **P0: 0. P1: 3 (F1, F2, F3). P2: 8 (F4–F11).**

Reproduction files (archived, restore before running; see `LOCAL_RUNBOOK.md` §9):
- `reviews/r1-certification/evidence/…` and `tools/r1-independent.test.ts.txt` — reviewer tests (18). FINDING tests pass when the weakness is reproduced.
- `tools/workerd-probe.mjs` — 1169 real-workerd checks.
- `reviews/poc-archive/original-3e865d0/` and `adapter-25140ba/` — the 51 original PoCs.

---

## F1 — Admin Worker has a writable customer D1 binding and reads password hashes

- **Severity:** P1 (data integrity and confidentiality of the customer database).
- **Affected files:** `wrangler.admin.jsonc` (`d1_databases`: `DB` → customer database, same ID as the customer Worker); `src/worker/routes/admin/readonly-db.ts`; `src/worker/routes/admin/auth.ts` (`ACCOUNT_SQL`, `credentialFingerprint`); customer reads in `people.ts`, `recipes.ts`, `billing-ai.ts`, `overview.ts`, `system.ts`.
- **Root cause:** the admin Worker received the customer D1 binding because the console was designed to read customer data directly. "Read-only" is enforced in code only. The session fingerprint needs `password_hash` and `salt`, which are read on every authenticated request, including Access-only production mode.
- **Exploitability / impact:** any code path in the admin Worker, or a compromise of its dependencies, can write to the production customer database. Credential hashes are read on every request, widening the blast radius of any Admin Worker compromise.
- **Reproduction:** restore `r1-independent.test.ts.txt`, run `R1C-B3` (asserts that `password_hash` and `salt` are selected in Access mode) and `R1C-B2` (guard shapes). Check the binding: `grep -n '"DB"' wrangler.admin.jsonc`.
- **Existing evidence:** R1C-B2, R1C-B3; `wrangler.admin.jsonc` (read, not changed).
- **Proposed remediation:** R2 WP1 (remove binding), WP2 (facade through service binding), WP4 (remove credential reads; `security_epoch`).
- **Current state:** OPEN.
- **Acceptance criteria:** (a) no admin config binds a customer database; a test fails if any `database_id` equals the customer ID; (b) `grep -R "env.DB" src/worker/routes/admin` returns nothing; (c) no admin SQL selects `password_hash` or `salt`; (d) R1C-B1 write capture remains 0 writes through the facade; (e) `R1C-B3` is inverted to "not observed".

## F2 — Two-SUPER_ADMIN deadlock without an adequate recovery ceremony

- **Severity:** P1.
- **Affected files:** `src/worker/routes/admin/index.ts` (roles and approvals); `migrations-admin/0001_admin_console_foundation.sql` (`trg_admin_roles_super_minimum`); `docs/admin/PRODUCTION_INTEGRATION_PLAN.md` §5.
- **Root cause:** with exactly two SUPER_ADMINs, a new SUPER_ADMIN needs the approval of an active SUPER_ADMIN, and removing one is blocked by the minimum-two trigger. If one becomes unavailable (left the organisation, lost Access, account unverified), no in-product path adds or removes a SUPER_ADMIN. No break-glass procedure exists.
- **Exploitability / impact:** availability of governance. An operational lock-out of the console.
- **Reproduction:** `R1C-D2` (FINDING): with two SUPER_ADMINs and one unverified, the requester cannot approve their own grant (403), the other SUPER_ADMIN cannot sign in while unverified (401), and removing that SUPER_ADMIN is refused (409).
- **Existing evidence:** R1C-D2 output in `reviews/r1-certification/evidence/r1-independent.txt`.
- **Proposed remediation:** R2 WP5 (≥3 active SUPER_ADMIN before production enablement; break-glass as a reviewed batch in a protected workflow, audited as `admin.breakglass`).
- **Current state:** OPEN.
- **Acceptance criteria:** D2 passes through a break-glass path; production refuses enablement with fewer than three active SUPER_ADMIN; break-glass requires two distinct approvers and writes an audit row.

## F3 — Two-account bootstrap does not guarantee two human operators

- **Severity:** P1.
- **Affected files:** `scripts/admin-local-lib.mjs` (`buildBootstrapAdminSql`); `scripts/admin-provision.mjs` (local only); `docs/admin/PRODUCTION_INTEGRATION_PLAN.md` §5.
- **Root cause:** the bootstrap distinguishes two **user identifiers**, not two people. One person with two verified mailboxes satisfies the check and controls both approvals.
- **Exploitability / impact:** the two-person control is only as strong as the operator process. Production has no ceremony that binds identities to people.
- **Reproduction:** read `buildBootstrapAdminSql` (inputs are `userIds` and `assignmentIds`; nothing ties them to distinct Access identities).
- **Existing evidence:** design review only; the production ceremony is not built.
- **Proposed remediation:** R2 WP7 (distinct Access `sub` per approver, enforced in the approval batch) and a three-operator ceremony in `PRODUCTION_BLOCKERS.md`.
- **Current state:** OPEN.
- **Acceptance criteria:** approval and bootstrap refuse two accounts that share an Access subject; the ceremony is written down and executed once in staging with three named operators.

## F4 — Approver privileges are not revalidated inside the write transaction

- **Severity:** P2 (time-of-check/time-of-use).
- **Affected files:** `src/worker/routes/admin/index.ts`, approval handler (decision batch near lines 304–341); role mutation handlers.
- **Root cause:** the decider's SUPER_ADMIN role is checked at request start. The decision batch re-checks the **requester** but not the decider.
- **Exploitability / impact:** a SUPER_ADMIN whose role is revoked between the session check and the batch still completes an approval. Requires a concurrent revocation.
- **Reproduction:** `R1C-D1` (FINDING): revoke the decider's role from inside the batch via a DB hook; the approval still returns 200 and the grant is applied.
- **Existing evidence:** R1C-D1 output.
- **Proposed remediation:** R2 WP8: add `EXISTS (active SUPER_ADMIN with user_id = acting id)` to the same batch for approve, reject, grant and revoke.
- **Current state:** OPEN.
- **Acceptance criteria:** R1C-D1 returns 409 and applies no grant; a concurrent-revocation test passes repeatedly (≥20 runs).

## F5 — Bootstrap is not atomic

- **Severity:** P2.
- **Affected files:** `scripts/admin-local-lib.mjs` (`buildBootstrapAdminSql` produces separate statements); `migrations-admin/0001_admin_console_foundation.sql` (`trg_admin_roles_bootstrap_once`).
- **Root cause:** grants, the completion marker and the audit row are separate statements. The trigger closes bootstrap only when the marker exists or a non-bootstrap grant exists.
- **Exploitability / impact:** an interrupted bootstrap leaves two (or three) `operator_bootstrap` grants, no marker and no audit. The trigger still permits another bootstrap grant.
- **Reproduction:** `R1C-D3` (FINDING): apply the first statement only, then insert a third `operator_bootstrap` SUPER_ADMIN: accepted, 0 audit rows, no marker.
- **Existing evidence:** R1C-D3 output.
- **Proposed remediation:** R2 WP8: run grants, marker and audit as one batch; add a migration (0002, ADMIN_DB only) that closes bootstrap after the first pair.
- **Current state:** OPEN.
- **Acceptance criteria:** an injected failure in the middle of the batch leaves no rows; a third bootstrap grant is refused.

## F6 — Account-level authentication throttling can be abused for lockout

- **Severity:** P2.
- **Affected files:** `src/worker/routes/admin/auth.ts` (login: `consumeLimit(… 'login-account', email, 10, 15*60)` runs before `verifyPassword`); `limits.ts`.
- **Root cause:** every attempt for an email consumes the account budget, including attempts with a wrong password. Anyone who can reach the login endpoint can exhaust the budget for a known admin email.
- **Exploitability / impact:** temporary lock-out (15 minutes per window) of a named administrator. In production, login is behind Access, so the attacker must first pass Access. Locally the endpoint is reachable.
- **Reproduction:** `R1C-C1` (FINDING): 10 wrong passwords from one client, then the real password returns 429 with `Retry-After` > 800 s.
- **Existing evidence:** R1C-C1; R1C-C6 confirms the 11th attempt is 429.
- **Proposed remediation:** R2 WP9: count only failed attempts against an identity keyed on the verified Access subject, and decide the policy explicitly. Do not let unauthenticated attempts consume the budget of a verified identity.
- **Current state:** OPEN.
- **Acceptance criteria:** a wrong-password flood from an unverified client does not block a verified administrator's correct login from another client.

## F7 — Full-table customer database aggregation

- **Severity:** P2 (availability of the shared customer database).
- **Affected files:** `src/worker/routes/admin/overview.ts`; `billing-ai.ts`; `people.ts` (`COUNT(*)` with `date(...)` predicates; `LEFT JOIN` search).
- **Root cause:** aggregates use `date(col) >= ?`, which is not sargable, and `COUNT` over whole tables.
- **Exploitability / impact:** each overview load scans `users`, `payment_intents` and `sessions_v2`. Load on the production database from the console.
- **Reproduction:** `EXPLAIN QUERY PLAN` on the queries (for example `SELECT COUNT(*) FROM users WHERE is_guest = 0 AND date(created_at) >= '2026-01-01'` → `SCAN users`).
- **Existing evidence:** reviewer plan output in the review log (not committed as a separate file).
- **Proposed remediation:** R2 WP9: sargable predicates with bound ISO timestamps and indexes. Indexes are a **customer migration** and need separate authorization; alternatively rollups read through the facade, cached for 60 s.
- **Current state:** OPEN.
- **Acceptance criteria:** the plans show index seeks for every aggregate; a load test shows bounded rows read per request.

## F8 — Flaky keyboard E2E

- **Severity:** P2 (test quality).
- **Affected files:** `tests/e2e/admin-a11y-responsive.e2e.ts` (test "scrollable tables are reachable and scrollable with the keyboard", reads `scrollLeft` immediately after `ArrowRight`).
- **Root cause:** the browser scrolls with an animation after a keyboard press. The assertion reads before the animation completes. The product behaves correctly (diagnostic: 80 px within 150 ms in 5/5 runs).
- **Reproduction:** `pnpm exec playwright test -c playwright.admin.config.ts -g "scrollable tables" --repeat-each 6` → 4 passed, 2 failed in the reviewer run.
- **Existing evidence:** `reviews/r1-certification/evidence/e2e-keyboard-repeat.txt`, `keyboard-diagnostic.json`, `tools/keyboard-diagnostic.mjs`.
- **Proposed remediation:** `await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before)`.
- **Current state:** OPEN.
- **Acceptance criteria:** the test passes in ≥10 consecutive `--repeat-each` runs.

## F9 — E2E overwrites Git-tracked screenshots

- **Severity:** P2 (repository hygiene; leaks non-reviewed images into commits).
- **Affected files:** `tests/e2e/admin-console.e2e.ts` (`const SHOTS = 'docs/admin/screenshots'`).
- **Root cause:** screenshot output is written into the tracked documentation directory on every run.
- **Reproduction:** run `pnpm test:admin:e2e`; `git status` lists `docs/admin/screenshots/*.png` as modified.
- **Existing evidence:** reviewer run (11 PNG files modified).
- **Proposed remediation:** write to `.hoplite/artifacts/admin-e2e/` (git-ignored) by default; update tracked screenshots only with an explicit opt-in variable.
- **Current state:** OPEN.
- **Acceptance criteria:** a clean `pnpm test:admin:e2e` leaves `git status` clean.

## F10 — Deep-link handling fails for certain identifiers

- **Severity:** P2 (functional).
- **Affected files:** `src/worker/admin-worker.ts` (`SHELL_ROUTE`, line 45: segments limited to `[A-Za-z0-9_-]`); `src/worker/routes/admin/schemas.ts` (`IdParam` allows `.`, `:` and `-`).
- **Root cause:** the route regex and the API identifier schema disagree.
- **Impact:** reloading `/admin/users/usr.abc` or `usr:abc` returns 404. No current identifier format contains `.` or `:` (recipe IDs: 0 in the fixture; user IDs use `usr_`), so the impact today is low.
- **Reproduction:** `R1C-A1` (FINDING, Node harness): `/admin/users/usr.abc` → 404.
- **Existing evidence:** R1C-A1.
- **Proposed remediation:** allow the same charset as `IdParam` in `SHELL_ROUTE`; reject `.` and `..` segments.
- **Current state:** OPEN.
- **Acceptance criteria:** every identifier accepted by the API has a working deep link; `..` segments return 404.

## F11 — Administrator privileges are tied to email rather than a stable verified identity

- **Severity:** P2.
- **Affected files:** `src/worker/routes/admin/auth.ts` (Access login maps the verified email to an account); `access.ts`.
- **Root cause:** the grant is keyed on the customer account's email. Access `sub` is not stored or compared.
- **Exploitability / impact:** if an email is reassigned in the customer system and the new holder verifies it, the grant can transfer. Session revocation on email change limits the window but does not remove the grant risk.
- **Reproduction:** design review. Not yet reproduced as a test.
- **Proposed remediation:** R2 WP6 (store `iss` and `sub` at first login; require equality afterwards; re-binding only through a SUPER_ADMIN action).
- **Current state:** OPEN.
- **Acceptance criteria:** same email with a different `sub` is refused with 403 and audited; a new test covers first-login binding.

---

## S1–S12 status (from the 2026-10-12 review)

| ID | R1 claim | Reviewer re-verification (2026-10-14) | Status |
|---|---|---|---|
| S1 | fail-closed policy | workerd matrix, 12 negative variants | fixed locally, **OPEN pending independent review** |
| S2 | worker-first routing | workerd: asset bypass refused; customer Worker serves no admin shell | fixed locally, OPEN pending review |
| S3 | exact Origin, no Referer, same-origin fetch metadata | R1C-C4, R1C-C5, workerd customer split-host checks | fixed locally, OPEN pending review |
| S4 | two-person bootstrap, four-eyes, triggers | R1C-D4–D7 pass; D1, D2, D3 are findings (F2–F5) | partly fixed; see F2–F5 |
| S5 | audit before disclosure, fail closed | original PoC H5 now fails; control holds | fixed locally, OPEN pending review |
| S6 | session fingerprint and revocation | H6 PoC fails; lifecycle controls hold | fixed locally, OPEN pending review (see F1 for hash reads) |
| S7 | global, IP and account budgets | H9a: 11th attempt 429; account lock-out is F6 | partly fixed; see F6 |
| S8 | email search only for reveal holders | H10 PoC fails | fixed locally, OPEN pending review |
| S9 | JWKS refresh at most once per 60 s | `access-verifier` PoC: one fetch for five forged `kid`s | fixed locally, OPEN pending review |
| S10 | admin DB without FKs; history retained | R1C-B4 | fixed locally; the latent FK (`households.created_by`) still blocks customer deletion (pre-existing) |
| S11 | 409 on constraint errors; `/auth/config` minimal | H11 controls hold | fixed locally, OPEN pending review |
| S12 | out of admin scope (customer auth accepts `userInfo` and bearer JWTs when `ENVIRONMENT !== 'production'`) | not re-tested | **OBSERVATION, not changed**. Relevant to the customer application; needs its own review. |
