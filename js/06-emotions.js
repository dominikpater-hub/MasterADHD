/* ============================================================
   ZRZUĆ EMOCJE — model kołowy afektu Russella (walencja × pobudzenie)
   Dwa suwaki zamiast listy przycisków. Podstawa: Russell (1980), Circumplex
   Model of Affect; wdrożenie wzorowane na Affective Slider / SAM.
   DLACZEGO SUWAKI: osoby z ADHD często mają trudność z nazwaniem emocji
   (aleksytymia) — suwak nie wymaga słowa, tylko wskazania. Etykieta jest
   OPCJONALNA i wybierana z gotowej siatki (rozpoznanie zamiast przypominania).
   Polskie brzmienia są robocze — wymagają debriefingu kognitywnego.
   ============================================================ */
function moodLoad(){ try{ return JSON.parse(localStorage.getItem(MOOD_KEY))||[]; }catch(e){ return []; } }
function moodSave(a){ try{ localStorage.setItem(MOOD_KEY, JSON.stringify(a.slice(-400))); }catch(e){} }

/* Cztery ćwiartki modelu kołowego — etykiety dobierane do pozycji suwaków. */
const MOOD_GRID = {
  hiPos: ['podekscytowany','radosny','pełen energii','dumny'],
  loPos: ['spokojny','rozluźniony','zadowolony','wyciszony'],
  hiNeg: ['spięty','zdenerwowany','zły','przeciążony'],
  loNeg: ['przygnębiony','smutny','zmęczony','pusty']
};

/* ============================================================
   ATLAS EMOCJI (§18) — głęboka warstwa afektywna OBOK suwaków Russella.
   Suwaki = szybki zrzut (nie wymaga słowa). Atlas = różnicowanie po OCENIE
   poznawczej — rozdziela emocje, które w modelu kołowym leżą w tym samym
   kwadrancie (strach vs ekscytacja, wstyd vs wina). Jeden słownik pod dwie
   powierzchnie: przeglądalny atlas + prowadzone różnicowanie.
   Pola scoringu: val(-1..1), obj(rdzeń), pew(0..1 rozlane..konkretne).
   ============================================================ */
