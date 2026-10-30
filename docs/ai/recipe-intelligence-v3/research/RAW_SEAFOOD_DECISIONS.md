# Raw seafood formulation decisions

## Current raw-crab candidate - 2026-10-31 JST

Worktree Takolio-recipe-v3; branch codex/recipe-v3-crab-cooking;
parent50ecf0188c1c98ce065c58bd8aa56a44ce679bea. ADR-072 editorial scope only.
Current candidate artifact SHA256: `61729db2569a553a3551051161a6aa3cb0dc996d381050327b89108f56a473e2`.
Current crab content fingerprint: `fc267f18206245a9036bf9156ee38a8aa7a0f306bb11618cef469cc03eba6e98`.
Immutable V2 SHA256 remains
`00a37d510676eb95f279699e8e9c5315bc82cb21205f26cead47876f4b72f533`.

Seven coordinated crab edits now use the owner's raw-to-cook direction:
raw heating-only ingredient note; refrigerator/drip/package handling;
thermometer and clean-utensil advice; both existing timers explicitly inspection
reminders; measured center at least75C held at least1minute. The numeric endpoint
is attributed to MHLW general household guidance, not a validated manufacturer
crab protocol. Marine Foods supplies a product-specific half-thaw counterexample;
no SKU, thaw duration or mixed-brand instructions are adopted. The former blanket
fully-thawed-center assertion and preboiled superficial-warming branch are removed.

Canonical evidence: batch-23-evidence.json recipes[14].claims[7-8]; two new
source rows, two claims. Both previous edits and prior supplement metadata remain
in that recipe's history. Quantity800g,servings4,total40minutes,ingredient
identities/roles/nutrition and V2 bytes are preserved, not independently validated.
Other499 candidate records and raw-shrimp recipe remain unchanged.

Both seafood cases remain FAIL_UNRESOLVED; six critical safety decisions remain
pending. humanReview=PENDING; no source/runtime promotion or safety approval.
The changed crab fingerprint needs a genuine new decision; any supplied review
file must bind the new artifact hash. The owner's reported completed review is
retained in19_INDEPENDENT_REVIEW_QUEUE.md; no reviewer identity is inferred.
Checks and release limits: [14_TEST_STRATEGY.md](../14_TEST_STRATEGY.md).

The following dated records retain their historical hashes, counts and proposals.
The previous two-edit crab plan and unchanged-candidate statements are superseded
by this bounded correction; their source observations remain evidence.

---

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

## Government category evidence and Nissui grilling FAQ - 2026-10-29 JST

Four additional retrievals below supplement the six earlier product/context
pages. CAA is the Japanese Consumer Affairs Agency. Its index presents the
food-specific standards for convenience, says it updates them as appropriate,
and directs readers to the MHLW law database and new legislation for the latest
text (normalized index lines 120-124). This is a bounded reading of the linked
category documents, not a complete current-law or product-compliance assessment.

