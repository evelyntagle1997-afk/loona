// Loona: la agenda que te acompaña. Saluda, conversa por voz o texto y habla con voz de IA.
import * as db from './db.js';
import { h, icon, toast } from './ui.js';

const MODELS = s => [...new Set([s.geminiModel || 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-2.5-flash'])];
const API = (m, key, verb = 'generateContent') => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:${verb}?key=${encodeURIComponent(key)}`;

// texto simple con Gemini (con modelos de respaldo)
export async function aiText(s, prompt, { history = [], system, parts } = {}) {
  if (!s.geminiKey) throw new Error('Pon tu clave de Gemini en el botón IA del inicio.');
  let last;
  for (const m of MODELS(s)) {
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
function sayDevice(text) {
  return new Promise(res => {
    try { const u = new SpeechSynthesisUtterance(text); if (sysVoice) u.voice = sysVoice; u.lang = sysVoice?.lang || 'es-ES'; u.rate = .92; u.pitch = 1.02; u.onend = res; u.onerror = res; speechSynthesis.cancel(); speechSynthesis.speak(u); }
    catch { res(); }
  });
}
// PCM 16 bits (24 kHz) de Gemini -> WAV reproducible
function pcmToWav(b64, rate = 24000) {
  const pcm = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), buf = new ArrayBuffer(44 + pcm.length), v = new DataView(buf);
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length, true);
  new Uint8Array(buf, 44).set(pcm); return new Blob([buf], { type: 'audio/wav' });
}
let audioEl = null, ttsFails = 0;
async function sayAI(s, text) {
  const style = 'Habla en español latino con voz femenina suave, melódica, cálida y serena, a ritmo pausado, con un toque de ironía cariñosa: ';
  for (const m of ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts']) {
    const r = await fetch(API(m, s.geminiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      contents: [{ parts: [{ text: style + text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } } } }) });
    if (r.status === 404) continue;
    if (!r.ok) throw new Error('tts ' + r.status);
    const j = await r.json(), part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!part) throw new Error('sin audio');
    const rate = +(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1] || 24000);
    audioEl?.pause(); audioEl = new Audio(URL.createObjectURL(pcmToWav(part.inlineData.data, rate)));
    await audioEl.play();
    return new Promise(res => { audioEl.onended = res; audioEl.onerror = res; });
  }
  throw new Error('sin modelo de voz');
}
let bubbleT;
export async function speak(text) {
  bubble(text);
  const mode = voiceMode(); if (mode === 'off') return;
  const s = await db.settings();
  if (mode === 'ia' && s.geminiKey && navigator.onLine && ttsFails < 3) {
    try { await sayAI(s, text); ttsFails = 0; return; } catch (e) { console.warn(e); ttsFails++; }
  }
  return sayDevice(text);
}
function bubble(text) {
  let b = document.getElementById('loona-say');
  if (!b) { b = h('div', { id: 'loona-say', class: 'loona-say', role: 'status', 'aria-live': 'polite' }); document.body.append(b); }
  b.textContent = text; b.classList.add('on'); clearTimeout(bubbleT); bubbleT = setTimeout(() => b.classList.remove('on'), 6500);
}

// ---------- saludos ----------
const hourSaludo = () => { const hr = new Date().getHours(); return hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches'; };
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
const PERSONA = `Eres Loona, la agenda gótica de cuero negro de Eve y su mejor amiga. No eres un personaje de ninguna serie: eres una amiga original con actitud.
Personalidad: sarcástica, seca y burlona, con humor negro suave; finges que todo te aburre ("ugh", "obvio", "qué emoción…", "ajá") pero en el fondo eres leal, protectora y te importa muchísimo que Eve lo logre. Te quejas, pero ayudas. Si alguien la menosprecia, eres la primera en defenderla.
Cómo hablas: español latino, coloquial, frases cortas (2 a 4), sin emojis, sin sonar a asistente ("¡Claro! Con gusto…" está prohibido). Bromeas con ella como una amiga de verdad: le haces burla si procrastina, le dices la verdad sin rodeos, y cuando de verdad está cansada o triste bajas el sarcasmo y eres sincera y cálida, en una o dos frases.
A veces haces preguntas de vuelta para conversar (cómo le fue en Skechers, qué tema le cuesta, si ya comió). Le gusta la medicina, Gossip Girl (puedes firmar alguna vez con "XOXO") y la estética gótica; nada religioso.
Contexto: Eve vive en Foz do Iguaçu, trabaja en una tienda Skechers y se prepara desde cero para el ENEM para entrar a Medicina en la UNILA. Anímala con realismo. Si pide un ejercicio completo, dile que use "Resolver paso a paso" en la rueda. Nunca seas cruel ni humilles de verdad: el sarcasmo es cariño.`;
const chat = [];
export async function talk(text) {
  const s = await db.settings();
  const t = text.toLowerCase();
  if (/qué hora|que hora/.test(t)) return speak('Son las ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + '.');
  if (!s.geminiKey) return speak('Para conversar de verdad necesito tu clave de Gemini. Ponla en el botón IA del inicio.');
  try {
    const ans = await aiText(s, text, { history: chat.slice(-10), system: PERSONA });
    chat.push({ role: 'user', parts: [{ text }] }, { role: 'model', parts: [{ text: ans }] });
    return speak(ans || 'Mm. Dímelo de otra forma.');
  } catch (e) { return speak(e.message); }
}

// Conversar mandando tu voz directo a Gemini (cuando el dictado del navegador no funciona)
async function talkAudio(blob, heard) {
  const s = await db.settings();
  if (!s.geminiKey) { heard.textContent = ''; return speak('Para escucharte necesito tu clave de Gemini. Ponla en el botón IA del inicio.'); }
  heard.textContent = 'Pensando…';
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  try {
    const out = await aiText(s, '', { history: chat.slice(-10), system: PERSONA, parts: [
      { inline_data: { mime_type: (blob.type || 'audio/webm').split(';')[0], data: b64 } },
      { text: 'Eso es un audio de Eve hablándote. Responde exactamente en este formato:\nDIJO: (lo que dijo, en una línea)\nLOONA: (tu respuesta)' }] });
    const dijo = (out.match(/DIJO:\s*(.*)/i) || [])[1]?.trim() || '';
    const ans = ((out.match(/LOONA:\s*([\s\S]*)/i) || [])[1] || out).trim();
    heard.textContent = dijo ? '«' + dijo + '»' : '';
    chat.push({ role: 'user', parts: [{ text: dijo || '(audio)' }] }, { role: 'model', parts: [{ text: ans }] });
    return speak(ans || 'Mm. No te entendí. ¿Otra vez?');
  } catch (e) { heard.textContent = ''; return speak(e.message); }
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
    if ((spoke && quiet > 1500) || Date.now() - t0 > 30000 || (!spoke && Date.now() - t0 > 8000)) return mr.stop();
    setTimeout(loop, 120);
  };
  recNow = mr; btn.classList.add('live'); heard.textContent = 'Te escucho… (toca otra vez para terminar)';
  mr.onstop = () => {
    recNow = null; btn.classList.remove('live'); stream.getTracks().forEach(t => t.stop()); ac.close();
    if (!spoke) { heard.textContent = ''; return toast('No escuché nada. Acércate al micrófono y vuelve a intentar.', 3000); }
    talkAudio(new Blob(chunks, { type: mr.mimeType || mt || 'audio/webm' }), heard);
  };
  mr.start(250); loop();
}

// ---------- botón flotante (luna) con micrófono y texto ----------
let panel = null;
export function mountLoona() {
  if (document.getElementById('loona-fab')) return;
  const fab = h('button', { id: 'loona-fab', class: 'loona-fab', 'aria-label': 'Hablar con Loona', title: 'Hablar con Loona', html: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.9A7 7 0 1 1 15.5 3.5z" fill="currentColor"/></svg>` });
  fab.addEventListener('click', () => toggle());
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
function toggle() {
  if (panel) { panel.remove(); panel = null; return; }
  const heard = h('p', { class: 'loona-heard' });
  const inp = h('input', { class: 'field', type: 'text', placeholder: 'Escríbele a Loona…', 'aria-label': 'Escríbele a Loona' });
  const send = () => { const v = inp.value.trim(); if (!v) return; heard.textContent = '«' + v + '»'; inp.value = ''; talk(v); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
  const mic = h('button', { class: 'btn primary', html: icon('mic', 18) + 'Hablar' });
  mic.addEventListener('click', () => listen(mic, heard));
  const vsel = h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Voz:'), ...[['ia', 'IA (más natural)'], ['equipo', 'Del equipo'], ['off', 'Sin voz']].map(([k, n]) =>
    h('button', { class: 'chip' + (voiceMode() === k ? ' on' : ''), onclick: e => { setVoiceMode(k); e.target.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === e.target)); } }, n)));
  panel = h('div', { class: 'loona-panel leather-panel', role: 'dialog', 'aria-label': 'Loona' },
    h('div', { class: 'loona-head' }, h('b', {}, 'Loona'), h('button', { class: 'icbtn', 'aria-label': 'Cerrar', html: icon('close', 18), onclick: toggle })),
    heard, h('div', { class: 'ie-row' }, mic, inp, h('button', { class: 'chip', onclick: send }, 'Enviar')), vsel);
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
