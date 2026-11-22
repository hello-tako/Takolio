import { create } from 'zustand';
import { api } from '../services/api';
import {
  capturePrivateSession,
  clearPrivateIdentity,
  currentPrivateScope,
  LOGOUT_PENDING_KEY,
  LOGOUT_WARNING,
  OFFLINE_GUEST_KEY,
  onPrivateSessionReset,
  privateSessionBlocked,
  removeLegacyPrivateCaches,
  resetPrivateSession,
} from '../lib/private-session';
import { clearVerifyContext } from '../features/auth/verify-context';

export const ONBOARDING_GOALS_STORAGE_KEY = 'takolio_onboarding_goals';

const LEGACY_DEFAULT_NAME_RE = /^Người dùng\s+Fri\w*$/i;

export function sanitizeUserDisplayName(raw: string | undefined | null, isGuest = false): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return isGuest ? 'Khách ghé thăm' : 'Bếp trưởng';
  if (LEGACY_DEFAULT_NAME_RE.test(trimmed)) return 'Bếp trưởng';
  return raw as string;
}

function readPersistedPrimaryGoal(): string | undefined {
  try {
    const raw = localStorage.getItem(ONBOARDING_GOALS_STORAGE_KEY);
    if (raw === 'fridge' || raw === 'today' || raw === 'week') return raw;
  } catch {
    // Ignore storage read errors.
  }
  return undefined;
}

function writePersistedPrimaryGoal(goal?: string): void {
  try {
    if (goal === 'fridge' || goal === 'today' || goal === 'week') {
      localStorage.setItem(ONBOARDING_GOALS_STORAGE_KEY, goal);
    }
  } catch {
    // Ignore storage write errors.
  }
}

function clearPersistedPrimaryGoal(): void {
  try {
    localStorage.removeItem(ONBOARDING_GOALS_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors.
  }
}

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  householdId?: string;
  onboardingCompleted?: boolean;
}

interface AuthState {
  userId: string;
  householdId: string;
  email: string;
  isGuest: boolean;
  displayName: string;
  avatarUrl?: string;
  isOnboarded: boolean;
  householdSize: number;
  spicyLevel: string;
  favoriteCuisines: string[];
  dietaryRestrictions: string[];
  /** Client-only planning goal from onboarding; persisted in takolio_onboarding_goals. */
  primaryGoal?: string;
  isPlus: boolean;
  setPlusFromServer: (isPlus: boolean) => void;
  syncPlusFromServer: () => Promise<void>;
  setGuestSession: () => Promise<void>;
  setAuthSession: (user: AuthUser) => void;
  setOnboardingFromServer: (
    completed: boolean,
    preferences?: Partial<
      Pick<AuthState, 'householdSize' | 'spicyLevel' | 'favoriteCuisines' | 'dietaryRestrictions'>
    >,
  ) => void;
  setOnboardingData: (data: {
    householdSize: number;
    spicyLevel: string;
    favoriteCuisines: string[];
    dietaryRestrictions: string[];
    primaryGoal?: string;
  }) => void;
  logoutStatus: 'idle' | 'pending' | 'error';
  logoutError: string | null;
  logout: () => Promise<boolean>;
}

