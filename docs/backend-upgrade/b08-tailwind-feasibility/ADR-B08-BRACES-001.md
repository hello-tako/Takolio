# ADR-B08-BRACES-001: Bound the known recursive nesting failure locally

Status: accepted for a bounded local mitigation; release gate remains FAILED.
Base receipt b9612d199bbad57efbe71a423ab97b41fab8f3af.

The minimal official Tailwind 4 candidate removes braces and passes both audits,
but real paired CSS-only application probes reproduce layout/color/focus changes.
It is not accepted into the application. The registry still has no braces patch.
A separate local mitigation can protect the actual installed Tailwind 3 owner
without changing its glob-watch owner semantics or rewriting the UI.

This addendum supersedes PLAN.md's initial package/lock freeze only for a pnpm
patch of braces 3.0.3. Root owns patches/braces@3.0.3.patch, the generated pnpm
patchedDependencies/lock hash and focused dependency regression tests. All other
package versions/overrides, product sources/config/public bytes/workflows/data/
40 migrations/payment/auth/provider authority remain unchanged.

Reject parser nesting before pushing the 129th AST container, counting braces
and parentheses together. The fixed bound cannot be disabled through options.
Add the same fixed recursive-depth checks to compile, expand and stringify for
programmatically supplied ASTs, including direct lib imports. Existing shallow
patterns keep the upstream output/errors and rangeLimit behavior. The patch does
not promise protection against all CPU/memory exhaustion or adversarial getters/
malformed AST parent graphs. It addresses the published recursive-depth failure
on string input and ordinary deep AST child chains only.

Use reproducible pnpm patchedDependencies, keep upstream version/license/name,
and test installed direct/transitive consumer paths against deeply nested braces,
parentheses, mixed containers, escapes/quotes/bracket literals and boundary cases.
Retain an isolated unpatched control showing stack exhaustion. The audit remains
high because the published version is unchanged; do not add ignore/waiver/version
claims or bypass the failed gate. This is an owned local mitigation, not an
upstream patch/security certificate or permission to release.

Acceptance: deterministic bounded error before host stack exhaustion, unchanged
shallow upstream behavior, actual Tailwind/glob consumers use the patched bytes,
frozen install/lint/types/full tests/40-migration smoke/build and exact CSS parity.
Retain all failures, verify protected files and patch bytes on clean committed
source. Rollback must not reintroduce the known failure: retain this reviewed
patch or select a later verified patched owner. Migration to Tailwind 4 remains
separately gated by actual UI/browser/toolchain compatibility.
