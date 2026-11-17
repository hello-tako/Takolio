import type { ComponentAssessment } from '../../../../packages/domain/src/meal-composition-api';
import { FreshnessShieldIcon, NavShoppingIcon } from '../../design-system/icons';
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

function statusPillClasses(status: ComponentAssessment['status']): string {
  switch (status) {
    case 'covered':
      return 'bg-tk-jade-soft text-tk-jade-deep border-tk-jade/25';
    case 'needs_shopping':
      return 'bg-tk-flame-soft text-tk-flame-deep border-tk-flame/25';
    case 'unresolved':
      return 'bg-tk-turmeric-soft text-tk-turmeric-deep border-tk-turmeric/30';
    default:
      return 'bg-tk-sunken text-tk-secondary border-tk-stone';
  }
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
    <div className="planning-ingredient-coverage mt-2 space-y-1.5">
      <p
        className={`planning-coverage-status inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusPillClasses(assessment.status)}`}
        data-status={assessment.status}
      >
        {assessment.status === 'covered' ? (
          <FreshnessShieldIcon size={12} tone="jade" />
        ) : assessment.status === 'needs_shopping' ? (
          <NavShoppingIcon size={12} tone="flame" />
        ) : null}
        <span>{coverageStatus(assessment, locale)}</span>
      </p>
      {!assessment.selectable && assessment.blockingReasons.length > 0 && (
        <p className="text-xs font-semibold text-tk-turmeric-deep">
          {assessment.blockingReasons.map((code) => reasonLabel(code, locale)).join(' · ')}
        </p>
      )}
      {assessment.requirements.length > 0 && (
        <details className="rounded-xl border border-tk-stone/80 bg-tk-sunken/60 p-2.5 text-xs">
          <summary className="cursor-pointer font-bold text-tk-jade-deep">
            {title ?? (locale === 'vi' ? 'Xem lượng nguyên liệu' : 'Review ingredient quantities')}
            {servings ? ` · ${servings} ${locale === 'vi' ? 'người' : 'servings'}` : ''}
          </summary>
          <p className="planning-coverage-note mt-2 text-[11px] leading-relaxed text-tk-secondary">
            {locale === 'vi'
              ? 'Lượng từ tủ dự kiến sau các món và bữa trước trong thực đơn. Chưa trừ thực phẩm thật.'
              : 'Fridge coverage is projected after earlier dishes and meals. Real stock is unchanged.'}
          </p>
          <ul className="mt-2 divide-y divide-tk-stone/70">
            {assessment.requirements.map((line, index) => (
              <li key={`${line.ingredientId}:${line.unit}:${index}`} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-bold text-tk-ink">{line.name}</strong>
                  {line.isOptional && (
                    <span className="text-[11px] text-tk-muted">
                      {locale === 'vi' ? 'Không bắt buộc' : 'Optional'}
                    </span>
                  )}
                </div>
                <dl className="mt-1.5 grid grid-cols-3 gap-2 rounded-lg bg-white p-2 text-[11px]">
                  <div>
                    <dt className="text-tk-muted">{locale === 'vi' ? 'Cần' : 'Needed'}</dt>
                    <dd className="font-bold text-tk-ink tk-tabular">
                      {ingredientAmount(line.requiredQuantity, line.unit, locale)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-tk-muted">{locale === 'vi' ? 'Từ tủ' : 'From fridge'}</dt>
                    <dd className="font-bold text-tk-jade-deep tk-tabular">
                      {ingredientAmount(line.coveredQuantity, line.unit, locale)}
                    </dd>
                  </div>
                  <div data-missing={line.missingQuantity === null || line.missingQuantity > 0}>
                    <dt className="text-tk-muted">
                      {locale === 'vi' ? 'Cần mua' : 'Still needed'}
                    </dt>
                    <dd className="font-bold text-tk-flame-deep tk-tabular">
                      {ingredientAmount(line.missingQuantity, line.unit, locale)}
                    </dd>
                  </div>
                </dl>
                {line.status === 'unresolved' && (
                  <p className="mt-1 text-[11px] font-semibold text-tk-turmeric-deep">
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
