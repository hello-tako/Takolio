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
    <dl className="family-preference-summary" data-testid="family-preference-review">
      <div>
        <dt>Khẩu vị & kiểu bữa</dt>
        <dd>
          {value.preferredRegions.map((region) => regions[region]).join(', ') ||
            'Món Việt mọi vùng'}{' '}
          ·{' '}
          {value.mealStyle === 'family'
            ? 'chính, rau/phụ, canh, cơm'
            : value.mealStyle === 'quick'
              ? 'bữa nhanh gọn'
              : 'một món trọn bữa'}{' '}
          · {value.preferredTimeMinutes} phút mong muốn
        </dd>
      </div>
      <div>
        <dt>Lịch tự nấu</dt>
        <dd>
          {value.cookingMealTypes.map((meal) => meals[meal]).join(', ')} ·{' '}
          {value.cookingDays.map((day) => days[day]).join(', ')}
        </dd>
      </div>
      <div>
        <dt>Nhịp đi chợ & đổi vị</dt>
        <dd>
          {value.shoppingCadence === 'daily'
            ? 'mỗi ngày'
            : value.shoppingCadence === 'weekly'
              ? 'mỗi tuần'
              : '2–3 ngày một lần'}{' '}
          · tối đa {value.internationalMealsPerWeek} bữa quốc tế / tuần
        </dd>
      </div>
      <div>
        <dt>Dị ứng & bắt buộc tránh</dt>
        <dd>
          {allergy.length
            ? `Dị ứng: ${allergy.map((id) => allergens[id] ?? id).join(', ')}`
            : 'Chưa chọn dị ứng'}
          {hardAvoid.length > 0 && ` · không ăn: ${ingredientNames(hardAvoid)}`}
        </dd>
      </div>
      {value.dislikedIngredientIds.length > 0 && (
        <div>
          <dt>Khẩu vị không thích</dt>
          <dd>{ingredientNames(value.dislikedIngredientIds)} · ưu tiên mềm</dd>
        </div>
      )}
    </dl>
  );
}
