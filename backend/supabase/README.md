# MasterADHD — backend (Supabase)

Konto, sync i podstawa monetyzacji. Zaprojektowane tak, że **serwer nie widzi
treści** — dziennik i emocje są szyfrowane w przeglądarce (E2E, AES-GCM), a do
chmury trafia tylko szyfrogram. To nie jest wygoda, tylko wymóg: to dane o
zdrowiu psychicznym (art. 9 RODO). Pełna analiza: `docs/DPIA.md`.

## Co jest w środku

- **Auth** — Supabase Auth (e-mail + hasło, OAuth). Konto = `auth.users`.
- **Sync** — jeden wiersz `public.user_state` na użytkownika: `ciphertext`,
  `iv`, `salt`, `plan`, `updated_at`. Row Level Security: każdy widzi tylko swój wiersz.
- **Plan** — `free` / `paid`. Klient **nie może** sam sobie nadać `paid`
  (polityki RLS + zmiana planu tylko przez webhook Stripe z rolą serwisową).

## Wdrożenie

1. Załóż projekt na [supabase.com](https://supabase.com) (darmowy plan wystarcza na start).
2. Uruchom migrację `migrations/0001_init.sql` (SQL Editor → wklej → Run,
   albo `supabase db push` z Supabase CLI).
3. Włącz dostawców logowania (Auth → Providers): e-mail; opcjonalnie Google/Apple.
4. Skopiuj z Project Settings → API: **Project URL** i **anon public key**.
5. Wpisz je w `js/13-sync.js`:

   ```js
   const SUPABASE_URL = 'https://TWOJ-PROJEKT.supabase.co';
   const SUPABASE_ANON_KEY = 'ey...';   // anon key jest publiczny — może być w kliencie
   ```

Puste `SUPABASE_URL`/`SUPABASE_ANON_KEY` = konto i sync **wyłączone**; aplikacja
działa w trybie lokalnym (jak dziś, w całości offline).

## Model szyfrowania (E2E)

- Klucz AES-GCM jest wyprowadzany z **hasła użytkownika** (PBKDF2, 150k iteracji)
  i `salt` zapisanym przy wierszu. Klucz **nigdy** nie opuszcza urządzenia i nie
  jest zapisywany — żyje tylko w pamięci sesji.
- Konsekwencja (uczciwie): **utrata hasła = utrata dostępu do zaszyfrowanych
  danych w chmurze**. Reset hasła w Supabase odzyskuje konto, ale nie odszyfruje
  starego wiersza — trzeba go nadpisać nowym stanem. Lokalna kopia na urządzeniu
  zostaje nietknięta. Zaplanuj UX odzyskiwania przed produkcją.
- Logowanie przez OAuth (Google/Apple) nie ma hasła → E2E wymaga wtedy osobnej
  frazy szyfrującej. To jest świadomie zostawione jako następny krok (patrz DPIA).

## Enforcement planu (paid)

Bramka `isPaid()` w kliencie służy do UX (co pokazać). **Twarde** wymuszenie
płatnej warstwy AI odbywa się na proxy (`worker/`): Worker powinien weryfikować
JWT użytkownika Supabase i jego `plan` przed wywołaniem modelu. To jest krok
wdrożeniowy opisany w `backend/stripe/README.md`.
