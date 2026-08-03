# Analiza S-3 — model zaufania szyfrowania E2E

**Wersja:** 1.0 · **Data:** 2026-08-03 · **Status:** do decyzji przed Etapem B
**Kontekst:** audyt repo 2.0, finding S-3 (+ powiązane S-4, S-5). Dotyczy danych o
zdrowiu psychicznym — **szczególna kategoria (art. 9 RODO)**.

---

## 1. Co dokładnie jest nie tak (dziś)

`accountBootstrap(pass)` wyprowadza klucz AES-GCM przez PBKDF2 z **tego samego
hasła**, którym użytkownik loguje się do Supabase Auth. Sól leży jawnie obok
szyfrogramu, w tym samym wierszu.

Sama kryptografia jest **poprawna** (zweryfikowane 🔬): round-trip działa, obce
hasło nie odszyfrowuje, szyfrogram nie zawiera jawnego tekstu. Problem jest w
**modelu zagrożeń**, nie w matematyce:

- Przy logowaniu **hasło w postaci jawnej trafia na serwer** — Supabase Auth
  odbiera je, zanim zahaszuje. W tym jednym momencie operator serwera (albo ktoś,
  kto go skompromitował, albo warstwa logująca) ma naraz: **hasło + sól +
  szyfrogram**. Deszyfracja jest wtedy trywialna.
- Deklaracja „**serwer widzi tylko szyfrogram**" (README, DPIA R-1, komentarz w
  kodzie) jest prawdziwa dla **danych w spoczynku**, a nieprawdziwa dla **modelu
  zagrożeń**, który sugeruje. Dla art. 9 to różnica prawna, nie tylko techniczna.
- **S-4:** logowanie przez OAuth (Google/Apple) nie ma hasła → nie ma z czego
  wyprowadzić klucza → `syncPush/Pull` cicho zwracają `false`. Użytkownik widzi
  „zalogowano" i „Synchronizacja nieudana" jednocześnie.

**Sedno:** jeśli klucz szyfrujący pochodzi z sekretu, który serwer i tak
przetwarza, to „E2E" opisuje szyfrowanie w spoczynku, a nie brak dostępu dostawcy.

---

## 2. Czego chcemy (cele decyzji)

1. **Serwer nie może odszyfrować dziennika** — nawet mając całą bazę i logi.
2. Działa dla **e-mail+hasło ORAZ OAuth**.
3. **Humanitarna ścieżka odzyskiwania** — bo E2E + zapomniany sekret = utrata danych,
   a grupa docelowa (ADHD, dysfunkcja wykonawcza) **z definicji gubi i zapomina**.
4. Deklaracja w polityce/DPIA jest **prawdziwa** dla przyjętego modelu.

Cel 1 i cel 3 są w fundamentalnym napięciu — to jest właściwa treść tej decyzji.

---

## 3. Kluczowe napięcie: E2E ↔ odzyskiwalność

Prawdziwe E2E znaczy, że dostawca **nie potrafi** odzyskać danych. Więc zapomniany
sekret = utrata danych — chyba że dobudujemy mechanizm odzyskiwania, który **sam
nie oddaje klucza serwerowi**. To jest cały problem, w jednym zdaniu.

Trzy postawy filozoficzne:
- **(a) Czyste E2E, bez odzyskiwania** — maksimum prywatności, maksimum ryzyka utraty (jak Signal).
- **(b) E2E z odzyskiwaniem po stronie użytkownika** (kod odzyskiwania) — odpowiedzialność na użytkowniku, ale dajemy mu narzędzie.
- **(c) Nie-E2E** — szyfrowanie w spoczynku + kontrola dostępu; dostawca technicznie może odczytać. Uczciwe, słabsza gwarancja, **zero niespodzianek z utratą danych**.

Dla dziennika zdrowia psychicznego dla osób z ADHD problem odzyskiwania **nie jest
akademicki — jest głównym ryzykiem UX**. Musi ważyć mocno.

---

## 4. Opcje

