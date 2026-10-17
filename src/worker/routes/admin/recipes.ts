import type { D1DatabaseBinding } from '@frigo/db';
import type { AdminEditorialState, AdminPage, AdminRecipeDetail, AdminRecipesSummary, AdminRecipeSummary } from '../../../shared/admin';
import type { CustomerReadClient } from './customer-facade-client';
// Latest editorial row per recipe, from the admin database.
const LATEST_REVIEW_SQL = `SELECT e.recipe_id, e.state FROM admin_recipe_editorial_reviews e
  WHERE e.recipe_id IN (SELECT value FROM json_each(?))
    AND NOT EXISTS (SELECT 1 FROM admin_recipe_editorial_reviews n WHERE n.recipe_id = e.recipe_id
      AND (n.created_at > e.created_at OR (n.created_at = e.created_at AND n.id > e.id)))`;

async function latestStates(adminDb: D1DatabaseBinding, recipeIds: string[]): Promise<Map<string, AdminEditorialState>> {
  if (recipeIds.length === 0) return new Map();
  const rows = await adminDb.prepare(LATEST_REVIEW_SQL).bind(JSON.stringify(recipeIds)).all<{ recipe_id: string; state: AdminEditorialState }>();
  return new Map(rows.results.map((row) => [row.recipe_id, row.state]));
}


export async function listRecipes(main:CustomerReadClient,db:D1DatabaseBinding,q:{q?:string;cuisine?:string;verification?:'unverified'|'reviewed'|'rejected';source?:'legacy'|'curated'|'imported'|'ai_generated'|'user_generated';page:number;pageSize:number}):Promise<AdminPage<AdminRecipeSummary>> {
 const page=await main.read<AdminPage<AdminRecipeSummary>>('recipes.list',q);
 const states=await latestStates(db,page.items.map(r=>r.id));
 return {...page,items:page.items.map(r=>({...r,latestEditorialState:states.get(r.id)??null}))};
}
export async function recipesSummary(main:CustomerReadClient,db:D1DatabaseBinding,catalogMode:string|undefined):Promise<AdminRecipesSummary> {
 const summary=await main.read<AdminRecipesSummary>('recipes.summary',{catalogMode});
 const rows=await db.prepare(`SELECT e.state AS key,COUNT(*) AS count FROM admin_recipe_editorial_reviews e WHERE NOT EXISTS(SELECT 1 FROM admin_recipe_editorial_reviews n WHERE n.recipe_id=e.recipe_id AND (n.created_at>e.created_at OR(n.created_at=e.created_at AND n.id>e.id))) GROUP BY 1 ORDER BY 1`).all<{key:AdminEditorialState;count:number}>();
 return {...summary,editorialQueue:rows.results.map(r=>({state:r.key,count:Number(r.count)}))};
}
export async function getRecipe(main:CustomerReadClient,db:D1DatabaseBinding,id:string):Promise<AdminRecipeDetail|null> {
 const recipe=await main.read<AdminRecipeDetail|null>('recipes.get',{id}); if(!recipe)return null;
 const rows=await db.prepare('SELECT id,state,note,author_user_id,recipe_version,created_at FROM admin_recipe_editorial_reviews WHERE recipe_id=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(id).all<{id:string;state:AdminEditorialState;note:string;author_user_id:string;recipe_version:number;created_at:string}>();
 return {...recipe,latestEditorialState:rows.results[0]?.state??null,editorialReviews:rows.results.map(r=>({id:r.id,state:r.state,note:r.note,authorUserId:r.author_user_id,recipeVersion:r.recipe_version,createdAt:r.created_at}))};
}
