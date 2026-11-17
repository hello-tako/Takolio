import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { DeferredNavIndicator } from './deferred-nav-indicator';
import { isMealPlannerEnabled } from '../features/planner/feature';
import { TakosanIcon, type TakosanIconName } from '../components/common/TakosanIcon';
import { TAKOSAN_BRAND } from '../lib/takosan-brand';
import {
  NavFridgeIcon,
  NavHomeIcon,
  NavPlannerIcon,
  NavProfileIcon,
  NavRecipesIcon,
  NavScanApertureIcon,
  NavShoppingIcon,
  TakolioLogoMark,
  TakolioWordmarkLockup,
  WokFlameIcon,
  type TakolioIconProps,
} from './icons';
import { useCookingStore } from '../stores/useCookingStore';

/**
 * Takolio V4 — Unified Spatial App Shell & 6-Pillar Terra-Botanical Navigation
 *
 * - Mobile bottom dock (`BottomNavigationBar` kitchen): 5 core pillars in a frosted glass dock
 *   while `KitchenHeader` surfaces quick 1-tap `/shopping` (`Đi chợ`), live Notification Bell, and `Quét AI`.
 * - Desktop (`>=1024px`) & Tablet Rail (`RailSidebar` kitchen): 256px sculpted Atelier Rail with
 *   `TakolioWordmarkLockup`, prominent terracotta `Quét nguyên liệu AI` CTA, all 6 duotone pillars
 *   (including `/shopping` `Đi chợ`), and live Active Cooking session resume card.
 */

export interface NavItem {
  label: string;
  path: string;
  icon: TakosanIconName;
  match: (pathname: string) => boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Hôm nay', path: '/', icon: 'home', match: (p) => p === '/' },
  {
    label: 'Tủ lạnh',
    path: '/fridge',
    icon: 'fridge',
    match: (p) => p.startsWith('/fridge') || p.startsWith('/inventory') || p.startsWith('/ingredients'),
  },
  {
    label: 'Công thức',
    path: '/recipes',
    icon: 'recipe',
    match: (p) => p.startsWith('/recipes') || p.startsWith('/cook'),
  },
  {
    label: 'Thực đơn',
    path: isMealPlannerEnabled() ? '/planner' : '/week',
    icon: 'mealPlan',
    match: (p) => p.startsWith('/planner') || p.startsWith('/week'),
  },
  {
    label: 'Tài khoản',
    path: '/me',
    icon: 'profile',
    match: (p) =>
      p.startsWith('/me') ||
      p.startsWith('/profile') ||
      p.startsWith('/settings') ||
      p.startsWith('/notifications') ||
      p.startsWith('/plus'),
  },
];

interface AtelierPillarItem {
  id: 'home' | 'fridge' | 'recipe' | 'mealPlan' | 'shopping' | 'profile';
  label: string;
  path: string;
  IconComponent: React.FC<TakolioIconProps>;
  isActive: (pathname: string) => boolean;
}

const SCAN_PATH = '/scan';
const inFamily = (path: string, root: string) =>
  path.toLowerCase() === root || path.toLowerCase().startsWith(`${root}/`);

export function isKitchenNavActive(item: NavItem, pathname: string) {
  if (item.path === '/') return pathname === '/';
  const families: Record<string, string[]> = {
    fridge: ['/fridge', '/inventory', '/ingredients', '/inventory-reconciliation'],
    recipe: ['/recipes', '/cook', '/cooking'],
    mealPlan: ['/planner', '/week'],
    profile: ['/me', '/profile', '/settings', '/notifications', '/plus'],
  };
  return (families[item.icon] ?? []).some((root) => inFamily(pathname, root));
}

const V4_NAV_ICON_MAP: Partial<Record<TakosanIconName, React.FC<TakolioIconProps>>> = {
  home: NavHomeIcon,
  fridge: NavFridgeIcon,
  recipe: NavRecipesIcon,
  mealPlan: NavPlannerIcon,
  shopping: NavShoppingIcon,
  profile: NavProfileIcon,
  scan: NavScanApertureIcon,
};

