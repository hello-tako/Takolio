import { AccountPage } from '../../components/common/AccountPage';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { weekApi } from '../../services/week';
import { queryKeys } from '../../lib/queryKeys';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { Button } from '../../components/common/Button';
import { StickyActions, Switch, UnavailableState } from '../../design-system/primitives';
import { BentoCard } from '../../design-system/v4/AtelierPrimitives';
import {
  BudgetCoinJarIcon,
  NavPlannerIcon,
  NavShoppingIcon,
  AiSousChefSparkIcon,
} from '../../design-system/icons';

const MEAL_SLOT_PRESETS = [
  { id: 'dinner_only', label: 'Chỉ bữa tối', desc: 'Bữa tối mỗi ngày' },
  { id: 'working_people', label: 'Người bận rộn', desc: 'Bữa trưa và bữa tối' },
  { id: 'all', label: 'Đủ bữa', desc: 'Sáng, trưa, tối' },
] as const;

const FREQUENCIES = [
  { id: 'once', label: '1 lần / tuần' },
  { id: 'twice', label: '2 lần / tuần' },
  { id: 'three_plus', label: '3+ lần / tuần' },
  { id: 'flexible', label: 'Không cố định' },
] as const;

const PRIORITIES = [
  { id: 'use_fridge', label: 'Dùng hết tủ lạnh', desc: 'Ưu tiên nguyên liệu sẵn có' },
  { id: 'budget', label: 'Đúng ngân sách', desc: 'Giữ tổng chi phí trong hạn mức' },
  { id: 'variety', label: 'Đa dạng món', desc: 'Tránh lặp lại món gần nhau' },
] as const;

