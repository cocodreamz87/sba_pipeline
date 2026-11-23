export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (env.RELAY_INGRESS_TOKEN) {
      const incomingToken = (request.headers.get('x-relay-token') || '').trim();
      if (incomingToken !== env.RELAY_INGRESS_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized relay caller' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const targetUrl = env.MAKE_WEBHOOK_URL;
    const webhookSecret = env.MAKE_WEBHOOK_SECRET || env.SBA_WEBHOOK_SECRET;

    if (!targetUrl || !webhookSecret) {
      return new Response(JSON.stringify({ error: 'Missing Worker configuration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await request.text();
    const contentType = request.headers.get('content-type') || 'application/json';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'X-Webhook-Secret': webhookSecret,
          'X-Forwarded-By': 'cloudflare-worker-relay',
        },
        body: rawBody,
        signal: controller.signal,
      });

      const responseText = await upstreamResponse.text();

      return new Response(responseText || JSON.stringify({ ok: upstreamResponse.ok }), {
        status: upstreamResponse.status,
        headers: {
          'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json',
        },
      });
    } catch (err) {
      const isTimeout = err?.name === 'AbortError';
      return new Response(
        JSON.stringify({
          error: isTimeout ? 'Upstream Make webhook timeout' : 'Failed to forward webhook',
        }),
        {
          status: isTimeout ? 504 : 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  },
};
