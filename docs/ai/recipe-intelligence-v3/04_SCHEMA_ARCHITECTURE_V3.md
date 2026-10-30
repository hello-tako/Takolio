# V3 schema architecture

V3 uses a versioned candidate sidecar first. It does not introduce a migration
or replace the runtime catalog in this checkpoint.

## Candidate envelope

Each candidate must carry:

- stable `recipeId` and unchanged `slug`;
- V1 and V2 source fingerprints;
- candidate schema/content version and candidate fingerprint;
- complete ingredient and step arrays;
- per-line reconciliation and quantity evidence;
- source attempts and claim evidence;
- nutrition evidence state;
- runtime projection result and explicit exclusions;
- review state and required actions.

The existing V2 schema already preserves most of these fields. V3 adds
deterministic audit manifests and review artifacts around it rather than
duplicating a second runtime recipe model.

## Options

| Option | Benefit | Cost | Decision |
|---|---|---|---|
| Versioned sidecar | Keeps V1 fingerprint and saved consumers stable | Requires an explicit read/promotion policy | Chosen for audit and candidate work |
| Full runtime promotion | One visible content authority | Requires projection proof, snapshot compatibility, and release migration | Deferred until blockers are closed |

No schema change is justified by the current evidence. Additive D1 work can
only follow an accepted ADR, migration review, local replay, and rollback proof.
