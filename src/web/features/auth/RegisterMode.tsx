import React, { type RefObject } from 'react';
import { Mail, User, Lock } from 'lucide-react';
import { ActionButton } from '../../design-system/v4/AtelierPrimitives';
import { TurnstileWidget } from '../../components/common/TurnstileWidget';
import { AuthField } from './AuthField';
import { GoogleAuthSection } from './GoogleAuthSection';

interface RegisterModeProps {
  googleButtonRef: RefObject<HTMLDivElement>;
  googleStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  googleClientId: string | null;
  onRetryGoogle: () => void;
  turnstileSiteKey: string | null;
  turnstileGeneration: number;
  onTurnstileToken: (token: string | null) => void;
  name: string;
  onNameChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  showPassword: boolean;
  onToggleShowPassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export const RegisterMode: React.FC<RegisterModeProps> = ({
  googleButtonRef,
  googleStatus,
  googleClientId,
  onRetryGoogle,
  turnstileSiteKey,
  turnstileGeneration,
  onTurnstileToken,
  name,
  onNameChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  showPassword,
  onToggleShowPassword,
  onSubmit,
  isLoading,
}) => (
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
        Hoặc đăng ký bằng Email
      </span>
      <div className="flex-1 border-t border-tk-stone" />
    </div>

    <form onSubmit={onSubmit} className="space-y-3.5">
      {turnstileSiteKey && (
        <TurnstileWidget
          key={turnstileGeneration}
          siteKey={turnstileSiteKey}
          onToken={onTurnstileToken}
        />
      )}
      <AuthField
        label="Họ và tên"
        icon={User}
        type="text"
        value={name}
        onChange={onNameChange}
        placeholder="Nguyễn Văn A"
      />
      <AuthField
        label="Email"
        icon={Mail}
        type="email"
        value={email}
        onChange={onEmailChange}
        placeholder="ban@example.com"
      />
      <AuthField
        label="Mật khẩu (tối thiểu 6 ký tự)"
        icon={Lock}
        type="password"
        value={password}
        onChange={onPasswordChange}
        placeholder="••••••••"
        autoComplete="new-password"
        reveal={{ show: showPassword, onToggle: onToggleShowPassword }}
      />

      <ActionButton
        variant="flame"
        size="lg"
        fullWidth
        type="submit"
        loading={isLoading}
        className="mt-2"
      >
        Tạo tài khoản &amp; Nhận mã OTP
      </ActionButton>
    </form>
  </div>
);
