import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import '../styles/tokens.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { isInventoryTransferDeferred } from '../../services/auth';
import { capturePrivateSession } from '../../lib/private-session';
import { apiErrorMessage } from '../../features/auth/auth-shared';
import { GoogleAuthSection } from '../../features/auth/GoogleAuthSection';
import {
  clearVerifyContext,
  readVerifyContext,
  resendSecondsRemaining,
  writeVerifyContext,
} from '../../features/auth/verify-context';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';
import { useBrandDirection, vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { BrandLockup, MascotIllustration } from '../components/VNextMedia';
import { TkvBadge, TkvButton, TkvSurface, TkvTextField } from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';

export type VNextAuthMode =
  | 'choose' // A01
  | 'login' // A02
  | 'google' // A03
  | 'register' // A04
  | 'verify' // A05
  | 'forgot' // A06
  | 'reset' // A07
  | 'transfer-deferred'; // A08

function resolveAuthMode(pathname: string, params: URLSearchParams): VNextAuthMode {
  if (pathname === '/auth/verify') return 'verify';
  if (params.get('provider') === 'google') return 'google';
  const mode = params.get('mode');
  if (
    mode === 'choose' ||
    mode === 'login' ||
    mode === 'google' ||
    mode === 'register' ||
    mode === 'forgot' ||
    mode === 'reset' ||
    mode === 'transfer-deferred'
  ) {
    return mode;
  }
  return 'login';
}

const SCREEN_IDS: Record<VNextAuthMode, string> = {
  choose: 'A01',
  login: 'A02',
  google: 'A03',
  register: 'A04',
  verify: 'A05',
  forgot: 'A06',
  reset: 'A07',
  'transfer-deferred': 'A08',
};

const OTP_LEN = 6;

const SixDigitOtpInput: React.FC<{
  digits: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}> = ({ digits, onChange, disabled = false }) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const handleDigitChange = (idx: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      const copy = [...digits];
      copy[idx] = '';
      onChange(copy);
      return;
    }
    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < clean.length && idx + i < OTP_LEN; i += 1) {
        next[idx + i] = clean[i];
      }
      onChange(next);
      const focusIdx = Math.min(OTP_LEN - 1, idx + clean.length);
      refs.current[focusIdx]?.focus();
      return;
    }
    const copy = [...digits];
    copy[idx] = clean;
    onChange(copy);
    if (idx < OTP_LEN - 1) refs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < OTP_LEN - 1) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: OTP_LEN }, (_, i) => pasted[i] ?? '');
    onChange(next);
    refs.current[Math.min(OTP_LEN - 1, pasted.length)]?.focus();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-extrabold text-[var(--tkv-ink)]">Mã xác thực 6 số</p>
      <div className="grid grid-cols-6 gap-2 sm:gap-2.5" role="group" aria-label="Nhập mã OTP 6 chữ số">
        {Array.from({ length: OTP_LEN }, (_, idx) => (
          <input
            key={idx}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            disabled={disabled}
            aria-label={`Chữ số OTP thứ ${idx + 1}`}
            value={digits[idx] ?? ''}
            onChange={(e) => handleDigitChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            className="tkv-focusable h-14 w-full rounded-2xl border border-[var(--tkv-border-strong)] bg-white text-center tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]"
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Unified Gate G04 Authentication Flow (`A01–A08`).
 * Preserves 100% of verified auth contracts:
 * - Guest entry (`setGuestSession`), Email Login (`api.login`), Register (`api.register` + Turnstile),
 *   Google Identity Services (`GoogleAuthSection`), 6-digit OTP (`/auth/verify` + paste + cooldown),
 *   Forgot/Reset Password (`api.forgotPassword` / `api.resetPassword`), and `DEC-012` transfer refusal (`A08`).
 */
export const VNextAuthFlow: React.FC = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [searchParams] = useSearchParams();
  const [direction] = useBrandDirection(search);

  const urlMode = resolveAuthMode(pathname, searchParams);
  const [transferDeferred, setTransferDeferred] = useState(false);
  const activeMode: VNextAuthMode = transferDeferred ? 'transfer-deferred' : urlMode;
  const screenId = SCREEN_IDS[activeMode];

  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : vnextHref('/');

  const setAuthSession = useAuthStore((s) => s.setAuthSession);
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const isGuest = useAuthStore((s) => s.isGuest);
  const guestHouseholdId = useAuthStore((s) => (s.isGuest && s.householdId ? s.householdId : null));

  const initialVerify = pathname === '/auth/verify' ? readVerifyContext() : null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => initialVerify?.email ?? searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(() => resendSecondsRemaining(initialVerify));
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileGen, setTurnstileGen] = useState(0);

  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [googleRetry, setGoogleRetry] = useState(0);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useVNextSeo({
    title:
      activeMode === 'choose'
        ? 'Bắt đầu với Takolio'
        : activeMode === 'register'
          ? 'Tạo tài khoản mới'
          : activeMode === 'verify'
            ? 'Xác minh OTP'
            : activeMode === 'forgot'
              ? 'Quên mật khẩu'
              : activeMode === 'reset'
                ? 'Đặt lại mật khẩu'
                : activeMode === 'google'
                  ? 'Đăng nhập bằng Google'
                  : activeMode === 'transfer-deferred'
                    ? 'Chuyển dữ liệu khách'
                    : 'Đăng nhập tài khoản',
    description: 'Xác thực tài khoản an toàn và bảo vệ dữ liệu riêng tư theo từng hộ gia đình trên Takolio.',
    canonicalPath: pathname === '/auth/verify' ? '/auth/verify' : '/auth',
  });

  useEffect(() => {
    let active = true;
    api
      .getPublicConfig()
      .then((cfg) => {
        if (!active) return;
        setTurnstileSiteKey(cfg.turnstileSiteKey || null);
        const cid = cfg.googleClientId || null;
        setGoogleClientId(cid);
        setGoogleStatus(cid ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (!active) return;
        setTurnstileSiteKey(null);
        setGoogleClientId(null);
        setGoogleStatus('unavailable');
      });
    return () => {
      active = false;
    };
  }, [googleRetry]);

  useEffect(() => {
    if (pathname === '/auth/verify') {
      const ctx = readVerifyContext();
      if (ctx) {
        setEmail(ctx.email);
        setResendSeconds(resendSecondsRemaining(ctx));
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = window.setInterval(() => {
      setResendSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendSeconds]);

  const switchMode = (nextMode: VNextAuthMode, extraQuery = '') => {
    setErrorMessage(null);
    setInfoMessage(null);
    setTransferDeferred(false);
    const rt = requestedReturnTo ? `&returnTo=${encodeURIComponent(requestedReturnTo)}` : '';
    if (nextMode === 'verify') {
      navigate(vnextHref(`/auth/verify${rt ? `?${rt.slice(1)}` : ''}`));
      return;
    }
    navigate(vnextHref(`/auth?mode=${nextMode}${rt}${extraQuery}`));
  };

  const handleRetryGoogle = useCallback(() => {
    setGoogleStatus('loading');
    setGoogleRetry((n) => n + 1);
  }, []);

  const ensureOnline = (): boolean => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErrorMessage('Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng để tiếp tục.');
      return false;
    }
    return true;
  };

  const handleGuestStart = async () => {
    setErrorMessage(null);
    if (!ensureOnline()) return;
    setIsLoading(true);
    try {
      await setGuestSession();
      navigate(vnextHref('/onboarding/welcome'));
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Không thể khởi tạo phiên dùng thử ngay lúc này.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim() || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ địa chỉ email và mật khẩu.');
      return;
    }
    if (!ensureOnline()) return;
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
    } catch (err) {
      if (!isCurrent()) return;
      if (isInventoryTransferDeferred(err)) {
        setTransferDeferred(true);
        return;
      }
      setErrorMessage(apiErrorMessage(err, 'Đăng nhập chưa thành công. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim() || password.length < 8) {
      setErrorMessage('Vui lòng nhập email hợp lệ và mật khẩu tối thiểu 8 ký tự.');
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setErrorMessage('Vui lòng hoàn tất xác minh bảo mật trước khi tạo tài khoản.');
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    setIsLoading(true);
    try {
      const display = name.trim() || email.trim().split('@')[0] || 'Thành viên Takolio';
      const res = await api.register(display, email.trim(), password, turnstileToken);
      if (!isCurrent()) return;
      const now = Date.now();
      const ctx = writeVerifyContext({
        email: email.trim(),
        resendAvailableAt: now + 60_000,
        expiresAt: res.expiresInMinutes ? now + res.expiresInMinutes * 60_000 : null,
        delivered: true,
      });
      setResendSeconds(resendSecondsRemaining(ctx));
      setDevOtpHint(res.devOtp ?? null);
      setOtpDigits(['', '', '', '', '', '']);
      switchMode('verify');
    } catch (err) {
      if (!isCurrent()) return;
      setTurnstileGen((g) => g + 1);
      setTurnstileToken(null);
      setErrorMessage(apiErrorMessage(err, 'Chưa thể tạo tài khoản mới. Vui lòng kiểm tra lại thông tin.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent, allowMigrate = true) => {
    e.preventDefault();
    setErrorMessage(null);
    const code = otpDigits.join('');
    if (!email.trim() || code.length !== 6) {
      setErrorMessage('Vui lòng nhập đủ mã OTP 6 chữ số được gửi tới email của bạn.');
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    setIsLoading(true);
    try {
      const res = await api.verifyOtp(
        email.trim(),
        code,
        'register',
        allowMigrate ? guestHouseholdId : null,
        password || undefined,
      );
      if (!isCurrent()) return;
      if (!res.user?.id || !res.user?.householdId) {
        throw new Error('Máy chủ chưa xác nhận thông tin tài khoản.');
      }
      clearVerifyContext();
      setAuthSession({
        id: res.user.id,
        email: res.user.email,
        displayName: res.user.displayName,
        avatarUrl: res.user.avatarUrl,
        householdId: res.user.householdId,
        onboardingCompleted: res.user.onboardingCompleted,
      });
      navigate(
        res.user.onboardingCompleted ? returnTo : vnextHref('/onboarding/welcome'),
        { replace: true },
      );
    } catch (err) {
      if (!isCurrent()) return;
      if (isInventoryTransferDeferred(err)) {
        setTransferDeferred(true);
        return;
      }
      setErrorMessage(apiErrorMessage(err, 'Mã xác thực không hợp lệ hoặc đã hết hạn.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0 || !email.trim()) return;
    setErrorMessage(null);
    if (!ensureOnline()) return;
    setIsLoading(true);
    try {
      const res = await api.resendOtp(email.trim(), 'register');
      const now = Date.now();
      const ctx = writeVerifyContext({
        email: email.trim(),
        resendAvailableAt: now + 60_000,
        expiresAt: res.expiresInMinutes ? now + res.expiresInMinutes * 60_000 : null,
        delivered: true,
      });
      setResendSeconds(resendSecondsRemaining(ctx));
      if (res.devOtp) setDevOtpHint(res.devOtp);
      setInfoMessage('Đã gửi lại mã xác thực mới tới hộp thư của bạn.');
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Chưa thể gửi lại mã OTP lúc này.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Vui lòng nhập địa chỉ email tài khoản.');
      return;
    }
    if (!ensureOnline()) return;
    setIsLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      if (res.devOtp) setDevOtpHint(res.devOtp);
      setOtpDigits(['', '', '', '', '', '']);
      switchMode('reset', `&email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Không thể gửi mã khôi phục lúc này. Vui lòng thử lại.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const code = otpDigits.join('');
    if (!email.trim() || code.length !== 6 || newPassword.length < 8) {
      setErrorMessage('Vui lòng nhập email, mã OTP 6 chữ số và mật khẩu mới tối thiểu 8 ký tự.');
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    setIsLoading(true);
    try {
      const res = await api.resetPassword(email.trim(), code, newPassword);
      if (!isCurrent()) return;
      if (res.user?.id && res.user?.householdId) {
        setAuthSession({
          id: res.user.id,
          email: res.user.email,
          displayName: res.user.displayName,
          avatarUrl: res.user.avatarUrl,
          householdId: res.user.householdId,
          onboardingCompleted: res.user.onboardingCompleted,
        });
        navigate(returnTo, { replace: true });
        return;
      }
      setInfoMessage('Đã đặt lại mật khẩu thành công. Mời bạn đăng nhập bằng mật khẩu mới.');
      switchMode('login');
    } catch (err) {
      if (!isCurrent()) return;
      setErrorMessage(apiErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra mã xác thực.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  return (
    <div className="tkv-root min-h-dvh flex flex-col" data-tkv-direction={direction} data-tkv-screen={screenId}>
      <a href="#tkv-auth-main" className="tkv-skip-link">
        Đến biểu mẫu xác thực
      </a>

      <main
        id="tkv-auth-main"
        tabIndex={-1}
        className="flex-1 max-w-[1040px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-12 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Mobile-First Auth Card matching A01..A08 wireframes */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <TkvSurface className="p-6 sm:p-8 relative overflow-hidden space-y-5">
              {/* Warm Kitchen Studio corner motif echoing A01..A08 wireframes */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[var(--tkv-surface-mint)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute right-10 top-3 w-7 h-7 rounded-full bg-[var(--tkv-saffron)] opacity-80"
              />

              <div className="relative flex items-center justify-between">
                <Link to={vnextHref('/landing')} className="tkv-focusable rounded-xl py-1">
                  <BrandLockup direction={direction} />
                </Link>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-danger)]/35 text-sm font-semibold text-[var(--tkv-danger)] flex items-start gap-2.5"
                >
                  <VNextIcon name="error" size={18} className="shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)] text-sm font-semibold text-[var(--tkv-primary)] flex items-start gap-2.5"
                >
                  <VNextIcon name="check" size={18} className="shrink-0 mt-0.5" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* A01 — Bắt đầu với Takolio (Choose Entry) */}
              {activeMode === 'choose' && (
                <div className="relative space-y-5">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Bắt đầu với Takolio
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Chọn cách vào ứng dụng phù hợp với bạn.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <TkvButton
                      variant="primary"
                      size="lg"
                      fullWidth
                      iconLeft="mail"
                      onClick={() => switchMode('login')}
                    >
                      Tiếp tục bằng email
                    </TkvButton>
                    <TkvButton
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={() => switchMode('google')}
                    >
                      Đăng nhập bằng Google
                    </TkvButton>
                    <TkvButton
                      variant="quiet"
                      size="md"
                      fullWidth
                      isLoading={isLoading}
                      onClick={handleGuestStart}
                    >
                      Dùng thử ngay với phiên khách
                    </TkvButton>
                  </div>
                </div>
              )}

              {/* A02 — Đăng nhập tài khoản */}
              {activeMode === 'login' && (
                <div className="relative space-y-5">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Đăng nhập tài khoản
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Tiếp tục quản lý căn bếp, tủ lạnh và thực đơn của hộ gia đình bạn.
                    </p>
                  </div>

                  {isGuest && (
                    <TkvBadge tone="neutral" icon="info">
                      Đang dùng phiên khách · Đăng nhập để đồng bộ tài khoản
                    </TkvBadge>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4" noValidate>
                    <TkvTextField
                      label="Địa chỉ email"
                      type="email"
                      autoComplete="email"
                      iconLeft="mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                    />
                    <div className="space-y-2">
                      <TkvTextField
                        label="Mật khẩu"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        iconLeft="lock"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••"
                        required
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            className="tkv-focusable w-9 h-9 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted)]"
                          >
                            <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                          </button>
                        }
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => switchMode('forgot')}
                          className="tkv-focusable text-xs font-bold text-[var(--tkv-primary)] hover:underline py-1"
                        >
                          Quên mật khẩu?
                        </button>
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

                  <GoogleAuthSection
                    clientId={googleClientId}
                    status={googleStatus}
                    buttonRef={googleBtnRef}
                    onRetry={handleRetryGoogle}
                  />
                </div>
              )}

              {/* A03 — Đăng nhập bằng Google */}
              {activeMode === 'google' && (
                <div className="relative space-y-5">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Đăng nhập bằng Google
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Xác thực nhanh, có phương án dự phòng khi dịch vụ không sẵn sàng.
                    </p>
                  </div>

                  <GoogleAuthSection
                    clientId={googleClientId}
                    status={googleStatus}
                    buttonRef={googleBtnRef}
                    onRetry={handleRetryGoogle}
                  />

                  <TkvButton variant="primary" size="lg" fullWidth onClick={handleRetryGoogle}>
                    Thử lại
                  </TkvButton>
                  <TkvButton variant="secondary" size="md" fullWidth onClick={() => switchMode('login')}>
                    Dùng email và mật khẩu
                  </TkvButton>
                </div>
              )}

              {/* A04 — Tạo tài khoản mới */}
              {activeMode === 'register' && (
                <div className="relative space-y-5">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Tạo tài khoản mới
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Lưu lại dữ liệu và trải nghiệm cá nhân của bạn.
                    </p>
                  </div>

                  <form onSubmit={handleRegister} className="space-y-4" noValidate>
                    <TkvTextField
                      label="Tên hiển thị"
                      type="text"
                      autoComplete="name"
                      iconLeft="profile"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Bếp nhà Minh"
                    />
                    <TkvTextField
                      label="Địa chỉ email"
                      type="email"
                      autoComplete="email"
                      iconLeft="mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                    />
                    <TkvTextField
                      label="Mật khẩu"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      iconLeft="lock"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••"
                      hint="Tối thiểu 8 ký tự · Có thể hiện/ẩn mật khẩu"
                      required
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          className="tkv-focusable w-9 h-9 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted)]"
                        >
                          <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                        </button>
                      }
                    />

                    {turnstileSiteKey && (
                      <div className="pt-1">
                        <TurnstileWidget
                          key={turnstileGen}
                          siteKey={turnstileSiteKey}
                          onToken={setTurnstileToken}
                        />
                      </div>
                    )}

                    <TkvButton type="submit" variant="primary" size="lg" fullWidth isLoading={isLoading}>
                      Tạo tài khoản
                    </TkvButton>
                  </form>
                </div>
              )}

              {/* A05 — Xác minh OTP */}
              {activeMode === 'verify' && (
                <div className="relative space-y-5">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Xác minh OTP
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      {email
                        ? `Mã sáu chữ số được gửi đến địa chỉ ${email}.`
                        : 'Nhập địa chỉ email và mã xác thực 6 chữ số của bạn.'}
                    </p>
                  </div>

                  {!initialVerify && !email && (
                    <TkvTextField
                      label="Địa chỉ email đang xác minh"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  )}

                  {devOtpHint && (
                    <TkvBadge tone="warning" icon="sparkles">
                      Mã thử nghiệm nội bộ (dev): {devOtpHint}
                    </TkvBadge>
                  )}

                  <form onSubmit={(e) => void handleVerifyOtp(e, true)} className="space-y-5">
                    <SixDigitOtpInput digits={otpDigits} onChange={setOtpDigits} disabled={isLoading} />

                    <div className="flex items-center justify-between text-xs font-bold">
                      <button
                        type="button"
                        disabled={resendSeconds > 0 || isLoading || !email.trim()}
                        onClick={() => void handleResendOtp()}
                        className="tkv-focusable text-[var(--tkv-primary)] disabled:text-[var(--tkv-ink-muted)] hover:underline py-1"
                      >
                        {resendSeconds > 0
                          ? `Gửi lại mã · 00:${String(resendSeconds).padStart(2, '0')}`
                          : 'Gửi lại mã xác thực'}
                      </button>
                    </div>

                    <TkvButton type="submit" variant="primary" size="lg" fullWidth isLoading={isLoading}>
                      Xác nhận mã
                    </TkvButton>
                  </form>
                </div>
              )}

              {/* A06 — Quên mật khẩu */}
              {activeMode === 'forgot' && (
                <div className="relative space-y-5">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Quên mật khẩu
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Nhập email để nhận mã khôi phục tài khoản.
                    </p>
                  </div>

                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <TkvTextField
                      label="Địa chỉ email"
                      type="email"
                      autoComplete="email"
                      iconLeft="mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                    />
                    <TkvButton type="submit" variant="primary" size="lg" fullWidth isLoading={isLoading}>
                      Gửi mã xác thực
                    </TkvButton>
                  </form>
                </div>
              )}

              {/* A07 — Đặt lại mật khẩu */}
              {activeMode === 'reset' && (
                <div className="relative space-y-5">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Đặt lại mật khẩu
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Chọn mật khẩu mới để tiếp tục sử dụng.
                    </p>
                  </div>

                  {devOtpHint && (
                    <TkvBadge tone="warning" icon="sparkles">
                      Mã khôi phục thử nghiệm (dev): {devOtpHint}
                    </TkvBadge>
                  )}

                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <TkvTextField
                      label="Địa chỉ email"
                      type="email"
                      iconLeft="mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                    />
                    <SixDigitOtpInput digits={otpDigits} onChange={setOtpDigits} disabled={isLoading} />
                    <TkvTextField
                      label="Mật khẩu mới"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      iconLeft="lock"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••"
                      hint="Tối thiểu 8 ký tự · Có thể hiện/ẩn mật khẩu"
                      required
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          className="tkv-focusable w-9 h-9 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted)]"
                        >
                          <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                        </button>
                      }
                    />
                    <TkvButton type="submit" variant="primary" size="lg" fullWidth isLoading={isLoading}>
                      Đặt lại mật khẩu
                    </TkvButton>
                  </form>
                </div>
              )}

              {/* A08 — Chuyển dữ liệu khách (DEC-012 Honest Refusal) */}
              {activeMode === 'transfer-deferred' && (
                <div className="relative space-y-5" role="alert">
                  <div className="space-y-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.75rem] font-extrabold text-[var(--tkv-ink)]">
                      Chuyển dữ liệu khách
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-secondary)]">
                      Giữ quyền kiểm soát khi chuyển từ dùng thử sang tài khoản.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--tkv-surface-saffron)] border border-[var(--tkv-warning)]/35 text-sm text-[var(--tkv-ink)] leading-relaxed">
                    Không thể tiếp tục tự động gộp dữ liệu do phiên khách cần được xác nhận hoặc tài khoản đích đã có hộ gia đình riêng. <strong>Dữ liệu khách chưa được chuyển.</strong>
                  </div>

                  <div className="space-y-2.5">
                    {otpDigits.join('').length === 6 ? (
                      <TkvButton
                        variant="primary"
                        size="lg"
                        fullWidth
                        isLoading={isLoading}
                        onClick={(e) => void handleVerifyOtp(e as unknown as React.FormEvent, false)}
                      >
                        Tiếp tục vào tài khoản (không gộp dữ liệu khách)
                      </TkvButton>
                    ) : (
                      <TkvButton
                        variant="primary"
                        size="lg"
                        fullWidth
                        onClick={() => switchMode('login')}
                      >
                        Xem các lựa chọn đăng nhập
                      </TkvButton>
                    )}
                    <TkvButton
                      variant="secondary"
                      size="lg"
                      fullWidth
                      onClick={() => navigate(vnextHref('/'))}
                    >
                      Quay về tài khoản khách hiện tại
                    </TkvButton>
                  </div>
                </div>
              )}

              {/* Bottom Navigation Links matching A01..A08 wireframes */}
              <div className="pt-2 border-t border-[var(--tkv-border)] flex items-center justify-between gap-2 text-xs sm:text-sm">
                <Link
                  to={activeMode === 'login' ? vnextHref('/auth?mode=choose') : vnextHref('/landing')}
                  className="tkv-focusable min-h-[40px] inline-flex items-center gap-1 font-semibold text-[var(--tkv-primary)] hover:underline"
                >
                  <VNextIcon name="arrow-left" size={15} />
                  <span>Quay lại</span>
                </Link>

                <div className="flex items-center gap-3">
                  {activeMode === 'login' ? (
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="tkv-focusable min-h-[40px] font-extrabold text-[var(--tkv-primary)] hover:underline"
                    >
                      Tạo tài khoản mới
                    </button>
                  ) : activeMode !== 'choose' ? (
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="tkv-focusable min-h-[40px] font-extrabold text-[var(--tkv-primary)] hover:underline"
                    >
                      Đăng nhập
                    </button>
                  ) : null}
                  <Link
                    to="/faq"
                    className="tkv-focusable min-h-[40px] inline-flex items-center font-semibold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-primary)]"
                  >
                    Trợ giúp
                  </Link>
                </div>
              </div>
            </TkvSurface>
          </div>

          {/* Desktop Editorial Assurance Panel */}
          <div className="hidden lg:block lg:col-span-6">
            <TkvSurface tone="mint" className="p-8 space-y-5">
              <div className="flex items-center gap-4">
                <MascotIllustration pose="guide" size={96} className="border-4 border-white shadow-sm shrink-0" />
                <div className="space-y-1">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-primary)]">
                    Takolio Kitchen Studio
                  </span>
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
            </TkvSurface>
          </div>
        </div>
      </main>
    </div>
  );
};
