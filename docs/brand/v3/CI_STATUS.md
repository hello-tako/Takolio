# Brand V3 integrated production receipt - 2026-10-12 JST

PR66 source `6114a43ee6c2798ecd9aebca959dd6496d1a2aea` is merged and retained in
production release `0c0f9933dcd1af2296d8033709ea3bf5ceec30f2` through PR67 and PR68 in hello-tako/Tako-san,
unchanged repository ID 1385308553. Exact merged-main CI 38208731783 and protected
production deploy 38209910253 PASS. Final public rendering/PWA smoke passes 30 checks
on staging and production, with external WebKit Turnstile errors recorded separately
and no authenticated journey certificate. Runtime/API/payment scope and independent
acceptance limits are detailed in
[release result](../../backend-upgrade/final-local-completion/RESULT.md) and
[receipt](../../backend-upgrade/final-local-completion/release-receipt.json).

Earlier baseline E/H failures were addressed in integration test instrumentation;
94 isolated production-build E2E pass. Full dependency audit now reports 0 advisories.
Original source-branch evidence follows unchanged and is historical.

---

# Commit / PR / CI Receipt

- Repository: `vn-tak/Tako-san`, ID `1385308553`.
- Baseline/default main: `652e0d7632745e9b77cda4b5b3caac83a3ec1015`.
- Branch: `feat/takosan-brand-v3-full-integration`.
- Implementation commit: `d35f4a68f4c2f6eb77f2a27742b5f1a3900075a7`.
- Pull Request: https://github.com/vn-tak/Tako-san/pull/66.
- Changed files: 214; deleted files: 0; package/lockfile changes: 0.
- Runtime: 54 files / 269.090 bytes; source 39 files, native preparation 5 files.
- Initial hosted run: https://github.com/vn-tak/Tako-san/actions/runs/38196104982.
- Final-head CI authority: https://github.com/vn-tak/Tako-san/pull/66/checks.

Ở thời điểm documentation checkpoint, run initial đã PASS lint/typecheck và
đang chạy Vitest; chưa tính CI đang chạy là PASS. Documentation commit tiếp theo
sẽ có run `validate` của chính HEAD đó. Final HEAD SHA và kết quả CI được đọc từ
GitHub và ghi vào báo cáo bàn giao/PR sau khi run kết thúc; file này không ghi hash
của commit chứa chính nó hoặc giả PASS cho run chưa hoàn tất.

Branch protection hiện yêu cầu `validate`, strict/up-to-date branch, zero required
approving reviews. Không tạo review approval, bypass, merge hoặc deploy.
PR body giữ disclosure của hai baseline/unsupported E2E cases và dependency audit.
Local verification đạt gate trong phạm vi; release concerns vẫn mở.

Evidence manifest ghi SHA256 của screenshots/observations/logs. Full-resolution
396 screenshots BEFORE/AFTER và supplemental được bàn giao trong archive local;
representative PNGs trong repository cho phép reviewer truy cập trực tiếp.
