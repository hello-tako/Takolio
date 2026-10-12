# ADR-B03-PREP-001 - Bounded lossless receipt preparation

Accepted for local implementation, 2026-10-12 JST. No deployment authorization.
This extends ADR-020 only for receipt uploads; ordinary photos keep its behavior.

## Evidence and decision

Native Chromium plus Apple Vision reproduces VN receipt exact text619/672 after
JPEG0.82 vs642/672 on the source. JPEG0.95 reaches628/672 and retains loss; PNG
reaches644/672 with24/24 source-PNG receipt rasters pixel-exact. Small originals
recover642/672 and original JA647/672. PNG on tilted JP sources alters whitespace
(638/672exact,672/672compact), so neither higher JPEG quality nor universal PNG
is a certified best policy for all text/real imagery. These are template lab data.

Prefer original already-supported PNG/JPEG receipt bytes when decoded dimensions
are <=2000px and source size <=512KiB. This makes the small-source path immune to
new lossy quantization by construction. For larger/other-format receipts, try a
PNG canvas derivative at the existing2000px cap, accept only if nonempty, genuinely
image/png and <=512KiB. Otherwise use the unchanged JPEG0.82/smaller-source rule.
The fixed512KiB lossless allowance is10% of the server's default5MiB decoded-image
limit, an engineering ceiling independent of observed OCR scores; configured
server limits remain authoritative. JPEG fallback can retain its existing larger
output; this is not a new universal upload-size guarantee.

`readPrivateImage` gains an optional purpose ('photo' default, 'receipt' opt-in).
Only the gallery ScanPage receipt tab passes the new purpose. Fridge/food/default
callers retain previous pixel/codec/dimension logic and flags. Camera capture is
unchanged. Capture session once, fence callback/cancel across both codec attempts,
close bitmaps as before. No API/quantity/currency/provider/confirmation changes.

## Compatibility, risks and acceptance

The branch handles PNG/JPEG MIME only for the original bypass; decode failures,
unsupported APIs and null encoders retain existing reader/fallback behavior.
No EXIF stripping is promised: like the existing smaller-source/failure fallback,
an original-bypass can retain source metadata. EXIF/privacy policy requires a
separate decision before release. PNG derivatives drop ancillary source metadata.
Do not read/log/store raw image content outside existing in-memory flows.

Actual browser tests cover exact preserved bytes, PNG derivative decoded pixels,
oversized image dimension cap, session/cancel races, MIME and default-photo parity.
Unit tests additionally cover the exact512KiB boundary and null/empty/wrong-MIME/
oversize/throwing encoders. Running ScanPage receipt/photo
requests use local interception and actual synthetic file input. Unit tests cover
state/encoder interleavings. Frozen local gates run at a source-bound commit.

Real photos, native devices/Safari, provider item recall/latency/cost/privacy and
release review remain uncertified. The local change avoids unnecessary compression
without treating a synthetic quality result as DATASET/PROVIDER_CERTIFIED. No
provider activation, remote write, inventory confirmation or deployment follows.
Rollback is caller purpose omission or reverting these two frontend source files;
there is no schema/data/message migration. Old callers continue to work unchanged.
