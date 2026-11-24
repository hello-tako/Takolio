import type { StandardUnit } from '@frigo/domain';
import { localizeStorageZone, useLocaleText } from '../../i18n/app-i18n';

export const REVIEW_UNITS: ReadonlyArray<{ value: StandardUnit; label: string }> = [
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'l' },
  { value: 'piece', label: 'Cái / quả' },
  { value: 'pack', label: 'Gói' },
  { value: 'bunch', label: 'Bó' },
  { value: 'slice', label: 'Lát' },
];

export const REVIEW_UNIT_LABELS_EN: Readonly<Record<StandardUnit, string>> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  piece: 'pcs',
  pack: 'pack',
  bunch: 'bunch',
  slice: 'slice',
};

export interface ReviewValues {
  rawName: string;
  estimatedQuantity: number | '';
  unit: StandardUnit;
  storage: 'fridge' | 'freezer' | 'pantry';
  expiryDate?: string;
  expiryEstimated?: boolean;
}

export function validReviewQuantity(quantity: number | '') {
  return (
    typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= 10000
  );
}

export function validReviewExpiry(date?: string) {
  if (!date) return true;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
}

export function validReviewValues(item: ReviewValues) {
  return (
    Boolean(item.rawName.trim()) &&
    validReviewQuantity(item.estimatedQuantity) &&
    validReviewExpiry(item.expiryDate)
  );
}

export function ReviewFields({
  prefix,
  item,
  disabled,
  onChange,
  receipt = false,
}: {
  prefix: string;
  item: ReviewValues;
  disabled: boolean;
  onChange: (changes: Partial<ReviewValues>) => void;
  receipt?: boolean;
}) {
  const { l, locale } = useLocaleText();
  const fieldId = (field: string) =>
    receipt ? `receipt-${field}-${prefix.slice(8)}` : `${prefix}-${field}`;
  const nameLabel = receipt
    ? l('Tên sản phẩm', 'Product name')
    : l('Tên nguyên liệu', 'Ingredient name');
  const quantityLabel = l('Số lượng', 'Quantity');
  const unitLabel = l('Đơn vị', 'Unit');
  const storageLabel = receipt
    ? l('Nơi bảo quản', 'Storage location')
    : l('Bảo quản', 'Storage');
  const expiryLabel = receipt
    ? l('Hạn dùng trên nhãn', 'Label expiry date')
    : l('Hạn dùng', 'Expiry date');

  return (
    <fieldset disabled={disabled} className="review-fields">
      <legend className="sr-only">{l('Thông tin bạn xác nhận', 'Your confirmed details')}</legend>
      <label className="review-field-wide" htmlFor={`${fieldId('name')}`}>
        {nameLabel}
        <input
          id={`${fieldId('name')}`}
          aria-label={nameLabel}
          className="review-input"
          value={item.rawName}
          required
          pattern=".*\S.*"
          disabled={disabled}
          aria-invalid={!disabled && !item.rawName.trim()}
          onChange={(event) => onChange({ rawName: event.target.value })}
        />
      </label>
      <label htmlFor={`${fieldId('quantity')}`}>
        {quantityLabel}
        <input
          id={`${fieldId('quantity')}`}
          aria-label={quantityLabel}
          className="review-input"
          type="number"
          inputMode="decimal"
          min={Number.MIN_VALUE}
          max="10000"
          step="any"
          required
          value={item.estimatedQuantity}
          disabled={disabled}
          aria-invalid={!disabled && !validReviewQuantity(item.estimatedQuantity)}
          onChange={(event) =>
            onChange({
              estimatedQuantity: event.target.value === '' ? '' : Number(event.target.value),
            })
          }
        />
      </label>
      <label htmlFor={`${fieldId('unit')}`}>
        {unitLabel}
        <select
          id={`${fieldId('unit')}`}
          aria-label={unitLabel}
          className="review-input"
          value={item.unit}
          disabled={disabled}
          onChange={(event) => onChange({ unit: event.target.value as StandardUnit })}
        >
          {REVIEW_UNITS.map(({ value, label }) => (
            <option key={value} value={value}>
              {locale === 'vi' ? label : REVIEW_UNIT_LABELS_EN[value]}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${fieldId('storage')}`}>
        {storageLabel}
        <select
          id={`${fieldId('storage')}`}
          aria-label={storageLabel}
          className="review-input"
          value={item.storage}
          disabled={disabled}
          onChange={(event) => onChange({ storage: event.target.value as ReviewValues['storage'] })}
        >
          <option value="fridge">{l('Ngăn mát', localizeStorageZone('fridge', locale))}</option>
          <option value="freezer">{l('Ngăn đông', localizeStorageZone('freezer', locale))}</option>
          <option value="pantry">{l('Kệ bếp', localizeStorageZone('pantry', locale))}</option>
        </select>
      </label>
      <label htmlFor={`${fieldId('expiry')}`}>
        {expiryLabel}
        <input
          id={`${fieldId('expiry')}`}
          aria-label={expiryLabel}
          className="review-input"
          type="date"
          value={item.expiryDate ?? ''}
          disabled={disabled}
          aria-invalid={!disabled && !validReviewExpiry(item.expiryDate)}
          onChange={(event) =>
            onChange({ expiryDate: event.target.value || undefined, expiryEstimated: false })
          }
        />
      </label>
      {!disabled && !validReviewValues(item) && (
        <p className="review-field-wide review-field-error" role="alert">
          {l(
            'Cần có tên, số lượng lớn hơn 0 (tối đa 10.000) và ngày hợp lệ.',
            'Name, a quantity greater than 0 (up to 10,000), and a valid date are required.',
          )}
        </p>
      )}
    </fieldset>
  );
}
