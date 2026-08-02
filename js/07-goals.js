/* ============================================================
   CELE / PROFIL — co użytkownik chce osiągnąć.
   Trzy pytania, wszystkie opcjonalne. Max pyta raz, przy pierwszym wejściu,
   i potem można wrócić z ekranu głównego.
   ============================================================ */
const CELE = {
  start:   { ico:'🚀', txt:'Zacząć to, co odkładam' },
  emocje:  { ico:'💗', txt:'Ogarnąć emocje' },
  rytm:    { ico:'🔁', txt:'Złapać jakiś rytm' },
  siebie:  { ico:'🪞', txt:'Zrozumieć siebie' }
};

function openProfile(first){
  markTool('profile');
  const p = profLoad();
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  nowSwap(`
    <div class="kicker">${first ? 'Zanim zaczniemy' : 'Twój profil'}</div>
    <div class="max-line" style="margin-bottom:6px">Jak mam się do Ciebie zwracać?</div>
    <div class="now-why-big" style="margin-bottom:18px">Wszystko opcjonalne. Możesz pominąć i wrócić kiedy chcesz.</div>

    <input class="task-input" id="pfName" type="text" maxlength="24"
      placeholder="imię (opcjonalnie)" value="${(p.name||'').replace(/"/g,'&quot;')}">

    <div class="pf-sec">Formy, których mam używać</div>
    <div class="pf-opts">
      <button class="pf-opt${p.gender==='f'?' on':''}"   onclick="pickGender('f')">zrobiłaś</button>
      <button class="pf-opt${p.gender==='m'?' on':''}"   onclick="pickGender('m')">zrobiłeś</button>
      <button class="pf-opt${p.gender==='n'?' on':''}"   onclick="pickGender('n')">neutralnie</button>
      <button class="pf-opt${p.gender==='own'?' on':''}" onclick="pickGender('own')">własne</button>
    </div>
    <div class="pf-own" id="pfOwn" style="display:${p.gender==='own'?'block':'none'}">
      <input class="task-input" id="pfOwnVal" type="text" maxlength="20"
        placeholder="np. zrobiłoś" value="${((p.forms&&p.forms.zrobiles)||'').replace(/"/g,'&quot;')}">
      <div class="pf-hint">Forma czasu przeszłego (np. „zrobiłoś").</div>
      <input class="task-input" id="pfOwnAdj" type="text" maxlength="20" style="margin-top:8px"
        placeholder="np. gotowe" value="${((p.forms&&p.forms.gotowy)||'').replace(/"/g,'&quot;')}">
      <div class="pf-hint">Forma przymiotnika (np. „gotowe") — żeby nie było „gotowś".</div>
    </div>

    <div class="pf-sec">Po co tu jesteś?</div>
    <div class="pf-opts">
      ${Object.keys(CELE).map(k=>`<button class="pf-opt${p.goal===k?' on':''}"
        onclick="pickGoal('${k}')">${CELE[k].ico} ${CELE[k].txt}</button>`).join('')}
    </div>
  `,`
    <button class="btn btn-primary" onclick="saveProfile()">Zapisz</button>
    <div class="footnote"><button class="btn-text" onclick="exitNow()">${first?'Pomiń':'Anuluj'}</button></div>
  `);
  setTimeout(()=>maxSpeak('Jak mam się do Ciebie zwracać? Wszystko opcjonalne.',false),400);
}

let pfG = null, pfGoal = null;
function pickGender(g){
  pfG = g; buzz(BUZZ.easier);
  document.querySelectorAll('.pf-opts')[0].querySelectorAll('.pf-opt')
    .forEach((b,i)=>b.classList.toggle('on', ['f','m','n','own'][i] === g));
  const own = document.getElementById('pfOwn');
  if(own) own.style.display = (g === 'own') ? 'block' : 'none';
}
function pickGoal(k){
  pfGoal = k; buzz(BUZZ.easier);
  const keys = Object.keys(CELE);
  document.querySelectorAll('.pf-opts')[1].querySelectorAll('.pf-opt')
    .forEach((b,i)=>b.classList.toggle('on', keys[i] === k));
}

