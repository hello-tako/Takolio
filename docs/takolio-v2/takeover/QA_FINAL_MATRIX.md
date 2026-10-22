# QA final matrix

| Area | Status | Evidence / limit |
|---|---|---|
| Recovery | PASS | 22,763 regular files / 772 symlinks match private full snapshot; original HEAD/index/status preserved |
| Main protection | PASS | Latest main `90b94129`; 5,847 paths outside allowlist unchanged; zero failures |
| Lint / types / migrations / build | PASS | Exact commands and logs in TEST_BASELINES.md |
| Focused UI/API regressions | PASS | Final combined run: six files / 116 tests |
| Browser functional coverage | PASS_BOUNDED | Eight tests, including real local discovery/search/filter/pagination/removal, planner/upload/cooking, keyboard, reduced motion, axe and icon guard |
| Recipe filter responsive evidence | PASS_BOUNDED | Eight viewport/text-scale combinations, eight axe reports with zero violations, long-search wrap and 44px targets; root-font 200% test only |
| 38-row screenshot mapping | CAPTURED_FOR_REVIEW | 37 synthetic states + one landing proxy; no full behavioral or owner/pixel-match acceptance |
| Full regression | PARTIAL | Canonical-TMPDIR rerun: 9,163/9,168; five inherited path failures. Ordinary run: 9,151/9,168; extra temp-path failures and Admin timeout did not recur |
| Dependency security | OPEN_INHERITED | Eight findings, including high Vite GHSA-587h-7wmj-h5pm; dependencies unchanged |
| Week flag OFF / live integrations | NOT_CERTIFIED | Protected code retained; browser fixture uses planner ON and mock AI; no live OTP/AI certification |
| Performance / production readiness | NOT_CLAIMED | Build verified; no packet-specific LCP/CLS/capacity or production certification |

The local recipe-filter refinement is reviewable at `89b0a331`. UI-C5 as a whole remains partial; saved-recipe behavior is the next bounded verification target. Owner visual acceptance and publication/release approval remain pending. Production test-path tooling and dependency remediation remain outside this UI scope. Current user authorization covers further local UI work.
