/**
 * Provider acceptance adapter. A successful send is not inbox delivery proof.
 * Native ambiguity must never trigger a second send through Resend.
 */

import type { Env } from '../types';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  purpose?: 'register' | 'forgot_password' | 'login';
}

type EmailProvider = 'workers-email' | 'resend' | 'none';
type EmailError = 'sender_not_verified' | 'recipient_not_allowed' | 'rate_limited' | 'daily_limit' | 'provider_unavailable' | 'not_configured';
type EmailEvidence = 'native_resolved' | 'native_rejection_code' | 'http_response' | 'provider_exception' | 'deadline' | 'configuration';

export type EmailResult = {
  provider: EmailProvider;
} & (
  | { sent: true; state: 'accepted'; evidence: 'native_resolved' | 'http_response'; messageIdHash?: string; error?: never }
  | { sent: false; state: 'rejected' | 'delivery_unknown' | 'not_configured'; evidence: EmailEvidence; error: EmailError }
);

const FROM_NAME = 'Takosan';
// Cloudflare onboards the apex sending domain; subdomains need separate onboarding.
const FROM_EMAIL = 'no-reply@tungjpstore.net';
const PROVIDER_TIMEOUT_MS = 8000;
const MAX_RESPONSE_BYTES = 4096;
const MAX_RESPONSE_CHUNKS = 64;

type Attempt<T> = { kind: 'resolved'; value: T } | { kind: 'exception'; error: unknown } | { kind: 'deadline' };

function providerDeadline(onTimeout?: () => void) {
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<{ kind: 'deadline' }>((resolve) => {
    timer = setTimeout(() => {
      expired = true;
      resolve({ kind: 'deadline' });
      onTimeout?.();
    }, PROVIDER_TIMEOUT_MS);
  });
  return {
    get expired() { return expired; },
    async wait<T>(operation: () => Promise<T>): Promise<Attempt<T>> {
      if (expired) return { kind: 'deadline' };
      try {
        // Both handlers remain attached after timeout, including for unabortable sends.
        const pending = operation().then<Attempt<T>, Attempt<T>>(
          (value) => ({ kind: 'resolved', value }),
          (error: unknown) => ({ kind: 'exception', error }),
        );
        return await Promise.race([pending, timeout]);
      } catch (error) {
        return { kind: 'exception', error };
      }
    },
    close() { clearTimeout(timer); },
  };
}

function field(value: unknown, key: string): unknown {
  try {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)[key]
      : undefined;
  } catch {
    return undefined;
  }
}

function workersFailure(error: unknown): { category: EmailError; rejected: boolean; fallback: boolean } {
  const code = field(error, 'code');
  const message = field(error, 'message');
  switch (code) {
    case 'E_SENDER_NOT_VERIFIED':
    case 'E_SENDER_DOMAIN_NOT_AVAILABLE':
      return { category: 'sender_not_verified', rejected: true, fallback: true };
    case 'E_RECIPIENT_NOT_ALLOWED':
    case 'E_RECIPIENT_SUPPRESSED':
      return { category: 'recipient_not_allowed', rejected: true, fallback: false };
    case 'E_RATE_LIMIT_EXCEEDED':
      return { category: 'rate_limited', rejected: true, fallback: false };
    case 'E_DAILY_LIMIT_EXCEEDED':
      return { category: 'daily_limit', rejected: true, fallback: false };
    default:
      return {
        category: typeof message === 'string' && message.length <= MAX_RESPONSE_BYTES && message.toLowerCase().includes('email sending not authorized for subdomain')
          ? 'sender_not_verified' : 'provider_unavailable',
        rejected: false,
        fallback: false,
      };
  }
}

async function messageIdMetadata(value: unknown): Promise<{ messageIdHash?: string }> {
  // Hash bounded IDs: provider-controlled metadata must not echo contact/OTP text.
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/.test(value) || !/[A-Za-z]/.test(value)) return {};
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return { messageIdHash: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') };
  } catch {
    return {};
  }
}

function cancelBody(response: Response): void {
  try { void response.body?.cancel().catch(() => {}); } catch { /* Cancellation is best effort. */ }
}

async function readMetadata(response: Response, deadline: ReturnType<typeof providerDeadline>): Promise<unknown> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try { reader = response.body?.getReader(); } catch { return null; }
  if (!reader) return null;
  let complete = false;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (let reads = 0; ; reads++) {
      if (reads >= MAX_RESPONSE_CHUNKS) return null;
      const result = await deadline.wait(() => reader.read());
      if (result.kind !== 'resolved') return null;
      if (result.value.done) { complete = true; break; }
      size += result.value.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) return null;
      chunks.push(result.value.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  } finally {
    if (!complete) {
      try { void reader.cancel().catch(() => {}); } catch { /* Do not await a stalled provider cancellation. */ }
    }
    try { reader.releaseLock(); } catch { /* A late pending read is already fenced. */ }
  }
}

function classifyResendError(status: number, body: unknown): EmailError {
  const rawName = field(body, 'name');
  const rawMessage = field(body, 'message');
  const name = typeof rawName === 'string' ? rawName.toLowerCase() : '';
  const message = typeof rawMessage === 'string' ? rawMessage.toLowerCase() : '';
  if (status === 429) {
    return name === 'daily_quota_exceeded' || name === 'monthly_quota_exceeded' ? 'daily_limit' : 'rate_limited';
  }
  if (status === 403 && name === 'validation_error') {
    if (message.includes('only send testing emails')) return 'recipient_not_allowed';
    if (message.includes('domain is not verified') || message.includes('verify a domain')) return 'sender_not_verified';
  }
  return 'provider_unavailable';
}

