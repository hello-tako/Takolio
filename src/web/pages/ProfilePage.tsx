import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { AccountPage } from '../components/common/AccountPage';
import { LogoutDialog } from '../components/common/LogoutDialog';
import { BentoCard, AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import {
  AllergenShieldIcon,
  CrownPlusIcon,
  ShareFamilyLinkIcon,
  NavPlannerIcon,
  ExpiryRescueBellIcon,
  FreshnessShieldIcon,
  TakolioLogoMark,
} from '../design-system/icons';
import { ChevronRight, Globe, LogOut } from 'lucide-react';

interface ProfileLinkItem {
  label: string;
  meta: string;
  path: string;
  icon: React.ReactNode;
}

const GROUPS: Array<{ title: string; items: ProfileLinkItem[] }> = [
  {
    title: 'Bữa ăn & gia đình',
    items: [
      {
        label: 'Sở thích & hạn chế',
        path: '/me/preferences',
        meta: 'Khẩu vị, độ cay và nguyên liệu cần tránh (đồng bộ toàn hệ thống)',
        icon: <AllergenShieldIcon size={20} tone="flame" active />,
      },
      {
        label: 'Hộ gia đình & chia sẻ',
        path: '/me/household',
        meta: 'Quản lý thành viên bếp chung & tạo mã mời TAKO-XXXX',
        icon: <ShareFamilyLinkIcon size={20} tone="jade" active />,
      },
      {
        label: 'Cài đặt lập thực đơn',
        path: '/settings/planning',
        meta: 'Kiểu Mâm Cơm, vùng miền, dị ứng bắt buộc & nhịp đi chợ',
        icon: <NavPlannerIcon size={20} tone="jade" active />,
      },
    ],
  },
  {
    title: 'Ứng dụng & dữ liệu',
    items: [
      {
        label: 'Tùy chỉnh thông báo',
        path: '/settings/notifications',
        meta: 'Nhắc nhở hạn dùng FEFO & thực đơn trên thiết bị',
        icon: <ExpiryRescueBellIcon size={20} tone="turmeric" active />,
      },
      {
        label: 'Cài đặt ứng dụng',
        path: '/settings/app',
        meta: 'Cài lên màn hình chính (PWA) và bộ nhớ đệm ngoại tuyến',
        icon: <Globe size={20} className="text-tk-jade" aria-hidden="true" />,
      },
      {
        label: 'Quyền riêng tư & dữ liệu',
        path: '/settings/privacy',
        meta: 'Bảo mật dữ liệu hộ gia đình, AI Vision và quyền trình duyệt',
        icon: <FreshnessShieldIcon size={20} tone="jade" active />,
      },
    ],
  },
];

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const {
    displayName,
    email,
    isGuest,
    isPlus,
    avatarUrl,
    dietaryRestrictions = [],
    favoriteCuisines = [],
  } = useAuthStore();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const initialLetter = (displayName || 'K').charAt(0).toUpperCase();

  return (
    <AccountPage
      title="Hồ sơ"
      description="Chăm chút khẩu vị gia đình, chia sẻ bếp chung và quản lý tài khoản Takolio."
      backTo={null}
    >
      <BentoCard
        tone="ceramic"
        padding="md"
        className="flex flex-wrap items-center justify-between gap-4"
        aria-label="Tài khoản hiện tại"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={64}
              height={64}
              className="w-16 h-16 rounded-2xl object-cover border border-tk-stone shrink-0"
            />
          ) : (
            <span
              className="w-16 h-16 rounded-2xl bg-tk-flame-soft border border-tk-flame/20 text-tk-flame-deep font-heading font-extrabold text-xl flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              {initialLetter}
            </span>
          )}
          <div className="min-w-0 space-y-1">
            <AtelierBadge tone={isGuest ? 'neutral' : isPlus ? 'turmeric' : 'jade'}>
              {isGuest ? 'Phiên dùng thử' : isPlus ? 'Hội viên Takolio Plus' : 'Tài khoản gia đình'}
            </AtelierBadge>
            <h2 className="font-heading font-extrabold text-lg text-tk-ink truncate">
              {displayName || 'Khách'}
            </h2>
            <p className="text-xs text-tk-muted truncate">{email || 'Chưa liên kết email'}</p>
          </div>
        </div>

        <Link
          to={isGuest ? '/auth?mode=login&returnTo=%2Fplus' : '/plus'}
          className="shrink-0 min-h-11 px-4 py-2 rounded-2xl bg-tk-turmeric-soft border border-tk-turmeric/35 text-tk-ink font-heading font-extrabold text-xs shadow-xs hover:bg-tk-turmeric/20 active:scale-[0.98] transition-tap flex items-center gap-1.5"
        >
          <CrownPlusIcon size={16} tone="turmeric" active />
          <span>
            {isGuest ? 'Đăng nhập để nâng cấp' : isPlus ? 'Takolio Plus' : 'Nâng cấp Takolio Plus'}
          </span>
        </Link>
      </BentoCard>

      {/* Unified Allergen & Taste Two-Way Sync Banner */}
      <BentoCard tone="jade" padding="sm" className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-white border border-tk-jade/20 flex items-center justify-center shrink-0 mt-0.5">
            <AllergenShieldIcon size={18} tone="jade" active />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-tk-jade-deep uppercase tracking-wider">
              Hồ sơ Dị ứng &amp; Khẩu vị Đồng bộ Tự động
            </p>
            <p className="text-xs text-tk-secondary leading-relaxed mt-0.5">
              Mọi nguyên liệu kiêng kỵ ({dietaryRestrictions.length} mục) và ẩm thực yêu thích (
              {favoriteCuisines.length || 1} nhóm) được tự động áp dụng xuyên suốt Khám phá Công
              thức, Bếp 3D và Thực đơn Mâm Cơm.
            </p>
          </div>
        </div>
        <Link
          to="/me/preferences"
          className="shrink-0 text-xs font-extrabold text-tk-jade-deep hover:underline self-center"
        >
          Chỉnh ngay
        </Link>
      </BentoCard>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2.5" aria-label={group.title}>
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-tk-muted px-1">
            {group.title}
          </h2>
          <div className="rounded-[24px] border border-tk-stone bg-white shadow-card divide-y divide-tk-stone/70 overflow-hidden">
            {group.items.map(({ label, icon, path, meta }) => (
              <Link
                key={path}
                to={path}
                className="flex items-center justify-between gap-3.5 px-4 sm:px-5 py-4 hover:bg-tk-sunken/50 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className="w-10 h-10 rounded-2xl bg-tk-canvas border border-tk-stone flex items-center justify-center shrink-0"
                    aria-hidden="true"
                  >
                    {icon}
                  </span>
                  <span className="min-w-0">
                    <strong className="block font-heading font-bold text-sm text-tk-ink">
                      {label}
                    </strong>
                    <span className="block text-xs text-tk-muted mt-0.5 truncate">{meta}</span>
                  </span>
                </div>
                <ChevronRight size={18} className="text-tk-muted shrink-0" aria-hidden="true" />
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="pt-2 pb-6 space-y-3 text-center">
        <button
          type="button"
          onClick={() => setConfirmLogout(true)}
          className="w-full min-h-12 rounded-2xl border border-tk-berry/25 bg-tk-berry-soft/60 hover:bg-tk-berry-soft text-tk-berry-deep font-heading font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <LogOut size={18} aria-hidden="true" /> Đăng xuất khỏi tài khoản
        </button>
        <p className="text-xs text-tk-muted inline-flex items-center justify-center gap-1.5">
          <TakolioLogoMark size={16} tone="flame" />
          <span>Takolio V4 · Không gian Bếp Việt Thông Minh</span>
        </p>
      </div>

      <LogoutDialog
        open={confirmLogout}
        onCancel={() => setConfirmLogout(false)}
        onLoggedOut={() => navigate('/auth', { replace: true })}
      />
    </AccountPage>
  );
};
