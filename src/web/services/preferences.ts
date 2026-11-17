import type { z } from 'zod';
import {
  type FamilyPreferencesDto,
  type SaveFamilyPreferencesSchema,
} from '../../../packages/domain/src/family-preferences-api';
import { fetchJson, guardPrivateSession } from './http';

export interface UnifiedUserPreferences {
  householdSize?: number;
  spicyLevel?: 'none' | 'mild' | 'medium' | 'hot';
  favoriteCuisines?: string[];
  dietaryRestrictions?: string[];
  allergens?: string[];
  language?: string;
}

export type SaveFamilyPreferencesInput = z.input<typeof SaveFamilyPreferencesSchema>;

export const preferencesApi = {
  getPreferences: async (): Promise<UnifiedUserPreferences> => {
    const assertCurrent = guardPrivateSession();
    const result = await fetchJson<{ preferences: UnifiedUserPreferences }>('/preferences');
    assertCurrent();
    return result.preferences;
  },

  updatePreferences: async (
    patch: UnifiedUserPreferences & { completeOnboarding?: boolean }
  ): Promise<{
    success: boolean;
    onboardingCompleted?: boolean;
    preferences: UnifiedUserPreferences;
  }> => {
    const assertCurrent = guardPrivateSession();
    const result = await fetchJson<{
      success: boolean;
      onboardingCompleted?: boolean;
      preferences: UnifiedUserPreferences;
    }>('/preferences', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    assertCurrent();
    return result;
  },

  getFamilyPreferences: async (): Promise<FamilyPreferencesDto> => {
    const assertCurrent = guardPrivateSession();
    const result = await fetchJson<FamilyPreferencesDto>('/family-preferences');
    assertCurrent();
    return result;
  },

  saveFamilyPreferences: async (
    input: SaveFamilyPreferencesInput
  ): Promise<FamilyPreferencesDto> => {
    const assertCurrent = guardPrivateSession();
    const result = await fetchJson<FamilyPreferencesDto>('/family-preferences', {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    assertCurrent();
    return result;
  },
};
