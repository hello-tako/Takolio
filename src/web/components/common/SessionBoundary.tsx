import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { ApiError } from '../../services/http';
import {
  capturePrivateSession,
  isOfflineGuestSession,
  privateSessionBlocked,
} from '../../lib/private-session';
import { queryClient } from '../../lib/query-client';
import { queryKeys } from '../../lib/queryKeys';
import { SystemStatusPage } from './SystemStatusPage';

function isGenuineOfflineError(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.kind === 'auth' || err.status === 401 || err.status === 403 || err.status === 409) {
      return false;
    }
    if (err.kind === 'offline' || err.status === 0) {
      return true;
    }
    return false;
  }
  if (err instanceof TypeError) {
    return true;
  }
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export const SessionBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    userId,
    householdId,
    isGuest,
    logoutStatus,
    logoutError,
    logout,
    setOnboardingFromServer,
    setPlusFromServer,
  } = useAuthStore();
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

    const canBootCachedOffline = Boolean(userId && householdId && !privateSessionBlocked());
    const browserOfflineAtBoot =
      typeof navigator !== 'undefined' && navigator.onLine === false && canBootCachedOffline;

    if (browserOfflineAtBoot) {
      // Allow cached household session to cold-start offline without locking the user out.
      setVerifiedIdentity(identity);
    }

    const verifyAgainstServer = () => {
      void queryClient
        .fetchQuery({
          queryKey: queryKeys.me(),
          queryFn: () => api.getMe({ requireServer: !isOfflineGuestSession() }),
          staleTime: 0,
          retry: false,
        })
        .then((me) => {
          if (!cancelled) {
            setOnboardingFromServer(me?.user?.onboardingCompleted === true, me?.user?.preferences);
            if (isCurrent() && me?.user?.id === userId) setPlusFromServer(me.user.isPlus === true);
            setVerificationFailed(false);
            setVerifiedIdentity(identity);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          if (canBootCachedOffline && isGenuineOfflineError(err)) {
            setVerificationFailed(false);
            setVerifiedIdentity(identity);
            return;
          }
          setVerifiedIdentity(null);
          setVerificationFailed(true);
        });
    };

    verifyAgainstServer();

    const handleReconnect = () => {
      if (!cancelled) verifyAgainstServer();
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', handleReconnect);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('online', handleReconnect);
      }
    };
  }, [
    identity,
    userId,
    householdId,
    isGuest,
    logoutStatus,
    retry,
    setOnboardingFromServer,
    setPlusFromServer,
  ]);

  if (logoutStatus === 'idle') {
    if (userId && verifiedIdentity !== identity) {
      return (
        <SystemStatusPage
          title={verificationFailed ? 'Chưa xác minh được phiên' : 'Đang kiểm tra phiên…'}
          busy={!verificationFailed}
        >
          <p role={verificationFailed ? 'alert' : 'status'}>
            {verificationFailed
              ? 'Không thể xác minh phiên. Vui lòng kết nối mạng và thử lại.'
              : 'Đang kiểm tra phiên…'}
          </p>
          {verificationFailed && (
            <button
              type="button"
              className="tap-target inline-flex items-center justify-center rounded-2xl bg-tk-flame px-5 py-3 text-sm font-extrabold text-white shadow-float hover:bg-tk-flame-hover transition-tap cursor-pointer"
              onClick={() => setRetry((value) => value + 1)}
            >
              Thử lại
            </button>
          )}
        </SystemStatusPage>
      );
    }
    return <>{children}</>;
  }

  const pending = logoutStatus === 'pending';
  return (
    <SystemStatusPage
      title={pending ? 'Đang đăng xuất…' : 'Chưa xác nhận đăng xuất'}
      busy={pending}
    >
      <div className="space-y-4" aria-live="polite">
        <p role={pending ? 'status' : 'alert'}>
          {pending
            ? 'Đã tạm dừng đồng bộ riêng tư. Đang thu hồi phiên trên máy chủ.'
            : logoutError}
        </p>
        {!pending && (
          <button
            type="button"
            className="tap-target inline-flex items-center justify-center rounded-2xl bg-tk-flame px-5 py-3 text-sm font-extrabold text-white shadow-float hover:bg-tk-flame-hover transition-tap cursor-pointer"
            onClick={async () => {
              if (await logout()) navigate('/auth', { replace: true });
            }}
          >
            Thử đăng xuất lại
          </button>
        )}
      </div>
    </SystemStatusPage>
  );
};
