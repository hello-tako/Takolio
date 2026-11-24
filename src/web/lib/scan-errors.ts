import { ApiError } from '../services/http';
import { isViLocale, lSync } from '../i18n/app-i18n';

export type ScanErrorContext = 'fridge' | 'food' | 'receipt';
export type ScanQuota = { plan: string; limit: number; used: number; remaining: number; resetAt: string };

const quality: Record<ScanErrorContext, readonly [string, string]> = {
  receipt: [
    'Không đọc được dòng hàng đủ rõ. Hãy chụp toàn bộ hóa đơn, thẳng và đủ sáng.',
    'Could not read the receipt items clearly. Please capture the full receipt straight-on in good lighting.',
  ],
  fridge: [
    'Ảnh chưa đủ rõ để nhận diện thực phẩm. Hãy chụp gần hơn, đủ sáng và tránh lóa.',
    'Photo is not clear enough to detect ingredients. Try shooting closer with good lighting and less glare.',
  ],
  food: [
    'Ảnh chưa đủ rõ để nhận diện thực phẩm. Hãy chụp gần hơn, đủ sáng và tránh lóa.',
    'Photo is not clear enough to detect ingredients. Try shooting closer with good lighting and less glare.',
  ],
};

function resetDate(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(isViLocale() ? 'vi-VN' : 'en-US', { timeZone: 'UTC' });
}