function saveProfile(){
  const p = profLoad();
  const n  = document.getElementById('pfName');
  const ov = document.getElementById('pfOwnVal');
  const av = document.getElementById('pfOwnAdj');
  if(n) p.name = n.value.trim() || null;
  if(pfG) p.gender = pfG;
  if(pfGoal) p.goal = pfGoal;
  if(p.gender === 'own' && ov && ov.value.trim()){
    /* T-5: czasowniki wyprowadzamy z końcówki (to działa: stał+oś, ruszył+oś…),
       ale przymiotnika „gotowy" i zaimka „sam" NIE — pytamy o formę przymiotnika
       osobno, żeby nie powstawały nie-słowa „gotowś/samś". */
    const w = ov.value.trim();
    const konc = w.slice(-2);
    const adj = (av && av.value.trim()) ? av.value.trim() : '';
    const ae = adj.slice(-1);
    const sam = ae==='a' ? 'sama' : ae==='y' ? 'sam' : ae ? 'samo' : 'samodzielnie';
    p.forms = { zrobiles:w, stales:'stał'+konc, ruszyles:'ruszył'+konc,
                pokazales:'pokazał'+konc, wrociles:'wrócił'+konc,
                gotowy: adj || 'gotowi', sam };
  }
  profSave(p);
  buzz(BUZZ.done);
  const pow = p.name ? `Dzięki, ${p.name}.` : 'Zapisane.';
  nowSwap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line" style="margin-bottom:8px">${pow}</div>
    <div class="now-why-big">Będę o tym pamiętał. Możesz to zmienić w każdej chwili.</div>
  `,`
    <button class="btn btn-primary" onclick="exitNow()">Lecimy</button>
  `);
  setTimeout(()=>maxSpeak(pow + ' Będę o tym pamiętał.',false),350);
}

/* ============================================================
   MOTYWACJA DO REGULARNOŚCI — dwa mechanizmy równolegle
   1. KOMPLETNOŚĆ MAPY: „jeszcze 6 wpisów i pokażę Ci X" — działa na
      ciekawość i kompetencję (SDT), nie na lęk przed utratą.
   2. LICZNIK DNI: suma dni razem, wybaczający. Przerwa nie cofa —
      po prostu nie posuwa (Lally 2010: pominięty dzień nie łamie krzywej).
   Świadomie NIE budujemy zerującego się streaka: karałby najmocniej tych,
   którzy najczęściej opuszczą dzień, czyli naszą grupę docelową.
   ============================================================ */
/* Ile punktów danych łącznie — TYLKO źródła, które realnie karmią mapę.
   UWAGA: sesji kroków tu NIE liczymy. „0 zapisów · 1 dzień razem" to nie
   sprzeczność, tylko informacja: byłeś, ale nic nie zostawiłeś dla mapy.
   Dni i zapisy mierzą co innego i mają się rozjeżdżać — to jest sygnał,
   a nie błąd. Wliczenie sesji rozmyłoby obietnicę „jeszcze N wpisów
   i pokażę Ci wzorce", bo część tych wpisów nie niosłaby danych. */
function dataCount(){
  const m = memLoad();
  return ((m && m.map) ? m.map.length : 0) + dumpLoad().length + moodLoad().length;
}
/* Następny próg albo null, gdy wszystkie osiągnięte. */
function nextProg(){
  const n = dataCount();
  return PROGI.find(p => n < p.n) || null;
}

function renderProgress(){
  const el = document.getElementById('progBox');
  if(!el) return;
  const m    = memLoad();
  const dni  = (m && m.days) ? m.days.length : 0;
  const n    = dataCount();
  const next = nextProg();

  if(!next){
    el.innerHTML = `<div class="pg-line"><b>${n}</b> zapisów · <b>${dni}</b> ${dni===1?'dzień':'dni'} razem</div>
      <div class="pg-sub">Mapa jest pełna. Każdy kolejny wpis ją tylko wyostrza.</div>`;
    return;
  }

  /* Rozjazd dni vs zapisy to użyteczny sygnał: bywasz, ale nic nie zostawiasz.
     Max mówi o tym wprost — bez wyrzutów, jako zaproszenie. */
  if(n === 0 && dni > 0){
    el.innerHTML = `
      <div class="pg-line"><b>0</b> zapisów · <b>${dni}</b> ${dni===1?'dzień':'dni'} razem</div>
      <div class="pg-bar"><i style="width:0%"></i></div>
      <div class="pg-sub">Bywasz tu, ale mapa jest jeszcze pusta.
        Wystarczy <b>jeden</b> wpis, żeby zaczęła się rysować.</div>`;
    return;
  }
  const brak = next.n - n;
  const proc = Math.round(n / next.n * 100);
  el.innerHTML = `
    <div class="pg-line"><b>${n}</b> zapisów · <b>${dni}</b> ${dni===1?'dzień':'dni'} razem</div>
    <div class="pg-bar"><i style="width:${Math.min(proc,100)}%"></i></div>
    <div class="pg-sub">Jeszcze <b>${brak}</b> ${brak===1?'wpis':'wpisów'}, a pokażę Ci ${next.co}.</div>`;
}

/* ============================================================
   PLANY JEŚLI-TO (implementation intentions)
   Najmocniej udokumentowana technika w całym researchu:
   Gollwitzer & Sheeran (2006), d≈0.65 na 94 testach; aktualizacja 2024 —
   642 testy. Format „JEŚLI [sytuacja], TO [ruch]" pre-ładuje połączenie
   bodziec→reakcja, więc w momencie utknięcia nie trzeba decydować.

   RÓŻNICA WOBEC SILNIKA: to jest reguła UŻYTKOWNIKA, nie produktu.
   Przy kolejnym utknięciu Max najpierw pokazuje jego własny plan,
   dopiero potem swoją propozycję. Z czasem Max mówi coraz mniej.
   ============================================================ */
const RULES_KEY = 'masteradhd.rules.v1';
function rulesLoad(){ try{ return JSON.parse(localStorage.getItem(RULES_KEY))||[]; }catch(e){ return []; } }
function rulesSave(a){ try{ localStorage.setItem(RULES_KEY, JSON.stringify(a.slice(-40))); }catch(e){} }

/* Czy mamy plan pasujący do bieżącego stanu (miejsce + poziom energii)? */
function findRule(place, level){
  const rs = rulesLoad();
  return rs.find(r => r.place === place && r.level === level)
      || rs.find(r => r.place === place)
      || null;
}

/* Propozycja planu po ukończeniu sesji — moment, w którym użytkownik
   właśnie doświadczył, co zadziałało. Najlepszy czas na zapis reguły. */
function offerRule(){
  const m = memLoad() || {};
  const place = m.lastPlace || 'away';
  const opisM = { desk:'siedzę przy biurku', couch:'siedzę na kanapie',
                  bed:'leżę w łóżku', away:'jestem w ruchu' }[place];
  const krok = (steps && steps[0]) ? steps[0].word : 'zrobię najmniejszy ruch';
  nowSwap(`
    <div class="kicker">Zapiszmy to sobie</div>
    <div class="max-line" style="margin-bottom:10px">Plan na następny raz</div>
    <div class="rule-card">
      <div class="rule-if">JEŚLI utknę i <b>${opisM}</b></div>
      <div class="rule-then">TO <b>${krok.toLowerCase().replace(/\.$/,'')}</b></div>
    </div>
    <div class="now-why-big" style="margin-top:12px">Następnym razem przypomnę Ci to, zanim cokolwiek zaproponuję.</div>
  `,`
    <button class="btn btn-primary" onclick="saveRule('${place}','${krok.replace(/'/g,"\\'")}')">Zapisz plan</button>
    <div class="footnote"><button class="btn-text" onclick="exitCrisis()">Nie teraz</button></div>
  `);
  setTimeout(()=>maxSpeak('Zapiszmy plan na następny raz. Przypomnę Ci go, zanim cokolwiek zaproponuję.',false),400);
}

function saveRule(place, krok){
  const m = memLoad() || {};
  const rs = rulesLoad();
  const lvl = m.lastLevel || 'mid';
  /* Nadpisujemy plan dla tej samej pary miejsce+energia, nie mnożymy duplikatów. */
  const i = rs.findIndex(r => r.place === place && r.level === lvl);
  const rule = { place, level:lvl, then:krok, t:Date.now(), used:0 };
  if(i >= 0) rs[i] = rule; else rs.push(rule);
  rulesSave(rs);
  buzz(BUZZ.done);
  nowSwap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line" style="margin-bottom:8px">Zapisane.</div>
    <div class="now-why-big">Masz teraz ${rs.length} ${rs.length===1?'plan':'planów'}. Im więcej ich znasz, tym mniej mnie potrzebujesz.</div>
  `,`
    <button class="btn btn-primary" onclick="exitCrisis()">Lecimy</button>
  `);
  setTimeout(()=>maxSpeak('Zapisane. Im więcej takich planów znasz, tym mniej mnie potrzebujesz.',false),350);
}

