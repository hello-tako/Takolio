# QA final matrix

| Area | Status | Evidence / limit |
|---|---|---|
| Recovery | PASS | 22,763 regular files / 772 symlinks match private snapshot; original HEAD/index/status preserved after saved implementation |
| Main protection | PASS | Rechecked main `90b94129`; 5,846 paths outside explicit allowlist unchanged; zero failures |
| Lint / types / migrations / builds | PASS | Current default and paired builds; exact commands/logs in TEST_BASELINES.md |
| Focused family / favorites / manual drafts | PASS | Four files / 49 tests; final full suite also covers these files |
| Focused discovery / presentation / inventory | PASS | Four files / 88 tests; final full suite also covers these files |
| Saved + discovery browser | PASS_BOUNDED | Six final paired tests: persistence/search/removal/resave/reload, servings tabs/detail/empty planner handoff, discovery and keyboard |
| Default composition V1 browser | PASS_BOUNDED | Two persistence/tab tests; no V2 handoff claim for V1 |
| Saved responsive/accessibility | PASS_BOUNDED | Eight viewport/text settings, collection/dialog, 17 zero-violation axe reports, text bounds/44px buttons/20px close icon; root-font 200% only |
| Historical filter browser | PASS_BOUNDED | Eight combined tests at prior filter checkpoint; latest discovery tests repeated in final paired run |
| 38-row screenshot mapping | CAPTURED_FOR_REVIEW | 37 synthetic states + one landing proxy; full behavioral and owner/pixel acceptance pending |
| Full regression | PARTIAL | Final canonical TMPDIR and maxWorkers=4: 9,163/9,168; five inherited path failures. Initial: 9,159/9,168, plus four Admin timeouts that did not recur |
| Dependency security | OPEN_INHERITED | Prior audit: eight findings including high Vite GHSA-587h-7wmj-h5pm; unchanged dependencies, audit not rerun in saved packet |
| Week OFF / live integrations | NOT_CERTIFIED | Protected code retained; browser planner ON, mock AI and external fetch blocked |
| Screen reader / performance / production | NOT_CLAIMED | No full screen-reader, LCP/CLS/capacity, meal-mutation E2E or production certification |

Saved-recipes implementation is reviewable at `f11a244ca0964a63618c1fc3a3f30b8a670ec90a`; full UI-C5 remains partial. Next bounded local target is row 20 recipe-detail readiness, servings and cooking handoff. Owner visual acceptance and publication/release approval remain pending. Path-sensitive production test tooling and dependency remediation stay outside this UI scope. Current authorization covers further local UI continuation.
