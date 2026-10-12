# Takosan V3 - Brand Audit

Mission: `TAKOSAN-BRAND-V3-FULL-INTEGRATION`. Codex thực hiện đơn agent.
Ngày: 2026-10-12 JST. Repository `vn-tak/Tako-san`, ID `1385308553`.
Default branch `main`; baseline `652e0d7632745e9b77cda4b5b3caac83a3ec1015`.
Checkout riêng; branch `feat/takosan-brand-v3-full-integration`; working tree ban đầu sạch.
PR mở #63/#29/#20 chỉ thay tài liệu vận hành. Các checkout khác không bị sửa.

## Input

ZIP SHA256: `43f61f42c533c0f6632002b1e8a91421c4420d612b851d5b117753c42c86e942`.
PDF SHA256: `192ff21c9bb5672670a98f53f12843e74aa5b05249ccb9a31002cc326c15378f`.
PDF riêng và bản trong ZIP trùng bytes. 83/83 file khớp MANIFEST; không thiếu file.
`INPUT_INVENTORY.json` ghi từng path, SHA256, bytes, kích thước, alpha và viewBox.
Không có checksum do nhà phát hành cung cấp: đây là digest quan sát, không phải
chứng nhận nguồn độc lập. SVG parse hợp lệ; không script, foreignObject, ảnh nhúng,
external href hoặc event handler. PNG decode được; logo/mascot có transparency;
social RGB và maskable/iOS opaque. PDF 14 trang, đã đọc text và render trang logo/UI.

Ảnh concept là tham khảo, khác master SVG và palette. Master logo/mascot và token
JSON có thẩm quyền. Ghi chú yêu cầu duyệt trong tài liệu đầu vào mô tả concept;
yêu cầu thực thi của chủ dự án cho phép tích hợp, commit/push/PR. Không có quyền deploy.

## Quyết định

| Nhóm | Hiện trạng | Quyết định | Lý do |
| --- | --- | --- | --- |
| Logo / wordmark | `brand` cũ và `rebuild` khác nhau | REPLACE | Một canonical V3 cho mọi caller |
| Logo SVG master | Path sạch, wordmark outline | ADAPT | Giữ geometry; cân symbol/wordmark và optical margins trong slot 300x72 |
| Monochrome | File ghi mono chứa 3-5 màu | ADAPT | Một màu thật; mắt/miệng knockout trong suốt |
| Micro symbol | Silhouette rút gọn không mũ | RETAIN | Ít chi tiết, dễ đọc favicon 16/24px |
| Mascot | Nhiều pose cũ không đồng nhất V3 | REPLACE | Happy/thinking/wink/celebrate; alias theo mục đích, không thêm persona |
| Empty/error states | Có accessibility semantics | ADAPT | Giữ heading/action; warning nghiêm trọng dùng icon hệ thống |
| UI icons | Lucide + TakosanIcon currentColor 1.8px | RETAIN | Nét hiện tại tốt; không thay cả thư viện vì kit có 12 icon |
| UI SVG V3 | 12 icon currentColor | RETAIN | Tài nguyên chức năng sẵn cho sử dụng sau; không ép vào mọi control |
| App icons/favicon | `rebuild` identity cũ | REPLACE | V3 SVG masters, raster xuất lại, micro riêng <=32px |
| Android/iOS | PWA, chưa có dự án native | DEFER | Chỉ chuẩn bị layer/icon trong docs, không tạo native app |
| Semantic tokens | Root T17 và override kitchen lệch palette | ADAPT | V3 scoped semantic source; giữ trạng thái/error/focus/alpha utilities |
| Typography | Kitchen Be Vietnam Pro; root Google Nunito | ADAPT | Self-host Nunito 400-800 variable + subset Việt; OFL kèm digest |
| Dark mode | Không có runtime/theme toggle | DEFER | Cung cấp reverse asset; không thêm theme chưa có |
| Responsive layout | UI01-UI14 có shell đo kích thước | RETAIN | Bảo toàn spacing, navigation, workflow và các fix 320px |
| Payment UI | Protected theo AGENTS; palette legacy | RETAIN | Chỉ alias brand asset, không sửa payment config/handlers/layout |
| SEO/OG/manifest/SW | Tagline cũ, asset cũ | REPLACE | Metadata V3; giữ domain, cache lifecycle và third-party bypass |
| Frigo identifiers | API headers/storage/packages/domain | RETAIN | Technical compatibility; đổi sẽ gây regression |
| README | Brand Frigo/palette cũ | ADAPT | Cập nhật phần nhận diện; không đổi lệnh backend/deploy lịch sử |
| Old public assets | Có caller/version/cache cũ | RETAIN | Không xóa phá compatibility; bỏ khỏi runtime precache mới |
| Preview / brand book | Design reference | REMOVE | Loại khỏi production delivery; giữ input bên ngoài repo |
| Social cover/avatar | Marketing, không runtime | DEFER | Kit gốc còn trong ZIP; chỉ OG cần cho app |

## Phạm vi màn hình

| Yêu cầu | Route / phần thực tế | Xử lý |
| --- | --- | --- |
| Welcome / Splash | `/landing`, RouteFallback | V3 logo/tagline, suspense symbol |
| Login / Registration | `/auth`, `?mode=register`, `/auth/verify` | Shared brand chrome; auth logic giữ nguyên |
| Onboarding | `/onboarding/household`, `/preferences`, `/goals` | Logo/font/token đồng bộ |
| Home / Daily plan | `/`, home planned meal | Shared shell; giữ nghiệp vụ |
| Weekly plan | `/planner`, setup/meal/shopping; `/week` flag-off | Shared shell/token; kiểm cả compatibility |
| Discovery / Detail | `/recipes`, `/recipes/:slug` | Logo/font/token; ảnh món ăn giữ nguyên |
| Cooking / Success | `/cook/:slug`, `/cooking/complete` | Shared logo/feedback |
| Fridge | `/fridge`, detail, reconciliation | Shared shell/empty state |
| Shopping | `/shopping`, planner shopping | Shared brand/component |
| Ingredient Scan | `/scan`, photo/receipt review | Existing camera/review, không provider mutation |
| Nutrition | Recipe tab `Dinh dưỡng`, meal summaries | Không tạo route giả |
| Budget | Planning defaults, summaries/shopping budget | Không tạo dashboard giả |
| Profile / Settings | `/me`, household/preferences, 4 settings routes | Shared brand/layout |
| Loading / Empty / Error | Suspense, async state, inbox, verify-missing, failure drill | Render thật + semantics |

Tất cả thay đổi branding được self-review bởi Codex; không có independent reviewer,
không tạo approval hoặc bypass branch protection.
