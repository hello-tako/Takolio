import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import { isMealPlannerEnabled } from '../../features/planner/feature';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { useModalFocus } from '../../design-system/use-modal-focus';
import { vnextHref } from '../feature';
import {
  isSatelliteComRuntime,
  navigateToAppSurface,
  resolveAppSurfaceHref,
} from '../lib/domain-surface';
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

export function getConsumerRoots(): ConsumerRootItem[] {
  const plannerPath = isMealPlannerEnabled() ? '/planner' : '/week';
  return [
    {
      id: 'home',
      label: 'Hôm nay',
      to: '/',
      icon: 'home',
      match: (p) => p === '/',
    },
    {
      id: 'fridge',
      label: 'Tủ lạnh',
      to: '/fridge',
      icon: 'fridge',
      match: (p) =>
        p.startsWith('/fridge') ||
        p.startsWith('/inventory') ||
        p.startsWith('/ingredients'),
    },
    {
      id: 'recipes',
      label: 'Món ăn',
      to: '/recipes',
      icon: 'recipes',
      match: (p) => p.startsWith('/recipes') || p.startsWith('/cook'),
    },
    {
      id: 'planner',
      label: 'Thực đơn',
      to: plannerPath,
      icon: 'calendar',
      match: (p) => p.startsWith('/planner') || p.startsWith('/week'),
    },
    {
      id: 'me',
      label: 'Tôi',
      to: '/me',
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

const AppEntryAnchor: React.FC<{
  appPath: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ appPath, className, onClick, children }) => {
  if (isSatelliteComRuntime()) {
    return (
      <a href={resolveAppSurfaceHref(appPath)} onClick={onClick} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={vnextHref(appPath)} onClick={onClick} className={className}>
      {children}
    </Link>
  );
};

/**
 * Public Marketing Shell (M01–M12) — Takolio Sunlit Ceramic & Terracotta Herb (`takolio.com`).
 */
export const PublicMarketingShell: React.FC<{
  screenId: string;
  children: React.ReactNode;
}> = ({ screenId, children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const satellite = isSatelliteComRuntime();
  const homeHref = satellite ? '/' : vnextHref('/landing');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Tính năng', to: '/features/ai-scan', active: pathname.startsWith('/features/') },
    { label: 'Cách hoạt động', to: '/how-it-works', active: pathname === '/how-it-works' },
    { label: 'Món ăn', to: '/features/recipes', active: pathname === '/features/recipes' },
    { label: 'Bảng giá', to: '/pricing', active: pathname === '/pricing' },
    { label: 'Blog', to: '/stories', active: pathname.startsWith('/stories') },
  ];

  return (
    <div className="tkv-root flex flex-col min-h-dvh" data-tkv-direction="a" data-tkv-screen={screenId}>
      <a href="#tkv-public-main" className="tkv-skip-link">
        Đến nội dung chính
      </a>
      <header className="sticky top-0 z-30 bg-[var(--tkv-header-glass)] backdrop-blur-md border-b border-[var(--tkv-border)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link to={homeHref} className="tkv-focusable rounded-xl py-1" aria-label="Takolio — Trang chủ giới thiệu">
            <BrandLockup />
          </Link>

          <nav aria-label="Điều hướng giới thiệu sản phẩm" className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--tkv-ink-secondary)]">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={item.active ? 'page' : undefined}
                className={clsx(
                  'tkv-focusable py-2 transition-colors hover:text-[var(--tkv-primary)]',
                  item.active && 'font-bold text-[var(--tkv-primary)]',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <AppEntryAnchor
              appPath="/auth?mode=login"
              className="tkv-focusable hidden sm:inline-flex min-h-[44px] items-center px-3.5 rounded-[var(--tkv-radius-btn)] text-sm font-semibold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)] transition-colors"
            >
              Đăng nhập
            </AppEntryAnchor>
            <TkvButton
              variant="primary"
              size="sm"
              onClick={() => navigateToAppSurface(vnextHref('/auth?mode=register'), navigate)}
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
                aria-current={item.active ? 'page' : undefined}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  'tkv-focusable min-h-[44px] flex items-center px-3 rounded-xl text-sm transition-colors',
                  item.active
                    ? 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-primary-deep)] border border-[var(--tkv-border-coral)] font-bold'
                    : 'font-semibold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)]',
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="tkv-focusable min-h-[44px] flex items-center px-3 rounded-xl font-semibold text-sm text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)] transition-colors"
            >
              Câu hỏi thường gặp
            </Link>
            <div className="pt-2 mt-1 border-t border-[var(--tkv-border)] grid grid-cols-2 gap-2">
              <AppEntryAnchor
                appPath="/auth?mode=login"
                onClick={() => setMobileMenuOpen(false)}
                className="tkv-focusable min-h-[44px] flex items-center justify-center px-3 rounded-xl border border-[var(--tkv-border)] font-semibold text-sm text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)] transition-colors"
              >
                Đăng nhập
              </AppEntryAnchor>
              <AppEntryAnchor
                appPath="/auth?mode=register"
                onClick={() => setMobileMenuOpen(false)}
                className="tkv-focusable min-h-[44px] flex items-center justify-center px-3 rounded-xl bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-cta-hover)] font-semibold text-sm text-white transition-colors"
              >
                Đăng ký
              </AppEntryAnchor>
            </div>
          </nav>
        )}
      </header>

      <main id="tkv-public-main" tabIndex={-1} className="flex-1">
        {children}
      </main>

      <footer className="border-t border-[var(--tkv-border)] bg-[var(--tkv-surface)] py-10 px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-[var(--tkv-ink-secondary)]">
          <div className="space-y-2.5">
            <BrandLockup />
            <p className="text-xs leading-relaxed text-[var(--tkv-ink-muted)]">
              Trợ lý căn bếp thông minh cho gia đình hiện đại — quản lý tủ lạnh theo lô, gợi ý món khớp định lượng, lập thực đơn tuần và đi chợ gọn nhẹ.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--tkv-ink)]">Tính năng</p>
            <ul className="space-y-1 text-xs font-medium">
              <li><Link to="/how-it-works" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Cách hoạt động</Link></li>
              <li><Link to="/features/ai-scan" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">AI Scan nguyên liệu</Link></li>
              <li><Link to="/features/fridge" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Tủ lạnh thông minh</Link></li>
              <li><Link to="/features/meal-planning" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Lên thực đơn tuần</Link></li>
              <li><Link to="/features/recipes" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Kho công thức</Link></li>
              <li><Link to="/features/cooking" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Nấu ăn từng bước</Link></li>
              <li><Link to="/features/shopping" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Danh sách đi chợ</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--tkv-ink)]">Sản phẩm & Cảm hứng</p>
            <ul className="space-y-1 text-xs font-medium">
              <li><Link to="/pricing" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Các gói Takolio</Link></li>
              <li><Link to="/faq" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Câu hỏi thường gặp</Link></li>
              <li><Link to="/stories" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">Takolio Stories</Link></li>
              <li>
                <AppEntryAnchor appPath="/auth?mode=login" className="tkv-focusable inline-flex items-center min-h-[32px] py-1.5 hover:text-[var(--tkv-primary)]">
                  Mở ứng dụng (takolio.app)
                </AppEntryAnchor>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--tkv-ink)]">Giới thiệu & Pháp lý</p>
            <ul className="space-y-1 text-xs font-medium">
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
 * Sumi Edition Architectural Monochrome chrome with WCAG-compliant C02 Quick Find dialog.
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
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const quickDialogRef = useRef<HTMLDivElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const closeQuickFind = useCallback(() => setQuickFindOpen(false), []);
  const roots = getConsumerRoots();

  useModalFocus(quickFindOpen, quickDialogRef, closeQuickFind, quickInputRef);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setQuickFindOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setQuickFindOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!quickFindOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [quickFindOpen]);

  const quickShortcuts = [
    { label: 'Tìm món ăn theo nguyên liệu sẵn có', to: vnextHref('/recipes'), icon: 'recipes' as const },
    { label: 'Kiểm tra tủ lạnh của tôi', to: vnextHref('/fridge'), icon: 'fridge' as const },
    { label: 'Quét nguyên liệu / hóa đơn (AI có duyệt trước)', to: vnextHref('/scan'), icon: 'scan' as const },
    { label: 'Xem thực đơn tuần', to: vnextHref(isMealPlannerEnabled() ? '/planner' : '/week'), icon: 'calendar' as const },
    { label: 'Mở danh sách đi chợ', to: vnextHref('/shopping'), icon: 'shopping' as const },
  ].filter((item) => item.label.toLowerCase().includes(quickQuery.trim().toLowerCase()));

  return (
    <div className="tkv-root min-h-dvh flex flex-col" data-tkv-direction="a" data-tkv-screen={screenId}>
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
            <Link to="/" className="tkv-focusable block px-2 py-1 rounded-xl">
              <BrandLockup />
            </Link>

            <button
              type="button"
              onClick={() => setQuickFindOpen(true)}
              className="tkv-focusable w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] flex items-center justify-between text-sm text-[var(--tkv-ink-muted)] hover:border-[var(--tkv-border-strong)] hover:text-[var(--tkv-ink)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <VNextIcon name="search" size={16} />
                Tìm nhanh…
              </span>
              <kbd className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)]">
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
                          'tkv-focusable min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center gap-3 text-sm transition-colors',
                          active
                            ? 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-primary-deep)] border border-[var(--tkv-border-coral)] font-bold shadow-xs'
                            : 'text-[var(--tkv-ink-secondary)] font-semibold hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)]',
                        )}
                      >
                        <VNextIcon name={item.icon} size={20} strokeWidth={active ? 1.9 : 1.6} />
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
              variant="primary"
              fullWidth
              iconLeft="scan"
              onClick={() => navigate(vnextHref('/scan'))}
            >
              Quét nguyên liệu
            </TkvButton>
            <Link
              to={vnextHref('/shopping')}
              className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-xl flex items-center gap-2.5 text-sm font-semibold text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)] transition-colors"
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
          <header className="lg:hidden sticky top-0 z-20 bg-[var(--tkv-header-glass)] backdrop-blur-md border-b border-[var(--tkv-border)] px-4 h-14 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              {backTo ? (
                <TkvIconButton
                  icon="arrow-left"
                  label="Quay lại trang trước"
                  onClick={() => navigate(backTo)}
                />
              ) : (
                <Link to="/" className="tkv-focusable rounded-xl py-1" aria-label="Takolio — Hôm nay">
                  <BrandLockup compact />
                </Link>
              )}
              {title ? (
                <span className="tkv-heading text-base font-bold text-[var(--tkv-ink)] truncate">
                  {title}
                </span>
              ) : (
                <span className="tkv-heading text-base font-bold text-[var(--tkv-primary)]" translate="no">
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
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-[var(--tkv-nav-glass)] backdrop-blur-md border-t border-[var(--tkv-border)] pb-[env(safe-area-inset-bottom,0px)]"
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
                    active ? 'text-[var(--tkv-primary-deep)]' : 'text-[var(--tkv-ink-muted)]',
                  )}
                >
                  <span
                    className={clsx(
                      'w-10 h-7 rounded-full flex items-center justify-center transition-colors',
                      active && 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-primary-deep)] border border-[var(--tkv-border-coral)]',
                    )}
                  >
                    <VNextIcon name={item.icon} size={20} strokeWidth={active ? 1.9 : 1.6} />
                  </span>
                  <span className={clsx('text-[11px] leading-none truncate max-w-full', active ? 'font-bold' : 'font-medium')}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* C02 Quick Find Dialog — Escape dismissal, body scroll lock, auto-focus & Tab containment */}
      {quickFindOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 bg-[var(--tkv-scrim)] backdrop-blur-xs flex items-start justify-center p-4 pt-14 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuickFind();
          }}
        >
          <div
            ref={quickDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tkv-c02-title"
            className="w-full max-w-lg rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-elevated)] p-5 space-y-4 animate-slide-up"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="tkv-c02-title" className="tkv-heading text-lg font-bold text-[var(--tkv-ink)]">
                Tìm nhanh trong căn bếp
              </h2>
              <TkvIconButton icon="close" label="Đóng hộp thoại tìm nhanh" onClick={closeQuickFind} />
            </div>
            <TkvSearchField
              inputRef={quickInputRef}
              autoFocus
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
                    closeQuickFind();
                    navigate(`/recipes?q=${encodeURIComponent(quickQuery.trim())}`);
                  }}
                >
                  Tìm món “{quickQuery.trim()}”
                </TkvButton>
                <TkvButton
                  size="sm"
                  variant="secondary"
                  iconLeft="fridge"
                  onClick={() => {
                    closeQuickFind();
                    navigate(`/fridge?q=${encodeURIComponent(quickQuery.trim())}`);
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
                    onClick={closeQuickFind}
                    className="tkv-focusable min-h-[46px] px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-subtle)] border border-[var(--tkv-border)] text-sm font-semibold text-[var(--tkv-ink)] transition-colors"
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
