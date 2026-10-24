# WKD01 regression test audit

## RED baseline (before runtime activation)

- Date: 2026-10-25 JST.
- Node: v25.9.0 (default local Node; this is intermediate evidence, not the final Node24 gate).
- Command: `pnpm exec vitest run tests/unit/sync.test.ts tests/unit/client-session.test.ts tests/unit/logout-dialog.test.tsx tests/unit/offline-banner.test.tsx --maxWorkers=1 --testTimeout=15000`
- Capture: `.artifacts/takeover/wkd01/baseline-tests.log`.
- Result: 4 files failed; 72 tests; 54 passed, 18 failed.
- Expected failures: 15 sync durability/stock/strict-storage/finally checks; 1 legacy unknown-outbox preservation check; 2 unknown-status UI checks.
- Runtime/UI source was not yet activated; the baseline proves the added assertions detect the previously observed behavior.

## Scope

Test files only, plus this ignored evidence artifact. Runtime, packet, and shared state documents are owned by the parent/domain agents.

Coverage added: native outbox acceptance, failed write cache immutability, Week retry/reload stock immutability, invalid/unreadable outbox byte preservation, nullable diagnostics, post-write diagnostic/listener failure, automatic retry rejection, failed removal outside the HTTP classifier, failed guest rebinding, generated-ID acceptance after cache failure, independent additions, and finally reconciliation after server acceptance/local removal failure.

Fixture updates keep the new contract explicit: header adapter tests now assert authoritative reads after an accepted replay; cooking persistence failure asserts the typed error/cause and unchanged queue/cache.

GREEN focused run pending parent-owned UI/service changes.

## GREEN caller and compatibility verification

- Node: `/opt/homebrew/opt/node@24/bin/node` (PATH explicitly set to that directory).
- Command: `pnpm exec vitest run tests/unit/sync.test.ts tests/unit/client-session.test.ts tests/unit/logout-dialog.test.tsx tests/unit/logout-ux.test.ts tests/unit/offline-banner.test.tsx tests/unit/ui-rebuild-cooking.test.ts tests/unit/ui06-shopping.test.ts tests/unit/week-query-sync.test.ts tests/unit/ui04-scan-offline.test.ts tests/integration/browser-security.test.ts --maxWorkers=1 --testTimeout=15000`
- Capture: `.artifacts/takeover/wkd01/focused-callers-attempt1.log`.
- Result: **10 files / 234 tests PASS**, 8.12s. No unhandled retry rejection.
- Targeted ESLint: six changed test files PASS; capture `.artifacts/takeover/wkd01/tests-eslint.log`.
- Expanded faults: 8 callers reject outbox-write failure without changing either private cache; 8 callers retain accepted request/receipt after cache-write failure; shopping/cooking survive post-write diagnostic reads; Week creation preserves its old cache when enqueue fails; independently generated shopping IDs remain separate.
- Formatting: initial Prettier check warned sync/client-session/logout-dialog/ui-rebuild-cooking. HEAD versions of sync/logout-dialog/ui-rebuild-cooking already fail the same check. client-session was clean at HEAD and has been formatted after the passing run; only whitespace changed.
- Full suite/build/typecheck/browser evidence remains parent-owned.
