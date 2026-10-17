import type { Context, Next } from 'hono';
import type { AdminApp } from './http';

export const ADMIN_API_CSP = "default-src 'none'; frame-ancestors 'none'";

/** Admin documents: same-origin only, no third-party scripts, frames or connections. */
export function adminDocumentCsp(https: boolean): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (https) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

/** Applied to every admin Worker response, including 404s and errors. */
export async function adminSecurityHeaders(c: Context<AdminApp>, next: Next) {
  await next();
  for (const name of [...c.res.headers.keys()]) {
    if (name.startsWith('access-control-')) c.header(name, undefined);
  }
  const https = (c.get('policy')?.origin ?? c.req.url).startsWith('https://');
  c.header('Cache-Control', 'no-store');
  c.header('X-Robots-Tag', 'noindex, nofollow');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Cross-Origin-Opener-Policy', 'same-origin');
  c.header('Cross-Origin-Resource-Policy', 'same-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (https) c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  c.header('Content-Security-Policy', new URL(c.req.url).pathname.startsWith('/api/') ? ADMIN_API_CSP : adminDocumentCsp(https));
}
