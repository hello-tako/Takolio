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
