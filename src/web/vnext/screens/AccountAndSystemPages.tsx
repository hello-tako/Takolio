import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { useUiTranslation } from '../../i18n';
import type { SupportedLocale } from '../../../shared/locales';
import {
  containsVietnameseDiacritics,
  lSync,
  localizeErrorText,
  useLocaleText,
} from '../../i18n/app-i18n';

const LEGACY_NAME_RE = /^Người dùng\s+Fri\w*$/i;
function sanitizeUserDisplayName(
  raw: string | undefined | null,
  isGuest = false,
  locale: SupportedLocale = 'vi',
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return isGuest
      ? lSync('Người dùng Takolio', 'Takolio Guest', locale)
      : lSync('Bếp trưởng', 'Home Chef', locale);
  }
  if (LEGACY_NAME_RE.test(trimmed)) return lSync('Bếp trưởng', 'Home Chef', locale);
  if (locale !== 'vi') {
    if (trimmed === 'Khách ghé thăm') return lSync('Khách ghé thăm', 'Guest', locale);
    if (trimmed === 'Người dùng Takolio') return lSync('Người dùng Takolio', 'Takolio User', locale);
    if (trimmed === 'Bếp trưởng') return lSync('Bếp trưởng', 'Home Chef', locale);
    if (trimmed === 'Bạn mới của Takolio') {
      return lSync('Bạn mới của Takolio', 'Takolio Guest', locale);
    }
  }
  return raw as string;
}
import { queryKeys } from '../../lib/queryKeys';
import { getPendingOps } from '../../lib/sync';
import { vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { detectRuntimeDomainRole } from '../lib/domain-surface';
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
import { SettingsFormSkeleton } from '../components/Skeletons';

const LazyFoodPreferencesPage = lazy(() =>
  import('../../pages/settings/FoodPreferencesPage').then((m) => ({ default: m.FoodPreferencesPage })),
);
const LazyPlanningSettingsPage = lazy(() =>
  import('../../pages/settings/PlanningSettingsPage').then((m) => ({ default: m.PlanningSettingsPage })),
);
const LazySettingsPage = lazy(() =>
  import('../../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const LazyNotificationPreferencesPage = lazy(() =>
  import('../../pages/settings/NotificationPreferencesPage').then((m) => ({ default: m.NotificationPreferencesPage })),
);
const LazyPlusPaywallPage = lazy(() =>
  import('../../pages/PlusPaywallPage').then((m) => ({ default: m.PlusPaywallPage })),
);
const LazyGlobalDodoBillingPanel = lazy(() =>
  import('../../components/global/GlobalDodoBillingPanel').then((m) => ({
    default: m.GlobalDodoBillingPanel,
  })),
);

function relativeTime(iso: string, locale: SupportedLocale): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return lSync('Vừa xong', 'Just now', locale);
  if (mins < 60) return lSync(`${mins} phút trước`, `${mins}m ago`, locale);
  const hours = Math.round(mins / 60);
  if (hours < 24) return lSync(`${hours} giờ trước`, `${hours}h ago`, locale);
  const days = Math.round(hours / 24);
  return lSync(`${days} ngày trước`, `${days}d ago`, locale);
}

/**
 * C30 — Thông báo căn bếp (`/notifications`).
 * Displays real household notifications from `api.getNotifications()` without inventing unread counters.
 */
export const C30NotificationsVNext: React.FC = () => {
  const { l, locale, isVi } = useLocaleText();

  useVNextSeo({
    title: l('Thông báo căn bếp', 'Kitchen notifications'),
    description: l(
      'Nhắc nhở nguyên liệu nên dùng sớm và gợi ý thao tác từ dữ liệu thật của hộ gia đình.',
      'Reminders for ingredients to use soon and actionable tips from your real household inventory.',
    ),
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
    <ConsumerStudioShell
      screenId="C30"
      title={l('Thông báo căn bếp', 'Kitchen notifications')}
      backTo={vnextHref('/me')}
    >
      <div className="max-w-3xl space-y-6">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#52706A)]">
              {l('Nhắc nhở từ trạng thái thực tế', 'Live kitchen reminders')}
            </p>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)] mt-0.5">
              {l('Thông báo căn bếp', 'Kitchen notifications')}
            </h1>
          </div>
          <Link
            to={vnextHref('/settings/notifications')}
            className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)] bg-white text-xs sm:text-sm font-bold text-[var(--tkv-ink)] inline-flex items-center gap-1.5 transition-colors"
          >
            <VNextIcon name="settings" size={15} />
            <span>{l('Cài đặt thông báo', 'Notification settings')}</span>
          </Link>
        </div>

        {notificationsQuery.isPending ? (
          <div className="space-y-3">
            <TkvSkeleton
              className="h-24"
              label={l('Đang tải thông báo căn bếp…', 'Loading kitchen notifications…')}
            />
            <TkvSkeleton
              className="h-24"
              label={l('Đang tải thông báo căn bếp…', 'Loading kitchen notifications…')}
            />
          </div>
        ) : notificationsQuery.isError ? (
          <TkvErrorState
            title={l('Chưa tải được thông báo', 'Could not load notifications')}
            message={l(
              'Không thể đọc danh sách nhắc nhở từ máy chủ lúc này.',
              'Unable to fetch reminders from the server right now.',
            )}
            onRetry={() => void notificationsQuery.refetch()}
          />
        ) : list.length === 0 ? (
          <TkvEmptyState
            pose="welcome"
            title={l('Căn bếp đang êm ả', 'All quiet in the kitchen')}
            description={l(
              'Hiện chưa có cảnh báo hạn dùng hay nhắc nhở mới cho hộ gia đình của bạn.',
              'There are no expiry alerts or new reminders for your household right now.',
            )}
            primaryAction={
              <Link
                to={vnextHref('/fridge')}
                className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white shadow-xs font-semibold text-sm inline-flex items-center transition-colors"
              >
                {l('Kiểm tra tủ lạnh', 'Check your fridge')}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3" aria-label={l('Danh sách thông báo', 'Notifications list')}>
            {list.map((item) => {
              const icon: VNextIconName =
                item.type === 'expiring_soon'
                  ? 'timer'
                  : item.type === 'shopping_reminder'
                    ? 'shopping'
                    : 'recipes';
              const displayTitle =
                !isVi && containsVietnameseDiacritics(item.title)
                  ? item.type === 'expiring_soon'
                    ? l('Nguyên liệu sắp hết hạn', 'Ingredients expiring soon')
                    : item.type === 'shopping_reminder'
                      ? l('Nhắc nhở danh sách mua sắm', 'Shopping list reminder')
                      : l('Nhắc nhở căn bếp', 'Kitchen reminder')
                  : item.title;
              const displayMessage =
                !isVi && containsVietnameseDiacritics(item.message)
                  ? item.type === 'expiring_soon'
                    ? l(
                        'Kiểm tra tủ lạnh để dùng sớm các nguyên liệu gần hạn.',
                        'Check your fridge for ingredients that should be cooked soon.',
                      )
                    : item.type === 'shopping_reminder'
                      ? l(
                          'Kiểm tra các mục còn lại trong danh sách mua sắm của hộ gia đình.',
                          'Review items remaining on your household shopping list.',
                        )
                      : l(
                          'Mở trang chủ căn bếp để xem các cập nhật mới nhất của hộ gia đình.',
                          'Open your kitchen dashboard for the latest household updates.',
                        )
                  : item.message;
              return (
                <li key={item.id}>
                  <TkvSurface className="p-4 sm:p-5 flex items-start justify-between gap-4 bg-white border-[var(--tkv-border,#DCE6DE)]">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <span className="relative w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                        <VNextIcon name={icon} size={20} />
                        {item.type === 'expiring_soon' && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--tkv-honey,#F6C453)]" aria-hidden="true" />
                        )}
                      </span>
                      <div className="space-y-1 min-w-0">
                        <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#152E2C)]">
                          {displayTitle}
                        </p>
                        <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                          {displayMessage}
                        </p>
                        {item.createdAt && (
                          <p className="text-xs text-[var(--tkv-ink-muted,#52706A)] tabular-nums">
                            {relativeTime(item.createdAt, locale)}
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
  const { l, locale } = useLocaleText();
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
    title: l('Hồ sơ cá nhân', 'Profile'),
    description: l(
      'Quản lý tài khoản, hộ gia đình, thông báo, gói Pro và cài đặt quyền riêng tư trên Takolio.',
      'Manage your account, household, notifications, Pro plan, and privacy settings on Takolio.',
    ),
    canonicalPath: '/me',
    domainSurface: 'app',
    noindex: true,
  });

  const handleLogout = async () => {
    const ok = await logout();
    if (ok) {
      navigate(
        vnextHref(detectRuntimeDomainRole() === 'application-app' ? '/auth?mode=welcome' : '/landing'),
        { replace: true },
      );
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
      title: l('Sở thích món ăn', 'Food preferences'),
      subtitle: l(
        `Khẩu phần ${householdSize} người · Ẩm thực & mức cay`,
        `Servings for ${householdSize} · Cuisines & spice level`,
      ),
      to: vnextHref('/me/preferences'),
    },
    {
      id: 'u06',
      icon: 'users',
      title: l('Hộ gia đình', 'Household'),
      subtitle: l(
        'Mã hộ hiện tại & trạng thái chia sẻ thành viên',
        'Active household ID & member sharing status',
      ),
      to: vnextHref('/me/household'),
    },
    {
      id: 'c30',
      icon: 'notification',
      title: l('Thông báo', 'Notifications'),
      subtitle: l(
        'Xem nhắc nhở hạn dùng thực phẩm & cấu hình thông báo',
        'View food expiry reminders & notification settings',
      ),
      to: vnextHref('/notifications'),
    },
    {
      id: 'u07',
      icon: 'crown',
      title: 'Takolio Pro',
      subtitle: l(
        'Xem quyền lợi và trạng thái gói dịch vụ chính thức từ máy chủ',
        'View benefits and verified subscription status from the server',
      ),
      to: vnextHref('/plus'),
      badge: isPlus ? l('Đang hoạt động', 'Active') : undefined,
    },
    {
      id: 'u03',
      icon: 'calendar',
      title: l('Cài đặt thực đơn', 'Meal plan settings'),
      subtitle: l(
        'Ngày nấu mặc định và thời gian chuẩn bị bữa ăn',
        'Default cooking days and meal prep time',
      ),
      to: vnextHref('/settings/planning'),
    },
    {
      id: 'u04',
      icon: 'settings',
      title: l('Cài đặt ứng dụng', 'App settings'),
      subtitle: l(
        'Tùy chọn hiển thị trên thiết bị và cập nhật PWA',
        'Language, units, device cache, and PWA installation',
      ),
      to: vnextHref('/settings/app'),
    },
    {
      id: 'u09',
      icon: 'privacy',
      title: l('Quyền riêng tư & Xuất/xóa dữ liệu', 'Privacy & Data rights'),
      subtitle: l(
        'Phân tách dữ liệu hộ gia đình, sự đồng ý và quyền dữ liệu',
        'Household data isolation, consent, and export/deletion status',
      ),
      to: vnextHref('/settings/privacy'),
    },
  ];

  const cleanDisplayName = sanitizeUserDisplayName(displayName, isGuest, locale);

  return (
    <ConsumerStudioShell screenId="U01" title={l('Hồ sơ cá nhân', 'Profile')}>
      <div className="max-w-3xl space-y-6">
        <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
          {l('Hồ sơ cá nhân', 'Profile')}
        </h1>

        {/* Identity Summary Card */}
        <TkvSurface className="p-4 sm:p-6 bg-gradient-to-br from-[var(--tkv-surface)] to-[var(--tkv-surface-mint)] border-[var(--tkv-border-mint)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            <MascotIllustration pose="welcome" size={64} className="border border-[var(--tkv-border)] bg-white shrink-0" />
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="tkv-heading text-lg sm:text-xl font-extrabold text-[var(--tkv-ink)] break-words">
                  {cleanDisplayName}
                </h2>
                <span
                  className={clsx(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                    isPlus && !isGuest
                      ? 'bg-[var(--tkv-accent-soft)] text-[var(--tkv-accent-ink)] border-[var(--tkv-accent-border)]'
                      : isGuest
                        ? 'bg-[var(--tkv-honey-soft)] text-[var(--tkv-honey-ink)] border-[var(--tkv-honey-border)]'
                        : 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-sage-ink)] border-[var(--tkv-border-mint)]',
                  )}
                >
                  <span
                    className={clsx(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      isPlus && !isGuest
                        ? 'bg-[var(--tkv-primary)]'
                        : isGuest
                          ? 'bg-[var(--tkv-saffron)]'
                          : 'bg-[var(--tkv-primary)]',
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    {isGuest
                      ? l('Phiên dùng thử khách', 'Guest trial session')
                      : isPlus
                        ? 'Takolio Pro'
                        : l('Tài khoản đã xác thực', 'Verified account')}
                  </span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] leading-snug break-words">
                {isGuest
                  ? l(
                      'Chưa liên kết email · Đăng ký để lưu dữ liệu lâu dài',
                      'No email linked · Sign up to keep your kitchen synced',
                    )
                  : email}
              </p>
              {householdId && (
                <p className="text-[11px] tabular-nums text-[var(--tkv-ink-muted)] truncate">
                  {l('Mã hộ:', 'Household ID:')} {householdId}
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
              {l('Tạo tài khoản', 'Create account')}
            </TkvButton>
          )}
        </TkvSurface>

        {/* Navigation List */}
        <ul
          className="space-y-2.5"
          aria-label={l('Danh mục tài khoản và cài đặt', 'Account and settings navigation')}
        >
          {navRows.map((row) => (
            <li key={row.id}>
              <Link
                to={row.to}
                className="tkv-focusable block rounded-[var(--tkv-radius-card)] bg-white border border-[var(--tkv-border,#DCE6DE)] p-4 hover:border-[var(--tkv-border-strong,#B8CABE)] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                      <VNextIcon name={row.icon} size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#152E2C)]">
                          {row.title}
                        </p>
                        {row.badge && <TkvBadge tone="success">{row.badge}</TkvBadge>}
                      </div>
                      <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)] leading-snug mt-0.5 tabular-nums">{row.subtitle}</p>
                    </div>
                  </div>
                  <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted,#52706A)] shrink-0" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {logoutError && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-sm text-[var(--tkv-accent-ink,#B33A22)] font-semibold flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)] shrink-0" aria-hidden="true" />
            <span>
              {localizeErrorText(
                logoutError,
                'Private data on this device has been cleared, but server session revocation could not be confirmed. Please reconnect and try signing out again.',
                logoutError,
                locale,
              )}
            </span>
          </div>
        )}

        <div className="pt-2">
          <TkvButton
            variant="quiet"
            size="md"
            isLoading={logoutStatus === 'pending'}
            onClick={() => void handleLogout()}
          >
            {l('Đăng xuất khỏi thiết bị này', 'Sign out of this device')}
          </TkvButton>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

/** U02 — Sở thích món ăn (`/me/preferences`, `/settings/food`). */
export const U02FoodPrefsVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell
      screenId="U02"
      title={l('Sở thích món ăn', 'Food preferences')}
      backTo={vnextHref('/me')}
    >
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense
          fallback={
            <SettingsFormSkeleton
              label={l('Đang tải sở thích món ăn…', 'Loading food preferences…')}
            />
          }
        >
          <LazyFoodPreferencesPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};

/** U03 — Cài đặt thực đơn (`/settings/planning`). */
export const U03PlanningSettingsVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell
      screenId="U03"
      title={l('Cài đặt thực đơn', 'Meal plan settings')}
      backTo={vnextHref('/me')}
    >
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense
          fallback={
            <SettingsFormSkeleton
              label={l('Đang tải cài đặt thực đơn…', 'Loading meal plan settings…')}
            />
          }
        >
          <LazyPlanningSettingsPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};

/** U04 — Cài đặt ứng dụng (`/settings/app`, `/settings`). */
export const U04AppSettingsVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell
      screenId="U04"
      title={l('Cài đặt ứng dụng', 'App settings')}
      backTo={vnextHref('/me')}
    >
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense
          fallback={
            <SettingsFormSkeleton
              label={l('Đang tải cài đặt ứng dụng…', 'Loading app settings…')}
            />
          }
        >
          <LazySettingsPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};

/** U05 — Cài đặt thông báo (`/settings/notifications`). */
export const U05NotificationPrefsVNext: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <ConsumerStudioShell
      screenId="U05"
      title={l('Cài đặt thông báo', 'Notification settings')}
      backTo={vnextHref('/me')}
    >
      <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
        <Suspense
          fallback={
            <SettingsFormSkeleton
              label={l('Đang tải cài đặt thông báo…', 'Loading notification settings…')}
            />
          }
        >
          <LazyNotificationPreferencesPage />
        </Suspense>
      </div>
    </ConsumerStudioShell>
  );
};

