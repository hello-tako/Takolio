import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import { isMealPlannerEnabled } from '../../features/planner/feature';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { useBrandDirection, vnextHref, type BrandDirection } from '../feature';
import { BrandLockup } from './VNextMedia';
import { VNextIcon, type VNextIconName } from './VNextIcons';
import { TkvButton, TkvIconButton, TkvSearchField } from './Primitives';

export interface ConsumerRootItem {
  id: 'home' | 'fridge' | 'recipes' | 'planner' | 'me';
  label: string;
  to: string;
  icon: VNextIconName;
  match: (pathname: string) => boolean;
}

export function getConsumerRoots(vnextQuery = '?vnext=1'): ConsumerRootItem[] {
  const plannerPath = isMealPlannerEnabled() ? '/planner' : '/week';
  return [
    {
      id: 'home',
      label: 'Hôm nay',
      to: `/${vnextQuery}`,
      icon: 'home',
      match: (p) => p === '/' || p === '/vnext/c01',
    },
    {
      id: 'fridge',
      label: 'Tủ lạnh',
      to: `/fridge${vnextQuery}`,
      icon: 'fridge',
      match: (p) =>
        p.startsWith('/fridge') ||
        p.startsWith('/inventory') ||
        p.startsWith('/ingredients') ||
        p === '/vnext/c03',
    },
    {
      id: 'recipes',
      label: 'Món ăn',
      to: `/recipes${vnextQuery}`,
      icon: 'recipes',
      match: (p) => p.startsWith('/recipes') || p.startsWith('/cook') || p.startsWith('/vnext/c18'),
    },
    {
      id: 'planner',
      label: 'Thực đơn',
      to: `${plannerPath}${vnextQuery}`,
      icon: 'calendar',
      match: (p) => p.startsWith('/planner') || p.startsWith('/week') || p === '/vnext/c23',
    },
    {
      id: 'me',
      label: 'Tôi',
      to: `/me${vnextQuery}`,
      icon: 'profile',
      match: (p) =>
        p.startsWith('/me') ||
        p.startsWith('/profile') ||
        p.startsWith('/settings') ||
        p.startsWith('/plus') ||
        p.startsWith('/notifications'),
    },
  ];
}

export const G02DirectionPreviewBar: React.FC<{
  direction: BrandDirection;
  onDirectionChange: (next: BrandDirection) => void;
  screenId: string;
}> = ({ direction, onDirectionChange, screenId }) => (
  <div
    role="region"
    aria-label="Thanh xem thử hướng thiết kế G02"
    className="bg-[var(--tkv-surface)] border-b border-[var(--tkv-border)] px-3 sm:px-6 py-1.5 text-xs flex items-center justify-between gap-2 flex-wrap"
  >
    <div className="flex items-center gap-2 min-w-0">
      <span className="px-2 py-0.5 rounded-md font-extrabold bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]">
        {screenId}
      </span>
      <span className="text-[var(--tkv-ink-secondary)] truncate">
        Bản thử vNext (G02 · Chờ chủ dự án duyệt khóa brand)
      </span>
    </div>
    <div className="flex items-center gap-1.5">
      {(['a', 'b', 'c'] as const).map((d) => (
        <button
          key={d}
          type="button"
          aria-pressed={direction === d}
          onClick={() => onDirectionChange(d)}
          className={clsx(
            'tkv-focusable min-h-[32px] px-2.5 py-1 rounded-lg font-bold transition-colors',
            direction === d
              ? 'bg-[var(--tkv-primary)] text-white'
              : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)]',
          )}
        >
          Style {d.toUpperCase()}
        </button>
      ))}
      <Link
        to="/vnext"
        className="tkv-focusable min-h-[32px] inline-flex items-center px-2.5 py-1 rounded-lg font-bold text-[var(--tkv-primary)] hover:underline"
      >
        Bảng duyệt G02
      </Link>
    </div>
  </div>
);

/**
 * Public Marketing Shell (M01–M12). Matches M01.png navigation anatomy cleanly
 * on mobile (390×844) and editorial desktop (1440×900).
 */
