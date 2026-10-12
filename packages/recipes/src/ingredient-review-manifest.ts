import { z } from 'zod';
import { CanonicalIngredientIdSchema, PositiveQuantitySchema, StandardUnitSchema, UNIT_DEFINITIONS } from '../../domain/src/foundation';
import { compileReviewedIngredientAuthority, IngredientReviewDecisionSchema } from './ingredient-authority-v2';
import { CatalogReleaseManifestSchema, deriveReleaseId } from './import/release-manifest';
import { canonicalJson, sha256Hex } from './import/identity';
import { fingerprintRefreshArtifact } from './refresh/artifact';
import { RefreshNutrientsSchema, RefreshRecipeSchema, type RefreshIngredient } from './refresh/schema';
import { RefreshSourceManifestSchema } from './refresh/release';
import { classifyTransformation } from './runtime-ingredient-audit';
import { ingredientV2FromRefresh, RuntimeIngredientV2Schema } from './runtime-ingredient-v2';

const Hash = z.string().regex(/^[0-9a-f]{64}$/);
const Text = z.string().trim().min(1);
const Position = z.number().int().nonnegative();
const Classification = z.enum(['TEST_ONLY', 'CANONICAL_CANDIDATE']);
const Quantity = z.object({ amount: PositiveQuantitySchema, unit: StandardUnitSchema }).strict();
export const IngredientReviewEvidenceBindingSchema = z.object({
  evidenceId: Text, reviewerId: Text, reviewedAt: z.string().datetime(),
  canonicalSourceSha256: Hash, authorityScope: z.literal('OFFLINE_REVIEW'),
}).strict();
const Binding = IngredientReviewEvidenceBindingSchema;

/** The ledger is a separate trusted input, never evidence asserted by the manifest itself. */
export const IngredientReviewEvidenceRecordSchema = Binding.extend({
  classification: z.enum(['TEST_ONLY', 'HUMAN_REVIEW']), baseReleaseId: Text,
  basis: Text, evidenceReference: Text,
  subject: z.object({ kind: z.enum(['identity', 'transformation', 'source', 'nutrition']), key: Text, sha256: Hash }).strict(),
  decisionSha256: Hash,
}).strict();

const Identity = z.object({ decision: IngredientReviewDecisionSchema, evidence: Binding.nullable() }).strict();
const Conversion = z.object({
  kind: z.enum(['culinary', 'count', 'package', 'density', 'reviewed_source_measurement']),
  ingredientId: CanonicalIngredientIdSchema, sourceAmount: PositiveQuantitySchema, sourceUnit: Text,
  factor: PositiveQuantitySchema, targetUnit: StandardUnitSchema,
  applicability: z.object({ minSourceAmount: PositiveQuantitySchema, maxSourceAmount: PositiveQuantitySchema }).strict(),
  reference: Text,
}).strict();
const Transformation = z.object({
  recipeId: Text, sourcePosition: Position, sourceRowSha256: Hash,
  ingredientId: CanonicalIngredientIdSchema.nullable(),
  decision: z.enum(['PRESERVE_SOURCE', 'REVIEWED_TRANSFORMATION', 'UNRESOLVED']),
  reviewedLine: RuntimeIngredientV2Schema.nullable(), reason: Text.nullable(),
  conversion: Conversion.nullable(), evidence: Binding.nullable(),
}).strict();
const SourceReview = z.object({
  recipeId: Text, url: z.string().url(), role: z.enum(['declared', 'supporting', 'exception']),
  decision: z.enum(['CONTENT_VERIFIED', 'UNRESOLVED']),
  sourceContentSha256: Hash.nullable(), observedAt: z.string().datetime().nullable(),
  claims: z.array(z.object({ sourcePosition: Position.nullable(),
    claim: z.enum(['identity', 'quantity', 'cooking', 'nutrition', 'allergen']) }).strict()),
  evidence: Binding.nullable(),
}).strict();
const NutritionReview = z.object({
  recipeId: Text, sourceNutritionSha256: Hash,
  decision: z.enum(['KEEP_BLOCKED', 'KEEP_NULL', 'REVIEWED_PROFILE']),
  basis: z.literal('per_serving'), servings: z.number().int().positive(),
  perServing: RefreshNutrientsSchema,
  nutrientReference: z.object({ reference: Text, contentSha256: Hash }).strict().nullable(),
  consumedQuantities: z.array(z.object({ sourcePosition: Position, sourceRowSha256: Hash,
    quantity: Quantity, absorptionBasis: Text }).strict()),
  evidence: Binding.nullable(),
}).strict();

