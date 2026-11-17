import { useContext, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { QueryClientContext, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Bell, User } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuthStore } from '../../stores/useAuthStore';
import { KitchenScanLink } from '../../design-system/navigation';
import { TAKOSAN_KITCHEN } from '../../lib/takosan-kitchen';
import {
  FreshnessShieldIcon,
  MortarPestleIcon,
  NavShoppingIcon,
  TakolioWordmarkLockup,
} from '../../design-system/icons';
import { notificationsApi } from '../../services/notifications';
import { queryKeys } from '../../lib/queryKeys';

function NotificationBellWithQuery({ enabled: _enabled }: { enabled: boolean }) {
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: () => notificationsApi.getNotifications(),
    enabled: false,
    staleTime: 60_000,
    retry: false,
  });

  const unreadCount = (notificationsQuery.data ?? []).filter((item) => !item.isRead).length;

  return (
    <Link
      to="/notifications"
      aria-label="Thông báo"
      className="kitchen-icon-link relative !rounded-2xl !border-tk-stone/80 !bg-white hover:!bg-tk-sunken transition-colors"
    >
      <Bell aria-hidden="true" size={20} className="text-tk-ink" />
      {unreadCount > 0 && (
        <span
          data-testid="notification-unread-badge"
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-tk-flame px-1 text-[10px] font-extrabold text-white shadow-xs tk-tabular"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}

export function KitchenHeader({
  backTo,
  backLabel = 'Quay lại',
}: {
  backTo?: string;
  backLabel?: string;
}) {
  const auth = useAuthStore();
  const avatarUrl = auth?.avatarUrl;
  const { pathname } = useLocation();
  const queryClient = useContext(QueryClientContext);
  const hasSession = Boolean(
    auth?.userId ||
      (typeof window !== 'undefined' &&
        typeof window.localStorage !== 'undefined' &&
        window.localStorage.getItem('frigo_user_id')),
  );
  const isShoppingActive =
    pathname.toLowerCase() === '/shopping' || pathname.toLowerCase().startsWith('/shopping/');
  const isStudioActive =
    pathname.toLowerCase() === '/studio' || pathname.toLowerCase().startsWith('/studio/');
  const isInsightsActive =
    pathname.toLowerCase() === '/insights' || pathname.toLowerCase().startsWith('/insights/');

  return (
    <header
      className={clsx(
        'kitchen-header !bg-tk-canvas/90 backdrop-blur-xl !border-tk-stone/80',
        backTo && 'kitchen-header-with-back',
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {backTo && (
          <Link
            to={backTo}
            aria-label={backLabel}
            className="kitchen-icon-link !rounded-2xl !border-tk-stone/80 !bg-white hover:!bg-tk-sunken transition-colors"
          >
            <ArrowLeft aria-hidden="true" size={20} className="text-tk-ink" />
          </Link>
        )}
        <Link
          to="/"
          aria-label="Takolio — Trang chủ"
          translate="no"
          className="kitchen-brand-link gap-2"
        >
          <TakolioWordmarkLockup size={30} tone="ink" className="shrink-0" />
          <picture className="sr-only">
            {backTo && (
              <source
                media="(max-width: 374px)"
                srcSet={TAKOSAN_KITCHEN.wordmark}
                width={466}
                height={262}
              />
            )}
            <img src={TAKOSAN_KITCHEN.logo} alt="" width={1050} height={414} />
          </picture>
        </Link>
        <span className="kitchen-brand-motto" aria-hidden="true">
          {TAKOSAN_KITCHEN.motto}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Quick 1-tap Heirloom & Batch-Prep Studio Pill */}
        <Link
          to="/studio"
          aria-current={isStudioActive ? 'page' : undefined}
          className={clsx(
            'hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-extrabold transition-colors tap-target',
            isStudioActive
              ? 'border-tk-turmeric/40 bg-tk-turmeric-soft text-tk-turmeric-deep shadow-xs'
              : 'border-tk-stone/85 bg-white text-tk-ink hover:bg-tk-sunken',
          )}
        >
          <MortarPestleIcon
            size={16}
            tone={isStudioActive ? 'turmeric' : 'flame'}
            active={isStudioActive}
          />
          <span>Sổ tay AI</span>
        </Link>

        {/* Quick 1-tap Kitchen OS Insights Pill */}
        <Link
          to="/insights"
          aria-current={isInsightsActive ? 'page' : undefined}
          className={clsx(
            'hidden md:inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-extrabold transition-colors tap-target',
            isInsightsActive
              ? 'border-tk-jade/30 bg-tk-jade-soft text-tk-jade-deep shadow-xs'
              : 'border-tk-stone/85 bg-white text-tk-ink hover:bg-tk-sunken',
          )}
        >
          <FreshnessShieldIcon
            size={16}
            tone={isInsightsActive ? 'jade' : 'ink'}
            active={isInsightsActive}
          />
          <span>Phân tích</span>
        </Link>

        {/* Quick 1-tap Shopping Bag Pill */}
        <Link
          to="/shopping"
          aria-current={isShoppingActive ? 'page' : undefined}
          className={clsx(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-extrabold transition-colors tap-target',
            isShoppingActive
              ? 'border-tk-jade/30 bg-tk-jade-soft text-tk-jade-deep shadow-xs'
              : 'border-tk-stone/85 bg-white text-tk-ink hover:bg-tk-sunken',
          )}
        >
          <NavShoppingIcon
            size={17}
            tone={isShoppingActive ? 'jade' : 'ink'}
            active={isShoppingActive}
          />
          <span className="hidden sm:inline">Đi chợ</span>
        </Link>

        {/* Live Unread Notification Bell */}
        {queryClient ? (
          <NotificationBellWithQuery enabled={hasSession} />
        ) : (
          <Link
            to="/notifications"
            aria-label="Thông báo"
            className="kitchen-icon-link !rounded-2xl !border-tk-stone/80 !bg-white hover:!bg-tk-sunken transition-colors"
          >
            <Bell aria-hidden="true" size={20} className="text-tk-ink" />
          </Link>
        )}

        <Link
          to="/me"
          aria-label="Tài khoản cá nhân"
          className="kitchen-icon-link kitchen-account-link !rounded-2xl !border-tk-stone/80 !bg-white hover:!bg-tk-sunken transition-colors overflow-hidden"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={36}
              height={36}
              className="rounded-full object-cover"
            />
          ) : (
            <User aria-hidden="true" size={20} className="text-tk-ink" />
          )}
        </Link>
      </div>

      <KitchenScanLink className="kitchen-header-scan" />
    </header>
  );
}

export function KitchenPageHeading({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="kitchen-page-heading">
      <div className="min-w-0">
        {eyebrow && (
          <p className="kitchen-eyebrow !text-tk-jade uppercase tracking-wider">{eyebrow}</p>
        )}
        <h1 className="font-heading text-tk-ink">{title}</h1>
        {description && <div className="mt-2 text-sm text-tk-secondary">{description}</div>}
      </div>
      {action}
    </div>
  );
}
