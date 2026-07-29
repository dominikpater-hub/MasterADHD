# Changelog

Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).

## [Nieopublikowane]

### Zmienione
- **Rozbicie prototypu jednoplikowego na źródło.** Monolit `MasterADHD-v16.html`
  (3426 linii) podzielony na `index.html` + `css/styles.css` + 10 modułów `js/*.js`
  wg banerów sekcji. Zachowanie identyczne z prototypem (zweryfikowane w Chromie —
  parytet globalnych funkcji, brak błędów runtime, identyczny render).
- Kolejność ładowania modułów zachowana; klasyczne `<script>` (nie moduły ES),
  by nie zerwać inline'owych `onclick`.

### Dodane
- `README.md` z architekturą, instrukcją uruchomienia i roadmapą.
- `docs/AUDYT-v16.1.0.md` — pełny audyt.
- `docs/prototype-v16-monolith.html` — zamrożony prototyp (proweniencja).
- `.gitignore`, `LICENSE`.

### Do zrobienia (v16.1)
Naprawy z audytu, sekcja D: A-2, A-3, A-5, A-1b, A-9, A-11, B-1, B-4, A-14.
