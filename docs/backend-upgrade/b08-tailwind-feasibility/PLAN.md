# B08 remaining dependency: bounded Tailwind 4 feasibility

Status: IN_PROGRESS. Date: 2026-10-12 JST.
Base: b9612d199bbad57efbe71a423ab97b41fab8f3af.
Branch: codex/backend-b08-tailwind-feasibility.

## Outcome and scope

Decide whether the remaining braces advisory can be removed through a compatible
published owner patch or a minimal Tailwind 4 candidate without changing the
established UI. This is an executable local discovery packet, not an accepted
major upgrade. Historical evidence remains bound to its recorded source.

Root owns this packet and new state prefixes only. No application, package/lock,
workflow, applied migration, runtime identity, catalog, payment/authentication,
provider activation or public asset mutation is included. Candidate installs,
source copies, CSS and browser output stay private and outside runtime authority.
Do not invoke remote D1/R2, real email, paid AI, deploy, push/PR/merge or settings.

## Assumptions and dependencies

The last locally verified implementation is 41da180a. Fresh npm/GitHub metadata
may invalidate earlier dependency conclusions and must be retained. Node 24,
pnpm 10, installed Chromium, PostCSS and sharp are available locally. Browser
fixtures use the repository's isolated preview and block external traffic.
No owner browser-support decision or hosted Linux/native acceptance exists.

## Sequence and acceptance

1. Recheck official registry owner releases and the exact braces advisory. Retain
   timestamped bounded metadata, actual full/production audits and failures.
2. Create a private source copy outside the repository. Pin Tailwind and its
   official PostCSS owner at 4.3.3; retain the existing JS theme through @config
   and explicit sources. Remove only obsolete owner overrides. Install the
   candidate, freeze its lock and build it with matching inputs. Record the exact
   candidate diff, graph and all changed package resolutions; never promote it
   automatically. Candidate audit must actually remove the affected owner graph.
3. Compare baseline/candidate generated selectors and actual browser computed
   styles, geometry and pixels on representative existing mobile/desktop flows,
   including auth, stock, planning, scan and account. Keep app/data/flags identical;
   isolate CSS replacement to diagnose compiler/cascade differences. A passing
   build or zero audit alone is insufficient. Concrete regressions reject the
   minimal candidate and yield a decision-complete migration plan.
4. Review browser support/native-toolchain/release/rollback implications. Record
   a go/no-go ADR with measured evidence. If the candidate fails, preserve current
   runtime bytes and the failing security gate; document exact remediation units
   and their measurable acceptance instead of claiming the major upgrade complete.
5. Run required canonical local gates, review protected Git blobs, update state,
   board/handoff and implementation plan, create a coherent local checkpoint and
   scan that actual SHA. Export only bounded privacy-reviewed evidence.

## Risks and fallback

Tailwind 4 native layers can reorder existing unlayered kitchen styles; defaults
and variant semantics can change even with @config. Modern CSS raises browser
requirements; Rust/lightningcss introduces native install requirements. Fail
closed on discovered incompatibility. Rollback for this discovery consists of
stopping use of the private candidate; no data or runtime change is applied.
If a later migration is warranted it needs its own accepted ADR, compatibility
edits and full behavior/device/hosted acceptance, preserving all release gates.

External real corpus/labels, provider charge/pricing/privacy, human ingredient
review, protected billing, inbox/staging/SLO/release gates remain prerequisites;
fixtures and discovery do not certify them.

## Measured decision and bounded follow-up

The corrected minimal candidate builds/audits but fails actual CSS compatibility.
See ADR-B08-BRACES-001.md for the narrowly extended package/lock/test ownership:
apply and verify a fixed nesting guard as a local mitigation, retain the full
high advisory and reject the incompatible major candidate. The final result must
separate mitigation verification, major-migration rejection and release blockers.
The original freeze remains in force outside those exact new paths.
