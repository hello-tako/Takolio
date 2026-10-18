# Staging certification

> Historical schema-3/source-specific snapshot. Staffing, signing, release operations
> and current blockers are superseded by [19_SINGLE_OWNER_RELEASE.md](19_SINGLE_OWNER_RELEASE.md).
> Retained receipts are not current-source or live deployment evidence.

Runtime source: `9395f0e31ea599f1eb7780a8eba36964fed7c483`. Main baseline: `526596a8cd857984ad2b69901a8c7b0e9d6bccc2`.
Prepared by implementation owner `/root` (Codex); independent reviewer is
`/root/independent_admin_review`. Evidence environment: local macOS arm64,
Node v24.16.0, pnpm 10.33.2, Python 3.9.6, `TMPDIR=/private/tmp`.
Evidence timestamps are UTC. Commands, exit codes, log digests and limitations
are in `evidence/verification.json` and `12_REGRESSION_RESULTS.md`.
No live Cloudflare operation or operator approval is implied.

`ADMIN_V1_STAGING_AUTHORIZATION_REQUIRED`. No actual Cloudflare staging resources
were accessed, modified or certified. Local workerd/SQLite, synthetic JWTs,
placeholder IDs and offline dry-runs do not satisfy this gate.

Required authorized targets: dedicated staging Admin Worker, ADMIN_DB and KV;
staging Read Facade Worker; synthetic/approved customer staging D1; exact internal
Service Binding; dedicated hostname and Access application/issuer/audience;
verified enrolled owner identity and owner recovery key. Password login
must be compiled out, flag initially OFF, and the facade must have no public
route/preview URL. No staging target may point to production customer D1.

## Operator authorization record needed

Owner must name the account/environment, Worker/DB/KV/hostname/Access identities,
reviewed exact source and migration manifest, allowed operations/data, named
operator approvers, recovery custodians and stop/rollback conditions. Private
identity evidence and secrets stay outside this public repository. Local adapter review is retained in 13; real provider validation and verified
protection settings remain prerequisites.

## Required actual staging matrix

| Case | Verification | Current result |
| --- | --- | --- |
| ST01 | Flag OFF blocks protected pages and assets | NOT RUN |
| ST02 | No Access identity denied | NOT RUN |
| ST03 | Foreign issuer denied | NOT RUN |
| ST04 | Foreign audience denied | NOT RUN |
| ST05 | Expired token denied | NOT RUN |
| ST06 | Unauthorized Access identity denied | NOT RUN |
| ST07 | Allowed Access identity without Admin role denied | NOT RUN |
| ST08 | Each role sees only permitted resources | NOT RUN |
| ST09 | CSRF and hostile origins denied | NOT RUN |
| ST10 | Static routes cannot bypass Worker | NOT RUN |
| ST11 | Facade unreachable publicly | NOT RUN |
| ST12 | Invalid facade operations denied | NOT RUN |
| ST13 | Password hashes/salts absent from Admin output | NOT RUN |
| ST14 | One enrolled owner performs authorized atomic bootstrap | NOT RUN |
| ST15 | Approval/revocation concurrency and recovery pass | NOT RUN |
| ST16 | Sensitive action audit matches state | NOT RUN |
| ST17 | Migration replay, manifest and database identity verified | NOT RUN |
| ST18 | Browser/axe/role E2E at real staging hostname | NOT RUN |
| ST19 | Customer health/regression unaffected | NOT RUN |
| ST20 | Compatible rollback and emergency flag-OFF demonstrated | NOT RUN |

Each future row needs exact SHA, real target/version/identity, UTC timestamp,
operator/reviewer, command/test ID, exit/result, sanitized artifact digest and
limitations. Access verification additionally needs real JWKS rotation and logout
semantics. A single failure blocks enablement and production readiness.

The protected staging workflow now packages a completed owner-signed report via opt-in certify=true. The producer does not execute or infer PASS for any ST case. Production separately signs the resulting artifact ID/digest; no circular self-digest is required. Report fields and API contract limits are in 10_RELEASE_WORKFLOWS.md. All real ST cases remain NOT RUN.
