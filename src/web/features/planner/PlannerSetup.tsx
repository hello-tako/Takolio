import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { FamilyPreferenceFields } from '../family/FamilyPreferenceFields';
import { useFamilyPreferences, familyPreferencesKey } from '../family/useFamilyPreferences';
import {
  FamilyPreferencesSchema,
  familyPreferencesApi,
  type FamilyPreferences,
} from '../../services/family-preferences';
import { ApiError } from '../../services/http';
import { plannerCopy, type PlannerLocale } from './copy';
import { buildPlanningIntent, localDate } from './intent';
import type { usePlanner } from './usePlanner';
import { isMealCompositionEnabled } from './composition';
import { LegacyPlannerSetup } from './LegacyPlannerSetup';
export const plannerInputClass =
  'planning-input block w-full min-h-11 mt-1 rounded-xl border border-semantic-border-strong bg-white p-3 text-sm text-semantic-text-primary focus:ring-2 focus:ring-takosan-green focus:outline-none';
export function PlannerSetup(props: {
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
}) {
  return isMealCompositionEnabled() ? (
    <FamilyPlannerSetup {...props} />
  ) : (
    <LegacyPlannerSetup {...props} />
  );
}
function FamilyPlannerSetup({
  model,
  locale,
}: {
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
}) {
  const t = plannerCopy[locale];
  const navigate = useNavigate();
  const client = useQueryClient();
  const preferences = useFamilyPreferences();
  const [draft, setDraft] = useState<FamilyPreferences | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return localDate(date);
  });
  const [days, setDays] = useState(7);
  const [mode, setMode] = useState<'shopping_allowed' | 'cook_now'>('shopping_allowed');
  const [maxTime, setMaxTime] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [profileConflict, setProfileConflict] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (preferences.data && !draft) {
      setDraft(preferences.data.preferences);
      setDraftRevision(preferences.data.revision);
    }
  }, [preferences.data, draft]);
  useEffect(() => {
    if (invalid) errorRef.current?.focus();
  }, [invalid]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !preferences.data || draftRevision === null || profileConflict) return;
    setInvalid(false);
    let intent;
    try {
      FamilyPreferencesSchema.parse(draft);
      intent = buildPlanningIntent({
        startDate,
        days,
        servings: draft.householdSize,
        meals: draft.cookingMealTypes,
        cookingDays: draft.cookingDays,
        preferredTimeMinutes: draft.preferredTimeMinutes,
        mode,
        maxTime,
        offset: -new Date().getTimezoneOffset(),
      });
    } catch {
      setInvalid(true);
      return;
    }
    const result = await model.perform(
      'generate',
      async () => {
        if (JSON.stringify(draft) !== JSON.stringify(preferences.data.preferences)) {
          try {
            const saved = await familyPreferencesApi.save(draftRevision, draft);
            client.setQueryData(familyPreferencesKey(), saved);
            setDraftRevision(saved.revision);
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 409) setProfileConflict(true);
            throw failure;
          }
        }
        return model.generate(intent, model.requestKey(intent));
      },
      (plan) => {
        model.replacePlan(plan);
        model.retireRequestKey(intent);
      },
    );
    if (result) navigate(`/planner/${result.id}`, { replace: true });
  }
  return (
    <div className="planning-setup-layout">
      <Card className="planning-setup-form">
        <div className="family-setup-heading">
          <CalendarDays size={24} aria-hidden="true" />
          <div>
            <h2>{locale === 'vi' ? 'Xếp những bữa nhà mình sẽ nấu' : 'Plan the meals you cook'}</h2>
            <p>
              {locale === 'vi'
                ? 'Takosan gợi ý cả bữa theo thói quen đã chọn.'
                : 'Get a complete meal based on your habits.'}
            </p>
          </div>
        </div>
        {preferences.isPending ? (
          <InlineLoading label="Đang tải thói quen gia đình…" />
        ) : preferences.isError ? (
          <InlineError error={preferences.error} onRetry={() => void preferences.refetch()} />
        ) : (
          draft && (
            <form onSubmit={submit} className="family-settings-form">
              <fieldset disabled={!!model.busy}>
                <div className="family-field-pair">
                  <label>
                    {t.date}
                    <input
                      type="date"
                      required
                      min={localDate()}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </label>
                  <label>
                    {t.days}
                    <input
                      type="number"
                      required
                      min={1}
                      max={14}
                      value={days}
                      onChange={(event) => setDays(Number(event.target.value))}
                    />
                  </label>
                </div>
                <label>
                  {t.servings}
                  <input
                    type="number"
                    required
                    min={1}
                    max={20}
                    value={draft.householdSize}
                    onChange={(event) =>
                      setDraft({ ...draft, householdSize: Number(event.target.value) })
                    }
                  />
                </label>
                <FamilyPreferenceFields value={draft} onChange={setDraft} />
                <details className="family-extra">
                  <summary>Nguyên liệu và giới hạn bắt buộc</summary>
                  <label>
                    {t.mode}
                    <select
                      value={mode}
                      onChange={(event) => setMode(event.target.value as typeof mode)}
                    >
                      <option value="shopping_allowed">{t.allowShopping}</option>
                      <option value="cook_now">{t.cookNow}</option>
                    </select>
                  </label>
                  <label>
                    Giới hạn thời gian bắt buộc (không cần nhập nếu linh hoạt)
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={maxTime}
                      onChange={(event) => setMaxTime(event.target.value)}
                    />
                  </label>
                  <Link className="planning-text-link" to="/me/preferences">
                    Kiểm tra hạn chế thực phẩm của gia đình
                  </Link>
                  <p>
                    Thời gian mong muốn giúp chọn món. Giới hạn bắt buộc loại bữa không có đủ dữ
                    liệu hoặc cần lâu hơn.
                  </p>
                </details>
              </fieldset>
              {invalid && (
                <p ref={errorRef} tabIndex={-1} role="alert" className="planning-error">
                  Chọn ít nhất một bữa và một ngày tự nấu trong khoảng kế hoạch; kiểm tra số người
                  và thời gian.
                </p>
              )}
              {profileConflict && (
                <div className="planning-error">
                  <p role="alert">
                    Thói quen đã đổi ở thiết bị khác. Tải bản mới và kiểm tra trước khi tạo thực
                    đơn.
                  </p>
                  <button
                    type="button"
                    className="planning-text-link"
                    onClick={async () => {
                      const result = await preferences.refetch();
                      if (result.data) {
                        setDraft(result.data.preferences);
                        setDraftRevision(result.data.revision);
                        setProfileConflict(false);
                      }
                    }}
                  >
                    Tải thói quen mới nhất
                  </button>
                </div>
              )}
              <Button type="submit" fullWidth isLoading={!!model.busy} disabled={profileConflict}>
                {t.generate}
              </Button>
              {model.busy && <p role="status">{t.generating}</p>}
              <p className="planning-note">
                Thói quen được lưu cho lần sau. Tạo thực đơn chưa trừ thực phẩm khỏi tủ.
              </p>
            </form>
          )
        )}
      </Card>
      <aside className="planning-setup-context">
        <p className="planning-eyebrow">BỮA NHÀ, THEO NHỊP NHÀ MÌNH</p>
        <h2>Đủ món trước. Đi chợ vừa đủ.</h2>
        <p>
          Bữa cơm gia đình có món chính, rau hoặc món phụ, canh và cơm. Bữa sáng và một món trọn bữa
          có cách xếp riêng.
        </p>
        <p>Khẩu vị vùng là ưu tiên mềm. Đổi vị quốc tế chỉ xuất hiện trong mức bạn chọn.</p>
        <p className="planning-note">
          Đủ nhóm món không đồng nghĩa đã xác minh dinh dưỡng hoặc an toàn dị ứng. Takosan sẽ báo
          phần còn thiếu dữ liệu.
        </p>
      </aside>
    </div>
  );
}
