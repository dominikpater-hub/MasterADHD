/* ============================================================
   MasterADHD v2 — Max jako persona przez cały przepływ
   Ton: w kryzysie ściszony i konkretny; od startu pełna energia.
   Głos: Web Speech API (pl-PL jeśli dostępny). Wyciszalny.
   ============================================================ */

const crisis  = document.getElementById('crisis');
const stage   = document.getElementById('stage');
const actions = document.getElementById('actions');
const dots    = document.getElementById('dots');
const muteBtn = document.getElementById('muteBtn');

/* ---------- PAMIĘĆ MAXA (partner, nie chatbot) ---------- */
const MEM_KEY = 'masteradhd.max.v1';
function memLoad(){
  try{ return JSON.parse(localStorage.getItem(MEM_KEY)) || null; }catch(e){ return null; }
}
function memSave(m){
  try{ localStorage.setItem(MEM_KEY, JSON.stringify(m)); }catch(e){}
}
/* Buduje kontekstowe powitanie na podstawie ostatniej sesji. */
function maxGreeting(){
  const m = memLoad();
  if(!m || !m.sessions){
    return { name:'Max · Twój trener',
      html:`<b>Hej. Jestem Max.</b> Kiedy utkniesz i nie możesz ruszyć — naciśnij duży guzik na dole. Zajmę się resztą.` };
  }
  /* WARSTWA 1 — powrót po przerwie. Nagroda idzie za POWRÓT, nie za ciągłość.
     Zero wyrzutów typu „nie widzieliśmy Cię 3 dni". */
  const gap = daysSinceLastSeen();
  if(gap >= 3){
    const dni = (m.days && m.days.length) ? m.days.length : m.sessions || 1;
    return { name:'Max',
      html:`<b>Wracasz.</b> To się liczy bardziej niż ciągłość. Masz za sobą ${dni} ${dni===1?'dzień':'dni'} — nic nie przepadło.` };
  }
  // wracający użytkownik — Max pamięta
  if(m.lastTask && m.lastHelped === 'breakdown'){
    return { name:`Max · widzimy się ${m.sessions}. raz`,
      html:`<b>Ostatnim razem pomogło rozbicie zadania.</b> Gdy znów utkniesz — rozbijamy to tak samo.` };
  }
  if(m.lastTask){
    return { name:`Max · pamięta`,
      html:`<b>Ostatnio utknąłeś przy: „${m.lastTask}”.</b> Dziś też? Naciśnij guzik, ruszymy to razem.` };
  }
  return { name:`Max · widzimy się ${m.sessions}. raz`,
    html:`<b>Dobrze Cię widzieć znowu.</b> Gdy utkniesz — jeden guzik i lecimy krok po kroku.` };
}
/* Zapisuje ślad po sesji. */
function memRecord(patch){
  const m = memLoad() || { sessions:0, created:Date.now() };
  m.sessions = (m.sessions||0) + (patch.newSession ? 1 : 0);
  if(patch.lastTask   !== undefined) m.lastTask   = patch.lastTask;
  if(patch.lastHelped !== undefined) m.lastHelped = patch.lastHelped;
  /* WARSTWA 2 — licznik startów. Nagradzamy ruszenie, nie ukończenie. */
  if(patch.newSession) m.starts = (m.starts||0) + 1;
  m.lastSeen = Date.now();
  memSave(m);
}

/* ---------- WARSTWA 1 — LICZNIK, KTÓRY NIE KARZE ----------
   Suma dni, nie ciąg. Pominięty dzień nie zeruje — po prostu nie dodaje.
   Podstawa: Lally 2010 — pominięcie jednego dnia nie łamie krzywej nawyku.
   Świadomie NIE budujemy zerującego się streaka: uderzałby najmocniej
   w tych, którzy najczęściej opuszczą dzień. */
function trackDay(){
  const m = memLoad() || { sessions:0, created:Date.now() };
  const today = new Date().toDateString();
  m.days = m.days || [];
  if(!m.days.includes(today)) m.days.push(today);
  memSave(m);
  return m.days.length;
}
/* Ile dni od ostatniej wizyty (do powitania po przerwie). */
function daysSinceLastSeen(){
  const m = memLoad();
  if(!m || !m.lastSeen) return 0;
  return Math.floor((Date.now() - m.lastSeen) / 86400000);
}

/* ---------- WARSTWA 3 — MAPA: POSTĘP JAKO SAMOPOZNANIE ----------
   Nie poziomy i odznaki, tylko rosnący obraz siebie z własnych danych.
   Karmi kompetencję (SDT), a nie posłuszeństwo.
   ZASADA NADRZĘDNA: to lustro, nie diagnoza. Formułujemy jako obserwację
   z danych („X% Twoich wejść"), NIGDY jako etykietę czy ocenę. */
const DUMP_KEY = 'masteradhd.dump.v1';
const MOOD_KEY = 'masteradhd.mood.v1';
const MAP_MIN = 15;   // próg, poniżej którego nie pokazujemy wzorców

