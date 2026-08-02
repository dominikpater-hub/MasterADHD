/* ============================================================
   WARSTWA ZADAŃ — v16
   ------------------------------------------------------------
   Powód istnienia: do v15 Max mówił „weź tę rzecz, którą odkładasz
   najdłużej". To nie jest zadanie, to jest opis problemu. Użytkownik
   nadal musiał sam wybrać, a wybieranie jest właśnie tą czynnością,
   która mu nie wychodzi.

   Od v16 „zrób to jedno" wskazuje KONKRETNĄ rzecz z listy użytkownika.

   Zasada nadrzędna: Max nigdy nie wymyśla zadania. Jeśli lista jest
   pusta, mówi wprost, że jest pusta, i prosi o jedną rzecz. Wymyślone
   zadanie brzmi jak porada z internetu i kosztuje zaufanie.

   Trzy źródła treści, w kolejności zaufania:
     1. lokalne zadania wpisane wprost          (zawsze, offline)
     2. zrzuty myśli awansowane na zadania      (zawsze, offline)
     3. Google Tasks                            (za zgodą, opcjonalnie)

   Kalendarz NIE jest źródłem zadań. Zgodnie z P-34 czytamy z niego
   wyłącznie metadane czasowe — po to, żeby wiedzieć ILE MASZ OKNA,
   nie po to, żeby wiedzieć, co w nim jest.
   ============================================================ */

const TASK_KEY  = 'masteradhd.tasks.v1';
const CONS_KEY  = 'masteradhd.consent.v1';
const BODY_KEY  = 'masteradhd.body.v1';

function taskLoad(){ try{ return JSON.parse(localStorage.getItem(TASK_KEY)) || []; }catch(e){ return []; } }
function taskSave(a){
  /* T-4: ukończone NIE mogą wypchnąć otwartych — open to jedyne źródło doboru.
     Trzymamy wszystkie otwarte + ostatnie 120 ukończonych, w oryginalnej kolejności.
     T-6: zapis przez saveGuarded (błąd pamięci nie ginie po cichu). */
  const doneKeep = new Set(a.filter(x=>x.done).slice(-120));
  const keep = a.filter(x=> !x.done || doneKeep.has(x));
  saveGuarded(TASK_KEY, JSON.stringify(keep));
}

/* Zgody. Wszystkie domyślnie WYŁĄCZONE (P-36, privacy by design).
   Cofnięcie jednym ruchem — patrz openConnect(). */
function consLoad(){
  try{ return Object.assign({gtasks:false, gcal:false, ai:false, body:false},
       JSON.parse(localStorage.getItem(CONS_KEY))||{}); }
  catch(e){ return {gtasks:false, gcal:false, ai:false, body:false}; }
}
function consSave(c){ try{ localStorage.setItem(CONS_KEY, JSON.stringify(c)); }catch(e){} }

/* ============================================================
   WZBOGACANIE ZADAŃ — HEURYSTYKI LOKALNE
   ------------------------------------------------------------
   Konkurencja (Orli, aidd) każe to robić modelowi w chmurze. My robimy
   to najpierw lokalnie, bo treść zadania nie musi opuszczać telefonu,
   żeby dało się zgadnąć, ile zajmie.

   Trzy wymiary, bo trzy wymiary ma check-in:
     min   — ile to zajmie (dopasowanie do okna)
     ene   — ile energii wymaga (dopasowanie do suwaka energii)
     dread — ile kosztuje wejście w to (dopasowanie do suwaka napięcia)

   „dread" to nie trudność. Telefon do urzędu bywa trywialny i zajmuje
   trzy minuty, a mimo to leży miesiącami. Odkładanie napędza opór przed
   startem, nie nakład pracy — i dlatego to osobna oś.
   ============================================================ */
