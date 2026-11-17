import { create } from 'zustand';
import type { StandardUnit } from '@frigo/domain';
import {
  buildParallelMamComTimeline,
  enrichRecipeToV4,
  evaluateRecipeAvailability,
  scaleRecipeV4,
  type ParallelCookingPlan,
  type Recipe,
  type RecipeScoringContext,
  type RecipeV4,
  type ScaledRecipeV4,
} from '@frigo/recipes';
import { onPrivateSessionReset } from '../lib/private-session';
import {
  reviewCookingDeductions,
  type CookingDeduction,
  type DeductionDraft,
} from '../lib/cooking-review';
import { createClientItemId } from '../services/http';

export type { DeductionDraft } from '../lib/cooking-review';

export const COOKING_STORAGE_KEY_V4 = 'takolio_active_cooking_v4';

export interface CookingAttempt {
  commandId: string;
  contentFingerprint?: string;
  servings: number;
  deductions: CookingDeduction[];
  status: 'sending' | 'uncertain' | 'rejected' | 'restricted' | 'blocked' | 'saved' | 'queued';
  error: string | null;
}

export interface ActiveCookingTimer {
  id: string;
  label: string;
  recipeId: string;
  stepNumber: number;
  durationSeconds: number;
  remainingSeconds: number;
  deadlineMs: number | null;
  running: boolean;
  completed: boolean;
}

export interface IngredientSwapReplacement {
  ingredientId: string;
  name: string;
  requiredQuantity?: number;
  unit?: StandardUnit;
}

export interface StartCookingOptionsV4 {
  contentFingerprint?: string;
  targetServings?: number;
}

export interface CookingState {
  runId: string | null;
  mode: 'single' | 'mam_com';
  baseRecipe: Recipe | null;
  activeRecipe: Recipe | null;
  enrichedRecipeV4: RecipeV4 | ScaledRecipeV4 | null;
  parallelRecipes: Recipe[];
  parallelPlan: ParallelCookingPlan | null;
  targetServings: number;
  contentFingerprint: string | undefined;
  currentStepIndex: number;
  // Legacy scalar current-step timer contract
  timerSecondsRemaining: number | null;
  timerDeadline: number | null;
  timerGeneration: number;
  isTimerRunning: boolean;
  // V4 Multi-Timer Registry & Dock
  timers: Record<string, ActiveCookingTimer>;
  activeStepTimer: ActiveCookingTimer | null;
  lastCompletedTimerId: string | null;
  // Checklists, Swaps & Post-Cook Feedback
  completedSteps: Record<string, boolean>;
  checkedIngredients: Record<string, boolean>;
  ingredientSwaps: Record<string, IngredientSwapReplacement>;
  leftoverPortions: number;
  rating: number | null;
  cookingNotes: string;
  // Inventory & Idempotent Completion
  deductions: DeductionDraft[];
  deductionInputs: string[];
  deductionErrors: Array<string | null>;
  stockSnapshot: RecipeScoringContext['inventory'];
  attempt: CookingAttempt | null;

