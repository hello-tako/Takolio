import { containsVietnameseDiacritics, isViLocale, lSync } from '../i18n/app-i18n';

// T13 Inventory UX V2 presentation truth. These helpers are the single place
// the UI turns Inventory Truth semantics into user-facing language.
// They never invent a fact: UNKNOWN expiry is shown as unknown (not "fresh"),
// an ESTIMATED date is labelled as an estimate, and a missing price/date reads
// as unknown instead of 0₫ or today.

export type ExpiryKind = 'KNOWN' | 'BEST_BEFORE' | 'USE_BY' | 'ESTIMATED' | 'UNKNOWN';

export interface ExpiryPresentation {
  /** Stable token for tests and styling. */
  tone: 'unknown' | 'expired' | 'expiring' | 'estimated' | 'fresh';
  label: string;
  /** The date to show, or null when there is genuinely none. */
  date: string | null;
  /** True when the date is an estimate rather than a dated fact. */
  estimated: boolean;
}

function daysUntil(date: string, now: number): number {
  return Math.ceil((Date.parse(`${date}T00:00:00Z`) - now) / 86_400_000);
}

/**
 * Expiry presentation. An UNKNOWN expiry is never rendered as "fresh": with no
 * date there is no basis for a freshness claim, so it is shown as unknown and
 * invites a correction.
 */
export function presentExpiry(item: {
  expiryKind?: string | null; expiryAt?: string | null; estimatedExpiryDate?: string | null;
  estimatedExpiryAt?: string | null; expiryDate?: string | null;
}, now: number = Date.now()): ExpiryPresentation {
  const kind = (item.expiryKind ?? 'UNKNOWN') as ExpiryKind;
  const estimatedDate = item.estimatedExpiryAt ?? item.estimatedExpiryDate ?? null;
  const knownDate = item.expiryAt ?? (kind === 'ESTIMATED' ? null : item.expiryDate ?? null);

  if (kind === 'UNKNOWN' || (!knownDate && !estimatedDate)) {
    return {
      tone: 'unknown',
      label: lSync('Chưa rõ hạn dùng', 'Expiry unknown'),
      date: null,
      estimated: false,
    };
  }
  if (kind === 'ESTIMATED') {
    const date = estimatedDate ?? item.expiryDate ?? null;
    if (!date) {
      return {
        tone: 'unknown',
        label: lSync('Chưa rõ hạn dùng', 'Expiry unknown'),
        date: null,
        estimated: false,
      };
    }
    const days = daysUntil(date, now);
    if (days < 0) {
      return {
        tone: 'expired',
        label: lSync(`Ước tính đã quá hạn (${date})`, `Estimated expired (${date})`),
        date,
        estimated: true,
      };
    }
    if (days <= 2) {
      return {
        tone: 'expiring',
        label: lSync(`Ước tính sắp hết hạn (${date})`, `Estimated expiring soon (${date})`),
        date,
        estimated: true,
      };
    }
    return {
      tone: 'estimated',
      label: lSync(`Hạn ước tính ${date}`, `Estimated expiry ${date}`),
      date,
      estimated: true,
    };
  }
  const date = knownDate ?? estimatedDate;
  if (!date) {
    return {
      tone: 'unknown',
      label: lSync('Chưa rõ hạn dùng', 'Expiry unknown'),
      date: null,
      estimated: false,
    };
  }
  const days = daysUntil(date, now);
  if (days < 0) {
    return {
      tone: 'expired',
      label: lSync(`Đã quá hạn ${date}`, `Expired ${date}`),
      date,
      estimated: false,
    };
  }
  if (days <= 2) {
    return {
      tone: 'expiring',
      label: lSync(`Sắp hết hạn ${date}`, `Expiring soon ${date}`),
      date,
      estimated: false,
    };
  }
  return {
    tone: 'fresh',
    label: lSync(`Hạn dùng ${date}`, `Expires ${date}`),
    date,
    estimated: false,
  };
}

