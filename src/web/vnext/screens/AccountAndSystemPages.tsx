import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';

const LEGACY_NAME_RE = /^Người dùng\s+Fri\w*$/i;
function sanitizeUserDisplayName(raw: string | undefined | null, isGuest = false): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return isGuest ? 'Người dùng Takolio' : 'Bếp trưởng';
  if (LEGACY_NAME_RE.test(trimmed)) return 'Bếp trưởng';
  return raw as string;
}
import { queryKeys } from '../../lib/queryKeys';
import { getPendingOps } from '../../lib/sync';
import { FoodPreferencesPage } from '../../pages/settings/FoodPreferencesPage';
import { PlanningSettingsPage } from '../../pages/settings/PlanningSettingsPage';
import { SettingsPage } from '../../pages/SettingsPage';
import { NotificationPreferencesPage } from '../../pages/settings/NotificationPreferencesPage';
import { PlusPaywallPage } from '../../pages/PlusPaywallPage';
import { vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvBadge,
  TkvButton,
  TkvEmptyState,
  TkvErrorState,
  TkvSkeleton,
  TkvSurface,
} from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import { MascotIllustration } from '../components/VNextMedia';

function relativeTimeVi(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  return `${Math.round(hours / 24)} ngày trước`;
}

/**
 * C30 — Thông báo căn bếp (`/notifications`).
 * Displays real household notifications from `api.getNotifications()` without inventing unread counters.
 */
