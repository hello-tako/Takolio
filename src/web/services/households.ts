import { resetPrivateSession } from '../lib/private-session';
import { rebindPendingOps, type PendingScope } from '../lib/sync';
import { fetchJson, getCurrentScope, guardPrivateSession } from './http';

export interface HouseholdMemberDto {
  userId: string;
  displayName: string;
  email: string | null;
  avatarUrl: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface HouseholdInviteDto {
  id: string;
  inviteCode: string;
  role: 'owner' | 'member' | string;
  maxUses: number;
  usedCount: number;
  expiresAt: string;
  createdAt: string;
}

export interface CurrentHouseholdResponse {
  household: {
    id: string;
    name: string;
    createdBy: string;
    createdAt: string;
    myRole: 'owner' | 'member';
  };
  members: HouseholdMemberDto[];
  invites: HouseholdInviteDto[];
}

export interface GuestImportPayload {
  items?: Array<{
    id?: string;
    name: string;
    quantity: number;
    unit?: string;
    category?: string;
    storage?: 'fridge' | 'freezer' | 'pantry';
    expiryDate?: string | null;
    expiryEstimated?: boolean;
  }>;
  shoppingItems?: Array<{
    id?: string;
    name: string;
    quantity?: number;
    unit?: string;
    isChecked?: boolean;
    ingredientId?: string;
  }>;
  guestSessionToken?: string;
  previousGuestScope?: PendingScope;
}

export const householdsApi = {
  getCurrentHousehold: async (): Promise<CurrentHouseholdResponse> => {
    const assertCurrent = guardPrivateSession();
    const res = await fetchJson<CurrentHouseholdResponse>('/households/current');
    assertCurrent();
    return res;
  },

  createInvite: async (options?: { maxUses?: number; expiresInDays?: number }): Promise<{
    success: boolean;
    invite: HouseholdInviteDto;
  }> => {
    const assertCurrent = guardPrivateSession();
    const res = await fetchJson<{ success: boolean; invite: HouseholdInviteDto }>(
      '/households/invites',
      {
        method: 'POST',
        body: JSON.stringify(options ?? {}),
      }
    );
    assertCurrent();
    return res;
  },

  joinHousehold: async (inviteCode: string): Promise<{
    success: boolean;
    alreadyMember?: boolean;
    householdId: string;
    householdName: string;
    role: 'owner' | 'member';
    household: { id: string; name: string; role: 'owner' | 'member' };
  }> => {
    const assertCurrent = guardPrivateSession();
    const res = await fetchJson<{
      success: boolean;
      alreadyMember?: boolean;
      householdId: string;
      householdName: string;
      role: 'owner' | 'member';
      household: { id: string; name: string; role: 'owner' | 'member' };
    }>('/households/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
    assertCurrent();
    const nextHouseholdId = res.household?.id ?? res.householdId;
    if (nextHouseholdId && nextHouseholdId !== getCurrentScope().householdId) {
      localStorage.setItem('frigo_household_id', nextHouseholdId);
      resetPrivateSession();
    }
    return res;
  },

  removeMember: async (memberUserId: string): Promise<{
    success: boolean;
    removedUserId?: string;
    leftHousehold?: boolean;
    householdId?: string;
    activeHouseholdId?: string;
  }> => {
    const assertCurrent = guardPrivateSession();
    const res = await fetchJson<{
      success: boolean;
      removedUserId?: string;
      leftHousehold?: boolean;
      householdId?: string;
      activeHouseholdId?: string;
    }>(`/households/members/${encodeURIComponent(memberUserId)}`, {
      method: 'DELETE',
    });
    assertCurrent();
    const nextHouseholdId = res.activeHouseholdId ?? res.householdId;
    if (nextHouseholdId && nextHouseholdId !== getCurrentScope().householdId) {
      localStorage.setItem('frigo_household_id', nextHouseholdId);
      resetPrivateSession();
    }
    return res;
  },

  importGuestData: async (payload: GuestImportPayload): Promise<{
    success: boolean;
    importedItemsCount: number;
    importedShoppingCount: number;
    inventory?: unknown[];
  }> => {
    const assertCurrent = guardPrivateSession();
    const { previousGuestScope, ...requestBody } = payload;
    const res = await fetchJson<{
      success: boolean;
      importedItemsCount: number;
      importedShoppingCount: number;
      inventory?: unknown[];
    }>('/households/import-guest', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    assertCurrent();
    if (res.success && previousGuestScope?.userId && previousGuestScope?.householdId) {
      const targetScope = getCurrentScope();
      if (targetScope.userId && targetScope.householdId) {
        rebindPendingOps(previousGuestScope, targetScope);
      }
    }
    return res;
  },
};
