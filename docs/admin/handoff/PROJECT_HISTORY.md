# Project history — Takosan Admin Console

All SHAs were resolved locally with `git rev-parse` and parent relations checked with `git log --format='%h %p'`. Counts come from `git show --shortstat`. Where a statement comes from a report rather than from git, it says so.

## Commit chain

```
186a9cf  customer baseline (Merge PR #71)
  └─ 3e865d0  feat(admin): Takosan Admin Console V1 (local)            98 files, +10084/−11
      └─ 6889f8d  docs(admin): record 2026-10-12 review (CHANGES_REQUIRED)   2 files, +200/−27 (also edits vite.config.ts)
          └─ 25140ba  fix(admin): Admin V1 security remediation R1        87 files, +3358/−1329
              └─ 0331cc9  docs(admin): R1 report, evidence and integration plan   32 files, +3541/−182
                  └─ 95a1425  docs(admin): R1 certification review (CHANGES_REQUIRED)   26 files, +16287
                      └─ 45cbec8  docs(admin): preserve handoff inputs, archive reviewer PoCs and evidence logs   84 files, +13911
                          └─ (handoff documentation commits; see HEAD_RECORD.md)
```

`ef50e344…` is the pre-amend object of `6889f8d` (reflog entry "commit (amend)"). It is not reachable from any branch. `6889f8d` differs from it only in `vite.config.ts` (1 insertion, 27 deletions).

## Phase A — Initial Admin V1 (`3e865d0`, committed 2026-10-12T13:56Z)

- **Architecture as built:** the console was mounted inside the **customer** Worker on the customer origin. Its assets were served from `dist/client/admin/`. Its admin tables were migration `0042_admin_console_foundation.sql` in the **customer** D1 ledger. The first design decision that the review later rejected.
- **Screens:** nine specified screens (`prompts/01-admin-console-v1-spec.md`, "Screen 01" to "Screen 09"): Authentication, Overview, Users & Households, Billing & Subscriptions, AI & OCR Operations, Recipe Management, System & Infrastructure, Audit & Security, Admin Settings. The implementation adds a login page and a user-detail page (`src/admin/pages`, 11 files).
- **Admin API:** `/api/v1/admin`, authenticated routes with `requirePermission`.
- **Authentication:** Cloudflare Access (production intent) and a local password mode (development only).
- **RBAC:** five roles as listed in START_HERE.
- **Local database:** seven tables and two triggers, in migration `0042` (`docs/admin/MIGRATION_COMPATIBILITY.md`; the same schema later moved to `ADMIN_DB`).
- **Audit:** `admin_audit_events`, append-only by trigger.
- **Super Admin governance:** two-person approval for SUPER_ADMIN grants and revocations.
- **Tests:** unit, integration and Playwright E2E (`tests/unit/admin-*`, `tests/integration/admin-*`, `tests/e2e/admin-*`).

## Phase B — Initial security review (`6889f8d`, review dated 2026-10-12, committed 2026-10-13T03:51Z)

Decision: `ADMIN_V1_REVIEW_CHANGES_REQUIRED` (`docs/admin/reviews/2026-10-12-independent-review.md`). The review itself says it was done by the same thread and model that implemented the change, so it is not organizational independence.

| ID | Severity | Summary |
|---|---|---|
| S1 | High | Environment detection failed open: missing, empty or wrong-case `ENVIRONMENT` enabled the console and password login. |
| S2 | High | The asset layer answered `/admin/` without running the Worker (no `run_worker_first`). |
| S3 | High | Admin CSRF/Origin/CORS trusted `APP_URL` (the customer origin); a JS-readable CSRF cookie. |
| S4 | Medium | SUPER_ADMIN lifecycle deadlock; no production bootstrap path; no revocation four-eyes. |
| S5 | Medium | PII reveal could return data when the audit insert failed (errors swallowed). |
| S6 | Medium | Admin sessions survived customer credential changes. |
| S7 | Medium | Login throttling per IP only; forwarding headers trusted as fallback. |
| S8 | Low | Email search acted as an oracle for `users.read` roles and was not audited. |
| S9 | Low | Unknown JWKS `kid` forced a refetch on every request. |
| S10 | Low | Admin DB foreign keys and cascades would block or erase history. |
| S11 | Low | Concurrent duplicate requests returned 500; decided approvals returned 200; `/auth/config` disclosed environment. |
| S12 | Info | Out of admin scope: customer auth accepts client `userInfo` and bearer JWTs when `ENVIRONMENT !== 'production'`. Not changed by R1. |

