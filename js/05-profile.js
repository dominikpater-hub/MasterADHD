/* ============================================================
   PROFIL — FORMY GRAMATYCZNE
   Polszczyzna wymusza rodzaj w czasie przeszłym („stałeś" / „stałaś"),
   więc bez tego Max albo kogoś misgenderuje, albo brzmi urzędowo.
   Cztery tryby: f (żeńskie), m (męskie), n (neutralne/bezosobowe),
   own (własne formy wpisane przez użytkownika).
   Domyślnie 'n' — dopóki użytkownik nie powie, Max nie zakłada.
   ============================================================ */
const PROGI = [
  { n:5,  co:'przebieg Twojej energii w ciągu dnia' },
  { n:15, co:'pierwsze wzorce — pory dnia i to, co wraca' },
  { n:30, co:'różnicę między dniami tygodnia' },
  { n:60, co:'jak Twoje emocje zmieniają się w czasie' }
];

const PROFILE_KEY = 'masteradhd.profile.v1';
function profLoad(){
  try{ return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {gender:'n'}; }
  catch(e){ return {gender:'n'}; }
}
function profSave(p){ try{ localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }catch(e){} }

/* Słownik form. Neutralne używa konstrukcji bezosobowych — nie „stałxś",
   tylko przeformułowania, które po polsku brzmią naturalnie. */
const FORMS = {
  m: { stales:'stałeś', ruszyles:'ruszyłeś', gotowy:'gotowy', sam:'sam',
       zrobiles:'zrobiłeś', mogl:'mógłbyś', pokazales:'pokazałeś',
       wrociles:'wróciłeś', zaczales:'zacząłeś' },
  f: { stales:'stałaś', ruszyles:'ruszyłaś', gotowy:'gotowa', sam:'sama',
       zrobiles:'zrobiłaś', mogl:'mogłabyś', pokazales:'pokazałaś',
       wrociles:'wróciłaś', zaczales:'zaczęłaś' },
  /* Neutralne: konstrukcje bezosobowe. Uwaga — nie wolno tu wstawiać form
     typu „było", bo zmieniają podmiot zdania („Ostatnio było nad X" jest
     niegramatyczne). Każda forma musi działać w zdaniu, w którym jej używamy. */
  n: { stales:'utknęło Ci', ruszyles:'jest ruch', gotowy:'gotowi', sam:'samodzielnie',
       zrobiles:'zrobione', mogl:'da się', pokazales:'pokazało się',
       wrociles:'jest powrót', zaczales:'jest start' }
};

/* F('stales') → forma zgodna z profilem. Własne formy nadpisują słownik. */
function F(klucz){
  const p = profLoad();
  if(p.gender === 'own' && p.forms && p.forms[klucz]) return p.forms[klucz];
  return (FORMS[p.gender] || FORMS.n)[klucz] || FORMS.n[klucz] || '';
}
/* Imię do wplecenia w zdanie — pusty string, gdy nie podano. */
function imie(){ const p = profLoad(); return p.name ? p.name : ''; }
function przecinekImie(){ const n = imie(); return n ? `, ${n}` : ''; }

/* ============================================================
   POWITANIA MAXA — pule wariantów, nie jeden sztywny tekst
   Max to gospodarz, nie tabliczka. Wariant losuje się RAZ NA DZIEŃ
   (ziarno z daty), żeby w obrębie jednego dnia był spójny, ale kolejne
   dni brzmiały inaczej. „Potwór" to metafora ADHD — czegoś, co się
   tresuje i oswaja, nie leczy. Nigdy nie jest to etykieta użytkownika.
   ============================================================ */
const HELLO_NEW = [
  { g:'Cześć, tu Max!',
    s:'Spędź ze mną 15 minut, a pomogę Ci wytresować Twojego potwora.' },
  { g:'Hej. Jestem Max.',
    s:'Nie jestem listą zadań. Jestem od tego, żeby ruszyć — nawet gdy nic się nie chce.' },
  { g:'O, nowa twarz.',
    s:'Jestem Max. Pokaż mi, jak masz dziś, a znajdę najmniejszy możliwy krok.' },
  { g:'Cześć! Tu Max.',
    s:'Twój potwór nie jest wrogiem. Trzeba go tylko poznać — zacznijmy dziś.' },
  { g:'Dobrze, że jesteś.',
    s:'Jestem Max. Nie oceniam, nie planuję za Ciebie. Prowadzę — krok po kroku.' }
];

