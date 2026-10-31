# Exact ingredient identity audit

Status: NEEDS_HUMAN_REVIEW. Promotion: false. Approved decisions: 0.

The existing registry contains 45 ingredients and 204 normalized name/alias keys.
Across all 500 V2 recipes, 1,395 provisional IDs occur on 4,233 of 6,766 lines.
None of their source or canonical names matches an existing registry name/alias
under Unicode NFKC, casefold and whitespace collapse. All remain unresolved.
This negative result does not establish that every provisional concept is new.
Accent/context/punctuation stripping, fuzzy matching and species substitution
are deliberately excluded; no automatic mapping is proposed.

There are 2,004 reconciliation rows carrying provisional IDs: 1,642 provisional
new rows plus 362 duplicate aliases. These differ from the 1,395 distinct IDs.
The report pins the registry, manifest, reconciliation, all 503 manifest files,
sorted ID set and reconstructed per-ID names, occurrences and source pointers.
It records the ten largest impacts without another redundant full per-ID copy.

`ING_ENR_0121EB2200008912` contains both Thai basil and holy basil labels. Review
species and each source occurrence before grouping or approving this identity.
The report retains exact pointers; this audit changes no source or runtime data.

Run from any directory:

```sh
python3 scripts/recipe-intelligence-v3-ingredient-exact.py
```

The script defaults to its repository root, reconstructs coverage, checks all
pinned hashes and compares the result with
`../manifests/ingredient-exact-audit.json`. Explicit `--root` and `--report`
arguments support another checkout. `--write` regenerates the candidate report;
it never approves identities. Observed result: exact=0, unresolved=1395,
humanReview=PENDING, promotion=false.
