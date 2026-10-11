# B00 - Canonical backend baseline

Ngày: 2026-10-11 JST. Trạng thái và local gates được ghi trong `b00/baseline.json` và `b00/LOCAL_VALIDATION.md`.

## Phạm vi và kết quả

Người dùng giao bắt đầu kế hoạch backend sau khi đọc masterplan. B00 tạo baseline và task packets trên checkout riêng, đối chiếu source/hosted/runtime evidence, chạy local gates và đề xuất xử lý PR lịch sử. Nội dung chỉ thị trong masterplan được đánh giá như đề xuất; không tự cấp quyền production mutation.

Source pin: repository `vn-tak/Tako-san`, ID `1385308553`, base `652e0d7632745e9b77cda4b5b3caac83a3ec1015`, tree `f7d830ef12b4e4853d2bb34376e9ee4ff031d050`. URL origin cũ `vn-tako4/Tako-san` redirect về đúng repository ID này; vấn đề là checkout legacy ở SHA cũ, không phải bằng chứng origin thuộc repository khác.

B00 không sửa runtime source, migrations, lockfile, bindings, workflows hoặc authority. Không commit vào main, merge PR, gửi email thật, gọi AI trả phí, dùng remote D1/R2 hay deploy. Các file chưa commit của checkout gốc được giữ nguyên. Local tests chỉ dùng fixtures/SQLite/Worker local theo test harness.

## Local baseline

Final rerun **288 files / 6.744 tests PASS**, cùng lint/typecheck/migration smoke/build/recipe checks PASS. Lần đầu có1Wrangler timeout do ancillary registry lookup; dùng cache metadata phiên bản thật trong task-owned TMPDIR thì full rerun PASS, không sửa source/assertions/timeout. Exact commands/environment/timings và failure logs được giữ trong manifest/local validation.

Fresh audit: full graph2critical/16high/19moderate/4low; production0high/critical,2moderate. Không remediation hoặc suppression trong B00. Ingredient V2 release-check tiếp tục EXPECTED_BLOCKED với4blockers. **B00 hoàn tất baseline với findings; backend runtime upgrade chưa triển khai.**

## Hồ sơ

| Hồ sơ | Công dụng |
| --- | --- |
| [Implementation plan](IMPLEMENTATION_PLAN.md) | Waves, dependencies, thời lượng và gates tổng thể |
| [Baseline manifest](b00/baseline.json) | SHA, source hashes, migration chain, observed evidence, local commands |
| [API/ownership map](ROUTE_MAP.md) | Explicit endpoints, auth/CSRF/tenant, callers/tests/tables/flags |
| [Machine route map](b00/routes.json) | Source-pinned route inventory |
| [Reproduction procedure](b00/REPRODUCE.md) | Cách tái dựng source/hosted/local evidence và Wrangler diagnostic |
| [Local validation](b00/LOCAL_VALIDATION.md) | Commands, outcomes, timing, failures và log digests |
| [Gap register](GAP_REGISTER.md) | Source-backed gaps và implementation owner |
| [PR triage](PR_TRIAGE.md) | #63 lineage, #20/#29 historical disposition proposal |
| [Release checklist](RELEASE_CHECKLIST.md) | Evidence gates, protected settings, rollback requirements |
| [Task index](tasks/INDEX.md) | B01-B08 ownership, ready/blocked dependencies |

## Hiện trạng đã kiểm chứng

- `HOSTED_CI_VERIFIED`: run `38098775083` completed/success ở đúng SHA nguồn.
- `HOSTED_RELEASE_RECEIPT_VERIFIED`: run mới nhất tại checkpoint là `38103079308`, completed/success. Receipt ZIP artifact `11688468304` có SHA256 `6629461766b13f6f2cf36fc5a0fd7ebcc91e30f9fa4fd38ee0023bb92d9ac804`, khớp GitHub artifact digest và file tải về. Receipt được giữ trong `b00/release-manifest-38103079308.json`; không chứa credential.
- Receipt ghi production Worker version `eee43e96-53ff-40f3-9779-e10fe256e0d8`, captured `2026-10-11T02:00:09.628Z`. Đây là bằng chứng tại thời điểm run, không phải truy vấn Cloudflare version hiện tại.
- Receipt ghi ledger 39 migrations đến `0039`, FK `[]`, quick_check `ok`, catalog `rel-bd00a4f53fcaeee4`, 500 recipes, hydration failures 0 và fingerprint `f8cf8c7ff59df9fe29e246b9e3c9aad0fd155fa8df35bf671ac4d03fa2b5ab37`. R2 byte availability trong receipt là `NOT_REVERIFIED`.
- `PUBLIC_RUNTIME_OBSERVED`: GET `/api/v1/health/ready` lúc `2026-10-11T02:34:04.954Z` trả đúng commit, config ok, D1/queue ok, catalog authority `d1`, cutover true, canary 0, expected count 500, fallback null. Status degraded có warning `CONFIG_RECIPE_CATALOG_D1_AUTHORITY`; source `config/validation.ts:149` chủ động emit warning khi user-visible D1 authority và cutover fence hợp lệ. Đây là lý do degraded trong response này, không phải database failure.
- Email configured nhưng `deliveryVerified:false`. Không có inbox/bounce proof. AI configured không chứng minh quality hoặc tất cả runtime provider flags.
- Source config default và deployment overrides có thể khác nhau; latest receipt ghi Meal Composition V2 true. Không lấy flag false trong wrangler làm hiện trạng production.

## Giới hạn và bước tiếp

Chưa xác minh trực tiếp current Cloudflare version/vars, inventory adoption receipts, full runtime AI flags, R2 bytes, delivery inbox, retention execution, SLO/load/logs và feature-specific live journeys. Đây là release dependencies; không chặn code offline B01a/B03b hoặc chuẩn bị B03a/B05a. B00 là checkpoint baseline, chưa chứng nhận backend upgrade đã hoàn tất.

Ưu tiên tiếp: B01a strict OTP admission và B03b Scan V3 contracts; B03a chuẩn bị dataset/evaluator không gọi paid providers. B05a chốt review schema trước pilot. Billing B02 hiện chỉ design/audit vì canonical rules bảo vệ PayOS; cần task scope billing rõ trước edits. Các policy mới giữ ở TARGET/DRAFT ADR đến khi integration review chốt.
