# Raw seafood formulation decisions

Prepared 2026-10-28 JST against documentation HEAD
`90c5b221b3c4e3c1d878c4edb5dab7f5f07465cb`; data implementation
`a578b5696389cdb6afeca7530e33b1f4e384690e`.
Candidate file SHA256:
`0f20c30bd52c821a17382e17b858dbfceffbc1a0bc4711f6eefcab4c3ad8bef4`.

Both cases remain P0 / `FAIL_UNRESOLVED`. Research directions selected by the
user; six public product/context pages were independently located and read.
Product-specific validation and independent culinary review remain **PENDING**.
This document adds decision and bounded product-research evidence only:
zero candidate edits, canonical claim additions, source-status promotions, human approvals or runtime promotions.
The 500-recipe audit totals remain unchanged. Cached written descriptions were
read; the YouTube video and captions were not reviewed.

## User direction record - 2026-10-28 JST

Recorded at `2026-10-27T21:06:10Z` after the user's two replies in the current
Codex chat. This is the recording time; the exact reply timestamps and a named
independent culinary reviewer were not supplied. Actor: the human user choosing
research scope, not a food-safety approver. Prior documentation checkpoint:
`56d077e172e14aa3505afd4d9f4aec1272f14c05`.

| Recipe ID / unchanged candidate fingerprint | User reply / selected option | Status and allowed next work |
|---|---|---|
| `imp-a71f6ef791b463ea` / `d3349cabf764cf32a9b2cea4c7e7268a987716c69f1395835fc75e7b4301bc1b` | "Cung cấp sản phẩm/quy trình tôm sống đã kiểm chứng" / `PROVIDE_RAW_PRODUCT_PROTOCOL` | Research direction selected; Alpex and Astra black-tiger product pages located; SKU/lot label, intended raw-use documentation and validated hazard-control evidence remain unverified. Review the bounded findings below; no candidate changes authorized by this preference alone. |
| `imp-f04b28987d7cd34a` / `bc566906cd417f8c1c7154a42fd66322fc83f5cfbfa4340215f3a16d86367001` | "Cua sống" / `SELECT_RAW_PATH` | Research direction selected; Marine Foods and Nissui frozen raw snow-crab products located; package identification and complete grilling directions remain unverified. Research the raw-crab cooking path; this does not select raw service. |

Neither reply identifies a product, supplies a validated protocol or establishes
`HUMAN_APPROVED`. The original three options per case below remain for decision
history; the two choices above supersede the earlier unselected-direction state.
Both P0 blocks, all six critical reviews and zero human approvals remain.
The user subsequently replied "tự tìm kiếm đi", authorizing autonomous public
research instead of another request for URLs. Exact reply time was not supplied;
this follow-up is recorded with the research below. Product comparators are not
proof of the original recipe's ingredients. No scientific species or reviewer inferred.

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
| `/ingredients/0/sourceName`, `/ingredients/0/note` | Generic frozen king/snow crab permits both raw and preboiled. Raw state selected for follow-up research; no specific species/product selected. |
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

## Autonomous product research - 2026-10-28 JST

Scope: six public pages retrieved at the UTC times below, after the user's
"tự tìm kiếm đi" instruction; recorded at `2026-10-27T21:17:17Z`.
These are product comparators and historical context, not six new canonical
sources. HTTP 200, marketing text and certification logos do not validate a
SKU/lot or the recipe. No suitable raw-shrimp protocol was established within
this bounded search; this is not a claim that none exists worldwide.

The search-service connector returned `MCP tool codex_apps/search_service.web_run
is not available to the model`. Browser fallback inspected the publisher pages;
stdlib HTTP retrieval cached them separately. The initial `bs4` import was
unavailable; extraction uses stdlib `HTMLParser`, excluding script/style/noscript,
normalizing whitespace and retaining image alt text with an explicit marker.
HTML decoding was strict UTF-8, except the MHLW page's Shift_JIS. Locators refer
to these immutable normalized text snapshots, not rendered page line numbers.
Full source caches remain private; only bounded summaries/hashes are published.