export const PublicMarketingShell: React.FC<{
  screenId: string;
  onStartFree?: () => void;
  isStartingFree?: boolean;
  children: React.ReactNode;
}> = ({ screenId, onStartFree, isStartingFree = false, children }) => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [direction] = useBrandDirection(search);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Tính năng', to: '/features/ai-scan', active: pathname.startsWith('/features/') },
    { label: 'Cách hoạt động', to: '/how-it-works', active: pathname === '/how-it-works' },
    { label: 'Món ăn', to: '/features/recipes', active: pathname === '/features/recipes' },
    { label: 'Plus', to: '/pricing', active: pathname === '/pricing' },
    { label: 'Blog', to: '/stories', active: pathname.startsWith('/stories') },
  ];

  return (
    <div className="tkv-root flex flex-col min-h-dvh" data-tkv-direction={direction} data-tkv-screen={screenId}>
      <a href="#tkv-public-main" className="tkv-skip-link">
        Đến nội dung chính
      </a>
      <header className="sticky top-0 z-30 bg-[var(--tkv-surface)]/95 backdrop-blur-md border-b border-[var(--tkv-border)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to={vnextHref('/landing')} className="tkv-focusable rounded-xl py-1" aria-label="Takolio — Trang chủ giới thiệu">
            <BrandLockup direction={direction} />
          </Link>

          <nav aria-label="Điều hướng giới thiệu sản phẩm" className="hidden md:flex items-center gap-6 text-sm font-semibold text-[var(--tkv-ink-secondary)]">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={item.active ? 'page' : undefined}
                className={clsx(
                  'tkv-focusable py-2 transition-colors hover:text-[var(--tkv-primary)]',
                  item.active && 'font-extrabold text-[var(--tkv-primary)]',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to={vnextHref('/auth?mode=login')}
              className="tkv-focusable hidden sm:inline-flex min-h-[44px] items-center px-3.5 rounded-[var(--tkv-radius-btn)] text-sm font-bold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)]"
            >
              Đăng nhập
            </Link>
            <TkvButton
              variant="coral"
              size="sm"
              isLoading={isStartingFree}
              onClick={() => (onStartFree ? onStartFree() : navigate(vnextHref('/auth?mode=register')))}
            >
              Đăng ký
            </TkvButton>
            <div className="md:hidden">
              <TkvIconButton
                icon={mobileMenuOpen ? 'close' : 'filter'}
                label={mobileMenuOpen ? 'Đóng menu giới thiệu' : 'Mở menu giới thiệu'}
                onClick={() => setMobileMenuOpen((v) => !v)}
              />
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label="Menu giới thiệu di động"
            className="md:hidden border-t border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-4 py-3 flex flex-col gap-1"
          >
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className="tkv-focusable min-h-[44px] flex items-center px-3 rounded-xl font-semibold text-sm text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="tkv-focusable min-h-[44px] flex items-center px-3 rounded-xl font-semibold text-sm text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)]"
            >
              Câu hỏi thường gặp
            </Link>
            <Link
              to={vnextHref('/auth?mode=login')}
              onClick={() => setMobileMenuOpen(false)}
              className="tkv-focusable min-h-[44px] flex items-center px-3 rounded-xl font-bold text-sm text-[var(--tkv-primary)] hover:bg-[var(--tkv-surface-mint)]"
            >
              Đăng nhập tài khoản
            </Link>
          </nav>
        )}
      </header>

      <main id="tkv-public-main" tabIndex={-1} className="flex-1">
        {children}
      </main>

      <footer className="border-t border-[var(--tkv-border)] bg-[var(--tkv-surface)] py-10 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-[var(--tkv-ink-secondary)]">
          <div className="space-y-2.5">
            <BrandLockup direction={direction} />
            <p className="text-xs leading-relaxed text-[var(--tkv-ink-muted)]">
              Trợ lý căn bếp thông minh cho gia đình hiện đại — quản lý tủ lạnh theo lô, gợi ý món khớp định lượng, lập thực đơn tuần và đi chợ gọn nhẹ.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink)]">Tính năng</p>
            <ul className="space-y-1 text-xs font-semibold">
              <li><Link to="/how-it-works" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Cách hoạt động (M02)</Link></li>
              <li><Link to="/features/ai-scan" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">AI Scan nguyên liệu (M03)</Link></li>
              <li><Link to="/features/fridge" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Tủ lạnh thông minh (M04)</Link></li>
              <li><Link to="/features/meal-planning" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Lên thực đơn tuần (M05)</Link></li>
              <li><Link to="/features/recipes" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Kho công thức (M06)</Link></li>
              <li><Link to="/features/cooking" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Nấu ăn từng bước (M07)</Link></li>
              <li><Link to="/features/shopping" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Danh sách đi chợ (M08)</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink)]">Sản phẩm & Cảm hứng</p>
            <ul className="space-y-1 text-xs font-semibold">
              <li><Link to="/pricing" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Các gói Takolio (M09)</Link></li>
              <li><Link to="/faq" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Câu hỏi thường gặp (M10)</Link></li>
              <li><Link to="/stories" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Takolio Stories (M11)</Link></li>
              <li><Link to={vnextHref('/auth?mode=login')} className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Đăng nhập ứng dụng</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink)]">Giới thiệu & Pháp lý</p>
            <ul className="space-y-1 text-xs font-semibold">
              <li><Link to="/about" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Giới thiệu Takolio</Link></li>
              <li><Link to="/contact" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Liên hệ hỗ trợ</Link></li>
              <li><Link to="/privacy" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Chính sách bảo mật</Link></li>
              <li><Link to="/terms" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Điều khoản sử dụng</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * Authenticated / Guest Consumer Kitchen Studio Shell (C01–C30, U01–U10).
 * - Mobile (<1024px): Contextual top bar + 1-column content + 5-Root Bottom Nav
 *   (Hôm nay / Tủ lạnh / Món ăn / Thực đơn / Tôi) + contextual Scan button.
 * - Desktop (>=1024px): Fixed 248px Kitchen Studio Sidebar + Quick Find (C02)
 *   + 1200px max-width workbench.
 */
