import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '../../components/common/Button';

interface OtpModeProps {
  otpDigits: string[];
  otpInputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onOtpChange: (index: number, value: string) => void;
  onOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOtpPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  transferDeferred: boolean;
  otpPurpose: 'register' | 'forgot_password';
  activationPassword: string;
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

/** Six-digit verification (screen 03): paste support, no disruptive shaking,
 *  honest transfer-deferred continuation (DEC-012). */
export const OtpMode: React.FC<OtpModeProps> = ({
  otpDigits,
  otpInputsRef,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  transferDeferred,
  otpPurpose,
  activationPassword,
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

  return (
    <div className="mt-6 space-y-5">
      <form onSubmit={onSubmitVerify} className="space-y-4">
        <p id={otpGroupId} className="sr-only">
          Mã OTP 6 chữ số
        </p>
        <div
          className="flex justify-center gap-2"
          role="group"
          aria-labelledby={otpGroupId}
          onPaste={onOtpPaste}
        >
          {otpDigits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (otpInputsRef.current[idx] = el)}
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
              className="w-11 h-13 text-center font-heading font-bold text-xl bg-white border border-semantic-border focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 transition-tap text-semantic-text-primary shadow-xs"
            />
          ))}
        </div>

        <p
          className="text-center text-xs text-semantic-text-muted"
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
                  <time dateTime={new Date(expiresAt).toISOString()}>{expiryTime}</time>. Máy chủ xác
                  nhận hiệu lực cuối cùng.
                </>
              )}
            </>
          )}
        </p>

        {otpPurpose === 'register' && (
          <div>
            <label htmlFor={activationPasswordId} className="block text-xs font-semibold text-semantic-text-secondary mb-1">
              Mật khẩu cho tài khoản sau khi xác thực
            </label>
            <div className="relative">
              <input
                id={activationPasswordId}
                name="activationPassword"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                maxLength={100}
                autoComplete="new-password"
                aria-describedby={activationPasswordHelpId}
                value={activationPassword}
                onChange={(e) => onActivationPasswordChange(e.target.value)}
                placeholder="Chọn mật khẩu của bạn"
                className="w-full h-11 px-4 pr-11 bg-white border border-semantic-border focus:border-takosan-green rounded-xl focus:outline-none focus:ring-2 focus:ring-takosan-green/20 text-sm font-medium text-semantic-text-primary shadow-xs"
              />
              <button
                type="button"
                onClick={onToggleShowPassword}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                className="absolute right-3 top-3 text-semantic-text-muted hover:text-semantic-text-secondary p-1 tap-target"
              >
                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
              </button>
            </div>
            <p id={activationPasswordHelpId} className="mt-1 text-xs text-semantic-text-muted">
              Chọn mật khẩu từ 6 đến 100 ký tự. Mã email xác nhận bạn có quyền đặt mật khẩu này;
              mật khẩu của yêu cầu đăng ký trước sẽ được thay thế.
            </p>
          </div>
        )}

        {transferDeferred && otpPurpose === 'register' ? (
          <div
            role="status"
            data-testid="transfer-deferred"
            className="p-3 bg-semantic-warning-soft border border-semantic-warning/30 text-semantic-warning-strong rounded-xl text-xs space-y-3 animate-fade-in"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-semantic-warning mt-0.5" />
              <p className="leading-relaxed">
                Hiện Takosan chưa thể chuyển dữ liệu trong tủ khách sang tài khoản mới một cách an
                toàn. Bạn vẫn có thể tiếp tục tạo tài khoản: dữ liệu của phiên khách được giữ riêng
                trên hộ khách, không bị xóa và không được chuyển sang tài khoản mới.
              </p>
            </div>
            <Button
              fullWidth
              size="lg"
              type="button"
              isLoading={isLoading}
              onClick={onContinueWithoutTransfer}
            >
              Tiếp tục không chuyển dữ liệu khách
            </Button>
          </div>
        ) : (
          <Button fullWidth size="lg" type="submit" isLoading={isLoading} disabled={isResending}>
            Xác thực & Hoàn tất
          </Button>
        )}

        <div className="flex items-center justify-between text-xs pt-2">
          <span className="text-semantic-text-muted">Chưa nhận được mã?</span>
          <button
            type="button"
            disabled={
              resendCountdown > 0 ||
              isLoading ||
              isResending
            }
            onClick={onResend}
            className="font-semibold text-takosan-green disabled:opacity-40 hover:underline flex items-center gap-1 tap-target cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
            <span>
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
          className="p-3 bg-semantic-danger-soft border border-semantic-danger/30 text-semantic-danger-strong rounded-xl text-xs flex items-center gap-2 animate-fade-in"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-semantic-danger" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div
          className="p-3 bg-takosan-mint border border-takosan-mint-deep text-takosan-green-deep rounded-xl text-xs flex items-center gap-2 animate-fade-in"
          role="status"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-takosan-green" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};
