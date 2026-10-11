import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOtpRequestKey, OTP_POLICY, parseOtpRequestKey } from '../../src/worker/config/otp-policy';

const nowSeconds = 1_791_676_800;
const nonce = '0123456789abcdef0123456789abcdef';
const keyAt = (issuedAtMs: number) => `${issuedAtMs}:${nonce}`;

afterEach(() => { vi.restoreAllMocks(); });

describe('OTP request-key validation', () => {
  it('accepts a canonical key without changing its nonce or epoch', () => {
    const key = keyAt(nowSeconds * 1000);
    expect(parseOtpRequestKey(key, nowSeconds)).toEqual({ kind: 'valid', key, issuedAtMs: nowSeconds * 1000 });
  });

  it.each([
    ['exact age limit', -1_800_000],
    ['one millisecond inside age limit', -1_799_999],
    ['one millisecond inside future limit', 29_999],
    ['exact future limit', 30_000],
  ])('accepts %s', (_label, offsetMs) => {
    const key = keyAt(nowSeconds * 1000 + offsetMs);
    expect(parseOtpRequestKey(key, nowSeconds)).toEqual({ kind: 'valid', key, issuedAtMs: nowSeconds * 1000 + offsetMs });
  });

  it.each([
    ['one millisecond beyond age limit', -1_800_001],
    ['one millisecond beyond future limit', 30_001],
  ])('expires %s', (_label, offsetMs) => {
    expect(parseOtpRequestKey(keyAt(nowSeconds * 1000 + offsetMs), nowSeconds)).toEqual({ kind: 'expired' });
  });

  it.each([
    undefined,
    '',
    ` ${keyAt(nowSeconds * 1000)}`,
    `${keyAt(nowSeconds * 1000)} `,
    `${keyAt(nowSeconds * 1000)}\n`,
    `+${nowSeconds * 1000}:${nonce}`,
    `0${nowSeconds * 1000}:${nonce}`,
    `0179167680000:${nonce}`,
    `0000000000000:${nonce}`,
    `999999999999:${nonce}`,
    `10000000000000:${nonce}`,
    `${nowSeconds * 1000}.0:${nonce}`,
    `1.7916768e12:${nonce}`,
    `${nowSeconds * 1000}/${nonce}`,
    `${nowSeconds * 1000}::${nonce}`,
    `${nowSeconds * 1000}:${nonce.toUpperCase()}`,
    `${nowSeconds * 1000}:${nonce.slice(1)}`,
    `${nowSeconds * 1000}:${nonce}0`,
    `${nowSeconds * 1000}:g${nonce.slice(1)}`,
    `${nowSeconds * 1000}:${nonce}:extra`,
  ])('rejects noncanonical input %#', (input) => {
    expect(parseOtpRequestKey(input, nowSeconds)).toEqual({ kind: 'malformed' });
  });

  it.each([NaN, Infinity, -Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid trusted DB time %s', (dbNow) => {
    expect(() => parseOtpRequestKey(keyAt(nowSeconds * 1000), dbNow)).toThrow(RangeError);
    expect(() => parseOtpRequestKey(undefined, dbNow)).toThrow(RangeError);
  });

  it('does not overflow when DB seconds remain safe but milliseconds exceed safe integer precision', () => {
    expect(parseOtpRequestKey(keyAt(nowSeconds * 1000), Number.MAX_SAFE_INTEGER)).toEqual({ kind: 'expired' });
  });

  it('uses only the supplied DB time, regardless of the machine wall clock', () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const key = keyAt(nowSeconds * 1000);
    expect(parseOtpRequestKey(key, nowSeconds).kind).toBe('valid');
    expect(Date.now).not.toHaveBeenCalled();
  });
});

describe('OTP request-key generation', () => {
  it('uses sixteen cryptographic bytes and renders each byte as two lowercase hex characters', () => {
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      if (!(array instanceof Uint8Array)) throw new Error('Expected Uint8Array');
      array.set(Array.from({ length: 16 }, (_unused, index) => index));
      return array;
    });
    const key = createOtpRequestKey(nowSeconds * 1000);
    expect(key).toBe(`${nowSeconds * 1000}:000102030405060708090a0b0c0d0e0f`);
    expect(random).toHaveBeenCalledOnce();
    expect(random.mock.calls[0][0]).toBeInstanceOf(Uint8Array);
    expect(random.mock.calls[0][0]).toHaveLength(16);
  });

  it('generates fresh keys for the same server epoch that pass the parser', () => {
    const keys = Array.from({ length: 32 }, () => createOtpRequestKey(nowSeconds * 1000));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(/^[1-9][0-9]{12}:[0-9a-f]{32}$/);
      expect(parseOtpRequestKey(key, nowSeconds)).toEqual({ kind: 'valid', key, issuedAtMs: nowSeconds * 1000 });
    }
  });

  it.each([1_000_000_000_000, 9_999_999_999_999])('retains the exact valid epoch boundary %s', (epoch) => {
    const key = createOtpRequestKey(epoch);
    expect(key.startsWith(`${epoch}:`)).toBe(true);
    expect(parseOtpRequestKey(key, Math.floor(epoch / 1000))).toEqual({ kind: 'valid', key, issuedAtMs: epoch });
  });

  it.each([NaN, Infinity, -Infinity, -1, 0, 999_999_999_999, 10_000_000_000_000, 1_791_676_800_000.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid server epoch %s before generating a nonce', (epoch) => {
    const random = vi.spyOn(crypto, 'getRandomValues');
    expect(() => createOtpRequestKey(epoch)).toThrow(RangeError);
    expect(random).not.toHaveBeenCalled();
  });
});

describe('OTP security policy', () => {
  it('fixes the admission and replay limits for callers', () => {
    expect(OTP_POLICY).toEqual({
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
    expect(Object.isFrozen(OTP_POLICY)).toBe(true);
  });
});