function startCrisis(){
  markTool('steps');
  buzz(BUZZ.enter);
  if(dots) dots.style.display='';   // przywróć kropki (mogły być ukryte przez ekran wsparcia)
  idx=0; breakdownGiven={};
  sessionTask=''; aiState='idle';   // czysty start, bez śladów poprzedniej sesji
  crisis.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>crisis.classList.add('vis')));
  sceneWhere();
}

/* ===== KONTEKST: Max pyta GDZIE jesteś, zanim powie co robić =====
   Bez tego kroki były ślepe — „wstań i podejdź do biurka" nawet komuś,
   kto jest pod prysznicem albo w autobusie. */
function sceneWhere(){
  setDots(0);
  const line='Zanim ruszymy — gdzie teraz jesteś? Dobiorę kroki do miejsca.';
  swap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line"><b>Gdzie teraz jesteś?</b><br>Dobiorę kroki do miejsca.</div>
  `,`
    <button class="btn btn-primary" onclick="pickPlace('desk')">Przy biurku 💻</button>
    <button class="btn btn-primary" onclick="pickPlace('couch')">Na kanapie 🛋️</button>
    <button class="btn btn-primary" onclick="pickPlace('bed')">W łóżku 🛏️</button>
    <button class="btn btn-primary" onclick="pickPlace('away')">Gdzie indziej 🚶</button>
  `);
  setTimeout(()=>maxSpeak(line,false),400);
}

function pickPlace(place){
  buzz(BUZZ.easier);
  steps = JSON.parse(JSON.stringify(STEP_SETS[place] || STEP_SETS.desk));
  const m = memLoad() || {}; m.lastPlace = place; memSave(m);
  /* Najpierw WŁASNY plan użytkownika, dopiero potem propozycja Maxa.
     To jest cel całej mechaniki: Max ma z czasem mówić coraz mniej. */
  const r = findRule(place, m.lastLevel || 'mid');
  if(r){ showOwnRule(r); return; }
  sceneWhatTask();
}

/* Przypomnienie planu — użytkownik decyduje, czy z niego korzysta. */
function showOwnRule(r){
  const opis = { desk:'siedzisz przy biurku', couch:'siedzisz na kanapie',
                 bed:'leżysz w łóżku', away:'jesteś w ruchu' }[r.place] || 'utykasz';
  swap(`
    <div class="kicker">Twój własny plan</div>
    <div class="max-line" style="margin-bottom:12px">Masz to już zapisane</div>
    <div class="rule-card">
      <div class="rule-if">JEŚLI utykasz i <b>${opis}</b></div>
      <div class="rule-then">TO <b>${r.then.toLowerCase().replace(/\.$/,'')}</b></div>
    </div>
  `,`
    <button class="btn btn-primary" onclick="useOwnRule()">Robię to</button>
    <button class="btn btn-ghost" onclick="sceneWhatTask()">Dziś inaczej</button>
  `);
  setTimeout(()=>maxSpeak('Masz to już zapisane. Robisz po swojemu?',false),400);
}

function useOwnRule(){
  const m = memLoad() || {};
  const r = findRule(m.lastPlace || 'away', m.lastLevel || 'mid');
  if(r){ const rs = rulesLoad();
    const i = rs.findIndex(x=>x.place===r.place && x.level===r.level);
    if(i>=0){ rs[i].used = (rs[i].used||0)+1; rulesSave(rs); } }
  buzz(BUZZ.done);
  sceneStart();
}

/* ===== KONTEKST DLA AI: co konkretnie stoi =====
   Max nie ma dostępu do skrzynki ani kalendarza — pyta wprost.
   Pole jest opcjonalne: pominięcie zostawia kroki deterministyczne. */
function sceneWhatTask(){
  const m = memLoad();
  const last = (m && m.lastTask) ? m.lastTask : '';
  const line='Nad czym dziś stoisz? Możesz pominąć — poprowadzę i tak.';
  swap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line" style="margin-bottom:16px"><b>Nad czym stoisz?</b><br>Dopasuję kroki. Możesz pominąć.</div>
    <input class="task-input" id="taskInput" type="text" maxlength="90"
      placeholder="np. mail do klienta, sprzątanie kuchni…"
      value="${last.replace(/"/g,'&quot;')}"
      onkeydown="if(event.key==='Enter')submitTask()">
  `,`
    <button class="btn btn-primary" onclick="submitTask()">Dalej</button>
    <div class="footnote"><button class="btn-text" onclick="submitTask(true)">Pomiń — po prostu prowadź</button></div>
  `);
  setTimeout(()=>{ maxSpeak(line,false); const i=document.getElementById('taskInput'); if(i) i.focus(); },400);
}

