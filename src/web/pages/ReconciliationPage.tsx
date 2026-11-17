import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { clsx } from 'clsx';
import { KitchenDetailPage } from '../components/common/KitchenDetailPage';
import { Button } from '../components/common/Button';
import { InlineLoading, InlineError } from '../components/common/AsyncState';
import { TakoChef3D } from '../components/3d';
import { AtelierBadge } from '../design-system/v4/AtelierPrimitives';
import { FreshnessShieldIcon } from '../design-system/icons';
import { api, ApiError } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { presentDomainError, provenanceLabel } from '../lib/inventory-truth';
import type { InventoryObservationView } from '../services/inventory-truth';

const VERDICT_LABEL: Record<string, string> = {
  MATCH: 'Khớp với tủ lạnh',
  NO_ACTION: 'Không cần xử lý',
  STALE_OBSERVATION: 'Bằng chứng đã cũ',
  AMBIGUOUS: 'Chưa xác định được lô',
  CONFLICT: 'Có mâu thuẫn cần bạn quyết định',
  PROPOSE_CORRECTION: 'Đề xuất sửa số lượng',
  PROPOSE_MOVE: 'Đề xuất chuyển vị trí',
  PROPOSE_EXPIRY_UPDATE: 'Đề xuất cập nhật hạn dùng',
  UNSUPPORTED: 'Chưa hỗ trợ tự động',
};

const REASON_LABEL: Record<string, string> = {
  QUANTITY_MISMATCH: 'Số lượng ghi nhận khác với tủ lạnh',
  STORAGE_MISMATCH: 'Vị trí bảo quản khác với tủ lạnh',
  EXPIRY_MISMATCH: 'Hạn dùng khác với tủ lạnh',
  EXPIRY_EVIDENCE_UPGRADE: 'Xác nhận hạn dùng đang là ước tính',
  NO_MATCHING_LOT: 'Chưa có lô tương ứng trong tủ',
  MULTIPLE_CANDIDATES: 'Có nhiều lô trùng tên',
  INCOMPATIBLE_UNIT: 'Đơn vị không quy đổi được',
};

function claimSummary(observation: InventoryObservationView): string {
  const claim = observation.claim as Record<string, unknown>;
  const parts: string[] = [];
  if (claim.quantity !== null && claim.quantity !== undefined) {
    parts.push(`${claim.quantity} ${claim.unit ?? ''}`.trim());
  }
  if (claim.storage) {
    parts.push(
      ({ fridge: 'Ngăn mát', freezer: 'Ngăn đông', pantry: 'Tủ đồ khô' } as Record<string, string>)[
        String(claim.storage)
      ] ?? String(claim.storage),
    );
  }
  if (claim.expiryDate) {
    parts.push(
      claim.expiryKind === 'ESTIMATED'
        ? `hạn ước tính ${claim.expiryDate}`
        : `hạn ${claim.expiryDate}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'Không có số liệu cụ thể';
}

export const ReconciliationPage: React.FC = () => {
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
        'Chưa xử lý được mục đối chiếu. Vui lòng thử lại.',
      );
      setActionError(presentation.message);
      if (presentation.refetch) await observationsQuery.refetch();
    },
  });

  const observations = observationsQuery.data ?? [];

  return (
    <KitchenDetailPage
      title="Đối chiếu tủ lạnh"
      description="Kiểm tra ghi nhận thực tế từ hóa đơn và ảnh quét AI. Bạn quyết định áp dụng hay bỏ qua từng đề xuất."
    >
      {actionError && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="rounded-2xl border border-tk-berry/30 bg-tk-berry-soft px-4 py-3 text-xs font-semibold text-tk-berry-deep"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {observationsQuery.isPending ? (
        <InlineLoading label="Đang tải mục cần đối chiếu…" />
      ) : observationsQuery.isError ? (
        <InlineError
          error={observationsQuery.error}
          onRetry={() => void observationsQuery.refetch()}
        />
      ) : observations.length === 0 ? (
        <section className="rounded-[28px] border border-tk-stone/85 bg-white p-8 text-center shadow-card space-y-4">
          <div className="flex justify-center">
            <TakoChef3D pose="nod" size={112} interactive={false} />
          </div>
          <div className="space-y-1.5">
            <AtelierBadge tone="jade" icon={<FreshnessShieldIcon size={13} tone="jade" active />}>
              Đồng bộ chuẩn xác
            </AtelierBadge>
            <h2 className="font-heading text-xl font-extrabold text-tk-ink">
              Không có mục nào cần đối chiếu
            </h2>
            <p className="text-sm text-tk-secondary max-w-md mx-auto">
              Khi bạn quét hóa đơn siêu thị hoặc ảnh tủ lạnh, các khác biệt về số lượng, vị trí và
              hạn dùng sẽ xuất hiện ở đây để bạn phê duyệt.
            </p>
          </div>
          <div>
            <Button variant="outline" onClick={() => navigate('/fridge')}>
              Về tủ lạnh
            </Button>
          </div>
        </section>
      ) : (
        observations.map((observation) => {
          const actionable = observation.proposals.length > 0;
          return (
            <article
              key={observation.observationId}
              data-testid="reconciliation-item"
              className={clsx(
                'reconciliation-record rounded-[24px] border border-tk-stone/85 !border-t-4 bg-white p-5 shadow-card space-y-3',
                actionable ? '!border-t-tk-jade' : '!border-t-tk-turmeric',
              )}
            >
              <header>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-tk-jade-soft text-tk-jade">
                    <ScanLine aria-hidden="true" className="w-4 h-4" />
                  </span>
                  <h2 className="font-heading font-extrabold text-tk-ink">
                    {observation.rawName ?? observation.ingredientId ?? 'Nguyên liệu'}
                  </h2>
                </div>
                <AtelierBadge tone="neutral" className="shrink-0">
                  {provenanceLabel(observation.dataSource)}
                </AtelierBadge>
              </header>

              <dl className="text-xs space-y-1 rounded-2xl bg-tk-sunken/60 p-3.5 border border-tk-stone/60">
                <div className="flex justify-between gap-3">
                  <dt className="text-tk-muted shrink-0">Ghi nhận mới</dt>
                  <dd className="text-tk-ink font-bold text-right tk-tabular">
                    {claimSummary(observation)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-tk-muted shrink-0">Kết luận hệ thống</dt>
                  <dd className="text-tk-ink font-bold text-right">
                    {VERDICT_LABEL[observation.verdict ?? ''] ?? 'Đang chờ xử lý'}
                  </dd>
                </div>
                {observation.reasons.length > 0 && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-tk-muted shrink-0">Điểm khác biệt</dt>
                    <dd className="text-tk-secondary font-medium text-right">
                      {observation.reasons
                        .map((reason) => REASON_LABEL[reason] ?? reason)
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
                  Áp dụng
                </Button>
                <Button
                  fullWidth
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() => decide.mutate({ observation, accept: false })}
                >
                  Bỏ qua
                </Button>
              </div>

              {!actionable && (
                <p className="text-xs text-tk-muted">
                  Mục này không có thao tác tự động an toàn; bạn có thể bỏ qua hoặc sửa trực tiếp
                  trong tủ lạnh.
                </p>
              )}
            </article>
          );
        })
      )}
    </KitchenDetailPage>
  );
};
