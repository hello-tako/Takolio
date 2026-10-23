# Profile row30 QA update - 2026-10-23 JST

| Area | Status | Evidence / limit |
|---|---|---|
| Existing account presentation | PASS_BOUNDED | One notification metadata correction; existing UI08 assets/components retained |
| Registered and guest identity | PASS_BOUNDED | Actual isolated local sessions; `/profile` alias; guest fallback; long cached identity explicitly shaped |
| Navigation and protected targets | PASS_BOUNDED | Six keyboard destinations/back; registered/guest Plus href preserved without activation; destination forms not certified |
| Logout dialog | PASS_BOUNDED | Registered focus/Tab/Escape and guest keyboard cancel; no actual logout commit |
| Session loading/error/retry | PASS_BOUNDED | Held real GET and shaped HTTP500; private profile hidden; keyboard retry recovers local API |
| Reflow and keyboard | PASS_BOUNDED | 48 final state/config captures; 192 actionable measured account-link/dialog controls; root-font simulation |
| Accessibility and owner review | OPEN_MANUAL | 48 axe reports zero violations; 48 incomplete contrast checks; owner review PENDING |
| Full regression and dependencies | PARTIAL | 9,163/9,168 tests; five inherited CLI path failures; audit 1 low/6 moderate/1 high |
| Live/device/performance/production | NOT_CLAIMED | Physical devices, screen readers, OS zoom, full Week-OFF, providers and production remain open |

Implementation `6cb0d462813482b8137d975b207d8b530fc55776`; exact commands and evidence in `UI_C7_PROFILE.md` and `evidence/profile-checks.json`. Next bounded packet: row31 household/family baseline.

---

# Notifications row29 QA update - 2026-10-23 JST

| Area | Status | Evidence / limit |
|---|---|---|
| Notifications content/reflow | PASS_BOUNDED | One scoped title/body wrap rule; nine before overflow captures and 60 settled after configurations across mobile/desktop |
| Real local notifications | PASS_BOUNDED | Native inventory + shopping reminder DTOs match cards; no writes; inventory/shopping unchanged |
| Loading/error/empty/offline honesty | PASS_BOUNDED | Held GET, HTTP500 with three attempts, keyboard retry, explicit empty and network abort states |
| Device-local preferences | PASS_BOUNDED | Keyboard Enter/Space, owner-scoped reload persistence; preference does not filter inbox |
| Accessibility | OPEN_MANUAL | 60 axe reports zero violations; all retain incomplete color-contrast checks; owner review pending |
| Delivery/production | NOT_CLAIMED | No push permission/background/live provider/production certification |

Implementation `8c1ad40ec5e63587c8b3b2900d0e683b35a3c794`; detailed evidence in `UI_C8_NOTIFICATIONS.md`. Earlier matrix entries remain below unchanged.

---

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
