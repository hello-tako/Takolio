import { z } from 'zod';
import type { D1DatabaseBinding, D1PreparedStatement } from '../../../packages/db/src/index';
import {
  ReviewShoppingDemandDtoSchema, ReviewShoppingDemandSchema, ShoppingContributionSchema,
  ShoppingUnknownDemandSchema, type ShoppingUnknownDemand,
} from '../../../packages/domain/src/shopping-plan-api';
import { canonicalJson } from '../../../packages/recipes/src/planner-context';
import { sha256Hex } from '../utils/session';
import { MealPlanningError } from './meal-planning-error';

type Scope = { householdId: string; userId: string };
export interface ShoppingDemandReviewRow {
  source_id: string; list_id: string; plan_id: string; creator_user_id: string;
  plan_revision: number; start_date: string; end_date: string;
  demand_key: string; ingredient_id: string; demand_name: string; demand_quantity: number | null;
  demand_unit: string; contributions_json: string;
  review_revision: number | null; review_fingerprint: string | null; review_decision: string | null;
  review_item_id: string | null; review_actor_user_id: string | null; review_updated_at: string | null;
  state_item_id: string | null; state_list_id: string | null; state_demand_key: string | null; is_overridden: number | null;
  item_id: string | null; item_list_id: string | null; item_ingredient_id: string | null; item_name: string | null;
  item_quantity: number | null; item_unit: string | null; item_is_checked: number | null; item_source_recipe_id: string | null;
  item_created_at: string | null; item_updated_at: string | null;
  metadata_item_id: string | null; ingredient_identity: string | null; recipe_identity: string | null;
  recipe_title: string | null; cannot_buy: number | null;
}

const REVIEW_FROM = `FROM shopping_plan_demands demand JOIN shopping_plan_sources source ON source.id = demand.source_id
  JOIN shopping_lists list ON list.id = source.list_id
  LEFT JOIN shopping_demand_reviews review ON review.source_id = source.id AND review.demand_key = demand.demand_key
  LEFT JOIN shopping_generated_item_state state ON state.list_id = source.list_id AND state.demand_key = demand.demand_key
  LEFT JOIN shopping_items item ON item.id = state.item_id AND item.list_id = source.list_id
  LEFT JOIN shopping_item_metadata metadata ON metadata.item_id = item.id`;
const SELECT_REVIEW = `SELECT source.id AS source_id, source.list_id, source.plan_id, source.creator_user_id,
  source.plan_revision, source.start_date, source.end_date,
  demand.demand_key, demand.ingredient_id, demand.name AS demand_name, demand.quantity AS demand_quantity,
  demand.unit AS demand_unit, demand.contributions_json,
  review.revision AS review_revision, review.demand_fingerprint AS review_fingerprint,
  review.decision AS review_decision, review.item_id AS review_item_id,
  review.actor_user_id AS review_actor_user_id, review.updated_at AS review_updated_at,
  state.item_id AS state_item_id, state.list_id AS state_list_id, state.demand_key AS state_demand_key, state.is_overridden,
  item.id AS item_id, item.list_id AS item_list_id, item.ingredient_id AS item_ingredient_id,
  item.name AS item_name, item.quantity AS item_quantity, item.unit AS item_unit, item.is_checked AS item_is_checked,
  item.source_recipe_id AS item_source_recipe_id, item.created_at AS item_created_at, item.updated_at AS item_updated_at,
  metadata.item_id AS metadata_item_id, metadata.ingredient_identity, metadata.recipe_identity,
  metadata.recipe_title, metadata.cannot_buy
  ${REVIEW_FROM}`;
const NOT_DISMISSED = `NOT EXISTS (SELECT 1 FROM shopping_plan_item_dismissals dismissal
  WHERE dismissal.list_id = source.list_id AND dismissal.demand_key = demand.demand_key AND dismissal.plan_id = source.plan_id)`;
export function unknownShoppingDemandStatement(db: D1DatabaseBinding, listId: string): D1PreparedStatement {
  return db.prepare(`${SELECT_REVIEW} WHERE source.list_id = ? AND demand.quantity IS NULL AND ${NOT_DISMISSED}
    ORDER BY source.id, demand.demand_key`).bind(listId);
}

