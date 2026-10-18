// Domain removal can return an empty success response. The caller must still
// prove the complete post-delete inventory before recording a successful detach.
export async function mutationResponse(response, { environment, method }) {
  if (!['staging', 'production'].includes(environment)) throw new Error('Invalid mutation environment');
  const label = environment === 'staging' ? 'Staging' : 'Production';
  if (!response.ok) throw new Error(`${label} mutation failed: HTTP ${response.status}`);
  let text;
  try { text = await response.text(); }
  catch { throw new Error(`${label} mutation returned an uncertain response`); }
  if (method === 'DELETE' && [200, 204].includes(response.status) && text.trim() === '') return undefined;
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error(`${label} mutation returned an uncertain response`); }
  if (!data || data.success !== true) throw new Error(`${label} mutation failed: HTTP ${response.status}`);
  return data.result;
}