function submitTask(skip){
  const el = document.getElementById('taskInput');
  if(!skip){
    const t = readUserText(el);   // A-9: skan kryzysowy przed zapisem i przed LLM
    if(t === null) return;        // trafienie → openSafety pokazał wsparcie, nie idziemy dalej
    sessionTask = t;
  } else {
    sessionTask = '';
  }
  if(sessionTask){
    const m = memLoad() || {}; m.lastTask = sessionTask; memSave(m);
  }
  buzz(BUZZ.easier);
  if(sessionTask) tailorSteps();   // AI przeformułuje kroki pod zadanie
  sceneBreath();
}

/* Wejście z trybu TERAZ: kryzys niesie konkretne zadanie, od razu w kroki */
function startCrisisWithTask(task){
  /* Nie pytamy trzeci raz z rzędu — bierzemy ostatnio wskazane miejsce.
     Przy pierwszym użyciu (brak lastPlace) wpadamy w neutralny zestaw „gdzie indziej”,
     który nie zakłada, że użytkownik siedzi przy biurku. */
  const m = memLoad();
  const place = (m && m.lastPlace) ? m.lastPlace : 'away';
  steps = JSON.parse(JSON.stringify(STEP_SETS[place] || STEP_SETS.away));
  idx=0; breakdownGiven={}; sessionTask = task || ''; aiState='idle';
  crisis.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>crisis.classList.add('vis')));
  if(sessionTask) tailorSteps();   // zadanie znamy z trybu TERAZ — dopasuj kroki
  // krótki oddech, potem prosto w kroki (bez pytania „co robimy" — już wiemy)
  sceneBreathThenSteps();
}
function sceneBreathThenSteps(){
  setDots(0);
  const line='Dobra. Bierzemy: '+sessionTask+'. Jeden oddech i ruszamy.';
  swap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line fade-delay"><b>Bierzemy to.</b><br>Jeden oddech ze mną i ruszamy.</div>
  `,'');
  setTimeout(()=>maxSpeak(line,false),500);
  clearTimeout(window._bt);
  window._bt=setTimeout(beginSteps, 4200);
}
function exitCrisis(){
  if('speechSynthesis' in window) speechSynthesis.cancel();
  clearTimeout(window._peek); clearTimeout(window._bt);
  crisis.classList.remove('vis');
  setTimeout(()=>{crisis.classList.remove('show');stage.innerHTML='';actions.innerHTML='';setDots(-1)},460);
}

function setDots(active){
  const arr=dots.querySelectorAll('i');
  arr.forEach((d,i)=>{
    d.className='';
    if(active===99){d.className='done';return;}
    if(i<active)d.className='done';else if(i===active)d.className='on';
  });
}

function swap(html, actsHtml){
  const old=stage.querySelector('.scene.active');
  if(old){old.classList.remove('active');setTimeout(()=>old.remove(),450);}
  const s=document.createElement('div');
  s.className='scene';s.innerHTML=html;
  stage.appendChild(s);
  requestAnimationFrame(()=>requestAnimationFrame(()=>s.classList.add('active')));
  actions.innerHTML=actsHtml||'';
}

/* ===== SCENA 1: MAX + ODDECH ===== */
function sceneBreath(){
  setDots(0);
  /* Uczciwość zamiast udawania: jeśli AI nie odpowiedziało, Max mówi to wprost,
     zamiast cicho podać ogólne kroki i sprawiać wrażenie, że słuchał. */
  const off = (sessionTask && aiState==='offline');
  const line = off
    ? 'Jestem offline, więc poprowadzę Cię ogólnie — ale poprowadzę.'
    : 'Dobra. Jestem tu. Weź ze mną jeden oddech.';
  swap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line fade-delay">${off
      ? '<b>Jestem offline.</b><br>Poprowadzę Cię ogólnie — ale poprowadzę.'
      : '<b>Dobra. Jestem tu.</b><br>Weź ze mną jeden oddech.'}</div>
  `,'');
  setTimeout(()=>maxSpeak(line,false), 500);
  clearTimeout(window._bt);
  /* A-3: submitTask już zapytał o zadanie — drugie pytanie sprawiało, że Max
     wyglądał, jakby nie słuchał, i kasowało pierwszą odpowiedź. Prosto w kroki. */
  window._bt=setTimeout(beginSteps, 4600);
}

