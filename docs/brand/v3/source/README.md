# Canonical V3 Source Subset

Đây là phần master được chọn từ bộ Takosan V3, phục vụ tái tạo asset runtime.
Không phải toàn bộ ZIP. `MANIFEST.json` ghi SHA256 và bytes của các file nguồn
thực sự được lưu tại đây; `../INPUT_INVENTORY.json` ghi đủ 83 file đầu vào.

- Logo và mascot giữ path từ master SVG của kit.
- Wordmark đã outline, không phụ thuộc font cài trên máy.
- Các file mono của kit được lưu để đối chiếu; không dùng trực tiếp. Generator
  sửa thành một màu thật với mắt/miệng knockout.
- Token/copywriting là dữ liệu tham khảo; semantic runtime có thẩm quyền tại
  `src/web/styles/takosan-tokens.css`, không import thêm stylesheet từ kit.
- OG là raster chức năng đã kiểm tra; concept/preview/PDF không đưa vào public.

Chạy `pnpm brand:icons` để tạo lại 49 export tại `public/takosan/v3`.
Nunito self-host được cấp phép SIL OFL, manifest riêng trong runtime fonts.
Native preparation ở `../native`; chưa có app native hoặc chứng nhận thiết bị.

ZIP SHA256: `43f61f42c533c0f6632002b1e8a91421c4420d612b851d5b117753c42c86e942`.
PDF SHA256: `192ff21c9bb5672670a98f53f12843e74aa5b05249ccb9a31002cc326c15378f`.
