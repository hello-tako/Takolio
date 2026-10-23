# QA final matrix

| Area | Status | Evidence / limit |
|---|---|---|
| Recovery | PASS | 22,763 regular files / 772 symlinks; original bytes/modes/links/HEAD/index/status match full private snapshot after 30693884 |
| Main protection | PASS | Read-only main 90b94129; 5,845 paths outside explicit allowlist unchanged; zero failures |
| Lint/types/migrations/builds | PASS | Final source lint/web+Worker types and targeted ESLint; unchanged schema; default and actual paired Vite flags build |
| Planner setup/generation/reload | PASS_BOUNDED | Real isolated API; blank-day validation, pending disabled, single create, seven intended slots/revision1 and DTO reload persistence |
| Planner manual/picker/revision | PASS_BOUNDED | One-day draft; keyboard focus/Shift+Tab/Escape; role/cuisine controls; real component add revision1->2 and reload; inventory unchanged |
| Planner shopping share | PASS_BOUNDED | Three-day trip with expected revision; saved shared list survives reload; no physical stock change |
| Planner responsive/accessibility | PASS_BOUNDED | Nine picker configs/36 reachable controls; three configs across five other states; 24 zero-violation axe; incomplete contrast24/ARIA12 require manual review |
| Planner browser/units | PASS_BOUNDED | 2/2 final browser in 38.3s; 4 files/43 focused units; local synthetic household only |
| Week compatibility | PARTIAL | Canonical ON redirect1/1 and synthetic OFF keyboard setup1/1; no full Week-OFF/generation/dual-write certification |
| Recipe quantity/readiness/handoff | RETAINED | Prior exact servings1/2/4/20, reload20, manual setup handoff4 and inventory boundary; no fresh recipe run in this packet |
| Cooking handoff/timer/confirmation | RETAINED | Prior servings4, timer/exit, actual-use guards and committed-response-loss replay; cooking75 payloads intact |
| Earlier saved/filter/detail evidence | RETAINED | 56 saved / 28 filter / 66 detail payloads intact; their results remain historical |
| 38-row capture mapping | CAPTURED_FOR_REVIEW | 37 synthetic/one landing proxy; owner/pixel/full behavior acceptance pending; planner rows23-27 refreshed |
| Full regression | PARTIAL | Full404/412 files; 9,157/9,168 tests in466.01s; five inherited path failures plus six timeouts; failed subset413/418 with all six timeout cases passing; no full-suite PASS |
| Dependency security | OPEN_INHERITED | Audit1 low/6 moderate/1 high; Vite GHSA-587h-7wmj-h5pm; dependencies unchanged |
| Screen reader/performance/production | NOT_CLAIMED | Physical devices/OS zoom, manual axe incomplete checks, full mutation/constraint matrices, live providers and LCP/CLS/load/production remain open |

Current implementation: `30693884c3b66ebe3d4fcd48fb57100853703826`. Final browser/static/build checks cover committed source; the full suite preceded final picker CSS specificity correction. Full UI continuation remains partial. Next local baseline: saved shopping row28 using existing UI06/T24 contracts. Owner acceptance and publication/release approval pending; inherited protected tooling/dependency fixes stay separate.
