// Grabar la clase: graba la voz del profesor, la IA la transcribe con la hora de cada parte
// y arma el resumen en el cuaderno. Cada audio queda guardado con su título, por materia y tema.
import * as db from './db.js';
import { h, icon, toast, modal, esc } from './ui.js';

const fmt = s => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0'); };
let active = null;   // grabación en curso (sigue aunque cierres la ventana)

export function openRecorder({ subject, nb, notebook }) {
  const title = h('input', { class: 'field', value: active?.title || `${subject?.name || 'Clase'} · ${new Date().toLocaleDateString('es')}`, 'aria-label': 'Título de la clase' });
  const topic = h('input', { class: 'field', value: active?.topic || '', placeholder: 'Tema (ej.: La célula)', 'aria-label': 'Tema de la clase' });
  const time = h('div', { class: 'rec-time', role: 'timer' }, fmt(active ? (Date.now() - active.t0 - active.paused) / 1000 : 0));
  const status = h('p', { class: 'opt-hint' }, 'Pide permiso al profesor antes de grabar. El audio se guarda en tu agenda y en tu nube.');
  const startBtn = h('button', { class: 'btn primary', html: icon('mic', 18) + (active ? 'Detener y guardar' : 'Empezar a grabar') });
  const pauseBtn = h('button', { class: 'btn', hidden: !active }, active?.rec.state === 'paused' ? 'Seguir' : 'Pausar');
  let tick = setInterval(() => { if (active && active.rec.state === 'recording') time.textContent = fmt((Date.now() - active.t0 - active.paused) / 1000); }, 500);
  startBtn.addEventListener('click', async () => {
    if (active) return stop();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Este navegador no permite grabar. Usa Chrome o Edge.', 4000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, { mimeType: mime || undefined, audioBitsPerSecond: 24000 });
      active = { rec, stream, chunks: [], t0: Date.now(), paused: 0, pauseAt: 0, title: title.value, topic: topic.value, subject, nb, notebook };
      rec.ondataavailable = e => e.data.size && active?.chunks.push(e.data);
      rec.start(4000); document.body.classList.add('rec-on');
      autoPause(active, () => { status.replaceChildren(h('span', { class: 'rec-dot' }), 'Grabando…'); pauseBtn.textContent = 'Pausar'; },
                        () => { status.textContent = 'En pausa automática: silencio. Sigue sola cuando vuelva a escucharse la voz.'; });
      try { active.wake = await navigator.wakeLock?.request('screen'); } catch { }
      startBtn.innerHTML = icon('mic', 18) + 'Detener y guardar'; pauseBtn.hidden = false;
      status.replaceChildren(h('span', { class: 'rec-dot' }), 'Grabando… puedes seguir subrayando; la grabación continúa.');
    } catch (e) { toast('Permite el micrófono para grabar la clase.', 4000); }
  });
  pauseBtn.addEventListener('click', () => {
    if (!active) return;
    if (active.rec.state === 'recording') { active.manual = true; doPause(active); pauseBtn.textContent = 'Seguir'; status.textContent = 'En pausa. Toca Seguir para continuar.'; }
    else { active.manual = false; doResume(active); pauseBtn.textContent = 'Pausar'; status.replaceChildren(h('span', { class: 'rec-dot' }), 'Grabando…'); }
  });
  async function stop() {
    const a = active; active = null;
    a.title = title.value.trim() || a.title; a.topic = topic.value.trim();
    if (a.rec.state === 'paused') doResume(a);
    await new Promise(r => { a.rec.onstop = r; a.rec.stop(); }); document.body.classList.remove('rec-on');
    a.vad?.stop();
    a.stream.getTracks().forEach(t => t.stop()); a.wake?.release?.().catch(() => { });
    const blob = new Blob(a.chunks, { type: a.rec.mimeType || 'audio/webm' });
    const dur = (Date.now() - a.t0 - a.paused) / 1000;
    const blobId = db.uid('audb_'); await db.putBlob(blobId, blob, { type: blob.type });
    const rec = await db.put({ id: db.uid('aud_'), kind: 'audio', subject: a.subject?.id, notebook: a.nb?.id, title: a.title, topic: a.topic, blob: blobId, dur, created: Date.now(), status: 'grabada' });
    m.close(); toast('Clase guardada: ' + rec.title);
    transcribe(rec, a.notebook);
  }
  const autoTg = h('input', { type: 'checkbox', onchange: e => { try { localStorage.setItem('recAuto', e.target.checked ? '1' : '0'); } catch { } } }); autoTg.checked = autoOn();
  const m = modal({ title: 'Grabar la clase', body: h('div', { class: 'rec-card' }, h('label', { class: 'lbl' }, 'Título', title), h('label', { class: 'lbl' }, 'Tema', topic), time, h('div', { class: 'ie-row' }, startBtn, pauseBtn),
    h('label', { class: 'dp-tg' }, autoTg, h('span', { class: 'sw' }), 'Pausar sola en los silencios y seguir cuando vuelva la voz'), status),
    onClose: () => clearInterval(tick) });
  if (active) status.replaceChildren(h('span', { class: 'rec-dot' }), 'Grabando…');
}

