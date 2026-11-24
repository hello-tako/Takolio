import type { ComponentAssessment } from '../../../../packages/domain/src/meal-composition-api';
import type { PlannerLocale } from './copy';
import { reasonLabel } from './presentation';
import { getActiveAppLocale } from '../../i18n/LocaleContext';
import {
  getActiveBcp47,
  lPlanner,
  localizeIngredientName,
  localizeUnit,
} from '../../i18n/app-i18n';

export function coverageStatus(assessment: ComponentAssessment, locale: PlannerLocale) {
  const labels: Record<ComponentAssessment['status'], string> = {
    covered: lPlanner(locale, 'Đủ lượng từ tủ lạnh', 'Covered by your fridge'),
    needs_shopping:
      assessment.missingCount > 0
        ? lPlanner(
            locale,
            `Cần mua thêm ${assessment.missingCount} nguyên liệu`,
            `Needs ${assessment.missingCount} ingredients`,
          )
        : lPlanner(locale, 'Cần mua thêm nguyên liệu', 'Needs additional shopping'),
    unresolved: lPlanner(locale, 'Cần kiểm tra lượng', 'Quantity needs review'),
    not_tracked: lPlanner(
      locale,
      'Chưa tính được lượng cho món này',
      'Quantities are not tracked for this dish',
    ),
    unavailable: lPlanner(
      locale,
      'Chưa kiểm tra được nguyên liệu',
      'Ingredients could not be checked',
    ),
  };
  return labels[assessment.status];
}

export function ingredientAmount(quantity: number | null, unit: string, locale: PlannerLocale) {
  if (quantity === null) return lPlanner(locale, 'Chưa rõ', 'Unknown');
  const active = getActiveAppLocale();
  const effectiveLocale = locale === 'vi' ? 'vi' : active === 'vi' ? 'en' : active;
  const unitLabels: Record<string, string> =
    locale === 'vi'
      ? { piece: 'cái / quả / bìa', bunch: 'bó', pack: 'gói', slice: 'lát' }
      : effectiveLocale === 'en'
        ? { piece: 'pieces', bunch: 'bunches', pack: 'packs', slice: 'slices' }
        : {
            piece: localizeUnit('piece', effectiveLocale),
            bunch: localizeUnit('bunch', effectiveLocale),
            pack: localizeUnit('pack', effectiveLocale),
            slice: localizeUnit('slice', effectiveLocale),
          };
  const options: Intl.NumberFormatOptions = { maximumSignificantDigits: 12, useGrouping: false };
  const bcp47 = locale === 'vi' ? 'vi-VN' : getActiveBcp47(effectiveLocale);
  const displayed = new Intl.NumberFormat(bcp47, options).format(quantity);
  const rounded = Number(new Intl.NumberFormat('en-US', options).format(quantity));
  const unitText = unitLabels[unit] ?? (locale === 'vi' ? unit : localizeUnit(unit, effectiveLocale));
  const approxPrefix = rounded === quantity ? '' : `${lPlanner(locale, 'Khoảng', 'About')} `;
  return `${approxPrefix}${displayed} ${unitText}`;
}

export function IngredientCoverage({
  assessment,
  locale,
  servings,
  title,
}: {
  assessment: ComponentAssessment;
  locale: PlannerLocale;
  servings?: number;
  title?: string;
}) {
  const active = getActiveAppLocale();
  const dataLocale = locale === 'vi' ? 'vi' : active === 'vi' ? 'en' : active;
  return (
    <div className="planning-ingredient-coverage">
      <p className="planning-coverage-status" data-status={assessment.status}>
        {coverageStatus(assessment, locale)}
      </p>
      {!assessment.selectable && assessment.blockingReasons.length > 0 && (
        <p className="text-xs text-semantic-warning-strong">
          {assessment.blockingReasons.map((code) => reasonLabel(code, locale)).join(' · ')}
        </p>
      )}
      {assessment.requirements.length > 0 && (
        <details>
          <summary>
            {title ?? lPlanner(locale, 'Xem lượng nguyên liệu', 'Review ingredient quantities')}
            {servings ? ` · ${servings} ${lPlanner(locale, 'người', 'servings')}` : ''}
          </summary>
          <p className="planning-coverage-note">
            {lPlanner(
              locale,
              'Lượng từ tủ dự kiến sau các món và bữa trước trong thực đơn. Chưa trừ thực phẩm thật.',
              'Fridge coverage is projected after earlier dishes and meals. Real stock is unchanged.',
            )}
          </p>
          <ul>
            {assessment.requirements.map((line, index) => (
              <li key={`${line.ingredientId}:${line.unit}:${index}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <strong>{localizeIngredientName(line.ingredientId, line.name, dataLocale)}</strong>
                  {line.isOptional && (
                    <span className="text-xs text-semantic-text-muted">
                      {lPlanner(locale, 'Không bắt buộc', 'Optional')}
                    </span>
                  )}
                </div>
                <dl>
                  <div>
                    <dt>{lPlanner(locale, 'Cần', 'Needed')}</dt>
                    <dd>{ingredientAmount(line.requiredQuantity, line.unit, locale)}</dd>
                  </div>
                  <div>
                    <dt>{lPlanner(locale, 'Từ tủ', 'From fridge')}</dt>
                    <dd>{ingredientAmount(line.coveredQuantity, line.unit, locale)}</dd>
                  </div>
                  <div data-missing={line.missingQuantity === null || line.missingQuantity > 0}>
                    <dt>{lPlanner(locale, 'Cần mua', 'Still needed')}</dt>
                    <dd>{ingredientAmount(line.missingQuantity, line.unit, locale)}</dd>
                  </div>
                </dl>
                {line.status === 'unresolved' && (
                  <p className="text-xs text-semantic-warning-strong">
                    {lPlanner(
                      locale,
                      'Kiểm tra đơn vị hoặc lượng thực tế trong gói.',
                      'Check the unit or actual package contents.',
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
