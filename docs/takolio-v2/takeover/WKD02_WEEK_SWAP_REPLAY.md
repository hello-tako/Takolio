# WKD02 - Durable Week swap replay

Status: `LOCAL_WKD02_VERIFIED`, 2026-10-25 JST; ADR-069. Implementation checkpoint `89d0ea243d08e98670a512ef797da4f64ac516f4` verified by `implementation-scope.json`; parent `4c5f8ce85b90edfb9d8f6f8183014471947a3c72`. This separate documentation checkpoint binds the verified implementation. Official GitHub `main` observed read-only at `90b94129113b41e34701d99f51175cfa81cb73de`.

## Result

Keyed explicit Week swaps retain one immutable acceptance receipt scoped to household, plan, meal and client key. Receipt INSERT is the first statement in the existing atomic legacy/dual relational plan batch. Replay A after later swap B returns the current owned plan with `idempotentReplay: true`; zero plan, child-row, receipt or plan-cache writes. Reusing the tuple for a different normalized recipe token returns `409 IDEMPOTENCY_CONFLICT` before catalog/plan hydration. Transaction losers reread the winner; failed batches roll back together.

Additive `0045_week_swap_receipts.sql` creates no historical backfill, retains receipts after plan/slot deletion and cascades only on household deletion. Triggers reject replacement, update and direct delete. Existing keyless swaps and alternatives remain compatible. Legacy/dual Week and legacy/native inventory matrices retain inventory rows, lots, versions, commands, events, adoption receipts and storage locations byte-equivalently. Existing migrations0001-0044 remain unchanged.

The client freezes the exact keyed body/header once. Fetch loss or a successful-body TypeError/uncancelled AbortError queues only after durable outbox acceptance. Explicit cancellation, HTTP/auth errors, malformed JSON, application and cache failures stay errors. Existing banner/ConfirmDialog exposes exact conflict. Cancel retains bytes. Confirmed recovery authenticates, replays the exact request, validates the owned current plan, refreshes matching cache/query state, then removes only the approved exact operation. Failure or a changed session retains the request.

## Executed verification

Node24.16.0; canonical TMPDIR. Exact argv, exits, timestamps, raw/public hashes and failed attempts are retained under `evidence/week-swap-replay/`. Published source freezes match1233 source/test/config hashes.

- Full `pnpm test --maxWorkers=1 --testTimeout=15000`:420/420files,9430/9430tests PASS; exit0, reported1141.80s, wall1143.22s. Source unchanged during run. See `gates/full-clean-artifact-discovery.json` and `.log`.
- Backend focused6files/114tests PASS; client focused6files/251tests PASS. Actual client plus authenticated Hono/SQLite response-loss6cases PASS, included in client count. Exact commands: `backend/refined-focused.json`, `client/client-focused.json`, `logs/integration-green.json`.
- `pnpm lint`, `pnpm typecheck`, `pnpm check:migrations`, `pnpm build` PASS. Actual paired build `VITE_MEAL_PLANNER_ENABLED=true VITE_MEAL_COMPOSITION_V2_ENABLED=true pnpm build` PASS. `gates/checks.json` preserves these results and the earlier failed full run.
- Local Wrangler D1 migration proof PASS:94 preexisting application tables,9920 preexisting rows byte-equivalent; zero receipt backfill; four immutable attacks rejected; atomic rollback; plan deletion retains receipt; household deletion cascades. Underlying SQLite read-only integrity/foreign-key checks PASS; D1 API itself rejects integrity_check. See `d1-proof-final/summary.json` and `logs/sqlite-integrity-readonly.json`.
- Browser PASS:four actual frontend/Worker-router flows at320/1440,18 targeted PNG. Lost responseA, laterB, reload/replay retainB; conflict cancel/confirm and partial swap outage with `/me` online. Zero page errors, external requests, overflow or broken images. Existing `takolio-week-commands-real.e2e.ts`2tests PASS,26PNG;44PNG total. Exact commands in `logs/browser-frozen.json` and `logs/week-commands-e2e.json`.
- Independent backend/client/evidence reviews found no concrete unresolved scoped defect. Static reviews are labeled separately from executed gates. Publication hashes, source freezes, PNG dimensions/hashes and bounded credential/private-path scans PASS.
- `pnpm audit --audit-level=high` remains FAIL, exit1:0low/3moderate/2high in inherited Hono/Zod/Undici. This checkpoint does not resolve dependency findings or certify production readiness.
- Source/docs whitespace PASS. Full staged diff retains26 verbatim evidence warnings:22 EOF blank lines,4 trailing spaces; only captured logs and two generated SQL fixtures. Their bytes/hashes remain intact.