| Source | Read locator / bounded observation | Limit / disposition |
|---|---|---|
| [Alpex Lanka Gold black tiger](https://www.alpexjapan.com/blacktigershrimp/) | Lines 23-28: Sri Lankan wild black tiger, Lanka Gold; 30-64: processed/frozen formats; 55-56: peeled quick-frozen product; 76-82: generic cooking suggestions including sashimi. | Common name only; no inspected SKU-specific raw-use package, hazard analysis, critical limits, lot acceptance or thaw/hold protocol. Freshness/quick-freezing claims do not validate the 500 g lemon-treated shrimp dish. |
| [Astra HLSO black tiger](https://astraaquaco.com/tiger-shrimp-hlso) | Lines 209-226: Vietnamese headless shell-on shrimp, washing/sorting and IQF/block freezing; 235-242: HACCP/GlobalG.A.P claims and sushi/sashimi application; 245-250: further certification claims. | Supplier marketing, not inspected certificate or validated raw-service process. No SKU/lot label, pathogen acceptance, critical limits or validated consumer protocol located. No size/count/nutrition figures imported into candidates. |
| [Astra certificates](https://astraaquaco.com/certificates) | Lines 88-91: Certificates heading followed by "Updating data". | No certificate available on this inspected page. HTTP 200 is not certification; this does not establish that the supplier lacks certification elsewhere. |
| [Marine Foods raw snow-crab half portions](https://www.marinefoods.co.jp/products/consumer/1916/) | Lines 77-86: frozen raw snow crab, explicitly for heating; grill/butter-grill suggestions. Rinse glaze, refrigerate about 30 minutes-1 hour to half-thaw; heating required. Package governs if website differs. | Preferred raw-to-cook comparator for further research, not selected recipe input. No inspected scientific species, package weight/origin or complete grill endpoint/duration. Line 79 displays frozen category at minus 5 C; do not silently correct it or adopt it as validated storage guidance without the actual label. |
| [Nissui product 90147](https://www.nissui-kenko.com/shop/g/g90147/) | Lines 171-189: image-alt product/process claims and enclosed manual; 215-225: thawing paths; 238-241: grilling suggestion, Russian raw snow crab, frozen at or below minus 18 C and ready after thawing; 325-331: glaze/net weight and internal factory-audit description. | Exact listing: two boxes, each approximately 750 g crab excluding glaze, approximately 1 kg gross including glaze. Shell remains; this is not edible-meat yield. Marketing/process alt text is not independently verified certification. The enclosed manual was not retrieved; no exact grill endpoint/duration or scientific species established. |
| [MHLW 18 May 2001 committee report](https://www.mhlw.go.jp/shingi/0105/s0518-2.html) | Lines 14-22: date/report status; 39-56 and 83-89: proposed raw/frozen seafood hygiene and Vibrio criteria; 57-71: boiled-crab processing; 90-109: cold handling guidance. | Historical report/proposed standards, not verification of current law or any product's compliance. Line 63's center 70 C for at least one minute concerns commercial boiled-crab processing; do not transplant it into this grill recipe. No candidate threshold derived. |

### Coupled conflicts and concrete next evidence

- Shrimp: retain `PROVIDE_RAW_PRODUCT_PROTOCOL` as the research direction. The two
  black-tiger pages establish leads, not permission to serve this formulation raw.
  A reviewable raw path still needs the exact scientific species/SKU/lot and
  raw-use label, validated hazard analysis/control limits and verification,
  cold-chain/thaw/hold/service instructions, plus an independent safety decision
  bound to the unchanged candidate fingerprint. Neither citrus nor 30-minute
  household freezing is validated by these pages. No cooked substitution inferred.
- Crab: `SELECT_RAW_PATH` means raw ingredient to cook. Marine Foods is a concrete
  frozen raw-to-cook comparator; Nissui is a distinct product with a raw-service
  claim. Neither identifies the original recipe product. Marine Foods' half-thaw
  instruction conflicts with the existing candidate's blanket fully-thawed-center
  wording. Preserve the two archival candidate edits while blocked; they are not
  validated universal instructions. Any proposal must reconcile thaw state,
  shell preparation, grill method, endpoint and timers together for the chosen
  package. No mixing of the two manufacturers' directions.
- Nissui's room-temperature option at line 222 is recorded only as a source
  observation; it is not adopted. Its full refrigerator thaw is described for
  raw service, while surface thaw is suggested for hotpot (line 221). Neither is
  a product-specific grill protocol. The internal HACCP-based factory criteria
  at lines 328-331 are manufacturer claims, not an independent certificate.
- Neither package mass nor vendor serving suggestions validate existing
  800 g / 4 servings / 40 minutes, king/snow equivalence or nutrition. Exact
  package/manual evidence and an appropriate supported cooking endpoint remain
  required before a coordinated, fingerprint-bound candidate proposal. No user
  research request remains outstanding; continue from these located sources.

### New retrieval bindings

All six requests returned HTTP 200 with final URL equal to the linked URL.
Snapshot IDs below bind the locators above to raw bytes and normalized text.

| Snapshot ID / retrieved UTC | Raw SHA256 | Normalized text SHA256 |
|---|---|---|
| `alpex-black-tiger` / `2026-10-27T21:13:58.187228+00:00` | `1d4e634a5173792f18be6c14295301344a8de2f01f074375d4abcf68fa209f03` | `0eb1b447b5b750e61de80dc118bac162513998388262e6d58b95fc1a627b308a` |
| `marinefoods-raw-crab` / `2026-10-27T21:13:58.947295+00:00` | `330506f0110501f087259eac2cf1f721260b7eb2e3975778cdd60488fb766768` | `513e67a05895bb5654a5026f35c95008ce3898e9e26989075455a2ec8fa7d756` |
| `nissui-raw-crab` / `2026-10-27T21:13:59.874584+00:00` | `f9b7feeb1bcfb29e0a524c168396e516c01c2db1d4ad56859f9cf90d9a13b435` | `ba9210f4ffc147c36b8d786ede9c3477f2d7dc9326b1985e09bbed7edeb07287` |
| `mhlw-2001-report` / `2026-10-27T21:14:00.759864+00:00` | `ba5ad8e39aa4c60ce53f89decc247bdc5cc7736397ba1fc03bcb17097fd17c21` | `67010b3c1541e9933ff8ed0872c823f59e5a515e6f576a30c0bae460324868db` |
| `astra-tiger-hlso` / `2026-10-27T21:16:32.819768+00:00` | `020b020aedfe2f31255f44631d9102f812ee6c7c3a41f75ab6ae7a98b2bf4a23` | `33fdfb245d4cf3437f48ddabddc454c0125e9bb3aed6174047e7851ff71aaf34` |
| `astra-certificates` / `2026-10-27T21:16:34.008276+00:00` | `bbca87c7e5ea3610a9b26406fe6d8ef3ffda738acbf061661698c981f7bb3eff` | `32b33dd72fb5bf4427d81f0d8465e80dfacf3b35def19be4f45c68a7b37b9b4b` |

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
fingerprint binding and needs a new review. Research directions are selected;
six public pages establish product leads; package/process validation and
independent safety decisions remain PENDING.

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

Product research provenance check: `python3 /private/tmp/takolio-v3-product-research-check.py`.
Exact executed results and retrieval limitations are recorded in `../14_TEST_STRATEGY.md`.
