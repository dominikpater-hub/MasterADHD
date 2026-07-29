/* ============================================================
   KONTO + SYNC + PLAN (v19, skala)
   ------------------------------------------------------------
   Konto i synchronizacja przez Supabase. Kluczowa zasada: to dane o
   zdrowiu psychicznym (art. 9 RODO), więc do chmury trafia WYŁĄCZNIE
   szyfrogram. Szyfrujemy w przeglądarce (AES-GCM), klucz wyprowadzamy
   z hasła użytkownika (PBKDF2) i nigdy go nie zapisujemy ani nie wysyłamy.

   Wszystko domyślnie WYŁĄCZONE: puste SUPABASE_URL/ANON_KEY = tryb lokalny,
   aplikacja działa jak dotąd, w całości offline. Konfiguracja i model
   zaufania: backend/supabase/README.md oraz docs/DPIA.md.
   ============================================================ */

const SUPABASE_URL = '';        // ← 'https://TWOJ-PROJEKT.supabase.co'
const SUPABASE_ANON_KEY = '';   // ← anon public key (bezpieczny w kliencie)
const CHECKOUT_URL = '';        // ← URL Edge Function Stripe Checkout (backend/stripe/)

function syncEnabled(){ return !!(SUPABASE_URL && SUPABASE_ANON_KEY); }

/* Stan sesji (nigdy nie trafia na dysk). */
let _encKey = null;      // CryptoKey AES-GCM
let _saltB64 = null;     // sól PBKDF2 (jawna, base64)
let _plan = 'free';      // 'free' | 'paid'
let _sbClient = null;

function isPaid(){ return _plan === 'paid'; }

/* Klient Supabase ładowany dynamicznie — tylko gdy sync włączony, więc tryb
   lokalny nie pobiera niczego z sieci (offline-first zostaje offline-first). */
async function sb(){
  if(_sbClient) return _sbClient;
  const m = await import('https://esm.sh/@supabase/supabase-js@2');
  _sbClient = m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sbClient;
}

/* ---------- WebCrypto: E2E ---------- */
function _b64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function _unb64(str){ return Uint8Array.from(atob(str), c=>c.charCodeAt(0)); }
function _rand(n){ const a=new Uint8Array(n); crypto.getRandomValues(a); return a; }

async function deriveKey(password, saltBytes){
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt:saltBytes, iterations:150000, hash:'SHA-256' },
    base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function encryptJSON(obj, key){
  const iv = _rand(12);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, data);
  return { iv:_b64(iv), ct:_b64(ct) };
}
async function decryptJSON(ivB64, ctB64, key){
  const pt = await crypto.subtle.decrypt(
    { name:'AES-GCM', iv:_unb64(ivB64) }, key, _unb64(ctB64));
  return JSON.parse(new TextDecoder().decode(pt));
}

/* ---------- Stan aplikacji ---------- */
/* Synchronizujemy dane użytkownika (masteradhd.*), nie sesję urządzenia. */
function syncStateKeys(){
  const out = [];
  for(let i=0;i<localStorage.length;i++){
    const k = localStorage.key(i);
    if(k && /^masteradhd\./.test(k)) out.push(k);
  }
  return out;
}
function collectSyncState(){
  const o = {}; syncStateKeys().forEach(k=>{ o[k] = localStorage.getItem(k); }); return o;
}
function applySyncState(obj){
  if(!obj) return;
  Object.keys(obj).forEach(k=>{ try{ if(obj[k] != null) localStorage.setItem(k, obj[k]); }catch(e){} });
}

/* ---------- Auth ---------- */
async function authSignUp(email, pass){ const c=await sb(); return c.auth.signUp({ email, password:pass }); }
async function authSignIn(email, pass){ const c=await sb(); return c.auth.signInWithPassword({ email, password:pass }); }
async function authOAuth(provider){ const c=await sb(); return c.auth.signInWithOAuth({ provider, options:{ redirectTo: location.origin } }); }
async function authSignOut(){ try{ const c=await sb(); await c.auth.signOut(); }catch(e){} _encKey=null; _saltB64=null; _plan='free'; }
async function currentUser(){ try{ const c=await sb(); const { data } = await c.auth.getUser(); return data.user || null; }catch(e){ return null; } }

/* Po zalogowaniu: ustal sól i klucz, wczytaj plan, odszyfruj i wgraj stan z chmury.
   Zwraca { ok, user, decryptError }. */
