# Rollback plan

ADR-075/076/077/078 retain V1 catalog authority. Apply0046 then0047 before this Worker.
Keep the immutable content archive, household grants, cooking receipt references
and saved composition pins. Never down-migrate, delete receipts, rewrite queued
commands or restore historical user data over current writes.

## Before saved pins or changed content

A prior reviewed Worker can use the additive0046/0047 schema only before any
non-NULL saved composition pin exists and before changed content has been served.
Existing Workers can insert legacy NULL references, but strict historical schema
gates reject extra migrations. This is not an executable historical deployment
path without separate reviewed certification.

## After the first saved pin

A Worker predating0047 can delete/reinsert composition rows without their pins.
Pre-077 strict V1 Workers cannot parse pinned result JSON; pre-078 strict shopping
Workers/clients cannot parse pinned attribution/cache. These are invalid recovery
versions even when catalog content is unchanged.
Use a certified version-aware recovery Worker from the same reviewed source with
both composition flags OFF. Preserve0046/0047, the archive, grants, pins and
receipt-first replay. Prove hosted OFF/recovery behavior, including legacy route
and queued-command handling, before issuing the first pin in production.

After changed content has been served, the recovery Worker must also retain the
exact content/request identity for pending and committed cooking commands. An
old Worker can reinterpret them against another catalog. Archive retention alone
does not make that safe.

## Recovery sequence

1. Stop promotion and new candidate issuance.
2. Activate the certified version-aware recovery Worker through normal gates.
3. Restore the previous approved authority for new selections; retain user pins.
4. Preserve IDs, slugs, plans, shopping rows, favorites and cooking history.
5. Replay committed commands from receipts without another debit. Resolve pending
   commands against their original content and current household restrictions.
6. Verify exact SHA/catalog, paired flags, schema, household isolation, saved pins,
   queue recovery and inventory state. Record the actual deployment/recovery receipt.

Local migration and consumer checks are recorded in23-26 validation reports.
Same-source paired flags OFF/ON preserves saved rows and exactly-once cooking;
real-service-worker offline queue/reconnect checks pass. These local checks do
not certify hosted recovery or old versions. V1 selection and shopping pins are
implemented; approved publication and exact-source hosted staging/recovery remain open.
No promotion or rollback has been executed in production.
