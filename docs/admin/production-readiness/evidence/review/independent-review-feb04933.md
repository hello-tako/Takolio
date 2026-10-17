# Independent release-adapter review: feb04933

Reviewer: /root/independent_admin_review (independent Codex reviewer; did not implement R2 or these adapters).
Frozen implementation SHA: feb049334eeb0e54ffcfe4fbc397f8eddbebe27f.
Review UTC: 2026-10-16T22:46Z to 2026-10-16T23:00Z.
Disposition: CHANGES REQUIRED. No release approval or staging certification.

## Findings

1. P1 - Emergency disable depends on the failing data/release plane. scripts/admin-release-adapter.mjs:122 and :131 require full target inventory, Admin D1 ledger/schema/integrity, database identity and both Workers' provisioned secrets before the Admin deploy. A D1 outage or integrity mismatch prevents any shutdown attempt. Local injected-provider reproduction of operation=disable with verifyLedger throwing "D1 unavailable" yielded calls [verifyTargets,verifyLedger], no deploy. Protected release requires a fast fail-closed shutdown capability. Implement a narrowly authorized target-bound containment operation independent of D1/facade/build/baseline/staging certification.

2. P2 - Disabled-release smoke probes a nonexistent API. scripts/admin-release-provider.mjs:157 requests /api/admin/auth/me; the actual route is /api/v1/admin/me. The probe accepts ordinary 404, so it can PASS while the actual API or a protected built asset still responds 200. Local injected HTTP reproduction returned 404 on all three existing probes and 200 on the actual API; verifyDisabled passed. Probe real protected API/config/assets and verify an unambiguous disabled response or exact Access interception.

3. P2 - Facade route inventory covers only the Admin hostname's zone. scripts/admin-release-provider.mjs:82 and :88 inspect zones/{target.zoneId}/workers/routes; a public route for the facade in another account zone is absent from those results and passes verifyTargets. Account custom domains and workers.dev are checked, but account zone routes must also be covered. Enumerate all account zones/routes with endpoint-appropriate completeness checks.

## Independent execution

Command:
PATH=/Users/tunbee27/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH TMPDIR=/private/tmp CI=true GITHUB_ACTIONS=true pnpm exec vitest run tests/unit/admin-release-adapter.test.mjs tests/unit/admin-release-provider.test.mjs --maxWorkers=1 --testTimeout=20000

Result: 2 files / 52 tests passed. Start local JST 2026-10-17 07:46:34 (UTC 2026-10-16 22:46:34), duration 330ms. This is the initial frozen adapter test set. Subsequent coordinated owner edits are excluded from that result and require a new clean freeze/rerun.

Reviewed exact policy/auth signature binding, repository/main/CI/environment/dispatch guards, protected workflow integration, fixed command/HTTP boundaries, D1 ledger/identity/schema guards, bootstrap/recovery calls, disabled deployments, rollback baseline and compensation, metadata/smoke and receipt behavior. Success receipts now verify disabled state for all operations; this closes the earlier provisional receipt concern.

## API/source checks and limits

Installed Wrangler 4.149.0 confirms deployment result.deployments[0] is the actively serving deployment; version bindings under resources.bindings, version_id and percentage semantics match provider assumptions. GitHub's official REST OpenAPI confirms approval-history and artifact digest shapes. The published environment REST schema does not expose can_admins_bypass; absence must remain fail-closed, and actual capability is a live schema prerequisite. This is an uncertainty, not proof that all live responses omit the property.

Current policy has both environments disabled and no real identities/custodians. No live API/resource query, external communication, commit/push, remote D1 command, deployment, Cloudflare change or approval was performed. Initial provisioning, existing disabled resource bindings, enrolled human operators, the first reviewed compatible rollback baseline, provider behavior, propagation, actual staging and all ST01-ST20 remain prerequisites/uncertainties. Full regression/build/browser validation belongs to the implementation owner on the next frozen source. This review cannot be reused as approval for later changes.
