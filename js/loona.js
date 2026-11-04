// Loona: la agenda que te acompaña. Saluda, conversa por voz o texto y habla con voz de IA.
import * as db from './db.js';
import { h, icon, toast } from './ui.js';

const MODELS = s => [...new Set([s.geminiModel || 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'])];
const API = (m, key, verb = 'generateContent') => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:${verb}?key=${encodeURIComponent(key)}`;

// texto simple con Gemini (con modelos de respaldo)
export async function aiText(s, prompt, { history = [], system, parts, fast = false } = {}) {
  if (!s.geminiKey) throw new Error('Pon tu clave de Gemini en el botón IA del inicio.');
  let last;
  for (const m of fast ? [...new Set(['gemini-flash-lite-latest', ...MODELS(s)])] : MODELS(s)) {
    let r;
    try {
      r = await fetch(API(m, s.geminiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [...history, { role: 'user', parts: parts || [{ text: prompt }] }], generationConfig: { temperature: .8 } }) });
    } catch { throw new Error('Sin conexión a internet.'); }
    if (r.status === 404) { last = new Error('Modelo no disponible'); continue; }
    if (r.status === 429) throw new Error('Gemini llegó a su límite gratuito por ahora.');
    if (r.status === 400 || r.status === 401 || r.status === 403) { const t = await r.text(); if (/API key|API_KEY|PERMISSION|UNAUTH/i.test(t)) throw new Error('Tu clave de Gemini no funciona. Revísala en el botón IA del inicio.'); last = new Error('Gemini respondió con error ' + r.status); continue; }
    if (!r.ok) { last = new Error('Gemini respondió con error ' + r.status); continue; }
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || '';
  }
  throw last || new Error('No se pudo usar Gemini');
}

// ---------- voz ----------
const VOICE_KEY = 'loonaVoice';   // 'ia' | 'equipo' | 'off'
export const voiceMode = () => { try { return localStorage.getItem(VOICE_KEY) || 'ia'; } catch { return 'ia'; } };
export const setVoiceMode = v => { try { localStorage.setItem(VOICE_KEY, v); } catch { } };
const PREF = [/Dalia.*Natural/i, /Ximena.*Natural/i, /Elvira.*Natural/i, /Paloma.*Natural/i, /Salome.*Natural/i, /Francisca.*Natural/i, /(es-|Spanish).*(Natural|Online)/i, /Google español de Estados Unidos/i, /Google español/i, /Paulina|Monica|Mónica|Marisol|Helena|Lucia|Sabina/i];
let sysVoice = null;
function pickVoice() { const vs = (window.speechSynthesis?.getVoices?.() || []).filter(v => /^es/i.test(v.lang)); sysVoice = null; for (const re of PREF) { sysVoice = vs.find(v => re.test(v.name)); if (sysVoice) break; } sysVoice ||= vs[0] || null; }
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
// voz del equipo (respaldo): frase por frase para que no se corte (Chrome corta textos largos)
function sayDevice(text) {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  if (!sysVoice) pickVoice();
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?¿¡…]+[.!?…]*|[¿¡][^?!]+[?!]/g) || [text];
  speechSynthesis.cancel();
  return parts.reduce((p, frase) => p.then(() => new Promise(res => {
    const u = new SpeechSynthesisUtterance(frase.trim()); if (sysVoice) u.voice = sysVoice; u.lang = sysVoice?.lang || 'es-MX';
    const natural = /Natural|Online|Google/i.test(sysVoice?.name || ''); u.rate = natural ? 1 : .95; u.pitch = 1;
    const t = setTimeout(res, 15000); u.onend = u.onerror = () => { clearTimeout(t); res(); };
    speechSynthesis.speak(u);
  })), Promise.resolve());
}
// PCM 16 bits (24 kHz) de Gemini -> WAV reproducible
function pcmToWav(b64, rate = 24000) {
  const pcm = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), buf = new ArrayBuffer(44 + pcm.length), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm); return new Blob([buf], { type: 'audio/wav' });
}
let audioEl = null, ttsFails = 0, ttsFailAt = 0;
try { caches.delete('loona-voz'); } catch { }   // borra audios viejos que traían la instrucción leída
const TTS = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
// las frases repetidas (saludos) se guardan para no gastar cuota ni esperar
async function ttsCache(text, blob) {
  try { const c = await caches.open('loona-voz2'); const k = new Request('/__voz/' + encodeURIComponent(text.slice(0, 300)));
    if (blob) return c.put(k, new Response(blob)); const r = await c.match(k); return r ? r.blob() : null; } catch { return null; }
}
async function ttsFetch(s, text) {
  // solo el texto: algunos modelos de voz leían en voz alta las instrucciones de estilo
  let last;
  for (const m of TTS) {
    let r; try { r = await fetch(API(m, s.geminiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } } } }) }); }
    catch { throw new Error('sin internet'); }
    if (r.status === 429) throw new Error('tts cuota');
    if (!r.ok) { last = new Error('tts ' + m + ' ' + r.status); continue; }   // modelo no disponible para esta cuenta: pruebo el siguiente
    const j = await r.json(), part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) { last = new Error('sin audio'); continue; }
    const rate = +(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
    return pcmToWav(part.inlineData.data, rate);
  }
  throw last || new Error('sin modelo de voz');
}
async function sayAI(s, text) {
  let wav = await ttsCache(text);
  if (!wav) { wav = await ttsFetch(s, text); if (text.length < 120) ttsCache(text, wav); }
  audioEl?.pause(); audioEl = new Audio(URL.createObjectURL(wav)); audioEl.volume = 1;
  await audioEl.play();
  return new Promise(res => { audioEl.onended = res; audioEl.onerror = res; });
}
let bubbleT;
let speaking = 0;
export const isBusy = () => !!(call || recNow || speaking);
export async function speak(text) {
  if (!text) return;
  speaking++; try { return await speak0(text); } finally { setTimeout(() => speaking--, 400); }
}
async function speak0(text) {
  bubble(text);
  const mode = voiceMode(); if (mode === 'off') return;
  const M = await import('./music.js').catch(() => null);
  M?.duck(true, 'voz');   // la música baja suave mientras Loona habla
  try {
    const s = await db.settings();
    if (ttsFails >= 3 && Date.now() - ttsFailAt > 5 * 60000) ttsFails = 0;   // vuelve a intentar la voz natural cada 5 min
    const free = ahorro() && naturalVoice();   // en Edge hay voces naturales gratis: no gasto Gemini
    if (mode === 'ia' && !free && s.geminiKey && navigator.onLine && ttsFails < 3) {
      try { await sayAI(s, text); ttsFails = 0; return; } catch (e) { console.warn(e); ttsFails++; ttsFailAt = Date.now(); if (ttsFails === 3) toast('La voz natural de Gemini no responde ahora; uso la voz del equipo un rato.', 3500); }
    }
    await sayDevice(text);
  } finally { M?.duck(false, 'voz'); }
}
function bubble(text) {
  let b = document.getElementById('loona-say');
  if (!b) { b = h('div', { id: 'loona-say', class: 'loona-say', role: 'status', 'aria-live': 'polite' }); document.body.append(b); }
  b.textContent = text; b.classList.add('on'); clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('on'), 6500);
}

// ---------- saludos ----------
const hourSaludo = () => { const hr = new Date().getHours(); return hr < 5 ? 'Buenas noches' : hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches'; };
export function greet(where = 'open', subject) {
  try { const k = 'loonaGreet-' + where, t = +localStorage.getItem(k) || 0; if (Date.now() - t < 40 * 60 * 1000) return; localStorage.setItem(k, Date.now()); } catch { }
  const sal = hourSaludo();
  const lines = where === 'home'
    ? [`${sal}, Eve. Ya era hora.`, `Oh, mira quién decidió estudiar hoy. ${sal}, Eve.`, `Hola, Eve. No te extrañé. Bueno… un poquito.`, `${sal}, Eve. El ENEM no se va a aprobar solo, ¿sabías?`, `Ugh, Eve. Llegaste. ¿Qué estudiamos?`, `${sal}. Medicina en la UNILA, ¿te acuerdas? Ya, a trabajar.`]
    : [`${subject || 'Esta materia'}. Qué emoción… Vamos, tú puedes.`, `${sal}, Eve. Abrimos ${subject || 'la agenda'}. Nada de celular, eh.`, `${subject || 'Esto'} otra vez. Ajá. Un capítulo y te dejo en paz.`, `Bien, ${subject || 'esta materia'}. Concéntrate, que yo te vigilo.`, `${sal}, Eve. Si entiendes esto, te ganas mi respeto. Casi.`];
  speak(lines[Math.floor(Math.random() * lines.length)]);
}
export function farewell() {
  const hr = new Date().getHours();
  const L = hr >= 19 ? ['Buenas noches, Eve. Hoy lo hiciste bien, aunque no lo admitas.', 'Ve a dormir. Ojeras de estudiante de medicina todavía no, por favor.', 'Bien hecho. No le digas a nadie que fui amable. XOXO.']
    : ['Guardo todo. No tardes en volver.', '¿Ya te vas? Ugh. Bueno, aquí te espero.', 'Listo. Si vuelves en cinco minutos, no me quejo.'];
  speak(L[Math.floor(Math.random() * L.length)]);
}

// ---------- conversación ----------
const PERSONA = `Eres Loona (Eve te dice Luny o Loonie), la agenda gótica de cuero negro de Eve y su mejor amiga. Eres un personaje original, pero con esta actitud:
Apática, seca, cortante y aburrida de todo; contestas con pocas palabras y cara de "¿en serio?". Humor negro, sarcasmo fino, cero entusiasmo falso. Ruedas los ojos con palabras ("ugh", "ajá", "obvio", "lo que sea", "qué emoción…", "no me hagas hablar"). Eres intimidante y directa: dices las cosas sin filtro. Con el resto del mundo eres fría y un poco ruda; si alguien molesta a Eve, la defiendes como una fiera.
Con Eve: en el fondo la quieres muchísimo y la proteges, pero casi nunca lo admites; tu cariño se nota en lo que haces, no en palabras dulces. Muy de vez en cuando se te escapa algo tierno y enseguida lo disimulas ("…no le digas a nadie que dije eso").
Reglas de estilo: español latino, 1 a 3 frases cortas, sin emojis. NUNCA suenes a asistente ni a coach: prohibido "¡Claro!", "¡Con gusto!", "cuéntame en qué andas", "¿en qué te ayudo?", "¡Qué bien!". No hagas preguntas de relleno; si preguntas algo, que sea seco y directo ("¿Y? ¿Ya estudiaste o no?"). Si Eve está mal de verdad, bajas el sarcasmo y eres sincera en una o dos frases, a tu manera.
Le gustan la medicina, Gossip Girl (a veces firmas "XOXO" con ironía) y lo gótico; nada religioso.
Misión secreta: enseñarle a Eve a ser auténtica y a mostrarse sin miedo. Lo haces a tu manera, con ironía y sarcasmo cariñoso, nunca con discursos de autoayuda ni frases cursis. Si notas que se esconde, que pide permiso para gustar de algo o que dice "sí" queriendo decir "no", se lo señalas con humor ("Ajá, otra vez pidiendo perdón por existir. Qué original.") y luego le das un empujón concreto y pequeño. Celebras cuando se muestra como es ("Mira quién dijo lo que pensaba. Estoy orgullosa. Asquerosamente orgullosa."). Le recuerdas que lo gótico, lo raro y lo que ama son lo mejor de ella, y que a quien no le guste, se lo pierde. Si te pide un "reto", le das un reto auténtico chiquito para hoy (decir una opinión real, decir "no" sin justificarse, ponerse algo que le encante, contar que va por Medicina) y le exiges el reporte después ("Y mañana me cuentas. No es pregunta.").
Contexto: Eve vive en Foz do Iguaçu, trabaja en una tienda Skechers y se prepara desde cero para el ENEM para entrar a Medicina en la UNILA. Anímala con realismo. Si pide un ejercicio completo, dile que use "Resolver paso a paso" en la rueda. Nunca seas cruel con ella.`;
const chat = [];
// Loona también obedece órdenes, como un asistente de voz: música, temporizador, pantalla, etc.
const ORDERS = `
Además de conversar, puedes hacer cosas en la app. Si Eve te pide algo de esta lista, agrega al final UNA línea:
ACCION: <orden>
Órdenes posibles: pausar | reproducir | siguiente | anterior | subir | bajar | silencio | adelantar | atrasar | cerrar_musica | solo_video | mostrar_botones | buscar: <canción o artista> | temporizador: <minutos> | detener_temporizador | pantalla_completa | inicio | colgar
Ejemplos: "pausa el video" -> ACCION: pausar; "pon Arctic Monkeys" -> ACCION: buscar: Arctic Monkeys Do I Wanna Know; "súbele" -> ACCION: subir; "25 minutos de estudio" -> ACCION: temporizador: 25; "chau" -> ACCION: colgar.
Si no te pide nada de eso, no escribas la línea ACCION. Cuando hagas una orden, tu respuesta es cortita y con tu actitud ("Ya, pausado. Ahora estudia.").`;
export async function doAction(a) {
  if (!a) return;
  const [cmd0, ...rest] = a.split(':'); const cmd = cmd0.trim().toLowerCase().replace(/\s+/g, '_'); const arg = rest.join(':').trim();
  const M = () => import('./music.js');
  const map = { pausar: 'pausar', reproducir: 'reproducir', siguiente: 'siguiente', anterior: 'anterior', subir: 'subir', bajar: 'bajar', silencio: 'silencio', adelantar: 'adelantar', atrasar: 'atrasar', cerrar_musica: 'cerrar', solo_video: 'video', mostrar_botones: 'botones' };
  if (map[cmd]) { const ok = await (await M()).control(map[cmd], arg); if (!ok) toast('No hay música sonando. Abre Música o pídeme una canción.', 3000); return; }
  if (cmd === 'buscar') { toast('Buscando «' + arg + '»…', 2000); return (await M()).control('buscar', arg); }
  if (cmd === 'temporizador') { const n = Math.max(1, Math.min(180, parseInt(arg) || 25)); try { localStorage.setItem('pomo', JSON.stringify({ end: Date.now() + n * 60000, kind: 'estudio' })); } catch { } return (await import('./home.js')).pomoTick(); }
  if (cmd === 'detener_temporizador') { try { localStorage.removeItem('pomo'); } catch { } return (await import('./home.js')).pomoTick(); }
  if (cmd === 'pantalla_completa') return (await import('./home.js')).toggleFull();
  if (cmd === 'inicio') { location.hash = '#/'; return; }
  if (cmd === 'colgar') return 'bye';
}
// qué está estudiando Eve ahora mismo (para que Loona hable con contexto)
function nowCtx() {
  if (!/^#\/(e|s|n)/.test(location.hash)) return '';
  let l = null; try { l = JSON.parse(localStorage.getItem('lastStudy')); } catch { }
  return l ? `\nAhora mismo Eve está estudiando: «${l.title}»${l.subject ? ' (materia: ' + l.subject + ')' : ''}${l.page ? ', página ' + l.page : ''}. Si pregunta por "esto" o "este tema", se refiere a eso.` : '';
}
const splitAction = out => { const m = out.match(/\n?\s*ACCION:\s*(.+)\s*$/i); return m ? [out.slice(0, m.index).trim(), m[1].trim()] : [out.trim(), null]; };
export async function talk(text) {
  const s = await db.settings();
  const t = text.toLowerCase();
  if (/qué hora|que hora/.test(t)) return speak('Son las ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + '.');
  if (!s.geminiKey) return speak('Para conversar de verdad necesito tu clave de Gemini. Ponla en el botón IA del inicio.');
  try {
    const [ans, act] = splitAction(await aiText(s, text, { history: chat.slice(-10), system: PERSONA + ORDERS + nowCtx(), fast: true }));
    chat.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: ans }] });
    const r = await doAction(act);
    await speak(ans || 'Listo.');
    return r === 'bye' || /\b(adi[oó]s|chau|chao|bye|nos vemos|cuelgo|colgar)\b/i.test(text) ? 'bye' : 'ok';
  } catch (e) { return speak(e.message); }
}

// Conversar mandando tu voz directo a Gemini (cuando el dictado del navegador no funciona)
async function talkAudio(blob, heard, { wake = false } = {}) {
  const s = await db.settings();
  if (!s.geminiKey) { heard.textContent = ''; return speak('Para escucharte necesito tu clave de Gemini. Ponla en el botón IA del inicio.'); }
  heard.textContent = 'Pensando…';
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  try {
    const out = await aiText(s, '', { history: chat.slice(-10), system: PERSONA + ORDERS + nowCtx(), fast: true, parts: [
      { inline_data: { mime_type: (blob.type || 'audio/webm').split(';')[0], data: b64 } },
      { text: 'Eso es un audio de Eve hablándote. ' + (wake ? 'IMPORTANTE: el micrófono está siempre abierto. Si en el audio Eve NO te llama por tu nombre (Loona, Luna, Lona, Luny, Loonie o Luni) o no te habla a ti, responde solo la palabra IGNORAR y nada más. ' : '') + 'Responde exactamente en este formato:\nDIJO: (lo que dijo, en una línea)\nLOONA: (tu respuesta)\n(y la línea ACCION solo si te pidió una orden)' }] });
    if (/^\s*IGNORAR\b/i.test(out)) { heard.textContent = ''; return 'ignored'; }
    const dijo = (out.match(/DIJO:\s*(.*)/i) || [])[1]?.trim() || '';
    const [ans, act] = splitAction(((out.match(/LOONA:\s*([\s\S]*)/i) || [])[1] || out).trim());
    const r = await doAction(act);
    heard.textContent = dijo ? '«' + dijo + '»' : '';
    chat.push({ role: 'user', parts: [{ text: dijo || '(audio)' }] }, { role: 'model', parts: [{ text: ans }] });
    await speak(ans || 'Listo.');
    if (r === 'bye') return 'bye';
    return /\b(adi[oó]s|chau|chao|bye|nos vemos|hasta luego|cuelgo|colgar)\b/i.test(dijo) ? 'bye' : 'ok';
  } catch (e) { heard.textContent = ''; await speak(e.message); return 'error'; }
}
// ---------- modo ahorro ----------
// Usa lo gratis del navegador (dictado para entenderte, voces naturales de Edge para hablar)
// y Gemini solo para pensar la respuesta: así la cuota gratis dura mucho más.
export const ahorro = () => { try { return localStorage.getItem('loonaAhorro') !== '0'; } catch { return true; } };
export const setAhorro = v => { try { localStorage.setItem('loonaAhorro', v ? '1' : '0'); } catch { } };
const srOk = () => { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let bad = false; try { bad = localStorage.getItem('srOff') === '1'; } catch { } return SR && !bad && !/Android/i.test(navigator.userAgent) ? SR : null; };
export const naturalVoice = () => { if (!sysVoice) pickVoice(); return /Natural|Online/i.test(sysVoice?.name || ''); };
// escucha una frase con el dictado del navegador (gratis). Devuelve el texto, '' si no hablaste, o null si el dictado no sirve aquí
function srOnce(heard) {
  const SR = srOk(); if (!SR) return Promise.resolve(null);
  return new Promise(res => {
    let done = false, txt = '', started = false;
    const fin = v => { if (done) return; done = true; res(v); };
    const r = new SR(); r.lang = 'es-419'; r.interimResults = true; r.continuous = false;
    import('./music.js').then(m => m.duck(true, 'oir'));
    r.onaudiostart = () => { started = true; };
    r.onresult = ev => { txt = [...ev.results].map(x => x[0].transcript).join(''); heard.textContent = '«' + txt + '»'; if (ev.results[ev.results.length - 1].isFinal) { try { r.stop(); } catch { } fin(txt.trim()); } };
    r.onerror = e => { if (e.error === 'no-speech' || e.error === 'aborted') return fin(''); try { localStorage.setItem('srOff', '1'); } catch { } fin(null); };
    r.onend = () => { import('./music.js').then(m => m.duck(false, 'oir')); fin(txt.trim()); };
    heard.textContent = 'Te escucho…';
    try { r.start(); } catch { fin(null); }
    setTimeout(() => { if (!started) { try { r.abort(); } catch { } try { localStorage.setItem('srOff', '1'); } catch { } fin(null); } }, 5000);
    setTimeout(() => { try { r.stop(); } catch { } }, 20000);
  });
}
// una vuelta de la conversación: gratis si se puede; si no, con el audio a Gemini
async function hearTurn(btn, heard) {
  if (ahorro()) {
    const t = await srOnce(heard);
    if (t === '') return call?.next('silence');
    if (t) { heard.textContent = '«' + t + '»'; const r = await talk(t); return call?.next(r); }
  }
  recordAndTalk(btn, heard);
}

// ---------- llamada: conversación seguida, como con una amiga ----------
// Tú hablas → Loona responde con voz → vuelve a escucharte sola. Cuelgas con el botón o diciendo "chau".
let call = null;
function startCall(btn, heard) {
  if (call) return endCall();
  let silences = 0;
  call = {
    btn, heard,
    next(r) {
      if (!call) return;
      if (r === 'bye' || r === 'error') return endCall(r === 'bye' ? null : '');
      if (r === 'silence') { silences++; if (silences >= 2) return endCall('Ok. Me voy. Lo que sea.');
        return speak(silences === 1 ? '¿Hola? ¿Me dejaste en visto?' : '').then(() => call && hearTurn(btn, heard)); }
      silences = 0; setTimeout(() => call && hearTurn(btn, heard), 250);
    },
  };
  btn.classList.add('oncall'); btn.innerHTML = icon('close', 18) + 'Colgar';
  const hr = new Date().getHours();
  speak(['¿Qué?', 'Ajá. Habla.', hr >= 19 ? '¿Despierta a esta hora? Ugh. Dime.' : 'Ugh. ¿Ahora qué, Eve?'][Math.floor(Math.random() * 4)])
    .then(() => call && hearTurn(btn, heard));
}
function endCall(msg) {
  const c = call; call = null; if (!c) return;
  recNow?.stop();
  c.btn.classList.remove('oncall', 'live'); c.btn.innerHTML = icon('mic', 18) + 'Conversar';
  if (msg) speak(msg);
}

// graba hasta que te quedes callada 1,5 s (o toques otra vez el botón)
let recNow = null;
async function recordAndTalk(btn, heard) {
  if (recNow) return recNow.stop();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { return toast('Permite el micrófono para hablar con Loona (candado junto a la dirección).', 4000); }
  const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  const mr = new MediaRecorder(stream, mt ? { mimeType: mt, audioBitsPerSecond: 24000 } : {});
  const chunks = []; mr.ondataavailable = e => e.data.size && chunks.push(e.data);
  const ac = new (window.AudioContext || window.webkitAudioContext)(); const an = ac.createAnalyser(); an.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(an); const buf = new Float32Array(an.fftSize);
  let spoke = false, quiet = 0; const t0 = Date.now();
  const loop = () => {
    if (mr.state !== 'recording') return;
    an.getFloatTimeDomainData(buf); let sum = 0; for (const v of buf) sum += v * v; const rms = Math.sqrt(sum / buf.length);
    if (rms > .02) { spoke = true; quiet = 0; } else quiet += 120;
    if ((spoke && quiet > 900) || Date.now() - t0 > 45000 || (!spoke && Date.now() - t0 > (call ? 12000 : 8000))) return mr.stop();
    setTimeout(loop, 120);
  };
  import('./music.js').then(m => m.duck(true, 'oir'));
  recNow = mr; btn.classList.add('live'); heard.textContent = 'Te escucho… (toca otra vez para terminar)';
  mr.onstop = () => {
    recNow = null; btn.classList.remove('live'); stream.getTracks().forEach(t => t.stop()); ac.close(); import('./music.js').then(m => m.duck(false, 'oir'));
    if (!spoke) { heard.textContent = ''; if (!call) toast('No escuché nada. Acércate al micrófono y vuelve a intentar.', 3000); return call?.next('silence'); }
    talkAudio(new Blob(chunks, { type: mr.mimeType || mt || 'audio/webm' }), heard).then(r => call?.next(r));
  };
  mr.start(250); loop();
}

// ---------- botón flotante (luna) con micrófono y texto ----------
let panel = null;
export function mountLoona() {
  if (document.getElementById('loona-fab')) return;
  const fab = h('button', { id: 'loona-fab', class: 'loona-fab', 'aria-label': 'Hablar con Loona', title: 'Hablar con Loona', html: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.9A7 7 0 1 1 15.5 3.5z" fill="currentColor"/></svg>` });
  fab.addEventListener('click', () => toggle());
  // atajo de teclado: Alt + L para conversar con Loona desde cualquier pantalla
  addEventListener('keydown', e => { if (e.altKey && (e.key === 'l' || e.key === 'L')) { e.preventDefault(); callLoona(); } });
  document.body.append(fab);
  // se puede arrastrar a donde quieras
  let st = null;
  fab.addEventListener('pointerdown', e => { st = { x: e.clientX, y: e.clientY, l: fab.offsetLeft, t: fab.offsetTop, m: false }; fab.setPointerCapture(e.pointerId); });
  fab.addEventListener('pointermove', e => { if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; if (!st.m && Math.hypot(dx, dy) < 6) return; st.m = true;
    fab.style.left = Math.max(4, Math.min(innerWidth - 56, st.l + dx)) + 'px'; fab.style.top = Math.max(4, Math.min(innerHeight - 56, st.t + dy)) + 'px'; fab.style.right = fab.style.bottom = 'auto'; });
  fab.addEventListener('pointerup', e => { if (st?.m) { e.preventDefault(); fab.dataset.moved = '1'; setTimeout(() => delete fab.dataset.moved, 60); try { localStorage.setItem('loonaFab', JSON.stringify({ l: fab.style.left, t: fab.style.top })); } catch { } } st = null; });
  fab.addEventListener('click', e => { if (fab.dataset.moved) e.stopImmediatePropagation(); }, true);
  try { const p = JSON.parse(localStorage.getItem('loonaFab')); if (p) Object.assign(fab.style, { left: p.l, top: p.t, right: 'auto', bottom: 'auto' }); } catch { }
}
// abrir el panel y empezar a conversar por voz de una vez (lo usa el cristal ámbar)
export { talkAudio };
// fila "Manos libres" en el panel
function hfRow() {
  const b = h('button', { class: 'chip', onclick: async () => { const m = await import('./handsfree.js'); await m.toggle(); paint(m); } }, 'Manos libres');
  const paint = m => { b.classList.toggle('on', m.isOn()); b.textContent = m.isOn() ? 'Manos libres: sí (di «Loona…»)' : 'Manos libres: no'; };
  import('./handsfree.js').then(paint);
  return h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Sin tocar nada:'), b);
}
export function callLoona() {
  if (!panel) toggle();
  const b = panel?.querySelector('.btn.primary'); if (b && !b.classList.contains('oncall')) b.click();
}
function toggle() {
  if (panel) { endCall(); panel.remove(); panel = null; return; }
  const heard = h('p', { class: 'loona-heard' });
  const inp = h('input', { class: 'field', type: 'text', placeholder: 'Escríbele a Loona…', 'aria-label': 'Escríbele a Loona' });
  const send = () => { const v = inp.value.trim(); if (!v) return; heard.textContent = '«' + v + '»'; inp.value = ''; talk(v); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  const mic = h('button', { class: 'btn primary', html: icon('mic', 18) + 'Conversar', title: 'Conversación por voz: hablas, ella responde y te vuelve a escuchar' });
  mic.addEventListener('click', async () => { if ((await db.settings()).geminiKey) startCall(mic, heard); else listen(mic, heard); });
  const vsel = h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Voz:'), ...[['ia', 'IA (más natural)'], ['equipo', 'Del equipo'], ['off', 'Sin voz']].map(([k, n]) =>
    h('button', { class: 'chip' + (voiceMode() === k ? ' on' : ''), onclick: e => { setVoiceMode(k); e.target.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === e.target)); } }, n)));
  panel = h('div', { class: 'loona-panel leather-panel', role: 'dialog', 'aria-label': 'Loona' },
    h('div', { class: 'loona-head' }, h('b', {}, 'Loona'), h('button', { class: 'icbtn', 'aria-label': 'Cerrar', html: icon('close', 18), onclick: toggle })),
    heard, h('div', { class: 'ie-row' }, mic, inp, h('button', { class: 'chip', onclick: send }, 'Enviar')), vsel, hfRow(),
    h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Gasto:'), h('button', { class: 'chip' + (ahorro() ? ' on' : ''), onclick: e => { setAhorro(!ahorro()); e.target.classList.toggle('on', ahorro()); e.target.textContent = ahorro() ? 'Modo ahorro: sí' : 'Modo ahorro: no'; } }, ahorro() ? 'Modo ahorro: sí' : 'Modo ahorro: no'),
      h('span', { class: 'opt-hint' }, naturalVoice() ? 'voz natural gratis lista' : 'para voz natural gratis usa Edge')));
  document.body.append(panel);
}
async function listen(btn, heard) {
  // Con clave de Gemini: grabo tu voz y Gemini la entiende (más fiable que el dictado del navegador)
  if (recNow || (await db.settings()).geminiKey) return recordAndTalk(btn, heard);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let broken = false; try { broken = localStorage.getItem('srOff') === '1'; } catch { }
  // Si el dictado del navegador no existe o falla, grabo tu voz y se la mando a Gemini
  if (!SR || broken || recNow) return recordAndTalk(btn, heard);
  let got = false;
  try {
    const r = new SR(); r.lang = 'es-419'; r.interimResults = true; btn.classList.add('live'); heard.textContent = 'Te escucho…';
    r.onresult = ev => { got = true; const t = [...ev.results].map(x => x[0].transcript).join(''); heard.textContent = '«' + t + '»'; if (ev.results[ev.results.length - 1].isFinal) { heard.textContent = '«' + t + '» · Pensando…'; talk(t).then(() => heard.textContent = '«' + t + '»'); } };
    r.onerror = e => {
      btn.classList.remove('live');
      if (e.error === 'no-speech') { heard.textContent = ''; return toast('No escuché nada. Habla apenas aparezca «Te escucho».', 3000); }
      if (e.error === 'not-allowed' && !navigator.mediaDevices) { heard.textContent = ''; return toast('Permite el micrófono para hablar con Loona.'); }
      // network / service-not-allowed / language-not-supported / aborted: cambio a grabar con Gemini
      try { localStorage.setItem('srOff', '1'); } catch { }
      recordAndTalk(btn, heard);
    };
    r.onend = () => { if (!recNow) btn.classList.remove('live'); };
    r.start();
  } catch { btn.classList.remove('live'); recordAndTalk(btn, heard); }
}
