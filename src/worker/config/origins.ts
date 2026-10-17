import type { Env } from '../types';
import { domainProfile } from './domains';

const DEVELOPMENT_ORIGINS = new Set([
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:8787', 'http://127.0.0.1:8787',
]);

export function applicationOrigin(env: Pick<Env, 'APP_URL' | 'ENVIRONMENT'>): string | null {
  try {
    const url = new URL(env.APP_URL || '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const loopback = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') ||
      url.hostname === '127.0.0.1' || url.hostname === '[::1]';
    if (env.ENVIRONMENT === 'production' && (url.protocol !== 'https:' || loopback)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isTrustedOrigin(origin: string, env: Pick<Env, 'APP_URL' | 'ENVIRONMENT' | 'PUBLIC_DOMAIN_ROUTING'>): boolean {
  try {
    if (new URL(origin).origin !== origin) return false;
    const profile = domainProfile(env);
    return origin === applicationOrigin(env) ||
      (profile !== null && origin === profile.legacy) ||
      (env.ENVIRONMENT === 'development' && DEVELOPMENT_ORIGINS.has(origin));
  } catch {
    return false;
  }
}
