import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  NavScanApertureIcon,
  ReceiptScanIcon,
} from '../../design-system/icons';

export function ReviewHeading({
  receipt = false,
  confirmed = false,
}: {
  receipt?: boolean;
  confirmed?: boolean;
}) {
  const navigate = useNavigate();
  const ModeIcon = receipt ? ReceiptScanIcon : NavScanApertureIcon;

  return (
    <header className="review-heading !border-tk-stone/80 bg-white/80 backdrop-blur-md">
      <button
        type="button"
        className="kitchen-icon-link !rounded-2xl !border-tk-stone/85 !bg-white hover:!bg-tk-sunken transition-colors cursor-pointer"
        aria-label="Quay lại màn quét"
        onClick={() => navigate('/scan')}
      >
        <ArrowLeft size={20} aria-hidden="true" className="text-tk-ink" />
      </button>
      <div className="min-w-0">
        <p className="kitchen-eyebrow !text-tk-flame">
          <ModeIcon size={15} tone="flame" active />
          <span>
            {confirmed ? 'Bản quét đã xác nhận · Chỉ xem' : 'Thêm vào tủ · Bước 2 / 3'}
          </span>
        </p>
        <h1 className="font-heading text-tk-ink">
          {receipt ? 'Kiểm tra hóa đơn' : 'Kiểm tra nguyên liệu'}
        </h1>
        <p className="text-tk-secondary">
          {confirmed ? 'Xem lại thông tin đã xác nhận.' : 'Xem lại thông tin trước khi xác nhận.'}
        </p>
      </div>
    </header>
  );
}

export function ReviewSummary({
  total,
  accepted,
  confirmed,
}: {
  total: number;
  accepted: number;
  confirmed: boolean;
}) {
  return (
    <div
      className="review-summary !rounded-[24px] !border !border-tk-stone/85 !border-t-4 !border-t-tk-jade !bg-white shadow-card"
      aria-label="Tóm tắt bản quét"
    >
      <p className="kitchen-eyebrow !text-tk-jade">
        {confirmed ? 'Bản quét đã xác nhận' : 'Danh sách chờ bạn kiểm tra'}
      </p>
      <p className="review-summary-count text-tk-ink tk-tabular">
        {accepted}
        <span className="text-tk-secondary">
          {' '}
          / {total} dòng {confirmed ? 'đã nhận' : 'sẽ nhận'}
        </span>
      </p>
      <p className="text-tk-secondary">
        {total - accepted > 0 ? `${total - accepted} dòng bỏ qua. ` : ''}
        {confirmed
          ? 'Sửa lô đã lưu trong tủ lạnh nếu cần.'
          : 'Chỉ những dòng được nhận mới thêm vào tủ khi bạn xác nhận.'}
      </p>
      {!confirmed && (
        <p className="review-summary-note !border-tk-stone/75 !text-tk-muted">
          AI có thể đọc nhầm. Kiểm tra tên, lượng và đơn vị; chỉ nhập ngày trên nhãn khi bạn biết
          rõ.
        </p>
      )}
    </div>
  );
}
