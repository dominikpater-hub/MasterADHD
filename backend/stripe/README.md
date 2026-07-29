# MasterADHD — płatności (Stripe, przez Supabase Edge Functions)

Model: **free = wszystko offline i lokalnie; paid = warstwa AI + sync między
urządzeniami.** To rzadka sytuacja, w której granica produktowa, prywatnościowa
i cenowa pokrywają się: darmowe działa bez sieci i bez kosztu per użytkownik,
płatne dokłada model (realny koszt) i chmurę.

Dwie funkcje brzegowe (Deno) + jedna reguła: **plan `paid` nadaje wyłącznie
webhook Stripe rolą serwisową** — klient nigdy nie ustawia sobie planu (patrz
polityki RLS w `backend/supabase/migrations/0001_init.sql`).

## Pliki

- `functions/checkout/index.ts` — tworzy sesję Stripe Checkout dla zalogowanego
  użytkownika i zwraca URL do przekierowania.
- `functions/webhook/index.ts` — odbiera zdarzenia Stripe i ustawia `plan`
  (`paid` po opłaceniu, `free` po anulowaniu/wygaśnięciu).

## Wdrożenie

1. Konto Stripe → produkt subskrypcyjny → zanotuj `price_id`.
2. Sekrety w Supabase:
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_...
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
   supabase secrets set STRIPE_PRICE_ID=price_...
   ```
3. Deploy:
   ```bash
   supabase functions deploy checkout
   supabase functions deploy webhook --no-verify-jwt
   ```
4. W panelu Stripe ustaw endpoint webhooka na URL funkcji `webhook`.
5. Wpisz URL funkcji `checkout` w `js/13-sync.js` → `CHECKOUT_URL`.

## Twarde wymuszenie AI (ważne)

`isPaid()` w kliencie decyduje tylko, co pokazać. **Płatną warstwę AI wymusza
proxy** (`worker/`): Worker powinien przyjmować token JWT użytkownika Supabase,
sprawdzić `plan` w tabeli `user_state` (przez REST z anon/service key) i dopiero
wtedy wołać model. Bez tego kroku ktoś mógłby wołać Worker z pominięciem UI.
To jedyne miejsce, gdzie enforcement jest bezpieczny.
