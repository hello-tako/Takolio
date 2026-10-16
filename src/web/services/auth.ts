import { rebindPendingOps } from '../lib/sync';
import { LOGOUT_PENDING_KEY, isOfflineGuestSession, onPrivateSessionReset } from '../lib/private-session';
import { OtpRequestRetryClient, type OtpResponseMetadata } from './auth-otp-retry';
import {
  BASE_URL,
  ApiError,
  fetchJson,
  isOffline,
  getCurrentScope,
  getUserId,
  getHouseholdId,
  guardPrivateSession,
  handleUnauthorized,
} from './http';

// DEC-012: the server refuses guest→account inventory transfer before consuming
// the OTP; the same code stays valid for a retry without the transfer field.
export const INVENTORY_TRANSFER_DEFERRED = 'INVENTORY_TRANSFER_DEFERRED';

interface AuthResponseUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  householdId: string;
  onboardingCompleted?: boolean;
}

export function isInventoryTransferDeferred(err: unknown): boolean {
  return err instanceof ApiError && err.status === 409 && err.code === INVENTORY_TRANSFER_DEFERRED;
}

const otpRequestRetry = new OtpRequestRetryClient();
onPrivateSessionReset(() => otpRequestRetry.reset());

async function postOtp<T>(path: string, body: Record<string, unknown>, issuance: boolean): Promise<T> {
  const assertCurrent = guardPrivateSession();
  const scope = getCurrentScope();
  const receipt = await otpRequestRetry.begin(path, body, JSON.stringify([scope.userId, scope.householdId]));
  assertCurrent();
  try {
    const result = await fetchJson<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      ...(receipt.key ? { headers: { 'Idempotency-Key': receipt.key } } : {}),
    });
    otpRequestRetry.finish(receipt, result, issuance);
    return result;
  } catch (error) {
    if (error instanceof ApiError) otpRequestRetry.finish(receipt, error.payload, issuance, error.status);
    throw error;
  }
}