function demandWitness(row: ShoppingDemandReviewRow) {
  return {
    sourceId: row.source_id, listId: row.list_id, planId: row.plan_id, creatorUserId: row.creator_user_id,
    planRevision: row.plan_revision, startDate: row.start_date, endDate: row.end_date,
    demandKey: row.demand_key, ingredientId: row.ingredient_id, name: row.demand_name,
    quantity: row.demand_quantity, unit: row.demand_unit, contributionsJson: row.contributions_json,
  };
}
function reviewWitness(row: ShoppingDemandReviewRow) {
  return row.review_revision === null ? null : {
    revision: row.review_revision, fingerprint: row.review_fingerprint, decision: row.review_decision,
    itemId: row.review_item_id, actorUserId: row.review_actor_user_id, updatedAt: row.review_updated_at,
  };
}
function purchaseWitness(row: ShoppingDemandReviewRow) {
  return row.item_id === null ? null : {
    id: row.item_id, listId: row.item_list_id, ingredientId: row.item_ingredient_id, name: row.item_name,
    quantity: row.item_quantity, unit: row.item_unit, isChecked: row.item_is_checked, sourceRecipeId: row.item_source_recipe_id,
    createdAt: row.item_created_at, updatedAt: row.item_updated_at,
    state: { itemId: row.state_item_id, listId: row.state_list_id, demandKey: row.state_demand_key, isOverridden: row.is_overridden },
    metadata: row.metadata_item_id === null ? null : {
      itemId: row.metadata_item_id, ingredientIdentity: row.ingredient_identity, recipeIdentity: row.recipe_identity,
      recipeTitle: row.recipe_title, cannotBuy: row.cannot_buy,
    },
  };
}
async function fingerprints(row: ShoppingDemandReviewRow) {
  const demand = demandWitness(row);
  return {
    demandFingerprint: await sha256Hex(canonicalJson(demand)),
    snapshot: await sha256Hex(canonicalJson({ demand, review: reviewWitness(row), purchase: purchaseWitness(row) })),
  };
}

export async function projectUnknownShoppingDemand(row: ShoppingDemandReviewRow): Promise<ShoppingUnknownDemand> {
  const { demandFingerprint, snapshot } = await fingerprints(row);
  let reviewState: ShoppingUnknownDemand['reviewState'] = 'pending';
  if (row.review_fingerprint === demandFingerprint) {
    if (row.review_decision === 'skipped') reviewState = 'skipped';
    else if (row.review_decision === 'purchased' && row.item_id !== null
      && row.review_item_id === row.item_id && row.state_item_id === row.item_id && row.is_overridden === 1) reviewState = 'purchased';
  }
  return ShoppingUnknownDemandSchema.parse({
    sourceId: row.source_id, demandKey: row.demand_key, snapshot, reviewRevision: row.review_revision ?? 0,
    ingredientId: row.ingredient_id, name: row.demand_name, unit: row.demand_unit,
    contributions: z.array(ShoppingContributionSchema).parse(JSON.parse(row.contributions_json)),
    reviewState, purchaseItemId: row.item_id,
  });
}

async function readOwnedList(db: D1DatabaseBinding, scope: Scope) {
  const member = await db.prepare('SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?')
    .bind(scope.householdId, scope.userId).first();
  if (!member) throw new MealPlanningError('FORBIDDEN', 403, 'Bạn không còn là thành viên của gia đình này.');
  const list = await db.prepare('SELECT id FROM shopping_lists WHERE household_id = ? LIMIT 1')
    .bind(scope.householdId).first<{ id: string }>();
  if (!list) throw new MealPlanningError('SHOPPING_DEMAND_NOT_FOUND', 404, 'Không tìm thấy nguyên liệu cần kiểm tra.');
  return list.id;
}
async function readReceipt(db: D1DatabaseBinding, scope: Scope, listId: string, requestKey: string, fingerprint: string) {
  const row = await db.prepare(`SELECT command.request_fingerprint, command.response_json FROM shopping_demand_review_commands command
    JOIN shopping_lists list ON list.id = command.list_id WHERE command.list_id = ? AND command.request_key = ? AND list.household_id = ?
    AND EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)`)
    .bind(listId, requestKey, scope.householdId, scope.householdId, scope.userId)
    .first<{ request_fingerprint: string; response_json: string }>();
  if (!row) return null;
  if (row.request_fingerprint !== fingerprint) throw new MealPlanningError('IDEMPOTENCY_CONFLICT', 409, 'Mã thao tác đã được dùng cho một yêu cầu khác.');
  return ReviewShoppingDemandDtoSchema.parse({ ...JSON.parse(row.response_json), idempotentReplay: true });
}

