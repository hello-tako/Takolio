import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { CulinaryTechniqueId, CulinaryTechniqueMeta } from '../../lib/culinary-visuals';
import { TakosanIcon, type TakosanIconName } from '../common/TakosanIcon';
import { isMealPlannerEnabled } from '../../features/planner/feature';

export const CookingTechniqueVisual: React.FC<{
  technique: CulinaryTechniqueMeta;
  stepNumber?: number;
  variant?: 'card' | 'stage';
}> = ({ technique, stepNumber, variant = 'card' }) => (
  <div
    className={clsx(
      `culinary-technique-visual culinary-technique-${technique.id} culinary-variant-${variant}`,
      'flex items-center gap-3.5 rounded-2xl border border-tk-stone/80 bg-tk-canvas/90 p-3 text-tk-ink',
    )}
    data-technique={technique.id}
    aria-hidden="true"
  >
    <div className="culinary-technique-artwork shrink-0 overflow-hidden rounded-xl border border-tk-stone/60 bg-white shadow-xs">
      {renderTechniqueSvg(technique.id)}
    </div>
    <div className="culinary-technique-meta min-w-0 flex-1">
      <div className="culinary-technique-badges flex flex-wrap items-center gap-1.5">
        {typeof stepNumber === 'number' && (
          <span className="culinary-step-pill inline-flex items-center rounded-full bg-tk-jade px-2.5 py-0.5 text-[11px] font-extrabold text-white tk-tabular">
            Bước {String(stepNumber).padStart(2, '0')}
          </span>
        )}
        <span className="culinary-technique-pill inline-flex items-center rounded-full bg-tk-flame-soft px-2.5 py-0.5 text-[11px] font-bold text-tk-flame-deep border border-tk-flame/20">
          {technique.label}
        </span>
      </div>
      <div className="culinary-technique-sub mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-tk-secondary">
        <span className="culinary-sub-item inline-flex items-center gap-1">
          <TakosanIcon name="chef" className="w-3.5 h-3.5 text-tk-jade" />
          {technique.toolLabel}
        </span>
        <span className="culinary-sub-dot text-tk-muted">·</span>
        <span className="culinary-sub-item inline-flex items-center gap-1">
          <TakosanIcon name="ingredient" className="w-3.5 h-3.5 text-tk-flame" />
          {technique.heatLabel}
        </span>
      </div>
    </div>
  </div>
);

