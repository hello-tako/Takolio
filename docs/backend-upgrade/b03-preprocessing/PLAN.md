# B03 receipt preprocessing comparison - 2026-10-12 JST

Status: LOCAL_IMPLEMENTATION_VERIFIED_WITH_BLOCKING_RELEASE_GATES.
Base: 85c60054 (resolve full SHA in validation receipt).
Branch: codex/backend-b03-preprocessing.
Canonical worktree /Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo.

## Outcome and bounded scope

Continue the user's authorized backend plan with self-created test images.
Reproduce the VN receipt text loss after browser JPEG, compare policies on exact
source bytes, and implement a bounded receipt-specific correction if supported.
Existing photo preprocessing, 2000px cap, scan APIs, ownership/session/idempotency,
confirmation, billing/auth/config/providers/data authority and40migrations stay
compatible. No paid provider calls, remote writes, deploy or public/private images.

Owned paths: new preprocessing comparison/aggregate scripts and tests, optional
receipt-only behavior in src/web/lib/private-image.ts plus its ScanPage caller,
new privacy/preprocessing regression tests, this packet and program/state/ADRs.
Do not alter historical B03a reports/scripts/assets or previous receipts. Generate
candidate images/reports into a separate ignored artifact directory.

## Sequence

1. Compare native browser JPEG0.82 (control), JPEG0.95, PNG lossless and preservation
   of existing small originals. Run actual Apple Vision on each paired image set.
   Reuse source/labels, keep errors and damaged/missing outcomes. Report bytes and
   text per task/locale/quality; no retuned OCR normalization or sample threshold.
2. Pin choice in an ADR before runtime editing. Prefer a receipt-only bounded
   lossless derivative over a universal quality/cap increase. Default photo remains
   byte-compatible. Real-image/provider quality certification remains separate.
3. Test chosen codec/size/fallback logic, large/corrupt images, cancellation/session
   fences and photo compatibility. Exercise actual native browser bytes and the
   running ScanPage with local intercepted APIs; verify no inventory/provider write.
4. Sequential frozen install/lint/both TS/full suite/40migration/build and audit.
   Commit implementation, source-bind clean checks and one aggregate report.

## Acceptance and limits

- Demonstrate control reproduces loss, selected local candidate avoids additional
  JPEG loss where lossless encoding fits the fixed bounded policy.
- No output dimension/currency/quantity invention; no unsafe expansion of upload
  size. Null/oversize/unsupported encoding retains bounded compatible fallback.
- Candidate correctness relies on encoded pixel/size evidence, not a claim that
  synthetic images certify all real OCR. Preserve the raw Apple Vision errors.
- Lossless receipt preparation may improve/retain local text but cannot establish
  provider cost/privacy or real-photo/object accuracy. Real data stays a release
  acceptance dependency, not a blocker to building/tests of the bounded candidate.
- Update next actions and state/board/handoff; original checkout untouched.

Final implementation: a0165c45f6d34c0a4c35c676613d6716f872c534.
All local gates complete; aggregate result/limits in RESULT.md and validation.json.
External real/provider/device/security/data/hosted/release gates remain open.
