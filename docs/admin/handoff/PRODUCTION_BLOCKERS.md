# Production blockers

**STAGING_NOT_CERTIFIED. PRODUCTION_NOT_CERTIFIED.**

Nothing in this list has been waived. A blocker is cleared only by evidence on the exact SHA that will be deployed, plus the approval named in the last column.

| # | Blocker | Status today | Evidence needed | Approval owner |
|---|---|---|---|---|
| B1 | R2 findings F1, F2, F3 (P1) | OPEN | R2 WP1–WP2, WP4, WP5, WP7 tests pass; independent re-review | Project owner |
| B2 | R2 findings F4–F11 (P2) | OPEN | WP6, WP8, WP9 tests pass | Project owner |
| B3 | Independent security review | Not done. The 2026-10-14 review is self-review by the implementer (report §0). | A reviewer who did not write R1 or R2 signs off on the exact SHA | Owner names the reviewer |
| B4 | Cloudflare Access live verification | `STAGING_NOT_VERIFIED`, `PRODUCTION_NOT_VERIFIED`. Tested only with local RS256 keys. | Real team JWKS, exact `iss`/`aud`, rotation, service-token refusal, foreign-identity refusal, custom-domain-only routing, `workers_dev: false`, Access logout semantics | Owner, with separate Cloudflare change approval |
| B5 | Production SUPER_ADMIN bootstrap and recovery process | Designed in `PRODUCTION_INTEGRATION_PLAN.md` §5; not built. No break-glass procedure. | Three named operators with distinct Access identities; ceremony run once in staging; written break-glass procedure (F2, F3) | Owner |
| B6 | Real Cloudflare binding identity verification | `wrangler.admin.jsonc` has placeholder all-zero `ADMIN_DB` and KV IDs. Its `DB` binding uses the customer database ID (F1). | Create `takosan-admin-db` separately; record its ID; verify that no admin binding equals a customer ID; confirm binding names in the deployed Worker | Owner, with separate Cloudflare change approval |
| B7 | Dedicated admin CI and deployment workflow | Missing. `ci.yml` covers lint, typecheck, tests, migration smoke and build, but not admin E2E, workerd or the migration matrix. No admin deploy or migration workflow exists. | An admin workflow gated on exact SHA, with `admin-production` and two reviewers excluding the author, pinned migration manifest, ADMIN_DB identity check | Owner; repository change needs approval |
| B8 | Data-isolation certification | Not done. Reads still use the customer binding (F1). | R1C-B1 and WP1 tests on the release SHA; query-plan evidence for F7 | Owner |
| B9 | Staging end-to-end | Not done. | Staging deploy only with separate approval; E2E and axe against the staging origin; screenshots reviewed | Owner |
| B10 | Production authorization and rollback approval | Not requested. | Written approval for deploy, admin migration and flag enablement; rollback steps (flag off, previous Worker version; schema is forward-only) | Owner |
| B11 | Integration with `origin/main` | Not done. `origin/main` `0ff82edb7c251be340b5e00fbcf0ae8703b22a55` has 43 migration files versus 41 at `186a9cf`, and changed `src/worker/index.ts` and `scripts/migration-smoke.sh`. | WP0 merge, re-pinned migration matrix, full gates on the merged SHA | Engineering |
| B12 | Stale documentation | `docs/admin/ARCHITECTURE_MAP.md:38` names withdrawn `0042`; `MIGRATION_COMPATIBILITY.md` is superseded; `README.md` status is pre-certification. | Update the three documents in the WP0 change | Engineering |
| B13 | Public repository disclosure | Repository is public. The admin source and PoCs are published by this handoff. | Owner decision: keep public, make private, or move security material to a private advisory | Project owner |
| B14 | Customer ledger and migrations for any F7 index | Not authorized. | Separate customer migration approval | Owner |

## Facts that are not blockers but must be understood

- No P0 finding was identified. This is not evidence that none exists.
- The admin Worker's customer-facing exposure has not been measured in a deployed environment. Nothing is deployed.
- `ADMIN_CONSOLE_ENABLED` defaults to not enabled in `wrangler.admin.jsonc` and the policy fails closed. These are local-code facts, not operational proof.
