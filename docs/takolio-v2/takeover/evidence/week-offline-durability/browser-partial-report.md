# WKD01 Partial Domain-Outage Evidence

Final run: `export PATH='/opt/homebrew/opt/node@24/bin':"$PATH" && node .artifacts/takeover/wkd01/browser-partial-domain.mjs`

PASS at320/1440; `.artifacts/takeover/wkd01/partial-browser-2026-10-24T20-18-13.579Z/`; 16screenshots including filtered egg qty8.

Actual `/api/v1/me` stays online while all other `/api/` transport is aborted. Fresh document authenticates normally and cached Week UI repeats completion. All three pending attempts preserve exact same durable raw queue/body/key/cache. Reconnect performs one native import2->8; exact replay creates zero SQL/GET delta.

Public equivalent: `docs/takolio-v2/takeover/evidence/week-offline-durability/browser/partial-domain-outage/`. This supplements the full outage auth-gate evidence; no claim that registered offline documents bypass server verification.
