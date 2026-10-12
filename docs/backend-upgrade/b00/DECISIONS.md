# B00 - Decisions and draft ADR register

Source base652e0d7632745e9b77cda4b5b3caac83a3ec1015; 2026-10-11 JST.

## ADR-B00-001 - Source and evidence authority

Status: ACCEPTED_FOR_B00_DOCUMENTATION.

Problem: original checkout is legacy while canonical main/source/deploy moved forward; same-SHA deployments have different catalog flags. Historical handoffs are valuable but cannot alone define current runtime.

Decision: isolate managed worktree from canonical fullSHA/repository ID; retain original checkout; source-pin route/migration/lock manifests; independently classify source, local checks, hosted CI/release receipts, public runtime observations and direct-runtime unknowns. Downloaded artifact digest must match API before using receipt. Source migration chain/hash must match recorded release schema, without claiming ledger checksum remeasurement on production. Historical PR/docs retained and reconciled separately; no automatic merge.

Consequences: B00 docs-only checkpoint, no runtime/schema/config/dependency/authority changes. New evidence supplements historical top sections without rewriting history. Missing direct runtime version/vars/inbox/SLO/R2/adoption proof stays release dependency. Full audit findings and expected blocked V2 release gate stay visible.

## Implementation ADR drafts - not accepted runtime policy

| Draft | Decision to review | Owner / point |
| --- | --- | --- |
| B01a OTP | D1 total admissions5/rolling15min, lock15min, TTL10min, cooldown60s; tickets/finalization/key retention; disclosed legacy OTP_REISSUE_REQUIRED cutover preserving budget/lock | Security/product; before B01a integration; details packet |
| B01b delivery | Native ambiguous outcome cannot blind fallback; accepted/delivered/bounced/unknown evidence and authenticated ingestion if supported | Backend/QA; adapter A1 before B01a wiring; real inbox before certification |
| B02 billing | Creation retry key/retention/original-offer replay/remote uncertainty reconciliation; any change to ADR-029 late failed policy | Explicit billing task+owner; protected scope before code |
| B03b contract | X-Scan-Contract-Version3, task/UNKNOWN/Money DTOs, cross-version idempotency409 target, old/new reader/writer/client/storage sequencing | AI/API/coordinator; before integration, providers OFF |
| B04 budget | Durable cumulative per-job spend/call/token admissions across redelivery and shadow, conservative crash charge, cancellation fence | AI/backend; before runtime wiring |
| B05 authority | Evidence-bound reviewed decisions, quantity channels, consumer readiness and immutable final fingerprint; subset/mixed release only through separate ADR | Data/domain; review model before migration/pilot promotion |
| B08 release | SLO thresholds from measurements; independent reviewer evidence beyond current0PR-required approval settings; security/toolchain separately scoped | Platform/operator; before canary/upgrade |

New ADR numbers are assigned against current canonical DECISIONS when task begins; B00 local namespace does not reserve numeric058+ (UI15 packet already proposes ADR-058). No numeric runtime/migration value is silently applied from a draft.