const PROVENANCE_LABELS: Record<string, readonly [string, string]> = {
  receipt: ['Từ hóa đơn', 'From receipt'],
  scan: ['Từ ảnh tủ lạnh', 'From fridge scan'],
  manual: ['Nhập thủ công', 'Manual entry'],
  shopping: ['Từ đi chợ', 'From shopping'],
  legacy: ['Dữ liệu cũ', 'Legacy data'],
};

/** Friendly provenance label; an unrecognized source is not guessed at. */
export function provenanceLabel(dataSource?: string | null): string {
  if (!dataSource) return lSync('Không rõ nguồn', 'Unknown source');
  const pair = PROVENANCE_LABELS[dataSource];
  return pair ? lSync(pair[0], pair[1]) : lSync('Nguồn khác', 'Other source');
}

/** Money that is genuinely unknown must never render as 0₫. */
export function presentPrice(amountVnd?: number | null): string {
  if (amountVnd === null || amountVnd === undefined || !Number.isFinite(amountVnd)) {
    return lSync('Không có giá', 'No price');
  }
  if (isViLocale()) {
    return `${Number(amountVnd).toLocaleString('vi-VN')}đ`;
  }
  return `${Number(amountVnd).toLocaleString('en-US')} VND`;
}

/** A missing purchase date reads as unknown, never as today. */
export function presentPurchaseDate(date?: string | null): string {
  return date ? date : lSync('Không rõ ngày mua', 'Purchase date unknown');
}

/**
 * Opening state (T13R-B P2-6). A NULL openedAt means no opening evidence was
 * recorded; it does not prove the item is sealed, so it is never rendered as
 * sealed. A recorded instant is shown as the opening date.
 */
export function presentOpenedState(openedAt?: string | null): string {
  if (typeof openedAt !== 'string' || openedAt.length < 10 || Number.isNaN(Date.parse(openedAt))) {
    return lSync('Chưa có thông tin', 'No record');
  }
  const date = openedAt.slice(0, 10);
  return lSync(`Đã mở ${date}`, `Opened ${date}`);
}

/** Model confidence the provider did not report is unknown, not high. */
export function presentConfidence(confidence?: number | null): {
  label: string; tone: 'unknown' | 'low' | 'medium' | 'high';
} {
  if (confidence === null || confidence === undefined || !Number.isFinite(confidence)) {
    return { label: lSync('Độ tin cậy: chưa rõ', 'Confidence: unknown'), tone: 'unknown' };
  }
  const percent = Math.round(confidence * 100);
  if (confidence < 0.5) {
    return {
      label: lSync(`Độ tin cậy thấp ${percent}%`, `Low confidence ${percent}%`),
      tone: 'low',
    };
  }
  if (confidence < 0.8) {
    return {
      label: lSync(`Độ tin cậy ${percent}%`, `Confidence ${percent}%`),
      tone: 'medium',
    };
  }
  return {
    label: lSync(`Độ tin cậy ${percent}%`, `Confidence ${percent}%`),
    tone: 'high',
  };
}

/**
 * Recoverable domain states get specific, actionable user text. `refetch`
 * marks the states where the client must reload authoritative state before the
 * user retries, instead of resubmitting a stale command.
 */
export interface DomainErrorPresentation { message: string; refetch: boolean }