const HELLO_BACK = [
  { g:'Cześć, tu Max. Jak jesteś?',        s:null },
  { g:'Hej. Co u Ciebie dziś?',            s:null },
  { g:'Dobrze Cię widzieć.',               s:null },
  { g:'No i jesteś. Jak leci?',            s:null },
  { g:'Cześć. Jestem, kiedy będziesz gotów.', s:null },
  { g:'Hej. Jak Ci się dziś układa?',      s:null },
  { g:'Tu Max. Bez pośpiechu — jak jest?', s:null },
  { g:'Widzę Cię. Od czego chcesz zacząć?', s:null }
];

const HELLO_RETURN = [
  { g:'Dobrze Cię widzieć.',   s:'Trochę Cię nie było — nic nie przepadło.' },
  { g:'O, jesteś!',            s:'Przerwa to nie porażka. Wracamy spokojnie.' },
  { g:'Cześć. Tęskniłem.',     s:'Nic nie zginęło — wszystko czeka tam, gdzie zostawiliśmy.' },
  { g:'Hej, nieznajomy.',      s:'Żadnych wyrzutów. Po prostu zaczynamy od nowa.' }
];

/* Ziarno z daty — ten sam wariant przez cały dzień, inny jutro. */
function daySeed(){
  const d = new Date();
  return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
}
function pickHello(pula, przesun){
  return pula[(daySeed() + (przesun||0)) % pula.length];
}

/* ============================================================
   MAX JAKO GOSPODARZ
   Max nie jest kafelkiem w dashboardzie — dashboard jest jego narzędziem.
   renderHost() decyduje, co Max mówi na wejściu i które narzędzie podsuwa,
   na podstawie tego, co REALNIE wie: liczba spotkań, ostatnie zadanie,
   przerwa, dane w mapie, wpisy w dzienniku.
   Zasada: Max mówi tylko to, co ma w danych. Nigdy nie zgaduje.
   ============================================================ */
function renderHost(){
  const say  = document.getElementById('hostSay');
  const sub  = document.getElementById('hostSub');
  const kick = document.getElementById('toolsKicker');
  const hint = document.getElementById('chatHint');
  if(!say) return;

  const m     = memLoad();
  const dumps = dumpLoad();
  const mapN  = (m && m.map) ? m.map.length : 0;
  const ses   = (m && m.sessions) ? m.sessions : 0;
  const gap   = daysSinceLastSeen();

  let g, s2, k = 'Czym mogę Cię teraz obsłużyć', h = 'o energii, nastroju, o czymkolwiek';

  if(!ses){
    const w = pickHello(HELLO_NEW);
    g = w.g; s2 = w.s;
    k = 'Od czego zacząć';
    h = 'powiedz mi, co się dzieje';
  } else if(gap >= 3){
    const w = pickHello(HELLO_RETURN, ses);
    g  = w.g;
    s2 = `${w.s} Mam ${mapN} ${mapN===1?'zapis':'zapisów'} i wracamy tam, gdzie skończyliśmy.`;
    k  = 'Wróćmy do tego spokojnie';
  } else if(mapN >= MAP_MIN || dumps.length >= 5){
    /* Max ma dość danych, żeby coś zauważyć — i od razu to mówi. */
    const pats = readPatterns();
    g  = pickHello(HELLO_BACK, ses).g;
    s2 = pats.length ? pats[0] : `Zbieram Twoje wzorce — mam już ${mapN} zapisów.`;
    k  = 'Zajrzyjmy głębiej';
    h  = 'chcesz, żebym to rozwinął?';
  } else if(m && m.lastTask){
    g  = pickHello(HELLO_BACK, ses).g;
    /* Przyimek zależy od formy: „stałeś NAD X" vs „utknęło Ci NA X". */
    const pg = profLoad().gender;
    const fraza = (pg==='n') ? `${F('stales')} na: „${m.lastTask}”`
                             : `${F('stales')} nad: „${m.lastTask}”`;
    s2 = `Ostatnio ${fraza}. Możemy do tego wrócić — albo dziś zająć się czymś innym. Ty decydujesz.`;
    k  = 'Co dziś bierzemy';
  } else {
    g  = pickHello(HELLO_BACK, ses).g;
    s2 = `Poznaję Cię — mam ${mapN} ${mapN===1?'zapis':'zapisów'}. Jeszcze chwila i zacznę widzieć wzorce.`;
    k  = 'Czym mogę Cię teraz obsłużyć';
  }

  /* Imię wplatamy w powitanie, jeśli podane. */
  const nm = imie();
  if(nm && g.endsWith('.')) g = g.slice(0,-1) + `, ${nm}.`;
  else if(nm && g.endsWith('?')) g = g.slice(0,-1) + `, ${nm}?`;

  say.textContent = g;
  sub.textContent = s2;
  renderProgress();
  if(kick) kick.textContent = k;
  if(hint) hint.textContent = h;

  /* Kafelek recenzji pyta o KONKRET, nie o ogólne wrażenia —
     „co sądzisz o dzienniku" daje użyteczniejszą odpowiedź niż „jak Ci się podoba". */
  const rvH = document.getElementById('rvHead');
  const rvS = document.getElementById('rvSub');
  if(rvH && m && m.lastTool){
    const nazwy = { dump:'dzienniku', energy:'wykresie energii', map:'mapie',
                    steps:'krokach', chat:'rozmowie ze mną' };
    const n = nazwy[m.lastTool];
    if(n){
      rvH.textContent = `Co sądzisz o ${n}?`;
      rvS.textContent = 'Powiedz wprost — poprawię to, co nie działa.';
    }
  }
}