// ---------- pausa y continuación automáticas ----------
const autoOn = () => { try { return localStorage.getItem('recAuto') !== '0'; } catch { return true; } };
function doPause(a) { if (a.rec.state === 'recording') { a.rec.pause(); a.pauseAt = Date.now(); } }
function doResume(a) { if (a.rec.state === 'paused') { a.rec.resume(); a.paused += Date.now() - a.pauseAt; } }
// mide el volumen del micrófono: tras 4 s de silencio pausa; cuando vuelve la voz, sigue grabando sola.
function autoPause(a, onResume, onPause) {
  let ctx, raf;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser(); an.fftSize = 1024; ctx.createMediaStreamSource(a.stream).connect(an);
    const buf = new Float32Array(an.fftSize);
    let quietSince = Date.now(), floor = .004;
    const loop = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0; for (const v of buf) sum += v * v; const rms = Math.sqrt(sum / buf.length);
      if (a.rec.state === 'recording') floor = floor * .995 + Math.min(rms, floor * 3) * .005;   // ruido de fondo del aula
      const voice = rms > Math.max(.012, floor * 2.6);
      if (voice) quietSince = Date.now();
      if (!a.manual && autoOn()) {
        if (a.rec.state === 'recording' && Date.now() - quietSince > 4000) { doPause(a); onPause(); }
        else if (a.rec.state === 'paused' && voice) { doResume(a); onResume(); }
      }
      raf = setTimeout(loop, 160);
    };
    loop();
  } catch { }
  // si el micrófono se corta (una llamada, otra app) pausa, y sigue al volver
  const tr = a.stream.getAudioTracks()[0];
  if (tr) { tr.onmute = () => { if (!a.manual) { doPause(a); onPause(); } }; tr.onunmute = () => { if (!a.manual) { doResume(a); onResume(); } }; }
  a.vad = { stop: () => { clearTimeout(raf); ctx?.close().catch(() => { }); } };
}

