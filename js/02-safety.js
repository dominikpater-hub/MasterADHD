/* ============================================================
   WARSTWA BEZPIECZEŃSTWA (§16) — deterministyczna, offline, przed LLM.
   Zasada: REAGOWAĆ na sygnał usera, nie WYKRYWAĆ ryzyka. Siatka słów-kluczy
   to uzupełnienie, NIE system wykrywania — łapie jawne sygnały, nie polega
   się na niej. Skan działa on-device PRZED wysłaniem tekstu do modelu.
   Numery zaszyte statycznie (nigdy generowane przez LLM), linki tel: offline.
   ============================================================ */
const CRISIS_WORDS=[
  'zabić się','zabije się','zabiję się','samobójstwo','odebrać sobie życie','odbiorę sobie życie',
  'skończyć ze sobą','skończę ze sobą','nie chcę żyć','chcę umrzeć','chce umrzeć','lepiej żeby mnie nie było',
  'zniknąć na zawsze','tnę się','chcę się pociąć','ranię się','samookalecz','nie ma dla mnie ratunku',
  'wszyscy mieliby lepiej beze mnie','napisałem pożegnanie','mam plan','nie dam rady dłużej','nie widzę wyjścia'
];
function scanCrisis(text){
  if(!text) return false;
  const t=text.toLowerCase();
  if(/nie chcę (się )?zab|nie chcę umrz|nie mam myśli samob/.test(t)) return false; // proste zaprzeczenia
  return CRISIS_WORDS.some(w=>t.includes(w));
}
/* A-9: jeden wspólny punkt pobrania tekstu od użytkownika. Skan kryzysowy PRZED
   jakimkolwiek zapisem i wysłaniem do modelu — nigdy przez wywołanie punktowe,
   które zawsze zostanie pominięte w drugim polu. Trafienie → wsparcie, zwraca null. */
function readUserText(el){
  if(!el) return '';
  const t = (el.value||'').trim();
  if(t && scanCrisis(t)){ openSafety(); return null; }
  return t;
}
/* C-5: numery i godziny linii się zmieniają (samo 116 123 przeszło z 14–22 na 24/7).
   Ostatnia weryfikacja webowa: HELPLINES_VERIFIED. Reguła: przeglądać CO ROK.
   Numery NIGDY nie są generowane przez model — wyłącznie ta stała lista. */
const HELPLINES_VERIFIED = '2026-08-02';   // ⟵ zaktualizuj przy corocznym przeglądzie
try{ if((Date.now() - new Date(HELPLINES_VERIFIED)) > 365*86400000)
  console.warn('[MasterADHD] Numery pomocowe wymagają corocznej weryfikacji (ostatnia: '+HELPLINES_VERIFIED+').'); }catch(e){}
const HELPLINES=[
  {num:'112', tel:'112', meta:'Bezpośrednie zagrożenie życia', emerg:true},
  {num:'116 123', tel:'116123', meta:'Kryzys emocjonalny, dorośli · 24/7'},
  {num:'511 200 200', tel:'511200200', meta:'Kryzys samobójczy · 24/7'},
  {num:'800 70 2222', tel:'800702222', meta:'Centrum Wsparcia · 24/7'},
  {num:'116 111', tel:'116111', meta:'Dzieci i młodzież · 24/7'},
];
/* Otwiera ekran wsparcia w nakładce kryzysu — statyczny, offline. */
function openSafety(){
  try{ if('speechSynthesis'in window) speechSynthesis.cancel(); }catch(e){}
  const html=`
    <div class="safety-wrap">
      <div class="safety-h">Nie musisz zostawać z tym w pojedynkę. Pomoc jest w zasięgu ręki.</div>
      <div class="safety-sub">Jeśli myślisz o zrobieniu sobie krzywdy albo czujesz, że nie dajesz rady — odezwij się do kogoś, kto pomoże teraz. Te rozmowy są anonimowe i bezpłatne.</div>
      ${HELPLINES.map(h=>`<a class="safety-num${h.emerg?' emerg':''}" href="tel:${h.tel}">
        <span class="sn-big">${h.num}</span>
        <span class="sn-meta">${h.meta}</span><span class="sn-go">›</span></a>`).join('')}
      <div class="safety-fine">Wolisz napisać? Czat na <b>116sos.pl</b>. To nie oznaka słabości — to krok naprzód. Max jest tu i zostaje, kiedy tylko zechcesz.</div>
    </div>`;
  // użyj nakładki kryzysu jako nośnika (już istnieje, działa offline)
  crisis.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>crisis.classList.add('vis')));
  stage.innerHTML = `<div class="scene active" style="justify-content:flex-start;padding-top:8px">${html}</div>`;
  actions.innerHTML = `<button class="btn btn-ghost" onclick="exitCrisis()">Wróć</button>`;
  if(dots) dots.style.display='none';
}


