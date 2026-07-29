/* ============================================================
   TRYB TERAZ — most plan↔działanie
   Max czyta energię → dobiera zadanie do stanu → jedna rzecz.
   „Biorę się" → płynnie w tryb kryzysowy (rozbicie na kroki).
   ============================================================ */
const NOW = document.getElementById('now');
const nowStage = document.getElementById('nowStage');
const nowActions = document.getElementById('nowActions');
/* Propozycje są ogólne i uczciwe — Max nie ma dostępu do Twojej skrzynki,
   kalendarza ani listy zadań, więc nie udaje, że wie co konkretnie wisi.
   Dobiera CIĘŻAR do energii, a konkret podajesz Ty. */
/* NOW_TASKS usunięte w v16 — Max nie wymyśla zadań, dobiera je
   z listy użytkownika. Patrz: WARSTWA ZADAŃ na końcu pliku. */
let nowCurrent = null;
function nowSwap(html, acts){
  const old = nowStage.querySelector('.now-scene.active');
  if(old){ old.classList.remove('active'); setTimeout(()=>old.remove(),450); }
  const s=document.createElement('div'); s.className='now-scene'; s.innerHTML=html;
  nowStage.appendChild(s);
  requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('active')));
  nowActions.innerHTML = acts||'';
}
function exitNow(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  NOW.classList.remove('vis');
  setTimeout(()=>{ NOW.classList.remove('show'); nowStage.innerHTML=''; nowActions.innerHTML='';
    renderHost();   // Max przelicza, co powiedzieć — mógł się właśnie czegoś dowiedzieć
  },460);
}
/* ============================================================
   GŁÓWNY POMIAR — TRZY SUWAKI ZAMIAST TRZECH PRZYCISKÓW
   Wcześniej jedna oś (niska/średnia/wysoka energia) gubiła stan, który
   u osób z ADHD jest bardzo częsty: WYCZERPANY I JEDNOCZEŚNIE NAKRĘCONY.
   Model Thayera rozdziela to na dwie niezależne osie — energetic arousal
   (energia↔zmęczenie) i tense arousal (napięcie↔spokój). Do tego walencja
   z modelu kołowego Russella. Trzy suwaki, ~20 s, bez wymuszania nazwy.
   KOMPATYBILNOŚĆ: mapRecord() nadal dostaje low/mid/high, więc stare
   zapisy i cała mapa działają bez migracji.
   ============================================================ */
function nowAskEnergy(){
  const line='Zanim wskażę, co teraz — pokaż mi, jak masz.';
  nowSwap(`
    <div class="kicker">Max sprawdza stan</div>
    <div class="max-line" style="margin-bottom:18px">Jak masz teraz?</div>
    ${bodyHint()}

    <div class="sl-block">
      <div class="sl-lab"><span>ciężko</span><span>dobrze</span></div>
      <input class="sl" type="range" min="0" max="100" value="50" id="ckVal">
      <div class="sl-name">Jak się czujesz</div>
    </div>

    <div class="sl-block">
      <div class="sl-lab"><span>bez energii</span><span>dużo energii</span></div>
      <input class="sl" type="range" min="0" max="100" value="50" id="ckEne">
      <div class="sl-name">Ile masz energii</div>
    </div>

    <div class="sl-block">
      <div class="sl-lab"><span>spokój</span><span>duże napięcie</span></div>
      <input class="sl" type="range" min="0" max="100" value="50" id="ckTen">
      <div class="sl-name">Ile masz napięcia</div>
    </div>
  `,`
    <button class="btn btn-primary" onclick="checkinDone()">Gotowe</button>
  `);
  setTimeout(()=>maxSpeak(line,false),400);
}

/* Suwak energii mapujemy na stary poziom, żeby reguła doboru zadania
   i cała mapa działały bez zmian. */
function eneLevel(e){ return e >= 66 ? 'high' : e >= 34 ? 'mid' : 'low'; }