export const IngredientReviewManifestSchema = z.object({
  schemaVersion: z.literal(1), classification: Classification,
  status: z.enum(['TEST_ONLY', 'INCOMPLETE', 'REVIEW_COMPLETE']), authorityScope: z.literal('OFFLINE_REVIEW'),
  reviewManifestId: Text, canonicalSourceSha256: Hash, baseReleaseId: Text, contentSha256: Hash,
  identities: z.array(Identity), transformations: z.array(Transformation),
  sources: z.array(SourceReview), nutrition: z.array(NutritionReview),
}).strict().superRefine((manifest, ctx) => {
  if ((manifest.classification === 'TEST_ONLY') !== (manifest.status === 'TEST_ONLY')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'synthetic manifests must be explicitly TEST_ONLY' });
  }
});
export type IngredientReviewManifest = z.infer<typeof IngredientReviewManifestSchema>;
export type IngredientReviewEvidenceRecord = z.infer<typeof IngredientReviewEvidenceRecordSchema>;

const FixtureSourceManifest = z.object({
  classification: z.literal('TEST_ONLY'), baseReleaseId: Text, canonicalArtifactSha256: Hash,
  orderedRecipeIds: z.array(Text).min(1), fileHashes: z.array(z.object({ path: Text, sha256: Hash }).strict()).min(1),
}).strict();

type SourceLine = { recipeId: string; sourcePosition: number; sourceRowSha256: string; source: RefreshIngredient };
type SourceOccurrence = { recipeId: string; url: string; role: z.infer<typeof SourceReview>['role']; sha256: string };
type NutritionSource = { recipeId: string; sha256: string; source: z.infer<typeof RefreshRecipeSchema>['nutrition'] };
type SourceProofData = {
  classification: z.infer<typeof Classification>; canonicalSourceSha256: string; baseReleaseId: string;
  concepts: Array<{ provisionalId: string; sourceNames: string[] }>;
  lines: SourceLine[]; sources: SourceOccurrence[]; nutrition: NutritionSource[]; existingIds: Set<string>;
};
export interface IngredientReviewSourceProof {
  readonly classification: z.infer<typeof Classification>;
  readonly canonicalSourceSha256: string;
  readonly baseReleaseId: string;
  readonly coverage: Readonly<{ recipes: number; concepts: number; sourceLines: number; sourceOccurrences: number; nutritionProfiles: number }>;
}
const proofs = new WeakMap<IngredientReviewSourceProof, SourceProofData>();
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const lineKey = (recipeId: string, position: number) => `${recipeId}:${position}`;
const sourceKey = (recipeId: string, url: string, role: string) => canonicalJson([recipeId, url, role]);

export class IngredientReviewProofError extends Error {
  readonly code = 'INGREDIENT_REVIEW_PROOF_BLOCKED';
  constructor(readonly reasons: readonly string[]) {
    super(`INGREDIENT_REVIEW_PROOF_BLOCKED: ${reasons.join(', ')}`);
    this.name = 'IngredientReviewProofError';
  }
}