const anonymousState = {
  userId: '',
  householdId: '',
  email: '',
  displayName: 'Khách ghé thăm',
  avatarUrl: undefined,
  isGuest: true,
  isOnboarded: false,
  isPlus: false,
  householdSize: 2,
  spicyLevel: 'medium',
  favoriteCuisines: [] as string[],
  dietaryRestrictions: [],
  primaryGoal: undefined as string | undefined,
};
let logoutRequest: Promise<boolean> | null = null;
let guestSessionRequest: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => {
  removeLegacyPrivateCaches();
  if (privateSessionBlocked()) {
    clearVerifyContext();
    clearPrivateIdentity();
    clearPersistedPrimaryGoal();
  }
  const savedUserId = localStorage.getItem('frigo_user_id') || '';
  const savedHouseholdId = localStorage.getItem('frigo_household_id') || '';
  const savedIsGuest = !savedUserId || localStorage.getItem('frigo_is_guest') === 'true';

  if (savedIsGuest) {
    localStorage.removeItem('frigo_email');
  }
  const savedEmail = savedIsGuest ? '' : localStorage.getItem('frigo_email') || '';
  const rawDisplayName = localStorage.getItem('frigo_display_name');
  const savedDisplayName = rawDisplayName
    ? sanitizeUserDisplayName(rawDisplayName, savedIsGuest)
    : savedIsGuest
      ? 'Khách ghé thăm'
      : 'Người dùng Takolio';
  const savedAvatarUrl = localStorage.getItem('frigo_avatar_url') || '';
  const savedOnboarded = localStorage.getItem('frigo_onboarded') === 'true';
  const savedPrimaryGoal = readPersistedPrimaryGoal();
  if (savedUserId && !savedIsGuest) clearVerifyContext();

  return {
    userId: savedUserId,
    householdId: savedHouseholdId,
    email: savedEmail,
    isGuest: savedIsGuest,
    displayName: savedDisplayName,
    avatarUrl: savedAvatarUrl,
    isOnboarded: savedOnboarded,
    isPlus: false,
    householdSize: 2,
    spicyLevel: 'medium',
    favoriteCuisines: [],
    dietaryRestrictions: [],
    primaryGoal: savedPrimaryGoal,
    logoutStatus: privateSessionBlocked() ? 'error' : 'idle',
    logoutError: privateSessionBlocked() ? LOGOUT_WARNING : null,

    // Only authenticated /me responses supply entitlement; local cache is not proof.
    setPlusFromServer: (isPlus: boolean) => {
      if (privateSessionBlocked() || !get().userId) return;
      localStorage.setItem('frigo_is_plus', isPlus ? 'true' : 'false');
      set({ isPlus });
    },

    syncPlusFromServer: async () => {
      const isCurrent = capturePrivateSession();
      try {
        const me = await api.getMe({ requireServer: true });
        if (!isCurrent() || me?.user?.id !== get().userId) return;
        const isPlus = me?.user?.isPlus === true;
        localStorage.setItem('frigo_is_plus', isPlus ? 'true' : 'false');
        const isOnboarded = me?.user?.onboardingCompleted === true;
        localStorage.setItem('frigo_onboarded', isOnboarded ? 'true' : 'false');
        const nextDisplayName = me?.user?.displayName
          ? sanitizeUserDisplayName(me.user.displayName, Boolean(me?.user?.isGuest))
          : get().displayName;
        set({
          isPlus,
          isOnboarded,
          displayName: nextDisplayName,
          ...(me?.user?.preferences || {}),
        });
      } catch {
        // keep cached value if the server is unreachable
      }
    },

    setAuthSession: (user: AuthUser) => {
      if (privateSessionBlocked()) throw new Error(LOGOUT_WARNING);
      if (!user.id || !user.householdId)
        throw new Error('Máy chủ chưa xác nhận danh tính và hộ gia đình.');
      clearVerifyContext();
      const hid = user.householdId;
      const current = currentPrivateScope();
      const identityChanged = current.userId !== user.id || current.householdId !== hid;
      if (identityChanged) {
        resetPrivateSession();
        clearPersistedPrimaryGoal();
        for (const key of ['frigo_onboarded', 'frigo_is_plus', 'frigo_avatar_url', 'frigo_email', 'frigo_display_name'])
          localStorage.removeItem(key);
      }
      const cleanDisplayName = sanitizeUserDisplayName(user.displayName, false);
      localStorage.setItem('frigo_user_id', user.id);
      localStorage.setItem('frigo_household_id', hid);
      if (user.email) localStorage.setItem('frigo_email', user.email);
      else localStorage.removeItem('frigo_email');
      localStorage.setItem('frigo_display_name', cleanDisplayName);
      if (user.avatarUrl) localStorage.setItem('frigo_avatar_url', user.avatarUrl);
      else localStorage.removeItem('frigo_avatar_url');
      localStorage.removeItem('frigo_token');
      sessionStorage.removeItem('frigo_guest_token');
      localStorage.setItem('frigo_is_guest', 'false');
      localStorage.removeItem(OFFLINE_GUEST_KEY);
      const isOnboarded =
        typeof user.onboardingCompleted === 'boolean'
          ? user.onboardingCompleted
          : identityChanged
            ? false
            : get().isOnboarded;
      localStorage.setItem('frigo_onboarded', isOnboarded ? 'true' : 'false');

      set({
        userId: user.id,
        householdId: hid,
        email: user.email,
        displayName: cleanDisplayName,
        avatarUrl: user.avatarUrl,
        isGuest: false,
        isOnboarded,
      });
    },

    setOnboardingFromServer: (completed, preferences) => {
      if (privateSessionBlocked() || !get().userId) return;
      localStorage.setItem('frigo_onboarded', completed ? 'true' : 'false');
      set({ isOnboarded: completed, ...preferences });
    },

    // Onboarding must not replace an existing guest or signed-in cookie.
    setGuestSession: () => {
      if (privateSessionBlocked()) return Promise.reject(new Error(LOGOUT_WARNING));
      if (get().userId) return Promise.resolve();
      if (guestSessionRequest) return guestSessionRequest;
      const isCurrent = capturePrivateSession();
      guestSessionRequest = (async () => {
        try {
          let res: Response;
          try {
            res = await fetch('/api/v1/auth/guest', { method: 'POST', credentials: 'include' });
          } catch {
            if (!isCurrent()) throw new Error('Phiên làm việc đã thay đổi. Vui lòng thử lại.');
            const id = `guest_${crypto.randomUUID()}`;
            clearPrivateIdentity();
            localStorage.setItem('frigo_user_id', id);
            localStorage.setItem('frigo_household_id', `hh_${id}`);
            localStorage.setItem('frigo_is_guest', 'true');
            localStorage.setItem(OFFLINE_GUEST_KEY, 'true');
            set({
              userId: id,
              householdId: `hh_${id}`,
              email: '',
              isGuest: true,
              displayName: 'Khách ghé thăm',
            });
            return;
          }
          if (!isCurrent()) throw new Error('Phiên làm việc đã thay đổi. Vui lòng thử lại.');
          if (!res.ok) throw new Error('Không thể khởi tạo phiên khách. Vui lòng thử lại.');
          const data = (await res.json()) as { success?: boolean; user?: AuthUser };
          if (!isCurrent()) throw new Error('Phiên làm việc đã thay đổi. Vui lòng thử lại.');
          if (!data.success || !data.user?.id || !data.user?.householdId) {
            throw new Error('Máy chủ chưa xác nhận phiên khách.');
          }
          const id: string = data.user.id;
          const hid: string = data.user.householdId;
          clearPrivateIdentity();
          localStorage.setItem('frigo_user_id', id);
          localStorage.setItem('frigo_household_id', hid);
          localStorage.setItem('frigo_is_guest', 'true');
          localStorage.removeItem('frigo_token');
          set({
            userId: id,
            householdId: hid,
            email: '',
            isGuest: true,
            displayName: sanitizeUserDisplayName(data.user?.displayName, true),
          });
        } finally {
          guestSessionRequest = null;
        }
      })();
      return guestSessionRequest;
    },

    setOnboardingData: (data) => {
      if (privateSessionBlocked() || !get().userId) return;
      localStorage.setItem('frigo_onboarded', 'true');
      writePersistedPrimaryGoal(data.primaryGoal);
      set({
        isOnboarded: true,
        ...data,
      });
    },

    logout: () => {
      if (logoutRequest) return logoutRequest;
      localStorage.setItem(LOGOUT_PENDING_KEY, 'true');
      clearPrivateIdentity();
      clearPersistedPrimaryGoal();
      set({ ...anonymousState, logoutStatus: 'pending', logoutError: null });
      logoutRequest = (async () => {
        try {
          await api.logout();
          localStorage.removeItem(LOGOUT_PENDING_KEY);
          set({ logoutStatus: 'idle', logoutError: null });
          return true;
        } catch {
          set({ logoutStatus: 'error', logoutError: LOGOUT_WARNING });
          return false;
        } finally {
          logoutRequest = null;
        }
      })();
      return logoutRequest;
    },
  };
});