async function accountBootstrap(password){
  const user = await currentUser();
  if(!user) return { ok:false };
  const c = await sb();
  const { data:row } = await c.from('user_state').select('*').eq('user_id', user.id).maybeSingle();
  const saltBytes = (row && row.salt) ? _unb64(row.salt) : _rand(16);
  _saltB64 = _b64(saltBytes);
  _encKey = await deriveKey(password, saltBytes);
  if(row){
    _plan = row.plan || 'free';
    if(row.ciphertext && row.iv){
      try{ applySyncState(await decryptJSON(row.iv, row.ciphertext, _encKey)); }
      catch(e){ return { ok:true, user, decryptError:true }; }  // złe hasło do starego szyfrogramu
    }
  }
  return { ok:true, user };
}

/* ---------- Sync ---------- */
async function syncPush(){
  if(!syncEnabled() || !_encKey) return false;
  try{
    const user = await currentUser(); if(!user) return false;
    const { iv, ct } = await encryptJSON(collectSyncState(), _encKey);
    const c = await sb();
    const { error } = await c.from('user_state')
      .upsert({ user_id:user.id, ciphertext:ct, iv, salt:_saltB64 });  // plan pomijamy → RLS OK
    return !error;
  }catch(e){ return false; }
}
async function syncPull(){
  if(!syncEnabled() || !_encKey) return false;
  try{
    const user = await currentUser(); if(!user) return false;
    const c = await sb();
    const { data:row } = await c.from('user_state').select('*').eq('user_id', user.id).maybeSingle();
    if(row){ _plan = row.plan || 'free';
      if(row.ciphertext && row.iv) applySyncState(await decryptJSON(row.iv, row.ciphertext, _encKey)); }
    return true;
  }catch(e){ return false; }
}
async function refreshPlan(){
  if(!syncEnabled()) return 'free';
  try{
    const user = await currentUser(); if(!user) return _plan;
    const c = await sb();
    const { data:row } = await c.from('user_state').select('plan').eq('user_id', user.id).maybeSingle();
    _plan = (row && row.plan) || 'free';
  }catch(e){}
  return _plan;
}

/* ---------- Monetyzacja (Stripe) ---------- */
/* UWAGA: to jest UX-owy start płatności. TWARDE nadanie 'paid' robi webhook
   Stripe po stronie serwera (rola serwisowa) — patrz backend/stripe/README.md.
   Warstwa AI jest wymuszana płatnie na proxy (worker/), nie tu. */
async function startCheckout(){
  if(!CHECKOUT_URL){ alert('Płatności nie są jeszcze skonfigurowane (patrz backend/stripe/README.md).'); return; }
  try{
    const c = await sb();
    const { data:{ session } } = await c.auth.getSession();
    const r = await fetch(CHECKOUT_URL, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+(session ? session.access_token : '') }
    });
    const j = await r.json();
    if(j && j.url) location.href = j.url;
  }catch(e){ alert('Nie udało się rozpocząć płatności. Spróbuj ponownie.'); }
}

/* Autosync: przy chowaniu aplikacji wypychamy zaszyfrowany stan (jeśli zalogowany). */
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState === 'hidden' && syncEnabled() && _encKey) syncPush();
});

/* ---------- UI glue (panel „Połączenia i zgody") ---------- */
async function fillAcctStatus(){
  const el = document.getElementById('cnAcctStatus'); if(!el) return;
  try{
    const u = await currentUser();
    if(!u){ el.textContent = 'Nie zalogowano na tym urządzeniu.'; return; }
    await refreshPlan();
    el.textContent = (u.email || 'zalogowano') + ' · plan: ' + (isPaid() ? 'pełny' : 'darmowy');
    const up = document.getElementById('cnUpgrade'); if(up) up.style.display = isPaid() ? 'none' : '';
  }catch(e){ el.textContent = 'Nie udało się sprawdzić konta.'; }
}
function syncNowUI(){
  const el = document.getElementById('cnAcctStatus');
  if(el) el.textContent = 'Synchronizuję…';
  syncPush().then(okz=>{ if(el) el.textContent = okz ? 'Zsynchronizowano ✓' : 'Synchronizacja nieudana — zaloguj się.'; });
}
function upgradeUI(){ startCheckout(); }
async function accountSignOutUI(){ await authSignOut(); try{ location.reload(); }catch(e){} }
