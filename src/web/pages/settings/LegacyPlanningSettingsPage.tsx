import { AccountPage } from '../../components/common/AccountPage';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Wallet, ShoppingBag, CalendarDays, Sparkles } from 'lucide-react';
import { weekApi } from '../../services/week';
import { queryKeys } from '../../lib/queryKeys';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { Button } from '../../components/common/Button';
import { StickyActions, Surface, Switch, UnavailableState } from '../../design-system/primitives';
import { useLocaleText } from '../../i18n/app-i18n';

const MEAL_SLOT_PRESETS = [
  { id: 'dinner_only', labelVi: 'Chỉ bữa tối', labelEn: 'Dinner only', descVi: 'Bữa tối mỗi ngày', descEn: 'Dinner every day' },
  { id: 'working_people', labelVi: 'Người bận rộn', labelEn: 'Busy schedule', descVi: 'Bữa trưa và bữa tối', descEn: 'Lunch and dinner' },
  { id: 'all', labelVi: 'Đủ bữa', labelEn: 'All meals', descVi: 'Sáng, trưa, tối', descEn: 'Breakfast, lunch, and dinner' },
] as const;

const FREQUENCIES = [
  { id: 'once', labelVi: '1 lần / tuần', labelEn: 'Once a week' },
  { id: 'twice', labelVi: '2 lần / tuần', labelEn: 'Twice a week' },
  { id: 'three_plus', labelVi: '3+ lần / tuần', labelEn: '3+ times a week' },
  { id: 'flexible', labelVi: 'Không cố định', labelEn: 'Flexible' },
] as const;

const PRIORITIES = [
  { id: 'use_fridge', labelVi: 'Dùng hết tủ lạnh', labelEn: 'Use what is in the fridge', descVi: 'Ưu tiên nguyên liệu sẵn có', descEn: 'Prioritize ingredients already on hand' },
  { id: 'budget', labelVi: 'Đúng ngân sách', labelEn: 'Stay on budget', descVi: 'Giữ tổng chi phí trong hạn mức', descEn: 'Keep estimated spending within target' },
  { id: 'variety', labelVi: 'Đa dạng món', labelEn: 'More variety', descVi: 'Tránh lặp lại món gần nhau', descEn: 'Avoid repeating similar dishes too soon' },
] as const;

/**
 * T17 screen 22 — planning defaults for future plans over the real
 * GET/PATCH /week/preferences contract. Distinct from the new-plan flow
 * (WeekSetup): saving here never generates a plan.
 */