  startCooking: (
    recipe: Recipe,
    inventory: RecipeScoringContext['inventory'],
    contentFingerprintOrOptions?: string | StartCookingOptionsV4,
  ) => void;
  startMultiDishCooking: (
    recipes: Recipe[],
    inventory: RecipeScoringContext['inventory'],
    targetServings?: number,
  ) => void;
  setTargetServings: (servings: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (stepIndex: number) => void;
  toggleStepCompleted: (key: string) => void;
  toggleIngredientChecked: (key: string) => void;
  applyIngredientSwap: (ingredientId: string, replacement: IngredientSwapReplacement) => void;
  setTimer: (seconds: number, label?: string) => void;
  tickTimer: () => void;
  toggleTimer: (timerId?: string) => void;
  clearTimer: (timerId?: string) => void;
  addCustomTimer: (label: string, seconds: number) => string | null;
  extendTimer: (timerId: string, addSeconds: number) => void;
  dismissTimer: (timerId: string) => void;
  setLeftoverPortions: (portions: number) => void;
  setRating: (rating: number | null) => void;
  setCookingNotes: (notes: string) => void;
  editDeduction: (index: number, input: string) => void;
  updateDeduction: (ingredientId: string, quantity: number) => void;
  beginCompletion: () => CookingAttempt | null;
  finishCompletion: (
    runId: string,
    commandId: string,
    status: CookingAttempt['status'],
    error?: string,
  ) => void;
  refreshStock: (inventory: RecipeScoringContext['inventory']) => void;
  hydrateSessionFromStorage: () => boolean;
  resetCooking: () => void;
}

type CookingDataSnapshot = Pick<
  CookingState,
  | 'runId'
  | 'mode'
  | 'baseRecipe'
  | 'activeRecipe'
  | 'enrichedRecipeV4'
  | 'parallelRecipes'
  | 'parallelPlan'
  | 'targetServings'
  | 'contentFingerprint'
  | 'currentStepIndex'
  | 'timerSecondsRemaining'
  | 'timerDeadline'
  | 'timerGeneration'
  | 'isTimerRunning'
  | 'timers'
  | 'activeStepTimer'
  | 'lastCompletedTimerId'
  | 'completedSteps'
  | 'checkedIngredients'
  | 'ingredientSwaps'
  | 'leftoverPortions'
  | 'rating'
  | 'cookingNotes'
  | 'deductions'
  | 'deductionInputs'
  | 'deductionErrors'
  | 'stockSnapshot'
  | 'attempt'
>;

const empty: CookingDataSnapshot = {
  runId: null,
  mode: 'single',
  baseRecipe: null,
  activeRecipe: null,
  enrichedRecipeV4: null,
  parallelRecipes: [],
  parallelPlan: null,
  targetServings: 2,
  contentFingerprint: undefined,
  currentStepIndex: 0,
  timerSecondsRemaining: null,
  timerDeadline: null,
  timerGeneration: 0,
  isTimerRunning: false,
  timers: {},
  activeStepTimer: null,
  lastCompletedTimerId: null,
  completedSteps: {},
  checkedIngredients: {},
  ingredientSwaps: {},
  leftoverPortions: 0,
  rating: null,
  cookingNotes: '',
  deductions: [],
  deductionInputs: [],
  deductionErrors: [],
  stockSnapshot: [],
  attempt: null,
};

const stoppedTimer = {
  timerSecondsRemaining: null,
  timerDeadline: null,
  isTimerRunning: false,
};

function resolveCurrentStepTimerMeta(
  state: Pick<CookingState, 'mode' | 'activeRecipe' | 'parallelPlan'>,
  stepIndex: number,
): { timerId: string; recipeId: string; stepNumber: number; defaultLabel: string } | null {
  if (state.mode === 'mam_com' && state.parallelPlan) {
    const tStep = state.parallelPlan.timelineSteps[stepIndex];
    if (tStep) {
      return {
        timerId: tStep.timelineStepId,
        recipeId: tStep.recipeId,
        stepNumber: tStep.originalStepNumber,
        defaultLabel: `${tStep.recipeTitle} · Bước ${tStep.originalStepNumber}`,
      };
    }
  }
  const recipe = state.activeRecipe;
  if (!recipe) return null;
  const step = recipe.steps[stepIndex];
  const stepNumber = step?.stepNumber ?? stepIndex + 1;
  return {
    timerId: `${recipe.id}:step:${stepNumber}`,
    recipeId: recipe.id,
    stepNumber,
    defaultLabel: `${recipe.title || 'Món nấu'} · Bước ${stepNumber}`,
  };
}

function draftDeductionsForRecipe(
  recipe: Recipe,
  inventory: RecipeScoringContext['inventory'],
) {
  const availability = evaluateRecipeAvailability(recipe, inventory);
  const inputs = recipe.ingredients.map((line, index) =>
    String(Math.min(availability[index].availableQuantity, line.requiredQuantity)),
  );
  const review = reviewCookingDeductions(recipe, inventory, inputs);
  return { inputs, review };
}

function buildCompositeRecipeFromPlan(
  plan: ParallelCookingPlan,
  fallbackRecipes: Recipe[],
): Recipe {
  const primary = fallbackRecipes[0];
  return {
    id: primary?.id ?? plan.planId,
    slug: primary?.slug ?? 'mam-com',
    title:
      plan.dishes.length > 1
        ? `Mâm cơm ${plan.dishes.length} món: ${plan.dishes.map((d) => d.title).join(' · ')}`
        : primary?.title ?? 'Mâm cơm gia đình',
    description: plan.summaryHeadlineVi,
    cuisine: primary?.cuisine ?? 'vietnamese',
    category: primary?.category ?? 'mon_canh',
    region: primary?.region ?? 'toan_quoc',
    cookTimeMinutes: plan.parallelTotalMinutes,
    servings: plan.targetServings,
    difficulty: primary?.difficulty ?? 'medium',
    imageUrl: primary?.imageUrl ?? '',
    tags: ['Mâm cơm song song'],
    ingredients: plan.consolidatedIngredients.map((c) => ({
      ingredientId: c.ingredientId,
      name: c.name,
      requiredQuantity: c.totalQuantity,
      unit: c.unit,
    })),
    steps: plan.timelineSteps.map((tStep, idx) => ({
      stepNumber: idx + 1,
      instruction: `[${tStep.recipeTitle}] ${tStep.step.instruction}`,
      tip: tStep.parallelHintVi ?? tStep.step.tip,
      timerMinutes: tStep.step.timerMinutes,
    })),
  };
}

function persistSnapshot(state: CookingState) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (!state.runId || !state.activeRecipe) {
      window.localStorage.removeItem(COOKING_STORAGE_KEY_V4);
      return;
    }
    const payload: CookingDataSnapshot = {
      runId: state.runId,
      mode: state.mode,
      baseRecipe: state.baseRecipe,
      activeRecipe: state.activeRecipe,
      enrichedRecipeV4: state.enrichedRecipeV4,
      parallelRecipes: state.parallelRecipes,
      parallelPlan: state.parallelPlan,
      targetServings: state.targetServings,
      contentFingerprint: state.contentFingerprint,
      currentStepIndex: state.currentStepIndex,
      timerSecondsRemaining: state.timerSecondsRemaining,
      timerDeadline: state.timerDeadline,
      timerGeneration: state.timerGeneration,
      isTimerRunning: state.isTimerRunning,
      timers: state.timers,
      activeStepTimer: state.activeStepTimer,
      lastCompletedTimerId: state.lastCompletedTimerId,
      completedSteps: state.completedSteps,
      checkedIngredients: state.checkedIngredients,
      ingredientSwaps: state.ingredientSwaps,
      leftoverPortions: state.leftoverPortions,
      rating: state.rating,
      cookingNotes: state.cookingNotes,
      deductions: state.deductions,
      deductionInputs: state.deductionInputs,
      deductionErrors: state.deductionErrors,
      stockSnapshot: state.stockSnapshot,
      attempt: state.attempt,
    };
    window.localStorage.setItem(COOKING_STORAGE_KEY_V4, JSON.stringify(payload));
  } catch {
    // Ignore storage quota or private-browsing write errors
  }
}