// ---------- transcripción y resumen con Gemini ----------
async function blobB64(b) { return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); }); }
export async function transcribe(rec, notebook, { quiet = false } = {}) {
  const s = await db.settings();
  if (!s.geminiKey) { if (!quiet) toast('Para transcribir y resumir pon tu clave de Gemini en el botón IA del inicio. El audio ya está guardado.', 5000); return; }
  const blob = await db.getBlob(rec.blob); if (!blob) return toast('No encuentro el audio en este dispositivo.');
  if (blob.size > 19 * 1024 * 1024) return toast('El audio es muy largo para transcribirlo de una vez (más de 1 h 40 min). Graba la clase en partes.', 6000);
  rec.status = 'transcribiendo'; await db.put(rec);
  toast('Loona está escuchando la clase para transcribirla…', 4000);
  const prompt = `Transcribe esta clase grabada (en español o portugués) y haz un resumen de estudio para una estudiante que se prepara para el ENEM.
Devuelve SOLO JSON:
{"segmentos":[{"t": segundos desde el inicio (número), "texto": "lo que se dijo en esa parte, fiel y completo"}],
 "titulo":"título corto del tema",
 "ideas":["ideas principales, frases cortas"],
 "definiciones":[{"termino":"","significado":""}],
 "ejemplos":["ejemplos que dio el profesor"],
 "datos":["fechas, fórmulas, números clave"],
 "preguntas":[{"q":"pregunta de repaso","a":"respuesta corta"}],
 "dudas":["partes poco claras del audio para revisar"]}
Segmentos de 20 a 60 segundos. No inventes nada que no se haya dicho.`;
  try {
    let data = null, last;
    for (const m of [...new Set([s.geminiModel || 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'])]) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(s.geminiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: (blob.type || 'audio/webm').split(';')[0], data: await blobB64(blob) } }, { text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: .2 } }) });
      if (r.status === 404) continue;
      if (!r.ok) { last = new Error(r.status === 429 ? 'Gemini llegó a su límite por ahora; intenta más tarde.' : 'Gemini respondió con error ' + r.status); continue; }
      const j = await r.json(); const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
      try { data = JSON.parse(txt.replace(/^\s*```(json)?|```\s*$/g, '')); break; } catch { last = new Error('No pude leer la respuesta de la IA.'); }
    }
    if (!data) throw last || new Error('No se pudo transcribir');
    rec.segments = (data.segmentos || []).map(x => ({ t: +x.t || 0, text: String(x.texto || '') }));
    rec.summary = data; rec.status = 'lista'; if (!rec.topic && data.titulo) rec.topic = data.titulo;
    await db.put(rec);
    if (notebook) await toNotebook(rec, notebook);
    toast('Transcripción lista. El resumen está en tu cuaderno.', 3500);
  } catch (e) { rec.status = 'grabada'; await db.put(rec); toast(e.message, 5000); }
}

// resumen estilo "lección aprendida" en el cuaderno (reparte en hojas si es largo)
export async function toNotebook(rec, nb) {
  const d = rec.summary || {}, list = a => (a || []).filter(Boolean);
  const pieces = [
    `<div class="sv-head"><div class="sv-title">${esc(d.titulo || rec.topic || rec.title)}</div><div class="sv-area">Clase grabada · ${esc(new Date(rec.created).toLocaleDateString('es'))} · ${fmt(rec.dur || 0)}</div></div>`,
    list(d.ideas).length && `<div class="sv-box"><h5>Ideas principales</h5><ul>${list(d.ideas).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`,
    list(d.definiciones).length && `<div class="sv-box"><h5>Definiciones</h5><ul>${list(d.definiciones).map(x => `<li><b>${esc(x.termino)}:</b> ${esc(x.significado)}</li>`).join('')}</ul></div>`,
    list(d.datos).length && `<div class="sv-idea"><h5>Datos clave</h5><ul>${list(d.datos).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`,
    list(d.ejemplos).length && `<div class="sv-box"><h5>Ejemplos de la clase</h5><ul>${list(d.ejemplos).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`,
    list(d.preguntas).length && `<div class="sv-box sv-prac"><h5>Repaso</h5>${list(d.preguntas).map(q => `<details><summary>${esc(q.q)}</summary><p>${esc(q.a)}</p></details>`).join('')}</div>`,
    list(d.dudas).length && `<div class="sv-idea sv-tip"><h5>Para revisar en el audio</h5><ul>${list(d.dudas).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`,
  ].filter(Boolean);
  const { placePieces } = await import('./solver.js');
  await placePieces(nb, pieces);
}

// ---------- lista y reproductor con transcripción ----------
export async function audioList(subjectId, notebook) {
  const list = (await db.where('audio', x => x.subject === subjectId)).sort((a, b) => b.created - a.created);
  return list;
}
export function audioRow(rec, notebook) {
  return h('button', { class: 'aud', onclick: () => openAudio(rec, notebook) },
    h('span', { class: 'aud-ic', html: icon('mic', 20) }),
    h('span', {}, h('b', {}, rec.title), h('small', {}, `${rec.topic ? rec.topic + ' · ' : ''}${fmt(rec.dur || 0)} · ${{ grabada: 'sin transcribir', transcribiendo: 'transcribiendo…', lista: 'transcripción lista' }[rec.status] || ''}`)));
}
export async function openAudio(rec, notebook) {
  const url = await db.blobURL(rec.blob);
  const audio = h('audio', { controls: true, preload: 'metadata', src: url || '' });
  const tr = h('div', { class: 'tr-list', hidden: true });
  const segs = rec.segments || [];
  tr.append(...segs.map(sg => h('button', { class: 'tr-seg', 'data-t': sg.t, onclick: () => { audio.currentTime = sg.t; audio.play(); } }, h('time', {}, fmt(sg.t)), h('span', {}, sg.text))));
  audio.addEventListener('timeupdate', () => { let cur = null; tr.querySelectorAll('.tr-seg').forEach(b => { if (+b.dataset.t <= audio.currentTime) cur = b; b.classList.remove('on'); }); cur?.classList.add('on'); });
  const trBtn = h('button', { class: 'btn primary', disabled: !segs.length, onclick: () => { tr.hidden = !tr.hidden; trBtn.textContent = tr.hidden ? 'Ver transcripción' : 'Ocultar transcripción'; } }, segs.length ? 'Ver transcripción' : 'Sin transcripción todavía');
  const acts = h('div', { class: 'ie-row' }, trBtn,
    rec.status !== 'lista' ? h('button', { class: 'btn', onclick: () => { m.close(); transcribe(rec, notebook); } }, 'Transcribir y resumir') : notebook ? h('button', { class: 'btn', onclick: () => { m.close(); toNotebook(rec, notebook); } }, 'Poner el resumen en el cuaderno') : null,
    h('button', { class: 'chip', onclick: () => { const t = rec.title, inp = h('input', { class: 'field', value: t }); modal({ title: 'Cambiar título', body: inp, actions: [{ label: 'Cancelar' }, { label: 'Guardar', primary: true, onclick: async () => { rec.title = inp.value.trim() || t; await db.put(rec); toast('Título guardado'); } }] }); } }, 'Cambiar título'),
    h('button', { class: 'chip danger', onclick: async () => { if (rec._arm) { await db.remove(rec.id); m.close(); toast('Audio borrado'); } else { rec._arm = 1; toast('Toca otra vez "Borrar" para confirmar'); } } }, 'Borrar'));
  const m = modal({ title: rec.title, wide: true, body: h('div', {}, h('p', { class: 'opt-hint' }, `${rec.topic || ''} · ${new Date(rec.created).toLocaleString('es')}`), audio, acts, tr) });
}
