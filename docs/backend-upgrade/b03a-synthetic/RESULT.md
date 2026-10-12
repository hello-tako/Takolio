# Kết quả kiểm thử bằng ảnh tổng hợp - 2026-10-12 JST

Trạng thái: **SYNTHETIC_LOCAL_TESTS_COMPLETE**. Bộ mẫu và kiểm thử local đã hoàn
thành; chứng nhận OCR của sản phẩm và các gate production còn mở.
Implementation: `7323a0e4dea33953c0bf966742766aa4847f8b1c`.
Branch: `codex/backend-b03a-synthetic-images`.
Worktree: `/Users/tunbee27/.codex/worktrees/backend-b00-baseline/frigo`.

## Bộ mẫu đã tạo và dùng

24 mẫu gốc, 120 biến thể ảnh PNG/JPEG và một JPEG cố tình hỏng:

| Nhóm | Mẫu gốc | Biến thể |
| --- | ---: | ---: |
| Hóa đơn Việt Nam, VND | 6 | 30 |
| Hóa đơn Nhật Bản, JPY | 6 | 30 |
| Nhãn sản phẩm Việt/Nhật | 6 | 30 |
| Minh họa tủ lạnh | 6 | 30 |

Mỗi mẫu có bản rõ, mờ, nghiêng 7 độ, thiếu sáng và thiếu trường. Nhãn đáp án được
tạo từ nguồn trước khi render/OCR; trường bị che thực sự chuyển thành UNKNOWN.
Dòng mua trùng giữ occurrences riêng; khối lượng, số lượng và nội dung hộp kín
trong tủ lạnh không được suy ra. Split giữ các biến thể cùng nguồn với nhau.
Tên cửa hàng/sản phẩm được tạo riêng, không chứa dữ liệu khách hàng/thanh toán.

Ảnh tủ lạnh là minh họa có nhãn SYNTHETIC TEST ONLY. Mẫu dùng template lặp;
24 mẫu gốc không phải 120 quan sát thực tế độc lập. Bộ hóa đơn và corpus symbolic
lịch sử được giữ nguyên. Font Nhật subset 22.212 bytes có SIL OFL và hash nguồn.

Ảnh, đáp án và raw outputs ở `.artifacts/scan-synthetic-v3/`; bảng ảnh xem nhanh
`contact-sheet.png`. Có thể tái tạo theo `qa/ocr/synthetic-v3/README.md`.

## Đã đo trực tiếp từ ảnh

Apple Vision chạy hai lượt, mỗi lượt 121 file: ảnh gốc và ảnh được bộ tiền xử lý
thật của frontend nén trong Chromium. Runner không đọc đáp án. Scorer đối chiếu
chữ theo vị trí template, giữ chữ sai/khoảng trắng sai và các failure trong report.
Đây là phép đo trích xuất chữ, chưa phải độ chính xác ngữ nghĩa hoặc pipeline Qwen.

| Nhóm | Khớp chữ chính xác, ảnh gốc | Khớp sau nén browser | Bỏ khác biệt khoảng trắng: gốc / browser |
| --- | ---: | ---: | ---: |
| Hóa đơn VI, 672 vùng chữ | 642/672 | 619/672 | 666/672 / 643/672 |
| Hóa đơn JA, 672 vùng chữ | 647/672 | 647/672 | 672/672 / 672/672 |
| Nhãn VI, 39 vùng chữ | 37/39 | 39/39 | 37/39 / 39/39 |
| Nhãn JA, 39 vùng chữ | 35/39 | 38/39 | 39/39 / 39/39 |

Không có lỗi decode trên 120 ảnh hợp lệ; JPEG hỏng thất bại ở cả hai lượt như thiết
kế. Các lỗi OCR thật gồm mất dấu trong THỊT BÒ, đổi chữ/số sang glyph Cyrillic và
khác biệt viết hoa/dấu. Nén JPEG hiện tại làm giảm kết quả hóa đơn VI ở template
này: mất thêm 23 vùng chữ khớp chính xác. Kết quả được giữ nguyên; chưa thay quality,
kích thước hay áp ngưỡng production từ mẫu này. `validation.json` lưu slices,
latency, hash manifest/raw results và command receipts của lượt clean-source.

