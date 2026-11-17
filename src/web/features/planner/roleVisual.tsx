import React from 'react';
import type { MealRole } from '../../../../packages/domain/src/meal-composition-api';
import {
  BambooSteamerIcon,
  CatFruitIcon,
  ChopsticksBowlIcon,
  ClaypotBraiseIcon,
  HerbSprigIcon,
  StockpotSoupIcon,
} from '../../design-system/icons';
import {
  recipeImageErrorHandler,
  resolveRecipeImageV4,
  type ResolvedRecipeImageV4,
} from '../../lib/recipe-media';

export function rolePillClasses(role: MealRole): string {
  switch (role) {
    case 'main':
      return 'bg-tk-flame-soft text-tk-flame-deep border-tk-flame/25';
    case 'soup':
      return 'bg-tk-ocean-soft text-tk-ocean border-tk-ocean/25';
    case 'vegetable':
      return 'bg-tk-jade-soft text-tk-jade-deep border-tk-jade/25';
    case 'staple':
      return 'bg-tk-turmeric-soft text-tk-turmeric-deep border-tk-turmeric/30';
    case 'side':
      return 'bg-tk-turmeric-soft/75 text-tk-turmeric-deep border-tk-turmeric/20';
    case 'dessert':
      return 'bg-tk-berry-soft text-tk-berry-deep border-tk-berry/20';
    case 'simple_food':
    default:
      return 'bg-tk-sunken text-tk-secondary border-tk-stone';
  }
}

export const RolePillIcon: React.FC<{ role: MealRole; size?: number }> = ({
  role,
  size = 13,
}) => {
  switch (role) {
    case 'main':
      return <ClaypotBraiseIcon size={size} tone="flame" aria-hidden="true" />;
    case 'soup':
      return <StockpotSoupIcon size={size} tone="jade" aria-hidden="true" />;
    case 'vegetable':
      return <HerbSprigIcon size={size} tone="jade" aria-hidden="true" />;
    case 'staple':
      return <BambooSteamerIcon size={size} tone="turmeric" aria-hidden="true" />;
    case 'dessert':
      return <CatFruitIcon size={size} tone="flame" aria-hidden="true" />;
    case 'side':
    case 'simple_food':
    default:
      return <ChopsticksBowlIcon size={size} tone="ink" aria-hidden="true" />;
  }
};

export function resolveComponentThumbV4(item: {
  id?: string;
  recipeId?: string | null;
  simpleFoodId?: string | null;
  title: string;
  role?: MealRole;
  cuisine?: string | null;
}): ResolvedRecipeImageV4 {
  return resolveRecipeImageV4({
    id: item.recipeId ?? item.simpleFoodId ?? item.id ?? item.title,
    title: item.title,
    category: item.role ?? undefined,
    cuisine: item.cuisine ?? undefined,
  });
}

export const DishThumbV4: React.FC<{
  item: {
    id?: string;
    recipeId?: string | null;
    simpleFoodId?: string | null;
    title: string;
    role?: MealRole;
    cuisine?: string | null;
  };
  sizeClassName?: string;
}> = ({ item, sizeClassName = 'h-12 w-12 rounded-2xl' }) => {
  const media = resolveComponentThumbV4(item);
  return (
    <span
      className={`relative block shrink-0 overflow-hidden border border-tk-stone/80 bg-tk-sunken shadow-xs ${sizeClassName}`}
      aria-hidden="true"
    >
      <img
        src={media.src}
        alt=""
        loading="lazy"
        onError={recipeImageErrorHandler(media.fallbackSrc)}
        className="h-full w-full object-cover"
      />
    </span>
  );
};
