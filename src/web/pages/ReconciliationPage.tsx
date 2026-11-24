import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KitchenDetailPage } from '../components/common/KitchenDetailPage';
import { Button } from '../components/common/Button';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { api, ApiError } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { presentDomainError, provenanceLabel } from '../lib/inventory-truth';
import type { InventoryObservationView } from '../services/inventory-truth';
import { ScanLine } from 'lucide-react';
import {
  formatLocalizedMeasure,
  localizeIngredientName,
  localizeStorageZone,
  useLocaleText,
} from '../i18n/app-i18n';
import type { SupportedLocale, UnitSystem } from '../../shared/locales';

// T13 reconciliation surface. It shows what was observed, what the fridge
// currently says and which difference the server's planner found — then
// submits INTENT only. Every decision semantic stays on the server.

const VERDICT_LABEL: Record<string, readonly [string, string]> = {
  MATCH: ['Khớp với tủ lạnh', 'Matches fridge'],
  NO_ACTION: ['Không cần xử lý', 'No action needed'],
  STALE_OBSERVATION: ['Bằng chứng đã cũ', 'Observation is outdated'],
  AMBIGUOUS: ['Chưa xác định được lô', 'Matching lot unclear'],
  CONFLICT: ['Có mâu thuẫn cần bạn quyết định', 'Conflict needs your decision'],
  PROPOSE_CORRECTION: ['Đề xuất sửa số lượng', 'Suggested quantity update'],
  PROPOSE_MOVE: ['Đề xuất chuyển vị trí', 'Suggested storage move'],
  PROPOSE_EXPIRY_UPDATE: ['Đề xuất cập nhật hạn dùng', 'Suggested expiry update'],
  UNSUPPORTED: ['Chưa hỗ trợ tự động', 'Not supported automatically'],
};

const REASON_LABEL: Record<string, readonly [string, string]> = {
  QUANTITY_MISMATCH: ['Số lượng ghi nhận khác với tủ lạnh', 'Observed quantity differs from fridge'],
  STORAGE_MISMATCH: ['Vị trí bảo quản khác với tủ lạnh', 'Observed storage differs from fridge'],
  EXPIRY_MISMATCH: ['Hạn dùng khác với tủ lạnh', 'Observed expiry differs from fridge'],
  EXPIRY_EVIDENCE_UPGRADE: ['Xác nhận hạn dùng đang là ước tính', 'Confirms an estimated expiry date'],
  NO_MATCHING_LOT: ['Chưa có lô tương ứng trong tủ', 'No matching lot in your fridge'],
  MULTIPLE_CANDIDATES: ['Có nhiều lô trùng tên', 'Multiple lots share this name'],
  INCOMPATIBLE_UNIT: ['Đơn vị không quy đổi được', 'Unit cannot be converted'],
};

function claimSummary(
  observation: InventoryObservationView,
  l: (vi: string, en: string) => string,
  locale: SupportedLocale,
  unitSystem: UnitSystem,
): string {
  const claim = observation.claim as Record<string, unknown>;
  const parts: string[] = [];
  if (claim.quantity !== null && claim.quantity !== undefined) {
    if (locale === 'vi') {
      parts.push(`${claim.quantity} ${claim.unit ?? ''}`.trim());
    } else {
      const numQty = Number(claim.quantity);
      parts.push(
        Number.isFinite(numQty) && claim.unit
          ? formatLocalizedMeasure(numQty, String(claim.unit), locale, unitSystem)
          : `${claim.quantity} ${claim.unit ?? ''}`.trim(),
      );
    }
  }
  if (claim.storage) {
    const storageKey = String(claim.storage);
    parts.push(
      locale === 'vi'
        ? (({ fridge: 'Ngăn mát', freezer: 'Ngăn đông', pantry: 'Tủ đồ khô' } as Record<string, string>)[
            storageKey
          ] ?? storageKey)
        : localizeStorageZone(storageKey, locale),
    );
  }
  if (claim.expiryDate) {
    parts.push(
      claim.expiryKind === 'ESTIMATED'
        ? l(`hạn ước tính ${claim.expiryDate}`, `est. expiry ${claim.expiryDate}`)
        : l(`hạn ${claim.expiryDate}`, `expires ${claim.expiryDate}`),
    );
  }
  return parts.length > 0 ? parts.join(' · ') : l('Không có số liệu cụ thể', 'No specific values');
}

