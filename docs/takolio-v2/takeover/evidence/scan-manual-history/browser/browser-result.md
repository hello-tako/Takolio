# SCAN01 browser result

- Runtime: isolated local Vite + real Worker router, synthetic in-memory SQLite, `http://127.0.0.1:3321`; external fetch disabled and browser external origins blocked.
- Matrix: photo and receipt lanes at 320px and 1440px; 4 flows, 8 screenshots; all confirmation responses `200`.
- Photo: UI manual add, second draft removal, `0.25 pack`, pantry, explicit expiry `2030-12-31`, confirm, new browser document reopen. Manual row retained with `scan_manual_<64 hex>` history ID, disabled review controls, no AI/OCR/confidence/price claims.
- Receipt: no new manual-add UI; manual row confirmed through existing API contract, new browser document reopen. Manual marker/detail retained, controls disabled, no OCR confidence/price/raw evidence.
- SQL/GET: accepted manual row present once; rejected row remains `REJECTED`; OCR and price columns remain NULL; fractional stock quantity is 250 milli-pack with known expiry; fresh GET matches SQL.
- Replay: identical confirm payload on all four flows returns `idempotentReplay: true`; full preview SQL and GET snapshots remain byte-equivalent to the committed snapshot.
- Safety: zero page errors, zero console errors, zero failed requests, zero blocked external requests; fresh-document phase makes GET-only API reads.
- Evidence: `browser-2026-10-24T19-39-33.888Z/`, `evidence-sha256.txt`.

## Limits

Synthetic SQLite/Node preview validates the real Worker router and UI path. It does not replace native D1, hosted browser, device, Safari, accessibility-assistive-technology, or production acceptance. No merge, deploy, or production operation performed.
