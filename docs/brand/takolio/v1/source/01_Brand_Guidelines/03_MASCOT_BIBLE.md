# Tako - Mascot Bible

## Character DNA
Đầu và thân liền khối, cân đối tròn. Màu san hô nổi bật, highlight trắng mềm, má hồng nhạt, mắt navy-đen có catchlight trắng. 8 xúc tu mềm tròn, không nhọn. Mũ đầu bếp trắng kem với lá xanh. Yếm kem có lá xanh cho các cảnh full-body. Không dùng biểu cảm hung dữ, cạnh sắc hoặc quá nhiều phụ kiện.

## Silhouette, chi tiết cần khóa
- Ở góc chính diện: đầu dạng khối tròn mềm hơi cao, 2 mắt lớn cân xứng/biểu cảm nháy mắt.
- Hat khoảng **22–30% tổng chiều cao** khi tính cả nón, không làm quá cao vượt nội dung UI.
- Xúc tu đọc rõ theo hình cung, hoạt họa uốn lượn; khi lên icon thu gọn xúc tu và bỏ yếm/tô.
- Không đổi vị trí biểu tượng lá (trên hat và yếm) tùy tiện.
- Palette mascot bổ sung: Blush `#FFB3B3`; Apron `#E6E1D9`; Wood `#D99055`; Accent `#FFC94B`.

## State matrix
| State | Biểu cảm | Props | Dùng ở đâu |
|---|---|---|---|
| welcome | vẫy tay, một mắt nháy | trái tim nhỏ | onboarding, welcome |
| cooking | mở mắt tập trung | muỗng, tô thức ăn | recipes, cooking |
| thinking | tròn mắt, dấu hỏi | dấu hỏi | AI processing/decision |
| excited | biểu cảm yêu thích | trái tim | feedback, favorite |
| completed | nháy mắt vui, hiệu ứng | bát, sparkle | hoàn thành kế hoạch |
| cheering | nở nụ cười, confetti | sao vàng | thành tựu |
| side/back/3-4 | góc nhìn nhân vật | không | character turnaround |

## Lớp cần cho bản final cao cấp
1. Xúc tu sau 2. Thân 3. Xúc tu trước 4. Facial features 5. Nón 6. Yếm 7. Phụ kiện 8. Ánh sáng và bóng tiếp xúc.
Bản nguồn kit là SVG shape/gradient, dễ chỉnh; muốn render 3D nên dùng Blender hoặc tương đương để dựng lại từ silhouette. Cần kiểm tra consistency front/side/back trước khi kết xuất trạng thái.

## Deliverable nâng cấp cần agent thực hiện
- Production 3D master file gốc có thể sửa, texture/material, pose controls, light rig; 4 góc nhìn; 6 pose PNG alpha >= 2048²; icon simp ở 64px; file pose list.
- Không đánh dấu phần nâng cấp 3D là DONE nếu chỉ có raster/board minh họa.
