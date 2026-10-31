# Runtime compatibility

V1 remains the runtime catalog authority. ADR-075/076/077/078 add cooking, saved
V1/composition and shared-shopping content identity without promoting the V3 candidate. Apply0046 then
0047 before this Worker. Existing NULL references remain unknown.

New composition selections capture unscaled immutable content and household
access. Lock, reorder and locked regeneration preserve their pin or legacy NULL.
Reads display authorized historical content; incompatible historical components
cannot borrow current classification, nutrition, assessment or shopping facts.
Corrective removal preserves a recovery path; entering changes retain authority,
household, transaction and revision guards.

New clients send `Accept: application/json; recipe-content=1`. Old strict DTOs
omit contentFingerprint and disable unversioned cooking links for pinned recipes.
Detail/cook URLs and query keys include known pins. Requested versions must match
the active cooking run. Offline static fallback must have the exact requested
fingerprint; missing history requires connection rather than substitution.

Compatibility requirements retained:

- Preserve all500 IDs/slugs, V1 catalog bytes and existing units.
- Add identity metadata without changing Recipe content or scaling identity.
- Retain old receipt NULLs and queued bodies; never invent historical versions.
- Resolve committed retries before the catalog; reject incompatible key reuse.
- Preserve household access and current hard restrictions for new commands.
- Keep candidate quantities, media and nutrition outside live inventory deduction.

ADR-077 pins standalone V1 selections; ADR-078 retains pins in shared shopping
attribution and private caches, using the same capability for legacy DTOs.
The release compiler still blocks projection loss, provisional ingredient IDs,
unverified source content and incomplete nutrition. Versioned approved publication
remains open.
After the first saved pin, Workers predating0047 cannot safely serve mutations.
Certify a version-aware recovery Worker with paired flags OFF; retain0046/0047.
See18_ROLLBACK_PLAN.md and23-26 validation reports. Local paired flags OFF/ON
and real-service-worker queue checks pass; hosted recovery remains uncertified.

Local checks are not hosted staging, device or production certification. Existing
production continuity, independent review and Environment gates remain intact.
