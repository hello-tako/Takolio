import { RecipeMedia } from './RecipeMedia';
import { LegacyRecipeCard } from './LegacyRecipeCard';
import type { RecipeMatchResult } from '@frigo/recipes';
import type { DiscoveryItem } from '../../../../packages/recipes/src/discovery-contract';
import { Clock, Users } from 'lucide-react';
import { resolveRecipeImage } from '../../lib/recipe-media';
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
export function RecipeCard(props: RecipeCardProps) {
  const { matchResult, onClick, compact = false, kitchen = false, headingLevel = 2, variant = 'row' } = props;
  if (!kitchen) return <LegacyRecipeCard {...props} />;
  const { recipe, canCookWithoutBuying, matchPercentage } = matchResult;
  const missing = 'missingRequiredIngredientCount' in matchResult ? matchResult.missingRequiredIngredientCount : matchResult.missingRequiredIngredients.length;
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return <article className="family-recipe-card kitchen-recipe-card" data-variant={compact ? 'compact' : variant}>
    <a href={props.detailHref ?? `/recipes/${recipe.slug}`} onClick={event => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onClick(); }} className="family-recipe-main" aria-label={recipe.title}>
      <RecipeMedia image={resolveRecipeImage(recipe)} title={recipe.title} />
      <div className="family-recipe-body"><p className="kitchen-recipe-readiness" data-ready={canCookWithoutBuying}>{canCookWithoutBuying ? 'Đủ lượng để nấu' : `Cần kiểm tra ${missing} nguyên liệu`}</p><Heading>{recipe.title}</Heading>{!compact && <p className="family-recipe-description">{recipe.description}</p>}<div className="family-recipe-facts"><span><Clock size={15} aria-hidden="true" />{recipe.cookTimeMinutes} phút</span><span><Users size={15} aria-hidden="true" />{recipe.servings} người</span></div><p className="family-recipe-coverage">Có {matchPercentage}% loại nguyên liệu</p></div>
    </a><div className="family-recipe-save"><SaveRecipeButton recipeId={recipe.id} title={recipe.title} compact /></div>
  </article>;
}
