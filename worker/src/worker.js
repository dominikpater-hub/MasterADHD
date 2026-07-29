/* ============================================================
   MasterADHD — proxy AI (Cloudflare Worker)
   ------------------------------------------------------------
   Po co: klient NIGDY nie trzyma klucza API (każdy by go odczytał
   i wydrenował budżet) i nie woła Anthropic bezpośrednio (CORS + 401).
   Ten Worker jest jedynym miejscem, które zna klucz. Klient woła własny
   endpoint, a Worker dokłada nagłówek autoryzacji i przekazuje żądanie.

   Wdrożenie: patrz worker/README.md.
   Sekret:   wrangler secret put ANTHROPIC_API_KEY
   Zmienne:  ALLOWED_ORIGIN (zawęź do swojej domeny w produkcji)
   Rate-limit: opcjonalny binding KV o nazwie RATE (jeśli brak — pomijany).
   ============================================================ */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// Model whitelist — klient nie wybiera dowolnego modelu.
const ALLOWED_MODELS = new Set(['claude-sonnet-4-6', 'claude-3-5-haiku-latest']);
const MAX_TOKENS_CAP = 1200;

// Rate limit (jeśli podpięto KV RATE): N żądań / okno na IP.
const RATE_LIMIT = 30;
const RATE_WINDOW_S = 60;

function cors(origin, allowed) {
  const allow = (allowed === '*' || allowed === origin) ? (allowed === '*' ? '*' : origin) : allowed;
  return {
    'Access-Control-Allow-Origin': allow || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) }
  });
}

async function limited(env, ip) {
  if (!env.RATE || !ip) return false;                 // brak KV → nie limitujemy
  try {
    const key = 'rl:' + ip;
    const cur = parseInt((await env.RATE.get(key)) || '0', 10);
    if (cur >= RATE_LIMIT) return true;
    await env.RATE.put(key, String(cur + 1), { expirationTtl: RATE_WINDOW_S });
    return false;
  } catch (e) {
    return false;                                     // błąd KV nie może blokować użytkownika
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = env.ALLOWED_ORIGIN || '*';
    const ch = cors(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, ch);
    if (!env.ANTHROPIC_API_KEY) return json({ error: 'server_not_configured' }, 500, ch);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (await limited(env, ip)) return json({ error: 'rate_limited' }, 429, ch);

    let body;
    try { body = await request.json(); }
    catch (e) { return json({ error: 'bad_json' }, 400, ch); }

    const model = ALLOWED_MODELS.has(body.model) ? body.model : 'claude-sonnet-4-6';
    const max_tokens = Math.min(parseInt(body.max_tokens, 10) || 1000, MAX_TOKENS_CAP);
    const messages = Array.isArray(body.messages) ? body.messages : null;
    if (!messages) return json({ error: 'missing_messages' }, 400, ch);

    let upstream;
    try {
      upstream = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION
        },
        body: JSON.stringify({ model, max_tokens, messages })
      });
    } catch (e) {
      return json({ error: 'upstream_unreachable' }, 502, ch);
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...ch }
    });
  }
};
