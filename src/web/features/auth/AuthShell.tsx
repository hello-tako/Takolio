import React from 'react';
import { ArrowLeft, AlertCircle, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import { TakoChef3D } from '../../components/3d';
import {
  FreshnessShieldIcon,
  HouseholdTrayIcon,
  TakolioWordmarkLockup,
} from '../../design-system/icons';
import { AtelierBadge } from '../../design-system/v4/AtelierPrimitives';
import type { AuthMode } from './auth-shared';

interface AuthShellProps {
  mode: AuthMode;
  email: string;
  errorMessage: string | null;
  successMessage: string | null;
  otpDelivered?: boolean | null;
  devOtp: string | null;
  hasGuestKitchen?: boolean;
  onFillDevOtp: () => void;
  onBack: () => void;
  onModeChange: (mode: 'login' | 'register') => void;
  children: React.ReactNode;
}

const HEADING: Record<AuthMode, string> = {
  login: 'Đăng nhập vào Takolio',
  register: 'Tạo tài khoản Takolio',
  otp_verify: 'Xác thực mã OTP',
  forgot_password: 'Quên mật khẩu',
};

/** V4 Split-Screen Atelier Chrome + mode selection shared by every auth state. */
export const AuthShell: React.FC<AuthShellProps> = ({
  mode,
  email,
  errorMessage,
  successMessage,
  otpDelivered,
  devOtp,
  hasGuestKitchen = false,
  onFillDevOtp,
  onBack,
  onModeChange,
  children,
}) => (
  <main className="min-h-dvh bg-tk-canvas text-tk-ink flex items-center justify-center p-4 sm:p-6 lg:p-10">
    <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Left Sanctuary Showcase (Desktop 2-Column Split) */}
      <aside
        aria-label="Giới thiệu không gian bếp Takolio"
        className="hidden lg:flex lg:col-span-5 tk-sanctuary-theme rounded-[32px] border border-tk-sanctuary-elevated p-8 flex-col justify-between shadow-elevated overflow-hidden relative"
      >
        <div className="space-y-4 relative z-10">
          <TakolioWordmarkLockup size={32} tone="cream" />
          <p className="text-xl font-extrabold text-white leading-snug pt-2">
            Giữ trọn sự tươi ngon từ ngăn mát đến mâm cơm chiều ấm lửa.
          </p>
          <p className="text-xs text-white/75 leading-relaxed">
            Đồng bộ thực phẩm FEFO, lịch nấu mâm cơm cả tuần và danh sách đi chợ tức thì giữa các
            thành viên trong cùng gia đình.
          </p>
        </div>

        <div className="my-4 flex flex-col items-center justify-center relative z-10">
          <TakoChef3D pose="wave" size={200} interactive />
        </div>

        <div className="space-y-2.5 relative z-10">
          <div className="rounded-2xl bg-tk-sanctuary-card border border-white/10 px-4 py-3 flex items-center gap-3">
            <FreshnessShieldIcon size={20} tone="cream" active />
            <div className="text-xs">
              <strong className="block text-white font-bold">Quản trị lô hạn dùng FEFO</strong>
              <span className="text-white/70">Ưu tiên dùng trước thực phẩm sắp tới hạn</span>
            </div>
          </div>
          <div className="rounded-2xl bg-tk-sanctuary-card border border-white/10 px-4 py-3 flex items-center gap-3">
            <HouseholdTrayIcon size={20} tone="flame" active />
            <div className="text-xs">
              <strong className="block text-white font-bold">Mâm cơm Việt 3–4 món chuẩn vị</strong>
              <span className="text-white/70">Tự động gộp nguyên liệu từ phiên dùng thử</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Right Glazed Ceramic Auth Card */}
      <div className="lg:col-span-7 rounded-[32px] bg-white border border-tk-stone/85 shadow-elevated p-6 sm:p-9 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="tap-target p-2.5 -ml-2 rounded-xl hover:bg-tk-sunken active:scale-95 text-tk-secondary hover:text-tk-ink flex items-center justify-center transition-tap cursor-pointer"
              aria-label="Quay lại"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2">
              <div className="lg:hidden">
                <TakolioWordmarkLockup size={26} tone="ink" />
              </div>
              <AtelierBadge tone="jade" className="hidden sm:inline-flex">
                Tài khoản Gia đình Takolio
              </AtelierBadge>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {/* Single page heading (accessibility checklist: sequential levels). */}
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-tk-ink">
              {HEADING[mode]}
            </h1>
            <p className="text-sm text-tk-secondary leading-relaxed">
              {mode === 'login' &&
                'Đồng bộ tủ lạnh FEFO, thực đơn tuần và danh sách đi chợ trên mọi thiết bị.'}
              {mode === 'register' &&
                'Khởi tạo gian bếp gia đình để lưu thực phẩm thông minh và chống lãng phí.'}
              {mode === 'otp_verify' &&
                (email
                  ? otpDelivered === false
                    ? `Địa chỉ cần xác thực: ${email}. Email OTP chưa gửi được.`
                    : otpDelivered === true
                      ? `Nhập 6 số mã OTP đã gửi tới ${email}`
                      : `Nhập 6 số mã OTP để xác thực ${email}`
                  : 'Xác thực tài khoản bằng mã OTP gửi qua email')}
              {mode === 'forgot_password' &&
                'Nhập địa chỉ email đã đăng ký để nhận mã OTP khôi phục mật khẩu.'}
            </p>
          </div>

          {hasGuestKitchen && (mode === 'login' || mode === 'register') && (
            <div className="mt-4 rounded-2xl bg-tk-jade-soft border border-tk-jade/20 px-3.5 py-2.5 text-xs font-semibold text-tk-jade-deep flex items-center gap-2">
              <FreshnessShieldIcon size={16} tone="jade" active />
              <span>
                Đồ trong tủ lạnh phiên khách hiện tại sẽ được đồng bộ liền mạch sau khi xác thực.
              </span>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div className="mt-5 p-1 rounded-2xl bg-tk-sunken border border-tk-stone/80 flex items-center gap-1">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => onModeChange(m)}
                  className={clsx(
                    'flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs sm:text-sm transition-tap tap-target cursor-pointer',
                    mode === m
                      ? 'bg-white text-tk-ink shadow-xs'
                      : 'text-tk-secondary hover:text-tk-ink',
                  )}
                >
                  {m === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
                </button>
              ))}
            </div>
          )}

          {mode !== 'otp_verify' && errorMessage && (
            <div
              className="mt-4 p-3.5 bg-tk-berry-soft border border-tk-berry/25 text-tk-berry-deep rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fade-in"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-tk-berry" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}
          {mode !== 'otp_verify' && successMessage && (
            <div
              className="mt-4 p-3.5 bg-tk-jade-soft border border-tk-jade/25 text-tk-jade-deep rounded-2xl text-xs font-semibold flex items-center gap-2.5 animate-fade-in"
              role="status"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-tk-jade" aria-hidden="true" />
              <span>{successMessage}</span>
            </div>
          )}

          {devOtp && (mode === 'otp_verify' || mode === 'forgot_password') && (
            <button
              type="button"
              onClick={onFillDevOtp}
              className="mt-4 w-full text-left p-3.5 bg-tk-jade-soft border border-tk-jade/30 rounded-2xl text-xs flex items-center justify-between cursor-pointer hover:bg-tk-jade-mint/60 transition-tap shadow-xs tap-target"
            >
              <div className="flex items-center gap-2 text-tk-jade-deep">
                <Sparkles className="w-4 h-4 text-tk-jade shrink-0" aria-hidden="true" />
                <div>
                  <span className="font-semibold">Mã OTP Thử nghiệm: </span>
                  <span className="font-extrabold text-sm tracking-widest text-tk-jade-deep tk-tabular">
                    {devOtp}
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-extrabold text-tk-jade bg-white px-2.5 py-1 rounded-lg border border-tk-jade/25">
                Tự điền
              </span>
            </button>
          )}

          {children}
        </div>

        <div className="pt-6 mt-6 border-t border-tk-stone/70">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-tk-muted">
            <ShieldCheck className="w-4 h-4 text-tk-jade shrink-0" aria-hidden="true" />
            <span>Tủ lạnh và thực đơn được phân tách theo hộ gia đình</span>
          </div>
        </div>
      </div>
    </div>
  </main>
);