function getAtelierPillars(): AtelierPillarItem[] {
  const plannerPath = isMealPlannerEnabled() ? '/planner' : '/week';
  return [
    {
      id: 'home',
      label: 'Hôm nay',
      path: '/',
      IconComponent: NavHomeIcon,
      isActive: (p) => p === '/',
    },
    {
      id: 'fridge',
      label: 'Tủ lạnh',
      path: '/fridge',
      IconComponent: NavFridgeIcon,
      isActive: (p) =>
        ['/fridge', '/inventory', '/ingredients', '/inventory-reconciliation'].some((r) =>
          inFamily(p, r),
        ),
    },
    {
      id: 'recipe',
      label: 'Công thức',
      path: '/recipes',
      IconComponent: NavRecipesIcon,
      isActive: (p) => ['/recipes', '/cook', '/cooking'].some((r) => inFamily(p, r)),
    },
    {
      id: 'mealPlan',
      label: 'Thực đơn',
      path: plannerPath,
      IconComponent: NavPlannerIcon,
      isActive: (p) => ['/planner', '/week'].some((r) => inFamily(p, r)),
    },
    {
      id: 'shopping',
      label: 'Đi chợ',
      path: '/shopping',
      IconComponent: NavShoppingIcon,
      isActive: (p) => inFamily(p, '/shopping'),
    },
    {
      id: 'profile',
      label: 'Tài khoản',
      path: '/me',
      IconComponent: NavProfileIcon,
      isActive: (p) =>
        ['/me', '/profile', '/settings', '/notifications', '/plus'].some((r) => inFamily(p, r)),
    },
  ];
}

const useActive = (item: NavItem) => item.match(useLocation().pathname);

const NavLinkContent: React.FC<{
  item: NavItem;
  active: boolean;
  withLabel: boolean;
  indicatorId: string;
}> = ({ item, active, withLabel, indicatorId }) => (
  <>
    <span
      className={clsx(
        'relative flex w-11 h-11 max-w-full items-center justify-center rounded-card transition-colors',
        active ? 'bg-semantic-success-soft text-semantic-action-primary' : 'text-semantic-text-muted',
      )}
    >
      {active && <DeferredNavIndicator indicatorId={indicatorId} />}
      <TakosanIcon
        name={item.icon}
        variant="v2"
        className={clsx('relative w-6 h-6', active && 'text-semantic-action-primary')}
        strokeWidth={active ? 2.2 : 1.8}
      />
    </span>
    {withLabel && (
      <span
        className={clsx(
          'text-[11px] leading-none',
          active ? 'font-bold text-semantic-action-primary' : 'font-medium text-semantic-text-muted',
        )}
      >
        {item.label}
      </span>
    )}
  </>
);

/** Legacy Mobile bottom bar (preserved for non-migrated /checkout & /settings surfaces). */
const LegacyBottomNavigationBar: React.FC = () => {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-semantic-border bg-semantic-surface/95 backdrop-blur-xl safe-bottom sm:hidden"
    >
      <ul className="flex items-stretch justify-around h-[68px] px-1.5">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <NavItemButton key={item.path} item={item} />
        ))}
        <li className="flex-1 min-w-0 flex items-start justify-center">
          <Link
            to={SCAN_PATH}
            aria-label="Quét AI"
            className="relative -top-4 flex flex-col items-center rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
          >
            <span className="w-[58px] h-[58px] rounded-[20px] bg-semantic-action-primary shadow-t17-md ring-2 ring-white flex items-center justify-center text-white">
              <TakosanIcon name="scan" variant="v2" onDark className="w-7 h-7" />
            </span>
            <span className="text-[11px] font-bold text-semantic-text-primary mt-1 tracking-tight">
              Quét
            </span>
          </Link>
        </li>
        {NAV_ITEMS.slice(2).map((item) => (
          <NavItemButton key={item.path} item={item} />
        ))}
      </ul>
    </nav>
  );
};

const NavItemButton: React.FC<{ item: NavItem }> = ({ item }) => {
  const active = useActive(item);
  return (
    <li className="flex-1 min-w-0">
      <Link
        to={item.path}
        aria-current={active ? 'page' : undefined}
        className="flex flex-col items-center justify-center gap-1 h-[68px] w-full py-1.5 rounded-card focus-visible:outline-none focus-visible:shadow-t17-focus"
      >
        <NavLinkContent item={item} active={active} withLabel indicatorId="t17-nav-indicator-bottom" />
      </Link>
    </li>
  );
};

