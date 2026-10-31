# Rollback plan

ADR-075 cooking foundation keeps the V1 catalog unchanged. Apply migration0046
before the new Worker; retain its archive, household grants and nullable receipt
fields through rollback. Existing Workers can insert legacy NULL references.
Never down-migrate, delete receipts, rewrite queued bodies or restore user data.

Before any changed recipe content is served, a rollback to the reviewed V1 Worker
is compatible with this additive schema. Verify its exact SHA, schema gate,
receipt replay, household isolation and stock state through the protected release
workflow. The current local migration tests prove old inserts and history
preservation; they are not hosted recovery certification.

After changed content has been served, an old V1 Worker is an invalid rollback
target: it can ignore contentFingerprint and reinterpret an offline command
against another catalog. First certify a version-aware recovery Worker using the
same archive, immutable command references and household grants. Pin that recovery
SHA in the release packet before promotion. Archive retention alone is insufficient.

For a later approved content release:

1. Stop promotion and new candidate issuance.
2. Deploy the certified version-aware recovery Worker through normal gates.
3. Restore the previous approved authority fingerprint for new selections.
4. Keep IDs, slugs, saved plans, shopping rows, favorites and cooking history.
5. Replay committed commands from receipts; resolve pending commands by their
   original content and current household restrictions without a second debit.
6. Verify catalog identity, saved consumer pins, queue recovery, schema and stock.

Version-pinned saved planner/shopping and hosted recovery rehearsal remain release
prerequisites. Current candidate content is review-only; no promotion or rollback
has been executed in production.
