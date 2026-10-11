# B08 dependency mitigation and measured migration decision

Status: LOCAL_MITIGATION_VERIFIED_WITH_BLOCKING_RELEASE_GATES.
Implementation: 30f1630b63c782de9e6fd37d8726cdadae0fffea.
Application patch commit: 0f52b1963c1b2075ba2d47f4cd05b3c4b3d6a495.
Base receipt: b9612d199bbad57efbe71a423ab97b41fab8f3af.
Branch: codex/backend-b08-tailwind-feasibility.
Canonical worktree: /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

## Delivered

Fresh official metadata still has no patched published braces version. This packet
implements an owned pnpm patch of braces3.0.3: fixed128 parser-container depth and
bounded compile/expand/stringify recursive child walking, including direct imports.
The next container is rejected before allocation; caller options cannot disable
the bound. Escapes/quoted/bracket literals retain their original interpretation.
All direct/transitive versions, owner semantics and existing overrides stay intact.

59 meaningful regression tests cover strings below the upstream10000-character
limit, mixed braces/parentheses, unbalanced/boundary/literal patterns, programmatic
ASTs/direct imports, original ranges and actual micromatch/chokidar owner resolution.
756 differential method/pattern/option comparisons against the integrity-verified
published tarball have0 mismatches. A fresh offline frozen install outside the
repository yields all7 installed JS files byte-identical to the reviewed patch.

Unpatched4000-container strings return on default Node24 here; the first control's
contrary assumption fails and is retained. Explicit512KiB child stacks reproduce
6 unpatched walker stack-exhaustion cases; default and constrained children yield
12 controlled patched rejections. This is bounded host/string/AST recursion proof,
not a claim of default-host crash or all CPU/memory/getter/parent-graph protection.

## Major candidate decision

An isolated official tailwindcss/@tailwindcss/postcss4.3.3 copy removes braces,
chokidar3/micromatch/fast-glob and both audits report0. Its437 declared packages
replace460 (55 removed/32 added); frozen install/build succeed. The initial import
ordering produced warnings/dropped kitchen imports and was corrected before final
compatibility checks. The corrected CSS is147930bytes versus134861 baseline.

The minimal candidate is REJECTED for application promotion. Same real application,
fixtures and DOM are measured with only its compiled CSS replaced:20 actual-route
pairs at390/1280px all differ in compared computed styles,15 change viewport pixels.
Six actual auth focus/hover/forced-color pairs also differ. All26 final baseline
recovery controls are exact, with0 page errors/forbidden API writes; external
traffic is blocked. The first unsettled pixel control and earlier fallback-route
probe are retained, with nominal registration/home labels corrected to actual
/auth?mode=register and /onboarding/household in the accepted final probes.

Visible planning-form padding/radius/background, auth spacing and scan appearance
regressions explain why build/audit success is insufficient. Some computed shadow/
radius/border differences are invisible serialization/default changes; the count
is not a claim that every difference is visible. Screenshots were inspected locally.
MIGRATION_PLAN.md specifies deliberate cascade/default/theme/browser/native fixes;
Safari16.4/Chrome111/Firefox128 floor and Linux native acceptance remain unestablished.
No product stylesheet/config, JSX, brand, public asset or browser-support policy changes.

## Final executed gates

On clean committed implementation30f1630b:313files/7582tests PASS; full command
156.645s. Focused recovery/final3files/152tests PASS (59 new dependency tests).
Frozen install, lint, both TypeScript projects,40-migration smoke and sequential
production build PASS. Fresh offline frozen install also PASS. No new remote D1
or hosted/browser/device certificate is claimed from this dependency-only patch.

CSS remains exact134861bytes/SHA256
796ca21e25b5dbfbf13ea2b3f70faed3f388d7c231d3cb00c056c77341cf4fef.
Service worker token binds the actual implementation.4564 protected base-tracked
files are exact; only seven base package/lock/state paths change, plus the owned
patch/test/new packet. All40 migrations, product src/packages/public, workflows,
Worker/config/date/bindings/resource identities/catalog/payment/auth/provider
activation and the original user checkout remain untouched.

The first full run retains2files/11 failures: missing TMPDIR pin caused /var vs
/private/var production receipt path assertions. Set the prior canonical
TMPDIR=/private/tmp; no assertion or production security behavior changes. Earlier
transitional docs/source receipts are preserved and do not certify clean source.
Other retained diagnostics: missing YAML helper, original control assumption,
import-order warnings, pixel drift, fallback-route classification and generated
patch diff-context whitespace warnings. Applied library bytes and the remaining
Git diff pass review; the pnpm artifact is not altered to hide standard context.

## Security and acceptance limits

Full audit still1HIGH; production0. Published GHSA-vfj7-8cjw-p6xm still matches
version3.0.3 despite the owned guard. No advisory suppression, version spoofing,
waiver or complete-security claim is added. Release gate remains FAILED.

The clean implementation scan snapshots4557files:853/853 Semgrep sources with
0errors/0findings;17 Gitleaks candidates have exact unchanged source/candidate/
provenance and0 unresolved in that captured set;2 normalized HIGH zizmor cache
findings remain; Syft518 declared library components stay unchanged. Raw gate exit1
is retained. Scanner engines/selftests are unchanged from their historical pinned
receipts. No Git-history/credential-validity/installed-binary/license certificate.

The bounded packet retains39 command metadata/log hashes and9 reviewed attachments;
raw command logs, scanner reports/snapshots/pointers and private candidate copies
stay ignored. The final documentation SHA needs its own retained scan/reconciliation
and postcommit verifier; do not reuse this implementation scan as later release proof.

The masterplan is not production-complete. Real OCR/independent labels, provider
bounds/pricing/privacy/retained-charge evidence and paid-run budget, human ingredient
review/four data blockers, protected billing, controlled inbox/hosted/staging/edge/
load/chaos/SLO/alerts/retention/access/rollback/release gates remain open. No remote
write/deploy/mail/paid AI/push/PR/merge or account setting occurs. The next actions
are in NEXT_ACTIONS.md; prior receipts remain immutable at their exact source.