function renderTechniqueSvg(id: CulinaryTechniqueId) {
  switch (id) {
    case 'prep':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <rect x="20" y="30" width="68" height="36" rx="8" fill="#D48817" fillOpacity="0.22" stroke="#1B6B4A" strokeWidth="2.4" />
          <circle cx="30" cy="48" r="3.5" fill="#1B6B4A" />
          <circle cx="52" cy="46" r="10" fill="#E5533D" />
          <circle cx="52" cy="46" r="5" fill="#FBF8F3" />
          <path d="M68 38C74 36 79 41 77 47C75 53 68 55 64 50C61 46 63 40 68 38Z" fill="#1B6B4A" />
          <path d="M42 22L88 22C90 22 92 24 90 27L76 34L42 28Z" fill="#121E1A" />
        </svg>
      );
    case 'marinate':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <path d="M28 42H92C92 58 78 68 60 68C42 68 28 58 28 42Z" fill="#E8F5EE" stroke="#1B6B4A" strokeWidth="2.4" />
          <ellipse cx="60" cy="42" rx="32" ry="6" fill="#FBF8F3" stroke="#1B6B4A" strokeWidth="2" />
          <circle cx="48" cy="26" r="3.5" fill="#E5533D" />
          <circle cx="62" cy="22" r="4" fill="#D48817" />
          <circle cx="74" cy="28" r="3" fill="#1B6B4A" />
          <path d="M52 33L58 41M68 32L63 41" stroke="#E5533D" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'saute':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <path d="M22 46H82C80 59 68 65 52 65C36 65 24 59 22 46Z" fill="#121E1A" />
          <path d="M80 47L102 41" stroke="#E5533D" strokeWidth="5" strokeLinecap="round" />
          <circle cx="44" cy="35" r="5" fill="#E5533D" />
          <circle cx="58" cy="30" r="4.5" fill="#D48817" />
          <circle cx="68" cy="37" r="4" fill="#1B6B4A" />
          <path d="M38 24C38 20 42 18 42 14M56 22C56 18 60 16 60 12" stroke="#1B6B4A" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'simmer':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <rect x="30" y="36" width="60" height="30" rx="10" fill="#E5533D" stroke="#121E1A" strokeWidth="2.4" />
          <path d="M23 44H30M90 44H97" stroke="#121E1A" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M34 36C38 28 82 28 86 36Z" fill="#D48817" stroke="#121E1A" strokeWidth="2" />
          <circle cx="60" cy="26" r="4" fill="#121E1A" />
          <path d="M48 72C50 68 54 68 56 72M64 72C66 68 70 68 72 72" stroke="#E5533D" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'boil':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <rect x="30" y="36" width="60" height="30" rx="8" fill="#E8F5EE" stroke="#1B6B4A" strokeWidth="2.4" />
          <path d="M23 42H30M90 42H97" stroke="#1B6B4A" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="46" cy="48" r="3.5" fill="#1B6B4A" />
          <circle cx="60" cy="52" r="4.5" fill="#E5533D" />
          <circle cx="73" cy="47" r="3.5" fill="#1B6B4A" />
          <path d="M46 28C46 23 50 21 50 16M60 26C60 21 64 19 64 14M74 28C74 23 78 21 78 16" stroke="#1B6B4A" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'steam':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <rect x="28" y="44" width="64" height="22" rx="8" fill="#1B6B4A" />
          <rect x="30" y="34" width="60" height="12" rx="4" fill="#E8F5EE" stroke="#1B6B4A" strokeWidth="2" />
          <circle cx="44" cy="40" r="2" fill="#1B6B4A" />
          <circle cx="60" cy="40" r="2" fill="#1B6B4A" />
          <circle cx="76" cy="40" r="2" fill="#1B6B4A" />
          <path d="M44 28C44 23 48 20 48 15M60 26C60 21 64 18 64 13M76 28C76 23 80 20 80 15" stroke="#1B6B4A" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'fry':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <ellipse cx="54" cy="48" rx="30" ry="16" fill="#121E1A" />
          <ellipse cx="54" cy="48" rx="23" ry="11" fill="#D48817" fillOpacity="0.45" />
          <circle cx="46" cy="47" r="6" fill="#E5533D" />
          <circle cx="62" cy="49" r="6" fill="#E5533D" />
          <path d="M84 48L104 42" stroke="#121E1A" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case 'season':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <path d="M34 54C34 61 42 66 52 66C62 66 70 61 70 54H34Z" fill="#E5533D" />
          <path d="M68 54L92 26" stroke="#121E1A" strokeWidth="4" strokeLinecap="round" />
          <circle cx="46" cy="36" r="3.5" fill="#1B6B4A" />
          <circle cx="56" cy="30" r="3" fill="#D48817" />
          <circle cx="52" cy="42" r="2.5" fill="#E5533D" />
        </svg>
      );
    case 'plate':
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <circle cx="60" cy="46" r="26" fill="#E8F5EE" stroke="#1B6B4A" strokeWidth="2.4" />
          <circle cx="60" cy="46" r="17" fill="#FBF8F3" stroke="#1B6B4A" strokeWidth="1.8" />
          <circle cx="54" cy="44" r="6" fill="#E5533D" />
          <circle cx="66" cy="48" r="5" fill="#D48817" />
          <path d="M56 38C59 34 65 35 66 40" stroke="#1B6B4A" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case 'general':
    default:
      return (
        <svg viewBox="0 0 120 88" width="96" height="70" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="#FBF8F3" />
          <rect x="28" y="28" width="64" height="36" rx="12" fill="#E8F5EE" stroke="#121E1A" strokeWidth="2.2" />
          <circle cx="48" cy="46" r="6" fill="#E5533D" />
          <circle cx="64" cy="46" r="5" fill="#D48817" />
          <path d="M76 38L84 54" stroke="#1B6B4A" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
  }
}

