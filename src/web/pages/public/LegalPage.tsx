import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { PublicLayout } from './PublicLayout';
import {
  AtelierBadge,
  BentoCard,
  SegmentedTabs,
} from '../../design-system/v4/AtelierPrimitives';

export interface LegalPageProps {
  doc?: 'privacy' | 'terms';
}

export const LegalPage: React.FC<LegalPageProps> = ({ doc }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const activeDoc: 'privacy' | 'terms' =
    doc ?? (pathname === '/terms' ? 'terms' : 'privacy');

  return (
    <PublicLayout dataTestId={`legal-${activeDoc}-page`}>
      <section className="mx-auto max-w-4xl px-4 sm:px-6 pt-10 pb-12 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AtelierBadge
            tone="jade"
            icon={<ShieldCheck className="w-3.5 h-3.5 text-tk-jade" aria-hidden="true" />}
          >
            Minh bạch Bảo mật & Quyền riêng tư Hộ gia đình
          </AtelierBadge>

          <SegmentedTabs<'privacy' | 'terms'>
            layoutId="legal-doc-tabs"
            value={activeDoc}
            onChange={(next) => navigate(next === 'terms' ? '/terms' : '/privacy')}
            options={[
              { value: 'privacy', label: 'Chính sách Bảo mật' },
              { value: 'terms', label: 'Điều khoản Sử dụng' },
            ]}
          />
        </div>

        {activeDoc === 'privacy' ? (
          <BentoCard tone="ceramic" padding="lg" className="space-y-6">
            <div className="border-b border-tk-stone pb-5 space-y-2">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-tk-ink">
                Chính sách Bảo mật Dữ liệu Takolio
              </h1>
              <p className="text-xs font-semibold text-tk-muted">
                Cập nhật lần cuối: Phiên bản Kiến trúc V4 · Áp dụng cho toàn bộ người dùng Takolio
              </p>
            </div>

            <div className="space-y-5 text-sm sm:text-base text-tk-secondary leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  1. Phân tách dữ liệu tuyệt đối theo Hộ gia đình (Household Isolation)
                </h2>
                <p>
                  Mọi dữ liệu tồn kho tủ lạnh, danh sách đi chợ, thực đơn tuần và khẩu vị dị ứng đều
                  được gắn khóa định danh hộ gia đình riêng biệt (<code>householdId</code>) và kiểm
                  chứng quyền sở hữu trên từng truy vấn máy chủ. Không hộ gia đình nào có thể đọc
                  hoặc ghi chéo dữ liệu của hộ gia đình khác.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  2. Mã hóa Cơ sở dữ liệu D1 & Xác thực Phiên HttpOnly
                </h2>
                <p>
                  Dữ liệu tài khoản, mật khẩu băm (PBKDF2/Argon2) và lịch sử thực đơn được lưu trữ
                  mã hóa ở trạng thái nghỉ (encryption-at-rest) trên hạ tầng Cloudflare D1. Phiên
                  đăng nhập sử dụng duy nhất cookie <code>HttpOnly; Secure; SameSite</code> — Takolio
                  tuyệt đối không lưu mã phiên hay mật khẩu dạng rõ trong <code>localStorage</code>.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  3. Tự động xóa ảnh Quét AI trên Cloudflare R2 sau 90 ngày
                </h2>
                <p>
                  Hình ảnh kệ tủ lạnh hoặc hóa đơn siêu thị bạn tải lên chỉ được sử dụng để trích
                  xuất danh sách nguyên liệu cho chính hộ gia đình bạn. Kho lưu trữ đối tượng
                  Cloudflare R2 áp dụng quy tắc vòng đời tự động xóa vĩnh viễn tệp ảnh gốc tối đa
                  sau <strong>90 ngày</strong> (hoặc ngay lập tức khi bạn yêu cầu xóa dữ liệu trong
                  mục Quyền riêng tư).
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  4. An toàn Thanh toán PayOS & VietQR
                </h2>
                <p>
                  Khi nâng cấp gói Takolio Plus, giao dịch chuyển khoản VietQR được xử lý trực tiếp
                  qua cổng thanh toán chuẩn ngân hàng PayOS kèm chữ ký HMAC xác thực hai chiều.
                  Takolio không bao giờ thu thập hay lưu trữ số thẻ tín dụng, mật khẩu ngân hàng
                  hoặc mã PIN của bạn.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  5. Quyền xuất & xóa toàn bộ dữ liệu của bạn
                </h2>
                <p>
                  Bạn toàn quyền xuất bản sao dữ liệu tồn kho, thói quen ăn uống hoặc yêu cầu xóa
                  hoàn toàn tài khoản bất cứ lúc nào ngay tại trang{' '}
                  <strong>Cài đặt → Quyền riêng tư & Dữ liệu</strong> mà không cần gửi email chờ xét
                  duyệt thủ công.
                </p>
              </section>
            </div>
          </BentoCard>
        ) : (
          <BentoCard tone="ceramic" padding="lg" className="space-y-6">
            <div className="border-b border-tk-stone pb-5 space-y-2">
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-tk-ink">
                Điều khoản Sử dụng Dịch vụ Takolio
              </h1>
              <p className="text-xs font-semibold text-tk-muted">
                Cập nhật lần cuối: Phiên bản Kiến trúc V4 · Minh bạch & tôn trọng người nội trợ
              </p>
            </div>

            <div className="space-y-5 text-sm sm:text-base text-tk-secondary leading-relaxed">
              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  1. Phạm vi dịch vụ & Trách nhiệm kiểm tra thực phẩm
                </h2>
                <p>
                  Takolio cung cấp công cụ hỗ trợ quản lý nguyên liệu, gợi ý công thức nấu ăn và ước
                  tính thời hạn bảo quản. Các thông tin nhận diện từ AI Vision, OCR hóa đơn và hạn
                  dùng ước tính chỉ mang tính chất tham khảo hỗ trợ; người dùng luôn kiểm tra cảm
                  quan thực tế và nhãn bao bì gốc trước khi chế biến, đặc biệt với trẻ nhỏ và người
                  có cơ địa dị ứng nghiêm trọng.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  2. Tài khoản Gia đình & Phiên trải nghiệm Khách
                </h2>
                <p>
                  Bạn có thể trải nghiệm Takolio ở chế độ Khách trước khi đăng ký. Khi tạo tài khoản
                  chính thức bằng Email OTP hoặc Google, bạn cam kết cung cấp địa chỉ email hợp lệ
                  và bảo mật quyền truy cập thiết bị khi chia sẻ mã mời hộ gia đình cho người thân.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  3. Gói dịch vụ Takolio Plus & Chính sách Thanh toán
                </h2>
                <p>
                  Gói Takolio Miễn phí luôn mở đầy đủ tính năng quản lý tủ lạnh FEFO, công thức và
                  thực đơn tuần. Gói <strong>Takolio Plus</strong> (49.000đ/tháng hoặc 499.000đ/năm)
                  cung cấp hạn mức 100 lượt Quét AI Vision & OCR Hóa đơn mỗi chu kỳ tháng. Quyền lợi
                  Plus được kích hoạt tự động ngay sau khi cổng PayOS xác nhận thanh toán thành công
                  và không tự động trừ tiền ngầm trái phép.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-lg font-extrabold text-tk-ink">
                  4. Sử dụng công bằng & Bảo vệ hệ thống
                </h2>
                <p>
                  Người dùng cam kết không sử dụng công cụ tự động hóa để khai thác trái phép kho dữ
                  liệu công thức, làm quá tải cổng AI Sous-Chef hoặc tải lên nội dung vi phạm pháp
                  luật Việt Nam.
                </p>
              </section>
            </div>
          </BentoCard>
        )}
      </section>
    </PublicLayout>
  );
};
