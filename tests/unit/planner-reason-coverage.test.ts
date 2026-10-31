import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { PlanResultDtoSchema, PlanningFreshnessSchema, PlannedMealDtoSchema } from '../../packages/domain/src/meal-planning-api';
import { ShoppingResultDtoSchema } from '../../packages/domain/src/meal-shopping-api';
import { plannerCopy, reasonLabel } from '../../src/web/features/planner/presentation';

function source(path: string) {
  return ts.createSourceFile(path, readFileSync(new URL(`../../packages/${path}`, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
}

function strings(node: ts.Node): string[] {
  const result: string[] = [];
  function visit(child: ts.Node) {
    if (ts.isStringLiteral(child)) result.push(child.text);
    ts.forEachChild(child, visit);
  }
  visit(node);
  return result;
}

function contract(path: string, name: string, member?: string) {
  const declaration = source(path).statements.find((node) =>
    (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name.text === name);
  if (!declaration) throw new Error(`Missing reason contract ${path}:${name}`);
  if (!member) return strings(declaration);
  if (!ts.isInterfaceDeclaration(declaration)) throw new Error(`Expected interface ${name}`);
  const property = declaration.members.find((node) => node.name?.getText() === member);
  if (!property) throw new Error(`Missing reason property ${name}.${member}`);
  return strings(property);
}

// Inspect source contracts without bundling trusted engines into the frontend.
const availability = contract('domain/src/availability.ts', 'AvailabilityReason');
const publicCodes = {
  T02: availability,
  T03: [
    ...contract('recipes/src/ranking.ts', 'RankingReason'),
    ...contract('recipes/src/ranking-eligibility.ts', 'RankingExclusionReason'),
  ],
  T04: [
    ...['planner-types.ts', 'planner-utility.ts', 'planner-nutrition.ts', 'weekly-planner.ts']
      .flatMap((file) => strings(source(`recipes/src/${file}`)).filter((value) => /^[A-Z][A-Z0-9_]+$/.test(value))),
    ...[...availability, ...contract('domain/src/availability.ts', 'InventoryDiagnostic', 'code')]
      .map((code) => `INVENTORY_${code.toUpperCase()}`),
    ...contract('recipes/src/candidates.ts', 'CandidateExclusion', 'reason').map((code) => `T02_${code.toUpperCase()}`),
    ...contract('recipes/src/families.ts', 'FamilyExpansionResult', 'truncationReason').map((code) => `T02_${code.toUpperCase()}`),
    ...contract('recipes/src/substitutions.ts', 'SubstitutionDiagnostic', 'reason').map((code) => `SUBSTITUTION_${code.toUpperCase()}`),
  ],
  T05: ['shopping-optimizer.ts', 'shopping-packages.ts'].flatMap((file) =>
    strings(source(`recipes/src/${file}`)).filter((value) => /^[A-Z][A-Z0-9_]+$/.test(value))),
};
const shoppingResultShape = ShoppingResultDtoSchema.shape;

describe('complete public T02–T05 reason presentation', () => {
  it.each(Object.entries(publicCodes))('%s codes have intentional Vietnamese and English explanations', (_layer, codes) => {
    expect(codes.length).toBeGreaterThan(5);
    for (const locale of ['vi', 'en'] as const) {
      const unmapped = [...new Set(codes)].filter((code) => reasonLabel(code, locale) === plannerCopy[locale].ui.unknownReason);
      expect(unmapped, `Unmapped ${locale} public reasons`).toEqual([]);
      for (const code of codes) expect(reasonLabel(code, locale)).not.toBe(code);
    }
  });

  it('reserves the generic fallback for genuinely new codes', () => {
    for (const locale of ['vi', 'en'] as const) {
      expect(reasonLabel('FUTURE_UNKNOWN_CONSTRAINT', locale)).toBe(plannerCopy[locale].ui.unknownReason);
    }
  });

  it('intentionally maps every public user-facing status in both locales', () => {
    const statuses = {
      status: PlanResultDtoSchema.shape.status.options,
      conclusion: PlanResultDtoSchema.shape.conclusion.options,
      budget: shoppingResultShape.budget.shape.status.options,
      shopping: shoppingResultShape.shoppingStatus.options,
      requirement: PlannedMealDtoSchema.shape.requirements.element.shape.status.options,
      waste: shoppingResultShape.purchaseSurplus.element.shape.risk.shape.status.options,
      freshness: [
        ...PlanningFreshnessSchema.shape.status.options,
        ...PlanningFreshnessSchema.shape.reasons.element.options,
      ],
    };
    for (const locale of ['vi', 'en'] as const) {
      for (const [section, codes] of Object.entries(statuses)) {
        const labels = plannerCopy[locale][section as keyof typeof statuses];
        expect(codes.every((code) => Object.hasOwn(labels, code)), `${locale} ${section}`).toBe(true);
      }
    }
  });
});
