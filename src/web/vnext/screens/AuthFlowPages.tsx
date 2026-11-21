import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { isInventoryTransferDeferred } from '../../services/auth';
import { isOffline } from '../../services/http';
import { capturePrivateSession } from '../../lib/private-session';
import { apiErrorMessage, otpPresentation } from '../../features/auth/auth-shared';
import { GoogleAuthSection } from '../../features/auth/GoogleAuthSection';
import {
  clearVerifyContext,
  readVerifyContext,
  resendSecondsRemaining,
  writeVerifyContext,
} from '../../features/auth/verify-context';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';
import { vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { BrandLockup } from '../components/VNextMedia';
import { TkvSurface, TkvTextField } from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';
import { InteractiveTakoChefSvg } from '../interactive-svg/InteractiveTakoChefSvg';

export type VNextAuthMode =
  | 'welcome'
  | 'login'
  | 'register'
  | 'verify'
  | 'forgot'
  | 'reset'
  | 'transfer-deferred';

function resolveAuthMode(pathname: string, params: URLSearchParams): VNextAuthMode {
  if (pathname === '/auth/verify') return 'verify';
  const mode = params.get('mode');
  if (
    mode === 'welcome' ||
    mode === 'register' ||
    mode === 'forgot' ||
    mode === 'reset' ||
    mode === 'transfer-deferred'
  ) {
    return mode;
  }
  // Unified entry: /auth, ?mode=login, ?mode=choose, ?mode=google all land cleanly on the unified Login/Register card.
  return 'login';
}

const SCREEN_IDS: Record<VNextAuthMode, string> = {
  welcome: 'A01',
  login: 'A02',
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
      <p className="text-sm font-extrabold text-[var(--tkv-ink,#2C221E)]">Mã xác thực 6 chữ số</p>
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
            className="tkv-focusable h-13 sm:h-14 w-full rounded-xl border border-[var(--tkv-border-strong,#D5C3B3)] focus:border-[var(--tkv-primary,#D86A43)] bg-white text-center font-mono tabular-nums text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#2C221E)] transition-colors"
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Sunlit Ceramic & Terracotta Herb Authentication Flow (`A01–A08`).
 * - `?mode=welcome` (`A01`): Clean entry gateway with Google 1-click, Login, Register, and Guest Trial.
 * - `/auth` & `?mode=login` / `?mode=register` (`A02`/`A04`): Unified 2-tab switcher + live Google GSI + `/landing` exit.
 * - `/auth/verify` (`A05`): 6-digit tabular-nums OTP input + refresh recovery + `DEC-012` transfer refusal (`A08`).
 */
export const VNextAuthFlow: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const urlMode = resolveAuthMode(pathname, searchParams);
  const [transferDeferred, setTransferDeferred] = useState(false);
  const activeMode: VNextAuthMode = transferDeferred ? 'transfer-deferred' : urlMode;
  const isPrimaryAuthTab = activeMode === 'login' || activeMode === 'register';
  const mountsGoogleGsi = isPrimaryAuthTab || activeMode === 'welcome';
  const screenId = SCREEN_IDS[activeMode];

  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : vnextHref('/');

  const setAuthSession = useAuthStore((s) => s.setAuthSession);
  const setGuestSession = useAuthStore((s) => s.setGuestSession);
  const hasActiveGuestSession = useAuthStore((s) => Boolean(s.isGuest && s.userId && s.householdId));

  const initialVerify = pathname === '/auth/verify' ? readVerifyContext() : null;
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => initialVerify?.email ?? searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [activationPassword, setActivationPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);
  const [resendSeconds, setResendSeconds] = useState(() => resendSecondsRemaining(initialVerify));
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingGuest, setIsStartingGuest] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileGen, setTurnstileGen] = useState(0);

  const [googleClientId, setGoogleClientId] = useState<string | null | undefined>(undefined);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('loading');
  const [googleRetry, setGoogleRetry] = useState(0);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const autoGuestHandoffRef = useRef(false);

  useVNextSeo({
    title:
      activeMode === 'welcome'
        ? 'Chào mừng đến Takolio'
        : activeMode === 'register'
          ? 'Tạo tài khoản mới'
          : activeMode === 'verify'
            ? 'Xác minh OTP'
            : activeMode === 'forgot'
              ? 'Quên mật khẩu'
              : activeMode === 'reset'
                ? 'Đặt lại mật khẩu'
                : activeMode === 'transfer-deferred'
                  ? 'Chuyển dữ liệu khách'
                  : 'Đăng nhập tài khoản',
    description: 'Đăng nhập hoặc tạo tài khoản Takolio nhanh chóng bằng Google hoặc email.',
    canonicalPath: pathname === '/auth/verify' ? '/auth/verify' : '/auth',
    domainSurface: 'app',
    noindex: true,
  });

  // 1st-party cross-domain guest handoff from `https://takolio.com` -> `https://takolio.app/auth?mode=guest`
  useEffect(() => {
    if (searchParams.get('mode') !== 'guest' || autoGuestHandoffRef.current) return;
    if (hasActiveGuestSession) {
      autoGuestHandoffRef.current = true;
      navigate(vnextHref('/onboarding/welcome'), { replace: true });
      return;
    }
    autoGuestHandoffRef.current = true;
    setIsStartingGuest(true);
    setErrorMessage(null);
    setGuestSession()
      .then(() => {
        navigate(vnextHref('/onboarding/welcome'), { replace: true });
      })
      .catch((err) => {
        setErrorMessage(
          apiErrorMessage(
            err,
            'Chưa thể khởi tạo phiên dùng thử tự động. Bạn có thể bấm Dùng thử ngay bên dưới hoặc đăng ký tài khoản.',
          ),
        );
      })
      .finally(() => {
        setIsStartingGuest(false);
      });
  }, [searchParams, hasActiveGuestSession, navigate, setGuestSession]);

  // Fetch public Turnstile + Google Client ID configuration once (or on explicit retry).
  useEffect(() => {
    let active = true;
    api
      .getPublicConfig()
      .then((cfg) => {
        if (!active) return;
        setTurnstileSiteKey(cfg.turnstileSiteKey || null);
        setGoogleClientId(cfg.googleClientId || null);
      })
      .catch(() => {
        if (!active) return;
        setTurnstileSiteKey(null);
        setGoogleClientId(null);
      });
    return () => {
      active = false;
    };
  }, [googleRetry]);

  // Mount & render real Google Identity Services button on Welcome, Login, and Register views.
  useEffect(() => {
    if (!mountsGoogleGsi) {
      setGoogleStatus('idle');
      return;
    }
    if (googleClientId === undefined) {
      setGoogleStatus('loading');
      return;
    }
    if (!googleClientId) {
      setGoogleStatus('unavailable');
      return;
    }

    let active = true;
    let timer: number | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let renderGoogleButton: (() => void) | undefined;
    let attempts = 0;

    const handleGoogleResponse = async (response: { credential?: string }) => {
      if (!active) return;
      if (typeof response?.credential !== 'string' || response.credential.length === 0) {
        setErrorMessage('Google không trả về thông tin xác thực hợp lệ. Vui lòng thử lại hoặc dùng email.');
        return;
      }
      const isCurrent = capturePrivateSession();
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const res = await api.loginWithGoogle(response.credential);
        if (!active || !isCurrent()) return;
        if (res.success && res.user) {
          setAuthSession({
            id: res.user.id,
            email: res.user.email,
            displayName: res.user.displayName,
            avatarUrl: res.user.avatarUrl,
            householdId: res.user.householdId,
            onboardingCompleted: res.user.onboardingCompleted,
          });
          navigate(res.user.onboardingCompleted ? returnTo : vnextHref('/onboarding'), {
            replace: true,
          });
        } else {
          setErrorMessage('Không thể xác thực tài khoản Google lúc này.');
        }
      } catch (err) {
        if (!active || !isCurrent()) return;
        setErrorMessage(apiErrorMessage(err, 'Đăng nhập Google chưa thành công. Vui lòng thử lại hoặc dùng email.'));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    const initializeGoogle = () => {
      if (!active) return;
      const googleId = window.google?.accounts?.id;
      if (!googleId) {
        attempts += 1;
        if (attempts < 40) {
          timer = window.setTimeout(initializeGoogle, 200);
          return;
        }
        setGoogleStatus('unavailable');
        return;
      }
      try {
        googleId.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        const googleHost = googleBtnRef.current;
        if (googleHost && active) {
          let renderedKey = '';
          const buttonText = activeMode === 'register' ? 'signup_with' : 'signin_with';
          renderGoogleButton = () => {
            if (!active) return;
            const parentWidth = Math.floor(
              googleHost.parentElement?.getBoundingClientRect().width ||
                googleHost.getBoundingClientRect().width ||
                340,
            );
            const buttonWidth = Math.min(400, Math.max(220, parentWidth));
            const nextKey = `${buttonText}:${buttonWidth}`;
            if (nextKey === renderedKey) return;
            googleHost.replaceChildren();
            googleId.renderButton(googleHost, {
              theme: 'outline',
              size: 'large',
              width: buttonWidth,
              text: buttonText,
              shape: 'pill',
              locale: 'vi',
            });
            renderedKey = nextKey;
          };
          setGoogleStatus('ready');
          renderGoogleButton();
          if (typeof ResizeObserver !== 'undefined' && googleHost.parentElement) {
            resizeObserver = new ResizeObserver(renderGoogleButton);
            resizeObserver.observe(googleHost.parentElement);
          }
          window.addEventListener('resize', renderGoogleButton);
        }
      } catch {
        setGoogleStatus('unavailable');
      }
    };

    setGoogleStatus('loading');
    initializeGoogle();

    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      resizeObserver?.disconnect();
      if (renderGoogleButton) window.removeEventListener('resize', renderGoogleButton);
    };
  }, [activeMode, mountsGoogleGsi, googleClientId, googleRetry, navigate, returnTo, setAuthSession]);

  useEffect(() => {
    if (pathname === '/auth/verify') {
      const ctx = readVerifyContext();
      if (ctx) {
        setEmail(ctx.email);
        setResendSeconds(resendSecondsRemaining(ctx));
        if (ctx.delivered === false && resendSecondsRemaining(ctx) === 0) {
          setErrorMessage((cur) => cur ?? 'Email OTP chưa gửi được. Hãy bấm Gửi lại mã xác thực.');
        }
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

  const switchMode = (
    nextMode: VNextAuthMode,
    options?: { extraQuery?: string; replace?: boolean },
  ) => {
    setErrorMessage(null);
    setInfoMessage(null);
    setTransferDeferred(false);
    const rt = requestedReturnTo ? `&returnTo=${encodeURIComponent(requestedReturnTo)}` : '';
    const extra = options?.extraQuery ?? '';
    if (nextMode === 'verify') {
      navigate(vnextHref(`/auth/verify${rt ? `?${rt.slice(1)}` : ''}`), {
        replace: options?.replace ?? false,
      });
      return;
    }
    // Tab switches replace history so Browser Back always exits /auth cleanly in 1 click.
    navigate(vnextHref(`/auth?mode=${nextMode}${rt}${extra}`), {
      replace: options?.replace ?? true,
    });
  };

  const enterRegisterVerification = (
    targetEmail: string,
    metadata: unknown,
    verifierPassword?: string,
  ) => {
    if (verifierPassword !== undefined) {
      setActivationPassword(verifierPassword);
    }
    const presentation = otpPresentation(metadata);
    const ctx = writeVerifyContext({
      email: targetEmail,
      resendAvailableAt: presentation.cooldown ? Date.now() + presentation.cooldown * 1000 : 0,
      expiresAt: presentation.expiresAt,
      delivered: presentation.delivered,
    });
    setResendSeconds(resendSecondsRemaining(ctx));
    setOtpDigits(['', '', '', '', '', '']);
    setTransferDeferred(false);
    const rt = requestedReturnTo ? `?returnTo=${encodeURIComponent(requestedReturnTo)}` : '';
    navigate(vnextHref(`/auth/verify${rt}`));
  };

  const handleRetryGoogle = useCallback(() => {
    setGoogleClientId(undefined);
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
    setIsStartingGuest(true);
    try {
      await setGuestSession();
      navigate(vnextHref('/onboarding/welcome'));
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Không thể khởi tạo phiên dùng thử ngay lúc này.'));
    } finally {
      setIsStartingGuest(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ địa chỉ email và mật khẩu.');
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    setIsLoading(true);
    try {
      const response = await api.login(cleanEmail, password);
      if (!isCurrent()) return;
      if (response.requireOtp) {
        if (typeof response.devOtp === 'string') setDevOtpHint(response.devOtp);
        enterRegisterVerification(cleanEmail, response, password);
        setInfoMessage('Tài khoản đang chờ xác minh email. Vui lòng nhập mã OTP 6 chữ số để hoàn tất.');
        return;
      }
      setAuthSession({
        id: response.user.id,
        email: response.user.email,
        displayName: response.user.displayName,
        avatarUrl: response.user.avatarUrl,
        householdId: response.user.householdId,
        onboardingCompleted: response.user.onboardingCompleted,
      });
      navigate(response.user.onboardingCompleted ? returnTo : vnextHref('/onboarding'), {
        replace: true,
      });
    } catch (err: unknown) {
      if (!isCurrent()) return;
      if (isInventoryTransferDeferred(err)) {
        setTransferDeferred(true);
        return;
      }
      const errObj = err as { payload?: Record<string, unknown> };
      if (errObj?.payload?.requireOtp === true) {
        if (typeof errObj.payload.devOtp === 'string') setDevOtpHint(errObj.payload.devOtp);
        enterRegisterVerification(cleanEmail, errObj.payload, password);
        if (errObj.payload.otpDelivered === true) {
          setInfoMessage('Mã OTP mới đã được gửi tới hộp thư của bạn.');
        } else {
          setErrorMessage('Tài khoản chưa xác minh email. Hãy kiểm tra hộp thư hoặc bấm Gửi lại mã.');
        }
        return;
      }
      setErrorMessage(apiErrorMessage(err, 'Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || password.length < 6) {
      setErrorMessage('Vui lòng nhập địa chỉ email hợp lệ và mật khẩu tối thiểu 6 ký tự.');
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setErrorMessage('Vui lòng hoàn tất bước xác minh bảo mật ngay bên dưới trước khi tiếp tục.');
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    const display = name.trim() || cleanEmail.split('@')[0] || 'Thành viên Takolio';
    const submittedPassword = password;
    setIsLoading(true);
    try {
      const res = await api.register(display, cleanEmail, submittedPassword, turnstileToken);
      if (!isCurrent()) return;
      setDevOtpHint(res.devOtp ?? null);
      enterRegisterVerification(cleanEmail, res, submittedPassword);
      setInfoMessage(res.message || `Đã gửi mã xác thực 6 số tới ${cleanEmail}.`);
    } catch (err: unknown) {
      if (!isCurrent()) return;
      const errCode = (err as { code?: string; payload?: Record<string, unknown> })?.code;
      const errPayload = (err as { payload?: Record<string, unknown> })?.payload;
      if (errCode === 'OTP_DELIVERY_UNAVAILABLE' || errCode === 'OTP_DELIVERY_UNKNOWN') {
        enterRegisterVerification(cleanEmail, { ...errPayload, otpDelivered: false }, submittedPassword);
        setErrorMessage(
          errCode === 'OTP_DELIVERY_UNKNOWN'
            ? 'Tài khoản đã tạo nhưng máy chủ chưa xác nhận gửi email. Vui lòng kiểm tra hộp thư trước khi gửi lại mã.'
            : 'Tài khoản đã lưu nhưng email OTP chưa gửi được. Hãy bấm Gửi lại mã xác thực.',
        );
        return;
      }
      setErrorMessage(apiErrorMessage(err, 'Không thể tạo tài khoản. Email này có thể đã được đăng ký.'));
    } finally {
      if (isCurrent()) {
        setTurnstileGen((g) => g + 1);
        setTurnstileToken(null);
        setIsLoading(false);
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent, allowMigrate = true) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim();
    const code = otpDigits.join('');
    const effectivePassword = activationPassword || password;
    if (!cleanEmail || code.length !== 6) {
      setErrorMessage('Vui lòng nhập đủ mã OTP 6 chữ số được gửi tới email của bạn.');
      return;
    }
    if (effectivePassword.length < 6 || effectivePassword.length > 100) {
      setErrorMessage('Vui lòng nhập mật khẩu (tối thiểu 6 ký tự) để hoàn tất kích hoạt tài khoản.');
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    setIsLoading(true);
    try {
      const authState = useAuthStore.getState();
      const guestHouseholdToMigrate =
        allowMigrate && authState.isGuest && authState.householdId.startsWith('hh_guest_')
          ? authState.householdId
          : null;
      const res = await api.verifyOtp(
        cleanEmail,
        code,
        'register',
        guestHouseholdToMigrate,
        effectivePassword,
      );
      if (!isCurrent()) return;
      if (!res.success) {
        setErrorMessage('Yêu cầu đang được xử lý. Vui lòng thử lại với cùng mã OTP.');
        return;
      }
      clearVerifyContext();
      if (!res.user?.id || !res.user?.householdId) {
        setInfoMessage('Xác thực thành công! Mời bạn đăng nhập vào tài khoản.');
        switchMode('login', { replace: true });
        return;
      }
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
      if (allowMigrate && isInventoryTransferDeferred(err)) {
        setTransferDeferred(true);
        return;
      }
      setErrorMessage(
        isOffline(err)
          ? 'Mất kết nối mạng. Mã OTP chưa được tiêu thụ — hãy kiểm tra mạng và thử lại.'
          : apiErrorMessage(err, 'Mã xác thực không đúng hoặc đã hết hạn.'),
      );
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const handleResendOtp = async (purpose: 'register' | 'forgot_password' = 'register') => {
    const cleanEmail = email.trim();
    if (resendSeconds > 0 || isLoading || !cleanEmail) return;
    setErrorMessage(null);
    setInfoMessage(null);
    if (!ensureOnline()) return;
    setIsLoading(true);
    try {
      const res = await api.resendOtp(cleanEmail, purpose);
      const presentation = otpPresentation(res);
      if (purpose === 'register') {
        const ctx = writeVerifyContext({
          email: cleanEmail,
          resendAvailableAt: presentation.cooldown ? Date.now() + presentation.cooldown * 1000 : 0,
          expiresAt: presentation.expiresAt,
          delivered: presentation.delivered,
        });
        setResendSeconds(resendSecondsRemaining(ctx));
      } else {
        setResendSeconds(presentation.cooldown || 60);
      }
      if (res.devOtp) setDevOtpHint(res.devOtp);
      setInfoMessage(res.message || 'Đã gửi lại mã xác thực mới tới hộp thư của bạn.');
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Chưa thể gửi lại mã OTP lúc này.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Vui lòng nhập địa chỉ email tài khoản cần khôi phục.');
      return;
    }
    if (!ensureOnline()) return;
    setIsLoading(true);
    try {
      const res = await api.forgotPassword(cleanEmail);
      if (res.devOtp) setDevOtpHint(res.devOtp);
      setOtpDigits(['', '', '', '', '', '']);
      setResendSeconds(otpPresentation(res).cooldown || 60);
      switchMode('reset', {
        extraQuery: `&email=${encodeURIComponent(cleanEmail)}`,
        replace: true,
      });
      setInfoMessage(res.message || `Đã gửi mã khôi phục 6 số tới ${cleanEmail}.`);
    } catch (err) {
      setErrorMessage(apiErrorMessage(err, 'Không thể gửi mã khôi phục lúc này. Vui lòng thử lại.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const cleanEmail = email.trim();
    const code = otpDigits.join('');
    if (!cleanEmail || code.length !== 6 || newPassword.length < 6) {
      setErrorMessage('Vui lòng nhập email, đủ 6 chữ số OTP và mật khẩu mới tối thiểu 6 ký tự.');
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    setIsLoading(true);
    try {
      const res = await api.resetPassword(cleanEmail, code, newPassword);
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
        navigate(res.user.onboardingCompleted ? returnTo : vnextHref('/onboarding'), {
          replace: true,
        });
        return;
      }
      setPassword(newPassword);
      setNewPassword('');
      setOtpDigits(['', '', '', '', '', '']);
      switchMode('login', { replace: true });
      setInfoMessage('Đã đặt lại mật khẩu thành công. Mời bạn đăng nhập bằng mật khẩu mới.');
    } catch (err) {
      if (!isCurrent()) return;
      setErrorMessage(apiErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại mã OTP.'));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const exitHref = hasActiveGuestSession ? vnextHref('/') : vnextHref('/landing');
  const exitLabel = hasActiveGuestSession ? 'Về căn bếp' : 'Trang giới thiệu';
  const needVerifyPasswordField = !activationPassword && !password;

  return (
    <div
      className="tkv-root min-h-dvh flex flex-col bg-[var(--tkv-bg,#FCF9F5)]"
      data-tkv-direction="a"
      data-tkv-screen={screenId}
    >
      <a href="#tkv-auth-main" className="tkv-skip-link">
        Đến biểu mẫu xác thực
      </a>

      <main
        id="tkv-auth-main"
        tabIndex={-1}
        className="flex-1 max-w-[1040px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Unified Sunlit Ceramic Auth Card */}
          <div className="lg:col-span-6 w-full max-w-[440px] mx-auto">
            <TkvSurface className="p-6 sm:p-8 relative overflow-hidden space-y-5 bg-white border-[var(--tkv-border,#EAE0D5)] shadow-soft">
              {/* Top Header: Brand Lockup + Deterministic 1-Click Exit */}
              <div className="relative flex items-center justify-between gap-3">
                <Link to={exitHref} className="tkv-focusable rounded-xl py-1">
                  <BrandLockup />
                </Link>

                {isPrimaryAuthTab || activeMode === 'welcome' ? (
                  <Link
                    to={exitHref}
                    className="tkv-focusable min-h-[38px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink-soft,#5F524A)] hover:bg-[var(--tkv-surface-muted,#F7EFE6)] hover:text-[var(--tkv-ink,#2C221E)] transition-colors"
                  >
                    <VNextIcon name="arrow-left" size={15} />
                    <span>{exitLabel}</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      switchMode(activeMode === 'verify' ? 'register' : 'login', { replace: true })
                    }
                    className="tkv-focusable min-h-[38px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink,#2C221E)] hover:bg-[var(--tkv-surface-muted,#F7EFE6)] transition-colors"
                  >
                    <VNextIcon name="arrow-left" size={15} />
                    <span>{activeMode === 'verify' ? 'Quay lại đăng ký' : 'Quay lại đăng nhập'}</span>
                  </button>
                )}
              </div>

              {/* 2-Tab Segmented Switcher (`Đăng nhập` | `Tạo tài khoản`) */}
              {isPrimaryAuthTab && (
                <div
                  role="tablist"
                  aria-label="Chuyển đổi Đăng nhập và Tạo tài khoản"
                  className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--tkv-surface-muted,#F7EFE6)] border border-[var(--tkv-border,#EAE0D5)]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMode === 'login'}
                    data-testid="auth-tab-login"
                    onClick={() => switchMode('login', { replace: true })}
                    className={clsx(
                      'tkv-focusable min-h-[42px] rounded-xl text-sm font-extrabold transition-colors',
                      activeMode === 'login'
                        ? 'bg-white text-[var(--tkv-ink,#2C221E)] shadow-xs border border-[var(--tkv-border,#EAE0D5)]'
                        : 'text-[var(--tkv-ink-soft,#5F524A)] hover:text-[var(--tkv-ink,#2C221E)]',
                    )}
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMode === 'register'}
                    data-testid="auth-tab-register"
                    onClick={() => switchMode('register', { replace: true })}
                    className={clsx(
                      'tkv-focusable min-h-[42px] rounded-xl text-sm font-extrabold transition-colors',
                      activeMode === 'register'
                        ? 'bg-white text-[var(--tkv-ink,#2C221E)] shadow-xs border border-[var(--tkv-border,#EAE0D5)]'
                        : 'text-[var(--tkv-ink-soft,#5F524A)] hover:text-[var(--tkv-ink,#2C221E)]',
                    )}
                  >
                    Tạo tài khoản
                  </button>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-accent-soft,#FDF0EA)] border border-[var(--tkv-accent-border,#F2D5C7)] text-sm font-semibold text-[var(--tkv-accent-ink,#9E4322)] flex items-start gap-2.5"
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#D86A43)] shrink-0 mt-1.5" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-sage-soft,#EEF5F0)] border border-[var(--tkv-sage-border,#CFE2D5)] text-sm font-semibold text-[var(--tkv-sage-ink,#355940)] flex items-start gap-2.5"
                >
                  <VNextIcon name="check" size={18} className="shrink-0 mt-0.5 text-[var(--tkv-sage,#4E7A5B)]" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* A01 — Entry Gateway (`?mode=welcome`) */}
              {activeMode === 'welcome' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider font-bold text-[var(--tkv-ink-muted,#87776E)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#D86A43)]" aria-hidden="true" />
                      <span>A01 · Cổng truy cập căn bếp</span>
                    </span>
                    <h1 className="tkv-heading text-2xl sm:text-[1.7rem] font-extrabold text-[var(--tkv-ink,#2C221E)]">
                      Chào mừng bạn đến Takolio
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)] leading-relaxed">
                      Tiếp tục bằng tài khoản Google, email đã đăng ký hoặc mở phiên dùng thử ngay lập tức.
                    </p>
                  </div>

                  <GoogleAuthSection
                    clientId={googleClientId}
                    status={googleStatus}
                    buttonRef={googleBtnRef}
                    onRetry={handleRetryGoogle}
                  />

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => switchMode('login', { replace: true })}
                      data-testid="a01-login-cta"
                      className="tkv-focusable w-full min-h-[48px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white text-sm font-bold shadow-xs transition-colors"
                    >
                      Đăng nhập bằng email
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register', { replace: true })}
                      data-testid="a01-register-cta"
                      className="tkv-focusable w-full min-h-[48px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border-strong,#D5C3B3)] hover:bg-[var(--tkv-surface-muted,#F7EFE6)] text-[var(--tkv-ink,#2C221E)] text-sm font-bold transition-colors"
                    >
                      Tạo tài khoản mới
                    </button>
                  </div>

                  {!hasActiveGuestSession && (
                    <div className="pt-2 border-t border-[var(--tkv-border,#EAE0D5)] text-center">
                      <button
                        type="button"
                        disabled={isStartingGuest || isLoading}
                        onClick={() => void handleGuestStart()}
                        className="tkv-focusable min-h-[38px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink-soft,#5F524A)] hover:text-[var(--tkv-accent-ink,#9E4322)] hover:underline"
                      >
                        <span>
                          {isStartingGuest
                            ? 'Đang mở phiên dùng thử…'
                            : 'Dùng thử ngay không cần đăng ký →'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Unified Login & Register Body: Google 1-Click on top + Email Form below */}
              {isPrimaryAuthTab && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#2C221E)]">
                      {activeMode === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                      {activeMode === 'login'
                        ? 'Vào nhanh bằng tài khoản Google hoặc địa chỉ email của bạn.'
                        : 'Đồng bộ tủ lạnh, thực đơn tuần và danh sách đi chợ cho gia đình.'}
                    </p>
                  </div>

                  {hasActiveGuestSession && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] text-xs font-bold text-[var(--tkv-honey-ink,#8C5B18)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#C68634)]" aria-hidden="true" />
                      <span>Đang dùng phiên khách · Xác thực để lưu dữ liệu lâu dài</span>
                    </span>
                  )}

                  {/* Real Google Identity Services Button */}
                  <GoogleAuthSection
                    clientId={googleClientId}
                    status={googleStatus}
                    buttonRef={googleBtnRef}
                    onRetry={handleRetryGoogle}
                  />

                  <div className="relative flex items-center py-0.5" aria-hidden="true">
                    <div className="flex-grow border-t border-[var(--tkv-border,#EAE0D5)]" />
                    <span className="shrink-0 mx-3 text-xs font-bold uppercase tracking-wider text-[var(--tkv-ink-muted,#87776E)]">
                      hoặc bằng email
                    </span>
                    <div className="flex-grow border-t border-[var(--tkv-border,#EAE0D5)]" />
                  </div>

                  {activeMode === 'login' ? (
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
                      <TkvTextField
                        label="Mật khẩu"
                        labelAction={
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="tkv-focusable text-xs font-bold text-[var(--tkv-accent-ink,#9E4322)] hover:text-[var(--tkv-primary,#D86A43)] hover:underline py-0.5"
                          >
                            Quên mật khẩu?
                          </button>
                        }
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        iconLeft="lock"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Nhập mật khẩu của bạn"
                        required
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            className="tkv-focusable w-9 h-9 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted,#87776E)] hover:text-[var(--tkv-ink,#2C221E)]"
                          >
                            <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                          </button>
                        }
                      />

                      <button
                        type="submit"
                        disabled={isLoading}
                        data-testid="a02-submit-btn"
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                      >
                        {isLoading ? 'Đang đăng nhập…' : 'Đăng nhập'}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-4" noValidate>
                      <TkvTextField
                        label="Tên hiển thị"
                        type="text"
                        autoComplete="name"
                        iconLeft="profile"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ví dụ: Bếp nhà Minh"
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
                        placeholder="Tối thiểu 6 ký tự"
                        required
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                            className="tkv-focusable w-9 h-9 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted,#87776E)] hover:text-[var(--tkv-ink,#2C221E)]"
                          >
                            <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                          </button>
                        }
                      />

                      {turnstileSiteKey && (
                        <div className="pt-0.5 flex justify-center">
                          <TurnstileWidget
                            key={turnstileGen}
                            siteKey={turnstileSiteKey}
                            onToken={setTurnstileToken}
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        data-testid="a04-submit-btn"
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                      >
                        {isLoading ? 'Đang gửi mã…' : 'Tạo tài khoản'}
                      </button>
                    </form>
                  )}

                  {!hasActiveGuestSession && (
                    <div className="pt-2 border-t border-[var(--tkv-border,#EAE0D5)] text-center">
                      <button
                        type="button"
                        disabled={isStartingGuest || isLoading}
                        onClick={() => void handleGuestStart()}
                        className="tkv-focusable min-h-[38px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink-soft,#5F524A)] hover:text-[var(--tkv-accent-ink,#9E4322)] hover:underline"
                      >
                        <span>{isStartingGuest ? 'Đang mở phiên dùng thử…' : 'Chưa cần tài khoản? Dùng thử ngay không cần đăng ký →'}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* A05 — Xác minh OTP (`/auth/verify`) */}
              {activeMode === 'verify' && (
                <div className="relative space-y-5">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#2C221E)]">
                      Xác minh OTP
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                      {email
                        ? `Nhập mã 6 chữ số đã gửi tới ${email} để kích hoạt tài khoản.`
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
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-surface-muted,#F7EFE6)] border border-[var(--tkv-border,#EAE0D5)] text-xs font-mono tabular-nums font-bold text-[var(--tkv-ink,#2C221E)]">
                      Mã thử nghiệm nội bộ (dev): {devOtpHint}
                    </span>
                  )}

                  <form onSubmit={(e) => void handleVerifyOtp(e, true)} className="space-y-4">
                    <SixDigitOtpInput digits={otpDigits} onChange={setOtpDigits} disabled={isLoading} />

                    {needVerifyPasswordField && (
                      <TkvTextField
                        label="Mật khẩu tài khoản"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        iconLeft="lock"
                        value={activationPassword}
                        onChange={(e) => setActivationPassword(e.target.value)}
                        placeholder="Nhập mật khẩu tối thiểu 6 ký tự"
                        hint="Trang vừa được tải lại — vui lòng nhập lại mật khẩu để hoàn tất."
                        required
                      />
                    )}

                    <div className="flex items-center justify-between text-xs font-bold">
                      <button
                        type="button"
                        disabled={resendSeconds > 0 || isLoading || !email.trim()}
                        onClick={() => void handleResendOtp('register')}
                        className="tkv-focusable font-mono tabular-nums text-[var(--tkv-accent-ink,#9E4322)] disabled:text-[var(--tkv-ink-muted,#87776E)] hover:underline py-1"
                      >
                        {resendSeconds > 0
                          ? `Gửi lại mã · 00:${String(resendSeconds).padStart(2, '0')}`
                          : 'Gửi lại mã xác thực'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isLoading ? 'Đang xác minh…' : 'Xác nhận & hoàn tất'}
                    </button>
                  </form>
                </div>
              )}

              {/* A06 — Quên mật khẩu */}
              {activeMode === 'forgot' && (
                <div className="relative space-y-5">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#2C221E)]">
                      Quên mật khẩu
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                      Nhập email đã đăng ký để nhận mã khôi phục 6 chữ số.
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
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isLoading ? 'Đang gửi…' : 'Gửi mã khôi phục'}
                    </button>
                  </form>
                </div>
              )}

              {/* A07 — Đặt lại mật khẩu */}
              {activeMode === 'reset' && (
                <div className="relative space-y-5">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#2C221E)]">
                      Đặt lại mật khẩu
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                      Nhập mã 6 chữ số trong hộp thư và chọn mật khẩu mới.
                    </p>
                  </div>

                  {devOtpHint && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-surface-muted,#F7EFE6)] border border-[var(--tkv-border,#EAE0D5)] text-xs font-mono tabular-nums font-bold text-[var(--tkv-ink,#2C221E)]">
                      Mã khôi phục thử nghiệm (dev): {devOtpHint}
                    </span>
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
                    <div className="flex justify-end text-xs font-bold">
                      <button
                        type="button"
                        disabled={resendSeconds > 0 || isLoading || !email.trim()}
                        onClick={() => void handleResendOtp('forgot_password')}
                        className="tkv-focusable font-mono tabular-nums text-[var(--tkv-accent-ink,#9E4322)] disabled:text-[var(--tkv-ink-muted,#87776E)] hover:underline py-0.5"
                      >
                        {resendSeconds > 0
                          ? `Gửi lại mã · 00:${String(resendSeconds).padStart(2, '0')}`
                          : 'Gửi lại mã khôi phục'}
                      </button>
                    </div>
                    <TkvTextField
                      label="Mật khẩu mới"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      iconLeft="lock"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tối thiểu 6 ký tự"
                      required
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                          className="tkv-focusable w-9 h-9 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted,#87776E)] hover:text-[var(--tkv-ink,#2C221E)]"
                        >
                          <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                        </button>
                      }
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isLoading ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
                    </button>
                  </form>
                </div>
              )}

              {/* A08 — Chuyển dữ liệu khách (DEC-012 Honest Refusal) */}
              {activeMode === 'transfer-deferred' && (
                <div className="relative space-y-5" role="alert">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#2C221E)]">
                      Chuyển dữ liệu khách
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                      Giữ quyền kiểm soát khi chuyển từ dùng thử sang tài khoản.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--tkv-honey-soft,#FCF5E6)] border border-[var(--tkv-honey-border,#EDD9B4)] text-sm text-[var(--tkv-honey-ink,#8C5B18)] leading-relaxed">
                    Không thể tự động gộp dữ liệu do phiên khách cần được xác nhận hoặc tài khoản đích đã có hộ gia đình riêng. <strong>Dữ liệu khách hiện tại vẫn giữ nguyên.</strong>
                  </div>

                  <div className="space-y-2.5">
                    {otpDigits.join('').length === 6 ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => void handleVerifyOtp(e as unknown as React.FormEvent, false)}
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-sm shadow-xs transition-colors disabled:opacity-60"
                      >
                        {isLoading ? 'Đang xử lý…' : 'Tiếp tục vào tài khoản (không gộp dữ liệu khách)'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchMode('login', { replace: true })}
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#D86A43)] hover:bg-[var(--tkv-primary-hover,#C25731)] text-white font-bold text-sm shadow-xs transition-colors"
                      >
                        Quay lại đăng nhập
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(vnextHref('/'))}
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border-strong,#D5C3B3)] text-[var(--tkv-ink,#2C221E)] font-bold text-sm transition-colors hover:bg-[var(--tkv-surface-muted,#F7EFE6)]"
                    >
                      Quay về phiên khách hiện tại
                    </button>
                  </div>
                </div>
              )}
            </TkvSurface>
          </div>

          {/* Desktop Sunlit Kitchen Companion Panel */}
          <div className="hidden lg:block lg:col-span-6">
            <div className="rounded-[24px] bg-gradient-to-br from-[var(--tkv-linen-from,#FFFDFB)] to-[var(--tkv-surface-muted,#F7EFE6)] border border-[var(--tkv-border,#EAE0D5)] p-8 space-y-5 shadow-soft">
              <div className="flex items-center gap-4">
                <InteractiveTakoChefSvg size={92} mood="happy" className="shrink-0" />
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted,#87776E)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#D86A43)]" aria-hidden="true" />
                    <span>KHÔNG GIAN BẾP GIA ĐÌNH</span>
                  </span>
                  <h2 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink,#2C221E)]">
                    Mỗi căn bếp là một không gian riêng tư
                  </h2>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-[var(--tkv-ink-soft,#5F524A)]">
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="shield" size={18} className="text-[var(--tkv-sage,#4E7A5B)] shrink-0 mt-0.5" />
                  <span>Tồn kho tủ lạnh, lịch sử quét và thực đơn được phân tách chặt chẽ theo mã hộ gia đình.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="check" size={18} className="text-[var(--tkv-sage,#4E7A5B)] shrink-0 mt-0.5" />
                  <span>Đăng nhập 1 chạm bằng Google hoặc email — tự động dọn sạch bộ nhớ đệm khi chuyển tài khoản.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="sparkles" size={18} className="text-[var(--tkv-primary,#D86A43)] shrink-0 mt-0.5" />
                  <span>Mọi kết quả nhận diện AI đều qua bước duyệt thủ công của bạn trước khi cập nhật tủ lạnh.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
