import { RuntimeIngredientV2Schema, scaleIngredientV2, type RuntimeIngredientV2 } from './runtime-ingredient-v2';

export type IngredientV2Consumer = 'planner' | 'shopping' | 'cooking' | 'nutrition';
export interface IngredientV2ConsumerAssessment {
  classification: 'OFFLINE_CANDIDATE';
  runtimeAuthority: false;
  restrictionIds: string[];
  consumers: Record<IngredientV2Consumer, { usable: boolean; blockers: string[] }>;
}

/** Review preview only. It cannot promote an ingredient or confer release authority. */
export function assessIngredientV2Consumers(raw: readonly RuntimeIngredientV2[], servingsFactor = 1): IngredientV2ConsumerAssessment {
  if (!Number.isFinite(servingsFactor) || servingsFactor <= 0) throw new RangeError('Invalid servings factor');
  const lines = raw.map((line) => RuntimeIngredientV2Schema.parse(line));
  if (new Set(lines.map((line) => line.sourcePosition)).size !== lines.length) throw new Error('SOURCE_LINE_COVERAGE_DRIFT');
  const consumers = Object.fromEntries((['planner', 'shopping', 'cooking', 'nutrition'] as const)
    .map((name) => [name, { usable: true, blockers: [] as string[] }])) as IngredientV2ConsumerAssessment['consumers'];
  const block = (consumer: IngredientV2Consumer, position: number, reason: string) => {
    consumers[consumer].blockers.push(`position:${position}:${reason}`);
    consumers[consumer].usable = false;
  };
  for (const line of lines) {
    const p = line.sourcePosition;
    if (line.authority === 'provisional' || (line.authority === 'reviewed_new' && !line.authorityEvidence)) {
      for (const name of ['planner', 'shopping', 'cooking', 'nutrition'] as const) block(name, p, 'UNREVIEWED_IDENTITY');
    }
    if (line.shopping.kind === 'unresolved') {
      for (const name of ['planner', 'shopping', 'cooking'] as const) block(name, p, 'UNKNOWN_STOCK_DEMAND');
    }
    if (line.shopping.kind === 'none' && line.shopping.reason !== 'process_water' && !line.shopping.evidence) {
      for (const name of ['planner', 'shopping', 'cooking'] as const) block(name, p, 'UNREVIEWED_EXCLUSION');
    }
    try { scaleIngredientV2(line, servingsFactor); }
    catch {
      for (const name of ['planner', 'shopping', 'cooking'] as const) block(name, p, 'UNRESOLVED_SERVINGS_SCALING');
    }
    if (line.consumed.kind === 'unknown') block('nutrition', p, 'UNKNOWN_EDIBLE_QUANTITY');
    if (line.process.kind === 'measured' && line.process.scaling === 'unresolved') block('cooking', p, 'UNRESOLVED_PROCESS_AMOUNT');
  }
  for (const name of ['planner', 'shopping', 'cooking', 'nutrition'] as const) {
    if (lines.length === 0) { consumers[name].usable = false; consumers[name].blockers.push('NO_SOURCE_LINES'); }
    consumers[name].blockers.sort();
  }
  // All source identities participate in hard restrictions, including unknown demands.
  return { classification: 'OFFLINE_CANDIDATE', runtimeAuthority: false,
    restrictionIds: [...new Set(lines.map((line) => line.ingredientId))].sort(), consumers };
}