export const LegacyPlanningSettingsPage: React.FC = () => {
  const { l, isVi } = useLocaleText();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<{
    mealSlotsPreset: string;
    budgetTargetVnd: number | null;
    shoppingFrequency: string;
    priorities: string[];
    autoWeeklyPlanEnabled: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const prefsQuery = useQuery({
    queryKey: queryKeys.planningPreferences(),
    queryFn: () => weekApi.getWeekPreferences(),
  });

  useEffect(() => {
    if (!draft && prefsQuery.data) {
      const p = prefsQuery.data;
      setDraft({
        mealSlotsPreset: p.mealSlotsPreset ?? 'dinner_only',
        budgetTargetVnd: p.budgetTargetVnd ?? 750000,
        shoppingFrequency: p.shoppingFrequency ?? 'once',
        priorities: Array.isArray(p.priorities) ? p.priorities : ['use_fridge'],
        autoWeeklyPlanEnabled: Boolean(p.autoWeeklyPlanEnabled),
      });
    }
  }, [draft, prefsQuery.data]);

  useEffect(() => {
    setSavedAt(null);
  }, [draft]);

  const save = async () => {
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      const result = await weekApi.updateWeekPreferences(draft);
      await queryClient.invalidateQueries({ queryKey: queryKeys.planningPreferences() });
      // Offline replay queued: say so rather than implying the server has it.
      if ((result as { pendingSync?: boolean })?.pendingSync) {
        setSavedAt(null);
        setError(
          l(
            'Chưa có mạng: cài đặt sẽ được đồng bộ lên máy chủ khi kết nối lại.',
            'Offline: settings will sync to the server once you reconnect.',
          ),
        );
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setError(
        l(
          'Chưa thể lưu cài đặt lập kế hoạch. Thử lại khi có kết nối.',
          'Could not save planning settings. Please try again when online.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const togglePriority = (id: string) =>
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        priorities: prev.priorities.includes(id)
          ? prev.priorities.filter((p) => p !== id)
          : [...prev.priorities, id],
      };
    });

  return (
    <AccountPage
      title={l('Cài đặt lập thực đơn', 'Meal planning settings')}
      description={l(
        'Giá trị mặc định cho các thực đơn kế tiếp',
        'Default preferences for upcoming meal plans',
      )}
    >
      <p className="text-xs text-semantic-text-muted mb-3">
        {l(
          'Đây là cài đặt mặc định, không tạo thực đơn mới. Để tạo, mở mục Thực đơn.',
          'These are default preferences and do not generate a new plan. Open Meal Plan to create one.',
        )}
      </p>

      {prefsQuery.isPending && !draft && (
        <InlineLoading label={l('Đang tải cài đặt…', 'Loading settings…')} />
      )}
      {prefsQuery.isError && (
        <InlineError error={prefsQuery.error} onRetry={() => prefsQuery.refetch()} />
      )}
      {/* getWeekPreferences returns null when offline: say so instead of
          showing an endless loading state or fabricating defaults. */}
      {prefsQuery.isSuccess && prefsQuery.data === null && !draft && (
        <UnavailableState
          title={l('Không tải được cài đặt khi ngoại tuyến', 'Settings unavailable offline')}
        >
          {l(
            'Cần kết nối mạng để đọc cài đặt lập thực đơn hiện tại từ máy chủ. Thử lại khi có mạng.',
            'An internet connection is required to load your current planning settings from the server. Try again when online.',
          )}
        </UnavailableState>
      )}

      {draft && (
        <fieldset disabled={saving} className="account-editor space-y-4 pb-8">
          <legend className="sr-only">{l('Chọn cài đặt', 'Choose settings')}</legend>
          <Surface className="p-4 space-y-3">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <Wallet className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" />{' '}
              {l('Ngân sách mục tiêu mỗi tuần', 'Weekly target budget')}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[500000, 750000, 1000000, 1500000].map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={draft.budgetTargetVnd === b}
                  onClick={() => setDraft({ ...draft, budgetTargetVnd: b })}
                  className={`h-11 rounded-card text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.budgetTargetVnd === b
                      ? 'bg-semantic-action-primary text-semantic-text-inverse border-transparent'
                      : 'bg-semantic-surface text-semantic-text-secondary border-semantic-border'
                  }`}
                >
                  {b >= 1000000
                    ? `${b / 1000000}${isVi ? 'tr' : 'M'}`
                    : `${Math.round(b / 1000)}k`}{' '}
                  VND
                </button>
              ))}
            </div>
            <p className="text-xs text-semantic-text-muted">
              {l(
                'Chi phí thực tế luôn hiển thị dạng ước tính.',
                'Actual grocery costs are always shown as estimates.',
              )}
            </p>
          </Surface>

          <Surface className="p-4 space-y-3">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" />{' '}
              {l('Khung bữa mặc định', 'Default meal slots')}
            </h2>
            <div className="space-y-2">
              {MEAL_SLOT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={draft.mealSlotsPreset === preset.id}
                  onClick={() => setDraft({ ...draft, mealSlotsPreset: preset.id })}
                  className={`w-full flex items-center justify-between gap-3 rounded-card border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.mealSlotsPreset === preset.id
                      ? 'border-semantic-action-primary bg-semantic-success-soft/40'
                      : 'border-semantic-border bg-semantic-surface hover:border-semantic-border-strong'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-semantic-text-primary block">
                      {l(preset.labelVi, preset.labelEn)}
                    </span>
                    <span className="text-xs text-semantic-text-muted">
                      {l(preset.descVi, preset.descEn)}
                    </span>
                  </span>
                  {draft.mealSlotsPreset === preset.id && (
                    <Check className="w-4 h-4 text-semantic-action-primary shrink-0" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 space-y-3">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" />{' '}
              {l('Tần suất đi chợ', 'Shopping frequency')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={draft.shoppingFrequency === f.id}
                  onClick={() => setDraft({ ...draft, shoppingFrequency: f.id })}
                  className={`h-11 px-4 rounded-pill text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.shoppingFrequency === f.id
                      ? 'bg-semantic-action-primary text-semantic-text-inverse border-transparent'
                      : 'bg-semantic-surface text-semantic-text-secondary border-semantic-border'
                  }`}
                >
                  {l(f.labelVi, f.labelEn)}
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="p-4 space-y-2">
            <h2 className="text-type-label text-semantic-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-semantic-action-primary" aria-hidden="true" />{' '}
              {l('Ưu tiên khi chọn món', 'Recipe selection priorities')}
            </h2>
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={draft.priorities.includes(p.id)}
                onClick={() => togglePriority(p.id)}
                className="w-full flex items-center justify-between gap-3 rounded-card px-4 py-3 text-left hover:bg-semantic-background-subtle focus-visible:outline-none focus-visible:shadow-t17-focus"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-semantic-text-primary block">
                    {l(p.labelVi, p.labelEn)}
                  </span>
                  <span className="text-xs text-semantic-text-muted">
                    {l(p.descVi, p.descEn)}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 ${
                    draft.priorities.includes(p.id)
                      ? 'bg-semantic-action-primary border-transparent text-white'
                      : 'border-semantic-border-strong bg-semantic-surface'
                  }`}
                >
                  {draft.priorities.includes(p.id) && <Check className="w-4 h-4" />}
                </span>
              </button>
            ))}
          </Surface>

          <div className="px-4">
            <Switch
              disabled={saving}
              checked={draft.autoWeeklyPlanEnabled}
              onChange={(next) => setDraft({ ...draft, autoWeeklyPlanEnabled: next })}
              label={l('Gợi ý thực đơn tuần mới', 'Suggest next week’s meal plan')}
              description={l(
                'Lưu lựa chọn cho tuần kế tiếp; hiện chưa tự gửi nhắc nhở',
                'Saves your preference for next week; automatic reminders are not sent yet',
              )}
            />
          </div>

          {error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="text-sm text-semantic-danger px-4"
            >
              {error}
            </p>
          )}
          {savedAt && !error && (
            <p role="status" className="text-sm text-semantic-success px-4">
              {l('Đã lưu cài đặt lập thực đơn.', 'Planning settings saved.')}
            </p>
          )}

          <StickyActions>
            <Button variant="primary" fullWidth onClick={save} disabled={saving} isLoading={saving}>
              {l('Lưu cài đặt', 'Save settings')}
            </Button>
          </StickyActions>
        </fieldset>
      )}
    </AccountPage>
  );
};
