/* ============================================================
   POŁĄCZENIA I ZGODY
   ------------------------------------------------------------
   Każda zgoda osobno, każda domyślnie wyłączona, każda cofalna jednym
   dotknięciem (P-36). Opis mówi wprost, CO wychodzi z urządzenia —
   bo to jedyna informacja, która realnie interesuje użytkownika.
   ============================================================ */
function openConnect(){
  const c = consLoad();
  const sw = (k, tytul, opis, ostrz) => `
    <div class="cn-row">
      <div class="cn-txt"><b>${tytul}</b><small>${opis}</small>
        ${ostrz?`<em class="cn-warn">${ostrz}</em>`:''}</div>
      <button class="cn-sw ${c[k]?'on':''}" onclick="toggleCons('${k}')"
        role="switch" aria-checked="${c[k]?'true':'false'}"><i></i></button>
    </div>`;

  nowSwap(`
    <div class="kicker">Połączenia</div>
    <div class="max-line" style="margin-bottom:6px">Co wolno mi widzieć</div>
    <div class="now-why-big" style="margin-bottom:16px">
      Domyślnie nic. Wszystko działa offline — to są dodatki, nie warunki.
    </div>

    ${sw('gtasks','Google Tasks','Wciągam Twoje zadania, żeby mieć z czego wybierać.',
         'Treść zadań zostaje na urządzeniu.')}
    ${sw('gcal','Kalendarz — tylko wolne okno','Sprawdzam, ile masz czasu do następnej rzeczy.',
         'Nie czytam tytułów ani uczestników. Tylko godziny.')}
    ${sw('ai','Podpowiedzi AI','Model doszacowuje czas i rozbija zadanie na kroki.',
         'Treść zadania wychodzi wtedy poza urządzenie. Bez tej zgody zgaduję lokalnie.')}
    ${sw('body','Sen i tętno z opaski','Pytam o stan trafniej — ale to Ty go oceniasz.',
         'Nie powiem Ci, jak się czujesz. Mogę tylko zapytać.')}

    <div class="cn-note">
      Wszystko trzymam na Twoim urządzeniu. Cofnięcie zgody zatrzymuje wysyłanie na zewnątrz.
    </div>

    <div class="cn-data">
      <div class="cn-data-h">Twoje dane (RODO art. 15, 17, 20)</div>
      <button class="btn btn-ghost" onclick="exportData()">📥 Pobierz wszystko (JSON)</button>
      <button class="btn btn-ghost cn-danger" onclick="wipeConfirm()">🗑️ Usuń wszystkie dane</button>
    </div>

    <div class="cn-data">
      <div class="cn-data-h">Konto i synchronizacja</div>
      ${(typeof syncEnabled==='function' && syncEnabled()) ? `
        <div class="cn-acct-status" id="cnAcctStatus">Sprawdzam konto…</div>
        <button class="btn btn-ghost" onclick="syncNowUI()">🔄 Synchronizuj teraz</button>
        <button class="btn btn-ghost" id="cnUpgrade" onclick="upgradeUI()" style="display:none">⭐ Włącz wersję pełną (AI + sync na wielu urządzeniach)</button>
        <button class="btn btn-ghost cn-danger" onclick="accountSignOutUI()">Wyloguj</button>`
      : `<div class="cn-acct-status">Tryb lokalny — dane tylko na tym urządzeniu, w całości offline. Konto i sync między urządzeniami włączysz, konfigurując backend (patrz backend/supabase).</div>`}
    </div>
  `,`
    <button class="btn btn-primary" onclick="renderTasks()">Wróć</button>
  `);
  if(typeof syncEnabled==='function' && syncEnabled() && typeof fillAcctStatus==='function') setTimeout(fillAcctStatus, 0);
}

/* ============================================================
   TWOJE DANE — eksport i usunięcie (RODO art. 15/17/20)
   ------------------------------------------------------------
   Wszystko żyje lokalnie, więc przenoszalność i prawo do bycia zapomnianym
   realizujemy w całości na urządzeniu: eksport = zrzut localStorage do JSON,
   usunięcie = skasowanie kluczy aplikacji i twardy reset. */
