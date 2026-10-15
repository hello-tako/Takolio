# Typography system / không có font files đi kèm

## Font chính
1. [Nunito - Google Fonts](https://fonts.google.com/specimen/Nunito) cho display/H1/H2/H3, weight 600, 700, 800.
2. [Plus Jakarta Sans - Google Fonts](https://fonts.google.com/specimen/Plus+Jakarta+Sans) cho UI/body/button/caption, weight 400, 500, 600, 700.

Agent phải tải bộ font trực tiếp từ nguồn hợp pháp, kiểm tra LICENSE theo phiên bản. Kit **không gửi kèm bất kỳ file font nào**.

## Type scale (px / line-height px)
| Token | Font | Weight | Size/Line-height | Letter-spacing |
|---|---|---:|---|---:|
| display | Nunito | 800 | 56/64 | -1.1px |
| h1 | Nunito | 800 | 40/48 | -0.7px |
| h2 | Nunito | 700 | 32/40 | -0.4px |
| h3 | Nunito | 700 | 24/32 | 0 |
| subtitle | Plus Jakarta Sans | 600 | 20/28 | 0 |
| body | Plus Jakarta Sans | 400 | 16/24 | 0 |
| body-small | Plus Jakarta Sans | 400 | 14/21 | 0 |
| button | Plus Jakarta Sans | 600 | 16/24 | .1px |
| caption | Plus Jakarta Sans | 500 | 12/18 | .2px |

**Breakpoint:** dưới 600px, display 40/48, H1 32/40, H2 28/36. Thiết kế responsive thay vì co tất cả theo cùng một tỉ lệ.

**Logo path font**: nguồn hiện tại dùng geometric outline Comfortaa Bold làm hình học khởi tạo, không phải font UI chính thức. Đội thiết kế cần quyết định duyệt wordmark hiện hành hoặc tinh chỉnh glyph; không thay bằng text Nunito runtime.

**Vietnamese QA sentence:** “Bữa ăn ngon mỗi ngày — Cùng Tako khám phá thực đơn thông minh, dinh dưỡng cân bằng cho gia đình Việt.”
