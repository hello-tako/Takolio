# Raw seafood formulation decisions

Prepared 2026-10-28 JST against documentation HEAD
`90c5b221b3c4e3c1d878c4edb5dab7f5f07465cb`; data implementation
`a578b5696389cdb6afeca7530e33b1f4e384690e`.
Candidate file SHA256:
`0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`.

Both cases remain P0 / `FAIL_UNRESOLVED`. Selected options: **PENDING**.
This document adds decision evidence only: zero candidate edits, canonical claim
additions, source-status promotions, human approvals or runtime promotions.
The 500-recipe audit totals remain unchanged. Cached written descriptions were
read; the YouTube video and captions were not reviewed.

## Gỏi tôm sả chanh: imp-a71f6ef791b463ea

- Immutable V2: `data/recipe-refresh/v2/recipes/imp-a71f6ef791b463ea.json`.
- V2 file SHA256: `6da0457ffafe2201986fe697431d5586d126a62910db5ecf50151926224b2a61`.
- Candidate content fingerprint: `d3349cabf764cf32a9b2cea4c7e7268a987716c69f1395835fc75e7b4301bc1b`.
- Canonical evidence: `data/recipe-intelligence/v3/research/batch-21-evidence.json#/recipes/5`.
- Candidate edits: zero. Existing 500 g / 3 servings is preserved, not validated.

| Coupled JSON pointers (zero-based) | Observed conflict / review requirement |
|---|---|
| `/content/description`, `/steps/0`, `/steps/2`, `/steps/3`, `/steps/6`, `/steps/8` | Description says blanched shrimp; procedure freezes raw shrimp, soaks in lemon, chills, mixes and serves cold without heating. Changing the description or acid-cooking tip alone cannot resolve the unsafe process. |
| `/content/cookTimeMinutes`, `/steps/0/timerMinutes`, `/steps/2/timerMinutes` | Declared total 20 minutes conflicts with a 30-minute freezer step before a 5-minute soak. No replacement total selected. |
| `/ingredients/0/note`, `/ingredients/0/quantity`, `/content/servings` | Note blends a 300 g source without yield and a claimed 1 kg / 4-person source into 500 g / 3 servings. No supported scaling established. |
| `/ingredients/2/note`, `/steps/2/instruction`, `/steps/5/instruction` | Lemon note allocates approximately 45 ml + 45 ml; steps use approximately 60 ml + 30 ml. Consumed/discarded acid and nutrition need review. |