/* ===== KROKI ===== */
function beginSteps(){
  const f = document.getElementById('taskField');
  /* A-3: puste albo nieobecne pole NIE kasuje zadania podanego w submitTask. */
  if(f && f.value.trim()){
    sessionTask = f.value.trim();
    const m = memLoad() || {}; m.lastTask = sessionTask; memSave(m);
  }
  sessionHelped = '';
  idx=0;renderStep();
}
function renderStep(){
  const st=steps[idx];
  setDots(idx);
  const tag = st.somatic ? `<div class="kicker">Krok 1 · ciało, nie głowa</div>` : `<div class="kicker">Krok ${idx+1} z ${steps.length}</div>`;
  swap(`
    ${tag}
    <div class="step-word">${st.word}</div>
    <div class="step-hint">${st.hint}</div>
    ${(aiState==='ok' && sessionTask)
      ? `<div class="ai-tag">✦ dopasowane do: ${sessionTask}</div>` : ''}
    <div class="lightbar-wrap"><div class="lightbar" id="lbar"></div></div>
  `,`
    <button class="btn btn-done" onclick="stepDone()">Zrobione ✓</button>
    <div class="footnote"><button class="btn-text" onclick="tooHard()">To za trudne teraz</button></div>
  `);
  if(st.max) setTimeout(()=>maxSpeak(st.max,false),350);
  runLightbar();
}
function runLightbar(){
  const bar=document.getElementById('lbar');if(!bar)return;
  bar.style.transition='none';bar.style.transform='scaleX(1)';
  requestAnimationFrame(()=>{bar.style.transition='transform 45s linear';bar.style.transform='scaleX(0)';});
}
function stepDone(){buzz(BUZZ.done);idx++;if(idx>=steps.length)sceneStart();else renderStep();}
function tooHard(){
  buzz(BUZZ.easier);
  sessionHelped = 'breakdown';   // rozbicie kroku pomogło — Max to zapamięta
  const st=steps[idx];
  if(EASIER[st.word] && !breakdownGiven[idx]){
    steps[idx]=EASIER[st.word];breakdownGiven[idx]=true;renderStep();
  }else{
    steps[idx]={word:'Zrób z tego połowę.',hint:'Weź najmniejszy możliwy kawałek. Sam wybierz jaki.',
      max:'Bez stresu. Weź z tego najmniejszy kawałek, jaki dasz radę.'};
    renderStep();
  }
}

