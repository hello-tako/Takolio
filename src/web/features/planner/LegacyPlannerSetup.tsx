import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { mealPlanningApi } from '../../services/meal-planning';
import { plannerCopy, type PlannerLocale } from './copy';
import { buildPlanningIntent, localDate } from './intent';
import type { usePlanner } from './usePlanner';
import { lPlanner, useLocaleText } from '../../i18n/app-i18n';
import { getLoadedLocalePack } from '../../i18n/packs/registry';

export const plannerInputClass =
  'planning-input block w-full min-h-11 mt-1 rounded-xl border border-semantic-border-strong bg-white p-3 text-base sm:text-sm text-semantic-text-primary focus:ring-2 focus:ring-semantic-focus focus:outline-none';

export function LegacyPlannerSetup({
  model,
  locale,
}: {
  model: ReturnType<typeof usePlanner>;
  locale: PlannerLocale;
}) {
  const { locale: appLocale } = useLocaleText();
  const pack = locale === 'vi' ? null : getLoadedLocalePack(appLocale === 'vi' ? 'en' : appLocale);
  const t =
    locale === 'vi'
      ? plannerCopy.vi
      : pack?.planner
        ? ({ ...plannerCopy.en, ...pack.planner } as unknown as typeof plannerCopy.en)
        : plannerCopy.en;
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
    <div className="planning-setup-layout">
      <Card className="planning-setup-form">
        <div className="flex items-center gap-3 mb-5">
          <span className="p-3 rounded-2xl bg-semantic-accent-soft text-semantic-text-primary">
            <CalendarDays />
          </span>
          <h2 className="text-xl font-heading font-bold text-semantic-text-primary">{t.newPlan}</h2>
        </div>
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={!!model.busy} className="space-y-5 disabled:opacity-70">
            <label className="block text-sm font-semibold">
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
            <div className="planning-pair">
              <label className="text-sm font-semibold">
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
              <label className="text-sm font-semibold">
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
              <legend className="text-sm font-semibold mb-2">{t.slots}</legend>
              <div className="planning-meal-choices">
                {(['breakfast', 'lunch', 'dinner'] as const).map((type) => (
                  <label
                    key={type}
                    className={`flex flex-col sm:flex-row items-center gap-2 p-2.5 sm:p-3 rounded-xl border text-sm cursor-pointer ${meals.includes(type) ? 'bg-semantic-accent-soft border-semantic-action-primary text-semantic-text-primary' : 'border-semantic-border'}`}
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
                      className="accent-semantic-action-primary w-4 h-4"
                    />
                    {t[type]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm font-semibold">
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
            <label className="block text-sm font-semibold">
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
          <details className="planning-setup-details">
            <summary>{lPlanner(locale, 'Điều cần biết về kế hoạch', 'About your plan')}</summary>
            <p>{t.future}</p>
            <p>{t.policy}</p>
            <p>{t.timezone}</p>
          </details>
          {invalid && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="planning-error">
              {t.invalidForm}
            </p>
          )}
          <Button type="submit" fullWidth size="lg" isLoading={!!model.busy}>
            {t.generate}
          </Button>
          {model.busy && (
            <p role="status" className="text-sm text-center text-semantic-text-primary">
              {t.generating}
            </p>
          )}
        </form>
      </Card>
      <aside className="planning-setup-context">
        <p className="planning-eyebrow">{lPlanner(locale, 'TUẦN CỦA BẠN', 'YOUR WEEK')}</p>
        <h2>
          {lPlanner(locale, 'Chọn bữa trước. Đi chợ sau.', 'Choose meals first. Shop next.')}
        </h2>
        <p>
          {lPlanner(
            locale,
            'Chế độ hiện tại gợi ý một món chính cho mỗi bữa. Bạn có thể điều chỉnh món trước khi đi chợ.',
            'The current mode suggests one main dish for each meal. Adjust your dishes before shopping.',
          )}
        </p>
        <dl>
          <div>
            <dt>{t.days}</dt>
            <dd>{days}</dd>
          </div>
          <div>
            <dt>{lPlanner(locale, 'Tổng số bữa', 'Total meals')}</dt>
            <dd>{meals.length * days}</dd>
          </div>
          <div>
            <dt>{t.servings}</dt>
            <dd>{servings}</dd>
          </div>
        </dl>
        <p className="planning-context-choice">
          {mode === 'cook_now' ? t.cookNow : t.allowShopping}
        </p>
        <p className="planning-note">{t.planNote}</p>
      </aside>
    </div>
  );
}