const FAMS=[
  {id:'strach',nm:'Strach i lęk',em:'🌫️'},{id:'gniew',nm:'Gniew i pokrewne',em:'⚡'},
  {id:'smutek',nm:'Smutek i strata',em:'🌧️'},{id:'samo',nm:'Emocje o sobie',em:'🫥'},
  {id:'wstret',nm:'Wstręt',em:'🤢'},{id:'poz',nm:'Pozytywne',em:'☀️'},
  {id:'porown',nm:'Porównanie z innymi',em:'👁️'},{id:'inne',nm:'Inne stany',em:'🍂'},
];
const ATLAS=[
  {id:'strach',nm:'Strach',em:'😨',fam:'strach',val:-1,obj:'zagrozenie',pew:1,spr:'okoliczności',tend:'ucieczka, unikanie',myli:['lek','ekscytacja'],pyt:'Czy wiesz konkretnie, czego się boisz, i czy to jest TERAZ?',opis:'Reakcja na konkretne, obecne zagrożenie. Wysokie pobudzenie, ciało gotowe do ucieczki.'},
  {id:'lek',nm:'Lęk',em:'🌫️',fam:'strach',val:-1,obj:'zagrozenie',pew:0,spr:'nic konkretnego',tend:'hiperczujność, zamartwianie',myli:['strach','przec'],pyt:'Czy to rozlane i o przyszłość, bez konkretnego obiektu?',opis:'Zagrożenie niepewne, przyszłe, bez wyraźnego obiektu. Myśli wybiegają w przód.'},
  {id:'panika',nm:'Panika',em:'💥',fam:'strach',val:-1,obj:'zagrozenie',pew:.5,spr:'nic konkretnego',tend:'ucieczka natychmiastowa',myli:['lek','strach'],pyt:'Czy ciało reaguje szybciej, niż zdążysz pomyśleć?',opis:'Skok lęku, który przejmuje ciało — serce, oddech, potrzeba ucieczki. Fala, która mija.'},
  {id:'gniew',nm:'Gniew',em:'🔥',fam:'gniew',val:-1,obj:'przeszkoda',pew:1,spr:'ktoś inny',tend:'ruch przeciw — usunąć przeszkodę',myli:['frust','pogarda'],pyt:'Czy jest ktoś, kogo obwiniasz, i czujesz siłę, by działać?',opis:'Ktoś stanął w drodze celu i to jego wina. Energia skierowana na zewnątrz.'},
  {id:'frust',nm:'Frustracja',em:'⚡',fam:'gniew',val:-1,obj:'przeszkoda',pew:.7,spr:'okoliczności',tend:'napór na przeszkodę',myli:['gniew','irytacja'],pyt:'Czy to raczej zablokowana droga niż konkretny winowajca?',opis:'Przeszkoda w celu — ale niekoniecznie osoba. Chce się przebić.'},
  {id:'irytacja',nm:'Irytacja',em:'😤',fam:'gniew',val:-1,obj:'przeszkoda',pew:.6,spr:'okoliczności',tend:'odsunięcie drażniącego bodźca',myli:['frust','gniew'],pyt:'Czy to drobne i powtarzalne, nie wielkie?',opis:'Drobne, powtarzalne drażnienie. Niżej niż gniew.'},
  {id:'pogarda',nm:'Pogarda',em:'😒',fam:'gniew',val:-1,obj:'inni',pew:1,spr:'ktoś inny',tend:'dystansowanie, patrzenie z góry',myli:['gniew','wstret'],pyt:'Czy patrzysz na kogoś „z góry”, chłodno, bez impulsu ataku?',opis:'Zimna emocja wyższości. Nie atakuje — odsuwa i dewaluuje.'},
  {id:'smutek',nm:'Smutek',em:'🌧️',fam:'smutek',val:-1,obj:'strata',pew:1,spr:'okoliczności',tend:'wycofanie, szukanie wsparcia',myli:['przygnebienie','rozczarowanie'],pyt:'Czy coś zostało utracone i nie da się tego cofnąć?',opis:'Reakcja na nieodwracalną stratę. Niskie pobudzenie, potrzeba wycofania.'},
  {id:'rozczarowanie',nm:'Rozczarowanie',em:'😞',fam:'smutek',val:-1,obj:'strata',pew:.8,spr:'okoliczności',tend:'rewizja oczekiwań',myli:['smutek','zal'],pyt:'Czy coś nie spełniło oczekiwań, które miałeś?',opis:'Rzeczywistość rozminęła się z oczekiwaniem. Nie utrata na zawsze.'},
  {id:'zal',nm:'Żal',em:'😔',fam:'smutek',val:-1,obj:'strata',pew:.9,spr:'ja sam',tend:'rozpamiętywanie „gdybym…”',myli:['wina','rozczarowanie'],pyt:'Czy wracasz do własnego wyboru — „gdybym zrobił inaczej”?',opis:'Kontrfaktyczne rozpamiętywanie własnej decyzji.'},
  {id:'przygnebienie',nm:'Przygnębienie',em:'🌫️',fam:'smutek',val:-1,obj:'brak',pew:.4,spr:'nic konkretnego',tend:'wycofanie, spadek napędu',myli:['smutek','nuda'],pyt:'Czy to ciągnie się dłużej i bez wyraźnej przyczyny?',opis:'Przewlekłe, rozlane obniżenie bez jednego powodu. (Jeśli trwa i gaśnie radość — warto z kimś porozmawiać.)'},
  {id:'wstyd',nm:'Wstyd',em:'🫥',fam:'samo',val:-1,obj:'ja',pew:.9,spr:'ja sam',tend:'ukrycie, zniknięcie',myli:['wina','upokorzenie'],pyt:'Czy to myśl „jestem zły/wadliwy”, a nie „zrobiłem coś złego”?',opis:'Negatywna ocena całego „ja”. Ciało się kurczy, chce zniknąć.'},
  {id:'wina',nm:'Wina',em:'😣',fam:'samo',val:-1,obj:'ja',pew:.9,spr:'ja sam',tend:'naprawa, przeprosiny',myli:['wstyd','zal'],pyt:'Czy chodzi o konkretne zachowanie, które chcesz naprawić?',opis:'Negatywna ocena konkretnego czynu. Ciągnie do naprawienia.'},
  {id:'zazenowanie',nm:'Zażenowanie',em:'😳',fam:'samo',val:-1,obj:'ja',pew:.6,spr:'ja sam',tend:'gesty pojednawcze, rumieniec',myli:['wstyd'],pyt:'Czy to przelotne potknięcie wobec ludzi, nie sprawa moralna?',opis:'Przypadkowe naruszenie konwencji przy świadkach. Lekkie, przelotne.'},
  {id:'upokorzenie',nm:'Upokorzenie',em:'💢',fam:'samo',val:-1,obj:'ja',pew:.9,spr:'ktoś inny',tend:'mieszanka: wycofanie i gniew',myli:['wstyd','gniew'],pyt:'Czy czujesz to jako NIESPRAWIEDLIWĄ krzywdę od kogoś?',opis:'Ściągnięcie w dół przez kogoś, odbierane jako niezasłużone.'},
  {id:'wstret',nm:'Wstręt',em:'🤢',fam:'wstret',val:-1,obj:'zagrozenie',pew:1,spr:'okoliczności',tend:'odrzucenie, odsunięcie',myli:['pogarda'],pyt:'Czy jest komponent „obrzydliwe” — reakcja ciała, mdłości?',opis:'Jedna z niewielu emocji z realnym śladem w ciele (mdłości, grymas).'},
  {id:'radosc',nm:'Radość',em:'😊',fam:'poz',val:1,obj:'dobro',pew:1,spr:'okoliczności',tend:'otwarcie, dzielenie się',myli:['ekscytacja','ulga'],pyt:'Czy to lekkie, jasne uniesienie tu i teraz?',opis:'Wysokie, przyjemne pobudzenie. Ciało otwarte.'},
  {id:'zadowolenie',nm:'Zadowolenie',em:'☺️',fam:'poz',val:1,obj:'dobro',pew:1,spr:'okoliczności',tend:'odpoczynek',myli:['radosc','ulga'],pyt:'Czy to ciche „jest dobrze”, bez fajerwerków?',opis:'Niskie, spokojne dobro. Nasycenie, nie ekscytacja.'},
  {id:'ekscytacja',nm:'Ekscytacja',em:'🤩',fam:'poz',val:1,obj:'dobro',pew:.7,spr:'okoliczności',tend:'zbliżenie do okazji',myli:['radosc','strach'],pyt:'Czy to samo wysokie pobudzenie, ale przed czymś DOBRYM?',opis:'Napięcie zbliżenia — jak strach, ale wobec okazji. Ta sama energia, inny znak.'},
  {id:'duma',nm:'Duma',em:'😌',fam:'poz',val:1,obj:'ja',pew:1,spr:'ja sam',tend:'wyprostowanie',myli:['radosc'],pyt:'Czy przypisujesz to własnemu wysiłkowi i osiągnięciu?',opis:'Pozytywna ocena siebie za osiągnięcie z wysiłku.'},
  {id:'ulga',nm:'Ulga',em:'😮‍💨',fam:'poz',val:1,obj:'dobro',pew:.9,spr:'okoliczności',tend:'rozluźnienie, wydech',myli:['radosc','zadowolenie'],pyt:'Czy właśnie minęło coś, czego się bałeś?',opis:'Zagrożenie minęło. Napięcie schodzi.'},
  {id:'wdziecznosc',nm:'Wdzięczność',em:'🙏',fam:'poz',val:1,obj:'dobro',pew:.9,spr:'ktoś inny',tend:'zbliżenie, odwzajemnienie',myli:['radosc'],pyt:'Czy ktoś dał Ci coś dobrego, co doceniasz?',opis:'Odpowiedź na dobro otrzymane od kogoś.'},
  {id:'zawisc',nm:'Zawiść',em:'😖',fam:'porown',val:-1,obj:'inni',pew:.8,spr:'ktoś inny',tend:'w górę lub w dół',myli:['zazdrosc'],pyt:'Czy KTOŚ MA coś, czego Ty chcesz (układ dwóch osób)?',opis:'Brak tego, co ma inny, w ważnej dla Ciebie dziedzinie.'},
  {id:'zazdrosc',nm:'Zazdrość',em:'💔',fam:'porown',val:-1,obj:'inni',pew:.8,spr:'ktoś inny',tend:'ochrona relacji',myli:['zawisc'],pyt:'Czy boisz się UTRATY relacji na rzecz rywala (układ trzech osób)?',opis:'Lęk przed utratą bliskiej relacji na rzecz kogoś trzeciego.'},
  {id:'zaskoczenie',nm:'Zaskoczenie',em:'😯',fam:'inne',val:0,obj:'zmiana',pew:.5,spr:'nic konkretnego',tend:'orientacja, zatrzymanie',myli:['strach','radosc'],pyt:'Czy coś naruszyło Twoje oczekiwania — zanim oceniłeś, dobre to czy złe?',opis:'Neutralna, bardzo krótka. Zwykle przechodzi w inną emocję.'},
  {id:'nuda',nm:'Nuda',em:'🍂',fam:'inne',val:-1,obj:'brak',pew:.6,spr:'okoliczności',tend:'poszukiwanie bodźca',myli:['przygnebienie','frust'],pyt:'Czy brakuje zaczepienia, a energia jest?',opis:'Brak zaczepienia uwagi. W ADHD częsty zapalnik.'},
  {id:'przec',nm:'Przeciążenie',em:'🌊',fam:'inne',val:-1,obj:'przeszkoda',pew:.7,spr:'okoliczności',tend:'zamrożenie',myli:['lek','frust'],pyt:'Czy to „za dużo naraz”, wszystkie karty otwarte?',opis:'Za wiele otwartych pętli naraz. System się zatyka.'},
];
const atlasById=id=>ATLAS.find(e=>e.id===id);
function objLabel(o){return{zagrozenie:'zagrożenie',przeszkoda:'przeszkoda w celu',strata:'strata',ja:'moje „ja”',inni:'inni ludzie',dobro:'coś dobrego',brak:'brak / rozlane',zmiana:'nagła zmiana'}[o]||o;}