/* ===== MOMENT STARTU: Max odpala energię ===== */
function sceneStart(){
  buzz(BUZZ.start);
  // Max zapamiętuje tę sesję → następnym razem powita kontekstowo
  memRecord({ newSession:true, lastTask: sessionTask || undefined,
              lastHelped: sessionHelped || 'steps' });
  /* WARSTWA 1+2 — nagroda natychmiastowa, w tej samej sekundzie co ruch.
     Mózg ADHD stromo dyskontuje odroczone nagrody (delay discounting d=0.43,
     Jackson & MacKillop 2016) — więc zero punktów „do wydania później". */
  const _dni    = trackDay();
  const _m      = memLoad();
  const _starts = (_m && _m.starts) ? _m.starts : 1;
  setDots(99);
  const _pg = profLoad().gender;
  /* Neutralne nie odmienia się przez osobę — używamy bezosobowego okrzyku. */
  const _r  = (_pg==='n') ? 'ruszyło' : F('ruszyles');
  const _r1 = _r.charAt(0).toUpperCase()+_r.slice(1);
  const line=`${_r1}! Widzisz? Najtrudniejsze już za Tobą. No dawaj, teraz lecimy!`;
  swap(`
    <div class="spark-core"><div class="spark-ray"></div></div>
    <div class="maxName fired">Max</div>
    <div class="max-line"><b>${_r1}!</b><br>Najtrudniejsze już za Tobą. No dawaj!</div>
    <div class="start-badge">${_starts}. raz ${_r} mimo oporu · ${_dni} ${_dni===1?'dzień':'dni'} razem</div>
  `,`
    <button class="btn btn-fire" onclick="sceneBuddy()">Zostań ze mną 🔥</button>
    <button class="btn btn-ghost" onclick="sceneHandoff()">Poradzę sobie</button>
  `);
  setTimeout(()=>maxSpeak(line,true),300);
}