### Opcja 0 — status quo (klucz z hasła logowania) — ❌ odrzucona
Nie zamyka modelu zagrożeń (§1).

### Opcja A — osobna fraza szyfrująca (rekomendacja audytu)
Druga, niezależna fraza, **nigdy niewysyłana**. Hasło → Supabase Auth; fraza →
tylko lokalny klucz `KDF(fraza, sól)`.
- **Model zagrożeń:** zamknięty — serwer nie widzi frazy. ✅
- **OAuth:** działa (fraza niezależna od metody logowania) → **zamyka S-4**. ✅
- **Odzyskiwanie:** zapomniana fraza = utrata danych w chmurze → wymaga kodu odzyskiwania.
- **UX:** jeden dodatkowy sekret do zapamiętania/zapisania. Dla grupy ADHD realne tarcie i realne ryzyko utraty.
- **Złożoność:** niska–umiarkowana (klient + ekran ustawienia + odzyskiwanie).

### Opcja B — hasło logowania, ale serwer NIGDY go nie widzi (OPAQUE / aPAKE)
Protokół OPAQUE uwierzytelnia **bez przesyłania hasła**; z tego samego hasła
wyprowadzamy klucz po stronie klienta. Jeden sekret, i nigdy nie opuszcza urządzenia.
- **Model zagrożeń:** zamknięty (serwer nie widzi hasła). ✅
- **OAuth:** OPAQUE dotyczy kont hasłowych — **OAuth i tak potrzebuje osobnej frazy**. Nie rozwiązuje S-4 w pełni.
- **Odzyskiwanie:** jak A (klucz z hasła; zapomniane = utrata bez kodu).
- **UX:** jeden sekret (dobrze), ale zastępuje natywny flow hasła Supabase własnym OPAQUE — **duża zmiana backendu**, dodatkowy komponent serwerowy i zależność krypto. Biblioteki dojrzewają, ale niszowe (nthparty/opaque, squirrelchat opaque-wasm, facebook/opaque-ke, projekt CFRG).
- **Złożoność:** wysoka (własne uwierzytelnianie zamiast/obok Supabase).

### Opcja C — passkey PRF (WebAuthn) jako źródło klucza
Klucz z passkey przez rozszerzenie PRF — deterministyczne 32 bajty związane z
credentialem, wprost do WebCrypto. Odblokowanie biometrią/urządzeniem, **zero fraz
do pamiętania**.
- **Model zagrożeń:** zamknięty (materiał klucza nigdy na serwerze). ✅✅
- **OAuth:** ortogonalne — passkey JEST logowaniem; da się złożyć z Supabase.
- **Odzyskiwanie:** utrata passkey = utrata danych, **chyba że** passkeys są synchronizowane (iCloud Keychain / Google Password Manager) — wtedy odzyskiwanie idzie za backupem passkey platformy. To może być **najlepsza** historia odzyskiwania — o ile użytkownik używa syncującego dostawcy.
- **Wsparcie 2026 (zweryfikowane webowo):** Android (Google PM, Chrome/Edge/Samsung) domyślnie; Windows 11 25H2 + Firefox 148 / Chrome 147; macOS 15+ (Safari 18/Chrome 132/Firefox 139); iOS 18.4+. **Ale:** Firefox na Androidzie bez wsparcia; stare klucze wymagają flagi przy tworzeniu; rekomendacja branżowa: „**traktować opportunistycznie**, nie robić krytycznym punktem" ze względu na fragmentację.
- **UX:** najniższe tarcie (biometria), **ale** nie może być JEDYNĄ ścieżką → i tak potrzebny fallback (fraza).
- **Złożoność:** umiarkowana–wysoka; wsparcie dobre, ale nie uniwersalne.

