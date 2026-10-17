# Independent final release-adapter review: 9395f0e3

Reviewer: /root/independent_admin_review (independent Codex agent; did not implement R2, its fixes or release adapters).
Frozen implementation SHA: 9395f0e31ea599f1eb7780a8eba36964fed7c483.
Tree: 72276a5a3ecc8754c7537ac23ff2c8639d5cb79c.
Final-delta comparison: a915b5a9713a01caa7f29c4935108a1152a29c8f.
Cumulative release review base: 77f81b7bff1c29790a67ea48475aa720a86b9f2e.
Reviewed UTC: 2026-10-16T23:05Z to 2026-10-16T23:07Z.
Disposition: PASS for the reviewed default-disabled offline implementation scope. No outstanding concrete P0/P1 finding in that scope. This is not real staging certification, production readiness, operator authorization, deployment approval or an assertion that provider APIs were exercised live.

## Findings

No new actionable finding in the exact final delta. The outstanding a915b5a9 P1 is closed: the dedicated staging workflow now has a separately opt-in protected certification job that validates an existing two-custodian completed report and uploads admin-staging-certification-{run.id}. This matches the production provider's pinned artifact-name/workflow/run/source/digest contract.

The report and production certificate are intentionally distinct signed objects. The report binds exact source, target policy digest, staging database, review digest, completion/expiry and all twenty ST check results, with no artifact self-ID/digest. A later production certificate independently binds the resulting immutable artifact ID/digest. The packaging script never runs or fabricates staging checks.

Shared verifier extraction preserves the strict manifest field set, exact-source/policy/database match, all twenty PASS requirements, expiry bounds and two distinct trusted Ed25519 signatures. Missing/failed/unrun checks do not become PASS.

The certification job is manual, default-off, exact-main/run-attempt gated, protected by admin-staging approval and credential-free for Cloudflare. Its script independently checks exact GitHub source/workflow/CI/environment facts before writing a private, write-once artifact. It needs no dependency install or build because its runtime imports are local modules and Node builtins.

The Access redirect path now accepts only the exact /cdn-cgi/access/login path or its slash-delimited children; the former prefix-only loginevil acceptance is rejected by regression coverage.

## Cumulative review and fixes

This report carries forward read-only source review from independent-review-feb04933.md and independent-review-a915b5a9.md, plus the complete final six-file delta. The earlier concrete disable dependencies, wrong API smoke, cross-zone facade routes, retained-secret behavior, shutdown recovery and compensation-config findings are closed in this candidate.

Cumulative scope includes target policy, two-signature authorization/replay/expiry/source guards, exact main/CI/dispatch/environment protection, all five protected manual workflows and Admin CI, credential ordering, fixed HTTP and command boundaries, D1 identity/migration/schema/integrity checks, bootstrap/recovery handoff to existing transactional guards, disabled deployments, compatible rollback, shutdown restoration/compensation, smoke and receipts, minimal shutdown Worker, disabled-response marker and local workerd scenario.

The earlier provisional bare-artifact-digest finding was withdrawn: actual loadContext already normalized the pinned action's bare hex digest to the API sha256: form. The extraction to normalizeArtifactDigest preserves that behavior and adds regression coverage. It is not an outstanding finding.

## Independent execution

Command:

PATH=/Users/tunbee27/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH TMPDIR=/private/tmp CI=true GITHUB_ACTIONS=true pnpm exec vitest run tests/unit/admin-release-adapter.test.mjs tests/unit/admin-release-provider.test.mjs tests/unit/admin-config.test.ts tests/unit/admin-local-tooling.test.ts --maxWorkers=1 --testTimeout=20000

Result: 4 files / 132 tests passed (107 adapter/provider plus 25 configuration/local-tooling tests). Start 2026-10-16T23:05:40Z; duration 2.85s. Clean source/HEAD remained unchanged through the final check at 23:06:43Z.

Additional producer checks:

1. Imported the actual scripts/admin-staging-attest.mjs entry point with synthetic Ed25519 report signatures and explicitly intercepted Node filesystem/child-process exports and fetch in a separate local Node process. The real parser/context/verifier/provider/packager code completed: eight mocked GitHub reads, one intercepted write of the exact original signed report, write-once mode, remoteExecuted=false. No real network request, repository/file write or invented check occurred.
2. Ran the real CLI with GITHUB_ACTIONS=false and ADMIN_RELEASE_EXECUTION_ENABLED=false. It exited 1 with "Protected exact-main staging dispatch required" before any provider call or artifact write.

Full regression, lint, typecheck, build, browser, local workerd and evidence-package verification remain owned by the implementation owner. Earlier a915b5a9 full-suite evidence is SHA-specific and must not be relabeled as this SHA. This independent result covers the narrow tests and source scope explicitly stated above.

## Remaining operational limits

Both release policies remain disabled with no real target/custodian identities. No enable operation exists. This implementation requires already isolated provisioned resources, current verified human enrollment and a first reviewed compatible disabled rollback baseline. Provisioning, secrets, environment/branch protection settings, public-route inventory visibility and signed custody are operator-owned prerequisites.

Actual Cloudflare/GitHub API shapes, permissions, Access tenant identity, external smoke, schema ledger behavior, migration application, distributed D1 concurrency, rollback/containment propagation, backup/restore and ST01-ST20 must be verified under separately authorized real staging. GitHub's published REST environment schema omits can_admins_bypass; missing evidence fails closed and actual authenticated availability remains a live prerequisite. Account route-absence claims require account-wide zone visibility.

No live Cloudflare request, remote D1 action, resource modification, deployment, commit, push, merge or external message was performed by this reviewer. All staging/production operations remain blocked. This exact-source code review PASS does not change ADMIN_V1_PRODUCTION_READINESS_BLOCKED / ADMIN_V1_STAGING_AUTHORIZATION_REQUIRED.
