import { CANONICAL_INGREDIENTS } from '@frigo/domain';
import type { FamilyPreferences } from '../../services/family-preferences';

const regions = { bac: 'Miền Bắc', trung: 'Miền Trung', nam: 'Miền Nam' };
const meals = { breakfast: 'sáng', lunch: 'trưa', dinner: 'tối' };
const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const allergens: Record<string, string> = {
  peanut: 'đậu phộng',
  milk: 'sữa',
  egg: 'trứng',
  soy: 'đậu nành',
  wheat: 'lúa mì',
  shellfish: 'giáp xác / nhuyễn thể',
  fish: 'cá',
};

const ingredientNames = (ids: string[]) =>
  ids.map((id) => CANONICAL_INGREDIENTS.find((item) => item.id === id)?.nameVi ?? id).join(', ');

export function FamilyPreferenceSummary({ value }: { value: FamilyPreferences }) {
  const hardAvoid = value.forbiddenIngredientIds ?? [];
  const allergy = value.allergens ?? [];
  return (
    <dl
      className="divide-y divide-tk-stone/60 text-xs sm:text-sm"
      data-testid="family-preference-review"
    >
      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <dt className="font-bold text-tk-muted">Khẩu vị &amp; kiểu bữa</dt>
        <dd className="font-semibold text-tk-ink sm:text-right">
          {value.preferredRegions.map((region) => regions[region]).join(', ') ||
            'Món Việt mọi vùng'}{' '}
          ·{' '}
          {value.mealStyle === 'family'
            ? 'mâm cơm gia đình 3–4 món'
            : value.mealStyle === 'quick'
              ? 'bữa nhanh gọn'
              : 'một món trọn bữa'}{' '}
          · {value.preferredTimeMinutes} phút
        </dd>
      </div>
      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <dt className="font-bold text-tk-muted">Lịch tự nấu</dt>
        <dd className="font-semibold text-tk-ink sm:text-right">
          {value.cookingMealTypes.map((meal) => meals[meal]).join(', ')} ·{' '}
          {value.cookingDays.map((day) => days[day]).join(', ')}
        </dd>
      </div>
      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <dt className="font-bold text-tk-muted">Nhịp đi chợ &amp; đổi vị</dt>
        <dd className="font-semibold text-tk-ink sm:text-right">
          {value.shoppingCadence === 'daily'
            ? 'mỗi ngày'
            : value.shoppingCadence === 'weekly'
              ? 'mỗi tuần'
              : '2–3 ngày một lần'}{' '}
          · tối đa {value.internationalMealsPerWeek} bữa quốc tế / tuần
        </dd>
      </div>
      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
        <dt className="font-bold text-tk-muted">Dị ứng &amp; bắt buộc tránh</dt>
        <dd className="font-semibold text-tk-ink sm:text-right">
          {allergy.length
            ? `Dị ứng: ${allergy.map((id) => allergens[id] ?? id).join(', ')}`
            : 'Chưa chọn dị ứng'}
          {hardAvoid.length > 0 && ` · không ăn: ${ingredientNames(hardAvoid)}`}
        </dd>
      </div>
      {value.dislikedIngredientIds.length > 0 && (
        <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <dt className="font-bold text-tk-muted">Khẩu vị không thích</dt>
          <dd className="font-semibold text-tk-ink sm:text-right">
            {ingredientNames(value.dislikedIngredientIds)} · ưu tiên mềm
          </dd>
        </div>
      )}
    </dl>
  );
}