function appDataKeys(){
  const out = [];
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if(k && /^(masteradhd\.|guardianid\.|gt\.)/.test(k)) out.push(k);
  }
  return out;
}
function exportData(){
  try{
    const dump = { _app:'MasterADHD', _wersja:'v17', _eksport:new Date().toISOString(), dane:{} };
    appDataKeys().forEach(k=>{ dump.dane[k] = localStorage.getItem(k); });
    const blob = new Blob([JSON.stringify(dump, null, 2)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'masteradhd-dane-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 120);
    buzz(BUZZ.done);
  }catch(e){ alert('Nie udało się przygotować pliku. Spróbuj ponownie.'); }
}
function wipeConfirm(){
  nowSwap(`
    <div class="kicker">Usunięcie danych</div>
    <div class="max-line" style="margin-bottom:8px">Na pewno usunąć wszystko?</div>
    <div class="now-why-big">Skasuję Twój dziennik, mapę, zadania, profil i zgody — nieodwracalnie,
      z tego urządzenia. Warto wcześniej pobrać kopię.</div>
  `,`
    <button class="btn btn-ghost cn-danger" onclick="wipeData()">Tak, usuń wszystko</button>
    <button class="btn btn-primary" onclick="openConnect()">Anuluj</button>
  `);
}
function wipeData(){
  appDataKeys().forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  try{ location.reload(); }catch(e){ location.href = location.pathname; }
}
function toggleCons(k){
  const c = consLoad();
  c[k] = !c[k];
  consSave(c);
  buzz(BUZZ.easier);
  if(k==='gtasks' && c[k]) { openConnect(); connectGoogleTasks(); return; }
  if(k==='gcal'   && c[k]) { openConnect(); connectCalendar(); return; }
  if(k==='gcal'   && !c[k]){ FREE_WINDOW = null; }   // wyłączenie zgody = zapominamy okno
  if(k==='body' && c[k])  { openConnect(); connectBody(); return; }
  openConnect();
}

/* ============================================================
   GOOGLE TASKS — SZKIELET OAuth PKCE
   ------------------------------------------------------------
   Działa z czystej PWA: OAuth 2.0 z PKCE, bez backendu i bez sekretu.
   Wymaga własnego Client ID z Google Cloud Console (typ: Web).
   Zakres celowo najwęższy z możliwych.

   UWAGA na przyszłość: Google Fit REST API jest wygaszane z końcem
   2026 i nie ma zamiennika dla weba — dane z opaski trzeba brać
   z Fitbit Web API / Google Health API albo przez wrapper.
   ============================================================ */
const GOOGLE_CLIENT_ID = '';                     /* ← wklej własny */
const GT_SCOPE = 'https://www.googleapis.com/auth/tasks.readonly';

function connectGoogleTasks(){
  if(!GOOGLE_CLIENT_ID){
    nowSwap(`
      <div class="kicker">Google Tasks</div>
      <div class="max-line" style="margin-bottom:10px">Brakuje jednej rzeczy</div>
      <div class="now-why-big">
        Żeby to ruszyło, potrzebny jest Client ID z Google Cloud Console
        (typ: aplikacja webowa, zakres <code>tasks.readonly</code>).
        Wklej go w stałej <code>GOOGLE_CLIENT_ID</code> w kodzie.
        <br><br>Do tego czasu wszystko działa na lokalnej liście.
      </div>
    `,`<button class="btn btn-primary" onclick="openConnect()">Rozumiem</button>`);
    return;
  }
  gtAuth();
}

async function gtAuth(){
  const verifier = [...crypto.getRandomValues(new Uint8Array(32))]
    .map(b=>('0'+b.toString(16)).slice(-2)).join('');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  sessionStorage.setItem('gt.verifier', verifier);

  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  u.searchParams.set('redirect_uri', location.origin + location.pathname);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', GT_SCOPE);
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  location.href = u.toString();
}


/* ============================================================
   KALENDARZ — TYLKO OKNO, ZERO TREŚCI (P-34)
   ------------------------------------------------------------
   Jedyne, co z niego bierzemy, to liczba minut do najbliższego zajętego
   slotu. Tytuł, uczestnicy i lokalizacja są odrzucane w miejscu odczytu,
   więc Max architektonicznie nie może powiedzieć „przez spotkania z X…"
   (P-38). To nie jest deklaracja w polityce prywatności, tylko brak
   danych w pamięci.
   ============================================================ */
let FREE_WINDOW = null;   /* minuty do następnej rzeczy albo null */

async function calWindow(token){
  if(!consLoad().gcal || !token) return null;
  try{
    const now = new Date();
    const end = new Date(now.getTime() + 8*3600*1000);
    const u = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    u.searchParams.set('timeMin', now.toISOString());
    u.searchParams.set('timeMax', end.toISOString());
    u.searchParams.set('singleEvents','true');
    u.searchParams.set('orderBy','startTime');
    const r = await fetch(u, {headers:{Authorization:'Bearer '+token}});
    if(!r.ok){ FREE_WINDOW = null; return null; }
    const j = await r.json();
    /* Bierzemy WYŁĄCZNIE start pierwszego PRZYSZŁEGO zdarzenia z godziną.
       Zdarzenia całodniowe (start.date) i trwające (start < teraz) pomijamy —
       „okno" to czas do następnej rzeczy, nie do bieżącej. Reszta pól (tytuł,
       uczestnicy, lokalizacja) nie jest w ogóle odczytywana (P-34/P-38). */
    const first = (j.items||[])
      .map(e => e.start && e.start.dateTime)
      .filter(Boolean)
      .map(dt => new Date(dt))
      .filter(d => d > now)[0];
    if(!first){ FREE_WINDOW = null; return null; }   // czysty horyzont = brak ograniczenia okna
    FREE_WINDOW = Math.max(5, Math.round((first - now)/60000));
    return FREE_WINDOW;
  }catch(e){ FREE_WINDOW = null; return null; }
}

/* ============================================================
   KALENDARZ — OAuth (Google Identity Services, bez backendu)
   ------------------------------------------------------------
   Audyt A-6: stary szkielet OAuth nie domykał się bez backendu (wymiana kodu
   na token potrzebowała sekretu). GIS token client daje token dostępu wprost
   w przeglądarce dla zakresu READ-ONLY — z samym Client ID typu „Web" i
   dozwolonym origin. Żaden sekret, żaden backend. Token żyje w pamięci (~1h),
   nie jest zapisywany. Nadal bierzemy z kalendarza tylko minuty (calWindow).
   ============================================================ */
const GCAL_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
let _gisReady = null;
let _calTokenClient = null;
let CAL_TOKEN = null;   // { token, exp } — tylko w pamięci sesji

function loadGIS(){
  if(_gisReady) return _gisReady;
  _gisReady = new Promise((resolve, reject)=>{
    if(window.google && google.accounts && google.accounts.oauth2){ resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = ()=>resolve();
    s.onerror = ()=>reject(new Error('gis-load-failed'));
    document.head.appendChild(s);
  });
  return _gisReady;
}

/* Zwraca token kalendarza (read-only) albo null. silent=true nie pokazuje okna,
   jeśli zgoda już była (do cichego odświeżania przed doborem). */
function getCalToken(silent){
  return new Promise(async (resolve)=>{
    if(!GOOGLE_CLIENT_ID){ resolve(null); return; }
    if(CAL_TOKEN && CAL_TOKEN.exp > Date.now() + 60000){ resolve(CAL_TOKEN.token); return; }
    try{
      await loadGIS();
      const cb = (resp)=>{
        if(resp && resp.access_token){
          CAL_TOKEN = { token: resp.access_token, exp: Date.now() + (Number(resp.expires_in||3600)*1000) };
          resolve(CAL_TOKEN.token);
        } else resolve(null);
      };
      if(!_calTokenClient){
        _calTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID, scope: GCAL_SCOPE, callback: cb });
      } else { _calTokenClient.callback = cb; }
      _calTokenClient.requestAccessToken({ prompt: silent ? '' : 'consent' });
    }catch(e){ resolve(null); }
  });
}

/* Włączenie zgody na kalendarz: raz pytamy o dostęp, od razu liczymy okno. */
async function connectCalendar(){
  if(!GOOGLE_CLIENT_ID){
    nowSwap(`
      <div class="kicker">Kalendarz</div>
      <div class="max-line" style="margin-bottom:10px">Brakuje jednej rzeczy</div>
      <div class="now-why-big">
        Potrzebny Client ID z Google Cloud Console (typ: aplikacja webowa, zakres
        <code>calendar.readonly</code>, Twój adres jako dozwolony origin). Wklej go
        w stałej <code>GOOGLE_CLIENT_ID</code> w kodzie.
        <br><br>Do tego czasu dobór działa bez okna czasu — to tylko dodatek.
      </div>
    `,`<button class="btn btn-primary" onclick="openConnect()">Rozumiem</button>`);
    return;
  }
  const t = await getCalToken(false);
  if(t) await calWindow(t);
  openConnect();
}

/* Ciche odświeżenie okna przed doborem — nie pyta, jeśli zgody już nie ma. */
async function refreshCalWindow(){
  if(!consLoad().gcal || !GOOGLE_CLIENT_ID){ FREE_WINDOW = null; return; }
  const t = await getCalToken(true);
  if(t) await calWindow(t); else FREE_WINDOW = null;
}

/* ============================================================
   CZUJNIKI — PYTANIE, NIE WERDYKT
   ------------------------------------------------------------
   Konkurencja (Lifestack, Focuzed) czyta energię z opaski i podaje ją
   jako fakt. My tego nie robimy, z dwóch powodów.

   Po pierwsze rzetelność: sen i tętno korelują z odczuwaną energią
   luźno i bardzo indywidualnie. Bez progu ≥3–4 tygodni danych i hipotez
   postawionych z góry (P-37) to zgadywanie w ładnej oprawie.

   Po drugie i ważniejsze — tożsamość produktu. Max jest lustrem, nie
   diagnostą. „Twoje ciało mówi, że masz niską energię" unieważnia
   odczyt użytkownika i podsuwa gotową wymówkę. „Spałeś 5 godzin, czuć
   to?" zostawia ocenę przy nim — a to jest dokładnie ten mechanizm
   appraisal, na którym stoi affect labeling.

   Dlatego czujnik NIGDY nie ustawia suwaka. Dopisuje jedno zdanie nad
   suwakami i tyle.
   ============================================================ */
function bodyLoad(){ try{ return JSON.parse(localStorage.getItem(BODY_KEY))||null; }catch(e){ return null; } }
function bodySave(b){ try{ localStorage.setItem(BODY_KEY, JSON.stringify(b)); }catch(e){} }

function connectBody(){
  nowSwap(`
    <div class="kicker">Sen i tętno</div>
    <div class="max-line" style="margin-bottom:10px">Skąd to wziąć</div>
    <div class="now-why-big">
      Google Fit odpada — API kończy się z końcem 2026 i nie ma następcy
      dla weba. Z przeglądarki działają: <b>Fitbit Web API</b>,
      <b>Google Health API</b>, Oura i Whoop. Apple Health i Health Connect
      wymagają wrappera.
      <br><br>
      Możesz też wpisać ręcznie — działa tak samo, bo i tak tylko pytam.
    </div>
  `,`
    <button class="btn btn-primary" onclick="bodyManual()">Wpiszę ręcznie</button>
    <div class="footnote"><button class="btn-text" onclick="openConnect()">Później</button></div>
  `);
}
function bodyManual(){
  nowSwap(`
    <div class="kicker">Dziś w nocy</div>
    <div class="max-line" style="margin-bottom:16px">Ile snu tej nocy?</div>
    <div class="sl-block">
      <div class="sl-lab"><span>3 h</span><span>10 h</span></div>
      <input class="sl" type="range" min="3" max="10" step="0.5" value="7" id="slSleep">
      <div class="sl-name">Godziny snu</div>
    </div>
  `,`
    <button class="btn btn-primary" onclick="bodyStore()">Zapisz</button>
  `);
}
function bodyStore(){
  const h = +document.getElementById('slSleep').value;
  bodySave({sleep:h, at:Date.now()});
  buzz(BUZZ.easier);
  openConnect();
}

/* Jedno zdanie nad suwakami. Zawsze kończy się znakiem zapytania —
   to nie jest stylistyka, tylko zabezpieczenie przed wydaniem werdyktu. */
function bodyHint(){
  const b = bodyLoad();
  if(!consLoad().body || !b) return '';
  const stare = (Date.now() - b.at) > 20*3600*1000;
  if(stare) return '';
  if(b.sleep <= 5)  return `<div class="ck-body">${b.sleep} h snu. Czuć to?</div>`;
  if(b.sleep >= 8.5) return `<div class="ck-body">${b.sleep} h snu. Widać to po energii?</div>`;
  return '';
}

/* ============================================================
   „ZRÓB TO JEDNO" — OD v16 WSKAZUJE REALNĄ RZECZ
   ------------------------------------------------------------
   Do v15 tu stała tablica NOW_TASKS z ogólnikami w rodzaju „weź tę
   rzecz, którą odkładasz najdłużej". To była porada, nie zadanie —
   użytkownik i tak musiał wybrać sam, a wybieranie jest właśnie tym,
   co mu nie wychodzi.

   Teraz dobieramy z jego własnej listy, po trzech osiach check-inu.
   Gdy lista jest pusta, Max mówi to wprost. Nie wymyśla.
   ============================================================ */
function nowPick(level, slid){
  mapRecord(level);
  const st = slid || {v:50, e: level==='high'?80:level==='low'?20:50, t:50};

  const res = pickReal(st, FREE_WINDOW);

  /* Pusta lista — jedyny uczciwy ruch to powiedzieć o tym i poprosić. */
  if(!res){
    nowSwap(`
      <div class="kicker">🎯 Zrób teraz to jedno</div>
      <div class="max-line" style="margin-bottom:10px">Nie mam z czego wybrać.</div>
      <div class="now-why-big">
        Mógłbym rzucić ogólnikiem, ale to byłaby porada z internetu, nie Twoja rzecz.
        Podaj mi jedną — wystarczy tak, jak myślisz.
      </div>
      <div class="tk-add" style="margin-top:16px">
        <input id="tkNew" class="tk-in" type="text" placeholder="np. zadzwonić do przychodni"
               onkeydown="if(event.key==='Enter')addFromNow()">
        <button class="tk-go" onclick="addFromNow()">Dodaj</button>
      </div>
    `,`
      <div class="footnote"><button class="btn-text" onclick="exitNow()">Nie teraz</button></div>
    `);
    setTimeout(()=>maxSpeak('Nie mam z czego wybrać. Podaj mi jedną rzecz.',false),350);
    return;
  }

  nowCurrent = res.pick;
  taskPatch(res.pick.id, {offered:(res.pick.offered||0)+1, lastOffer:Date.now()});

  const kolor = {high:'var(--ok)', mid:'#e8b34f', low:'#f2a3a3'}[level] || 'var(--ok)';

  /* Rozjazd Thayera — stan, którego jedna oś by nie zauważyła. */
  let uwaga = '', line = 'Bierzemy to jedno.';
  if(st.e < 40 && st.t > 60){
    uwaga = '<div class="ck-note">Mało energii, sporo napięcia. Wybrałem coś, przy czym nie trzeba się zbierać.</div>';
    line  = 'Mało energii, a napięcia sporo. Wybrałem coś lekkiego.';
  } else if(st.e > 60 && st.t > 70){
    uwaga = '<div class="ck-note">Energia jest, ale i napięcie. Zaczynamy od czegoś, co je rozładuje.</div>';
  }

  const okno = FREE_WINDOW ? `<span class="nw-win">${FREE_WINDOW} min do następnej rzeczy</span>` : '';

  /* Alternatywy pokazujemy od razu. Trzy widoczne opcje to nadal wybór,
     ale ograniczony — a odrzucenie jednej rzeczy bez alternatywy
     kończy się zamknięciem apki. */
  const inne = res.alts.length ? `
    <div class="nw-alts">
      <span class="nw-alts-lab">albo</span>
      ${res.alts.map(a=>`<button class="nw-alt" onclick="swapTo('${a.id}','${level}')">
        ${esc(a.t)} <i>${a.min} min</i></button>`).join('')}
    </div>` : '';

  nowSwap(`
    <div class="kicker" style="color:${kolor}">🎯 Zrób teraz to jedno ${okno}</div>
    <div class="now-task-big">${esc(res.pick.t)}</div>
    <div class="now-why-big">Bo ${res.reason}</div>
    ${uwaga}
    ${inne}
  `,`
    <button class="btn btn-primary" onclick="nowStart()">Biorę się 🔥</button>
    <button class="btn btn-ghost" onclick="nowTooHard()">Za trudne teraz</button>
  `);
  setTimeout(()=>maxSpeak(line,false),350);
}

function addFromNow(){
  const el = document.getElementById('tkNew');
  const t = readUserText(el);   // A-9: skan kryzysowy
  if(!t) return;
  taskAdd(t, 'local');
  buzz(BUZZ.easier);
  const m = moodLoad(); const last = m[m.length-1];
  nowPick(eneLevel(last ? last.a : 50), last ? {v:last.v, e:last.a, t:last.ten} : null);
}

function swapTo(id, level){
  const t = taskById(id); if(!t) return;
  nowCurrent = t;
  taskPatch(id, {offered:(t.offered||0)+1, lastOffer:Date.now()});
  buzz(BUZZ.easier);
  const el = document.querySelector('.now-task-big');
  if(el) el.textContent = t.t;
  const why = document.querySelector('.now-why-big');
  if(why) why.textContent = 'Dobra, bierzemy to.';
  document.querySelectorAll('.nw-alt').forEach(b=>b.remove());
  const lab = document.querySelector('.nw-alts-lab'); if(lab) lab.remove();
}

/* Nagroda za START, nie za ukończenie. To jest cała różnica wobec
   reszty rynku: liczymy `started`, nie `done`. Zadanie zaczęte i
   porzucone jest sukcesem, bo rozruch był problemem. */
function nowStart(){
  buzz(BUZZ.enter);
  const t = nowCurrent;
  if(t && t.id) taskPatch(t.id, {started:(t.started||0)+1, lastStart:Date.now()});
  exitNow();
  setTimeout(()=>{ startCrisisWithTask(t.t || t.task || 'to jedno'); }, 500);
}

/* „Za trudne teraz" nie schodzi po sztywnej drabinie low→mid→high,
   tylko szuka czegoś lżejszego W TEJ SAMEJ liście. Odrzucenie jest
   sygnałem o zadaniu, nie o człowieku — więc podbijamy jego dread. */
function nowTooHard(){
  buzz(BUZZ.easier);
  if(nowCurrent && nowCurrent.id){
    taskPatch(nowCurrent.id, {dread: Math.min(4,(nowCurrent.dread||2)+1), guessed:false});
  }
  const m = moodLoad(); const last = m[m.length-1];
  const st = last ? {v:last.v, e:Math.max(0,last.a-25), t:last.ten} : {v:50,e:20,t:50};
  const res = pickReal(st, FREE_WINDOW);

  if(!res || (nowCurrent && res.pick.id === nowCurrent.id)){
    nowSwap(`
      <div class="kicker" style="color:#f2a3a3">🎯 Najmniejszy krok</div>
      <div class="now-task-big">Otwórz to i popatrz. Nic więcej.</div>
      <div class="now-why-big">Nie musisz nic zrobić. Samo spojrzenie liczy się jako ruch.</div>
    `,`
      <button class="btn btn-primary" onclick="nowStart()">Biorę się 🔥</button>
      <button class="btn btn-ghost" onclick="exitNow()">Później</button>
    `);
    setTimeout(()=>maxSpeak('Dobra. To najmniejszy możliwy krok.',false),350);
    return;
  }
  nowPick(eneLevel(st.e), st);
  setTimeout(()=>maxSpeak('Jasne, weźmy coś lżejszego.',false),350);
}

