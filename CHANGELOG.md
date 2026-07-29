# Changelog

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).

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
