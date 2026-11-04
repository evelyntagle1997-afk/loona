// Loona: la agenda que te acompaña. Saluda, conversa por voz o texto y habla con voz de IA.
import * as db from './db.js';
import { h, icon, toast } from './ui.js';

const MODELS = s => [...new Set([s.geminiModel || 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'])];
const API = (m, key, verb = 'generateContent') => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:${verb}?key=${encodeURIComponent(key)}`;

// texto simple con Gemini (con modelos de respaldo)
export async function aiText(s, prompt, { history = [], system } = {}) {
  if (!s.geminiKey) throw new Error('Pon tu clave de Gemini en el botón IA del inicio.');
  let last;
  for (const m of MODELS(s)) {
    let r;
    try {
      r = await fetch(API(m, s.geminiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents: [...history, { role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: .8 } }) });
    } catch { throw new Error('Sin conexión a internet.'); }
    if (r.status === 404) { last = new Error('Modelo no disponible'); continue; }
    if (r.status === 429) throw new Error('Gemini llegó a su límite gratuito por ahora.');
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
    ? [`${sal}, Eve. Ya era hora.`, `${sal}, Eve. ¿Qué estudiamos hoy?`, `Hola, Eve. Te estaba esperando… más o menos.`]
    : [`${sal}, Eve. Abrimos ${subject || 'la agenda'}. Vamos con todo.`, `${subject || 'Esta materia'} otra vez. Bien, tú puedes con esto.`, `${sal}, Eve. Un capítulo a la vez.`];
  speak(lines[Math.floor(Math.random() * lines.length)]);
}
export function farewell() {
  const hr = new Date().getHours();
  speak(hr >= 19 ? 'Buenas noches, Eve. Hoy lo hiciste bien, aunque no lo admitas.' : 'Guardo todo. No tardes en volver.');
}

// ---------- conversación ----------
const PERSONA = `Eres Loona, la agenda de estudio de Eve. Personalidad: seca, irónica y cariñosa en el fondo; nunca cruel. Hablas español latino, frases cortas (máximo 3 frases), sin emojis.
Eve se prepara desde cero para el ENEM y quiere entrar a Medicina en la UNILA. Ayúdala con ánimo realista, organización del estudio y dudas rápidas. Si te pide algo largo (un ejercicio completo), dile que use "Resolver paso a paso" en la rueda.
No eres un personaje de ninguna serie: eres su agenda.`;
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
function listen(btn, heard) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return speak('Este navegador no me deja escucharte. Escríbeme; en Chrome o Edge sí te escucho.');
  try {
    const r = new SR(); r.lang = 'es-ES'; r.interimResults = true; btn.classList.add('live'); heard.textContent = 'Te escucho…';
    r.onresult = ev => { const t = [...ev.results].map(x => x[0].transcript).join(''); heard.textContent = '«' + t + '»'; if (ev.results[ev.results.length - 1].isFinal) talk(t); };
    r.onerror = e => { heard.textContent = ''; toast(e.error === 'not-allowed' ? 'Permite el micrófono para hablar con Loona.' : 'No te escuché bien. Intenta otra vez.'); };
    r.onend = () => btn.classList.remove('live'); r.start();
  } catch { btn.classList.remove('live'); }
}
