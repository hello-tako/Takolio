export const OTP_POLICY = Object.freeze({
  maxAttempts: 5,
  rollingWindowSeconds: 900,
  lockSeconds: 900,
  challengeTtlSeconds: 600,
  issuanceCooldownSeconds: 60,
  verificationTicketSeconds: 30,
  requestKeyMaxAgeSeconds: 1800,
  requestKeyFutureSkewSeconds: 30,
  receiptTtlSeconds: 86400,
});

export type OtpPurpose = 'register' | 'forgot_password' | 'login';
export type OtpOperation =
  | 'issue_register'
  | 'issue_login'
  | 'issue_forgot'
  | 'register_verify'
  | 'login_verify'
  | 'reset_preliminary'
  | 'reset_final';

export type OtpRequestKeyResult =
  | { kind: 'valid'; key: string; issuedAtMs: number }
  | { kind: 'malformed' | 'expired' };

const REQUEST_KEY_LENGTH = 46;
const REQUEST_KEY_PATTERN = /^([1-9][0-9]{12}):[0-9a-f]{32}$/;

export function parseOtpRequestKey(input: string | undefined, nowSeconds: number): OtpRequestKeyResult {
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) {
    throw new RangeError('OTP database epoch seconds must be a nonnegative safe integer');
  }
  if (typeof input !== 'string' || input.length !== REQUEST_KEY_LENGTH) return { kind: 'malformed' };
  const match = REQUEST_KEY_PATTERN.exec(input);
  if (!match) return { kind: 'malformed' };
  const issuedAtMs = Number(match[1]);
  const ageMs = nowSeconds * 1000 - issuedAtMs;
  if (ageMs > OTP_POLICY.requestKeyMaxAgeSeconds * 1000
    || ageMs < -OTP_POLICY.requestKeyFutureSkewSeconds * 1000) {
    return { kind: 'expired' };
  }
  return { kind: 'valid', key: input, issuedAtMs };
}

export function createOtpRequestKey(serverEpochMillis: number): string {
  if (!Number.isSafeInteger(serverEpochMillis) || !/^[1-9][0-9]{12}$/.test(String(serverEpochMillis))) {
    throw new RangeError('OTP server epoch milliseconds must be a canonical 13-digit safe integer');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${serverEpochMillis}:${nonce}`;
}