/* ===== CIĄGŁOŚĆ: Max nie znika w ciszy ===== */
function sceneHandoff(){
  const line='Spoko, działasz solo. Nie znikam — mam trzymać czas czy zostać obok?';
  swap(`
    <div class="max-orb" style="width:110px;height:110px;margin-bottom:20px"><div class="max-orb-core" style="width:60px;height:60px"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line"><b>Działasz solo — super.</b><br>Jestem tu, gdyby co.</div>
  `,`
    <button class="btn btn-primary" onclick="sceneBuddy()">Zostań obok 👤</button>
    <button class="btn btn-ghost" onclick="pingLater()">Trzymaj mi czas ⏱️</button>
    <div class="footnote"><button class="btn-text" onclick="exitCrisis()">Nie trzeba, dzięki</button></div>
  `);
  setTimeout(()=>maxSpeak(line,false),300);
}

/* ===== WARSTWA 4 — KOTWICA ZDARZENIOWA, NIE GODZINOWA =====
   Habit stacking + implementation intentions (Gollwitzer & Sheeran, d≈0.65):
   nawyk przypina się do istniejącego zdarzenia, nie do godziny na zegarze.
   „Po pierwszej kawie" działa lepiej niż „o 9:00", bo cue jest realny,
   a nie arbitralny — i nie wymaga pamiętania o czasie (time blindness). */
function pingLater(){
  buzz(BUZZ.easier);
  const m = memLoad();
  if(m && m.anchor){ pingConfirm(m.anchor); return; }
  const line='Jasne. A powiedz — kiedy zwykle utykasz? Nie o której. Po czym.';
  swap(`
    <div class="max-orb" style="width:100px;height:100px;margin-bottom:20px"><div class="max-orb-core" style="width:54px;height:54px"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line"><b>Kiedy zwykle utykasz?</b><br>Nie o której — <i>po czym</i>.</div>
  `,`
    <button class="btn btn-primary" onclick="saveAnchor('po pierwszej kawie')">Po pierwszej kawie ☕</button>
    <button class="btn btn-primary" onclick="saveAnchor('po otwarciu laptopa')">Po otwarciu laptopa 💻</button>
    <button class="btn btn-primary" onclick="saveAnchor('po powrocie do domu')">Po powrocie do domu 🏠</button>
    <div class="footnote"><button class="btn-text" onclick="pingConfirm(null)">Pomiń — po prostu trzymaj czas</button></div>
  `);
  setTimeout(()=>maxSpeak(line,false),300);
}

