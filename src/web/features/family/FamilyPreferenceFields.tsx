import { useState } from 'react';
import { CANONICAL_INGREDIENTS } from '@frigo/domain';
import type { FamilyPreferences } from '../../services/family-preferences';

const ALLERGENS = [
  ['peanut', 'Đậu phộng'],
  ['milk', 'Sữa'],
  ['egg', 'Trứng'],
  ['soy', 'Đậu nành'],
  ['wheat', 'Lúa mì'],
  ['shellfish', 'Giáp xác / nhuyễn thể'],
  ['fish', 'Cá'],
] as const;
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
  const [search, setSearch] = useState('');
  const results = CANONICAL_INGREDIENTS.filter(
    (item) =>
      !value.includes(item.id) &&
      search.trim() &&
      item.nameVi.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  ).slice(0, 12);
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
        {value.map((id) =>
          choice(id, CANONICAL_INGREDIENTS.find((item) => item.id === id)?.nameVi ?? id),
        )}
      </div>
      <label>
        <span className="sr-only">Tìm {label.toLowerCase()}</span>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm nguyên liệu…"
          autoComplete="off"
        />
      </label>
      <div className="family-choice-row">{results.map((item) => choice(item.id, item.nameVi))}</div>
      {search.trim() && !results.length && <p>Không còn nguyên liệu phù hợp với tìm kiếm.</p>}
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
  const change = <K extends keyof FamilyPreferences>(key: K, next: FamilyPreferences[K]) =>
    onChange({ ...value, [key]: next });
  const toggle = <T extends string | number>(items: T[], id: T, checked: boolean) =>
    checked ? [...items, id] : items.filter((item) => item !== id);
  return (
    <div className="family-preference-fields">
      <fieldset>
        <legend>Khẩu vị quen của nhà mình</legend>
        <p>Chọn nhiều vùng nếu muốn. Đây là ưu tiên, món chung nhiều vùng vẫn được chọn.</p>
        <div className="family-choice-row">
          {(
            [
              ['bac', 'Miền Bắc'],
              ['trung', 'Miền Trung'],
              ['nam', 'Miền Nam'],
            ] as const
          ).map(([id, label]) => (
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
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="family-field-pair">
        <label>
          Kiểu bữa thường nấu
          <select
            value={value.mealStyle}
            onChange={(event) =>
              change('mealStyle', event.target.value as FamilyPreferences['mealStyle'])
            }
          >
            <option value="family">Bữa nhà · chính, rau/phụ, canh, cơm</option>
            <option value="quick">Nhanh gọn · ít món hơn</option>
            <option value="one_pot">Một món trọn bữa · bún, cháo, cơm trộn</option>
          </select>
        </label>
        <label>
          Thời gian muốn dành cho bữa ăn
          <select
            value={value.preferredTimeMinutes}
            onChange={(event) => change('preferredTimeMinutes', Number(event.target.value))}
          >
            {[15, 30, 45, 60, 90, 120, 180].map((time) => (
              <option key={time} value={time}>
                {time} phút
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Bữa nào nhà mình tự nấu?</legend>
        <div className="family-choice-row">
          {(
            [
              ['breakfast', 'Bữa sáng'],
              ['lunch', 'Bữa trưa'],
              ['dinner', 'Bữa tối'],
            ] as const
          ).map(([id, label]) => (
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
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {!compact && (
        <fieldset>
          <legend>Những ngày tự nấu</legend>
          <div className="family-choice-row family-days">
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => (
              <label key={day}>
                <input
                  type="checkbox"
                  aria-label={`Tự nấu ${index === 0 ? 'Chủ nhật' : `Thứ ${index + 1}`}`}
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
          Đi chợ theo nhịp nào?
          <select
            value={value.shoppingCadence}
            onChange={(event) =>
              change('shoppingCadence', event.target.value as FamilyPreferences['shoppingCadence'])
            }
          >
            <option value="daily">Mỗi ngày · đồ tươi cho bữa gần nhất</option>
            <option value="every_2_3_days">2–3 ngày một lần</option>
            <option value="weekly">Một lần cho cả tuần</option>
          </select>
        </label>
        <label>
          Số bữa đổi vị quốc tế mỗi tuần
          <select
            value={value.internationalMealsPerWeek}
            onChange={(event) => change('internationalMealsPerWeek', Number(event.target.value))}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((count) => (
              <option key={count} value={count}>
                {count === 0 ? 'Ưu tiên món Việt' : `Tối đa ${count} bữa`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!compact && (
        <details className="family-extra">
          <summary>Khẩu vị & món quốc tế muốn thử</summary>
          <fieldset>
            <legend>Món quốc tế muốn thử</legend>
            <div className="family-choice-row">
              {(
                [
                  ['korean', 'Hàn'],
                  ['japanese', 'Nhật'],
                  ['chinese', 'Trung Hoa'],
                  ['thai', 'Thái'],
                  ['italian', 'Ý'],
                ] as const
              ).map(([id, label]) => (
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
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <IngredientChoices
            label="Nguyên liệu không thích"
            hint="Ưu tiên khẩu vị mềm; Takolio có thể dùng nếu các lựa chọn khác bị giới hạn."
            value={value.dislikedIngredientIds}
            onChange={(next) => change('dislikedIngredientIds', next)}
          />
        </details>
      )}
      <details className="family-extra family-safety">
        <summary>Dị ứng & nguyên liệu bắt buộc tránh</summary>
        <p>
          Các lựa chọn này là ràng buộc bắt buộc khi tạo thực đơn. Thiếu dữ liệu an toàn, Takolio sẽ
          báo chưa tìm được bữa phù hợp.
        </p>
        <fieldset>
          <legend>Dị ứng cần tránh</legend>
          <div className="family-choice-row">
            {ALLERGENS.map(([id, label]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={(value.allergens ?? []).includes(id)}
                  onChange={(event) =>
                    change('allergens', toggle(value.allergens ?? [], id, event.target.checked))
                  }
                />
                {label}
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
                {id} · hạn chế đã lưu
              </label>
            ))}
        </fieldset>
        <IngredientChoices
          label="Nguyên liệu không ăn"
          hint="Loại món có nguyên liệu này khỏi các gợi ý mới, độc lập với khẩu vị không thích."
          value={value.forbiddenIngredientIds ?? []}
          onChange={(next) => change('forbiddenIngredientIds', next)}
        />
      </details>
    </div>
  );
}