export const C30NotificationsVNext: React.FC = () => {
  useVNextSeo({
    title: 'Thông báo căn bếp',
    description: 'Nhắc nhở nguyên liệu nên dùng sớm và gợi ý thao tác từ dữ liệu thật của hộ gia đình.',
    canonicalPath: '/notifications',
    domainSurface: 'app',
    noindex: true,
  });

  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => api.getNotifications(),
  });

  const list = notificationsQuery.data ?? [];

  return (
    <ConsumerStudioShell screenId="C30" title="Thông báo căn bếp" backTo={vnextHref('/me')}>
      <div className="max-w-3xl space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#87776E)]">
              Nhắc nhở từ trạng thái thực tế
            </p>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)] mt-0.5">
              Thông báo căn bếp
            </h1>
          </div>
          <Link
            to={vnextHref('/settings/notifications')}
            className="tkv-focusable min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--tkv-border,#EAE0D5)] hover:border-[var(--tkv-border-strong,#D5C3B3)] bg-white text-xs font-bold text-[var(--tkv-ink,#2C221E)] inline-flex items-center gap-1.5 transition-colors"
          >
            <VNextIcon name="settings" size={15} />
            <span>Cài đặt thông báo</span>
          </Link>
        </div>

        {notificationsQuery.isPending ? (
          <div className="space-y-3">
            <TkvSkeleton className="h-24" label="Đang tải thông báo căn bếp…" />
            <TkvSkeleton className="h-24" label="Đang tải thông báo căn bếp…" />
          </div>
        ) : notificationsQuery.isError ? (
          <TkvErrorState
            title="Chưa tải được thông báo"
            message="Không thể đọc danh sách nhắc nhở từ máy chủ lúc này."
            onRetry={() => void notificationsQuery.refetch()}
          />
        ) : list.length === 0 ? (
          <TkvEmptyState
            pose="welcome"
            title="Căn bếp đang êm ả"
            description="Hiện chưa có cảnh báo hạn dùng hay nhắc nhở mới cho hộ gia đình của bạn."
            primaryAction={
              <Link
                to={vnextHref('/fridge')}
                className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white shadow-xs font-semibold text-sm inline-flex items-center transition-colors"
              >
                Kiểm tra tủ lạnh
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3" aria-label="Danh sách thông báo">
            {list.map((item) => {
              const icon: VNextIconName =
                item.type === 'expiring_soon'
                  ? 'timer'
                  : item.type === 'shopping_reminder'
                    ? 'shopping'
                    : 'recipes';
              return (
                <li key={item.id}>
                  <TkvSurface className="p-4 sm:p-5 flex items-start justify-between gap-4 bg-white border-[var(--tkv-border,#EAE0D5)]">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <span className="relative w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center shrink-0">
                        <VNextIcon name={icon} size={20} />
                        {item.type === 'expiring_soon' && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--tkv-honey,#C68634)]" aria-hidden="true" />
                        )}
                      </span>
                      <div className="space-y-1 min-w-0">
                        <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#2C221E)]">
                          {item.title}
                        </p>
                        <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
                          {item.message}
                        </p>
                        {item.createdAt && (
                          <p className="text-xs text-[var(--tkv-ink-muted,#87776E)] tabular-nums">
                            {relativeTimeVi(item.createdAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </TkvSurface>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ConsumerStudioShell>
  );
};

/**
 * U01 — Hồ sơ cá nhân (`/me` & `/profile`).
 * Matches U01.png 1:1 while preserving session-fenced logout and guest upgrade CTAs.
 */
export const U01ProfileHubVNext: React.FC = () => {
  const navigate = useNavigate();
  const {
    displayName,
    email,
    householdId,
    householdSize,
    isGuest,
    isPlus,
    logout,
    logoutStatus,
    logoutError,
  } = useAuthStore();

  useVNextSeo({
    title: 'Hồ sơ cá nhân',
    description: 'Quản lý tài khoản, hộ gia đình, thông báo, gói Pro và cài đặt quyền riêng tư trên Takolio.',
    canonicalPath: '/me',
    domainSurface: 'app',
    noindex: true,
  });

  const handleLogout = async () => {
    const ok = await logout();
    if (ok) {
      navigate(vnextHref('/landing'), { replace: true });
    }
  };

  const navRows: Array<{
    id: string;
    icon: VNextIconName;
    title: string;
    subtitle: string;
    to: string;
    badge?: string;
  }> = [
    {
      id: 'u02',
      icon: 'recipes',
      title: 'Sở thích món ăn',
      subtitle: `Khẩu phần ${householdSize} người · Ẩm thực & mức cay`,
      to: vnextHref('/me/preferences'),
    },
    {
      id: 'u06',
      icon: 'users',
      title: 'Hộ gia đình',
      subtitle: 'Mã hộ hiện tại & trạng thái chia sẻ thành viên',
      to: vnextHref('/me/household'),
    },
    {
      id: 'c30',
      icon: 'notification',
      title: 'Thông báo',
      subtitle: 'Xem nhắc nhở hạn dùng thực phẩm & cấu hình thông báo',
      to: vnextHref('/notifications'),
    },
    {
      id: 'u07',
      icon: 'crown',
      title: 'Takolio Pro',
      subtitle: 'Xem quyền lợi và trạng thái gói dịch vụ chính thức từ máy chủ',
      to: vnextHref('/plus'),
      badge: isPlus ? 'Đang hoạt động' : undefined,
    },
    {
      id: 'u03',
      icon: 'calendar',
      title: 'Cài đặt thực đơn',
      subtitle: 'Ngày nấu mặc định và thời gian chuẩn bị bữa ăn',
      to: vnextHref('/settings/planning'),
    },
    {
      id: 'u04',
      icon: 'settings',
      title: 'Cài đặt ứng dụng',
      subtitle: 'Tùy chọn hiển thị trên thiết bị và cập nhật PWA',
      to: vnextHref('/settings/app'),
    },
    {
      id: 'u09',
      icon: 'privacy',
      title: 'Quyền riêng tư & Xuất/xóa dữ liệu',
      subtitle: 'Phân tách dữ liệu hộ gia đình, sự đồng ý và quyền dữ liệu',
      to: vnextHref('/settings/privacy'),
    },
  ];

  const cleanDisplayName = sanitizeUserDisplayName(displayName, isGuest);

  return (
    <ConsumerStudioShell screenId="U01" title="Hồ sơ cá nhân">
      <div className="max-w-3xl space-y-6">
        <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
          Hồ sơ cá nhân
        </h1>

        {/* Identity Summary Card */}
        <TkvSurface className="p-5 sm:p-6 bg-gradient-to-br from-[var(--tkv-linen-from,#FFFDFB)] to-[var(--tkv-surface-muted,#F7EFE6)] border-[var(--tkv-border,#EAE0D5)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <MascotIllustration pose="welcome" size={64} className="border border-[var(--tkv-border,#EAE0D5)] bg-white shrink-0" />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="tkv-heading text-lg sm:text-xl font-extrabold text-[var(--tkv-ink,#2C221E)] truncate">
                  {cleanDisplayName}
                </h2>
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                    isPlus && !isGuest
                      ? 'bg-[var(--tkv-accent-soft,#FDF0EA)] text-[var(--tkv-accent-ink,#9E4322)] border-[var(--tkv-accent-border,#F2D5C7)]'
                      : isGuest
                        ? 'bg-[var(--tkv-honey-soft,#FCF5E6)] text-[var(--tkv-honey-ink,#8C5B18)] border-[var(--tkv-honey-border,#EDD9B4)]'
                        : 'bg-[var(--tkv-sage-soft,#EEF5F0)] text-[var(--tkv-sage-ink,#355940)] border-[var(--tkv-sage-border,#CFE2D5)]',
                  )}
                >
                  <span
                    className={clsx(
                      'w-1.5 h-1.5 rounded-full',
                      isPlus && !isGuest
                        ? 'bg-[var(--tkv-primary,#D86A43)]'
                        : isGuest
                          ? 'bg-[var(--tkv-honey,#C68634)]'
                          : 'bg-[var(--tkv-sage,#4E7A5B)]',
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    {isGuest ? 'Phiên dùng thử khách' : isPlus ? 'Takolio Pro' : 'Tài khoản đã xác thực'}
                  </span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#5F524A)] truncate">
                {isGuest ? 'Chưa liên kết email · Đăng ký để lưu dữ liệu lâu dài' : email}
              </p>
              {householdId && (
                <p className="text-[11px] font-mono tabular-nums text-[var(--tkv-ink-muted,#87776E)] truncate">
                  Mã hộ: {householdId}
                </p>
              )}
            </div>
          </div>

          {isGuest && (
            <TkvButton
              variant="primary"
              size="sm"
              onClick={() => navigate(vnextHref('/auth?mode=register'))}
            >
              Tạo tài khoản
            </TkvButton>
          )}
        </TkvSurface>

        {/* Navigation List */}
        <ul className="space-y-2.5" aria-label="Danh mục tài khoản và cài đặt">
          {navRows.map((row) => (
            <li key={row.id}>
              <Link
                to={row.to}
                className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-white border border-[var(--tkv-border,#EAE0D5)] p-4 hover:border-[var(--tkv-border-strong,#D5C3B3)] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center shrink-0">
                      <VNextIcon name={row.icon} size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#2C221E)]">
                          {row.title}
                        </p>
                        {row.badge && <TkvBadge tone="success">{row.badge}</TkvBadge>}
                      </div>
                      <p className="text-xs text-[var(--tkv-ink-soft,#5F524A)] truncate tabular-nums">{row.subtitle}</p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted,#87776E)] shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {logoutError && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-sm text-[var(--tkv-accent-ink,#9E4322)] font-semibold flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#D86A43)] shrink-0" aria-hidden="true" />
            <span>{logoutError}</span>
          </div>
        )}

        <div className="pt-2">
          <TkvButton
            variant="quiet"
            size="md"
            isLoading={logoutStatus === 'pending'}
            onClick={() => void handleLogout()}
          >
            Đăng xuất khỏi thiết bị này
          </TkvButton>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

/** U02 — Sở thích món ăn (`/me/preferences`, `/settings/food`). */
export const U02FoodPrefsVNext: React.FC = () => (
  <ConsumerStudioShell screenId="U02" title="Sở thích món ăn" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
      <FoodPreferencesPage />
    </div>
  </ConsumerStudioShell>
);

/** U03 — Cài đặt thực đơn (`/settings/planning`). */
export const U03PlanningSettingsVNext: React.FC = () => (
  <ConsumerStudioShell screenId="U03" title="Cài đặt thực đơn" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
      <PlanningSettingsPage />
    </div>
  </ConsumerStudioShell>
);

/** U04 — Cài đặt ứng dụng (`/settings/app`, `/settings`). */
export const U04AppSettingsVNext: React.FC = () => (
  <ConsumerStudioShell screenId="U04" title="Cài đặt ứng dụng" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
      <SettingsPage />
    </div>
  </ConsumerStudioShell>
);

/** U05 — Cài đặt thông báo (`/settings/notifications`). */
export const U05NotificationPrefsVNext: React.FC = () => (
  <ConsumerStudioShell screenId="U05" title="Cài đặt thông báo" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
      <NotificationPreferencesPage />
    </div>
  </ConsumerStudioShell>
);

/**
 * U06 — Hộ gia đình (`/me/household`, `/family`).
 * Matches U06.png 1:1 AND Owner Decision 4 (`BLOCKED_BACKEND` `RFC-001`):
 * Displays real active `householdId` and household size while honestly marking
 * invite/join/member-list actions as `Chưa hỗ trợ API` (zero fake invite codes!).
 */
export const U06HouseholdHonestPage: React.FC = () => {
  const { householdId, householdSize, isGuest } = useAuthStore();

  useVNextSeo({
    title: 'Hộ gia đình',
    description: 'Thông tin mã hộ gia đình hiện tại và trạng thái tính năng chia sẻ thành viên.',
    canonicalPath: '/me/household',
    domainSurface: 'app',
    noindex: true,
  });

  const unavailableItems = [
    {
      title: 'Mời thành viên · Chưa hỗ trợ API',
      detail: 'Cần API mã mời có thời hạn và phân quyền chủ hộ / thành viên (đã lập đặc tả RFC-001).',
      icon: 'mail' as const,
    },
    {
      title: 'Tham gia hộ khác · Chưa hỗ trợ API',
      detail: 'Cần quy trình chuyển hộ an toàn không làm rò rỉ hoặc mất tồn kho hiện tại (RFC-001).',
      icon: 'swap' as const,
    },
    {
      title: 'Danh sách thành viên · Chưa hỗ trợ API',
      detail: 'Máy chủ hiện lưu mã hộ cho phiên của bạn, chưa cung cấp điểm cuối liệt kê/thu hồi thành viên.',
      icon: 'users' as const,
    },
  ];

  return (
    <ConsumerStudioShell screenId="U06" title="Hộ gia đình" backTo={vnextHref('/me')}>
      <div className="max-w-3xl space-y-6">
        <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
          Hộ gia đình
        </h1>

        {/* Active Household Card */}
        <TkvSurface className="p-5 sm:p-6 space-y-3 bg-[var(--tkv-surface-muted,#F7EFE6)] border-[var(--tkv-border,#EAE0D5)]">
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] text-xs font-semibold text-[var(--tkv-honey-ink,#8C5B18)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#C68634)]" aria-hidden="true" />
            <span>BLOCKED_BACKEND · RFC-001 đang chờ triển khai tầng máy chủ</span>
          </span>
          <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
            Hộ gia đình hiện tại
          </h2>
          <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)]">
            Mời, tham gia hộ khác và quản lý danh sách thành viên cần API máy chủ mới để bảo đảm cô lập dữ liệu.
          </p>
          <div className="rounded-2xl bg-white border border-[var(--tkv-border,#EAE0D5)] p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-semibold text-[var(--tkv-ink-soft,#5F524A)]">Mã hộ hiện tại</span>
              <code className="font-mono text-xs font-bold tabular-nums text-[var(--tkv-ink,#2C221E)] bg-[var(--tkv-bg,#FCF9F5)] border border-[var(--tkv-border,#EAE0D5)] px-2.5 py-1 rounded-lg">
                {householdId || 'Chưa khởi tạo'}
              </code>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--tkv-border,#EAE0D5)] pt-2">
              <span className="font-semibold text-[var(--tkv-ink-soft,#5F524A)]">Khẩu phần nấu mặc định</span>
              <strong className="text-[var(--tkv-ink,#2C221E)] tabular-nums">{householdSize} người</strong>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--tkv-border,#EAE0D5)] pt-2">
              <span className="font-semibold text-[var(--tkv-ink-soft,#5F524A)]">Loại phiên</span>
              <strong className="text-[var(--tkv-ink,#2C221E)]">
                {isGuest ? 'Phiên khách cục bộ' : 'Tài khoản đã đăng ký'}
              </strong>
            </div>
          </div>
        </TkvSurface>

        {/* Honest Unavailable Feature Rows */}
        <div className="space-y-3" aria-label="Các tính năng chia sẻ hộ gia đình chưa mở">
          {unavailableItems.map((it) => (
            <TkvSurface key={it.title} className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#EAE0D5)]">
              <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center shrink-0 border border-[var(--tkv-accent-border,#F2D5C7)]">
                <VNextIcon name={it.icon} size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#2C221E)]">{it.title}</p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
                  {it.detail}
                </p>
              </div>
            </TkvSurface>
          ))}
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

/**
 * U07 / U08 — Takolio Plus & Trạng thái thanh toán (`/plus`).
 * Protected Red Zone: renders the untouched `PlusPaywallPage` inside `ConsumerStudioShell`
 * without altering a single byte of PayOS/VietQR/billing logic!
 */
export const U07U08PlusReadOnlyWrapper: React.FC = () => (
  <ConsumerStudioShell screenId="U07" title="Takolio Pro" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
      <PlusPaywallPage />
    </div>
  </ConsumerStudioShell>
);

/**
 * U09 / U10 — Quyền riêng tư & Xuất/xóa dữ liệu (`/settings/privacy`).
 * Matches U09.png + U10.png 1:1 AND Owner Decision 4 (`BLOCKED_BACKEND` `RFC-002`):
 * Real browser permission & consent controls for U09 + explicit honest UnavailableState for U10 export/delete.
 */
export const U09U10PrivacyAndDataRightsPage: React.FC = () => {
  const { location } = { location: useLocation() };
  const [analyticsConsent, setAnalyticsConsent] = useState<boolean>(() => {
    try {
      return localStorage.getItem('takolio_analytics_consent') === 'granted';
    } catch {
      return false;
    }
  });
  const pendingCount = getPendingOps().length;

  useVNextSeo({
    title:
      location.hash === '#data-rights' ? 'Xuất và xóa dữ liệu' : 'Quyền riêng tư & Dữ liệu',
    description: 'Kiểm soát quyền riêng tư hộ gia đình, sự đồng ý đo lường và trạng thái xuất/xóa dữ liệu.',
    canonicalPath: '/settings/privacy',
    domainSurface: 'app',
    noindex: true,
  });

  const toggleConsent = () => {
    const next = !analyticsConsent;
    setAnalyticsConsent(next);
    try {
      localStorage.setItem('takolio_analytics_consent', next ? 'granted' : 'denied');
      if (!next) sessionStorage.removeItem('takolio_consent_events');
    } catch {
      // Ignore storage errors.
    }
  };

  return (
    <ConsumerStudioShell
      screenId={location.hash === '#data-rights' ? 'U10' : 'U09'}
      title="Quyền riêng tư & Dữ liệu"
      backTo={vnextHref('/me')}
    >
      <div className="max-w-3xl space-y-7">
        {/* U09 — Quyền riêng tư */}
        <section aria-labelledby="tkv-u09-h1" className="space-y-4">
          <h1 id="tkv-u09-h1" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
            Quyền riêng tư
          </h1>
          <TkvSurface className="p-5 sm:p-6 space-y-4 text-sm text-[var(--tkv-ink-soft,#5F524A)] bg-white border-[var(--tkv-border,#EAE0D5)]">
            <div className="flex items-start gap-3">
              <VNextIcon name="shield" size={20} className="text-[var(--tkv-sage,#4E7A5B)] shrink-0 mt-0.5" />
              <p>
                <strong className="text-[var(--tkv-ink,#2C221E)]">Cô lập dữ liệu theo hộ gia đình:</strong> Mọi truy vấn tồn kho, thực đơn tuần, giỏ đi chợ và bản quét AI đều được xác thực theo phiên máy chủ và <code>household_id</code> riêng biệt.
              </p>
            </div>
            <div className="flex items-start gap-3 border-t border-[var(--tkv-border,#EAE0D5)] pt-3">
              <VNextIcon name="scan" size={20} className="text-[var(--tkv-primary,#D86A43)] shrink-0 mt-0.5" />
              <p>
                <strong className="text-[var(--tkv-ink,#2C221E)]">Xử lý ảnh quét AI:</strong> Ảnh tủ lạnh hoặc hóa đơn chỉ được gửi khi bạn bấm chụp/chọn ảnh và luôn yêu cầu bước duyệt thủ công trước khi ghi vào tồn kho.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[var(--tkv-border,#EAE0D5)] pt-3 flex-wrap">
              <div>
                <p className="font-bold text-[var(--tkv-ink,#2C221E)]">
                  Đồng ý ghi nhận tương tác trang giới thiệu (cục bộ)
                </p>
                <p className="text-xs text-[var(--tkv-ink-muted,#87776E)]">
                  Mặc định tắt · Không gửi dữ liệu cho bên thứ ba khi chưa đồng ý
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analyticsConsent}
                onClick={toggleConsent}
                className={clsx(
                  'tkv-focusable min-h-[42px] px-4 py-1.5 rounded-full text-xs font-bold border transition-colors',
                  analyticsConsent
                    ? 'bg-[var(--tkv-sage,#4E7A5B)] text-white border-[var(--tkv-sage,#4E7A5B)] shadow-xs'
                    : 'bg-[var(--tkv-surface-muted,#F7EFE6)] text-[var(--tkv-ink-soft,#5F524A)] border-[var(--tkv-border,#EAE0D5)]',
                )}
              >
                {analyticsConsent ? 'Đang bật' : 'Đang tắt'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[var(--tkv-border,#EAE0D5)] pt-3 text-xs tabular-nums">
              <span>Thao tác ngoại tuyến đang chờ đồng bộ trên trình duyệt này:</span>
              <strong className="text-[var(--tkv-ink,#2C221E)]">{pendingCount} mục</strong>
            </div>
          </TkvSurface>
        </section>

        {/* U10 — Xuất và xóa dữ liệu (Honest BLOCKED_BACKEND) */}
        <section id="data-rights" aria-labelledby="tkv-u10-h2" className="space-y-4">
          <h2 id="tkv-u10-h2" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
            Xuất và xóa dữ liệu
          </h2>

          <TkvSurface className="p-5 space-y-2 bg-[var(--tkv-surface-muted,#F7EFE6)] border-[var(--tkv-border,#EAE0D5)]">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] text-xs font-semibold text-[var(--tkv-honey-ink,#8C5B18)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#C68634)]" aria-hidden="true" />
              <span>U10 · BLOCKED_BACKEND (RFC-002)</span>
            </span>
            <p className="text-sm sm:text-base font-bold text-[var(--tkv-ink,#2C221E)]">
              Dữ liệu thuộc quyền kiểm soát của bạn. Tính năng xuất bản sao và xóa tài khoản tự động cần API máy chủ được phê duyệt.
            </p>
          </TkvSurface>

          <div className="space-y-3">
            <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#EAE0D5)]">
              <span className="w-11 h-11 rounded-xl bg-[var(--tkv-sage-soft,#EEF5F0)] text-[var(--tkv-sage,#4E7A5B)] flex items-center justify-center shrink-0 border border-[var(--tkv-sage-border,#CFE2D5)]">
                <VNextIcon name="download" size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#2C221E)]">
                  Xuất dữ liệu · Cần API máy chủ (RFC-002)
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                  Đang chờ triển khai điểm cuối đóng gói JSON/CSV toàn bộ tồn kho, lịch tuần và giỏ đi chợ theo hộ gia đình.
                </p>
              </div>
            </TkvSurface>

            <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#EAE0D5)]">
              <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FDF0EA)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center shrink-0 border border-[var(--tkv-accent-border,#F2D5C7)]">
                <VNextIcon name="trash" size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#2C221E)]">
                  Xóa tài khoản · Cần API máy chủ (RFC-002)
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                  Ứng dụng không hiển thị nút xóa giả. Quy trình xóa vĩnh viễn yêu cầu xác thực lại và xử lý đối soát gói Pro trên tầng máy chủ.
                </p>
              </div>
            </TkvSurface>
          </div>
        </section>
      </div>
    </ConsumerStudioShell>
  );
};

export type SystemStateCode = 's01' | 's02' | 's03' | 's04' | 's05' | 's06' | 's07' | 's08';

const SYSTEM_STATES_SPEC: Record<
  SystemStateCode,
  {
    id: string;
    title: string;
    lead: string;
    pose: 'error' | 'offline' | 'guide' | 'empty-fridge' | 'welcome';
    cards: Array<{ icon: VNextIconName; heading: string; sub: string; to?: string }>;
    ctaLabel: string;
    ctaHref: string;
  }
> = {
  s01: {
    id: 'S01',
    title: 'Không có quyền truy cập',
    lead: 'Phiên đăng nhập đã hết hạn hoặc tài khoản hiện tại không có quyền mở nội dung này.',
    pose: 'error',
    cards: [
      { icon: 'lock', heading: 'Đăng nhập lại an toàn', sub: 'Xác thực lại phiên mà không làm lộ dữ liệu hộ khác', to: '/auth?mode=login' },
      { icon: 'home', heading: 'Về trang giới thiệu', sub: 'Quay lại khu vực công khai của Takolio', to: '/landing' },
    ],
    ctaLabel: 'Đăng nhập tài khoản',
    ctaHref: '/auth?mode=login',
  },
  s02: {
    id: 'S02',
    title: 'Không tìm thấy trang',
    lead: 'Đường dẫn này có thể đã thay đổi hoặc không còn tồn tại trong ứng dụng.',
    pose: 'guide',
    cards: [
      { icon: 'home', heading: 'Trở lại trang chủ', sub: 'Thao tác an toàn về màn hình chính', to: '/' },
      { icon: 'search', heading: 'Tìm kiếm trong app', sub: 'Tra cứu món ăn hoặc nguyên liệu trong bếp', to: '/search' },
    ],
    ctaLabel: 'Về màn hình chính',
    ctaHref: '/',
  },
  s03: {
    id: 'S03',
    title: 'Hệ thống chưa sẵn sàng',
    lead: 'Máy chủ đang bận hoặc gặp sự cố tạm thời. Dữ liệu cũ không bị ghi đè sai lệch.',
    pose: 'error',
    cards: [
      { icon: 'refresh', heading: 'Thử tải lại trang', sub: 'Kiểm tra lại kết nối tới máy chủ Takolio' },
      { icon: 'fridge', heading: 'Mở tủ lạnh của tôi', sub: 'Xem trạng thái tồn kho đã xác thực gần nhất', to: '/fridge' },
    ],
    ctaLabel: 'Thử tải lại',
    ctaHref: '/',
  },
  s04: {
    id: 'S04',
    title: 'Đang ngoại tuyến',
    lead: 'Một số dữ liệu có thể xem nhưng chưa thể đồng bộ lên máy chủ cho tới khi có mạng trở lại.',
    pose: 'offline',
    cards: [
      { icon: 'fridge', heading: 'Xem nội dung đã lưu', sub: 'Tồn kho và danh sách đi chợ trong phạm vi hộ hiện tại', to: '/fridge' },
      { icon: 'history', heading: 'Thao tác chờ đồng bộ', sub: 'Các thay đổi ngoại tuyến được giữ trong hàng đợi an toàn', to: '/shopping' },
      { icon: 'refresh', heading: 'Kết nối lại', sub: 'Tự động gửi hàng đợi sau khi xác minh phiên máy chủ' },
    ],
    ctaLabel: 'Kiểm tra lại kết nối',
    ctaHref: '/',
  },
  s05: {
    id: 'S05',
    title: 'Xung đột phiên bản dữ liệu',
    lead: 'Nguyên liệu hoặc thực đơn vừa được cập nhật trên một thiết bị khác (HTTP 409 Conflict).',
    pose: 'guide',
    cards: [
      { icon: 'refresh', heading: 'Tải lại phiên bản mới nhất từ máy chủ', sub: 'Không bao giờ âm thầm ghi đè dữ liệu của thiết bị kia', to: '/fridge' },
      { icon: 'history', heading: 'Mở đối soát tồn kho (C08)', sub: 'So sánh chi tiết trước khi áp dụng thay đổi', to: '/inventory-reconciliation' },
    ],
    ctaLabel: 'Mở tủ lạnh mới nhất',
    ctaHref: '/fridge',
  },
  s06: {
    id: 'S06',
    title: 'Trạng thái tải và rỗng',
    lead: 'Phân biệt rõ đang tải (skeleton khớp bố cục), kho rỗng thực sự và bộ lọc không có kết quả.',
    pose: 'empty-fridge',
    cards: [
      { icon: 'plus', heading: 'Kho rỗng thực sự', sub: 'Hướng dẫn thêm nguyên liệu đầu tiên vào tủ lạnh', to: '/fridge?action=add' },
      { icon: 'filter', heading: 'Bộ lọc không khớp', sub: 'Giữ nguyên dữ liệu gốc và cho phép xóa nhanh bộ lọc', to: '/recipes' },
    ],
    ctaLabel: 'Mở tủ lạnh',
    ctaHref: '/fridge',
  },
  s07: {
    id: 'S07',
    title: 'Quyền truy cập & Sự đồng ý',
    lead: 'Giải thích rõ lý do trước khi xin quyền Camera hoặc Thông báo — luôn có lối đi thay thế khi bạn từ chối.',
    pose: 'guide',
    cards: [
      { icon: 'scan', heading: 'Quyền Camera khi quét thực phẩm', sub: 'Nếu từ chối camera, bạn vẫn tải ảnh từ thư viện hoặc nhập tay bình thường', to: '/scan' },
      { icon: 'notification', heading: 'Quyền Thông báo trình duyệt', sub: 'Không bao giờ báo đã bật thông báo khi trình duyệt đang chặn', to: '/settings/notifications' },
    ],
    ctaLabel: 'Xem cài đặt quyền riêng tư',
    ctaHref: '/settings/privacy',
  },
  s08: {
    id: 'S08',
    title: 'Cài đặt & Cập nhật ứng dụng PWA',
    lead: 'Thêm Takolio ra màn hình chính và cập nhật phiên bản mới an toàn mà không làm mất dữ liệu đang nhập.',
    pose: 'welcome',
    cards: [
      { icon: 'download', heading: 'Cài đặt lên màn hình chính', sub: 'Mở nhanh như ứng dụng gốc trên iOS, Android và máy tính' },
      { icon: 'shield', heading: 'Cập nhật Service Worker an toàn', sub: 'Không tự ý tải lại đè lên biểu mẫu đang sửa hoặc hàng đợi ngoại tuyến', to: '/settings/app' },
    ],
    ctaLabel: 'Mở cài đặt ứng dụng',
    ctaHref: '/settings/app',
  },
};

/**
 * S01–S08 — System States Surface (`/vnext/states/:stateId` + Live `S02` 404 NotFound Route).
 * Matches S01..S08 wireframes cleanly with Bé Mầm Bếp medallion, safe recovery cards, and real outbox status.
 */
export const VNextSystemStatePage: React.FC<{ forcedState?: SystemStateCode }> = ({ forcedState }) => {
  const { stateId } = useParams<{ stateId: string }>();
  const navigate = useNavigate();
  const normalized = (forcedState ?? stateId?.toLowerCase() ?? 's02') as SystemStateCode;
  const spec = SYSTEM_STATES_SPEC[normalized] ?? SYSTEM_STATES_SPEC.s02;
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const pendingOpsCount = getPendingOps().length;

  useEffect(() => {
    const onChange = () => setOnline(navigator.onLine);
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }, []);

  useVNextSeo({
    title: spec.title,
    description: spec.lead,
    canonicalPath: forcedState === 's02' ? '/404' : `/vnext/states/${normalized}`,
    domainSurface: 'app',
    noindex: true,
  });

  return (
    <div className="tkv-root min-h-dvh bg-[var(--tkv-bg,#FCF9F5)] flex flex-col items-center justify-center px-4 py-10" data-tkv-screen={spec.id}>
      <main className="w-full max-w-xl space-y-6">
        <TkvSurface className="p-6 sm:p-8 space-y-6 bg-white border-[var(--tkv-border,#EAE0D5)] shadow-soft">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-xs font-semibold text-[var(--tkv-accent-ink,#9E4322)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#D86A43)]" aria-hidden="true" />
              <span>{spec.id} · Trạng thái hệ thống</span>
            </span>
            {normalized === 's04' && (
              <TkvBadge tone={online ? 'success' : 'warning'}>
                <span className="tabular-nums">
                  {online ? 'Mạng đã kết nối' : 'Đang ngoại tuyến'} · Chờ đồng bộ: {pendingOpsCount}
                </span>
              </TkvBadge>
            )}
          </div>

          <div className="flex justify-center">
            <div className="w-28 h-28 rounded-full bg-[var(--tkv-surface-muted,#F7EFE6)] p-3 flex items-center justify-center border border-[var(--tkv-border,#EAE0D5)]">
              <MascotIllustration pose={spec.pose} size={92} />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
              {spec.title}
            </h1>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
              {spec.lead}
            </p>
          </div>

          <div className="space-y-2.5">
            {spec.cards.map((c) => {
              const inner = (
                <div className="rounded-2xl border border-[var(--tkv-border,#EAE0D5)] bg-[var(--tkv-bg,#FCF9F5)] p-4 flex items-center justify-between gap-3 hover:border-[var(--tkv-border-strong,#D5C3B3)] transition-colors">
                  <div className="flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-xl bg-white border border-[var(--tkv-border,#EAE0D5)] text-[var(--tkv-primary,#D86A43)] flex items-center justify-center shrink-0">
                      <VNextIcon name={c.icon} size={18} />
                    </span>
                    <div>
                      <p className="tkv-heading text-sm sm:text-base font-bold text-[var(--tkv-ink,#2C221E)]">
                        {c.heading}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-soft,#5F524A)]">{c.sub}</p>
                    </div>
                  </div>
                  {c.to && <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted,#87776E)] shrink-0" />}
                </div>
              );
              return c.to ? (
                <Link key={c.heading} to={vnextHref(c.to)} className="tkv-focusable block rounded-2xl">
                  {inner}
                </Link>
              ) : (
                <div key={c.heading}>{inner}</div>
              );
            })}
          </div>

          <TkvButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate(vnextHref(spec.ctaHref))}
          >
            {spec.ctaLabel}
          </TkvButton>
        </TkvSurface>
      </main>
    </div>
  );
};

export const S02NotFoundPage: React.FC = () => <VNextSystemStatePage forcedState="s02" />;