function checkinDone(){
  const v = +document.getElementById('ckVal').value;
  const e = +document.getElementById('ckEne').value;
  const t = +document.getElementById('ckTen').value;
  const level = eneLevel(e);
  const mm = memLoad() || {}; mm.lastLevel = level; memSave(mm);
  /* Pełny zapis do dziennika nastrojów — karmi mapę i wykrywanie rozjazdu. */
  const all = moodLoad();
  all.push({ t:Date.now(), v, a:e, ten:t, tag:null, src:'checkin',
             h:new Date().getHours(), d:new Date().getDay() });
  moodSave(all);
  buzz(BUZZ.easier);
  nowPick(level, {v, e, t});
}

/* ===== WARSTWA 3 — EKRAN „TWOJA MAPA" ===== */
function openMap(){
  markTool('map');
  const m = memLoad();
  const n = (m && m.map) ? m.map.length : 0;
  const dni = (m && m.days) ? m.days.length : 0;
  const pats = readPatterns();

  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));

  if(n < MAP_MIN){
    const brak = MAP_MIN - n;
    nowSwap(`
      <div class="kicker">Twoja mapa</div>
      <div class="max-line" style="margin-bottom:6px">Mapa się rysuje.</div>
      <div class="now-why-big">Masz ${n} ${n===1?'punkt':'punktów'} i ${dni} ${dni===1?'dzień':'dni'} razem.
        Jeszcze ${brak} ${brak===1?'wejście':'wejść'} i pokażę Ci, co się powtarza.</div>
      <div class="map-bar"><div class="map-fill" style="width:${Math.round(n/MAP_MIN*100)}%"></div></div>
    `,`
      <button class="btn btn-primary" onclick="exitNow()">Jasne</button>
    `);
    setTimeout(()=>maxSpeak('Mapa się rysuje. Jeszcze kilka wejść i pokażę Ci, co się powtarza.',false),350);
    return;
  }

  nowSwap(`
    <div class="kicker">Twoja mapa · ${n} punktów</div>
    <div class="max-line" style="margin-bottom:14px">Co widzę w Twoich danych</div>
    ${pats.map(p=>`<div class="map-item">${p}</div>`).join('')}
    <div class="map-note">To obserwacja z Twoich wejść, nie diagnoza.
      Ty wiesz najlepiej, co z tym zrobić.</div>
  `,`
    <button class="btn btn-primary" onclick="exitNow()">Dzięki, Max</button>
  `);
  setTimeout(()=>maxSpeak('To, co widzę w Twoich danych. Nie diagnoza — obserwacja.',false),400);
}

/* ============================================================
   ZRZUĆ MYŚLI — INTELIGENTNY DZIENNIK
   Wzorzec z TellSelf: użytkownik pisze swobodnie, AI wyciąga strukturę.
   Zero formularzy, zero skal nastroju do wypełniania.

   RÓŻNICA WOBEC TELLSELF: oni wysyłają wpis na serwer i kasują go po minutach,
   więc nie mają na czym budować mapy. U nas wpis ZOSTAJE lokalnie —
   do AI leci tylko na czas analizy. To karmi mapę i pamięć Maxa.

   AI robi trzy rzeczy naraz:
   1. LUSTRO   — odbija i nazywa emocję (affect labeling, Lieberman 2007)
   2. ZADANIA  — wyciąga z tekstu konkretne rzeczy do zrobienia
   3. PYTANIE  — jedno, które drąży głębiej
   ============================================================ */

let dumpFirstTask = '';   // A-11: pierwsze zadanie z modelu trzymamy tu, nie wstrzykujemy do onclick

function dumpLoad(){
  try{ return JSON.parse(localStorage.getItem(DUMP_KEY)) || []; }catch(e){ return []; }
}
function dumpSave(arr){
  try{ localStorage.setItem(DUMP_KEY, JSON.stringify(arr.slice(-300))); }catch(e){}
}

