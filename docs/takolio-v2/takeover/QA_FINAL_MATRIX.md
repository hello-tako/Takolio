# QA final matrix

| Area | Status | Evidence / limit |
|---|---|---|
| Recovery | PASS | 22,763 regular files /772 symlinks; original bytes/modes/links/HEAD/index/status match full private snapshot after9dad1494 |
| Main protection | PASS | Fresh read-only main90b94129; 5,845 paths outside explicit allowlist unchanged; zero failures |
| Lint/types/migrations/builds | PASS | Final lint/web+Worker types and targeted ESLint; local migration smoke; default and actual paired Vite builds; schema/dependencies unchanged |
| Shopping saved/edit/check/delete | PASS_BOUNDED | Actual local API fractions0.125/0.5, invalid guards, pending disabled, reload, keyboard/cancel and confirmed delete; inventory unchanged |
| Shopping offline projection | PASS_BOUNDED | Durable125.5g outbox item/device-pending label survives reload with server-empty GET; reconnect/flush and all conflicts untested |
| Shopping unknown review/retry/conflict | PASS_BOUNDED | Real commit followed by response loss; identical payload/key replay200/200 yields one0.5pack purchase; unknown aggregate unchanged; concurrent same-household revision produces409 and explicit reload |
| Shopping responsive/accessibility | PASS_BOUNDED | Separate mobile+desktop contexts; 88captures/zero-violation axe; 154enabled dialog controls reachable; 38incomplete contrast reports require manual review; seven before contrast failures retained |
| Shopping browser/focused tests | PASS_BOUNDED | Frozen4/4 browser;61unit +53integration tests; synthetic local household only |
| Planner continuation | RETAINED | Prior rows23-27; nine picker configs/36controls and2/2 browser;61payloads intact; incomplete contrast24/ARIA12 unresolved |
| Week compatibility | PARTIAL | Prior canonical ON redirect1/1 and synthetic OFF keyboard setup1/1; no fresh/full OFF/generation/dual-write certification |
| Recipe/cooking/saved/filter | RETAINED | Prior current101/filter28/saved56/detail66/cooking75 payloads and source-bound receipts intact; no fresh end-to-end rerun of those packets |
| 38-row mapping | CAPTURED_FOR_REVIEW | 37synthetic/one landing proxy; row28 refined; owner/pixel/full behavior acceptance pending |
| Full regression | PARTIAL | 410/412 files;9,163/9,168 tests in360.97s;five inherited encoded-space CLI path failures;no timeout in this run |
| Dependency security | OPEN_INHERITED | Audit1low/6moderate/1high;Vite GHSA-587h-7wmj-h5pm;dependencies unchanged |
| Manual/device/live/performance/production | NOT_CLAIMED | Screen readers, OS zoom, incomplete axe checks, full mutation/error matrices, physical devices, live providers, LCP/CLS/load and production remain open |

Shopping implementation: `9dad1494dab2719eb3f787ab161ab49748bd30d4`. Two CSS values plus new local E2E coverage. Final lint/types/browser cover committed source; builds/full suite use final product CSS before last E2E-only harness adaptations. Full UI continuation remains partial; next bounded baseline is notifications row29. Owner acceptance and publication/release approval remain pending.
