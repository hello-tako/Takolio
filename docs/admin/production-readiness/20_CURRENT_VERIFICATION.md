# Current verification - 2026-10-18

Branch: `codex/admin-production-readiness-20261018`. Base main:
`571f3c229696d6bc766de89f552a36f48ca92e58`. This is local synthetic verification
of the candidate source. Exact published-SHA hosted results must be checked on
the PR; they cannot be inferred from the baseline main checks.

| Check | Actual result |
| --- | --- |
| Admin unit/integration Vitest | PASS; 22 files / 348 tests, 44.88 seconds, serial one-worker run |
| Final metadata-audit delta | PASS; 1 file / 4 tests, after tightening single-page pagination and redaction |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS; both TypeScript projects |
| `pnpm build` | PASS; expected existing runtime Admin font URL warnings; emitted font files present |
| `pnpm check:migrations` | PASS; customer smoke plus Admin schema v4 |
| Real local multi-Worker workerd | PASS; 10/10 scenarios, including binding-free shutdown and password code exclusion |
| Local Wrangler D1 migration matrix | PASS; 25/25 cases; includes populated 3 -> 4 upgrade and failed-4 transactional rollback |
| Browser regression | PASS; 12/12 on isolated synthetic SQLite preview; zero axe violations in 11 scanned screens and no overflow at 390/820/1440 |
| Keyboard eventual-state regression | PASS; 10/10 consecutive repetitions |
| `pnpm audit --audit-level high` | PASS; no known vulnerabilities |
| Public added-text credential/identity scan | PASS |
| Whitespace / tracked screenshot reference / customer protected-path diff | PASS |
| Offline release configuration preflight | PASS; readyForDeployment=false, remoteExecuted=false, candidate checkout intentionally dirty during local validation |
| Whole-project Vitest | Running at publication checkpoint; exact final result will be recorded after completion |
| Hosted candidate CI and reviewer approval | PENDING; baseline source results do not certify this candidate |

Earlier failed attempts are retained in local logs: an intermediate delta had
one expected-error-message mismatch (155 passed / 1 failed), corrected before
the 348-test run; overlapping browser runs collided on the preview port/shared
trace output (11 passed / 1 artifact-close failure, plus keyboard startup refusal).
The browser and keyboard suites then ran sequentially and passed. No assertion,
timeout, retry count or test case was removed to make them pass.

Current repository/API inspection confirms canonical repository ID 1422954151,
main 571f3c22, enforced-admin branch protection, strict validate/validate-admin,
one approving review, stale dismissal and last-push approval. Existing production
Environment requires vn-taphoanhatung, prevents self-review and admin bypass;
staging has protected-branch restriction only. Dedicated admin-staging and
admin-production Environments do not exist yet (404 on direct API reads).

The new manual `Admin Infrastructure Audit` uses GET-only fixed Cloudflare metadata
endpoints through the protected staging secret, keeps only project resources and
allowlisted binding fields and reports missing scopes as
PENDING_EXTERNAL_EVIDENCE. It does not query database rows or read secret values.
It is prepared, not dispatched. Target policy remains enabled:false with
placeholders until actual dedicated resources/Access are verified.

No Admin live migration, owner enrollment, key/secret change, Access configuration,
Worker upload or production deployment has occurred. Real owner identity,
resource/protection configuration, ST01-ST20 and production acceptance remain
PENDING_EXTERNAL_EVIDENCE. Current operational steps are in 19_SINGLE_OWNER_RELEASE.md.

## Read-only Cloudflare dashboard observation

At the logged-in account dashboard, D1 showed 12 databases and KV showed 10
namespaces. The visible names were existing customer/other projects (`frigo`,
`frigo-db-staging-v3`, `selinow-*`, `tungjpstore-*`, `frigo-frigo-cache*`,
`selinow-cache/session-*`, and unrelated projects); no dedicated `takosan-admin*`,
`takolio-admin*`, Admin D1 or Admin KV was present. Access Applications showed
five existing apps (Takolio staging customer/PayOS, roomAgent, MailVault and
portfolio admin) and no `Takolio Admin` app. This observation is read-only and
uses no copied IDs; it confirms the infrastructure gate remains pending.
