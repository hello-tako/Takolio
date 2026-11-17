import React, { useEffect, useRef, useState } from 'react';
import { BellRing, ChevronDown, ChevronUp, Pause, Play, Plus, X } from 'lucide-react';
import { clsx } from 'clsx';
import { useCookingStore, type ActiveCookingTimer } from '../../stores/useCookingStore';
import { RadialProgressRing } from '../../design-system/v4/AtelierPrimitives';
import { MultiTimerIcon } from '../../design-system/icons';
import { playTimerCompleteChime } from '../../lib/audio-effects';

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const QUICK_CUSTOM_PRESETS = [
  { label: '+ 2p Áp chảo', seconds: 120, timerName: 'Áp chảo 2 phút' },
  { label: '+ 5p Luộc/Chần', seconds: 300, timerName: 'Luộc / Chần 5 phút' },
  { label: '+ 10p Rim sốt', seconds: 600, timerName: 'Rim thấm sốt 10 phút' },
  { label: '+ 15p Ninh mềm', seconds: 900, timerName: 'Ninh mềm 15 phút' },
] as const;

export const MultiTimerDock: React.FC<{ dark?: boolean }> = ({ dark = true }) => {
  const timers = useCookingStore((s) => s.timers);
  const lastCompletedTimerId = useCookingStore((s) => s.lastCompletedTimerId);
  const toggleTimer = useCookingStore((s) => s.toggleTimer);
  const extendTimer = useCookingStore((s) => s.extendTimer);
  const dismissTimer = useCookingStore((s) => s.dismissTimer);
  const addCustomTimer = useCookingStore((s) => s.addCustomTimer);
  const tickTimer = useCookingStore((s) => s.tickTimer);

  const [collapsed, setCollapsed] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const chimedIdsRef = useRef<Set<string>>(new Set());

  const timerList: ActiveCookingTimer[] = Object.values(timers);
  const anyRunning = timerList.some((t) => t.running);
  const completedCount = timerList.filter((t) => t.completed).length;

  // Keep ticking all concurrent background timers even when user navigates to a step without scalar timer!
  useEffect(() => {
    if (!anyRunning) return;
    const tick = () => tickTimer();
    const interval = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [anyRunning, tickTimer]);

  // Chime whenever any background/multi-timer transitions to completed
  useEffect(() => {
    for (const timer of timerList) {
      if (timer.completed && !chimedIdsRef.current.has(timer.id)) {
        chimedIdsRef.current.add(timer.id);
        playTimerCompleteChime();
        navigator.vibrate?.([220, 100, 220]);
        setCollapsed(false);
      } else if (!timer.completed && chimedIdsRef.current.has(timer.id)) {
        chimedIdsRef.current.delete(timer.id);
      }
    }
  }, [timerList, lastCompletedTimerId]);

  if (timerList.length === 0) return null;

  return (
    <aside
      aria-label="Khay quản lý đa hẹn giờ bếp"
      className={clsx(
        'fixed bottom-[92px] left-3 right-3 sm:left-6 sm:right-auto sm:w-[396px] z-30 rounded-[24px] p-3.5 transition-all animate-slide-up',
        dark ? 'tk-glass-dark text-white' : 'tk-glass text-tk-ink border-tk-stone',
        completedCount > 0 && 'ring-2 ring-amber-400 shadow-glow',
      )}
    >
      {/* Dock Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
        >
          <span
            className={clsx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
              completedCount > 0
                ? 'bg-amber-400 text-tk-ink animate-pulse'
                : 'bg-tk-flame text-white',
            )}
          >
            {completedCount > 0 ? (
              <BellRing size={16} aria-hidden="true" />
            ) : (
              <MultiTimerIcon size={17} tone="cream" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-extrabold tracking-tight truncate">
              Đa Hẹn Giờ Bếp ({timerList.length} nồi đang canh)
            </p>
            <p
              className={clsx(
                'text-[11px] truncate',
                completedCount > 0
                  ? 'font-bold text-amber-300'
                  : dark
                    ? 'text-white/65'
                    : 'text-tk-muted',
              )}
            >
              {completedCount > 0
                ? `${completedCount} hẹn giờ đã hoàn thành — kiểm tra bếp ngay!`
                : 'Chuyển bước thoải mái · Hẹn giờ vẫn chạy nền'}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              setShowQuickAdd((v) => !v);
            }}
            aria-label="Thêm hẹn giờ phụ"
            className={clsx(
              'inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-[11px] font-extrabold cursor-pointer transition-colors',
              dark
                ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken',
            )}
          >
            <Plus size={13} aria-hidden="true" />
            <span>Thêm nồi</span>
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Mở rộng khay hẹn giờ' : 'Thu gọn khay hẹn giờ'}
            className={clsx(
              'rounded-xl p-1.5 cursor-pointer',
              dark ? 'text-white/75 hover:bg-white/10' : 'text-tk-secondary hover:bg-tk-sunken',
            )}
          >
            {collapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Quick Custom Timer Launcher */}
      {!collapsed && showQuickAdd && (
        <div
          className={clsx(
            'mt-2.5 grid grid-cols-2 gap-1.5 rounded-2xl border p-2',
            dark ? 'border-white/10 bg-black/25' : 'border-tk-stone/70 bg-tk-canvas',
          )}
        >
          {QUICK_CUSTOM_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                addCustomTimer(preset.timerName, preset.seconds);
                setShowQuickAdd(false);
              }}
              className={clsx(
                'rounded-xl px-2.5 py-2 text-xs font-bold transition-tap cursor-pointer text-left',
                dark
                  ? 'bg-white/10 text-white hover:bg-tk-flame'
                  : 'bg-white text-tk-ink border border-tk-stone hover:border-tk-flame',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Concurrent Timer Rows */}
      {!collapsed && (
        <div className="mt-3 max-h-[220px] overflow-y-auto space-y-2 pr-0.5">
          {timerList.map((timer) => {
            const pct =
              timer.durationSeconds > 0
                ? Math.round(
                    ((timer.durationSeconds - timer.remainingSeconds) / timer.durationSeconds) * 100,
                  )
                : 100;

            return (
              <div
                key={timer.id}
                className={clsx(
                  'flex items-center justify-between gap-2.5 rounded-2xl border px-3 py-2 transition-all',
                  timer.completed
                    ? dark
                      ? 'border-amber-400/70 bg-amber-500/20 text-amber-100'
                      : 'border-tk-turmeric bg-tk-turmeric-soft text-tk-ink'
                    : dark
                      ? 'border-white/10 bg-white/6'
                      : 'border-tk-stone bg-white',
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <RadialProgressRing
                    value={timer.completed ? 100 : pct}
                    size={40}
                    strokeWidth={4}
                    tone={timer.completed ? 'turmeric' : timer.running ? 'flame' : 'jade'}
                    label={
                      <span className="text-[10px] font-extrabold">
                        {timer.completed ? 'Xong' : `${pct}%`}
                      </span>
                    }
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{timer.label}</p>
                    <p
                      className={clsx(
                        'text-sm sm:text-base font-extrabold tk-tabular leading-tight',
                        timer.completed
                          ? 'text-amber-400'
                          : timer.running
                            ? 'text-tk-flame-glow'
                            : 'opacity-75',
                      )}
                    >
                      {timer.completed ? '00:00 · Đã tới giờ!' : formatClock(timer.remainingSeconds)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {!timer.completed && (
                    <button
                      type="button"
                      onClick={() => toggleTimer(timer.id)}
                      aria-label={
                        timer.running
                          ? `Tạm dừng ${timer.label}`
                          : `Tiếp tục ${timer.label}`
                      }
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-xl border cursor-pointer transition-colors',
                        dark
                          ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                          : 'border-tk-stone bg-tk-canvas text-tk-ink hover:bg-tk-sunken',
                      )}
                    >
                      {timer.running ? (
                        <Pause size={15} aria-hidden="true" />
                      ) : (
                        <Play size={15} aria-hidden="true" />
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => extendTimer(timer.id, 60)}
                    aria-label={`Thêm 60 giây cho ${timer.label}`}
                    className={clsx(
                      'rounded-xl border px-2.5 h-9 text-xs font-extrabold tk-tabular cursor-pointer transition-colors',
                      dark
                        ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                        : 'border-tk-stone bg-tk-canvas text-tk-ink hover:bg-tk-sunken',
                    )}
                  >
                    +60s
                  </button>

                  <button
                    type="button"
                    onClick={() => dismissTimer(timer.id)}
                    aria-label={`Tắt hẹn giờ ${timer.label}`}
                    className={clsx(
                      'flex h-9 w-9 items-center justify-center rounded-xl cursor-pointer transition-colors',
                      timer.completed
                        ? 'bg-amber-400 text-tk-ink font-bold hover:bg-amber-300'
                        : dark
                          ? 'text-white/65 hover:bg-white/10 hover:text-white'
                          : 'text-tk-muted hover:bg-tk-sunken hover:text-tk-ink',
                    )}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
};