function openMood(){
  markTool('mood');
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  nowSwap(`
    <div class="kicker">Zrzuć emocje</div>
    <div class="max-line" style="margin-bottom:4px">Jak Ci teraz?</div>
    <div class="now-why-big" style="margin-bottom:20px">Nie musisz tego nazywać. Wystarczy, że pokażesz.</div>

    <div class="sl-block">
      <div class="sl-lab"><span>bardzo nieprzyjemnie</span><span>bardzo przyjemnie</span></div>
      <input class="sl" type="range" min="0" max="100" value="50" id="slVal" oninput="moodPreview()">
      <div class="sl-name">Jak się czujesz</div>
    </div>

    <div class="sl-block">
      <div class="sl-lab"><span>spokojnie, suchy dok</span><span>bardzo pobudzony</span></div>
      <input class="sl" type="range" min="0" max="100" value="50" id="slAro" oninput="moodPreview()">
      <div class="sl-name">Ile masz w sobie pobudzenia</div>
    </div>

    <div class="mood-guess" id="moodGuess"></div>
  `,`
    <button class="btn btn-primary" onclick="moodNext()">Dalej</button>
    <div class="footnote"><button class="btn-text" onclick="exitNow()">Nie teraz</button></div>
  `);
  setTimeout(()=>{ maxSpeak('Jak Ci teraz? Nie musisz tego nazywać — wystarczy, że pokażesz.',false); moodPreview(); },400);
}

