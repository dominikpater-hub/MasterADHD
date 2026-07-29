# Changelog

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).

## [Nieopublikowane] — kalendarz (A-6, A-7)

Zweryfikowane w headless Chromium: 0 błędów; z kalendarzem OFF **zero żądań do
Google**; `calWindow` liczy okno poprawnie (pomija zdarzenia całodniowe i trwające);
okno wpływa na dobór.

### Dodane
- **Kalendarz — okno czasu w doborze (P-34).** Domknięty OAuth bez backendu przez
  **Google Identity Services** (token client, zakres `calendar.readonly`, tylko Client ID
  typu „Web" — żaden sekret; rozwiązuje A-6). `getCalToken()` (token w pamięci, ~1h),
  `connectCalendar()` przy włączeniu zgody `gcal`, `refreshCalWindow()` cicho odświeża
  okno na starcie check-inu — więc `FREE_WINDOW` realnie zasila `scoreTask`/`pickReal`
  i plakietkę „X min do następnej rzeczy" (rozwiązuje A-7, martwy dotąd tor).

### Zmienione
- `calWindow()` bierze pierwszy **przyszły** start z godziną (pomija całodniowe i
  trwające); z kalendarza nadal czyta wyłącznie minuty — tytuły/uczestnicy/lokalizacja
  nie są odczytywane (P-34/P-38). DPIA zaktualizowana (R-10).

## [v19] — skala

Backend, konto, sync, monetyzacja, DPIA. Dostarczone jako **poprawne źródło +
instrukcja wdrożenia** (backendu/płatności nie da się uruchomić z repo). Wszystko
domyślnie WYŁĄCZONE — aplikacja działa lokalnie, dopóki nie wpiszesz configu.

Zweryfikowane w headless Chromium: 0 błędów; z sync OFF **zero żądań zewnętrznych**
(offline-first zachowany); szyfrowanie E2E round-trip PASS (złe hasło nie odszyfruje,
szyfrogram nie zawiera jawnej treści); (de)serializacja stanu i lokalny fallback
logowania PASS.

### Dodane
- **Backend Supabase (`backend/supabase/`).** Migracja SQL: tabela `user_state`
  (jeden wiersz/użytkownika), **Row Level Security** (każdy widzi tylko swój wiersz),
  kolumna `plan` zmieniana wyłącznie rolą serwisową. README z wdrożeniem.
- **Konto + sync + E2E (`js/13-sync.js`).** Supabase Auth (e-mail/hasło, OAuth);
  synchronizacja stanu z **szyfrowaniem po stronie klienta** (AES-GCM, klucz z hasła
  przez PBKDF2 — serwer widzi tylko szyfrogram); autosync przy chowaniu aplikacji;
  panel „Konto i synchronizacja" w Połączeniach. SDK ładowany dynamicznie tylko przy
  włączonym sync, więc tryb lokalny nie pobiera niczego.
- **Monetyzacja free/paid (`backend/stripe/`).** Edge Functions: `checkout` (sesja
  Stripe) i `webhook` (nadaje `paid` rolą serwisową — klient nie może sam sobie
  zmienić planu). `isPaid()` w kliencie + bramka na `callModel` (aktywna tylko gdy
  backend włączony). Free = pełne offline, paid = AI + sync.
- **DPIA (`docs/DPIA.md`).** Ocena skutków przed wdrożeniem backendu/kalendarza:
  rejestr ryzyk, środki (E2E, RLS, minimalizacja, skan kryzysowy), warunki dopuszczenia.

### Zmienione
- **Logowanie (`08-auth.js`).** `submitAuth`/`oauth` używają realnego Supabase Auth,
  gdy backend skonfigurowany, z płynnym fallbackiem do lokalnej sesji, gdy wyłączony.

## [v18] — wartość

Zweryfikowane w headless Chromium (0 błędów; share target, „wklej listę", kafelek
ankiety, fallback audio PASS; ścieżka powiadomień z Notification Triggers PASS na
stubie — headless twardo blokuje realne Notification, więc gałąź „granted" testowana
przez stub, a „denied" zwraca poprawne `blocked`).

### Dodane
- **Powiadomienia — nośnik dla pingu/kotwicy (`js/11-notify.js`).** `armReminder()`
  planuje realne przypomnienie lokalne: przez **Notification Triggers** (przeżywa
  zamknięcie aplikacji) tam, gdzie wspierane, i uczciwy fallback sesyjny (setTimeout,
  tylko przy otwartej aplikacji) tam, gdzie nie. Ekran „trzymam czas" dostał przycisk
  „Przypomnij mi za 10 min 🔔", a copy mówi wprost, jaki nośnik zadziałał. Koniec
  obietnicy „sprawdzę Cię za 10 minut" bez pokrycia (B-4, C-8).
- **Realne wejście zadań (C-6 — największe ryzyko produktowe).**
  - *Share target*: `manifest.share_target` + `handleShareTarget()` — tekst udostępniony
    z dowolnej aplikacji startuje MasterADHD z `?text=…` i wpada jako zadanie (ze skanem
    kryzysowym; URL czyszczony po odczycie).
  - *„Wklej listę"*: pole wielu linii w ekranie zadań → parsowanie po `\n` → wiele zadań
    naraz. Dziesięć sekund zamiast dziesięciu formularzy.
- **Ankieta emocji na własnym kafelku (B-7).** Najbogatszy moduł nie jest już schowany
  w szarej stopce — kafelek „🎯 Nazwij dokładniej" prowadzi wprost do `openSurvey()`.
- **Pipeline audio Maxa (C-10).** `js/12-audio.js` + `audio/`: `playMax(key, text, fired)`
  gra nagranie, a przy jego braku spada do TTS. Podpięte kwestie: domknięcie sesji,
  body-double, offline. `audio/README.md` z listą kwestii do nagrania.

## [v17] — fundament

Zweryfikowane w headless Chromium (0 błędów; SW aktywny; reload offline serwuje
całą aplikację z cache; eksport/usunięcie i ciągła oś napięcia PASS).

### Dodane
- **Proxy do modelu (A-1).** Cloudflare Worker w `worker/` (klucz w sekrecie,
  rate-limit per IP przez KV, whitelist modeli, zawężony CORS) + instrukcja wdrożenia.
  Klient (`js/03-ai.js`) ma jedno wejście `callModel()` wołające konfigurowalny
  `AI_PROXY_URL`; usunięte bezpośrednie wywołania `api.anthropic.com`. Puste `AI_PROXY_URL`
  = AI wyłączone (bezpieczny domyślny stan).
- **Manifest + service worker (A-8).** `manifest.webmanifest`, ikony (192/512/maskable/SVG),
  `sw.js` (cache-first na powłokę, aktualizacja w tle, nawigacja offline). „Max działa offline"
  przestaje być obietnicą bez pokrycia; aplikacja instaluje się na ekranie głównym.
- **Eksport i usunięcie danych (RODO art. 15/17/20).** „Połączenia → Twoje dane":
  `exportData()` (zrzut całego stanu do JSON) i `wipeData()` (trwałe skasowanie + reset).
  Panel zaufania i zgoda znów obiecują pobranie/usunięcie — bo teraz to prawda.
- **Polityka prywatności.** `docs/POLITYKA-PRYWATNOSCI.md` — realny dokument (art. 9,
  podstawy prawne, prawa, retencja), z polami do uzupełnienia przez administratora.

### Zmienione
- **Ciągła funkcja napięcia (A-4).** `scoreTask` liczy `dread × (napięcie − 40) × 0.4`
  zamiast dwóch progów 60/30. Oś napięcia — wyróżnik produktu — działa teraz od stanu
  domyślnego (suwak startuje na 50), nie tylko na skrajnościach. Zweryfikowane: przy
  energii 15 i napięciu 50 Max nie podsuwa już telefonu do urzędu (dread 4).

## [v16.1] — naprawy, zero nowych funkcji

Cel: produkt przestaje kłamać. Wszystkie naprawy zweryfikowane w headless Chromium
(0 błędów konsoli/runtime, testy funkcjonalne PASS).

### Naprawione
- **A-2 — `promoteDump` gubił dane.** Pole to `text`, nie `txt` (etykieta + `taskAdd`);
  dodany guard: wpis dostaje `promoted` dopiero, gdy zadanie realnie powstało.
- **A-3 — Max pytał o zadanie dwa razy** i kasował pierwszą odpowiedź. Usunięta zbędna
  scena `sceneAsk` z głównej ścieżki; `beginSteps` nie nadpisuje `sessionTask` pustym polem,
  a pamięć Maxa karmi się z głównego przepływu.
- **A-5 — ankieta zanieczyszczała statystykę.** `readPatterns` filtruje wpisy `v/a=null`,
  więc emocje z ankiety nie lądują wszystkie w ćwiartce „niska energia i ciężko".
- **A-1b — zgoda `ai` egzekwowana w kodzie.** `tailorSteps` i `analyzeDump` sprawdzają
  `consLoad().ai` jako pierwszą linię — bez zgody treść nie opuszcza urządzenia (art. 9 RODO).
- **A-9 — skan kryzysowy na każdym polu.** Wspólny `readUserText()` ze `scanCrisis` na
  `taskInput`, `tkNew` (dwa wejścia) i `rvText`, nie tylko na zrzucie myśli.
- **A-11 — XSS z odpowiedzi modelu.** `esc()` na `mirror/emotion/tasks/question`;
  pierwsze zadanie trzymane w zmiennej zamiast wstrzykiwane do atrybutu `onclick`.
- **B-1 — formy rodzajowe.** ~15 zaszytych form męskich przepisanych na bezosobowe/`F()`
  (ekran wsparcia, domknięcie sesji, czat, mapa, suwaki, atlas emocji, czujniki snu,
  handoff, uzasadnienie doboru). Żeńskie i neutralne profile nie są już misgenderowane.
- **B-4 — niedotrzymane obietnice.** Copy przestaje obiecywać rzeczy bez nośnika:
  „Sprawdzę Cię za 10 min"/„odezwę się" → obecność, gdy wrócisz (brak powiadomień);
  „Wyślij Maxowi" → „Zapisz uwagę"; „poukładam, gdy wrócę do sieci" → uczciwie o zapisie
  lokalnym; „cofnięcie zgody kasuje" → prawda o danych lokalnych; panel zaufania
  („pobierz/usuń wszystko", „w UE", „offline") → stan faktyczny (dane tylko na urządzeniu).
- **A-14 — martwy kod.** Usunięte: `maxGreeting`, `openNow`, `przecinekImie`, `gtPull`,
  `voiceReady`, oraz osierocone reguły CSS (`.now-card*`, `.now-eyebrow`, `.now-energy*`,
  `.now-task`, `.now-why`, `.now-go`, `.energy-pick`, `.energy-btn*`).

### Poza zakresem v16.1 (zostaje na później)
Wymagają backendu lub większej pracy: A-1 (proxy do modelu), A-4 (ciągła funkcja napięcia),
A-6/A-7 (Google Tasks / kalendarz), A-8 (manifest + service worker), A-10 (eksport/usunięcie —
RODO art. 17/20), A-13 (własne formy rodzaju). Patrz `docs/AUDYT-v16.1.0.md`, sekcja D.

## [Nieopublikowane] — rozbicie na źródło

### Zmienione
- **Rozbicie prototypu jednoplikowego na źródło.** Monolit `MasterADHD-v16.html`
  (3426 linii) podzielony na `index.html` + `css/styles.css` + 10 modułów `js/*.js`
  wg banerów sekcji. Klasyczne `<script>` (nie moduły ES), by nie zerwać inline `onclick`;
  kolejność ładowania zachowana. Zachowanie identyczne z prototypem (parytet w Chromie).

### Dodane
- `README.md`, `docs/AUDYT-v16.1.0.md`, `docs/prototype-v16-monolith.html`,
  `.gitignore`, `LICENSE`.
