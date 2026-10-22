import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import type { CulinaryTechniqueId, CulinaryTechniqueMeta } from '../../lib/culinary-visuals';
import { TakosanIcon, type TakosanIconName } from '../common/TakosanIcon';
import { isMealPlannerEnabled } from '../../features/planner/feature';

export const CookingTechniqueVisual: React.FC<{
  technique: CulinaryTechniqueMeta;
  stepNumber?: number;
  variant?: 'card' | 'stage';
}> = ({ technique, stepNumber, variant = 'card' }) => (
  <div
    className={`culinary-technique-visual culinary-technique-${technique.id} culinary-variant-${variant}`}
    data-technique={technique.id}
    aria-hidden="true"
  >
    <div className="culinary-technique-artwork">{renderTechniqueSvg(technique.id)}</div>
    <div className="culinary-technique-meta">
      <div className="culinary-technique-badges">
        {typeof stepNumber === 'number' && (
          <span className="culinary-step-pill">Bước {String(stepNumber).padStart(2, '0')}</span>
        )}
        <span className="culinary-technique-pill">{technique.label}</span>
      </div>
      <div className="culinary-technique-sub">
        <span className="culinary-sub-item">
          <TakosanIcon name="chef" className="w-3.5 h-3.5" />
          {technique.toolLabel}
        </span>
        <span className="culinary-sub-dot">·</span>
        <span className="culinary-sub-item">
          <TakosanIcon name="ingredient" className="w-3.5 h-3.5" />
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
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <rect x="20" y="30" width="68" height="36" rx="8" fill="var(--takosan-yellow)" fillOpacity="0.28" stroke="var(--kitchen-pine)" strokeWidth="2.5" />
          <circle cx="30" cy="48" r="3.5" fill="var(--kitchen-pine)" />
          <circle cx="52" cy="46" r="10" fill="var(--takosan-coral)" />
          <circle cx="52" cy="46" r="5" fill="var(--takosan-cream)" />
          <path d="M68 38C74 36 79 41 77 47C75 53 68 55 64 50C61 46 63 40 68 38Z" fill="var(--kitchen-pine)" />
          <path d="M42 22L88 22C90 22 92 24 90 27L76 34L42 28Z" fill="var(--takosan-navy)" />
        </svg>
      );
    case 'marinate':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <path d="M28 42H92C92 58 78 68 60 68C42 68 28 58 28 42Z" fill="var(--takosan-mint)" stroke="var(--kitchen-pine)" strokeWidth="2.5" />
          <ellipse cx="60" cy="42" rx="32" ry="6" fill="var(--takosan-cream)" stroke="var(--kitchen-pine)" strokeWidth="2" />
          <circle cx="48" cy="26" r="3.5" fill="var(--takosan-coral)" />
          <circle cx="62" cy="22" r="4" fill="var(--takosan-yellow)" />
          <circle cx="74" cy="28" r="3" fill="var(--kitchen-pine)" />
          <path d="M52 33L58 41M68 32L63 41" stroke="var(--takosan-coral)" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'saute':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <path d="M22 46H82C80 59 68 65 52 65C36 65 24 59 22 46Z" fill="var(--takosan-navy)" />
          <path d="M80 47L102 41" stroke="var(--takosan-coral)" strokeWidth="5" strokeLinecap="round" />
          <circle cx="44" cy="35" r="5" fill="var(--takosan-coral)" />
          <circle cx="58" cy="30" r="4.5" fill="var(--takosan-yellow)" />
          <circle cx="68" cy="37" r="4" fill="var(--kitchen-pine)" />
          <path d="M38 24C38 20 42 18 42 14M56 22C56 18 60 16 60 12" stroke="var(--kitchen-pine)" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'simmer':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <rect x="30" y="36" width="60" height="30" rx="10" fill="var(--takosan-coral)" stroke="var(--takosan-navy)" strokeWidth="2.5" />
          <path d="M23 44H30M90 44H97" stroke="var(--takosan-navy)" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M34 36C38 28 82 28 86 36Z" fill="var(--takosan-yellow)" stroke="var(--takosan-navy)" strokeWidth="2" />
          <circle cx="60" cy="26" r="4" fill="var(--takosan-navy)" />
          <path d="M48 72C50 68 54 68 56 72M64 72C66 68 70 68 72 72" stroke="var(--takosan-coral)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'boil':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <rect x="30" y="36" width="60" height="30" rx="8" fill="var(--takosan-mint)" stroke="var(--kitchen-pine)" strokeWidth="2.5" />
          <path d="M23 42H30M90 42H97" stroke="var(--kitchen-pine)" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="46" cy="48" r="3.5" fill="var(--kitchen-pine)" />
          <circle cx="60" cy="52" r="4.5" fill="var(--takosan-coral)" />
          <circle cx="73" cy="47" r="3.5" fill="var(--kitchen-pine)" />
          <path d="M46 28C46 23 50 21 50 16M60 26C60 21 64 19 64 14M74 28C74 23 78 21 78 16" stroke="var(--kitchen-pine)" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'steam':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <rect x="28" y="44" width="64" height="22" rx="8" fill="var(--kitchen-pine)" />
          <rect x="30" y="34" width="60" height="12" rx="4" fill="var(--takosan-mint)" stroke="var(--kitchen-pine)" strokeWidth="2" />
          <circle cx="44" cy="40" r="2" fill="var(--kitchen-pine)" />
          <circle cx="60" cy="40" r="2" fill="var(--kitchen-pine)" />
          <circle cx="76" cy="40" r="2" fill="var(--kitchen-pine)" />
          <path d="M44 28C44 23 48 20 48 15M60 26C60 21 64 18 64 13M76 28C76 23 80 20 80 15" stroke="var(--kitchen-pine)" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'fry':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <ellipse cx="54" cy="48" rx="30" ry="16" fill="var(--takosan-navy)" />
          <ellipse cx="54" cy="48" rx="23" ry="11" fill="var(--takosan-yellow)" fillOpacity="0.45" />
          <circle cx="46" cy="47" r="6" fill="var(--takosan-coral)" />
          <circle cx="62" cy="49" r="6" fill="var(--takosan-coral)" />
          <path d="M84 48L104 42" stroke="var(--takosan-navy)" strokeWidth="5" strokeLinecap="round" />
        </svg>
      );
    case 'season':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <path d="M34 54C34 61 42 66 52 66C62 66 70 61 70 54H34Z" fill="var(--takosan-coral)" />
          <path d="M68 54L92 26" stroke="var(--takosan-navy)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="46" cy="36" r="3.5" fill="var(--kitchen-pine)" />
          <circle cx="56" cy="30" r="3" fill="var(--takosan-yellow)" />
          <circle cx="52" cy="42" r="2.5" fill="var(--takosan-coral)" />
        </svg>
      );
    case 'plate':
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <circle cx="60" cy="46" r="26" fill="var(--takosan-mint)" stroke="var(--kitchen-pine)" strokeWidth="2.5" />
          <circle cx="60" cy="46" r="17" fill="var(--takosan-cream)" stroke="var(--kitchen-pine)" strokeWidth="1.8" />
          <circle cx="54" cy="44" r="6" fill="var(--takosan-coral)" />
          <circle cx="66" cy="48" r="5" fill="var(--takosan-yellow)" />
          <path d="M56 38C59 34 65 35 66 40" stroke="var(--kitchen-pine)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'general':
    default:
      return (
        <svg viewBox="0 0 120 88" width="120" height="88" fill="none">
          <rect x="8" y="12" width="104" height="64" rx="16" fill="var(--takosan-cream)" />
          <rect x="28" y="28" width="64" height="36" rx="12" fill="var(--takosan-mint)" stroke="var(--takosan-navy)" strokeWidth="2.2" />
          <circle cx="48" cy="46" r="6" fill="var(--takosan-coral)" />
          <circle cx="64" cy="46" r="5" fill="var(--takosan-yellow)" />
          <path d="M76 38L84 54" stroke="var(--kitchen-pine)" strokeWidth="2.5" strokeLinecap="round" />
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
    <rect x="16" y="14" width="288" height="172" rx="28" fill="var(--takosan-cream)" />
    <circle cx="72" cy="46" r="22" fill="var(--takosan-mint)" />
    <circle cx="252" cy="148" r="28" fill="var(--takosan-coral)" fillOpacity="0.14" />
    <path d="M188 28L268 62" stroke="var(--takosan-navy)" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M182 38L266 74" stroke="var(--takosan-coral)" strokeWidth="4.5" strokeLinecap="round" />
    <ellipse cx="154" cy="138" rx="76" ry="18" fill="var(--takosan-mint)" />
    <path d="M88 96H220C216 128 190 144 154 144C118 144 92 128 88 96Z" fill="var(--takosan-navy)" />
    <ellipse cx="154" cy="96" rx="66" ry="18" fill="var(--takosan-cream)" stroke="var(--takosan-navy)" strokeWidth="3" />
    <circle cx="132" cy="95" r="12" fill="var(--takosan-coral)" />
    <circle cx="162" cy="92" r="11" fill="var(--takosan-yellow)" />
    <circle cx="182" cy="99" r="9" fill="var(--kitchen-pine)" />
    <path d="M140 88C146 80 158 80 164 88" stroke="var(--kitchen-pine)" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M126 64C126 54 134 50 134 40M154 58C154 48 162 44 162 34M182 64C182 54 190 50 190 40" stroke="var(--kitchen-pine)" strokeWidth="3" strokeLinecap="round" />
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
  <div className="kitchen-loop-strip" data-loop-stage={activeStage}>
    <div className="kitchen-loop-header">
      <span className="kitchen-loop-badge">
        <TakosanIcon name="aiSuggestion" className="w-4 h-4" />
        Chu trình bếp khép kín Takolio
      </span>
      {summaryText && <span className="kitchen-loop-summary">{summaryText}</span>}
    </div>
    <div className="kitchen-loop-steps">
      {LOOP_STEPS.map((step) => {
        const isCurrent = step.id === activeStage;
        return (
          <Link
            key={step.id}
            to={step.getPath()}
            className={`kitchen-loop-step${isCurrent ? ' kitchen-loop-step-active' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="kitchen-loop-step-icon">
              <TakosanIcon name={step.icon} className="w-5 h-5" />
            </span>
            <span className="kitchen-loop-step-copy">
              <span className="kitchen-loop-step-title">
                {step.label}
                {isCurrent && <CheckCircle2 size={13} aria-hidden="true" />}
              </span>
              <span className="kitchen-loop-step-sub">{step.sublabel}</span>
            </span>
          </Link>
        );
      })}
    </div>
  </div>
);
