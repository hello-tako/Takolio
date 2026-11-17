import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { ActionButton } from '../../design-system/v4/AtelierPrimitives';

interface OtpModeProps {
  otpDigits: string[];
  otpInputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onOtpChange: (index: number, value: string) => void;
  onOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOtpPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  transferDeferred: boolean;
  otpPurpose: 'register' | 'forgot_password';
  activationPassword: string;
  hasPresetPassword?: boolean;
  onActivationPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onContinueWithoutTransfer: () => void;
  onSubmitVerify: (e: React.FormEvent) => void;
  isLoading: boolean;
  isResending: boolean;
  resendCountdown: number;
  onResend: () => void;
  delivered: boolean | null;
  expiresAt: number | null;
  errorMessage: string | null;
  successMessage: string | null;
}

/** Six-digit verification (screen 03): paste support, zero double-password friction
 *  when password was already captured in-memory from RegisterMode, compact recovery
 *  password field on cold tab reload, and honest transfer-deferred continuation (DEC-012). */
export const OtpMode: React.FC<OtpModeProps> = ({
  otpDigits,
  otpInputsRef,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  transferDeferred,
  otpPurpose,
  activationPassword,
  hasPresetPassword = false,
  onActivationPasswordChange,
  showPassword,
  onToggleShowPassword,
  onContinueWithoutTransfer,
  onSubmitVerify,
  isLoading,
  isResending,
  resendCountdown,
  onResend,
  delivered,
  expiresAt,
  errorMessage,
  successMessage,
}) => {
  const otpGroupId = useId();
  const activationPasswordId = useId();
  const activationPasswordHelpId = useId();
  const [expired, setExpired] = useState(() => expiresAt !== null && expiresAt <= Date.now());
  const [overrideOpen, setOverrideOpen] = useState(false);

  useEffect(() => {
    if (expiresAt === null) {
      setExpired(false);
      return;
    }
    const remaining = expiresAt - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [expiresAt]);

  const expiryTime =
    expiresAt === null
      ? null
      : new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(expiresAt);

  const renderPasswordControl = (isRequired: boolean) => (
    <div>
      <label
        htmlFor={activationPasswordId}
        className="block text-xs font-bold text-tk-secondary mb-1.5"
      >
        Mật khẩu cho tài khoản sau khi xác thực
      </label>
      <div className="relative">
        <input
          id={activationPasswordId}
          name="activationPassword"
          type={showPassword ? 'text' : 'password'}
          required={isRequired}
          minLength={6}
          maxLength={100}
          autoComplete="new-password"
          aria-describedby={activationPasswordHelpId}
          value={activationPassword}
          onChange={(e) => onActivationPasswordChange(e.target.value)}
          placeholder="Chọn mật khẩu của bạn"
          className="w-full h-12 px-4 pr-11 bg-tk-canvas/60 border border-tk-stone focus:bg-white focus:border-tk-jade rounded-2xl focus:outline-none focus:ring-3 focus:ring-tk-jade/20 text-sm font-semibold text-tk-ink shadow-xs transition-colors"
        />
        <button
          type="button"
          onClick={onToggleShowPassword}
          aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={showPassword}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-tk-muted hover:text-tk-ink rounded-xl p-2 tap-target inline-flex items-center justify-center cursor-pointer transition-colors"
        >
          {showPassword ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <p id={activationPasswordHelpId} className="mt-1.5 text-xs text-tk-muted leading-relaxed">
        Chọn mật khẩu từ 6 đến 100 ký tự. Mã email xác nhận bạn có quyền đặt mật khẩu này; mật khẩu
        của yêu cầu đăng ký trước sẽ được thay thế.
      </p>
    </div>
  );

  return (
    <div className="mt-6 space-y-5">
      <form onSubmit={onSubmitVerify} className="space-y-4">
        <p id={otpGroupId} className="sr-only">
          Mã OTP 6 chữ số
        </p>
        <div
          className="flex justify-center gap-2 sm:gap-2.5"
          role="group"
          aria-labelledby={otpGroupId}
          onPaste={onOtpPaste}
        >
          {otpDigits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => {
                otpInputsRef.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              name={`otp-${idx + 1}`}
              spellCheck={false}
              autoComplete="one-time-code"
              aria-label={`Chữ số ${idx + 1} của 6`}
              maxLength={1}
              value={digit}
              onChange={(e) => onOtpChange(idx, e.target.value)}
              onKeyDown={(e) => onOtpKeyDown(idx, e)}
              className="w-11 h-13 sm:w-12 sm:h-14 text-center font-extrabold text-xl bg-tk-canvas/60 border border-tk-stone focus:bg-white focus:border-tk-jade rounded-2xl focus:outline-none focus:ring-3 focus:ring-tk-jade/20 transition-tap text-tk-ink shadow-xs tk-tabular"
            />
          ))}
        </div>

        <p
          className="text-center text-xs font-medium text-tk-muted"
          data-testid="otp-expiry"
          role="status"
        >
          {delivered === false ? (
            'Chưa có mã đang hoạt động vì email OTP chưa gửi được.'
          ) : (
            <>
              {delivered === null && 'Máy chủ chưa xác nhận trạng thái gửi email. '}
              {expiresAt === null ? (
                'Máy chủ chưa cung cấp thời hạn cho mã này.'
              ) : expired ? (
                'Mã đã hết hạn theo thời hạn máy chủ trả về. Máy chủ vẫn xác nhận kết quả cuối cùng.'
              ) : (
                <>
                  Mã hết hạn lúc{' '}
                  <time dateTime={new Date(expiresAt).toISOString()}>{expiryTime}</time>. Máy chủ
                  xác nhận hiệu lực cuối cùng.
                </>
              )}
            </>
          )}
        </p>

        {otpPurpose === 'register' &&
          (hasPresetPassword ? (
            <details
              open={overrideOpen}
              onToggle={(e) => setOverrideOpen((e.currentTarget as HTMLDetailsElement).open)}
              className="rounded-2xl border border-tk-jade/25 bg-tk-jade-soft/55 px-4 py-1"
            >
              <summary className="tap-target flex items-center justify-between gap-2 cursor-pointer text-xs font-bold text-tk-jade-deep select-none list-none">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-tk-jade shrink-0" aria-hidden="true" />
                  <span>Đã ghi nhận mật khẩu đăng ký của bạn</span>
                </span>
                <span className="underline text-tk-jade font-extrabold">
                  {overrideOpen ? 'Thu gọn' : 'Đổi mật khẩu khác'}
                </span>
              </summary>
              <div className="pt-3 pb-3 border-t border-tk-jade/15">
                {renderPasswordControl(overrideOpen)}
              </div>
            </details>
          ) : (
            <div className="rounded-2xl border border-tk-stone bg-tk-sunken/55 p-4">
              {renderPasswordControl(true)}
            </div>
          ))}

        {transferDeferred && otpPurpose === 'register' ? (
          <div
            role="status"
            data-testid="transfer-deferred"
            className="p-4 bg-tk-turmeric-soft border border-tk-turmeric/30 text-tk-turmeric-deep rounded-2xl text-xs space-y-3 animate-fade-in"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle
                className="w-4 h-4 shrink-0 text-tk-turmeric mt-0.5"
                aria-hidden="true"
              />
              <p className="leading-relaxed font-medium">
                Hiện Takolio chưa thể chuyển dữ liệu trong tủ khách sang tài khoản mới một cách an
                toàn. Bạn vẫn có thể tiếp tục tạo tài khoản: dữ liệu của phiên khách được giữ riêng
                trên hộ khách, không bị xóa và không được chuyển sang tài khoản mới.
              </p>
            </div>
            <ActionButton
              variant="flame"
              size="lg"
              fullWidth
              type="button"
              loading={isLoading}
              onClick={onContinueWithoutTransfer}
            >
              Tiếp tục không chuyển dữ liệu khách
            </ActionButton>
          </div>
        ) : (
          <ActionButton
            variant="flame"
            size="lg"
            fullWidth
            type="submit"
            loading={isLoading}
            disabled={isResending}
          >
            Xác thực &amp; Hoàn tất
          </ActionButton>
        )}

        <div className="flex items-center justify-between text-xs pt-2">
          <span className="text-tk-muted font-medium">Chưa nhận được mã?</span>
          <button
            type="button"
            disabled={resendCountdown > 0 || isLoading || isResending}
            onClick={onResend}
            className="font-extrabold text-tk-jade disabled:opacity-40 hover:underline flex items-center gap-1.5 tap-target px-2 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="tk-tabular">
              {isResending
                ? 'Đang gửi lại mã…'
                : resendCountdown > 0
                  ? `Gửi lại sau (${resendCountdown}s)`
                  : 'Gửi lại mã OTP'}
            </span>
          </button>
        </div>
      </form>

      {errorMessage && (
        <div
          className="p-3.5 bg-tk-berry-soft border border-tk-berry/25 text-tk-berry-deep rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fade-in"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-tk-berry" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div
          className="p-3.5 bg-tk-jade-soft border border-tk-jade/25 text-tk-jade-deep rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fade-in"
          role="status"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-tk-jade" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};