/**
 * U06 — Hộ gia đình (`/me/household`, `/family`).
 * Matches U06.png 1:1 AND Owner Decision 4 (`BLOCKED_BACKEND` `RFC-001`):
 * Displays real active `householdId` and household size while honestly marking
 * invite/join/member-list actions as `Chưa hỗ trợ API` (zero fake invite codes!).
 */
export const U06HouseholdHonestPage: React.FC = () => {
  const { l } = useLocaleText();
  const { householdId, householdSize, isGuest } = useAuthStore();

  useVNextSeo({
    title: l('Hộ gia đình', 'Household'),
    description: l(
      'Thông tin mã hộ gia đình hiện tại và trạng thái tính năng chia sẻ thành viên.',
      'Active household ID details and member sharing feature status.',
    ),
    canonicalPath: '/me/household',
    domainSurface: 'app',
    noindex: true,
  });

  const unavailableItems = [
    {
      title: l('Mời thành viên · Chưa hỗ trợ API', 'Invite members · API not yet available'),
      detail: l(
        'Cần API mã mời có thời hạn và phân quyền chủ hộ / thành viên (đã lập đặc tả RFC-001).',
        'Requires expiring invite-code APIs and owner/member permissions (specified in RFC-001).',
      ),
      icon: 'mail' as const,
    },
    {
      title: l('Tham gia hộ khác · Chưa hỗ trợ API', 'Join another household · API not yet available'),
      detail: l(
        'Cần quy trình chuyển hộ an toàn không làm rò rỉ hoặc mất tồn kho hiện tại (RFC-001).',
        'Requires a safe household transfer flow that prevents inventory loss or cross-household leaks (RFC-001).',
      ),
      icon: 'swap' as const,
    },
    {
      title: l('Danh sách thành viên · Chưa hỗ trợ API', 'Member list · API not yet available'),
      detail: l(
        'Máy chủ hiện lưu mã hộ cho phiên của bạn, chưa cung cấp điểm cuối liệt kê/thu hồi thành viên.',
        'The server tracks your active household ID, but listing or revoking members is not available yet.',
      ),
      icon: 'users' as const,
    },
  ];

  return (
    <ConsumerStudioShell screenId="U06" title={l('Hộ gia đình', 'Household')} backTo={vnextHref('/me')}>
      <div className="max-w-3xl space-y-6">
        <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
          {l('Hộ gia đình', 'Household')}
        </h1>

        {/* Active Household Card */}
        <TkvSurface className="p-4 sm:p-6 space-y-3 bg-[var(--tkv-surface-mint)] border-[var(--tkv-border-mint)]">
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--tkv-honey-soft)] border border-[var(--tkv-honey-border)] text-xs font-semibold text-[var(--tkv-honey-ink)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-saffron)] shrink-0" aria-hidden="true" />
            <span>
              {l(
                'BLOCKED_BACKEND · RFC-001 đang chờ triển khai tầng máy chủ',
                'BLOCKED_BACKEND · RFC-001 awaiting backend implementation',
              )}
            </span>
          </span>
          <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
            {l('Hộ gia đình hiện tại', 'Current household')}
          </h2>
          <p className="text-sm text-[var(--tkv-ink-secondary)]">
            {l(
              'Mời, tham gia hộ khác và quản lý danh sách thành viên cần API máy chủ mới để bảo đảm cô lập dữ liệu.',
              'Inviting members, joining another household, and managing members require dedicated server APIs to guarantee strict data isolation.',
            )}
          </p>
          <div className="rounded-2xl bg-white border border-[var(--tkv-border)] p-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-semibold text-[var(--tkv-ink-secondary)]">
                {l('Mã hộ hiện tại', 'Current household ID')}
              </span>
              <code className="font-mono text-xs font-bold tabular-nums break-all max-w-full text-[var(--tkv-ink)] bg-[var(--tkv-bg)] border border-[var(--tkv-border)] px-2.5 py-1 rounded-lg">
                {householdId || l('Chưa khởi tạo', 'Not initialized')}
              </code>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap border-t border-[var(--tkv-border)] pt-2.5">
              <span className="font-semibold text-[var(--tkv-ink-secondary)]">
                {l('Khẩu phần nấu mặc định', 'Default cooking portions')}
              </span>
              <strong className="text-[var(--tkv-ink)] tabular-nums">
                {l(
                  `${householdSize} người`,
                  `${householdSize} ${householdSize === 1 ? 'person' : 'people'}`,
                )}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap border-t border-[var(--tkv-border)] pt-2.5">
              <span className="font-semibold text-[var(--tkv-ink-secondary)]">
                {l('Loại phiên', 'Session type')}
              </span>
              <strong className="text-[var(--tkv-ink)]">
                {isGuest
                  ? l('Phiên khách cục bộ', 'Local guest session')
                  : l('Tài khoản đã đăng ký', 'Registered account')}
              </strong>
            </div>
          </div>
        </TkvSurface>

        {/* Honest Unavailable Feature Rows */}
        <div
          className="space-y-3"
          aria-label={l(
            'Các tính năng chia sẻ hộ gia đình chưa mở',
            'Unavailable household sharing features',
          )}
        >
          {unavailableItems.map((it) => (
            <TkvSurface key={it.title} className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#DCE6DE)]">
              <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0 border border-[var(--tkv-accent-border,#FAD0C4)]">
                <VNextIcon name={it.icon} size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#152E2C)]">{it.title}</p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
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
 * Unified Calm Kitchen Commerce experience:
 * - Reads `?plan=monthly|annual` & `?market=VN|JP|DE|FR|GB|US` deep-linked from `/pricing`.
 * - Single Brand Board v2 ceramic Pro hero + quiet payment-rail pill switcher.
 * - Protected Red Zone (`BillingAccountPanel`, `VietQRModal`, `billing.ts`) stays 100% untouched.
 */
export const U07U08PlusReadOnlyWrapper: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { isPlus, isGuest } = useAuthStore();
  const { locale: appLocale, l } = useLocaleText();
  const { locale: uiLocale, catalog } = useUiTranslation(appLocale);

  const rawPlan = searchParams.get('plan');
  const initialPlan: 'monthly' | 'annual' = rawPlan === 'monthly' ? 'monthly' : 'annual';
  const rawMarket = searchParams.get('market')?.trim().toUpperCase() || '';

  const [billingChannel, setBillingChannel] = useState<'payos_vn' | 'dodo_mor'>(() => {
    if (rawMarket === 'VN') return 'payos_vn';
    if (rawMarket && rawMarket !== 'VN') return 'dodo_mor';
    return appLocale === 'vi' ? 'payos_vn' : 'dodo_mor';
  });

  useEffect(() => {
    if (rawMarket === 'VN') {
      setBillingChannel('payos_vn');
    } else if (rawMarket) {
      setBillingChannel('dodo_mor');
    } else {
      setBillingChannel(appLocale === 'vi' ? 'payos_vn' : 'dodo_mor');
    }
  }, [appLocale, rawMarket]);

  return (
    <ConsumerStudioShell screenId="U07" title="Takolio Pro" backTo={vnextHref('/me')}>
      <div className="mx-auto max-w-[680px] space-y-5 pb-6">
        {/* Unified Warm Leaf-Green Brand Board v2 Hero Banner */}
        <section
          aria-label="Takolio Pro"
          className="relative overflow-hidden rounded-[28px] border border-[var(--tkv-border-hero)] bg-gradient-to-br from-[var(--tkv-primary)] to-[var(--tkv-primary-deep)] p-5 sm:p-6 text-white shadow-[var(--tkv-shadow-elevated)]"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--tkv-saffron)]">
                <VNextIcon name="crown" size={13} />
                <span>Takolio Pro</span>
              </span>
              <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-black leading-tight text-white">
                {isPlus ? catalog.billing.heroActiveTitle : catalog.billing.heroUpgradeTitle}
              </h1>
              <p className="text-xs sm:text-sm leading-relaxed text-white/90">
                {isPlus ? catalog.billing.heroActiveSubtitle : catalog.billing.heroUpgradeSubtitle}
              </p>
            </div>
            <div className="hidden xs:flex sm:flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-white/12 p-2 ring-1 ring-white/15">
              <img
                src="/takolio/vnext/mascot/pose-06-achievement-256w.webp"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </section>

        {/* Quiet, Human-Friendly Payment Method Switcher */}
        {!isGuest && (
          <div
            className="flex flex-wrap items-center gap-1.5 rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] p-1"
            role="tablist"
            aria-label={l('Phương thức thanh toán', 'Payment method')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={billingChannel === 'payos_vn'}
              onClick={() => setBillingChannel('payos_vn')}
              className={clsx(
                'tkv-focusable min-h-[42px] flex-1 rounded-full px-4 text-xs sm:text-sm font-bold transition-colors',
                billingChannel === 'payos_vn'
                  ? 'bg-[var(--tkv-surface)] text-[var(--tkv-primary)] shadow-[var(--tkv-shadow-card)]'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              )}
            >
              {catalog.billing.channelVietnam}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={billingChannel === 'dodo_mor'}
              onClick={() => setBillingChannel('dodo_mor')}
              className={clsx(
                'tkv-focusable min-h-[42px] flex-1 rounded-full px-4 text-xs sm:text-sm font-bold transition-colors',
                billingChannel === 'dodo_mor'
                  ? 'bg-[var(--tkv-surface)] text-[var(--tkv-primary)] shadow-[var(--tkv-shadow-card)]'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              )}
            >
              {catalog.billing.channelGlobal}
            </button>
          </div>
        )}

        {!isGuest && billingChannel === 'dodo_mor' ? (
          <Suspense fallback={<SettingsFormSkeleton label={catalog.common.loading} />}>
            <LazyGlobalDodoBillingPanel
              locale={uiLocale}
              initialPlan={initialPlan}
              initialCountryCode={rawMarket && rawMarket !== 'VN' ? rawMarket : undefined}
            />
          </Suspense>
        ) : (
          <div className="tkv-adapted-surface takolio-rebuild" data-tkv-surface-adapt="1">
            <Suspense fallback={<SettingsFormSkeleton label={catalog.common.loading} />}>
              <LazyPlusPaywallPage embedded initialPlan={initialPlan} />
            </Suspense>
          </div>
        )}
      </div>
    </ConsumerStudioShell>
  );
};

/**
 * U09 / U10 — Quyền riêng tư & Xuất/xóa dữ liệu (`/settings/privacy`).
 * Matches U09.png + U10.png 1:1 AND Owner Decision 4 (`BLOCKED_BACKEND` `RFC-002`):
 * Real browser permission & consent controls for U09 + explicit honest UnavailableState for U10 export/delete.
 */
export const U09U10PrivacyAndDataRightsPage: React.FC = () => {
  const { l } = useLocaleText();
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
      location.hash === '#data-rights'
        ? l('Xuất và xóa dữ liệu', 'Export and delete data')
        : l('Quyền riêng tư & Dữ liệu', 'Privacy & Data'),
    description: l(
      'Kiểm soát quyền riêng tư hộ gia đình, sự đồng ý đo lường và trạng thái xuất/xóa dữ liệu.',
      'Control household privacy, analytics consent, and data export/deletion status.',
    ),
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
      title={l('Quyền riêng tư & Dữ liệu', 'Privacy & Data')}
      backTo={vnextHref('/me')}
    >
      <div className="max-w-3xl space-y-7">
        {/* U09 — Quyền riêng tư */}
        <section aria-labelledby="tkv-u09-h1" className="space-y-4">
          <h1 id="tkv-u09-h1" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
            {l('Quyền riêng tư', 'Privacy')}
          </h1>
          <TkvSurface className="p-5 sm:p-6 space-y-4 text-sm text-[var(--tkv-ink-soft,#3C5954)] bg-white border-[var(--tkv-border,#DCE6DE)]">
            <div className="flex items-start gap-3">
              <VNextIcon name="shield" size={20} className="text-[var(--tkv-sage,#196149)] shrink-0 mt-0.5" />
              <p>
                <strong className="text-[var(--tkv-ink,#152E2C)]">
                  {l('Cô lập dữ liệu theo hộ gia đình:', 'Household data isolation:')}
                </strong>{' '}
                {l(
                  'Mọi truy vấn tồn kho, thực đơn tuần, giỏ đi chợ và bản quét AI đều được xác thực theo phiên máy chủ và',
                  'All inventory, weekly meal plan, shopping list, and AI scan queries are verified against your server session and isolated by',
                )}{' '}
                <code>household_id</code>
                {l(' riêng biệt.', '.')}
              </p>
            </div>
            <div className="flex items-start gap-3 border-t border-[var(--tkv-border,#DCE6DE)] pt-3">
              <VNextIcon name="scan" size={20} className="text-[var(--tkv-primary,#196149)] shrink-0 mt-0.5" />
              <p>
                <strong className="text-[var(--tkv-ink,#152E2C)]">
                  {l('Xử lý ảnh quét AI:', 'AI scan image processing:')}
                </strong>{' '}
                {l(
                  'Ảnh tủ lạnh hoặc hóa đơn chỉ được gửi khi bạn bấm chụp/chọn ảnh và luôn yêu cầu bước duyệt thủ công trước khi ghi vào tồn kho.',
                  'Fridge or receipt photos are only uploaded when you explicitly capture or pick an image, and always require manual review before updating inventory.',
                )}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-[var(--tkv-border)] pt-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[var(--tkv-ink)]">
                  {l(
                    'Đồng ý ghi nhận tương tác trang giới thiệu (cục bộ)',
                    'Local marketing interaction analytics consent',
                  )}
                </p>
                <p className="text-xs text-[var(--tkv-ink-muted)]">
                  {l(
                    'Mặc định tắt · Không gửi dữ liệu cho bên thứ ba khi chưa đồng ý',
                    'Off by default · No third-party tracking without your consent',
                  )}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={analyticsConsent}
                onClick={toggleConsent}
                className={clsx(
                  'tkv-focusable min-h-[44px] px-4 py-2 rounded-full text-xs sm:text-sm font-bold border transition-colors shrink-0',
                  analyticsConsent
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                    : 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
                )}
              >
                {analyticsConsent ? l('Đang bật', 'Enabled') : l('Đang tắt', 'Disabled')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap border-t border-[var(--tkv-border)] pt-3 text-xs tabular-nums">
              <span className="min-w-0">
                {l(
                  'Thao tác ngoại tuyến đang chờ đồng bộ trên trình duyệt này:',
                  'Offline actions waiting to sync on this browser:',
                )}
              </span>
              <strong className="text-[var(--tkv-ink)] shrink-0">
                {l(`${pendingCount} mục`, `${pendingCount} ${pendingCount === 1 ? 'item' : 'items'}`)}
              </strong>
            </div>
          </TkvSurface>
        </section>

        {/* U10 — Xuất và xóa dữ liệu (Honest BLOCKED_BACKEND) */}
        <section id="data-rights" aria-labelledby="tkv-u10-h2" className="space-y-4">
          <h2 id="tkv-u10-h2" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
            {l('Xuất và xóa dữ liệu', 'Export and delete data')}
          </h2>

          <TkvSurface className="p-5 space-y-2 bg-[var(--tkv-surface-muted,#E7F4EC)] border-[var(--tkv-border,#DCE6DE)]">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--tkv-honey-soft,#FFF5D6)] border border-[var(--tkv-honey-border,#F5DE93)] text-xs font-semibold text-[var(--tkv-honey-ink,#8A5205)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#F6C453)]" aria-hidden="true" />
              <span>U10 · BLOCKED_BACKEND (RFC-002)</span>
            </span>
            <p className="text-sm sm:text-base font-bold text-[var(--tkv-ink,#152E2C)]">
              {l(
                'Dữ liệu thuộc quyền kiểm soát của bạn. Tính năng xuất bản sao và xóa tài khoản tự động cần API máy chủ được phê duyệt.',
                'Your data belongs to you. Automated data export and account deletion require approved backend APIs.',
              )}
            </p>
          </TkvSurface>

          <div className="space-y-3">
            <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#DCE6DE)]">
              <span className="w-11 h-11 rounded-xl bg-[var(--tkv-sage-soft,#E7F4EC)] text-[var(--tkv-sage,#196149)] flex items-center justify-center shrink-0 border border-[var(--tkv-sage-border,#BDE0CC)]">
                <VNextIcon name="download" size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#152E2C)]">
                  {l(
                    'Xuất dữ liệu · Cần API máy chủ (RFC-002)',
                    'Export data · Backend API required (RFC-002)',
                  )}
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                  {l(
                    'Đang chờ triển khai điểm cuối đóng gói JSON/CSV toàn bộ tồn kho, lịch tuần và giỏ đi chợ theo hộ gia đình.',
                    'Awaiting server endpoints to package household inventory, meal plans, and shopping lists as JSON/CSV.',
                  )}
                </p>
              </div>
            </TkvSurface>

            <TkvSurface className="p-4 sm:p-5 flex items-start gap-3.5 bg-white border-[var(--tkv-border,#DCE6DE)]">
              <span className="w-11 h-11 rounded-xl bg-[var(--tkv-accent-soft,#FFF0E9)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0 border border-[var(--tkv-accent-border,#FAD0C4)]">
                <VNextIcon name="trash" size={20} />
              </span>
              <div className="space-y-1">
                <p className="tkv-heading text-base font-bold text-[var(--tkv-ink,#152E2C)]">
                  {l(
                    'Xóa tài khoản · Cần API máy chủ (RFC-002)',
                    'Delete account · Backend API required (RFC-002)',
                  )}
                </p>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                  {l(
                    'Ứng dụng không hiển thị nút xóa giả. Quy trình xóa vĩnh viễn yêu cầu xác thực lại và xử lý đối soát gói Pro trên tầng máy chủ.',
                    'We never show fake delete buttons. Permanent deletion requires re-authentication and server-side Pro subscription reconciliation.',
                  )}
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

interface SystemStateSpec {
  id: string;
  title: string;
  lead: string;
  pose: 'error' | 'offline' | 'guide' | 'empty-fridge' | 'welcome';
  cards: Array<{ icon: VNextIconName; heading: string; sub: string; to?: string }>;
  ctaLabel: string;
  ctaHref: string;
}

function getSystemStatesSpec(
  l: (vi: string, en: string) => string,
): Record<SystemStateCode, SystemStateSpec> {
  return {
    s01: {
      id: 'S01',
      title: l('Không có quyền truy cập', 'Access restricted'),
      lead: l(
        'Phiên đăng nhập đã hết hạn hoặc tài khoản hiện tại không có quyền mở nội dung này.',
        'Your sign-in session has expired or your current account does not have permission to view this page.',
      ),
      pose: 'error',
      cards: [
        {
          icon: 'lock',
          heading: l('Đăng nhập lại an toàn', 'Sign in safely again'),
          sub: l(
            'Xác thực lại phiên mà không làm lộ dữ liệu hộ khác',
            'Re-authenticate your session without exposing any other household data',
          ),
          to: '/auth?mode=login',
        },
        {
          icon: 'home',
          heading: l('Về trang giới thiệu', 'Return to home page'),
          sub: l('Quay lại khu vực công khai của Takolio', 'Go back to the public Takolio site'),
          to: '/landing',
        },
      ],
      ctaLabel: l('Đăng nhập tài khoản', 'Sign in to your account'),
      ctaHref: '/auth?mode=login',
    },
    s02: {
      id: 'S02',
      title: l('Không tìm thấy trang', 'Page not found'),
      lead: l(
        'Đường dẫn này có thể đã thay đổi hoặc không còn tồn tại trong ứng dụng.',
        'This link may have moved or no longer exists in the app.',
      ),
      pose: 'guide',
      cards: [
        {
          icon: 'home',
          heading: l('Trở lại trang chủ', 'Back to home'),
          sub: l('Thao tác an toàn về màn hình chính', 'Safely return to your kitchen dashboard'),
          to: '/',
        },
        {
          icon: 'search',
          heading: l('Tìm kiếm trong app', 'Search in the app'),
          sub: l(
            'Tra cứu món ăn hoặc nguyên liệu trong bếp',
            'Find recipes or ingredients in your kitchen',
          ),
          to: '/search',
        },
      ],
      ctaLabel: l('Về màn hình chính', 'Go to dashboard'),
      ctaHref: '/',
    },
    s03: {
      id: 'S03',
      title: l('Hệ thống chưa sẵn sàng', 'Service temporarily unavailable'),
      lead: l(
        'Máy chủ đang bận hoặc gặp sự cố tạm thời. Dữ liệu cũ không bị ghi đè sai lệch.',
        'The server is busy or experiencing a temporary issue. Your existing data has not been overwritten.',
      ),
      pose: 'error',
      cards: [
        {
          icon: 'refresh',
          heading: l('Thử tải lại trang', 'Try reloading the page'),
          sub: l(
            'Kiểm tra lại kết nối tới máy chủ Takolio',
            'Check your connection to the Takolio server',
          ),
        },
        {
          icon: 'fridge',
          heading: l('Mở tủ lạnh của tôi', 'Open my fridge'),
          sub: l(
            'Xem trạng thái tồn kho đã xác thực gần nhất',
            'View your most recently verified inventory state',
          ),
          to: '/fridge',
        },
      ],
      ctaLabel: l('Thử tải lại', 'Try again'),
      ctaHref: '/',
    },
    s04: {
      id: 'S04',
      title: l('Đang ngoại tuyến', 'You are offline'),
      lead: l(
        'Một số dữ liệu có thể xem nhưng chưa thể đồng bộ lên máy chủ cho tới khi có mạng trở lại.',
        'Some saved data stays readable, but changes will wait to sync until you are back online.',
      ),
      pose: 'offline',
      cards: [
        {
          icon: 'fridge',
          heading: l('Xem nội dung đã lưu', 'View saved kitchen data'),
          sub: l(
            'Tồn kho và danh sách đi chợ trong phạm vi hộ hiện tại',
            'Inventory and shopping list scoped to your current household',
          ),
          to: '/fridge',
        },
        {
          icon: 'history',
          heading: l('Thao tác chờ đồng bộ', 'Changes waiting to sync'),
          sub: l(
            'Các thay đổi ngoại tuyến được giữ trong hàng đợi an toàn',
            'Offline edits are held safely in your sync outbox',
          ),
          to: '/shopping',
        },
        {
          icon: 'refresh',
          heading: l('Kết nối lại', 'Reconnect'),
          sub: l(
            'Tự động gửi hàng đợi sau khi xác minh phiên máy chủ',
            'Queued actions replay automatically after server session verification',
          ),
        },
      ],
      ctaLabel: l('Kiểm tra lại kết nối', 'Check connection'),
      ctaHref: '/',
    },
    s05: {
      id: 'S05',
      title: l('Xung đột phiên bản dữ liệu', 'Data version conflict'),
      lead: l(
        'Nguyên liệu hoặc thực đơn vừa được cập nhật trên một thiết bị khác (HTTP 409 Conflict).',
        'An ingredient or meal plan was updated on another device (HTTP 409 Conflict).',
      ),
      pose: 'guide',
      cards: [
        {
          icon: 'refresh',
          heading: l(
            'Tải lại phiên bản mới nhất từ máy chủ',
            'Reload the latest version from the server',
          ),
          sub: l(
            'Không bao giờ âm thầm ghi đè dữ liệu của thiết bị kia',
            'We never silently overwrite edits made on another device',
          ),
          to: '/fridge',
        },
        {
          icon: 'history',
          heading: l('Mở đối soát tồn kho (C08)', 'Open inventory reconciliation (C08)'),
          sub: l(
            'So sánh chi tiết trước khi áp dụng thay đổi',
            'Review differences carefully before applying changes',
          ),
          to: '/inventory-reconciliation',
        },
      ],
      ctaLabel: l('Mở tủ lạnh mới nhất', 'Open latest fridge state'),
      ctaHref: '/fridge',
    },
    s06: {
      id: 'S06',
      title: l('Trạng thái tải và rỗng', 'Loading & empty states'),
      lead: l(
        'Phân biệt rõ đang tải (skeleton khớp bố cục), kho rỗng thực sự và bộ lọc không có kết quả.',
        'Clearly distinguishes loading skeletons, truly empty inventories, and zero-match filters.',
      ),
      pose: 'empty-fridge',
      cards: [
        {
          icon: 'plus',
          heading: l('Kho rỗng thực sự', 'Truly empty fridge'),
          sub: l(
            'Hướng dẫn thêm nguyên liệu đầu tiên vào tủ lạnh',
            'Guided prompt to add your first kitchen ingredients',
          ),
          to: '/fridge?action=add',
        },
        {
          icon: 'filter',
          heading: l('Bộ lọc không khớp', 'No matching filter results'),
          sub: l(
            'Giữ nguyên dữ liệu gốc và cho phép xóa nhanh bộ lọc',
            'Keeps your underlying data intact and lets you clear filters quickly',
          ),
          to: '/recipes',
        },
      ],
      ctaLabel: l('Mở tủ lạnh', 'Open fridge'),
      ctaHref: '/fridge',
    },
    s07: {
      id: 'S07',
      title: l('Quyền truy cập & Sự đồng ý', 'Permissions & consent'),
      lead: l(
        'Giải thích rõ lý do trước khi xin quyền Camera hoặc Thông báo — luôn có lối đi thay thế khi bạn từ chối.',
        'Explains why before requesting Camera or Notification access — with clear fallbacks if you decline.',
      ),
      pose: 'guide',
      cards: [
        {
          icon: 'scan',
          heading: l('Quyền Camera khi quét thực phẩm', 'Camera access for food scanning'),
          sub: l(
            'Nếu từ chối camera, bạn vẫn tải ảnh từ thư viện hoặc nhập tay bình thường',
            'If camera access is declined, you can still upload from your library or enter items manually',
          ),
          to: '/scan',
        },
        {
          icon: 'notification',
          heading: l('Quyền Thông báo trình duyệt', 'Browser notification permission'),
          sub: l(
            'Không bao giờ báo đã bật thông báo khi trình duyệt đang chặn',
            'Never claims notifications are enabled when the browser has blocked them',
          ),
          to: '/settings/notifications',
        },
      ],
      ctaLabel: l('Xem cài đặt quyền riêng tư', 'View privacy settings'),
      ctaHref: '/settings/privacy',
    },
    s08: {
      id: 'S08',
      title: l('Cài đặt & Cập nhật ứng dụng PWA', 'PWA installation & updates'),
      lead: l(
        'Thêm Takolio ra màn hình chính và cập nhật phiên bản mới an toàn mà không làm mất dữ liệu đang nhập.',
        'Add Takolio to your home screen and apply app updates safely without losing in-progress edits.',
      ),
      pose: 'welcome',
      cards: [
        {
          icon: 'download',
          heading: l('Cài đặt lên màn hình chính', 'Install to home screen'),
          sub: l(
            'Mở nhanh như ứng dụng gốc trên iOS, Android và máy tính',
            'Launch quickly like a native app on iOS, Android, and desktop',
          ),
        },
        {
          icon: 'shield',
          heading: l('Cập nhật Service Worker an toàn', 'Safe Service Worker updates'),
          sub: l(
            'Không tự ý tải lại đè lên biểu mẫu đang sửa hoặc hàng đợi ngoại tuyến',
            'Never force-reloads over an active form or pending offline queue',
          ),
          to: '/settings/app',
        },
      ],
      ctaLabel: l('Mở cài đặt ứng dụng', 'Open app settings'),
      ctaHref: '/settings/app',
    },
  };
}

/**
 * S01–S08 — System States Surface (`/vnext/states/:stateId` + Live `S02` 404 NotFound Route).
 * Matches S01..S08 wireframes cleanly with Bé Mầm Bếp medallion, safe recovery cards, and real outbox status.
 */
export const VNextSystemStatePage: React.FC<{ forcedState?: SystemStateCode }> = ({ forcedState }) => {
  const { l } = useLocaleText();
  const { stateId } = useParams<{ stateId: string }>();
  const navigate = useNavigate();
  const normalized = (forcedState ?? stateId?.toLowerCase() ?? 's02') as SystemStateCode;
  const specs = getSystemStatesSpec(l);
  const spec = specs[normalized] ?? specs.s02;
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
    <div
      className="tkv-root min-h-dvh bg-[var(--tkv-bg)] flex flex-col items-center justify-center px-4 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(2rem,env(safe-area-inset-bottom,0px))] sm:py-10"
      data-tkv-screen={spec.id}
    >
      <main className="w-full max-w-xl space-y-6">
        <TkvSurface className="p-4 sm:p-8 space-y-6 bg-white border-[var(--tkv-border)] shadow-soft">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--tkv-accent-soft)] border border-[var(--tkv-accent-border)] text-xs font-semibold text-[var(--tkv-accent-ink)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)] shrink-0" aria-hidden="true" />
              <span>
                {spec.id} · {l('Trạng thái hệ thống', 'System state')}
              </span>
            </span>
            {normalized === 's04' && (
              <TkvBadge tone={online ? 'success' : 'warning'}>
                <span className="tabular-nums">
                  {online
                    ? l('Mạng đã kết nối', 'Back online')
                    : l('Đang ngoại tuyến', 'Offline')}{' '}
                  · {l('Chờ đồng bộ:', 'Pending sync:')} {pendingOpsCount}
                </span>
              </TkvBadge>
            )}
          </div>

          <div className="flex justify-center">
            <div className="w-28 h-28 rounded-full bg-[var(--tkv-surface-mint)] p-3 flex items-center justify-center border border-[var(--tkv-border-mint)]">
              <MascotIllustration pose={spec.pose} size={92} />
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
                <div className="rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] p-4 flex items-center justify-between gap-3 hover:border-[var(--tkv-border-strong)] transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <span className="w-10 h-10 rounded-xl bg-white border border-[var(--tkv-border)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                      <VNextIcon name={c.icon} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="tkv-heading text-sm sm:text-base font-bold text-[var(--tkv-ink)]">
                        {c.heading}
                      </p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)] leading-snug">{c.sub}</p>
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