const VERB_FAST = /\b(zadzwo|wy[śs][lł]|odpis|odpowie|potwierd|zap[łl]a|przele|kup|zam[óo]w|um[óo]w|zapisz si|anuluj|odwo[łl]a|podpis|wyrzu|podl(a|e)|wstaw|w[łl][ąa]cz|napij|przewietrz)/i;
const VERB_MID  = /\b(napis|przygot|ogarn|posprz[ąa]t|zr[óo]b|wype[łl]ni|uporz[ąa]dk|przejrz|sprawd[źz]|spakow|spakuj|ugot|umy|poukr|zbier)/i;
const VERB_SLOW = /\b(doko[ńn]cz|przerob|przeanaliz|zaplan|nau(cz|k)|opracow|przepis|zaprojekt|policz|rozlicz|raport|projekt|prezentacj|remont|ogarn[ąa][ćc] ca)/i;
const DREAD_HI  = /\b(urz[ąa]d|skarbow|zus|pit|podat|rozlicz|faktur|windyk|komorni|s[ąa]d|prawni|reklamacj|odwo[łl]anie|umow|wypowiedzen|rozmow[ea] z|szef|lekarz|dentyst|przychodni|badani|wynik|d[łl]ug|kredyt|bank|ubezpiecz)/i;
const DREAD_LO  = /\b(podl(a|e)|wyrzu|umy|posprz[ąa]t|spacer|woda|napij|przewietr|po[śs]ciel|kwiat)/i;

/* Zwraca metadane zgadnięte z samego tytułu. Nic nie wychodzi z urządzenia. */
function guessMeta(title){
  const s = (title||'').toLowerCase();
  let min = 25, ene = 'mid', dread = 2, why = 'średnia rzecz';

  if(VERB_SLOW.test(s)){ min = 60; ene = 'high'; why = 'to wygląda na dłuższą robotę'; }
  else if(VERB_FAST.test(s)){ min = 8;  ene = 'low';  why = 'to wygląda na krótką rzecz'; }
  else if(VERB_MID.test(s)){ min = 25; ene = 'mid';  why = 'średnia rzecz'; }

  if(DREAD_HI.test(s)){ dread = 4; }
  else if(DREAD_LO.test(s)){ dread = 1; }

  /* Bardzo długi tytuł = zwykle sklejone kilka rzeczy w jedną. */
  if((title||'').length > 70){ min = Math.max(min, 45); ene = 'high'; }

  return {min, ene, dread, why, guessed:true};
}

/* Dodanie zadania. Metadane zgadujemy od razu, żeby użytkownik nie
   musiał wypełniać formularza — to główny powód, dla którego ludzie
   porzucają Motion i Todoist. */
function taskAdd(title, src){
  const t = (title||'').trim();
  if(!t) return null;
  const arr = taskLoad();
  const meta = guessMeta(t);
  const row = { id:'t'+Date.now()+Math.floor(Math.random()*999), t:t, src:src||'local',
                min:meta.min, ene:meta.ene, dread:meta.dread, guessed:true,
                added:Date.now(), started:0, done:false, offered:0, lastOffer:0 };
  arr.push(row); taskSave(arr);
  return row;
}
function taskById(id){ return taskLoad().find(x=>x.id===id) || null; }
function taskPatch(id, patch){
  const arr = taskLoad(); const i = arr.findIndex(x=>x.id===id);
  if(i<0) return; Object.assign(arr[i], patch); taskSave(arr);
}
function tasksOpen(){ return taskLoad().filter(x=>!x.done); }

/* ============================================================
   DOBÓR — TU SIEDZI CAŁA PRZEWAGA
   ------------------------------------------------------------
   Konkurencja pyta wprost „jaka energia, 1–5?" (aidd) albo czyta ją
   z opaski (Lifestack, Focuzed). My mamy trzy osie z check-inu, więc
   dobieramy dokładniej — a przede wszystkim mamy NAPIĘCIE, którego
   nie ma nikt.

   Reguła, która z tego wynika i której nie da się wyprowadzić z samej
   energii: przy wysokim napięciu odpadają rzeczy o dużym dread,
   NAWET jeśli energii jest dużo. Nakręcony człowiek nie zadzwoni do
   urzędu. Zrobi za to porządek w szufladzie.
   ============================================================ */
const ENE_VAL = {low:1, mid:2, high:3};