function witnessGuard(db: D1DatabaseBinding, scope: Scope, row: ShoppingDemandReviewRow, candidateId: string,
  listId: string, requestKey: string, requestFingerprint: string, response: unknown, now: string) {
  const conditions = [
    'source.id = ?', 'source.list_id = ?', 'list.household_id = ?',
    'source.plan_id IS ?', 'source.creator_user_id IS ?', 'source.plan_revision IS ?', 'source.start_date IS ?', 'source.end_date IS ?',
    'demand.demand_key = ?', 'demand.ingredient_id IS ?', 'demand.name IS ?', 'demand.quantity IS NULL',
    'demand.unit IS ?', 'demand.contributions_json IS ?', NOT_DISMISSED,
    'EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)',
  ];
  const values: Array<string | number | null> = [row.source_id, row.list_id, scope.householdId,
    row.plan_id, row.creator_user_id, row.plan_revision, row.start_date, row.end_date,
    row.demand_key, row.ingredient_id, row.demand_name, row.demand_unit, row.contributions_json, scope.householdId, scope.userId];
  if (row.review_revision === null) conditions.push('review.revision IS NULL');
  else {
    conditions.push('review.revision IS ?', 'review.demand_fingerprint IS ?', 'review.decision IS ?',
      'review.item_id IS ?', 'review.actor_user_id IS ?', 'review.updated_at IS ?');
    values.push(row.review_revision, row.review_fingerprint, row.review_decision, row.review_item_id, row.review_actor_user_id, row.review_updated_at);
  }
  if (row.item_id === null) {
    conditions.push('state.item_id IS NULL', 'NOT EXISTS (SELECT 1 FROM shopping_items candidate WHERE candidate.id = ?)');
    values.push(candidateId);
  } else {
    conditions.push('state.item_id IS ?', 'state.list_id IS ?', 'state.demand_key IS ?', 'state.is_overridden IS ?',
      'item.id IS ?', 'item.list_id IS ?', 'item.ingredient_id IS ?', 'item.name IS ?', 'item.quantity IS ?',
      'item.unit IS ?', 'item.is_checked IS ?', 'item.source_recipe_id IS ?', 'item.created_at IS ?', 'item.updated_at IS ?');
    values.push(row.state_item_id, row.state_list_id, row.state_demand_key, row.is_overridden,
      row.item_id, row.item_list_id, row.item_ingredient_id, row.item_name, row.item_quantity,
      row.item_unit, row.item_is_checked, row.item_source_recipe_id, row.item_created_at, row.item_updated_at);
    if (row.metadata_item_id === null) conditions.push('metadata.item_id IS NULL');
    else {
      conditions.push('metadata.item_id IS ?', 'metadata.ingredient_identity IS ?', 'metadata.recipe_identity IS ?',
        'metadata.recipe_title IS ?', 'metadata.cannot_buy IS ?');
      values.push(row.metadata_item_id, row.ingredient_identity, row.recipe_identity, row.recipe_title, row.cannot_buy);
    }
  }
  return db.prepare(`INSERT INTO shopping_demand_review_commands(list_id,request_key,request_fingerprint,response_json,created_at)
    SELECT CASE WHEN EXISTS (SELECT 1 ${REVIEW_FROM}
      WHERE ${conditions.join(' AND ')}) THEN ? ELSE NULL END,?,?,?,?`)
    .bind(...values, listId, requestKey, requestFingerprint, JSON.stringify(response), now);
}

