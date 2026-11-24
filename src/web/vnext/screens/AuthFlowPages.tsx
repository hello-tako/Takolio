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
import { normalizeLocale, type SupportedLocale } from '../../../shared/locales';
import {
  containsVietnameseDiacritics,
  lSync,
  translateEnForLocale,
  useLocaleText,
} from '../../i18n/app-i18n';
import { vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { detectRuntimeDomainRole, resolveSatelliteSurfaceHref } from '../lib/domain-surface';
import { BrandLockup, MascotIllustration } from '../components/VNextMedia';
import { TkvSurface, TkvTextField } from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';

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
  locale?: SupportedLocale;
}> = ({ digits, onChange, disabled = false, locale }) => {
  const { locale: ctxLocale } = useLocaleText();
  const activeLocale = locale ?? ctxLocale;
  const l = (vi: string, en: string) => lSync(vi, en, activeLocale);
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
      <p className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)]">
        {l('Mã xác thực 6 chữ số', '6-digit verification code')}
      </p>
      <div
        className="grid grid-cols-6 gap-1.5 sm:gap-2.5"
        role="group"
        aria-label={l('Nhập mã OTP 6 chữ số', 'Enter 6-digit OTP code')}
      >
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
            aria-label={l(`Chữ số OTP thứ ${idx + 1}`, `OTP digit ${idx + 1}`)}
            value={digits[idx] ?? ''}
            onChange={(e) => handleDigitChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            className="tkv-focusable h-12 sm:h-14 w-full min-w-0 rounded-xl border border-[var(--tkv-border-strong)] focus:border-[var(--tkv-primary)] bg-white text-center font-mono tabular-nums text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)] transition-colors"
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
  const { locale: ctxLocale, setLocale, l: ctxL } = useLocaleText();
  const queryLang = searchParams.get('lang');
  const effectiveLocale: SupportedLocale = queryLang ? normalizeLocale(queryLang, ctxLocale) : ctxLocale;
  const isVi = effectiveLocale === 'vi';
  const l = useCallback(
    (vi: string, en: string) =>
      effectiveLocale === ctxLocale ? ctxL(vi, en) : lSync(vi, en, effectiveLocale),
    [ctxL, ctxLocale, effectiveLocale],
  );

  useEffect(() => {
    if (!queryLang) return;
    const normalized = normalizeLocale(queryLang, ctxLocale);
    if (normalized !== ctxLocale) {
      setLocale(normalized);
    }
  }, [queryLang, ctxLocale, setLocale]);

  const localizeAuthError = useCallback(
    (err: unknown, viFallback: string, enFallback: string) => {
      const translatedFallback = isVi ? viFallback : translateEnForLocale(enFallback, effectiveLocale);
      const raw = apiErrorMessage(err, translatedFallback);
      if (isVi) return raw;
      if (!raw || containsVietnameseDiacritics(raw) || raw.startsWith('HTTP ')) {
        return translatedFallback;
      }
      return translateEnForLocale(raw, effectiveLocale);
    },
    [isVi, effectiveLocale, ctxL],
  );

  const localizeServerInfo = useCallback(
    (msg: string | undefined, viFallback: string, enFallback: string) => {
      if (isVi) return msg || viFallback;
      if (msg && !containsVietnameseDiacritics(msg)) {
        return translateEnForLocale(msg, effectiveLocale);
      }
      return translateEnForLocale(enFallback, effectiveLocale);
    },
    [isVi, effectiveLocale, ctxL],
  );

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
        ? l('Chào mừng đến Takolio', 'Welcome to Takolio')
        : activeMode === 'register'
          ? l('Tạo tài khoản mới', 'Create an account')
          : activeMode === 'verify'
            ? l('Xác minh OTP', 'Verify OTP')
            : activeMode === 'forgot'
              ? l('Quên mật khẩu', 'Forgot password')
              : activeMode === 'reset'
                ? l('Đặt lại mật khẩu', 'Reset password')
                : activeMode === 'transfer-deferred'
                  ? l('Chuyển dữ liệu khách', 'Transfer guest data')
                  : l('Đăng nhập tài khoản', 'Sign in'),
    description: l(
      'Đăng nhập hoặc tạo tài khoản Takolio nhanh chóng bằng Google hoặc email.',
      'Sign in or create a Takolio account quickly with Google or email.',
    ),
    canonicalPath: pathname === '/auth/verify' ? '/auth/verify' : '/auth',
    domainSurface: 'app',
    lang: effectiveLocale,
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
          localizeAuthError(
            err,
            'Chưa thể khởi tạo phiên dùng thử tự động. Bạn có thể bấm Dùng thử ngay bên dưới hoặc đăng ký tài khoản.',
            'Could not start a guest trial automatically. You can tap Try as guest below or create an account.',
          ),
        );
      })
      .finally(() => {
        setIsStartingGuest(false);
      });
  }, [searchParams, hasActiveGuestSession, navigate, setGuestSession, localizeAuthError]);

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
        setErrorMessage(
          l(
            'Google không trả về thông tin xác thực hợp lệ. Vui lòng thử lại hoặc dùng email.',
            'Google did not return valid credentials. Please try again or continue with email.',
          ),
        );
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
          setErrorMessage(
            l(
              'Không thể xác thực tài khoản Google lúc này.',
              'Unable to verify your Google account right now.',
            ),
          );
        }
      } catch (err) {
        if (!active || !isCurrent()) return;
        setErrorMessage(
          localizeAuthError(
            err,
            'Đăng nhập Google chưa thành công. Vui lòng thử lại hoặc dùng email.',
            'Google Sign-In failed. Please try again or continue with email.',
          ),
        );
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
            const nextKey = `${buttonText}:${buttonWidth}:${effectiveLocale}`;
            if (nextKey === renderedKey) return;
            googleHost.replaceChildren();
            googleId.renderButton(googleHost, {
              theme: 'outline',
              size: 'large',
              width: buttonWidth,
              text: buttonText,
              shape: 'pill',
              locale: effectiveLocale,
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
  }, [activeMode, mountsGoogleGsi, googleClientId, googleRetry, navigate, returnTo, setAuthSession, effectiveLocale, l, localizeAuthError]);

  useEffect(() => {
    if (pathname === '/auth/verify') {
      const ctx = readVerifyContext();
      if (ctx) {
        setEmail(ctx.email);
        setResendSeconds(resendSecondsRemaining(ctx));
        if (ctx.delivered === false && resendSecondsRemaining(ctx) === 0) {
          setErrorMessage(
            (cur) =>
              cur ??
              l(
                'Email OTP chưa gửi được. Hãy bấm Gửi lại mã xác thực.',
                'The verification email could not be sent. Please tap Resend verification code.',
              ),
          );
        }
      }
    }
  }, [pathname, l]);

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
    const lp = queryLang ? `&lang=${encodeURIComponent(queryLang)}` : '';
    const extra = options?.extraQuery ?? '';
    if (nextMode === 'verify') {
      const verifyQuery = `${rt}${lp}`;
      navigate(vnextHref(`/auth/verify${verifyQuery ? `?${verifyQuery.slice(1)}` : ''}`), {
        replace: options?.replace ?? false,
      });
      return;
    }
    // Tab switches replace history so Browser Back always exits /auth cleanly in 1 click.
    navigate(vnextHref(`/auth?mode=${nextMode}${rt}${lp}${extra}`), {
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
    const rt = requestedReturnTo ? `&returnTo=${encodeURIComponent(requestedReturnTo)}` : '';
    const lp = queryLang ? `&lang=${encodeURIComponent(queryLang)}` : '';
    const verifyQuery = `${rt}${lp}`;
    navigate(vnextHref(`/auth/verify${verifyQuery ? `?${verifyQuery.slice(1)}` : ''}`));
  };

  const handleRetryGoogle = useCallback(() => {
    setGoogleClientId(undefined);
    setGoogleStatus('loading');
    setGoogleRetry((n) => n + 1);
  }, []);

  const ensureOnline = (): boolean => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErrorMessage(
        l(
          'Thiết bị đang ngoại tuyến. Vui lòng kiểm tra kết nối mạng để tiếp tục.',
          'You are offline. Please check your internet connection to continue.',
        ),
      );
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
      setErrorMessage(
        localizeAuthError(
          err,
          'Không thể khởi tạo phiên dùng thử ngay lúc này.',
          'Unable to start a guest session right now.',
        ),
      );
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
      setErrorMessage(
        l(
          'Vui lòng nhập đầy đủ địa chỉ email và mật khẩu.',
          'Please enter both your email address and password.',
        ),
      );
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
        setInfoMessage(
          l(
            'Tài khoản đang chờ xác minh email. Vui lòng nhập mã OTP 6 chữ số để hoàn tất.',
            'Your account is awaiting email verification. Please enter the 6-digit OTP code to continue.',
          ),
        );
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
          setInfoMessage(
            l('Mã OTP mới đã được gửi tới hộp thư của bạn.', 'A new OTP code has been sent to your inbox.'),
          );
        } else {
          setErrorMessage(
            l(
              'Tài khoản chưa xác minh email. Hãy kiểm tra hộp thư hoặc bấm Gửi lại mã.',
              'Your email is not verified yet. Check your inbox or tap Resend code.',
            ),
          );
        }
        return;
      }
      setErrorMessage(
        localizeAuthError(
          err,
          'Email hoặc mật khẩu chưa chính xác. Vui lòng kiểm tra lại.',
          'Incorrect email or password. Please check and try again.',
        ),
      );
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
      setErrorMessage(
        l(
          'Vui lòng nhập địa chỉ email hợp lệ và mật khẩu tối thiểu 6 ký tự.',
          'Please enter a valid email address and a password of at least 6 characters.',
        ),
      );
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setErrorMessage(
        l(
          'Vui lòng hoàn tất bước xác minh bảo mật ngay bên dưới trước khi tiếp tục.',
          'Please complete the security check below before continuing.',
        ),
      );
      return;
    }
    if (!ensureOnline()) return;
    const isCurrent = capturePrivateSession();
    const display = name.trim() || cleanEmail.split('@')[0] || l('Thành viên Takolio', 'Takolio Member');
    const submittedPassword = password;
    setIsLoading(true);
    try {
      const res = await api.register(display, cleanEmail, submittedPassword, turnstileToken);
      if (!isCurrent()) return;
      setDevOtpHint(res.devOtp ?? null);
      enterRegisterVerification(cleanEmail, res, submittedPassword);
      setInfoMessage(
        localizeServerInfo(
          res.message,
          `Đã gửi mã xác thực 6 số tới ${cleanEmail}.`,
          `Sent a 6-digit verification code to ${cleanEmail}.`,
        ),
      );
    } catch (err: unknown) {
      if (!isCurrent()) return;
      const errCode = (err as { code?: string; payload?: Record<string, unknown> })?.code;
      const errPayload = (err as { payload?: Record<string, unknown> })?.payload;
      if (errCode === 'OTP_DELIVERY_UNAVAILABLE' || errCode === 'OTP_DELIVERY_UNKNOWN') {
        enterRegisterVerification(cleanEmail, { ...errPayload, otpDelivered: false }, submittedPassword);
        setErrorMessage(
          errCode === 'OTP_DELIVERY_UNKNOWN'
            ? l(
                'Tài khoản đã tạo nhưng máy chủ chưa xác nhận gửi email. Vui lòng kiểm tra hộp thư trước khi gửi lại mã.',
                'Account created, but email delivery is unconfirmed. Please check your inbox before requesting a new code.',
              )
            : l(
                'Tài khoản đã lưu nhưng email OTP chưa gửi được. Hãy bấm Gửi lại mã xác thực.',
                'Account saved, but the OTP email could not be delivered. Please tap Resend verification code.',
              ),
        );
        return;
      }
      setErrorMessage(
        localizeAuthError(
          err,
          'Không thể tạo tài khoản. Email này có thể đã được đăng ký.',
          'Unable to create account. This email may already be registered.',
        ),
      );
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
      setErrorMessage(
        l(
          'Vui lòng nhập đủ mã OTP 6 chữ số được gửi tới email của bạn.',
          'Please enter all 6 digits of the OTP code sent to your email.',
        ),
      );
      return;
    }
    if (effectivePassword.length < 6 || effectivePassword.length > 100) {
      setErrorMessage(
        l(
          'Vui lòng nhập mật khẩu (tối thiểu 6 ký tự) để hoàn tất kích hoạt tài khoản.',
          'Please enter your password (at least 6 characters) to finish activating your account.',
        ),
      );
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
        setErrorMessage(
          l(
            'Yêu cầu đang được xử lý. Vui lòng thử lại với cùng mã OTP.',
            'Your request is still processing. Please try again with the same OTP code.',
          ),
        );
        return;
      }
      clearVerifyContext();
      if (!res.user?.id || !res.user?.householdId) {
        setInfoMessage(
          l(
            'Xác thực thành công! Mời bạn đăng nhập vào tài khoản.',
            'Verification succeeded! Please sign in to your account.',
          ),
        );
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
          ? l(
              'Mất kết nối mạng. Mã OTP chưa được tiêu thụ — hãy kiểm tra mạng và thử lại.',
              'Network connection lost. Your OTP code was not used — reconnect and try again.',
            )
          : localizeAuthError(
              err,
              'Mã xác thực không đúng hoặc đã hết hạn.',
              'Invalid or expired verification code.',
            ),
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
      setInfoMessage(
        localizeServerInfo(
          res.message,
          'Đã gửi lại mã xác thực mới tới hộp thư của bạn.',
          'A new verification code has been sent to your inbox.',
        ),
      );
    } catch (err) {
      setErrorMessage(
        localizeAuthError(err, 'Chưa thể gửi lại mã OTP lúc này.', 'Unable to resend the OTP code right now.'),
      );
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
      setErrorMessage(
        l(
          'Vui lòng nhập địa chỉ email tài khoản cần khôi phục.',
          'Please enter the email address for the account you want to recover.',
        ),
      );
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
      setInfoMessage(
        localizeServerInfo(
          res.message,
          `Đã gửi mã khôi phục 6 số tới ${cleanEmail}.`,
          `Sent a 6-digit recovery code to ${cleanEmail}.`,
        ),
      );
    } catch (err) {
      setErrorMessage(
        localizeAuthError(
          err,
          'Không thể gửi mã khôi phục lúc này. Vui lòng thử lại.',
          'Unable to send recovery code right now. Please try again.',
        ),
      );
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
      setErrorMessage(
        l(
          'Vui lòng nhập email, đủ 6 chữ số OTP và mật khẩu mới tối thiểu 6 ký tự.',
          'Please enter your email, all 6 OTP digits, and a new password of at least 6 characters.',
        ),
      );
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
      setInfoMessage(
        l(
          'Đã đặt lại mật khẩu thành công. Mời bạn đăng nhập bằng mật khẩu mới.',
          'Password reset successfully. Please sign in with your new password.',
        ),
      );
    } catch (err) {
      if (!isCurrent()) return;
      setErrorMessage(
        localizeAuthError(
          err,
          'Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại mã OTP.',
          'Unable to reset password. Please check your OTP code and try again.',
        ),
      );
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  };

  const isAppHost = detectRuntimeDomainRole() === 'application-app';
  const externalMarketingHref =
    !hasActiveGuestSession && isAppHost ? resolveSatelliteSurfaceHref('/') : null;
  const exitHref = hasActiveGuestSession ? vnextHref('/') : vnextHref('/landing');
  const exitLabel = hasActiveGuestSession
    ? l('Về căn bếp', 'Back to kitchen')
    : l('Trang giới thiệu', 'Home');
  const needVerifyPasswordField = !activationPassword && !password;

  return (
    <div
      className="tkv-root min-h-dvh flex flex-col bg-[var(--tkv-bg,#FFF9F1)]"
      data-tkv-direction="a"
      data-tkv-screen={screenId}
    >
      <a href="#tkv-auth-main" className="tkv-skip-link">
        {l('Đến biểu mẫu xác thực', 'Skip to sign-in form')}
      </a>

      <main
        id="tkv-auth-main"
        tabIndex={-1}
        className="flex-1 max-w-[1040px] w-full mx-auto px-4 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:py-10 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Unified Sunlit Ceramic Auth Card */}
          <div className="lg:col-span-6 w-full max-w-[440px] mx-auto">
            <TkvSurface className="p-4 sm:p-8 relative overflow-hidden space-y-5 bg-white border-[var(--tkv-border)] shadow-soft">
              {/* Top Header: Brand Lockup + Deterministic 1-Click Exit */}
              <div className="relative flex flex-wrap items-center justify-between gap-2.5">
                {externalMarketingHref ? (
                  <a href={externalMarketingHref} className="tkv-focusable rounded-xl py-1">
                    <BrandLockup locale={effectiveLocale} />
                  </a>
                ) : (
                  <Link to={exitHref} className="tkv-focusable rounded-xl py-1">
                    <BrandLockup locale={effectiveLocale} />
                  </Link>
                )}

                {isPrimaryAuthTab || activeMode === 'welcome' ? (
                  externalMarketingHref ? (
                    <a
                      href={externalMarketingHref}
                      className="tkv-focusable min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-mint)] hover:text-[var(--tkv-ink)] transition-colors shrink-0"
                    >
                      <VNextIcon name="arrow-left" size={15} />
                      <span>{exitLabel}</span>
                    </a>
                  ) : (
                    <Link
                      to={exitHref}
                      className="tkv-focusable min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-mint)] hover:text-[var(--tkv-ink)] transition-colors shrink-0"
                    >
                      <VNextIcon name="arrow-left" size={15} />
                      <span>{exitLabel}</span>
                    </Link>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      switchMode(activeMode === 'verify' ? 'register' : 'login', { replace: true })
                    }
                    className="tkv-focusable min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)] transition-colors shrink-0"
                  >
                    <VNextIcon name="arrow-left" size={15} />
                    <span>
                      {activeMode === 'verify'
                        ? l('Quay lại đăng ký', 'Back to sign up')
                        : l('Quay lại đăng nhập', 'Back to sign in')}
                    </span>
                  </button>
                )}
              </div>

              {/* 2-Tab Segmented Switcher (`Đăng nhập` | `Tạo tài khoản`) */}
              {isPrimaryAuthTab && (
                <div
                  role="tablist"
                  aria-label={l('Chuyển đổi Đăng nhập và Tạo tài khoản', 'Switch between Sign in and Create account')}
                  className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMode === 'login'}
                    data-testid="auth-tab-login"
                    onClick={() => switchMode('login', { replace: true })}
                    className={clsx(
                      'tkv-focusable min-h-[44px] rounded-xl text-sm font-extrabold transition-colors',
                      activeMode === 'login'
                        ? 'bg-white text-[var(--tkv-ink)] shadow-xs border border-[var(--tkv-border)]'
                        : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
                    )}
                  >
                    {l('Đăng nhập', 'Sign in')}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMode === 'register'}
                    data-testid="auth-tab-register"
                    onClick={() => switchMode('register', { replace: true })}
                    className={clsx(
                      'tkv-focusable min-h-[44px] rounded-xl text-sm font-extrabold transition-colors',
                      activeMode === 'register'
                        ? 'bg-white text-[var(--tkv-ink)] shadow-xs border border-[var(--tkv-border)]'
                        : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
                    )}
                  >
                    {l('Tạo tài khoản', 'Create account')}
                  </button>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-sm font-semibold text-[var(--tkv-accent-ink,#B33A22)] flex items-start gap-2.5"
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)] shrink-0 mt-1.5" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-2xl bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] text-sm font-semibold text-[var(--tkv-sage-ink,#134C39)] flex items-start gap-2.5"
                >
                  <VNextIcon name="check" size={18} className="shrink-0 mt-0.5 text-[var(--tkv-sage,#196149)]" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* A01 — Entry Gateway (`?mode=welcome`) */}
              {activeMode === 'welcome' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-bold text-[var(--tkv-ink-muted,#52706A)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
                      <span>{l('Trợ lý bếp gia đình thông minh với AI', 'Smart AI family kitchen assistant')}</span>
                    </span>
                    <h1 className="tkv-heading text-2xl sm:text-[1.7rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {l('Chào mừng bạn đến Takolio', 'Welcome to Takolio')}
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                      {l(
                        'Tiếp tục bằng tài khoản Google, email đã đăng ký hoặc mở phiên dùng thử ngay lập tức.',
                        'Continue with Google, your email account, or start a guest trial right away.',
                      )}
                    </p>
                  </div>

                  <GoogleAuthSection
                    clientId={googleClientId}
                    status={googleStatus}
                    buttonRef={googleBtnRef}
                    onRetry={handleRetryGoogle}
                    locale={effectiveLocale}
                  />

                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => switchMode('login', { replace: true })}
                      data-testid="a01-login-cta"
                      className="tkv-focusable w-full min-h-[48px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white text-sm font-bold shadow-xs transition-colors"
                    >
                      {l('Đăng nhập bằng email', 'Sign in with email')}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register', { replace: true })}
                      data-testid="a01-register-cta"
                      className="tkv-focusable w-full min-h-[48px] px-5 py-2.5 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border-strong,#B8CABE)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-[var(--tkv-ink,#152E2C)] text-sm font-bold transition-colors"
                    >
                      {l('Tạo tài khoản mới', 'Create new account')}
                    </button>
                  </div>

                  {!hasActiveGuestSession && (
                    <div className="pt-2 border-t border-[var(--tkv-border)] text-center">
                      <button
                        type="button"
                        disabled={isStartingGuest || isLoading}
                        onClick={() => void handleGuestStart()}
                        className="tkv-focusable min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-accent-ink)] hover:underline"
                      >
                        <span>
                          {isStartingGuest
                            ? l('Đang mở phiên dùng thử…', 'Starting guest session…')
                            : l('Dùng thử ngay không cần đăng ký →', 'Try now without signing up →')}
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
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {activeMode === 'login'
                        ? l('Đăng nhập tài khoản', 'Sign in')
                        : l('Tạo tài khoản mới', 'Create an account')}
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                      {activeMode === 'login'
                        ? l(
                            'Vào nhanh bằng tài khoản Google hoặc địa chỉ email của bạn.',
                            'Sign in quickly with Google or your email address.',
                          )
                        : l(
                            'Đồng bộ tủ lạnh, thực đơn tuần và danh sách đi chợ cho gia đình.',
                            'Sync your fridge, weekly meal plan, and grocery list across devices.',
                          )}
                    </p>
                  </div>

                  {hasActiveGuestSession && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-honey-soft,#FFF5D6)] border border-[var(--tkv-honey-border,#F5DE93)] text-xs font-bold text-[var(--tkv-honey-ink,#8A5205)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-honey,#F6C453)]" aria-hidden="true" />
                      <span>
                        {l(
                          'Đang dùng phiên khách · Xác thực để lưu dữ liệu lâu dài',
                          'Guest session active · Sign in to keep your kitchen data',
                        )}
                      </span>
                    </span>
                  )}

                  {/* Real Google Identity Services Button */}
                  <GoogleAuthSection
                    clientId={googleClientId}
                    status={googleStatus}
                    buttonRef={googleBtnRef}
                    onRetry={handleRetryGoogle}
                    locale={effectiveLocale}
                  />

                  <div className="relative flex items-center py-0.5" aria-hidden="true">
                    <div className="flex-grow border-t border-[var(--tkv-border,#DCE6DE)]" />
                    <span className="shrink-0 mx-3 text-xs font-bold uppercase tracking-wider text-[var(--tkv-ink-muted,#52706A)]">
                      {l('hoặc bằng email', 'or with email')}
                    </span>
                    <div className="flex-grow border-t border-[var(--tkv-border,#DCE6DE)]" />
                  </div>

                  {activeMode === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4" noValidate>
                      <TkvTextField
                        label={l('Địa chỉ email', 'Email address')}
                        type="email"
                        autoComplete="email"
                        iconLeft="mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        required
                      />
                      <TkvTextField
                        label={l('Mật khẩu', 'Password')}
                        labelAction={
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="tkv-focusable min-h-[44px] px-2 -my-2 inline-flex items-center text-xs font-bold text-[var(--tkv-accent-ink)] hover:text-[var(--tkv-primary)] hover:underline"
                          >
                            {l('Quên mật khẩu?', 'Forgot password?')}
                          </button>
                        }
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        iconLeft="lock"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={l('Nhập mật khẩu của bạn', 'Enter your password')}
                        required
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? l('Ẩn mật khẩu', 'Hide password') : l('Hiện mật khẩu', 'Show password')}
                            className="tkv-focusable w-11 h-11 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-ink)]"
                          >
                            <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                          </button>
                        }
                      />

                      <button
                        type="submit"
                        disabled={isLoading}
                        data-testid="a02-submit-btn"
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                      >
                        {isLoading ? l('Đang đăng nhập…', 'Signing in…') : l('Đăng nhập', 'Sign in')}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleRegister} className="space-y-4" noValidate>
                      <TkvTextField
                        label={l('Tên hiển thị', 'Display name')}
                        type="text"
                        autoComplete="name"
                        iconLeft="profile"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={l('Ví dụ: Bếp nhà Minh', "e.g. Alex's Kitchen")}
                      />
                      <TkvTextField
                        label={l('Địa chỉ email', 'Email address')}
                        type="email"
                        autoComplete="email"
                        iconLeft="mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@example.com"
                        required
                      />
                      <TkvTextField
                        label={l('Mật khẩu', 'Password')}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        iconLeft="lock"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={l('Tối thiểu 6 ký tự', 'At least 6 characters')}
                        required
                        rightSlot={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            aria-label={showPassword ? l('Ẩn mật khẩu', 'Hide password') : l('Hiện mật khẩu', 'Show password')}
                            className="tkv-focusable w-11 h-11 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-ink)]"
                          >
                            <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                          </button>
                        }
                      />

                      {turnstileSiteKey && (
                        <div className="pt-0.5 w-full overflow-x-auto flex justify-center">
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
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                      >
                        {isLoading ? l('Đang gửi mã…', 'Sending code…') : l('Tạo tài khoản', 'Create account')}
                      </button>
                    </form>
                  )}

                  {!hasActiveGuestSession && (
                    <div className="pt-2 border-t border-[var(--tkv-border)] text-center">
                      <button
                        type="button"
                        disabled={isStartingGuest || isLoading}
                        onClick={() => void handleGuestStart()}
                        className="tkv-focusable min-h-[44px] px-3 rounded-xl inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-accent-ink)] hover:underline"
                      >
                        <span>
                          {isStartingGuest
                            ? l('Đang mở phiên dùng thử…', 'Starting guest session…')
                            : l(
                                'Chưa cần tài khoản? Dùng thử ngay không cần đăng ký →',
                                'No account yet? Try as guest now →',
                              )}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* A05 — Xác minh OTP (`/auth/verify`) */}
              {activeMode === 'verify' && (
                <div className="relative space-y-5">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {l('Xác minh OTP', 'Verify OTP')}
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                      {email
                        ? l(
                            `Nhập mã 6 chữ số đã gửi tới ${email} để kích hoạt tài khoản.`,
                            `Enter the 6-digit code sent to ${email} to activate your account.`,
                          )
                        : l(
                            'Nhập địa chỉ email và mã xác thực 6 chữ số của bạn.',
                            'Enter your email address and 6-digit verification code.',
                          )}
                    </p>
                  </div>

                  {!initialVerify && !email && (
                    <TkvTextField
                      label={l('Địa chỉ email đang xác minh', 'Email address to verify')}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  )}

                  {devOtpHint && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-surface-muted,#E7F4EC)] border border-[var(--tkv-border,#DCE6DE)] text-xs tabular-nums font-bold text-[var(--tkv-ink,#152E2C)]">
                      {l('Mã thử nghiệm nội bộ (dev):', 'Dev test OTP code:')} {devOtpHint}
                    </span>
                  )}

                  <form onSubmit={(e) => void handleVerifyOtp(e, true)} className="space-y-4">
                    <SixDigitOtpInput
                      digits={otpDigits}
                      onChange={setOtpDigits}
                      disabled={isLoading}
                      locale={effectiveLocale}
                    />

                    {needVerifyPasswordField && (
                      <div className="space-y-1.5">
                        <TkvTextField
                          label={l('Mật khẩu tài khoản', 'Account password')}
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          iconLeft="lock"
                          value={activationPassword}
                          onChange={(e) => setActivationPassword(e.target.value)}
                          placeholder={l('Nhập mật khẩu tối thiểu 6 ký tự', 'Enter password (at least 6 characters)')}
                          required
                        />
                        <p className="text-xs text-[var(--tkv-ink-muted)] leading-relaxed">
                          {l(
                            'Trang vừa được tải lại — vui lòng nhập lại mật khẩu để hoàn tất.',
                            'Page was reloaded — please re-enter your password to complete verification.',
                          )}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs font-bold">
                      <button
                        type="button"
                        disabled={resendSeconds > 0 || isLoading || !email.trim()}
                        onClick={() => void handleResendOtp('register')}
                        className="tkv-focusable min-h-[44px] inline-flex items-center tabular-nums text-[var(--tkv-accent-ink)] disabled:text-[var(--tkv-ink-muted)] hover:underline"
                      >
                        {resendSeconds > 0
                          ? l(
                              `Gửi lại mã · 00:${String(resendSeconds).padStart(2, '0')}`,
                              `Resend code · 00:${String(resendSeconds).padStart(2, '0')}`,
                            )
                          : l('Gửi lại mã xác thực', 'Resend verification code')}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isLoading
                        ? l('Đang xác minh…', 'Verifying…')
                        : l('Xác nhận & hoàn tất', 'Verify & continue')}
                    </button>
                  </form>
                </div>
              )}

              {/* A06 — Quên mật khẩu */}
              {activeMode === 'forgot' && (
                <div className="relative space-y-5">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {l('Quên mật khẩu', 'Forgot password')}
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                      {l(
                        'Nhập email đã đăng ký để nhận mã khôi phục 6 chữ số.',
                        'Enter your registered email to receive a 6-digit recovery code.',
                      )}
                    </p>
                  </div>

                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <TkvTextField
                      label={l('Địa chỉ email', 'Email address')}
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
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isLoading ? l('Đang gửi…', 'Sending…') : l('Gửi mã khôi phục', 'Send recovery code')}
                    </button>
                  </form>
                </div>
              )}

              {/* A07 — Đặt lại mật khẩu */}
              {activeMode === 'reset' && (
                <div className="relative space-y-5">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {l('Đặt lại mật khẩu', 'Reset password')}
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                      {l(
                        'Nhập mã 6 chữ số trong hộp thư và chọn mật khẩu mới.',
                        'Enter the 6-digit code from your inbox and choose a new password.',
                      )}
                    </p>
                  </div>

                  {devOtpHint && (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--tkv-surface-muted,#E7F4EC)] border border-[var(--tkv-border,#DCE6DE)] text-xs tabular-nums font-bold text-[var(--tkv-ink,#152E2C)]">
                      {l('Mã khôi phục thử nghiệm (dev):', 'Dev test recovery code:')} {devOtpHint}
                    </span>
                  )}

                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <TkvTextField
                      label={l('Địa chỉ email', 'Email address')}
                      type="email"
                      iconLeft="mail"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@example.com"
                      required
                    />
                    <SixDigitOtpInput
                      digits={otpDigits}
                      onChange={setOtpDigits}
                      disabled={isLoading}
                      locale={effectiveLocale}
                    />
                    <div className="flex justify-end text-xs font-bold">
                      <button
                        type="button"
                        disabled={resendSeconds > 0 || isLoading || !email.trim()}
                        onClick={() => void handleResendOtp('forgot_password')}
                        className="tkv-focusable min-h-[44px] inline-flex items-center tabular-nums text-[var(--tkv-accent-ink)] disabled:text-[var(--tkv-ink-muted)] hover:underline"
                      >
                        {resendSeconds > 0
                          ? l(
                              `Gửi lại mã · 00:${String(resendSeconds).padStart(2, '0')}`,
                              `Resend code · 00:${String(resendSeconds).padStart(2, '0')}`,
                            )
                          : l('Gửi lại mã khôi phục', 'Resend recovery code')}
                      </button>
                    </div>
                    <TkvTextField
                      label={l('Mật khẩu mới', 'New password')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      iconLeft="lock"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={l('Tối thiểu 6 ký tự', 'At least 6 characters')}
                      required
                      rightSlot={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? l('Ẩn mật khẩu', 'Hide password') : l('Hiện mật khẩu', 'Show password')}
                          className="tkv-focusable w-11 h-11 rounded-lg inline-flex items-center justify-center text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-ink)]"
                        >
                          <VNextIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                        </button>
                      }
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-base shadow-xs transition-colors disabled:opacity-60"
                    >
                      {isLoading ? l('Đang lưu…', 'Saving…') : l('Lưu mật khẩu mới', 'Save new password')}
                    </button>
                  </form>
                </div>
              )}

              {/* A08 — Chuyển dữ liệu khách (DEC-012 Honest Refusal) */}
              {activeMode === 'transfer-deferred' && (
                <div className="relative space-y-5" role="alert">
                  <div className="space-y-1">
                    <h1 className="tkv-heading text-2xl sm:text-[1.65rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      {l('Chuyển dữ liệu khách', 'Transfer guest data')}
                    </h1>
                    <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                      {l(
                        'Giữ quyền kiểm soát khi chuyển từ dùng thử sang tài khoản.',
                        'Stay in control when moving from guest mode to an account.',
                      )}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--tkv-honey-soft,#FFF5D6)] border border-[var(--tkv-honey-border,#F5DE93)] text-sm text-[var(--tkv-honey-ink,#8A5205)] leading-relaxed">
                    {l(
                      'Không thể tự động gộp dữ liệu do phiên khách cần được xác nhận hoặc tài khoản đích đã có hộ gia đình riêng. ',
                      'We could not merge data automatically because the guest session needs confirmation or the target account already has its own household. ',
                    )}
                    <strong>
                      {l(
                        'Dữ liệu khách hiện tại vẫn giữ nguyên.',
                        'Your current guest data remains intact.',
                      )}
                    </strong>
                  </div>

                  <div className="space-y-2.5">
                    {otpDigits.join('').length === 6 ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => void handleVerifyOtp(e as unknown as React.FormEvent, false)}
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-sm shadow-xs transition-colors disabled:opacity-60"
                      >
                        {isLoading
                          ? l('Đang xử lý…', 'Processing…')
                          : l(
                              'Tiếp tục vào tài khoản (không gộp dữ liệu khách)',
                              'Continue to account (without merging guest data)',
                            )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => switchMode('login', { replace: true })}
                        className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-sm shadow-xs transition-colors"
                      >
                        {l('Quay lại đăng nhập', 'Back to sign in')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(vnextHref('/'))}
                      className="tkv-focusable w-full min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border-strong,#B8CABE)] text-[var(--tkv-ink,#152E2C)] font-bold text-sm transition-colors hover:bg-[var(--tkv-surface-muted,#E7F4EC)]"
                    >
                      {l('Quay về phiên khách hiện tại', 'Return to current guest session')}
                    </button>
                  </div>
                </div>
              )}
            </TkvSurface>
          </div>

          {/* Desktop Sunlit Kitchen Companion Panel */}
          <div className="hidden lg:block lg:col-span-6">
            <div className="rounded-[24px] bg-gradient-to-br from-[var(--tkv-linen-from,#FFFFFF)] to-[var(--tkv-surface-muted,#E7F4EC)] border border-[var(--tkv-border,#DCE6DE)] p-8 space-y-5 shadow-soft">
              <div className="flex items-center gap-4">
                <MascotIllustration pose="welcome" size={96} locale={effectiveLocale} className="w-24 h-24 shrink-0" />
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted,#52706A)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
                    <span>{l('KHÔNG GIAN BẾP GIA ĐÌNH', 'FAMILY KITCHEN SPACE')}</span>
                  </span>
                  <h2 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    {l('Mỗi căn bếp là một không gian riêng tư', 'Every kitchen is a private space')}
                  </h2>
                </div>
              </div>
              <ul className="space-y-3 text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="shield" size={18} className="text-[var(--tkv-sage,#196149)] shrink-0 mt-0.5" />
                  <span>
                    {l(
                      'Tồn kho tủ lạnh, lịch sử quét và thực đơn được phân tách chặt chẽ theo mã hộ gia đình.',
                      'Fridge inventory, scan history, and meal plans are strictly isolated per household.',
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="check" size={18} className="text-[var(--tkv-sage,#196149)] shrink-0 mt-0.5" />
                  <span>
                    {l(
                      'Đăng nhập 1 chạm bằng Google hoặc email — tự động dọn sạch bộ nhớ đệm khi chuyển tài khoản.',
                      'One-tap sign-in with Google or email — local cache clears automatically when switching accounts.',
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <VNextIcon name="sparkles" size={18} className="text-[var(--tkv-primary,#196149)] shrink-0 mt-0.5" />
                  <span>
                    {l(
                      'Mọi kết quả nhận diện AI đều qua bước duyệt thủ công của bạn trước khi cập nhật tủ lạnh.',
                      'Every AI scan result goes through your manual review before updating your fridge.',
                    )}
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
