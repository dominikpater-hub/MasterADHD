# MasterADHD v16 — audyt pełny

**Wersja audytu:** 1.0
**Data:** 2026-07-29
**Przedmiot:** `MasterADHD-v16.html` (3426 linii, 182 kB, jeden plik)
**Zakres:** techniczny · treści · potencjału

---

## 0. Metoda i status weryfikacji

Zgodnie z M-02 (test w prawdziwym Chromie, nigdy sam `node --check`) audyt przeszedł trzy warstwy:

1. **Statyczna** — czytanie całego pliku, `node --check`, analiza martwego kodu i referencji `onclick` → funkcja.
2. **Dynamiczna** — Chromium headless (Puppeteer) na HTTP, viewporty 390×844 i 360×640, przejście czterech ścieżek użytkownika, odczyt stanu `localStorage` i wyniku funkcji doboru.
3. **Zewnętrzna** — weryfikacja webowa numerów pomocowych.

**Oznaczenia w raporcie:**
- 🔬 **zweryfikowane w Chromie** — zachowanie odtworzone i zmierzone
- 📖 **z lektury kodu** — wnioskowane, niepotwierdzone uruchomieniem
- ⚠️ **hipoteza** — wymaga testu na użytkownikach albo w środowisku docelowym

Czego audyt **nie** obejmuje: testów z ludźmi, pomiaru wydajności na realnym urządzeniu, przeglądu prawnego przez prawnika, weryfikacji cytowanych badań co do treści.

**Wynik ogólny:** produkt ma jedną rzecz, której konkurencja nie ma i której nie da się skopiować w tydzień (oś napięcia w doborze — działa, dowód w A-4). Ma też trzy błędy, które w realnym deployu wyłączają jego główną obietnicę, oraz kilkanaście obietnic składanych użytkownikowi, których kod nie dotrzymuje. Kolejność napraw w sekcji D.

---
---

# A. AUDYT TECHNICZNY

## A.0 Stan podstawowy

| Sprawdzenie | Wynik |
|---|---|
| `node --check` | ✅ czysto |
| Ładowanie w Chromie | ✅ bez błędów konsoli (poza 404 favicon) |
| Błędy runtime na czterech ścieżkach | ✅ zero `pageerror` |
| `onclick` → funkcja nieistniejąca | ✅ zero |
| Martwy kod | 4 funkcje + 2 bloki CSS (A-14) |
| Escapowanie wejścia użytkownika | częściowe — `esc()` w zadaniach, brak przy odpowiedziach modelu (A-11) |

Kod jest zdyscyplinowany: komentarze tłumaczą **dlaczego**, nie **co**; decyzje architektoniczne są w pliku; fallbacki są przemyślane. To rzadkie i warto to powiedzieć wprost, zanim przejdziemy do listy usterek.

---

## A.1 Blokery (P0) — wyłączają główną obietnicę produktu

### A-1. Warstwa AI nie zadziała nigdzie poza artefaktem Claude 📖

`tailorSteps()` (L1150) i `analyzeDump()` (L1438) wołają `https://api.anthropic.com/v1/messages` **bezpośrednio z przeglądarki, bez klucza API**. To działa wyłącznie w środowisku artefaktów, gdzie autoryzację wstrzykuje host. Po wystawieniu jako PWA:

- brak nagłówka `x-api-key` → 401,
- brak `anthropic-dangerous-direct-browser-access` → blokada CORS,
- a klucz w kliencie **i tak nie jest opcją** (każdy go odczyta i wydrenuje budżet).

**Skutek kaskadowy — to nie jest jeden błąd, tylko wyłączenie modułu:**
1. `analyzeDump` zawsze zwraca `null` → „Zrzuć myśli" **zawsze** kończy się ekranem „Jestem offline".
2. `mapRecord` z dziennika odpala się tylko `if(res.emotion)` (L1399) → rzeka danych #4 w `readPatterns` (emocje i tematy z dziennika, L946–963) jest **martwa na zawsze**.
3. `tailorSteps` zawsze wpada w `catch` → `aiState='offline'` → plakietka „✦ dopasowane do:" nigdy się nie pokaże, a Max mówi „Jestem offline", będąc online. To gorsze niż milczenie: użytkownik widzi kłamstwo, które sam może obalić.

**Naprawa:** proxy po stronie serwera (Cloudflare Worker / Supabase Edge Function), klucz w zmiennej środowiskowej, rate-limit per użytkownik. Klient woła własny endpoint, nie Anthropic.

### A-1b. Zgoda `ai` nie jest egzekwowana 📖 — ryzyko RODO

Ekran zgód (L3093) obiecuje: *„Treść zadania wychodzi wtedy poza urządzenie. Bez tej zgody zgaduję lokalnie."*
`analyzeDump` i `tailorSteps` **nie sprawdzają `consLoad().ai`**. Gdyby wywołanie działało (A-1), treść dziennika — czyli dane o zdrowiu psychicznym, art. 9 RODO — wychodziłaby z urządzenia przy zgodzie **wyłączonej domyślnie**.

To jest jedna linia kodu i największe ryzyko prawne w całym pliku:
```js
if(!consLoad().ai) return null;   // pierwsza linia obu funkcji
```

### A-2. `promoteDump` cicho gubi dane 🔬

L3015: `taskAdd(arr[i].txt, 'dump')` — pole nazywa się **`text`**, nie `txt` (zapis w L1365).
L2977: `esc((d.txt||'').slice(0,80))` — ten sam błąd w etykiecie.

