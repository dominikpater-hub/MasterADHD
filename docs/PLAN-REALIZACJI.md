# MasterADHD — plan realizacji

**Wersja:** 1.0 · **Data:** 2026-08-02 · **Podstawa:** audyt repo 2.0 @ `c1afbca`
**Legenda kosztu:** S = ≤30 min · M = godziny · L = 1–3 dni · XL = tydzień+ / zależne od decyzji

---

## 0. Zasada nadrzędna (bramka bezpieczeństwa)

Dziś **wszystko domyślnie wyłączone = produkt jest bezpieczny**. Ryzyko aktywuje
się w dniu włączenia backendu. Dlatego jedna twarda reguła:

> **Nic nie idzie na produkcję z włączonym kontem / sync / AI multi-user, dopóki
> nie zamknięty jest cały Etap B.** Statyczny front (offline, bez backendu) można
> deployować od zaraz — Etap A to porządkuje.

---

## 1. Stan na dziś — zrobione i zweryfikowane 🔬

| Partia | Zakres | Commit |
|---|---|---|
| Źródło | rozbicie monolitu na 13 modułów, parytet | `b44bc46` |
| v16.1 | A-2, A-3, A-5, A-1b, A-9, A-11, B-1, B-4, A-14 — „produkt przestaje kłamać" | `91f79c1` |
| v17 | A-1 proxy, A-8 PWA/offline, RODO eksport/usunięcie, A-4 oś napięcia, polityka | `d84dedf` |
| v18 | powiadomienia, share target + „wklej listę", B-7 kafelek, pipeline audio | `4c1933c` |
| v19 | backend Supabase, konto+sync E2E, monetyzacja free/paid, DPIA | `9c73507` |
| Kalendarz | A-6/A-7: okno czasu w doborze przez GIS (P-34) | `716bdac` |
| C-1 | personalizacja języka: `MOOD_GRID` na rzeczowniki + kryzys | `97672ee` |
| v19.1 | S-9, S-8, C-2, S-7, S-15, T-3, U-4, U-5 — twardnienie przed deployem | `c1afbca` |

Baseline: 0 błędów runtime, 0 żądań zewnętrznych w stanie domyślnym, 8 blokerów v1.0 zamkniętych.

---

## 2. Etapy do realizacji

### Etap A — Sweep techniczny  ·  koszt M  ·  bez zależności, można od zaraz

Tani dług, który nie wymaga backendu. Dobry rozgrzewkowy sprint.

| ID | Zadanie | Koszt | Definicja ukończenia |
|---|---|---|---|
| T-4 / A-12 | ukończone zadania wypychają otwarte | S | osobny limit dla `done` albo czyszczenie >30 dni; test: 400 done nie wypycha otwartych |
| T-5 / A-13 | formy własne generują „gotowś/samś" | M | profil pyta o 2–3 formy zamiast wyprowadzać z końcówki; test render dla „zrobiłoś" |
| T-6 / A-19 | ciche `catch(e){}` przy zapisie | S | wykrycie `QuotaExceededError` → komunikat; nie „Zapisane." przy niepowodzeniu |
| T-7 / A-16 | recenzja zna 5/10 narzędzi | S | mapa `nazwy` uzupełniona o `mood/atlas/survey/tasks/profile` |
| T-9 / A-18 | dwa liczniki czasu | S | ujednolicić `daysSinceLastSeen`/`trackDay` na dni kalendarzowe |
| T-10 | martwy kod `_b`, `_unb`, `survStep` | S | usunięte; `syncPull` **podłączyć** (Etap B/T-2), nie usuwać |
| T-11 | share target offline | S | `caches.match('./index.html',{ignoreSearch:true})` jawnie |
| T-8 | strażnik kolizji globali w CI | S | skrypt `grep|sort|uniq -d` na deklaracjach top-level w CI |
| C-5 | data weryfikacji numerów pomocowych + reguła corocznego przeglądu | S | stała `HELPLINES_VERIFIED='2026-08-02'` + komentarz-przypomnienie |

---

### Etap B — Warunek wstępny backendu  ·  koszt L  ·  🔒 BRAMKA przed „go live"

Kolejność wewnątrz etapu ma znaczenie (zależności krypto → sync → proxy → prawo).

