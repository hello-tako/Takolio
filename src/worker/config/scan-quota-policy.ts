export const SCAN_QUOTA_POLICY = Object.freeze({ guest: 1, free: 5, plus: 999999 });

export interface ScanSubscription {
  plan: string | null;
  status: string | null;
  expires_at: string | null;
  is_guest?: number | boolean | null;
  grace_period_ends_at?: string | null;
}

export function getScanQuotaEntitlement(subscription: ScanSubscription | null, now = new Date()) {
  const nowMs = now.getTime();
  const inGracePeriod =
    subscription?.status === 'past_due' &&
    Boolean(subscription.grace_period_ends_at) &&
    new Date(subscription.grace_period_ends_at!).getTime() > nowMs;
  const statusActive = !subscription?.status || subscription.status === 'active' || inGracePeriod;
  const notExpired =
    inGracePeriod || !subscription?.expires_at || new Date(subscription.expires_at).getTime() > nowMs;
  const isPlus = subscription?.plan === 'plus' && statusActive && notExpired;
  const isGuestTrial = !isPlus && (
    (subscription?.plan === 'guest' && (!subscription.status || subscription.status === 'active')) ||
    (!subscription?.plan && Boolean(subscription?.is_guest))
  );
  const plan = isPlus ? 'plus' : 'free';
  const limit = isPlus
    ? SCAN_QUOTA_POLICY.plus
    : isGuestTrial
      ? SCAN_QUOTA_POLICY.guest
      : SCAN_QUOTA_POLICY.free;
  return {
    plan,
    isPlus,
    limit,
    expiresAt: subscription?.expires_at || null,
  };
}

export function getScanQuotaPeriod(now = new Date()) {
  return {
    start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10),
    resetAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  };
}
