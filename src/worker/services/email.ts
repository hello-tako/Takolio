/**
 * Provider acceptance adapter. A successful send is not inbox delivery proof.
 * Native ambiguity must never trigger a second send through Resend.
 */

import type { Env } from '../types';
import {
  resolveSupportedLocale,
  type SupportedLocale,
} from '../../../packages/domain/src/i18n';

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

const FROM_NAME = 'Takolio';
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
  const senderAddress = env.EMAIL_FROM_ADDRESS?.trim() || FROM_EMAIL;
  const senderName = params.fromName || env.EMAIL_FROM_NAME?.trim() || FROM_NAME;
  const controller = new AbortController();
  const deadline = providerDeadline(() => controller.abort());
  try {
    const attempt = await deadline.wait(() => fetch('https://api.resend.com/emails', {
      method: 'POST',
      redirect: 'error',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${senderName} <${senderAddress}>`,
        to: [params.to], subject: params.subject, html: params.html, text: params.text,
        headers: { 'Auto-Submitted': 'auto-generated' },
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
  const senderAddress = env.EMAIL_FROM_ADDRESS?.trim() || FROM_EMAIL;
  const senderName = params.fromName || env.EMAIL_FROM_NAME?.trim() || FROM_NAME;
  if (env.SEND_EMAIL) {
    const deadline = providerDeadline();
    let attempt;
    let metadata: { messageIdHash?: string } = {};
    try {
      attempt = await deadline.wait(() => env.SEND_EMAIL!.send({
        to: params.to,
        from: { email: senderAddress, name: senderName },
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

interface OtpCopyBundle {
  subject: (code: string) => string;
  heading: Record<'register' | 'forgot_password' | 'login', string>;
  introHtml: string;
  warning: string;
  ignore: string;
  tagline: string;
  plainText: (heading: string, code: string) => string;
}

const OTP_EMAIL_COPY: Readonly<Record<SupportedLocale, OtpCopyBundle>> = Object.freeze({
  en: {
    subject: (code) => `Takolio verification code: ${code}`,
    heading: {
      register: 'Verify your account',
      forgot_password: 'Reset your password',
      login: 'Sign-in verification code',
    },
    introHtml: 'Enter the code below in Takolio to continue. This code expires in <strong>10 minutes</strong>.',
    warning: 'Never share this code with anyone — Takolio staff will never ask for it.',
    ignore: 'If you did not request this code, you can safely ignore this email.',
    tagline: 'Takolio — Plan smart. Shop right. Waste nothing.',
    plainText: (heading, code) =>
      `${heading}: ${code}\nValid for 10 minutes. Never share this code with anyone.\n\nIf you did not request this code, please ignore this email.\n— Takolio`,
  },
  ja: {
    subject: (code) => `【Takolio】認証コード：${code}`,
    heading: {
      register: 'アカウント登録の認証コード',
      forgot_password: 'パスワード再設定の認証コード',
      login: 'ログイン認証コード',
    },
    introHtml: 'Takolioの画面に以下の認証コードを入力してください。有効期限は<strong>10分間</strong>です。',
    warning: 'このコードを第三者に教えないでください。Takolio運営が認証コードを尋ねることは一切ありません。',
    ignore: 'お心当たりがない場合は、このまま本メールを破棄してください。',
    tagline: 'Takolio — 賢く献立、無駄なくお買い物。',
    plainText: (heading, code) =>
      `${heading}：${code}\n有効期限は10分間です。第三者に共有しないでください。\n\nお心当たりがない場合は本メールを破棄してください。\n— Takolio`,
  },
  de: {
    subject: (code) => `Takolio-Bestätigungscode: ${code}`,
    heading: {
      register: 'Konto bestätigen',
      forgot_password: 'Passwort zurücksetzen',
      login: 'Anmeldecode',
    },
    introHtml: 'Geben Sie den folgenden Code in Takolio ein. Der Code ist <strong>10 Minuten</strong> gültig.',
    warning: 'Teilen Sie diesen Code niemals mit Dritten — Takolio fragt Sie nie danach.',
    ignore: 'Falls Sie diesen Code nicht angefordert haben, ignorieren Sie diese E-Mail bitte.',
    tagline: 'Takolio — Clever planen. Passend einkaufen. Nichts verschwenden.',
    plainText: (heading, code) =>
      `${heading}: ${code}\n10 Minuten gültig. Teilen Sie diesen Code nicht.\n\nFalls nicht angefordert, ignorieren Sie diese E-Mail.\n— Takolio`,
  },
  fr: {
    subject: (code) => `Code de vérification Takolio : ${code}`,
    heading: {
      register: 'Vérification de votre compte',
      forgot_password: 'Réinitialisation du mot de passe',
      login: 'Code de connexion',
    },
    introHtml: 'Saisissez le code ci-dessous dans Takolio pour continuer. Ce code est valable <strong>10 minutes</strong>.',
    warning: 'Ne partagez jamais ce code — l’équipe Takolio ne vous le demandera jamais.',
    ignore: 'Si vous n’êtes pas à l’origine de cette demande, ignorez simplement cet e-mail.',
    tagline: 'Takolio — Mieux planifier. Acheter juste. Zéro gaspillage.',
    plainText: (heading, code) =>
      `${heading} : ${code}\nValable 10 minutes. Ne partagez ce code avec personne.\n\nSi vous n’avez rien demandé, ignorez cet e-mail.\n— Takolio`,
  },
  es: {
    subject: (code) => `Código de verificación de Takolio: ${code}`,
    heading: {
      register: 'Verifica tu cuenta',
      forgot_password: 'Restablece tu contraseña',
      login: 'Código de inicio de sesión',
    },
    introHtml: 'Introduce el siguiente código en Takolio para continuar. Caduca en <strong>10 minutos</strong>.',
    warning: 'No compartas este código con nadie; el equipo de Takolio nunca te lo pedirá.',
    ignore: 'Si no solicitaste este código, puedes ignorar este correo.',
    tagline: 'Takolio — Planifica bien. Compra justo. Cero desperdicio.',
    plainText: (heading, code) =>
      `${heading}: ${code}\nVálido durante 10 minutos. No compartas este código.\n\nSi no lo solicitaste, ignora este correo.\n— Takolio`,
  },
  it: {
    subject: (code) => `Codice di verifica Takolio: ${code}`,
    heading: {
      register: 'Verifica il tuo account',
      forgot_password: 'Reimposta la password',
      login: 'Codice di accesso',
    },
    introHtml: 'Inserisci il codice seguente in Takolio per continuare. Scade tra <strong>10 minuti</strong>.',
    warning: 'Non condividere mai questo codice: il team Takolio non te lo chiederà mai.',
    ignore: 'Se non hai richiesto questo codice, ignora questa email.',
    tagline: 'Takolio — Pianifica bene. Compra il giusto. Zero sprechi.',
    plainText: (heading, code) =>
      `${heading}: ${code}\nValido per 10 minuti. Non condividere questo codice.\n\nSe non richiesto, ignora questa email.\n— Takolio`,
  },
  nl: {
    subject: (code) => `Takolio-verificatiecode: ${code}`,
    heading: {
      register: 'Bevestig je account',
      forgot_password: 'Wachtwoord opnieuw instellen',
      login: 'Inlogcode',
    },
    introHtml: 'Voer onderstaande code in Takolio in om door te gaan. De code is <strong>10 minuten</strong> geldig.',
    warning: 'Deel deze code met niemand — Takolio vraagt hier nooit om.',
    ignore: 'Heb je deze code niet aangevraagd, negeer deze e-mail dan.',
    tagline: 'Takolio — Slim plannen. Precies kopen. Niets verspillen.',
    plainText: (heading, code) =>
      `${heading}: ${code}\n10 minuten geldig. Deel deze code met niemand.\n— Takolio`,
  },
  pl: {
    subject: (code) => `Kod weryfikacyjny Takolio: ${code}`,
    heading: {
      register: 'Potwierdź konto',
      forgot_password: 'Resetowanie hasła',
      login: 'Kod logowania',
    },
    introHtml: 'Wpisz poniższy kod w aplikacji Takolio. Kod wygasa za <strong>10 minut</strong>.',
    warning: 'Nikomu nie udostępniaj tego kodu — zespół Takolio nigdy o niego nie prosi.',
    ignore: 'Jeśli to nie Ty wysłałeś prośbę, zignoruj tę wiadomość.',
    tagline: 'Takolio — Planuj mądrze. Kupuj z głową. Zero marnowania.',
    plainText: (heading, code) =>
      `${heading}: ${code}\nWażny przez 10 minut. Nie udostępniaj tego kodu.\n— Takolio`,
  },
  sv: {
    subject: (code) => `Verifieringskod för Takolio: ${code}`,
    heading: {
      register: 'Bekräfta ditt konto',
      forgot_password: 'Återställ lösenord',
      login: 'Inloggningskod',
    },
    introHtml: 'Ange koden nedan i Takolio för att fortsätta. Koden gäller i <strong>10 minuter</strong>.',
    warning: 'Dela aldrig koden med någon — Takolio ber aldrig om den.',
    ignore: 'Om du inte begärt denna kod kan du bortse från mejlet.',
    tagline: 'Takolio — Planera smart. Handla rätt. Inget matsvinn.',
    plainText: (heading, code) =>
      `${heading}: ${code}\nGiltig i 10 minuter. Dela aldrig denna kod.\n— Takolio`,
  },
  vi: {
    subject: (code) => `Mã xác thực Takolio: ${code}`,
    heading: {
      register: 'Mã xác thực tài khoản',
      forgot_password: 'Mã đặt lại mật khẩu',
      login: 'Mã đăng nhập',
    },
    introHtml: 'Nhập mã sau vào ứng dụng Takolio để tiếp tục. Mã có hiệu lực trong <strong>10 phút</strong>.',
    warning: 'Không chia sẻ mã này với bất kỳ ai — nhân viên Takolio không bao giờ hỏi mã của bạn.',
    ignore: 'Nếu bạn không yêu cầu mã này, hãy bỏ qua email.',
    tagline: 'Takolio — Ăn đủ. Mua đủ. Dùng hết.',
    plainText: (heading, code) =>
      `${heading} của bạn là: ${code}\nMã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.\n— Takolio: Bữa ngon, nhẹ đầu. · Ăn đủ. Mua đủ. Dùng hết.`,
  },
});

/**
 * Build Takolio-styled localized OTP email across global markets (JP, EU, VN, Global EN)
 * using Official Brand Board v2 palette (Leaf Green #196149, Tomato Coral & Warm Ivory #FFF9F1).
 */
export function buildOtpEmail(
  code: string,
  purpose: 'register' | 'forgot_password' | 'login',
  localeInput?: string | null,
): { subject: string; html: string; text: string } {
  const locale = resolveSupportedLocale(localeInput, 'vi');
  const copy = OTP_EMAIL_COPY[locale];
  const heading = copy.heading[purpose];
  const subject = copy.subject(code);
  const text = copy.plainText(heading, code);

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFF9F1;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Hiragino Sans','Yu Gothic','Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF9F1;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #DCE6DE;border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(21,46,44,0.06);">
        <tr><td style="background:#196149;padding:24px 32px;text-align:center;">
          <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.02em;">Takolio</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:18px;color:#152E2C;">${heading}</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#3C5954;line-height:1.5;">${copy.introHtml}</p>
          <div style="background:#E7F4EC;border:1px solid #BDE0CC;border-radius:14px;padding:20px;text-align:center;margin-bottom:24px;">
            <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#196149;font-family:'SF Mono',Menlo,monospace;">${code}</span>
          </div>
          <p style="margin:0 0 4px;font-size:13px;color:#3C5954;">${copy.warning}</p>
          <p style="margin:0;font-size:13px;color:#52706A;">${copy.ignore}</p>
        </td></tr>
        <tr><td style="background:#FFF0E9;padding:16px 32px;text-align:center;">
          <span style="font-size:12px;color:#152E2C;">${copy.tagline}</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}
