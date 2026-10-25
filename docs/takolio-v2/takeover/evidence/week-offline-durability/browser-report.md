# WKD01 Browser Evidence

Full run: `export PATH='/opt/homebrew/opt/node@24/bin':"$PATH" && node .artifacts/takeover/wkd01/browser.mjs`
Partial run: `node .artifacts/takeover/wkd01/browser-partial-domain.mjs`
Public integrity check: `python3 .artifacts/takeover/wkd01/check-public-evidence.py`

PASS: both flows at `320px`/`1440px`; 32 final screenshots total; no uncaught page errors/external requests/horizontal overflow.

Final raw runs:
- `.artifacts/takeover/wkd01/browser-2026-10-24T20-17-43.145Z/`
- `.artifacts/takeover/wkd01/partial-browser-2026-10-24T20-18-13.579Z/`

Public sanitized evidence: `docs/takolio-v2/takeover/evidence/week-offline-durability/browser/`; PNG exact bytes; readback excludes SQL lock tokens/credential-like fields/private absolute paths; manifests bind raw/public hashes. `raw-browser-inventory.json` retains failed attempt hashes and receipts.

Full API outage: existing registered-session verification gate blocks a fresh document; exact queue/cache survives. Partial domain outage: actual `/api/v1/me` remains online; fresh Week document renders cached plan, completes again, and retains the same durable operation. Both preserve stock2 while pending, replay exactly once to stock8, keep native lot count5, increment egg version once, and leave unrelated lots unchanged. Exact replay returns idempotentReplay and changes no SQL/GET facts.

Native merge semantics explain the corrected harness assertion: compatible egg lot is updated2000->8000 milli rather than adding another lot. Screenshot selector was narrowed to first Trứng button because both filter and row share that accessible name. No runtime workaround was added.

Limits: actual frontend/Worker router via Node in-memory SQLite adapter; actual planner/composition flags false; synthetic API transport/navigator outage; Vite assets/evidence controls remain available; Chromium only. No production/workerd/Safari/device/cross-tab claim. Initial failed runs lack incremental record payloads but retain screenshots/logs/diagnostics. Final harness stores facts incrementally.

Own preview stopped cleanly after both final runs. No runtime/auth/backend edits during this evidence phase.
