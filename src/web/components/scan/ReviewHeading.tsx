import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocaleText } from '../../i18n/app-i18n';

export function ReviewHeading({
  receipt = false,
  confirmed = false,
}: {
  receipt?: boolean;
  confirmed?: boolean;
}) {
  const navigate = useNavigate();
  const { l } = useLocaleText();
  return (
    <header className="review-heading">
      <button
        type="button"
        className="kitchen-icon-link"
        aria-label={l('Quay lại màn quét', 'Back to scanner')}
        onClick={() => navigate('/scan')}
      >
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
      <div>
        <p className="kitchen-eyebrow">
          {confirmed
            ? l('Bản quét đã xác nhận · Chỉ xem', 'Confirmed scan · Read-only')
            : l('Thêm vào tủ · Bước 2 / 3', 'Add to fridge · Step 2 of 3')}
        </p>
        <h1>
          {receipt
            ? l('Kiểm tra hóa đơn', 'Review receipt')
            : l('Kiểm tra nguyên liệu', 'Review ingredients')}
        </h1>
        <p>
          {confirmed
            ? l('Xem lại thông tin đã xác nhận.', 'Review the details you confirmed.')
            : l('Xem lại thông tin trước khi xác nhận.', 'Review details before confirming.')}
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
  const { l } = useLocaleText();
  return (
    <div className="review-summary" aria-label={l('Tóm tắt bản quét', 'Scan summary')}>
      <p className="kitchen-eyebrow">
        {confirmed
          ? l('Bản quét đã xác nhận', 'Confirmed scan')
          : l('Danh sách chờ bạn kiểm tra', 'Items ready for review')}
      </p>
      <p className="review-summary-count">
        {accepted}
        <span>
          {' '}
          {l(
            `/ ${total} dòng ${confirmed ? 'đã nhận' : 'sẽ nhận'}`,
            `/ ${total} ${total === 1 ? 'line' : 'lines'} ${confirmed ? 'confirmed' : 'selected'}`,
          )}
        </span>
      </p>
      <p>
        {total - accepted > 0
          ? l(`${total - accepted} dòng bỏ qua. `, `${total - accepted} skipped. `)
          : ''}
        {confirmed
          ? l('Sửa lô đã lưu trong tủ lạnh nếu cần.', 'Edit saved lots in your fridge if needed.')
          : l(
              'Chỉ những dòng được nhận mới thêm vào tủ khi bạn xác nhận.',
              'Only selected lines will be added to your fridge when you confirm.',
            )}
      </p>
      {!confirmed && (
        <p className="review-summary-note">
          {l(
            'AI có thể đọc nhầm. Kiểm tra tên, lượng và đơn vị; chỉ nhập ngày trên nhãn khi bạn biết rõ.',
            'AI can make mistakes. Check names, quantities, and units; only enter label dates you are sure about.',
          )}
        </p>
      )}
    </div>
  );
}