export const authApi = {
  // GET /preferences — real server preferences used by the dedicated
  // /me/preferences editor (T17 screen 20).
  getFoodPreferences: async () => {
    const assertCurrent = guardPrivateSession();
    const result = await fetchJson<{
      preferences: {
        householdSize?: number;
        spicyLevel?: 'none' | 'mild' | 'medium' | 'hot';
        favoriteCuisines?: string[];
        dietaryRestrictions?: string[];
        language?: string;
      };
    }>('/preferences');
    assertCurrent();
    return result.preferences;
  },

  // PATCH /preferences without completeOnboarding — updates the existing taste
  // profile without touching onboarding completion state.
  updateFoodPreferences: async (patch: {
    householdSize?: number;
    spicyLevel?: 'none' | 'mild' | 'medium' | 'hot';
    favoriteCuisines?: string[];
    dietaryRestrictions?: string[];
  }) =>
    fetchJson<{ success: boolean; preferences: Record<string, unknown> }>('/preferences', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  logout: async (): Promise<void> => {
    const response = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || ((await response.json()) as { success?: boolean }).success !== true) {
      throw new Error('Logout not confirmed');
    }
  },

  getMe: async (options?: { requireServer?: boolean }) => {
    const assertCurrent = guardPrivateSession();
    try {
      const result = await fetchJson<any>('/me');
      assertCurrent();
      const scope = getCurrentScope();
      if (result.user?.id !== scope.userId || result.user?.household?.id !== scope.householdId) {
        localStorage.setItem(LOGOUT_PENDING_KEY, 'true');
        handleUnauthorized();
        throw new ApiError(
          'auth',
          'Danh tính phiên máy chủ đã thay đổi. Vui lòng đăng xuất và đăng nhập lại.',
        );
      }
      return result;
    } catch (err) {
      assertCurrent();
      if (options?.requireServer || !isOffline(err) || !isOfflineGuestSession()) throw err;
      return {
        user: {
          id: getUserId(),
          displayName: 'Bạn mới của Takolio',
          isGuest: true,
          onboardingCompleted: localStorage.getItem('frigo_onboarded') === 'true',
          household: { id: getHouseholdId(), name: 'Tủ lạnh nhà tôi' },
          subscription: null,
        },
      };
    }
  },

  getPublicConfig: async () => {
    try {
      return await fetchJson<{ turnstileSiteKey: string | null; googleClientId: string | null }>(
        '/config',
      );
    } catch (err) {
      if (!isOffline(err)) throw err;
      return { turnstileSiteKey: null as string | null, googleClientId: null as string | null };
    }
  },

  completeOnboarding: async (preferences: {
    householdSize: number;
    spicyLevel: 'none' | 'mild' | 'medium' | 'hot';
    favoriteCuisines: string[];
    dietaryRestrictions: string[];
  }) =>
    fetchJson<{ success: boolean; onboardingCompleted: boolean }>('/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ ...preferences, completeOnboarding: true }),
    }),

  register: async (
    name: string,
    email: string,
    password: string,
    turnstileToken?: string | null,
  ) => {
    try {
      return await postOtp<{
        success: boolean;
        message: string;
        email: string;
        expiresInMinutes: number;
        devOtp?: string;
      } & OtpResponseMetadata>('/auth/register', { name, email, password, turnstileToken }, true);
    } catch (err: any) {
      // SEC-04: never fake a successful registration — surface the real error.
      throw err;
    }
  },

  verifyOtp: async (
    email: string,
    code: string,
    purpose: 'register' | 'forgot_password',
    migrateFromHouseholdId?: string | null,
    newPassword?: string,
  ) => {
    const assertCurrent = guardPrivateSession();
    try {
      const result = await postOtp<{
        success: boolean;
        user?: AuthResponseUser;
        resetToken?: string;
        migratedFromHouseholdId?: string;
      } & OtpResponseMetadata>('/auth/verify-otp', {
        email,
        code,
        purpose,
        ...(purpose === 'register' && newPassword !== undefined ? { newPassword } : {}),
        ...(purpose === 'register' && migrateFromHouseholdId ? { migrateFromHouseholdId } : {}),
      }, false);
      assertCurrent();

      // Preserve offline guest mutations when the same guest household is
      // migrated into the newly registered account.
      if (
        purpose === 'register' &&
        migrateFromHouseholdId &&
        result.migratedFromHouseholdId === migrateFromHouseholdId &&
        result.success &&
        result.user?.id &&
        result.user?.householdId
      ) {
        const current = getCurrentScope();
        if (current.householdId === migrateFromHouseholdId) {
          rebindPendingOps(current, {
            userId: result.user.id,
            householdId: result.user.householdId,
          });
        }
      }

      return result;
    } catch (err: any) {
      // SEC-04: never fake a verified session — surface the real error.
      throw err;
    }
  },

  resendOtp: async (email: string, purpose: string) => {
    try {
      return await postOtp<{
        success: boolean;
        message: string;
        expiresInMinutes: number;
        devOtp?: string;
      } & OtpResponseMetadata>('/auth/resend-otp', { email, purpose }, true);
    } catch (err: any) {
      // SEC-04: surface the real error instead of a fake OTP.
      throw err;
    }
  },

  login: async (email: string, password: string) => {
    try {
      return await postOtp<{ success: boolean; user: AuthResponseUser; requireOtp?: boolean; devOtp?: string } & OtpResponseMetadata>(
        '/auth/login', { email, password }, true,
      );
    } catch (err: any) {
      // SEC-04: never fake a login session — surface the real error.
      throw err;
    }
  },

  forgotPassword: async (email: string) => {
    try {
      return await postOtp<{ success: boolean; message: string; devOtp?: string } & OtpResponseMetadata>(
        '/auth/forgot-password', { email }, true,
      );
    } catch (err: any) {
      // SEC-04: surface the real error instead of a fake OTP.
      throw err;
    }
  },

  resetPassword: async (email: string, code: string, newPassword: string) => {
    try {
      return await postOtp<{ success: boolean; message: string; user?: AuthResponseUser } & OtpResponseMetadata>(
        '/auth/reset-password', { email, code, newPassword }, false,
      );
    } catch (err: any) {
      // SEC-04: surface the real error instead of faking success.
      throw err;
    }
  },

  loginWithGoogle: async (credential?: string, userInfo?: any) => {
    try {
      return await fetchJson<{ success: boolean; user: AuthResponseUser }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ credential, userInfo }),
      });
    } catch (err: any) {
      // SEC-04: never fake a Google session — surface the real error.
      console.warn('Backend Google auth failed:', err);
      throw err;
    }
  },
};
