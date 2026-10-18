export function verifyStagingCors(response, origin) {
  const methods = (response.headers.get('access-control-allow-methods') ?? '').split(',').map((value) => value.trim());
  // Access responds to approved preflight with 200; the Worker responds with 204.
  if (![200, 204].includes(response.status) || response.headers.get('access-control-allow-origin') !== origin ||
      response.headers.get('access-control-allow-credentials') !== 'true' || !methods.includes('GET')) {
    throw new Error(`Staging API CORS proof failed (HTTP ${response.status})`);
  }
  return { status: response.status, origin, credentials: true, method: 'GET' };
}
