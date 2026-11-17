import React from 'react';
import { ActionButton } from '../../design-system/v4/AtelierPrimitives';

interface VerifyUnavailableProps {
  onRegister: () => void;
  onLogin: () => void;
}

/** `/auth/verify` reached without a verification in progress on this device
 *  (direct link, expired tab, cleared storage). Says so honestly instead of
 *  rendering an OTP form that could never succeed; no code is requested. */
export const VerifyUnavailable: React.FC<VerifyUnavailableProps> = ({ onRegister, onLogin }) => (
  <div className="mt-6 space-y-4" data-testid="verify-context-missing">
    <div
      role="note"
      className="rounded-2xl border border-dashed border-tk-stone bg-tk-sunken/75 px-4 py-4"
    >
      <p className="text-sm font-extrabold text-tk-ink">Không có yêu cầu xác thực đang chờ</p>
      <p className="mt-1.5 text-xs leading-relaxed text-tk-secondary">
        Trang này chỉ dùng ngay sau khi đăng ký hoặc đăng nhập bằng tài khoản chưa xác thực trên
        cùng thiết bị. Takolio không thể gửi mã OTP khi chưa biết email của bạn.
      </p>
    </div>
    <ActionButton variant="flame" size="lg" fullWidth type="button" onClick={onRegister}>
      Tạo tài khoản mới
    </ActionButton>
    <ActionButton variant="ceramic" size="lg" fullWidth type="button" onClick={onLogin}>
      Đăng nhập bằng tài khoản đã có
    </ActionButton>
  </div>
);
