/* ============================================================
   POWIADOMIENIA — nośnik dla pingu/kotwicy (v18)
   ------------------------------------------------------------
   Do tej pory Max obiecywał „sprawdzę Cię za 10 minut" i nie wracał —
   nie było nośnika (audyt B-4, C-8). Tu dajemy prawdziwe przypomnienie
   lokalne:
     • gdzie przeglądarka wspiera Notification Triggers (Chromium) —
       odpala się NAWET po zamknięciu aplikacji;
     • gdzie nie — uczciwy fallback: setTimeout działa tylko, dopóki
       aplikacja jest otwarta, i copy mówi to wprost.
   Nie ma serwera push, więc niczego więcej nie obiecujemy.
   ============================================================ */
function notifSupported(){ return typeof Notification !== 'undefined'; }

async function armReminder(minutes, title, body){
  if(!notifSupported()) return 'unsupported';
  let perm = Notification.permission;
  if(perm === 'default'){
    try{ perm = await Notification.requestPermission(); }catch(e){ perm = 'denied'; }
  }
  if(perm !== 'granted') return 'blocked';

  const delay = Math.max(1, minutes) * 60000;
  const when  = Date.now() + delay;
  const opts  = { body, tag:'masteradhd-ping', icon:'icons/icon-192.png', badge:'icons/icon-192.png' };

  /* 1) Notification Triggers — przypomnienie przeżywa zamknięcie aplikacji. */
  try{
    if('serviceWorker' in navigator &&
       'showTrigger' in ServiceWorkerRegistration.prototype &&
       typeof TimestampTrigger !== 'undefined'){
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, { ...opts, showTrigger: new TimestampTrigger(when) });
      return 'scheduled';
    }
  }catch(e){ /* spróbuj fallbacku */ }

  /* 2) Fallback sesyjny — tylko dopóki aplikacja jest otwarta. */
  try{
    setTimeout(async ()=>{
      try{
        if('serviceWorker' in navigator){
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, opts);
        } else {
          new Notification(title, opts);
        }
      }catch(e){}
    }, delay);
    return 'session';
  }catch(e){ return 'blocked'; }
}

/* Glue dla ekranu „trzymam czas": uzbraja przypomnienie za 10 minut i
   uczciwie melduje, jak dobry jest nośnik na tym urządzeniu. */
async function armPingReminder(){
  const res = await armReminder(10, 'Max: jak Ci idzie?',
    'Wróć na chwilę — zobaczmy, gdzie jesteś z tym zadaniem.');
  const map = {
    scheduled:   'Przypomnę Ci za 10 minut 🔔 — nawet jeśli zamkniesz aplikację.',
    session:     'Przypomnę za 10 minut 🔔 — o ile zostawisz aplikację otwartą.',
    blocked:     'Bez zgody na powiadomienia nie przypomnę — ale trzymam za Ciebie kciuki.',
    unsupported: 'Ta przeglądarka nie umie przypomnień — trzymam czas, wróć, kiedy zrobisz kawałek.'
  };
  const line = map[res] || map.unsupported;
  const ustawione = (res === 'scheduled' || res === 'session');
  swap(`
    <div class="max-orb" style="width:100px;height:100px;margin-bottom:20px"><div class="max-orb-core" style="width:54px;height:54px"></div></div>
    <div class="maxName">Max</div>
    <div class="max-line"><b>${ustawione ? 'Ustawione.' : 'Jasne.'}</b><br>${line}</div>
  `,`
    <button class="btn btn-primary" onclick="afterSession()">Do zobaczenia 👊</button>
  `);
  setTimeout(()=>maxSpeak(line,false),250);
}
