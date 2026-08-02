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
/* T-6: zapis, który NIE połyka błędów po cichu. Przy pełnej pamięci
   (QuotaExceededError) użytkownik dostaje jednorazowy komunikat, zamiast
   widzieć „Zapisane." i tracić dane bez śladu. Zwraca true/false. */
let _storageWarned = false;
function saveGuarded(key, value){
  try{ localStorage.setItem(key, value); return true; }
  catch(e){ storageWarn(); return false; }
}
function storageWarn(){
  if(_storageWarned) return; _storageWarned = true;
  try{
    const b = document.createElement('div');
    b.className = 'storage-warn';
    b.textContent = 'Pamięć urządzenia jest pełna — część zapisów może nie przejść. Pobierz kopię danych (Połączenia → Twoje dane) i usuń stare wpisy. (dotknij, by ukryć)';
    b.onclick = () => b.remove();
    document.body.appendChild(b);
  }catch(e){}
}
function memSave(m){ saveGuarded(MEM_KEY, JSON.stringify(m)); }
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
  /* T-9: różnica DNI KALENDARZOWYCH (spójnie z trackDay), nie bloków 24 h —
     wczoraj 23:00 i dziś 8:00 to 1 dzień przerwy, nie 0. */
  const a = new Date(m.lastSeen); a.setHours(0,0,0,0);
  const b = new Date();           b.setHours(0,0,0,0);
  return Math.max(0, Math.round((b - a) / 86400000));
}

/* ---------- WARSTWA 3 — MAPA: POSTĘP JAKO SAMOPOZNANIE ----------
   Nie poziomy i odznaki, tylko rosnący obraz siebie z własnych danych.
   Karmi kompetencję (SDT), a nie posłuszeństwo.
   ZASADA NADRZĘDNA: to lustro, nie diagnoza. Formułujemy jako obserwację
   z danych („X% Twoich wejść"), NIGDY jako etykietę czy ocenę. */
const DUMP_KEY = 'masteradhd.dump.v1';
const MOOD_KEY = 'masteradhd.mood.v1';
const MAP_MIN = 15;   // próg, poniżej którego nie pokazujemy wzorców