const DOMAIN_ERRORS: Record<string, { vi: string; en: string; refetch: boolean }> = {
  INVENTORY_AUTHORITY_REQUIRED: {
    vi: 'Tủ lạnh này chưa bật quản lý theo lô. Hãy bật trước khi dùng tính năng này.',
    en: 'Lot tracking is not enabled for this fridge yet. Enable it before using this feature.',
    refetch: false,
  },
  // Conflict copy must not itself claim the reload succeeded; the caller
  // appends the truthful outcome via presentRefetchOutcome().
  CONFLICT: {
    vi: 'Nguyên liệu vừa được cập nhật ở nơi khác nên thay đổi của bạn chưa được lưu.',
    en: 'This item was updated elsewhere, so your changes were not saved.',
    refetch: true,
  },
  STALE_SNAPSHOT: {
    vi: 'Thông tin đã thay đổi kể từ lúc bạn mở nên thao tác chưa được thực hiện.',
    en: 'Details changed since you opened this view, so the action was not applied.',
    refetch: true,
  },
  ALREADY_DECIDED: {
    vi: 'Mục đối chiếu này đã được xử lý trước đó.',
    en: 'This reconciliation item was already resolved.',
    refetch: true,
  },
  UNIT_MISMATCH: {
    vi: 'Không thể quy đổi đơn vị này sang đơn vị đang lưu trong tủ.',
    en: 'Cannot convert this unit to the unit currently stored in your fridge.',
    refetch: false,
  },
  INSUFFICIENT_INVENTORY: {
    vi: 'Số lượng trong tủ không đủ cho thao tác này.',
    en: 'Not enough quantity in your fridge for this action.',
    refetch: true,
  },
  IDEMPOTENCY_CONFLICT: {
    vi: 'Yêu cầu này đã được dùng cho một thao tác khác nên chưa được thực hiện.',
    en: 'This request was already used for another action and was not applied.',
    refetch: true,
  },
  NOT_ACTIONABLE: {
    vi: 'Bằng chứng này hiện không có thao tác nào phù hợp.',
    en: 'No safe automatic action is available for this observation.',
    refetch: true,
  },
  REVIVE_REQUIRED: {
    vi: 'Lô này đã kết thúc. Cần khôi phục với số lượng cụ thể trước khi sửa.',
    en: 'This lot is depleted. Restore it with a specific quantity before editing.',
    refetch: true,
  },
  VALIDATION_ERROR: {
    vi: 'Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.',
    en: 'Invalid data. Please check your entries and try again.',
    refetch: false,
  },
  NOT_FOUND: {
    vi: 'Không tìm thấy mục này.',
    en: 'This item could not be found.',
    refetch: true,
  },
  FORBIDDEN: {
    vi: 'Bạn không có quyền với mục này.',
    en: 'You do not have permission to access this item.',
    refetch: false,
  },
};

/**
 * Map an ApiError code to user-readable text. Unknown codes fall back to a
 * generic message only when no specific domain code is available — never
 * raw JSON.
 */
export function presentDomainError(
  code: string | null | undefined,
  fallback?: string,
): DomainErrorPresentation {
  const defaultFallback = lSync(
    'Thao tác chưa thực hiện được. Vui lòng thử lại.',
    'Action could not be completed. Please try again.',
  );
  const resolvedFallback =
    fallback !== undefined
      ? isViLocale() || !containsVietnameseDiacritics(fallback)
        ? fallback
        : defaultFallback
      : defaultFallback;
  if (!code) return { message: resolvedFallback, refetch: false };
  const entry = DOMAIN_ERRORS[code];
  return entry
    ? { message: lSync(entry.vi, entry.en), refetch: entry.refetch }
    : { message: resolvedFallback, refetch: false };
}

/**
 * Truthful conflict recovery copy (T13R-B P2-4). The refresh claim is made
 * only when the authoritative reload actually succeeded; a failed reload says
 * so and asks for an explicit reload instead of pretending the screen is
 * current. Neither branch ever implies the mutation was retried.
 */
export function presentRefetchOutcome(presentation: DomainErrorPresentation,
  refetched: boolean | null): { message: string; refreshed: boolean } {
  if (!presentation.refetch || refetched === null) return { message: presentation.message, refreshed: false };
  return refetched
    ? {
        message: `${presentation.message} ${lSync(
          'Đã tải lại trạng thái mới nhất, vui lòng kiểm tra rồi thử lại.',
          'Reloaded the latest state — please review and try again.',
        )}`,
        refreshed: true,
      }
    : {
        message: `${presentation.message} ${lSync(
          'Chưa tải lại được trạng thái mới nhất — dữ liệu đang hiển thị có thể đã cũ. Vui lòng tải lại trước khi thử lại.',
          'Could not reload the latest state — displayed data may be outdated. Please reload before trying again.',
        )}`,
        refreshed: false,
      };
}