**B1. Krypto i konto** (fundament — odblokowuje resztę)
| ID | Zadanie | Koszt |
|---|---|---|
| S-3 + S-4 | osobna **fraza szyfrująca** niezależna od hasła logowania; wersjonowanie w wierszu; **zamyka ścieżkę E2E dla OAuth** (dziś sync po Google cicho pada) | M |
| S-5 | PBKDF2 **600k** iteracji + zapis `kdf:{alg,iter}` obok soli (migracja starych szyfrogramów) | S |

**B2. Sync bez utraty danych** (zanim ktokolwiek zaloguje się na 2. urządzeniu)
| ID | Zadanie | Koszt |
|---|---|---|
| T-2 | **pull-przed-push** + `updated_at` po stronie klienta; podłączyć `syncPull`; przy rozjeździe pytać, nie nadpisywać; docelowo scalanie per-klucz (dziennik/nastroje append-only po `t`) | M |
| S-10 | `applySyncState` filtruje `^masteradhd\.` też przy zapisie | S |

**B3. Usunięcie danych domknięte** (RODO art. 17)
| ID | Zadanie | Koszt |
|---|---|---|
| S-6 | `wipeData`: `delete from user_state`, `auth.signOut()`, czyszczenie `sb-*`, `caches.delete()`, `sessionStorage.clear()` | M |

**B4. Proxy i monetyzacja zamknięte na serwerze**
| ID | Zadanie | Koszt |
|---|---|---|
| S-1 | Worker: `ALLOWED_ORIGIN` **wymuszony** (brak = odmowa startu), rate-limit **domyślnie ON**, weryfikacja **JWT Supabase**, `Authorization` w `Access-Control-Allow-Headers` | M |
| S-2 | bramka **paid po stronie Workera** (weryfikacja `plan`); **usunąć nieprawdziwy komentarz** z `13-sync.js` | M |
| S-11 | CORS `checkout` zawężony do domeny | S |
| S-12 | webhook zdejmuje `plan` przy `subscription.deleted` / `payment_failed` | S |
| S-14 | Worker mapuje błędy Anthropic na własne kody | S |

**B5. Prawo i weryfikacja na żywym środowisku**
| ID | Zadanie | Koszt |
|---|---|---|
| C-6 | polityka prywatności o Supabase, Stripe, Google, transferach poza EOG; uzupełnić pola `[…]` | M (wymaga decyzji/prawnika) |
| S-13 | test integracyjny RLS + `upsert` INSERT→UPDATE na żywym Supabase | M |
| S-7b | uzupełnić DPIA po zamknięciu warunków 1–4 | S |

> **Po zamknięciu Etapu B bramka jest spełniona** — można wystawić ograniczoną
> betę z kontem/sync/AI.

---

### Etap C — Retencja i onboarding  ·  koszt L–XL  ·  częściowo niezależne

Największe ryzyka **produktowe** (nie bezpieczeństwa). U-3 częściowo zazębia się z Etapem B.

| ID | Zadanie | Koszt | Uwaga |
|---|---|---|---|
| U-3 | **decyzja o pętli powrotu**: (a) Web Push (VAPID na tym samym Workerze) albo (b) świadoma rezygnacja z obietnicy i oparcie retencji na ikonie PWA + kotwicy. Notification Triggers realnie nie działa | L / S | najpierw DECYZJA, potem koszt; sprostować README/CHANGELOG |
| U-1 | profil (imię/formy/cele) **po pierwszym starcie**, nie przed; domyślne `n` na sesję #1 | M | ⚠️ do testu, hipoteza mocna |
| C-7 | zimny start: tryb kryzysowy jako bohater onboardingu; mapa/wzorce jako nagroda dla wytrwałych, nie obietnica na wejściu | M | powiązane z U-1 |
| U-2 | ekran główny: 4 kafelki + „więcej", pasek postępu nad zgięciem, jeden osierocony kafelek w siatce | M | 360×640 |

---

### Etap D — Dostępność i kalibracja  ·  koszt M

