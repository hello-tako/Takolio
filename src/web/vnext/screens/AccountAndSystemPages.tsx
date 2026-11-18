import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
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
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
              Nhắc nhở từ trạng thái thực tế
            </p>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)] mt-0.5">
              Thông báo căn bếp
            </h1>
          </div>
          <Link
            to={vnextHref('/settings/notifications')}
            className="tkv-focusable min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--tkv-border)] bg-white text-xs font-extrabold text-[var(--tkv-primary)] inline-flex items-center gap-1.5"
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
                className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] text-white font-bold text-sm inline-flex items-center"
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
                  <TkvSurface className="p-4 sm:p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                        <VNextIcon name={icon} size={20} />
                      </span>
                      <div className="space-y-1 min-w-0">
                        <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                          {item.title}
                        </p>
                        <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                          {item.message}
                        </p>
                        {item.createdAt && (
                          <p className="text-xs text-[var(--tkv-ink-muted)]">
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
    description: 'Quản lý tài khoản, hộ gia đình, thông báo, gói Plus và cài đặt quyền riêng tư trên Takolio.',
    canonicalPath: '/me',
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
      title: 'Takolio Plus',
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

  return (
    <ConsumerStudioShell screenId="U01" title="Hồ sơ cá nhân">
      <div className="max-w-3xl space-y-6">
        <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
          Hồ sơ cá nhân
        </h1>

        {/* Identity Summary Card */}
        <TkvSurface tone="mint" className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <MascotIllustration pose="welcome" size={64} className="border-2 border-white shrink-0" />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="tkv-heading text-lg sm:text-xl font-extrabold text-[var(--tkv-ink)] truncate">
                  {displayName || 'Người dùng Takolio'}
                </h2>
                <TkvBadge tone={isGuest ? 'warning' : 'success'} icon={isGuest ? 'info' : 'check'}>
                  {isGuest ? 'Phiên dùng thử khách' : isPlus ? 'Thành viên Plus' : 'Tài khoản đã xác thực'}
                </TkvBadge>
              </div>
              <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] truncate">
                {isGuest ? 'Chưa liên kết email · Đăng ký để lưu dữ liệu lâu dài' : email}
              </p>
              {householdId && (
                <p className="text-[11px] font-mono text-[var(--tkv-ink-muted)] truncate">
                  Mã hộ: {householdId}
                </p>
              )}
            </div>
          </div>

          {isGuest && (
            <TkvButton
              variant="coral"
              size="sm"
              onClick={() => navigate(vnextHref('/auth?mode=register'))}
            >
              Tạo tài khoản
            </TkvButton>
          )}
        </TkvSurface>

        {/* Navigation List matching U01.png */}
        <ul className="space-y-2.5" aria-label="Danh mục tài khoản và cài đặt">
          {navRows.map((row) => (
            <li key={row.id}>
              <Link
                to={row.to}
                className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-white border border-[var(--tkv-border)] p-4 hover:border-[var(--tkv-primary)] transition-colors shadow-[var(--tkv-shadow-card)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                      <VNextIcon name={row.icon} size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                          {row.title}
                        </p>
                        {row.badge && <TkvBadge tone="success">{row.badge}</TkvBadge>}
                      </div>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] truncate">{row.subtitle}</p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {logoutError && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-danger)]/35 text-sm text-[var(--tkv-danger)] font-semibold"
          >
            {logoutError}
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
    <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
      <FoodPreferencesPage />
    </div>
  </ConsumerStudioShell>
);

/** U03 — Cài đặt thực đơn (`/settings/planning`). */
export const U03PlanningSettingsVNext: React.FC = () => (
  <ConsumerStudioShell screenId="U03" title="Cài đặt thực đơn" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
      <PlanningSettingsPage />
    </div>
  </ConsumerStudioShell>
);

/** U04 — Cài đặt ứng dụng (`/settings/app`, `/settings`). */
export const U04AppSettingsVNext: React.FC = () => (
  <ConsumerStudioShell screenId="U04" title="Cài đặt ứng dụng" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
      <SettingsPage />
    </div>
  </ConsumerStudioShell>
);

/** U05 — Cài đặt thông báo (`/settings/notifications`). */
export const U05NotificationPrefsVNext: React.FC = () => (
  <ConsumerStudioShell screenId="U05" title="Cài đặt thông báo" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
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
        <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
          Hộ gia đình
        </h1>

        {/* Active Household Card matching U06.png */}
        <TkvSurface tone="mint" className="p-5 sm:p-6 space-y-3">
          <TkvBadge tone="warning" icon="info">
            BLOCKED_BACKEND · RFC-001 đang chờ triển khai tầng máy chủ
          </TkvBadge>
          <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-primary)]">
            Hộ gia đình hiện tại
          </h2>
          <p className="text-sm text-[var(--tkv-ink-secondary)]">
            Mời, tham gia hộ khác và quản lý danh sách thành viên cần API máy chủ mới để bảo đảm cô lập dữ liệu.
          </p>
          <div className="rounded-2xl bg-white border border-[var(--tkv-border)] p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-[var(--tkv-ink-secondary)]">Mã hộ hiện tại</span>
              <code className="font-mono text-xs font-extrabold text-[var(--tkv-ink)] bg-[var(--tkv-bg)] px-2.5 py-1 rounded-lg">
                {householdId || 'Chưa khởi tạo'}
              </code>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--tkv-border)] pt-2">
              <span className="font-bold text-[var(--tkv-ink-secondary)]">Khẩu phần nấu mặc định</span>
              <strong className="text-[var(--tkv-ink)]">{householdSize} người</strong>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[var(--tkv-border)] pt-2">
              <span className="font-bold text-[var(--tkv-ink-secondary)]">Loại phiên</span>
              <strong className="text-[var(--tkv-ink)]">
                {isGuest ? 'Phiên khách cục bộ' : 'Tài khoản đã đăng ký'}
              </strong>
            </div>
          </div>
        </TkvSurface>

        {/* Honest Unavailable Feature Rows matching U06.png */}
        <div className="space-y-3" aria-label="Các tính năng chia sẻ hộ gia đình chưa mở">
          {unavailableItems.map((it) => (
            <TkvSurface key={it.title} className="p-4 sm:p-5 flex items-start gap-3.5 opacity-90">
              <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-bg)] text-[var(--tkv-ink-muted)] flex items-center justify-center shrink-0 border border-[var(--tkv-border)]">
                <VNextIcon name={it.icon} size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">{it.title}</p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
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
  <ConsumerStudioShell screenId="U07" title="Takolio Plus" backTo={vnextHref('/me')}>
    <div className="tkv-adapted-surface takosan-rebuild" data-tkv-surface-adapt="1">
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
          <h1 id="tkv-u09-h1" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
            Quyền riêng tư
          </h1>
          <TkvSurface className="p-5 sm:p-6 space-y-4 text-sm text-[var(--tkv-ink-secondary)]">
            <div className="flex items-start gap-3">
              <VNextIcon name="shield" size={20} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
              <p>
                <strong>Cô lập dữ liệu theo hộ gia đình:</strong> Mọi truy vấn tồn kho, thực đơn tuần, giỏ đi chợ và bản quét AI đều được xác thực theo phiên máy chủ và <code>household_id</code> riêng biệt.
              </p>
            </div>
            <div className="flex items-start gap-3 border-t border-[var(--tkv-border)] pt-3">
              <VNextIcon name="scan" size={20} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
              <p>
                <strong>Xử lý ảnh quét AI:</strong> Ảnh tủ lạnh hoặc hóa đơn chỉ được gửi khi bạn bấm chụp/chọn ảnh và luôn yêu cầu bước duyệt thủ công trước khi ghi vào tồn kho.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[var(--tkv-border)] pt-3 flex-wrap">
              <div>
                <p className="font-extrabold text-[var(--tkv-ink)]">
                  Đồng ý ghi nhận tương tác trang giới thiệu (cục bộ)
                </p>
                <p className="text-xs text-[var(--tkv-ink-muted)]">
                  Mặc định tắt · Không gửi dữ liệu cho bên thứ ba khi chưa đồng ý
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analyticsConsent}
                onClick={toggleConsent}
                className={clsx(
                  'tkv-focusable min-h-[42px] px-4 py-1.5 rounded-full text-xs font-extrabold border transition-colors',
                  analyticsConsent
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                    : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
                )}
              >
                {analyticsConsent ? 'Đang bật' : 'Đang tắt'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[var(--tkv-border)] pt-3 text-xs">
              <span>Thao tác ngoại tuyến đang chờ đồng bộ trên trình duyệt này:</span>
              <strong className="text-[var(--tkv-ink)]">{pendingCount} mục</strong>
            </div>
          </TkvSurface>
        </section>

        {/* U10 — Xuất và xóa dữ liệu (Honest BLOCKED_BACKEND matching U10.png) */}
        <section id="data-rights" aria-labelledby="tkv-u10-h2" className="space-y-4">
          <h2 id="tkv-u10-h2" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            Xuất và xóa dữ liệu
          </h2>

          <TkvSurface tone="mint" className="p-5 space-y-2">
            <TkvBadge tone="warning" icon="info">
              U10 · BLOCKED_BACKEND (RFC-002)
            </TkvBadge>
            <p className="text-sm sm:text-base font-bold text-[var(--tkv-ink)]">
              Dữ liệu thuộc quyền kiểm soát của bạn. Tính năng xuất bản sao và xóa tài khoản tự động cần API máy chủ được phê duyệt.
            </p>
          </TkvSurface>

          <div className="space-y-3">
            <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5">
              <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-bg)] text-[var(--tkv-ink-muted)] flex items-center justify-center shrink-0 border border-[var(--tkv-border)]">
                <VNextIcon name="download" size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                  Xuất dữ liệu · Cần API máy chủ (RFC-002)
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)]">
                  Đang chờ triển khai điểm cuối đóng gói JSON/CSV toàn bộ tồn kho, lịch tuần và giỏ đi chợ theo hộ gia đình.
                </p>
              </div>
            </TkvSurface>

            <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5">
              <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-bg)] text-[var(--tkv-ink-muted)] flex items-center justify-center shrink-0 border border-[var(--tkv-border)]">
                <VNextIcon name="trash" size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                  Xóa tài khoản · Cần API máy chủ (RFC-002)
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)]">
                  Ứng dụng không hiển thị nút xóa giả. Quy trình xóa vĩnh viễn yêu cầu xác thực lại và xử lý đối soát gói Plus trên tầng máy chủ.
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
  });

  return (
    <div className="tkv-root min-h-dvh flex flex-col items-center justify-center px-4 py-10" data-tkv-screen={spec.id}>
      <main className="w-full max-w-xl space-y-6">
        <TkvSurface className="p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <TkvBadge tone="neutral">{spec.id} · Trạng thái hệ thống</TkvBadge>
            {normalized === 's04' && (
              <TkvBadge tone={online ? 'success' : 'warning'}>
                {online ? 'Mạng đã kết nối' : 'Đang ngoại tuyến'} · Chờ đồng bộ: {pendingOpsCount}
              </TkvBadge>
            )}
          </div>

          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full bg-[var(--tkv-surface-mint)] p-3 flex items-center justify-center border border-[var(--tkv-border)]">
              <MascotIllustration pose={spec.pose} size={104} />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
              {spec.title}
            </h1>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
              {spec.lead}
            </p>
          </div>

          <div className="space-y-2.5">
            {spec.cards.map((c) => {
              const inner = (
                <div className="rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] p-4 flex items-center justify-between gap-3 hover:border-[var(--tkv-primary)] transition-colors">
                  <div className="flex items-center gap-3.5">
                    <span className="w-10 h-10 rounded-xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                      <VNextIcon name={c.icon} size={18} />
                    </span>
                    <div>
                      <p className="tkv-heading text-sm sm:text-base font-extrabold text-[var(--tkv-ink)]">
                        {c.heading}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)]">{c.sub}</p>
                    </div>
                  </div>
                  {c.to && <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />}
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