export function scanErrorMessage(
  code: string | null | undefined,
  context: ScanErrorContext,
  options: { quota?: ScanQuota | null; requestId?: string | null; resetAt?: string | null } = {},
): string {
  const resetAt = resetDate(options.resetAt || options.quota?.resetAt);
  const quotaLimit = options.quota?.plan === 'free' ? options.quota.limit : null;
  let message: string;
  switch (code) {
    case 'SCAN_QUOTA_EXCEEDED':
      message = quotaLimit === null
        ? lSync(
            `Hạn mức quét của gói hiện tại đã hết.${resetAt ? ` Lượt mới sẽ mở lại vào ${resetAt}.` : ''}`,
            `You have reached the scan limit for your current plan.${resetAt ? ` Quota resets on ${resetAt}.` : ''}`,
          )
        : lSync(
            `Bạn đã dùng hết ${quotaLimit} lượt quét miễn phí trong tháng này.${resetAt ? ` Lượt mới sẽ mở lại vào ${resetAt}.` : ''}`,
            `You have used all ${quotaLimit} free scans for this month.${resetAt ? ` Quota resets on ${resetAt}.` : ''}`,
          );
      break;
    case 'RATE_LIMIT_EXCEEDED':
    case 'RATE_LIMITED':
      message = lSync(
        'Yêu cầu đang bị giới hạn tạm thời. Vui lòng thử lại sau ít phút.',
        'Requests are temporarily rate-limited. Please try again in a few minutes.',
      );
      break;
    case 'RATE_LIMIT_UNAVAILABLE':
    case 'QUOTA_UNAVAILABLE':
      message = lSync(
        'Chưa thể kiểm tra hạn mức quét. Vui lòng thử lại sau.',
        'Unable to check your scan quota right now. Please try again later.',
      );
      break;
    case 'PAYLOAD_TOO_LARGE':
    case 'AI_IMAGE_TOO_LARGE':
    case 'QUEUE_PAYLOAD_TOO_LARGE':
      message = lSync(
        'Ảnh quá lớn để xử lý. Hãy chọn ảnh có dung lượng nhỏ hơn.',
        'Image is too large to process. Please choose a smaller photo.',
      );
      break;
    case 'IMAGE_REQUIRED':
      message = lSync('Hãy chọn một ảnh để quét.', 'Please select a photo to scan.');
      break;
    case 'IMAGE_STORAGE_FAILED':
    case 'IMAGE_UNAVAILABLE':
    case 'IMAGE_NOT_FOUND':
      message = lSync(
        'Ảnh quét không còn khả dụng. Hãy chọn và tải lên ảnh mới.',
        'The scan photo is no longer available. Please select and upload a new photo.',
      );
      break;
    case 'QUEUE_UNAVAILABLE':
      message = lSync(
        'Chưa thể xếp hàng xử lý. Hãy kiểm tra lại trạng thái bản quét trước khi gửi lại.',
        'Could not queue the scan for processing. Check the scan status before retrying.',
      );
      break;
    case 'REQUEST_TIMEOUT':
    case 'AI_SCAN_TIMEOUT':
      message = context === 'receipt'
        ? lSync(
            'Dịch vụ đọc hóa đơn phản hồi quá lâu. Bản quét lỗi không trừ lượt quét.',
            'Receipt scanning took too long to respond. Failed scans do not count against your quota.',
          )
        : lSync(
            'Dịch vụ nhận diện phản hồi quá lâu. Bản quét lỗi không trừ lượt quét.',
            'Ingredient detection took too long to respond. Failed scans do not count against your quota.',
          );
      break;
    case 'NETWORK_ERROR':
      message = lSync(
        'Dịch vụ quét bị mất kết nối. Hãy kiểm tra lại trạng thái trước khi gửi lại.',
        'Lost connection to the scan service. Check status before retrying.',
      );
      break;
    case 'UPSTREAM_ERROR':
    case 'AI_SCAN_UNAVAILABLE':
    case 'AI_UNAVAILABLE':
    case 'MODEL_NOT_FOUND':
    case 'AUTHENTICATION_FAILED':
    case 'PERMISSION_DENIED':
    case 'LICENSE_REQUIRED':
    case 'MAX_ATTEMPTS_EXCEEDED':
    case 'RESERVATION_EXPIRED':
      message = lSync(
        'Dịch vụ AI đang tạm thời không khả dụng. Bản quét lỗi không trừ lượt quét.',
        'AI service is temporarily unavailable. Failed scans do not count against your quota.',
      );
      break;
    case 'INVALID_RESPONSE':
    case 'SCHEMA_VALIDATION':
    case 'AI_SCAN_NO_USABLE_ITEMS':
      message = lSync(quality[context][0], quality[context][1]);
      break;
    case 'IDEMPOTENCY_CONFLICT':
      message = lSync(
        'Ảnh hoặc chế độ quét đã thay đổi. Hãy bắt đầu một lượt quét mới.',
        'The photo or scan mode changed. Please start a new scan.',
      );
      break;
    case 'DATABASE_ERROR':
      message = lSync(
        'Chưa thể lưu bản quét. Vui lòng thử lại sau.',
        'Could not save the scan. Please try again later.',
      );
      break;
    case 'SCAN_FAILED':
      message = lSync(
        'Bản quét trước đã thất bại. Hãy tạo lượt quét mới.',
        'The previous scan failed. Please start a new scan.',
      );
      break;
    default:
      message = context === 'receipt'
        ? lSync(
            'Chưa thể xử lý hóa đơn. Vui lòng thử lại sau.',
            'Could not process the receipt. Please try again later.',
          )
        : lSync(
            'Chưa thể xử lý bản quét. Vui lòng thử lại sau.',
            'Could not process the scan. Please try again later.',
          );
  }
  const requestId = options.requestId?.match(/^[A-Za-z0-9_-]{8,64}$/)?.[0];
  return requestId
    ? `${message} ${lSync(`Mã hỗ trợ: ${requestId.slice(0, 12)}.`, `Support ID: ${requestId.slice(0, 12)}.`)}`
    : message;
}

export function scanApiErrorMessage(error: unknown, context: ScanErrorContext, quota?: ScanQuota | null): string {
  if (!(error instanceof ApiError)) return scanErrorMessage(null, context, { quota });
  if (error.kind === 'offline' && error.retryable) return scanErrorMessage('NETWORK_ERROR', context, { quota });
  const resetAt = typeof error.payload?.resetAt === 'string' ? error.payload.resetAt : null;
  const serverQuota = error.payload?.quota;
  const authoritativeQuota = serverQuota && typeof serverQuota === 'object'
    ? serverQuota as ScanQuota : quota;
  return scanErrorMessage(error.code, context, { quota: authoritativeQuota, requestId: error.requestId, resetAt });
}
