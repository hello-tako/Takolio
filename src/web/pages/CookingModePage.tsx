import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { clsx } from 'clsx';
import {
  enrichRecipeToV4,
  scaleRecipeV4,
  type CulinaryPhaseV4,
  type MamComColorSlot,
  type RecipeStepV4,
} from '@frigo/recipes';
import { useCookingStore } from '../stores/useCookingStore';
import { api } from '../services/api';
import type { CulinaryFridgeItem, DishRole } from '../services/ai-copilot';
import { queryKeys } from '../lib/queryKeys';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  BambooSteamerIcon,
  ChefKnifeBoardIcon,
  ClaypotBraiseIcon,
  FlameHighIcon,
  FlameLowIcon,
  FlameMediumIcon,
  FlameOffIcon,
  HouseholdTrayIcon,
  MarinateBowlIcon,
  MultiTimerIcon,
  PlatingSparkleIcon,
  PortionScaleIcon,
  SensoryAromaIcon,
  StockpotSoupIcon,
  TakolioLogoMark,
  VoiceWaveTakoIcon,
  WakeLockSunIcon,
  WokFlameIcon,
} from '../design-system/icons';
import {
  ActiveCookwareStage3D,
  TakoChef3D,
  type BurnerHeatLevel,
  type CulinaryTechnique,
} from '../components/3d';
import { CookingReview } from '../components/cooking/CookingReview';
import {
  StepIngredientSplitCard,
  mapAllocationsToSplitItems,
  type StepIngredientSplitItem,
} from '../components/cooking/StepIngredientSplitCard';
import { MultiTimerDock } from '../components/cooking/MultiTimerDock';
import { SousChefCopilotDrawer } from '../components/cooking/SousChefCopilotDrawer';
import { MamComConductorModal } from '../components/cooking/MamComConductorModal';
import {
  playStepAdvanceTick,
  playTimerCompleteChime,
} from '../lib/audio-effects';
import { matchStepIngredients } from '../lib/culinary-visuals';
import { getIngredientImage } from '../lib/ingredient-images';
import { useScreenWakeLock } from '../lib/wake-lock';
import { voiceChef } from '../lib/voice-chef';
import { capturePrivateSession } from '../lib/private-session';
import { useFamilyPreferences } from '../features/family/useFamilyPreferences';
import { useAuthStore } from '../stores/useAuthStore';

const PHASE_META_VI: Record<CulinaryPhaseV4, { code: string; label: string }> = {
  mise_en_place: { code: '01', label: 'Sơ chế' },
  marinate: { code: '02', label: 'Tẩm ướp' },
  active_cook: { code: '03', label: 'Chế biến trên bếp' },
  plate: { code: '04', label: 'Trình bày' },
};

const HEAT_BAR_MAP: Record<BurnerHeatLevel, { bars: number; summaryVi: string }> = {
  off: { bars: 0, summaryVi: 'Không bật bếp (Sơ chế / Trình bày)' },
  low: { bars: 1, summaryVi: 'Lửa nhỏ liu riu' },
  medium_low: { bars: 2, summaryVi: 'Lửa nhỏ vừa' },
  medium: { bars: 3, summaryVi: 'Lửa vừa ổn định' },
  medium_high: { bars: 4, summaryVi: 'Lửa khá lớn' },
  high: { bars: 5, summaryVi: 'Lửa lớn áp chảo / xào vượng' },
};

const MAM_COM_PILL_STYLES: Record<MamComColorSlot, string> = {
  terracotta: 'bg-tk-flame text-white',
  jade: 'bg-tk-jade text-white',
  amber: 'bg-tk-turmeric text-white',
  cobalt: 'bg-tk-ocean text-white',
};

function inferDishRoleForSwap(technique: CulinaryTechnique): DishRole | undefined {
  switch (technique) {
    case 'braise':
      return 'braise';
    case 'simmer':
    case 'steam':
      return 'soup';
    case 'stir_fry':
    case 'fry':
      return 'stir_fry';
    case 'marinate':
      return 'marinade';
    case 'plate':
      return 'garnish';
    default:
      return undefined;
  }
}

export const CookingModePage: React.FC = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const recipeKey = slug || id || '';
  const [params] = useSearchParams();
  const rawServings = params.get('servings') ?? '';
  const servings =
    /^[1-9][0-9]?$/.test(rawServings) && Number(rawServings) <= 20
      ? Number(rawServings)
      : undefined;
  const contentFingerprint = params.get('contentFingerprint') ?? undefined;

  return (
    <CookingLoader
      key={`${recipeKey}:${contentFingerprint ?? 'current'}`}
      recipeKey={recipeKey}
      servings={servings}
      contentFingerprint={contentFingerprint}
    />
  );
};

function CookingLoader({
  recipeKey,
  servings,
  contentFingerprint,
}: {
  recipeKey: string;
  servings?: number;
  contentFingerprint?: string;
}) {
  const {
    activeRecipe,
    mode,
    parallelRecipes,
    runId,
    startCooking,
    attempt,
    contentFingerprint: activeFingerprint,
  } = useCookingStore();

  const matchesSingle = Boolean(
    activeRecipe &&
      (activeRecipe.slug === recipeKey || activeRecipe.id === recipeKey) &&
      (servings === undefined || activeRecipe.servings === servings) &&
      (contentFingerprint === undefined || activeFingerprint === contentFingerprint),
  );
  const matchesMamCom = Boolean(
    mode === 'mam_com' &&
      activeRecipe &&
      parallelRecipes.some((r) => r.slug === recipeKey || r.id === recipeKey),
  );
  const matches = matchesSingle || matchesMamCom;

  const blockedRun = Boolean(attempt && !['saved', 'queued'].includes(attempt.status));

  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(recipeKey, contentFingerprint),
    queryFn: () => api.getRecipeById(recipeKey, contentFingerprint),
    enabled: Boolean(recipeKey) && !matches && !blockedRun,
  });

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
    enabled: Boolean(recipeKey) && !matches && !blockedRun,
  });

  useEffect(() => {
    if (!matches && !blockedRun && recipeQuery.data?.recipe && inventoryQuery.data) {
      startCooking(recipeQuery.data.recipe, inventoryQuery.data, {
        contentFingerprint: recipeQuery.data.contentFingerprint,
        targetServings: servings,
      });
    }
  }, [matches, blockedRun, recipeQuery.data, inventoryQuery.data, startCooking, servings]);

  if (blockedRun && !matches) {
    return (
      <div className="cooking-empty tk-sanctuary-theme min-h-dvh flex items-center justify-center p-6">
        <BentoCard tone="sanctuary" padding="lg" className="max-w-lg w-full text-center space-y-4">
          <div className="flex justify-center">
            <TakoChef3D pose="think" size={120} interactive={false} />
          </div>
          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-white">
            Cần kiểm tra lần nấu trước
          </h1>
          <p className="text-sm text-white/75 leading-relaxed">
            Bạn còn một yêu cầu hoàn tất cho <strong>{activeRecipe?.title}</strong>. Kiểm tra kết quả
            trước khi bắt đầu món khác để tránh gửi thêm lần trừ nguyên liệu.
          </p>
          <ActionButton variant="flame" size="lg" fullWidth to="/cooking/complete">
            Kiểm tra yêu cầu trước
          </ActionButton>
        </BentoCard>
      </div>
    );
  }

  if (matches && attempt) return <CookingReview key={runId} />;

  if (!matches || !runId) {
    const error = recipeQuery.error || inventoryQuery.error;
    return (
      <div className="cooking-empty tk-sanctuary-theme min-h-dvh flex flex-col items-center justify-center p-6">
        <BentoCard tone="sanctuary" padding="lg" className="max-w-md w-full text-center space-y-4">
          {error ? (
            <InlineError
              error={error}
              onRetry={() => {
                void recipeQuery.refetch();
                void inventoryQuery.refetch();
              }}
            />
          ) : !recipeKey || (recipeQuery.isSuccess && !recipeQuery.data?.recipe) ? (
            <h1 className="font-heading text-xl font-extrabold text-white">
              Không tìm thấy công thức này
            </h1>
          ) : (
            <InlineLoading label="Đang khởi tạo Không gian Bếp 3D…" />
          )}
          <ActionButton variant="sanctuary" fullWidth to="/recipes">
            Xem công thức
          </ActionButton>
        </BentoCard>
      </div>
    );
  }

  return <CookingSanctuary key={runId} />;
}

