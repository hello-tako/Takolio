import { useEffect, useState } from 'react';
import type { BillingAccount, BillingHistoryPayment } from '../../../shared/billing';
import { useAuthStore } from '../../stores/useAuthStore';
import { capturePrivateSession, onPrivateSessionReset } from '../../lib/private-session';
import { billingApi } from '../../services/billing';
import { BentoCard, AtelierBadge } from '../../design-system/v4/AtelierPrimitives';
import { CrownPlusIcon, VietQRBadgeIcon } from '../../design-system/icons';
import { Button } from '../common/Button';
import { RefreshCw } from 'lucide-react';

const paymentLabels = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  failed: 'Thất bại',
  expired: 'Hết hạn',
  refunded: 'Đã hoàn tiền',
} as const;

const paymentTones = {
  pending: 'turmeric',
  paid: 'jade',
  failed: 'berry',
  expired: 'neutral',
  refunded: 'ocean',
} as const;

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

interface Props {
  refreshVersion: number;
  isBusy: boolean;
  onResume: (payment: BillingHistoryPayment, trigger: HTMLButtonElement) => void;
  onLoaded: (account: BillingAccount) => void;
  onLoading: () => void;
}

export function BillingAccountPanel({
  refreshVersion,
  isBusy,
  onResume,
  onLoaded,
  onLoading,
}: Props) {
  const userId = useAuthStore((state) => state.userId);
  const householdId = useAuthStore((state) => state.householdId);
  const isGuest = useAuthStore((state) => state.isGuest);
  const [snapshot, setSnapshot] = useState<{ owner: string; account: BillingAccount } | null>(null);
  const owner = `${userId}:${householdId}`;
  const account = snapshot?.owner === owner ? snapshot.account : null;
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setSnapshot(null);
    setPending(true);
    onLoading();
    setError(false);
    if (isGuest || !userId || !householdId) return;
    const isCurrent = capturePrivateSession();
    let active = true;
    const valid = () =>
      active &&
      isCurrent() &&
      useAuthStore.getState().userId === userId &&
      useAuthStore.getState().householdId === householdId &&
      !useAuthStore.getState().isGuest;
    const unsubscribe = onPrivateSessionReset(() => {
      active = false;
      setSnapshot(null);
      setPending(true);
      onLoading();
    });
    void billingApi
      .getAccount()
      .then((result) => {
        if (!valid()) return;
        setSnapshot({ owner, account: result });
        onLoaded(result);
      })
      .catch(() => {
        if (valid()) setError(true);
      })
      .finally(() => {
        if (valid()) setPending(false);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, householdId, isGuest, refreshVersion, reload, onLoaded, onLoading, owner]);

  if (isGuest || !userId) return null;

  return (
    <div className="space-y-4">
      <BentoCard tone="ceramic" padding="md" role="region" aria-labelledby="billing-account-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-tk-turmeric-soft border border-tk-turmeric/25 flex items-center justify-center shrink-0">
              <CrownPlusIcon size={20} tone="turmeric" active />
            </span>
            <h2 id="billing-account-heading" className="font-heading text-base font-extrabold text-tk-ink">
              Gói của bạn
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || isBusy}
            onClick={() => setReload((value) => value + 1)}
          >
            <RefreshCw size={14} className="mr-1.5" aria-hidden="true" />
            {pending ? 'Đang tải…' : 'Cập nhật trạng thái'}
          </Button>
        </div>

        {pending ? (
          <p role="status" className="mt-4 text-sm text-tk-secondary">
            Đang tải gói và lịch sử thanh toán…
          </p>
        ) : error ? (
          <p
            role="alert"
            className="mt-4 rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-3.5 py-2.5 text-sm font-semibold text-tk-berry-deep"
          >
            Chưa tải được thông tin gói. Bấm cập nhật để thử lại.
          </p>
        ) : (
          account && (
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-2xl bg-tk-sunken/70 p-3.5 border border-tk-stone/70">
                <dt className="text-xs font-bold uppercase tracking-wide text-tk-muted">Gói hiện tại</dt>
                <dd className="mt-1 font-extrabold text-tk-ink">
                  {account.subscription.plan === 'plus' ? 'Takolio Plus' : 'Takolio Miễn phí'}
                </dd>
              </div>
              <div className="rounded-2xl bg-tk-sunken/70 p-3.5 border border-tk-stone/70">
                <dt className="text-xs font-bold uppercase tracking-wide text-tk-muted">Trạng thái</dt>
                <dd className="mt-1 font-extrabold text-tk-ink">
                  {account.subscription.status === 'active'
                    ? 'Đang hoạt động'
                    : account.subscription.status === 'expired'
                      ? 'Plus đã hết hạn'
                      : 'Chưa có gói Plus hoạt động'}
                </dd>
              </div>
              <div className="sm:col-span-2 rounded-2xl bg-tk-sunken/70 p-3.5 border border-tk-stone/70">
                <dt className="text-xs font-bold uppercase tracking-wide text-tk-muted">
                  Hạn sử dụng Plus
                </dt>
                <dd className="mt-1 font-semibold text-tk-ink">
                  {account.subscription.expiresAt ? (
                    <time dateTime={account.subscription.expiresAt}>
                      {dateLabel(account.subscription.expiresAt)}
                    </time>
                  ) : (
                    'Chưa có hạn sử dụng Plus'
                  )}
                </dd>
              </div>
            </dl>
          )
        )}
        <p className="mt-4 text-xs leading-relaxed text-tk-muted">
          Gia hạn bằng cách chọn gói bên dưới. Takolio Plus còn hạn sẽ được cộng thêm thời gian sau
          khi nhận tiền; hệ thống thanh toán VietQR một lần, không tự động trừ tiền định kỳ.
        </p>
      </BentoCard>

      {account && !pending && !error && (
        <BentoCard
          tone="ceramic"
          padding="md"
          role="region"
          aria-labelledby="billing-history-heading"
        >
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-tk-sunken border border-tk-stone flex items-center justify-center shrink-0">
              <VietQRBadgeIcon size={18} tone="jade" active />
            </span>
            <div>
              <h2
                id="billing-history-heading"
                className="font-heading text-base font-extrabold text-tk-ink"
              >
                Lịch sử giao dịch
              </h2>
              <p className="text-xs text-tk-muted mt-0.5">
                {account.hasMore ? '20 giao dịch gần nhất.' : 'Các lệnh thanh toán của tài khoản này.'}{' '}
                Đóng ứng dụng không hủy lệnh đang chờ.
              </p>
            </div>
          </div>

          {!account.payments.length ? (
            <p className="mt-4 text-sm text-tk-secondary">Chưa có giao dịch.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {account.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="rounded-2xl border border-tk-stone bg-tk-canvas/60 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-extrabold text-sm text-tk-ink">
                        {payment.plan === 'annual' ? 'Gói 1 Năm Takolio Plus' : 'Gói 1 Tháng Takolio Plus'}
                      </h3>
                      <p className="mt-0.5 text-sm font-bold text-tk-flame tk-tabular">
                        {payment.amountVnd.toLocaleString('vi-VN')} {payment.currency}
                      </p>
                    </div>
                    <AtelierBadge tone={paymentTones[payment.status]}>
                      {paymentLabels[payment.status]}
                    </AtelierBadge>
                  </div>
                  <p className="mt-2 break-all text-xs text-tk-secondary tk-tabular">
                    Mã đơn: <span className="font-semibold">{payment.orderCode}</span>
                  </p>
                  <p className="mt-1 text-xs text-tk-muted">
                    Tạo lúc <time dateTime={payment.createdAt}>{dateLabel(payment.createdAt)}</time>
                  </p>
                  {payment.status === 'pending' && (
                    <p className="mt-1 text-xs text-tk-muted">
                      Hết hạn <time dateTime={payment.expiresAt}>{dateLabel(payment.expiresAt)}</time>
                    </p>
                  )}
                  {payment.status === 'paid' ? null : payment.checkoutState === 'remote_uncertain' ? (
                    <p className="mt-3 text-xs font-semibold text-tk-turmeric-deep">
                      Đang chờ đối soát. Không chuyển tiền thêm hoặc tạo lệnh thay thế.
                    </p>
                  ) : payment.checkoutState === 'dispatching' ? (
                    <p className="mt-3 text-xs text-tk-secondary">
                      Lệnh đang được xử lý. Cập nhật trạng thái trước khi tạo lệnh mới.
                    </p>
                  ) : payment.canResume ? (
                    <Button
                      className="mt-3"
                      size="sm"
                      disabled={isBusy}
                      onClick={(event) => onResume(payment, event.currentTarget)}
                    >
                      Mở lại mã QR
                    </Button>
                  ) : payment.status === 'pending' ? (
                    <p className="mt-3 text-xs text-tk-secondary">
                      QR của lệnh cũ chưa được lưu để mở lại. Nếu chưa chuyển tiền, đợi lệnh hết hạn
                      trước khi tạo lệnh mới.
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </BentoCard>
      )}
    </div>
  );
}