function mapRecord(energy, helped){
  const m = memLoad() || { sessions:0, created:Date.now() };
  m.map = m.map || [];
  m.map.push({ e:energy, h:new Date().getHours(), d:new Date().getDay(),
               helped: helped || null, t:Date.now() });
  if(m.map.length > 400) m.map = m.map.slice(-400);   // sufit lokalny
  memSave(m);
}

/* Zwraca listę obserwacji (0–3). Pusta = za mało danych, nic nie zmyślamy. */
function readPatterns(){
  const m = memLoad();
  if(!m || !m.map || m.map.length < MAP_MIN) return [];
  const map = m.map, n = map.length, out = [];

  // 1) Pora dnia
  const evening = map.filter(r=>r.h>=20 || r.h<4).length;
  const morning = map.filter(r=>r.h>=5 && r.h<11).length;
  const evShare = Math.round(evening/n*100), moShare = Math.round(morning/n*100);
  if(evShare >= 40)      out.push(`Najczęściej wchodzisz tu wieczorem — ${evShare}% Twoich wejść po 20:00.`);
  else if(moShare >= 40) out.push(`Najczęściej wchodzisz tu rano — ${moShare}% Twoich wejść przed 11:00.`);

  // 2) Dominująca energia
  const cnt = {low:0, mid:0, high:0};
  map.forEach(r=>{ if(cnt[r.e]!==undefined) cnt[r.e]++; });
  const top = Object.keys(cnt).reduce((a,b)=>cnt[a]>=cnt[b]?a:b);
  const topShare = Math.round(cnt[top]/n*100);
  if(topShare >= 45){
    const nazwa = {low:'niskiej energii', mid:'średniej energii', high:'pełnej mocy'}[top];
    out.push(`Zwykle sięgasz po pomoc przy ${nazwa} — ${topShare}% razy.`);
  }

  // 3) Weekend vs tydzień roboczy
  const wknd = map.filter(r=>r.d===0||r.d===6).length;
  const wkShare = Math.round(wknd/n*100);
  if(wkShare >= 45) out.push(`Weekendy bywają dla Ciebie trudniejsze — ${wkShare}% wejść wypada w sobotę lub niedzielę.`);
  else if(wkShare <= 8) out.push(`Weekendy masz lżejsze — tylko ${wkShare}% wejść wypada wtedy.`);

  /* 4) Emocje i tematy z dziennika — druga rzeka danych do tej samej mapy. */
  const dumps = dumpLoad();
  if(dumps.length >= 5){
    const emos = {};
    dumps.forEach(d=>{ if(d.emotion) emos[d.emotion]=(emos[d.emotion]||0)+1; });
    const keys = Object.keys(emos);
    if(keys.length){
      const topE = keys.reduce((a,b)=>emos[a]>=emos[b]?a:b);
      const withEmo = keys.reduce((s,k)=>s+emos[k],0);
      const sh = Math.round(emos[topE]/withEmo*100);
      if(sh >= 35) out.push(`W tym, co piszesz, najczęściej wraca: ${topE} — ${sh}% wpisów.`);
    }
    const th = {};
    dumps.forEach(d=>(d.themes||[]).forEach(x=>{ th[x]=(th[x]||0)+1; }));
    const tk = Object.keys(th);
    if(tk.length){
      const topT = tk.reduce((a,b)=>th[a]>=th[b]?a:b);
      if(th[topT] >= 3) out.push(`Najwięcej miejsca zajmuje u Ciebie: ${topT}.`);
    }
  }

  /* 5) Ćwiartki z suwaków nastroju — trzecia rzeka danych.
     A-5: wpisy z ankiety emocji mają v/a = null; bez filtra moodQuadrant(null,null)
     wrzuca je wszystkie do loNeg i lustro odbija odwrotność. Liczymy tylko realne pomiary. */
  const moods = moodLoad().filter(x => x.v != null && x.a != null);
  if(moods.length >= 5){
    const q = {hiPos:0, loPos:0, hiNeg:0, loNeg:0};
    moods.forEach(x=>{ q[moodQuadrant(x.v, x.a)]++; });
    const kq = Object.keys(q).reduce((a,b)=>q[a]>=q[b]?a:b);
    const sh = Math.round(q[kq]/moods.length*100);
    const opis = {
      hiPos:'w energii i na plusie', loPos:'spokojnie i na plusie',
      hiNeg:'spięcie przy wysokim pobudzeniu', loNeg:'niska energia i ciężko'
    }[kq];
    if(sh >= 35) out.push(`Gdy pokazujesz mi emocje, najczęściej jest to: ${opis} — ${sh}% razy.`);
    /* Rozjazd Thayera: wyczerpany, a jednocześnie nakręcony. */
    const spiecie = moods.filter(x=>x.v < 40 && x.a > 60).length;
    const spSh = Math.round(spiecie/moods.length*100);
    if(spSh >= 25) out.push(`Często masz naraz niską energię i wysokie napięcie — ${spSh}% Twoich zapisów.`);
  }

  return out.slice(0,4);
}
/* Renderuje powitanie na ekranie głównym. */
/* Blok .max-hello zniknął w v7 — Max jest teraz gospodarzem (sekcja .host).
   Nazwa zostaje jako alias, bo wołają ją enterApp() i start aplikacji. */
