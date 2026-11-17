import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  LogIn,
  Share2,
  UserMinus,
  LogOut,
  Plus,
  Clock,
  Sparkles,
} from 'lucide-react';
import { AccountPage } from '../components/common/AccountPage';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../design-system/v4/AtelierPrimitives';
import {
  HouseholdTrayIcon,
  ShareFamilyLinkIcon,
  FreshnessShieldIcon,
} from '../design-system/icons';
import {
  householdsApi,
  type HouseholdInviteDto,
  type HouseholdMemberDto,
} from '../services/households';
import { ApiError } from '../services/http';
import { useAuthStore } from '../stores/useAuthStore';
import { invalidateInventoryDependents } from '../lib/query-invalidation';
import { queryKeys } from '../lib/queryKeys';

function formatInviteCountdown(expiresAt: string, nowMs: number): string {
  const diffMs = Date.parse(expiresAt) - nowMs;
  if (!Number.isFinite(diffMs) || diffMs <= 0) return 'Đã hết hạn';
  const totalHours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days >= 1) {
    return `Còn ${days} ngày ${hours > 0 ? `${hours} giờ` : ''}`.trim();
  }
  const minutes = Math.max(1, Math.floor((diffMs % 3_600_000) / 60_000));
  return totalHours > 0 ? `Còn ${totalHours} giờ ${minutes} phút` : `Còn ${minutes} phút`;
}

function normalizeInviteInput(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (cleaned.length === 8 && !cleaned.includes('-') && cleaned.startsWith('TAKO')) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return cleaned.slice(0, 12);
}

