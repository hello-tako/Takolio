import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientContext } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import { isMealPlannerEnabled } from '../../features/planner/feature';
import { queryClient as defaultQueryClient } from '../../lib/query-client';
import { type AppChromeCopy } from '../../i18n/LocaleContext';
import { lSync, useLocaleText } from '../../i18n/app-i18n';
import { OfflineBanner } from '../../components/common/OfflineBanner';
import { useModalFocus } from '../../design-system/use-modal-focus';
import { vnextHref } from '../feature';
import { prefetchDestination, prefetchRouteChunk } from '../lib/prefetch';
import {
  isSatelliteComRuntime,
  navigateToAppSurface,
  resolveAppSurfaceHref,
} from '../lib/domain-surface';
import { BrandLockup } from './VNextMedia';
import { VNextIcon, type VNextIconName } from './VNextIcons';
import { TkvButton, TkvIconButton, TkvSearchField } from './Primitives';
import { TkvToastViewport, TkvTopProgressBar } from './LivingMotion';

export interface ConsumerRootItem {
  id: 'home' | 'fridge' | 'planner' | 'shopping' | 'me';
  label: string;
  to: string;
  icon: VNextIconName;
  match: (pathname: string) => boolean;
}

/**
 * Official 5-destination navigation per Brand Board §4 (`board.jpg` & `board-2.jpg`):
 * Trang chủ · Tủ lạnh · Thực đơn · Mua sắm · Cá nhân
 */
