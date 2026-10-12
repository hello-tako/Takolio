# ADR - Preserve an unchanged fully deployed D1 catalog across an application release

2026-10-12 JST. Authorized integrated release deployment failed in run 38206476316
before recovery upload, application upload or traffic mutation. Migration 0040 had
already succeeded. The transition guard rejected d1 -> d1 solely because the new
application SHA differs from the deployed ancestor. Restarting at shadow would
replace the established 500-recipe D1 authority with the static baseline.

Permit only production d1 -> d1 continuity when protected current evidence proves
complete healthy D1, the previous active 100% version and canonical D1 binding match
its commit, that commit is an ancestor, and reviewed release identity/content and
catalog selection/hydration source bytes remain identical. Pin the source dependency
set in the release checker, including shared schemas, static baseline, import release
parser and reader. Verify the root Zod specifier/resolution as well. Unavailable
files/proofs, drift, changed source, a different release/fingerprint, a sibling/older
commit, canary continuation or promotion still fails closed under existing policy.

The trusted workflow computes this proof from Git and provider/version/protected
runtime evidence; no operator-supplied bypass flag or manifest boolean is added.
Pre-deploy D1 ledger/integrity/runtime fingerprint gates, current-main/exact-SHA CI,
Environment review and strict OTP recovery remain required. Record previous authority
proof to classify edge convergence only; previous-SHA responses remain unacceptable
as final deployment proof. This narrowly supersedes the per-SHA restart rule only
for the unchanged final D1 state. Any catalog/reader/router change retains the
existing reviewed shadow/canary progression. No runtime code or catalog data changes.

Add positive continuity and adversarial source/version/binding/content/ancestry tests,
verify the CLI using real Git history, then normal protected PR/main CI and same-SHA
staging verification precede a new production dispatch and Environment review.
Retain the failed deployment receipt and the successful 0040 migration; do not
reapply the migration or label the failed run successful.
