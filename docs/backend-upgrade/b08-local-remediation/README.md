# B08 local remediation packet

Canonical branch: codex/backend-b08-local-remediation. Base receipt commit:
2c42984b2839d1b03c3b0ccfb89998d3535a48d8. The parent backend program remains
verified within its recorded scope; this packet continues local remediation.

The direct owner graph is deliberately upgraded to concrete compatible versions.
React18/Vite6/Tailwind3 stay; supported Vitest/Router/Wrangler/native compatibility
adapters preserve behavior. The unused PWA dependency is removed while the custom
service worker remains the application authority. Existing workflows receive
bounded action pin/credential/cache/input fixes while preserving their release
and migration gates. The security pipeline candidate under docs remains disabled.

Use PLAN.md and ADR-B08-LOCAL-001.md for scope/decisions, DEPENDENCY_SELECTION.md
for registry provenance, WORKFLOW_HARDENING.md for workflow and vendor fixture
contracts, PARSER_AND_SECRET_TRIAGE.md for private-safe scanner adjudication and
INDEPENDENT_REVIEW.md for the independent compatibility review. Final aggregate
RESULT.md and LOCAL_VALIDATION.md bind exact implementation/command receipts.

Reproduce the immutable packet from the canonical repository root after its
separate documentation receipt commit:

```bash
python3 docs/backend-upgrade/b08-local-remediation/verify_packet.py --committed
```

The parent program verifier binds older source bytes. Run it at its recorded
receipt commit, not against this changed B08 implementation. Prior receipts are
not rewritten. Raw engine reports, source snapshots, private pointers and tool
caches never belong in the public evidence packet. Only bounded receipts and
privately reviewed command logs are exported; gzip alone is not redaction.

NEXT_ACTIONS.md orders remaining upstream, hosted, human data, provider, paid
benchmark, billing and operational gates. Local success never establishes a
production release certificate or authority to activate dormant candidates.
