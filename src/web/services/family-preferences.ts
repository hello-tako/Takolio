import {
  FamilyPreferencesSchema,
  FamilyPreferencesDtoSchema,
  SaveFamilyPreferencesSchema,
  type FamilyPreferences,
} from '../../../packages/domain/src/family-preferences-api';
import { fetchJson } from './http';
export { FamilyPreferencesSchema };
export type { FamilyPreferences };
export const DEFAULT_FAMILY_PREFERENCES: FamilyPreferences = FamilyPreferencesSchema.parse({});
export const familyPreferencesApi = {
  async get() {
    return FamilyPreferencesDtoSchema.parse(
      await fetchJson('/family-preferences', { cache: 'no-store' }),
    );
  },
  async save(expectedRevision: number, preferences: FamilyPreferences) {
    return FamilyPreferencesDtoSchema.parse(
      await fetchJson('/family-preferences', {
        method: 'PUT',
        body: JSON.stringify(SaveFamilyPreferencesSchema.parse({ expectedRevision, preferences })),
      }),
    );
  },
};
