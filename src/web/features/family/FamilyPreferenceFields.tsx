import { useState } from 'react';
import { CANONICAL_INGREDIENTS } from '@frigo/domain';
import type { FamilyPreferences } from '../../services/family-preferences';
import { localizeIngredientName, useLocaleText } from '../../i18n/app-i18n';

const ALLERGENS = [
  ['peanut', 'Đậu phộng', 'Peanuts'],
  ['milk', 'Sữa', 'Milk / Dairy'],
  ['egg', 'Trứng', 'Eggs'],
  ['soy', 'Đậu nành', 'Soy'],
  ['wheat', 'Lúa mì', 'Wheat'],
  ['shellfish', 'Giáp xác / nhuyễn thể', 'Shellfish'],
  ['fish', 'Cá', 'Fish'],
] as const;

const EN_WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const EN_WEEKDAYS_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const VI_WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;

function IngredientChoices({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const { l, locale, isVi } = useLocaleText();
  const [search, setSearch] = useState('');
  const needle = search.trim();
  const needleLower = isVi ? needle.toLocaleLowerCase('vi') : needle.toLowerCase();
  const results = CANONICAL_INGREDIENTS.filter((item) => {
    if (value.includes(item.id) || !needle) return false;
    if (isVi) {
      return item.nameVi.toLocaleLowerCase('vi').includes(needleLower);
    }
    return (
      localizeIngredientName(item.id, item.nameVi, locale).toLowerCase().includes(needleLower) ||
      item.nameVi.toLocaleLowerCase('vi').includes(needleLower)
    );
  }).slice(0, 12);
  const choice = (id: string, title: string) => (
    <label key={id}>
      <input
        type="checkbox"
        checked={value.includes(id)}
        onChange={(event) =>
          onChange(event.target.checked ? [...value, id] : value.filter((item) => item !== id))
        }
      />
      {title}
    </label>
  );
  return (
    <fieldset className="family-ingredient-field">
      <legend>{label}</legend>
      <p>{hint}</p>
      <div className="family-choice-row">
        {value.map((id) => {
          const matched = CANONICAL_INGREDIENTS.find((item) => item.id === id);
          const title = matched
            ? isVi
              ? matched.nameVi
              : localizeIngredientName(matched.id, matched.nameVi, locale)
            : id;
          return choice(id, title);
        })}
      </div>
      <label>
        <span className="sr-only">
          {l(`Tìm ${label.toLowerCase()}`, `Search ${label.toLowerCase()}`)}
        </span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={l('Tìm nguyên liệu…', 'Search ingredients…')}
          autoComplete="off"
        />
      </label>
      <div className="family-choice-row">
        {results.map((item) =>
          choice(item.id, isVi ? item.nameVi : localizeIngredientName(item.id, item.nameVi, locale)),
        )}
      </div>
      {search.trim() && !results.length && (
        <p>{l('Không còn nguyên liệu phù hợp với tìm kiếm.', 'No matching ingredients left.')}</p>
      )}
    </fieldset>
  );
}

export function FamilyPreferenceFields({
  value,
  onChange,
  compact = false,
}: {
  value: FamilyPreferences;
  onChange: (value: FamilyPreferences) => void;
  compact?: boolean;
}) {
  const { l, isVi } = useLocaleText();
  const change = <K extends keyof FamilyPreferences>(key: K, next: FamilyPreferences[K]) =>
    onChange({ ...value, [key]: next });
  const toggle = <T extends string | number>(items: T[], id: T, checked: boolean) =>
    checked ? [...items, id] : items.filter((item) => item !== id);
  return (
    <div className="family-preference-fields">
      <fieldset>
        <legend>{l('Khẩu vị quen của nhà mình', 'Household regional tastes')}</legend>
        <p>
          {l(
            'Chọn nhiều vùng nếu muốn. Đây là ưu tiên, món chung nhiều vùng vẫn được chọn.',
            'Select as many regions as you like. This is a preference; nationwide dishes can still be picked.',
          )}
        </p>
        <div className="family-choice-row">
          {(
            [
              ['bac', 'Miền Bắc', 'Northern Vietnamese'],
              ['trung', 'Miền Trung', 'Central Vietnamese'],
              ['nam', 'Miền Nam', 'Southern Vietnamese'],
            ] as const
          ).map(([id, labelVi, labelEn]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={value.preferredRegions.includes(id)}
                onChange={(event) =>
                  change(
                    'preferredRegions',
                    toggle(value.preferredRegions, id, event.target.checked),
                  )
                }
              />
              {l(labelVi, labelEn)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="family-field-pair">
        <label>
          {l('Kiểu bữa thường nấu', 'Usual meal style')}
          <select
            value={value.mealStyle}
            onChange={(event) =>
              change('mealStyle', event.target.value as FamilyPreferences['mealStyle'])
            }
          >
            <option value="family">
              {l(
                'Bữa nhà · chính, rau/phụ, canh, cơm',
                'Family meal · main, side/greens, soup, rice',
              )}
            </option>
            <option value="quick">
              {l('Nhanh gọn · ít món hơn', 'Quick & simple · fewer dishes')}
            </option>
            <option value="one_pot">
              {l(
                'Một món trọn bữa · bún, cháo, cơm trộn',
                'One-dish meal · noodles, congee, rice bowls',
              )}
            </option>
          </select>
        </label>
        <label>
          {l('Thời gian muốn dành cho bữa ăn', 'Preferred cooking time per meal')}
          <select
            value={value.preferredTimeMinutes}
            onChange={(event) => change('preferredTimeMinutes', Number(event.target.value))}
          >
            {[15, 30, 45, 60, 90, 120, 180].map((time) => (
              <option key={time} value={time}>
                {l(`${time} phút`, `${time} min`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>{l('Bữa nào nhà mình tự nấu?', 'Which meals do you cook at home?')}</legend>
        <div className="family-choice-row">
          {(
            [
              ['breakfast', 'Bữa sáng', 'Breakfast'],
              ['lunch', 'Bữa trưa', 'Lunch'],
              ['dinner', 'Bữa tối', 'Dinner'],
            ] as const
          ).map(([id, labelVi, labelEn]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={value.cookingMealTypes.includes(id)}
                onChange={(event) =>
                  change(
                    'cookingMealTypes',
                    toggle(value.cookingMealTypes, id, event.target.checked),
                  )
                }
              />
              {l(labelVi, labelEn)}
            </label>
          ))}
        </div>
      </fieldset>
      {!compact && (
        <fieldset>
          <legend>{l('Những ngày tự nấu', 'Days you cook at home')}</legend>
          <div className="family-choice-row family-days">
            {(isVi ? VI_WEEKDAYS_SHORT : EN_WEEKDAYS_SHORT).map((day, index) => (
              <label key={index}>
                <input
                  type="checkbox"
                  aria-label={l(
                    `Tự nấu ${index === 0 ? 'Chủ nhật' : `Thứ ${index + 1}`}`,
                    `Cook on ${EN_WEEKDAYS_FULL[index]}`,
                  )}
                  checked={value.cookingDays.includes(index)}
                  onChange={(event) =>
                    change('cookingDays', toggle(value.cookingDays, index, event.target.checked))
                  }
                />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="family-field-pair">
        <label>
          {l('Đi chợ theo nhịp nào?', 'How often do you shop?')}
          <select
            value={value.shoppingCadence}
            onChange={(event) =>
              change('shoppingCadence', event.target.value as FamilyPreferences['shoppingCadence'])
            }
          >
            <option value="daily">
              {l(
                'Mỗi ngày · đồ tươi cho bữa gần nhất',
                'Daily · fresh groceries for upcoming meals',
              )}
            </option>
            <option value="every_2_3_days">{l('2–3 ngày một lần', 'Every 2–3 days')}</option>
            <option value="weekly">
              {l('Một lần cho cả tuần', 'Once for the whole week')}
            </option>
          </select>
        </label>
        <label>
          {l('Số bữa đổi vị quốc tế mỗi tuần', 'International meals per week')}
          <select
            value={value.internationalMealsPerWeek}
            onChange={(event) => change('internationalMealsPerWeek', Number(event.target.value))}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((count) => (
              <option key={count} value={count}>
                {count === 0
                  ? l('Ưu tiên món Việt', 'Prefer local staples')
                  : l(
                      `Tối đa ${count} bữa`,
                      `Up to ${count} ${count === 1 ? 'meal' : 'meals'}`,
                    )}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!compact && (
        <details className="family-extra">
          <summary>
            {l('Khẩu vị & món quốc tế muốn thử', 'Tastes & international cuisines to try')}
          </summary>
          <fieldset>
            <legend>{l('Món quốc tế muốn thử', 'International cuisines to try')}</legend>
            <div className="family-choice-row">
              {(
                [
                  ['korean', 'Hàn', 'Korean'],
                  ['japanese', 'Nhật', 'Japanese'],
                  ['chinese', 'Trung Hoa', 'Chinese'],
                  ['thai', 'Thái', 'Thai'],
                  ['italian', 'Ý', 'Italian'],
                ] as const
              ).map(([id, labelVi, labelEn]) => (
                <label key={id}>
                  <input
                    name="favorite-cuisines"
                    type="checkbox"
                    value={id}
                    checked={value.preferredCuisines.includes(id)}
                    onChange={(event) =>
                      change(
                        'preferredCuisines',
                        toggle(value.preferredCuisines, id, event.target.checked),
                      )
                    }
                  />
                  {l(labelVi, labelEn)}
                </label>
              ))}
            </div>
          </fieldset>
          <IngredientChoices
            label={l('Nguyên liệu không thích', 'Disliked ingredients')}
            hint={l(
              'Ưu tiên khẩu vị mềm; Takolio có thể dùng nếu các lựa chọn khác bị giới hạn.',
              'Soft preference; Takolio may still use them if other options are limited.',
            )}
            value={value.dislikedIngredientIds}
            onChange={(next) => change('dislikedIngredientIds', next)}
          />
        </details>
      )}
      <details className="family-extra family-safety">
        <summary>
          {l('Dị ứng & nguyên liệu bắt buộc tránh', 'Allergies & strictly excluded ingredients')}
        </summary>
        <p>
          {l(
            'Các lựa chọn này là ràng buộc bắt buộc khi tạo thực đơn. Thiếu dữ liệu an toàn, Takolio sẽ báo chưa tìm được bữa phù hợp.',
            'These selections are strict constraints when generating meal plans. If safety data is missing, Takolio will report that no suitable meal was found.',
          )}
        </p>
        <fieldset>
          <legend>{l('Dị ứng cần tránh', 'Allergens to avoid')}</legend>
          <div className="family-choice-row">
            {ALLERGENS.map(([id, labelVi, labelEn]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={(value.allergens ?? []).includes(id)}
                  onChange={(event) =>
                    change('allergens', toggle(value.allergens ?? [], id, event.target.checked))
                  }
                />
                {l(labelVi, labelEn)}
              </label>
            ))}
          </div>
          {(value.allergens ?? [])
            .filter((id) => !ALLERGENS.some(([known]) => known === id))
            .map((id) => (
              <label key={id} className="family-existing-choice">
                <input
                  type="checkbox"
                  checked
                  onChange={() =>
                    change(
                      'allergens',
                      (value.allergens ?? []).filter((item) => item !== id),
                    )
                  }
                />
                {id} · {l('hạn chế đã lưu', 'saved restriction')}
              </label>
            ))}
        </fieldset>
        <IngredientChoices
          label={l('Nguyên liệu không ăn', 'Forbidden ingredients')}
          hint={l(
            'Loại món có nguyên liệu này khỏi các gợi ý mới, độc lập với khẩu vị không thích.',
            'Excludes dishes containing these ingredients from new suggestions, separately from soft dislikes.',
          )}
          value={value.forbiddenIngredientIds ?? []}
          onChange={(next) => change('forbiddenIngredientIds', next)}
        />
      </details>
    </div>
  );
}
