-- ============================================================
-- MasterADHD — backend (Supabase / Postgres)
-- Konto: Supabase Auth (auth.users). Sync: JEDEN wiersz stanu na
-- użytkownika, przechowywany jako SZYFROGRAM (E2E po stronie klienta).
-- Serwer nie widzi treści dziennika/emocji — tylko ciphertext + iv + salt.
-- Dostęp pilnuje Row Level Security: użytkownik widzi wyłącznie swój wiersz.
-- ============================================================

create table if not exists public.user_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  -- E2E: treść zaszyfrowana w przeglądarce (AES-GCM, klucz z hasła użytkownika)
  ciphertext  text,
  iv          text,          -- wektor inicjujący (base64), jawny
  salt        text,          -- sól do PBKDF2 (base64), jawna
  -- monetyzacja: 'free' | 'paid'. Ustawiane WYŁĄCZNIE przez webhook Stripe
  -- (service role), nigdy przez klienta — patrz polityki niżej.
  plan        text not null default 'free',
  updated_at  timestamptz not null default now()
);

alter table public.user_state enable row level security;

-- Odczyt: tylko własny wiersz.
create policy "state_select_own"
  on public.user_state for select
  using (auth.uid() = user_id);

-- Wstawienie: tylko dla siebie i tylko z planem 'free' (klient nie nadaje sobie 'paid').
create policy "state_insert_own"
  on public.user_state for insert
  with check (auth.uid() = user_id and plan = 'free');

-- Aktualizacja: tylko własny wiersz; klient NIE może zmienić kolumny plan
-- (wymuszamy równość ze stanem sprzed update — plan zmienia tylko service role
-- z pominięciem RLS w webhooku Stripe).
create policy "state_update_own"
  on public.user_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and plan = (select plan from public.user_state s where s.user_id = auth.uid()));

-- Usunięcie konta kasuje wiersz automatycznie (on delete cascade z auth.users),
-- ale pozwalamy też skasować dane ręcznie (RODO art. 17).
create policy "state_delete_own"
  on public.user_state for delete
  using (auth.uid() = user_id);

-- Auto-aktualizacja updated_at.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_user_state_touch on public.user_state;
create trigger trg_user_state_touch
  before update on public.user_state
  for each row execute function public.touch_updated_at();