| ID | Zadanie | Koszt |
|---|---|---|
| U-9 | `aria-live` na `#stage`/`#nowStage`, `:focus-visible`, `aria-valuetext` na suwakach | M |
| U-6 | oś napięcia: mnożnik 0,6–0,8 zamiast 0,4 albo twardy próg „nie proponuj dread 4 przy energii <25"; ograniczyć bonus przy skrajnym spokoju (`Math.min(...,30)`) | S |
| U-7 | suwaki bez domyślnej odpowiedzi: nietknięte = `null`, pomijane w statystyce (spójne z A-5) | S |
| U-10 / A-17 | pasek 45 s: nazwać („Max jest obok") albo usunąć | S | ⚠️ test |
| C-4 | copy: „obsłużyć"→„sięgnąć", `tooHard` nagłówek na „najmniejszy kawałek", jedna tożsamość Maxa, „potwór" ⚠️ | S |

---

### Etap E — Integracje i głos  ·  koszt M + zewnętrzne

| ID | Zadanie | Koszt |
|---|---|---|
| T-1 | Google Tasks przez GIS (analogicznie do kalendarza) **albo** usunąć przełącznik (dziś zbiera zgodę na nic) | M |
| C-10 | nagrania głosu Maxa u lektora (pipeline gotowy, 0 nagrań) | XL / zewnętrzne |

---

### Etap F — Walidacja z ludźmi  ·  przecina wszystkie etapy

Audyt wielokrotnie podkreśla: **wszystkie oceny oznaczone ⚠️ to hipotezy, nie
ustalenia**. Bez testów z użytkownikami z ADHD nie wiadomo, czy „potwór", pasek
45 s, onboarding czy metafory działają. Powinno biec **równolegle** od Etapu C.

---

## 3. Sugerowana kolejność sprintów

| Sprint | Zawartość | Efekt |
|---|---|---|
| 1 | **Etap A** (cały sweep) + **decyzja U-3** | dług techniczny spłacony; kierunek retencji ustalony |
| 2 | **Etap B1 + B2** (krypto, sync bez utraty danych) | E2E domknięte, sync bezpieczny |
| 3 | **Etap B3 + B4 + B5** (usuwanie, proxy, monetyzacja, prawo) | 🔒 **bramka spełniona** → beta z backendem |
| 4 | **Etap C** (onboarding, retencja) + **F** runda 1 | wartość w sesji #1, pętla powrotu |
| 5 | **Etap D** (a11y, kalibracja) + **E** (Tasks/głos) | produkt dostępny i dopięty |

Uwaga: Etapy A, C-część (U-1/U-2), D nie zależą od backendu — można je przesuwać
wcześniej, jeśli priorytetem jest jakość frontu, a nie włączenie konta.

---

## 4. Decyzje do GENESIS (z sekcji G audytu) — do zatwierdzenia raz

1. Każda kontrola opisana jako „wymuszana na serwerze" ma **test integracyjny**; brak testu = komentarz do usunięcia. *(S-2)*
2. Klucz szyfrujący E2E **nigdy** nie pochodzi z sekretu, który zna serwer. *(S-3)*
3. Proxy modelu **domyślnie zamknięte**: bez `ALLOWED_ORIGIN` i rate-limitu odmawia startu. *(S-1)*
4. Na produkcję trafia **wyłącznie bieżąca wersja**; archiwum proweniencji żyje w repo, nigdy pod publicznym URL. *(S-9 — już wdrożone)*
5. Panel zaufania renderuje się **ze stanu zgód**, nigdy statycznie. *(C-2 — już wdrożone)*
6. Numery pomocowe mają w kodzie **datę weryfikacji i coroczny przegląd**. *(C-5)*
7. **Strażnik kolizji globali w CI**. *(T-8)*

---

## 5. Czego plan nie rozstrzyga (decyzje po Twojej stronie)

- **Podmiot i dane administratora** do polityki/DPIA (pola `[…]`) — plus przegląd prawnika (RODO/MDR/AI Act).
- **Strategia pętli powrotu** (U-3): infrastruktura Web Push vs świadoma rezygnacja.
- **Lektor** do nagrań głosu Maxa (C-10).
- **Cennik** warstwy paid i konfiguracja produktu Stripe.
- **Testy z użytkownikami** — rekrutacja grupy z ADHD (Etap F).
