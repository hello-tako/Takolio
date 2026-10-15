import type { ComponentAssessment } from '../../../../packages/domain/src/meal-composition-api';
import type { PlannerLocale } from './copy';
import { reasonLabel } from './presentation';

export function coverageStatus(assessment: ComponentAssessment, locale: PlannerLocale) {
  const labels =
    locale === 'vi'
      ? {
          covered: 'Đủ lượng từ tủ lạnh',
          needs_shopping:
            assessment.missingCount > 0
              ? `Cần mua thêm ${assessment.missingCount} nguyên liệu`
              : 'Cần mua thêm nguyên liệu',
          unresolved: 'Cần kiểm tra lượng',
          not_tracked: 'Chưa tính được lượng cho món này',
          unavailable: 'Chưa kiểm tra được nguyên liệu',
        }
      : {
          covered: 'Covered by your fridge',
          needs_shopping:
            assessment.missingCount > 0
              ? `Needs ${assessment.missingCount} ingredients`
              : 'Needs additional shopping',
          unresolved: 'Quantity needs review',
          not_tracked: 'Quantities are not tracked for this dish',
          unavailable: 'Ingredients could not be checked',
        };
  return labels[assessment.status];
}

export function ingredientAmount(quantity: number | null, unit: string, locale: PlannerLocale) {
  if (quantity === null) return locale === 'vi' ? 'Chưa rõ' : 'Unknown';
  const unitLabels: Record<string, string> =
    locale === 'vi'
      ? { piece: 'cái / quả / bìa', bunch: 'bó', pack: 'gói', slice: 'lát' }
      : { piece: 'pieces', bunch: 'bunches', pack: 'packs', slice: 'slices' };
  const options: Intl.NumberFormatOptions = { maximumSignificantDigits: 12, useGrouping: false };
  const displayed = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', options).format(
    quantity,
  );
  const rounded = Number(new Intl.NumberFormat('en-US', options).format(quantity));
  return `${rounded === quantity ? '' : locale === 'vi' ? 'Khoảng ' : 'About '}${displayed} ${unitLabels[unit] ?? unit}`;
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
            {title ?? (locale === 'vi' ? 'Xem lượng nguyên liệu' : 'Review ingredient quantities')}
            {servings ? ` · ${servings} ${locale === 'vi' ? 'người' : 'servings'}` : ''}
          </summary>
          <p className="planning-coverage-note">
            {locale === 'vi'
              ? 'Lượng từ tủ dự kiến sau các món và bữa trước trong thực đơn. Chưa trừ thực phẩm thật.'
              : 'Fridge coverage is projected after earlier dishes and meals. Real stock is unchanged.'}
          </p>
          <ul>
            {assessment.requirements.map((line, index) => (
              <li key={`${line.ingredientId}:${line.unit}:${index}`}>
                <strong>{line.name}</strong>
                {line.isOptional && (
                  <span className="text-xs text-semantic-text-muted">
                    {locale === 'vi' ? 'Không bắt buộc' : 'Optional'}
                  </span>
                )}
                <dl>
                  <div>
                    <dt>{locale === 'vi' ? 'Cần' : 'Needed'}</dt>
                    <dd>{ingredientAmount(line.requiredQuantity, line.unit, locale)}</dd>
                  </div>
                  <div>
                    <dt>{locale === 'vi' ? 'Từ tủ' : 'From fridge'}</dt>
                    <dd>{ingredientAmount(line.coveredQuantity, line.unit, locale)}</dd>
                  </div>
                  <div data-missing={line.missingQuantity === null || line.missingQuantity > 0}>
                    <dt>{locale === 'vi' ? 'Cần mua' : 'Still needed'}</dt>
                    <dd>{ingredientAmount(line.missingQuantity, line.unit, locale)}</dd>
                  </div>
                </dl>
                {line.status === 'unresolved' && (
                  <p className="text-xs text-semantic-warning-strong">
                    {locale === 'vi'
                      ? 'Kiểm tra đơn vị hoặc lượng thực tế trong gói.'
                      : 'Check the unit or actual package contents.'}
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
