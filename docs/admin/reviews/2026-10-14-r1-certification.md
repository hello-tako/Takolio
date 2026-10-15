# Takosan Admin V1 — R1 source & security certification review (2026-10-14)

**Verdict: `ADMIN_V1_R1_CHANGES_REQUIRED`**

## 0. Reviewer independence (read first)

This review was performed by the **same agent and thread that implemented Admin V1 (`3e865d0`) and
Remediation R1 (`25140ba`)**. The brief assumes an independent reviewer; that assumption does not hold. To limit
self-confirmation:
- nothing in the R1 report was taken as proof;
- every claim was re-executed in clean detached worktrees;
- the reviewer wrote new adversarial tests and a real-workerd probe, in which every negative case is paired with a
  positive control that differs only in the variable under test;
- each of the 51 original PoCs was classified from its actual failure message.

Even with zero findings this review **could not issue a PASS** (no self-approval). A human or separate team must
repeat the review before publication. A PASS would also have been a local result only, not authorization to publish,
deploy to staging, or operate in production.

## 1. Source authority and checksums

| Item | Value |
|---|---|
| Baseline tag `admin-v1-review-baseline` | `3e865d009ee62a92ed1d9c8d225a36893035670b` (parent `186a9cf05de7c91ed3289e13130feb3b38a264ac`) |
| Review record | `6889f8da71591c49bfdac30a14108426ea05dd57` (parent `3e865d0…`) |
| Remediation implementation | `25140baa99ef0aecc5e8d0e53206132e01e0f765` (parent `6889f8d…`), tree `e82789b041cc9343f87de2647a6f48f4e08e3543` |
| Evidence commit | `0331cc9f4e247446dd1a99715047fe00866d8e2a` (parent `25140ba…`), tree `29cd56b9a6324ead0857b5486545287566a6c8c3` |
| `25140ba..0331cc9` | 28 paths, documentation/state only (no source, test or config change) |
| Repository ID `1385308553` | **not verifiable offline**. `origin` points to `hello-tako/Tako-san`. GitHub `main` was not consulted. |
| Working tree | clean at start; all execution in `git worktree add --detach` of `0331cc9`, `3e865d0`, `186a9cf` with `pnpm install --frozen-lockfile --offline` |

| Artifact (at `0331cc9`) | SHA-256 |
|---|---|
| `migrations-admin/0001_admin_console_foundation.sql` | `a890b20ae824072ecc0768e0bd6ebd548151fc3a0468d6c82e42064e20dabc48` |
| `wrangler.admin.jsonc` | `f1c860fb108f67c75193d15ed90dbd21b563e74204bc6063b2bd4c46b27fd8d4` |
| `wrangler.admin-local.jsonc` | `2f108923fa93b9be22945450745eed3156accc16984d2bf27c80b9cff84b813e` |
| `src/worker/admin-worker.ts` | `66b9c35c60aac1a0135f83808813be4d7549185e7965f959f9f241824086732e` |
| `src/worker/routes/admin/readonly-db.ts` | `3c15fd300248260a8e8b0cdff4c178d0d0ce04151a269154badde2ca57cf9c70` |
| `vite.admin.config.ts` | `89686e2f9096c974861c5802f3fbbeae409d6e1e333d6baf636727100838fd2c` |
| `dist/admin` tree digest (sorted file hashes) | `2d9ca51fa8a29799a046d38199492dc7197f5a235f8cd81e1d48dc853a677ee8` |
| Customer `dist/client` (fixed `BUILD_TIMESTAMP`/`GIT_COMMIT`) | 441 files, **byte-identical** to the `186a9cf` build (`evidence/dist-client-*.sha`) |
| Customer Worker dry-run bundle (path-normalised) | `23505d0736912f2e…` in both `0331cc9` and `186a9cf` |
| Original PoC files vs adapter copies | 7/7 byte-identical; adapter `harness.ts` identical to the committed evidence copy |

## 2. Reviewed file manifest

- **Admin Worker and boundary:** `src/worker/admin-worker.ts`, `wrangler.admin.jsonc`, `wrangler.admin-local.jsonc`,
  `vite.admin.config.ts`, `admin/index.html`.
- **Admin backend:** `src/worker/routes/admin/{index,auth,access,policy,limits,headers,http,audit,readonly-db,env,schemas,mask,people,billing-ai,recipes,overview,system,settings}.ts`.
- **Contract:** `src/shared/admin.ts`.
- **Admin schema:** `migrations-admin/0001_admin_console_foundation.sql`.
- **Frontend:** `src/admin/**` (API client, retry policy, session guard, error boundary, pages, i18n, styles).
- **Tooling:** `scripts/admin-{local-lib.mjs,provision.mjs,local-d1.mjs,preview.mjs,workerd-check.mjs,migration-matrix.mjs,migration-smoke.sh}`.
- **Tests:**
  - `tests/integration/admin-{console,remediation}.test.ts`
  - `tests/unit/admin-*.test.ts(x)`
  - `tests/e2e/admin-{console,a11y-responsive}.e2e.ts`
  - `tests/helpers/admin-{harness.ts,worker-fetch.mjs}`
  - `playwright.admin.config.ts`
- **Customer surfaces compared against `186a9cf`:**
  - `src/worker/**` (excluding `routes/admin`), `src/web/**`, `public/**`, `index.html`, `vite.config.ts`
  - `wrangler.jsonc`, `wrangler.staging.jsonc`, `migrations/**`, `.github/**`, `tests/fixtures/**`, `packages/**`
  - **all identical**. Only `package.json` (admin scripts) and `tsconfig.json` (`src/admin` include) differ.
