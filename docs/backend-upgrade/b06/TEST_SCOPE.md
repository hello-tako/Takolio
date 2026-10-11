# B06 current-authority whole-week checks

The seven-day matrix covers Manual (all explicit existing locks), Assisted (one
existing lock plus deterministic search), Auto (unlocked search), stocked/empty
pantry/freezer/fridge and two households. These are test workflow labels. Existing
backend modes remain cook_now/shopping_allowed; no product mode or scoring changes.

Tests preload current SQLite authority with persisted household restrictions and
prove read-only planning, all seven slots, repeat policy, lock identity, no foreign
stock, no negative projected quantity, consolidated demand and unknown nutrition.
Same-household members share hard restrictions while foreign members cannot preload.
Stale context retains immutable original evidence and a fresh context changes its
fingerprint. Existing HTTP revision/concurrency and shopping/cooking FEFO suites
are mandatory complementary checks; this matrix alone is not a UI or data V2
certificate. Real V2 ingredient consumer migration remains gated by human evidence.
