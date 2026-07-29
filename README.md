# MasterADHD · Max

Aplikacja-towarzysz dla osób z ADHD. **Max** to trener nastroju (nie lista zadań, nie terapeuta),
który w kryzysie jest ściszony i konkretny, a na co dzień pomaga ruszyć z miejsca — wskazując
**realną rzecz z Twojej listy**, nigdy nie wymyślając zadań za Ciebie.

> „Im więcej takich planów znasz, tym mniej mnie potrzebujesz."

To repozytorium to **źródło** aplikacji rozbite z jednoplikowego prototypu (`v16`) na czytelną,
utrzymywalną strukturę plików. Zachowanie jest identyczne z prototypem — patrz [Weryfikacja](#weryfikacja).

---

## Zasady produktu (co jest przewagą)

- **Oś napięcia w doborze zadań.** Silnik mierzy *napięcie* jako osobną oś i stosuje regułę
  „napięcie tłumi dread" — wyczerpanej, spiętej osobie nie podsuwa najtrudniejszej rzeczy.
  Tego nie ma żaden profilowany konkurent.
- **Max nigdy nie wymyśla zadania.** Gdy nie ma z czego wybrać, mówi to wprost, zamiast
  serwować „poradę z internetu".
- **Licznik, który nie karze.** Nagroda idzie za *powrót* i za *start*, nie za nieprzerwaną passę.
- **Heurystyki lokalne zamiast chmury.** ~90% pracy dzieje się offline, bez inferencji —
  argument prywatnościowy i kosztowy zarazem.
- **Deterministyczna warstwa bezpieczeństwa.** Numery pomocowe w kodzie, skan on-device
  *przed* wysłaniem czegokolwiek do modelu, przycisk wsparcia zawsze widoczny.

---

## Struktura repozytorium

```
MasterADHD/
├── index.html            # szkielet: <head>, markup ekranów, ładowanie modułów
├── css/
│   └── styles.css        # cała warstwa wizualna (motyw, sceny, komponenty)
├── js/                   # moduły ładowane po kolei jako klasyczne <script>
│   ├── 01-core.js        # persona Maxa, pamięć sesji, licznik startów, mapa
│   ├── 02-safety.js      # warstwa bezpieczeństwa §16, ekran wsparcia, głos (TTS), wibracje
│   ├── 03-ai.js          # warstwa AI (tailorSteps, analyzeDump) — WYMAGA proxy backendowego
│   ├── 04-now.js         # tryb TERAZ, główny pomiar (3 suwaki), „Zrzuć myśli", czat
│   ├── 05-profile.js     # formy gramatyczne, powitania, Max jako gospodarz, recenzje
│   ├── 06-emotions.js    # „Zrzuć emocje" (model Russella), Atlas emocji, ankieta różnicująca
│   ├── 07-goals.js       # cele/profil, motywacja do regularności, plany jeśli-to
│   ├── 08-auth.js        # Guardian ID — logowanie (etap 1, bez backendu)
│   ├── 09-tasks.js       # warstwa zadań, wzbogacanie heurystyczne, DOBÓR, „Twoje rzeczy"
│   └── 10-sensors.js     # połączenia i zgody, Google Tasks (szkielet), kalendarz, czujniki
└── docs/
    ├── AUDYT-v16.1.0.md              # pełny audyt (techniczny · treści · potencjału)
    └── prototype-v16-monolith.html  # zamrożony prototyp jednoplikowy (proweniencja)
```

### Dlaczego klasyczne `<script>`, nie moduły ES

Cała aplikacja opiera się na inline'owych `onclick="fn()"`, które rozwiązują funkcje z zasięgu
globalnego. Moduły ES mają własny zasięg i zerwałyby te wywołania. Pliki `js/*.js` to zwykłe
skrypty ładowane **w kolejności** — dzielą globalny zasięg leksykalny (współdzielone `const`/`let`)
i globalny obiekt (deklaracje funkcji), więc podział jest czysto organizacyjny i **nie zmienia
zachowania**. Kolejność ładowania w `index.html` musi być zachowana.

---

## Uruchomienie lokalne

Aplikację trzeba serwować po HTTP (przeglądarki nie ładują zewnętrznych `<script>`/`<link>`
z `file://` przy części ustawień). Dowolny statyczny serwer wystarczy:

```bash
# Python
python3 -m http.server 8000
# albo Node
npx serve .
```

Następnie otwórz `http://localhost:8000`.

### Uwaga o warstwie AI

`js/03-ai.js` woła `https://api.anthropic.com` bezpośrednio z przeglądarki. Działa to **wyłącznie**
w środowisku artefaktów Claude, gdzie autoryzację wstrzykuje host. W realnym wdrożeniu (PWA)
wymaga **proxy po stronie serwera** (Cloudflare Worker / Edge Function) z kluczem w zmiennej
środowiskowej — patrz audyt, punkt A-1. Bez tego moduł AI jest wyłączony, a reszta aplikacji
(heurystyki lokalne) działa normalnie.

---

## Roadmapa

Pełna lista i uzasadnienia: [`docs/AUDYT-v16.1.0.md`](docs/AUDYT-v16.1.0.md), sekcja D.

- **v16.1 — same naprawy, zero nowych funkcji.** `promoteDump` gubi dane (A-2), Max pyta dwa razy
  (A-3), ankieta emocji zanieczyszcza statystykę (A-5), egzekwowanie zgody `ai` (A-1b), skan
  kryzysowy na wszystkich polach (A-9), `esc()` na odpowiedziach modelu (A-11), formy rodzajowe
  (B-1), usunięcie niedotrzymanych obietnic (B-4), martwy kod (A-14). *Cel: produkt przestaje kłamać.*
- **v17 — fundament.** Proxy do modelu, manifest + service worker („offline" staje się prawdą),
  eksport + usunięcie danych (RODO art. 17/20), ciągła funkcja napięcia (A-4), polityka prywatności.
- **v18 — wartość.** Powiadomienia (nośnik dla kotwicy zdarzeniowej), realne wejście zadań
  (share target + „wklej listę"), własne audio Maxa, ankieta emocji na własnym kafelku.
- **v19 — skala.** Backend, konto, sync, monetyzacja (free = offline, paid = warstwa AI), DPIA.

---

## Weryfikacja

Rozbity build został sprawdzony w headless Chromium (viewport 390×844) i porównany z prototypem:

- `node --check` przechodzi dla każdego modułu z osobna (brak przecięć w środku funkcji) i dla całości,
- 0 błędów konsoli (poza 404 favicon) i 0 `pageerror` przy ładowaniu,
- komplet globalnych funkcji obecny i wywoływalny ponad granicami modułów,
- render ekranu logowania i treść identyczne z prototypem (parytet: **PASS**).

---

## Status i znane ograniczenia

Aplikacja jest **prototypem**. Audyt (`docs/AUDYT-v16.1.0.md`) opisuje blokery, które w realnym
wdrożeniu wyłączają główną obietnicę produktu — zwłaszcza brak backendu (AI, logowanie, sync,
Google Tasks, kalendarz są dziś szkieletem lub atrapą). Zbieranie danych o stanie psychicznym
(art. 9 RODO) wymaga polityki prywatności, eksportu i usuwania danych **przed** uruchomieniem backendu.

---

© Dominik Pater. Wszelkie prawa zastrzeżone.
