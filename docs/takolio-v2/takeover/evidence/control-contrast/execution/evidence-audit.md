# C12/C13 local evidence audit

Audit time: 2026-10-23T23:20:10Z (2026-10-24 JST).
Workspace: `/Users/tunbee27/Documents/New project/Takolio-v2-codex-integration`.
Observed HEAD: `c50c737d97e4385db90fa9e8a05fb8fbc832edb4`.

Scope: read-only inventory of baseline evidence, runner/source provenance, failed
attempts and minimum review evidence. Only this ignored index was written. No
source, public report, existing receipt or existing payload was rewritten.
`git check-ignore -v` confirms `.gitignore:8:.artifacts/` applies to this index.
C12 rerun remains parent-owned; this index does not claim it passes.

## Canonical baseline index

All paths in this section are relative to `.artifacts/takeover/control-contrast/`.

| Directory | Meaning | Contents | Verification |
|---|---|---|---|
| `settled-2026-10-23T225813253Z/` | C12 baseline before ADR-064 | 22 sampled controls, 66 state observations, 44 PNG, assessment, measurement, receipt | 46 receipt payloads plus 2 external supplements: 48/48 exist, byte lengths match, SHA-256 match. |
| `boundary-2026-10-23T231041454Z/` | C13 canonical boundary diagnosis | 4 viewport/text configs, 16 pages, 44 controls, 88 normal/focus observations, 32 raw PNG, 3 contact sheets, 7 JSON | Original receipt: 34/34 payloads match. Supplement: 6/6 payloads and 3/3 runners match. Original receipt binding matches. |

C12 receipt SHA-256:
`b5bd50f35548fdde0c076926c1c4f54ec03a917c14c11228eefd6678ce2be6a3`.
C13 original receipt SHA-256:
`b4a68b2cd1f36e8ec6425d5dbe2ec2d1e6d874ae8aa7199ecb995faf7aca6caa`.
C13 supplementary receipt SHA-256:
`39dd047adcb5fffe4b507489a985ce0fd138813642c57d677875b35e8a9f1943`.
These are observations of existing receipts, not replacement receipts.

C12 evidence addresses discovery, saved recipes, stock, shopping, notification
switches and sampled planner/detail/account controls. Family dislike/exclusion
search fields were hidden during the canonical runner; `supplement.json` contains
normal computed observations only. No family baseline focus/hover PNG claim.
`stock-focus.json` separately confirms the settled stock search keyboard state;
`stock-search-keyboard-focus.png` duplicates the receipt-bound stock focus image
byte-for-byte (SHA-256 `6f56a4cab71459260ba081a677df1389dbe408e18763d4137a23a4ddd9e7f919`).

C13 configs: 320x568 text1, 320x420 root-font200, 390x844 text1, 1440x1000 text1.
Canonical measurement records HEAD
`6bf58f3a0d7c0909b777958fa9cdd5fda4426ddc` and identical before/after hashes of
7 source files. Those same 7 files still matched at this audit; this does not bind
the later C12 patch in `kitchen-upgrade.css`, which is outside that 7-file list.

## Source and runner index

| File | Role | Bytes | SHA-256 |
|---|---|---:|---|
| `audit.mjs` | Settled C12 browser collector | 7605 | `4d5c775995ffc5bdc619c253972634d848646ac5c7978ab7cc45abea699e710b` |
| `assess.mjs` | C12 assessment/composition | 5833 | `dfd1a15e6d11576cebea2974fc50dd3bc752ae017c877a43bb15050543679740` |
| `supplement.mjs` | C12 family/background supplement | 2966 | `d851e8ab9d109ca478fea7b3c600178449700f93c419e98d3381d6b8e401306e` |
| `stock-focus.mjs` | C12 settled stock focus supplement | 1946 | `9a4038d11f45c7097405574505521740a70e1499f56f812c83f4ada4e1a9498e` |
| `boundary.mjs` | C13 canonical collector | 10701 | `0ed57dd002670e808edc1f090710d2791b575527615ecb7efcd0090426a7742e` |
| `boundary-contact.mjs` | C13 contact sheets | 1313 | `11bc1f41db087a17afd4048afab16e5f86c741edc5994cf57918e8a65f725ca5` |
| `boundary-finalize.mjs` | C13 source/manual/failed-attempt supplement | 6463 | `6cf69a7b0b54d450dca3078c887aef198cdfbc791f69da325d09c1253486a811` |

C12 receipt binds collector/assessor hashes; supplement runner hashes above are
current observations, not hashes retroactively claimed as captured at execution.
C13 supplementary receipt binds all three C13 runner hashes.
`run-browser.py`, `test-final.ts`, `controls.e2e.ts.pending` and
`controls.e2e.ts.corrected` are parent-owned C12 working snapshots/helpers;
the authoritative intended test is
`tests/e2e/t17-ui/takolio-control-contrast.e2e.ts`. Do not mistake working copies
for a passing run or freeze their hashes while parent is still correcting setup.