export function getConsumerRoots(navLabels?: AppChromeCopy['nav']): ConsumerRootItem[] {
  const plannerPath = isMealPlannerEnabled() ? '/planner' : '/week';
  return [
    {
      id: 'home',
      label: navLabels?.home ?? lSync('Trang chủ', 'Home'),
      to: '/',
      icon: 'home',
      match: (p) => p === '/' || p.startsWith('/recipes') || p.startsWith('/cook'),
    },
    {
      id: 'fridge',
      label: navLabels?.fridge ?? lSync('Tủ lạnh', 'Fridge'),
      to: '/fridge',
      icon: 'fridge',
      match: (p) =>
        p.startsWith('/fridge') ||
        p.startsWith('/inventory') ||
        p.startsWith('/ingredients') ||
        p.startsWith('/scan') ||
        p.startsWith('/receipt'),
    },
    {
      id: 'planner',
      label: navLabels?.planner ?? lSync('Thực đơn', 'Meal Plan'),
      to: plannerPath,
      icon: 'calendar',
      match: (p) => p.startsWith('/planner') || p.startsWith('/week'),
    },
    {
      id: 'shopping',
      label: navLabels?.shopping ?? lSync('Mua sắm', 'Shopping'),
      to: '/shopping',
      icon: 'shopping',
      match: (p) => p.startsWith('/shopping'),
    },
    {
      id: 'me',
      label: navLabels?.me ?? lSync('Cá nhân', 'Profile'),
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
 * Public Marketing Shell (M01–M12) — Official Takolio Brand Board (`takolio.com`).
 */
export const PublicMarketingShell: React.FC<{
  screenId: string;
  children: React.ReactNode;
}> = ({ screenId, children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { l } = useLocaleText();
  const satellite = isSatelliteComRuntime();
  const homeHref = satellite ? '/' : vnextHref('/landing');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const navItems = [
    { label: l('Tính năng', 'Features'), to: '/features/ai-scan', active: pathname.startsWith('/features/') && pathname !== '/features/recipes' },
    { label: l('Cách hoạt động', 'How it works'), to: '/how-it-works', active: pathname === '/how-it-works' },
    { label: l('Món ăn', 'Recipes'), to: '/features/recipes', active: pathname === '/features/recipes' },
    { label: l('Bảng giá', 'Pricing'), to: '/pricing', active: pathname === '/pricing' },
    { label: 'Stories', to: '/stories', active: pathname.startsWith('/stories') },
  ];

  return (
    <div className="tkv-root flex flex-col min-h-dvh" data-tkv-direction="a" data-tkv-screen={screenId}>
      <a href="#tkv-public-main" className="tkv-skip-link">
        {l('Đến nội dung chính', 'Skip to main content')}
      </a>
      <header className="sticky top-0 z-30 bg-[var(--tkv-header-glass)] backdrop-blur-md border-b border-[var(--tkv-border)] pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 min-h-16 py-2 flex items-center justify-between gap-2 sm:gap-3">
          <Link to={homeHref} className="tkv-focusable rounded-xl py-1 min-w-0 shrink-0" aria-label={l('Takolio — Trang chủ giới thiệu', 'Takolio — Home')}>
            <BrandLockup />
          </Link>

          <nav aria-label={l('Điều hướng giới thiệu sản phẩm', 'Product navigation')} className="hidden md:flex items-center gap-6 text-sm font-semibold text-[var(--tkv-ink-secondary)]">
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

          <div className="flex items-center gap-2 shrink-0">
            <AppEntryAnchor
              appPath="/auth?mode=login"
              className="tkv-focusable hidden sm:inline-flex min-h-[44px] items-center px-3.5 rounded-[var(--tkv-radius-btn)] text-sm font-bold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)] transition-colors"
            >
              {l('Đăng nhập', 'Sign in')}
            </AppEntryAnchor>
            <TkvButton
              variant="primary"
              size="sm"
              onClick={() => navigateToAppSurface(vnextHref('/auth?mode=register'), navigate)}
            >
              {l('Đăng ký', 'Sign up')}
            </TkvButton>
            <div className="md:hidden">
              <TkvIconButton
                icon={mobileMenuOpen ? 'close' : 'filter'}
                label={mobileMenuOpen ? l('Đóng menu giới thiệu', 'Close navigation menu') : l('Mở menu giới thiệu', 'Open navigation menu')}
                aria-expanded={mobileMenuOpen}
                onClick={() => setMobileMenuOpen((v) => !v)}
              />
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label={l('Menu giới thiệu di động', 'Mobile navigation menu')}
            className="md:hidden border-t border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-4 py-3 flex flex-col gap-1 max-h-[calc(100dvh-64px-env(safe-area-inset-top,0px))] overflow-y-auto overscroll-contain"
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
                    ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border border-[var(--tkv-border-mint)] font-bold'
                    : 'font-semibold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)]',
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/faq"
              onClick={() => setMobileMenuOpen(false)}
              className="tkv-focusable min-h-[44px] flex items-center px-3 rounded-xl font-semibold text-sm text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)] transition-colors"
            >
              {l('Câu hỏi thường gặp', 'FAQ')}
            </Link>
            <div className="pt-2 mt-1 border-t border-[var(--tkv-border)] grid grid-cols-2 gap-2">
              <AppEntryAnchor
                appPath="/auth?mode=login"
                onClick={() => setMobileMenuOpen(false)}
                className="tkv-focusable min-h-[44px] flex items-center justify-center px-3 rounded-xl border border-[var(--tkv-border)] font-bold text-sm text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)] transition-colors"
              >
                {l('Đăng nhập', 'Sign in')}
              </AppEntryAnchor>
              <AppEntryAnchor
                appPath="/auth?mode=register"
                onClick={() => setMobileMenuOpen(false)}
                className="tkv-focusable min-h-[44px] flex items-center justify-center px-3 rounded-xl bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-cta-hover)] font-bold text-sm text-white transition-colors"
              >
                {l('Đăng ký', 'Sign up')}
              </AppEntryAnchor>
            </div>
          </nav>
        )}
      </header>

      <main id="tkv-public-main" tabIndex={-1} className="flex-1">
        {children}
      </main>

      <footer className="tkv-leaf-wave-band border-t border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] pt-10 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] px-4 sm:px-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 text-sm text-[var(--tkv-ink-secondary)]">
          <div className="space-y-3">
            <BrandLockup showTagline />
            <p className="inline-flex items-center rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-primary)]">
              {l('Ăn đủ. Mua đủ. Dùng hết.', 'Eat well. Buy right. Waste nothing.')}
            </p>
            <p className="text-xs leading-relaxed text-[var(--tkv-ink-muted)]">
              {l(
                'Bữa ngon, nhẹ đầu. Quản lý tủ lạnh thông minh, quét nguyên liệu bằng AI, gợi ý món Việt sát kho sẵn có và lên thực đơn 7 ngày cho cả gia đình.',
                'Great meals, zero stress. Smart fridge tracking, AI ingredient scanning, fridge-matched recipes, and 7-day family meal planning.',
              )}
            </p>
          </div>

          <div className="space-y-2">
            <p className="tkv-heading text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink)]">
              {l('Tính năng cốt lõi', 'Core features')}
            </p>
            <ul className="space-y-0.5 text-xs font-medium">
              <li><Link to="/how-it-works" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Cách hoạt động', 'How it works')}</Link></li>
              <li><Link to="/features/fridge" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Quản lý tủ lạnh', 'Fridge inventory')}</Link></li>
              <li><Link to="/features/ai-scan" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Quét nguyên liệu bằng AI', 'AI ingredient scan')}</Link></li>
              <li><Link to="/features/recipes" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Gợi ý công thức món ăn', 'Recipe suggestions')}</Link></li>
              <li><Link to="/features/meal-planning" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Lên thực đơn 7 ngày', '7-day meal planner')}</Link></li>
              <li><Link to="/features/shopping" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Danh sách mua sắm', 'Shopping list')}</Link></li>
              <li><Link to="/features/cooking" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Nấu ăn từng bước', 'Step-by-step cooking')}</Link></li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="tkv-heading text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink)]">
              {l('Sản phẩm & Cảm hứng', 'Product & Inspiration')}
            </p>
            <ul className="space-y-0.5 text-xs font-medium">
              <li><Link to="/pricing" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Các gói Takolio', 'Takolio plans')}</Link></li>
              <li><Link to="/faq" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Câu hỏi thường gặp', 'FAQ')}</Link></li>
              <li><Link to="/stories" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">Takolio Stories</Link></li>
              <li>
                <AppEntryAnchor appPath="/auth?mode=login" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">
                  {l('Mở ứng dụng (takolio.app)', 'Open app (takolio.app)')}
                </AppEntryAnchor>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="tkv-heading text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink)]">
              {l('Giới thiệu & Pháp lý', 'Company & Legal')}
            </p>
            <ul className="space-y-0.5 text-xs font-medium">
              <li><Link to="/about" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Giới thiệu Takolio', 'About Takolio')}</Link></li>
              <li><Link to="/contact" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Liên hệ hỗ trợ', 'Contact support')}</Link></li>
              <li><Link to="/privacy" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Chính sách bảo mật', 'Privacy policy')}</Link></li>
              <li><Link to="/terms" className="tkv-focusable inline-flex items-center min-h-[44px] py-2 hover:text-[var(--tkv-primary)]">{l('Điều khoản sử dụng', 'Terms of service')}</Link></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
};

/**
 * Authenticated / Guest Consumer Kitchen Studio Shell (C01–C30, U01–U10).
 * Implements Official Brand Board 5-item bottom navigation:
 * Trang chủ · Tủ lạnh · Thực đơn · Mua sắm · Cá nhân
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
  const queryClient = useContext(QueryClientContext) ?? defaultQueryClient;

  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [quickQuery, setQuickQuery] = useState('');
  const quickDialogRef = useRef<HTMLDivElement>(null);
  const quickInputRef = useRef<HTMLInputElement>(null);
  const closeQuickFind = useCallback(() => setQuickFindOpen(false), []);
  const { l, copy: appCopy } = useLocaleText();
  const roots = getConsumerRoots(appCopy.nav);

  const warmDestination = useCallback(
    (targetPath: string) => {
      prefetchDestination(queryClient, targetPath);
    },
    [queryClient],
  );

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
    { label: l('Hôm nay ăn gì? (Trang chủ)', "What's for dinner? (Home)"), to: vnextHref('/'), icon: 'home' as const },
    { label: l('Khám phá kho công thức món ăn', 'Explore recipe library'), to: vnextHref('/recipes'), icon: 'recipes' as const },
    { label: l('Tủ lạnh của bạn', 'Your fridge'), to: vnextHref('/fridge'), icon: 'fridge' as const },
    { label: l('Quét nguyên liệu / hóa đơn bằng AI', 'Scan ingredients or receipts with AI'), to: vnextHref('/scan'), icon: 'scan' as const },
    { label: l('Thực đơn 7 ngày', '7-day meal plan'), to: vnextHref(isMealPlannerEnabled() ? '/planner' : '/week'), icon: 'calendar' as const },
    { label: l('Danh sách mua sắm', 'Shopping list'), to: vnextHref('/shopping'), icon: 'shopping' as const },
  ].filter((item) => item.label.toLowerCase().includes(quickQuery.trim().toLowerCase()));

  return (
    <div className="tkv-root min-h-dvh flex flex-col" data-tkv-direction="a" data-tkv-screen={screenId}>
      <TkvTopProgressBar />
      <a href="#tkv-consumer-main" className="tkv-skip-link">
        {l('Đến nội dung chính', 'Skip to main content')}
      </a>

      <div className="flex-1 flex min-w-0">
        {/* Desktop Kitchen Studio Sidebar (>=1024px) */}
        <aside
          aria-label={l('Điều hướng căn bếp chính (Desktop)', 'Main kitchen navigation (Desktop)')}
          className="hidden lg:flex w-[280px] shrink-0 flex-col justify-between border-r border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-4 py-5 sticky top-0 h-dvh"
        >
          <div className="space-y-5">
            <Link to="/" className="tkv-focusable block px-1.5 py-1 rounded-xl">
              <BrandLockup showTagline />
            </Link>

            <button
              type="button"
              onClick={() => setQuickFindOpen(true)}
              className="tkv-focusable w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] flex items-center justify-between gap-2 text-sm text-[var(--tkv-ink-muted)] hover:border-[var(--tkv-border-mint)] hover:text-[var(--tkv-ink)] transition-colors"
            >
              <span className="inline-flex items-center gap-2 font-medium whitespace-nowrap">
                <VNextIcon name="search" size={16} />
                {l('Tìm nhanh…', 'Quick find…')}
              </span>
              <kbd className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] shrink-0">
                ⌘K
              </kbd>
            </button>

            <nav aria-label={l('Năm phân khu chính', 'Primary sections')}>
              <ul className="space-y-1">
                {roots.map((item) => {
                  const active = item.match(pathname);
                  return (
                    <li key={item.id}>
                      <Link
                        to={item.to}
                        onPointerEnter={() => warmDestination(item.to)}
                        onFocus={() => warmDestination(item.to)}
                        aria-current={active ? 'page' : undefined}
                        className={clsx(
                          'tkv-focusable tkv-tactile min-h-[46px] px-3.5 py-2.5 rounded-2xl flex items-center gap-3 text-sm active:scale-[0.98]',
                          active
                            ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border border-[var(--tkv-border-mint)] font-extrabold shadow-xs'
                            : 'text-[var(--tkv-ink-secondary)] font-semibold hover:bg-[var(--tkv-bg)] hover:text-[var(--tkv-ink)] border border-transparent',
                        )}
                      >
                        <span className={clsx('inline-flex', active && 'tkv-pop')}>
                          <VNextIcon name={item.icon} size={20} strokeWidth={active ? 2.1 : 1.7} />
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="flex flex-col gap-2 pt-4 border-t border-[var(--tkv-border)]">
            <TkvButton
              variant="primary"
              fullWidth
              iconLeft="scan"
              onPointerEnter={() => prefetchRouteChunk('/scan')}
              onFocus={() => prefetchRouteChunk('/scan')}
              onClick={() => navigate(vnextHref('/scan'))}
            >
              {l('Quét nguyên liệu', 'Scan ingredients')}
            </TkvButton>
            <Link
              to={vnextHref('/recipes')}
              onPointerEnter={() => warmDestination('/recipes')}
              onFocus={() => warmDestination('/recipes')}
              className="tkv-focusable tkv-tactile min-h-[44px] px-3.5 py-2 rounded-2xl flex items-center gap-2.5 text-sm font-semibold text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-coral)] hover:text-[var(--tkv-coral-ink)]"
            >
              <VNextIcon name="recipes" size={18} />
              <span>{l('Kho công thức món Việt', 'Recipe library')}</span>
            </Link>
          </div>
        </aside>

        {/* Main Workbench Column */}
        <div className="flex-1 min-w-0 flex flex-col pb-[calc(96px+env(safe-area-inset-bottom,0px))] lg:pb-8">
          <div className="sticky top-0 z-20">
            <OfflineBanner />

            {/* Mobile / Tablet Contextual Header (<1024px) */}
            <header className="lg:hidden bg-[var(--tkv-header-glass)] backdrop-blur-md border-b border-[var(--tkv-border)] pt-[env(safe-area-inset-top,0px)]">
              <div className="px-3 sm:px-4 min-h-14 py-1.5 flex items-center justify-between gap-1.5 sm:gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {backTo ? (
                    <TkvIconButton
                      icon="arrow-left"
                      label={l('Quay lại trang trước', 'Go back')}
                      onClick={() => navigate(backTo)}
                    />
                  ) : (
                    <Link to="/" className="tkv-focusable rounded-xl py-1 shrink-0" aria-label={l('Takolio — Trang chủ', 'Takolio — Home')}>
                      <BrandLockup compact />
                    </Link>
                  )}
                  {title ? (
                    <span className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] truncate min-w-0">
                      {title}
                    </span>
                  ) : (
                    <span className="tkv-heading text-lg font-black text-[var(--tkv-ink)] truncate" translate="no">
                      Takolio
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <TkvIconButton
                    icon="search"
                    label={l('Tìm nhanh trong bếp', 'Quick find in kitchen')}
                    onClick={() => setQuickFindOpen(true)}
                  />
                  {showContextualScan && (
                    <TkvIconButton
                      icon="scan"
                      tone="primary"
                      label={l('Quét AI nguyên liệu', 'AI ingredient scan')}
                      onClick={() => navigate(vnextHref('/scan'))}
                    />
                  )}
                  {headerRight}
                </div>
              </div>
            </header>
          </div>

          <main
            id="tkv-consumer-main"
            key={pathname}
            tabIndex={-1}
            className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7 min-w-0 tkv-page-enter"
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile 5-Root Bottom Navigation (<1024px): Trang chủ · Tủ lạnh · Thực đơn · Mua sắm · Cá nhân */}
      <nav
        aria-label={l('Điều hướng chính trên điện thoại', 'Mobile primary navigation')}
        className="lg:hidden fixed inset-x-0 bottom-0 z-30 overflow-x-clip bg-[var(--tkv-nav-glass)] backdrop-blur-md border-t border-[var(--tkv-border)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <ul className="grid grid-cols-5 px-1 pt-1.5 pb-2">
          {roots.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.id} className="min-w-0">
                <Link
                  to={item.to}
                  onTouchStart={() => warmDestination(item.to)}
                  onPointerEnter={() => warmDestination(item.to)}
                  onFocus={() => warmDestination(item.to)}
                  aria-current={active ? 'page' : undefined}
                  className={clsx(
                    'tkv-focusable tkv-tactile min-h-[56px] flex flex-col items-center justify-center gap-1 rounded-2xl px-0.5 py-1 active:scale-95',
                    active ? 'text-[var(--tkv-primary)]' : 'text-[var(--tkv-ink-muted)]',
                  )}
                >
                  <span
                    className={clsx(
                      'w-10 h-7 rounded-full flex items-center justify-center transition-colors duration-200 shrink-0',
                      active && 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border border-[var(--tkv-border-mint)] tkv-pop shadow-xs',
                    )}
                  >
                    <VNextIcon name={item.icon} size={20} strokeWidth={active ? 2.1 : 1.65} />
                  </span>
                  <span className={clsx('max-w-full truncate text-[10.5px] sm:text-[11px] leading-snug pb-0.5', active ? 'font-extrabold' : 'font-semibold')}>
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <TkvToastViewport />

      {/* C02 Quick Find Dialog */}
      {quickFindOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 bg-[var(--tkv-scrim)] backdrop-blur-xs flex items-start justify-center p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] sm:pt-14 pb-[max(1rem,env(safe-area-inset-bottom,0px))] overflow-y-auto animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeQuickFind();
          }}
        >
          <div
            ref={quickDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tkv-c02-title"
            className="w-full max-w-lg max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-contain rounded-3xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-elevated)] p-4 sm:p-5 space-y-4 animate-slide-up"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 id="tkv-c02-title" className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">
                {l('Tìm nhanh trong căn bếp', 'Quick find in your kitchen')}
              </h2>
              <TkvIconButton icon="close" label={l('Đóng hộp thoại tìm nhanh', 'Close quick find dialog')} onClick={closeQuickFind} />
            </div>
            <TkvSearchField
              inputRef={quickInputRef}
              autoFocus
              value={quickQuery}
              onChange={setQuickQuery}
              placeholder={l('Nhập tên món ăn hoặc nguyên liệu…', 'Search recipes or ingredients…')}
              label={l('Từ khóa tìm nhanh', 'Quick find query')}
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
                  {l(`Tìm món “${quickQuery.trim()}”`, `Search recipes for “${quickQuery.trim()}”`)}
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
                  {l('Lọc trong tủ lạnh', 'Filter in fridge')}
                </TkvButton>
              </div>
            )}
            <ul className="space-y-2" aria-label={l('Lối tắt căn bếp', 'Kitchen shortcuts')}>
              {quickShortcuts.map((sc) => (
                <li key={sc.to}>
                  <Link
                    to={sc.to}
                    onClick={closeQuickFind}
                    className="tkv-focusable min-h-[46px] px-3.5 py-2.5 rounded-2xl flex items-center justify-between gap-3 bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)] text-sm font-semibold text-[var(--tkv-ink)] transition-colors"
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
