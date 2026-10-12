/** Masks an email for default display: `ab•••@domain`. Never reveals more than 2 local chars. */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return '•••';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}•••@${domain}`;
}

/** Last four digits only; provider-facing order codes stay server-side. */
export function maskOrderCode(code: string | null | undefined): string {
  if (!code) return '••••';
  return `••••${code.slice(-4)}`;
}