function readHydratedSnapshot(): CookingDataSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(COOKING_STORAGE_KEY_V4);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookingDataSnapshot>;
    if (!parsed || typeof parsed.runId !== 'string' || !parsed.activeRecipe) {
      return null;
    }

    const now = Date.now();
    const hydratedTimers: Record<string, ActiveCookingTimer> = {};
    if (parsed.timers && typeof parsed.timers === 'object') {
      for (const [id, timer] of Object.entries(parsed.timers)) {
        if (!timer || typeof timer !== 'object') continue;
        if (timer.running && typeof timer.deadlineMs === 'number') {
          const rem = Math.max(0, Math.ceil((timer.deadlineMs - now) / 1000));
          hydratedTimers[id] = {
            ...timer,
            remainingSeconds: rem,
            running: rem > 0,
            deadlineMs: rem > 0 ? timer.deadlineMs : null,
            completed: rem === 0 ? true : Boolean(timer.completed),
          };
        } else {
          hydratedTimers[id] = timer;
        }
      }
    }

    let timerSecondsRemaining = parsed.timerSecondsRemaining ?? null;
    let timerDeadline = parsed.timerDeadline ?? null;
    let isTimerRunning = Boolean(parsed.isTimerRunning);
    if (isTimerRunning && typeof timerDeadline === 'number') {
      const rem = Math.max(0, Math.ceil((timerDeadline - now) / 1000));
      timerSecondsRemaining = rem;
      isTimerRunning = rem > 0;
      timerDeadline = rem > 0 ? timerDeadline : null;
    }

    const mode = parsed.mode === 'mam_com' ? 'mam_com' : 'single';
    const currentStepIndex = Math.max(0, Number(parsed.currentStepIndex ?? 0));
    const stepMeta = resolveCurrentStepTimerMeta(
      {
        mode,
        activeRecipe: parsed.activeRecipe,
        parallelPlan: parsed.parallelPlan ?? null,
      },
      currentStepIndex,
    );

    return {
      ...empty,
      ...parsed,
      mode,
      currentStepIndex,
      timers: hydratedTimers,
      activeStepTimer: stepMeta ? (hydratedTimers[stepMeta.timerId] ?? null) : null,
      timerSecondsRemaining,
      timerDeadline,
      isTimerRunning,
    };
  } catch {
    return null;
  }
}

