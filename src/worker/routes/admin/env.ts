import type { D1DatabaseBinding } from '@frigo/db';
import type { CustomerReadBinding } from '../../facade/contract';
import type { Fetcher, KVNamespace } from '@cloudflare/workers-types';

/** Dedicated admin bindings; customer data is reachable only through named RPC reads. */
export interface AdminEnv {
  CUSTOMER_READ?: CustomerReadBinding;
  ADMIN_FACADE_HMAC_SECRET?: string;
  /** Admin authority database (roles, sessions, approvals, audit). */
  ADMIN_DB?: D1DatabaseBinding;
  CACHE?: KVNamespace;
  ASSETS?: Fetcher;

  /** Exactly 'development' | 'test' | 'staging' | 'production'; anything else disables the console. */
  ENVIRONMENT?: string;
  /** Must be exactly 'true' for the console to exist in any environment. */
  ADMIN_CONSOLE_ENABLED?: string;
  /** Exact serialized origin of the admin host, e.g. https://admin.example.com. */
  ADMIN_ORIGIN?: string;
  /** 'cloudflare_access' (any environment) or 'password' (local development/test builds only). */
  ADMIN_AUTH_MODE?: string;
  ADMIN_ACCESS_TEAM_DOMAIN?: string;
  ADMIN_ACCESS_AUD?: string;
  /** Customer app URL; outside development the admin host must differ from it. */
  CUSTOMER_APP_URL?: string;
  /** Optional (>= 32 chars) key for hashing client IPs in audit rows. */
  ADMIN_AUDIT_HMAC_SECRET?: string;
  GIT_COMMIT?: string;
  /** Display only: the customer Worker's recipe catalog mode when mirrored into admin config. */
  RECIPE_CATALOG_MODE?: string;
}
