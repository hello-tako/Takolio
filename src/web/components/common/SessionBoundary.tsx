import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { capturePrivateSession, isOfflineGuestSession } from '../../lib/private-session';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/queryKeys';
import { localizeErrorText, useLocaleText } from '../../i18n/app-i18n';
import { SystemStatusPage } from './SystemStatusPage';

export const SessionBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { l, locale } = useLocaleText();
  const { userId, householdId, isGuest, logoutStatus, logoutError, logout, setOnboardingFromServer, setPlusFromServer } = useAuthStore();
  const identity = `${userId}:${householdId}`;
  const [verifiedIdentity, setVerifiedIdentity] = useState<string | null>(null);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const navigate = useNavigate();
  useEffect(() => {
    if (logoutStatus !== 'idle' || !userId) return;
    let cancelled = false;
    const isCurrent = capturePrivateSession();
    setVerificationFailed(false);
    void queryClient.fetchQuery({
      queryKey: queryKeys.me(),
      queryFn: () => api.getMe({ requireServer: !isOfflineGuestSession() }),
      staleTime: 0,
      retry: false,
    }).then((me) => {
      if (!cancelled) {
        setOnboardingFromServer(me?.user?.onboardingCompleted === true, me?.user?.preferences);
        if (isCurrent() && me?.user?.id === userId) setPlusFromServer(me.user.isPlus === true);
        setVerifiedIdentity(identity);
      }
    }).catch(() => {
      if (!cancelled) setVerificationFailed(true);
    });
    return () => { cancelled = true; };
  }, [identity, userId, isGuest, logoutStatus, retry]);
  if (logoutStatus === 'idle') {
    if (userId && verifiedIdentity !== identity) return (
      <SystemStatusPage
        title={
          verificationFailed
            ? l('Chưa xác minh được phiên', 'Unable to verify session')
            : l('Đang kiểm tra phiên…', 'Checking your session…')
        }
        busy={!verificationFailed}
      >
        <p role={verificationFailed ? 'alert' : 'status'}>
          {verificationFailed
            ? l(
                'Không thể xác minh phiên. Vui lòng kết nối mạng và thử lại.',
                'Could not verify your session. Please check your internet connection and try again.',
              )
            : l('Đang kiểm tra phiên…', 'Checking your session…')}
        </p>
        {verificationFailed && (
          <button
            className="rounded-xl bg-semantic-action-primary hover:bg-semantic-action-primary-hover px-4 py-3 font-semibold text-semantic-on-action-primary transition-colors"
            onClick={() => setRetry((value) => value + 1)}
          >
            {l('Thử lại', 'Try again')}
          </button>
        )}
      </SystemStatusPage>
    );
    return <>{children}</>;
  }

  const pending = logoutStatus === 'pending';
  return (
    <SystemStatusPage
      title={
        pending
          ? l('Đang đăng xuất…', 'Signing out…')
          : l('Chưa xác nhận đăng xuất', 'Sign-out not confirmed')
      }
      busy={pending}
    >
      <div className="space-y-4" aria-live="polite">
        <p role={pending ? 'status' : 'alert'}>
          {pending
            ? l(
                'Đã tạm dừng đồng bộ riêng tư. Đang thu hồi phiên trên máy chủ.',
                'Private sync paused. Revoking your session on the server.',
              )
            : localizeErrorText(
                logoutError,
                'Unable to confirm sign-out on the server. Please try again.',
                'Chưa xác nhận đăng xuất trên máy chủ.',
                locale,
              )}
        </p>
        {!pending && (
          <button className="rounded-xl bg-semantic-action-primary hover:bg-semantic-action-primary-hover px-4 py-3 font-semibold text-semantic-on-action-primary transition-colors" onClick={async () => {
            if (await logout()) navigate('/auth', { replace: true });
          }}>
            {l('Thử đăng xuất lại', 'Retry sign-out')}
          </button>
        )}
      </div>
    </SystemStatusPage>
  );
};