function renderGreeting(){ renderHost(); }

/* ---------- WIBRACJE (mikrobodziec zamknięcia kroku) ---------- */
/* Vibration API: Android/Chrome tak, iOS Safari nie — bezpieczna detekcja. */
function buzz(pattern){
  try{
    if('vibrate' in navigator && typeof navigator.vibrate === 'function'){
      navigator.vibrate(pattern);
    }
  }catch(e){/* ciche pominięcie */}
}
const BUZZ = {
  enter:  30,          // wejście w kryzys — delikatne „jestem"
  done:   [0,18,40,18],// zamknięcie kroku — podwójny, satysfakcjonujący puls
  easier: 12,          // „za trudne" — ledwo muśnięcie
  start:  [0,25,50,25,50,45] // start — dłuższy, triumfalny wzór
};

/* ---------- GŁOS MAXA ----------
   Problem: na wielu urządzeniach (zwł. Android/Samsung) nie ma polskiego głosu
   TTS. Wtedy przeglądarka czyta polski tekst obcym silnikiem = bełkot z akcentem.
   Zasada: lepiej CISZA niż niezrozumiały głos. Mówimy TYLKO gdy jest realnie
   polski głos. Preferencja użytkownika zapamiętana. Głosy ładują się async —
   dlatego reagujemy na onvoiceschanged i odświeżamy ikonę. */
let voiceWanted = (function(){ try{ return localStorage.getItem('masteradhd.voice')!=='off'; }catch(e){ return true; } })();
let plVoice = null;
function plAvailable(){ return !!plVoice; }
function voiceOn(){ return voiceWanted && plAvailable(); }  // mówimy tylko z polskim głosem
function refreshMuteIcon(){
  const label = !plAvailable() ? '🔇' : (voiceWanted ? '🔊' : '🔇');
  document.querySelectorAll('.muteBtn').forEach(b=>{
    b.textContent = label;
    b.title = !plAvailable() ? 'Brak polskiego głosu w tej przeglądarce' : (voiceWanted ? 'Głos Maxa włączony' : 'Głos Maxa wyciszony');
    b.style.opacity = plAvailable() ? '' : '.35';
  });
}
function pickVoice(){
  const vs = speechSynthesis.getVoices();
  plVoice = vs.find(v=>/^pl(-|_|$)/i.test(v.lang)) || vs.find(v=>/polish|polski/i.test(v.name)) || null;
  refreshMuteIcon();
}
if('speechSynthesis' in window){
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
  // niektóre przeglądarki potrzebują chwili, by wypełnić listę głosów
  setTimeout(pickVoice, 400); setTimeout(pickVoice, 1200);
}
function maxSpeak(text, fired){
  if(!voiceOn() || !('speechSynthesis' in window)) return;   // cisza, gdy brak PL głosu lub wyciszone
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[—•→]/g,' '));
  u.voice = plVoice;            // zawsze konkretny polski głos (nie null)
  u.lang = plVoice.lang || 'pl-PL';
  u.rate = fired ? 1.08 : 0.96;
  u.pitch = fired ? 1.1 : 1.0;
  u.volume = 1;
  const core = document.querySelector('.max-orb-core');
  if(core){ core.classList.add('talking'); u.onend = ()=>core.classList.remove('talking'); }
  speechSynthesis.speak(u);
}
function toggleVoice(){
  if(!plAvailable()){
    // brak polskiego głosu — nie da się włączyć; wyjaśnij zamiast czytać bełkot
    alert('Ta przeglądarka nie ma polskiego głosu, więc Max czytałby z obcym akcentem. Aby włączyć głos, doinstaluj polski pakiet TTS w ustawieniach systemu (Zamiana tekstu na mowę) i wróć.');
    return;
  }
  voiceWanted = !voiceWanted;
  try{ localStorage.setItem('masteradhd.voice', voiceWanted ? 'on' : 'off'); }catch(e){}
  refreshMuteIcon();
  if(!voiceWanted && 'speechSynthesis' in window) speechSynthesis.cancel();
}

