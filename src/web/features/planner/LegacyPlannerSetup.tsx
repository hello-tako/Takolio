import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { OnboardingMamCom3D } from '../../components/3d/OnboardingMamCom3D';
import { AtelierBadge, BentoCard } from '../../design-system/v4/AtelierPrimitives';
import { CalendarMealCheckIcon, HouseholdTrayIcon } from '../../design-system/icons';
import { mealPlanningApi } from '../../services/meal-planning';
import { plannerCopy, type PlannerLocale } from './copy';
import { buildPlanningIntent, localDate } from './intent';
import type { usePlanner } from './usePlanner';

export const plannerInputClass =
  'planning-input block w-full min-h-11 mt-1 rounded-xl border border-tk-stone bg-white p-3 text-sm text-tk-ink focus:ring-2 focus:ring-tk-jade focus:outline-none';

export function LegacyPlannerSetup({
  model,
  locale,
}: {
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
}) {
  const t = plannerCopy[locale];
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    return localDate(next);
  });
  const [days, setDays] = useState(7);
  const [servings, setServings] = useState(2);
  const [meals, setMeals] = useState<Array<'breakfast' | 'lunch' | 'dinner'>>(['dinner']);
  const [mode, setMode] = useState<'shopping_allowed' | 'cook_now'>('shopping_allowed');
  const [maxTime, setMaxTime] = useState('');
  const [invalid, setInvalid] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (invalid) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [invalid]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setInvalid(false);
    let intent;
    try {
      intent = buildPlanningIntent({
        startDate,
        days,
        servings,
        meals,
        mode,
        maxTime,
        offset: -new Date().getTimezoneOffset(),
      });
    } catch {
      setInvalid(true);
      return;
    }
    const plan = await model.perform(
      'generate',
      () => mealPlanningApi.generate(intent, model.requestKey(intent)),
      (result) => {
        model.replacePlan(result);
        model.retireRequestKey(intent);
      },
    );
    if (plan) navigate(`/planner/${plan.id}`, { replace: true });
  }

  return (
    <div className="planning-setup-layout grid gap-6 lg:grid-cols-12 lg:items-start">
      <BentoCard tone="ceramic" padding="lg" className="planning-setup-form lg:col-span-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-tk-jade-soft text-tk-jade-deep">
            <CalendarMealCheckIcon size={24} tone="jade" active />
          </span>
          <h2 className="font-heading text-xl font-extrabold text-tk-ink">{t.newPlan}</h2>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={!!model.busy} className="space-y-5 disabled:opacity-70">
            <label className="block text-sm font-bold text-tk-ink">
              {t.date}
              <input
                type="date"
                name="start-date"
                required
                min={localDate()}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={plannerInputClass}
              />
            </label>
            <div className="planning-pair grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-bold text-tk-ink">
                {t.days}
                <input
                  type="number"
                  min={1}
                  max={14}
                  required
                  name="days"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className={plannerInputClass}
                />
              </label>
              <label className="text-sm font-bold text-tk-ink">
                {t.servings}
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  name="servings"
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className={plannerInputClass}
                />
              </label>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-bold text-tk-ink">{t.slots}</legend>
              <div className="planning-meal-choices grid grid-cols-3 gap-2.5">
                {(['breakfast', 'lunch', 'dinner'] as const).map((type) => (
                  <label
                    key={type}
                    className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 text-sm font-semibold transition-colors sm:flex-row ${
                      meals.includes(type)
                        ? 'border-tk-jade bg-tk-jade-soft text-tk-jade-deep'
                        : 'border-tk-stone bg-white text-tk-secondary hover:bg-tk-sunken'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={meals.includes(type)}
                      onChange={(e) =>
                        setMeals(
                          e.target.checked
                            ? [...meals, type]
                            : meals.filter((item) => item !== type),
                        )
                      }
                      className="h-4 w-4 accent-tk-jade"
                    />
                    {t[type]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-bold text-tk-ink">
              {t.mode}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
                className={plannerInputClass}
              >
                <option value="shopping_allowed">{t.allowShopping}</option>
                <option value="cook_now">{t.cookNow}</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-tk-ink">
              {t.maxTime}
              <input
                type="number"
                min={1}
                max={1440}
                name="max-time"
                value={maxTime}
                onChange={(e) => setMaxTime(e.target.value)}
                className={plannerInputClass}
              />
            </label>
          </fieldset>

          <details className="planning-setup-details rounded-2xl border border-tk-stone bg-tk-sunken/70 p-4 text-xs leading-relaxed text-tk-secondary space-y-2">
            <summary className="cursor-pointer text-sm font-bold text-tk-ink">
              {locale === 'vi' ? 'Điều cần biết về kế hoạch' : 'About your plan'}
            </summary>
            <p className="mt-2">{t.future}</p>
            <p>{t.policy}</p>
            <p>{t.timezone}</p>
          </details>

          {invalid && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="planning-error rounded-2xl border border-tk-berry/30 bg-tk-berry-soft p-3.5 text-sm font-semibold text-tk-berry-deep"
            >
              {t.invalidForm}
            </p>
          )}

          <Button type="submit" fullWidth size="lg" isLoading={!!model.busy}>
            {t.generate}
          </Button>
          {model.busy && (
            <p role="status" className="text-center text-sm font-bold text-tk-jade-deep">
              {t.generating}
            </p>
          )}
        </form>
      </BentoCard>

      <aside className="planning-setup-context space-y-4 lg:col-span-5">
        <OnboardingMamCom3D householdSize={servings} step={1} />
        <BentoCard tone="sunken" padding="md" className="space-y-3">
          <AtelierBadge tone="jade" icon={<HouseholdTrayIcon size={14} tone="jade" active />}>
            <span className="planning-eyebrow">{locale === 'vi' ? 'TUẦN CỦA BẠN' : 'YOUR WEEK'}</span>
          </AtelierBadge>
          <h2 className="font-heading text-xl font-extrabold text-tk-ink">
            {locale === 'vi' ? 'Chọn bữa trước. Đi chợ sau.' : 'Choose meals first. Shop next.'}
          </h2>
          <p className="text-sm leading-relaxed text-tk-secondary">
            {locale === 'vi'
              ? 'Chế độ hiện tại gợi ý một món chính cho mỗi bữa. Bạn có thể điều chỉnh món trước khi đi chợ.'
              : 'The current mode suggests one main dish for each meal. Adjust your dishes before shopping.'}
          </p>
          <dl className="grid grid-cols-3 gap-2 rounded-2xl border border-tk-stone bg-white p-3 text-center">
            <div>
              <dt className="text-[11px] font-bold text-tk-muted">{t.days}</dt>
              <dd className="mt-0.5 text-base font-extrabold text-tk-ink tk-tabular">{days}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold text-tk-muted">
                {locale === 'vi' ? 'Tổng số bữa' : 'Total meals'}
              </dt>
              <dd className="mt-0.5 text-base font-extrabold text-tk-ink tk-tabular">
                {meals.length * days}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold text-tk-muted">{t.servings}</dt>
              <dd className="mt-0.5 text-base font-extrabold text-tk-ink tk-tabular">{servings}</dd>
            </div>
          </dl>
          <p className="planning-context-choice text-xs font-extrabold text-tk-jade-deep">
            {mode === 'cook_now' ? t.cookNow : t.allowShopping}
          </p>
          <p className="planning-note text-xs leading-relaxed text-tk-muted">{t.planNote}</p>
        </BentoCard>
      </aside>
    </div>
  );
}
