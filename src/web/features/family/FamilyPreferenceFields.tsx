import { useState } from 'react';
import { clsx } from 'clsx';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { CANONICAL_INGREDIENTS } from '@frigo/domain';
import type { FamilyPreferences } from '../../services/family-preferences';
import {
  AllergenShieldIcon,
  ClaypotBraiseIcon,
  HerbSprigIcon,
  HouseholdTrayIcon,
  WokFlameIcon,
} from '../../design-system/icons';

const ALLERGENS = [
  ['shellfish', 'Giáp xác / nhuyễn thể'],
  ['peanut', 'Đậu phộng'],
  ['milk', 'Sữa'],
  ['egg', 'Trứng'],
  ['soy', 'Đậu nành'],
  ['wheat', 'Lúa mì'],
  ['fish', 'Cá'],
] as const;

const MEAL_STYLE_CARDS: ReadonlyArray<{
  id: FamilyPreferences['mealStyle'];
  title: string;
  subtitle: string;
  icon: typeof HouseholdTrayIcon;
}> = [
  {
    id: 'family',
    title: 'Mâm cơm gia đình 3–4 món',
    subtitle: 'Đầy đủ món mặn, canh, rau xào và cơm nóng',
    icon: HouseholdTrayIcon,
  },
  {
    id: 'quick',
    title: 'Bữa nhanh gọn 25 phút',
    subtitle: 'Ít nồi chảo, tối ưu ngày đi làm bận rộn',
    icon: WokFlameIcon,
  },
  {
    id: 'one_pot',
    title: 'Món một nồi trọn bữa',
    subtitle: 'Bún, phở, cháo, mì hoặc cơm trộn đủ chất',
    icon: ClaypotBraiseIcon,
  },
];

const QUICK_AVOID_CANDIDATES = [
  { id: 'PORK', label: 'Không ăn thịt heo' },
  { id: 'BEEF', label: 'Không ăn thịt bò' },
  { id: 'SHRIMP', label: 'Không ăn tôm' },
  { id: 'CILANTRO', label: 'Không ăn rau mùi' },
] as const;

