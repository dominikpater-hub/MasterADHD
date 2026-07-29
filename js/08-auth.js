/* ============================================================
   GUARDIAN ID — logowanie (etap 1, bez backendu)
   Guzik realnie odsłania ekran główny Maxa. Sesja → localStorage
   'guardianid.session.v1' (tu wejdzie token Supabase w etapie 2).
   ============================================================ */
let authMode = 'register';
const A = id => document.getElementById(id);

function setMode(m){
  authMode = m;
  A('tabReg').classList.toggle('on', m==='register');
  A('tabLog').classList.toggle('on', m==='login');
  A('aConsentBox').style.display = m==='register' ? 'flex' : 'none';
  A('aPass').autocomplete = m==='register' ? 'new-password' : 'current-password';
  if(m==='register'){
    A('aHead').innerHTML = 'Cześć, jestem Max.<br><b>Zrób konto</b>, a zapamiętam każdą sesję.';
    A('aSub').textContent = 'Wszystko, co Ci pomaga, wróci na każdym urządzeniu — nawet gdy zmienisz telefon.';
    A('aSubmit').textContent = 'Załóż konto';
  }else{
    // uwaga #2 użytkownika: to mówi MAX, w pierwszej osobie
    A('aHead').innerHTML = 'Dobrze Cię widzieć.<br><b>Zaloguj się</b>, a przypomnę Ci nasze sesje.';
    A('aSub').textContent = 'Wróćmy tam, gdzie stanęliśmy. Pamiętam, na czym skończyliśmy.';
    A('aSubmit').textContent = 'Zaloguj się';
  }
  clearAuthErrors();
}
function clearAuthErrors(){
  ['aEmail','aPass'].forEach(f=>A(f).classList.remove('bad'));
  ['aEmailErr','aPassErr','aConsentErr'].forEach(e=>A(e).classList.remove('show'));
}
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function saveSession(s){ try{ localStorage.setItem('guardianid.session.v1', JSON.stringify(s)); }catch(e){} }

function submitAuth(){
  clearAuthErrors();
  const email = A('aEmail').value.trim();
  const pass  = A('aPass').value;
  let ok = true;
  if(!validEmail(email)){ A('aEmail').classList.add('bad'); A('aEmailErr').classList.add('show'); ok=false; }
  if(pass.length < 8){ A('aPass').classList.add('bad'); A('aPassErr').classList.add('show'); ok=false; }
  if(authMode==='register' && !A('aConsent').checked){ A('aConsentErr').classList.add('show'); ok=false; }
  if(!ok) return;
  // ETAP 2 (Supabase): supabase.auth.signUp / signInWithPassword tutaj.
  saveSession({ userId:'local-'+Date.now(), email, method:'email', createdAt:Date.now(), synced:false });
  enterApp();
}
function oauth(provider){
  // ETAP 2: supabase.auth.signInWithOAuth({provider})
  saveSession({ userId:'local-'+Date.now(), email:'(przez '+provider+')', method:provider.toLowerCase(), createdAt:Date.now(), synced:false });
  enterApp();
}
function skipAuth(){
  saveSession({ userId:'guest', method:'guest', createdAt:Date.now(), synced:false });
  enterApp();
}

/* KLUCZOWE: realne przejście z logowania do ekranu głównego Maxa */
function enterApp(){
  const auth = A('auth');
  auth.classList.add('gone');
  setTimeout(()=>{ auth.style.display='none'; }, 460);
  renderGreeting(); // Max wita kontekstowo na ekranie głównym
  refreshMuteIcon();
  /* Nowy użytkownik: Max pyta o imię i formy, zanim zacznie mówić w czasie
     przeszłym. Pytamy raz — potem tylko przez ⚙ w nagłówku. */
  const p = profLoad();
  if(!p.asked){
    p.asked = true; profSave(p);
    setTimeout(()=>openProfile(true), 900);
  }
}

/* Jeśli już zalogowany/gość — pomiń ekran logowania od razu */
(function initAuthGate(){
  let s=null; try{ s=JSON.parse(localStorage.getItem('guardianid.session.v1')); }catch(e){}
  if(s && s.method){ A('auth').style.display='none'; }
})();

/* panel zaufania */
function showTrust(){ document.getElementById('trust').classList.add('show'); }
function hideTrust(){ document.getElementById('trust').classList.remove('show'); }

/* Enter wysyła formularz logowania */
['aEmail','aPass'].forEach(f=>A(f).addEventListener('keydown',e=>{ if(e.key==='Enter') submitAuth(); }));

/* dostępność */
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    if(document.getElementById('trust').classList.contains('show')){ hideTrust(); return; }
    if(NOW.classList.contains('show')){ exitNow(); return; }
    if(crisis.classList.contains('show')) exitCrisis();
  }
});

/* powitanie Maxa zależne od pamięci — partner, nie chatbot */
renderGreeting();

