import { Clock, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { evaluateRecipeDietarySafetyV4, type Recipe, type RecipeMatchResult } from '@frigo/recipes';
import type { DiscoveryItem } from '../../../../packages/recipes/src/discovery-contract';
import { resolveRecipeImage, resolveRecipeImageV4 } from '../../lib/recipe-media';
import { formatDifficultyLabel } from '../../lib/culinary-visuals';
import { RadialProgressRing } from '../../design-system/v4/AtelierPrimitives';
import {
  AllergenShieldIcon,
  FreshnessShieldIcon,
  WokFlameIcon,
} from '../../design-system/icons';
import { LegacyRecipeCard } from './LegacyRecipeCard';
import { RecipeMedia } from './RecipeMedia';
import { SaveRecipeButton } from './SaveRecipeButton';

interface RecipeCardProps {
  matchResult: RecipeMatchResult | DiscoveryItem;
  onClick: () => void;
  compact?: boolean;
  detailHref?: string;
  kitchen?: boolean;
  headingLevel?: 2 | 3;
  variant?: 'row' | 'feature' | 'grid';
}

function isFullRecipe(candidate: RecipeMatchResult['recipe'] | DiscoveryItem['recipe']): candidate is Recipe {
  return 'ingredients' in candidate && Array.isArray(candidate.ingredients);
}

const ALLERGEN_LABELS_VI: Record<string, string> = {
  shellfish: 'Tôm cua',
  seafood: 'Hải sản',
  egg: 'Trứng',
  dairy: 'Sữa',
  peanut: 'Đậu phộng',
  tree_nut: 'Hạt cây',
  soy: 'Đậu nành',
  gluten: 'Gluten',
  wheat_gluten: 'Gluten',
  sesame: 'Mè',
};

export function RecipeCard(props: RecipeCardProps) {
  const {
    matchResult,
    onClick,
    compact = false,
    kitchen = false,
    headingLevel = 2,
    variant = 'row',
  } = props;

  if (!kitchen) return <LegacyRecipeCard {...props} />;

  const { recipe, canCookWithoutBuying, matchPercentage } = matchResult;
  const missing =
    'missingRequiredIngredientCount' in matchResult
      ? matchResult.missingRequiredIngredientCount
      : matchResult.missingRequiredIngredients.length;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const difficulty = formatDifficultyLabel('difficulty' in recipe ? recipe.difficulty : undefined);
  const v4Fallback = resolveRecipeImageV4({
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    cuisine: recipe.cuisine,
    category: 'category' in recipe ? recipe.category : undefined,
    tags: 'tags' in recipe ? recipe.tags : undefined,
    imageUrl: recipe.imageUrl,
    media: 'media' in recipe ? recipe.media : undefined,
  });
  const v4Image = {
    ...v4Fallback,
    src: resolveRecipeImage(recipe, v4Fallback.src).src === '/takosan/recipe-placeholder.svg'
      ? v4Fallback.src
      : resolveRecipeImage(recipe, v4Fallback.src).src,
  };

  const safetySummary = isFullRecipe(recipe)
    ? evaluateRecipeDietarySafetyV4(recipe)
    : null;

  const isVegetarian = safetySummary?.compliantDiets.includes('vegetarian') ?? false;
  const topAllergens = (safetySummary?.detectedAllergens ?? [])
    .filter((a) => ALLERGEN_LABELS_VI[a])
    .slice(0, 2)
    .map((a) => ALLERGEN_LABELS_VI[a]);

  const isHorizontalRow = variant === 'row' && !compact;

  return (
    <article
      className={clsx(
        'family-recipe-card kitchen-recipe-card group relative flex overflow-hidden rounded-[24px] border border-tk-stone/85 bg-white shadow-card transition-tap duration-200 hover:-translate-y-0.5 hover:border-tk-ink/20 hover:shadow-elevated',
        isHorizontalRow ? 'flex-col sm:flex-row' : 'flex-col',
      )}
      data-variant={compact ? 'compact' : variant}
    >
      <a
        href={props.detailHref ?? `/recipes/${recipe.slug}`}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) {
            return;
          }
          event.preventDefault();
          onClick();
        }}
        className={clsx(
          'family-recipe-main flex min-w-0 flex-1 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-tk-flame/40',
          isHorizontalRow ? 'flex-col sm:flex-row' : 'flex-col',
        )}
        aria-label={recipe.title}
      >
        <div
          className={clsx(
            'relative shrink-0 overflow-hidden',
            isHorizontalRow ? 'w-full sm:w-52 md:w-60' : 'w-full',
          )}
        >
          <RecipeMedia
            image={v4Image}
            title={recipe.title}
            aspectClass={
              isHorizontalRow
                ? 'aspect-[16/10] sm:aspect-auto sm:h-full sm:min-h-[188px]'
                : variant === 'feature'
                  ? 'aspect-[16/10]'
                  : 'aspect-[4/3]'
            }
            overlay={
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
                {/* Top-left frosted glass Cook-Time + Category pills */}
                <div className="flex flex-wrap items-center gap-1.5 pr-11">
                  <span className="tk-glass inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-tk-ink tk-tabular shadow-xs">
                    <Clock size={12} aria-hidden="true" className="text-tk-flame" />
                    {recipe.cookTimeMinutes} phút
                  </span>
                  <span className="inline-flex items-center rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                    {v4Image.categoryLabelVi}
                  </span>
                </div>

                {/* Bottom-left Allergen / Dietary Safety Shield */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {isVegetarian ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-tk-jade/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
                      <FreshnessShieldIcon size={13} tone="cream" />
                      <span>Thanh đạm · Chay</span>
                    </span>
                  ) : topAllergens.length > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white/95 backdrop-blur-md">
                      <AllergenShieldIcon size={13} tone="cream" />
                      <span>Lưu ý: {topAllergens.join(', ')}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/88 px-2.5 py-1 text-[11px] font-bold text-tk-jade-deep shadow-xs backdrop-blur-md">
                      <AllergenShieldIcon size={13} tone="jade" />
                      <span>An toàn dinh dưỡng</span>
                    </span>
                  )}
                </div>
              </div>
            }
          />
        </div>

        <div className="family-recipe-body kitchen-recipe-card-body flex min-w-0 flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
          <div className="space-y-2">
            {/* Readiness & Difficulty Row */}
            <div
              className={clsx(
                'kitchen-recipe-badges-row flex flex-wrap items-center justify-between gap-2',
                isHorizontalRow && 'sm:pr-12',
              )}
            >
              <p
                className={clsx(
                  'kitchen-recipe-readiness inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-extrabold tracking-tight',
                  canCookWithoutBuying
                    ? 'border-tk-jade/25 bg-tk-jade-soft text-tk-jade-deep'
                    : 'border-tk-turmeric/30 bg-tk-turmeric-soft text-tk-turmeric-deep',
                )}
                data-ready={canCookWithoutBuying}
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    'h-1.5 w-1.5 rounded-full',
                    canCookWithoutBuying ? 'bg-tk-jade' : 'bg-tk-turmeric',
                  )}
                />
                {canCookWithoutBuying
                  ? 'Đủ nguyên liệu nấu ngay'
                  : `Thiếu ${missing} món`}
              </p>

              <span className="kitchen-recipe-difficulty inline-flex items-center gap-1 text-xs font-semibold text-tk-secondary">
                <WokFlameIcon size={14} tone="flame" />
                {difficulty.label}
              </span>
            </div>

            <Heading className="font-heading text-base sm:text-[17px] font-extrabold leading-snug tracking-tight text-tk-ink group-hover:text-tk-flame transition-colors">
              {recipe.title}
            </Heading>

            {!compact && recipe.description && (
              <p className="family-recipe-description kitchen-recipe-description line-clamp-2 text-xs sm:text-sm leading-relaxed text-tk-secondary">
                {recipe.description}
              </p>
            )}
          </div>

          {/* Fridge Match Ring + Servings Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-tk-stone/65 pt-3">
            <div className="kitchen-recipe-coverage-wrap flex min-w-0 flex-1 items-center gap-2.5">
              <RadialProgressRing
                value={matchPercentage}
                size={38}
                strokeWidth={3.5}
                tone={canCookWithoutBuying ? 'jade' : matchPercentage >= 50 ? 'turmeric' : 'flame'}
                label={
                  <span className="text-[10px] font-extrabold text-tk-ink">
                    {matchPercentage}%
                  </span>
                }
              />
              <div className="min-w-0 flex-1">
                <p className="family-recipe-coverage kitchen-recipe-coverage truncate text-xs font-bold text-tk-ink">
                  Có {matchPercentage}% loại nguyên liệu
                </p>
                <div
                  className="kitchen-coverage-meter mt-1 h-1.5 w-full overflow-hidden rounded-full bg-tk-sunken"
                  aria-hidden="true"
                >
                  <span
                    className={clsx(
                      'block h-full rounded-full transition-[width] duration-500',
                      canCookWithoutBuying ? 'bg-tk-jade' : 'bg-tk-turmeric',
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, matchPercentage))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="family-recipe-facts kitchen-recipe-facts shrink-0">
              <span className="inline-flex items-center gap-1 rounded-xl bg-tk-sunken px-2.5 py-1 text-xs font-bold text-tk-secondary tk-tabular">
                <Users size={13} aria-hidden="true" />
                {recipe.servings} người
              </span>
            </div>
          </div>
        </div>
      </a>

      <div className="family-recipe-save absolute right-3 top-3 z-20">
        <SaveRecipeButton recipeId={recipe.id} title={recipe.title} compact glass />
      </div>
    </article>
  );
}