/** Verifies exact input bytes through the existing canonical artifact fingerprint. */
export async function buildIngredientReviewSourceProof(input: {
  classification: z.infer<typeof Classification>; sourceManifest: unknown;
  expectedCanonicalSourceSha256: string; certifiedBaseRelease: unknown;
  certifiedExistingIngredientIds: ReadonlySet<string>;
  files: readonly { path: string; bytes: string | Uint8Array }[];
}): Promise<IngredientReviewSourceProof> {
  // Snapshot caller-owned buffers before hashing yields to other work.
  const inputFiles = input.files.map((file) => ({ path: file.path,
    bytes: typeof file.bytes === 'string' ? file.bytes : new Uint8Array(file.bytes) }));
  const inputExistingIds = [...input.certifiedExistingIngredientIds];
  const classification = Classification.parse(input.classification);
  const manifest = classification === 'TEST_ONLY' ? FixtureSourceManifest.parse(input.sourceManifest)
    : RefreshSourceManifestSchema.parse(input.sourceManifest);
  const release = CatalogReleaseManifestSchema.parse(input.certifiedBaseRelease);
  if (manifest.baseReleaseId !== release.releaseId) throw new IngredientReviewProofError(['BASE_RELEASE_MISMATCH']);
  if (classification === 'CANONICAL_CANDIDATE'
    && await deriveReleaseId(release.legacyBaselineFingerprint, release.approvedImportBatches) !== release.releaseId) {
    throw new IngredientReviewProofError(['BASE_RELEASE_MANIFEST_DIGEST_MISMATCH']);
  }
  if (manifest.canonicalArtifactSha256 !== Hash.parse(input.expectedCanonicalSourceSha256)) {
    throw new IngredientReviewProofError(['CANONICAL_SOURCE_HASH_MISMATCH']);
  }
  const files = new Map(inputFiles.map((file) => [file.path, file.bytes]));
  const declared = new Map(manifest.fileHashes.map((file) => [file.path, file.sha256]));
  if (files.size !== inputFiles.length || declared.size !== manifest.fileHashes.length || files.size !== declared.size
    || [...files.keys()].some((file) => !declared.has(file))) {
    throw new IngredientReviewProofError(['SOURCE_FILE_COVERAGE_DRIFT']);
  }
  const hashes = await Promise.all([...files].sort(([a], [b]) => compare(a, b)).map(async ([path, bytes]) => ({ path, sha256: await sha256Hex(bytes) })));
  if (hashes.some((file) => declared.get(file.path) !== file.sha256)
    || await fingerprintRefreshArtifact(hashes) !== manifest.canonicalArtifactSha256) {
    throw new IngredientReviewProofError(['SOURCE_BYTES_DIGEST_MISMATCH']);
  }
  if (new Set(manifest.orderedRecipeIds).size !== manifest.orderedRecipeIds.length
    || hashes.filter(({ path }) => path.startsWith('recipes/') && path.endsWith('.json')).length !== manifest.orderedRecipeIds.length) {
    throw new IngredientReviewProofError(['RECIPE_COVERAGE_DRIFT']);
  }
  const recipes = manifest.orderedRecipeIds.map((id) => {
    const bytes = files.get(`recipes/${id}.json`);
    if (bytes === undefined) throw new IngredientReviewProofError(['RECIPE_COVERAGE_DRIFT']);
    const recipe = RefreshRecipeSchema.parse(JSON.parse(typeof bytes === 'string' ? bytes : new TextDecoder().decode(bytes)));
    if (recipe.identity.id !== id || new Set(recipe.ingredients.map((line) => line.position)).size !== recipe.ingredients.length) {
      throw new IngredientReviewProofError(['SOURCE_LINE_IDENTITY_DRIFT']);
    }
    return recipe;
  }).sort((a, b) => compare(a.identity.id, b.identity.id));
  const existingIds = new Set(inputExistingIds.map((id) => CanonicalIngredientIdSchema.parse(id)));
  if (existingIds.size !== inputExistingIds.length || [...existingIds].some((id) => id.startsWith('ING_ENR_'))) {
    throw new IngredientReviewProofError(['UNREVIEWED_EXISTING_AUTHORITY']);
  }
  if (recipes.some((recipe) => recipe.ingredients.some((line) => line.reconciliation === 'existing_canonical_id'
    && (!line.canonicalIngredientId || !existingIds.has(line.canonicalIngredientId))))) {
    throw new IngredientReviewProofError(['UNREVIEWED_EXISTING_AUTHORITY']);
  }
  const concepts = new Map<string, Set<string>>();
  const lines = await Promise.all(recipes.flatMap((recipe) => recipe.ingredients.map(async (source) => {
    if (source.canonicalIngredientId?.startsWith('ING_ENR_')) {
      const names = concepts.get(source.canonicalIngredientId) ?? new Set<string>();
      names.add(source.sourceName); concepts.set(source.canonicalIngredientId, names);
    }
    return { recipeId: recipe.identity.id, sourcePosition: source.position,
      sourceRowSha256: await sha256Hex(canonicalJson(source)), source };
  })));
  const sources = await Promise.all(recipes.flatMap((recipe) => recipe.research.sources.map(async (source) => ({
    recipeId: recipe.identity.id, url: source.url, role: source.role,
    sha256: await sha256Hex(canonicalJson({ recipeId: recipe.identity.id, ...source })),
  }))));
  if (new Set(sources.map((source) => sourceKey(source.recipeId, source.url, source.role))).size !== sources.length) {
    throw new IngredientReviewProofError(['DUPLICATE_SOURCE_OCCURRENCE']);
  }
  const nutrition = await Promise.all(recipes.map(async (recipe) => ({ recipeId: recipe.identity.id,
    sha256: await sha256Hex(canonicalJson(recipe.nutrition)), source: recipe.nutrition })));
  const proof = Object.freeze({ classification, canonicalSourceSha256: manifest.canonicalArtifactSha256, baseReleaseId: manifest.baseReleaseId,
    coverage: Object.freeze({ recipes: recipes.length, concepts: concepts.size, sourceLines: lines.length,
      sourceOccurrences: sources.length, nutritionProfiles: nutrition.length }) });
  proofs.set(proof, { classification, canonicalSourceSha256: proof.canonicalSourceSha256, baseReleaseId: proof.baseReleaseId,
    concepts: [...concepts].sort(([a], [b]) => compare(a, b)).map(([provisionalId, names]) => ({ provisionalId, sourceNames: [...names].sort(compare) })),
    lines, sources, nutrition, existingIds });
  return proof;
}

