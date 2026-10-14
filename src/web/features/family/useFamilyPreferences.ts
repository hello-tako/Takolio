import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { familyPreferencesApi } from '../../services/family-preferences';
import { isOfflineGuestSession } from '../../lib/private-session';
export const familyPreferencesKey = () => [...queryKeys.planningPreferences(), 'family'] as const;
export function useFamilyPreferences(enabled = true) {
  const offlineGuest = isOfflineGuestSession();
  return useQuery({
    queryKey: familyPreferencesKey(),
    queryFn: familyPreferencesApi.get,
    enabled: enabled && !offlineGuest,
    retry: false,
  });
}
