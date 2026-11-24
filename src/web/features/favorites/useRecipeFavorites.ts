import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/useAuthStore';
import { recipeFavoritesApi } from '../../services/recipe-favorites';
import { queryKeys } from '../../lib/queryKeys';
import { ApiError } from '../../services/http';
import { capturePrivateSession } from '../../lib/private-session';
import { lSync, useLocaleText } from '../../i18n/app-i18n';

export const favoritesKey = () => [...queryKeys.recipes(), 'favorites'] as const;
export function useRecipeFavorites() {
  const { l } = useLocaleText();
  const guest = useAuthStore((state) => state.isGuest);
  const userId = useAuthStore((state) => state.userId);
  const householdId = useAuthStore((state) => state.householdId);
  const client = useQueryClient();
  const queryKey = useMemo(favoritesKey, [userId, householdId]);
  const query = useQuery({
    queryKey,
    queryFn: recipeFavoritesApi.list,
    enabled: !guest,
    retry: false,
  });
  const mutation = useMutation({
    onMutate: () => ({ isCurrent: capturePrivateSession(), queryKey }),
    mutationFn: async ({ recipeId, isSaved }: { recipeId: string; isSaved: boolean }) => {
      const isCurrent = capturePrivateSession();
      // Read the tombstone revision before an explicit write, including a save after removal.
      const state = await recipeFavoritesApi.state(recipeId);
      if (!isCurrent() || useAuthStore.getState().isGuest)
        throw new ApiError('auth', lSync('Phiên làm việc đã thay đổi.', 'Your session has changed.'));
      return recipeFavoritesApi.set(recipeId, state.revision, isSaved);
    },
    onSettled: (_data, _error, _input, origin) => {
      if (origin?.isCurrent()) return client.invalidateQueries({ queryKey: origin.queryKey });
    },
  });
  const saved = (recipeId: string) =>
    query.data?.entries.some((entry) => entry.recipeId === recipeId) ?? false;
  return {
    query,
    mutation,
    saved,
    guest,
    error:
      mutation.error instanceof ApiError && mutation.error.status === 409
        ? l(
            'Món đã lưu vừa thay đổi ở nơi khác. Danh sách đã được tải lại; hãy chọn lại.',
            'Saved recipes were updated elsewhere. The list has been refreshed; please choose again.',
          )
        : l(
            'Chưa lưu được món. Kiểm tra kết nối và thử lại.',
            'Could not save this recipe. Check your connection and try again.',
          ),
  };
}
