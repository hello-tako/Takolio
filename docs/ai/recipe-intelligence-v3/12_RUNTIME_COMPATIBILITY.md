# Runtime compatibility

V1 remains the runtime catalog authority. ADR-075 adds cooking version and replay
compatibility without promoting the V3 candidate. Migration0046 must precede the
new Worker: detail/start write the archive; completion reads the new receipt fields.

The V2 release compiler still blocks source-line projection loss, provisional
ingredient identities, unverified source content and incomplete nutrition. The
V3 audit reports these conditions without waiving them.

Compatibility requirements:

- Preserve all500 IDs/slugs, V1 catalog bytes and existing units.
- Add `contentFingerprint` metadata without changing Recipe content or scaling identity.
- Retain old receipt NULLs and queued bodies; never invent their content version.
- Resolve committed retries before the catalog; reject incompatible key reuse.
- Preserve household authorization and current hard restrictions for new commands.
- Keep candidate quantities, media and nutrition outside live inventory deduction.
- Certify saved-plan/shopping pins and version-aware recovery before content promotion.

Local legacy/native inventory, Week, restriction, migration and offline-replay
checks are recorded in14_TEST_STRATEGY.md. Local proof is not hosted staging or
production certification. The existing production continuity fence remains.