function logDeliveryFailure(env: Env, params: SendEmailParams, result: EmailResult): void {
  console.error(JSON.stringify({
    event: 'email_delivery_failed',
    provider: result.provider,
    category: result.error,
    state: result.state,
    evidence: result.evidence,
    ...(params.purpose ? { purpose: params.purpose } : {}),
    ...(env.ENVIRONMENT ? { environment: env.ENVIRONMENT } : {}),
  }));
}

async function sendResend(env: Env, params: SendEmailParams): Promise<EmailResult> {
  const controller = new AbortController();
  const deadline = providerDeadline(() => controller.abort());
  try {
    const attempt = await deadline.wait(() => fetch('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${params.fromName || FROM_NAME} <${FROM_EMAIL}>`,
        to: [params.to], subject: params.subject, html: params.html, text: params.text,
      }),
      signal: controller.signal,
    }).then((response) => {
      if (deadline.expired) cancelBody(response);
      return response;
    }));
    if (attempt.kind !== 'resolved') {
      return { sent: false, provider: 'resend', state: 'delivery_unknown', evidence: attempt.kind === 'deadline' ? 'deadline' : 'provider_exception', error: 'provider_unavailable' };
    }
    const response = attempt.value;
    const body = await readMetadata(response, deadline);
    // Headers remain acceptance evidence even when optional metadata is unavailable.
    if (response.ok) {
      const metadata = await deadline.wait(() => messageIdMetadata(field(body, 'id')));
      return { sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response', ...(metadata.kind === 'resolved' ? metadata.value : {}) };
    }
    return {
      sent: false, provider: 'resend',
      state: response.status >= 400 && response.status < 500 && response.status !== 408 ? 'rejected' : 'delivery_unknown',
      evidence: 'http_response', error: classifyResendError(response.status, body),
    };
  } finally {
    deadline.close();
  }
}

export async function sendEmail(env: Env, params: SendEmailParams): Promise<EmailResult> {
  if (env.SEND_EMAIL) {
    const deadline = providerDeadline();
    let attempt;
    let metadata: { messageIdHash?: string } = {};
    try {
      attempt = await deadline.wait(() => env.SEND_EMAIL!.send({
        to: params.to,
        from: { email: FROM_EMAIL, name: params.fromName || FROM_NAME },
        subject: params.subject, html: params.html,
        text: params.text || params.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        headers: { 'X-Frigo-Kind': 'transactional' },
      }));
      if (attempt.kind === 'resolved') {
        const value = attempt.value;
        const result = await deadline.wait(() => messageIdMetadata(field(value, 'messageId')));
        if (result.kind === 'resolved') metadata = result.value;
      }
    } finally {
      deadline.close();
    }
    if (attempt.kind === 'resolved') {
      return { sent: true, provider: 'workers-email', state: 'accepted', evidence: 'native_resolved', ...metadata };
    }
    const failure = workersFailure(attempt.kind === 'exception' ? attempt.error : undefined);
    const result: EmailResult = {
      sent: false, provider: 'workers-email', state: failure.rejected ? 'rejected' : 'delivery_unknown',
      evidence: attempt.kind === 'deadline' ? 'deadline' : failure.rejected ? 'native_rejection_code' : 'provider_exception',
      error: failure.category,
    };
    logDeliveryFailure(env, params, result);
    if (!failure.fallback || !env.RESEND_API_KEY) return result;
  }
  const result: EmailResult = env.RESEND_API_KEY
    ? await sendResend(env, params)
    : { sent: false, provider: 'none', state: 'not_configured', evidence: 'configuration', error: 'not_configured' };
  if (!result.sent) logDeliveryFailure(env, params, result);
  return result;
}

/**
 * Build Frigo-styled OTP email. Purpose-specific copy in Vietnamese.
 */
export function buildOtpEmail(code: string, purpose: 'register' | 'forgot_password' | 'login'): { subject: string; html: string; text: string } {
  const action =
    purpose === 'register'
      ? 'xác thực tài khoản'
      : purpose === 'forgot_password'
        ? 'đặt lại mật khẩu'
        : 'đăng nhập';

  const subject = `Mã xác thực Takosan: ${code}`;

  const text = `Mã ${action} của bạn là: ${code}\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n— Takosan: Ăn đủ. Mua đủ. Dùng hết.`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8FAF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAF9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
        <tr><td style="background:#059669;padding:24px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">Takosan</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:18px;color:#0F172A;">Mã ${action}</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#475569;line-height:1.5;">Nhập mã sau vào ứng dụng Frigo để tiếp tục. Mã có hiệu lực trong <strong>10 phút</strong>.</p>
          <div style="background:#E6F4EA;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#059669;font-family:'SF Mono',Menlo,monospace;">${code}</span>
          </div>
          <p style="margin:0 0 4px;font-size:13px;color:#475569;">Không chia sẻ mã này với bất kỳ ai — nhân viên Frigo không bao giờ hỏi mã của bạn.</p>
          <p style="margin:0;font-size:13px;color:#94A3B8;">Nếu bạn không yêu cầu mã này, hãy bỏ qua email.</p>
        </td></tr>
        <tr><td style="background:#F8FAF9;padding:16px 32px;text-align:center;">
          <span style="font-size:12px;color:#94A3B8;">Takosan — Ăn đủ. Mua đủ. Dùng hết.</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