**Zmierzone w Chromie:**
```
Przycisk awansu ze zrzutu myśli: "+ zrób z tego zadanie"   ← etykieta pusta
Zadania po kliknięciu: []                                   ← nic nie powstało
```
`taskAdd(undefined)` zwraca `null`, ale wpis dostaje `promoted:true` i **znika z listy**. Użytkownik klika „zrób z tego zadanie", wpis przepada, zadanie nie powstaje, komunikatu brak.

To uderza dokładnie w sztandarową zasadę v16 („Max wskazuje realną rzecz z Twojej listy"), bo blokuje najbardziej naturalną drogę zasilania tej listy.

**Naprawa:** `arr[i].text` w obu miejscach + `if(!row) return;` przed ustawieniem `promoted`.

### A-3. Max pyta o zadanie dwa razy i kasuje pierwszą odpowiedź 🔬

Przepływ: `startCrisis` → `sceneWhere` → `pickPlace` → `sceneWhatTask` (**„Nad czym stoisz?"**) → `submitTask` → `sceneBreath` → po 4,6 s → `sceneAsk` (**„Co miałeś zacząć?"**) → `beginSteps`.

L2482: `sessionTask = (f && f.value.trim()) ? f.value.trim() : '';` — puste pole **nadpisuje** wcześniejszą odpowiedź.

**Zmierzone w Chromie:**
```
PYTANIE 1: "Nad czym stoisz?"        (wpisano: "mail do klienta")
PYTANIE 2: "Co miałeś zacząć?"
sessionTask po submitTask:  "mail do klienta"
sessionTask po beginSteps:  ""            ← wymazane
```

**Trzy skutki:**
- Max wygląda, jakby nie słuchał — czyli popełnia dokładnie ten grzech, przed którym ostrzega komentarz przy `STEP_SETS` (L1064: *„Max, który nie pyta o kontekst, wygląda jakby nie słuchał"*).
- `memRecord({lastTask: sessionTask || undefined})` (L2527) zapisuje `undefined` → pamięć Maxa („Ostatnio stałeś nad…") **nie karmi się z głównej ścieżki**. Zasila ją tylko tryb TERAZ.
- Nawet gdyby AI działało, plakietka dopasowania wymaga `sessionTask` — nie pokaże się.

**Naprawa (minimalna):** usunąć `sceneAsk` z tej ścieżki (`sceneBreath` → `beginSteps`), albo `sessionTask = f?.value.trim() || sessionTask;`.

---

## A.2 Poważne (P1)

### A-4. Oś napięcia — wyróżnik produktu — jest martwa w stanie domyślnym 🔬

`scoreTask` uwzględnia `dread` **wyłącznie** w dwóch skrajnych progach (L2888–2889):
```js
if(st.t >= 60)      s -= task.dread * 16;
else if(st.t <= 30) s += (4 - task.dread) * 4;
```
Suwaki check-inu startują na **50**. Użytkownik, który tylko kliknie „Gotowe" (a to jest tryb domyślny osoby wyczerpanej), dostaje dobór, w którym oś napięcia **nie istnieje**.

**Zmierzone w Chromie** (lista: urząd skarbowy / posprzątać biurko / dokończyć prezentację):

| Stan | Wybór Maxa | Ocena |
|---|---|---|
| energia 85, napięcie **85** | „posprzątać biurko" | ✅ reguła działa — odrzucił urząd mimo mocy |
| energia 85, napięcie 10 | „dokończyć prezentację" | ✅ poprawnie |
| energia 15, napięcie **50** | **„zadzwonić do urzędu skarbowego"** (dread 4) | ❌ wyczerpanej osobie podaje najgorszą rzecz |

Dobra wiadomość: **reguła „napięcie tłumi dread" naprawdę działa** i jest sprawdzalna. Zła: włącza się dopiero od 60, a większość wejść będzie miała 50.

**Naprawa:** funkcja ciągła zamiast progów, np.
```js
s -= task.dread * (st.t - 40) * 0.4;   // zero przy 40, symetrycznie w obie strony
```
Dodatkowo warto rozważyć, żeby suwaki **nie** startowały w centrum (środek to odpowiedź „nie wiem" udająca pomiar) — albo wymagać dotknięcia każdego suwaka przed „Gotowe".

### A-5. Ankieta emocji zanieczyszcza statystykę — lustro kłamie 🔬

`saveSurvey` (L2054) zapisuje `{v:null, a:null, tag:id, granular:true}`.
`readPatterns` liczy `moodQuadrant(x.v, x.a)` bez filtra (L970). `null >= 50` to `false`, więc **każdy** wpis z ankiety ląduje w ćwiartce `loNeg`.

**Zmierzone w Chromie:** 6 wpisów oznaczonych „**Duma**" (emocja jednoznacznie pozytywna) →
```
{hiPos:0, loPos:0, hiNeg:0, loNeg:6}
```
Max powie użytkownikowi: *„Gdy pokazujesz mi emocje, najczęściej jest to: niska energia i ciężko — 100% razy"* — po tym, jak ten sześć razy zapisał dumę.

To nie jest błąd kosmetyczny. To bezpośrednie złamanie doktryny „lustro, nie diagnoza": lustro, które odbija odwrotność, jest gorsze niż brak lustra.

**Naprawa (dwie opcje):**
- minimalna: `moods.filter(x => x.v != null && x.a != null)` przed statystyką;
- lepsza: mapować emocję z ATLAS na `v`/`a` (masz już `val` i pośrednio pobudzenie przez `fam`) i zasilać ćwiartki poprawnie — ankieta jest najbogatszym źródłem danych, szkoda ją wyrzucać ze statystyki.

Uwaga poboczna: `saveSurvey` **nie woła** `mapRecord`, w odróżnieniu od `saveMood`. Najgłębsze narzędzie w aplikacji nie karmi mapy.

### A-6. Google Tasks to atrapa, a komunikat sugeruje inaczej 📖

- `gtAuth()` (L3146) przekierowuje do Google, ale **nie ma obsługi powrotu** — nigdzie nie czytamy `?code=` z URL, nie ma wymiany kodu na token.
- `gtPull()` — **0 wywołań w całym pliku** (potwierdzone analizą referencji).
- `window.GT_TOKEN` — nigdzie nie jest ustawiane, tylko odczytywane (L1198).
- Konfiguracyjnie: Google przy typie klienta „Web application" wymaga `client_secret` do wymiany kodu; PKCE bez sekretu działa dla typów natywnych, a te nie przyjmą `redirect_uri` z `location.origin`. **Bez backendu to się nie domknie.**

Ekran mówi: *„Wklej go w stałej `GOOGLE_CLIENT_ID` w kodzie"* — po wklejeniu użytkownik trafi na ekran zgody Google, wróci i nie stanie się nic. Komunikat trzeba zmienić na uczciwy („wymaga backendu, planowane w vXX") albo dokończyć integrację.

### A-7. Kalendarz nigdy nie jest odpytywany 📖

`calWindow()` woła się tylko z `openNow()` (L1198), a `openNow` jest **martwy** (0 wywołań — komentarz w kodzie sam to przyznaje, L1193).
Skutek: `FREE_WINDOW` jest zawsze `null`, więc:
- składnik #3 `scoreTask` (dopasowanie do okna, L2893) nigdy nie działa,
- plakietka „X min do następnej rzeczy" (L3338) nigdy się nie pokaże,
- fragment uzasadnienia „zmieścisz to w N min" nigdy nie wystąpi.

Cała decyzja P-34 (kalendarz = tylko metadane) jest zaimplementowana poprawnie i **nieużywana**.

### A-8. „Offline-first" bez service workera i manifestu 📖

Brak `<link rel="manifest">`, brak Service Workera, brak ikon, brak `apple-touch-icon`.

Ekran zaufania obiecuje: *„Max działa **offline**. Konto to wygoda, nie warunek."* Po utracie sieci aplikacja **się nie wczyta** (poza przypadkowym trafieniem w cache HTTP). Nie da się jej też zainstalować jako PWA — czyli nie ma ikony na ekranie głównym, a to jedyny realny trigger powrotu, jaki ten produkt dziś ma.

To najtańsza duża naprawa w całym zestawieniu: manifest + prosty SW z `cache-first` na jeden plik.

### A-9. Skan kryzysowy pokrywa 1 z 5 pól tekstowych 🔬

`scanCrisis` jest wołane **wyłącznie** w `processDump` (L1359).

| Pole | Gdzie | Skan? | Leci do LLM? |
|---|---|---|---|
| `dumpInput` | Zrzuć myśli | ✅ | tak |
| `taskInput` | „Nad czym stoisz?" (L2367) | ❌ | **tak** (`tailorSteps`) |
| `taskField` | „Co miałeś zacząć?" (L2471) | ❌ | tak |
| `tkNew` | dodawanie zadania | ❌ | nie (dziś) |
| `rvText` | recenzja | ❌ | nie |

Deklaracja §16 („skan on-device **przed** wysłaniem do modelu") jest spełniona dla jednego z dwóch kanałów wychodzących. Ktoś, kto w polu „nad czym stoisz" wpisze zdanie z listy `CRISIS_WORDS`, nie zobaczy ekranu wsparcia — a jego tekst pojedzie do modelu.

**Naprawa:** jeden wspólny wrapper na każde pobranie tekstu od użytkownika:
```js
function readUserText(el){ const t=el.value.trim(); if(scanCrisis(t)){ openSafety(); throw 'crisis'; } return t; }
```

**Do świadomej decyzji, nie błąd:** przy trafieniu wpis **nie jest zapisywany** (`return` przed `dumpSave`). Można to bronić („nie utrwalamy"), ale użytkownik w kryzysie traci to, co właśnie napisał, bez ostrzeżenia. Warto co najmniej powiedzieć o tym na ekranie wsparcia.

### A-10. Logowanie jest fikcją, a panel zaufania obiecuje rzeczy, których nie ma 🔬

`submitAuth` (L2698) nie weryfikuje niczego. „Mam już konto" + dowolny e-mail + dowolne 8 znaków → **nowa lokalna sesja**. Nic się nie synchronizuje, hasło nie jest nigdzie porównywane.

Panel „🛡️ Twoje dane" (L668–678) deklaruje pięć rzeczy. Stan realizacji:

| Obietnica | Stan |
|---|---|
| „Dane trzymamy w Unii Europejskiej" | brak serwera — nieweryfikowalne, a po wdrożeniu backendu staje się zobowiązaniem |
| „Nie sprzedajemy danych, nie ma reklam" | ✅ prawda |
| „Możesz **pobrać wszystko**" | ❌ brak jakiejkolwiek funkcji eksportu (RODO art. 20) |
| „Możesz **usunąć konto i dane**" | ❌ brak (RODO art. 17) |
| „Max działa offline" | ❌ patrz A-8 |

Do tego:
- link „zasady prywatności" otwiera ten sam panel marketingowy — **nie ma polityki prywatności**, a zgoda jest zbierana;
- L3099: *„Cofnięcie zgody kasuje też to, co dzięki niej zebrałem"* — `toggleCons` (L3105) nie kasuje **niczego**;
- przycisk „**Wyślij** Maxowi" przy recenzji zapisuje wyłącznie do `localStorage`. Nic nie wychodzi.

Zbieranie zgody na dane o zdrowiu psychicznym bez polityki, bez eksportu i bez usunięcia to nie jest dług techniczny, tylko ekspozycja prawna.

---

## A.3 Średnie (P2)

**A-11. Wstrzyknięcie HTML z odpowiedzi modelu.** `res.mirror`, `res.emotion`, `res.tasks[]`, `res.question` idą do `innerHTML` bez `esc()` (L1403–1408). `res.tasks[0]` trafia do atrybutu `onclick` z escapowaniem **tylko apostrofu** (L1411) — cudzysłów albo `<` rozbija przycisk. Wektor: użytkownik pisze tekst → model go odbija → wraca jako HTML. `esc()` już istnieje, wystarczy go użyć.

**A-12. Ukończone zadania wypychają otwarte.** `taskSave(a.slice(-400))` obcina po 400 **wszystkich** wpisów, licząc `done:true`. Po dłuższym używaniu ukończone zadania mogą wypchnąć otwarte. Naprawa: przycinać osobno albo czyścić `done` starsze niż 30 dni.

**A-13. Formy własne rodzaju generują niegramatyczne słowa.** L2147: dla wpisanego „zrobiłoś" (`konc='oś'`) wychodzi `gotow` + `ś` = **„gotowś"** i `sam` + `ś` = **„samś"**. Naprawa: pytać o dwie–trzy formy zamiast wyprowadzać wszystko z jednej końcówki.

**A-14. Martwy kod do usunięcia:** `maxGreeting()` (L793, zastąpione przez `renderHost`), `openNow()` (L1196), `przecinekImie()` (L1605), `gtPull()` (L3165), zmienna `voiceReady`, klasy CSS `.now-card`/`.energy-pick` (L570–606, bez odpowiednika w HTML). Ok. 120 linii.

**A-15. `startCrisisWithTask` nie pyta o miejsce.** Bierze `lastPlace` (L2395). Rano biurko → wieczorem łóżko: kroki będą nietrafione i nie da się tego skorygować, bo ekran wyboru miejsca jest pominięty.

**A-16. Pytanie o recenzję gubi połowę narzędzi.** Mapa `nazwy` (L1724, L1750) zna `dump/energy/map/steps/chat`, ale `markTool` zapisuje też `mood`, `atlas`, `survey`, `tasks`, `profile`. Po użyciu ankiety emocji Max wraca do ogólnikowego „Masz uwagi?".

**A-17. `runLightbar` — 45-sekundowy pasek bez wyjaśnienia.** Występuje na każdym kroku i w trybie body-double. Wygląda jak odliczanie. W grupie z ADHD to ryzyko odwrotne do zamierzonego (presja czasu zamiast towarzystwa). Albo nazwać go wprost, albo usunąć. ⚠️ do testu na użytkownikach.

**A-18. Dwa niespójne liczniki czasu.** `daysSinceLastSeen` liczy bloki po 24 h, `trackDay` — dni kalendarzowe (`toDateString`). Wizyta wczoraj 23:00 i dziś 8:00 to „0 dni przerwy", ale dwa różne dni w liczniku. Przy progu ≥3 zwykle nieszkodliwe, warto ujednolicić.

**A-19. Cichy zjadacz danych: `catch(e){}` przy każdym zapisie.** `dumpSave`, `moodSave`, `taskSave`, `memSave` połykają wyjątki. Przy przepełnionym `localStorage` (`QuotaExceededError`) użytkownik pisze, klika „Gotowe", widzi potwierdzenie — i nic się nie zapisuje. Bez śladu. Minimum: wykryć błąd zapisu i powiedzieć o tym.

**A-20. Dostępność.** Brak `aria-live` przy `swap()`/`nowSwap()` — czytnik ekranu nie ogłosi zmiany sceny, a cała aplikacja to sekwencja scen. `.btn-text` z `opacity:.6` schodzi poniżej kontrastu 4.5:1. Suwaki nie mają `aria-valuetext` (czytnik przeczyta „57", nie „raczej spięty"). Sam plik ma poprawne `lang="pl"`, `prefers-reduced-motion` i obsługę Escape — fundament jest, brakuje warstwy dla czytników.

---
---

# B. AUDYT TREŚCI

## B-1. System rodzajów gramatycznych istnieje i przecieka w ~15 miejscach

`FORMS` + `F()` to dobra, przemyślana konstrukcja. Jest używana w **dwóch** miejscach (`renderHost` L1698, `sceneStart` L2538). Wszędzie indziej rodzaj jest zaszyty na sztywno w formie męskiej:

| Linia | Tekst | Waga |
|---|---|---|
| **891** | „Nie jesteś **sam**." | **ekran wsparcia w kryzysie** — najgorsze możliwe miejsce |
| 2656 | „**Dowiozłeś**." | domknięcie sesji |
| 2466 / 2470 | „Co **miałeś** zacząć?" | główny przepływ |
| 3257 / 3281 | „Ile **spałeś**?" / „**Spałeś** X h. Czuć to?" | warstwa czujników |
| 1481 | „Ostatnio **stałeś** nad…" | czat |
| 1380 | „Zapisałem to, co **napisałeś**" | dziennik |
| 981 | „bywasz jednocześnie **wyczerpany i nakręcony**" | mapa |
| 1234 | etykieta suwaka „**wyczerpany**" | check-in |
| 1632 | „Jestem, kiedy będziesz **gotów**" | powitanie |
| 2548 / 2555 | „Dam radę **sam**" / „lecisz **sam**" | przekazanie |
| 2939 | „już to **zaczynałeś**" | uzasadnienie doboru |
| 1847 / 1850 / 1859 | pytania w ATLAS: „które **miałeś**", „**zrobiłem** coś złego", „czego się **bałeś**" | atlas emocji |

Kobieta, która świadomie wybrała „zrobiłaś", zostanie zmisgenderowana kilkanaście razy — w tym w kryzysie i w momencie sukcesu. **To kosztuje więcej zaufania niż brak systemu w ogóle**, bo obietnica została złożona jawnie.

**Naprawa:** przepisać wszystkie na `F()` albo formy bezosobowe, a potem dodać do procesu prosty test regresyjny:
```bash
grep -nE '(łeś|łaś|\bsam\b|gotów|wyczerpany)' plik.html | grep -v 'FORMS\|/\*'
```

## B-2. Max ma cztery różne tożsamości w czterech miejscach

- ekran logowania: „Max · **Twój trener**"
- czat: „Nie jestem listą zadań ani terapeutą. Jestem **trenerem nastroju**"
- powitanie: „pomogę Ci **wytresować Twojego potwora**"
- nagłówek kafelków: „**Czym mogę Cię teraz obsłużyć**"

Ostatnie wypada wyciąć bez dyskusji — „obsłużyć" to język infolinii i kłóci się z całą resztą. Pozostałe trzy trzeba zredukować do jednej. Rekomendacja: „trener nastroju" jest najprecyzyjniejszy i najlepiej odgranicza od terapii (patrz C-9b).

## B-3. „Wytresować potwora" — mocne, ale ryzykowne w pierwszym kontakcie ⚠️

Komentarz w kodzie broni metafory („potwór to ADHD, nie użytkownik") i to obrona sensowna. Ale w **pierwszym zdaniu**, jakie widzi nowa osoba, bez żadnego kontekstu, „Twój potwór" czyta się dwuznacznie — albo jako patologizacja, albo jako „to ty jesteś potworem". Metafora jest dobra **po** zbudowaniu relacji, nie przed. Do testu; sugeruję przenieść z `HELLO_NEW` dalej w ścieżkę.

## B-4. Obietnice, których produkt nie dotrzymuje

Uszeregowane wg kosztu zaufania:

1. **„Sprawdzę Cię za 10 minut"** (`pingConfirm`) — nie ma powiadomień. Max obiecuje wrócić i **nie wraca**. To najdroższa obietnica w całej aplikacji, bo dotyczy dokładnie tego, czego użytkownik boi się najbardziej: porzucenia w połowie.
2. **„Odezwę się po pierwszej kawie"** (kotwica zdarzeniowa) — mechanika zaprojektowana pięknie, nośnika brak.
3. **„Zajrzę co jakiś czas"** (body-double) — jest, ale **raz**, po 12 s, i **tylko głosem**. A głos milczy, gdy brak polskiego TTS (patrz C-10). U dużej części Androidów Max po prostu nie zagląda.
4. **„Wyślij Maxowi"** (recenzja) — nic nie wychodzi.
5. **„Poukładam, gdy wrócę do sieci"** (dziennik offline) — nie ma kolejki ani retry. Wpis nigdy nie zostanie przeanalizowany.
6. **„Cofnięcie zgody kasuje to, co zebrałem"** — nie kasuje.
7. **„Możesz pobrać wszystko / usunąć konto"** — brak funkcji.

To nie jest czepialstwo. Produkt, którego jedyną walutą jest zaufanie osoby z historią porzucania rzeczy i bycia porzucaną, **nie może obiecywać powrotu i nie wracać**. Każda z tych siedmiu obietnic ma dwa wyjścia: spełnić albo skasować z copy. Trzeciego nie ma.

## B-5. Ekran wsparcia — najważniejszy tekst w aplikacji

**Numery są poprawne** — sprawdzone webowo 2026-07-29:
- 116 123 — całodobowo, 7 dni w tygodniu (Kryzysowy Telefon Zaufania IPZ / platforma 116sos.pl) ✅
- 800 70 2222 — Centrum Wsparcia Fundacji ITAKA, całodobowo ✅
- 116 111 — dzieci i młodzież, całodobowo ✅
- 511 200 200 — kryzys samobójczy, dorośli, całodobowo ✅
- 112 ✅

**Do poprawy:**
- „Nie jesteś **sam**" → rodzaj (B-1). Propozycja bezosobowa: *„Nie musisz być z tym sam na sam."*
- 116 111 opisać precyzyjniej: „dla osób do 18 r.ż." — dorosły widzący na liście numer dla dzieci może pomyśleć, że lista nie jest dla niego.
- **Dodać w kodzie datę weryfikacji numerów** i regułę corocznego przeglądu. Godziny i operatorzy linii zmieniają się (sam numer 116 123 przeszedł z 14–22 na 24/7). Nieaktualny numer na tym ekranie to najgorszy możliwy błąd w tym produkcie.
- Rozważyć dopisanie, że wpis nie został zapisany (A-9), jeśli ta decyzja zostaje.

## B-6. Copy — konkrety

**Zostawić bez zmian:**
- „To obserwacja z Twoich wejść, nie diagnoza." — dokładnie to, co trzeba.
- „Nie mam z czego wybrać. Mógłbym rzucić ogólnikiem, ale to byłaby porada z internetu, nie Twoja rzecz." — to jest najlepszy tekst w aplikacji i powinien iść do materiałów marketingowych.
- **„Im więcej takich planów znasz, tym mniej mnie potrzebujesz."** — to jest teza całego produktu w ośmiu słowach. Wyeksponować w onboardingu i w opisie w sklepie.

**Poprawić:**
- „Bywasz tu, **ale** mapa jest jeszcze pusta" — „ale" zamienia obserwację w wyrzut. → *„Jesteś tu. Wystarczy jeden wpis, żeby mapa zaczęła się rysować."*
- „**Zrób z tego połowę**" (fallback `tooHard`, L2517) — dla kogoś, kto właśnie powiedział „za trudne", połowa nadal jest dużą liczbą. → *„Weź z tego jeden najmniejszy kawałek. Sam wybierz jaki."*
- „**Dowiozłeś**" — poza rodzajem, to język KPI i kłóci się z zasadą „nagradzamy start, nie ukończenie". → *„Doszłoś do końca"* / bezosobowo *„Zrobione. Byłem obok, ale to Twoja robota."*
- „Czym mogę Cię teraz **obsłużyć**" → *„Po co mogę teraz sięgnąć"*.

## B-7. Najbogatszy moduł produktu jest praktycznie niewidoczny

Atlas 27 emocji + ankieta różnicująca po ocenie poznawczej to najpoważniejsza merytorycznie część aplikacji. Wejście do ankiety to **stopka na drugim ekranie** narzędzia „Zrzuć emocje" (L1929: „Chcę nazwać dokładniej →"). Kafelek „Atlas emocji" prowadzi do trybu **przeglądania**, nie nazywania.

Statystycznie: ile osób z ADHD dojdzie do drugiego ekranu i zauważy szarą stopkę? Ten moduł zasługuje na własny kafelek („Nazwij dokładniej") albo na propozycję od Maxa, gdy suwaki wskażą stan skrajny.

## B-8. Dwie różne skale mierzące podobne rzeczy

- check-in: **walencja / energia / napięcie** (3 suwaki)
- „Zrzuć emocje": **walencja / pobudzenie** (2 suwaki)

Użytkownik nie ma jak wiedzieć, czy „ile masz pobudzenia" to to samo co „ile masz energii" plus „ile masz napięcia" (bo teoretycznie mniej więcej tak jest — Thayer rozbija arousal Russella na dwie osie). Albo ujednolicić, albo dodać jedno zdanie wyjaśniające. Dziś to wygląda jak dwie wersje tego samego pytania, co podważa wrażenie, że pomiar jest przemyślany — a jest.

## B-9. Brak jasnego rozgraniczenia od terapii

Jedno zdanie w czacie („nie jestem terapeutą") to za mało, jeśli produkt zbiera dane o emocjach, pokazuje wzorce i mówi rzeczy w rodzaju „(Jeśli trwa i gaśnie radość — warto z kimś porozmawiać)" (ATLAS, `przygnebienie` — nawiasem: to zdanie jest **bardzo dobre** i powinno mieć więcej rodzeństwa). Potrzebne stałe, widoczne rozgraniczenie — nie z powodów prawnych, tylko dlatego, że użytkownik ma prawo wiedzieć, czym jest rzecz, której powierza swój stan psychiczny. Kontekst regulacyjny w C-9b.

---
---

# C. AUDYT POTENCJAŁU

## C.1 Co jest realną przewagą

**C-1. Oś napięcia i reguła „napięcie tłumi dread".** Zweryfikowana empirycznie (A-4): przy napięciu 85 Max odrzuca telefon do urzędu i wybiera sprzątanie biurka, mimo pełnej energii. To jest **prawdziwy insight behawioralny zaimplementowany w kodzie**, nie slogan. Żaden z profilowanych konkurentów (Tiimo, Structured, Goblin Tools, Inflow, Shimmer, Lifestack) nie mierzy napięcia jako osobnej osi. To nie jest funkcja, którą da się skopiować w tydzień, bo wymaga decyzji projektowej i modelu, a nie kodu.

**C-2. „Max nigdy nie wymyśla zadania".** Bardzo mocna zasada, bo działa dokładnie tam, gdzie każdy konkurent generuje ściemę. Ekran „Nie mam z czego wybrać" buduje więcej zaufania niż jakakolwiek udana podpowiedź. To materiał na główny komunikat produktu.

**C-3. Licznik wybaczający + nagroda za start.** Zgodne z Lally i z aktywacją behawioralną, i przeciwne do wszystkiego, co robi rynek (Finch, Habitica, Duolingo). Trzeba to komunikować agresywnie — „aplikacja, która nie zeruje ci passy" to jest hasło.

**C-4. Heurystyki lokalne zamiast chmury.** Jednocześnie argument prywatnościowy i kosztowy: ~90% pracy dzieje się bez inferencji, czyli bez kosztu per użytkownik. To realnie zmienia model biznesowy.

**C-5. Deterministyczna warstwa bezpieczeństwa.** Właściwa architektura (numery w kodzie, skan przed LLM, przycisk zawsze widoczny). Niedokończona (A-9), ale kierunek jest poprawny i rzadki.

## C.2 Ryzyka, uszeregowane

### C-6. Pusta lista = pusty produkt (największe ryzyko produktowe)

Cała warstwa v16 zależy od tego, że użytkownik wpisze zadania. **Osoba, która nie potrafi zacząć, tym bardziej nie zrobi setupu listy.** To jest paradoks wpisany w fundament: produkt wymaga na wejściu dokładnie tej czynności, której brak jest jego racją bytu.

Google Tasks miał to rozwiązać i nie działa (A-6). Awans ze zrzutu myśli miał to rozwiązać i nie działa (A-2). Zostaje ręczne wpisywanie.

To jest poważniejsze niż jakikolwiek bug w tym raporcie. Kierunki do rozważenia:
- **naprawić A-2** — zrzut myśli to najbardziej naturalne wejście, bo użytkownik i tak pisze;
- **share target** (PWA) — udostępnienie tekstu z dowolnej aplikacji wprost do listy;
- **wklej listę** — jedno pole, wiele linii, parsowanie po `\n`; dziesięć sekund zamiast dziesięciu formularzy;
- ⚠️ hipoteza: dla części użytkowników wystarczyłoby **jedno zadanie**. Może nie potrzebujemy listy, tylko pytania „co ci dziś wisi?" raz dziennie.

### C-7. Zimny start vs realia retencji

Progi wartości: energia ≥5 pomiarów, wzorce ≥15 wejść, dziennik ≥5 wpisów, `PROGI` do 60.
Baumel 2019: mediana retencji D15 w aplikacjach zdrowia psychicznego ≈ 3,9%.

Produkt obiecuje główną wartość po ~15 wejściach. **Większość użytkowników nie dojdzie do trzeciego.** Dziś jedyna rzecz dająca wartość w sesji #1 to tryb kryzysowy — i to on powinien być bohaterem onboardingu, a mapa/wzorce dodatkiem dla wytrwałych, nie obietnicą na wejściu.

### C-8. Brak jakiejkolwiek pętli powrotu

Nie ma powiadomień. Nie ma instalacji PWA (A-8), więc nie ma nawet ikony na ekranie. Wszystkie mechaniki retencyjne — licznik, mapa, progi, kotwica — działają **dopiero gdy ktoś już wszedł**. Produkt bez triggera jest produktem jednorazowym, niezależnie od tego, jak dobry jest w środku.

Kotwica zdarzeniowa („po pierwszej kawie") jest zaprojektowana świetnie i **nie ma nośnika**. Najkrótsza droga: manifest + SW + `Notification API` z lokalnym harmonogramem. Wersja natywna (Capacitor) daje więcej, ale kosztuje więcej.

### C-9. Ryzyka regulacyjne

**(a) RODO.** Dane o stanie psychicznym to art. 9 — kategoria szczególna. Wymagane: zgoda wyraźna (jest, ale bez polityki), polityka prywatności (**brak**), prawo do przenoszenia — eksport (**brak**), prawo do usunięcia (**brak**), DPIA (zaplanowany — dobrze). Dopóki wszystko jest w `localStorage`, ekspozycja jest niska; **w dniu uruchomienia backendu staje się realna**. Eksport i usunięcie to dwie funkcje po ~30 linii i warto je mieć **przed** backendem, nie po.

**(b) MDR.** Granica „wellness" / „wyrób medyczny klasy I–IIa" w UE przebiega dokładnie tam, gdzie produkt zaczyna sugerować diagnozę lub prowadzić leczenie. Obecna doktryna „**lustro, nie diagnoza**" trzyma MasterADHD po bezpiecznej stronie. **To jest argument regulacyjny, nie tylko filozoficzny** — i dlatego zasługuje na osobną decyzję w GENESIS, żeby za rok nikt nie „ulepszył" produktu jednym zdaniem typu „to wygląda na ADHD".
Uwaga praktyczna: bug A-5 (ankieta zanieczyszcza statystykę) to nie tylko błąd danych — to produkt **mówiący użytkownikowi nieprawdę o jego stanie**. W kontekście MDR to najgorsza kategoria błędu, jaka może tu wystąpić.

**(c) AI Act.** Systemy rozpoznawania emocji są ograniczone w kontekście **pracy i edukacji**. B2C wellness — nie dotyczy. Ale to zamyka ścieżkę monetyzacji „MasterADHD dla pracodawców / uczelni", którą warto skreślić z listy opcji od razu, zamiast odkrywać ją jako niemożliwą po roku.

### C-10. Głos jest fundamentem reżyserii, a w praktyce opcjonalny

Cała choreografia scen zakłada, że Max **mówi**: `sceneBreath` czeka 4,6 s, `sceneBreathThenSteps` 4,2 s, body-double zagląda wyłącznie głosem. Decyzja „lepiej cisza niż bełkot z obcym akcentem" jest **słuszna i dobrze uzasadniona**. Ale jej konsekwencja jest taka, że na sporej części Androidów (brak polskiego pakietu TTS) użytkownik dostaje **niemego Maxa z pustymi pauzami** — czyli aplikację, która wygląda na zawieszoną.

Dwie drogi:
- **nagrać własne audio** — kilkadziesiąt kwestii Maxa u lektora. Realne, tanie, jednorazowe, i daje spójny charakter głosu zamiast losowego syntezatora. Prawdopodobnie najlepszy stosunek efektu do kosztu w całej roadmapie.
- **przeprojektować sceny tak, żeby cisza była domyślna** — tekst niesie wszystko, głos jest bonusem.

### C-11. Brak modelu biznesowego w kodzie

Zero śladu monetyzacji, limitów, planów, telemetrii. Przy modelu z proxy do LLM koszt per użytkownik jest realny i trzeba go zaprojektować **zanim** powstanie backend. Dobra wiadomość: architektura „heurystyki lokalne, AI jako dodatek za zgodą" (C-4) naturalnie pasuje do podziału free/paid — darmowe działa w całości offline, płatne dokłada warstwę modelu. To rzadka sytuacja, w której granica produktowa i granica prywatności pokrywają się z granicą cenową.

---
---

# D. KOLEJNOŚĆ NAPRAW

## v16.1 — same naprawy, zero nowych funkcji (dni, nie tygodnie)

| # | Co | Koszt |
|---|---|---|
| A-2 | `d.txt` → `d.text` (2 miejsca) + guard na `null` | 5 min |
| A-3 | usunąć `sceneAsk` z głównej ścieżki | 15 min |
| A-5 | filtr `v!=null && a!=null` w `readPatterns` | 10 min |
| A-1b | `if(!consLoad().ai) return null;` w obu funkcjach AI | 5 min |
| A-9 | `scanCrisis` na wszystkich polach tekstowych | 30 min |
| A-11 | `esc()` na odpowiedziach modelu | 15 min |
| B-1 | przepisanie form rodzajowych + grep-test | 2 h |
| B-4 | usunąć obietnice, których nie dotrzymujemy (albo je spełnić) | 1 h |
| A-14 | usunąć martwy kod | 20 min |

Efekt: produkt przestaje kłamać. To jest warunek wstępny dla wszystkiego dalej.

## v17 — fundament

- **proxy do modelu** (Worker/Edge Function) — odblokowuje A-1 i całą rzekę danych z dziennika
- **manifest + service worker** — „offline" staje się prawdą, pojawia się ikona na ekranie
- **eksport + usunięcie danych** — RODO art. 17 i 20, plus panel zaufania przestaje być fikcją
- **ciągła funkcja napięcia** (A-4) — wyróżnik zaczyna działać dla wszystkich, nie tylko dla skrajnych
- polityka prywatności (realny dokument, nie panel)

## v18 — wartość

- **powiadomienia** — kotwica zdarzeniowa dostaje nośnik; bez tego nie ma retencji
- **realne wejście zadań**: share target + „wklej listę" (C-6). Google Tasks dopiero po backendzie
- **własne audio Maxa** (C-10)
- ankieta emocji na własnym kafelku (B-7)

## v19 — skala

- backend, konto, sync
- monetyzacja (free = offline, paid = warstwa AI)
- DPIA przed wdrożeniem kalendarza

---

# E. Propozycje decyzji do GENESIS

| Proponowany # | Decyzja | Dlaczego |
|---|---|---|
| P-xx | **Żadne wywołanie modelu bez sprawdzenia zgody `ai`** — sprawdzenie jest pierwszą linią funkcji, nie warunkiem w UI | A-1b; zgoda zadeklarowana w interfejsie musi być egzekwowana w kodzie, inaczej jest deklaracją marketingową |
| P-xx | **Każde pole tekstowe przechodzi `scanCrisis`** — przez wspólny wrapper, nigdy przez wywołanie punktowe | A-9; skan wywoływany ręcznie w jednym miejscu zawsze zostanie pominięty w drugim |
| P-xx | **Max nie składa obietnicy, której kod nie może spełnić** — dotyczy zwłaszcza powrotu i kontaktu | B-4; jedyna waluta tego produktu |
| P-xx | **Doktryna „lustro, nie diagnoza" ma status decyzji regulacyjnej**, nie tylko produktowej | C-9b; chroni przed MDR, więc nie wolno jej „ulepszyć" bez analizy prawnej |
| P-xx | **Numery pomocowe mają w kodzie datę weryfikacji i coroczny przegląd** | B-5; numery i godziny się zmieniają, a to najważniejszy ekran w aplikacji |

---

# F. Czego ten audyt nie sprawdził

Uczciwie, żeby nie było fałszywej pewności:

- **Nie testowałem na użytkownikach.** Wszystkie oceny copy i przepływów oznaczone ⚠️ to hipotezy, nie ustalenia.
- **Nie testowałem na realnym urządzeniu** — tylko headless Chromium. Zachowanie TTS, wibracji, `safe-area` i klawiatury ekranowej na Androidzie może się różnić.
- **Nie weryfikowałem cytowanych badań co do treści** (Lally, Gollwitzer & Sheeran, Baumel, Jackson & MacKillop). Sprawdziłem tylko, czy wniosek zapisany w kodzie jest spójny z tym, jak kod działa.
- **Nie oceniałem stanu prawnego** — uwagi RODO/MDR/AI Act to sygnały do sprawdzenia z prawnikiem, nie opinia prawna.
- **Nie mierzyłem wydajności** przy dużych zbiorach (400 punktów mapy × 400 zadań × 300 wpisów).
- **Ekran zgód i lista 12 zadań mieszczą się i przewijają** na 360×640 — sprawdzone. Nie sprawdziłem wszystkich scen na wszystkich rozmiarach.
