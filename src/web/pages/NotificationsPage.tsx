import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountPage } from '../components/common/AccountPage';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
  SegmentedTabs,
} from '../design-system/v4/AtelierPrimitives';
import {
  ExpiryRescueBellIcon,
  NavShoppingIcon,
  NavPlannerIcon,
  ShareFamilyLinkIcon,
  FreshnessShieldIcon,
} from '../design-system/icons';
import { api } from '../services/api';
import { notificationsApi, type AppNotification } from '../services/notifications';
import { queryKeys } from '../lib/queryKeys';
import { Check, CheckCheck, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { clsx } from 'clsx';

type NotificationFilter = 'all' | 'expiry' | 'shopping' | 'planner' | 'household';

function inferCategory(n: AppNotification): Exclude<NotificationFilter, 'all'> {
  if (n.category && n.category !== 'system') {
    return n.category;
  }
  const key = `${n.type} ${n.title}`.toLowerCase();
  if (key.includes('expir') || key.includes('hạn') || key.includes('cứu')) return 'expiry';
  if (key.includes('shop') || key.includes('chợ') || key.includes('mua')) return 'shopping';
  if (key.includes('house') || key.includes('gia đình') || key.includes('thành viên'))
    return 'household';
  return 'planner';
}

function renderCategoryIcon(category: Exclude<NotificationFilter, 'all'>) {
  switch (category) {
    case 'expiry':
      return <ExpiryRescueBellIcon size={20} tone="turmeric" active />;
    case 'shopping':
      return <NavShoppingIcon size={20} tone="flame" active />;
    case 'household':
      return <ShareFamilyLinkIcon size={20} tone="jade" active />;
    case 'planner':
    default:
      return <NavPlannerIcon size={20} tone="jade" active />;
  }
}

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

export const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const baseNotifKey = queryKeys.notifications();
  const notifKey = baseNotifKey;
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const notificationsQuery = useQuery({
    queryKey: notifKey,
    queryFn: () => api.getNotifications(),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => {
      const fn =
        (api as Partial<typeof notificationsApi>).markNotificationRead ??
        notificationsApi.markNotificationRead;
      return fn(id);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<AppNotification[]>(notifKey, (prev) =>
        prev ? prev.map((item) => (item.id === updated.id ? updated : item)) : prev,
      );
      void queryClient.invalidateQueries({ queryKey: baseNotifKey });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => {
      const fn =
        (api as Partial<typeof notificationsApi>).markAllNotificationsRead ??
        notificationsApi.markAllNotificationsRead;
      return fn();
    },
    onSuccess: () => {
      queryClient.setQueryData<AppNotification[]>(notifKey, (prev) =>
        prev ? prev.map((item) => ({ ...item, isRead: true })) : prev,
      );
      void queryClient.invalidateQueries({ queryKey: baseNotifKey });
    },
  });

  const allItems = notificationsQuery.data ?? [];
  const unreadCount = useMemo(() => allItems.filter((n) => !n.isRead).length, [allItems]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return allItems;
    return allItems.filter((n) => inferCategory(n) === filter);
  }, [allItems, filter]);

  return (
    <AccountPage
      title="Thông báo"
      description="Cảnh báo nguyên liệu sắp đến hạn FEFO, danh sách đi chợ và hoạt động bếp gia đình."
      backTo="/"
      action={
        unreadCount > 0 ? (
          <ActionButton
            variant="ceramic"
            size="sm"
            loading={markAllReadMutation.isPending}
            icon={<CheckCheck size={15} aria-hidden="true" />}
            onClick={() => markAllReadMutation.mutate()}
          >
            Đánh dấu tất cả đã đọc
          </ActionButton>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {allItems.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="overflow-x-auto max-w-full pb-1">
              <SegmentedTabs<NotificationFilter>
                layoutId="tk-notifications-filter"
                value={filter}
                onChange={setFilter}
                options={[
                  {
                    value: 'all',
                    label: 'Tất cả',
                    badge: unreadCount > 0 ? unreadCount : undefined,
                  },
                  { value: 'expiry', label: 'Hạn dùng' },
                  { value: 'shopping', label: 'Đi chợ' },
                  { value: 'planner', label: 'Thực đơn' },
                  { value: 'household', label: 'Gia đình' },
                ]}
              />
            </div>
          </div>
        )}

        <section aria-label="Thông báo mới">
          {notificationsQuery.isPending ? (
            <InlineLoading label="Đang tải thông báo…" />
          ) : notificationsQuery.isError ? (
            <InlineError
              error={notificationsQuery.error}
              onRetry={() => void notificationsQuery.refetch()}
            />
          ) : allItems.length === 0 ? (
            <BentoCard tone="ceramic" padding="lg" className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-tk-jade-soft border border-tk-jade/20 flex items-center justify-center mx-auto">
                <FreshnessShieldIcon size={24} tone="jade" active />
              </div>
              <p className="text-sm font-bold text-tk-ink">Không có thông báo để hiển thị.</p>
              <p className="text-xs text-tk-muted max-w-md mx-auto leading-relaxed">
                Khi tủ lạnh có nguyên liệu gần hạn dùng hoặc người thân cập nhật danh sách đi chợ,
                Takolio sẽ báo ngay tại đây. Khi mất mạng, hộp này có thể chưa phản ánh dữ liệu mới
                nhất.
              </p>
            </BentoCard>
          ) : filteredItems.length === 0 ? (
            <BentoCard tone="sunken" padding="md" className="text-center space-y-2">
              <p className="text-sm font-semibold text-tk-secondary">
                Chưa có thông báo nào trong nhóm mục này.
              </p>
              <ActionButton variant="ceramic" size="sm" onClick={() => setFilter('all')}>
                Xem tất cả thông báo
              </ActionButton>
            </BentoCard>
          ) : (
            <div className="rounded-[24px] border border-tk-stone bg-white shadow-card divide-y divide-tk-stone/70 overflow-hidden">
              {filteredItems.map((n) => {
                const cat = inferCategory(n);
                const unread = !n.isRead;
                return (
                  <article
                    key={n.id}
                    className={clsx(
                      'p-4 sm:p-5 flex items-start justify-between gap-3.5 transition-colors',
                      unread ? 'bg-tk-flame-soft/30' : 'bg-white',
                    )}
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <span
                          className={clsx(
                            'w-10 h-10 rounded-2xl flex items-center justify-center border',
                            cat === 'expiry'
                              ? 'bg-tk-turmeric-soft border-tk-turmeric/25'
                              : cat === 'shopping'
                                ? 'bg-tk-flame-soft border-tk-flame/20'
                                : 'bg-tk-jade-soft border-tk-jade/20',
                          )}
                        >
                          {renderCategoryIcon(cat)}
                        </span>
                        {unread && (
                          <span
                            aria-label="Chưa đọc"
                            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-tk-flame ring-2 ring-white"
                          />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2
                            className={clsx(
                              'font-heading text-sm leading-snug',
                              unread ? 'font-extrabold text-tk-ink' : 'font-bold text-tk-secondary',
                            )}
                          >
                            {n.title}
                          </h2>
                          {unread && <AtelierBadge tone="flame">Mới</AtelierBadge>}
                        </div>
                        <p className="text-xs text-tk-secondary leading-relaxed">{n.message}</p>
                        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] text-tk-muted">
                          <time dateTime={n.createdAt}>{relativeTimeVi(n.createdAt)}</time>
                          {n.actionUrl && n.actionUrl.startsWith('/') && (
                            <Link
                              to={n.actionUrl}
                              className="font-bold text-tk-jade hover:underline inline-flex items-center gap-0.5"
                            >
                              Mở xem ngay <ChevronRight size={12} aria-hidden="true" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>

                    {unread && (
                      <button
                        type="button"
                        disabled={markReadMutation.isPending}
                        onClick={() => markReadMutation.mutate(n.id)}
                        aria-label={`Đánh dấu đã đọc: ${n.title}`}
                        className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-xl border border-tk-stone bg-white hover:bg-tk-sunken text-xs font-bold text-tk-ink inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Check size={14} className="text-tk-jade" aria-hidden="true" />
                        <span className="hidden sm:inline">Đã đọc</span>
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <Link
          to="/settings/notifications"
          className="flex items-center justify-between gap-3 rounded-2xl border border-tk-stone bg-white px-4 py-3.5 text-sm font-bold text-tk-ink shadow-xs hover:bg-tk-sunken/50 transition-colors"
        >
          <span className="flex items-center gap-3">
            <SlidersHorizontal className="w-5 h-5 text-tk-jade" aria-hidden="true" />
            Tùy chỉnh nhắc nhở trên thiết bị
          </span>
          <ChevronRight className="w-4 h-4 text-tk-muted" aria-hidden="true" />
        </Link>
      </div>
    </AccountPage>
  );
};
