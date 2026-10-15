// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthPage } from '../../src/web/pages/AuthPage';
import { VerifyRouteLifecycle } from '../../src/web/features/auth/VerifyRouteLifecycle';
import { useAuthStore } from '../../src/web/stores/useAuthStore';
import {
  VERIFY_CONTEXT_KEY,
  readVerifyContext,
  resendSecondsRemaining,
  writeVerifyContext,
} from '../../src/web/features/auth/verify-context';

// T17 screen 03: `/auth/verify` is a real route over the existing OTP state
// machine. The real AuthPage, auth store and api layer run; only `fetch` is
// replaced. No test here fabricates a verified session.
const EMAIL = 'verify-route@example.test';
const OTP = '493817';
const ACCOUNT = {
  id: 'usr_verify',
  email: EMAIL,
  displayName: 'Verify Route',
  avatarUrl: '',
  householdId: 'hh_usr_verify',
};

const fetchMock = vi.fn<typeof fetch>();
let root: Root | undefined;
let container: HTMLDivElement;
let calls: Array<{ path: string; body: Record<string, unknown> }>;
let registerResponse: { status: number; body: unknown };
let verifyResponses: Array<{ status: number; body: unknown }>;
let resendResponse: { status: number; body: unknown };
let verifyOffline: boolean;
let resendOffline: boolean;
let navigateForTest: NavigateFunction;
let verifyGate: Promise<Response> | null;
let registerGate: Promise<Response> | null;
let loginGate: Promise<Response> | null;
let resendGate: Promise<Response> | null;
let forgotGate: Promise<Response> | null;
let resetGate: Promise<Response> | null;
let resetResponse: { status: number; body: unknown };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function LocationProbe() {
  navigateForTest = useNavigate();
  return <output data-testid="location">{useLocation().pathname}</output>;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

async function until(assertion: () => void) {
  const deadline = Date.now() + 1_500;
  for (;;) {
    await flush();
    try {
      assertion();
      return;
    } catch (failure) {
      if (Date.now() >= deadline) throw failure;
    }
  }
}

async function mount(initialEntry: string) {
  root ??= createRoot(container);
  await act(async () => {
    root!.render(
      <MemoryRouter
        initialEntries={[initialEntry]}
        useTransitions={true}
      >
        <LocationProbe />
        <VerifyRouteLifecycle />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/verify" element={<AuthPage />} />
          <Route
            path="/onboarding"
            element={<output data-testid="onboarding">onboarding</output>}
          />
          <Route path="/landing" element={<output data-testid="landing">landing</output>} />
        </Routes>
      </MemoryRouter>,
    );
  });
  await flush();
}

function location() {
  return container.querySelector('[data-testid="location"]')!.textContent;
}

function buttons() {
  return [...container.querySelectorAll('button')];
}

function button(label: string | RegExp) {
  const found = buttons().find((item) => {
    const text = item.textContent?.trim() || item.getAttribute('aria-label') || '';
    return typeof label === 'string' ? text === label : label.test(text);
  });
  expect(found, `button ${label}`).toBeTruthy();
  return found!;
}

async function click(label: string | RegExp) {
  await act(async () => {
    button(label).click();
  });
  await flush();
}

function setNative(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function otpBoxes() {
  return [...container.querySelectorAll<HTMLInputElement>('form input[inputmode="numeric"]')];
}

function otpValue() {
  return otpBoxes()
    .map((box) => box.value)
    .join('');
}

async function fillRegisterForm() {
  const inputs = [...container.querySelectorAll<HTMLInputElement>('form input')];
  const byPlaceholder = (placeholder: string) =>
    inputs.find((input) => input.placeholder === placeholder)!;
  await act(async () => {
    setNative(byPlaceholder('Nguyễn Văn A'), 'Verify Route');
    setNative(byPlaceholder('ban@example.com'), EMAIL);
    setNative(byPlaceholder('••••••••'), 'strong-password-1');
  });
  await flush();
}

async function registerAndReachVerify() {
  await mount('/auth?mode=register');
  await fillRegisterForm();
  await click('Tạo tài khoản & Nhận mã OTP');
  await until(() => expect(location()).toBe('/auth/verify'));
  await until(() => expect(otpBoxes()).toHaveLength(6));
}

async function typeOtp(code = OTP, choosePassword = true) {
  const activation = container.querySelector<HTMLInputElement>('input[name="activationPassword"]');
  if (choosePassword && activation && !activation.value) {
    await act(async () => setNative(activation, 'owner-chosen-password'));
  }
  for (const [index, digit] of code.split('').entries()) {
    await act(async () => {
      setNative(otpBoxes()[index], digit);
    });
  }
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  sessionStorage.clear();
  useAuthStore.setState({
    userId: '',
    householdId: '',
    email: '',
    isGuest: true,
    isOnboarded: false,
  });
  calls = [];
  verifyResponses = [];
  verifyOffline = false;
  resendOffline = false;
  verifyGate = null;
  registerGate = null;
  loginGate = null;
  resendGate = null;
  forgotGate = null;
  resetGate = null;
  resetResponse = { status: 200, body: { success: true, user: ACCOUNT } };
  registerResponse = {
    status: 200,
    body: {
      success: true,
      message: 'Mã xác thực OTP đã được gửi đến email của bạn.',
      email: EMAIL,
      expiresInMinutes: 10,
    },
  };
  resendResponse = {
    status: 200,
    body: { success: true, message: 'Đã gửi lại mã OTP mới.', expiresInMinutes: 7, otpDelivered: true },
  };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const path = new URL(String(input), 'https://takosan.example.test').pathname;
    if (path.endsWith('/config')) return response({ turnstileSiteKey: null, googleClientId: null });
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    calls.push({ path, body });
    if (path.endsWith('/auth/register')) {
      if (registerGate) return registerGate;
      return response(registerResponse.body, registerResponse.status);
    }
    if (path.endsWith('/auth/login')) {
      if (loginGate) return loginGate;
      throw new Error('unexpected login request');
    }
    if (path.endsWith('/auth/forgot-password')) {
      return forgotGate ?? response({ success: true, message: 'Nếu tài khoản tồn tại, hãy kiểm tra email.',
        otpKeyIssuedAtMs: 1_792_000_000_000, otpDelivered: false, deliveryState: 'pending', retryAfterSeconds: 0 });
    }
    if (path.endsWith('/auth/reset-password')) {
      return resetGate ?? response(resetResponse.body, resetResponse.status);
    }
    if (path.endsWith('/auth/verify-otp')) {
      if (verifyOffline) throw new TypeError('network unavailable');
      if (verifyGate) return verifyGate;
      const next = verifyResponses.shift();
      if (!next) throw new Error(`unexpected verify-otp call #${calls.length}`);
      return response(next.body, next.status);
    }
    if (path.endsWith('/auth/resend-otp')) {
      if (resendOffline) throw new TypeError('network unavailable');
      if (resendGate) return resendGate;
      return response(resendResponse.body, resendResponse.status);
    }
    throw new Error(`unexpected fetch ${path}`);
  });
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = undefined;
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('screen 03 — /auth/verify route', () => {
  it('direct load without a verification in progress states so and offers real exits, never an OTP form', async () => {
    await mount('/auth/verify');
    expect(container.querySelector('[data-testid="verify-context-missing"]')).toBeTruthy();
    expect(container.textContent).toContain('Không có yêu cầu xác thực đang chờ');
    expect(otpBoxes()).toHaveLength(0);
    expect(container.querySelector('h1')?.textContent).toBe('Xác thực mã OTP');
    // No network request is made on behalf of an unknown user.
    expect(calls).toEqual([]);
    await click('Đăng nhập bằng tài khoản đã có');
    expect(location()).toBe('/auth');
    expect(container.textContent).toContain('Đăng nhập vào Takolio');
  });

  it('missing-context exit to registration opens the register mode', async () => {
    await mount('/auth/verify');
    await click('Tạo tài khoản mới');
    expect(location()).toBe('/auth');
    expect(container.textContent).toContain('Tạo tài khoản Takolio');
  });

  it('registration navigates to /auth/verify with the email, a 60s cooldown and a tab-scoped context that never holds the code', async () => {
    registerResponse = {
      status: 200,
      body: {
        success: true,
        message: 'Mã xác thực OTP đã được gửi đến email của bạn.',
        email: EMAIL,
        expiresInMinutes: 10,
        devOtp: OTP,
      },
    };
    const startedAt = Date.now();
    await registerAndReachVerify();
    expect(container.textContent).toContain(`Nhập 6 số mã OTP để xác thực ${EMAIL}`);
    expect(container.textContent).toMatch(/Gửi lại sau \(\d+s\)/);
    const context = readVerifyContext();
    expect(context).toMatchObject({ email: EMAIL, delivered: null });
    expect(context?.expiresAt).toBeGreaterThanOrEqual(startedAt + 10 * 60_000);
    expect(context?.expiresAt).toBeLessThanOrEqual(Date.now() + 10 * 60_000);
    expect(resendSecondsRemaining(context)).toBeGreaterThan(55);
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toContain(
      'Mã hết hạn lúc',
    );
    const rawContext = sessionStorage.getItem(VERIFY_CONTEXT_KEY)!;
    expect(rawContext).not.toContain(OTP);
    expect(rawContext).not.toContain('strong-password-1');
    expect(rawContext.toLowerCase()).not.toMatch(/"(?:otp|code|token|password)"/);
    expect(Object.keys(JSON.parse(rawContext) as Record<string, unknown>).sort()).toEqual([
      'delivered',
      'email',
      'expiresAt',
      'owner',
      'resendAvailableAt',
    ]);
    expect(localStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
  });

  it('does not let a delayed registration response revive verification after the user switches modes', async () => {
    let release!: (value: Response) => void;
    registerGate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await mount('/auth?mode=register');
    await fillRegisterForm();
    await act(async () => button('Tạo tài khoản & Nhận mã OTP').click());
    await until(() => expect(calls.some(({ path }) => path.endsWith('/auth/register'))).toBe(true));
    await click('Đăng nhập');

    release(response(registerResponse.body, registerResponse.status));
    await flush();
    expect(location()).toBe('/auth');
    expect(container.textContent).toContain('Đăng nhập vào Takolio');
    expect(readVerifyContext()).toBeNull();
  });

  it('does not let a delayed unverified-login response attach to a replacement session', async () => {
    let release!: (value: Response) => void;
    loginGate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await mount('/auth');
    const inputs = [...container.querySelectorAll<HTMLInputElement>('form input')];
    await act(async () => {
      setNative(inputs.find((input) => input.placeholder === 'ban@example.com')!, EMAIL);
      setNative(inputs.find((input) => input.placeholder === '••••••••')!, 'strong-password-1');
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    });
    await until(() => expect(calls.some(({ path }) => path.endsWith('/auth/login'))).toBe(true));
    await act(async () => useAuthStore.getState().setAuthSession(ACCOUNT));

    release(
      response(
        {
          error: 'Account verification required',
          requireOtp: true,
          otpDelivered: true,
        },
        401,
      ),
    );
    await flush();
    expect(location()).toBe('/auth');
    expect(readVerifyContext()).toBeNull();
    expect(localStorage.getItem('frigo_user_id')).toBe(ACCOUNT.id);
  });

  it('does not let a delayed login response navigate after the auth route is abandoned', async () => {
    let release!: (value: Response) => void;
    loginGate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await mount('/auth');
    const inputs = [...container.querySelectorAll<HTMLInputElement>('form input')];
    await act(async () => {
      setNative(inputs.find((input) => input.placeholder === 'ban@example.com')!, EMAIL);
      setNative(inputs.find((input) => input.placeholder === '••••••••')!, 'strong-password-1');
      container.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click();
    });
    await until(() => expect(calls.some(({ path }) => path.endsWith('/auth/login'))).toBe(true));
    await act(async () => navigateForTest('/landing'));

    release(
      response(
        {
          error: 'Account verification required',
          requireOtp: true,
          otpDelivered: true,
        },
        401,
      ),
    );
    await flush();
    expect(location()).toBe('/landing');
    expect(readVerifyContext()).toBeNull();
  });

  it('refresh of /auth/verify restores the verification (email, cooldown) from the tab-scoped context and completes with the server', async () => {
    writeVerifyContext({ email: EMAIL, resendAvailableAt: Date.now() + 42_000, delivered: true });
    verifyResponses.push({ status: 200, body: { success: true, message: 'ok', user: ACCOUNT } });
    await mount('/auth/verify');
    expect(container.querySelector('[data-testid="verify-context-missing"]')).toBeNull();
    expect(container.textContent).toContain(`Nhập 6 số mã OTP đã gửi tới ${EMAIL}`);
    expect(container.textContent).toMatch(/Gửi lại sau \(4[0-2]s\)/);
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    await until(() => expect(container.textContent).toContain('Xác thực tài khoản thành công!'));
    expect(calls.at(-1)).toEqual({
      path: '/api/v1/auth/verify-otp',
      body: { email: EMAIL, code: OTP, purpose: 'register', newPassword: 'owner-chosen-password' },
    });
    // Verification consumed: the context is gone so a later visit is honest.
    expect(readVerifyContext()).toBeNull();
    await until(() => expect(container.querySelector('[data-testid="onboarding"]')).toBeTruthy());
  });

  it('restored context whose email was never delivered shows the delivery problem and enables resend immediately', async () => {
    writeVerifyContext({ email: EMAIL, resendAvailableAt: 0, delivered: false });
    await mount('/auth/verify');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Email OTP chưa gửi được. Hãy bấm gửi lại mã.',
    );
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
  });

  it('typing advances focus, backspace on an empty box moves back, and non-digits are rejected', async () => {
    await registerAndReachVerify();
    const boxes = otpBoxes();
    boxes[0].focus();
    await act(async () => {
      setNative(boxes[0], '4');
    });
    expect(document.activeElement).toBe(boxes[1]);
    await act(async () => {
      setNative(boxes[1], 'x');
    });
    expect(boxes[1].value).toBe('');
    expect(document.activeElement).toBe(boxes[1]);
    await act(async () => {
      setNative(boxes[1], '9');
    });
    expect(document.activeElement).toBe(boxes[2]);
    await act(async () => {
      boxes[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    });
    expect(document.activeElement).toBe(boxes[1]);
    expect(otpValue()).toBe('49');
    // Every digit box is labelled for screen readers and uses OTP autofill.
    for (const [index, box] of boxes.entries()) {
      expect(box.getAttribute('aria-label')).toBe(`Chữ số ${index + 1} của 6`);
      expect(box.getAttribute('autocomplete')).toBe('one-time-code');
      expect(box.getAttribute('inputmode')).toBe('numeric');
    }
    expect(container.querySelector('[role="group"][aria-labelledby]')).toBeTruthy();
  });

  it('pasting a full code fills all six boxes (digits only) and lands focus on the last box', async () => {
    await registerAndReachVerify();
    const group = container.querySelector<HTMLElement>('[role="group"]')!;
    const paste = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', { value: { getData: () => ' 49-38 17abc' } });
    await act(async () => {
      group.dispatchEvent(paste);
    });
    expect(otpValue()).toBe(OTP);
    expect(document.activeElement).toBe(otpBoxes()[5]);
  });

  it('submitting fewer than six digits is refused locally with an announced error and no request', async () => {
    await registerAndReachVerify();
    const requestsBefore = calls.length;
    await typeOtp('4');
    await click('Xác thực & Hoàn tất');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Vui lòng nhập đủ 6 chữ số mã OTP',
    );
    expect(calls.length).toBe(requestsBefore);
  });

  it.each([
    ['invalid', 400, 'Mã OTP không chính xác hoặc đã được sử dụng'],
    ['expired', 400, 'Mã OTP đã hết hạn. Vui lòng bấm gửi lại mã mới.'],
    ['rate-limited', 429, 'Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.'],
  ])(
    '%s verification failure stays server-authoritative on /auth/verify',
    async (_case, status, error) => {
      verifyResponses.push({
        status,
        body: { error },
      });
      await registerAndReachVerify();
      await typeOtp();
      await click('Xác thực & Hoàn tất');
      await until(() =>
        expect(container.querySelector('[role="alert"]')?.textContent).toContain(error),
      );
      expect(location()).toBe('/auth/verify');
      expect(localStorage.getItem('frigo_user_id')).toBeFalsy();
      expect(readVerifyContext()).toMatchObject({ email: EMAIL });
    },
  );

  it('shows locally elapsed metadata without replacing the server as final OTP authority', async () => {
    writeVerifyContext({
      email: EMAIL,
      resendAvailableAt: 0,
      expiresAt: Date.now() - 1_000,
      delivered: true,
    });
    await mount('/auth/verify');
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toContain(
      'Mã đã hết hạn theo thời hạn máy chủ trả về',
    );
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toContain(
      'Máy chủ vẫn xác nhận kết quả cuối cùng',
    );
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
  });

  it('reports an offline verification without consuming context or establishing a local session', async () => {
    verifyOffline = true;
    await registerAndReachVerify();
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    await until(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'Không thể kết nối máy chủ. Mã OTP chưa được xác nhận',
      ),
    );
    expect(readVerifyContext()).toMatchObject({ email: EMAIL });
    expect(localStorage.getItem('frigo_user_id')).toBeNull();
  });

  it('resend is locked during the cooldown, then re-requests with the same email and purpose and restarts the cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await registerAndReachVerify();
    expect(button(/Gửi lại sau/).disabled).toBe(true);
    // The countdown is a chain of 1s timers; advance second by second.
    for (let second = 0; second < 61; second++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }
    const resend = button(/Gửi lại mã OTP/);
    expect(resend.disabled).toBe(false);
    const oldExpiry = readVerifyContext()?.expiresAt;
    const startedAt = Date.now();
    await act(async () => {
      resend.click();
    });
    await until(() => expect(container.textContent).toContain('Đã gửi lại mã OTP mới.'));
    expect(calls.at(-1)).toMatchObject({
      path: '/api/v1/auth/resend-otp',
      body: { email: EMAIL, purpose: 'register' },
    });
    expect(container.textContent).toMatch(/Gửi lại sau \(\d+s\)/);
    expect(resendSecondsRemaining(readVerifyContext())).toBeGreaterThan(55);
    expect(readVerifyContext()?.expiresAt).toBeGreaterThanOrEqual(startedAt + 7 * 60_000);
    expect(readVerifyContext()?.expiresAt).toBeLessThanOrEqual(Date.now() + 7 * 60_000);
    expect(readVerifyContext()?.expiresAt).not.toBe(oldExpiry);
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toContain(
      'Mã hết hạn lúc',
    );
  });

  it.each([false, true])('restores fresh resend metadata after refresh without persisting credentials (dev OTP: %s)', async (development) => {
    writeVerifyContext({ email: EMAIL, resendAvailableAt: 0, delivered: false });
    resendResponse.body = {
      success: true,
      message: 'Đã gửi lại mã OTP mới.',
      expiresInMinutes: 3,
      otpDelivered: development ? undefined : true,
      ...(development ? { devOtp: OTP } : {}),
      otp: OTP,
      code: OTP,
      password: 'not-for-storage',
      token: 'not-for-storage',
      resetToken: 'not-for-storage',
    };
    await mount('/auth/verify');
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    const startedAt = Date.now();
    await click(/Gửi lại mã OTP/);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    const context = readVerifyContext()!;
    expect(context).toMatchObject({
      email: EMAIL,
      delivered: development ? null : true,
      owner: { userId: '', householdId: '' },
    });
    expect(context.expiresAt).toBeGreaterThanOrEqual(startedAt + 3 * 60_000);
    expect(context.expiresAt).toBeLessThanOrEqual(Date.now() + 3 * 60_000);
    expect(resendSecondsRemaining(context)).toBeGreaterThan(55);
    const persisted = sessionStorage.getItem(VERIFY_CONTEXT_KEY)!;
    expect(Object.keys(JSON.parse(persisted)).sort()).toEqual([
      'delivered', 'email', 'expiresAt', 'owner', 'resendAvailableAt',
    ]);
    expect(persisted).not.toContain(OTP);
    expect(persisted).not.toContain('not-for-storage');
    expect(localStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
    const expiryText = container.querySelector('[data-testid="otp-expiry"]')?.textContent;

    await act(async () => root!.unmount());
    root = undefined;
    await mount('/auth/verify');
    expect(readVerifyContext()).toEqual(context);
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toBe(expiryText);
    expect(container.textContent).toContain('Mã hết hạn lúc');
    expect(otpValue()).toBe('');
  });

  it.each([undefined, null, '10', 0, -1, 1441, {}])('uses honest unknown expiry for malformed resend duration %j', async (expiresInMinutes) => {
    writeVerifyContext({
      email: EMAIL,
      resendAvailableAt: 0,
      expiresAt: Date.now() + 10 * 60_000,
      delivered: true,
    });
    resendResponse.body = { success: true, message: 'Đã gửi lại mã OTP mới.', expiresInMinutes, otpDelivered: true };
    await mount('/auth/verify');
    await click(/Gửi lại mã OTP/);
    expect(readVerifyContext()).toMatchObject({ email: EMAIL, delivered: true, expiresAt: null });
    expect(resendSecondsRemaining(readVerifyContext())).toBeGreaterThan(55);
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toContain(
      'Máy chủ chưa cung cấp thời hạn cho mã này',
    );
  });

  it('a resent code reaching local expiry still submits to the server for the final decision', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    writeVerifyContext({ email: EMAIL, resendAvailableAt: 0, delivered: true });
    resendResponse.body = { success: true, message: 'Đã gửi lại mã OTP mới.', expiresInMinutes: 0.01 };
    verifyResponses.push({ status: 200, body: { success: true, user: ACCOUNT } });
    await mount('/auth/verify');
    await click(/Gửi lại mã OTP/);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toContain(
      'Mã đã hết hạn theo thời hạn máy chủ trả về',
    );
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    expect(calls.at(-1)).toMatchObject({
      path: '/api/v1/auth/verify-otp', body: { email: EMAIL, purpose: 'register', code: OTP },
    });
    expect(localStorage.getItem('frigo_user_id')).toBe(ACCOUNT.id);
    expect(readVerifyContext()).toBeNull();
  });

  it.each(['leave-and-return', 'session-change', 'logout'] as const)('ignores a delayed resend after %s', async (transition) => {
    let release!: (value: Response) => void;
    resendGate = new Promise<Response>((resolve) => { release = resolve; });
    writeVerifyContext({ email: EMAIL, resendAvailableAt: 0, delivered: true });
    await mount('/auth/verify');
    await act(async () => button(/Gửi lại mã OTP/).click());
    await until(() => expect(calls.some(({ path }) => path.endsWith('/auth/resend-otp'))).toBe(true));
    if (transition === 'leave-and-return') {
      await act(async () => navigateForTest('/auth'));
      await act(async () => navigateForTest(-1));
    } else if (transition === 'session-change') {
      await act(async () => useAuthStore.getState().setAuthSession(ACCOUNT));
    } else {
      fetchMock.mockResolvedValueOnce(response({ success: true }));
      await act(async () => { await useAuthStore.getState().logout(); });
    }
    release(response(resendResponse.body));
    await flush();
    expect(readVerifyContext()).toBeNull();
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
    expect(container.textContent).not.toContain('Đã gửi lại mã OTP mới.');
  });

  it('OTP_DELIVERY_UNAVAILABLE on register still reaches /auth/verify honestly: error shown, no cooldown, context marked undelivered', async () => {
    registerResponse = {
      status: 503,
      body: {
        error: 'Email OTP chưa gửi được.',
        code: 'OTP_DELIVERY_UNAVAILABLE',
        accountCreated: true,
      },
    };
    await registerAndReachVerify();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'Tài khoản đã được lưu nhưng email OTP chưa gửi được',
    );
    expect(container.querySelector('[data-testid="otp-expiry"]')?.textContent).toContain(
      'Chưa có mã đang hoạt động vì email OTP chưa gửi được',
    );
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
    expect(readVerifyContext()).toMatchObject({
      email: EMAIL,
      delivered: false,
      resendAvailableAt: 0,
    });
  });

  it('a failed resend surfaces the server error and leaves resend available', async () => {
    resendResponse = { status: 429, body: { error: 'Vui lòng chờ trước khi gửi lại mã.' } };
    registerResponse = {
      status: 503,
      body: {
        error: 'Email OTP chưa gửi được.',
        code: 'OTP_DELIVERY_UNAVAILABLE',
        accountCreated: true,
      },
    };
    await registerAndReachVerify();
    await click(/Gửi lại mã OTP/);
    await until(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'Vui lòng chờ trước khi gửi lại mã.',
      ),
    );
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
  });

  it('invalidates stale delivery and expiry claims when the server cannot deliver a replacement', async () => {
    writeVerifyContext({
      email: EMAIL,
      resendAvailableAt: 0,
      expiresAt: Date.now() + 10 * 60_000,
      delivered: true,
    });
    resendResponse = {
      status: 503,
      body: { error: 'Email OTP chưa gửi được.', code: 'OTP_DELIVERY_UNAVAILABLE' },
    };
    await mount('/auth/verify');
    await click(/Gửi lại mã OTP/);
    await until(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'Email OTP chưa gửi được.',
      ),
    );
    expect(readVerifyContext()).toMatchObject({
      delivered: false,
      expiresAt: null,
      resendAvailableAt: 0,
    });
  });

  it('reports an offline resend without fabricating delivery or expiry metadata', async () => {
    writeVerifyContext({
      email: EMAIL,
      resendAvailableAt: 0,
      expiresAt: Date.now() + 10 * 60_000,
      delivered: true,
    });
    resendOffline = true;
    await mount('/auth/verify');
    await click(/Gửi lại mã OTP/);
    await until(() =>
      expect(container.querySelector('[role="alert"]')?.textContent).toContain(
        'Không thể kết nối máy chủ. Chưa gửi lại mã OTP',
      ),
    );
    expect(readVerifyContext()).toMatchObject({ delivered: null, expiresAt: null });
    expect(button(/Gửi lại mã OTP/).disabled).toBe(false);
  });

  it('back from /auth/verify returns to login and clears the tab-scoped context, so re-entering the route is honest', async () => {
    await registerAndReachVerify();
    await click('Quay lại');
    expect(location()).toBe('/auth');
    expect(container.textContent).toContain('Đăng nhập vào Takolio');
    expect(readVerifyContext()).toBeNull();
    await act(async () => {
      root?.unmount();
    });
    root = undefined;
    await mount('/auth/verify');
    expect(container.querySelector('[data-testid="verify-context-missing"]')).toBeTruthy();
  });

  it('browser back clears verification so browser forward cannot revive the OTP form', async () => {
    await registerAndReachVerify();
    await act(async () => navigateForTest(-1));
    await until(() => expect(location()).toBe('/auth'));
    expect(readVerifyContext()).toBeNull();
    await act(async () => navigateForTest(1));
    await until(() => expect(location()).toBe('/auth/verify'));
    expect(container.querySelector('[data-testid="verify-context-missing"]')).toBeTruthy();
    expect(otpBoxes()).toHaveLength(0);
  });

  it('ignores an in-flight verification result after the user leaves the route', async () => {
    let release!: (value: Response) => void;
    verifyGate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    await registerAndReachVerify();
    await typeOtp();
    await act(async () => button('Xác thực & Hoàn tất').click());
    await act(async () => navigateForTest('/auth'));
    await until(() => expect(location()).toBe('/auth'));
    expect(container.querySelector<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(
      false,
    );
    release(response({ success: true, user: ACCOUNT }));
    await flush();
    expect(location()).toBe('/auth');
    expect(container.querySelector<HTMLButtonElement>('form button[type="submit"]')?.disabled).toBe(
      false,
    );
    expect(localStorage.getItem('frigo_user_id')).toBeNull();
    expect(readVerifyContext()).toBeNull();
  });

  it('a corrupt stored context is treated as absent', () => {
    sessionStorage.setItem(VERIFY_CONTEXT_KEY, '{not json');
    expect(readVerifyContext()).toBeNull();
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
    sessionStorage.setItem(VERIFY_CONTEXT_KEY, JSON.stringify({ email: '' }));
    expect(readVerifyContext()).toBeNull();
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
    sessionStorage.setItem(
      VERIFY_CONTEXT_KEY,
      JSON.stringify({
        email: EMAIL,
        resendAvailableAt: 0,
        delivered: true,
        otp: OTP,
      }),
    );
    expect(readVerifyContext()).toBeNull();
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
  });

  it('migrates the safe anonymous legacy context and rejects an owner mismatch', () => {
    sessionStorage.setItem(
      VERIFY_CONTEXT_KEY,
      JSON.stringify({ email: EMAIL, resendAvailableAt: 0, delivered: true }),
    );
    expect(readVerifyContext()).toMatchObject({
      email: EMAIL,
      expiresAt: null,
      owner: { userId: '', householdId: '' },
    });
    expect(JSON.parse(sessionStorage.getItem(VERIFY_CONTEXT_KEY)!)).toHaveProperty('owner');

    localStorage.setItem('frigo_user_id', 'guest-a');
    localStorage.setItem('frigo_household_id', 'hh_guest_a');
    writeVerifyContext({ email: EMAIL, resendAvailableAt: 0, delivered: true });
    localStorage.setItem('frigo_household_id', 'hh_guest_b');
    expect(readVerifyContext()).toBeNull();
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
  });
  it('projects server expiry onto presentation without using the skewed client epoch for authority', async () => {
    registerResponse.body = { success: true, message: 'Mã đã được gửi.', otpDelivered: true,
      deliveryState: 'accepted', otpKeyIssuedAtMs: 1_792_000_000_000,
      otpExpiresAtMs: 1_792_000_330_000, retryAfterSeconds: 23 };
    const before = Date.now();
    await registerAndReachVerify();
    const context = readVerifyContext()!;
    expect(context.expiresAt).toBeGreaterThanOrEqual(before + 330_000);
    expect(context.expiresAt).toBeLessThanOrEqual(Date.now() + 330_000);
    expect(context.delivered).toBe(true);
    expect(resendSecondsRemaining(context)).toBeGreaterThan(20);
    expect(resendSecondsRemaining(context)).toBeLessThanOrEqual(23);
  });

  it('a pending 202 receipt does not claim accepted email delivery', async () => {
    registerResponse = { status: 202, body: { success: true, message: 'Đang xử lý yêu cầu.',
      otpKeyIssuedAtMs: 1_792_000_000_000, otpDelivered: false, deliveryState: 'pending', retryAfterSeconds: 44 } };
    await registerAndReachVerify();
    expect(readVerifyContext()?.delivered).toBeNull();
    expect(container.textContent).toContain('Máy chủ chưa xác nhận trạng thái gửi email');
    expect(resendSecondsRemaining(readVerifyContext())).toBeGreaterThan(40);
  });

  it.each([
    ['OTP_DELIVERY_UNAVAILABLE', 'rejected', false],
    ['OTP_DELIVERY_UNKNOWN', 'delivery_unknown', null],
  ] as const)('%s preserves server cooldown and honest delivery state', async (code, deliveryState, delivered) => {
    registerResponse = { status: 503, body: { error: 'Máy chủ chưa xác nhận email.', code,
      accountCreated: true, otpKeyIssuedAtMs: 1_792_000_000_000, otpDelivered: false,
      deliveryState, retryAfterSeconds: 37 } };
    await registerAndReachVerify();
    expect(readVerifyContext()).toMatchObject({ delivered, expiresAt: null });
    expect(resendSecondsRemaining(readVerifyContext())).toBeGreaterThan(33);
    expect(button(/Gửi lại sau/).disabled).toBe(true);
    expect(localStorage.getItem('frigo_user_id')).toBeNull();
  });

  it('completed verification replay offers login and keeps the current guest identity', async () => {
    localStorage.setItem('frigo_user_id', 'guest-replay');
    localStorage.setItem('frigo_household_id', 'hh_guest_replay');
    useAuthStore.setState({ userId: 'guest-replay', householdId: 'hh_guest_replay', isGuest: true });
    verifyResponses.push({ status: 200, body: { success: true, replayed: true, sessionRequired: true } });
    await registerAndReachVerify();
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    await until(() => expect(location()).toBe('/auth'));
    expect(container.textContent).toContain('Hãy đăng nhập để xác nhận phiên tài khoản');
    expect(container.textContent).toContain('Đăng nhập vào Takolio');
    expect(localStorage.getItem('frigo_user_id')).toBe('guest-replay');
    expect(localStorage.getItem('frigo_household_id')).toBe('hh_guest_replay');
    expect(readVerifyContext()).toBeNull();
  });

  it('in-progress verification reports retry status without claiming completion or losing context', async () => {
    verifyResponses.push({ status: 202, body: { success: false, code: 'OTP_IN_PROGRESS',
      error: 'Yêu cầu đang được xử lý. Vui lòng thử lại cùng yêu cầu.' } });
    await registerAndReachVerify();
    const context = readVerifyContext();
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Vui lòng thử lại cùng yêu cầu');
    expect(location()).toBe('/auth/verify');
    expect(readVerifyContext()).toEqual(context);
    expect(localStorage.getItem('frigo_user_id')).toBeNull();
  });

  it('verification budget denial preserves challenge metadata and applies Retry-After to resend', async () => {
    verifyResponses.push({ status: 429, body: { error: 'Hãy chờ trước khi thử lại.',
      code: 'OTP_BUDGET_EXHAUSTED', retryAfterSeconds: 83 } });
    await registerAndReachVerify();
    const original = readVerifyContext();
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    expect(readVerifyContext()?.expiresAt).toBe(original?.expiresAt);
    expect(resendSecondsRemaining(readVerifyContext())).toBeGreaterThan(79);
    expect(button(/Gửi lại sau/).disabled).toBe(true);
  });

  it('a delayed forgot-password reply cannot revive the reset form after returning to login', async () => {
    let release!: (value: Response) => void;
    forgotGate = new Promise<Response>((resolve) => { release = resolve; });
    await mount('/auth');
    await click('Quên mật khẩu?');
    await act(async () => setNative(container.querySelector<HTMLInputElement>('form input[type="email"]')!, EMAIL));
    await act(async () => button('Gửi mã OTP khôi phục').click());
    await until(() => expect(calls.some(({ path }) => path.endsWith('/auth/forgot-password'))).toBe(true));
    await click('← Quay lại màn hình đăng nhập');
    release(response({ success: true, message: 'Nếu tài khoản tồn tại, hãy kiểm tra email.' }));
    await flush();
    expect(container.textContent).toContain('Đăng nhập vào Takolio');
    expect(otpBoxes()).toHaveLength(0);
    expect(container.textContent).not.toContain('Nếu tài khoản tồn tại');
  });

  it('forgot-password resend uses its purpose and does not add preliminary verification', async () => {
    await mount('/auth');
    await click('Quên mật khẩu?');
    await act(async () => setNative(container.querySelector<HTMLInputElement>('form input[type="email"]')!, EMAIL));
    await click('Gửi mã OTP khôi phục');
    await click('Gửi lại mã OTP');
    expect(calls.at(-1)).toMatchObject({ path: '/api/v1/auth/resend-otp', body: { email: EMAIL, purpose: 'forgot_password' } });
    expect(calls.some(({ path }) => path.endsWith('/auth/verify-otp'))).toBe(false);
    expect(container.textContent).toContain('Đã gửi lại mã OTP mới.');
  });

  it.each(['back-to-login', 'replacement-session'] as const)('a delayed final reset cannot establish a session after %s', async (transition) => {
    let release!: (value: Response) => void;
    resetGate = new Promise<Response>((resolve) => { release = resolve; });
    await mount('/auth');
    await click('Quên mật khẩu?');
    await act(async () => setNative(container.querySelector<HTMLInputElement>('form input[type="email"]')!, EMAIL));
    await click('Gửi mã OTP khôi phục');
    await typeOtp();
    await act(async () => setNative(container.querySelector<HTMLInputElement>('input[name="newPassword"]')!, 'new-password-1'));
    await act(async () => button('Lưu mật khẩu mới & Đăng nhập').click());
    await until(() => expect(calls.some(({ path }) => path.endsWith('/auth/reset-password'))).toBe(true));
    if (transition === 'back-to-login') await click('← Quay lại màn hình đăng nhập');
    else await act(async () => useAuthStore.getState().setAuthSession({ ...ACCOUNT, id: 'replacement-user', householdId: 'replacement-house' }));
    release(response({ success: true, user: ACCOUNT }));
    await flush();
    expect(location()).toBe('/auth');
    expect(localStorage.getItem('frigo_user_id')).toBe(transition === 'back-to-login' ? null : 'replacement-user');
  });

  it('final reset completion replay returns to login without claiming a new local session', async () => {
    resetResponse = { status: 200, body: { success: true, replayed: true, sessionRequired: true } };
    await mount('/auth');
    await click('Quên mật khẩu?');
    await act(async () => setNative(container.querySelector<HTMLInputElement>('form input[type="email"]')!, EMAIL));
    await click('Gửi mã OTP khôi phục');
    await typeOtp();
    await act(async () => setNative(container.querySelector<HTMLInputElement>('input[name="newPassword"]')!, 'new-password-1'));
    await click('Lưu mật khẩu mới & Đăng nhập');
    expect(container.textContent).toContain('Đăng nhập vào Takolio');
    expect(container.textContent).toContain('Hãy đăng nhập để xác nhận phiên tài khoản');
    expect(localStorage.getItem('frigo_user_id')).toBeNull();
    expect(calls.some(({ path }) => path.endsWith('/auth/verify-otp'))).toBe(false);
  });

  it('direct verification asks the mailbox owner to choose an activation password without restoring it from storage', async () => {
    writeVerifyContext({ email: EMAIL, resendAvailableAt: 0, delivered: true });
    await mount('/auth/verify');
    const field = container.querySelector<HTMLInputElement>('input[name="activationPassword"]')!;
    expect(field.value).toBe('');
    expect(field.required).toBe(true);
    expect(field.getAttribute('autocomplete')).toBe('new-password');
    expect(container.textContent).toContain('mật khẩu của yêu cầu đăng ký trước sẽ được thay thế');
    await typeOtp(OTP, false);
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Hãy chọn mật khẩu từ 6 đến 100 ký tự');
    expect(calls.some(({ path }) => path.endsWith('/auth/verify-otp'))).toBe(false);
    verifyResponses.push({ status: 200, body: { success: true, user: ACCOUNT } });
    await act(async () => setNative(field, 'mailbox-owner-password'));
    await click('Xác thực & Hoàn tất');
    expect(calls.at(-1)?.body).toMatchObject({ newPassword: 'mailbox-owner-password' });
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).toBeNull();
    expect(localStorage.getItem('mailbox-owner-password')).toBeNull();
  });

  it('the verifier can replace the current registration password before account activation', async () => {
    verifyResponses.push({ status: 200, body: { success: true, user: ACCOUNT } });
    await registerAndReachVerify();
    const field = container.querySelector<HTMLInputElement>('input[name="activationPassword"]')!;
    expect(field.value).toBe('strong-password-1');
    await act(async () => setNative(field, 'chosen-at-verification'));
    await typeOtp();
    await click('Xác thực & Hoàn tất');
    expect(calls.at(-1)?.body).toMatchObject({ email: EMAIL, code: OTP, purpose: 'register', newPassword: 'chosen-at-verification' });
    expect(calls.at(-1)?.body).not.toHaveProperty('password');
  });

  it('an unverified login opens verification with an empty activation password field', async () => {
    loginGate = Promise.resolve(response({ error: 'Account verification required', requireOtp: true,
      otpDelivered: true, deliveryState: 'accepted', expiresInMinutes: 10 }, 403));
    await mount('/auth');
    const fields = [...container.querySelectorAll<HTMLInputElement>('form input')];
    await act(async () => {
      setNative(fields.find((field) => field.placeholder === 'ban@example.com')!, EMAIL);
      setNative(fields.find((field) => field.placeholder === '••••••••')!, 'password-from-login');
    });
    await act(async () => container.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click());
    await until(() => expect(location()).toBe('/auth/verify'));
    expect(container.querySelector<HTMLInputElement>('input[name="activationPassword"]')!.value).toBe('');
    expect(sessionStorage.getItem(VERIFY_CONTEXT_KEY)).not.toContain('password-from-login');
  });

  it('an in-progress unverified login reaches verification and asks for a chosen password', async () => {
    loginGate = Promise.resolve(response({ success: true, code: 'OTP_IN_PROGRESS', requireOtp: true,
      otpDelivered: false, deliveryState: 'pending', retryAfterSeconds: 60 }, 202));
    await mount('/auth');
    const fields = [...container.querySelectorAll<HTMLInputElement>('form input')];
    await act(async () => {
      setNative(fields.find((field) => field.placeholder === 'ban@example.com')!, EMAIL);
      setNative(fields.find((field) => field.placeholder === '••••••••')!, 'password-from-login');
    });
    await act(async () => container.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click());
    await until(() => expect(location()).toBe('/auth/verify'));
    expect(container.querySelector<HTMLInputElement>('input[name="activationPassword"]')!.value).toBe('');
    expect(container.textContent).toContain('Hãy chọn mật khẩu để hoàn tất tài khoản');
    expect(readVerifyContext()?.delivered).toBeNull();
    expect(resendSecondsRemaining(readVerifyContext())).toBeGreaterThan(55);
  });

});
