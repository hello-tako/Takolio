import { useEffect, useState } from 'react';
import type { BillingAccount, BillingHistoryPayment } from '../../../shared/billing';
import { useAuthStore } from '../../stores/useAuthStore';
import { capturePrivateSession, onPrivateSessionReset } from '../../lib/private-session';
import { billingApi } from '../../services/billing';
import { Button } from '../common/Button';

const paymentLabels = {
  pending: 'Chờ thanh toán', paid: 'Đã thanh toán', failed: 'Thất bại',
  expired: 'Hết hạn', refunded: 'Đã hoàn tiền',
};

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

interface Props {
  refreshVersion: number;
  isBusy: boolean;
  onResume: (payment: BillingHistoryPayment, trigger: HTMLButtonElement) => void;
  onLoaded: (account: BillingAccount) => void;
  onLoading: () => void;
}

export function BillingAccountPanel({ refreshVersion, isBusy, onResume, onLoaded, onLoading }: Props) {
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
    const valid = () => active && isCurrent() && useAuthStore.getState().userId === userId &&
      useAuthStore.getState().householdId === householdId && !useAuthStore.getState().isGuest;
    const unsubscribe = onPrivateSessionReset(() => { active = false; setSnapshot(null); setPending(true); onLoading(); });
    void billingApi.getAccount().then((result) => {
      if (!valid()) return;
      setSnapshot({ owner, account: result });
      onLoaded(result);
    }).catch(() => { if (valid()) setError(true); })
      .finally(() => { if (valid()) setPending(false); });
    return () => { active = false; unsubscribe(); };
  }, [userId, householdId, isGuest, refreshVersion, reload, onLoaded, onLoading, owner]);

  if (isGuest || !userId) return null;
  return (
    <div className="space-y-5">
      <section aria-labelledby="billing-account-heading" className="rounded-xl border border-semantic-border bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="billing-account-heading" className="font-heading text-lg font-bold">Gói của bạn</h2>
          <Button variant="outline" disabled={pending || isBusy} onClick={() => setReload((value) => value + 1)}>
            {pending ? 'Đang tải…' : 'Cập nhật trạng thái'}
          </Button>
        </div>
        {pending ? <p role="status" className="mt-3 text-sm">Đang tải gói và lịch sử thanh toán…</p>
          : error ? <p role="alert" className="mt-3 text-sm text-semantic-danger-strong">Chưa tải được thông tin gói. Bấm cập nhật để thử lại.</p>
            : account && (
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-semantic-text-secondary">Gói hiện tại</dt><dd className="mt-1 font-semibold">{account.subscription.plan === 'plus' ? 'Takosan Plus' : 'Takosan miễn phí'}</dd></div>
                <div><dt className="text-semantic-text-secondary">Trạng thái</dt><dd className="mt-1 font-semibold">{account.subscription.status === 'active' ? 'Đang hoạt động' : account.subscription.status === 'expired' ? 'Plus đã hết hạn' : 'Chưa có gói Plus hoạt động'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-semantic-text-secondary">Hạn sử dụng Plus</dt><dd className="mt-1">{account.subscription.expiresAt ? <time dateTime={account.subscription.expiresAt}>{dateLabel(account.subscription.expiresAt)}</time> : 'Chưa có hạn sử dụng Plus'}</dd></div>
              </dl>
            )}
        <p className="mt-4 text-xs leading-relaxed text-semantic-text-secondary">Gia hạn bằng cách chọn gói bên dưới. Plus còn hạn sẽ được cộng thêm thời gian sau khi nhận tiền; không tự động trừ tiền.</p>
      </section>
      {account && !pending && !error && (
        <section aria-labelledby="billing-history-heading" className="rounded-xl border border-semantic-border bg-white p-5 shadow-xs">
          <h2 id="billing-history-heading" className="font-heading text-lg font-bold">Lịch sử giao dịch</h2>
          <p className="mt-2 text-xs text-semantic-text-secondary">{account.hasMore ? '20 giao dịch gần nhất.' : 'Các lệnh thanh toán của tài khoản này.'} Đóng ứng dụng không hủy lệnh đang chờ.</p>
          {!account.payments.length ? <p className="mt-4 text-sm text-semantic-text-secondary">Chưa có giao dịch.</p> : (
            <ol className="mt-4 space-y-3">
              {account.payments.map((payment) => (
                <li key={payment.id} className="rounded-xl border border-semantic-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-semibold">{payment.plan === 'annual' ? 'Gói 1 Năm' : 'Gói 1 Tháng'}</h3><p className="mt-1 text-sm">{payment.amountVnd.toLocaleString('vi-VN')} {payment.currency}</p></div>
                    <span className="text-sm font-semibold">{paymentLabels[payment.status]}</span>
                  </div>
                  <p className="mt-2 break-all text-xs text-semantic-text-secondary">Mã đơn: {payment.orderCode}</p>
                  <p className="mt-1 text-xs text-semantic-text-secondary">Tạo lúc <time dateTime={payment.createdAt}>{dateLabel(payment.createdAt)}</time></p>
                  {payment.status === 'pending' && <p className="mt-1 text-xs text-semantic-text-secondary">Hết hạn <time dateTime={payment.expiresAt}>{dateLabel(payment.expiresAt)}</time></p>}
                  {payment.status === 'paid' ? null : payment.checkoutState === 'remote_uncertain' ? <p className="mt-3 text-sm text-semantic-warning-strong">Đang chờ đối soát. Không chuyển tiền thêm hoặc tạo lệnh thay thế.</p>
                    : payment.checkoutState === 'dispatching' ? <p className="mt-3 text-sm text-semantic-text-secondary">Lệnh đang được xử lý. Cập nhật trạng thái trước khi tạo lệnh mới.</p>
                      : payment.canResume ? <Button className="mt-3" disabled={isBusy} onClick={(event) => onResume(payment, event.currentTarget)}>Mở lại mã QR</Button>
                        : payment.status === 'pending' ? <p className="mt-3 text-sm text-semantic-text-secondary">QR của lệnh cũ chưa được lưu để mở lại. Nếu chưa chuyển tiền, đợi lệnh hết hạn trước khi tạo lệnh mới.</p> : null}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
