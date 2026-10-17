import type { Env } from '../types';
import profiles from '../../../config/domain-profiles.json';

export const DOMAIN_PROFILES = profiles;

export function domainProfile(env: Pick<Env, 'ENVIRONMENT' | 'APP_URL' | 'PUBLIC_DOMAIN_ROUTING'>) {
  if (env.PUBLIC_DOMAIN_ROUTING === undefined || env.PUBLIC_DOMAIN_ROUTING === 'false') return null;
  const profile = env.ENVIRONMENT === 'production' ? DOMAIN_PROFILES.production
    : env.ENVIRONMENT === 'staging' ? DOMAIN_PROFILES.staging : null;
  if (env.PUBLIC_DOMAIN_ROUTING !== 'true' || !profile || env.APP_URL !== profile.app) {
    throw new Error('DOMAIN_CONFIGURATION_INVALID');
  }
  return profile;
}
