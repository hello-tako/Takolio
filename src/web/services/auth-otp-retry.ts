export interface OtpResponseMetadata {
  error?: string;
  code?: string;
  otpKeyIssuedAtMs?: number;
  otpExpiresAtMs?: number;
  otpDelivered?: boolean;
  deliveryState?: 'pending' | 'accepted' | 'rejected' | 'delivery_unknown' | 'superseded';
  retryAfterSeconds?: number;
  replayed?: boolean;
  sessionRequired?: boolean;
}

interface OtpRetryReceipt {
  path: string;
  fingerprint: string;
  key?: string;
  genericForgot?: boolean;
}

/** Tab-memory receipts never persist credentials. A no-key retry is a new admission. */
export class OtpRequestRetryClient {
  private readonly receipts = new Map<string, OtpRetryReceipt>();
  private owner: string | undefined;
  private clock: { epoch: number; monotonic: number } | undefined;

  constructor(private readonly monotonicNow = () => performance.now()) {}

  reset(): void {
    this.receipts.clear();
    this.owner = undefined;
    this.clock = undefined;
  }

  async begin(path: string, body: Record<string, unknown>, owner: string): Promise<OtpRetryReceipt> {
    if (this.owner !== owner) {
      this.receipts.clear();
      this.owner = owner;
    }
    const semanticBody = Object.entries(body)
      .filter(([field, value]) => field !== 'turnstileToken' && value !== undefined)
      .map(([field, value]) => [field, typeof value === 'string' && ['email', 'name', 'code'].includes(field)
        ? field === 'email' ? value.trim().toLowerCase() : value.trim()
        : value])
      .sort(([a], [b]) => String(a).localeCompare(String(b)));
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([path, semanticBody])));
    const fingerprint = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (this.owner !== owner) return { path, fingerprint };
    const previous = this.receipts.get(path);
    if (previous?.fingerprint === fingerprint && previous.key) return previous;
    const genericForgot = path === '/auth/forgot-password' ||
      (path === '/auth/resend-otp' && body.purpose === 'forgot_password');
    const receipt = { path, fingerprint, key: this.createKey(), genericForgot };
    this.receipts.set(path, receipt);
    return receipt;
  }

  finish(receipt: OtpRetryReceipt, payload: unknown, issuance: boolean, status?: number): void {
    if (this.receipts.get(receipt.path) !== receipt) return;
    const metadata = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const epoch = metadata.otpKeyIssuedAtMs;
    if (typeof epoch === 'number' && Number.isSafeInteger(epoch) && /^[1-9][0-9]{12}$/.test(String(epoch))) {
      this.clock = { epoch, monotonic: this.monotonicNow() };
    }
    const terminalDenial = status === 409 || status === 410 || status === 429 ||
      (status === 400 && metadata.code !== 'OTP_INVALID');
    const acknowledgedForgot = issuance && receipt.genericForgot && metadata.success === true;
    const terminalIssuance = issuance && (metadata.deliveryState === 'accepted' || metadata.deliveryState === 'rejected' || acknowledgedForgot);
    if (terminalDenial || terminalIssuance) this.receipts.delete(receipt.path);
    if (issuance && !terminalDenial && (metadata.deliveryState === 'accepted' || acknowledgedForgot)) {
      this.receipts.delete('/auth/verify-otp');
      this.receipts.delete('/auth/reset-password');
    }
  }

  private createKey(): string | undefined {
    if (!this.clock) return undefined;
    const elapsed = this.monotonicNow() - this.clock.monotonic;
    if (!Number.isFinite(elapsed) || elapsed < 0) return undefined;
    const epoch = this.clock.epoch + Math.floor(elapsed);
    if (!Number.isSafeInteger(epoch) || !/^[1-9][0-9]{12}$/.test(String(epoch))) return undefined;
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    return `${epoch}:${Array.from(nonce, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
}