/* Podpowiedź nazwy na podstawie ćwiartki — Max proponuje, nie narzuca. */
function moodQuadrant(v, a){
  if(v >= 50) return a >= 50 ? 'hiPos' : 'loPos';
  return a >= 50 ? 'hiNeg' : 'loNeg';
}
function moodPreview(){
  const v = +document.getElementById('slVal').value;
  const a = +document.getElementById('slAro').value;
  const el = document.getElementById('moodGuess');
  if(!el) return;
  /* Blisko środka nie zgadujemy — to uczciwsze niż wciskanie etykiety. */
  if(Math.abs(v-50) < 12 && Math.abs(a-50) < 12){ el.textContent = ''; return; }
  const q = MOOD_GRID[moodQuadrant(v,a)];
  el.textContent = `brzmi jak: ${q[0]}`;
}

function moodNext(){
  const v = +document.getElementById('slVal').value;
  const a = +document.getElementById('slAro').value;
  buzz(BUZZ.easier);
  const q = MOOD_GRID[moodQuadrant(v,a)];
  nowSwap(`
    <div class="kicker">Zrzuć emocje</div>
    <div class="max-line" style="margin-bottom:6px">Nazwiesz to?</div>
    <div class="now-why-big" style="margin-bottom:16px">Opcjonalnie. Jeśli żadne nie pasuje — pomiń.</div>
    <div class="mood-tags">
      ${q.map(t=>`<button class="mood-tag" onclick="saveMood(${v},${a},'${t}')">${t}</button>`).join('')}
    </div>
  `,`
    <button class="btn btn-ghost" onclick="saveMood(${v},${a},null)">Nie umiem nazwać</button>
    <div class="footnote"><button class="btn-text" onclick="exitNow();setTimeout(openSurvey,480)">Chcę nazwać dokładniej →</button></div>
  `);
  setTimeout(()=>maxSpeak('Nazwiesz to? Jeśli nie — spokojnie, pomiń.',false),350);
}