export const RecipeDishIllustration: React.FC<{ title?: string }> = () => (
  <svg
    className="recipe-dish-illustration"
    viewBox="0 0 320 200"
    width="220"
    height="138"
    fill="none"
    aria-hidden="true"
  >
    <rect x="16" y="14" width="288" height="172" rx="28" fill="#FBF8F3" />
    <circle cx="72" cy="46" r="22" fill="#E8F5EE" />
    <circle cx="252" cy="148" r="28" fill="#E5533D" fillOpacity="0.14" />
    <path d="M188 28L268 62" stroke="#121E1A" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M182 38L266 74" stroke="#E5533D" strokeWidth="4.5" strokeLinecap="round" />
    <ellipse cx="154" cy="138" rx="76" ry="18" fill="#E8F5EE" />
    <path d="M88 96H220C216 128 190 144 154 144C118 144 92 128 88 96Z" fill="#121E1A" />
    <ellipse cx="154" cy="96" rx="66" ry="18" fill="#FBF8F3" stroke="#121E1A" strokeWidth="3" />
    <circle cx="132" cy="95" r="12" fill="#E5533D" />
    <circle cx="162" cy="92" r="11" fill="#D48817" />
    <circle cx="182" cy="99" r="9" fill="#1B6B4A" />
    <path d="M140 88C146 80 158 80 164 88" stroke="#1B6B4A" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M126 64C126 54 134 50 134 40M154 58C154 48 162 44 162 34M182 64C182 54 190 50 190 40" stroke="#1B6B4A" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export type KitchenLoopStage = 'fridge' | 'recipes' | 'plan' | 'shopping' | 'cooking';

const LOOP_STEPS: Array<{
  id: KitchenLoopStage;
  label: string;
  sublabel: string;
  icon: TakosanIconName;
  getPath: () => string;
}> = [
  { id: 'fridge', label: '1. Tủ lạnh', sublabel: 'Kiểm tra đồ sẵn có', icon: 'fridge', getPath: () => '/fridge' },
  { id: 'recipes', label: '2. Chọn món', sublabel: 'Khớp nguyên liệu', icon: 'recipe', getPath: () => '/recipes' },
  { id: 'plan', label: '3. Thực đơn', sublabel: 'Xếp lịch bữa ăn', icon: 'mealPlan', getPath: () => (isMealPlannerEnabled() ? '/planner' : '/week') },
  { id: 'shopping', label: '4. Đi chợ', sublabel: 'Mua đúng phần thiếu', icon: 'shopping', getPath: () => '/shopping' },
];

export const KitchenLoopStrip: React.FC<{
  activeStage: KitchenLoopStage;
  summaryText?: string;
}> = ({ activeStage, summaryText }) => (
  <div
    className="kitchen-loop-strip rounded-2xl border border-tk-stone/80 bg-white/85 p-3.5 shadow-xs backdrop-blur-sm"
    data-loop-stage={activeStage}
  >
    <div className="kitchen-loop-header flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-tk-stone/60">
      <span className="kitchen-loop-badge inline-flex items-center gap-1.5 rounded-full bg-tk-jade-soft px-2.5 py-0.5 text-xs font-bold text-tk-jade-deep">
        <TakosanIcon name="aiSuggestion" className="w-4 h-4" />
        Chu trình bếp khép kín Takolio
      </span>
      {summaryText && (
        <span className="kitchen-loop-summary text-xs font-semibold text-tk-secondary">
          {summaryText}
        </span>
      )}
    </div>
    <div className="kitchen-loop-steps mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {LOOP_STEPS.map((step) => {
        const isCurrent = step.id === activeStage;
        return (
          <Link
            key={step.id}
            to={step.getPath()}
            className={clsx(
              'kitchen-loop-step flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-tap',
              isCurrent
                ? 'kitchen-loop-step-active border-tk-jade/30 bg-tk-jade-soft/70 text-tk-jade-deep shadow-xs'
                : 'border-tk-stone/60 bg-tk-canvas/60 text-tk-secondary hover:border-tk-stone hover:bg-tk-sunken/60 hover:text-tk-ink',
            )}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span
              className={clsx(
                'kitchen-loop-step-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                isCurrent ? 'bg-tk-jade text-white' : 'bg-white text-tk-secondary border border-tk-stone/70',
              )}
            >
              <TakosanIcon name={step.icon} className="w-4 h-4" />
            </span>
            <span className="kitchen-loop-step-copy min-w-0 flex flex-col">
              <span className="kitchen-loop-step-title flex items-center gap-1 text-xs font-bold truncate">
                {step.label}
                {isCurrent && <CheckCircle2 size={13} aria-hidden="true" className="shrink-0 text-tk-jade" />}
              </span>
              <span className="kitchen-loop-step-sub text-[11px] opacity-80 truncate">
                {step.sublabel}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  </div>
);
