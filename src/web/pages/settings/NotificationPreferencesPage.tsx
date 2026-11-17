import { AccountPage } from '../../components/common/AccountPage';
import React, { useState } from 'react';
import { getCurrentScope } from '../../services/http';
import { Switch } from '../../design-system/primitives';
import { BentoCard, AtelierBadge } from '../../design-system/v4/AtelierPrimitives';
import {
  NavPlannerIcon,
  ExpiryRescueBellIcon,
  NavShoppingIcon,
  HouseholdTrayIcon,
  CrownPlusIcon,
} from '../../design-system/icons';

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

const PERMISSION_LABELS: Record<string, string> = {
  granted: 'đã cho phép',
  denied: 'đã chặn',
  default: 'chưa được yêu cầu',
  unsupported: 'trình duyệt không hỗ trợ',
};

export const NotificationPreferencesPage: React.FC = () => {
  const [toggles, setToggles] = useState<ToggleState>(readToggles);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  const toggle = (key: keyof ToggleState) => {
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    try {
      const storageKey = prefsKey();
      if (!storageKey) throw new Error('No preference owner');
      localStorage.setItem(storageKey, JSON.stringify(next));
      setStorageMessage('Đã ghi nhớ lựa chọn trên thiết bị này.');
    } catch {
      setStorageMessage('Chưa lưu được trên thiết bị. Lựa chọn chỉ giữ khi trang này đang mở.');
    }
  };

  const browserPermission =
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

  const items: Array<{
    key: keyof ToggleState;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }> = [
    {
      key: 'remindWeekPlan',
      label: 'Nhắc lập thực đơn tuần',
      desc: 'Chuẩn bị bữa ăn Mâm Cơm cho tuần kế tiếp',
      icon: <NavPlannerIcon size={18} tone="jade" active />,
    },
    {
      key: 'remindExpiring',
      label: 'Nhắc nguyên liệu sắp hết hạn',
      desc: 'Ưu tiên thực phẩm FEFO cần nấu sớm',
      icon: <ExpiryRescueBellIcon size={18} tone="turmeric" active />,
    },
    {
      key: 'remindShopping',
      label: 'Nhắc đi chợ',
      desc: 'Theo dõi nguyên liệu cần mua theo thực đơn',
      icon: <NavShoppingIcon size={18} tone="flame" active />,
    },
    {
      key: 'remindTodayMeal',
      label: 'Nhắc bữa ăn hôm nay',
      desc: 'Theo dõi lịch nấu trong ngày của gia đình',
      icon: <HouseholdTrayIcon size={18} tone="jade" active />,
    },
    {
      key: 'promoUpdates',
      label: 'Cập nhật & ưu đãi Takolio Plus',
      desc: 'Tính năng bếp 3D mới và ưu đãi hội viên',
      icon: <CrownPlusIcon size={18} tone="turmeric" active />,
    },
  ];

  return (
    <AccountPage
      title="Tùy chỉnh thông báo"
      description="Tùy chọn nhắc nhở trên thiết bị của bạn."
    >
      <section aria-label="Lựa chọn nhắc nhở" className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-tk-muted px-1">
          Lựa chọn nhắc nhở
        </h2>
        <div className="rounded-[24px] border border-tk-stone bg-white shadow-card divide-y divide-tk-stone/70 overflow-hidden">
          {items.map((item) => (
            <div key={item.key} className="account-switch-row px-4 py-3.5 flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-2xl bg-tk-canvas border border-tk-stone flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <Switch
                  checked={toggles[item.key]}
                  onChange={() => toggle(item.key)}
                  label={item.label}
                  description={item.desc}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-tk-muted px-1 leading-relaxed">
          Các lựa chọn này chỉ ghi nhớ mong muốn trên thiết bị. Hiện chúng chưa lọc hộp thông báo
          hoặc tự gửi nhắc nhở theo lịch.
        </p>
      </section>

      {storageMessage && (
        <p
          role="status"
          className="rounded-2xl border border-tk-stone bg-tk-sunken/70 px-4 py-2.5 text-xs font-semibold text-tk-ink"
        >
          {storageMessage}
        </p>
      )}

      <section aria-label="Kênh gửi thông báo" className="space-y-3 pt-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-tk-muted px-1">
          Kênh thông báo hiện tại
        </h2>
        <BentoCard tone="sunken" padding="sm" className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading font-bold text-sm text-tk-ink">Hộp thư trong ứng dụng</h3>
            <AtelierBadge tone="jade">Đang hoạt động</AtelierBadge>
          </div>
          <p className="text-xs text-tk-secondary leading-relaxed">
            Cảnh báo hạn dùng thực phẩm và cập nhật bếp chung hiển thị trực tiếp tại mục Thông báo.
            Chưa gửi email nhắc bữa ăn hay đi chợ. Email xác thực tài khoản là luồng riêng.
          </p>
        </BentoCard>

        <BentoCard tone="sunken" padding="sm" className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-heading font-bold text-sm text-tk-ink">
              Quyền thông báo trình duyệt
            </h3>
            <AtelierBadge tone="neutral">
              {PERMISSION_LABELS[browserPermission] ?? 'không xác định'}
            </AtelierBadge>
          </div>
          <p className="text-xs text-tk-secondary leading-relaxed">
            Takolio hiện chưa gửi thông báo đẩy nền. Quyền thông báo trên trình duyệt:{' '}
            <strong>{PERMISSION_LABELS[browserPermission] ?? 'không xác định'}</strong>.
          </p>
        </BentoCard>
      </section>
    </AccountPage>
  );
};