function openDump(){
  markTool('dump');
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  const n = dumpLoad().length;
  nowSwap(`
    <div class="kicker">Zrzuć myśli</div>
    <div class="max-line" style="margin-bottom:6px">Co Ci siedzi w głowie?</div>
    <div class="now-why-big" style="margin-bottom:14px">Pisz jak leci. Bez ładnych zdań, bez porządku.
      Ja poukładam.</div>
    <textarea class="dump-input" id="dumpInput" rows="6"
      placeholder="wszystko naraz, mail wisi od trzech dni, nie mogę się zebrać, jutro dentysta…"></textarea>
    ${n ? `<div class="ai-tag">${n} ${n===1?'wpis':'wpisów'} w dzienniku</div>` : ''}
  `,`
    <button class="btn btn-primary" onclick="processDump()">Gotowe</button>
    <div class="footnote"><button class="btn-text" onclick="exitNow()">Anuluj</button></div>
  `);
  setTimeout(()=>{
    maxSpeak('Pisz jak leci. Bez ładnych zdań — ja poukładam.',false);
    const i=document.getElementById('dumpInput'); if(i) i.focus();
  },400);
}

async function processDump(){
  const el = document.getElementById('dumpInput');
  const text = el ? el.value.trim() : '';
  if(!text){ exitNow(); return; }

  /* BEZPIECZEŃSTWO (§16): skan on-device PRZED zapisem i wysłaniem do modelu.
     Sygnał kryzysu → ekran wsparcia lokalnie, tekst NIE wychodzi do LLM. */
  if(scanCrisis(text)){ exitNow(); setTimeout(openSafety, 320); return; }

  buzz(BUZZ.done);

  /* Wpis zapisujemy ZAWSZE i NATYCHMIAST — niezależnie od tego, czy AI odpowie.
     Dane użytkownika nie mogą zależeć od dostępności sieci. */
  const entry = { t:Date.now(), text, h:new Date().getHours(), d:new Date().getDay() };
  const all = dumpLoad(); all.push(entry); dumpSave(all);

  nowSwap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line">Czytam…</div>
  `,'');

  const res = await analyzeDump(text);
  if(!res){
    /* Offline — Max mówi wprost. Wpis i tak jest zapisany. */
    nowSwap(`
      <div class="kicker">Zapisane</div>
      <div class="max-line" style="margin-bottom:8px">Jestem offline.</div>
      <div class="now-why-big">Zapisałem Twój wpis — jest u Ciebie, lokalnie. Nic nie przepadło.
        Wróć z siecią, jeśli chcesz, żebym go z Tobą rozłożył.</div>
    `,`
      <button class="btn btn-primary" onclick="exitNow()">Jasne</button>
    `);
    setTimeout(()=>playMax('offline','Jestem offline. Twój wpis jest zapisany — nic nie przepadło.',false),350);
    return;
  }

  /* Wzbogacamy zapisany wpis o to, co wyciągnęła AI — to karmi mapę. */
  const arr = dumpLoad();
  const last = arr[arr.length-1];
  if(last && last.t === entry.t){
    last.emotion = res.emotion || null;
    last.themes  = res.themes  || [];
    last.tasks   = res.tasks   || [];
    dumpSave(arr);
  }
  /* Emocja z dziennika trafia do tej samej mapy, co check-iny. */
  if(res.emotion) mapRecord(res.energy || 'mid', 'dump');

  /* A-11: odpowiedź modelu to niezaufane wejście (użytkownik → model → HTML).
     Escapujemy każde pole; pierwsze zadanie trzymamy w zmiennej, nie w atrybucie onclick. */
  dumpFirstTask = (res.tasks && res.tasks[0]) || '';
  nowSwap(`
    <div class="kicker">Co usłyszałem</div>
    <div class="dump-mirror">${esc(res.mirror||'')}</div>
    ${res.emotion ? `<div class="dump-emo">${esc(res.emotion)}</div>` : ''}
    ${(res.tasks&&res.tasks.length) ? `
      <div class="dump-sec">Wyłapałem konkrety</div>
      ${res.tasks.map(t=>`<div class="dump-task">${esc(t)}</div>`).join('')}` : ''}
    ${res.question ? `<div class="dump-q">${esc(res.question)}</div>` : ''}
  `,`
    ${(res.tasks&&res.tasks.length)
      ? `<button class="btn btn-primary" onclick="dumpToSession()">Ruszmy pierwsze 🔥</button>` : ''}
    <button class="btn btn-ghost" onclick="exitNow()">Wystarczy na teraz</button>
  `);
  setTimeout(()=>maxSpeak(res.mirror||'Zapisane.',false),400);
}

async function analyzeDump(text){
  if(!AI_PROXY_URL) return null;    // A-1: brak proxy → offline (bez proxy analiza nie zadziała)
  if(!consLoad().ai) return null;   // A-1b: treść dziennika (art. 9 RODO) nie wychodzi bez zgody
  if(!navigator.onLine) return null;
  const prompt =
`Jesteś Max — spokojny przewodnik dla osoby z ADHD. Użytkownik zrzucił myśli:
"""${text}"""

Zwróć WYŁĄCZNIE JSON, bez markdown:
{"mirror":"...","emotion":"...","energy":"low|mid|high","themes":["..."],"tasks":["..."],"question":"..."}

- mirror: 1-2 zdania. Odbij to, co usłyszałeś, jego słowami. Bez oceniania, bez pocieszania na siłę.
- emotion: JEDNO polskie słowo nazywające dominującą emocję (np. przeciążenie, lęk, wstyd, frustracja, nuda, spokój).
- energy: oszacuj poziom energii z tonu wpisu.
- themes: 1-3 obszary życia, których dotyczy (np. praca, dom, zdrowie, relacje).
- tasks: konkretne rzeczy do zrobienia wyłowione z tekstu, każda jako krótka fraza (maks 6 słów).
  Pusta tablica, jeśli nie ma żadnych. NIE wymyślaj zadań, których nie ma w tekście.
- question: JEDNO krótkie pytanie, które drąży głębiej. Otwarte, nie oceniające, bez "dlaczego".

Nie diagnozuj. Nie używaj terminów klinicznych. Nie obiecuj poprawy.`;
  try{
    const txt = await callModel(prompt, 1000, 12000);
    if(txt === null) return null;
    return JSON.parse(txt.replace(/```json|```/g,'').trim());
  }catch(e){ return null; }
}

/* Most dziennik → sesja: wyłowione zadanie wchodzi wprost w kroki. */
function dumpToSession(task){
  task = (task != null ? task : dumpFirstTask);   // A-11: domyślnie z bezpiecznego bufora
  exitNow();
  setTimeout(()=>{ startCrisisWithTask(task); }, 500);
}

/* ============================================================
   CZAT Z MAXEM — wejście do rozmowy
   Powitanie rozróżnia nowego użytkownika od bywalca: pierwszy raz
   to wyjaśnienie czym Max jest, kolejne to kontynuacja znajomości.
   Tryb TERAZ (energia → jedno zadanie) mieszka tutaj, nie na kaflu.
   ============================================================ */
function openChat(){
  markTool('chat');
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  const m = memLoad();
  const wraca = !!(m && m.sessions);
  const gap = daysSinceLastSeen();

  let naglowek, tresc, mowa;
  if(!wraca){
    naglowek = 'Cześć. Jestem Max.';
    tresc = 'Nie jestem listą zadań ani terapeutą. Jestem trenerem nastroju — pomagam nazwać, co się dzieje, i ruszyć najmniejszym możliwym krokiem.';
    mowa  = 'Cześć. Jestem Max. Pomagam nazwać, co się dzieje, i ruszyć najmniejszym krokiem.';
  } else if(gap >= 3){
    naglowek = 'Dobrze Cię widzieć.';
    tresc = 'Trochę Cię nie było — i to w porządku. Od czego dziś zaczniemy?';
    mowa  = 'Dobrze Cię widzieć. Od czego dziś zaczniemy?';
  } else {
    naglowek = `Hej. Widzimy się ${m.sessions+1}. raz.`;
    tresc = m.lastTask ? `Ostatnio utknęło Ci przy: „${m.lastTask}”. Dziś to samo czy coś nowego?`
                       : 'O czym dziś pogadamy?';
    mowa  = 'Hej. O czym dziś pogadamy?';
  }

  nowSwap(`
    <div class="now-orb"></div>
    <div class="kicker">Max · trener nastroju</div>
    <div class="max-line" style="margin-bottom:8px">${naglowek}</div>
    <div class="now-why-big">${tresc}</div>
  `,`
    <button class="btn btn-primary" onclick="nowAskEnergy()">Sprawdź moją energię ⚡</button>
    <button class="btn btn-primary" onclick="exitNow();setTimeout(openDump,480)">Mam mętlik w głowie 🧠</button>
    <button class="btn btn-ghost" onclick="exitNow();setTimeout(startCrisis,480)">Nie mogę zacząć</button>
    <div class="footnote"><button class="btn-text" onclick="exitNow()">Później</button></div>
  `);
  setTimeout(()=>maxSpeak(mowa,false),400);
  const o=nowStage.querySelector('.now-orb');
  if(o){o.classList.add('talking');setTimeout(()=>o.classList.remove('talking'),2600);}
}

/* Kafelek „Pokaż energię" — energia płynie, więc pokazujemy jej przebieg,
   a nie jednorazowy pomiar. Póki brak danych, prowadzi do sprawdzenia stanu.
   DO ZROBIENIA: pełna ankieta energii po researchu (PANAS, chronotyp). */
function openEnergy(){
  markTool('energy');
  const m = memLoad();
  const map = (m && m.map) ? m.map : [];
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));

  if(map.length < 5){
    nowSwap(`
      <div class="kicker">Twoja energia</div>
      <div class="max-line" style="margin-bottom:8px">Za mało danych.</div>
      <div class="now-why-big">Mam ${map.length} ${map.length===1?'pomiar':'pomiarów'}.
        Sprawdźmy, jak masz teraz — z czasem pokażę Ci, jak Twoja energia płynie w ciągu dnia.</div>
    `,`
      <button class="btn btn-primary" onclick="nowAskEnergy()">Sprawdź teraz ⚡</button>
      <div class="footnote"><button class="btn-text" onclick="exitNow()">Później</button></div>
    `);
    setTimeout(()=>maxSpeak('Za mało danych. Sprawdźmy, jak masz teraz.',false),350);
    return;
  }

  /* Przebieg energii wg pory dnia — z realnych pomiarów, bez zgadywania. */
  const pory = [
    {n:'Rano',      od:5,  do:11},
    {n:'Południe',  od:11, do:16},
    {n:'Wieczór',   od:16, do:21},
    {n:'Noc',       od:21, do:29}
  ];
  const val = {low:1, mid:2, high:3};
  const wiersze = pory.map(p=>{
    const w = map.filter(r=>{ const h=r.h<5?r.h+24:r.h; return h>=p.od && h<p.do; });
    if(!w.length) return `<div class="en-row"><span class="en-lab">${p.n}</span>
      <span class="en-empty">brak danych</span></div>`;
    const sr = w.reduce((s,r)=>s+(val[r.e]||2),0)/w.length;
    const proc = Math.round((sr-1)/2*100);
    return `<div class="en-row"><span class="en-lab">${p.n}</span>
      <span class="en-bar"><i style="width:${Math.max(proc,6)}%"></i></span>
      <span class="en-n">${w.length}×</span></div>`;
  }).join('');

  nowSwap(`
    <div class="kicker">Twoja energia · ${map.length} pomiarów</div>
    <div class="max-line" style="margin-bottom:14px">Jak płynie w ciągu dnia</div>
    ${wiersze}
    <div class="map-note">To średnia z Twoich wejść, nie diagnoza.
      Im więcej pomiarów, tym wierniejszy obraz.</div>
  `,`
    <button class="btn btn-primary" onclick="nowAskEnergy()">Sprawdź teraz ⚡</button>
    <div class="footnote"><button class="btn-text" onclick="exitNow()">Zamknij</button></div>
  `);
  setTimeout(()=>maxSpeak('Tak Twoja energia płynie w ciągu dnia. Średnia z Twoich wejść.',false),400);
}

