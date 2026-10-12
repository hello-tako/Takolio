# Takosan V3 - Implementation

Mission `TAKOSAN-BRAND-V3-FULL-INTEGRATION`; baseline
`652e0d7632745e9b77cda4b5b3caac83a3ec1015`; branch
`feat/takosan-brand-v3-full-integration`. Thực hiện bởi một Codex agent.

## Canonical assets

`src/web/lib/takosan-brand.ts` là contract tài nguyên V3.
`takosan-kitchen.ts` là compatibility facade đọc cùng contract.
Runtime ở `public/takosan/v3`; source ở `docs/brand/v3/source`; native preparation
ở `docs/brand/v3/native`. Không tải brand book hoặc preview concept vào ứng dụng.

`pnpm brand:icons` tái tạo 49 export từ master SVG đã commit:

- 16 logo horizontal/stacked/wordmark/symbol: primary, reverse, mono-dark, mono-white.
- 2 micro symbols; micro riêng cho favicon <=32px và tablet rail.
- 4 mascot happy/thinking/wink/celebrate, giữ geometry master.
- 12 UI SVG; thư viện currentColor/Lucide hiện tại tiếp tục dùng trong controls.
- 3 app icon SVG; 10 PNG sizes 16/24/32/48/64/128/180/192/256/512.
- 1 maskable PNG opaque; 1 OG 1200x630 đã kiểm tra.

Thêm 3 Nunito WOFF2 + OFL + font manifest: runtime tổng 54 file, 269.090 bytes.
PNG được xuất từ vector, không crop concept. Maskable foreground nằm trong
vòng tròn 80% an toàn; Android layer và iOS preparation cập nhật nền Leaf Green.
Hai symbol primary/reverse trùng bytes có chủ đích vì symbol màu dùng được cả hai nền.

Monochrome input chứa nhiều màu nên generator xuất lại một màu và knockout mặt.
Horizontal giữ paths, cân symbol/wordmark trong frame 300x72; logo runtime 168px
rộng, khoảng 40px cao. Logo outline không cần font runtime.

## Semantic mapping

Một authority tại `src/web/styles/takosan-tokens.css`. Không import token CSS của kit.
Root giữ compatibility hiện có của legacy/payment; product scope `.takosan-rebuild`
đọc V3 qua tên semantic/RGB mà Tailwind và component hiện tại đã dùng.

| Vai trò | Mapping V3 | Ghi chú |
| --- | --- | --- |
| Primary action | `#2E7D5B` | Chữ trắng 5,00:1 |
| Accent | `#FF7B6B` | Chỉ accent/background; không chữ nhỏ trên trắng |
| Canvas | `#FFF8F3` | Tako Cream |
| Primary text | `#202C28` | Deep Ink; 13,75:1 trên Cream |
| Success soft | `#DFF4E6` | Soft Mint |
| Text on soft | `#26694C` | Derived green; 5,68:1 trên Mint |
| Muted text | `#6F6B64` | Giữ fix AA; 5,04:1 trên Cream |
| Hover / pressed | `#246648` / `#1D553D` | Giữ state semantic |
| Focus / error / warning | Semantic hiện tại | Không ghi đè fix accessibility |
| Sun Yellow / White | `#FFC857` / `#FFFFFF` | Brand constants giữ canonical |

Chuyển các chữ/link/navigation trên nền nhạt sang `--semantic-text-on-soft`.
Token declarations được chuyển khỏi `kitchen-foundation.css` để tránh authority cạnh tranh.
Không thêm dark theme vì runtime chưa có; reverse/dark assets sẵn cho dùng sau.

## Typography và component

Self-host Nunito variable 200-1000, SIL OFL 1.1, package nguồn
`@fontsource-variable/nunito@5.2.7`. Hỗ trợ weights 400/500/600/700/800 và glyph
tiếng Việt. `font-display: swap`; Latin/Latin-ext/Vietnamese subsets tổng ~87,8 KB.
Giữ font fallback cũ và không đổi package.json/lockfile.

Header, entry và desktop sidebar đọc logo V3; tablet dùng micro symbol.
RouteFallback/cooking/reconciliation dùng canonical symbol/logo qua facade.
EmptyState aliases pose cũ vào 4 biểu cảm, lỗi nghiêm trọng dùng AlertTriangle.
Landing dùng tagline “Bữa ngon, nhẹ đầu.”; supporting line nằm trong contract.
Button/Input/Select/Modal/Dialog/Card/Badge/Toast/Tabs/Loading tiếp tục dùng semantic
và behaviors hiện tại; không viết lại component library.

## Màn hình và metadata

Welcome, login/register/verify, 3 onboarding steps, Home/daily planned state,
Planner empty/setup/saved week/meal/shopping, recipes/detail/nutrition, cooking/review/
success, inventory/detail/reconciliation, shopping, scan/photo/receipt review,
profile/household/preferences, settings, notifications và Plus dùng shared identity.
Nutrition/Budget là tab/summary/settings có thật; không tạo route/backend mới.
Week flag-off vẫn tương thích và được render riêng.

Favicon, apple-touch-icon, manifest, OG, application title/description/theme đã đổi V3.
Domain deployment giữ nguyên. SW precache dùng V3 và local Nunito, lifecycle cache
release/third-party bypass/network strategies giữ nguyên.

## Phạm vi bảo toàn

Không sửa App routing, auth callback/logic, API/services/stores, Worker, domain,
payment components/configuration, secrets, migrations, CI/deploy workflows.
Payment shell nhận logo/mascot V3 qua shared contract; palette/root/layout hiện có giữ.
Các Frigo key/header/domain và ảnh nguyên liệu/món ăn giữ compatibility.
Old public assets không xóa vì phục vụ old callers/cache/source generators.

Source README/manifest mô tả subset thực sự commit, tách khỏi inventory 83 file input.
Các script QA mới chỉ bind loopback, dùng real local Worker/synthetic SQLite;
không có production mutation hoặc provider payment/login thật.
