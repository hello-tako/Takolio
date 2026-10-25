# WKD01 Actual-Browser Evidence

Local Chromium runs passed at `320px` and `1440px` using the actual frontend and actual Worker router with an adopted synthetic household on Node SQLite. Actual planner/composition flags are false. No external requests, uncaught page errors, or horizontal overflow occurred. Each flow contains 16 exact-byte PNG screenshots, sanitized readback, successful run log, and a manifest binding raw/public hashes. Root `summary.json` retains per-width facts; root `manifest.json` binds the flow manifests and ignored raw-attempt inventory hash.

| Flow | API outage | Fresh document result | Offline completion attempts |
| --- | --- | --- | --- |
| `full-api-outage/` | All `/api/` transport aborted | Existing registered-session verification gate; exact queue/cache retained | 2 |
| `partial-domain-outage/` | All `/api/` except actual `/api/v1/me` aborted | Actual session verification succeeds; cached Week UI completes again | 3 |

Both flows preserve one exact queued body/idempotency key and stock `2` during outage. Reconnect imports `6` once, producing stock `8`; one shopping import command, one run, one run-item, one additional inventory command/event. Native import updates the existing egg lot (`quantity_milli 2000 -> 8000`, version increment once), keeps lot count `5`, leaves unrelated lots unchanged. Exact replay returns `idempotentReplay: true` and changes neither authoritative inventory GET nor SQL facts.

The mobile final filtered screenshot makes quantity `8` visible; unfiltered full-page captures can include fixed navigation over the middle of the inventory list. PNG bytes are not cropped, re-encoded, or altered. Completion panel focus is checked by the browser harness.

Public readback retains exact synthetic outbox/cache strings and SQL evidence needed for durability checks. Cookie/session/token/storage-state fields and private absolute paths are removed. SQL `lock_token` values are excluded; raw/public readback and manifest hashes preserve provenance.

Commands executed locally:

```sh
export PATH='/opt/homebrew/opt/node@24/bin':"$PATH"
node .artifacts/takeover/wkd01/browser.mjs
node .artifacts/takeover/wkd01/browser-partial-domain.mjs
python3 .artifacts/takeover/wkd01/check-public-evidence.py
```

Failed attempts remain ignored and hash-inventoried: session-verification wait timing; full navigation under total API outage reaching the existing auth gate; an incorrect harness assumption that native import creates a new lot; an ambiguous `Trứng` locator when adding a filtered screenshot. The successful runs do not conceal these attempts. Initial three failed runs stored screenshots/diagnostics without incremental record payloads; later runs retain progressive facts.

Limits: synthetic transport abort while local assets/evidence controls remain available; Node SQLite adapter rather than Cloudflare workerd/D1; Chromium only. Partial domain outage keeps `/api/v1/me` online. No complete-network offline authenticated-rendering, physical-device, Safari, cross-tab transaction, hosted, or production claim. No app/auth/backend source changed for this browser evidence phase.
