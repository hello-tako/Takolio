# Native Icon Preparation

App hiện tại là PWA; những file này không tạo dự án native hoặc thay configuration.
iOS PNG 1024x1024 opaque, xuất từ SVG master; background đã mapping Leaf Green V3.
Android background/foreground giữ safe geometry canonical. Phải chuyển layer SVG
sang Android VectorDrawable/PNG theo build native trong tương lai; không gọi các
SVG này là adaptive-icon XML đã cài đặt. Launcher circle/squircle crop chưa kiểm
trên thiết bị thật. PWA maskable runtime có kiểm pixel safe circle riêng.