function scoreTask(task, st, windowMin){
  const uEne = st.e <= 33 ? 1 : st.e <= 66 ? 2 : 3;   /* 0–100 → 1–3 */
  let s = 100;

  /* 1. Dopasowanie energii. Zadanie cięższe niż stan boli mocniej
        niż zadanie lżejsze — dlatego kara asymetryczna. */
  const d = ENE_VAL[task.ene] - uEne;
  s -= d > 0 ? d * 34 : Math.abs(d) * 9;

  /* 2. Napięcie kontra opór przed wejściem — funkcja CIĄGŁA (A-4).
        Progi 60/30 działały tylko na skrajnościach, a suwak startuje na 50,
        więc oś napięcia — wyróżnik produktu — była martwa w stanie domyślnym.
        Teraz: zero przy 40, symetrycznie w obie strony. Wysokie napięcie tłumi
        dread (nakręcony nie zadzwoni do urzędu); niskie napięcie sprzyja wejściu
        w trudne (spokój to dobry moment na tę rozmowę). */
  s -= task.dread * (st.t - 40) * 0.4;

  /* 3. Okno czasowe z kalendarza, jeśli jest. Nie proponujemy
        godzinnej rzeczy przed spotkaniem za 20 minut. */
  if(windowMin && task.min > windowMin) s -= 45;
  if(windowMin && task.min <= windowMin * 0.6) s += 8;

  /* 4. Świeżość — to samo zadanie odrzucone trzy razy z rzędu
        przestaje być propozycją, a zaczyna być wyrzutem. */
  const dni = (Date.now() - (task.lastOffer||0)) / 86400000;
  if(task.offered > 0 && dni < 1) s -= task.offered * 12;

  /* 5. Rzecz zaczęta wcześniej i nieskończona ma pierwszeństwo —
        wracanie jest tańsze niż zaczynanie. */
  if(task.started > 0) s += 14;

  /* 6. Wiek. Coś, co leży trzeci tydzień, ma delikatny priorytet,
        ale bez presji — 12 punktów, nie 50. */
  const wiek = (Date.now() - task.added) / 86400000;
  s += Math.min(wiek, 21) * 0.6;

  return s;
}

/* Zwraca {pick, alts, reason} albo null, gdy nie ma z czego wybierać. */
function pickReal(st, windowMin){
  const open = tasksOpen();
  if(!open.length) return null;
  const ranked = open
    .map(t => ({t, s: scoreTask(t, st, windowMin)}))
    .sort((a,b) => b.s - a.s);
  return {
    pick: ranked[0].t,
    alts: ranked.slice(1,3).map(r=>r.t),
    reason: explainPick(ranked[0].t, st, windowMin)
  };
}

/* Uzasadnienie w formacie „jeśli-to" — implementation intentions,
   d=0,65 (Gollwitzer & Sheeran 2006). Max mówi, DLACZEGO ta rzecz,
   bo dobór bez uzasadnienia brzmi jak losowanie. */
function explainPick(task, st, windowMin){
  const parts = [];
  if(st.e <= 33 && task.ene === 'low') parts.push('energii jest mało, a to rzecz na kilka minut');
  else if(st.e >= 67 && task.ene === 'high') parts.push('masz moc, więc bierzemy najcięższe');
  else if(task.ene === 'mid') parts.push('to średnia rzecz, w sam raz na teraz');
  else parts.push('to pasuje do tego, jak masz');

  if(st.t >= 50 && task.dread <= 2) parts.push('i nie wymaga zbierania się');
  if(windowMin && task.min <= windowMin) parts.push(`zmieścisz to w ${windowMin} min do następnej rzeczy`);
  if(task.started > 0) parts.push('a to już się zaczęło, więc wracasz, nie ruszasz od zera');

  return parts.join(', ') + '.';
}

/* ============================================================
   EKRAN „TWOJE RZECZY"
   ============================================================ */
function openTasks(){
  markTool('tasks');
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  renderTasks();
}