function saveMood(v, a, tag){
  const all = moodLoad();
  all.push({ t:Date.now(), v, a, tag:tag||null, h:new Date().getHours(), d:new Date().getDay() });
  moodSave(all);
  /* Pobudzenie mapujemy na skalę energii, żeby zasilić wspólną mapę. */
  mapRecord(a >= 66 ? 'high' : a >= 34 ? 'mid' : 'low', 'mood');
  buzz(BUZZ.done);
  const n = all.length;
  nowSwap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line" style="margin-bottom:8px">Zapisane.</div>
    <div class="now-why-big">${tag ? `„${tag}” — zanotowane. ` : ''}To już ${n}. taki zapis. Z tego rośnie Twoja mapa.</div>
  `,`
    <button class="btn btn-primary" onclick="exitNow()">Gotowe</button>
  `);
  setTimeout(()=>maxSpeak('Zapisane. Z tego rośnie Twoja mapa.',false),350);
}

/* ============================================================
   ATLAS — przeglądalny (nakładka NOW). Rodziny → emocja → karta.
   ============================================================ */
let SURV = {val:null,obj:null,pew:null,cands:[]};
function openAtlas(){
  markTool('atlas');
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  atlasList();
}
function atlasList(){
  nowSwap(`
    <div class="kicker">Atlas emocji</div>
    <div class="max-line" style="margin-bottom:4px">Poznaj każdą emocję.</div>
    <div class="now-why-big" style="margin-bottom:16px">Każda ma swój podpis — po czym ją poznać i z czym się myli.</div>
    ${FAMS.map(f=>{
      const es=ATLAS.filter(e=>e.fam===f.id);
      return `<div class="atl-fam">${f.em} ${f.nm}</div>
        <div class="atl-grid">${es.map(e=>`<button class="atl-chip" onclick="atlasCard('${e.id}',false)">${e.em} ${e.nm}</button>`).join('')}</div>`;
    }).join('')}
  `,`<button class="btn btn-ghost" onclick="exitNow()">Zamknij</button>`);
}
function atlasCard(id, fromSurvey){
  const e=atlasById(id); if(!e) return;
  const near=e.myli.map(m=>atlasById(m)).filter(Boolean);
  nowSwap(`
    ${fromSurvey?`<div class="kicker">To chyba to</div>`:`<div class="kicker">Atlas · ${e.nm}</div>`}
    <div class="atl-card-h">${e.em} <b>${e.nm}</b></div>
    <div class="atl-opis">${e.opis}</div>
    <div class="atl-row"><span class="ak">Co za tym stoi</span><span class="av">${e.spr}</span></div>
    <div class="atl-row"><span class="ak">Rdzeń</span><span class="av">${objLabel(e.obj)}</span></div>
    <div class="atl-row"><span class="ak">Ciągnie do</span><span class="av">${e.tend}</span></div>
    <div class="atl-crux"><div class="acl">Pytanie różnicujące</div><div class="acq">${e.pyt}</div></div>
    ${near.length?`<div class="atl-near"><span>Łatwo pomylić z:</span>${near.map(n=>`<button onclick="atlasCard('${n.id}',${fromSurvey})">${n.em} ${n.nm}</button>`).join('')}</div>`:''}
  `, fromSurvey
      ? `<button class="btn btn-primary" onclick="saveSurvey('${e.id}')">Tak, to nazwij</button>
         <button class="btn btn-ghost" onclick="survStep3()">Nie, wróćmy do wyboru</button>`
      : `<button class="btn btn-ghost" onclick="atlasList()">‹ Wszystkie emocje</button>`);
}

/* ============================================================
   ZRZUĆ EMOCJE — GŁĘBIEJ: różnicowanie po ocenie poznawczej.
   Dostępne jako opcja w „Zrzuć emocje” (obok szybkich suwaków Russella).
   ============================================================ */
function openSurvey(){
  markTool('survey');
  SURV={val:null,obj:null,pew:null,cands:[]};
  NOW.classList.add('show');
  requestAnimationFrame(()=>requestAnimationFrame(()=>NOW.classList.add('vis')));
  survStep0();
}
function survStep0(){
  nowSwap(`
    <div class="kicker">Zrzuć emocje · głębiej</div>
    <div class="max-line" style="margin-bottom:4px">Zacznijmy od grubsza. Jak to jest?</div>
    <div class="now-why-big" style="margin-bottom:18px">Nie musisz trafić idealnie — zawęzimy razem.</div>
    <div class="surv-opts">
      <button class="surv-o" onclick="survVal('minus')">🌧️ <b>Nieprzyjemne</b><small>ciężkie, chcę, żeby minęło</small></button>
      <button class="surv-o" onclick="survVal('plus')">☀️ <b>Przyjemne</b><small>dobre, chcę tego więcej</small></button>
      <button class="surv-o" onclick="survVal('mix')">🌗 <b>Jedno i drugie</b><small>albo trudno powiedzieć</small></button>
    </div>
  `,`<button class="btn btn-ghost" onclick="exitNow()">Nie teraz</button>`);
}
function survVal(v){ SURV.val=v; buzz(BUZZ.easier); nowSwap(`
    <div class="kicker">Zrzuć emocje · głębiej</div>
    <div class="max-line" style="margin-bottom:4px">Co jest w centrum?</div>
    <div class="now-why-big" style="margin-bottom:18px">Wokół czego to się kręci?</div>
    <div class="surv-opts">
      ${[['zagrozenie','⚠️','Zagrożenie','coś może się źle skończyć'],['przeszkoda','🧱','Przeszkoda','coś stoi mi na drodze'],['strata','🍂','Strata','coś się skończyło / nie wyszło'],['ja','🪞','Ja sam','chodzi o mnie, jaki jestem'],['inni','👥','Inni ludzie','ktoś inny, porównanie, relacja'],['dobro','✨','Coś dobrego','wydarzyło się coś fajnego'],['zmiana','⚡','Nagła zmiana','coś mnie zaskoczyło']].map(([id,em,n,d])=>`<button class="surv-o" onclick="survObj('${id}')">${em} <b>${n}</b><small>${d}</small></button>`).join('')}
    </div>
  `,`<button class="btn btn-ghost" onclick="exitNow()">Nie teraz</button>`); }
function survObj(o){ SURV.obj=o; buzz(BUZZ.easier); nowSwap(`
    <div class="kicker">Zrzuć emocje · głębiej</div>
    <div class="max-line" style="margin-bottom:4px">Jak wyraźne to jest?</div>
    <div class="now-why-big" style="margin-bottom:18px">Wiesz dokładnie, o co chodzi — czy to rozlane?</div>
    <div class="surv-opts">
      <button class="surv-o" onclick="survPew(1)">🎯 <b>Konkretne i teraz</b><small>wiem dokładnie, o co chodzi</small></button>
      <button class="surv-o" onclick="survPew(0.5)">🌥️ <b>Coś pomiędzy</b><small>trochę wiem, trochę nie</small></button>
      <button class="surv-o" onclick="survPew(0)">🌫️ <b>Rozlane, niepewne</b><small>nie umiem wskazać palcem</small></button>
    </div>
  `,`<button class="btn btn-ghost" onclick="exitNow()">Nie teraz</button>`); }
function survPew(p){ SURV.pew=p; SURV.cands=scoreEmotions(); survStep3(); }
function scoreEmotions(){
  const {val,obj,pew}=SURV;
  return ATLAS.map(e=>{ let s=0;
    if(val!==null){ if(val==='mix') s+=0; else if((val==='plus')===(e.val>0)) s+=3; else if(e.val===0) s+=1; else s-=2; }
    if(obj && e.obj===obj) s+=4;
    if(pew!==null) s+=(1-Math.abs(e.pew-pew))*2;
    return {e,s};
  }).sort((a,b)=>b.s-a.s).slice(0,4).map(x=>x.e);
}
function survStep3(){ buzz(BUZZ.easier); nowSwap(`
    <div class="kicker">Zrzuć emocje · głębiej</div>
    <div class="max-line" style="margin-bottom:4px">To może być któreś z tych.</div>
    <div class="now-why-big" style="margin-bottom:16px">Dotknij najbliższego — pokażę Ci różnicę.</div>
    <div class="surv-opts">
      ${SURV.cands.map(e=>`<button class="surv-o" onclick="atlasCard('${e.id}',true)">${e.em} <b>${e.nm}</b><small>${e.opis.split('.')[0]}</small></button>`).join('')}
    </div>
  `,`<button class="btn btn-ghost" onclick="survStep0()">Zacznij od nowa</button>`); }
function saveSurvey(id){
  const all=moodLoad();
  all.push({ t:Date.now(), v:null, a:null, tag:id, granular:true, h:new Date().getHours(), d:new Date().getDay() });
  moodSave(all);
  buzz(BUZZ.done);
  const e=atlasById(id);
  nowSwap(`
    <div class="max-orb"><div class="max-orb-core"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line" style="margin-bottom:8px">„${e.nm}” — nazwane.</div>
    <div class="now-why-big">Im precyzyjniej nazywasz, tym łatwiej to ogarnąć. Z tego rośnie Twoja mapa.</div>
  `,`<button class="btn btn-primary" onclick="exitNow()">Gotowe</button>`);
  setTimeout(()=>maxSpeak('Nazwane. Im precyzyjniej nazywasz, tym łatwiej to ogarnąć.',false),350);
}