/* Zapis kotwicy = pierwsza połowa planu JEŚLI-TO.
   Max ma potem gotowe: „JEŚLI po kawie, TO check-in". */
function saveAnchor(a){
  const m = memLoad() || { sessions:0, created:Date.now() };
  m.anchor = a;
  memSave(m);
  buzz(BUZZ.done);
  pingConfirm(a);
}

function pingConfirm(anchor){
  const cap = anchor ? anchor.charAt(0).toUpperCase()+anchor.slice(1) : null;
  const linia = anchor
    ? `Zapamiętane. ${cap} — dobry moment, żeby tu wrócić. Teraz lecisz, ja trzymam czas.`
    : 'Trzymam czas. Wróć do mnie za jakieś 10 minut — będę tu.';
  swap(`
    <div class="max-orb" style="width:100px;height:100px;margin-bottom:20px"><div class="max-orb-core" style="width:54px;height:54px"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line"><b>Trzymam czas.</b><br>Wróć do mnie, kiedy zrobisz kawałek — będę tu.</div>
    ${anchor ? `<div class="start-badge">Kotwica: ${anchor} — wtedy do mnie wróć</div>` : ''}
  `,`
    <button class="btn btn-primary" onclick="armPingReminder()">Przypomnij mi za 10 min 🔔</button>
    <div class="footnote"><button class="btn-text" onclick="afterSession()">Nie trzeba — do zobaczenia</button></div>
  `);
  setTimeout(()=>maxSpeak(linia,false),300);
}

/* Po sesji: jeśli użytkownik nie ma jeszcze planu dla tego stanu,
   proponujemy zapis. Moment jest kluczowy — właśnie doświadczył,
   co zadziałało, więc reguła nie jest abstrakcyjna. */
function afterSession(){
  const m = memLoad() || {};
  const r = findRule(m.lastPlace || 'away', m.lastLevel || 'mid');
  if(r){ exitCrisis(); return; }
  offerRule();
}

/* ===== BODY DOUBLE: Max zostaje obok, aż skończysz ===== */
function sceneBuddy(){
  setDots(99);
  const line='Jestem obok. Rób swoje — jestem tu, kiedy tylko zerkniesz na ekran.';
  swap(`
    <div class="max-orb fired"><div class="max-orb-core"></div></div>
    <div class="maxName fired">Max jest obok</div>
    <div class="max-line"><b>Rób swoje.</b><br>Jestem obok — nie musisz nic mówić.</div>
    <div class="lightbar-wrap"><div class="lightbar" id="lbar"></div></div>
  `,`
    <button class="btn btn-done" onclick="buddyDone()">Skończyłem ✓</button>
    <div class="footnote"><button class="btn-text" onclick="exitCrisis()">Muszę lecieć</button></div>
  `);
  runLightbar();
  setTimeout(()=>playMax('buddy', line, false),300);
  clearTimeout(window._peek);
  window._peek = setTimeout(()=>{ maxSpeak('Jestem. Lecisz?',false); }, 12000);
}
/* Domknięcie sesji body-double — świętuje UKOŃCZENIE (rzadki moment: doszedł
   do końca), zapisuje ślad i wychodzi łagodnie. */
function buddyDone(){
  clearTimeout(window._peek);
  setDots(-1);
  buzz(BUZZ.done);
  memRecord({ lastHelped:'buddy' });
  trackDay();
  swap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line" style="margin-bottom:8px"><b>Zrobione.</b></div>
    <div class="now-why-big">Byłem obok, ale to Twoja robota. Zapamiętam, że dziś się udało — wróć, kiedy znów przyda Ci się towarzystwo.</div>
  `,`
    <button class="btn btn-primary" onclick="exitCrisis()">Wracam do siebie</button>
  `);
  setTimeout(()=>playMax('close','Zrobione. Byłem obok, ale to Twoja robota.',true),300);
}

