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
import { BentoCard } from '../../design-system/v4/AtelierPrimitives';
import { AllergenShieldIcon, HouseholdTrayIcon } from '../../design-system/icons';

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
      description="Lưu kiểu Mâm Cơm, vùng miền và nhịp nấu để các thực đơn 7 ngày luôn sát nếp nhà."
    >
      <BentoCard tone="jade" padding="sm" className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AllergenShieldIcon size={20} tone="jade" active className="mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-tk-jade-deep">
              Đồng bộ Ràng buộc An toàn &amp; Khẩu vị
            </p>
            <p className="text-xs text-tk-secondary leading-relaxed mt-0.5">
              Dị ứng và nguyên liệu bắt buộc tránh tại đây luôn được áp dụng nghiêm ngặt cho cả bộ
              lập Thực đơn Mâm Cơm và Khám phá Công thức.
            </p>
          </div>
        </div>
        <Link
          to="/me/preferences"
          className="shrink-0 text-xs font-extrabold text-tk-jade-deep hover:underline self-center"
        >
          Gu món &amp; độ cay
        </Link>
      </BentoCard>

      {guest ? (
        <BentoCard tone="ceramic" padding="md">
          <p className="text-sm text-tk-secondary">
            Đăng nhập để lưu thói quen cho gia đình.{' '}
            <Link
              to="/auth?mode=login&returnTo=%2Fsettings%2Fplanning"
              className="planning-text-link font-bold text-tk-flame"
            >
              Đăng nhập
            </Link>
          </p>
        </BentoCard>
      ) : query.isPending ? (
        <InlineLoading label="Đang tải thói quen gia đình…" />
      ) : query.isError ? (
        <InlineError error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        draft && (
          <BentoCard tone="ceramic" padding="md">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSaved(false);
                save.mutate();
              }}
            >
              <fieldset disabled={save.isPending} className="family-settings-form space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-tk-stone/70">
                  <HouseholdTrayIcon size={20} tone="jade" active />
                  <h2 className="font-heading font-extrabold text-base text-tk-ink">
                    Cấu hình Mâm Cơm Gia Đình
                  </h2>
                </div>
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
                <p className="planning-note">
                  Chỉnh dị ứng và nguyên liệu bắt buộc tránh ở mục phía trên. Sở thích trong hồ sơ
                  được đồng bộ cùng các ràng buộc này.
                </p>
                <Link className="planning-text-link" to="/me/preferences">
                  Gu món &amp; độ cay trong hồ sơ
                </Link>
                {save.isError && (
                  <p role="alert" className="planning-error">
                    Chưa lưu được thói quen. Nếu một thiết bị khác vừa đổi, tải lại và kiểm tra
                    trước khi lưu.
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
              <p className="planning-note mt-3">
                Thay đổi này không sửa các bữa đã xếp. Tạo tuần mới hoặc xem gợi ý lại để áp dụng.
              </p>
            </form>
          </BentoCard>
        )
      )}
    </AccountPage>
  );
}