### Opcja D — envelope encryption + kod odzyskiwania (warstwa, nie alternatywa)
Losowy **klucz danych (DEK)** szyfruje dziennik. DEK zapisujemy **owinięty** kilkoma
kluczami: z frazy (A) i/lub z passkey (C), oraz z **jednorazowego kodu odzyskiwania**,
który użytkownik zapisuje. Serwer trzyma tylko owinięte DEK-i.
- To jest **warstwa odzyskiwania**, która czyni A i C używalnymi (wzorzec „jak Bitwarden").
- Pozwala **dodawać/rotować metody odblokowania bez ponownego szyfrowania** całości.
- Dokłada UX: generowanie kodu + ekran „zapisz to, nie odzyskamy".

### Opcja E — świadomie NIE E2E (szyfrowanie w spoczynku) — uczciwa alternatywa
Dane po stronie serwera, zaszyfrowane w spoczynku (Postgres/Supabase) + RLS + ścisła
kontrola dostępu. **Skreślamy deklarację E2E**, aktualizujemy politykę/DPIA na
„szyfrowane w tranzycie i spoczynku; dostawca technicznie może uzyskać dostęp".
- **Model zagrożeń:** dostawca MOŻE odszyfrować. Słabsze. Ale: **zero ryzyka utraty
  danych z zapomnianego sekretu**, najprostszy UX, standardowa postawa SaaS.
- **Prawo:** art. 9 nadal wymaga silnych środków (DPA z Supabase, minimalizacja) —
  wiele aplikacji zdrowotnych działa tak legalnie. Tracimy jednak wyróżnik „nawet my nie widzimy".
- **Złożoność:** najniższa (usuwamy krypto sync po stronie klienta).

---

## 5. Macierz porównawcza

| Kryterium | A: fraza | B: OPAQUE | C: passkey PRF | E: nie-E2E |
|---|---|---|---|---|
| Serwer nie może odszyfrować | ✅ | ✅ | ✅ | ❌ (może) |
| Rozwiązuje OAuth (S-4) | ✅ | ⚠️ nie w pełni | ✅ | n/d |
| Historia odzyskiwania | kod odzysk. (D) | kod odzysk. (D) | backup passkey / kod | trywialne (reset hasła) |
| Ryzyko utraty danych | średnie | średnie | niskie (jeśli sync) / wysokie | **zero** |
| Tarcie UX | +1 sekret | 1 sekret | najniższe (biometria) | najniższe |
| Wsparcie/uniwersalność | pełne | pełne | dobre, nie uniwersalne | pełne |
| Złożoność wdrożenia | niska–śr. | **wysoka** | śr.–wysoka | **najniższa** |
| Utrzymuje deklarację „serwer nie widzi" | ✅ | ✅ | ✅ | ❌ (trzeba zmienić) |

---

## 6. Parametry KDF (S-5, wchodzi tu naturalnie)

OWASP 2026: **PBKDF2-HMAC-SHA256 = 600 000 iteracji**; **Argon2id = m=19 MiB, t=2, p=1**.
Dziś w kodzie jest PBKDF2 **150k** (28 ms) — poniżej progu.

- **PBKDF2 600k** — natywne w WebCrypto, **zero zależności**, działa offline. ~110 ms przy logowaniu (akceptowalne). Rekomendacja na teraz.
- **Argon2id** — pamięciowo-twardy (lepszy przeciw GPU), ale wymaga **WASM** w powłoce (dodatek do cache offline). Do rozważenia później.
- **Krytyczne:** zapisać `kdf:{alg, iter/params, ver}` obok soli — inaczej podniesienie parametrów **zamknie stare szyfrogramy**.

---

## 7. Rekomendacja

Biorąc pod uwagę grupę docelową (ADHD → wysokie ryzyko utraty/zapomnienia), dane
art. 9 i etos produktu („dane są Twoje, nawet my nie widzimy") — **podejście
warstwowe, wdrażane etapami**:

1. **Architektura: envelope encryption (losowy DEK)** — odseparować klucz danych od
   pojedynczego sekretu, żeby dodawać/rotować metody odblokowania bez ponownego
   szyfrowania. *(Opcja D jako fundament.)*
2. **Odblokowanie v1: osobna fraza szyfrująca** *(Opcja A)* — najprostsze do wydania,
   zamyka model zagrożeń, działa dla OAuth. KDF: **PBKDF2 600k, wersjonowany** (S-5).
3. **Odzyskiwanie: jednorazowy kod** *(Opcja D)* — owija DEK; „zapisz, nie odzyskamy".
   **Obowiązkowy przy zakładaniu.** To on czyni rozwiązanie humanitarnym dla tej grupy.
4. **Odblokowanie v2 (później): passkey PRF** *(Opcja C)* — opcjonalne, niskotarciowe,
   dołączone do tego samego DEK, z frazą jako fallback. Świetne dla użytkowników z synchronizowanymi passkeys.
5. **OPAQUE: nie teraz** — największa zmiana, nie rozwiązuje OAuth, brak natywnej ścieżki w Supabase. Wrócić tylko, jeśli chcemy jeden sekret bez osobnej frazy.
6. **Uczciwa alternatywa:** jeśli zespół uzna, że ryzyko utraty danych dla tej grupy
   **przewyższa** korzyść z E2E → **Opcja E** z **jawną** zmianą deklaracji w
   polityce/DPIA. To legalna decyzja produktowa — musi być świadoma, nie odziedziczona.

Wszystko za **ekranem edukacyjnym**: „ta fraza szyfruje Twój dziennik; nie mamy jej i
nie odzyskamy — zapisz kod odzyskiwania".

---

## 8. Wpływ wdrożenia (jeśli 7.1–7.4)

- **Kod:** nowy moduł klucza (envelope, KDF z wersjonowaniem), przebudowa
  `accountBootstrap` → fraza + kod odzyskiwania; ekran ustawienia frazy i kodu.
- **Schema:** kolumny `dek_wrap_pass`, `dek_wrap_recovery`, `kdf` (JSON), `salt`, `ver`
  (zamiast dzisiejszego `ciphertext/iv/salt` powiązanego z hasłem).
- **DPIA/polityka:** aktualizacja modelu zagrożeń (deklaracja staje się prawdziwa) →
  **zamyka warunek dopuszczenia nr 3**.
- **UX:** +1 ekran przy zakładaniu konta; onboarding musi to wytłumaczyć (i tak przebudowa w U-1).
- **S-4 (OAuth):** rozwiązane — klucz niezależny od metody logowania.
- **S-5 (KDF):** wchodzi w komplecie.

---

## 9. Pytania do rozstrzygnięcia (Twoje)

1. **Czy E2E jest twardym wymogiem produktu, czy „miło mieć"?** — determinuje A/C/D vs E.
   To najważniejsze pytanie; reszta z niego wynika.
2. **Tolerancja utraty danych przy zapomnianej frazie** dla grupy ADHD — akceptujemy z
   kodem odzyskiwania, czy to zbyt duże ryzyko i wolimy E (nie-E2E, reset zawsze działa)?
3. **Escrow opcjonalny?** — czy pozwalamy użytkownikowi **świadomie** oddać klucz w
   depozyt dla wygody odzyskiwania (łamie czyste E2E, ale bywa humanitarne — model „za zgodą")?
4. **KDF:** PBKDF2 600k natywnie teraz, czy od razu Argon2id (WASM)?
5. **Passkey od razu (v2 w tym samym etapie), czy dopiero po walidacji frazy?**

---

## 10. Rekomendacja w jednym zdaniu

**Envelope + osobna fraza (PBKDF2 600k, wersjonowany) + obowiązkowy kod
odzyskiwania teraz; passkey PRF jako druga metoda później** — chyba że decyzja
z pyt. 1 brzmi „E2E nie jest wymogiem", wtedy **Opcja E** i uczciwa zmiana deklaracji.

---

*Źródła (weryfikacja 2026-08-03):* OWASP Password Storage Cheat Sheet (PBKDF2 600k,
Argon2id 19 MiB/t=2/p=1); Corbado, „Passkeys & WebAuthn PRF for E2E Encryption (2026)"
(wsparcie PRF i ostrzeżenie o utracie passkey); przegląd bibliotek OPAQUE (CFRG draft,
facebook/opaque-ke, squirrelchat/nthparty).