C13 source list: `kitchen-daily.css`, `kitchen-planning.css`,
`kitchen-foundation.css`, `kitchen-family.css`, `takosan-tokens.css`,
`ShoppingPage.tsx`, `PlannerSetup.tsx`. Full paths/hashes remain in canonical
`measurement.json` and `source-review.json`.

## Failed and superseded attempts

| Location | Status | Preserved evidence | Integrity and caveat |
|---|---|---|---|
| `run-2026-10-23T225249450Z/` | Superseded early C12 collection | 18 records, 36 PNG, measurement JSON | No original receipt or exact earlier runner revision retained here. Measurement SHA-256 observed now: `b74702799ff299088ce0da7287e5e988bfd91e4ad310b914d5b6a7a584ab87e3`. Use settled run for conclusions. |
| `boundary-2026-10-23T230829292Z/` | Failed C13 attempt | 5 partial PNG | 5/5 hashes/bytes match `failed-attempts.json`; mobile shopping disclosure unopened. No complete original failed runner/stdout provenance. |
| `boundary-2026-10-23T230921207Z/` | Failed C13 attempt | 29 partial PNG | 29/29 hashes/bytes match `failed-attempts.json`; empty `open` attribute misread, desktop disclosure closed. Same missing runner/stdout limitation. |
| `c12-after-1/` | Failed C12 test attempt | 6 PNG, 2 error-context MD, 2 traces, `.last-run.json`; external log and command receipt | Receipt exit1; log SHA-256 `11c553e9cabd6f05c70f70f4952c72f8aaf6a6174bdfe36318829b5107d59b56` matches. Family fields hidden under details; test setup correction parent-owned. Receipt binds log only, not all Playwright payloads. |

No old receipt was regenerated. Failed-attempt directory names remain unchanged.
The failed folders are diagnostic evidence; they do not certify a product defect
or an accepted patch. This index is a point-in-time snapshot; later C12 attempts
must receive distinct output directories and receipts.

## Findings and practical limits

- C12 baseline: discovery/saved/shopping/family placeholders about 2.41-2.54:1;
  notification OFF track/white thumb 1.768:1. Stock placeholders already pass.
  ADR-064 narrows the correction to actual affected controls.
- C13 baseline: 44/44 normal/focus rectangles equal, 0/16 horizontal document
  overflow, zero monitored API writes/external requests/browser errors. The
  7 sampled source hashes remain equal before/after canonical collection.
- Missing `--semantic-border-rgb` yields 0px/none computed border on the 11
  target controls. Fill-only distinction is about 1.00-1.06:1. Proposed scoped
  inset stroke is a recommendation; no runtime candidate was applied/tested.
- Fixture reset/login occurs before mutation monitoring. No domain action was
  submitted by the audit. Local preference changes during later C12 tests must
  be distinguished from server/domain writes.
- C12 baseline is desktop1440x1000; planned after-test desktop1440x900 is not an
  exact screenshot comparison. Family baseline has normal computed data only.
- Full-page fixed navigation can appear in artificial mid-document positions.
  Contact sheets support appearance review; they do not certify occlusion.
- Root font-size200 is synthetic enlargement, not native zoom. Targeted focus
  does not certify full Tab traversal. No Safari/device/screenreader/owner or
  hosted-release certification. Home redirects to onboarding; no bypass used.

## Minimum review evidence to publish

Recommended destination: tracked `docs/takolio-v2/takeover/evidence/` alongside
existing takeover evidence. Runtime `public/` does not need audit files. No
publication, copy, source change, or report change was performed in this task.

1. Publish the final C12 report and ADR-064 reference with actual test command,
   exit status, source/test hashes, test counts, ratios and explicit limitations.
   Preserve failed attempt1 in the history as failed.
2. Publish both project summaries from the successful C12 run. The test itself
   loops all 3 configs, so two projects give duplicate viewport coverage under
   distinct Playwright contexts; do not claim six unique devices.
3. Publish representative baseline/after PNG for affected controls, plus the
   3 C13 baseline contact sheets if C13 diagnosis is referenced. Label viewport
   mismatch and normal-only family supplement; no fabricated paired baseline.
4. Publish a new selective manifest containing only the selected copied payloads,
   their original relative source paths, byte lengths, SHA-256, canonical source
   receipt SHA-256, test/runner hash and evidence limitations. Keep original
   full receipts byte-identical; a selective manifest is not a replacement.
5. Retain full canonical baseline/run outputs and failed attempts privately.
   Full C13 receipt lists 34 baseline payloads, supplementary receipt lists 6;
   copying only selected evidence must not imply the omitted files were shipped.

The minimum acceptance evidence for the C13 implementation is still outstanding:
ADR/scope, actual minimal CSS patch, before/after geometry and contrast checks,
keyboard/hover/disabled considerations, browser screenshots and zero-write
verification. C13 diagnosis alone does not close that task.
