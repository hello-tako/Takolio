import { AccountPage } from '../../components/common/AccountPage';
import React, { useState } from 'react';
import { Bell, Calendar, Clock, ShoppingBag, Sparkles } from 'lucide-react';
import { getCurrentScope } from '../../services/http';
import { Switch, UnavailableState } from '../../design-system/primitives';
import { useLocaleText } from '../../i18n/app-i18n';

type ToggleState = {
  remindWeekPlan: boolean;
  remindExpiring: boolean;
  remindShopping: boolean;
  remindTodayMeal: boolean;
  promoUpdates: boolean;
};

const DEFAULT_TOGGLES: ToggleState = {
  remindWeekPlan: true,
  remindExpiring: true,
  remindShopping: true,
  remindTodayMeal: true,
  promoUpdates: false,
};

// Device-local preference, scoped per user so account switches don't leak.
function prefsKey(): string | null {
  const { userId } = getCurrentScope();
  return userId ? `frigo_notify_prefs_${encodeURIComponent(userId)}` : null;
}

function readToggles(): ToggleState {
  try {
    const key = prefsKey();
    const raw = key ? localStorage.getItem(key) : null;
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const result = { ...DEFAULT_TOGGLES };
        for (const key of Object.keys(result) as Array<keyof ToggleState>) {
          const value = (parsed as Record<string, unknown>)[key];
          if (typeof value === 'boolean') result[key] = value;
        }
        return result;
      }
    }
  } catch {
    // corrupted prefs fall back to defaults
  }
  return DEFAULT_TOGGLES;
}

const PERMISSION_LABELS: Record<string, { vi: string; en: string }> = {
  granted: { vi: 'đã cho phép', en: 'allowed' },
  denied: { vi: 'đã chặn', en: 'blocked' },
  default: { vi: 'chưa được yêu cầu', en: 'not requested yet' },
  unsupported: { vi: 'trình duyệt không hỗ trợ', en: 'not supported by this browser' },
};

/**
 * T17 screen 24 — notification preferences, separated from the inbox
 * (screen 23). Only real capability is offered: device-local reminder
 * intent switches; no scheduled/filter delivery is implemented.
 */
export const NotificationPreferencesPage: React.FC = () => {
  const { l } = useLocaleText();
  const [toggles, setToggles] = useState<ToggleState>(readToggles);

  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  const toggle = (key: keyof ToggleState) => {
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    try {
      const storageKey = prefsKey();
      if (!storageKey) throw new Error('No preference owner');
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageMessage(
        l('Đã ghi nhớ lựa chọn trên thiết bị này.', 'Preference saved on this device.'),
      );
    } catch {
      setStorageMessage(
        l(
          'Chưa lưu được trên thiết bị. Lựa chọn chỉ giữ khi trang này đang mở.',
          'Could not save on this device. This choice will only last while this page stays open.',
        ),
      );
    }
  };

  const browserPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const permissionLabelEntry = PERMISSION_LABELS[browserPermission];
  const permissionLabel = permissionLabelEntry
    ? l(permissionLabelEntry.vi, permissionLabelEntry.en)
    : l('không xác định', 'unknown');

  return (
    <AccountPage
      title={l('Tùy chỉnh thông báo', 'Notification preferences')}
      description={l('Nhắc nhở từ tủ lạnh của bạn', 'Reminders from your kitchen')}
    >

      <section aria-label={l('Lựa chọn nhắc nhở', 'Reminder choices')} className="mb-6">
        <h2 className="text-type-label text-semantic-text-primary mb-2">
          {l('Lựa chọn nhắc nhở', 'Reminder choices')}
        </h2>
        <div className="bg-semantic-surface rounded-card border border-semantic-border divide-y divide-semantic-border">
          {(
            [
              {
                key: 'remindWeekPlan',
                label: l('Nhắc lập thực đơn tuần', 'Weekly meal plan reminder'),
                desc: l('Chuẩn bị bữa ăn cho tuần kế tiếp', 'Prepare meals for the upcoming week'),
                icon: Calendar,
              },
              {
                key: 'remindExpiring',
                label: l('Nhắc nguyên liệu sắp hết', 'Expiring ingredients reminder'),
                desc: l('Ưu tiên đồ ăn cần dùng sớm', 'Prioritize food that should be used soon'),
                icon: Clock,
              },
              {
                key: 'remindShopping',
                label: l('Nhắc đi chợ', 'Shopping reminder'),
                desc: l('Theo dõi nguyên liệu cần mua', 'Keep track of groceries to buy'),
                icon: ShoppingBag,
              },
              {
                key: 'remindTodayMeal',
                label: l('Nhắc bữa ăn hôm nay', 'Today’s meal reminder'),
                desc: l('Theo dõi bữa ăn trong ngày', 'Stay on top of today’s meals'),
                icon: Bell,
              },
              {
                key: 'promoUpdates',
                label: l('Khuyến mãi & cập nhật', 'Updates & offers'),
                desc: l('Tính năng mới và ưu đãi Takolio Pro', 'New features and Takolio Pro offers'),
                icon: Sparkles,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.key} className="account-switch-row">
                <span className="w-9 h-9 rounded-card bg-semantic-background-subtle text-semantic-action-primary flex items-center justify-center shrink-0" aria-hidden="true">
                  <Icon className="w-5 h-5" />
                </span>
                <Switch
                  checked={toggles[item.key]}
                  onChange={() => toggle(item.key)}
                  label={item.label}
                  description={item.desc}
                />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-semantic-text-muted mt-2 px-1">
          {l(
            'Các lựa chọn này chỉ ghi nhớ mong muốn trên thiết bị. Hiện chúng chưa lọc hộp thông báo hoặc tự gửi nhắc nhở theo lịch.',
            'These switches only save your preferences on this device. They do not filter the inbox or schedule push deliveries yet.',
          )}
        </p>
      </section>

      {storageMessage && <p role="status">{storageMessage}</p>}

      <section aria-label={l('Kênh gửi thông báo', 'Delivery channels')} className="space-y-3">
        <h2 className="text-type-label text-semantic-text-primary">
          {l('Kênh gửi', 'Delivery channels')}
        </h2>
        <UnavailableState title={l('Email — chưa cấu hình', 'Email — not configured yet')}>
          {l(
            'Chưa có email nhắc nhở bữa ăn hay đi chợ. Email xác thực tài khoản là luồng riêng.',
            'Meal and grocery reminder emails are not available yet. Account verification emails are handled separately.',
          )}
        </UnavailableState>
        <UnavailableState title={l('Thông báo đẩy — chưa cấu hình', 'Push notifications — not configured yet')}>
          {l(
            'Takolio hiện chưa gửi thông báo đẩy. Quyền thông báo trên trình duyệt:',
            'Takolio does not send push notifications yet. Browser notification permission:',
          )}{' '}
          <strong>{permissionLabel}</strong>.{' '}
          {l(
            'Quyền này không có nghĩa là nhắc nhở đang được gửi.',
            'This permission does not mean reminders are being sent.',
          )}
        </UnavailableState>
      </section>
    </AccountPage>
  );
};