onPrivateSessionReset(() => {
  clearVerifyContext();
  clearPersistedPrimaryGoal();
  useAuthStore.setState({
    ...anonymousState,
    logoutStatus: privateSessionBlocked() ? 'error' : 'idle',
    logoutError: privateSessionBlocked() ? LOGOUT_WARNING : null,
  });
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (
      event.key === LOGOUT_PENDING_KEY ||
      event.key === 'frigo_user_id' ||
      event.key === 'frigo_household_id'
    ) {
      sessionStorage.removeItem('frigo_guest_token');
      resetPrivateSession();
      const isGuestNext =
        !currentPrivateScope().userId || localStorage.getItem('frigo_is_guest') === 'true';
      const rawName = localStorage.getItem('frigo_display_name');
      useAuthStore.setState({
        ...currentPrivateScope(),
        email: localStorage.getItem('frigo_email') || '',
        displayName: rawName ? sanitizeUserDisplayName(rawName, isGuestNext) : anonymousState.displayName,
        avatarUrl: localStorage.getItem('frigo_avatar_url') || undefined,
        isGuest: isGuestNext,
        isOnboarded: localStorage.getItem('frigo_onboarded') === 'true',
        isPlus: localStorage.getItem('frigo_is_plus') === 'true',
        primaryGoal: readPersistedPrimaryGoal(),
        logoutStatus: privateSessionBlocked() ? 'error' : 'idle',
        logoutError: privateSessionBlocked() ? LOGOUT_WARNING : null,
      });
    }
  });
}
