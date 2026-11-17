import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';
import { api } from '../services/api';
import { isInventoryTransferDeferred } from '../services/auth';
import { isOffline } from '../services/http';
import { capturePrivateSession } from '../lib/private-session';
import { Slide } from '../design-system/motion';
import { apiErrorMessage, otpPresentation, type AuthMode } from '../features/auth/auth-shared';
import { AuthShell } from '../features/auth/AuthShell';
import { LoginMode } from '../features/auth/LoginMode';
import { RegisterMode } from '../features/auth/RegisterMode';
import { OtpMode } from '../features/auth/OtpMode';
import { VerifyUnavailable } from '../features/auth/VerifyUnavailable';
import { ForgotPasswordMode } from '../features/auth/ForgotPasswordMode';
import {
  clearVerifyContext,
  readVerifyContext,
  resendSecondsRemaining,
  writeVerifyContext,
} from '../features/auth/verify-context';

export const AUTH_VERIFY_PATH = '/auth/verify';
const EMPTY_OTP = ['', '', '', '', '', ''];

function captureGuestSnapshotBeforeAuth() {
  const state = useAuthStore.getState();
  if (!state.isGuest || !state.userId || !state.householdId) return null;
  const previousGuestScope = { userId: state.userId, householdId: state.householdId };
  let items: Array<Record<string, unknown>> = [];
  let shoppingItems: Array<Record<string, unknown>> = [];
  let guestSessionToken: string | undefined;

  try {
    const rawInv = localStorage.getItem(
      `frigo_cache_v2:${state.userId}:${state.householdId}:inventory`,
    );
    if (rawInv) {
      const parsed = JSON.parse(rawInv);
      if (Array.isArray(parsed)) items = parsed;
    }
    const rawShop = localStorage.getItem(
      `frigo_cache_v2:${state.userId}:${state.householdId}:shopping_list`,
    );
    if (rawShop) {
      const parsed = JSON.parse(rawShop);
      if (Array.isArray(parsed)) shoppingItems = parsed;
    }
  } catch {
    // Malformed local cache is ignored safely.
  }

  try {
    guestSessionToken = sessionStorage.getItem('frigo_guest_token') || undefined;
  } catch {
    guestSessionToken = undefined;
  }

  const normalizedItems = items
    .filter((i) => i && typeof i.name === 'string' && Number(i.quantity) > 0)
    .map((i) => ({
      id: typeof i.id === 'string' ? i.id : undefined,
      name: String(i.name),
      quantity: Number(i.quantity) || 1,
      unit: typeof i.unit === 'string' ? i.unit : 'piece',
      category: typeof i.category === 'string' ? i.category : 'other',
      storage: (['fridge', 'freezer', 'pantry'].includes(String(i.storage))
        ? String(i.storage)
        : 'fridge') as 'fridge' | 'freezer' | 'pantry',
      expiryDate: typeof i.expiryDate === 'string' ? i.expiryDate : null,
      expiryEstimated: Boolean(i.expiryEstimated || i.expiryKind === 'ESTIMATED'),
    }));

  const normalizedShopping = shoppingItems
    .filter((s) => s && typeof s.name === 'string')
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id : undefined,
      name: String(s.name),
      quantity: Number(s.quantity) || 1,
      unit: typeof s.unit === 'string' ? s.unit : 'piece',
      isChecked: Boolean(s.isChecked),
      ingredientId: typeof s.ingredientId === 'string' ? s.ingredientId : undefined,
    }));

  if (normalizedItems.length === 0 && normalizedShopping.length === 0 && !guestSessionToken) {
    return null;
  }

  return {
    items: normalizedItems,
    shoppingItems: normalizedShopping,
    guestSessionToken,
    previousGuestScope,
  };
}

/**
 * Auth state machine (screen 02). Presentation lives in `features/auth/*`;
 * security semantics (Turnstile, GSI on both Login & Register, DEC-012 guest
 * transfer, seamless guest-to-account merge, private-session capture) stay here.
 */