/* ---------- DANE KROKÓW (placeholder — docelowo AI) ---------- */
/* Kroki zależne od tego, GDZIE użytkownik jest. Wcześniej Max zawsze kazał
   wstać i podejść do biurka — nawet komuś pod prysznicem. Max, który nie pyta
   o kontekst, wygląda jakby nie słuchał. */
const STEP_SETS = {
  desk: [
    { word:'Odsuń wszystko poza jedną rzeczą.', hint:'Telefon ekranem w dół. Zakładki poza tą jedną — zamknij.', somatic:true,
      max:'Jesteś na miejscu. To odsuńmy wszystko poza jedną rzeczą.' },
    { word:'Otwórz to, w czym masz zacząć.', hint:'Plik, dokument, aplikacja. Otwórz i zatrzymaj się.',
      max:'Teraz otwórz to i zatrzymaj się. Nie zaczynaj — tylko otwórz.' },
    { word:'Zrób najmniejszy możliwy ruch.', hint:'Jedno zdanie. Jedna linijka. Jeden klik.',
      max:'Ostatni krok. Najmniejszy możliwy ruch. Dalej ja.' }
  ],
  couch: [
    { word:'Postaw stopy na podłodze.', hint:'Nic więcej. Obie stopy, płasko.', somatic:true,
      max:'Zaczynamy od ciała. Obie stopy na podłodze — tyle.' },
    { word:'Usiądź prosto i weź jeden oddech.', hint:'Plecy od oparcia. Jeden wdech, jeden wydech.',
      max:'Teraz plecy od oparcia i jeden spokojny oddech.' },
    { word:'Wstań i przejdź trzy kroki.', hint:'Dokądkolwiek. Chodzi o ruch, nie o cel.',
      max:'Wstań i zrób trzy kroki. Gdziekolwiek. Dalej ja.' }
  ],
  away: [
    { word:'Dokończ spokojnie to, co robisz.', hint:'Bez pośpiechu. Nigdzie się nie spieszymy.', somatic:true,
      max:'Jesteś w trakcie czegoś. Dokończ spokojnie — poczekam.' },
    { word:'Powiedz na głos jedną rzecz, którą zrobisz.', hint:'Jedno zdanie. Głośno albo w myślach.',
      max:'Teraz nazwij jedną rzecz, którą zrobisz. Jedno zdanie.' },
    { word:'Ustaw ją tam, gdzie ją zobaczysz.', hint:'Notatka, wiadomość do siebie, kartka.',
      max:'Zostaw to sobie tam, gdzie zobaczysz. Wrócimy do tego.' }
  ],
  bed: [
    { word:'Odłóż telefon na chwilę.', hint:'Obok, ekranem w dół. Zaraz wróci.', somatic:true,
      max:'Zaczynamy lekko. Odłóż telefon na moment — zaraz wróci.' },
    { word:'Usiądź na brzegu łóżka.', hint:'Tylko usiądź. Nie wstawaj jeszcze.',
      max:'Teraz usiądź na brzegu. Nie wstawaj — tylko usiądź.' },
    { word:'Postaw obie stopy na podłodze.', hint:'To wszystko. Reszta sama pójdzie.',
      max:'Obie stopy na podłodze. To wszystko. Dalej ja.' }
  ]
};
const DEFAULT_STEPS = STEP_SETS.desk;
const EASIER = {
  'Wstań i przejdź trzy kroki.': { word:'Postaw jedną stopę na podłodze.', hint:'Tyle wystarczy na teraz. Reszta poczeka.',
    max:'Spoko. Mniejszy krok: tylko jedna stopa na podłodze.' },
  'Odsuń wszystko poza jedną rzeczą.': { word:'Zamknij jedną zakładkę.', hint:'Jedną. Nie wszystkie.',
    max:'Mniejszy krok: zamknij jedną zakładkę. Tyle.' }
};

let steps=[], idx=0, breakdownGiven={};
let sessionTask = '';   // co user wpisał w tej sesji
let sessionHelped = ''; // co pomogło (breakdown/steps)