function normalizedManifest(manifest: IngredientReviewManifest) {
  const { contentSha256: _digest, ...body } = manifest;
  return { ...body,
    identities: [...body.identities].sort((a, b) => compare(a.decision.provisionalId, b.decision.provisionalId)),
    transformations: [...body.transformations].sort((a, b) => compare(a.recipeId, b.recipeId) || a.sourcePosition - b.sourcePosition),
    sources: body.sources.map((source) => ({ ...source, claims: [...source.claims].sort((a, b) =>
      (a.sourcePosition ?? -1) - (b.sourcePosition ?? -1) || compare(a.claim, b.claim)) }))
      .sort((a, b) => compare(sourceKey(a.recipeId, a.url, a.role), sourceKey(b.recipeId, b.url, b.role))),
    nutrition: body.nutrition.map((row) => ({ ...row, consumedQuantities: [...row.consumedQuantities].sort((a, b) => a.sourcePosition - b.sourcePosition) }))
      .sort((a, b) => compare(a.recipeId, b.recipeId)),
  };
}

export async function computeIngredientReviewManifestHash(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(normalizedManifest(IngredientReviewManifestSchema.parse(value))));
}

export async function ingredientReviewDecisionHash(value: unknown): Promise<string> {
  return sha256Hex(canonicalJson(value));
}

export interface IngredientReviewAudit {
  classification: z.infer<typeof Classification>; status: 'TEST_ONLY' | 'INCOMPLETE' | 'REVIEW_COMPLETE';
  authorityScope: 'OFFLINE_REVIEW'; runtimeAuthority: false; finalRuntimeFingerprint: null;
  canonicalSourceSha256: string; reviewManifestSha256: string; auditSha256: string;
  blockers: string[];
  coverage: { concepts: { expected: number; resolved: number }; sourceLines: { expected: number; resolved: number };
    sourceOccurrences: { expected: number; resolved: number }; nutritionProfiles: { expected: number; resolved: number } };
  transformationClasses: Record<string, { expected: number; resolved: number }>;
  offlineIdentityPreview: ({ classification: z.infer<typeof Classification>; authorityScope: 'OFFLINE_REVIEW' }
    & ReturnType<typeof compileReviewedIngredientAuthority>) | null;
}