export const LegacyPlanningSettingsPage: React.FC = () => {
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
      if ((result as { pendingSync?: boolean })?.pendingSync) {
        setSavedAt(null);
        setError('Chưa có mạng: cài đặt sẽ được đồng bộ lên máy chủ khi kết nối lại.');
        return;
      }
      setSavedAt(Date.now());
    } catch {
      setError('Chưa thể lưu cài đặt lập kế hoạch. Thử lại khi có kết nối.');
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
      title="Cài đặt lập thực đơn"
      description="Giá trị mặc định cho các thực đơn kế tiếp"
    >
      <p className="text-xs text-tk-muted">
        Đây là cài đặt mặc định, không tạo thực đơn mới. Để tạo, mở mục Thực đơn.
      </p>

      {prefsQuery.isPending && !draft && <InlineLoading label="Đang tải cài đặt…" />}
      {prefsQuery.isError && (
        <InlineError error={prefsQuery.error} onRetry={() => void prefsQuery.refetch()} />
      )}
      {prefsQuery.isSuccess && prefsQuery.data === null && !draft && (
        <UnavailableState title="Không tải được cài đặt khi ngoại tuyến">
          Cần kết nối mạng để đọc cài đặt lập thực đơn hiện tại từ máy chủ. Thử lại khi có mạng.
        </UnavailableState>
      )}

      {draft && (
        <fieldset disabled={saving} className="account-editor space-y-4 pb-8">
          <legend className="sr-only">Chọn cài đặt</legend>

          <BentoCard tone="ceramic" padding="md" className="space-y-3">
            <h2 className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2">
              <BudgetCoinJarIcon size={18} tone="turmeric" active />
              <span>Ngân sách mục tiêu mỗi tuần</span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[500000, 750000, 1000000, 1500000].map((b) => (
                <button
                  key={b}
                  type="button"
                  aria-pressed={draft.budgetTargetVnd === b}
                  onClick={() => setDraft({ ...draft, budgetTargetVnd: b })}
                  className={`min-h-11 rounded-2xl text-sm font-extrabold border transition-colors cursor-pointer tk-tabular focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.budgetTargetVnd === b
                      ? 'bg-tk-flame text-white border-tk-flame shadow-xs'
                      : 'bg-white text-tk-secondary border-tk-stone hover:border-tk-ink/25'
                  }`}
                >
                  {b >= 1000000 ? `${b / 1000000}tr` : `${Math.round(b / 1000)}k`} VND
                </button>
              ))}
            </div>
            <p className="text-xs text-tk-muted">Chi phí thực tế luôn hiển thị dạng ước tính.</p>
          </BentoCard>

          <BentoCard tone="ceramic" padding="md" className="space-y-3">
            <h2 className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2">
              <NavPlannerIcon size={18} tone="jade" active />
              <span>Khung bữa mặc định</span>
            </h2>
            <div className="space-y-2">
              {MEAL_SLOT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={draft.mealSlotsPreset === preset.id}
                  onClick={() => setDraft({ ...draft, mealSlotsPreset: preset.id })}
                  className={`w-full flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.mealSlotsPreset === preset.id
                      ? 'border-tk-jade bg-tk-jade-soft/50'
                      : 'border-tk-stone bg-white hover:border-tk-ink/25'
                  }`}
                >
                  <span>
                    <span className="text-sm font-bold text-tk-ink block">{preset.label}</span>
                    <span className="text-xs text-tk-muted">{preset.desc}</span>
                  </span>
                  {draft.mealSlotsPreset === preset.id && (
                    <Check className="w-4 h-4 text-tk-jade" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </BentoCard>

          <BentoCard tone="ceramic" padding="md" className="space-y-3">
            <h2 className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2">
              <NavShoppingIcon size={18} tone="flame" active />
              <span>Tần suất đi chợ</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {FREQUENCIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={draft.shoppingFrequency === f.id}
                  onClick={() => setDraft({ ...draft, shoppingFrequency: f.id })}
                  className={`min-h-11 px-4 rounded-pill text-sm font-bold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    draft.shoppingFrequency === f.id
                      ? 'bg-tk-flame text-white border-tk-flame'
                      : 'bg-white text-tk-secondary border-tk-stone'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </BentoCard>

          <BentoCard tone="ceramic" padding="md" className="space-y-2">
            <h2 className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2">
              <AiSousChefSparkIcon size={18} tone="jade" active />
              <span>Ưu tiên khi chọn món</span>
            </h2>
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="checkbox"
                aria-checked={draft.priorities.includes(p.id)}
                onClick={() => togglePriority(p.id)}
                className="w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left hover:bg-tk-sunken/60 cursor-pointer focus-visible:outline-none focus-visible:shadow-t17-focus"
              >
                <span>
                  <span className="text-sm font-bold text-tk-ink block">{p.label}</span>
                  <span className="text-xs text-tk-muted">{p.desc}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-lg border flex items-center justify-center ${
                    draft.priorities.includes(p.id)
                      ? 'bg-tk-jade border-transparent text-white'
                      : 'border-tk-stone bg-white'
                  }`}
                >
                  {draft.priorities.includes(p.id) && <Check className="w-4 h-4" />}
                </span>
              </button>
            ))}
          </BentoCard>

          <BentoCard tone="ceramic" padding="sm">
            <Switch
              disabled={saving}
              checked={draft.autoWeeklyPlanEnabled}
              onChange={(next) => setDraft({ ...draft, autoWeeklyPlanEnabled: next })}
              label="Gợi ý thực đơn tuần mới"
              description="Lưu lựa chọn cho tuần kế tiếp; hiện chưa tự gửi nhắc nhở"
            />
          </BentoCard>

          {error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
            >
              {error}
            </p>
          )}
          {savedAt && !error && (
            <p
              role="status"
              className="rounded-2xl border border-tk-jade/30 bg-tk-jade-soft px-4 py-3 text-sm font-bold text-tk-jade-deep"
            >
              Đã lưu cài đặt lập thực đơn.
            </p>
          )}

          <StickyActions>
            <Button variant="primary" fullWidth onClick={save} disabled={saving} isLoading={saving}>
              Lưu cài đặt
            </Button>
          </StickyActions>
        </fieldset>
      )}
    </AccountPage>
  );
};
