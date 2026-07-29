# MasterADHD — proxy AI (Cloudflare Worker)

Jedyne miejsce, które zna klucz API Anthropic. Klient (`js/03-ai.js`) woła ten
endpoint, a Worker dokłada autoryzację i przekazuje żądanie do Anthropic. Dzięki
temu klucz nigdy nie trafia do przeglądarki, a treść zadania idzie przez
kontrolowany kanał (rate-limit, whitelist modeli, zawężony CORS).

## Wdrożenie (kilka minut)

Wymagany [Node](https://nodejs.org) i konto Cloudflare (darmowy plan wystarcza).

```bash
cd worker
npm i -g wrangler            # albo: npx wrangler ...
wrangler login

# klucz API jako sekret (nie trafia do repo)
wrangler secret put ANTHROPIC_API_KEY

# (opcjonalnie) rate-limit per IP przez KV
wrangler kv namespace create RATE
#   → wklej zwrócone id do wrangler.toml (sekcja [[kv_namespaces]])

wrangler deploy
```

`wrangler deploy` wypisze URL, np. `https://masteradhd-ai-proxy.TWOJ-SUBDOMAIN.workers.dev`.

## Podłączenie klienta

W `js/03-ai.js` ustaw:

```js
const AI_PROXY_URL = 'https://masteradhd-ai-proxy.TWOJ-SUBDOMAIN.workers.dev';
```

Puste `AI_PROXY_URL` = warstwa AI wyłączona (aplikacja działa w całości na
heurystykach lokalnych — to bezpieczny domyślny stan). Dodatkowo AI odpala się
tylko przy włączonej zgodzie `ai` (patrz audyt A-1b).

## Bezpieczeństwo produkcyjne

- Ustaw `ALLOWED_ORIGIN` w `wrangler.toml` na swoją domenę (nie `*`).
- Whitelist modeli i limit `max_tokens` są w `src/worker.js` (`ALLOWED_MODELS`, `MAX_TOKENS_CAP`).
- Rate-limit działa dopiero po podpięciu KV `RATE`; bez niego Worker nie limituje.

## Kontrakt

`POST /` z ciałem:

```json
{ "model": "claude-sonnet-4-6", "max_tokens": 1000, "messages": [{ "role": "user", "content": "..." }] }
```

Odpowiedź: surowe body z Anthropic Messages API (klient czyta `content[].text`).