function renderTasks(){
  const open = tasksOpen();
  const dumps = dumpLoad().filter(d => !d.promoted).slice(-6).reverse();

  const lista = open.length ? open.map(t=>`
    <div class="tk-row">
      <button class="tk-main" onclick="taskDetail('${t.id}')">
        <span class="tk-t">${esc(t.t)}</span>
        <span class="tk-meta">${t.min} min · ${eneWord(t.ene)}${t.guessed?' · zgadnięte':''}</span>
      </button>
      <button class="tk-x" onclick="taskDone('${t.id}')" aria-label="Zrobione">✓</button>
    </div>`).join('') : `
    <div class="tk-empty">
      <b>Lista jest pusta.</b>
      Dopóki nic tu nie ma, nie wskażę Ci konkretnej rzeczy — a wymyślać nie będę.
    </div>`;

  /* Zrzuty myśli to gotowe źródło zadań, które już zbieracie.
     Awans jednym dotknięciem — bez przepisywania. */
  const zdumpu = dumps.length ? `
    <div class="tk-sec">Z Twoich zrzutów myśli</div>
    ${dumps.map((d,i)=>`
      <button class="tk-prom" onclick="promoteDump(${d.t})">
        <span>${esc((d.text||'').slice(0,80))}</span><i>+ zrób z tego zadanie</i>
      </button>`).join('')}` : '';

  nowSwap(`
    <div class="kicker">Twoje rzeczy · ${open.length}</div>
    <div class="max-line" style="margin-bottom:6px">To, z czego wybieram</div>
    <div class="now-why-big" style="margin-bottom:16px">Wpisuj krótko, tak jak myślisz. Resztę zgadnę sam.</div>

    <div class="tk-add">
      <input id="tkNew" class="tk-in" type="text" placeholder="np. zadzwonić do przychodni"
             onkeydown="if(event.key==='Enter')addTaskUI()">
      <button class="tk-go" onclick="addTaskUI()">Dodaj</button>
    </div>
    <div class="footnote" style="text-align:left;margin:-6px 0 12px">
      <button class="btn-text" onclick="openPasteList()">albo wklej całą listę naraz →</button>
    </div>

    ${lista}
    ${zdumpu}
  `,`
    <button class="btn btn-primary" onclick="exitNow()">Gotowe</button>
    <div class="footnote"><button class="btn-text" onclick="openConnect()">Połączenia i zgody</button></div>
  `);
}