const VALID_CANONICAL_IDS = new Set(CANONICAL_INGREDIENTS.map((item) => item.id));
const QUICK_AVOID_PILLS = QUICK_AVOID_CANDIDATES.filter((c) => VALID_CANONICAL_IDS.has(c.id));

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

  const renderChip = (id: string, title: string, selected: boolean) => (
    <label key={id} className="cursor-pointer inline-flex">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={selected}
        onChange={(event) =>
          onChange(event.target.checked ? [...value, id] : value.filter((item) => item !== id))
        }
      />
      <span
        className={clsx(
          'tap-target inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-xs font-bold border transition-tap peer-focus-visible:ring-3 peer-focus-visible:ring-tk-flame/35',
          selected
            ? 'bg-tk-ink text-white border-tk-ink'
            : 'bg-white text-tk-secondary border-tk-stone hover:border-tk-ink/30 hover:text-tk-ink',
        )}
      >
        <span>{title}</span>
        {selected && <X className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />}
      </span>
    </label>
  );

  return (
    <fieldset className="rounded-2xl border border-tk-stone/80 bg-white p-4 space-y-3">
      <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-ink">
        {label}
      </legend>
      <p className="text-xs text-tk-secondary leading-relaxed">{hint}</p>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) =>
            renderChip(
              id,
              CANONICAL_INGREDIENTS.find((item) => item.id === id)?.nameVi ?? id,
              true,
            ),
          )}
        </div>
      )}

      <label className="relative block">
        <span className="sr-only">Tìm {label.toLowerCase()}</span>
        <Search
          className="w-4 h-4 text-tk-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm nguyên liệu tiếng Việt…"
          autoComplete="off"
          className="w-full h-11 pl-10 pr-4 rounded-xl bg-tk-canvas border border-tk-stone focus:bg-white focus:border-tk-jade focus:outline-none focus:ring-2 focus:ring-tk-jade/20 text-sm font-medium text-tk-ink"
        />
      </label>

      {results.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {results.map((item) => renderChip(item.id, item.nameVi, false))}
        </div>
      )}
      {search.trim() && !results.length && (
        <p className="text-xs text-tk-muted">Không còn nguyên liệu phù hợp với tìm kiếm.</p>
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
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const change = <K extends keyof FamilyPreferences>(key: K, next: FamilyPreferences[K]) =>
    onChange({ ...value, [key]: next });
  const toggle = <T extends string | number>(items: T[], id: T, checked: boolean) =>
    checked ? [...items, id] : items.filter((item) => item !== id);

  const timeChoices = Array.from(
    new Set([15, 30, 45, 60, 90, value.preferredTimeMinutes]),
  ).sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      {/* 1. Regional Flavor Chips */}
      <fieldset className="rounded-[24px] border border-tk-stone/85 bg-white p-5 shadow-xs space-y-3">
        <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-jade inline-flex items-center gap-1.5">
          <HerbSprigIcon size={15} tone="jade" active />
          <span>Khẩu vị quen của nhà mình</span>
        </legend>
        <p className="text-xs text-tk-secondary leading-relaxed">
          Vị Bắc thanh tao · Vị Trung đậm đà · Vị Nam ngọt dịu. Chọn nhiều vùng nếu muốn; các món
          quốc dân hợp mọi miền vẫn luôn được gợi ý.
        </p>
        <div className="flex flex-wrap gap-2.5">
          {(
            [
              ['bac', 'Miền Bắc'],
              ['trung', 'Miền Trung'],
              ['nam', 'Miền Nam'],
            ] as const
          ).map(([id, label]) => {
            const checked = value.preferredRegions.includes(id);
            return (
              <label key={id} className="cursor-pointer inline-flex">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={(event) =>
                    change(
                      'preferredRegions',
                      toggle(value.preferredRegions, id, event.target.checked),
                    )
                  }
                />
                <span
                  className={clsx(
                    'tap-target inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold border transition-tap peer-focus-visible:ring-3 peer-focus-visible:ring-tk-jade/30',
                    checked
                      ? 'bg-tk-jade text-white border-tk-jade shadow-jade'
                      : 'bg-tk-canvas text-tk-ink border-tk-stone hover:border-tk-ink/30',
                  )}
                >
                  {checked && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                  <span>{label}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* 2. Visual Meal Style Cards + Cook Time Pills */}
      <fieldset className="rounded-[24px] border border-tk-stone/85 bg-white p-5 shadow-xs space-y-4">
        <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-ink">
          Kiểu bữa thường nấu
        </legend>
        <label className="sr-only">
          <span>Kiểu bữa thường nấu</span>
          <select
            value={value.mealStyle}
            onChange={(event) => change('mealStyle', event.target.value as FamilyPreferences['mealStyle'])}
          >
            <option value="family">Bữa cơm gia đình</option>
            <option value="quick">Bữa nhanh gọn</option>
            <option value="one_pot">Món một nồi</option>
          </select>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MEAL_STYLE_CARDS.map((card) => {
            const Icon = card.icon;
            const active = value.mealStyle === card.id;
            return (
              <label key={card.id} className="cursor-pointer block">
                <input
                  type="radio"
                  name="family-meal-style"
                  value={card.id}
                  className="peer sr-only"
                  checked={active}
                  onChange={() => change('mealStyle', card.id)}
                />
                <span
                  className={clsx(
                    'flex h-full flex-col justify-between gap-2.5 rounded-2xl border p-3.5 text-left transition-tap peer-focus-visible:ring-3 peer-focus-visible:ring-tk-flame/35',
                    active
                      ? 'border-tk-flame bg-tk-flame-soft/65 shadow-xs'
                      : 'border-tk-stone bg-tk-canvas/50 hover:bg-tk-canvas',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <Icon size={22} tone={active ? 'flame' : 'ink'} active={active} />
                    {active && <Check className="w-4 h-4 text-tk-flame" aria-hidden="true" />}
                  </span>
                  <span>
                    <strong className="block text-sm font-extrabold text-tk-ink">
                      {card.title}
                    </strong>
                    <span className="mt-0.5 block text-xs text-tk-secondary leading-snug">
                      {card.subtitle}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="pt-1 space-y-2">
          <span className="block text-xs font-bold text-tk-secondary">
            Thời gian muốn dành cho mỗi bữa
          </span>
          <label className="sr-only">
            <span>Thời gian muốn dành cho mỗi bữa</span>
            <select
              value={String(value.preferredTimeMinutes)}
              onChange={(event) => change('preferredTimeMinutes', Number(event.target.value))}
            >
              {timeChoices.map((time) => (
                <option key={time} value={time}>
                  {time} phút
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            {timeChoices.map((time) => {
              const active = value.preferredTimeMinutes === time;
              return (
                <button
                  key={time}
                  type="button"
                  aria-pressed={active}
                  onClick={() => change('preferredTimeMinutes', time)}
                  className={clsx(
                    'tap-target rounded-xl px-3.5 py-2 text-xs font-extrabold border transition-tap cursor-pointer tk-tabular',
                    active
                      ? 'bg-tk-ink text-white border-tk-ink'
                      : 'bg-tk-canvas text-tk-secondary border-tk-stone hover:text-tk-ink',
                  )}
                >
                  {time} phút
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* 3. Visual Allergen Shield Pills (Upfront Safety Boundary!) */}
      <fieldset className="rounded-[24px] border border-tk-stone/85 bg-white p-5 shadow-xs space-y-3.5">
        <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-berry-deep inline-flex items-center gap-1.5">
          <AllergenShieldIcon size={16} tone="flame" active />
          <span>Dị ứng cần tránh</span>
        </legend>
        <p className="text-xs text-tk-secondary leading-relaxed">
          Khiên an toàn cứng: Takolio sẽ loại bỏ tuyệt đối các món chứa chất gây dị ứng đã chọn khi
          tạo thực đơn.
        </p>

        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map(([id, label]) => {
            const checked = (value.allergens ?? []).includes(id);
            return (
              <label key={id} className="cursor-pointer inline-flex">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked}
                  onChange={(event) =>
                    change('allergens', toggle(value.allergens ?? [], id, event.target.checked))
                  }
                />
                <span
                  className={clsx(
                    'tap-target inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs sm:text-sm font-bold border transition-tap peer-focus-visible:ring-3 peer-focus-visible:ring-tk-berry/30',
                    checked
                      ? 'bg-tk-berry text-white border-tk-berry shadow-xs'
                      : 'bg-tk-canvas/70 text-tk-ink border-tk-stone hover:border-tk-berry/40',
                  )}
                >
                  <AllergenShieldIcon size={15} tone={checked ? 'cream' : 'flame'} active={checked} />
                  <span>{label}</span>
                </span>
              </label>
            );
          })}

          {(value.allergens ?? [])
            .filter((id) => !ALLERGENS.some(([known]) => known === id))
            .map((id) => (
              <label key={id} className="cursor-pointer inline-flex">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked
                  onChange={() =>
                    change(
                      'allergens',
                      (value.allergens ?? []).filter((item) => item !== id),
                    )
                  }
                />
                <span className="tap-target inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-xs font-bold bg-tk-berry text-white border border-tk-berry">
                  <span>{id} · hạn chế đã lưu</span>
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </span>
              </label>
            ))}
        </div>

        {QUICK_AVOID_PILLS.length > 0 && (
          <div className="pt-2 border-t border-tk-stone/60 space-y-2">
            <span className="block text-xs font-bold text-tk-secondary">
              Kiêng nhanh nguyên liệu phổ biến:
            </span>
            <div className="flex flex-wrap gap-2">
              {QUICK_AVOID_PILLS.map((pill) => {
                const active = (value.forbiddenIngredientIds ?? []).includes(pill.id);
                return (
                  <button
                    key={pill.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      change(
                        'forbiddenIngredientIds',
                        toggle(value.forbiddenIngredientIds ?? [], pill.id, !active),
                      )
                    }
                    className={clsx(
                      'tap-target rounded-pill px-3.5 py-1.5 text-xs font-bold border transition-tap cursor-pointer',
                      active
                        ? 'bg-tk-ink text-white border-tk-ink'
                        : 'bg-white text-tk-secondary border-tk-stone hover:text-tk-ink',
                    )}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </fieldset>

      {/* 4. Optional Clean Expandable Advanced Drawer ("Tùy chỉnh nâng cao") */}
      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-[24px] border border-tk-stone bg-tk-sunken/60 overflow-hidden"
      >
        <summary className="tap-target flex items-center justify-between gap-3 px-5 py-4 cursor-pointer select-none list-none hover:bg-tk-sunken transition-colors">
          <div>
            <span className="block text-sm font-extrabold text-tk-ink">
              Tùy chỉnh nâng cao (Lịch tự nấu, Đi chợ, Món quốc tế &amp; Nguyên liệu kiêng)
            </span>
            <span className="block text-xs text-tk-secondary mt-0.5">
              Tùy chọn thêm — mặc định đã tối ưu sẵn cho bữa tối gia đình Việt.
            </span>
          </div>
          <ChevronDown
            className={clsx(
              'w-5 h-5 text-tk-muted shrink-0 transition-transform duration-200',
              advancedOpen && 'rotate-180 text-tk-ink',
            )}
            aria-hidden="true"
          />
        </summary>

        <div className="p-5 pt-2 space-y-5 border-t border-tk-stone/70">
          {/* Meals Cooked */}
          <fieldset className="rounded-2xl border border-tk-stone/80 bg-white p-4 space-y-2.5">
            <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-ink">
              Bữa nào nhà mình tự nấu?
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['breakfast', 'Bữa sáng'],
                  ['lunch', 'Bữa trưa'],
                  ['dinner', 'Bữa tối'],
                ] as const
              ).map(([id, label]) => {
                const checked = value.cookingMealTypes.includes(id);
                return (
                  <label key={id} className="cursor-pointer inline-flex">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={checked}
                      onChange={(event) =>
                        change(
                          'cookingMealTypes',
                          toggle(value.cookingMealTypes, id, event.target.checked),
                        )
                      }
                    />
                    <span
                      className={clsx(
                        'tap-target inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold border transition-tap peer-focus-visible:ring-2 peer-focus-visible:ring-tk-jade',
                        checked
                          ? 'bg-tk-jade text-white border-tk-jade'
                          : 'bg-tk-canvas text-tk-secondary border-tk-stone hover:text-tk-ink',
                      )}
                    >
                      {checked && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                      <span>{label}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Days Cooked */}
          {!compact && (
            <fieldset className="rounded-2xl border border-tk-stone/80 bg-white p-4 space-y-2.5">
              <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-ink">
                Những ngày tự nấu
              </legend>
              <div className="flex flex-wrap gap-2">
                {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => {
                  const checked = value.cookingDays.includes(index);
                  return (
                    <label key={day} className="cursor-pointer inline-flex">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        aria-label={`Tự nấu ${index === 0 ? 'Chủ nhật' : `Thứ ${index + 1}`}`}
                        checked={checked}
                        onChange={(event) =>
                          change(
                            'cookingDays',
                            toggle(value.cookingDays, index, event.target.checked),
                          )
                        }
                      />
                      <span
                        className={clsx(
                          'tap-target inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-extrabold border transition-tap peer-focus-visible:ring-2 peer-focus-visible:ring-tk-jade',
                          checked
                            ? 'bg-tk-jade text-white border-tk-jade'
                            : 'bg-tk-canvas text-tk-secondary border-tk-stone hover:text-tk-ink',
                        )}
                      >
                        {day}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Shopping Cadence & International Frequency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-tk-stone/80 bg-white p-4 space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-tk-ink">
                Đi chợ theo nhịp nào?
                <select
                  value={value.shoppingCadence}
                  onChange={(event) =>
                    change(
                      'shoppingCadence',
                      event.target.value as FamilyPreferences['shoppingCadence'],
                    )
                  }
                  className="mt-2 w-full h-11 px-3 rounded-xl bg-tk-canvas border border-tk-stone text-sm font-semibold text-tk-ink focus:bg-white focus:border-tk-jade focus:outline-none"
                >
                  <option value="daily">Mỗi ngày · đồ tươi cho bữa gần nhất</option>
                  <option value="every_2_3_days">2–3 ngày một lần</option>
                  <option value="weekly">Một lần cho cả tuần</option>
                </select>
              </label>
            </div>

            <div className="rounded-2xl border border-tk-stone/80 bg-white p-4 space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-tk-ink">
                Số bữa đổi vị quốc tế mỗi tuần
                <select
                  value={value.internationalMealsPerWeek}
                  onChange={(event) =>
                    change('internationalMealsPerWeek', Number(event.target.value))
                  }
                  className="mt-2 w-full h-11 px-3 rounded-xl bg-tk-canvas border border-tk-stone text-sm font-semibold text-tk-ink focus:bg-white focus:border-tk-jade focus:outline-none"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((count) => (
                    <option key={count} value={count}>
                      {count === 0 ? 'Ưu tiên món Việt' : `Tối đa ${count} bữa`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* International Cuisines */}
          {!compact && (
            <fieldset className="rounded-2xl border border-tk-stone/80 bg-white p-4 space-y-2.5">
              <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-ink">
                Món quốc tế muốn thử
              </legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['korean', 'Hàn Quốc'],
                    ['japanese', 'Nhật Bản'],
                    ['chinese', 'Trung Hoa'],
                    ['thai', 'Thái Lan'],
                    ['italian', 'Ý'],
                  ] as const
                ).map(([id, label]) => {
                  const checked = value.preferredCuisines.includes(id);
                  return (
                    <label key={id} className="cursor-pointer inline-flex">
                      <input
                        name="favorite-cuisines"
                        type="checkbox"
                        value={id}
                        className="peer sr-only"
                        checked={checked}
                        onChange={(event) =>
                          change(
                            'preferredCuisines',
                            toggle(value.preferredCuisines, id, event.target.checked),
                          )
                        }
                      />
                      <span
                        className={clsx(
                          'tap-target inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold border transition-tap peer-focus-visible:ring-2 peer-focus-visible:ring-tk-flame',
                          checked
                            ? 'bg-tk-flame text-white border-tk-flame'
                            : 'bg-tk-canvas text-tk-secondary border-tk-stone hover:text-tk-ink',
                        )}
                      >
                        {checked && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{label}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* Hard Forbidden Ingredients */}
          <IngredientChoices
            label="Nguyên liệu không ăn"
            hint="Loại món có nguyên liệu này khỏi các gợi ý mới, độc lập với khẩu vị không thích."
            value={value.forbiddenIngredientIds ?? []}
            onChange={(next) => change('forbiddenIngredientIds', next)}
          />

          {/* Soft Disliked Ingredients */}
          {!compact && (
            <IngredientChoices
              label="Nguyên liệu không thích"
              hint="Ưu tiên khẩu vị mềm; Takolio chỉ cân nhắc nếu các lựa chọn khác quá hạn hẹp."
              value={value.dislikedIngredientIds}
              onChange={(next) => change('dislikedIngredientIds', next)}
            />
          )}
        </div>
      </details>
    </div>
  );
}
