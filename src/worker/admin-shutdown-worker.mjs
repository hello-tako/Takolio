// Containment deliberately has no imports, bindings, assets or authentication dependencies.
export default {
  fetch() {
    return new Response('Not Found', { status: 404, headers: {
      'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Admin-Disabled': 'true', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    } });
  },
};
