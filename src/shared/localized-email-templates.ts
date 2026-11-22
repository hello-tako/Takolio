import type { SupportedLocale } from './locales';

export type OtpEmailPurpose = 'verify' | 'login' | 'reset';

export interface LocalizedOtpEmail {
  subject: string;
  text: string;
  html: string;
  lang: 'vi' | 'en';
}

/**
 * Bilingual transactional OTP email templates (`vi` default, `en` for international users).
 * Zero plaintext PII beyond the recipient's ephemeral 6-digit OTP code; safe for Resend / MailChannels.
 */
export function buildLocalizedOtpEmail(
  code: string,
  purpose: OtpEmailPurpose,
  locale: SupportedLocale = 'vi',
): LocalizedOtpEmail {
  const isEnglish = locale !== 'vi';

  if (isEnglish) {
    const label =
      purpose === 'verify'
        ? 'Email Verification'
        : purpose === 'login'
          ? 'Sign-In'
          : 'Password Reset';
    const subject = `[Takolio] Your ${label.toLowerCase()} code: ${code}`;
    const text = [
      `Your Takolio ${label.toLowerCase()} verification code is: ${code}`,
      '',
      'This code expires in 10 minutes. If you did not request this, you can safely ignore this email.',
      '— Takolio Kitchen Assistant (https://takolio.com)',
    ].join('\n');
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #FFF9F1; color: #152E2C; border-radius: 16px;">
        <h2 style="color: #196149; margin-top: 0;">Takolio — ${label}</h2>
        <p style="font-size: 15px; line-height: 1.55;">Use this 6-digit code to continue:</p>
        <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 16px 20px; background: #FFFFFF; border: 1px solid #DCE6DE; border-radius: 12px; text-align: center; margin: 20px 0; color: #196149;">
          ${code}
        </div>
        <p style="color: #52706A; font-size: 13px; line-height: 1.5;">This code expires in 10 minutes. If you didn't request it, you can ignore this message.</p>
      </div>
    `;
    return { subject, text, html, lang: 'en' };
  }

  const labelVi =
    purpose === 'verify'
      ? 'xác nhận email'
      : purpose === 'login'
        ? 'đăng nhập'
        : 'đặt lại mật khẩu';
  const subject = `[Takolio] Mã ${labelVi}: ${code}`;
  const text = [
    `Mã ${labelVi} Takolio của bạn là: ${code}`,
    '',
    'Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    '— Takolio Trợ lý căn bếp (https://takolio.com)',
  ].join('\n');
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #FFF9F1; color: #152E2C; border-radius: 16px;">
      <h2 style="color: #196149; margin-top: 0;">Takolio — Mã ${labelVi}</h2>
      <p style="font-size: 15px; line-height: 1.55;">Nhập mã 6 chữ số bên dưới để tiếp tục:</p>
      <div style="font-size: 32px; font-weight: 800; letter-spacing: 6px; padding: 16px 20px; background: #FFFFFF; border: 1px solid #DCE6DE; border-radius: 12px; text-align: center; margin: 20px 0; color: #196149;">
        ${code}
      </div>
      <p style="color: #52706A; font-size: 13px; line-height: 1.5;">Mã có hiệu lực trong 10 phút. Nếu bạn không thực hiện yêu cầu này, bạn có thể bỏ qua email này.</p>
    </div>
  `;
  return { subject, text, html, lang: 'vi' };
}