function esc(s){ return (s||'').replace(/[<>&"'`]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;','`':'&#96;'}[c])); }  /* S-15: też ' i ` (atrybuty w apostrofach) */
function eneWord(e){ return e==='low'?'lekkie':e==='high'?'ciężkie':'średnie'; }

function addTaskUI(){
  const el = document.getElementById('tkNew');
  const t = readUserText(el);   // A-9: skan kryzysowy na każdym polu tekstowym
  if(!t) return;                 // puste albo trafienie kryzysowe (openSafety już zadziałał)
  taskAdd(t, 'local');
  el.value = '';
  buzz(BUZZ.easier);
  renderTasks();
}

/* C-6 / share target: tekst udostępniony z DOWOLNEJ aplikacji (przeglądarka,
   notatki, mail) wpada wprost jako zadanie. Nośnik: manifest share_target (GET)
   → aplikacja startuje z ?text=… . Skan kryzysowy przed zapisem (A-9).
   Zwraca 'crisis' | 'added' | false. */
function handleShareTarget(){
  try{
    const q = new URLSearchParams(location.search);
    const shared = [q.get('title'), q.get('text'), q.get('url')].map(x=>x||'').join(' ').trim();
    if(!shared) return false;
    history.replaceState(null, '', location.pathname);   // wyczyść URL po odczycie
    if(typeof scanCrisis==='function' && scanCrisis(shared)){ openSafety(); return 'crisis'; }
    taskAdd(shared.slice(0,120), 'share');
    return 'added';
  }catch(e){ return false; }
}

/* C-6: najszybsze wejście danych — jedno pole, wiele linii. Osoba z ADHD i tak
   ma listę rozsypaną gdzie indziej; parsujemy po liniach, zamiast kazać wypełniać
   dziesięć formularzy. Skan kryzysowy (A-9) na całości przed zapisem. */
function openPasteList(){
  markTool('tasks');
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  nowSwap(`
    <div class="kicker">Wklej listę</div>
    <div class="max-line" style="margin-bottom:6px">Wrzuć wszystko naraz</div>
    <div class="now-why-big" style="margin-bottom:12px">Każda linia = jedno zadanie. Skopiuj skądkolwiek, ja rozdzielę i zgadnę resztę.</div>
    <textarea class="dump-input" id="pasteBox" rows="7"
      placeholder="zadzwonić do przychodni&#10;odpisać Kasi&#10;zapłacić za prąd&#10;wynieść śmieci"></textarea>
  `,`
    <button class="btn btn-primary" onclick="addPastedList()">Dodaj wszystkie</button>
    <div class="footnote"><button class="btn-text" onclick="openTasks()">Wróć</button></div>
  `);
  setTimeout(()=>{ const i=document.getElementById('pasteBox'); if(i) i.focus(); },350);
}
function addPastedList(){
  const el = document.getElementById('pasteBox');
  const blob = readUserText(el);   // A-9: skan kryzysowy na całości
  if(blob === null) return;         // trafienie → openSafety pokazał wsparcie
  const lines = (blob || '').split('\n').map(s=>s.trim()).filter(Boolean);
  lines.forEach(line => { taskAdd(line, 'paste'); });
  buzz(BUZZ.done);
  openTasks();                      // wróć do listy — zadania już tam są
}

function promoteDump(ts){
  const arr = dumpLoad();
  const i = arr.findIndex(d=>d.t===ts);
  if(i<0) return;
  const row = taskAdd(arr[i].text, 'dump');
  if(!row) return;                       // pole puste/nieprawidłowe → nie gubimy wpisu
  arr[i].promoted = true; dumpSave(arr);
  buzz(BUZZ.easier);
  renderTasks();
}

function taskDone(id){
  taskPatch(id, {done:true, doneAt:Date.now()});
  buzz(BUZZ.enter);
  renderTasks();
}

/* Szczegół zadania — tu użytkownik może poprawić to, co Max zgadł.
   Pytamy RAZ i zapamiętujemy, zamiast wymagać formularza przy dodawaniu. */
function taskDetail(id){
  const t = taskById(id); if(!t) return;
  nowSwap(`
    <div class="kicker">Jedna rzecz</div>
    <div class="now-task-big" style="font-size:22px">${esc(t.t)}</div>
    <div class="now-why-big" style="margin-bottom:14px">
      ${t.guessed ? 'Zgadłem te dwie rzeczy z samej nazwy. Popraw, jeśli pudło — zapamiętam.' : 'Ustawione przez Ciebie.'}
    </div>

    <div class="tk-pick"><span class="tk-lab">Ile zajmie</span>
      <div class="tk-opts">
        ${[5,15,30,60,120].map(m=>`<button class="tk-opt ${t.min===m?'on':''}"
          onclick="setMin('${id}',${m})">${m<60?m+' min':(m/60)+' h'}</button>`).join('')}
      </div>
    </div>

    <div class="tk-pick"><span class="tk-lab">Ile trzeba się zebrać</span>
      <div class="tk-opts">
        ${[[1,'wcale'],[2,'trochę'],[3,'sporo'],[4,'bardzo']].map(([v,n])=>`
          <button class="tk-opt ${t.dread===v?'on':''}" onclick="setDread('${id}',${v})">${n}</button>`).join('')}
      </div>
    </div>
  `,`
    <button class="btn btn-primary" onclick="renderTasks()">Zapisz</button>
    <div class="footnote"><button class="btn-text" onclick="taskDrop('${id}')">Usuń to zadanie</button></div>
  `);
}
function setMin(id,m){
  const ene = m<=10?'low':m<=45?'mid':'high';
  taskPatch(id,{min:m, ene:ene, guessed:false}); taskDetail(id);
}
function setDread(id,v){ taskPatch(id,{dread:v, guessed:false}); taskDetail(id); }
function taskDrop(id){
  const arr = taskLoad().filter(x=>x.id!==id); taskSave(arr); renderTasks();
}

