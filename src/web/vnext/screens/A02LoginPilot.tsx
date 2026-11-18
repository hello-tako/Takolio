import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/tokens.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { isInventoryTransferDeferred } from '../../services/auth';
import { capturePrivateSession } from '../../lib/private-session';
import { apiErrorMessage } from '../../features/auth/auth-shared';
import { GoogleAuthSection } from '../../features/auth/GoogleAuthSection';
import { useBrandDirection } from '../feature';
import { G02DirectionPreviewBar } from '../components/Shells';
import { BrandLockup, MascotIllustration } from '../components/VNextMedia';
import { TkvBadge, TkvButton, TkvSurface, TkvTextField } from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';

/**
 * A02 — Đăng nhập tài khoản (G02 Live Pilot).
 * Preserves 100% of existing auth contracts:
 * - Email/password login (`POST /api/v1/auth/login`)
 * - Real Google Identity Services button (`GoogleAuthSection`, `A03` compatibility)
 * - Sanitized internal-only `returnTo`
 * - `capturePrivateSession()` race fence
 * - `DEC-012` guest data transfer refusal (`A08` honest state — never fakes merge!)
 */
export const A02LoginPilot: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [searchParams] = useSearchParams();
  const [direction, setDirection] = useBrandDirection(search);

  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : '/?vnext=1';

  const setAuthSession = useAuthStore((s) => s.setAuthSession);
  const isGuest = useAuthStore((s) => s.isGuest);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transferDeferred, setTransferDeferred] = useState(false);

  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [googleRetry, setGoogleRetry] = useState(0);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api
      .getPublicConfig()
      .then((cfg) => {
        if (!active) return;
        const cid = cfg.googleClientId || null;
        setGoogleClientId(cid);
        setGoogleStatus(cid ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (!active) return;
        setGoogleClientId(null);
        setGoogleStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [googleRetry]);

  const handleRetryGoogle = useCallback(() => {
    setGoogleStatus('loading');
    setGoogleRetry((n) => n + 1);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setTransferDeferred(false);
    if (!email.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ địa chỉ email và mật khẩu.');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErrorMessage('Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng để đăng nhập.');
      return;
    }
    const isCurrent = capturePrivateSession();
    setIsLoading(true);
    try {
      const response = await api.login(email.trim(), password);
      if (!isCurrent()) return;
      setAuthSession({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName,
        avatarUrl: response.user.avatarUrl,
        householdId: response.user.householdId,
        onboardingCompleted: response.user.onboardingCompleted,
      });
      navigate(returnTo, { replace: true });
    } catch (error) {
      if (!isCurrent()) return;
      if (isInventoryTransferDeferred(error)) {
        // DEC-012 / A08: Server refused automatic guest inventory transfer. Never fake merge.
        setTransferDeferred(true);
        return;
      }
      setErrorMessage(apiErrorMessage(error, 'Đăng nhập chưa thành công. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  return (
    <div className="tkv-root min-h-dvh flex flex-col" data-tkv-direction={direction} data-tkv-screen="A02">
      <a href="#tkv-a02-main" className="tkv-skip-link">
        Đến biểu mẫu đăng nhập
      </a>
      <G02DirectionPreviewBar direction={direction} onDirectionChange={setDirection} screenId="A02" />

      <main
        id="tkv-a02-main"
        tabIndex={-1}
        className="flex-1 max-w-[1040px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-12 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Form Column — Mobile-first clean form matching A02.png (never pushed down by decorative art) */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <TkvSurface className="p-6 sm:p-8 relative overflow-hidden space-y-5">
              {/* Subtle warm studio circles echoing A02.png top-right motif */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[var(--tkv-surface-mint)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-10 top-3 w-7 h-7 rounded-full bg-[var(--tkv-saffron)] opacity-80"
              />

              <div className="relative flex items-center justify-between">
                <Link to="/landing?vnext=1" className="tkv-focusable rounded-xl py-1">
                  <BrandLockup direction={direction} />
                </Link>
              </div>

              <div className="relative space-y-2 pt-1">
                <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                  Đăng nhập tài khoản
                </h1>
                <p className="text-sm text-[var(--tkv-ink-secondary)]">
                  Tiếp tục quản lý căn bếp, tủ lạnh và thực đơn của hộ gia đình bạn.
                </p>
              </div>

              {isGuest && !transferDeferred && (
                <TkvBadge tone="neutral" icon="info">
                  Đang dùng phiên khách · Đăng nhập để đồng bộ tài khoản
                </TkvBadge>
              )}

              {/* A08 DEC-012 Guest Transfer Refusal Guard */}
              {transferDeferred && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-[var(--tkv-surface-saffron)] border border-[var(--tkv-warning)]/30 space-y-2.5"
                >
                  <p className="text-xs font-extrabold text-[var(--tkv-warning)]">
                    Chuyển dữ liệu phiên khách cần xác nhận (A08)
                  </p>
                  <p className="text-xs text-[var(--tkv-ink)] leading-relaxed">
                    Máy chủ chưa tự động gộp nguyên liệu từ phiên khách sang tài khoản này. Dữ liệu khách hiện vẫn được giữ nguyên trên thiết bị.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/auth?mode=login"
                      className="tkv-focusable min-h-[40px] inline-flex items-center px-3 py-1.5 rounded-xl bg-[var(--tkv-primary)] text-white text-xs font-bold"
                    >
                      Xem tùy chọn chuyển phiên
                    </Link>
                    <Link
                      to="/fridge?vnext=1"
                      className="tkv-focusable min-h-[40px] inline-flex items-center px-3 py-1.5 rounded-xl bg-white border border-[var(--tkv-border)] text-xs font-bold text-[var(--tkv-ink)]"
                    >
                      Quay về tủ lạnh khách
                    </Link>
                  </div>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-danger)]/30 text-sm font-semibold text-[var(--tkv-danger)] flex items-start gap-2.5"
                >
                  <VNextIcon name="error" size={18} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <TkvTextField
                  label="Địa chỉ email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  iconLeft="mail"
                />

                <div className="space-y-2">
                  <TkvTextField
                    label="Mật khẩu"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••"
                    iconLeft="lock"
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                        aria-pressed={showPassword}
                        className="tkv-focusable tkv-tap inline-flex items-center justify-center text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-ink)] rounded-xl"
                      >
                        <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                      </button>
                    }
                  />
                  <div className="flex justify-end">
                    <Link
                      to="/auth?mode=forgot"
                      className="tkv-focusable min-h-[44px] inline-flex items-center px-1 text-xs font-bold text-[var(--tkv-primary)] hover:underline"
                    >
                      Quên mật khẩu?
                    </Link>
                  </div>
                </div>

                <TkvButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isLoading}
                  data-testid="a02-submit-btn"
                >
                  Đăng nhập
                </TkvButton>
              </form>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--tkv-border)]" />
                <span className="text-xs font-semibold text-[var(--tkv-ink-muted)]">Hoặc</span>
                <div className="h-px flex-1 bg-[var(--tkv-border)]" />
              </div>

              {/* A03 Google Identity Services integration — never fakes Google sign-in */}
              <GoogleAuthSection
                buttonRef={googleBtnRef}
                status={googleStatus}
                clientId={googleClientId}
                onRetry={handleRetryGoogle}
              />

              <div className="pt-2 border-t border-[var(--tkv-border)] flex items-center justify-between gap-2 flex-wrap text-xs font-bold text-[var(--tkv-primary)]">
                <Link to="/landing?vnext=1" className="tkv-focusable min-h-[44px] inline-flex items-center hover:underline">
                  ← Quay lại
                </Link>
                <Link to="/auth?mode=register" className="tkv-focusable min-h-[44px] inline-flex items-center hover:underline">
                  Tạo tài khoản mới
                </Link>
              </div>
            </TkvSurface>
          </div>

          {/* Desktop Editorial Companion Panel (>=1024px only so mobile stays 100% focused on form) */}
          <aside
            aria-label="Thông tin bảo mật căn bếp"
            className="hidden lg:flex lg:col-span-6 flex-col justify-center gap-5 p-8 rounded-[28px] bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)]"
          >
            <div className="flex items-center gap-4">
              <MascotIllustration pose="welcome" size={88} decorative className="border-2 border-white shadow-sm" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
                  Takolio Kitchen Studio
                </p>
                <h2 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
                  Mỗi căn bếp là một không gian riêng tư
                </h2>
              </div>
            </div>
            <ul className="space-y-3 text-sm text-[var(--tkv-ink-secondary)]">
              <li className="flex items-start gap-2.5">
                <VNextIcon name="shield" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                <span>Tồn kho tủ lạnh, lịch sử quét và thực đơn được phân tách chặt chẽ theo mã hộ gia đình.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <VNextIcon name="check" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                <span>Phiên xác thực sử dụng cookie bảo mật và tự động làm sạch bộ nhớ đệm khi chuyển tài khoản.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <VNextIcon name="sparkles" size={18} className="text-[var(--tkv-primary)] shrink-0 mt-0.5" />
                <span>Mọi kết quả nhận diện AI đều qua bước duyệt thủ công của bạn trước khi cập nhật tủ lạnh.</span>
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
};
