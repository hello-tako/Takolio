# QA final matrix

| Area | Status | Evidence / limit |
|---|---|---|
| Recovery | PASS | 22,763 regular files / 772 symlinks and original bytes/modes/links/HEAD/index/status match full private snapshot after 6276a6b9 |
| Main protection | PASS | Read-only main 90b94129; 5,846 paths outside explicit allowlist unchanged; zero failures |
| Lint/types/migrations/builds | PASS | Final source lint/web+Worker types and targeted ESLint; unchanged schema; default and actual paired Vite build flags pass |
| Recipe quantity/readiness | PASS_BOUNDED | Exact servings 1/2/4/20; reload 20; real isolated API inventory unchanged |
| Recipe planner handoff | PASS_BOUNDED | Existing manual-first setup retains recipe + servings 4; no stock write |
| Recipe responsive/accessibility | PASS_BOUNDED | Prior eight viewport/text settings; three tabs/dialog; 24 zero-violation axe; whole words/text bounds/44px actions; keyboard/focus |
| Cooking handoff/exit/review | PASS_BOUNDED | Detail4->cook4->reload->exit->detail4 plus review->cook4->reload; six eggs; zero write requests; zero-step fallback not independently exercised |
| Cooking timer/confirmation | PASS_BOUNDED | Wall-clock pause/resume/expiry/reset/step clearing, exit cancel/focus, actual-use guards, explicit confirm and committed-response-loss same-key replay; empty completion recovery |
| Cooking responsive/accessibility | PASS_BOUNDED | Eight viewport/text settings across cooking/exit/review/saved; 32 zero-violation axe; no overflow/broken images/control text clipping; whole words/44px heights |
| Final cooking+detail+culinary browser | PASS_BOUNDED | 10/10 paired in 1.7m; 4/4 default-V1 cooking subset in 21.8s; synthetic local inventory only |
| Earlier focused regression | PASS_SUPPORTING | Prior 27 unit / 69 integration transcript-only; full suite includes their files |
| Earlier saved/filter/detail evidence | RETAINED | 56 saved / 28 filter / 66 detail files, manifests intact; their recorded results remain historical |
| 38-row capture mapping | CAPTURED_FOR_REVIEW | 37 synthetic/one landing proxy; owner/pixel/full behavior acceptance pending |
| Full regression | PARTIAL | 410/412 files; 9,163/9,168 tests; 447.30s; five inherited encoded-space CLI path failures; no Admin timeout this run |
| Dependency security | OPEN_INHERITED | Repeated audit 1 low / 6 moderate / 1 high; Vite GHSA-587h-7wmj-h5pm; dependencies unchanged |
| Week OFF/live integrations | NOT_CERTIFIED | Protected code retained; browser planner ON, mock AI/external fetch blocked |
| Screen reader/performance/production | NOT_CLAIMED | Physical-device/OS zoom, speech/background alarm, full meal-mutation E2E and LCP/CLS/load/production certification remain open |

Current implementation: `6276a6b929304c1c207b3355c3827fdd762ef287`. Full UI-C5 remains partial. Next local baseline: planner rows 23-27 using existing UI06/current contracts. Owner visual acceptance and publication/release approval pending; inherited tooling/dependency fixes stay separate.
