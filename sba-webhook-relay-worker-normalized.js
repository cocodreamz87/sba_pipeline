function cleanStr(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function extractEmail(raw) {
  const candidate = cleanStr(
    raw.from_email ||
      raw.sender_email ||
      raw.email ||
      raw.envelope?.from ||
      (typeof raw.from === 'string' && raw.from.includes('@') ? raw.from : '') ||
      (typeof raw.sender === 'string' && raw.sender.includes('@') ? raw.sender : '')
  );
  // Extracts bare email from "Display Name <user@domain.com>" if present
  const match = candidate.match(/<([^>\s]+@[^>\s]+)>/) || candidate.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/);
  return (match ? match[1] : candidate).trim().toLowerCase();
}

function extractPhone(raw) {
  const candidate = cleanStr(
    raw.from_phone ||
      raw.sender_phone ||
      raw.phone ||
      raw.From ||
      raw.from_number ||
      (typeof raw.from === 'string' && !raw.from.includes('@') ? raw.from : '')
  );
  const digits = candidate.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

function detectChannel(raw, fromEmail, fromPhone) {
  const explicit = cleanStr(raw.channel || raw.type || raw.event_type || '').toLowerCase();
  if (explicit.includes('sms') || explicit.includes('text') || explicit.includes('mms')) {
    return 'sms';
  }
  if (explicit.includes('email') || explicit.includes('mail')) {
    return 'email';
  }
  if (fromPhone && !fromEmail) return 'sms';
  if (fromEmail && !fromPhone) return 'email';
  return raw.From || raw.MessageSid ? 'sms' : 'email';
}

function extractBodyText(raw) {
  const text = cleanStr(
    raw.text ||
      raw.body_text ||
      raw.Body ||
      raw.message ||
      raw.snippet ||
      raw['stripped-text'] ||
      ''
  );
  if (text) return text;

  const html = cleanStr(raw.html || raw.body_html || '');
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTimestamp(raw) {
  const candidate = cleanStr(raw.occurred_at || raw.timestamp || raw.created_at || raw.date || '');
  if (!candidate) return new Date().toISOString();
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

async function parseIncomingBody(request) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  const rawText = await request.text();
  if (!rawText) return {};

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(rawText);
    return Object.fromEntries(params.entries());
  }

  if (contentType.includes('application/json') || rawText.trim().startsWith('{')) {
    const parsed = JSON.parse(rawText);
    // Unwrap common webhook envelopes like { data: { ... } } or { payload: { ... } }
    if (parsed && typeof parsed === 'object') {
      if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
        return { ...parsed, ...parsed.data };
      }
      if (parsed.payload && typeof parsed.payload === 'object' && !Array.isArray(parsed.payload)) {
        return { ...parsed, ...parsed.payload };
      }
    }
    return parsed;
  }

  return { text: rawText };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (env.RELAY_INGRESS_TOKEN) {
      const incomingToken = cleanStr(request.headers.get('x-relay-token') || '');
      if (incomingToken !== env.RELAY_INGRESS_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized relay caller' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!env.N8N_WEBHOOK_URL || !env.N8N_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: 'Missing Worker configuration' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let rawPayload;
    try {
      rawPayload = await parseIncomingBody(request);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fromEmail = extractEmail(rawPayload);
    const fromPhone = extractPhone(rawPayload);
    const channel = detectChannel(rawPayload, fromEmail, fromPhone);
    const text = extractBodyText(rawPayload);
    const subject = cleanStr(
      rawPayload.subject ||
        rawPayload.subject_line ||
        (channel === 'sms' ? 'Inbound SMS Reply' : 'Inbound Email Reply')
    );
    const eventId = cleanStr(
      rawPayload.event_id ||
        rawPayload.message_id ||
        rawPayload.MessageSid ||
        rawPayload.id ||
        ''
    );
    const occurredAt = normalizeTimestamp(rawPayload);

    const normalizedPayload = {
      channel,
      from_email: fromEmail,
      from_phone: fromPhone,
      subject,
      text,
      event_id: eventId,
      occurred_at: occurredAt,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const upstreamResponse = await fetch(env.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': env.N8N_WEBHOOK_SECRET,
          'X-Forwarded-By': 'cloudflare-worker-relay',
        },
        body: JSON.stringify(normalizedPayload),
        signal: controller.signal,
      });

      const responseText = await upstreamResponse.text();

      return new Response(
        responseText || JSON.stringify({ ok: upstreamResponse.ok, channel }),
        {
          status: upstreamResponse.status,
          headers: {
            'Content-Type': upstreamResponse.headers.get('content-type') || 'application/json',
          },
        }
      );
    } catch (err) {
      const isTimeout = err?.name === 'AbortError';
      return new Response(
        JSON.stringify({
          error: isTimeout ? 'Upstream n8n timeout' : 'Failed to forward webhook',
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
