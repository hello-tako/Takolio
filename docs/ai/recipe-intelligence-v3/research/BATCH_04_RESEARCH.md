# Current integrated research checkpoint

Current canonical packets: batch-04. 20 recipes; 47 source rows; 29 bounded content reads; 52 claims; 20 recipes with external-content claims; 8 candidate edits across 6 recipes. Human approval and full culinary verification remain zero. Source/runtime promotion remains false.

Current validation from the repository root:

```sh
PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=/private/tmp node scripts/recipe-intelligence-v3-audit.mjs --check
```

This validates all 500 V1/V2 hashes, exact packet ownership, claim facts/pointers, allowed edits, candidate fingerprints and generated outputs. Raw retrieval-cache checks remain historical session evidence; current source hashes and fact locators are retained in the canonical packets. Supplement summaries: `GAP_RESEARCH_SUPPLEMENTS.md`.

Current packet hashes:

| Packet | Evidence SHA-256 | Edits SHA-256 |
|---|---|---|
| batch-04 | `ff435b226f9cbba7d2da5cbd2e962084e8863710da8174810686113ebc08e20f` | `97755ee0d1afdd51dbaab4d3cd361b54f8790176e02def11bab6acfbe4f8572c` |

---

The original report below is historical: counts, packet hashes and session commands describe the initial pre-supplement snapshot. Its fixed-count code is retained as text. Use the current validation command above.

# Batch 04 bounded source review

Status: `RECIPE_V3_RESEARCH_IN_PROGRESS`. Batch: `v3-04`.
20 recipes; 43 retrieval attempts; 25 bounded source reads; 18 unavailable;
43 source-specific claims; four candidate edits across three recipes.
Full recipe verification: 0. Human approval: 0. Production mutations: 0.

Only selected sections were read. Ingredient completeness, methods, conversions,
servings, metadata, food safety, allergens and nutrition remain unverified outside
those sections. HTTP success is not recipe certification. Authors and publication
dates remain null. No source becomes `content_verified`.

## Candidate changes

| Recipe / field | Evidence and correction |
| --- | --- |
| `vn-sang-02` ingredient 5 note | Kingfoodmart uses rau ram; ETV lists cilantro; Saigonese's selected cilantro passage describes a sausage-pate variant. Remove false all-three-source cilantro consensus. |
| `vn-sang-03` ingredient 3 note | Both selected sources use 200g pork; only cachnaungon establishes four servings. MarryBaby's selected pork-perilla section has no yield. Remove false serving consensus. |
| `gl-12` ingredient 5 note | Daigasikfaan lists evaporated milk, an unsweetened concentrated milk. Correct the sweetened-condensed-milk translation. |
| `gl-12` step 2 | Use the same evaporated-milk clarification; preserve the existing amount. Ingredient identity and nutrition remain blocked for review. |

Ingredient indices above are zero-based; cooking step numbers are one-based.
All quantities, identities, roles, servings and nutrition remain unchanged.
Other sources support only short, source-specific paraphrases. No formulation
combines different variants or treats counted units as edible gram mass.

## Artifacts and validation

Evidence: `data/recipe-intelligence/v3/research/batch-04-evidence.json`.
Edits: `data/recipe-intelligence/v3/research/batch-04-edits.json`.
V1 snapshot hashes use Python sorted compact Unicode JSON; V2 hashes use exact
file bytes. Raw HTML/text stays outside Git in
`/private/tmp/takolio-v3-batch04-research/`; no complete source instructions copied.

Executed generator: `python3 /private/tmp/generate_batch04.py`, exit 0; all 25
readable HTML/text hashes matched cache; actual generation timestamp recorded.
The persistent runnable check is `node scripts/recipe-intelligence-v3-audit.mjs
--check`; it validates ownership, V1/V2 hashes, facts, pointers, edit references
and exact generated outputs. Integrated results are recorded in
`20_FINAL_ACCEPTANCE_REPORT.md` after execution.

Next: independently review these four edits; reconcile the milk identity and
nutrition before promotion; complete unmentioned whole-recipe fields for all 20.