/** Legacy Tablet rail & desktop sidebar (preserved for non-kitchen routes). */
const LegacyRailSidebar: React.FC<{
  brandLogo?: string;
  brandSymbol?: string;
  brandDimensions?: { width: number; height: number };
}> = ({
  brandLogo = TAKOSAN_BRAND.wordmark,
  brandSymbol = TAKOSAN_BRAND.symbolMicro,
  brandDimensions = { width: 466, height: 262 },
}) => {
  const { pathname } = useLocation();
  return (
    <>
      <nav
        aria-label="Điều hướng chính"
        className="hidden sm:flex lg:hidden fixed left-0 top-0 bottom-0 w-20 flex-col items-center gap-2 py-4 bg-semantic-surface border-r border-semantic-border z-30"
      >
        <Link
          to="/"
          className="mb-2 tap-target flex items-center justify-center rounded-card focus-visible:outline-none focus-visible:shadow-t17-focus"
          aria-label="Takolio — Trang chủ"
          translate="no"
        >
          <img src={brandSymbol} alt="" width={32} height={32} className="w-8 h-8" />
        </Link>
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="flex w-full flex-col items-center gap-1 px-1 py-1.5 rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
            >
              <NavLinkContent
                item={item}
                active={active}
                withLabel={false}
                indicatorId="t17-nav-indicator-rail"
              />
              <span
                className={clsx(
                  'max-w-full truncate text-center text-[10px] leading-none',
                  active ? 'font-bold text-semantic-action-primary' : 'text-semantic-text-muted',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
        <Link
          to={SCAN_PATH}
          aria-label="Quét AI"
          className="mt-auto flex flex-col items-center gap-1 px-3 py-1.5 rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
        >
          <span className="flex w-11 h-11 items-center justify-center rounded-card bg-semantic-action-primary text-white">
            <TakosanIcon name="scan" variant="v2" onDark className="w-6 h-6" />
          </span>
          <span className="text-[10px] font-medium text-semantic-text-muted">Quét</span>
        </Link>
      </nav>

      <nav
        aria-label="Điều hướng chính"
        className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col px-4 py-5 bg-semantic-surface border-r border-semantic-border z-30"
      >
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2.5 mb-6 px-2 rounded-card focus-visible:outline-none focus-visible:shadow-t17-focus"
          aria-label="Takolio — Trang chủ"
          translate="no"
        >
          <img
            src={brandLogo}
            alt=""
            width={brandDimensions.width}
            height={brandDimensions.height}
            className="w-[168px] h-auto"
          />
        </Link>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-feature tap-target focus-visible:outline-none focus-visible:shadow-t17-focus"
                >
                  <TakosanIcon
                    name={item.icon}
                    variant="v2"
                    className={clsx(
                      'w-6 h-6',
                      active ? 'text-semantic-action-primary' : 'text-semantic-text-muted',
                    )}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span
                    className={clsx(
                      'text-sm',
                      active
                        ? 'font-bold text-semantic-action-primary'
                        : 'font-medium text-semantic-text-secondary',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          to={SCAN_PATH}
          className="mt-auto flex items-center justify-center gap-2 h-12 rounded-card bg-semantic-action-primary text-white text-sm font-bold shadow-t17-md focus-visible:outline-none focus-visible:shadow-t17-focus"
        >
          <TakosanIcon name="scan" variant="v2" onDark className="w-5 h-5" />
          Quét nguyên liệu
        </Link>
      </nav>
    </>
  );
};

function KitchenMobileDockItems() {
  const { pathname } = useLocation();
  return (
    <ul className="kitchen-nav-items">
      {NAV_ITEMS.map((item) => {
        const active = isKitchenNavActive(item, pathname);
        const V4Icon = V4_NAV_ICON_MAP[item.icon] ?? NavHomeIcon;
        return (
          <li key={item.path}>
            <Link
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'rounded-2xl transition-colors',
                active ? 'bg-tk-jade-soft text-tk-jade-deep font-extrabold' : 'text-tk-secondary',
              )}
            >
              <V4Icon
                size={22}
                tone={active ? 'jade' : 'ink'}
                active={active}
                className="kitchen-nav-icon"
              />
              <span className="kitchen-nav-label">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function KitchenDesktopSixPillarItems() {
  const { pathname } = useLocation();
  const pillars = getAtelierPillars();
  return (
    <ul className="kitchen-nav-items space-y-1">
      {pillars.map((pillar) => {
        const active = pillar.isActive(pathname);
        const IconComp = pillar.IconComponent;
        return (
          <li key={pillar.id}>
            <Link
              to={pillar.path}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'group rounded-2xl border transition-colors',
                active
                  ? 'border-tk-jade/20 bg-tk-jade-soft text-tk-jade-deep shadow-xs'
                  : 'border-transparent text-tk-secondary hover:bg-tk-sunken/80 hover:text-tk-ink',
              )}
            >
              <IconComp
                size={22}
                tone={active ? 'jade' : 'ink'}
                active={active}
                className="kitchen-nav-icon shrink-0"
              />
              <span className={clsx('kitchen-nav-label', active && 'font-extrabold text-tk-jade-deep')}>
                {pillar.label}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ActiveCookingResumeBanner({ compact = false }: { compact?: boolean }) {
  const runId = useCookingStore((s) => s.runId);
  const activeRecipe = useCookingStore((s) => s.activeRecipe);
  const currentStepIndex = useCookingStore((s) => s.currentStepIndex);
  const mode = useCookingStore((s) => s.mode);
  const attempt = useCookingStore((s) => s.attempt);

  if (!runId || !activeRecipe) return null;
  if (attempt && ['saved', 'queued'].includes(attempt.status)) return null;

  const totalSteps = Math.max(1, activeRecipe.steps.length);
  const currentStep = Math.min(totalSteps, currentStepIndex + 1);
  const cookHref = `/cook/${encodeURIComponent(activeRecipe.slug || activeRecipe.id)}`;

  if (compact) {
    return (
      <Link
        to={cookHref}
        data-testid="active-cooking-resume-mobile"
        className="mx-3 mb-2 flex items-center justify-between gap-2.5 rounded-2xl border border-white/15 bg-tk-sanctuary px-3.5 py-2.5 text-white shadow-elevated transition-transform active:scale-[0.99] sm:hidden"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-tk-flame/20">
            <WokFlameIcon size={18} tone="flame" active />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-extrabold text-white">
              {activeRecipe.title}
            </span>
            <span className="block text-[11px] text-white/75 tk-tabular">
              {mode === 'mam_com' ? 'Mâm cơm song song' : 'Đang nấu dở'} · Bước {currentStep}/
              {totalSteps}
            </span>
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-tk-flame px-2.5 py-1 text-[11px] font-extrabold text-white">
          Tiếp tục
        </span>
      </Link>
    );
  }

  return (
    <Link
      to={cookHref}
      data-testid="active-cooking-resume-rail"
      className="mt-auto rounded-2xl border border-white/10 bg-tk-sanctuary-card p-3.5 text-white shadow-elevated transition-colors hover:bg-tk-sanctuary-elevated"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-tk-flame/20">
          <WokFlameIcon size={18} tone="flame" active />
        </span>
        <div className="min-w-0 flex-1 hidden lg:block">
          <p className="text-[10px] font-bold uppercase tracking-wider text-tk-flame-glow">
            {mode === 'mam_com' ? 'Bếp Mâm Cơm' : 'Đang nấu dở'}
          </p>
          <p className="truncate text-xs font-extrabold text-white">{activeRecipe.title}</p>
        </div>
      </div>
      <div className="mt-2.5 hidden lg:flex items-center justify-between gap-2 text-[11px] text-white/80 tk-tabular">
        <span>
          Bước {currentStep}/{totalSteps}
        </span>
        <span className="font-extrabold text-tk-jade-mint">Vào bếp tiếp →</span>
      </div>
    </Link>
  );
}

export function KitchenScanLink({ className = '' }: { className?: string }) {
  const { pathname } = useLocation();
  const active = inFamily(pathname, SCAN_PATH);
  return (
    <Link
      to={SCAN_PATH}
      className={clsx(
        'kitchen-scan-link !rounded-2xl !bg-tk-flame hover:!bg-tk-flame-hover !text-white !font-extrabold shadow-float transition-tap active:scale-[0.985]',
        className,
      )}
      aria-current={active ? 'page' : undefined}
    >
      <NavScanApertureIcon size={20} tone="cream" active className="kitchen-nav-icon" />
      <span>Quét nguyên liệu AI</span>
    </Link>
  );
}

export function BottomNavigationBar({ kitchen = false }: { kitchen?: boolean }) {
  if (!kitchen) return <LegacyBottomNavigationBar />;
  return (
    <nav aria-label="Điều hướng chính" className="kitchen-bottom-nav">
      <div className="tk-glass mx-auto max-w-xl rounded-2xl border border-tk-stone/80 px-1 py-0.5 shadow-elevated">
        <KitchenMobileDockItems />
      </div>
    </nav>
  );
}

type SidebarProps = React.ComponentProps<typeof LegacyRailSidebar> & { kitchen?: boolean };

export function RailSidebar({ kitchen = false, ...brand }: SidebarProps) {
  if (!kitchen) return <LegacyRailSidebar {...brand} />;
  return (
    <nav
      aria-label="Điều hướng chính"
      className="kitchen-sidebar !bg-tk-canvas/95 backdrop-blur-xl !border-tk-stone/85"
    >
      <Link
        to="/"
        aria-label="Takolio — Trang chủ"
        translate="no"
        className="kitchen-sidebar-brand px-2 py-1"
      >
        <span className="kitchen-sidebar-symbol inline-flex items-center justify-center">
          <TakolioLogoMark size={30} tone="flame" active />
        </span>
        <span className="kitchen-sidebar-logo hidden lg:inline-flex items-center">
          <TakolioWordmarkLockup size={34} tone="ink" />
          <img
            src={brand.brandLogo ?? TAKOSAN_BRAND.wordmark}
            alt=""
            width={466}
            height={262}
            className="sr-only"
          />
        </span>
      </Link>

      {/* Prominent Terracotta AI Vision Scan CTA */}
      <div className="w-full px-0.5">
        <KitchenScanLink className="w-full" />
      </div>

      {/* 6-Pillar Terra-Botanical Atelier Navigation */}
      <KitchenDesktopSixPillarItems />

      {/* Live Active Cooking Session Resume Card */}
      <ActiveCookingResumeBanner />
    </nav>
  );
}
