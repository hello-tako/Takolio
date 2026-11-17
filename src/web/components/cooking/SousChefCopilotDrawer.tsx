import React, { useMemo, useState } from 'react';
import { AlertTriangle, Send, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import {
  ActionButton,
  AtelierBadge,
  SlideDrawer,
} from '../../design-system/v4/AtelierPrimitives';
import {
  AiSousChefSparkIcon,
  FreshnessShieldIcon,
  MultiTimerIcon,
} from '../../design-system/icons';
import { TakoChef3D } from '../3d';
import {
  aiCopilotApi,
  getContextualCookingPresets,
  type CulinaryFridgeItem,
  type SousChefResponse,
} from '../../services/ai-copilot';

interface SousChefCopilotDrawerProps {
  open: boolean;
  onClose: () => void;
  dark?: boolean;
  recipeTitle: string;
  currentStepNumber: number;
  currentStepText: string;
  heatLevel?: string;
  servings: number;
  recipeIngredients: Array<{ name: string; quantity: number; unit: string }>;
  fridgeItems?: CulinaryFridgeItem[];
  householdAllergens?: string[];
  onStartSuggestedTimer: (seconds: number, label: string) => void;
}

interface ChatTurn {
  id: string;
  question: string;
  response: SousChefResponse;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  if (!text || !text.includes('**')) return text;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-extrabold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const SousChefCopilotDrawer: React.FC<SousChefCopilotDrawerProps> = ({
  open,
  onClose,
  dark = true,
  recipeTitle,
  currentStepNumber,
  currentStepText,
  heatLevel,
  servings,
  recipeIngredients,
  fridgeItems,
  householdAllergens,
  onStartSuggestedTimer,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatTurn[]>([]);

  const presets = useMemo(
    () => getContextualCookingPresets({ recipeTitle, currentStepText }),
    [recipeTitle, currentStepText],
  );

  const ask = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await aiCopilotApi.askSousChef({
        question: trimmed,
        recipeTitle,
        currentStepNumber,
        currentStepText,
        heatLevel,
        servings,
        recipeIngredients,
        fridgeItems,
        householdAllergens,
      });
      setHistory((prev) => [
        {
          id: `${Date.now()}-${prev.length}`,
          question: trimmed,
          response,
        },
        ...prev,
      ]);
      setQuestion('');
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Chưa kết nối được Trợ lý Bếp Trưởng. Vui lòng thử lại.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideDrawer
      open={open}
      onClose={onClose}
      dark={dark}
      widthClass="max-w-xl"
      title="Trợ lý Bếp Trưởng AI Tako"
      subtitle={`Đang đồng hành Bước ${currentStepNumber} · ${recipeTitle}`}
      footer={
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Hỏi nhanh: Món hơi mặn? Chín tới chưa? Đổi nồi?"
            maxLength={400}
            className={clsx(
              'min-h-[48px] flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-tk-flame',
              dark
                ? 'border-white/15 bg-tk-sanctuary-elevated text-white placeholder:text-white/45'
                : 'border-tk-stone bg-tk-canvas text-tk-ink placeholder:text-tk-muted',
            )}
          />
          <ActionButton
            type="submit"
            variant="flame"
            size="md"
            loading={loading}
            disabled={!question.trim()}
            icon={<Send size={16} aria-hidden="true" />}
          >
            Hỏi
          </ActionButton>
        </form>
      }
    >
      <div className="space-y-5">
        {/* 3D Tako Chef Companion Header Card */}
        <div
          className={clsx(
            'flex items-center gap-4 rounded-3xl border p-4',
            dark
              ? 'border-white/12 bg-gradient-to-br from-tk-sanctuary-elevated to-tk-sanctuary'
              : 'border-tk-stone bg-gradient-to-br from-white to-tk-flame-soft/45',
          )}
        >
          <div className="shrink-0">
            <TakoChef3D pose="cook" size={96} interactive={false} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <AtelierBadge
              tone={dark ? 'dark' : 'jade'}
              icon={<AiSousChefSparkIcon size={14} tone={dark ? 'cream' : 'jade'} />}
            >
              Sous-Chef Trực Chiến · {servings} khẩu phần
            </AtelierBadge>
            <p className="text-sm font-bold leading-snug">
              Tako đang theo dõi Bước {currentStepNumber}. Chạm câu hỏi 1 chạm bên dưới để xử lý tình huống ngay trên bếp!
            </p>
            <p
              className={clsx(
                'line-clamp-2 text-xs',
                dark ? 'text-white/65' : 'text-tk-secondary',
              )}
            >
              “{currentStepText}”
            </p>
          </div>
        </div>

        {/* 1-Tap Contextual Quick Chips */}
        <div className="space-y-2">
          <p
            className={clsx(
              'text-xs font-extrabold uppercase tracking-wider',
              dark ? 'text-white/70' : 'text-tk-secondary',
            )}
          >
            Tình huống bếp 1 chạm cho bước này
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={loading}
                onClick={() => void ask(preset.questionTemplateVi)}
                className={clsx(
                  'flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-left text-xs sm:text-sm font-bold transition-tap cursor-pointer min-h-[46px]',
                  dark
                    ? 'border-white/12 bg-white/6 text-white hover:border-tk-flame/60 hover:bg-white/12'
                    : 'border-tk-stone bg-white text-tk-ink shadow-2xs hover:border-tk-flame/40 hover:bg-tk-flame-soft/40',
                )}
              >
                <span className="text-base shrink-0" aria-hidden="true">
                  {preset.icon}
                </span>
                <span className="leading-snug">{preset.labelVi}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border border-tk-berry/40 bg-tk-berry-soft px-4 py-3 text-xs font-bold text-tk-berry-deep"
          >
            {error}
          </div>
        )}

        {loading && (
          <div
            role="status"
            className={clsx(
              'rounded-2xl border p-4 text-sm font-semibold animate-pulse',
              dark
                ? 'border-tk-flame/35 bg-tk-flame/15 text-tk-flame-soft'
                : 'border-tk-flame/25 bg-tk-flame-soft text-tk-flame-deep',
            )}
          >
            Bếp Trưởng Tako đang phân tích nhiệt độ, gia vị và nguyên liệu trong tủ lạnh…
          </div>
        )}

        {/* Structured AI Sous-Chef Answers */}
        {history.length > 0 && (
          <div className="space-y-4">
            {history.map((turn) => {
              const { response } = turn;
              const timerSeconds = response.suggestedTimerSeconds;

              return (
                <article
                  key={turn.id}
                  className={clsx(
                    'rounded-3xl border p-4 space-y-3 animate-slide-up',
                    dark
                      ? 'border-white/12 bg-tk-sanctuary-elevated/90 text-white'
                      : 'border-tk-stone bg-white text-tk-ink shadow-card',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-current/10 pb-2.5">
                    <p
                      className={clsx(
                        'text-xs font-bold',
                        dark ? 'text-tk-turmeric-glow' : 'text-tk-flame-deep',
                      )}
                    >
                      Hỏi: “{turn.question}”
                    </p>
                  </div>

                  {response.quickActionTitle && (
                    <h4 className="text-sm sm:text-base font-extrabold tracking-tight">
                      {response.quickActionTitle}
                    </h4>
                  )}

                  <p className="text-sm leading-relaxed whitespace-pre-line">
                    {renderInlineMarkdown(response.answerVi)}
                  </p>

                  {response.chefSecretVi && (
                    <div
                      className={clsx(
                        'rounded-2xl border p-3 text-xs leading-relaxed',
                        dark
                          ? 'border-tk-turmeric-glow/30 bg-tk-turmeric/15 text-tk-turmeric-soft'
                          : 'border-tk-turmeric/30 bg-tk-turmeric-soft text-tk-turmeric-deep',
                      )}
                    >
                      <p className="font-extrabold flex items-center gap-1.5 mb-1">
                        <Sparkles size={13} aria-hidden="true" />
                        Bí quyết Bếp Trưởng Tako
                      </p>
                      <p>{renderInlineMarkdown(response.chefSecretVi)}</p>
                    </div>
                  )}

                  {response.safetyAlertVi && (
                    <div className="rounded-2xl border border-tk-berry/40 bg-tk-berry-soft p-3 text-xs font-semibold text-tk-berry-deep flex items-start gap-2">
                      <AlertTriangle size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{renderInlineMarkdown(response.safetyAlertVi)}</span>
                    </div>
                  )}

                  {response.safeSubstitutions && response.safeSubstitutions.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-xs font-extrabold opacity-80">
                        Nguyên liệu thay thế an toàn:
                      </p>
                      <div className="space-y-1.5">
                        {response.safeSubstitutions.map((sub, idx) => (
                          <div
                            key={`${sub.replacement}-${idx}`}
                            className={clsx(
                              'rounded-xl border px-3 py-2 text-xs',
                              dark ? 'border-white/10 bg-black/20' : 'border-tk-stone bg-tk-canvas',
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-extrabold">{sub.replacement}</span>
                              <span className="opacity-65">(thay {sub.missing})</span>
                              {sub.inFridge && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-tk-jade px-2 py-0.5 text-[10px] font-extrabold text-white">
                                  <FreshnessShieldIcon size={11} tone="cream" />
                                  Có sẵn trong tủ lạnh
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 opacity-80">{sub.ratioNoteVi}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {timerSeconds && timerSeconds > 0 && (
                    <div className="pt-1">
                      <ActionButton
                        variant="flame"
                        size="md"
                        fullWidth
                        icon={<MultiTimerIcon size={17} tone="cream" />}
                        onClick={() => {
                          onStartSuggestedTimer(
                            timerSeconds,
                            response.quickActionTitle || `Gợi ý AI · Bước ${currentStepNumber}`,
                          );
                          onClose();
                        }}
                      >
                        Bấm hẹn giờ gợi ý ({Math.max(1, Math.round(timerSeconds / 60))} phút)
                      </ActionButton>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </SlideDrawer>
  );
};