export const FamilySharingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { userId, householdId, displayName, email, avatarUrl, isGuest, isOnboarded } =
    useAuthStore();
  const [joinCode, setJoinCode] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<HouseholdMemberDto | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!copiedCode) return;
    const timer = window.setTimeout(() => setCopiedCode(null), 2_200);
    return () => window.clearTimeout(timer);
  }, [copiedCode]);

  const householdQueryKey = useMemo(
    () => ['household', userId, householdId] as const,
    [userId, householdId],
  );

  const householdQuery = useQuery({
    queryKey: householdQueryKey,
    queryFn: () => householdsApi.getCurrentHousehold(),
    enabled: !isGuest && Boolean(userId && householdId),
  });

  const syncNewHouseholdScope = async (nextHouseholdId: string) => {
    if (nextHouseholdId && userId) {
      useAuthStore.getState().setAuthSession({
        id: userId,
        email,
        displayName: displayName || 'Thành viên Takolio',
        avatarUrl,
        householdId: nextHouseholdId,
        onboardingCompleted: isOnboarded,
      });
      void useAuthStore.getState().syncPlusFromServer();
    }
    await Promise.all([
      invalidateInventoryDependents(),
      queryClient.invalidateQueries({ queryKey: queryKeys.shoppingList() }),
      queryClient.invalidateQueries({ queryKey: ['household'] }),
    ]);
  };

  const createInviteMutation = useMutation({
    mutationFn: () => householdsApi.createInvite({ maxUses: 5, expiresInDays: 7 }),
    onMutate: () => {
      setActionError(null);
      setStatusBanner(null);
      setShareFeedback(null);
    },
    onSuccess: async (res) => {
      setStatusBanner(`Đã tạo mã mời mới: ${res.invite.inviteCode}`);
      await queryClient.invalidateQueries({ queryKey: householdQueryKey });
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError && err.status === 403
          ? 'Chỉ Chủ bếp mới có thể tạo mã mời thành viên mới.'
          : 'Chưa tạo được mã mời. Vui lòng kiểm tra kết nối và thử lại.',
      );
    },
  });

  const joinMutation = useMutation({
    mutationFn: (code: string) => householdsApi.joinHousehold(code),
    onMutate: () => {
      setActionError(null);
      setStatusBanner(null);
    },
    onSuccess: async (res) => {
      const nextId = res.household?.id ?? res.householdId;
      setJoinCode('');
      await syncNewHouseholdScope(nextId);
      setStatusBanner(
        res.alreadyMember
          ? `Bạn đã là thành viên của "${res.householdName}".`
          : `Chào mừng bạn đến với "${res.householdName}"! Tủ lạnh, đi chợ và thực đơn đã đồng bộ chung.`,
      );
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 404) {
        setActionError('Mã mời không tồn tại hoặc đã nhập sai. Hãy kiểm tra lại mã TAKO-XXXX.');
      } else if (err instanceof ApiError && (err.status === 410 || err.status === 409)) {
        setActionError('Mã mời này đã hết hạn hoặc đã dùng hết lượt cho phép.');
      } else {
        setActionError('Chưa thể tham gia bếp gia đình. Vui lòng kiểm tra kết nối và thử lại.');
      }
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (targetUserId: string) => householdsApi.removeMember(targetUserId),
    onMutate: () => {
      setActionError(null);
      setStatusBanner(null);
    },
    onSuccess: async (res, targetUserId) => {
      setPendingRemoval(null);
      const nextId = res.activeHouseholdId ?? res.householdId;
      if (targetUserId === userId && nextId) {
        await syncNewHouseholdScope(nextId);
        setStatusBanner('Bạn đã rời bếp chung và quay về không gian bếp cá nhân.');
      } else {
        await queryClient.invalidateQueries({ queryKey: householdQueryKey });
        setStatusBanner('Đã cập nhật danh sách thành viên của bếp gia đình.');
      }
    },
    onError: () => {
      setPendingRemoval(null);
      setActionError('Chưa thể cập nhật thành viên lúc này. Vui lòng thử lại.');
    },
  });

  const handleCopyCode = async (code: string) => {
    setShareFeedback(null);
    try {
      await navigator.clipboard?.writeText(code);
      setCopiedCode(code);
    } catch {
      setShareFeedback(`Hãy sao chép thủ công mã: ${code}`);
    }
  };

  const handleShareInvite = async (invite: HouseholdInviteDto, householdName: string) => {
    setShareFeedback(null);
    const shareUrl = `${window.location.origin}/me/household?invite=${encodeURIComponent(invite.inviteCode)}`;
    const shareText = `Cùng dùng chung tủ lạnh, thực đơn Mâm Cơm & danh sách đi chợ tại "${householdName}" trên Takolio! Nhập mã mời: ${invite.inviteCode}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Lời mời vào bếp "${householdName}" · Takolio`,
          text: shareText,
          url: shareUrl,
        });
        setShareFeedback('Đã mở bảng chia sẻ lời mời gia đình.');
        return;
      } catch (err) {
        if ((err instanceof Error || err instanceof DOMException) && err.name === 'AbortError') {
          return;
        }
      }
    }
    try {
      await navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`);
      setCopiedCode(invite.inviteCode);
      setShareFeedback('Đã sao chép lời mời và liên kết tham gia bếp.');
    } catch {
      setShareFeedback(`Mã tham gia của bạn: ${invite.inviteCode}`);
    }
  };

  if (isGuest) {
    return (
      <AccountPage
        title="Hộ gia đình & chia sẻ"
        description="Cùng quản lý Tủ lạnh, Đi chợ và Thực đơn Mâm Cơm theo thời gian thực."
      >
        <BentoCard tone="jade" padding="lg" className="space-y-4">
          <div className="flex items-start gap-3.5">
            <span className="w-12 h-12 rounded-2xl bg-white border border-tk-jade/20 flex items-center justify-center shrink-0 shadow-xs">
              <ShareFamilyLinkIcon size={26} tone="jade" active />
            </span>
            <div className="min-w-0">
              <AtelierBadge tone="jade">Miễn phí cho mọi gia đình</AtelierBadge>
              <h2 className="font-heading font-extrabold text-xl text-tk-ink mt-2">
                Đăng nhập để mở Bếp Chung Gia Đình
              </h2>
              <p className="text-sm text-tk-secondary leading-relaxed mt-1.5">
                Tạo mã mời <strong>TAKO-XXXX</strong> để vợ chồng, ông bà hoặc bạn cùng nhà cùng xem
                tủ lạnh FEFO, tích chọn danh sách đi chợ siêu thị và lên thực đơn 7 ngày. Nguyên
                liệu phiên khách hiện tại của bạn sẽ được giữ nguyên khi đăng nhập!
              </p>
            </div>
          </div>
          <ActionButton
            variant="flame"
            size="lg"
            fullWidth
            to="/auth?mode=login&returnTo=%2Fme%2Fhousehold"
            icon={<LogIn size={18} aria-hidden="true" />}
          >
            Đăng nhập / Tạo tài khoản miễn phí
          </ActionButton>
        </BentoCard>
      </AccountPage>
    );
  }

  const data = householdQuery.data;
  const activeInvites = (data?.invites ?? []).filter(
    (inv) => Date.parse(inv.expiresAt) > nowMs && inv.usedCount < inv.maxUses,
  );
  const latestInvite = activeInvites[0] ?? null;
  const isOwner = data?.household.myRole === 'owner';

  return (
    <AccountPage
      title="Hộ gia đình & chia sẻ"
      description="Một căn bếp chung đồng bộ tức thì Tủ lạnh, Thực đơn Mâm Cơm và Đi chợ."
    >
      <div className="space-y-4 pb-8 min-w-0">
        {statusBanner && (
          <div
            role="status"
            className="rounded-2xl border border-tk-jade/30 bg-tk-jade-soft px-4 py-3 text-sm font-bold text-tk-jade-deep flex items-center gap-2"
          >
            <FreshnessShieldIcon size={18} tone="jade" active />
            <span>{statusBanner}</span>
          </div>
        )}

        {actionError && (
          <p
            role="alert"
            className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
          >
            {actionError}
          </p>
        )}

        {householdQuery.isPending ? (
          <InlineLoading label="Đang tải thông tin bếp gia đình…" />
        ) : householdQuery.isError ? (
          <InlineError
            error={householdQuery.error}
            onRetry={() => void householdQuery.refetch()}
          />
        ) : (
          data && (
            <>
              {/* 1. Current Household & Members Card */}
              <BentoCard tone="jade" padding="md" className="space-y-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-12 h-12 rounded-2xl bg-white border border-tk-jade/20 flex items-center justify-center shrink-0 shadow-xs">
                      <HouseholdTrayIcon size={24} tone="jade" active />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-tk-jade-deep">
                        KHÔNG GIAN BẾP HIỆN TẠI
                      </p>
                      <h2 className="text-lg font-heading font-extrabold text-tk-ink truncate">
                        {data.household.name || 'Bếp nhà mình'}
                      </h2>
                      <p className="text-xs text-tk-secondary tk-tabular mt-0.5">
                        {data.members.length} thành viên đang kết nối
                      </p>
                    </div>
                  </div>
                  <AtelierBadge tone={isOwner ? 'flame' : 'jade'}>
                    {isOwner ? 'Chủ bếp' : 'Thành viên'}
                  </AtelierBadge>
                </div>

                <div className="space-y-2.5 pt-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-tk-secondary">
                    Thành viên trong bếp ({data.members.length})
                  </h3>
                  <ul className="divide-y divide-tk-stone/70 rounded-2xl border border-tk-stone/80 bg-white overflow-hidden">
                    {data.members.map((member) => {
                      const isMe = member.userId === userId;
                      const initial = (member.displayName || 'T').charAt(0).toUpperCase();
                      const canRemove =
                        (isOwner && !isMe) || (isMe && data.members.length > 1 && !isOwner);
                      const canOwnerLeave = isMe && isOwner && data.members.length > 1;
                      return (
                        <li
                          key={member.userId}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt=""
                                width={40}
                                height={40}
                                className="w-10 h-10 rounded-full object-cover border border-tk-stone shrink-0"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="w-10 h-10 rounded-full bg-tk-flame-soft text-tk-flame-deep font-extrabold text-sm flex items-center justify-center shrink-0 border border-tk-flame/20"
                              >
                                {initial}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-tk-ink truncate">
                                  {member.displayName || 'Thành viên'}
                                  {isMe ? ' (Bạn)' : ''}
                                </span>
                                <AtelierBadge
                                  tone={member.role === 'owner' ? 'turmeric' : 'neutral'}
                                >
                                  {member.role === 'owner' ? 'Chủ bếp' : 'Thành viên'}
                                </AtelierBadge>
                              </div>
                              {member.email && (
                                <p className="text-xs text-tk-muted truncate mt-0.5">
                                  {member.email}
                                </p>
                              )}
                            </div>
                          </div>

                          {(canRemove || canOwnerLeave) && (
                            <ActionButton
                              variant="ghost"
                              size="sm"
                              disabled={removeMemberMutation.isPending}
                              aria-label={
                                isMe
                                  ? 'Rời bếp gia đình'
                                  : `Mời ${member.displayName} rời bếp`
                              }
                              onClick={() => setPendingRemoval(member)}
                              icon={
                                isMe ? (
                                  <LogOut size={14} aria-hidden="true" />
                                ) : (
                                  <UserMinus size={14} aria-hidden="true" />
                                )
                              }
                            >
                              {isMe ? 'Rời bếp' : 'Xóa'}
                            </ActionButton>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </BentoCard>

              {/* 2. Generate Invite Code Card */}
              <BentoCard tone="flame" padding="md" className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-10 h-10 rounded-2xl bg-white border border-tk-flame/20 flex items-center justify-center shrink-0 shadow-xs">
                      <ShareFamilyLinkIcon size={20} tone="flame" active />
                    </span>
                    <div>
                      <h2 className="font-heading font-extrabold text-base text-tk-ink">
                        Mời người thân vào bếp
                      </h2>
                      <p className="text-xs text-tk-secondary mt-0.5">
                        Tạo mã mời 8 ký tự <strong>TAKO-XXXX</strong> có hiệu lực 7 ngày.
                      </p>
                    </div>
                  </div>
                  <ActionButton
                    variant={latestInvite ? 'ceramic' : 'flame'}
                    size="sm"
                    loading={createInviteMutation.isPending}
                    disabled={!isOwner}
                    icon={<Plus size={15} aria-hidden="true" />}
                    onClick={() => createInviteMutation.mutate()}
                  >
                    {latestInvite ? 'Tạo mã mới' : 'Tạo mã mời'}
                  </ActionButton>
                </div>

                {!isOwner && !latestInvite && (
                  <p className="text-xs text-tk-muted bg-white/80 rounded-2xl px-3.5 py-2.5 border border-tk-stone/70">
                    Chủ bếp có thể tạo mã mời mới để gửi cho các thành viên khác trong gia đình.
                  </p>
                )}

                {latestInvite && (
                  <div className="rounded-2xl border border-tk-flame/25 bg-white p-4 space-y-3 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-tk-muted">
                        Mã mời đang hoạt động
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-tk-turmeric-deep tk-tabular">
                        <Clock size={13} aria-hidden="true" />
                        {formatInviteCountdown(latestInvite.expiresAt, nowMs)} · Đã dùng{' '}
                        {latestInvite.usedCount}/{latestInvite.maxUses}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-tk-sunken/80 px-4 py-3 border border-tk-stone">
                      <code className="font-mono text-xl sm:text-2xl font-extrabold tracking-widest text-tk-ink select-all">
                        {latestInvite.inviteCode}
                      </code>
                      <AtelierBadge tone="jade">TAKO-8</AtelierBadge>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <ActionButton
                        variant="ceramic"
                        size="md"
                        icon={
                          copiedCode === latestInvite.inviteCode ? (
                            <Check size={16} className="text-tk-jade" aria-hidden="true" />
                          ) : (
                            <Copy size={16} aria-hidden="true" />
                          )
                        }
                        onClick={() => void handleCopyCode(latestInvite.inviteCode)}
                      >
                        {copiedCode === latestInvite.inviteCode ? 'Đã sao chép!' : 'Sao chép mã'}
                      </ActionButton>
                      <ActionButton
                        variant="flame"
                        size="md"
                        icon={<Share2 size={16} aria-hidden="true" />}
                        onClick={() =>
                          void handleShareInvite(
                            latestInvite,
                            data.household.name || 'Bếp gia đình',
                          )
                        }
                      >
                        Chia sẻ liên kết
                      </ActionButton>
                    </div>

                    {shareFeedback && (
                      <p role="status" className="text-xs font-semibold text-tk-jade-deep">
                        {shareFeedback}
                      </p>
                    )}
                  </div>
                )}
              </BentoCard>

              {/* 3. Join Family Kitchen Card */}
              <BentoCard tone="ceramic" padding="md" className="space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-2xl bg-tk-sunken border border-tk-stone flex items-center justify-center shrink-0">
                    <Sparkles size={18} className="text-tk-jade" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-heading font-extrabold text-base text-tk-ink">
                      Tham gia bếp gia đình khác
                    </h2>
                    <p className="text-xs text-tk-secondary mt-0.5">
                      Nhập mã <strong>TAKO-XXXX</strong> từ người thân để chuyển sang dùng chung tủ
                      lạnh &amp; danh sách đi chợ.
                    </p>
                  </div>
                </div>

                <form
                  className="flex flex-col sm:flex-row gap-2.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const trimmed = joinCode.trim().toUpperCase();
                    if (!trimmed || joinMutation.isPending) return;
                    joinMutation.mutate(trimmed);
                  }}
                >
                  <label className="flex-1">
                    <span className="sr-only">Mã mời bếp gia đình</span>
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(normalizeInviteInput(e.target.value))}
                      placeholder="Nhập mã mời (VD: TAKO-8F2K)"
                      maxLength={12}
                      autoComplete="off"
                      className="w-full min-h-[46px] rounded-2xl border border-tk-stone bg-tk-canvas px-4 py-2.5 font-mono text-sm font-bold uppercase tracking-wider text-tk-ink placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-tk-muted focus:outline-none focus:ring-2 focus:ring-tk-flame"
                    />
                  </label>
                  <ActionButton
                    type="submit"
                    variant="jade"
                    size="md"
                    disabled={joinCode.trim().length < 6}
                    loading={joinMutation.isPending}
                  >
                    Tham gia bếp
                  </ActionButton>
                </form>
              </BentoCard>
            </>
          )
        )}

        <ConfirmDialog
          open={Boolean(pendingRemoval)}
          title={
            pendingRemoval?.userId === userId
              ? 'Rời khỏi bếp gia đình này?'
              : `Mời ${pendingRemoval?.displayName ?? 'thành viên'} rời bếp?`
          }
          description={
            pendingRemoval?.userId === userId
              ? 'Bạn sẽ chuyển về không gian bếp cá nhân của riêng mình. Dữ liệu của bếp chung vẫn được giữ cho các thành viên còn lại.'
              : 'Thành viên này sẽ được chuyển về không gian bếp riêng và không còn thấy tủ lạnh hay danh sách đi chợ chung.'
          }
          confirmText={pendingRemoval?.userId === userId ? 'Rời bếp chung' : 'Xác nhận xóa'}
          cancelText="Giữ lại"
          destructive
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => {
            if (pendingRemoval) {
              removeMemberMutation.mutate(pendingRemoval.userId);
            }
          }}
        />
      </div>
    </AccountPage>
  );
};
