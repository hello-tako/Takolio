# ADR-B08-TW-001: Evaluate, then decide the remaining owner migration

Status: minimal major candidate REJECTED; discovery completed locally.
Supersedes no runtime ADR. Base receipt b9612d199bbad57efbe71a423ab97b41fab8f3af.

The remaining high braces advisory has no patched published version in earlier
registry evidence. Tailwind 3 consumes braces through several glob/watch owners;
forcing a chokidar major is not a compatible fix. The user authorizes sequential
local work, including a separately scoped major-upgrade feasibility check.

Use the official Tailwind 4.3.3 PostCSS owner in a private copy. Preserve current
theme via supported @config, constrain source discovery explicitly, and compare
actual CSS behavior against the current compiler. No unreviewed major upgrade,
unsafe transitive override, waiver, suppression or renamed fake patch is accepted.

The final decision must state measured incompatibilities, browser requirements,
new native dependencies, exact package graph/audit status, a bounded migration
sequence and release/rollback acceptance. The accepted prior implementation and
its receipts remain authoritative until a later reviewed migration passes.

Measured decision: corrected official candidate builds and removes the affected
graph, but20/20 actual-route computed comparisons and15/20 visible pixel pairs
change; six state pairs also change. Keep it private and unpromoted. The accepted
local mitigation and its strict retained audit gate are in ADR-B08-BRACES-001.md;
MIGRATION_PLAN.md specifies the future compatibility/browser/toolchain work.