- **Docs:** `docs/admin/remediation-r1/{REPORT,REGRESSION}.md`, its evidence, and `docs/admin/PRODUCTION_INTEGRATION_PLAN.md`.

## 3. Findings (reproducible)

Reproducer: `tools/r1-independent.test.ts` (18 tests, 18 pass). A FINDING test passes when the weakness is
reproduced; a CONTROL test passes when the property holds. No P0 was found.

| ID | Sev | Finding | Evidence | Paths |
|---|---|---|---|---|
| F1 | **P1** | The admin Worker holds a **direct, writable D1 binding to the production customer database**: `DB → frigo-db`, the same database id as the customer Worker. The SELECT-only rule is application code only (`readOnlyDatabase()` regex plus a wrapper); nothing at the infrastructure level enforces it. The Worker also reads `auth_accounts.password_hash` and `salt` on **every** authenticated request to compute the credential fingerprint, including in Access-only production mode. | R1C-B3 (credential reads observed); R1C-B2 (guard shapes); `wrangler.admin.jsonc` | `wrangler.admin.jsonc`, `auth.ts` (`ACCOUNT_SQL`, `credentialFingerprint`), `readonly-db.ts` |
| F2 | **P1** | **Governance deadlock with exactly two SUPER_ADMINs.** If one becomes unavailable (left, lost IdP access, account unverified), no in-product path can add a SUPER_ADMIN (the grant needs that person's approval) or remove them (the minimum-two trigger blocks it). No break-glass procedure is defined. | R1C-D2 | `index.ts` roles/approvals, `0001` `trg_admin_roles_super_minimum` |
| F3 | **P1 (production)** | **No production bootstrap ceremony.** The SQL distinguishes two *user ids*, not two humans: one person with two verified mailboxes satisfies it and controls both approvals. There is no protected workflow, no operator identity binding, and no recovery path. | design review; PRODUCTION_INTEGRATION_PLAN §5 is descriptive only | `scripts/admin-local-lib.mjs#buildBootstrapAdminSql`, plan §5 |
| F4 | P2 | The decider's or actor's authority is not re-checked inside the mutation batch. A SUPER_ADMIN whose role is revoked between the session check and the batch still completes the approval. The same window exists for grants and revocations of non-SUPER roles. | R1C-D1 (decision applied after concurrent revocation) | `index.ts` approval batch, `POST/DELETE /roles` |
| F5 | P2 | The bootstrap runs as three separate statements. If it is interrupted after the grants, the marker and audit rows are missing, and the bootstrap-once trigger still accepts further `operator_bootstrap` SUPER_ADMIN grants. | R1C-D3 (third grant accepted, 0 audit rows) | `buildBootstrapAdminSql`, `trg_admin_roles_bootstrap_once` |
| F6 | P2 | The per-account login budget is consumed **before** authentication, so 10 bad attempts lock the real admin out for 15 minutes. In production, login sits behind Access, so the attacker must already be an Access-authenticated principal. | R1C-C1 | `auth.ts` login (`login-account` budget) |
| F7 | P2 | Availability: overview/billing/AI aggregates use `date(col) >= ?`. The query plan is `SCAN users`, `SCAN payment_intents`, `SCAN sessions_v2`, so each page load runs several full scans on the customer DB, which serves live customer traffic. | `EXPLAIN QUERY PLAN` (review log) | `overview.ts`, `billing-ai.ts` |
| F8 | P2 | Flaky E2E. "scrollable tables are reachable…" read `scrollLeft` immediately after an animated keyboard scroll. The product behaves correctly. | 4 pass / 2 fail in `--repeat-each 6`; diagnostic 5/5: 0 px → 80 px within 150 ms (`evidence/keyboard-diagnostic.json`) | `tests/e2e/admin-a11y-responsive.e2e.ts:85` |
| F9 | P2 | The E2E rewrites 11 tracked PNGs in `docs/admin/screenshots/` on every run, leaving the tree dirty after tests. | `git status` in the review worktree after E2E | `tests/e2e/admin-console.e2e.ts` (`shot()`) |
| F10 | P2 | Deep-link reload 404s for ids containing `.` or `:`, which the API schema (`IdParam`) allows. No current id format uses them (0 recipes; user ids `usr_*`), so impact is low. | R1C-A1 | `admin-worker.ts` `SHELL_ROUTE` |
| F11 | P2 | Admin grants are bound to an email→account mapping, not to the Access identity (`sub`). Reassigning an email in the customer DB revokes sessions but would let the new owner of that verified email inherit the grant at next login. | design review | `auth.ts` Access login |

**Verified controls (independently re-executed):**
- No admin write reaches any customer table across 13 mutations and 16 reads, checked with write-capture triggers on every customer table (R1C-B1).
- The admin DB has no foreign keys, so deleting customer users does not touch admin history (R1C-B4).
- Access controls hold:
  - assertions for another identity, expired tokens, foreign signatures, revoked roles and unverified accounts are refused;
  - password bodies are ignored in Access mode;
  - an account security change revokes the session (R1C-C2);
  - production without an AUD fails closed (R1C-C3).
- Origin/CSRF: non-canonical or hostile Origins and non-same-origin fetch metadata are refused (R1C-C4). Under a valid production split host, the customer origin cannot log in or mutate even with a valid Access assertion, session and CSRF token, and no CORS headers are sent (R1C-C5).
- Per-account limit: the 11th attempt is 429 (R1C-C6).
- Governance:
  - concurrent decisions produce exactly one grant (R1C-D4);
  - concurrent SUPER_ADMIN revocations never drop below two (R1C-D5);
  - a requester who lost SUPER_ADMIN gets the request cancelled (R1C-D6);
  - a single-SUPER_ADMIN state is impossible and unilateral SUPER_ADMIN revocation is impossible (R1C-D7).

## 4. Threat model

| Actor | Goal | Boundary / control | Residual risk |
|---|---|---|---|
| Anonymous Internet | Reach admin UI/API | Cloudflare Access (production) → admin surface gate (exact env/origin/flag) → session | Depends on the real Access app (unverified) and `workers_dev: false` / route hygiene |
| Customer user, customer-app XSS | Use admin authority | Separate origin, host-only `__Host-` cookie, exact Origin + session-derived CSRF, no CORS, customer Worker has no admin code | Low; re-verified (R1C-C5, workerd customer comparison) |
| Authenticated low-privilege admin | Escalate or read PII | Server RBAC on every route, audited PII reveal (fail closed), email search only for `users.pii.reveal` | Low |
| Malicious or compromised SUPER_ADMIN | Unilateral control | Four-eyes grants and revocations, minimum two, decisions final | F3 (one human with two identities), F4 (TOCTOU window) |
| Compromised admin Worker code or dependency | Modify or exfiltrate customer data | Only `readOnlyDatabase()` in code | **F1: a full write path to production customer data, and credential hashes readable** |
| Operator with D1 / Cloudflare access | Tamper with grants or audit | Triggers (append-only, final decisions) | Triggers can be dropped; audit is not tamper-evident |
| Availability attacker / heavy admin use | Degrade customer DB | Per-admin read budget (120/min) | F7: full scans on the shared DB |

## 5. Admin ↔ customer D1 isolation — assessment and decision

- Admin authority data (`ADMIN_DB`) is separate and has no FKs into customer data. **LOCAL_VERIFIED.**
- Access to the customer DB uses a **raw `D1Database` binding with full write capability**. There is no
  infrastructure-enforced read-only access; enforcement is `assertReadOnlySql` (statement must start with
  `SELECT`/`WITH`, mutating keywords and `;` rejected) plus a wrapper that refuses `batch`/`exec`.
  - Every one of the 18 `prepare` call sites uses fixed SQL fragments with bound parameters; no request text reaches SQL.
  - CTE, comment and multi-statement shapes are rejected (R1C-B2).
  - Read-only table functions (`pragma_table_info`) and credential columns remain readable.
- Bounds: every list is paginated (`pageSize` ≤ 100, `page` ≤ 1000) and every lookup is capped with LIMIT.
  Aggregates are unbounded scans (F7).
- Sensitive fields are masked by default (email, order code). Reveal requires an audit row first. Password hashes are
  never returned to clients, but the Worker processes them on every request (F1).

**Decision (required before staging):**
1. Remove the `DB` binding from the admin Worker.
2. Expose a **private Service Binding to a read facade** (a `WorkerEntrypoint` with typed, purpose-built methods),
   owned and reviewed with the customer codebase, that returns only projected fields.
3. Replace credential material with a monotonic `security_epoch` maintained by the customer auth flows. This touches
   protected customer auth code, so it needs separate authorization.
4. Move aggregates to rollups or cached projections, or read them through D1 read replication via the facade.

A controlled data projection (a periodic export into `ADMIN_DB`) is acceptable for metrics, but not for the
session-time account checks.

## 6. Authentication and RBAC

| Property | Result |
|---|---|
| Access JWT | RS256 only, `kid` lookup (refresh throttled 60 s), signature, `aud` contains AUD, exact `iss`, `exp`, `nbf` (+60 s skew), email required. Checked on login **and every request**; the email must match the session account. LOCAL_VERIFIED with generated keys. |
| Missing/invalid Access config | `mode: unavailable`, login/session APIs 503 (R1C-C3; workerd NEGATIVE AUD-empty 4/4) |
| Local-only password auth | Requires `ENVIRONMENT∈{development,test}` + loopback origin + compile-time define. The production dry-run bundle keeps the runtime guard (define absent) — reproduced among the 108 implementer checks. |
| Cookies | Exactly one `__Host-takosan_admin_session`, HttpOnly, Secure, SameSite=Strict, host-only. Confirmed in a real browser under workerd. `document.cookie` exposes nothing. |
| CSRF / Origin | Exact Origin; session-derived token in memory; fetch metadata must be same-origin (R1C-C4/C5) |
| RBAC | Explicit `requirePermission` on all 21 protected routes (static review); 5 roles × 15 reads matrix (repository tests) and the original reviewer's matrix PoCs (4/4 controls hold) |
| Revocation | Role change, credential/email/verification/Google-link change, auth-mode change, logout, admin revoke |
| Unverified until real Access staging | real JWKS and rotation; real `iss`/`aud`; assertion on every route including assets; service tokens; Access logout vs admin logout; clock skew; no route reaches the Worker without Access (custom domain only, `workers_dev: false`); identity binding (F11) |

## 7. Bootstrap governance

- **Holds locally:** two distinct user ids, one-time after the marker, no self-approval, final decisions,
  replay-safe, concurrency-safe (D4/D5), minimum two (D7), requester re-check (D6), audit in the same batch.
- **Not production-ready:** F2 (deadlock), F3 (no ceremony binding identities to people), F4 (TOCTOU), F5
  (non-atomic bootstrap). Local synthetic identities prove mechanics only, not production authorization.
- **Required ceremony:**
  - three named operators, each with a distinct IdP identity in the Access group, verified out of band;
  - two of them bootstrap, the third witnesses;
  - the bootstrap runs as one D1 batch through a protected workflow whose Environment reviewers are those operators;
  - go-live requires **at least 3** active, loginable SUPER_ADMINs;
  - a written break-glass procedure: two organization owners run a reviewed SQL batch through the same protected
    path to replace an unavailable SUPER_ADMIN, recorded as `admin.breakglass` in the audit log.

## 8. Original 51 PoCs — verification matrix

Before = `3e865d0` with the original harness. After = `0331cc9` through the adapter, with PoC files unchanged.
Totals: **before 51/51 pass; after 22 pass / 29 fail; 23 attack PoCs: 21 no longer reproduce, 2 still pass
(explained); 28 controls: 20 hold, 8 fail for contract reasons (explained); 0 unexplained.**

Several attack PoCs (H1a/b/d/e, H2b, H3, H4, H7) fail because the adapter configuration is now disabled
(development on a public host → 404), or because a new control blocks their setup. They therefore **do not exercise
the fix itself**. Each is independently re-verified by the reviewer test named in the Verdict column.

| # | PoC (file › title) | Type / finding | Before (3e865d0) | Expected after | Actual after | After evidence (first failure line @ PoC line) | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | access-verifier.test.ts › accepts a correctly signed token and lowercases the email | control | passed | pass | passed | — | Control holds |
| 2 | access-verifier.test.ts › rejects alg=none and non-RS256 headers | control | passed | pass | passed | — | Control holds |
| 3 | access-verifier.test.ts › rejects wrong audience, wrong issuer, expired, and missing exp | control | passed | pass | passed | — | Control holds |
| 4 | access-verifier.test.ts › rejects a signature made by another key that reuses the trusted kid | control | passed | pass | passed | — | Control holds |
| 5 | access-verifier.test.ts › accepts an audience array that contains the configured AUD | control | passed | pass | passed | — | Control holds |
| 6 | access-verifier.test.ts › observed: an unknown kid forces a JWKS refetch on every request (no negative caching) | attack (S9) | passed | fail (defect absent) | failed | AssertionError: expected +0 to be 3 // Object.is equality @72 | Defect not reproducible |
| 7 | authz-matrix.test.ts › anonymous requests are 401 on every read and mutation | control | passed | pass | passed | — | Control holds |
| 8 | authz-matrix.test.ts › each role gets exactly the reads the matrix grants; others get 403 ADMIN_FORBIDDEN | control | passed | pass | passed | — | Control holds |
| 9 | authz-matrix.test.ts › each role is denied mutations it lacks the permission for, with no side effect | control | passed | pass | passed | — | Control holds |
| 10 | authz-matrix.test.ts › revoked admin, household owner and plain customer cannot obtain a session | control | passed | pass | passed | — | Control holds |
| 11 | gate-c-db-writeset.test.ts › a full admin workflow writes only admin_* tables (DB triggers capture every INSERT/UPDATE/DELETE, incl. cascades) | control | passed | fail (contract change) | failed | AssertionError: expected 201 to be 200 // Object.is equality @33 | Contract change: SUPER_ADMIN revocation now returns 201 (four-eyes request) instead of 200, aborting the PoC before its write-set assertion; property re-verified by R1C-B1 |
| 12 | gate-c-db-writeset.test.ts › admin_audit_events is append-only and has no FK to users (audit survives user deletion) | control | passed | pass | passed | — | Control holds |
| 13 | gate-c-db-writeset.test.ts › latent: a SUPER_ADMIN that granted roles cannot be deleted from users (granted_by has no ON DELETE) | attack (S10) | passed | fail (defect absent) | passed | — | Attack PoC still passes — explained: still blocked, but by the pre-existing customer FK households.created_by → users(id); the admin DB has no foreign keys; verified by R1C-B4 |
| 14 | gate-c-db-writeset.test.ts › latent: deleting a user cascades away their admin grant history while the audit trail remains | attack (S10) | passed | fail (defect absent) | failed | AssertionError: expected 1 to be +0 // Object.is equality @72 | Defect not reproducible; absence independently verified by R1C-B4 |
| 15 | gate-c-db-writeset.test.ts › latent: deleting a recipe silently cascades its editorial review history | attack (S10) | passed | fail (defect absent) | failed | AssertionError: expected 1 to be +0 // Object.is equality @81 | Defect not reproducible; absence independently verified by R1C-B4 |
| 16 | h1-h2-h8-origin-host-env.test.ts › H1a CONFIRMED: login from the admin origin is refused with ADMIN_CSRF_FAILED | attack (S3) | passed | fail (defect absent) | failed | AssertionError: expected 404 to be 403 // Object.is equality @11 | Defect not reproducible; absence independently verified by R1C-C4, R1C-C5 |
| 17 | h1-h2-h8-origin-host-env.test.ts › H1b CONFIRMED: the customer origin (APP_URL) is the origin accepted for admin login on the admin host | attack (S3) | passed | fail (defect absent) | failed | AssertionError: expected 404 to be 200 // Object.is equality @17 | Defect not reproducible; absence independently verified by R1C-C5 |
| 18 | h1-h2-h8-origin-host-env.test.ts › H1c control: when APP_URL equals the admin host, login from the admin origin works | control | passed | fail (contract change) | failed | AssertionError: expected 404 to be 200 // Object.is equality @24 | Contract change: adapter maps this to ENVIRONMENT=development on a public host, which R1 disables (S1); admin-origin login re-verified under a valid production split host; property re-verified by R1C-C5 |
| 19 | h1-h2-h8-origin-host-env.test.ts › H1d CONFIRMED: admin mutations are refused from the admin origin and accepted from the customer origin | attack (S3) | passed | fail (defect absent) | failed | AssertionError: expected 404 to be 403 // Object.is equality @31 | Defect not reproducible; absence independently verified by R1C-C5 |
| 20 | h1-h2-h8-origin-host-env.test.ts › H1e CONFIRMED: admin API responses reflect the customer origin with credentials (CORS trust follows APP_URL) | attack (S3) | passed | fail (defect absent) | failed | TypeError: Cannot read properties of undefined (reading 'cookie') @40 | Defect not reproducible; absence independently verified by R1C-C5 |
| 21 | h1-h2-h8-origin-host-env.test.ts › refuses a foreign, null, or missing origin and accepts a trusted Referer only as fallback | control | passed | fail (contract change) | failed | AssertionError: expected 403 to be 200 // Object.is equality @62 | Contract change: the Referer fallback was intentionally removed (exact Origin only); the refusals in this PoC still hold; property re-verified by R1C-C4 |
| 22 | h1-h2-h8-origin-host-env.test.ts › refuses a wrong CSRF token even with a trusted origin, and audits the denial | control | passed | pass | passed | — | Control holds |
| 23 | h1-h2-h8-origin-host-env.test.ts › H2a CONFIRMED: ENVIRONMENT undefined -> console enabled, mode=password, password login succeeds | attack (S1) | passed | fail (defect absent) | failed | AssertionError: expected 404 to be 200 // Object.is equality @79 | Defect not reproducible; absence independently verified by workerd NEGATIVE ENVIRONMENT missing |
| 24 | h1-h2-h8-origin-host-env.test.ts › H2b CONFIRMED: ENVIRONMENT="" behaves identically to undefined | attack (S1) | passed | fail (defect absent) | failed | TypeError: Cannot read properties of null (reading 'data') @89 | Defect not reproducible; absence independently verified by workerd NEGATIVE ENVIRONMENT empty string |
| 25 | h1-h2-h8-origin-host-env.test.ts › H2c CONFIRMED: ENVIRONMENT="Production" (wrong case) is not 404 and enables the console by default | attack (S1) | passed | fail (defect absent) | failed | AssertionError: expected 404 to be 200 // Object.is equality @96 | Defect not reproducible; absence independently verified by workerd NEGATIVE ENVIRONMENT "Production" |
| 26 | h1-h2-h8-origin-host-env.test.ts › H2d CONFIRMED: ENVIRONMENT="staging" exposes the console by default; password login needs only an extra flag | attack (S1) | passed | fail (defect absent) | failed | AssertionError: expected 404 to be 200 // Object.is equality @104 | Defect not reproducible; absence independently verified by tests/integration/admin-remediation.test.ts decision matrix (staging password) |
| 27 | h1-h2-h8-origin-host-env.test.ts › H2e control: ENVIRONMENT=production fails closed (404 unless ADMIN_CONSOLE_ENABLED=true; no password mode) | control | passed | fail (contract change) | failed | TypeError: Cannot read properties of null (reading 'data') @116 | Contract change: a production config with a loopback/http origin is now refused earlier with an opaque plain-text 404, so the PoC cannot read a JSON body; property re-verified by R1C-C3, workerd NEGATIVE scenarios |
| 28 | h1-h2-h8-origin-host-env.test.ts › H8a CONFIRMED (colocated): CSRF cookie is script-readable; session cookie is HttpOnly | attack (S3) | passed | fail (defect absent) | failed | TypeError: .toMatch() expects to receive a string, but got undefined @127 | Defect not reproducible |
| 29 | h1-h2-h8-origin-host-env.test.ts › H8b CONFIRMED (colocated XSS model): same-origin script reads the CSRF cookie and performs a privileged mutation | attack (S3) | passed | fail (defect absent) | failed | TypeError: Cannot read properties of null (reading '1') @134 | Defect not reproducible |
| 30 | h1-h2-h8-origin-host-env.test.ts › H8c CONFIRMED (ADMIN_HOSTNAME set): customer API and SPA fallback are still served on the admin host | attack (S3/S2) | passed | fail (defect absent) | failed | AssertionError: expected 404 to be 200 // Object.is equality @143 | Defect not reproducible; absence independently verified by workerd NEGATIVE foreign host |
| 31 | h1-h2-h8-origin-host-env.test.ts › H8d control (ADMIN_HOSTNAME set): admin API is not reachable on the customer host | control | passed | fail (contract change) | failed | TypeError: Cannot read properties of null (reading 'code') @154 | Contract change: foreign hosts receive an opaque plain-text 404 instead of a JSON error, so the PoC fails reading .code; the status is still 404; property re-verified by R1C-C5 (customer host → 404) |
| 32 | h3-h4-h7-roles-approvals.test.ts › H3 CONFIRMED: with a single active SUPER_ADMIN, no product path yields a second one | attack (S4) | passed | fail (defect absent) | failed | Error: at least two active SUPER_ADMIN assignments must remain @8 | Defect not reproducible; absence independently verified by R1C-D7 |
| 33 | h3-h4-h7-roles-approvals.test.ts › H4 CONFIRMED: one SUPER_ADMIN revokes another without four-eyes, and the revoked session dies | attack (S4) | passed | fail (defect absent) | failed | AssertionError: expected 409 to be 200 // Object.is equality @29 | Defect not reproducible; absence independently verified by R1C-D7, R1C-B1, R1C-D5 |
| 34 | h3-h4-h7-roles-approvals.test.ts › control: a SUPER_ADMIN cannot revoke its own grant | control | passed | pass | passed | — | Control holds |
| 35 | h3-h4-h7-roles-approvals.test.ts › H7 CONFIRMED: approval requested by a since-revoked SUPER_ADMIN is still approvable and grants SUPER_ADMIN | attack (S4) | passed | fail (defect absent) | failed | AssertionError: expected 409 to be 200 // Object.is equality @49 | Defect not reproducible; absence independently verified by R1C-D6 |
| 36 | h5-h6-h9-h10-pii-session-login.test.ts › H5 CONFIRMED: email is returned even though the audit insert fails | attack (S5) | passed | fail (defect absent) | failed | AssertionError: expected 503 to be 200 // Object.is equality @12 | Defect not reproducible |
| 37 | h5-h6-h9-h10-pii-session-login.test.ts › control: with audit available the reveal is recorded | control | passed | pass | passed | — | Control holds |
| 38 | h5-h6-h9-h10-pii-session-login.test.ts › H6 CONFIRMED: rotating the customer credential row leaves the admin session valid | attack (S6) | passed | fail (defect absent) | failed | AssertionError: expected 401 to be 200 // Object.is equality @32 | Defect not reproducible |
| 39 | h5-h6-h9-h10-pii-session-login.test.ts › H9a CONFIRMED: no per-account throttle; 10 wrong passwords from 10 IPs are all 401 | attack (S7) | passed | fail (defect absent) | passed | — | Attack PoC still passes — explained: the PoC makes exactly 10 attempts; the per-account budget is 10 per 15 minutes, so the 11th attempt is 429; verified by R1C-C6 |
| 40 | h5-h6-h9-h10-pii-session-login.test.ts › H9b control: the per-IP limit (5/min) applies to one source | control | passed | pass | passed | — | Control holds |
| 41 | h5-h6-h9-h10-pii-session-login.test.ts › H9c CONFIRMED (no CF header, e.g. non-Cloudflare ingress): rotating X-Forwarded-For bypasses the limiter | attack (S7) | passed | fail (defect absent) | failed | AssertionError: expected [ 401, 401, 401, 401, 401, 429, …(2) ] to deeply equal [ 401, 401, 401, 401, 401, 401, …(2) ] @60 | Defect not reproducible |
| 42 | h5-h6-h9-h10-pii-session-login.test.ts › H10 CONFIRMED: users.read roles confirm a full email via search with no audit trail | attack (S8) | passed | fail (defect absent) | failed | AssertionError: expected +0 to be 1 // Object.is equality @71 | Defect not reproducible |
| 43 | h5-h6-h9-h10-pii-session-login.test.ts › control: the same auditor is denied the explicit reveal (403) and that denial is audited | control | passed | pass | passed | — | Control holds |
| 44 | session-access-lifecycle.test.ts › a valid assertion for an admin email creates a cloudflare_access session | control | passed | fail (contract change) | failed | AssertionError: expected undefined to be defined @43 | Contract change: the PoC parses the removed __Host-takosan_admin_csrf cookie; its earlier assertions (200, authMethod cloudflare_access) passed; property re-verified by R1C-C2 |
| 45 | session-access-lifecycle.test.ts › a valid assertion for a non-admin identity is refused with the generic credential error | control | passed | pass | passed | — | Control holds |
| 46 | session-access-lifecycle.test.ts › password login is not offered in Access mode | control | passed | pass | passed | — | Control holds |
| 47 | session-access-lifecycle.test.ts › an existing Access session is denied when the assertion header is absent | control | passed | fail (contract change) | failed | AssertionError: expected 'ADMIN_UNAUTHENTICATED' to be 'ADMIN_ACCESS_DENIED' // Object.is equality @64 | Contract change: consequence of the previous PoC: no cookie was parsed, so the request is anonymous (401 ADMIN_UNAUTHENTICATED instead of ADMIN_ACCESS_DENIED); property re-verified by R1C-C2 |
| 48 | session-access-lifecycle.test.ts › production with ADMIN_AUTH_MODE=cloudflare_access but no AUD fails closed (503) | control | passed | fail (contract change) | failed | AssertionError: expected 404 to be 503 // Object.is equality @72 | Contract change: the PoC config is a loopback/http production origin, refused earlier with 404 instead of 503; property re-verified by R1C-C3, workerd NEGATIVE ADMIN_ACCESS_AUD empty |
| 49 | session-access-lifecycle.test.ts › logout revokes the session server-side | control | passed | pass | passed | — | Control holds |
| 50 | session-access-lifecycle.test.ts › an absolute-expired session is rejected | control | passed | pass | passed | — | Control holds |
| 51 | session-access-lifecycle.test.ts › an idle-expired session is rejected even when absolute expiry is in the future | control | passed | pass | passed | — | Control holds |

`{"total":51,"beforePassed":51,"afterPassed":22,"attacks":23,"attacksStillPassing":2,"controlsFailing":8,"unexplained":0}`

**The two attack PoCs that still pass:**
1. *H9a — "no per-account throttle; 10 wrong passwords from 10 IPs are all 401."* The PoC sends exactly 10
   attempts; the per-account budget is 10 per 15 minutes. R1C-C6 shows the 11th is 429. The attack (unlimited
   multi-IP guessing) no longer works. The early budget consumption has its own issue (F6).
2. *Latent — "a SUPER_ADMIN that granted roles cannot be deleted from users."* The delete is still refused, but by
   the **pre-existing customer FK** `households.created_by → users(id)`: the fixture admin owns a household. R1C-B4
   shows the admin DB has no foreign keys, and that once the household is removed the user deletes cleanly with the
   admin history intact.

**The eight control PoCs that fail:**
1. *H1c* — 404: the adapter maps it to development on a public host, which S1 now disables. The admin-origin login
   property is re-verified under a valid production split host (R1C-C5).
2. *Referer fallback* — 403 instead of 200: Referer fallback was intentionally removed. Its refusals still hold (R1C-C4).
3. *H2e* — TypeError on `.data`: production with a loopback/http origin now gets an opaque plain-text 404. That is
   stricter than the original 503 (R1C-C3; workerd NEGATIVE scenarios).
4. *H8d* — TypeError on `.code`: the status is still 404; foreign hosts now get plain text instead of JSON (R1C-C5).
5. *Gate C write-set* — 201 instead of 200: SUPER_ADMIN revocation is now a four-eyes request, which aborted the PoC
   before its write-set assertion. The write-set is re-verified more broadly by R1C-B1, with 0 customer writes.
6. *Access session creation* — the PoC parses the removed CSRF cookie; its earlier assertions (200, `cloudflare_access`) passed (R1C-C2).
7. *Access header absent* — a consequence of #6: no cookie, so 401 UNAUTHENTICATED instead of ACCESS_DENIED (R1C-C2).
8. *Production without AUD* — 404 instead of 503 because the PoC origin is loopback/http (R1C-C3; workerd AUD-empty scenario).

## 9. Regression evidence (this review, clean worktree of `0331cc9`)

Environment: Linux 4.19.0-gvisor x86_64, 4 vCPU, Node v24.21.0, pnpm 10.31.0, sqlite3 3.45.1, wrangler 4.149.0
(`WRANGLER_SEND_METRICS=false`, empty `CLOUDFLARE_API_TOKEN`, throwaway `XDG_CONFIG_HOME`), Playwright 1.63.0
Chromium (`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`).

| Check | Command | Exit | Result |
|---|---|---|---|
| Full suite | `pnpm test --reporter=dot --silent` (05:04:23–05:15:19Z) | 0 | **342 files / 7865 tests** (confirms the reported numbers) |
| Lint / typecheck / build | `pnpm lint`, `pnpm typecheck`, `pnpm build` (fixed `BUILD_TIMESTAMP`, `GIT_COMMIT`) | 0/0/0 | |
| Customer artifact identity | sha256 of `dist/client` vs the `186a9cf` build; `wrangler deploy --dry-run` both trees | 0 | 441/441 files identical, 0 admin files; Worker bundle identical |
| Migration smoke | `pnpm check:migrations` | 0 | `migration-smoke=ok`, `admin-migration-smoke=ok` |
| Migration / rollback matrix | `node scripts/admin-migration-matrix.mjs` | 0 | 11/11 |
| Implementer workerd checks | `node scripts/admin-workerd-check.mjs` | 0 | **108/108** reproduced |
| Independent workerd probe | `tools/workerd-probe.mjs` | 0 | **1169/1169** (see breakdown below) |
| Reviewer tests | `vitest run tools/r1-independent.test.ts` | 0 | 18/18 (5 findings reproduced, 13 controls) |
| Original PoCs before / after | vitest JSON reporter on `3e865d0` / `0331cc9` | 0 / 1 (expected) | 51/51; 22/29; matrix 0 unexplained |
| E2E + a11y + responsive | `pnpm test:admin:e2e` | 1 | 11/12; axe 0 violations on 11 screens; 0 px overflow on 10 screens × 1440/820/390; the failure is F8 |
| F8 isolation | `playwright test -g "scrollable tables" --repeat-each 6` + diagnostic | 1 | 4/6; 5/5 diagnostic runs scroll 80 px within 150 ms |

Independent workerd probe breakdown (17 scenarios):
- 1 production positive control (11 checks);
- 12 negative scenarios × 93 checks, each varying one setting: `ENVIRONMENT` "Production"/"prod"/" production"/"PRODUCTION"/""/missing; flag "false"/"TRUE"/"1"; shared host; literal template; foreign host;
- AUD empty (4 checks);
- a real browser session on workerd (15 checks);
- customer Worker `0331cc9` vs `186a9cf`, request for request (23 checks).

## 10. Release and migration integrity; admin pipeline design (not implemented)

- Customer runtime, configs, service worker and the 41-file migration ledger are **byte-identical to `186a9cf`**,
  and the customer build artifacts are identical. Nothing legitimate was reverted: every customer file `3e865d0`
  had touched was admin-related, and `186a9cf` is the parent of the whole series.
  - Caveat: newer commits on GitHub `main`, if any, were not examined (offline).
- Admin migration `0001` is additive in its own database: 9 triggers, CHECK constraints, partial unique indexes.
  Fresh apply, re-apply and the failed-apply path are verified by the matrix. Weaknesses: F5, and audit
  tamper-evidence only by trigger.
- **Required admin pipeline (design):**
  - *CI:* `admin-ci` on every PR touching admin paths — lint/types, admin unit + integration, `admin-migration-smoke`,
    `admin-workerd-check`, dry-run bundle assertions (no define, no fixture credential), E2E + axe with the F8 fix.
  - *Exact SHA:* deploy and migrate accept only a full SHA on `main` with green CI for that SHA, rechecked after
    approval (reuse the `release-check.mjs` patterns).
  - *Admin migration:* `admin-d1-migrate.yml` with Environment `admin-production` and two reviewers excluding the
    author; pinned migration manifest (per-file sha256); plan check against `takosan-admin-db`.
  - *ADMIN_DB identity:* the database name and id from `wrangler d1 list/info` must match a committed manifest and
    must **differ** from `frigo-db`.
  - *Staging:* a real Access app; PRODUCTION_INTEGRATION_PLAN §6 checks plus Access-specific ones (no assertion →
    401, service token refused, foreign identity refused).
  - *Ordering:* migrate admin DB → bootstrap ceremony → deploy with flag false (verify 404 everywhere) → enable flag
    (separate approval) → verify.
  - *Rollback:* flag false (immediate), or a previous admin Worker version. The schema is forward-only/additive;
    `schema_version` fails closed.
  - *Approvals:* two distinct reviewers each for admin migrations, bootstrap and enablement; CODEOWNERS for
    `src/worker/routes/admin`, `src/worker/admin-worker.ts`, `migrations-admin`, `wrangler.admin*.jsonc`.

## 11. Production integration blockers

1. F1 — replace the writable customer DB binding with a read facade; remove credential-hash reads (needs authorization for customer-auth changes).
2. F2 + F3 — at least 3 SUPER_ADMINs, identity-bound ceremony, break-glass procedure.
3. Real Cloudflare Access application and staging verification of the §6 unverified list (STAGING_NOT_VERIFIED, PRODUCTION_NOT_VERIFIED).
4. Admin CI, migrate and deploy workflows (§10) — not present.
5. Placeholder IDs in `wrangler.admin.jsonc` (all-zero `ADMIN_DB`/KV), no route, no origin/AUD values.
6. Independent human or separate-team review of this code (see §0).

## 12. Recommended remediation diff (not applied)

```diff
# wrangler.admin.jsonc — no writable customer binding (F1)
-  "d1_databases": [ { "binding": "DB", "database_name": "frigo-db", ... }, { "binding": "ADMIN_DB", ... } ],
+  "d1_databases": [ { "binding": "ADMIN_DB", ... } ],
+  "services": [ { "binding": "CUSTOMER_READ", "service": "frigo", "entrypoint": "AdminReadFacade" } ],

# src/worker/routes/admin/index.ts — decider/actor authority inside the batch (F4)
   WHERE id = ? AND status = 'pending' AND expires_at > ?
+    AND EXISTS (SELECT 1 FROM admin_role_assignments d WHERE d.user_id = ? AND d.role = 'SUPER_ADMIN' AND d.status = 'active')
#  (same guard on INSERT/UPDATE statements of POST/DELETE /roles, binding the acting admin id)

# migrations-admin/0002_* — close bootstrap on the first pair, not only on the marker (F5)
+CREATE TRIGGER trg_admin_roles_bootstrap_pair BEFORE INSERT ON admin_role_assignments
+WHEN NEW.grant_source = 'operator_bootstrap'
+  AND (SELECT COUNT(*) FROM admin_role_assignments WHERE grant_source = 'operator_bootstrap') >= 2
+BEGIN SELECT RAISE(ABORT, 'operator bootstrap has already been completed'); END;
#  and run grants + marker + audit as one D1 batch in the protected workflow

# src/worker/routes/admin/auth.ts — governance precondition (F2)
+  if (activeSupers < 3) return errorResponse(c, 503, 'ADMIN_GOVERNANCE_INCOMPLETE'); // production only

# src/worker/routes/admin/auth.ts — count failures, not attempts (F6)
-  const accountBudget = await consumeLimit(..., 'login-account', email, 10, 15 * 60);
+  // consume 'login-account' only when the attempt fails; key successes out

# tests/e2e/admin-a11y-responsive.e2e.ts (F8)
-  const after = await region.evaluate((el) => el.scrollLeft);
-  expect(after).toBeGreaterThan(before);
+  await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);

# tests/e2e/admin-console.e2e.ts (F9): write screenshots to .hoplite/artifacts, not docs/admin/screenshots
# src/worker/admin-worker.ts (F10): allow [A-Za-z0-9_.:-] path segments in SHELL_ROUTE (reject '.' and '..' segments)
# auth.ts (F11): persist the Access `sub` on first admin login and require it on later logins
```

F7: sargable `created_at >= ?` predicates with indexes (a customer migration, which needs separate approval), or
rollups served by the facade, plus 60 s KV caching of overview payloads.

## 13. Final verdict

**`ADMIN_V1_R1_CHANGES_REQUIRED`.**

R1's targeted fixes were independently re-verified with reproducible local evidence: S1 env fail-closed, S2 asset
bypass, S3 origin/CSRF/cookies, the customer release train, S5–S9, and the customer no-regression claim, including
byte-identical customer artifacts. The verdict is driven by:
- two P1 design issues that block staging and production — F1 (writable customer DB plus credential reads) and
  F2/F3 (governance deadlock and missing identity-bound ceremony);
- P2 items F4–F11;
- the absence of reviewer independence (§0), which on its own would forbid a PASS.

This verdict authorizes nothing: no GitHub publication, no Cloudflare staging deployment, no production operation.
