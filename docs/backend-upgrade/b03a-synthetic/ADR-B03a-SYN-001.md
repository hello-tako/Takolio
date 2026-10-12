# ADR-B03a-SYN-001 - Actual synthetic image fixtures

Accepted for offline implementation, 2026-10-12 JST.

The user explicitly requested self-created invoice and refrigerator samples for
remaining tests. The existing four VN receipt baseline and nine symbolic V3 cases
cannot exercise Japanese glyphs, actual fridge image encoding, degraded images
and native browser preprocessing. Preserve both as historical regression inputs.

Add a distinct SYNTHETIC_IMAGE asset kind to the offline dataset schema, retaining
TEST_ONLY annotation and certification blockers. Render 24 source documents with
five variants and one damaged file. Bind source/image/font hashes and keep all
variants of each source in one split. Missing-field variants have reduced facts;
no masked values inherit known truth. Fridge visual regions transform on rotation;
unobservable quantities and covered contents remain unknown.

Use pinned repository fonts and deterministic Sharp rendering. A 22KB SIL OFL
Japanese subset and provenance are repository fixtures; no dependency/public font
change. Raw generated images and OCR observations stay in ignored local artifacts.
Apple Vision performs real offline text recognition without reading source labels.
Scoring is region-based text extraction, with exact/compact text and CER separated.
Fridge semantics are unmeasured and stay null. No quality threshold is retrofitted
from these results. The original real pilot and paid-provider gates remain open.

Use Chromium native input/bitmap/canvas/FileReader with the existing preprocessing
module; preserve actual processed images for paired local OCR. Test MIME/byte
integrity and schema rejection through existing adapters with intercepted fetch.
Legacy V1 requires quantity/unit and rejects null; do not fabricate a default or
change its runtime contract. V3 can represent UNKNOWN and these fixtures test that.

No application/runtime/auth/payment/provider config, data authority or migration
change. Offline rollback is to stop using the new scripts and fixtures; historical
scorers remain usable. No inventory or external side effects occur.
