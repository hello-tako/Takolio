export type AuthMode = 'login' | 'register' | 'otp_verify' | 'forgot_password';

export function apiErrorMessage(error: any, fallback: string): string {
  return typeof error?.payload?.error === 'string' ? error.payload.error : fallback;
}

export function otpPresentation(payload: unknown) {
  const metadata = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const state = metadata.deliveryState;
  const delivered = state === 'pending' || state === 'delivery_unknown'
    ? null
    : typeof metadata.otpDelivered === 'boolean' ? metadata.otpDelivered : null;
  const retry = metadata.retryAfterSeconds;
  const cooldown = typeof retry === 'number' && Number.isFinite(retry) && retry >= 0 && retry <= 86_400
    ? Math.ceil(retry)
    : delivered === false ? 0 : 60;
  const serverEpoch = metadata.otpKeyIssuedAtMs;
  const serverExpiry = metadata.otpExpiresAtMs;
  const duration = metadata.expiresInMinutes;
  const expiryDelta = typeof serverEpoch === 'number' && Number.isSafeInteger(serverEpoch) && /^[1-9][0-9]{12}$/.test(String(serverEpoch)) &&
    typeof serverExpiry === 'number' && Number.isSafeInteger(serverExpiry) &&
    serverExpiry >= 0 && Math.abs(serverExpiry - serverEpoch) <= 86_400_000
    ? serverExpiry - serverEpoch
    : typeof duration === 'number' && Number.isFinite(duration) && duration > 0 && duration <= 1440
      ? duration * 60_000
      : null;
  return {
    delivered,
    cooldown,
    expiresAt: delivered !== false && expiryDelta !== null ? Date.now() + expiryDelta : null,
  };
}