/** Records a household purchase choice while the source recipe quantity remains unknown. */
export async function reviewShoppingDemand(db: D1DatabaseBinding, scope: Scope, rawInput: unknown, requestKey: string) {
  const input = ReviewShoppingDemandSchema.parse(rawInput);
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestKey)) throw new MealPlanningError('INVALID_REQUEST_KEY', 422, 'Thiếu mã thao tác hợp lệ.');
  const listId = await readOwnedList(db, scope);
  const requestFingerprint = await sha256Hex(canonicalJson(input));
  const previous = await readReceipt(db, scope, listId, requestKey, requestFingerprint);
  if (previous) return previous;
  const row = await db.prepare(`${SELECT_REVIEW} WHERE source.id = ? AND demand.demand_key = ? AND source.list_id = ?
    AND list.household_id = ? AND ${NOT_DISMISSED}
    AND EXISTS (SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?)`)
    .bind(input.sourceId, input.demandKey, listId, scope.householdId, scope.householdId, scope.userId)
    .first<ShoppingDemandReviewRow>();
  if (!row) throw new MealPlanningError('SHOPPING_DEMAND_NOT_FOUND', 404, 'Nguyên liệu này đã được cập nhật. Hãy tải lại danh sách.');
  const { demandFingerprint, snapshot } = await fingerprints(row);
  if (row.demand_quantity !== null || snapshot !== input.snapshot || (row.review_revision ?? 0) !== input.reviewRevision) {
    throw new MealPlanningError('SHOPPING_REVIEW_CHANGED', 409, 'Danh sách hoặc lượng mua đã thay đổi. Hãy tải lại rồi chọn lại.');
  }
  const candidateId = row.item_id ?? `plan_shop_${(await sha256Hex(`${listId}:${row.demand_key}`)).slice(0,48)}`;
  const nextRevision = input.reviewRevision + 1;
  const reviewState = input.action === 'purchase' ? 'purchased' : input.action === 'skip' ? 'skipped' : 'pending';
  const purchaseItemId = input.action === 'purchase' ? candidateId
    : input.action === 'skip' && row.item_is_checked !== 1 ? null : row.item_id;
  const response = ReviewShoppingDemandDtoSchema.parse({ success: true, sourceId: row.source_id, demandKey: row.demand_key,
    reviewRevision: nextRevision, reviewState, purchaseItemId, idempotentReplay: false });
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [witnessGuard(db, scope, row, candidateId, listId, requestKey, requestFingerprint, response, now)];
  if (input.action === 'purchase') {
    statements.push(db.prepare(`INSERT INTO shopping_items(id,list_id,ingredient_id,name,quantity,unit,is_checked,source_recipe_id)
      VALUES(?,?,(SELECT id FROM ingredients WHERE id=?),?,?,?,0,NULL)
      ON CONFLICT(id) DO UPDATE SET quantity=excluded.quantity,unit=excluded.unit,updated_at=?`)
      .bind(candidateId, listId, row.ingredient_id, row.demand_name, input.quantity, input.unit, now));
    statements.push(db.prepare(`INSERT INTO shopping_generated_item_state(item_id,list_id,demand_key,is_overridden) VALUES(?,?,?,1)
      ON CONFLICT(item_id) DO UPDATE SET is_overridden=1`).bind(candidateId, listId, row.demand_key));
    statements.push(db.prepare(`INSERT OR IGNORE INTO shopping_item_metadata(item_id,ingredient_identity)
      VALUES(?,?)`).bind(candidateId, row.ingredient_id));
  }
  statements.push(db.prepare(`INSERT INTO shopping_demand_reviews(source_id,demand_key,revision,demand_fingerprint,decision,item_id,actor_user_id,updated_at)
    VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(source_id,demand_key) DO UPDATE SET revision=excluded.revision,
    demand_fingerprint=excluded.demand_fingerprint,decision=excluded.decision,item_id=excluded.item_id,
    actor_user_id=excluded.actor_user_id,updated_at=excluded.updated_at`)
    .bind(row.source_id, row.demand_key, nextRevision, demandFingerprint, reviewState, purchaseItemId, scope.userId, now));
  if (input.action === 'skip' && row.item_id !== null && row.item_is_checked !== 1) {
    statements.push(db.prepare('DELETE FROM shopping_items WHERE id = ? AND list_id = ? AND is_checked = 0')
      .bind(row.item_id, listId));
  }
  try {
    const results = await db.batch(statements);
    if (results.some(result => !result.success)) throw new Error('Shopping demand review batch failed');
  } catch (error) {
    const replay = await readReceipt(db, scope, listId, requestKey, requestFingerprint);
    if (replay) return replay;
    const member = await db.prepare('SELECT 1 FROM household_members WHERE household_id = ? AND user_id = ?')
      .bind(scope.householdId, scope.userId).first();
    if (!member) throw new MealPlanningError('FORBIDDEN', 403, 'Bạn không còn là thành viên của gia đình này.');
    if (error instanceof Error && error.message.includes('NOT NULL constraint failed: shopping_demand_review_commands.list_id')) {
      throw new MealPlanningError('SHOPPING_REVIEW_CHANGED', 409, 'Danh sách hoặc lượng mua đã thay đổi. Hãy tải lại rồi chọn lại.');
    }
    throw new MealPlanningError('SHOPPING_REVIEW_FAILED', 503, 'Chưa xác nhận được lựa chọn. Hãy thử lại thao tác vừa gửi.');
  }
  return response;
}
