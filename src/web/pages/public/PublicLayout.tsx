import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { ArrowRight, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { TAKOSAN_KITCHEN } from '../../lib/takosan-kitchen';
import { ActionButton } from '../../design-system/v4/AtelierPrimitives';
import {
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  TakolioWordmarkLockup,
} from '../../design-system/icons';

const NAV_LINKS = [
  { to: '/landing', label: 'Trang chủ' },
  { to: '/features', label: 'Tính năng & AI' },
  { to: '/pricing', label: 'Bảng giá' },
  { to: '/about', label: 'Triết lý Bếp' },
] as const;

export interface PublicLayoutProps {
  children: React.ReactNode;
  dataTestId?: string;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ children, dataTestId }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { userId, householdId, isGuest, isOnboarded, setGuestSession } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [startingGuest, setStartingGuest] = useState(false);

  const hasRegisteredSession = Boolean(userId && householdId && !isGuest);
  const hasAnySession = Boolean(userId && householdId);
  const isCinemaHeroRoute = pathname === '/landing';

  const handleQuickStart = async () => {
    if (hasAnySession) {
      navigate(isOnboarded ? '/' : '/onboarding');
      return;
    }
    setStartingGuest(true);
    try {
      await setGuestSession();
      navigate('/onboarding');
    } catch {
      navigate('/auth?mode=register');
    } finally {
      setStartingGuest(false);
    }
  };

  return (
    <div
      data-testid={dataTestId}
      className="min-h-dvh flex flex-col bg-tk-canvas text-tk-ink selection:bg-tk-flame-soft selection:text-tk-flame-deep"
    >
      {/* Architectural Masthead Navbar — Seamless Obsidian Hearth on /landing, Frosted Stoneware on subpages */}
      <header
        className={clsx(
          'sticky top-0 z-40 transition-colors',
          isCinemaHeroRoute
            ? 'bg-tk-sanctuary/92 backdrop-blur-xl border-b border-white/12 px-3 sm:px-6 py-2.5'
            : 'px-3 sm:px-6 pt-3',
        )}
      >
        <div
          className={clsx(
            'mx-auto max-w-7xl',
            isCinemaHeroRoute
              ? 'px-1 sm:px-2 py-0.5'
              : 'rounded-[24px] tk-glass border border-tk-stone px-4 sm:px-6 py-2.5',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/landing"
              aria-label="Takolio Trang chủ"
              className="tap-target inline-flex items-center gap-2 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-tk-flame/40"
            >
              <TakolioWordmarkLockup
                size={32}
                tone={isCinemaHeroRoute ? 'cream' : 'ink'}
              />
            </Link>

            <nav aria-label="Điều hướng chính" className="hidden lg:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-current={active ? 'page' : undefined}
                    className={clsx(
                      'tap-target inline-flex items-center px-4 py-2 rounded-xl text-sm font-bold transition-colors',
                      isCinemaHeroRoute
                        ? active
                          ? 'bg-white/14 text-white border border-white/15'
                          : 'text-white/75 hover:text-white hover:bg-white/8'
                        : active
                          ? 'bg-tk-jade-soft text-tk-jade-deep'
                          : 'text-tk-secondary hover:text-tk-ink hover:bg-tk-sunken/70',
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="hidden sm:flex items-center gap-2.5">
              {hasRegisteredSession ? (
                <ActionButton
                  to={isOnboarded ? '/' : '/onboarding'}
                  variant="jade"
                  size="md"
                  trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                >
                  Mở gian bếp của tôi
                </ActionButton>
              ) : (
                <>
                  <ActionButton
                    to="/auth"
                    variant={isCinemaHeroRoute ? 'sanctuary' : 'ghost'}
                    size="md"
                  >
                    Đăng nhập
                  </ActionButton>
                  <ActionButton
                    variant="flame"
                    size="md"
                    loading={startingGuest}
                    onClick={() => void handleQuickStart()}
                    trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
                  >
                    Vào bếp miễn phí
                  </ActionButton>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Đóng trình đơn' : 'Mở trình đơn'}
              className={clsx(
                'lg:hidden tap-target inline-flex items-center justify-center rounded-xl border transition-colors cursor-pointer',
                isCinemaHeroRoute
                  ? 'border-white/20 bg-tk-sanctuary-card text-white hover:bg-tk-sanctuary-elevated'
                  : 'border-tk-stone bg-tk-surface text-tk-ink hover:bg-tk-sunken',
              )}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Menu className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>

          {mobileMenuOpen && (
            <div
              className={clsx(
                'lg:hidden mt-3 pt-3 border-t space-y-2 animate-fade-in',
                isCinemaHeroRoute ? 'border-white/15' : 'border-tk-stone/80',
              )}
            >
              <nav aria-label="Điều hướng di động" className="grid gap-1">
                {NAV_LINKS.map((link) => {
                  const active = pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={clsx(
                        'tap-target flex items-center px-3.5 py-2.5 rounded-xl text-sm font-bold transition-colors',
                        isCinemaHeroRoute
                          ? active
                            ? 'bg-white/15 text-white'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                          : active
                            ? 'bg-tk-jade-soft text-tk-jade-deep'
                            : 'text-tk-secondary hover:bg-tk-sunken/80 hover:text-tk-ink',
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="grid grid-cols-1 sm:hidden gap-2 pt-2">
                {hasRegisteredSession ? (
                  <ActionButton
                    to={isOnboarded ? '/' : '/onboarding'}
                    variant="jade"
                    size="md"
                    fullWidth
                  >
                    Mở gian bếp của tôi
                  </ActionButton>
                ) : (
                  <>
                    <ActionButton
                      to="/auth"
                      variant={isCinemaHeroRoute ? 'sanctuary' : 'ceramic'}
                      size="md"
                      fullWidth
                    >
                      Đăng nhập
                    </ActionButton>
                    <ActionButton
                      variant="flame"
                      size="md"
                      fullWidth
                      loading={startingGuest}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void handleQuickStart();
                      }}
                    >
                      Vào bếp miễn phí
                    </ActionButton>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Editorial Multi-Column Smoked Stoneware Footer */}
      <footer className="mt-16 border-t-2 border-tk-stone bg-tk-sunken">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-tk-stone">
            <div className="md:col-span-5 space-y-4">
              <img
                src={TAKOSAN_KITCHEN.logo}
                alt="Takolio"
                translate="no"
                width={300}
                height={72}
                data-testid="landing-logo"
                className="h-11 w-auto object-contain"
              />
              <p className="text-sm text-tk-secondary leading-relaxed max-w-md">
                Tuyên ngôn Bếp Việt Hiện Đại: Trân trọng từng bó rau, lát cá trong tủ lạnh nhà mình.
                Takolio kết nối quản trị lô hạn dùng FEFO, trí tuệ nhân tạo có kiểm chứng và nghệ
                thuật sắp xếp mâm cơm gia đình ấm lửa mỗi chiều.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-tk-surface border border-tk-stone px-3 py-1.5 text-xs font-bold text-tk-jade-deep shadow-2xs">
                  <FreshnessShieldIcon size={15} tone="jade" active />
                  Chống lãng phí thực phẩm
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-pill bg-tk-surface border border-tk-stone px-3 py-1.5 text-xs font-bold text-tk-ink shadow-2xs">
                  <HouseholdTrayIcon size={15} tone="flame" active />
                  Chuẩn mâm cơm Việt
                </span>
              </div>
            </div>

            <div className="md:col-span-2 space-y-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-tk-ink">
                Không gian bếp
              </p>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    to="/landing"
                    className="tap-target inline-flex items-center text-tk-secondary hover:text-tk-ink font-semibold"
                  >
                    Trang chủ Điện ảnh
                  </Link>
                </li>
                <li>
                  <Link
                    to="/features"
                    className="tap-target inline-flex items-center text-tk-secondary hover:text-tk-ink font-semibold"
                  >
                    Tính năng & AI
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pricing"
                    className="tap-target inline-flex items-center text-tk-secondary hover:text-tk-ink font-semibold"
                  >
                    Bảng giá minh bạch
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-tk-ink">
                Câu chuyện & Pháp lý
              </p>
              <ul className="space-y-1 text-sm">
                <li>
                  <Link
                    to="/about"
                    className="tap-target inline-flex items-center text-tk-secondary hover:text-tk-ink font-semibold"
                  >
                    Triết lý Bếp Việt
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="tap-target inline-flex items-center text-tk-secondary hover:text-tk-ink font-semibold"
                  >
                    Chính sách Bảo mật
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="tap-target inline-flex items-center text-tk-secondary hover:text-tk-ink font-semibold"
                  >
                    Điều khoản Sử dụng
                  </Link>
                </li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-tk-ink">
                Bắt đầu hôm nay
              </p>
              <p className="text-xs text-tk-secondary leading-relaxed">
                Khởi tạo gian bếp miễn phí trong 60 giây, dùng thử ngay trên trình duyệt mà không
                cần thẻ thanh toán.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <ActionButton
                  variant="flame"
                  size="md"
                  loading={startingGuest}
                  onClick={() => void handleQuickStart()}
                >
                  Vào bếp miễn phí
                </ActionButton>
                <ActionButton to="/auth" variant="ceramic" size="sm">
                  Đăng nhập tài khoản
                </ActionButton>
              </div>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-tk-muted">
            <p>© {new Date().getFullYear()} Takolio Culinary Atelier. Một căn bếp ngăn nắp hơn, từng bữa một.</p>
            <div className="inline-flex items-center gap-1.5 text-tk-secondary font-semibold">
              <ShieldCheck className="w-4 h-4 text-tk-jade shrink-0" aria-hidden="true" />
              <span>Dữ liệu tủ lạnh & thực đơn được cô lập riêng biệt theo từng hộ gia đình</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
