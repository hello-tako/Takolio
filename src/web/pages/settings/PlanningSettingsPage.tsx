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

export function PlanningSettingsPage() {
  return isMealCompositionEnabled() ? (
    <FamilyPlanningSettingsPage />
  ) : (
    <LegacyPlanningSettingsPage />
  );
}
function FamilyPlanningSettingsPage() {
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
      title="Thói quen bữa nhà"
      description="Lưu để thực đơn tới hợp khẩu vị và nhịp sinh hoạt của gia đình."
    >
      {guest ? (
        <p>
          Đăng nhập để lưu thói quen cho gia đình.{' '}
          <Link
            to="/auth?mode=login&returnTo=%2Fsettings%2Fplanning"
            className="planning-text-link"
          >
            Đăng nhập
          </Link>
        </p>
      ) : query.isPending ? (
        <InlineLoading label="Đang tải thói quen gia đình…" />
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
                Số người thường ăn
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
              <Link className="planning-text-link" to="/me/preferences">
                Dị ứng & hạn chế thực phẩm trong hồ sơ
              </Link>
              {save.isError && (
                <p role="alert" className="planning-error">
                  Chưa lưu được thói quen. Nếu một thiết bị khác vừa đổi, tải lại và kiểm tra trước
                  khi lưu.
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
                  Tải lại thói quen mới nhất
                </button>
              )}
              {saved && (
                <p role="status" className="planning-notice">
                  Đã lưu thói quen cho các thực đơn tới.
                </p>
              )}
              <Button
                type="submit"
                fullWidth
                isLoading={save.isPending}
                disabled={save.error instanceof ApiError && save.error.status === 409}
              >
                Lưu thói quen
              </Button>
            </fieldset>
            <p className="planning-note">
              Thay đổi này không sửa các bữa đã xếp. Tạo tuần mới hoặc xem gợi ý lại để áp dụng.
            </p>
          </form>
        )
      )}
    </AccountPage>
  );
}
