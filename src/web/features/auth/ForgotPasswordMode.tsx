import React, { useId } from 'react';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import { ActionButton } from '../../design-system/v4/AtelierPrimitives';

interface ForgotPasswordModeProps {
  forgotOtpRequested: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  onRequestOtp: (e: React.FormEvent) => void;
  otpDigits: string[];
  otpInputsRef: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onOtpChange: (index: number, value: string) => void;
  onOtpKeyDown: (index: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onOtpPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  newPassword: string;
  onNewPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onResetPassword: (e: React.FormEvent) => void;
  isLoading: boolean;
  isResending: boolean;
  resendCountdown: number;
  onResend: () => void;
  onBackToLogin: () => void;
}

export const ForgotPasswordMode: React.FC<ForgotPasswordModeProps> = ({
  forgotOtpRequested,
  email,
  onEmailChange,
  onRequestOtp,
  otpDigits,
  otpInputsRef,
  onOtpChange,
  onOtpKeyDown,
  onOtpPaste,
  newPassword,
  onNewPasswordChange,
  showPassword,
  onToggleShowPassword,
  onResetPassword,
  isLoading,
  isResending,
  resendCountdown,
  onResend,
  onBackToLogin,
}) => {
  const emailId = useId();
  const newPasswordId = useId();
  const otpGroupId = useId();
  return (
    <div className="mt-5 space-y-4">
      {!forgotOtpRequested && (
        <form onSubmit={onRequestOtp} className="space-y-4">
          <div>
            <label htmlFor={emailId} className="block text-xs font-bold text-tk-secondary mb-1.5">
              Email đăng ký tài khoản
            </label>
            <div className="relative">
              <Mail
                className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-tk-muted pointer-events-none"
                aria-hidden="true"
              />
              <input
                id={emailId}
                name="email"
                spellCheck={false}
                type="email"
                required
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="ban@example.com"
                autoComplete="email"
                className="w-full h-12 pl-10.5 pr-4 bg-tk-canvas/60 border border-tk-stone focus:bg-white focus:border-tk-jade rounded-2xl focus:outline-none focus:ring-3 focus:ring-tk-jade/20 text-sm font-semibold text-tk-ink shadow-xs transition-colors"
              />
            </div>
          </div>

          <ActionButton variant="flame" size="lg" fullWidth type="submit" loading={isLoading}>
            Gửi mã OTP khôi phục
          </ActionButton>
        </form>
      )}

      {forgotOtpRequested && (
        <form onSubmit={onResetPassword} className="space-y-4 animate-fade-in">
          <div>
            <p
              id={otpGroupId}
              className="block text-xs font-bold text-tk-secondary mb-2 text-center"
            >
              Mã xác thực OTP (6 số)
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
          </div>

          <div>
            <label
              htmlFor={newPasswordId}
              className="block text-xs font-bold text-tk-secondary mb-1.5"
            >
              Mật khẩu mới (tối thiểu 6 ký tự)
            </label>
            <div className="relative">
              <KeyRound
                className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-tk-muted pointer-events-none"
                aria-hidden="true"
              />
              <input
                id={newPasswordId}
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => onNewPasswordChange(e.target.value)}
                placeholder="Nhập mật khẩu mới"
                autoComplete="new-password"
                className="w-full h-12 pl-10.5 pr-11 bg-tk-canvas/60 border border-tk-stone focus:bg-white focus:border-tk-jade rounded-2xl focus:outline-none focus:ring-3 focus:ring-tk-jade/20 text-sm font-semibold text-tk-ink shadow-xs transition-colors"
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
          </div>

          <ActionButton
            variant="flame"
            size="lg"
            fullWidth
            type="submit"
            loading={isLoading}
            disabled={isResending}
            className="mt-2"
          >
            Lưu mật khẩu mới &amp; Đăng nhập
          </ActionButton>
          <div className="text-center">
            <button
              type="button"
              disabled={resendCountdown > 0 || isLoading || isResending}
              onClick={onResend}
              className="text-xs font-extrabold text-tk-jade disabled:opacity-40 hover:underline tap-target inline-flex items-center justify-center px-3 cursor-pointer tk-tabular"
            >
              {isResending
                ? 'Đang gửi lại mã…'
                : resendCountdown > 0
                  ? `Gửi lại sau (${resendCountdown}s)`
                  : 'Gửi lại mã OTP'}
            </button>
          </div>
        </form>
      )}

      <div className="text-center pt-1">
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-xs font-bold text-tk-secondary hover:text-tk-ink tap-target inline-flex items-center justify-center px-3 cursor-pointer"
        >
          ← Quay lại màn hình đăng nhập
        </button>
      </div>
    </div>
  );
};