export const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isVerifyRoute = pathname === AUTH_VERIFY_PATH;
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const requestedProvider = searchParams.get('provider');
  const requestedReturnTo = searchParams.get('returnTo');
  const returnTo =
    requestedReturnTo?.startsWith('/') && !requestedReturnTo.startsWith('//')
      ? requestedReturnTo
      : '/';
  const setAuthSession = useAuthStore((state) => state.setAuthSession);
  const hasGuestKitchen = useAuthStore((state) =>
    Boolean(state.isGuest && state.userId && state.householdId),
  );
  const identity = useAuthStore((state) => `${state.userId}:${state.householdId}`);

  // Non-route modes; `otp_verify` is derived from the route below.
  const [baseMode, setBaseMode] = useState<Exclude<AuthMode, 'otp_verify'>>(() =>
    requestedMode === 'register' ? 'register' : 'login',
  );
  const mode: AuthMode = isVerifyRoute ? 'otp_verify' : baseMode;
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  // Direct load / refresh of /auth/verify restores the address being verified.
  const [verifyContext, setVerifyContext] = useState(() =>
    isVerifyRoute ? readVerifyContext() : null,
  );
  const [email, setEmail] = useState(() => verifyContext?.email ?? '');
  const [password, setPassword] = useState('');
  const [activationPassword, setActivationPassword] = useState('');
  const [hasPresetPassword, setHasPresetPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password new password
  const [newPassword, setNewPassword] = useState('');

  // OTP State
  const [otpDigits, setOtpDigits] = useState(EMPTY_OTP);
  const [otpPurpose, setOtpPurpose] = useState<'register' | 'forgot_password'>('register');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [forgotOtpRequested, setForgotOtpRequested] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(() =>
    resendSecondsRemaining(verifyContext),
  );
  const [isResending, setIsResending] = useState(false);
  const [transferDeferred, setTransferDeferred] = useState(false);
  const verifyRouteActiveRef = useRef(isVerifyRoute);
  const verificationCompletedRef = useRef(false);
  const routeGenerationRef = useRef(0);
  const authPageActiveRef = useRef(true);
  const authRequestGenerationRef = useRef(0);
  const routeScopeRef = useRef(`${identity}:${pathname}`);
  if (routeScopeRef.current !== `${identity}:${pathname}`) {
    routeScopeRef.current = `${identity}:${pathname}`;
    routeGenerationRef.current += 1;
  }
  verifyRouteActiveRef.current = isVerifyRoute;

  useEffect(() => {
    verifyRouteActiveRef.current = isVerifyRoute;
    return () => {
      verifyRouteActiveRef.current = false;
    };
  }, [isVerifyRoute]);

  useEffect(() => {
    authPageActiveRef.current = true;
    return () => {
      authPageActiveRef.current = false;
      authRequestGenerationRef.current += 1;
    };
  }, []);

  // SEC-6: account creation is the single user-visible Turnstile boundary.
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null | undefined>(undefined);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileGeneration, setTurnstileGeneration] = useState(0);
  const handleTurnstileToken = useCallback((token: string | null) => setTurnstileToken(token), []);
  const [googleStatus, setGoogleStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>(
    'idle',
  );
  const [googleRetry, setGoogleRetry] = useState(0);

  useEffect(() => {
    api
      .getPublicConfig()
      .then((cfg) => {
        setTurnstileSiteKey(cfg.turnstileSiteKey || null);
        setGoogleClientId(cfg.googleClientId || null);
      })
      .catch(() => {
        setTurnstileSiteKey(null);
        setGoogleClientId(null);
      });
  }, []);

  useEffect(() => {
    if (requestedMode === 'register') setBaseMode('register');
  }, [requestedMode]);

  useEffect(() => {
    if (!isVerifyRoute) {
      verificationCompletedRef.current = false;
      setVerifyContext(null);
      setIsLoading(false);
      setIsResending(false);
      return;
    }
    if (verificationCompletedRef.current) return;
    const context = readVerifyContext();
    setVerifyContext(context);
    if (!context) {
      setEmail('');
      setResendCountdown(0);
      setOtpDigits(EMPTY_OTP);
      setDevOtp(null);
      setTransferDeferred(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      return;
    }
    setEmail(context.email);
    setResendCountdown(resendSecondsRemaining(context));
    if (context.delivered === false && resendSecondsRemaining(context) === 0) {
      setErrorMessage((current) => current ?? 'Email OTP chưa gửi được. Hãy bấm gửi lại mã.');
    }
  }, [identity, isVerifyRoute]);

  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const mergeGuestKitchenIfPresent = useCallback(
    async (snapshot: ReturnType<typeof captureGuestSnapshotBeforeAuth>) => {
      if (!snapshot || typeof api.importGuestHousehold !== 'function') return null;
      try {
        const res = await api.importGuestHousehold(snapshot);
        if (
          res?.success &&
          ((res.importedItemsCount ?? 0) > 0 || (res.importedShoppingCount ?? 0) > 0)
        ) {
          return res;
        }
      } catch {
        // Guest merge is best-effort and must never block a valid authenticated session.
      }
      return null;
    },
    [],
  );

  // Initialize Google Identity Services on BOTH Login and Register modes.
  useEffect(() => {
    if (mode !== 'login' && mode !== 'register') {
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
    const handleGoogleResponse = async (response: any) => {
      if (!active) return;
      if (typeof response?.credential !== 'string' || response.credential.length === 0) {
        setErrorMessage(
          'Google không trả về thông tin xác thực hợp lệ. Hãy thử lại hoặc dùng email.',
        );
        return;
      }
      const isCurrent = capturePrivateSession();
      const guestSnapshot = captureGuestSnapshotBeforeAuth();
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
          const merged = await mergeGuestKitchenIfPresent(guestSnapshot);
          if (merged) {
            setSuccessMessage(
              `Đã đồng bộ ${merged.importedItemsCount} nguyên liệu từ tủ lạnh phiên khách!`,
            );
          }
          navigate(res.user.onboardingCompleted ? returnTo : '/onboarding', { replace: true });
        } else {
          setErrorMessage('Không thể xác thực tài khoản Google.');
        }
      } catch (err: any) {
        setErrorMessage(
          apiErrorMessage(err, 'Đăng nhập Google thất bại. Hãy thử lại hoặc dùng email.'),
        );
      } finally {
        setIsLoading(false);
      }
    };

    const initializeGoogle = () => {
      if (!active) return;
      const googleId = window.google?.accounts?.id;
      if (!googleId) {
        attempts += 1;
        if (attempts < 40) {
          timer = window.setTimeout(initializeGoogle, 250);
          return;
        }
        setGoogleStatus('unavailable');
        return;
      }
      try {
        setGoogleStatus('ready');
        googleId.initialize({
          client_id: googleClientId,
          callback: handleGoogleResponse,
          auto_select: false,
        });

        const googleHost = googleBtnRef.current;
        if (googleHost && active) {
          let renderedWidth = 0;
          renderGoogleButton = () => {
            if (!active) return;
            const measuredWidth = Math.floor(googleHost.getBoundingClientRect().width);
            const buttonWidth = Math.min(400, Math.max(200, measuredWidth || 320));
            if (buttonWidth === renderedWidth) return;
            googleHost.replaceChildren();
            googleId.renderButton(googleHost, {
              theme: 'outline',
              size: 'large',
              width: buttonWidth,
              text: 'signin_with',
              shape: 'pill',
              locale: 'vi',
            });
            renderedWidth = buttonWidth;
          };
          renderGoogleButton();
          if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(renderGoogleButton);
            resizeObserver.observe(googleHost);
          }
          window.addEventListener('resize', renderGoogleButton);
          if (requestedProvider === 'google') {
            googleHost.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        }
      } catch (e) {
        console.warn('Google Sign-In init error:', e);
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
  }, [
    mode,
    googleRetry,
    googleClientId,
    navigate,
    requestedProvider,
    returnTo,
    setAuthSession,
    mergeGuestKitchenIfPresent,
  ]);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const enterVerification = (
    verificationEmail: string,
    metadata: unknown,
    verifierPassword?: string,
  ) => {
    if (verifierPassword !== undefined) {
      setActivationPassword(verifierPassword);
      setHasPresetPassword(verifierPassword.length >= 6);
    }
    const presentation = otpPresentation(metadata);
    const context = writeVerifyContext({
      email: verificationEmail,
      resendAvailableAt: presentation.cooldown ? Date.now() + presentation.cooldown * 1000 : 0,
      expiresAt: presentation.expiresAt,
      delivered: presentation.delivered,
    });
    setVerifyContext(context);
    setOtpPurpose('register');
    setTransferDeferred(false);
    setResendCountdown(presentation.cooldown);
    if (!isVerifyRoute) navigate(AUTH_VERIFY_PATH);
  };

  const requireLoginAfterCompletion = () => {
    clearVerifyContext();
    setVerifyContext(null);
    setTransferDeferred(false);
    setDevOtp(null);
    setOtpDigits(EMPTY_OTP);
    setForgotOtpRequested(false);
    setNewPassword('');
    setActivationPassword('');
    setHasPresetPassword(false);
    setBaseMode('login');
    setSuccessMessage('Thao tác đã hoàn tất. Hãy đăng nhập để xác nhận phiên tài khoản.');
    navigate('/auth', { replace: true });
  };

  const beginAuthRequest = () => {
    const isCurrentSession = capturePrivateSession();
    const requestGeneration = ++authRequestGenerationRef.current;
    const routeGeneration = routeGenerationRef.current;
    const isLatest = () =>
      authPageActiveRef.current && authRequestGenerationRef.current === requestGeneration;
    return {
      isLatest,
      canApply: () =>
        isLatest() && isCurrentSession() && routeGenerationRef.current === routeGeneration,
    };
  };

  const invalidateAuthRequests = () => {
    authRequestGenerationRef.current += 1;
    setIsLoading(false);
    setIsResending(false);
    setTurnstileToken(null);
    setTurnstileGeneration((value) => value + 1);
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ email và mật khẩu');
      return;
    }
    const submittedEmail = email;
    const submittedPassword = password;
    const guestSnapshot = captureGuestSnapshotBeforeAuth();
    const request = beginAuthRequest();
    setIsLoading(true);
    setErrorMessage(null);
    setDevOtp(null);
    setOtpDigits(EMPTY_OTP);

    try {
      const res = await api.login(submittedEmail, submittedPassword);
      if (!request.canApply()) return;
      if (res.requireOtp) {
        if (typeof res.devOtp === 'string') setDevOtp(res.devOtp);
        enterVerification(submittedEmail, res, '');
        setSuccessMessage(
          'Yêu cầu xác thực email đang được xử lý. Hãy chọn mật khẩu để hoàn tất tài khoản.',
        );
        return;
      }
      if (res.success && res.user) {
        setAuthSession({
          id: res.user.id,
          email: res.user.email,
          displayName: res.user.displayName,
          avatarUrl: res.user.avatarUrl,
          householdId: res.user.householdId,
          onboardingCompleted: res.user.onboardingCompleted,
        });
        const merged = await mergeGuestKitchenIfPresent(guestSnapshot);
        if (merged) {
          setSuccessMessage(
            `Đã đồng bộ ${merged.importedItemsCount} nguyên liệu từ tủ lạnh phiên khách!`,
          );
        }
        navigate(res.user.onboardingCompleted ? returnTo : '/onboarding', { replace: true });
      }
    } catch (err: any) {
      if (!request.canApply()) return;
      if (err?.payload?.requireOtp === true) {
        if (typeof err.payload.devOtp === 'string') setDevOtp(err.payload.devOtp);
        const delivered = err.payload.otpDelivered === true;
        enterVerification(submittedEmail, err.payload, '');
        if (delivered) {
          setSuccessMessage('Mã OTP mới đã được gửi đến email của bạn.');
        } else if (
          err.payload.deliveryState === 'pending' ||
          err.payload.deliveryState === 'delivery_unknown'
        ) {
          setErrorMessage(
            apiErrorMessage(
              err,
              'Máy chủ chưa xác nhận trạng thái gửi email. Hãy chờ rồi thử lại.',
            ),
          );
        } else {
          setErrorMessage(
            'Tài khoản chưa xác thực và email OTP chưa gửi được. Hãy bấm gửi lại mã.',
          );
        }
      } else {
        setErrorMessage(apiErrorMessage(err, 'Email hoặc mật khẩu không chính xác'));
      }
    } finally {
      if (request.isLatest()) {
        setIsLoading(false);
      }
    }
  };

  // Handle Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setErrorMessage('Vui lòng điền đầy đủ họ tên, email và mật khẩu');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có tối thiểu 6 ký tự');
      return;
    }
    const submittedName = name;
    const submittedEmail = email;
    const submittedPassword = password;
    const submittedTurnstileToken = turnstileToken;
    const request = beginAuthRequest();

    setIsLoading(true);
    setErrorMessage(null);
    setDevOtp(null);
    setOtpDigits(EMPTY_OTP);

    try {
      const res = await api.register(
        submittedName,
        submittedEmail,
        submittedPassword,
        submittedTurnstileToken,
      );
      if (!request.canApply()) return;
      if (res.success) {
        if (res.devOtp) setDevOtp(res.devOtp);
        enterVerification(submittedEmail, res, submittedPassword);
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      if (!request.canApply()) return;
      if (err?.code === 'OTP_DELIVERY_UNAVAILABLE' || err?.code === 'OTP_DELIVERY_UNKNOWN') {
        enterVerification(
          submittedEmail,
          { ...err.payload, otpDelivered: false },
          submittedPassword,
        );
        setSuccessMessage(null);
        setErrorMessage(
          err?.code === 'OTP_DELIVERY_UNKNOWN'
            ? 'Tài khoản đã được lưu. Máy chủ chưa xác nhận trạng thái gửi email; hãy chờ trước khi yêu cầu mã mới.'
            : 'Tài khoản đã được lưu nhưng email OTP chưa gửi được. Hãy bấm gửi lại mã.',
        );
      } else {
        setErrorMessage(apiErrorMessage(err, 'Đăng ký thất bại. Email có thể đã tồn tại.'));
      }
    } finally {
      if (request.isLatest()) {
        setTurnstileToken(null);
        setTurnstileGeneration((value) => value + 1);
        setIsLoading(false);
      }
    }
  };

  // Handle OTP digit change
  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;

    const newDigits = [...otpDigits];
    newDigits[index] = clean.slice(-1);
    setOtpDigits(newDigits);

    if (clean && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setOtpDigits(newDigits);
      const nextIndex = Math.min(pasted.length, 5);
      otpInputsRef.current[nextIndex]?.focus();
    }
  };

  const submitOtpVerification = async (transferGuestData: boolean) => {
    const isCurrent = capturePrivateSession();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số mã OTP');
      return;
    }
    if (
      otpPurpose === 'register' &&
      (activationPassword.length < 6 || activationPassword.length > 100)
    ) {
      setErrorMessage('Hãy chọn mật khẩu từ 6 đến 100 ký tự để hoàn tất xác thực tài khoản.');
      return;
    }
    const routeGeneration = routeGenerationRef.current;
    const canApply = () =>
      isCurrent() && verifyRouteActiveRef.current && routeGenerationRef.current === routeGeneration;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const authState = useAuthStore.getState();
      const guestHouseholdId =
        transferGuestData &&
        otpPurpose === 'register' &&
        authState.isGuest &&
        authState.householdId.startsWith('hh_guest_')
          ? authState.householdId
          : null;
      const res = await api.verifyOtp(
        email,
        code,
        otpPurpose,
        guestHouseholdId,
        otpPurpose === 'register' ? activationPassword : undefined,
      );
      if (!canApply()) return;
      if (!res.success) {
        setErrorMessage(res.error || 'Yêu cầu đang được xử lý. Hãy thử lại với cùng mã OTP.');
        return;
      }
      if (res.success) {
        if (res.sessionRequired || (otpPurpose === 'register' && !res.user)) {
          requireLoginAfterCompletion();
          return;
        }
        setTransferDeferred(false);
        if (otpPurpose === 'register') {
          verificationCompletedRef.current = true;
          clearVerifyContext();
          setActivationPassword('');
          setHasPresetPassword(false);
          setIsLoading(false);
          if (res.user) {
            setAuthSession({
              id: res.user.id,
              email: res.user.email,
              displayName: res.user.displayName,
              avatarUrl: res.user.avatarUrl,
              householdId: res.user.householdId,
            });
          }
          setSuccessMessage(
            res.migratedFromHouseholdId
              ? 'Xác thực tài khoản thành công! Đã đồng bộ dữ liệu tủ lạnh khách vào tài khoản của bạn.'
              : 'Xác thực tài khoản thành công!',
          );
          const isNewSession = capturePrivateSession();
          setTimeout(() => {
            if (isNewSession()) navigate('/onboarding', { replace: true });
          }, 500);
        } else if (otpPurpose === 'forgot_password') {
          setSuccessMessage('Mã OTP chính xác. Hãy nhập mật khẩu mới.');
        }
      }
    } catch (err: any) {
      if (transferGuestData && isInventoryTransferDeferred(err)) {
        if (canApply()) setTransferDeferred(true);
        return;
      }
      if (canApply()) {
        const retry = err?.payload?.retryAfterSeconds;
        if (typeof retry === 'number' && Number.isFinite(retry) && retry >= 0 && retry <= 86_400) {
          const context = writeVerifyContext({
            email,
            delivered: verifyContext?.delivered ?? null,
            expiresAt: verifyContext?.expiresAt ?? null,
            resendAvailableAt: retry ? Date.now() + retry * 1000 : 0,
          });
          setVerifyContext(context);
          setResendCountdown(resendSecondsRemaining(context));
        }
        setErrorMessage(
          isOffline(err)
            ? 'Không thể kết nối máy chủ. Mã OTP chưa được xác nhận; hãy kiểm tra kết nối và thử lại.'
            : apiErrorMessage(err, 'Mã OTP không đúng hoặc đã hết hạn'),
        );
      }
    } finally {
      if (canApply()) setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitOtpVerification(true);
  };

  const handleContinueWithoutTransfer = async () => {
    await submitOtpVerification(false);
  };

  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isResending) return;
    const request = beginAuthRequest();
    const canApply = request.canApply;
    setIsResending(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await api.resendOtp(email, otpPurpose);
      if (res.success && canApply()) {
        setDevOtp(res.devOtp || null);
        setResendCountdown(otpPresentation(res).cooldown);
        setTransferDeferred(false);
        if (otpPurpose === 'register') {
          enterVerification(email, res);
        }
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      if (canApply()) {
        const retry = err?.payload?.retryAfterSeconds;
        if (typeof retry === 'number' && Number.isFinite(retry) && retry >= 0 && retry <= 86_400) {
          setResendCountdown(Math.ceil(retry));
        }
        if (
          otpPurpose === 'register' &&
          (isOffline(err) || err?.status >= 500 || err?.status === 429)
        ) {
          const terminalDelivery =
            err?.code === 'OTP_DELIVERY_UNAVAILABLE' || err?.code === 'OTP_DELIVERY_UNKNOWN';
          const cooldown = err?.payload?.retryAfterSeconds;
          const preserveChallenge = err?.status === 429;
          const context = writeVerifyContext({
            email,
            resendAvailableAt:
              typeof cooldown === 'number' && Number.isFinite(cooldown) && cooldown > 0
                ? Date.now() + cooldown * 1000
                : 0,
            expiresAt: preserveChallenge ? (verifyContext?.expiresAt ?? null) : null,
            delivered: preserveChallenge
              ? (verifyContext?.delivered ?? null)
              : terminalDelivery
                ? otpPresentation({ ...err.payload, otpDelivered: false }).delivered
                : null,
          });
          setVerifyContext(context);
          setResendCountdown(resendSecondsRemaining(context));
          if (!preserveChallenge) {
            setDevOtp(null);
            setOtpDigits(EMPTY_OTP);
          }
        }
        setErrorMessage(
          isOffline(err)
            ? 'Không thể kết nối máy chủ. Chưa gửi lại mã OTP; hãy kiểm tra kết nối và thử lại.'
            : apiErrorMessage(err, 'Không thể gửi lại OTP'),
        );
      }
    } finally {
      if (canApply()) {
        setIsResending(false);
      }
    }
  };

  const handleRequestForgotOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMessage('Vui lòng nhập email của bạn');
      return;
    }
    const submittedEmail = email;
    const request = beginAuthRequest();
    setIsLoading(true);
    setErrorMessage(null);
    setDevOtp(null);
    setForgotOtpRequested(false);
    setOtpDigits(EMPTY_OTP);
    try {
      const res = await api.forgotPassword(submittedEmail);
      if (!request.canApply()) return;
      if (res.success) {
        if (res.devOtp) setDevOtp(res.devOtp);
        setForgotOtpRequested(true);
        setOtpPurpose('forgot_password');
        setResendCountdown(otpPresentation(res).cooldown);
        setSuccessMessage(res.message);
      }
    } catch (err: any) {
      if (request.canApply()) {
        setErrorMessage(apiErrorMessage(err, 'Không thể tạo yêu cầu đặt lại mật khẩu lúc này'));
      }
    } finally {
      if (request.isLatest()) setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setErrorMessage('Vui lòng nhập đủ 6 chữ số mã OTP');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }
    const submittedEmail = email;
    const submittedPassword = newPassword;
    const request = beginAuthRequest();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.resetPassword(submittedEmail, code, submittedPassword);
      if (!request.canApply()) return;
      if (!res.success) {
        setErrorMessage(
          res.error || 'Yêu cầu đang được xử lý. Hãy thử lại với cùng mã OTP và mật khẩu mới.',
        );
        return;
      }
      if (res.success) {
        if (res.sessionRequired) {
          requireLoginAfterCompletion();
          return;
        }
        if (res.user) {
          setAuthSession(res.user);
          navigate(res.user.onboardingCompleted ? '/' : '/onboarding', { replace: true });
          return;
        }
        setSuccessMessage('Đặt lại mật khẩu thành công! Hãy đăng nhập với mật khẩu mới.');
        setPassword(submittedPassword);
        setDevOtp(null);
        setForgotOtpRequested(false);
        setOtpDigits(EMPTY_OTP);
        setTimeout(() => {
          if (!request.canApply()) return;
          setBaseMode('login');
          setSuccessMessage(null);
        }, 1500);
      }
    } catch (err: any) {
      if (request.canApply()) setErrorMessage(apiErrorMessage(err, 'Lỗi đặt lại mật khẩu'));
    } finally {
      if (request.isLatest()) setIsLoading(false);
    }
  };

  const retryGoogle = () => {
    if (!googleClientId) return;
    document.getElementById('google-identity-services')?.remove();
    const script = document.createElement('script');
    script.id = 'google-identity-services';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = () => setGoogleStatus('unavailable');
    document.head.appendChild(script);
    setGoogleStatus('loading');
    setGoogleRetry((value) => value + 1);
  };

  const switchMode = (next: 'login' | 'register') => {
    invalidateAuthRequests();
    setBaseMode(next);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const backOutOfVerification = () => {
    invalidateAuthRequests();
    if (mode === 'otp_verify') {
      clearVerifyContext();
      verificationCompletedRef.current = false;
      setVerifyContext(null);
      routeGenerationRef.current += 1;
      setBaseMode('login');
      setErrorMessage(null);
      setSuccessMessage(null);
      setDevOtp(null);
      setTransferDeferred(false);
      setOtpDigits(EMPTY_OTP);
      setActivationPassword('');
      setHasPresetPassword(false);
      navigate('/auth', { replace: true });
    } else if (mode === 'forgot_password') {
      setBaseMode('login');
      setErrorMessage(null);
      setSuccessMessage(null);
      setDevOtp(null);
      setForgotOtpRequested(false);
      setOtpDigits(EMPTY_OTP);
    } else {
      navigate('/landing');
    }
  };

  const startForgotPassword = () => {
    invalidateAuthRequests();
    setBaseMode('forgot_password');
    setErrorMessage(null);
    setSuccessMessage(null);
    setDevOtp(null);
    setForgotOtpRequested(false);
    setOtpDigits(EMPTY_OTP);
  };

  const backToLogin = () => {
    invalidateAuthRequests();
    setForgotOtpRequested(false);
    setDevOtp(null);
    setOtpDigits(EMPTY_OTP);
    setNewPassword('');
    setActivationPassword('');
    setHasPresetPassword(false);
    setBaseMode('login');
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const verifyContextMissing = isVerifyRoute && verifyContext === null;

  return (
    <AuthShell
      mode={mode}
      email={email}
      errorMessage={errorMessage}
      successMessage={successMessage}
      otpDelivered={verifyContext?.delivered}
      devOtp={devOtp}
      hasGuestKitchen={hasGuestKitchen}
      onFillDevOtp={() => setOtpDigits(devOtp ? devOtp.split('') : otpDigits)}
      onBack={backOutOfVerification}
      onModeChange={switchMode}
    >
      <Slide key={mode} direction={mode === 'register' || mode === 'forgot_password' ? 1 : -1}>
        {mode === 'login' && (
          <LoginMode
            googleButtonRef={googleBtnRef}
            googleStatus={googleStatus}
            googleClientId={googleClientId ?? null}
            onRetryGoogle={retryGoogle}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onSubmit={handleLogin}
            isLoading={isLoading}
            onForgotPassword={startForgotPassword}
          />
        )}
        {mode === 'register' && (
          <RegisterMode
            googleButtonRef={googleBtnRef}
            googleStatus={googleStatus}
            googleClientId={googleClientId ?? null}
            onRetryGoogle={retryGoogle}
            turnstileSiteKey={turnstileSiteKey}
            turnstileGeneration={turnstileGeneration}
            onTurnstileToken={handleTurnstileToken}
            name={name}
            onNameChange={setName}
            email={email}
            onEmailChange={setEmail}
            password={password}
            onPasswordChange={setPassword}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onSubmit={handleRegister}
            isLoading={isLoading}
          />
        )}
        {mode === 'otp_verify' && verifyContextMissing && (
          <VerifyUnavailable
            onRegister={() => navigate('/auth?mode=register', { replace: true })}
            onLogin={() => navigate('/auth', { replace: true })}
          />
        )}
        {mode === 'otp_verify' && verifyContext && (
          <OtpMode
            otpDigits={otpDigits}
            otpInputsRef={otpInputsRef}
            onOtpChange={handleOtpChange}
            onOtpKeyDown={handleOtpKeyDown}
            onOtpPaste={handleOtpPaste}
            transferDeferred={transferDeferred}
            otpPurpose={otpPurpose}
            activationPassword={activationPassword}
            hasPresetPassword={hasPresetPassword}
            onActivationPasswordChange={setActivationPassword}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onContinueWithoutTransfer={() => void handleContinueWithoutTransfer()}
            onSubmitVerify={handleVerifyOtp}
            isLoading={isLoading}
            isResending={isResending}
            resendCountdown={resendCountdown}
            onResend={() => void handleResendOtp()}
            delivered={verifyContext.delivered}
            expiresAt={verifyContext.expiresAt}
            errorMessage={errorMessage}
            successMessage={successMessage}
          />
        )}
        {mode === 'forgot_password' && (
          <ForgotPasswordMode
            forgotOtpRequested={forgotOtpRequested}
            email={email}
            onEmailChange={setEmail}
            onRequestOtp={handleRequestForgotOtp}
            otpDigits={otpDigits}
            otpInputsRef={otpInputsRef}
            onOtpChange={handleOtpChange}
            onOtpKeyDown={handleOtpKeyDown}
            onOtpPaste={handleOtpPaste}
            newPassword={newPassword}
            onNewPasswordChange={setNewPassword}
            showPassword={showPassword}
            onToggleShowPassword={() => setShowPassword(!showPassword)}
            onResetPassword={handleResetPassword}
            isLoading={isLoading}
            isResending={isResending}
            resendCountdown={resendCountdown}
            onResend={() => void handleResendOtp()}
            onBackToLogin={backToLogin}
          />
        )}
      </Slide>
    </AuthShell>
  );
};