| Source / read locator | Bounded finding | Limit for these recipes |
|---|---|---|
| [CAA raw fresh seafood](https://www.caa.go.jp/policies/policy/standards_evaluation/other/category/assets/0000126765.pdf), both pages read; p1 section1, p2 sections2-3 | Covers sliced/peeled raw-use seafood, excluding oysters and frozen products. It specifies Vibrio parahaemolyticus MPN at most100/g, hygienic processing and storage at or below10C. | Category requirements do not prove any shrimp species/SKU/lot compliant or validate the lemon/freezer process. The category storage maximum is not a proposed household handling instruction. |
| [CAA frozen food](https://www.caa.go.jp/policies/policy/standards_evaluation/other/category/assets/0000126767.pdf), all three pages read; p2 section1(4), p2-3 section2, p3 section3 | Separately defines raw-use frozen sliced/peeled seafood: viable bacteria at most100,000/g, coliform negative and Vibrio MPN at most100/g; hygienic processing, prompt freezing and frozen storage at or below minus15C. | Do not apply the nonfrozen category to a frozen SKU, treat microbiological criteria as a complete hazard-control protocol, or replace stricter product-label instructions. No shrimp lot/testing or validated thaw/hold/service evidence obtained. |
| [CAA category index](https://www.caa.go.jp/policies/policy/standards_evaluation/other/category), normalized lines120-124 | Establishes the publisher context and latest-law caveat for these two PDFs. | No claim that every subsequent amendment has been checked. The older MHLW2001 report remains historical. |
| [Nissui90147 grilling FAQ](https://www.nissui-kenko.com/shop/g/g90147/), question/answer at normalized lines274-277, also expanded in the browser | Half-cut shell crab can be used for grilled crab; the shell contributes aroma. | No grill temperature, duration or internal endpoint supplied. The enclosed manual still has not been retrieved; scientific species/package protocol remain unestablished. User-review cooking anecdotes are not manufacturer directions. |

Both PDFs were extracted in full, rendered and visually inspected across all
five pages. HTML locators refer to immutable normalized text including image
alt text, not browser line numbers. Full PDFs, images and HTML remain private;
only bounded findings and retrieval bindings are published.

All four requests returned HTTP200; final URLs equal the linked URLs.

| Snapshot / retrieved UTC | Raw SHA256 | Extracted or normalized text SHA256 |
|---|---|---|
| `raw-seafood` / `2026-10-29T10:53:42.194042+00:00` | `628bbf12d1c7ddd4698735788d33db555c3e5204bb4fc8dbb929fb11b7d4b9ea` | `1768035943ada987c525b0df80b505bcb6bf228dce8f2356e0339155b53d76df` |
| `frozen-food` / `2026-10-29T10:53:44.434576+00:00` | `9dcf9c65db5182a8ebf27884a2466d4c74ad1c97f5658d959c7c4ad0f0a78415` | `44ca3031c884496ff06728b8c72d7eb2880685e76f69ec6141bd7db181abde1c` |
| `caa-index` / `2026-10-29T10:58:49.371567+00:00` | `a8d0e9a1a2ef37723591c6f16ce392fdfecd6170bd3c69c63c22482ed3d90360` | `f16c1207375b4d037eb07d8c53d2137ae57689d79eb98be0630818b586c49144` |
| `nissui-grill-faq` / `2026-10-29T10:58:51.479029+00:00` | `55ec383a36eca32c9ad841ea5d59f1c4b2c3d0f2b616ad10613a0b99f3cf7295` | `5011e7a6986ebf1c46f0aa98b4c07065b2aafabf9c082ff29ee767c7a9255091` |

Disposition: `PROVIDE_RAW_PRODUCT_PROTOCOL` and `SELECT_RAW_PATH` remain the
selected research directions; both cases stay `FAIL_UNRESOLVED`. No product
selection, candidate edit, canonical source promotion, nutrition claim or human
approval results from this supplement. The existing six critical reviews stay
pending. Next evidence remains exact raw-shrimp package/validated process and
raw-crab package/species/coordinated thaw-and-grill directions, followed by an
independent safety decision bound to each candidate fingerprint.

## Product specification and household cooking endpoint - 2026-10-30 JST

Nine primary/comparator sources retrieved at the UTC times below. This bounded
supplement follows the owner's raw-shrimp research and raw-crab selections. It
does not select a new ingredient, change a candidate or confer HUMAN_APPROVED.
Locators address immutable normalized text; the GODAK one-page PDF was extracted,
rendered and visually inspected. Raw files remain private.

| Source / locator | Supported observation | Remaining limit |
|---|---|---|
| [GODAK product](https://www.godak-tokyo.com/angelprawn) and its [official specification](https://www.godak-tokyo.com/_files/ugd/880d39_d4adbbc1a1254eea8e70fe1b7d365d26.pdf), PDF text14-24,32,36,39-42,49 | Concrete product: GODAK, Tenshi No Ebi, farmed New Caledonian shrimp; printed scientific name `Lito Penaeus Stylirostris`; raw-use label `生食用`; NET1kg; frozen storage at or below minus18C. Quick running-water thaw, prompt preparation, refrigerated protected storage when necessary, early consumption. Manufacturer states approximately annual laboratory testing including viable counts, coliforms and Vibrio. | No inspected lot COA, numeric results/critical limits, validated kill step or current independent certificate. Labelled raw use does not validate the original lemon/freezer formulation. Species differs from original black tiger shrimp; substitution needs coordinated identity/formulation and independent safety review. |
| [SOPAC products](https://sopac.nc/nos-produits/), text16; [species](https://sopac.nc/notre-crevette/), text9,12; [quality](https://sopac.nc/engagements/) | Producer identifies Tenshi No Ebi for Japan and `Litopenaeus Stylirostris`; describes monitored traceability/quality parameters. | Corroborates product/species context; generic quality and historical certification claims do not establish a current inspected certificate or pathogen-control protocol. |
| [Marine Foods raw crab](https://www.marinefoods.co.jp/products/consumer/1916/), text81-84,89 | Frozen raw snow-crab half portions, heating required, grilling intended; rinse glaze and refrigerator half-thaw approximately30-60minutes. Actual package governs. | Website frozen category says minus5C; ambiguous, not adopted or silently corrected. Scientific species, purchased package and manufacturer grill endpoint remain unverified. Do not combine this half-thaw instruction with another product's full-thaw/raw-service directions. |
| [MHLW household six points](https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/shokuhin/syokuchu/01_00006.html), text252,254 | Current publisher guidance gives cooked-food center75C for at least1minute as a household cooking guide. | General household endpoint, not validation of a specific crab, grill temperature or fixed timer. This does not establish the original800g/4servings/40minutes or edible yield/nutrition. |
| [JF Tajima salt-grilled crab](https://www.jftajima.com/recipe/20151226220919/), text39-44 | Whole Matsuba crab technique: gills removed, legs opened, foil/hotplate, salt and lid. | Red shell/plump flesh is not temperature proof; whole fresh crab does not establish frozen half-portion identity or yield. |
| [Itamaedamashii8201](https://www.1osechi.com/shop/g/gkn8201/), text57-60,73 | Secondary raw heating-only snow-crab listing, glaze rinse and refrigerator thaw around1hour. | Selected800g x1 versus content table800g x2 conflicts; scientific species and validated grill endpoint absent. Do not use inconsistent yield as evidence. |

GODAK is now a concrete raw-use-labelled lead with manufacturer handling/QC
instructions. Missing validated controls and the species/formulation difference
remain explicit. Freshness/K-value, flash freezing, lemon and30-minute household
freezing are not established pathogen controls. No fixed GODAK holding/service
period was obtained; directions from another brand must not fill that gap.
Both recipes remain FAIL_UNRESOLVED; six independent safety decisions remain
pending and the unchanged candidate fingerprint still binds those decisions.

### Retrieval bindings for this supplement

All requests returned HTTP200 with final URL equal to the linked URL.

| Snapshot / retrieved UTC | Raw SHA256 | Extracted text SHA256 |
|---|---|---|
| `godak-angelprawn` / `2026-10-29T21:47:16.577994+00:00` | `2bf10cbfede341e27e4a1fd7b9960f52f1d891a344bd270c0c8bed1023c9627b` | `ca8185304194487c574059020c64873673ec3a32d3bd9c5c15e9e0f1506c3998` |
| `godak-product-spec` / `2026-10-29T21:47:16.853777+00:00` | `9504c8963aeaa3eaebeb1363a5432b8dd627f6ed1857aa19e259dcacdc2a7a8d` | `817bc1dff3883d7772d8c13f361b954a4537212db380ed27aac5bbaa19eba0be` |
| `sopac-products` / `2026-10-29T21:47:16.932331+00:00` | `84b57711590a9ef61a76cbe3b6fdf3ad7d1f5918d39290c1237664db283631ee` | `9008f29e0ed02b0d6fba41c4057d51827ff0202e51cb7e311229fcc22276e7c9` |
| `sopac-species` / `2026-10-29T21:47:16.944391+00:00` | `dc9a99e2f36537f1ae523a34b61bb91dd34c98d8f61e7a89a22dd6d9a38e5782` | `ee2d1c243a0f811493a5fc5cf1a42ec4bf0b156e58e9faf2db7107d7a8cf0b2c` |
| `sopac-quality` / `2026-10-29T21:47:17.217416+00:00` | `e980331b4d564b7e8d6a303343a3789aaf7b3c491ff2258f7ae54ce1379e89d8` | `c831201ab6697db7b71ade63a0f34d55f18cc47c3c25520e81aae7963aa87db3` |
| `mhlw-household-six-points` / `2026-10-29T21:47:17.087392+00:00` | `44d8ddb7a2d23059a313b6fa3dbb3d61d6964f5bab47a832c856082120ece6b4` | `eba9e740495cc0bef2d66f937219efd42d3ca705c26eefd0fb8a3bf735a2b536` |
| `marinefoods-raw-crab` / `2026-10-29T21:47:17.655990+00:00` | `f64b805c8ef3a8b611bff4e7e3f67b84d5747cf4510c6fa65826e69fb98dc034` | `45d7db67a73acbf346a87d429b89f9b1432ff2b90e40c26bd8f6e25e1b69e75e` |
| `jftajima-grilled-crab` / `2026-10-29T21:47:17.560130+00:00` | `eadfa6468c6d74f9b8b4423569acbc3ad9d295b107287e420995bea048b494bd` | `51bc7de9c8d359dbb69dc80d052f17e14300474a1a8f39748012f78af6affbed` |
| `itamaedamashii-raw-crab-8201` / `2026-10-29T21:47:17.555982+00:00` | `88587c548b2a36e4a07a749754e0c061d5b41597dc27397213988047b1bfb305` | `4174199a851879d5f8f5599dd9c28d1feccbdb7f413924048e1952cd2d85e879` |

Executed `python3 /private/tmp/takolio-v3-seafood-research-20261030/check_provenance.py`: PASS exit0;9sources,18SHA256 checks,15quote locators and official PDF link. This verifies recorded provenance, not food safety or regulatory compliance.
