import worker from '../../src/worker/index.ts';

// Isolated test entry only; product requests retain the real cookie/tenancy/CSRF middleware.
export default {
  async fetch(request, env, context) {
    if (new URL(request.url).pathname === '/') {
      if (request.headers.get('x-test-token') !== env.TEST_TOKEN) return new Response('Forbidden', { status: 403 });
      const { statements } = await request.json();
      const results = await env.DB.batch(statements.map(({ sql, values = [] }) => env.DB.prepare(sql).bind(...values)));
      return Response.json({ results });
    }
    return worker.fetch(request, {
      ...env,
      ENVIRONMENT: 'development',
      APP_URL: 'http://localhost',
      AI_ENABLED: 'false',
      MEAL_PLANNER_ENABLED: 'true',
      MEAL_COMPOSITION_V2_ENABLED: 'true',
      RECIPE_CATALOG_MODE: 'd1',
      RECIPE_CATALOG_CUTOVER_ENABLED: 'true',
    }, context);
  },
};