export const ConsumerStudioShell: React.FC<{
  screenId: string;
  title?: string;
  backTo?: string;
  showContextualScan?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  screenId,
  title,
  backTo,
  showContextualScan = true,
  headerRight,
  children,
}) => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const [direction] = useBrandDirection(search);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const roots = getConsumerRoots(import.meta.env.PROD ? '' : '?vnext=1');

  const quickShortcuts = [
    { label: 'Tìm món ăn theo nguyên liệu sẵn có', to: vnextHref('/recipes'), icon: 'recipes' as const },
    { label: 'Kiểm tra tủ lạnh của tôi', to: vnextHref('/fridge'), icon: 'fridge' as const },
    { label: 'Quét nguyên liệu / hóa đơn (AI có duyệt trước)', to: vnextHref('/scan'), icon: 'scan' as const },
    { label: 'Xem thực đơn tuần', to: vnextHref(isMealPlannerEnabled() ? '/planner' : '/week'), icon: 'calendar' as const },
    { label: 'Mở danh sách đi chợ', to: vnextHref('/shopping'), icon: 'shopping' as const },
  ].filter((item) => item.label.toLowerCase().includes(quickQuery.trim().toLowerCase()));

  return (
    <div className="tkv-root min-h-dvh flex flex-col" data-tkv-direction={direction} data-tkv-screen={screenId}>
      <a href="#tkv-consumer-main" className="tkv-skip-link">
        Đến nội dung chính
      </a>

      <div className="flex-1 flex min-w-0">
        {/* Desktop Kitchen Studio Sidebar (>=1024px) */}
        <aside
          aria-label="Điều hướng căn bếp chính (Desktop)"
          className="hidden lg:flex w-[248px] shrink-0 flex-col justify-between border-r border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 sticky top-0 h-dvh"
        >
          <div className="space-y-5">
            <Link to="/?vnext=1" className="tkv-focusable block px-2 py-1 rounded-xl">
              <BrandLockup direction={direction} />
            </Link>

            <button
              type="button"
              onClick={() => setQuickFindOpen(true)}
              className="tkv-focusable w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] flex items-center justify-between text-sm text-[var(--tkv-ink-muted)] hover:border-[var(--tkv-primary)]"
            >
              <span className="inline-flex items-center gap-2 font-semibold">
                <VNextIcon name="search" size={16} />
                Tìm nhanh (C02)…
              </span>
              <kbd className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-white border border-[var(--tkv-border)]">
                ⌘K
              </kbd>
            </button>

            <nav aria-label="Năm phân khu chính">
              <ul className="space-y-1">
                {roots.map((item) => {
                  const active = item.match(pathname);
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        className={clsx(
                          'tkv-focusable min-h-[46px] px-3.5 py-2.5 rounded-[14px] flex items-center gap-3 text-sm font-bold transition-colors',
                          active
                            ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]'
                            : 'text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-bg)] hover:text-[var(--tkv-ink)]',
                        )}
                      >
                        <VNextIcon name={item.icon} size={20} strokeWidth={active ? 2.3 : 2} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="space-y-2 pt-4 border-t border-[var(--tkv-border)]">
            <TkvButton
              variant="coral"
              fullWidth
              iconLeft="scan"
              onClick={() => navigate(vnextHref('/scan'))}
            >
              Quét nguyên liệu
            </TkvButton>
            <Link
              to={vnextHref('/shopping')}
              className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-[14px] flex items-center gap-2.5 text-sm font-bold text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-bg)]"
            >
              <VNextIcon name="shopping" size={18} />
              <span>Danh sách đi chợ</span>
            </Link>
          </div>
        </aside>

        {/* Main Workbench Column */}
        <div className="flex-1 min-w-0 flex flex-col pb-[calc(76px+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <OfflineBanner />

          {/* Mobile / Tablet Contextual Header (<1024px) */}
          <header className="lg:hidden sticky top-0 z-20 bg-[var(--tkv-bg)]/95 backdrop-blur-md border-b border-[var(--tkv-border)] px-4 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {backTo ? (
                <TkvIconButton
                  icon="arrow-left"
                  label="Quay lại trang trước"
                  onClick={() => navigate(backTo)}
                />
              ) : (
                <Link to="/?vnext=1" className="tkv-focusable rounded-xl py-1" aria-label="Takolio — Hôm nay">
                  <BrandLockup direction={direction} compact />
                </Link>
              )}
              {title ? (
                <span className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] truncate">
                  {title}
                </span>
              ) : (
                <span className="tkv-heading text-base font-extrabold text-[var(--tkv-primary)]" translate="no">
                  takolio
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <TkvIconButton
                icon="search"
                label="Tìm nhanh trong bếp"
                onClick={() => setQuickFindOpen(true)}
              />
              {showContextualScan && (
                <TkvIconButton
                  icon="scan"
                  tone="primary"
                  label="Quét AI nguyên liệu"
                  onClick={() => navigate(vnextHref('/scan'))}
                />
              )}
              {headerRight}
            </div>
          </header>

          <main
            id="tkv-consumer-main"
            tabIndex={-1}
            className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 min-w-0"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile 5-Root Bottom Navigation (<1024px) — Scan stays contextual, NOT a 6th root */}
      <nav
        aria-label="Điều hướng chính trên điện thoại"
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-[var(--tkv-surface)]/98 backdrop-blur-md border-t border-[var(--tkv-border)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <ul className="grid grid-cols-5 px-1.5 py-1">
          {roots.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.id} className="min-w-0">
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'tkv-focusable min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-1.5 transition-colors',
                    active ? 'text-[var(--tkv-primary)]' : 'text-[var(--tkv-ink-muted)]',
                  )}
                >
                  <span
                    className={clsx(
                      'w-10 h-7 rounded-full flex items-center justify-center transition-colors',
                      active && 'bg-[var(--tkv-surface-mint)]',
                    )}
                  >
                    <VNextIcon name={item.icon} size={20} strokeWidth={active ? 2.3 : 1.9} />
                  </span>
                  <span className={clsx('text-[11px] leading-none truncate max-w-full', active ? 'font-extrabold' : 'font-semibold')}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* C02 Quick Find Dialog (Real navigation & search redirect, zero fabricated hits) */}
      {quickFindOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tkv-c02-title"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 pt-14"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuickFindOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 id="tkv-c02-title" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                Tìm nhanh trong căn bếp (C02)
              </h2>
              <TkvIconButton icon="close" label="Đóng hộp thoại tìm nhanh" onClick={() => setQuickFindOpen(false)} />
            </div>
            <TkvSearchField
              value={quickQuery}
              onChange={setQuickQuery}
              placeholder="Nhập tên món ăn hoặc nguyên liệu…"
              label="Từ khóa tìm nhanh"
            />
            {quickQuery.trim() && (
              <div className="flex flex-wrap gap-2">
                <TkvButton
                  size="sm"
                  iconLeft="recipes"
                  onClick={() => {
                    setQuickFindOpen(false);
                    navigate(`/recipes?q=${encodeURIComponent(quickQuery.trim())}&vnext=1`);
                  }}
                >
                  Tìm món “{quickQuery.trim()}”
                </TkvButton>
                <TkvButton
                  size="sm"
                  variant="secondary"
                  iconLeft="fridge"
                  onClick={() => {
                    setQuickFindOpen(false);
                    navigate(`/fridge?q=${encodeURIComponent(quickQuery.trim())}&vnext=1`);
                  }}
                >
                  Lọc trong tủ lạnh
                </TkvButton>
              </div>
            )}
            <ul className="space-y-2" aria-label="Lối tắt căn bếp">
              {quickShortcuts.map((sc) => (
                <li key={sc.to}>
                  <Link
                    to={sc.to}
                    onClick={() => setQuickFindOpen(false)}
                    className="tkv-focusable min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] text-sm font-bold text-[var(--tkv-ink)]"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <VNextIcon name={sc.icon} size={18} className="text-[var(--tkv-primary)]" />
                      <span>{sc.label}</span>
                    </span>
                    <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
