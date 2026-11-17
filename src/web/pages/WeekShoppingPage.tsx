import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { mapCategoryToShoppingSection, type AggregatedShoppingItem } from '@frigo/domain';
import { useWeekStore } from '../stores/useWeekStore';
import { WeekWorkspace, weekCurrency } from '../features/week/WeekWorkspace';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { BentoCard } from '../design-system/v4/AtelierPrimitives';
import { BudgetCoinJarIcon, NavFridgeIcon } from '../design-system/icons';
import { getIngredientImage } from '../lib/ingredient-images';
import { capturePrivateSession } from '../lib/private-session';
import { queryKeys } from '../lib/queryKeys';
import { api } from '../services/api';

type Completion = { items: AggregatedShoppingItem[]; count: number; pendingSync?: boolean };

export function WeekShoppingPage() {
  const { planId } = useParams<{ planId: string }>();
  const { error: workflowError, toggleShoppingItem, completeShopping } = useWeekStore();
  const [shoppingMode, setShoppingMode] = useState<'list' | 'active' | 'complete'>('list');
  const [selectedSection, setSelectedSection] = useState('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [completedShopping, setCompletedShopping] = useState<Completion | null>(null);
  const lifecycle = useRef(0);
  const submitting = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const planQuery = useQuery({
    queryKey: queryKeys.weekPlan(planId || ''),
    queryFn: () => api.getWeekPlan(planId!),
    enabled: Boolean(planId),
  });
  const currentPlan = planQuery.data ?? null;

  useEffect(() => {
    if (currentPlan) useWeekStore.setState({ currentPlan });
  }, [currentPlan]);

  useEffect(() => {
    lifecycle.current += 1;
    submitting.current = false;
    setShoppingMode('list');
    setSelectedSection('all');
    setIsSubmitting(false);
    setCompletionError(null);
    setCompletedShopping(null);
    return () => {
      lifecycle.current += 1;
    };
  }, [planId]);

  useEffect(() => {
    if (completionError) errorRef.current?.focus();
  }, [completionError]);

  useEffect(() => {
    if (completedShopping) completionRef.current?.focus();
  }, [completedShopping]);

  const items = currentPlan?.shoppingItems ?? [];
  const checkedItems = items.filter((item) => item.checked);
  const sections = [...new Set(items.map((item) => mapCategoryToShoppingSection(item.category)))];
  const filteredItems =
    selectedSection === 'all'
      ? items
      : items.filter((item) => mapCategoryToShoppingSection(item.category) === selectedSection);
  const backTo = planId ? `/week/${planId}` : '/week';

  async function finishShopping() {
    if (submitting.current || !checkedItems.length) return;
    const isCurrentSession = capturePrivateSession();
    const owner = lifecycle.current;
    const isCurrent = () => isCurrentSession() && lifecycle.current === owner;
    const submittedItems = checkedItems.map((item) => ({ ...item }));
    submitting.current = true;
    setCompletionError(null);
    setIsSubmitting(true);
    try {
      const result = await completeShopping();
      if (!isCurrent()) return;
      if (!result.success) throw new Error('Shopping not completed');
      setCompletedShopping({
        items: submittedItems,
        count: result.count,
        pendingSync: result.pendingSync,
      });
      setShoppingMode('complete');
    } catch {
      if (isCurrent())
        setCompletionError('Chưa nhập được nguyên liệu vào tủ lạnh. Vui lòng thử lại.');
    } finally {
      if (isCurrent()) {
        submitting.current = false;
        setIsSubmitting(false);
      }
    }
  }

  if (shoppingMode === 'complete' && completedShopping) {
    const pending = completedShopping.pendingSync === true;
    return (
      <WeekWorkspace
        title={pending ? 'Yêu cầu nhập đang chờ đồng bộ.' : 'Đã nhập nguyên liệu vào tủ.'}
        backTo={backTo}
        narrow
        description={
          pending
            ? 'Máy chủ chưa xác nhận nhập hàng. Kiểm tra lại tủ và trạng thái đồng bộ khi có kết nối.'
            : `Đã nhận xác nhận nhập ${completedShopping.count} nguyên liệu. Bạn có thể xem lại số lượng trong tủ.`
        }
      >
        <div
          className="week-paper week-completion space-y-4 rounded-[26px] border border-tk-jade/25 bg-white p-6 shadow-card focus:outline-none"
          ref={completionRef}
          tabIndex={-1}
          role="status"
        >
          <h2 className="font-heading text-lg font-extrabold text-tk-ink">
            {pending ? 'Nguyên liệu trong yêu cầu' : 'Nguyên liệu đã chọn'}
          </h2>
          <ul className="week-completion-list divide-y divide-tk-stone/70 text-sm">
            {completedShopping.items.map((item) => (
              <li key={item.ingredientId} className="flex justify-between gap-3 py-2.5">
                <span className="font-semibold text-tk-ink">{item.name}</span>
                <strong className="font-extrabold text-tk-jade-deep tk-tabular">
                  {item.recommendedPurchaseQuantity} {item.unit}
                </strong>
              </li>
            ))}
          </ul>
          <p className="week-muted text-xs text-tk-secondary">
            Chỉ những nguyên liệu bạn đã chọn được gửi trong lần xác nhận này.
          </p>
          <div className="week-actions flex flex-wrap gap-3 pt-2">
            <Link
              to="/fridge"
              className="week-button inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-tk-jade px-5 py-2.5 text-sm font-extrabold text-white shadow-jade transition-tap hover:bg-tk-jade-hover"
            >
              <NavFridgeIcon size={18} tone="jade" active />
              Xem tủ lạnh
            </Link>
            <Link
              to={backTo}
              className="week-button week-button-secondary inline-flex min-h-11 flex-1 items-center justify-center rounded-2xl border border-tk-stone bg-white px-4 py-2.5 text-sm font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
            >
              Về thực đơn tuần
            </Link>
          </div>
        </div>
      </WeekWorkspace>
    );
  }

  return (
    <WeekWorkspace
      title={
        shoppingMode === 'active' ? 'Đi chợ, từng nguyên liệu một.' : 'Mua thêm vừa đủ cho tuần.'
      }
      backTo={backTo}
      description="Đánh dấu nguyên liệu đã mua. Chỉ khi xác nhận nhập, các nguyên liệu được chọn mới được gửi vào tủ."
    >
      {planQuery.isError ? (
        <InlineError error={planQuery.error} onRetry={() => planQuery.refetch()} />
      ) : !currentPlan ? (
        planQuery.isPending ? (
          <InlineLoading label="Đang tải danh sách đi chợ…" />
        ) : (
          <p role="status" className="text-sm font-semibold text-tk-secondary">
            Không tìm thấy thực đơn này.
          </p>
        )
      ) : (
        <>
          {(completionError || workflowError) && (
            <p
              role="alert"
              tabIndex={-1}
              ref={errorRef}
              className="week-error rounded-2xl border border-tk-berry/30 bg-tk-berry-soft p-4 text-sm font-semibold text-tk-berry-deep"
            >
              {completionError || workflowError}
            </p>
          )}

          <BentoCard
            tone="turmeric"
            padding="md"
            className="week-shopping-summary week-paper flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="week-eyebrow flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-tk-turmeric-deep">
                <BudgetCoinJarIcon size={15} tone="turmeric" active />
                MUA THÊM · ƯỚC TÍNH
              </p>
              <h2 className="mt-1 font-heading text-xl font-extrabold text-tk-ink tk-tabular">
                {currentPlan.budget.displayText || 'Chưa có ước tính giá'}
              </h2>
              <p className="week-muted mt-1 text-xs text-tk-secondary">
                Giá thực tế có thể khác; giá bằng 0 trong kế hoạch có thể do thiếu dữ liệu.
              </p>
            </div>
            <p
              role="status"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-tk-ink shadow-xs"
            >
              Đã chọn{' '}
              <strong className="font-extrabold text-tk-jade-deep tk-tabular">
                {checkedItems.length}/{items.length}
              </strong>{' '}
              nguyên liệu
            </p>
          </BentoCard>

          {!items.length ? (
            <BentoCard tone="sunken" padding="lg" className="week-paper week-empty text-center space-y-3">
              <h2 className="font-heading text-xl font-extrabold text-tk-ink">
                Chưa có nguyên liệu cần mua thêm
              </h2>
              <p className="week-muted text-sm text-tk-secondary">
                Kiểm tra lại tủ và nguyên liệu từng bữa trước khi nấu.
              </p>
              <Link
                to={backTo}
                className="week-button week-button-secondary inline-flex min-h-11 items-center justify-center rounded-2xl border border-tk-stone bg-white px-5 py-2.5 text-sm font-bold text-tk-ink"
              >
                Về thực đơn tuần
              </Link>
            </BentoCard>
          ) : (
            <>
              <div
                className="week-shopping-filters flex flex-wrap gap-2"
                role="group"
                aria-label="Nhóm nguyên liệu"
              >
                {['all', ...sections].map((section) => {
                  const active = selectedSection === section;
                  return (
                    <button
                      key={section}
                      type="button"
                      className={`week-button week-button-secondary min-h-10 rounded-full border px-4 py-1.5 text-xs font-extrabold transition-colors ${
                        active
                          ? 'border-tk-jade bg-tk-jade text-white shadow-xs'
                          : 'border-tk-stone bg-white text-tk-secondary hover:text-tk-ink'
                      }`}
                      aria-pressed={active}
                      onClick={() => setSelectedSection(section)}
                    >
                      {section === 'all' ? 'Tất cả' : section} (
                      {section === 'all'
                        ? items.length
                        : items.filter(
                            (item) => mapCategoryToShoppingSection(item.category) === section,
                          ).length}
                      )
                    </button>
                  );
                })}
              </div>

              <ul className="week-shopping-list space-y-2.5">
                {filteredItems.map((item) => (
                  <li key={item.ingredientId}>
                    <button
                      type="button"
                      aria-pressed={item.checked}
                      disabled={isSubmitting}
                      onClick={() => toggleShoppingItem(item.ingredientId, !item.checked)}
                      className={`week-shopping-item flex w-full items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
                        item.checked
                          ? 'border-tk-jade/40 bg-tk-jade-soft/55'
                          : 'border-tk-stone bg-white hover:bg-tk-canvas'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`week-shopping-check flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border ${
                            item.checked
                              ? 'border-tk-jade bg-tk-jade text-white'
                              : 'border-tk-stone bg-tk-canvas'
                          }`}
                          aria-hidden="true"
                        >
                          {item.checked && <Check size={16} />}
                        </span>
                        <img
                          src={getIngredientImage(item.ingredientId, item.name)}
                          alt=""
                          width={44}
                          height={44}
                          loading="lazy"
                          className="h-11 w-11 shrink-0 rounded-xl border border-tk-stone/70 bg-tk-sunken object-cover"
                        />
                        <span className="week-shopping-item-copy min-w-0">
                          <strong
                            className={`block truncate text-sm font-extrabold ${
                              item.checked ? 'line-through text-tk-secondary' : 'text-tk-ink'
                            }`}
                          >
                            {item.name}
                          </strong>
                          <span className="block text-xs text-tk-secondary">
                            {item.recommendedPurchaseQuantity} {item.unit} · dùng cho{' '}
                            {item.sourceRecipes.length} món
                          </span>
                          {item.cannotBuy && (
                            <span className="week-muted block text-xs font-semibold text-tk-turmeric-deep">
                              Kế hoạch ghi nhận chưa thể mua đủ.
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="week-shopping-price shrink-0 text-right text-xs font-bold text-tk-secondary tk-tabular">
                        ~{weekCurrency(item.estimatedPriceMin)} –{' '}
                        {weekCurrency(item.estimatedPriceMax)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              <BentoCard
                tone="jade"
                padding="md"
                className="week-note week-shopping-confirm space-y-3"
              >
                <p className="text-sm font-semibold text-tk-ink">
                  {shoppingMode === 'list'
                    ? 'Bạn có thể đánh dấu khi chuẩn bị danh sách hoặc trong lúc đi chợ.'
                    : `Xác nhận nhập ${checkedItems.length} nguyên liệu đã chọn. Các nguyên liệu chưa chọn sẽ không được nhập.`}
                </p>
                <div className="week-actions flex flex-wrap gap-3">
                  {shoppingMode === 'list' ? (
                    <button
                      type="button"
                      className="week-button inline-flex min-h-11 items-center justify-center rounded-2xl bg-tk-flame px-5 py-2.5 text-sm font-extrabold text-white shadow-float transition-tap hover:bg-tk-flame-hover"
                      onClick={() => setShoppingMode('active')}
                    >
                      Bắt đầu đi chợ
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="week-button inline-flex min-h-11 items-center justify-center rounded-2xl bg-tk-jade px-5 py-2.5 text-sm font-extrabold text-white shadow-jade transition-tap hover:bg-tk-jade-hover disabled:opacity-50"
                      disabled={isSubmitting || !checkedItems.length}
                      aria-busy={isSubmitting}
                      onClick={finishShopping}
                    >
                      {isSubmitting
                        ? 'Đang gửi yêu cầu nhập…'
                        : `Nhập ${checkedItems.length} nguyên liệu đã chọn vào tủ`}
                    </button>
                  )}
                  {shoppingMode === 'active' && (
                    <button
                      type="button"
                      className="week-button week-button-secondary inline-flex min-h-11 items-center justify-center rounded-2xl border border-tk-stone bg-white px-4 py-2.5 text-sm font-bold text-tk-ink transition-colors hover:bg-tk-sunken"
                      disabled={isSubmitting}
                      onClick={() => setShoppingMode('list')}
                    >
                      Về danh sách
                    </button>
                  )}
                </div>
              </BentoCard>
            </>
          )}
        </>
      )}
    </WeekWorkspace>
  );
}
