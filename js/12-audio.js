/* ============================================================
   AUDIO MAXA — własny głos zamiast losowego TTS (v18, pipeline C-10)
   ------------------------------------------------------------
   Problem: na wielu Androidach brak polskiego głosu TTS → Max milczy
   albo brzmi obco (audyt C-10). Docelowo kilkadziesiąt kwestii nagrywa
   lektor, co daje spójny charakter zamiast losowego syntezatora.

   To jest WARSTWA ODTWARZANIA: playMax(key, text, fired) gra nagranie
   z audio/<plik>, a gdy pliku nie ma (albo błąd/autoplay) — spada do TTS
   (maxSpeak). Dzięki temu nagrania dokłada się po jednym, bez zmian w
   logice: wystarczy podmienić maxSpeak(...) → playMax('klucz', ...).
   Lista kwestii do nagrania: audio/README.md.
   ============================================================ */
const AUDIO_LINES = {
  // klucz : nazwa pliku w audio/  (dołóż nagrania — klucze zostają)
  close:   'close.mp3',    // domknięcie sesji („Zrobione. Byłem obok…")
  buddy:   'buddy.mp3',    // wejście w body-double („Rób swoje…")
  breath:  'breath.mp3',   // oddech przed krokami
  offline: 'offline.mp3'   // „Jestem offline, wpis zapisany"
};

let _audioEl = null;
function _audio(){ if(!_audioEl){ _audioEl = new Audio(); } return _audioEl; }

/* Gra nagranie dla klucza; brak pliku / błąd / blokada autoplay → TTS fallback.
   Gdy nagranie gra, NIE odpalamy TTS (żeby Max nie mówił dwoma głosami naraz). */
function playMax(key, text, fired){
  const file = AUDIO_LINES[key];
  if(!file){ maxSpeak(text, fired); return; }
  try{
    if(typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    const a = _audio();
    let fellBack = false;
    const fall = () => { if(!fellBack){ fellBack = true; maxSpeak(text, fired); } };
    a.onerror = fall;
    a.src = 'audio/' + file;
    const p = a.play();
    if(p && typeof p.catch === 'function') p.catch(fall);
  }catch(e){ maxSpeak(text, fired); }
}
