# B08 local remediation execution packet

Date: 2026-10-12 JST. Status: LOCAL_IMPLEMENTATION_PREPARED_FINAL_GATES_PENDING.
Base: `2c42984b2839d1b03c3b0ccfb89998d3535a48d8`.
Branch: `codex/backend-b08-local-remediation`.
The verified program receipt remains immutable on the parent branch.

User scope is sequential completion of the available local plan. This packet
continues relevant reversible security/toolchain work; source freeze is evidence,
not an instruction to defer executable local fixes.

## Sequence and ownership

1. Privately adjudicate each of the 16 Gitleaks candidates from actual source
   provenance. Publish hashes, categories, reasons and limits only; retain engine
   findings without blanket suppression. Check parser compatibility by a minimal
   assertion-preserving TSX test refactor and the pinned Semgrep engine.
2. Upgrade direct dependency owners to concrete patched compatible versions,
   recording official registry metadata and before/after package/lock hashes.
   Preserve React 18, Vite 6 and Tailwind 3 when compatible. Migrate Vitest pool
   options deliberately; no arbitrary major transitive overrides.
3. Validate frozen install, lint, types, full tests, migration smoke and sequential
   build. Rehearse local D1 and consumed Wrangler contracts with local resources
   or captured fixtures; no fallback remote operation. Verify native decoding,
   client navigation/auth aliases and offline/build behavior appropriate to changes.
4. Run fresh full/production audits and the pinned scanner selftests/repository
   scan. Remaining findings stay explicit; no suppression, exception or security
   certification is inferred. Obtain independent review and a clean checkpoint.

Root owns package/lock, relevant Vite config, new packet receipts and state docs.
The scanner lane owns the parser test, PNG reproducibility compatibility and
bounded triage/probe documents.
A workflow lane hardens the existing action pins/credential/cache/SHA input surfaces
and reviews compatibility independently. A scanner lane adds bounded native,
D1 persistence and browser probes. Root schedules shared Vite caches sequentially.

Protected: PayOS/payment/billing/checkout/webhooks, 40 applied/local migrations,
catalog/data authority, provider activation, runtime date/bindings/resource IDs
and unrelated auth. Existing workflow edits
are narrowly scoped by ADR-B08-LOCAL-001; all exact-SHA/main/approval/migration/
rollback gates remain. No remote D1/R2 writes, deploy, paid provider, actual email,
push, PR, merge or account settings changes. The security workflow candidate remains
under docs; hosted acceptance is still required for workflow/release certification.

## Acceptance and limits

Count every observed audit finding; do not relabel known counts as exploited
vulnerabilities. Owner updates must remove their audited graph or document an
actual blocker. Parser coverage must include the same intended source set.
Preserve every payment assertion, existing tenancy/stock/quota and release gate.
No numerical SLO, real dataset label, human source review, inbox delivery or edge
behavior may be fabricated from local tests. Provider budget/storage/data cutover
still depends on the previously recorded real evidence gates.

Historical program receipts bind their recorded implementation, not changed
current files. Verify them at their recorded receipt commit. New receipts will
bind this packet's implementation and its protected delta separately.