/** This is an offline review proof, never a release certificate or source mutation. */
export async function auditIngredientReviewManifest(proof: IngredientReviewSourceProof, value: unknown,
  trustedEvidence: readonly IngredientReviewEvidenceRecord[]): Promise<IngredientReviewAudit> {
  const source = proofs.get(proof);
  if (!source) throw new IngredientReviewProofError(['UNVERIFIED_SOURCE_PROOF']);
  const manifest = IngredientReviewManifestSchema.parse(value);
  const blockers = new Set<string>();
  const block = (reason: string) => { blockers.add(reason); return false; };
  if (manifest.classification !== source.classification) block('CLASSIFICATION_MISMATCH');
  if (manifest.canonicalSourceSha256 !== source.canonicalSourceSha256) block('CANONICAL_SOURCE_HASH_MISMATCH');
  if (manifest.baseReleaseId !== source.baseReleaseId) block('BASE_RELEASE_MISMATCH');
  const manifestHash = await computeIngredientReviewManifestHash(manifest);
  if (manifestHash !== manifest.contentSha256) block('REVIEW_MANIFEST_HASH_MISMATCH');
  const records = trustedEvidence.map((row) => IngredientReviewEvidenceRecordSchema.parse(row));
  const ledger = new Map(records.map((row) => [row.evidenceId, row]));
  if (ledger.size !== records.length) block('DUPLICATE_EVIDENCE_ID');
  const bind = async (binding: z.infer<typeof Binding> | null, kind: IngredientReviewEvidenceRecord['subject']['kind'],
    key: string, digest: string, payload: unknown, review?: { basis: string; evidenceReference: string } | null) => {
    const evidence = binding && ledger.get(binding.evidenceId);
    if (!binding || !evidence) return block('MISSING_TRUSTED_EVIDENCE');
    if (binding.canonicalSourceSha256 !== source.canonicalSourceSha256 || evidence.canonicalSourceSha256 !== source.canonicalSourceSha256
      || evidence.baseReleaseId !== source.baseReleaseId || binding.reviewerId !== evidence.reviewerId
      || binding.reviewedAt !== evidence.reviewedAt || binding.authorityScope !== evidence.authorityScope
      || evidence.subject.kind !== kind || evidence.subject.key !== key || evidence.subject.sha256 !== digest
      || evidence.decisionSha256 !== await ingredientReviewDecisionHash(payload)
      || (review && (review.basis !== evidence.basis || review.evidenceReference !== evidence.evidenceReference))
      || evidence.classification !== (source.classification === 'TEST_ONLY' ? 'TEST_ONLY' : 'HUMAN_REVIEW')) {
      return block('EVIDENCE_BINDING_MISMATCH');
    }
    return true;
  };
  const unique = <T>(rows: readonly T[], key: (row: T) => string, expected: ReadonlySet<string>, label: string) => {
    const ids = rows.map(key);
    if (new Set(ids).size !== ids.length) block(`DUPLICATE_${label}_DECISION`);
    if (ids.length !== expected.size || ids.some((id) => !expected.has(id)) || [...expected].some((id) => !ids.includes(id))) {
      block(`${label}_COVERAGE_DRIFT`);
    }
  };
  const concepts = new Map(source.concepts.map((row) => [row.provisionalId, row]));
  const lines = new Map(source.lines.map((row) => [lineKey(row.recipeId, row.sourcePosition), row]));
  const sources = new Map(source.sources.map((row) => [sourceKey(row.recipeId, row.url, row.role), row]));
  const nutritions = new Map(source.nutrition.map((row) => [row.recipeId, row]));
  unique(manifest.identities, (row) => row.decision.provisionalId, new Set(concepts.keys()), 'IDENTITY');
  unique(manifest.transformations, (row) => lineKey(row.recipeId, row.sourcePosition), new Set(lines.keys()), 'SOURCE_LINE');
  unique(manifest.sources, (row) => sourceKey(row.recipeId, row.url, row.role), new Set(sources.keys()), 'SOURCE');
  unique(manifest.nutrition, (row) => row.recipeId, new Set(nutritions.keys()), 'NUTRITION');
  let identityResolved = 0;
  for (const row of manifest.identities) {
    const concept = concepts.get(row.decision.provisionalId);
    if (!concept || !concept.sourceNames.includes(row.decision.sourceName)) { block('SOURCE_CONCEPT_IDENTITY_DRIFT'); continue; }
    if (!row.decision.review || !row.decision.targetId) { block('INGREDIENT_RECONCILIATION_INCOMPLETE'); continue; }
    if (await bind(row.evidence, 'identity', concept.provisionalId, await sha256Hex(canonicalJson(concept)), row.decision, row.decision.review)) identityResolved++;
  }
  let identityProjection: ReturnType<typeof compileReviewedIngredientAuthority> | null = null;
  if (identityResolved === concepts.size && manifest.identities.length === concepts.size) {
    try { identityProjection = compileReviewedIngredientAuthority(source.concepts, manifest.identities.map((row) => row.decision), source.existingIds); }
    catch { block('INGREDIENT_AUTHORITY_PROOF_BLOCKED'); }
  }
  let lineResolved = 0;
  const resolvedLineKeys = new Set<string>();
  for (const row of manifest.transformations) {
    const key = lineKey(row.recipeId, row.sourcePosition);
    const original = lines.get(key);
    if (!original || row.sourceRowSha256 !== original.sourceRowSha256 || row.ingredientId !== original.source.canonicalIngredientId) {
      block('SOURCE_ROW_DIGEST_OR_IDENTITY_MISMATCH'); continue;
    }
    if (row.decision === 'UNRESOLVED') { block('RUNTIME_PROJECTION_LOSS'); continue; }
    const line = row.reviewedLine;
    if (!line || line.sourcePosition !== original.sourcePosition || line.ingredientId !== original.source.canonicalIngredientId
      || line.name !== original.source.sourceName || line.optional !== original.source.optional
      || line.display.text !== original.source.quantity.text) { block('SOURCE_LINE_IDENTITY_OR_DISPLAY_DRIFT'); continue; }
    let candidate;
    try { candidate = ingredientV2FromRefresh(original.source); } catch { block('SOURCE_ADAPTATION_BLOCKED'); continue; }
    if (line.authority !== candidate.authority || canonicalJson(line.authorityEvidence) !== canonicalJson(candidate.authorityEvidence)) {
      block('UNREVIEWED_INGREDIENT_PROMOTION'); continue;
    }
    if (row.decision === 'PRESERVE_SOURCE') {
      if (canonicalJson(line) !== canonicalJson(candidate) || row.conversion !== null || row.evidence !== null
        || classifyTransformation(original.source).releaseBlocking || line.shopping.kind === 'unresolved'
        || line.shopping.kind === 'measured' && line.shopping.scaling === 'unresolved'
        || line.process.kind === 'measured' && line.process.scaling === 'unresolved'
        || line.shopping.kind === 'none' && line.shopping.reason !== 'process_water' && line.shopping.evidence === null) {
        block('UNREVIEWED_TRANSFORMATION'); continue;
      }
    } else {
      const { evidence: _binding, ...payload } = row;
      if (!await bind(row.evidence, 'transformation', key, original.sourceRowSha256, payload)) continue;
      if (line.shopping.kind === 'unresolved' || line.shopping.kind === 'measured' && line.shopping.scaling === 'unresolved') {
        block('UNRESOLVED_SHOPPING_QUANTITY_OR_SCALING'); continue;
      }
      if (line.shopping.kind === 'none' && line.shopping.reason !== 'process_water' && line.shopping.evidence === null) {
        block('UNREVIEWED_NON_SHOPPING_EXCLUSION'); continue;
      }
      if (line.shopping.kind === 'none' && original.source.includeInShopping
        || line.shopping.kind !== 'none' && !original.source.includeInShopping) {
        block('SHOPPING_SEMANTIC_DRIFT'); continue;
      }
      if (line.shopping.kind === 'measured') {
        const quantity = original.source.quantity;
        const physical = quantity.kind === 'measured' && /^(?:g|kg|ml|l)$/u.test(quantity.unit);
        const from = physical ? UNIT_DEFINITIONS[quantity.unit as 'g' | 'kg' | 'ml' | 'l'] : null;
        const to = UNIT_DEFINITIONS[line.shopping.quantity.unit];
        const exact = from !== null && from.dimension === to.dimension && quantity.kind === 'measured'
          && quantity.amount * from.factorToBase / to.factorToBase === line.shopping.quantity.amount;
        if (!exact) {
          const conversion = row.conversion;
          if (quantity.kind !== 'measured' || !conversion || line.shopping.conversionEvidence === null
            || conversion.ingredientId !== row.ingredientId || conversion.sourceAmount !== quantity.amount || conversion.sourceUnit !== quantity.unit
            || conversion.targetUnit !== line.shopping.quantity.unit || conversion.sourceAmount * conversion.factor !== line.shopping.quantity.amount
            || conversion.applicability.minSourceAmount > quantity.amount || conversion.applicability.maxSourceAmount < quantity.amount
            || line.shopping.conversionEvidence.reference !== conversion.reference) {
            block('UNREVIEWED_PURCHASE_CONVERSION'); continue;
          }
        } else if (row.conversion !== null) { block('CONTRADICTORY_CONVERSION'); continue; }
      } else if (row.conversion !== null) { block('CONTRADICTORY_CONVERSION'); continue; }
      if (line.process.kind === 'measured' && line.process.scaling === 'unresolved') {
        block('PROCESS_LINEAGE_OR_SCALING_UNRESOLVED'); continue;
      }
      if (original.source.usageRole === 'process_only' || original.source.usageRole === 'mixed_process') {
        if (line.process.kind === 'none' || line.process.kind === 'measured' && line.process.scaling === 'unresolved') {
          block('PROCESS_LINEAGE_OR_SCALING_UNRESOLVED'); continue;
        }
      }
    }
    if (line.consumed.kind === 'measured') {
      const nutrition = manifest.nutrition.find((entry) => entry.recipeId === row.recipeId && entry.decision === 'REVIEWED_PROFILE');
      const consumed = nutrition?.consumedQuantities.find((entry) => entry.sourcePosition === row.sourcePosition);
      const independentEvidence = nutrition?.evidence && ledger.get(nutrition.evidence.evidenceId);
      if (!consumed || !independentEvidence || consumed.sourceRowSha256 !== original.sourceRowSha256
        || canonicalJson(consumed.quantity) !== canonicalJson(line.consumed.quantity)
        || line.consumed.evidence.basis !== consumed.absorptionBasis
        || line.consumed.evidence.reference !== independentEvidence.evidenceReference) { block('UNREVIEWED_CONSUMED_QUANTITY'); continue; }
    }
    lineResolved++;
    resolvedLineKeys.add(key);
  }
  let sourceResolved = 0;
  for (const row of manifest.sources) {
    const key = sourceKey(row.recipeId, row.url, row.role);
    const original = sources.get(key);
    if (!original) { block('SOURCE_REFERENCE_MISMATCH'); continue; }
    const claimKeys = row.claims.map((claim) => canonicalJson(claim));
    if (row.decision !== 'CONTENT_VERIFIED' || row.sourceContentSha256 === null || row.observedAt === null || row.claims.length === 0
      || new Set(claimKeys).size !== claimKeys.length || row.claims.some((claim) => claim.sourcePosition !== null && !lines.has(lineKey(row.recipeId, claim.sourcePosition)))) {
      block('SOURCE_CONTENT_VERIFICATION_INCOMPLETE'); continue;
    }
    const { evidence: _binding, ...payload } = row;
    payload.claims = [...payload.claims].sort((a, b) => (a.sourcePosition ?? -1) - (b.sourcePosition ?? -1) || compare(a.claim, b.claim));
    if (await bind(row.evidence, 'source', key, original.sha256, payload)) sourceResolved++;
  }
  let nutritionResolved = 0;
  for (const row of manifest.nutrition) {
    const original = nutritions.get(row.recipeId);
    if (!original || original.sha256 !== row.sourceNutritionSha256 || row.servings !== original.source.servings) { block('NUTRITION_SOURCE_DRIFT'); continue; }
    if (row.decision === 'KEEP_NULL' && original.source.certification === 'null_truthful'
      && Object.values(row.perServing).every((amount) => amount === null) && row.nutrientReference === null
      && row.consumedQuantities.length === 0 && row.evidence === null) { nutritionResolved++; continue; }
    if (row.decision !== 'REVIEWED_PROFILE' || Object.values(row.perServing).some((amount) => amount === null)
      || row.nutrientReference === null) { block('NUTRITION_EVIDENCE_INCOMPLETE'); continue; }
    const consumed = row.consumedQuantities;
    const expected = source.lines.filter((line) => line.recipeId === row.recipeId && (line.source.includeInNutrition
      || manifest.transformations.some((entry) => entry.recipeId === row.recipeId && entry.sourcePosition === line.sourcePosition
        && entry.reviewedLine?.consumed.kind === 'measured')));
    if (new Set(consumed.map((entry) => entry.sourcePosition)).size !== consumed.length
      || consumed.length !== expected.length || expected.some((line) => !consumed.some((entry) =>
        entry.sourcePosition === line.sourcePosition && entry.sourceRowSha256 === line.sourceRowSha256))) {
      block('NUTRITION_CONSUMED_COVERAGE_DRIFT'); continue;
    }
    const { evidence: _binding, ...payload } = row;
    payload.consumedQuantities = [...payload.consumedQuantities].sort((a, b) => a.sourcePosition - b.sourcePosition);
    if (await bind(row.evidence, 'nutrition', row.recipeId, original.sha256, payload)) nutritionResolved++;
  }
  const classRows = source.lines.map((line) => ({ key: lineKey(line.recipeId, line.sourcePosition),
    kind: classifyTransformation(line.source).transformationClass }));
  const transformationClasses = Object.fromEntries([...new Set(classRows.map((row) => row.kind))].sort(compare).map((kind) => {
    const entries = classRows.filter((row) => row.kind === kind);
    return [kind, { expected: entries.length, resolved: entries.filter((row) => resolvedLineKeys.has(row.key)).length }];
  }));
  const counts = { concepts: { expected: concepts.size, resolved: identityResolved }, sourceLines: { expected: lines.size, resolved: lineResolved },
    sourceOccurrences: { expected: sources.size, resolved: sourceResolved }, nutritionProfiles: { expected: nutritions.size, resolved: nutritionResolved } };
  if (Object.values(counts).some((count) => count.expected !== count.resolved)) block('REVIEW_SET_INCOMPLETE');
  if (blockers.size > 0 && manifest.status === 'REVIEW_COMPLETE') block('FALSE_REVIEW_COMPLETION_CLAIM');
  const ready = blockers.size === 0;
  const body: Omit<IngredientReviewAudit, 'auditSha256'> = {
    classification: source.classification, status: source.classification === 'TEST_ONLY' ? 'TEST_ONLY' : ready ? 'REVIEW_COMPLETE' : 'INCOMPLETE',
    authorityScope: 'OFFLINE_REVIEW', runtimeAuthority: false, finalRuntimeFingerprint: null,
    canonicalSourceSha256: source.canonicalSourceSha256, reviewManifestSha256: manifestHash, blockers: [...blockers].sort(compare), coverage: counts, transformationClasses,
    offlineIdentityPreview: ready && identityProjection ? { classification: source.classification, authorityScope: 'OFFLINE_REVIEW', ...identityProjection } : null,
  };
  return { ...body, auditSha256: await sha256Hex(canonicalJson(body)) };
}
