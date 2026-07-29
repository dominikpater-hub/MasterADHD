# Audio Maxa

Warstwa odtwarzania jest gotowa (`js/12-audio.js`). Tu wrzucasz nagrania —
`playMax('klucz', …)` odtworzy plik z tego folderu, a gdy pliku nie ma, Max
spadnie do syntezatora (TTS). Nic nie trzeba przełączać: dołożenie pliku
aktywuje głos dla danej kwestii.

## Jak nagrać

Jeden lektor, spokojny, ciepły ton (w kryzysie ściszony i konkretny). Format:
**MP3 lub M4A**, mono, ~128 kbps wystarczy. Nazwy plików muszą zgadzać się z
mapą `AUDIO_LINES` w `js/12-audio.js`.

## Kwestie do nagrania (pierwsza partia)

Trzy pierwsze są już podpięte przez `playMax(...)` — wrzucenie pliku od razu je
aktywuje. `breath.mp3` jest w mapie jako gotowy klucz, ale kwestia oddechu bywa
warunkowa (wersja offline), więc podepnij ją ręcznie, gdy zdecydujesz który wariant.

| plik          | podpięte | tekst |
|---------------|:-------:|-------|
| `close.mp3`   | ✅ | „Zrobione. Byłem obok, ale to Twoja robota." |
| `buddy.mp3`   | ✅ | „Jestem obok. Rób swoje — jestem tu, kiedy tylko zerkniesz na ekran." |
| `offline.mp3` | ✅ | „Jestem offline. Twój wpis jest zapisany — nic nie przepadło." |
| `breath.mp3`  | ⏳ | „Dobra. Jestem tu. Weź ze mną jeden oddech." |

## Dokładanie kolejnych kwestii

1. Dodaj wpis do `AUDIO_LINES` w `js/12-audio.js`, np. `handoff: 'handoff.mp3'`.
2. W miejscu, gdzie Max to mówi, zmień `maxSpeak('…', fired)` na
   `playMax('handoff', '…', fired)` (ten sam tekst zostaje jako fallback TTS).
3. Wrzuć `handoff.mp3` do tego folderu i dodaj plik do listy `SHELL` w `sw.js`,
   żeby działał też offline.

## Uwaga

Bez nagrań aplikacja działa jak dziś (TTS albo cisza, gdy brak polskiego głosu).
Nagrania to ulepszenie, nie warunek.