Ảnh tủ lạnh không có vùng chữ sản phẩm: số đo nhận diện đồ vật/khối lượng là
UNMEASURED, không ghi thành độ chính xác 100%. Không gọi Qwen hoặc provider trả phí.

## Kiểm thử luồng và hợp đồng

Chromium 153.0.8010.12 chạy native file input, createImageBitmap, canvas và
FileReader với module `readPrivateImage` hiện hữu. 120 ảnh hợp lệ và một hóa đơn
3.200 px đều qua kiểm tra decode/MIME/hash/kích thước <=2.000 px; ảnh nhỏ không
bị tăng dung lượng. Hủy, đổi household và reset phiên đều có 0 callback cũ.
JPEG hỏng được helper giữ nguyên bytes để bước validation phía sau xử lý.
Mọi request browser ở loopback; không gửi ảnh ra ngoài.

Adapter nhận bytes ảnh thật với fetch bị intercept: kiểm MIME, nội dung ảnh,
request serialization và malformed output. V1 từ chối null quantity/unit bằng
SCHEMA_VALIDATION; V3 biểu diễn UNKNOWN. Mock responses không được tính là OCR.
Scorer tests phát hiện quantity bịa, dòng trùng bị collapse, sai hash/metadata/
split/matrix và cố gán một observation cho hai occurrences. Evaluator CLI với
120 outputs thiếu vẫn giữ đủ 120 submissions, 24 documents và 4.548 UNKNOWN slots;
classification NOT_CERTIFIED, cost NOT_COMPUTABLE.

## Kiểm tra toàn kho

Các gate chạy tuần tự trên commit sạch `7323a0e4`, Node24 và pnpm10.33.2:

| Kiểm tra | Kết quả |
| --- | --- |
| Frozen install, lint, cả hai TypeScript projects | PASS |
| Focused regression | 7 files / 49 tests PASS |
| Full suite | 315 files / 7.610 tests PASS; command 184,536 giây |
| Migration smoke | PASS; 40 migrations giữ nguyên |
| Build frontend + Worker TypeScript | PASS |
| Protected base files | 4.593 files byte-identical |
| CSS và service worker | CSS 134.861 bytes/hash y hệt baseline; token đúng implementation |
| Production dependency audit | 0 cảnh báo |
| Full dependency audit | FAIL: 1 HIGH, braces / GHSA-vfj7-8cjw-p6xm |

Môi trường: NODE_OPTIONS=--no-experimental-webstorage, CI=true,
WRANGLER_SEND_METRICS=false, TMPDIR=/private/tmp; remote schema/Week flags unset.
Lỗi phát hiện ban đầu: 5 focused assertions dùng sai shape output/strict V1;
3 lỗi TypeScript Buffer; helper Git filename quoting; một khoảng trắng cuối dòng
trong license upstream. Đã sửa kiểm thử/helper/whitespace tương ứng, giữ log thất
bại. Warning HMR port ở phép kiểm ad hoc cũng được ghi riêng, không tính là gate.
Không sửa assertions cũ hoặc runtime để ép qua test.

## Những việc còn mở

Bộ ảnh tổng hợp đã giải quyết việc thiếu file mẫu cho kiểm thử local. Để chứng
nhận sản phẩm vẫn cần ảnh thực được phép sử dụng, nhãn độc lập và phép đo provider
với bằng chứng token/giá/privacy/retention cùng ngân sách đã chốt. Nhận diện đồ vật
trong ảnh tủ lạnh cần model run riêng. Tiếp theo so sánh preprocessing trên corpus
thực trước khi quyết định sửa runtime quality/cap.

Gate security HIGH, review ingredient/recipe của con người, scope billing riêng,
inbox/hosted/staging/edge/load/chaos, SLO bảy ngày và release/rollback vẫn theo
kế hoạch đã ghi. Không có remote migration, deploy, gửi email, gọi paid AI,
push/PR/merge, đổi payment/auth/provider/data authority trong task này.
