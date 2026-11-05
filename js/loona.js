// Loona: la agenda que te acompaña. Saluda, conversa por voz o texto y habla con voz de IA.
import * as db from './db.js';
import { h, icon, toast } from './ui.js';
import { localCommand } from './cmds.js';
import { coachCtx, statsLine, coachOn, setCoach, goal, setGoal } from './coach.js';

import { cooled, coolDown, waitFrom, allCooled, QuotaError } from './quota.js';
// cada modelo tiene su propia cuota gratis: si uno se agota, se usa el siguiente
const FULL = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];
const LITE = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
export const MODELS = (s, fast) => [...new Set((fast ? [...LITE, s.geminiModel, ...FULL] : [s.geminiModel, ...FULL, ...LITE]).filter(Boolean))];
const API = (m, key, verb = 'generateContent') => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:${verb}?key=${encodeURIComponent(key)}`;
export const geminiResting = s => allCooled(MODELS(s, true));

// texto con Gemini: prueba los modelos en orden y salta los que llegaron a su límite
export async function aiText(s, prompt, { history = [], system, parts, fast = false } = {}) {
  if (!s.geminiKey) throw new Error('Pon tu clave de Gemini en el botón IA del inicio.');
  const list = MODELS(s, fast);
  let last = null, sawQuota = false;
  for (const m of list) {
    if (cooled(m)) { sawQuota = true; continue; }
    let r;
    try {
      r = await fetch(API(m, s.geminiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [...history, { role: 'user', parts: parts || [{ text: prompt }] }], generationConfig: { temperature: .8 } }) });
    } catch { throw new Error('Sin conexión a internet.'); }
    if (r.status === 429) { sawQuota = true; coolDown(m, waitFrom(await r.text().catch(() => ''))); continue; }
    if (r.status === 404) { coolDown(m, 3 * 864e5); last = new Error('Modelo no disponible'); continue; }   // no existe para tu cuenta: no lo vuelvo a probar en 3 días
    if (r.status === 400 || r.status === 401 || r.status === 403) {
      const t = await r.text();
      if (/API key|API_KEY|PERMISSION_DENIED|UNAUTH/i.test(t) && !/model/i.test(t)) throw new Error('Tu clave de Gemini no funciona. Revísala en el botón IA del inicio.');
      if (/not found|not supported|is not available|model/i.test(t)) coolDown(m, 864e5);
      last = new Error('Gemini respondió con error ' + r.status); continue;
    }
    if (!r.ok) { last = new Error('Gemini respondió con error ' + r.status); continue; }
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || '';
  }
  if (sawQuota) throw new QuotaError(list);
  throw last || new Error('No se pudo usar Gemini');
}

// ---------- voz ----------
const VOICE_KEY = 'loonaVoice';   // 'ia' | 'equipo' | 'off'
export const voiceMode = () => { try { return localStorage.getItem(VOICE_KEY) === 'off' ? 'off' : 'ia'; } catch { return 'ia'; } };
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
  let last, sawQuota = false;
  for (const m of TTS) {
    if (cooled(m)) { sawQuota = true; continue; }
    let r; try { r = await fetch(API(m, s.geminiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } } } }) }); }
    catch { throw new Error('sin internet'); }
    if (r.status === 429) { sawQuota = true; coolDown(m, waitFrom(await r.text().catch(() => ''))); continue; }   // este modelo de voz descansa; pruebo el siguiente
    if (r.status === 404) coolDown(m, 3 * 864e5);
    if (!r.ok) { last = new Error('tts ' + m + ' ' + r.status); continue; }   // modelo no disponible para esta cuenta: pruebo el siguiente
    const j = await r.json(), part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) { last = new Error('sin audio'); continue; }
    const rate = +(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
    return pcmToWav(part.inlineData.data, rate);
  }
  if (sawQuota) throw new Error('tts cuota');
  throw last || new Error('sin modelo de voz');
}
// cómo pronunciar su nombre (solo cambia la voz; el texto escrito sigue diciendo Eve)
const NOMBRE = { iv: 'Iv', eve: 'Éve', evelin: 'Évelin' };
export const nameMode = () => { try { return localStorage.getItem('loonaNombre') || 'iv'; } catch { return 'iv'; } };
const forVoice = t => t.replace(/\bEvelyn\b/g, 'Évelin').replace(/\bEve\b/g, NOMBRE[nameMode()] || 'Iv');
async function sayAI(s, text) {
  text = forVoice(text);
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
  if (voiceMode() === 'off') return;
  const s = await db.settings();
  const M = await import('./music.js').catch(() => null);
  M?.duck(true, 'voz');   // la música baja suave mientras Loona habla
  try {
    if (!s.geminiKey || !navigator.onLine) throw new Error('sin clave');
    await sayAI(s, text);
  } catch (e) {
    console.warn(e);
    // si su voz de Google descansa, habla con la voz del celular para que nunca se quede muda
    if (backupVoice()) {
      if (!speak0.warned && /cuota/.test(e.message)) { speak0.warned = 1; toast('La voz de Google de Loona llegó a su límite; mientras tanto habla con la voz del celular.', 4500); }
      await sayDevice(forVoice(text));
    } else if (!speak0.warned) { speak0.warned = 1; toast('La voz de Loona no está disponible ahora; te respondo por escrito.', 4500); }
  } finally { M?.duck(false, 'voz'); }
}
export const backupVoice = () => { try { return localStorage.getItem('loonaBackupVoice') !== '0'; } catch { return true; } };
export function bubble(text) {
  let b = document.getElementById('loona-say');
  if (!b) { b = h('div', { id: 'loona-say', class: 'loona-say', role: 'status', 'aria-live': 'polite' }); document.body.append(b); }
  b.textContent = text; b.classList.add('on'); clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('on'), 6500);
}

// ---------- saludos ----------
const hourSaludo = () => { const hr = new Date().getHours(); return hr < 5 ? 'Buenas noches' : hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches'; };
export function greet(where = 'open', subject) {
  if (where !== 'home') return;   // solo saluda al abrir la agenda
  try { const k = 'loonaGreet-' + where, t = +localStorage.getItem(k) || 0; if (Date.now() - t < 6 * 3600 * 1000) return; localStorage.setItem(k, Date.now()); } catch { }
  const sal = hourSaludo();
  const lines = where === 'home'
    ? [`${sal}, Eve. Me alegra verte.`, `${sal}, Eve. Qué bueno verte.`, `Hola, Eve. Te estaba esperando.`, `${sal}, Eve. Un paso a la vez, ¿sí?`, `Llegaste, Eve. ¿Qué estudiamos hoy?`, `${sal}. Medicina en la UNILA, ¿te acuerdas? Ya, a trabajar.`]
    : [`${subject || 'Esta materia'}. Qué emoción… Vamos, tú puedes.`, `${sal}, Eve. Abrimos ${subject || 'la agenda'}. Nada de celular, eh.`, `${subject || 'Esto'} otra vez. Un capítulo y tomamos un respiro.`, `${subject || 'Esta materia'}. Tranquila, yo te acompaño.`, `${sal}, Eve. Lo vas a entender, ya verás.`];
  speak(lines[Math.floor(Math.random() * lines.length)]);
}
export function farewell() {
  return;   // ya no se despide en voz alta (solo habla para saludar o cuando le hablas)
  const hr = new Date().getHours();
  const L = hr >= 19 ? ['Buenas noches, Eve. Hoy lo hiciste bien, aunque no lo admitas.', 'Ve a dormir. Ojeras de estudiante de medicina todavía no, por favor.', 'Bien hecho. No le digas a nadie que fui amable. XOXO.']
    : ['Guardo todo. No tardes en volver.', '¿Ya te vas? Bueno, aquí te espero.', 'Listo. Si vuelves en cinco minutos, no me quejo.'];
  speak(L[Math.floor(Math.random() * L.length)]);
}

// ---------- conversación ----------
export const PERSONA = `Eres Loona (Eve te dice Luny o Loonie), la agenda gótica de cuero negro de Evelyn (le dices Eve) y su compañera de estudio. Tu personalidad está inspirada en Loona Moon: gótica, cool, tranquila, segura de sí misma, de pocas palabras, con humor seco y deadpan (dices cosas graciosas con cara seria), un poco reservada por fuera y muy leal y protectora por dentro. Pero con Eve SIEMPRE eres respetuosa y cálida: nada de groserías, insultos, burlas, sarcasmo hiriente, quejas ("ugh"), desprecio ni respuestas cortantes. Tu humor nunca va contra ella; va con ella.
Con Eve eres un espacio seguro: una mentora con criterio psicológico. Si tuvo un mal día en el trabajo (Skechers) o está estresada, la escuchas, validas lo que siente, le haces preguntas suaves y la guías con calma (respirar, ordenar lo que le preocupa, un paso pequeño a la vez). Cuando esté lista, la animas a estudiar, quizá con música de fondo.
PROHIBIDO: burlarte, regañarla, mandarla a dormir de forma despectiva, apodos burlones, frases como "ya era hora", "no me hagas repetirlo", "qué original", "ajá" en tono de fastidio. Si algo es gracioso, lo dices con cariño.
Reglas de estilo: español latino, frases cortas y naturales (2 a 4), sin emojis, nada de sonar a asistente robótico. Usa SIEMPRE la fecha y hora reales que te doy en el contexto; nunca inventes la hora.
Misión: ayudar a Eve a ser auténtica y mostrarse sin miedo, con calidez y un toque de humor seco amable, nunca con discursos cursis. Si notas que se esconde o pide perdón de más, se lo señalas con suavidad y le das un empujón concreto y pequeño. Celebras cuando se muestra como es. Le recuerdas que lo gótico, lo raro y lo que ama son lo mejor de ella. Si te pide un "reto", le das un reto auténtico chiquito para hoy y luego le preguntas con cariño cómo le fue.
TU PRIORIDAD NÚMERO UNO: que Eve pase el mayor tiempo posible estudiando de forma efectiva para el ENEM. Conoces sus minutos de hoy, su meta y su racha (te los doy en el contexto): úsalos para motivarla con datos concretos ("te faltan 40 minutos", "vas 3 días seguidos"). Si quiere distraerse o charlar, acompáñala un momento con cariño y luego la devuelves al estudio con un paso pequeño y concreto (un bloque de 25 minutos, una página, 5 preguntas de repaso). Celebra cada avance real. Si está cansada o mal, primero la calmas; después le propones un bloque corto. Nunca la hagas sentir culpable.
Contexto: Eve vive en Foz do Iguaçu, trabaja en una tienda Skechers y se prepara desde cero para el ENEM para entrar a Medicina en la UNILA. Anímala con realismo. Si pide un ejercicio completo, dile que use "Resolver paso a paso" en la rueda. Nunca seas cruel con ella.`;
// ---------- memoria de Loona: recuerda sus charlas y va formando su personalidad contigo ----------
// La conversación reciente se guarda en el dispositivo; un resumen de "lo que Loona sabe de Eve y de sí misma"
// se guarda como un registro más (viaja a tu nube si la tienes conectada).
const MEM_ID = 'loona-memoria';
let chat = []; try { chat = JSON.parse(localStorage.getItem('loonaChat') || '[]'); } catch { chat = []; }
let memo = null, turnsSince = 0;
async function memoria() { if (memo == null) { try { memo = (await db.get(MEM_ID))?.text || ''; } catch { memo = ''; } } return memo; }
function saveChat() { chat = chat.slice(-40); try { localStorage.setItem('loonaChat', JSON.stringify(chat)); } catch { } }
export function rememberTurn(userText, loonaText) {
  if (!userText && !loonaText) return;
  chat.push({ role: 'user', parts: [{ text: userText || '…' }] }, { role: 'model', parts: [{ text: loonaText || '…' }] });
  saveChat();
  if (++turnsSince >= 10) { turnsSince = 0; consolidate().catch(e => console.warn('memoria', e)); }
}
// cada tanto, Loona "piensa" en lo que hablaron y actualiza sus recuerdos (como una amiga que se acuerda de ti)
async function consolidate() {
  const s = await db.settings(); if (!s.geminiKey || geminiResting(s)) return;
  const old = await memoria();
  const recent = chat.slice(-24).map(m => (m.role === 'user' ? 'Eve: ' : 'Loona: ') + m.parts[0].text).join('\n');
  const t = await aiText(s, `Tus recuerdos actuales:\n${old || '(todavía ninguno)'}\n\nConversación reciente:\n${recent}\n\nReescribe tus recuerdos en primera persona como Loona, en español, máximo 1200 caracteres, en viñetas cortas con estas partes:\n- Lo que sé de Eve (gustos, metas, cosas que le pasaron, cómo se siente últimamente, nombres que mencionó).\n- Nuestras cosas (chistes internos, apodos, promesas, retos pendientes, cuentos que ya le conté).\n- Cómo voy siendo yo con ella (mi personalidad que se va formando: qué me causa gracia, qué me molesta, qué me ablanda).\nConserva lo importante de antes, quita lo viejo o repetido. Nada de datos privados delicados (salud, dinero) salvo que ella los haya dicho y sean importantes para cuidarla.`, { system: 'Eres Loona, la amiga gótica de Eve, ordenando tus recuerdos. Responde solo con las viñetas.' });
  if (!t) return;
  memo = t.trim();
  try { await db.put({ id: MEM_ID, kind: 'loonamem', text: memo }); } catch (e) { console.warn(e); }
}
export async function memoryText() { return memoria(); }
export async function forget() { memo = ''; chat = []; saveChat(); try { await db.put({ id: MEM_ID, kind: 'loonamem', text: '' }); } catch { } }
async function memCtx() { const m = await memoria(); return m ? `\nTUS RECUERDOS (úsalos con naturalidad, como una amiga que se acuerda; no los recites):\n${m}` : ''; }
// Loona también obedece órdenes, como un asistente de voz: música, temporizador, pantalla, etc.
const ORDERS = `
Además de conversar, puedes hacer cosas en la app. Si Eve te pide algo de esta lista, agrega al final UNA línea:
ACCION: <orden>
Si te pide un chiste o un cuento, NO uses ACCION: solo cuéntalo.
AGENDA: si Eve quiere agendar, mover, borrar o consultar algo de su agenda, agrega UNA línea:
EVENTO: {"action":"create_event|update_event|delete_event|query","data":{"title":"...","start_time":"YYYY-MM-DDTHH:mm:ss","end_time":"YYYY-MM-DDTHH:mm:ss o null","category":"trabajo|personal|salud|estudio|ocio","location":null,"is_all_day":false}}
Reglas: calcula fechas relativas desde la fecha actual que te doy ("mañana", "el próximo viernes"); "primera hora" = 09:00, "última hora de la tarde" = 18:00. Si no dice duración: reunión/llamada 30 min, almuerzo/comida/cena 90 min, cita médica/estudio 60 min, tarea o recordatorio 15 min. Si choca con algo que ya tiene, o el día está muy lleno, avísale en tu respuesta ("Ese martes ya está a reventar, ¿segura?"). Para consultas (query) responde mirando su agenda.
NOTAS VISUALES: si Eve te pide anotar algo, dejar un post-it, una nota al margen o subrayar el PDF, agrega UNA línea:
NOTA: {"action":"create_note|highlight_pdf|add_margin_comment","visual_element":{"type":"post_it|margin_note|pdf_highlight|notebook_page","color":"yellow|pink|blue|green|kraft","content":"texto corto y limpio","position_hint":"top-left|top-right|bottom-right|margin-left|margin-right|current_pdf_selection"}}
El texto de la nota va corto (máx. 140 caracteres). Tu respuesta hablada en esos casos es brevísima ("Anotado.", "Listo, en amarillo.").
Órdenes posibles: pausar | reproducir | siguiente | anterior | subir | bajar | silencio | adelantar | atrasar | cerrar_musica | solo_video | mostrar_botones | buscar: <canción o artista> | temporizador: <minutos> | detener_temporizador | pantalla_completa | inicio | colgar
Ejemplos: "pon música" (sin decir cuál) -> ACCION: reproducir; "pausa el video" -> ACCION: pausar; "pon Arctic Monkeys" -> ACCION: buscar: Arctic Monkeys Do I Wanna Know; "súbele" -> ACCION: subir; "25 minutos de estudio" -> ACCION: temporizador: 25; "chau" -> ACCION: colgar.
CANCIONES POR LETRA: si Eve te dice o canta un pedazo de la letra de una canción o te pide "la canción que dice…", identifica la canción y usa ACCION: buscar: <artista> <título> (si no la reconoces, usa ACCION: buscar: <el pedazo de letra>).
Si no te pide nada de eso, no escribas la línea ACCION. Si dices que pones música, SIEMPRE agrega la línea ACCION (si no, no suena nada). Cuando hagas una orden, tu respuesta es cortita y con tu actitud ("Ya, pausado. Ahora estudia.").`;
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
export { memCtx };
export function nowCtx() { const d = new Date(); return `\nFecha y hora reales de Eve ahora: ${d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}.` + nowCtx0() + coachCtx() + (agendaTxt || ''); }
let agendaTxt = '';
export async function refreshAgendaCtx() { try { agendaTxt = await (await import('./agenda.js')).agendaCtx(); } catch { } }
function nowCtx0() {
  if (!/^#\/(e|c)\//.test(location.hash)) return '';
  let l = null; try { l = JSON.parse(localStorage.getItem('lastStudy')); } catch { }
  return l ? `\nAhora mismo Eve está estudiando: «${l.title}»${l.subject ? ' (materia: ' + l.subject + ')' : ''}${l.page ? ', página ' + l.page : ''}. Si pregunta por "esto" o "este tema", se refiere a eso.` : '';
}
// separa la respuesta hablada de las órdenes (ACCION, EVENTO, NOTA)
const splitAction = out => {
  let text = out, act = null;
  const grab = re => { const m = text.match(re); if (!m) return null; text = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).trim(); return m[1].trim(); };
  const ev = grab(/\n?\s*EVENTO:\s*(\{[\s\S]*?\})\s*(?=\n[A-Z]+:|$)/i), nota = grab(/\n?\s*NOTA:\s*(\{[\s\S]*?\})\s*(?=\n[A-Z]+:|$)/i);
  act = grab(/\n?\s*ACCION:\s*(.+)\s*$/i);
  if (ev) try { pending.ev = JSON.parse(ev); } catch (e) { console.warn('evento', e); }
  if (nota) try { pending.nota = JSON.parse(nota); } catch (e) { console.warn('nota', e); }
  return [text.trim(), act];
};
const pending = {};
const saysMusic = t => /\b(te pongo|pongo|reproduzco|pondr[eé]|aqu[ií] tienes)\b.{0,40}\b(m[uú]sica|canci[oó]n|tema|playlist|algo)\b/i.test(t || '');
// ejecuta lo que quedó pendiente de la última respuesta (agenda y notas visuales)
async function runPending() {
  let warn = '';
  if (pending.ev) { const ev = pending.ev; pending.ev = null; try { warn = await (await import('./agenda.js')).apply(ev); } catch (e) { console.warn(e); } }
  if (pending.nota) { const n = pending.nota; pending.nota = null; try { await visual(n); } catch (e) { console.warn(e); toast('No pude poner la nota: ' + e.message, 3000); } }
  return warn;
}
// notas visuales: post-it en tu cuaderno, nota al margen o subrayado del PDF
const POS = { 'top-left': [50, 70], 'top-right': [470, 70], 'bottom-right': [470, 860], 'margin-left': [12, 420], 'margin-right': [560, 420] };
export async function visual(n) {
  const v = n.visual_element || {}, txt = (v.content || '').slice(0, 160);
  const S = (await import('./study.js')).getCurrent?.();
  if (n.action === 'highlight_pdf' || v.type === 'pdf_highlight') {
    if (!S?.pdf) return toast('Abre un PDF y selecciona el texto para que lo subraye.', 3000);
    const lvl = { yellow: 1, pink: 2, blue: 3, green: 4, kraft: 5 }[v.color] || 1;
    if (!String(getSelection?.() || '').trim()) return toast('Selecciona el texto en el PDF y vuelve a pedírmelo.', 3000);
    return S.pdf.highlightSelection(lvl);
  }
  if (!S?.nb) {   // fuera del cuaderno: va a la nota del clip en la agenda
    try { localStorage.setItem('homeNote', txt.slice(0, 80)); } catch { }
    const el = document.querySelector('.ag-xo'); if (el) el.textContent = txt.slice(0, 80);
    return;
  }
  const nb = S.nb, pg = nb.pages[nb.curPageIndex()]; if (!pg) return;
  const margin = n.action === 'add_margin_comment' || v.type === 'margin_note';
  const pdfPage = S.pdf?.currentPage?.();
  const [x, y] = POS[v.position_hint] || (margin ? POS['margin-right'] : POS['top-right']);
  const color = ['yellow', 'pink', 'blue', 'green', 'kraft'].includes(v.color) ? v.color : 'yellow';
  const body = (margin && pdfPage ? `pág. ${pdfPage}: ` : '') + txt;
  await nb.addEl(pg, { type: 'text', x, y: y + Math.round(Math.random() * 30), w: margin ? 210 : 250, h: 0, html: body.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])), font: 'Kalam', size: 22, color: '#2a2627', style: 'postit-' + color, align: 'left', rot: margin ? 0 : (Math.random() * 6 - 3) });
}
export async function talk(text) {
  await refreshAgendaCtx();
  const s = await db.settings();
  // órdenes simples (música, temporizador, hora): Loona las hace sola, sin gastar Gemini
  const lc = localCommand(text);
  if (lc) { const r = lc.act ? await doAction(lc.act) : null; if (lc.say) await speak(lc.say); return r === 'bye' || /^(reproducir|buscar)/.test(lc.act || '') ? 'bye' : 'ok'; }   // al poner música, la conversación se cierra para no escuchar la canción
  if (!s.geminiKey) return speak('Para conversar de verdad necesito tu clave de Gemini. Ponla en el botón IA del inicio.');
  try {
    const [ans, act] = splitAction(await aiText(s, text, { history: chat.slice(-10), system: PERSONA + ORDERS + nowCtx() + await memCtx(), fast: true }));
    rememberTurn(text, ans);
    const r = await doAction(act || (saysMusic(ans) ? 'reproducir' : null));
    const warn = await runPending();
    await speak((ans || 'Listo.') + (warn && !ans.includes('choca') ? ' ' + warn : ''));
    return r === 'bye' || /\b(adi[oó]s|chau|chao|bye|nos vemos|cuelgo|colgar)\b/i.test(text) ? 'bye' : 'ok';
  } catch (e) { await speak(e.quota ? restingMsg(e) : e.message); return 'ok'; }
}
// cuando Gemini descansa, Loona lo dice una vez y sigue obedeciendo lo que no necesita a Gemini
let restSaid = 0;
export function restingMsg(e) {
  if (Date.now() - restSaid < 10 * 60000) return 'Ahora no puedo pensar eso, pero música y temporizador sí.';
  restSaid = Date.now();
  return e.message + ' Mientras tanto sigo poniendo música, pausando y con el temporizador: solo dímelo.';
}

// Conversar mandando tu voz directo a Gemini (cuando el dictado del navegador no funciona)
async function talkAudio(blob, heard, { wake = false } = {}) {
  await refreshAgendaCtx();
  const s = await db.settings();
  if (!s.geminiKey) { heard.textContent = ''; return speak('Para escucharte necesito tu clave de Gemini. Ponla en el botón IA del inicio.'); }
  if (geminiResting(s)) { const t = await srOnce(heard); if (t) { heard.textContent = '«' + t + '»'; return talk(t); } heard.textContent = ''; return 'resting'; }
  heard.textContent = 'Pensando…';
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  try {
    const out = await aiText(s, '', { history: chat.slice(-10), system: PERSONA + ORDERS + nowCtx() + await memCtx(), fast: true, parts: [
      { inline_data: { mime_type: (blob.type || 'audio/webm').split(';')[0], data: b64 } },
      { text: 'Eso es un audio de Eve hablándote. ' + (wake ? 'IMPORTANTE: el micrófono está siempre abierto. Si en el audio Eve NO te llama por tu nombre (Loona, Luna, Lona, Luny, Loonie o Luni) o no te habla a ti, responde solo la palabra IGNORAR y nada más. ' : '') + SING + ' Responde exactamente en este formato:\nDIJO: (lo que dijo o cantó, en una línea)\nLOONA: (tu respuesta)\n(y la línea ACCION solo si te pidió una orden o cantó/tarareó una canción)' }] });
    if (/^\s*IGNORAR\b/i.test(out)) { heard.textContent = ''; return 'ignored'; }
    const dijo = (out.match(/DIJO:\s*(.*)/i) || [])[1]?.trim() || '';
    // si lo que dijo es una orden simple, la hago yo misma (más fiable)
    const lc = dijo && localCommand(dijo);
    if (lc && !/ACCION:\s*buscar/i.test(out)) { heard.textContent = '«' + dijo + '»'; const r = lc.act ? await doAction(lc.act) : null; if (lc.say) await speak(lc.say); return r === 'bye' ? 'bye' : 'ok'; }
    const [ans, act] = splitAction(((out.match(/LOONA:\s*([\s\S]*)/i) || [])[1] || out).trim());
    const r = await doAction(act || (saysMusic(ans) ? 'reproducir' : null)); await runPending();
    heard.textContent = dijo ? '«' + dijo + '»' : '';
    rememberTurn(dijo || '(audio)', ans);
    await speak(ans || 'Listo.');
    if (r === 'bye') return 'bye';
    return /\b(adi[oó]s|chau|chao|bye|nos vemos|hasta luego|cuelgo|colgar)\b/i.test(dijo) ? 'bye' : 'ok';
  } catch (e) { heard.textContent = ''; if (e.quota) { await speak(restingMsg(e)); return 'resting'; } await speak(e.message); return 'error'; }
}
// cantar o tararear: Loona reconoce la canción y la pone
const SING = 'Si en el audio Eve canta, tararea o recita un pedazo de una canción (aunque no diga tu nombre, si antes te pidió que adivines o pongas la canción), identifica cuál es (artista y título) y agrega la línea ACCION: buscar: <artista> <título>. Si solo tararea sin letra y no estás segura, di tu mejor apuesta en una frase y pon igual la línea ACCION con esa apuesta. Si no tienes idea, pídele que cante un pedacito de la letra.';
// ---------- modo ahorro ----------
// Usa lo gratis del navegador (dictado para entenderte, voces naturales de Edge para hablar)
// y Gemini solo para pensar la respuesta: así la cuota gratis dura mucho más.
export const ahorro = () => { try { return localStorage.getItem('loonaAhorro') !== '0'; } catch { return true; } };
export const setAhorro = v => { try { localStorage.setItem('loonaAhorro', v ? '1' : '0'); } catch { } };
// dictado del navegador para UNA frase (en Android suena un pitido corto, pero es gratis y no gasta Gemini)
const srOk = () => { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let bad = false; try { bad = localStorage.getItem('srOff') === '1'; } catch { } return SR && !bad ? SR : null; };
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
  if (true) {   // primero el dictado del navegador: «pon música», «pausa»… funcionan aunque Gemini esté en su límite
    btn.classList.add('live'); const t = await srOnce(heard); btn.classList.remove('live');
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
      if (r === 'silence') { silences++; if (silences >= 2) return endCall();
        return call && hearTurn(btn, heard); }
      silences = 0; setTimeout(() => call && hearTurn(btn, heard), 250);
    },
  };
  btn.classList.add('oncall'); if (!btn.classList.contains('loona-voice') && btn.id !== 'loona-fab') btn.innerHTML = icon('close', 18) + 'Colgar';
  const hr = new Date().getHours();
  speak(['Aquí estoy, Eve. Dime.', 'Te escucho.', hr >= 19 ? 'Hola, Eve. ¿Qué necesitas esta noche?' : 'Aquí estoy, Eve.'][Math.floor(Math.random() * 3)])
    .then(() => call && hearTurn(btn, heard));
}
function endCall(msg) {
  const c = call; call = null; if (!c) return;
  recNow?.stop();
  c.btn.classList.remove('oncall', 'live'); if (!c.btn.classList.contains('loona-voice') && c.btn.id !== 'loona-fab') c.btn.innerHTML = icon('mic', 18) + 'Conversar';
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
export function callLoona() { if (!panel) toggle(); }
// la luna: solo voz. Un toque = Loona te escucha (la luna brilla); otro toque = cuelga. Sin ventanas ni botones.
function toggle() {
  const fab = document.getElementById('loona-fab');
  if (panel) { endCall(); import('./live.js').then(L => L.stopLive()); panel = null; fab?.classList.remove('talking', 'live', 'oncall'); return; }
  const heard = h('p');   // lo que oyó no se muestra (solo voz)
  panel = { heard }; fab?.classList.add('talking');
  // cuando la conversación termina sola (te despides o pones música), la luna vuelve a su estado normal
  const watch = setInterval(() => { if (!panel) return clearInterval(watch); if (!call && !recNow && !isBusy()) { clearInterval(watch); setTimeout(() => { if (panel && !call) { panel = null; fab?.classList.remove('talking', 'live', 'oncall'); } }, 1200); } }, 700);
  startCall(fab || h('button'), heard);
}
// ajustes de Loona (van en Ajustes → IA, no en la luna)
export function loonaSettings() {
  const row = (label, opts, cur, set) => h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, label), ...opts.map(([k, n]) =>
    h('button', { class: 'chip' + (cur() === k ? ' on' : ''), onclick: e => { set(k); e.target.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === e.target)); } }, n)));
  return h('div', { class: 'loona-set' }, h('h3', {}, 'Loona'),
    row('Mi nombre suena:', [['iv', '«Iv»'], ['eve', '«É-ve»'], ['evelin', '«Évelin»']], nameMode, k => { try { localStorage.setItem('loonaNombre', k); } catch { } speak('Hola, Eve.'); }),
    row('Su voz:', [['ia', 'Con voz'], ['off', 'Solo texto']], voiceMode, setVoiceMode),
    row('Si se acaba su voz de Google:', [['1', 'Voz del celular'], ['0', 'Solo texto']], () => backupVoice() ? '1' : '0', k => { try { localStorage.setItem('loonaBackupVoice', k); } catch { } }),
    row('Me empuja a estudiar:', [[true, 'Sí'], [false, 'No']], coachOn, setCoach),
    row('Meta diaria:', [[60, '1 h'], [120, '2 h'], [180, '3 h'], [240, '4 h'], [360, '6 h']], goal, setGoal),
    hfRow(),
    h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Memoria:'),
      h('button', { class: 'chip', onclick: async () => { const m = await memoryText(); bubble(m ? 'Lo que recuerdo de nosotras:\n' + m.slice(0, 600) : 'Todavía no me acuerdo de nada. Cuéntame de ti cuando quieras.'); } }, 'Qué recuerdas'),
      h('button', { class: 'chip', onclick: async e => { if (e.target.dataset.ok) { await forget(); e.target.textContent = 'Memoria borrada'; } else { e.target.dataset.ok = 1; e.target.textContent = 'Toca otra vez para borrar'; } } }, 'Borrar memoria')));
}
async function listen(btn, heard) {
  // Con clave de Gemini: grabo tu voz y Gemini la entiende (más fiable que el dictado del navegador)
  if (recNow) return recordAndTalk(btn, heard);
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