## Failed attempts retained

Backend baseline reproduced staleA overB:1FAIL, then GREEN. First expanded backend fixture attempt4FAIL/21PASS, corrected25PASS, final refined114PASS. Client baseline reproduced both transport losses:2FAIL; intermediate expanded attempt2FAIL/59PASS. Intermediate mode/header typing failed before final typecheck PASS. No test assertions or release config were weakened to obtain a green suite.

Initial local D1 unsupported pragma and initial browser selector attempt failed; supported API/read-only SQLite and corrected selector evidence are separate. Public validator initially assumed a dictionary for an agent's list-shaped manifest; corrected parser validates all hashes. First full run passed9430 repository tests but failed an extra generated historical snapshot suite. Rename of the byte-identical ignored snapshot from `.test.ts` to `.test.ts.txt` removed accidental discovery; source/tests/config unchanged. First failure and exact rename hash remain in `gates/full.log`, `artifact-discovery-fix.json` and `logs/public-validator-first-failure.log`.

## Recovery and scope

Final precommit recheck: `PASS_WITH_AUTHORIZED_PLATFORM_DRIFT`. Snapshot22763regular/772symlinks, source22772regular/772symlinks;116Git baseline files exact. Only ten previously authorized `.DS_Store` deltas differ; separately privately copied/verified. All other bytes/modes/links and HEAD/index/status match. Source index and stored manifest unchanged during check. No zero-difference claim; private recovery locations unpublished. Earlier authorized snapshot-index restoration remains disclosed in CAT01.

Precommit scope PASS:9112 unchanged parent paths,5782 protected-main paths,54salvage paths,69Argon/12asset/38screen rows unchanged;115prior FILE_DECISIONS rows preserved; all38owner reviews PENDING. Source freezes1233entries/zero differences. See `precommit-scope.json`, `recovery-precommit.json`; `implementation-scope.json` verifies `89d0ea243d08e98670a512ef797da4f64ac516f4` with the same preserved counts and zero failures. Post-docs proof is produced after the separate documentation commit in ignored `.artifacts/takeover/wkd02/post-docs-scope.json`,bound to its actual HEAD.

## Explicit ceilings and next action

Distinct fresh Week commands still rewrite full snapshots: no shared revision/CAS or cross-tab atomicity. Keyless commands, create/regenerate/slot/shopping/preferences remain outside receipt deduplication. Actual Node SQLite/Worker-router browser evidence does not certify hosted D1/workerd concurrency, physical devices, Safari, native zoom, screen readers, live providers or owner acceptance. Migration0045 must precede any future Worker using the schema; retained-schema/mixed-worker limits require separately approved rollout review.

Finite UI01-UI15+C12/C13 and CLI01/DEP01/CAT01/SCAN01/WKD01/WKD02 are locally bounded complete. Remaining:38owner reviews, media rights/mapping, device/Safari/assistive-technology, live-provider/hosted acceptance and a separately scoped dependency remediation. No speculative UI rebuild. Next:external acceptance and separately scoped dependency remediation; release requires explicit approval. Final post-docs scope verification follows this documentation checkpoint and records its actual HEAD in the local proof path above. No push, merge, deploy, remote migration, production, PayOS/payment/billing/checkout/webhook or unrelated auth/infrastructure change.
