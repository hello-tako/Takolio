import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LegacyPlanningSettingsPage } from './LegacyPlanningSettingsPage';
import { isMealCompositionEnabled } from '../../features/planner/composition';
import { AccountPage } from '../../components/common/AccountPage';
import { Button } from '../../components/common/Button';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { FamilyPreferenceFields } from '../../features/family/FamilyPreferenceFields';
import {
  familyPreferencesKey,
  useFamilyPreferences,
} from '../../features/family/useFamilyPreferences';
import { familyPreferencesApi, type FamilyPreferences } from '../../services/family-preferences';
import { ApiError } from '../../services/http';
import { capturePrivateSession, isOfflineGuestSession } from '../../lib/private-session';
import { useLocaleText } from '../../i18n/app-i18n';

export function PlanningSettingsPage() {
  return isMealCompositionEnabled() ? (
    <FamilyPlanningSettingsPage />
  ) : (
    <LegacyPlanningSettingsPage />
  );
}
function FamilyPlanningSettingsPage() {
  const { l } = useLocaleText();
  const query = useFamilyPreferences();
  const client = useQueryClient();
  const guest = isOfflineGuestSession();
  const [draft, setDraft] = useState<FamilyPreferences | null>(null);
  const [saved, setSaved] = useState(false);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  useEffect(() => {
    if (query.data && !draft) {
      setDraft(query.data.preferences);
      setDraftRevision(query.data.revision);
    }
  }, [query.data, draft]);
  const save = useMutation({
    onMutate: () => ({ isCurrent: capturePrivateSession(), key: familyPreferencesKey() }),
    mutationFn: () => familyPreferencesApi.save(draftRevision!, draft!),
    onSuccess: (result, _input, origin) => {
      if (!origin.isCurrent()) return;
      client.setQueryData(origin.key, result);
      setSaved(true);
      setDraftRevision(result.revision);
    },
  });
  return (
    <AccountPage
      title={l('Thói quen bữa nhà', 'Household meal habits')}
      description={l(
        'Lưu để thực đơn tới hợp khẩu vị và nhịp sinh hoạt của gia đình.',
        'Save your defaults so future meal plans match your family’s tastes and routine.',
      )}
    >
      {guest ? (
        <p>
          {l('Đăng nhập để lưu thói quen cho gia đình.', 'Sign in to save habits for your household.')}{' '}
          <Link
            to="/auth?mode=login&returnTo=%2Fsettings%2Fplanning"
            className="planning-text-link"
          >
            {l('Đăng nhập', 'Sign in')}
          </Link>
        </p>
      ) : query.isPending ? (
        <InlineLoading label={l('Đang tải thói quen gia đình…', 'Loading household habits…')} />
      ) : query.isError ? (
        <InlineError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        draft && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSaved(false);
              save.mutate();
            }}
          >
            <fieldset disabled={save.isPending} className="family-settings-form">
              <label>
                {l('Số người thường ăn', 'Household size')}
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={draft.householdSize}
                  onChange={(event) => {
                    setSaved(false);
                    setDraft({ ...draft, householdSize: Number(event.target.value) });
                  }}
                />
              </label>
              <FamilyPreferenceFields
                value={draft}
                onChange={(next) => {
                  setSaved(false);
                  setDraft(next);
                }}
              />
              <p className="planning-note">
                {l(
                  'Chỉnh dị ứng và nguyên liệu bắt buộc tránh ở mục phía trên. Sở thích trong hồ sơ không thay thế các ràng buộc này.',
                  'Edit allergies and strictly excluded ingredients above. Profile preferences do not override these safety constraints.',
                )}
              </p>
              <Link className="planning-text-link" to="/me/preferences">
                {l('Gu món & độ cay trong hồ sơ', 'Cuisine tastes & spice level in profile')}
              </Link>
              {save.isError && (
                <p role="alert" className="planning-error">
                  {l(
                    'Chưa lưu được thói quen. Nếu một thiết bị khác vừa đổi, tải lại và kiểm tra trước khi lưu.',
                    'Could not save habits. If another device made changes, reload and review before saving.',
                  )}
                </p>
              )}
              {save.isError && (
                <button
                  type="button"
                  className="planning-text-link"
                  onClick={async () => {
                    const result = await query.refetch();
                    if (result.data) {
                      setDraft(result.data.preferences);
                      setDraftRevision(result.data.revision);
                      save.reset();
                    }
                  }}
                >
                  {l('Tải lại thói quen mới nhất', 'Reload latest habits')}
                </button>
              )}
              {saved && (
                <p role="status" className="planning-notice">
                  {l('Đã lưu thói quen cho các thực đơn tới.', 'Habits saved for future meal plans.')}
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                isLoading={save.isPending}
                disabled={save.error instanceof ApiError && save.error.status === 409}
              >
                {l('Lưu thói quen', 'Save habits')}
              </Button>
            </fieldset>
            <p className="planning-note mt-3">
              {l(
                'Thay đổi này không sửa các bữa đã xếp. Tạo tuần mới hoặc xem gợi ý lại để áp dụng.',
                'These changes do not edit already scheduled meals. Create a new week or refresh suggestions to apply them.',
              )}
            </p>
          </form>
        )
      )}
    </AccountPage>
  );
}
