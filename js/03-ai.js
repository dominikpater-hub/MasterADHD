/* ============================================================
   WARSTWA AI — TREŚĆ, NIGDY SZKIELET
   Zgodnie z ADR: Decision Engine jest deterministyczny, AI nigdy nie decyduje.
   Tu AI dostaje GOTOWE kroki (wybrane regułą miejsce×energia) i tylko
   przepisuje ich brzmienie pod konkretne zadanie użytkownika.
   Liczba kroków, kolejność i logika „za trudne" pozostają w regule.
   Brak sieci / błąd / timeout => zostaje wersja deterministyczna, a Max
   mówi wprost, że działa offline. Nigdy nie blokujemy użytkownika.
   ============================================================ */
let aiState = 'idle';   // idle | pending | ok | offline

async function tailorSteps(){
  if(!consLoad().ai){ aiState='idle'; return; }   // A-1b: bez zgody treść zadania nie opuszcza urządzenia
  if(!navigator.onLine){ aiState='offline'; return; }
  aiState='pending';
  const skeleton = steps.map((s,i)=>`${i+1}. ${s.word} (${s.hint})`).join('\n');
  const prompt =
`Jesteś Max — spokojny przewodnik dla osoby z ADHD, która utknęła i nie może zacząć.
Zadanie użytkownika: "${sessionTask}"

Oto ${steps.length} kroki wybrane przez silnik. NIE zmieniaj ich liczby, kolejności ani sensu.
Przepisz TYLKO brzmienie, tak by odnosiło się do zadania użytkownika:
${skeleton}

Zasady:
- Każdy krok ma być mniejszy niż użytkownik myśli, że musi zrobić.
- Krok 1 dotyczy ciała lub otoczenia, nie samego zadania.
- Ostatni krok to najmniejszy możliwy ruch W zadaniu, nie jego ukończenie.
- Bez oceniania, bez motywacyjnych sloganów, bez wykrzykników.
- "word": maks 6 słów, tryb rozkazujący. "hint": jedno krótkie zdanie.
- "max": jedno zdanie, które Max powie na głos.

Zwróć WYŁĄCZNIE JSON, bez markdown:
{"steps":[{"word":"...","hint":"...","max":"..."}]}`;

  try{
    const ctl = new AbortController();
    const to = setTimeout(()=>ctl.abort(), 9000);
    const r = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST", headers:{"Content-Type":"application/json"}, signal:ctl.signal,
      body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000,
        messages:[{role:"user",content:prompt}] })
    });
    clearTimeout(to);
    const data = await r.json();
    const txt = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    const parsed = JSON.parse(txt.replace(/```json|```/g,'').trim());
    if(parsed && Array.isArray(parsed.steps) && parsed.steps.length === steps.length){
      /* Nadpisujemy WYŁĄCZNIE treść. somatic i cała reszta szkieletu zostaje. */
      steps = steps.map((s,i)=>({ ...s,
        word: parsed.steps[i].word || s.word,
        hint: parsed.steps[i].hint || s.hint,
        max:  parsed.steps[i].max  || s.max }));
      aiState='ok';
      if(idx===0 && document.querySelector('#stage .scene')) renderStep();
    } else { aiState='offline'; }
  }catch(e){ aiState='offline'; }
}

