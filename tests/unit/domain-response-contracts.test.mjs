import { describe, expect, it } from 'vitest';
import { mutationResponse } from '../../scripts/domain/mutation-response.mjs';
import { verifyStagingCors } from '../../scripts/domain/cors-proof.mjs';

const origin = 'https://staging.takolio.app';
const corsHeaders = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE' };

describe('Cloudflare mutation response contracts', () => {
  it.each(['staging', 'production'])('accepts empty DELETE success for %s, while writes still require a JSON acknowledgement', async (environment) => {
    for (const status of [200, 204]) {
      await expect(mutationResponse(new Response(null, { status }), { environment, method: 'DELETE' })).resolves.toBeUndefined();
      for (const method of ['POST', 'PUT']) {
        await expect(mutationResponse(new Response(null, { status }), { environment, method })).rejects.toThrow('uncertain response');
      }
    }
    const body = { success: true, result: { id: 'confirmed-id' } };
    for (const method of ['POST', 'PUT', 'DELETE']) {
      await expect(mutationResponse(new Response(JSON.stringify(body)), { environment, method })).resolves.toEqual(body.result);
    }
  });

  it.each([202, 400, 403, 500])('rejects an unconfirmed empty DELETE response with HTTP %s', async (status) => {
    await expect(mutationResponse(new Response(null, { status }), { environment: 'staging', method: 'DELETE' })).rejects.toThrow();
  });

  it.each(['<html>private credential</html>', '{', 'null', '{"success":false}', '{"result":{}}'])(
    'rejects malformed or failed acknowledgements without disclosing response content', async (body) => {
      const error = await mutationResponse(new Response(body), { environment: 'production', method: 'DELETE' }).catch((value) => value);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).not.toContain(body);
      expect(error.message).not.toContain('private credential');
    },
  );

  it('hides body read errors and rejects an unknown environment', async () => {
    const response = { ok: true, status: 200, text: async () => { throw new Error('private credential'); } };
    await expect(mutationResponse(response, { environment: 'staging', method: 'DELETE' })).rejects.toThrow('Staging mutation returned an uncertain response');
    await expect(mutationResponse(response, { environment: 'other', method: 'DELETE' })).rejects.toThrow('Invalid mutation environment');
  });
});

describe('credentialed staging preflight behind Access', () => {
  it.each([200, 204])('requires exact origin, credentials and GET for HTTP %s', (status) => {
    expect(verifyStagingCors(new Response(null, { status, headers: corsHeaders }), origin))
      .toEqual({ status, origin, credentials: true, method: 'GET' });
  });

  it.each([
    [403, corsHeaders], [302, corsHeaders], [206, corsHeaders],
    [200, { ...corsHeaders, 'Access-Control-Allow-Origin': '*' }],
    [200, { ...corsHeaders, 'Access-Control-Allow-Origin': 'https://takolio.app' }],
    [200, { ...corsHeaders, 'Access-Control-Allow-Credentials': 'false' }],
    [200, { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST' }], [200, {}],
  ])('rejects unapproved CORS status/headers %#', (status, headers) => {
    expect(() => verifyStagingCors(new Response(null, { status, headers }), origin)).toThrow('CORS proof failed');
  });
});
