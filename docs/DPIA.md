# Ocena skutków dla ochrony danych (DPIA) — MasterADHD

**Wersja:** 1.0 · **Data:** 2026-07-29 · **Status:** wstępna, do zatwierdzenia przed wdrożeniem backendu

> DPIA jest wymagana (art. 35 RODO), bo MasterADHD przetwarza **dane o zdrowiu
> psychicznym na dużą skalę** — szczególną kategorię danych (art. 9). Ten
> dokument to baza; przed produkcją zatwierdza go administrator (i w razie
> wysokiego ryzyka szczątkowego — konsultacja z organem, art. 36).

## 1. Opis przetwarzania

- **Cel:** wsparcie osób z ADHD w rozpoczynaniu zadań i rozumieniu własnych stanów.
- **Dane:** wpisy dziennika, pomiary nastroju/emocji, zadania, profil, opcjonalnie
  sen (ręcznie). Część to dane o zdrowiu psychicznym (art. 9).
- **Podmioty:** dorośli użytkownicy (i młodzież — patrz ryzyko R-6).
- **Podstawa:** wyraźna zgoda (art. 9 ust. 2 lit. a); zgody opcjonalne (AI, kalendarz,
  czujniki) osobno, domyślnie wyłączone.
- **Przepływ danych:**
  - *Tryb lokalny (domyślny):* wszystko w `localStorage`, nic nie wychodzi.
  - *Sync (opcjonalny, paid):* stan szyfrowany w przeglądarce (E2E, AES-GCM),
    do Supabase trafia tylko szyfrogram.
  - *AI (opcjonalna, za zgodą):* treść pojedynczego zadania/wpisu idzie przez
    proxy (`worker/`) do Anthropic na czas analizy.

## 2. Konieczność i proporcjonalność

Zbieramy minimum potrzebne do działania (minimalizacja, art. 5). Heurystyki
działają lokalnie, więc większość funkcji nie wymaga wysyłania czegokolwiek.
Kalendarz (planowany) czyta wyłącznie liczbę minut do następnego zdarzenia —
tytuły i uczestnicy są odrzucane w miejscu odczytu (P-34/P-38), więc nie trafiają
do pamięci aplikacji.

## 3. Rejestr ryzyk i środki

| # | Ryzyko | Środek |
|---|--------|--------|
| R-1 | Wyciek danych o zdrowiu z serwera | **E2E: serwer widzi tylko szyfrogram.** Klucz z hasła (PBKDF2 150k), nigdy nie wysyłany. |
| R-2 | Dostęp do cudzych danych | **Row Level Security** — każdy widzi tylko swój wiersz (`auth.uid() = user_id`). |
| R-3 | Klucz API modelu wycieka z klienta | Klucz wyłącznie na proxy (`worker/`); klient nie zna klucza. |
| R-4 | Treść dziennika wychodzi bez zgody | Bramka `consLoad().ai` w pierwszej linii wywołań AI (A-1b); skan kryzysowy on-device przed wysłaniem (A-9). |
| R-5 | Utrata hasła = utrata danych w chmurze | Uczciwie zakomunikowane; lokalna kopia zostaje; UX odzyskiwania do zaprojektowania przed produkcją. |
| R-6 | Małoletni użytkownicy | Ekran wsparcia ma osobny numer 116 111; wymóg wieku i weryfikacja do ustalenia w polityce. |
| R-7 | Lustro mówi nieprawdę o stanie (błąd danych) | Doktryna „lustro, nie diagnoza"; naprawiony bug zanieczyszczający statystykę (A-5); brak wniosków diagnostycznych. |
| R-8 | Nieaktualne numery pomocowe | Data weryfikacji w kodzie + coroczny przegląd (decyzja GENESIS). |
| R-9 | Profilowanie / rozpoznawanie emocji w pracy/edukacji (AI Act) | Wyłącznie B2C wellness; ścieżka „dla pracodawców/uczelni" świadomie odrzucona. |

## 4. Prawa podmiotów

Dostęp, przenoszenie i usunięcie realizowane w aplikacji (**Połączenia → Twoje
dane**: eksport JSON, trwałe usunięcie). Cofnięcie zgody zatrzymuje wysyłanie.
Szczegóły: `docs/POLITYKA-PRYWATNOSCI.md`.

## 5. Ryzyko szczątkowe i wniosek

Po zastosowaniu środków (E2E, RLS, minimalizacja, proxy, skan kryzysowy) ryzyko
oceniamy jako **niskie–średnie**. Warunki dopuszczenia do produkcji:

1. UX odzyskiwania po utracie hasła (R-5).
2. Rozstrzygnięcie kwestii wieku i weryfikacji (R-6).
3. E2E dla logowania OAuth (osobna fraza szyfrująca) — dziś tylko e-mail+hasło.
4. Twarde wymuszenie planu paid na proxy przed włączeniem AI dla wielu użytkowników.

Kalendarza **nie wdrażamy** przed zamknięciem powyższych i aktualizacją tej DPIA.