export const ReconciliationPage: React.FC = () => {
  const { l, locale, unitSystem } = useLocaleText();
  const navigate = useNavigate();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (actionError) errorRef.current?.focus();
  }, [actionError]);

  const observationsQuery = useQuery({
    queryKey: queryKeys.inventoryObservations(),
    queryFn: () => api.getInventoryObservations('OPEN'),
    retry: false,
  });

  const decide = useMutation({
    mutationFn: (input: { observation: InventoryObservationView; accept: boolean }) => {
      const { observation, accept } = input;
      if (!accept) {
        return api.decideInventoryObservation({
          observationId: observation.observationId,
          expectedObservationVersion: observation.version,
          decisionType: 'DISMISS',
        });
      }
      // The decision type follows the server's own verdict; the client never
      // invents a mutation of its own.
      const decisionType = observation.verdict === 'PROPOSE_MOVE' ? 'MOVE' : 'CORRECT';
      return api.decideInventoryObservation({
        observationId: observation.observationId,
        expectedObservationVersion: observation.version,
        decisionType,
        proposals: observation.proposals,
      });
    },
    onSuccess: async () => {
      setActionError(null);
      await invalidateInventoryDependents();
      await observationsQuery.refetch();
    },
    onError: async (error: unknown) => {
      const code = error instanceof ApiError ? error.code : null;
      const presentation = presentDomainError(
        code,
        l(
          'Chưa xử lý được mục đối chiếu. Vui lòng thử lại.',
          'Could not resolve this reconciliation item. Please try again.',
        ),
      );
      setActionError(presentation.message);
      // Stale or already-decided evidence only makes sense after a reload.
      if (presentation.refetch) await observationsQuery.refetch();
    },
  });

  const observations = observationsQuery.data ?? [];

  return (
    <KitchenDetailPage
      title={l('Đối chiếu tủ lạnh', 'Fridge Reconciliation')}
      description={l(
        'Kiểm tra ghi nhận từ hóa đơn và ảnh quét. Bạn quyết định áp dụng hay bỏ qua từng đề xuất.',
        'Review observations from receipts and scans. You decide whether to apply or dismiss each suggestion.',
      )}
    >
      {actionError && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="text-xs text-semantic-danger-strong bg-semantic-danger-soft border border-semantic-danger/30 rounded-xl px-3 py-2 font-medium"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {observationsQuery.isPending ? (
        <InlineLoading label={l('Đang tải mục cần đối chiếu…', 'Loading reconciliation items…')} />
      ) : observationsQuery.isError ? (
        <InlineError
          error={observationsQuery.error}
          onRetry={() => void observationsQuery.refetch()}
        />
      ) : observations.length === 0 ? (
        <section className="bg-white rounded-xl border border-semantic-border p-6 space-y-4">
          <img src="/takolio/vnext/mascot/pose-04-empty-fridge.webp" alt="" width={64} height={64} />
          <h2>{l('Không có mục nào cần đối chiếu', 'Nothing to reconcile')}</h2>
          <p>
            {l(
              'Khi bạn quét hóa đơn hoặc ảnh tủ lạnh, các khác biệt sẽ xuất hiện ở đây.',
              'When you scan receipts or fridge photos, any differences will appear here.',
            )}
          </p>
          <Button variant="outline" onClick={() => navigate('/fridge')}>
            {l('Về tủ lạnh', 'Back to fridge')}
          </Button>
        </section>
      ) : (
        observations.map((observation) => {
          const actionable = observation.proposals.length > 0;
          const verdictPair = VERDICT_LABEL[observation.verdict ?? ''];
          return (
            <article
              key={observation.observationId}
              data-testid="reconciliation-item"
              className="reconciliation-record bg-white rounded-xl border border-semantic-border space-y-2"
            >
              <header>
                <div className="flex items-center gap-2 min-w-0">
                  <ScanLine aria-hidden="true" className="w-4 h-4 text-semantic-action-primary shrink-0" />
                  <h2 className="font-heading font-semibold text-semantic-text-primary">
                    {observation.rawName || observation.ingredientId
                      ? localizeIngredientName(observation.ingredientId, observation.rawName, locale)
                      : l('Nguyên liệu', 'Ingredient')}
                  </h2>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-semantic-border/60 text-semantic-text-secondary font-medium shrink-0">
                  {provenanceLabel(observation.dataSource)}
                </span>
              </header>

              <dl className="text-xs space-y-1">
                <div className="flex justify-between gap-3">
                  <dt className="text-semantic-text-muted shrink-0">{l('Ghi nhận', 'Observed')}</dt>
                  <dd className="text-semantic-text-primary font-medium text-right">
                    {claimSummary(observation, l, locale, unitSystem)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-semantic-text-muted shrink-0">{l('Kết luận', 'Assessment')}</dt>
                  <dd className="text-semantic-text-primary font-medium text-right">
                    {verdictPair ? l(verdictPair[0], verdictPair[1]) : l('Đang chờ xử lý', 'Pending review')}
                  </dd>
                </div>
                {observation.reasons.length > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-semantic-text-muted shrink-0">{l('Khác biệt', 'Differences')}</dt>
                    <dd className="text-semantic-text-secondary text-right">
                      {observation.reasons
                        .map((reason) => {
                          const pair = REASON_LABEL[reason];
                          return pair ? l(pair[0], pair[1]) : reason;
                        })
                        .join('; ')}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="reconciliation-actions">
                <Button
                  fullWidth
                  size="sm"
                  disabled={!actionable || decide.isPending}
                  onClick={() => decide.mutate({ observation, accept: true })}
                >
                  {l('Áp dụng', 'Apply')}
                </Button>
                <Button
                  fullWidth
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ observation, accept: false })}
                >
                  {l('Bỏ qua', 'Dismiss')}
                </Button>
              </div>
              {!actionable && (
                <p className="text-[11px] text-semantic-text-muted">
                  {l(
                    'Mục này không có thao tác tự động an toàn; bạn có thể bỏ qua hoặc sửa trực tiếp trong tủ lạnh.',
                    'No safe automatic action is available for this item; you can dismiss it or edit the lot directly in your fridge.',
                  )}
                </p>
              )}
            </article>
          );
        })
      )}
    </KitchenDetailPage>
  );
};
