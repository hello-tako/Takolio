import React, { useId, type RefObject } from 'react';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { ActionButton } from '../../design-system/v4/AtelierPrimitives';
import { AuthField } from './AuthField';
import { GoogleAuthSection } from './GoogleAuthSection';

interface LoginModeProps {
  googleButtonRef: RefObject<HTMLDivElement>;
  googleStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  googleClientId: string | null;
  onRetryGoogle: () => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onForgotPassword: () => void;
}

export const LoginMode: React.FC<LoginModeProps> = ({
  googleButtonRef,
  googleStatus,
  googleClientId,
  onRetryGoogle,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  onSubmit,
  isLoading,
  onForgotPassword,
}) => {
  const passwordId = useId();
  return (
    <div className="mt-5 space-y-4">
      <GoogleAuthSection
        buttonRef={googleButtonRef}
        status={googleStatus}
        clientId={googleClientId}
        onRetry={onRetryGoogle}
      />

      <div className="flex items-center my-2">
        <div className="flex-1 border-t border-tk-stone" />
        <span className="px-3 text-[11px] text-tk-muted uppercase font-extrabold tracking-wider">
          Hoặc qua Email
        </span>
        <div className="flex-1 border-t border-tk-stone" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3.5">
        <AuthField
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={onEmailChange}
          placeholder="ban@example.com"
        />

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor={passwordId} className="block text-xs font-bold text-tk-secondary">
              Mật khẩu
            </label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="tap-target -my-2 inline-flex items-center px-2 text-xs font-bold text-tk-jade hover:underline cursor-pointer"
            >
              Quên mật khẩu?
            </button>
          </div>
          <div className="relative">
            <Lock
              className="w-4.5 h-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-tk-muted pointer-events-none"
              aria-hidden="true"
            />
            <input
              id={passwordId}
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
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
          className="mt-2"
        >
          Đăng nhập
        </ActionButton>
      </form>
    </div>
  );
};