function CookingSanctuary() {
  const state = useCookingStore();
  const {
    mode,
    baseRecipe,
    activeRecipe: recipe,
    enrichedRecipeV4,
    parallelRecipes,
    parallelPlan,
    currentStepIndex: index,
    timerSecondsRemaining: remaining,
    isTimerRunning: running,
    activeStepTimer,
    timerGeneration,
    completedSteps,
    checkedIngredients,
    ingredientSwaps,
    stockSnapshot,
    runId,
  } = state;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isGuest = useAuthStore((s) => s.isGuest);
  const familyPrefs = useFamilyPreferences(!isGuest);

  // Sanctuary Dark (#111A17) by default, with 1-tap toggle to Warm Daylight (#FBF8F3)
  const [darkTheme, setDarkTheme] = useState(true);
  const [wakeDesired, setWakeDesired] = useState(true);
  const wakeLock = useScreenWakeLock(wakeDesired);

  const [confirmExit, setConfirmExit] = useState(false);
  const [sousChefOpen, setSousChefOpen] = useState(false);
  const [mamComOpen, setMamComOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);

  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [wakeWordOnly, setWakeWordOnly] = useState(false);
  const [heard, setHeard] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('');
  const [announcement, setAnnouncement] = useState({ text: '', sequence: 0 });
  const [direction, setDirection] = useState(1);

  const toggleRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const voiceGeneration = useRef(0);
  const heardTimeout = useRef<ReturnType<typeof setTimeout>>();
  const alertedGeneration = useRef(-1);

  const currentStep = recipe?.steps[index];
  const parallelTimelineStep =
    mode === 'mam_com' && parallelPlan ? parallelPlan.timelineSteps[index] ?? null : null;

  // Resolve structured V4 step metadata (phase, cookware, heatLevel, sensoryCue, stepIngredients)
  const resolvedV4Recipe = useMemo(() => {
    if (!recipe) return null;
    if (enrichedRecipeV4 && mode === 'single') return enrichedRecipeV4;
    return recipe.servings !== (baseRecipe?.servings ?? recipe.servings) && baseRecipe
      ? scaleRecipeV4(baseRecipe, recipe.servings)
      : enrichRecipeToV4(recipe);
  }, [recipe, baseRecipe, enrichedRecipeV4, mode]);

  const v4Step: RecipeStepV4 | null = useMemo(() => {
    if (parallelTimelineStep) return parallelTimelineStep.step;
    return resolvedV4Recipe?.steps[index] ?? null;
  }, [parallelTimelineStep, resolvedV4Recipe, index]);

  const fridgeItemsForAi = useMemo<CulinaryFridgeItem[]>(() => {
    if (!Array.isArray(stockSnapshot)) return [];
    return stockSnapshot
      .filter((lot) => lot && Number(lot.quantity) > 0)
      .slice(0, 80)
      .map((lot) => ({
        id: lot.id,
        name: ('name' in lot && typeof lot.name === 'string' && lot.name) || lot.ingredientId,
        ingredientId: lot.ingredientId,
        quantity: lot.quantity,
        unit: lot.unit,
        freshness: lot.freshness,
      }));
  }, [stockSnapshot]);

  const announce = (text: string) =>
    setAnnouncement((previous) => ({ text, sequence: previous.sequence + 1 }));

  useEffect(() => {
    mounted.current = true;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      mounted.current = false;
      voiceGeneration.current++;
      clearTimeout(heardTimeout.current);
      voiceChef.stopSpeaking();
      voiceChef.stopListening();
      window.removeEventListener('beforeunload', warn);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const tick = () => state.tickTimer();
    const interval = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [running, state.tickTimer]);

  useEffect(() => {
    if (remaining !== 0 || alertedGeneration.current === timerGeneration) return;
    alertedGeneration.current = timerGeneration;
    announce('Hẹn giờ đã kết thúc.');
    playTimerCompleteChime();
    navigator.vibrate?.([200, 100, 200]);
  }, [remaining, timerGeneration]);

  useEffect(() => {
    voiceChef.stopSpeaking();
    setSpeaking(false);
    setAnnouncement({ text: '', sequence: 0 });
  }, [index]);

  const ownsRun = () => mounted.current && useCookingStore.getState().runId === runId;

  const speakCurrent = () => {
    const live = useCookingStore.getState();
    const step = live.activeRecipe?.steps[live.currentStepIndex];
    if (!ownsRun() || !step) return;
    const speakingStep = live.currentStepIndex;
    const ok = voiceChef.speakInstruction(step.instruction, () => {
      if (ownsRun() && useCookingStore.getState().currentStepIndex === speakingStep) {
        setSpeaking(false);
      }
    });
    setSpeaking(ok);
    if (!ok) {
      setVoiceStatus(
        'Không thể đọc giọng nói trên trình duyệt này. Bạn có thể đọc hướng dẫn và dùng các nút bên dưới.',
      );
    }
  };

  const effectiveTimerSeconds = remaining ?? activeStepTimer?.remainingSeconds ?? null;
  const effectiveTimerRunning = remaining !== null ? running : Boolean(activeStepTimer?.running);

  const startTimer = (overrideSeconds?: number, customLabel?: string) => {
    const live = useCookingStore.getState();
    const stepMinutes =
      live.activeRecipe?.steps[live.currentStepIndex]?.timerMinutes ??
      v4Step?.timerMinutes ??
      undefined;
    const durationSec =
      overrideSeconds && overrideSeconds > 0
        ? overrideSeconds
        : stepMinutes
          ? stepMinutes * 60
          : 0;
    if (!ownsRun() || durationSec <= 0) return;
    const starting = live.timerSecondsRemaining === null && !live.activeStepTimer;
    live.setTimer(durationSec, customLabel);
    announce(starting ? 'Đã bắt đầu hẹn giờ.' : 'Đã đặt lại hẹn giờ.');
  };

  const toggleTimer = () => {
    const live = useCookingStore.getState();
    live.tickTimer();
    const currentAfterTick = useCookingStore.getState();
    const targetTimerId =
      currentAfterTick.timerSecondsRemaining === null && currentAfterTick.activeStepTimer
        ? currentAfterTick.activeStepTimer.id
        : undefined;
    const currentRem =
      currentAfterTick.timerSecondsRemaining ??
      currentAfterTick.activeStepTimer?.remainingSeconds ??
      0;
    if (!ownsRun() || currentRem === 0) return;
    const pausing =
      currentAfterTick.timerSecondsRemaining !== null
        ? currentAfterTick.isTimerRunning
        : Boolean(currentAfterTick.activeStepTimer?.running);
    live.toggleTimer(targetTimerId);
    announce(pausing ? 'Đã tạm dừng hẹn giờ.' : 'Đã tiếp tục hẹn giờ.');
  };

  const extendActiveStepTimer = (addSeconds: number) => {
    const live = useCookingStore.getState();
    if (!ownsRun()) return;
    if (live.activeStepTimer) {
      live.extendTimer(live.activeStepTimer.id, addSeconds);
      announce('Đã cộng thêm 1 phút hẹn giờ.');
    } else {
      live.addCustomTimer(
        `${recipe?.title ?? 'Bếp'} · Bước ${index + 1}`,
        addSeconds,
      );
      announce('Đã bắt đầu hẹn giờ.');
    }
  };

  const changeStep = (delta: number) => {
    if (!ownsRun()) return;
    setDirection(delta);
    playStepAdvanceTick();
    const live = useCookingStore.getState();
    if (delta > 0) live.nextStep();
    else live.prevStep();
  };

  const jumpToStep = (targetIdx: number) => {
    if (!ownsRun() || targetIdx === index) return;
    setDirection(targetIdx > index ? 1 : -1);
    playStepAdvanceTick();
    useCookingStore.getState().goToStep(targetIdx);
  };

  const handleScaleServings = (nextServings: number) => {
    const clamped = Math.max(1, Math.min(12, Math.round(nextServings)));
    state.setTargetServings(clamped);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('servings', String(clamped));
    setSearchParams(nextParams, { replace: true });
  };

  const startVoiceSession = (strictWakeWord: boolean) => {
    const generation = ++voiceGeneration.current;
    const isCurrent = capturePrivateSession();
    const valid = () => ownsRun() && isCurrent() && voiceGeneration.current === generation;
    setListening(true);
    setVoiceStatus('Trợ lý rảnh tay đã bật.');
    voiceChef.startListening(
      {
        requireWakeWord: strictWakeWord,
        onNext: () => {
          if (valid()) changeStep(1);
        },
        onPrev: () => {
          if (valid()) changeStep(-1);
        },
        onRepeat: () => {
          if (valid()) speakCurrent();
        },
        onStartTimer: () => {
          if (valid()) startTimer();
        },
        onPauseTimer: () => {
          const st = useCookingStore.getState();
          if (valid() && (st.isTimerRunning || st.activeStepTimer?.running)) {
            toggleTimer();
          }
        },
        onExtendTimer: () => {
          if (valid()) extendActiveStepTimer(60);
        },
        onHeardCommand: (text) => {
          if (!valid()) return;
          setHeard(text);
          clearTimeout(heardTimeout.current);
          heardTimeout.current = setTimeout(() => {
            if (valid()) setHeard('');
          }, 3200);
        },
        onError: () => {
          if (!valid()) return;
          voiceGeneration.current++;
          voiceChef.stopListening();
          setListening(false);
          setVoiceStatus(
            'Trợ lý rảnh tay đã tắt. Không thể nghe khẩu lệnh; bạn vẫn có thể dùng các nút điều khiển.',
          );
        },
      },
      { requireWakeWord: strictWakeWord },
    );
  };

  const toggleListening = () => {
    if (listening) {
      voiceGeneration.current++;
      voiceChef.stopListening();
      clearTimeout(heardTimeout.current);
      setHeard('');
      setListening(false);
      setVoiceStatus('Trợ lý rảnh tay đã tắt.');
      return;
    }
    startVoiceSession(wakeWordOnly);
  };

  const toggleWakeWordFilter = () => {
    const nextStrict = !wakeWordOnly;
    setWakeWordOnly(nextStrict);
    voiceChef.setWakeWordMode(nextStrict);
    if (listening) {
      voiceChef.stopListening();
      startVoiceSession(nextStrict);
    }
  };

  const complete = () => {
    state.clearTimer();
    navigate('/cooking/complete');
  };

  if (!recipe) return null;

  const recipeParams = new URLSearchParams({ servings: String(recipe.servings) });
  if (state.contentFingerprint) recipeParams.set('contentFingerprint', state.contentFingerprint);
  const recipeHref = `/recipes/${recipe.slug}?${recipeParams}`;

  if (!currentStep) {
    return (
      <div className="cooking-empty tk-sanctuary-theme min-h-dvh flex items-center justify-center p-6">
        <BentoCard tone="sanctuary" padding="lg" className="max-w-md w-full text-center space-y-4">
          <h1 className="font-heading text-xl font-extrabold text-white">
            Công thức chưa có bước nấu
          </h1>
          <p className="text-sm text-white/75">
            Bạn có thể xem lại công thức hoặc kiểm tra lượng thực dùng nếu đã nấu món này.
          </p>
          <div className="flex flex-col gap-2.5">
            <ActionButton variant="sanctuary" fullWidth to={recipeHref}>
              Xem lại công thức
            </ActionButton>
            <ActionButton variant="flame" fullWidth onClick={complete}>
              Kiểm tra lượng thực dùng
            </ActionButton>
          </div>
        </BentoCard>
      </div>
    );
  }

  const last = index === recipe.steps.length - 1;
  const countdown =
    effectiveTimerSeconds === null
      ? ''
      : `${String(Math.floor(effectiveTimerSeconds / 60)).padStart(2, '0')}:${String(
          effectiveTimerSeconds % 60,
        ).padStart(2, '0')}`;

  const stageTechnique: CulinaryTechnique = v4Step?.technique ?? 'simmer';
  const stageHeat: BurnerHeatLevel = v4Step?.heatLevel ?? 'medium';
  const heatInfo = HEAT_BAR_MAP[stageHeat] ?? HEAT_BAR_MAP.medium;
  const phaseInfo = PHASE_META_VI[v4Step?.phase ?? 'active_cook'];

  const totalStepTimerSeconds =
    activeStepTimer?.durationSeconds ?? (currentStep.timerMinutes ?? 0) * 60;
  const stepTimerProgress =
    effectiveTimerSeconds !== null && totalStepTimerSeconds > 0
      ? Math.max(0, Math.min(1, 1 - effectiveTimerSeconds / totalStepTimerSeconds))
      : undefined;

  // Build exact per-step split ingredient list
  const units: Record<string, string> = { piece: 'cái', pack: 'gói', bunch: 'bó', slice: 'lát' };
  const formatQty = (quantity: number, unit: string) =>
    `${new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 15 }).format(quantity)} ${
      units[unit] ?? unit
    }`;

  const splitStepItems: StepIngredientSplitItem[] = (() => {
    if (v4Step && v4Step.stepIngredients.length > 0) {
      return mapAllocationsToSplitItems(v4Step.stepIngredients);
    }
    const fallbackMatched = matchStepIngredients(currentStep.instruction, recipe.ingredients);
    return fallbackMatched.map((ing) => ({
      ingredientId: ing.ingredientId,
      name: ing.name,
      formattedAmountVi: formatQty(ing.requiredQuantity, ing.unit),
      roleLabelVi: 'Dùng trong bước này',
      allocatedQuantity: ing.requiredQuantity,
      totalRecipeQuantity: ing.requiredQuantity,
      unit: ing.unit,
      isSplitPortion: false,
    }));
  })();

  const stepCompletionKey = `${recipe.id}:step:${index + 1}`;
  const isStepMarkedDone = Boolean(completedSteps[stepCompletionKey]);
  const panCrowdingWarningVi: string | null =
    resolvedV4Recipe &&
    'panCrowdingWarningVi' in resolvedV4Recipe &&
    typeof resolvedV4Recipe.panCrowdingWarningVi === 'string'
      ? resolvedV4Recipe.panCrowdingWarningVi
      : null;

  return (
    <div
      className={clsx(
        'cooking-workspace min-h-dvh flex flex-col transition-colors duration-300',
        darkTheme ? 'tk-sanctuary-theme text-white' : 'bg-tk-canvas text-tk-ink',
      )}
    >
      {/* Screen-reader live regions (preserving zero timer-tick noise on step status) */}
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="cooking-step-status"
      >{`Bước ${index + 1} trên ${recipe.steps.length}. ${currentStep.instruction}`}</p>

      <p role="status" className="sr-only" data-testid="cooking-timer-status">
        <span key={announcement.sequence}>{announcement.text}</span>
      </p>

      {/* =====================================================================
       * 1. TOP SANCTUARY COMMAND BAR
       * ===================================================================== */}
      <header
        className={clsx(
          'cooking-header sticky top-0 z-30 border-b backdrop-blur-xl px-3 sm:px-6 py-2.5',
          darkTheme
            ? 'border-white/10 bg-tk-sanctuary/90'
            : 'border-tk-stone/85 bg-tk-canvas/92 shadow-2xs',
        )}
      >
        <div className="mx-auto max-w-[1380px] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Exit Button + Dish Title + Phase Pill */}
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                className={clsx(
                  'cooking-control inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs sm:text-sm font-extrabold transition-tap cursor-pointer min-h-[44px] shrink-0',
                  darkTheme
                    ? 'border-white/15 bg-white/8 text-white hover:bg-white/15'
                    : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken',
                )}
                onClick={() => setConfirmExit(true)}
                aria-label="Thoát chế độ nấu"
              >
                <ArrowLeft aria-hidden="true" size={18} />
                <span className="hidden sm:inline">Thoát</span>
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <TakolioLogoMark size={18} tone="flame" />
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold tk-tabular',
                      darkTheme
                        ? 'bg-tk-flame/25 text-white border border-tk-flame/45'
                        : 'bg-tk-flame-soft text-tk-flame-deep border border-tk-flame/20',
                    )}
                  >
                    {phaseInfo.code} {phaseInfo.label}
                  </span>
                  <span
                    className={clsx(
                      'text-xs font-bold tk-tabular',
                      darkTheme ? 'text-white/65' : 'text-tk-muted',
                    )}
                  >
                    Bước {index + 1}/{recipe.steps.length}
                  </span>
                </div>
                <p className="truncate text-sm sm:text-base font-extrabold leading-tight mt-0.5">
                  {recipe.title}
                </p>
              </div>
            </div>

            {/* Right: 4 Live Status Pills + Daylight/Sanctuary Theme Switch */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* 1. Screen Wake Lock Pill */}
              <button
                type="button"
                onClick={() => setWakeDesired((v) => !v)}
                aria-pressed={wakeDesired}
                title={
                  wakeLock.active
                    ? 'Màn hình đang được giữ sáng liên tục'
                    : 'Bật giữ sáng màn hình khi nấu'
                }
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-tap cursor-pointer min-h-[40px]',
                  wakeDesired
                    ? darkTheme
                      ? 'border-tk-jade-mint/45 bg-tk-jade/35 text-tk-jade-mint'
                      : 'border-tk-jade/30 bg-tk-jade-soft text-tk-jade-deep'
                    : darkTheme
                      ? 'border-white/12 bg-white/5 text-white/65'
                      : 'border-tk-stone bg-tk-surface text-tk-muted',
                )}
              >
                <WakeLockSunIcon
                  size={15}
                  tone={wakeDesired ? (darkTheme ? 'cream' : 'jade') : 'ink'}
                  active={wakeDesired}
                />
                <span className="hidden md:inline">
                  {wakeDesired ? 'Giữ sáng màn hình' : 'Tự tắt màn hình'}
                </span>
              </button>

              {/* 2. Voice Sous-Chef Pill */}
              <button
                type="button"
                onClick={toggleListening}
                aria-pressed={listening}
                aria-label={listening ? 'Tắt trợ lý rảnh tay' : 'Bật trợ lý rảnh tay'}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-extrabold transition-tap cursor-pointer min-h-[40px]',
                  listening
                    ? 'border-tk-flame bg-tk-flame text-white shadow-glow'
                    : darkTheme
                      ? 'border-white/15 bg-white/8 text-white hover:bg-white/15'
                      : 'border-tk-stone bg-tk-surface text-tk-ink hover:bg-tk-sunken',
                )}
              >
                <VoiceWaveTakoIcon
                  size={16}
                  tone={listening || darkTheme ? 'cream' : 'flame'}
                  active={listening}
                />
                <span>{listening ? 'Đang nghe “Tako”' : 'Khẩu lệnh “Tako”'}</span>
              </button>

              {/* 3. Mâm Cơm Conductor / Dish Switcher Pill */}
              <button
                type="button"
                onClick={() => setMamComOpen(true)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-tap cursor-pointer min-h-[40px]',
                  mode === 'mam_com'
                    ? 'border-tk-turmeric bg-tk-turmeric/30 text-white'
                    : darkTheme
                      ? 'border-white/15 bg-white/8 text-white hover:bg-white/15'
                      : 'border-tk-stone bg-tk-surface text-tk-ink hover:bg-tk-sunken',
                )}
              >
                <HouseholdTrayIcon
                  size={15}
                  tone={darkTheme ? 'cream' : 'turmeric'}
                  active={mode === 'mam_com'}
                />
                <span className="hidden sm:inline">
                  {mode === 'mam_com' && parallelPlan
                    ? `Mâm ${parallelPlan.dishes.length} món`
                    : 'Đạo diễn Mâm Cơm'}
                </span>
              </button>

              {/* 4. Ask AI Sous-Chef Glowing Pill */}
              <button
                type="button"
                onClick={() => setSousChefOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-tk-flame to-tk-turmeric px-3.5 py-2 text-xs font-extrabold text-white shadow-float hover:brightness-105 active:scale-95 transition-tap cursor-pointer min-h-[40px]"
              >
                <AiSousChefSparkIcon size={16} tone="cream" active />
                <span>Hỏi AI Bếp Trưởng</span>
              </button>

              {/* Daylight / Cast-Iron Sanctuary Theme Toggle */}
              <button
                type="button"
                onClick={() => setDarkTheme((d) => !d)}
                aria-label={
                  darkTheme
                    ? 'Chuyển sang giao diện Sáng Ban Ngày'
                    : 'Chuyển sang giao diện Tối Sanctuary'
                }
                className={clsx(
                  'flex h-10 w-10 items-center justify-center rounded-full border transition-colors cursor-pointer',
                  darkTheme
                    ? 'border-white/15 bg-white/8 text-tk-flame-glow hover:bg-white/15'
                    : 'border-tk-stone bg-tk-surface text-tk-ink hover:bg-tk-sunken',
                )}
              >
                {darkTheme ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {/* Smooth Interactive Segmented Progress Rail across all steps */}
          <div
            className="cooking-progress flex items-center gap-1.5"
            role="progressbar"
            aria-label="Tiến trình nấu ăn"
            aria-valuemin={1}
            aria-valuemax={recipe.steps.length}
            aria-valuenow={index + 1}
            aria-valuetext={`Bước ${index + 1} trên ${recipe.steps.length}`}
          >
            {recipe.steps.map((_, sIdx) => {
              const isCurrent = sIdx === index;
              const isPast = sIdx < index || Boolean(completedSteps[`${recipe.id}:step:${sIdx + 1}`]);
              return (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => jumpToStep(sIdx)}
                  aria-label={`Chuyển tới bước ${sIdx + 1}`}
                  className="group flex-1 py-1.5 cursor-pointer focus:outline-none"
                >
                  <span
                    className={clsx(
                      'block h-2 w-full rounded-full transition-tap duration-300',
                      isCurrent
                        ? 'bg-tk-flame shadow-glow scale-y-110'
                        : isPast
                          ? 'bg-tk-jade'
                          : darkTheme
                            ? 'bg-white/15 group-hover:bg-white/30'
                            : 'bg-tk-stone group-hover:bg-tk-muted/50',
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* Live Voice Status & Transcript Toast Strip */}
          {(voiceStatus || heard || listening) && (
            <div
              className={clsx(
                'flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2 text-xs',
                darkTheme
                  ? 'border-white/12 bg-tk-sanctuary-card/95 text-white/90'
                  : 'border-tk-stone bg-tk-surface text-tk-ink',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p role="status" data-testid="cooking-listening-status" className="font-bold">
                  {voiceStatus}
                </p>
                {listening && (
                  <span className="opacity-75">
                    Nói “tiếp”, “lùi”, “đọc lại”, “hẹn giờ”, “tạm dừng” hoặc “Tako tiếp”.
                  </span>
                )}
                <p
                  role="status"
                  data-testid="cooking-heard-status"
                  className="font-extrabold text-tk-flame-glow"
                >
                  {heard ? `Đã nghe: ${heard}` : ''}
                </p>
              </div>

              {listening && (
                <button
                  type="button"
                  onClick={toggleWakeWordFilter}
                  aria-pressed={wakeWordOnly}
                  className={clsx(
                    'rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer',
                    wakeWordOnly
                      ? 'border-tk-flame bg-tk-flame/25 text-white'
                      : 'border-current/20 opacity-80 hover:opacity-100',
                  )}
                >
                  {wakeWordOnly ? 'Chế độ lọc ồn: Phải gọi “Tako”' : 'Nhận lệnh nhanh trực tiếp'}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* =====================================================================
       * 2. RESPONSIVE 12-COLUMN MASTER-STAGE STUDIO
       * ===================================================================== */}
      <div className="cooking-workspace-grid mx-auto w-full max-w-[1380px] flex-1 px-3 sm:px-6 pt-4 pb-52 lg:pb-40 grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-7 items-start">
        {/* LEFT / TOP COCKPIT POD (5 cols): Connected Cinema Cookware Stage & Thermal Console */}
        <aside className="cooking-context lg:col-span-5 lg:sticky lg:top-28">
          <div
            className={clsx(
              'rounded-[30px] border p-3 sm:p-3.5 space-y-3',
              darkTheme
                ? 'border-white/15 bg-tk-sanctuary-card text-white shadow-cinema'
                : 'border-tk-stone bg-tk-surface text-tk-ink shadow-elevated',
            )}
          >
            <ActiveCookwareStage3D
              technique={stageTechnique}
              heatLevel={stageHeat}
              timerRunning={effectiveTimerRunning}
              timerProgress={stepTimerProgress}
              stepTitle={v4Step?.titleVi ?? `Bước ${index + 1}`}
              className="min-h-[265px] sm:min-h-[320px] lg:min-h-[355px]"
            />

            {/* Integrated Thermal, Equipment & Live Portion Scaler Console */}
            <div
              className={clsx(
                'rounded-[22px] border p-3.5 space-y-3',
                darkTheme
                  ? 'border-white/10 bg-tk-sanctuary text-white'
                  : 'border-tk-stone/80 bg-tk-canvas text-tk-ink',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Cookware Badge */}
                <div className="inline-flex items-center gap-2">
                  {stageTechnique === 'braise' ? (
                    <ClaypotBraiseIcon size={20} tone="flame" active />
                  ) : stageTechnique === 'simmer' ? (
                    <StockpotSoupIcon size={20} tone="jade" active />
                  ) : stageTechnique === 'steam' ? (
                    <BambooSteamerIcon size={20} tone="turmeric" active />
                  ) : stageTechnique === 'prep' ? (
                    <ChefKnifeBoardIcon size={20} tone="jade" active />
                  ) : stageTechnique === 'marinate' ? (
                    <MarinateBowlIcon size={20} tone="turmeric" active />
                  ) : stageTechnique === 'plate' ? (
                    <PlatingSparkleIcon size={20} tone="jade" active />
                  ) : (
                    <WokFlameIcon size={20} tone="flame" active />
                  )}
                  <div>
                    <p className="text-xs font-extrabold">
                      {v4Step?.cookwareLabelVi ?? 'Dụng cụ bếp gia đình'}
                    </p>
                    <p
                      className={clsx(
                        'text-[11px]',
                        darkTheme ? 'text-white/65' : 'text-tk-muted',
                      )}
                    >
                      {v4Step?.techniqueLabelVi ?? 'Chế biến từng bước'}
                    </p>
                  </div>
                </div>

                {/* Live Portion Scaler Pill (1..12 người) */}
                <div
                  className={clsx(
                    'inline-flex items-center gap-1 rounded-2xl border p-1',
                    darkTheme ? 'border-white/15 bg-tk-sanctuary-card' : 'border-tk-stone bg-tk-surface',
                  )}
                >
                  <button
                    type="button"
                    aria-label="Giảm khẩu phần đang nấu"
                    disabled={recipe.servings <= 1}
                    onClick={() => handleScaleServings(recipe.servings - 1)}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer disabled:opacity-35',
                      darkTheme ? 'hover:bg-white/12 text-white' : 'hover:bg-tk-sunken text-tk-ink',
                    )}
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span className="inline-flex items-center gap-1 px-2 text-xs font-extrabold tk-tabular">
                    <PortionScaleIcon size={14} tone={darkTheme ? 'cream' : 'flame'} />
                    {recipe.servings} người
                  </span>
                  <button
                    type="button"
                    aria-label="Tăng khẩu phần đang nấu"
                    disabled={recipe.servings >= 12}
                    onClick={() => handleScaleServings(recipe.servings + 1)}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-xl transition-colors cursor-pointer disabled:opacity-35',
                      darkTheme ? 'hover:bg-white/12 text-white' : 'hover:bg-tk-sunken text-tk-ink',
                    )}
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* 5-Flame Heat Level Meter */}
              <div
                className={clsx(
                  'flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5',
                  darkTheme
                    ? 'border-white/10 bg-tk-sanctuary-card/90'
                    : 'border-tk-stone bg-tk-surface',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {stageHeat === 'off' ? (
                    <FlameOffIcon size={18} tone={darkTheme ? 'cream' : 'ink'} />
                  ) : heatInfo.bars <= 2 ? (
                    <FlameLowIcon size={18} tone="jade" active />
                  ) : heatInfo.bars <= 4 ? (
                    <FlameMediumIcon size={18} tone="turmeric" active />
                  ) : (
                    <FlameHighIcon size={18} tone="flame" active />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold truncate">{heatInfo.summaryVi}</p>
                    <p
                      className={clsx(
                        'text-[11px] truncate',
                        darkTheme ? 'text-white/60' : 'text-tk-muted',
                      )}
                    >
                      {v4Step?.heatLabelVi ?? 'Điều chỉnh nhiệt phù hợp'}
                    </p>
                  </div>
                </div>

                {/* 5-Flame Gauge */}
                <div className="flex items-center gap-1 shrink-0" aria-label={`Mức lửa ${heatInfo.bars} trên 5`}>
                  {[1, 2, 3, 4, 5].map((lvl) => {
                    const lit = lvl <= heatInfo.bars;
                    return (
                      <span
                        key={lvl}
                        className={clsx(
                          'h-5 w-2.5 rounded-full transition-colors duration-300',
                          lit
                            ? heatInfo.bars >= 4
                              ? 'bg-tk-flame shadow-xs'
                              : heatInfo.bars === 3
                                ? 'bg-tk-turmeric'
                                : 'bg-tk-ocean'
                            : darkTheme
                              ? 'bg-white/12'
                              : 'bg-tk-stone',
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Collapsible Roadmap & Total Ingredients Drawer */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setOutlineOpen((o) => !o)}
                  aria-expanded={outlineOpen}
                  className={clsx(
                    'flex w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer',
                    darkTheme
                      ? 'text-white/75 hover:bg-white/8 hover:text-white'
                      : 'text-tk-secondary hover:bg-tk-sunken hover:text-tk-ink',
                  )}
                >
                  <span>
                    Tổng quan {recipe.steps.length} bước &amp; {recipe.ingredients.length} nguyên liệu
                  </span>
                  <ChevronDown
                    size={15}
                    className={clsx('transition-transform', outlineOpen && 'rotate-180')}
                  />
                </button>

                {outlineOpen && (
                  <div className="mt-2.5 space-y-3 border-t border-current/10 pt-3 max-h-64 overflow-y-auto pr-1">
                    <ol className="space-y-1.5">
                      {recipe.steps.map((st, sIdx) => (
                        <li key={sIdx}>
                          <button
                            type="button"
                            onClick={() => jumpToStep(sIdx)}
                            aria-current={sIdx === index ? 'step' : undefined}
                            className={clsx(
                              'w-full flex items-start gap-2.5 rounded-xl p-2 text-left text-xs transition-colors cursor-pointer',
                              sIdx === index
                                ? 'bg-tk-flame text-white font-bold'
                                : darkTheme
                                  ? 'hover:bg-white/8 text-white/80'
                                  : 'hover:bg-tk-sunken text-tk-secondary',
                            )}
                          >
                            <span className="tk-tabular font-extrabold shrink-0">
                              {String(sIdx + 1).padStart(2, '0')}.
                            </span>
                            <span className="line-clamp-2">{st.instruction}</span>
                          </button>
                        </li>
                      ))}
                    </ol>

                    {recipe.ingredients.length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-current/10">
                        <p className="text-[11px] font-extrabold uppercase opacity-70">
                          Tổng nguyên liệu ({recipe.servings} người):
                        </p>
                        <ul className="space-y-1">
                          {recipe.ingredients.map((ing, i) => (
                            <li
                              key={`${ing.ingredientId}-${i}`}
                              className="flex items-center justify-between gap-2 text-xs py-0.5"
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <img
                                  src={getIngredientImage(ing.ingredientId, ing.name)}
                                  alt=""
                                  width={18}
                                  height={18}
                                  className="h-4.5 w-4.5 rounded bg-tk-surface p-0.5 object-contain"
                                />
                                <span className="truncate">{ing.name}</span>
                              </span>
                              <span className="font-bold tk-tabular shrink-0">
                                {formatQty(ing.requiredQuantity, ing.unit)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT / CENTER STAGE (7 cols): Precision Culinary Step Card */}
        <section
          className="cooking-stage lg:col-span-7 space-y-4"
          aria-label="Bước nấu hiện tại"
        >
          <div
            key={index}
            style={{ '--step-direction': direction } as React.CSSProperties}
            className={clsx(
              'cooking-step rounded-[28px] border p-5 sm:p-7 space-y-5 animate-fade-in',
              darkTheme
                ? 'border-white/12 bg-tk-sanctuary-card text-white shadow-elevated'
                : 'border-tk-stone bg-white text-tk-ink shadow-card',
            )}
          >
            {/* Multi-Dish Mâm Cơm Parallel Banner when active */}
            {parallelTimelineStep && (
              <div
                className={clsx(
                  'rounded-2xl border p-3.5 space-y-1.5',
                  darkTheme
                    ? 'border-white/15 bg-tk-sanctuary-elevated'
                    : 'border-tk-stone bg-tk-canvas',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold',
                      MAM_COM_PILL_STYLES[parallelTimelineStep.dishColorSlot],
                    )}
                  >
                    {parallelTimelineStep.recipeTitle} · Bước gốc {parallelTimelineStep.originalStepNumber}
                  </span>
                  <span className="text-xs font-bold opacity-75 tk-tabular">
                    Phút {parallelTimelineStep.startMinuteOffset}–{parallelTimelineStep.endMinuteOffset}
                  </span>
                </div>
                {parallelTimelineStep.parallelHintVi && (
                  <p className="text-xs font-semibold text-tk-flame-glow">
                    ⚡ Nhịp song song: {parallelTimelineStep.parallelHintVi}
                  </p>
                )}
              </div>
            )}

            {/* Step Header Row + Read-Aloud TTS + Mark Step Completed */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tk-flame text-lg font-extrabold text-white shadow-float tk-tabular">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h1 className="font-heading text-lg sm:text-xl font-extrabold tracking-tight">
                    Bước {index + 1}
                    {v4Step?.titleVi ? ` · ${v4Step.titleVi}` : ''}
                  </h1>
                  <p
                    className={clsx(
                      'text-xs font-semibold',
                      darkTheme ? 'text-white/65' : 'text-tk-muted',
                    )}
                  >
                    {phaseInfo.label} · Ước tính ~{v4Step?.estimatedDurationMinutes ?? 3} phút
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (speaking) {
                      voiceChef.stopSpeaking();
                      setSpeaking(false);
                    } else {
                      speakCurrent();
                    }
                  }}
                  aria-label={speaking ? 'Dừng đọc' : 'Đọc to bước này'}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-xs font-extrabold transition-tap cursor-pointer min-h-[44px]',
                    speaking
                      ? 'border-tk-flame bg-tk-flame text-white'
                      : darkTheme
                        ? 'border-white/15 bg-white/8 text-white hover:bg-white/15'
                        : 'border-tk-stone bg-tk-canvas text-tk-ink hover:bg-tk-sunken',
                  )}
                >
                  {speaking ? (
                    <VolumeX aria-hidden="true" size={17} />
                  ) : (
                    <Volume2 aria-hidden="true" size={17} />
                  )}
                  <span>{speaking ? 'Dừng đọc' : 'Đọc bước này'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => state.toggleStepCompleted(stepCompletionKey)}
                  aria-pressed={isStepMarkedDone}
                  aria-label="Đánh dấu hoàn thành bước này"
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2.5 text-xs font-extrabold transition-tap cursor-pointer min-h-[44px]',
                    isStepMarkedDone
                      ? 'border-tk-jade bg-tk-jade text-white'
                      : darkTheme
                        ? 'border-white/15 bg-white/8 text-white/80 hover:bg-white/15'
                        : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:text-tk-ink',
                  )}
                >
                  <Check size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">{isStepMarkedDone ? 'Đã xong' : 'Xong bước'}</span>
                </button>
              </div>
            </div>

            {/* GIANT, ULTRA-LEGIBLE 1-METER STEP INSTRUCTION TYPOGRAPHY */}
            <p
              className={clsx(
                'cooking-instruction text-xl sm:text-2xl lg:text-[26px] font-bold leading-[1.52] tracking-tight',
                darkTheme ? 'text-white' : 'text-tk-ink',
              )}
            >
              {currentStep.instruction}
            </p>

            {/* SENSORY DONENESS CALLOUT CARD */}
            {v4Step?.sensoryCue && (
              <div
                className={clsx(
                  'flex items-start gap-3 rounded-2xl border p-4',
                  darkTheme
                    ? 'border-tk-jade-mint/30 bg-tk-jade-deep/65 text-white'
                    : 'border-tk-jade/25 bg-tk-jade-soft/75 text-tk-jade-deep',
                )}
              >
                <span
                  className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    darkTheme ? 'bg-tk-jade/45' : 'bg-tk-surface shadow-2xs',
                  )}
                >
                  <SensoryAromaIcon size={20} tone={darkTheme ? 'cream' : 'jade'} active />
                </span>
                <div className="space-y-0.5">
                  <p className="text-xs font-extrabold uppercase tracking-wider opacity-85">
                    Dấu hiệu giác quan nhận biết đạt chuẩn
                  </p>
                  <p className="text-sm sm:text-base font-semibold leading-relaxed">
                    {v4Step.sensoryCue}
                  </p>
                </div>
              </div>
            )}

            {/* EXACT PER-STEP SPLIT INGREDIENT CHECKLIST + AI SUBSTITUTION SWAPPER */}
            <StepIngredientSplitCard
              stepKeyPrefix={`run:${runId}:step:${index + 1}`}
              items={splitStepItems}
              checkedMap={checkedIngredients}
              swappedMap={ingredientSwaps}
              onToggleChecked={state.toggleIngredientChecked}
              onApplySwap={state.applyIngredientSwap}
              recipeTitle={recipe.title}
              dishRole={inferDishRoleForSwap(stageTechnique)}
              fridgeItems={fridgeItemsForAi}
              householdAllergens={familyPrefs.data?.preferences.allergens}
              dark={darkTheme}
            />

            {/* CHEF PRO-TIP & PAN CROWDING GUARD */}
            {(currentStep.tip || panCrowdingWarningVi) && (
              <div
                className={clsx(
                  'cooking-tip rounded-2xl border p-4 space-y-2',
                  darkTheme
                    ? 'border-tk-turmeric/40 bg-tk-turmeric/16 text-white'
                    : 'border-tk-turmeric/30 bg-tk-turmeric-soft text-tk-turmeric-deep',
                )}
              >
                {currentStep.tip && (
                  <p className="text-sm leading-relaxed">
                    <strong className="font-extrabold">💡 Mẹo Bếp Trưởng: </strong>
                    {currentStep.tip}
                  </p>
                )}
                {panCrowdingWarningVi && stageHeat !== 'off' && (
                  <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                    🔥 {panCrowdingWarningVi}
                  </p>
                )}
              </div>
            )}

            {/* TACTILE STEP TIMER LAUNCHER + QUICK PRESETS */}
            <div
              className={clsx(
                'cooking-timer-region rounded-2xl border p-4 space-y-3',
                darkTheme
                  ? 'border-white/12 bg-tk-sanctuary/85'
                  : 'border-tk-stone bg-tk-canvas',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-2 text-xs sm:text-sm font-extrabold uppercase tracking-wider">
                  <MultiTimerIcon size={18} tone={darkTheme ? 'cream' : 'flame'} active />
                  Hẹn giờ canh lửa bước này
                </h3>

                {/* Quick Timer Presets (+2p, +5p, +10p) */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: '+ 2p', sec: 120 },
                    { label: '+ 5p', sec: 300 },
                    { label: '+ 10p', sec: 600 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => startTimer(preset.sec)}
                      className={clsx(
                        'rounded-xl border px-2.5 py-1 text-xs font-extrabold tk-tabular transition-tap cursor-pointer',
                        darkTheme
                          ? 'border-white/15 bg-white/8 text-white hover:bg-tk-flame'
                          : 'border-tk-stone bg-white text-tk-ink hover:border-tk-flame',
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {effectiveTimerSeconds === null ? (
                Boolean(currentStep.timerMinutes) ? (
                  <button
                    type="button"
                    className="cooking-control cooking-timer-start-btn w-full min-h-[56px] rounded-2xl bg-tk-jade hover:bg-tk-jade-hover px-5 py-3.5 text-base font-extrabold text-white shadow-jade flex items-center justify-center gap-2.5 transition-tap cursor-pointer"
                    onClick={() => {
                      startTimer();
                      requestAnimationFrame(() => toggleRef.current?.focus());
                    }}
                  >
                    <Play size={19} fill="currentColor" aria-hidden="true" />
                    <span>
                      Bắt đầu hẹn giờ {String(currentStep.timerMinutes).padStart(2, '0')}:00
                    </span>
                  </button>
                ) : (
                  <p
                    className={clsx(
                      'text-xs',
                      darkTheme ? 'text-white/60' : 'text-tk-muted',
                    )}
                  >
                    Bước này canh theo dấu hiệu giác quan bên trên, hoặc chạm nhanh +2p / +5p / +10p nếu muốn đặt chuông báo.
                  </p>
                )
              ) : (
                <div className="cooking-timer flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                  <div className="cooking-timer-dial flex items-center gap-3.5">
                    <svg
                      className="cooking-timer-ring shrink-0"
                      viewBox="0 0 64 64"
                      width="60"
                      height="60"
                      aria-hidden="true"
                    >
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        fill="none"
                        stroke={darkTheme ? 'rgba(255,255,255,0.12)' : '#E7DFD1'}
                        strokeWidth="6"
                      />
                      <circle
                        cx="32"
                        cy="32"
                        r="26"
                        fill="none"
                        stroke={effectiveTimerSeconds === 0 ? '#D48817' : '#E5533D'}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 26}
                        strokeDashoffset={
                          2 *
                          Math.PI *
                          26 *
                          (totalStepTimerSeconds > 0
                            ? 1 - Math.max(0, Math.min(1, effectiveTimerSeconds / totalStepTimerSeconds))
                            : 0)
                        }
                        transform="rotate(-90 32 32)"
                      />
                    </svg>

                    <div>
                      <span
                        className="cooking-countdown block text-3xl sm:text-4xl font-extrabold tk-tabular tracking-tight"
                        data-testid="cooking-countdown"
                      >
                        {countdown}
                      </span>
                      <span
                        className={clsx(
                          'text-xs font-semibold',
                          effectiveTimerSeconds === 0
                            ? 'text-tk-flame-glow font-bold'
                            : darkTheme
                              ? 'text-white/65'
                              : 'text-tk-secondary',
                        )}
                      >
                        {effectiveTimerSeconds === 0
                          ? 'Đã hết giờ! Kiểm tra độ chín của món ngay.'
                          : 'Hẹn giờ vẫn tiếp tục chạy nền kể cả khi bạn lật sang bước kế tiếp.'}
                      </span>
                    </div>
                  </div>

                  <div className="cooking-timer-controls flex flex-wrap items-center gap-2">
                    <button
                      ref={toggleRef}
                      type="button"
                      className={clsx(
                        'cooking-control inline-flex items-center gap-1.5 rounded-2xl px-4 min-h-[48px] text-sm font-extrabold transition-tap cursor-pointer',
                        effectiveTimerRunning
                          ? 'bg-tk-turmeric text-white hover:brightness-105'
                          : 'bg-tk-jade text-white hover:bg-tk-jade-hover',
                        effectiveTimerSeconds === 0 && 'opacity-50 pointer-events-none',
                      )}
                      onClick={toggleTimer}
                      aria-disabled={effectiveTimerSeconds === 0}
                      aria-label={
                        effectiveTimerSeconds === 0
                          ? 'Hẹn giờ đã kết thúc'
                          : effectiveTimerRunning
                            ? 'Tạm dừng hẹn giờ'
                            : 'Tiếp tục hẹn giờ'
                      }
                    >
                      {effectiveTimerRunning ? (
                        <Pause aria-hidden="true" size={18} />
                      ) : (
                        <Play aria-hidden="true" size={18} />
                      )}
                      <span>{effectiveTimerRunning ? 'Tạm dừng' : 'Tiếp tục'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => extendActiveStepTimer(60)}
                      className={clsx(
                        'rounded-2xl border px-3.5 min-h-[48px] text-sm font-extrabold tk-tabular transition-tap cursor-pointer',
                        darkTheme
                          ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                          : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken',
                      )}
                    >
                      +1 phút
                    </button>

                    <button
                      type="button"
                      className={clsx(
                        'cooking-control flex h-12 w-12 items-center justify-center rounded-2xl border transition-tap cursor-pointer',
                        darkTheme
                          ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                          : 'border-tk-stone bg-white text-tk-ink hover:bg-tk-sunken',
                      )}
                      aria-label="Đặt lại hẹn giờ"
                      onClick={() => startTimer()}
                    >
                      <RotateCcw aria-hidden="true" size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* =====================================================================
       * 3. PERSISTENT FLOATING MULTI-TIMER DOCK
       * ===================================================================== */}
      <MultiTimerDock dark={darkTheme} />

      {/* =====================================================================
       * 4. WET-HAND ERGONOMIC STICKY BOTTOM STEP NAVIGATION BAR
       * ===================================================================== */}
      <footer
        className={clsx(
          'fixed bottom-0 inset-x-0 z-30 border-t px-3 sm:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl',
          darkTheme
            ? 'border-white/10 bg-tk-sanctuary/92'
            : 'border-tk-stone bg-white/94 shadow-elevated',
        )}
      >
        <div className="cooking-step-actions mx-auto max-w-[1380px] flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => changeStep(-1)}
            className={clsx(
              'cooking-control min-h-[54px] rounded-2xl border px-5 sm:px-7 text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 transition-tap cursor-pointer disabled:opacity-35 disabled:pointer-events-none',
              darkTheme
                ? 'border-white/15 bg-tk-sanctuary-elevated text-white hover:bg-white/15'
                : 'border-tk-stone bg-tk-sunken text-tk-ink hover:bg-tk-stone/70',
            )}
          >
            <ArrowLeft aria-hidden="true" size={19} />
            <span>Bước trước</span>
          </button>

          <button
            type="button"
            onClick={last ? complete : () => changeStep(1)}
            className={clsx(
              'cooking-primary flex-1 sm:flex-initial sm:min-w-[280px] min-h-[54px] rounded-2xl px-6 sm:px-8 text-sm sm:text-base font-extrabold text-white inline-flex items-center justify-center gap-2.5 transition-tap cursor-pointer active:scale-[0.985]',
              last
                ? 'bg-tk-jade hover:bg-tk-jade-hover shadow-jade'
                : 'bg-tk-flame hover:bg-tk-flame-hover shadow-float',
            )}
          >
            {last && <Check aria-hidden="true" size={20} />}
            <span>{last ? 'Hoàn thành nấu' : 'Bước tiếp theo'}</span>
            <ArrowRight aria-hidden="true" size={19} />
          </button>
        </div>
      </footer>

      {/* =====================================================================
       * 5. EMBEDDED AI SOUS-CHEF COPILOT DRAWER
       * ===================================================================== */}
      <SousChefCopilotDrawer
        open={sousChefOpen}
        onClose={() => setSousChefOpen(false)}
        dark={darkTheme}
        recipeTitle={recipe.title}
        currentStepNumber={index + 1}
        currentStepText={currentStep.instruction}
        heatLevel={stageHeat}
        servings={recipe.servings}
        recipeIngredients={recipe.ingredients.map((i) => ({
          name: i.name,
          quantity: i.requiredQuantity,
          unit: i.unit,
        }))}
        fridgeItems={fridgeItemsForAi}
        householdAllergens={familyPrefs.data?.preferences.allergens}
        onStartSuggestedTimer={(sec, label) => {
          state.addCustomTimer(label, sec);
          announce('Đã bắt đầu hẹn giờ.');
        }}
      />

      {/* =====================================================================
       * 6. MÂM CƠM CONDUCTOR / PARALLEL MULTI-DISH MODAL
       * ===================================================================== */}
      {mamComOpen && (
        <MamComConductorModal
          open={mamComOpen}
          onClose={() => setMamComOpen(false)}
          primaryRecipe={baseRecipe ?? recipe}
          currentRecipes={mode === 'mam_com' && parallelRecipes.length > 0 ? parallelRecipes : [baseRecipe ?? recipe]}
          servings={recipe.servings}
          inventory={stockSnapshot}
          dark={darkTheme}
          onApplyMamCom={(selectedRecipes) => {
            state.startMultiDishCooking(selectedRecipes, stockSnapshot, recipe.servings);
          }}
          onReturnSingleDish={() => {
            if (baseRecipe) {
              state.startCooking(baseRecipe, stockSnapshot, {
                contentFingerprint: state.contentFingerprint,
                targetServings: recipe.servings,
              });
            }
          }}
        />
      )}

      {/* =====================================================================
       * 7. EXIT / PAUSE SESSION CONFIRMATION DIALOG (Preserves localStorage option!)
       * ===================================================================== */}
      {confirmExit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in"
          onClick={() => setConfirmExit(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sanctuary-exit-title"
            onClick={(e) => e.stopPropagation()}
            className={clsx(
              'w-full max-w-md rounded-[28px] border p-6 space-y-4 shadow-2xl animate-slide-up',
              darkTheme
                ? 'border-white/15 bg-tk-sanctuary-card text-white'
                : 'border-tk-stone bg-white text-tk-ink',
            )}
          >
            <div className="space-y-1.5">
              <AtelierBadge tone={darkTheme ? 'dark' : 'flame'}>
                Tạm rời Không gian Bếp 3D?
              </AtelierBadge>
              <h2 id="sanctuary-exit-title" className="text-xl font-extrabold">
                Bạn muốn lưu tiến trình đang nấu hay thoát hẳn?
              </h2>
              <p
                className={clsx(
                  'text-xs sm:text-sm leading-relaxed',
                  darkTheme ? 'text-white/70' : 'text-tk-secondary',
                )}
              >
                Tủ lạnh chưa bị trừ nguyên liệu. Nếu chọn <strong>Tạm dừng &amp; Giữ phiên nấu</strong>,
                bước hiện tại và các bộ hẹn giờ sẽ được lưu để bạn mở lại bất cứ lúc nào!
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <ActionButton
                variant="jade"
                size="md"
                fullWidth
                onClick={() => {
                  setConfirmExit(false);
                  navigate(recipeHref);
                }}
              >
                Tạm dừng &amp; Giữ phiên nấu (Quay lại sau)
              </ActionButton>

              <ActionButton
                variant="danger"
                size="md"
                fullWidth
                onClick={() => {
                  state.resetCooking();
                  navigate(recipeHref);
                }}
              >
                Thoát
              </ActionButton>

              <ActionButton
                variant={darkTheme ? 'sanctuary' : 'ceramic'}
                size="sm"
                fullWidth
                onClick={() => setConfirmExit(false)}
              >
                Ở lại nấu tiếp
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
