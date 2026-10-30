# Source verification policy

Source states are separate:

- `URL_DISCOVERED`
- `URL_REACHABLE`
- `SOURCE_CONTENT_READ`
- `SOURCE_RELEVANCE_VERIFIED`
- `FACT_SUPPORTED`
- `SOURCE_CONFLICT`
- `SOURCE_UNAVAILABLE`

HTTP 200, a valid URL, or a JSON-LD block alone cannot produce
`content_verified`. A claim needs a source-specific excerpt or structured
fact reference, retrieval record, and relevance review. V3 stores hashes and
metadata, never a full copied recipe.

The current V2 package has 0 declared sources marked content-verified. Until
source attempts and claim review are complete, the release blocker remains.
Network retrieval is research-only; deterministic release compilation never
depends on the network.