const initialSnapshot = readHydratedSnapshot() ?? empty;

export const useCookingStore = create<CookingState>((set, get) => ({
  ...initialSnapshot,

  startCooking: (recipe, inventory, contentFingerprintOrOptions) => {
    const attempt = get().attempt;
    if (attempt && !['saved', 'queued'].includes(attempt.status)) return;

    const options: StartCookingOptionsV4 =
      typeof contentFingerprintOrOptions === 'string'
        ? { contentFingerprint: contentFingerprintOrOptions }
        : (contentFingerprintOrOptions ?? {});

    const requestedServings =
      options.targetServings &&
      Number.isFinite(options.targetServings) &&
      options.targetServings >= 1 &&
      options.targetServings <= 24
        ? Math.round(options.targetServings)
        : recipe.servings;

    const enriched =
      requestedServings !== recipe.servings
        ? scaleRecipeV4(recipe, requestedServings)
        : enrichRecipeToV4(recipe);

    const effectiveRecipe: Recipe =
      requestedServings !== recipe.servings
        ? {
            ...recipe,
            servings: requestedServings,
            ingredients: enriched.ingredients.map((line) => ({
              ingredientId: line.ingredientId,
              name: line.name,
              requiredQuantity: line.requiredQuantity,
              unit: line.unit,
              isOptional: line.isOptional,
            })),
          }
        : recipe;

    const { inputs, review } = draftDeductionsForRecipe(effectiveRecipe, inventory);

    set({
      ...empty,
      runId: createClientItemId('cooking_run'),
      mode: 'single',
      baseRecipe: recipe,
      activeRecipe: effectiveRecipe,
      enrichedRecipeV4: enriched,
      targetServings: effectiveRecipe.servings,
      contentFingerprint: options.contentFingerprint,
      stockSnapshot: inventory,
      deductionInputs: inputs,
      deductions: review.deductions,
      deductionErrors: review.errors,
    });
    persistSnapshot(get());
  },

  startMultiDishCooking: (recipes, inventory, targetServings) => {
    const attempt = get().attempt;
    if (attempt && !['saved', 'queued'].includes(attempt.status)) return;
    if (!recipes.length) return;

    const plan = buildParallelMamComTimeline(recipes, targetServings);
    const compositeRecipe = buildCompositeRecipeFromPlan(plan, recipes);
    const { inputs, review } = draftDeductionsForRecipe(compositeRecipe, inventory);

    set({
      ...empty,
      runId: createClientItemId('cooking_run'),
      mode: 'mam_com',
      baseRecipe: recipes[0],
      activeRecipe: compositeRecipe,
      enrichedRecipeV4: plan.dishes[0]?.enrichedRecipe ?? null,
      parallelRecipes: recipes.slice(0, 4),
      parallelPlan: plan,
      targetServings: plan.targetServings,
      stockSnapshot: inventory,
      deductionInputs: inputs,
      deductions: review.deductions,
      deductionErrors: review.errors,
    });
    persistSnapshot(get());
  },

  setTargetServings: (servings) => {
    const state = get();
    if (
      state.attempt ||
      !state.activeRecipe ||
      !Number.isFinite(servings) ||
      servings < 1 ||
      servings > 24
    ) {
      return;
    }
    const cleanServings = Math.round(servings);

    if (state.mode === 'mam_com' && state.parallelRecipes.length > 0) {
      const plan = buildParallelMamComTimeline(state.parallelRecipes, cleanServings);
      const compositeRecipe = buildCompositeRecipeFromPlan(plan, state.parallelRecipes);
      const { inputs, review } = draftDeductionsForRecipe(compositeRecipe, state.stockSnapshot);
      set({
        targetServings: cleanServings,
        parallelPlan: plan,
        activeRecipe: compositeRecipe,
        enrichedRecipeV4: plan.dishes[0]?.enrichedRecipe ?? null,
        deductionInputs: inputs,
        deductions: review.deductions,
        deductionErrors: review.errors,
      });
      persistSnapshot(get());
      return;
    }

    const source = state.baseRecipe ?? state.activeRecipe;
    const scaled = scaleRecipeV4(source, cleanServings);
    const updatedRecipe: Recipe = {
      ...state.activeRecipe,
      servings: cleanServings,
      ingredients: scaled.ingredients.map((line) => {
        const swap = state.ingredientSwaps[line.ingredientId];
        return swap
          ? {
              ingredientId: swap.ingredientId,
              name: swap.name,
              requiredQuantity: swap.requiredQuantity ?? line.requiredQuantity,
              unit: swap.unit ?? line.unit,
              isOptional: line.isOptional,
            }
          : {
              ingredientId: line.ingredientId,
              name: line.name,
              requiredQuantity: line.requiredQuantity,
              unit: line.unit,
              isOptional: line.isOptional,
            };
      }),
    };
    const { inputs, review } = draftDeductionsForRecipe(updatedRecipe, state.stockSnapshot);
    set({
      targetServings: cleanServings,
      activeRecipe: updatedRecipe,
      enrichedRecipeV4: scaled,
      deductionInputs: inputs,
      deductions: review.deductions,
      deductionErrors: review.errors,
    });
    persistSnapshot(get());
  },

  nextStep: () => {
    const state = get();
    const { activeRecipe, currentStepIndex, attempt, timers } = state;
    if (!attempt && activeRecipe && currentStepIndex < activeRecipe.steps.length - 1) {
      const nextIdx = currentStepIndex + 1;
      const meta = resolveCurrentStepTimerMeta(state, nextIdx);
      set({
        currentStepIndex: nextIdx,
        activeStepTimer: meta ? (timers[meta.timerId] ?? null) : null,
        ...stoppedTimer,
      });
      persistSnapshot(get());
    }
  },

  prevStep: () => {
    const state = get();
    const { currentStepIndex, attempt, timers } = state;
    if (!attempt && currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      const meta = resolveCurrentStepTimerMeta(state, prevIdx);
      set({
        currentStepIndex: prevIdx,
        activeStepTimer: meta ? (timers[meta.timerId] ?? null) : null,
        ...stoppedTimer,
      });
      persistSnapshot(get());
    }
  },

  goToStep: (stepIndex) => {
    const state = get();
    const { activeRecipe, attempt, timers } = state;
    if (
      attempt ||
      !activeRecipe ||
      !Number.isInteger(stepIndex) ||
      stepIndex < 0 ||
      stepIndex >= activeRecipe.steps.length
    ) {
      return;
    }
    const meta = resolveCurrentStepTimerMeta(state, stepIndex);
    set({
      currentStepIndex: stepIndex,
      activeStepTimer: meta ? (timers[meta.timerId] ?? null) : null,
      ...stoppedTimer,
    });
    persistSnapshot(get());
  },

  toggleStepCompleted: (key) => {
    if (!key) return;
    const prev = get().completedSteps;
    set({
      completedSteps: {
        ...prev,
        [key]: !prev[key],
      },
    });
    persistSnapshot(get());
  },

  toggleIngredientChecked: (key) => {
    if (!key) return;
    const prev = get().checkedIngredients;
    set({
      checkedIngredients: {
        ...prev,
        [key]: !prev[key],
      },
    });
    persistSnapshot(get());
  },

  applyIngredientSwap: (ingredientId, replacement) => {
    const state = get();
    if (!state.activeRecipe || state.attempt || !ingredientId || !replacement.ingredientId) return;

    const updatedIngredients = state.activeRecipe.ingredients.map((line) =>
      line.ingredientId === ingredientId
        ? {
            ...line,
            ingredientId: replacement.ingredientId,
            name: replacement.name,
            requiredQuantity: replacement.requiredQuantity ?? line.requiredQuantity,
            unit: replacement.unit ?? line.unit,
          }
        : line,
    );

    const updatedRecipe: Recipe = {
      ...state.activeRecipe,
      ingredients: updatedIngredients,
    };
    const { inputs, review } = draftDeductionsForRecipe(updatedRecipe, state.stockSnapshot);

    set({
      activeRecipe: updatedRecipe,
      enrichedRecipeV4: enrichRecipeToV4(updatedRecipe),
      ingredientSwaps: {
        ...state.ingredientSwaps,
        [ingredientId]: replacement,
      },
      deductionInputs: inputs,
      deductions: review.deductions,
      deductionErrors: review.errors,
    });
    persistSnapshot(get());
  },

  setTimer: (seconds, label) => {
    const state = get();
    if (!Number.isFinite(seconds) || seconds <= 0 || state.attempt) return;
    const duration = Math.ceil(seconds);
    const deadline = Date.now() + duration * 1000;
    const meta = resolveCurrentStepTimerMeta(state, state.currentStepIndex);

    const nextTimers = { ...state.timers };
    let activeStepTimer: ActiveCookingTimer | null = null;

    if (meta) {
      activeStepTimer = {
        id: meta.timerId,
        label: label?.trim() || meta.defaultLabel,
        recipeId: meta.recipeId,
        stepNumber: meta.stepNumber,
        durationSeconds: duration,
        remainingSeconds: duration,
        deadlineMs: deadline,
        running: true,
        completed: false,
      };
      nextTimers[meta.timerId] = activeStepTimer;
    }

    set({
      timerSecondsRemaining: duration,
      timerDeadline: deadline,
      isTimerRunning: true,
      timerGeneration: state.timerGeneration + 1,
      timers: nextTimers,
      activeStepTimer,
    });
    persistSnapshot(get());
  },

  tickTimer: () => {
    const state = get();
    const now = Date.now();
    let changed = false;

    let nextScalarRemaining = state.timerSecondsRemaining;
    let nextScalarRunning = state.isTimerRunning;
    let nextScalarDeadline = state.timerDeadline;

    if (state.isTimerRunning && state.timerDeadline !== null) {
      const remaining = Math.max(0, Math.ceil((state.timerDeadline - now) / 1000));
      if (remaining !== state.timerSecondsRemaining) {
        nextScalarRemaining = remaining;
        nextScalarRunning = remaining > 0;
        nextScalarDeadline = remaining > 0 ? state.timerDeadline : null;
        changed = true;
      }
    }

    let nextTimers = state.timers;
    let lastCompletedTimerId = state.lastCompletedTimerId;

    for (const [id, timer] of Object.entries(state.timers)) {
      if (!timer.running || timer.deadlineMs === null) continue;
      const rem = Math.max(0, Math.ceil((timer.deadlineMs - now) / 1000));
      if (rem !== timer.remainingSeconds || rem === 0) {
        if (nextTimers === state.timers) nextTimers = { ...state.timers };
        const finished = rem === 0;
        nextTimers[id] = {
          ...timer,
          remainingSeconds: rem,
          running: !finished,
          deadlineMs: finished ? null : timer.deadlineMs,
          completed: finished ? true : timer.completed,
        };
        if (finished) {
          lastCompletedTimerId = id;
        }
        changed = true;
      }
    }

    if (!changed) return;

    const meta = resolveCurrentStepTimerMeta(state, state.currentStepIndex);
    set({
      timerSecondsRemaining: nextScalarRemaining,
      isTimerRunning: nextScalarRunning,
      timerDeadline: nextScalarDeadline,
      timers: nextTimers,
      activeStepTimer: meta ? (nextTimers[meta.timerId] ?? null) : state.activeStepTimer,
      lastCompletedTimerId,
    });
  },

  toggleTimer: (timerId) => {
    get().tickTimer();
    const state = get();
    if (state.attempt) return;

    if (timerId) {
      const target = state.timers[timerId];
      if (!target || target.remainingSeconds === 0) return;
      const nowRunning = !target.running;
      const nextDeadline = nowRunning ? Date.now() + target.remainingSeconds * 1000 : null;
      const updatedTimer: ActiveCookingTimer = {
        ...target,
        running: nowRunning,
        deadlineMs: nextDeadline,
      };
      const nextTimers = { ...state.timers, [timerId]: updatedTimer };
      const meta = resolveCurrentStepTimerMeta(state, state.currentStepIndex);
      const isCurrentStep = meta?.timerId === timerId;

      set({
        timers: nextTimers,
        activeStepTimer: isCurrentStep ? updatedTimer : state.activeStepTimer,
        ...(isCurrentStep && state.timerSecondsRemaining !== null
          ? {
              isTimerRunning: nowRunning,
              timerDeadline: nextDeadline,
            }
          : {}),
      });
      persistSnapshot(get());
      return;
    }

    const { timerSecondsRemaining, isTimerRunning } = state;
    if (timerSecondsRemaining === null || timerSecondsRemaining === 0) return;
    const nowRunning = !isTimerRunning;
    const nextDeadline = nowRunning ? Date.now() + timerSecondsRemaining * 1000 : null;

    const meta = resolveCurrentStepTimerMeta(state, state.currentStepIndex);
    const nextTimers = { ...state.timers };
    let activeStepTimer = state.activeStepTimer;

    if (meta && nextTimers[meta.timerId]) {
      activeStepTimer = {
        ...nextTimers[meta.timerId],
        remainingSeconds: timerSecondsRemaining,
        running: nowRunning,
        deadlineMs: nextDeadline,
      };
      nextTimers[meta.timerId] = activeStepTimer;
    }

    set({
      isTimerRunning: nowRunning,
      timerDeadline: nextDeadline,
      timers: nextTimers,
      activeStepTimer,
    });
    persistSnapshot(get());
  },

  clearTimer: (timerId) => {
    const state = get();
    if (timerId) {
      const nextTimers = { ...state.timers };
      delete nextTimers[timerId];
      const meta = resolveCurrentStepTimerMeta(state, state.currentStepIndex);
      const isCurrent = meta?.timerId === timerId;
      set({
        timers: nextTimers,
        activeStepTimer: isCurrent ? null : state.activeStepTimer,
        ...(isCurrent ? stoppedTimer : {}),
      });
      persistSnapshot(get());
      return;
    }
    set(stoppedTimer);
    persistSnapshot(get());
  },

  addCustomTimer: (label, seconds) => {
    const state = get();
    if (!Number.isFinite(seconds) || seconds <= 0 || state.attempt) return null;
    const duration = Math.ceil(seconds);
    const id = createClientItemId('timer');
    const customTimer: ActiveCookingTimer = {
      id,
      label: label.trim() || 'Hẹn giờ bếp',
      recipeId: state.activeRecipe?.id ?? 'custom',
      stepNumber: state.currentStepIndex + 1,
      durationSeconds: duration,
      remainingSeconds: duration,
      deadlineMs: Date.now() + duration * 1000,
      running: true,
      completed: false,
    };
    set({
      timers: {
        ...state.timers,
        [id]: customTimer,
      },
    });
    persistSnapshot(get());
    return id;
  },

  extendTimer: (timerId, addSeconds) => {
    get().tickTimer();
    const state = get();
    const target = state.timers[timerId];
    if (!target || !Number.isFinite(addSeconds) || addSeconds === 0 || state.attempt) return;
    const delta = Math.round(addSeconds);
    const nextRemaining = Math.max(1, target.remainingSeconds + delta);
    const nextDuration = Math.max(nextRemaining, target.durationSeconds + Math.max(0, delta));
    const shouldRun = target.running || target.completed;
    const nextDeadline = shouldRun ? Date.now() + nextRemaining * 1000 : null;

    const updated: ActiveCookingTimer = {
      ...target,
      durationSeconds: nextDuration,
      remainingSeconds: nextRemaining,
      deadlineMs: nextDeadline,
      running: shouldRun,
      completed: false,
    };
    const nextTimers = { ...state.timers, [timerId]: updated };
    const meta = resolveCurrentStepTimerMeta(state, state.currentStepIndex);
    const isCurrent = meta?.timerId === timerId;

    set({
      timers: nextTimers,
      activeStepTimer: isCurrent ? updated : state.activeStepTimer,
      ...(isCurrent && state.timerSecondsRemaining !== null
        ? {
            timerSecondsRemaining: nextRemaining,
            timerDeadline: nextDeadline,
            isTimerRunning: shouldRun,
          }
        : {}),
    });
    persistSnapshot(get());
  },

  dismissTimer: (timerId) => {
    const state = get();
    if (!state.timers[timerId]) return;
    const nextTimers = { ...state.timers };
    delete nextTimers[timerId];
    const meta = resolveCurrentStepTimerMeta(state, state.currentStepIndex);
    set({
      timers: nextTimers,
      activeStepTimer: meta?.timerId === timerId ? null : state.activeStepTimer,
      lastCompletedTimerId:
        state.lastCompletedTimerId === timerId ? null : state.lastCompletedTimerId,
    });
    persistSnapshot(get());
  },

  setLeftoverPortions: (portions) => {
    if (!Number.isFinite(portions) || portions < 0) return;
    set({ leftoverPortions: Math.min(20, Math.round(portions)) });
    persistSnapshot(get());
  },

  setRating: (rating) => {
    if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) return;
    set({ rating: rating === null ? null : Math.round(rating) });
    persistSnapshot(get());
  },

  setCookingNotes: (notes) => {
    set({ cookingNotes: notes.slice(0, 1000) });
    persistSnapshot(get());
  },

  editDeduction: (index, input) => {
    const { activeRecipe, attempt, stockSnapshot, deductionInputs } = get();
    if (!activeRecipe || attempt || index < 0 || index >= deductionInputs.length) return;
    const inputs = deductionInputs.map((value, row) => (row === index ? input : value));
    const review = reviewCookingDeductions(activeRecipe, stockSnapshot, inputs);
    set({ deductionInputs: inputs, deductions: review.deductions, deductionErrors: review.errors });
    persistSnapshot(get());
  },

  updateDeduction: (ingredientId, quantity) => {
    if (!Number.isFinite(quantity) || quantity < 0) return;
    const index = get().deductions.findIndex((line) => line.ingredientId === ingredientId);
    get().editDeduction(index, String(quantity));
  },

  beginCompletion: () => {
    const state = get();
    if (
      !state.activeRecipe ||
      !state.runId ||
      state.deductionErrors.some(Boolean) ||
      (state.attempt && state.attempt.status !== 'uncertain')
    )
      return null;
    const attempt: CookingAttempt = state.attempt
      ? { ...state.attempt, status: 'sending', error: null }
      : {
          commandId: createClientItemId('cook'),
          contentFingerprint: state.contentFingerprint,
          servings: state.activeRecipe.servings,
          status: 'sending',
          error: null,
          deductions: state.deductions.map(({ ingredientId, name, quantityDeducted, unit }) => ({
            ingredientId,
            name,
            quantityDeducted,
            unit,
          })),
        };
    set({ attempt });
    persistSnapshot(get());
    return attempt;
  },

  finishCompletion: (runId, commandId, status, error) => {
    const state = get();
    if (state.runId === runId && state.attempt?.commandId === commandId) {
      set({ attempt: { ...state.attempt, status, error: error ?? null } });
      persistSnapshot(get());
    }
  },

  refreshStock: (inventory) => {
    const { activeRecipe, deductionInputs, attempt } = get();
    if (!activeRecipe || attempt?.status !== 'rejected') return;
    const review = reviewCookingDeductions(activeRecipe, inventory, deductionInputs);
    set({
      stockSnapshot: inventory,
      attempt: null,
      deductions: review.deductions,
      deductionErrors: review.errors,
    });
    persistSnapshot(get());
  },

  hydrateSessionFromStorage: () => {
    const hydrated = readHydratedSnapshot();
    if (!hydrated) return false;
    set(hydrated);
    return true;
  },

  resetCooking: () => {
    set(empty);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(COOKING_STORAGE_KEY_V4);
      } catch {
        // Ignore
      }
    }
  },
}));

onPrivateSessionReset(() => useCookingStore.getState().resetCooking());