The [declared PDF](https://tailieu.duytan.edu.vn/tailieu/2009/20091216/cangghexaotoi/goi_tom_tuoi_3073.pdf?rand=701668)
contains 300 g shrimp on page 2 line 4; page 3 lines 2-9 describe peeling,
a roughly five-minute lemon soak, draining, mixing and immediate service.
All seven pages were inspected; pages 4-7 concern separate fish/squid dishes.
No shrimp heating step, freezer duration, three-second acid-cooking claim or
500 g / 3-serving conversion was established. The second declared
[Nghiện Bếp URL](http://nghienbep.com/cach-lam-mon-goi-tom-gion-tan.html)
retains its prior unavailable/404 outcome; no redundant retrieval or promotion.
General FDA/CDC guidance in GAP_RESEARCH_SUPPLEMENTS.md does not validate this
raw process or establish a complete cooked replacement.

| Decision option | Evidence needed before a candidate change |
|---|---|
| `RETAIN_BLOCKED_RAW` | Retain the archival candidate and P0 publication block; record an independent human reviewer and explicit unresolved-risk disposition. This does not certify raw service. |
| `RESEARCH_COOKED_ADAPTATION` | Record a formulation decision, then support a complete preparation/cooking/cooling/mixing sequence for the selected shrimp. Review description/identity continuity, all coupled steps, quantities, yield, time, provenance and nutrition together. |
| `PROVIDE_RAW_PRODUCT_PROTOCOL` | Supply exact species/product/package/intended use and a credible validated hazard-control process for independent food-safety review. Citrus appearance, 30-minute freezing and generic fish guidance cannot substitute for this evidence. |

## Cua nướng muối Nhật: imp-f04b28987d7cd34a

- Immutable V2: `data/recipe-refresh/v2/recipes/imp-f04b28987d7cd34a.json`.
- V2 file SHA256: `00a37d510676eb95f279699e8e9c5315bc82cb21205f26cead47876f4b72f533`.
- Candidate content fingerprint: `bc566906cd417f8c1c7154a42fd66322fc83f5cfbfa4340215f3a16d86367001`.
- Canonical evidence: `data/recipe-intelligence/v3/research/batch-23-evidence.json#/recipes/14`.
- Preserve the two existing `/steps/0/instruction` and `/steps/0/tip` edits:
  fridge thawing, drip control, package directions and fully thawed center.

| Coupled JSON pointers (zero-based) | Observed conflict / review requirement |
|---|---|
| `/ingredients/0/sourceName`, `/ingredients/0/note` | Generic frozen king/snow crab permits both raw and preboiled. No specific product/state selected. |
| `/steps/0`, `/steps/4/tip`, `/steps/5`, `/steps/6` | Raw slow-grilling advice, 5-minute shell-color cue, 3-4-minute flip and preboiled surface-warming advice are combined. Neither shell redness nor these times selects a safe universal cooking/reheating path. |
| `/ingredients/0/quantity`, `/content/servings`, `/content/cookTimeMinutes` | Preserve 800 g / 4 servings / 40 minutes. Product state, edible yield, thawing inclusion and nutrition basis remain unverified. |

[Iwamoto](https://karatsu-iwamoto.com/blog/7141/) visible text lines 93-124
distinguishes raw/preboiled king/snow crab; lines 125-133 make the choice
contextual, and 134-151 discuss shell preparation before grilling. It supplies
multiple alternatives, not an exact product or universal cooking duration.

The [declared YouTube page](https://www.youtube.com/watch?v=NAUiFb8UIwk)
contains written description at `ytInitialPlayerResponse /videoDetails/shortDescription`:
extracted lines 35-40 cover thawing, 43-59 shelling/serving, 69-75 generic vendor
links. It describes king crab and eating after shelling, without an explicit
boiled label in that description. Its room-temperature thawing advice conflicts
with the existing fridge correction. Description chapter times are not viewed
frames or culinary verification.

The phrase identifying preboiled 800 g king crab occurs in a merchandise shelf:
`ytInitialData /contents/twoColumnWatchNextResults/results/results/contents/3/merchandiseShelfRenderer/items/0/merchandiseItemRenderer/{title,description,vendorName}`.
The shelf also contains an unrelated green-juice product. It does not establish
the crab demonstrated in the video or authorize narrowing V2 to preboiled king
crab. The [exact shelf product URL](https://aojiru.base.shop/items/103627019)
redirected to `https://aojiru.base.shop/suspend`, HTTP 200, at
`2026-10-27T20:51:18.371251+00:00`; extracted lines 1-4 show shop suspension.
Product specifications/package directions remain unavailable despite HTTP 200.

| Decision option | Evidence needed before a candidate change |
|---|---|
| `SELECT_RAW_PATH` | Exact species/product/raw package state; supported handling and cooking endpoint; coordinated ingredient note, steps/tips/timers, yield and nutrition review. |
| `SELECT_PREBOILED_PATH` | Exact species/product/package proves fully cooked state and whether ready to eat after thawing; manufacturer storage/thaw/reheat instructions, including any required heat treatment; remove contradictory raw-only instructions only after review. |
| `REVIEW_CONDITIONAL_PATHS` | Separately supported raw and cooked entry conditions, complete cooking versus reheating paths, species/quantity/nutrition review. Unknown product state stays blocked. |

## Source bindings

The first three raw snapshots were retrieved on 2026-10-26 UTC. New description
and merchandise observations reuse those immutable bytes; they are not fresh
retrievals or canonical source-status changes.

| Source / retrieval | Raw SHA256 | Reviewed extraction SHA256 / locator basis |
|---|---|---|
| PDF `source-245df51a4906974c`, `2026-10-26T19:28:52.560286Z` | `ee7feec31c28218acb5a86de5a6330ef9583a2628b40229492f6b54d9c801c81` | PDF text `fc46049d23374eabf997ae436dce7c210db4483e6175ae5572e41e8842f0d963`; page extraction `2a7cdc9a0687334372f4c2170e7225a11c88d679c28cba3f91faac8551ca3c73` |
| Iwamoto `source-caefb25eb11bbc40`, `2026-10-26T19:28:50.962899Z` | `7f20f85eb841221f9fca97343fce3d55df88adc59f8e9631d4073ddd6dd3f5aa` | Visible text `b9362c7a0b3e9c5c9e796e09b6457bf83ea35a17688a02101b3e99ce988b5546` |
| YouTube `source-0a59f7cc79f0a104`, `2026-10-26T19:28:51.060417Z` | `9f4d90474d4676b451bd98a6f91c23a3eef73c02a8d6426c25c9f1178436be9f` | Description `13fedbd9d4e6f708ed3ac12d2c2109255861c7738bac4c7eda08173bade35737`; merchandise extraction `259294e932bad134305e7ed15b79102bba6a8155f9d5935ee85e98a05b3c3c28` |
| Unavailable product, `2026-10-27T20:51:18.371251+00:00` | `1869aa5bf02f8a0932491bfb2492e4ab10e47cc6e6e9c32214be6c325c9698fa` | Suspension text `401d57ca04199c4f768249380b50a4d86107a464c3b484cf2a0d3732d9d2b64c` |

PDF text/page hashes refer to the named PDF extraction, not its separately
normalized historical `visibleTextSha256`. Full source files, descriptions and
private cache paths are excluded from this publication.

## Decision acceptance

A product/formulation preference authorizes the next bounded research step; it
cannot set `HUMAN_APPROVED`. Record recipe ID, selected option, exact candidate
fingerprint, reviewer identity/role, UTC decision timestamp, evidence references,
allowed field changes and unresolved-risk disposition under
`../19_INDEPENDENT_REVIEW_QUEUE.md`. Any content change invalidates the old
fingerprint binding and needs a new review. Current decisions remain PENDING.

ADR072 preserves identity, ingredient quantities/roles and servings. If a chosen
option needs structural or quantity changes, prepare the separately reviewed
compiler extension before applying it; do not bypass the editorial allowlist.
The other four critical recipes remain in GAP_RESEARCH_SUPPLEMENTS.md, also
awaiting human review. No formulation choice alone closes release blockers.

## Executed verification

`python3 /private/tmp/takolio-v3-supp08-culinary/check-packet.py`: PASS two cases,
five bounded observations, 14 cache hashes, V2/candidate snapshots and exact
description locators. This checks provenance and current pointers, not safety.
The temporary proposal remains session evidence; this document is the durable
bounded decision record. Current audit and documentation checks are recorded in
`../14_TEST_STRATEGY.md`; the full supplement07 gate applies to unchanged data/code.
