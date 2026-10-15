import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CatalogIdSchema } from '../../../../packages/domain/src/foundation';
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
import { ingredientLabel } from './presentation';
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
  const [params] = useSearchParams();
  const recipe = CatalogIdSchema.safeParse(params.get('recipe'));
  const recipeId = recipe.success ? recipe.data : null;
  const requestedServings = params.get('servings') ?? '';
  const handoffServings =
    recipeId && /^[1-9][0-9]?$/.test(requestedServings) && Number(requestedServings) <= 20
      ? Number(requestedServings)
      : undefined;
  const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>(
    recipeId ? 'manual' : 'auto',
  );
  const client = useQueryClient();
  const preferences = useFamilyPreferences();
  const [draft, setDraft] = useState<FamilyPreferences | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [habitsOpen, setHabitsOpen] = useState(false);
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
  const [uncertainProfileRevision, setUncertainProfileRevision] = useState<number | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const timedOut = model.error instanceof ApiError && model.error.code === 'PLAN_REQUEST_TIMEOUT';
  useEffect(() => {
    if (preferences.data && !draft) {
      setDraft({
        ...preferences.data.preferences,
        householdSize: handoffServings ?? preferences.data.preferences.householdSize,
      });
      setDraftRevision(preferences.data.revision);
      setHabitsOpen(preferences.data.revision === 0);
    }
  }, [preferences.data, draft, handoffServings]);
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
      setHabitsOpen(true);
      setInvalid(true);
      return;
    }
    // Include family choices in the retry fingerprint. The server body remains the validated intent,
    // while a changed preference set must never replay a timed-out plan from the old profile.
    const requestIntent = { selectionMode, intent, familyPreferences: draft };
    const result = await model.perform(
      selectionMode === 'manual' ? 'manual-draft' : 'generate',
      async () => {
        let acceptedProfile = preferences.data;
        let expectedRevision = draftRevision;
        if (uncertainProfileRevision !== null) {
          // An explicit retry reads the uncertain save before issuing another write.
          const latest = await familyPreferencesApi.get();
          if (
            latest.revision <= uncertainProfileRevision ||
            JSON.stringify(latest.preferences) !== JSON.stringify(draft)
          ) {
            setProfileConflict(true);
            throw new ApiError('http', 'HTTP 409: {"code":"FAMILY_PREFERENCES_CHANGED"}', 409);
          }
          acceptedProfile = latest;
          expectedRevision = latest.revision;
          client.setQueryData(familyPreferencesKey(), latest);
          setDraftRevision(latest.revision);
          setUncertainProfileRevision(null);
        }
        if (JSON.stringify(draft) !== JSON.stringify(acceptedProfile.preferences)) {
          try {
            const saved = await familyPreferencesApi.save(expectedRevision, draft);
            client.setQueryData(familyPreferencesKey(), saved);
            setDraftRevision(saved.revision);
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 409) setProfileConflict(true);
            if (failure instanceof ApiError && failure.code === 'PLAN_REQUEST_TIMEOUT') {
              setUncertainProfileRevision(expectedRevision);
            }
            throw failure;
          }
        }
        return selectionMode === 'manual'
          ? model.createManual(intent, model.requestKey(requestIntent))
          : model.generate(intent, model.requestKey(requestIntent));
      },
      (plan) => {
        model.replacePlan(plan);
        model.retireRequestKey(requestIntent);
      },
    );
    if (result) {
      const first = result.intent.slots[0];
      const destination =
        recipeId && first
          ? `/planner/${result.id}/meal/${encodeURIComponent(`${first.date}:${first.mealType}:${first.sequence ?? 0}`)}?recipe=${encodeURIComponent(recipeId)}`
          : `/planner/${result.id}`;
      navigate(destination, { replace: true });
    }
  }
  const regionLabels =
    locale === 'vi'
      ? { bac: 'Miền Bắc', trung: 'Miền Trung', nam: 'Miền Nam' }
      : { bac: 'North', trung: 'Central', nam: 'South' };
  const allergenLabels: Record<string, string> =
    locale === 'vi'
      ? {
          peanut: 'đậu phộng',
          milk: 'sữa',
          egg: 'trứng',
          soy: 'đậu nành',
          wheat: 'lúa mì',
          shellfish: 'giáp xác / nhuyễn thể',
          fish: 'cá',
        }
      : {
          peanut: 'peanuts',
          milk: 'milk',
          egg: 'eggs',
          soy: 'soy',
          wheat: 'wheat',
          shellfish: 'shellfish',
          fish: 'fish',
        };
  const appliedAllergens = (draft?.allergens ?? []).map((id) => allergenLabels[id] ?? id);
  const appliedAvoid = (draft?.forbiddenIngredientIds ?? []).map((id) =>
    ingredientLabel(id, locale),
  );
  return (
    <div className="planning-setup-layout">
      <Card className="planning-setup-form">
        <div className="family-setup-heading">
          <CalendarDays size={24} aria-hidden="true" />
          <div>
            <h2>{locale === 'vi' ? 'Lên thực đơn cho nhà mình' : 'Plan the meals you cook'}</h2>
            <p>
              {locale === 'vi'
                ? selectionMode === 'manual'
                  ? 'Tạo lịch trống, rồi chọn món cho từng bữa.'
                  : 'Takosan gợi ý cả bữa theo thói quen đã chọn.'
                : selectionMode === 'manual'
                  ? 'Choose your cooking calendar, then fill each meal with your own dishes.'
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
                <legend>{locale === 'vi' ? 'Cách lên thực đơn' : 'How to plan'}</legend>
                <div className="family-plan-mode">
                  <label data-selected={selectionMode === 'auto'}>
                    <input
                      type="radio"
                      name="plan-selection-mode"
                      value="auto"
                      checked={selectionMode === 'auto'}
                      onChange={() => setSelectionMode('auto')}
                    />
                    <span>
                      <strong>
                        {locale === 'vi' ? 'Takosan gợi ý cả bữa' : 'Let Takosan suggest meals'}
                      </strong>
                      <small>
                        {locale === 'vi'
                          ? 'Xếp món chính, rau/phụ, canh và cơm theo kiểu bữa đã chọn.'
                          : 'Get complete dish groups based on your household habits.'}
                      </small>
                    </span>
                  </label>
                  <label data-selected={selectionMode === 'manual'}>
                    <input
                      type="radio"
                      name="plan-selection-mode"
                      value="manual"
                      checked={selectionMode === 'manual'}
                      onChange={() => setSelectionMode('manual')}
                    />
                    <span>
                      <strong>
                        {locale === 'vi' ? 'Tự chọn món cho từng bữa' : 'Choose each dish yourself'}
                      </strong>
                      <small>
                        {locale === 'vi'
                          ? 'Chọn món từ tủ lạnh, tìm kiếm hoặc món đã lưu.'
                          : 'Start with an empty calendar and use your fridge or saved dishes.'}
                      </small>
                    </span>
                  </label>
                </div>
                {recipeId && (
                  <p className="planning-note">
                    {locale === 'vi'
                      ? 'Món bạn vừa chọn sẽ được mở để xem lượng và đặt vào bữa sau khi tạo lịch.'
                      : 'Your selected dish will open for quantity review after creating the calendar.'}
                  </p>
                )}
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
                <details
                  className="family-extra family-plan-habits"
                  open={habitsOpen}
                  onToggle={(event) => setHabitsOpen(event.currentTarget.open)}
                >
                  <summary>
                    <span>
                      {locale === 'vi'
                        ? 'Thói quen bữa nhà · Chỉnh lại'
                        : 'Household habits · Edit'}
                    </span>
                    <span className="family-plan-habit-summary">
                      {draft.cookingMealTypes.map((meal) => t[meal]).join(', ')}
                      {' · '}
                      {draft.cookingDays.length} {locale === 'vi' ? 'ngày/tuần' : 'days/week'}
                      {' · '}
                      {draft.preferredRegions.map((region) => regionLabels[region]).join(', ') ||
                        (locale === 'vi' ? 'Món Việt mọi vùng' : 'All Vietnamese regions')}
                      {' · '}
                      {draft.mealStyle === 'family'
                        ? locale === 'vi'
                          ? 'bữa cơm gia đình'
                          : 'family meals'
                        : draft.mealStyle === 'quick'
                          ? locale === 'vi'
                            ? 'nhanh gọn'
                            : 'quick meals'
                          : locale === 'vi'
                            ? 'một món trọn bữa'
                            : 'one-dish meals'}
                      {' · '}
                      {mode === 'shopping_allowed' ? t.allowShopping : t.cookNow}
                    </span>
                  </summary>
                  <FamilyPreferenceFields value={draft} onChange={setDraft} />
                </details>
                <p className="planning-note">
                  {locale === 'vi'
                    ? `Dị ứng đã chọn (${appliedAllergens.length}): ${appliedAllergens.join(', ') || 'chưa chọn'}. Nguyên liệu bắt buộc tránh (${appliedAvoid.length}): ${appliedAvoid.join(', ') || 'chưa chọn'}.`
                    : `Selected allergies (${appliedAllergens.length}): ${appliedAllergens.join(', ') || 'none selected'}. Forbidden ingredients (${appliedAvoid.length}): ${appliedAvoid.join(', ') || 'none selected'}.`}
                </p>
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
                        setUncertainProfileRevision(null);
                      }
                    }}
                  >
                    Tải thói quen mới nhất
                  </button>
                </div>
              )}
              <Button type="submit" fullWidth isLoading={!!model.busy} disabled={profileConflict}>
                {timedOut
                  ? t.retry
                  : selectionMode === 'manual'
                    ? locale === 'vi'
                      ? 'Tạo lịch trống để tự chọn món'
                      : 'Create an empty meal calendar'
                    : t.generate}
              </Button>
              {timedOut && (
                <Link className="planning-text-link" to="/planner">
                  {locale === 'vi' ? 'Kiểm tra thực đơn hiện tại' : 'Check your current plan'}
                </Link>
              )}
              {model.busy && (
                <p role="status">
                  {selectionMode === 'manual'
                    ? locale === 'vi'
                      ? 'Đang tạo lịch nấu…'
                      : 'Creating your meal calendar…'
                    : t.generating}
                </p>
              )}
              <p className="planning-note">Thói quen được lưu cho lần tạo thực đơn tiếp theo.</p>
            </form>
          )
        )}
      </Card>
      <aside className="planning-setup-context">
        <p className="planning-eyebrow">BỮA NHÀ, THEO NHỊP NHÀ MÌNH</p>
        <h2>Một lần xếp. Nhẹ cả tuần.</h2>
        <p>
          Chọn lịch nấu và số người ăn. Takosan xếp theo kiểu bữa nhà mình, rồi gom phần nguyên liệu
          còn thiếu vào danh sách đi chợ.
        </p>
        <p>Ưu tiên món Việt và khẩu vị vùng đã chọn. Bạn tự quyết định số bữa đổi vị quốc tế.</p>
        <p className="planning-note">
          Đủ nhóm món không đồng nghĩa đã xác minh dinh dưỡng hoặc an toàn dị ứng. Takosan sẽ báo
          phần còn thiếu dữ liệu.
        </p>
      </aside>
    </div>
  );
}