The original PoC suite is 51 tests in 7 files plus a harness, archived under `docs/admin/reviews/poc-archive/original-3e865d0/`. Before R1 they all passed on `3e865d0`, which is the expected result for a reproduction of a defect.

## Phase C — R1 remediation (`25140ba`, plus evidence `0331cc9`)

Implemented as described in `docs/admin/remediation-r1/REPORT.md`. Summary of the design change and the R1 fixes:

- **Dedicated Admin Worker** `src/worker/admin-worker.ts` with `wrangler.admin.jsonc`, `main` pointing to it, assets `./dist/admin`, `run_worker_first: true`, `workers_dev: false`. (S2, S3)
- **Dedicated admin database** `ADMIN_DB` (`takosan-admin-db`), schema `migrations-admin/0001_admin_console_foundation.sql` with `schema_version`. The admin schema left the customer ledger. (0042 release/rollback deadlock)
- **Customer baseline restored** byte-for-byte to `186a9cf` for the customer Worker, types, CSP, rate limiter, service worker, migration smoke, and the sqlite test helper (verified in this review). The customer migration ledger has 41 files, identical to `186a9cf`.
- **Strict environment policy** (`policy.ts`): exact allow-list; fail closed. Fixture-marked ADMIN_DB is rejected outside development/test. (S1)
- **Origin, CSRF and cookies** (`access.ts`, `auth.ts`, `headers.ts`): exact `ADMIN_ORIGIN`; no Referer fallback; `Sec-Fetch-Site` must be same-origin for mutations; host-only `__Host-` session cookie. (S3)
- **SUPER_ADMIN protection:** one-time two-person operator bootstrap, four-eyes approvals, DB triggers keep at least two active SUPER_ADMIN, final approvals, requester re-check. (S4, partly; findings F2–F5 remain)
- **Audit and session hardening:** `requireAudit` before disclosure, failing closed with `503 ADMIN_AUDIT_UNAVAILABLE`; session stores a credential fingerprint and is revoked on change. (S5, S6)
- **Login throttling:** global, per-IP and per-account budgets keyed on `CF-Connecting-IP` only. (S7; finding F6 remains)
- **Email search** only for `users.pii.reveal` holders, audited. (S8). JWKS refresh at most once per 60 s. (S9)
- **Frontend fixes** (P1 items in the report); E2E includes axe and three-viewport overflow checks.
- **Local tooling:** loopback binding, `WRANGLER_SEND_METRICS=false`, empty API token, throwaway config home, remote invocation refused.

The R1 report's own status line: `ADMIN_V1_REMEDIATION_READY_FOR_INDEPENDENT_REVIEW`. It states that it is not an independent review pass and not production approval.

## Phase D — R1 certification review (`95a1425`, review dated 2026-10-14, committed 2026-10-15T00:46Z)

Verdict: `ADMIN_V1_R1_CHANGES_REQUIRED` (`docs/admin/reviews/2026-10-14-r1-certification.md`). The reviewer is the same agent that implemented R1 (stated in the report §0). What was executed, against the clean worktree of `0331cc9`, is listed in TEST_AND_EVIDENCE.

Result in brief:
- Full suite 342 files / 7865 tests passed (executed at `0331cc9`).
- 51 original PoCs: 51/51 before, 22/29 after, 0 unexplained. Eight control PoCs fail because of intended contract changes; two attack PoCs still pass for stated reasons.
- Real-workerd checks: 108/108 (implementer) and 1169/1169 (reviewer probe, including a browser session).
- Reviewer-written tests: 18/18 (6 FINDING tests reproduce weaknesses; 12 CONTROL tests confirm properties).
- E2E 11/12 in the reviewer run (keyboard test flaky; F8). The R1 team reported 12/12 in its own run.
- Findings F1–F11 (see SECURITY_FINDINGS). No P0 identified.

## Phase E — R2

**R2 IMPLEMENTATION NOT STARTED.** Evidence: no commit after `95a1425` other than the handoff preservation and documentation commits; no stash; no worktree with changes; no R2 branch on the remote. The R2 **plan** is in `R2_IMPLEMENTATION_PLAN.md`. Nothing in it has been implemented.

## Corrections recorded in this handoff

1. The certification report §10 claimed that every customer file touched by `3e865d0` was admin-related. That is wrong (see Phase C and the erratum in the report).
2. `6889f8d` is labelled documentation-only but changes `vite.config.ts` (removes the admin SPA fallback plugin added by `3e865d0`). Customer state at HEAD is identical to `186a9cf` for this file.
3. The reviewer test was committed under `docs/` in `95a1425` where `pnpm test` collects it and it fails to import. Fixed in `45cbec8` by archiving it as `.txt`.