/* Ślad ostatnio użytego narzędzia — karmi pytanie o recenzję. */
function markTool(name){
  const m = memLoad() || { sessions:0, created:Date.now() };
  m.lastTool = name; memSave(m);
}

/* ============================================================
   RECENZJE — Max sam prosi o ocenę
   Zbierane lokalnie, żeby dało się je potem wyeksportować.
   ============================================================ */
const REVIEW_KEY = 'masteradhd.reviews.v1';
function reviewLoad(){ try{ return JSON.parse(localStorage.getItem(REVIEW_KEY))||[]; }catch(e){ return []; } }
function reviewSave(a){ try{ localStorage.setItem(REVIEW_KEY, JSON.stringify(a.slice(-200))); }catch(e){} }

function openReview(){
  const m = memLoad();
  const nazwy = { dump:'dziennik', energy:'wykres energii', map:'mapa',
                  steps:'kroki', chat:'rozmowa ze mną' };
  const cel = (m && m.lastTool && nazwy[m.lastTool]) ? nazwy[m.lastTool] : null;

  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  nowSwap(`
    <div class="kicker">Max pyta</div>
    <div class="max-line" style="margin-bottom:8px">${cel ? `Jak Ci działa ${cel}?` : 'Co mogę zrobić lepiej?'}</div>
    <div class="now-why-big" style="margin-bottom:14px">Bez lukru. Jeśli coś jest bez sensu — napisz, że jest bez sensu.</div>
    <div class="rv-scale" id="rvScale">
      <button class="rv-dot" onclick="pickScore(1)">😖</button>
      <button class="rv-dot" onclick="pickScore(2)">😕</button>
      <button class="rv-dot" onclick="pickScore(3)">😐</button>
      <button class="rv-dot" onclick="pickScore(4)">🙂</button>
      <button class="rv-dot" onclick="pickScore(5)">😃</button>
    </div>
    <textarea class="dump-input" id="rvText" rows="3"
      placeholder="co działa, co nie działa, czego brakuje…"></textarea>
  `,`
    <button class="btn btn-primary" onclick="sendReview()">Wyślij Maxowi</button>
    <div class="footnote"><button class="btn-text" onclick="exitNow()">Nie teraz</button></div>
  `);
  setTimeout(()=>maxSpeak(cel?`Jak Ci działa ${cel}? Bez lukru.`:'Co mogę zrobić lepiej? Bez lukru.',false),400);
}

let rvScore = 0;
function pickScore(n){
  rvScore = n; buzz(BUZZ.easier);
  document.querySelectorAll('.rv-dot').forEach((b,i)=>b.classList.toggle('on', i < n));
}

function sendReview(){
  const el = document.getElementById('rvText');
  const txt = el ? el.value.trim() : '';
  if(!rvScore && !txt){ exitNow(); return; }
  const m = memLoad();
  const all = reviewLoad();
  all.push({ t:Date.now(), score:rvScore||null, text:txt||null,
             tool:(m&&m.lastTool)||null, ses:(m&&m.sessions)||0 });
  reviewSave(all);
  buzz(BUZZ.done);
  rvScore = 0;
  nowSwap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line" style="margin-bottom:8px">Zapisane.</div>
    <div class="now-why-big">Dzięki. Takie rzeczy naprawdę zmieniają to, co budujemy.</div>
  `,`
    <button class="btn btn-primary" onclick="exitNow()">Wracamy</button>
  `);
  setTimeout(()=>maxSpeak('Zapisane. Dzięki — to realnie zmienia to, co budujemy.',false),350);
}

