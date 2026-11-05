// Manos libres: Loona escucha todo el tiempo y responde cuando dices su nombre ("Loona, pausa el video").
// Motor 1: dictado del navegador (gratis, sin internet extra). Si no funciona, motor 2: el micrófono
// detecta cuando hablas y Gemini decide si le hablaste a Loona (usa tu cuota gratuita de Gemini).
import * as db from './db.js';
import { h, toast } from './ui.js';
import { talk, talkAudio, speak, isBusy, bubble, geminiResting } from './loona.js';
import { localCommand } from './cmds.js';

const KEY = 'loonaHF';
const WAKE = /\b(loona|luna|lona|lunna|louna|luny|luni|lunny|loonie|looney|loony|lunita|lúni|lunie|lunei)\b[,.!¿?\s]*/i;
let on = false, engine = null, follow = 0;
const dummy = h('p');
// muestra en la burbuja lo último que Loona oyó, para que sepas que te está escuchando
function peek(t) {
  let el = document.getElementById('hf-peek');
  if (!el) { el = h('div', { id: 'hf-peek', class: 'hf-peek' }); document.body.append(el); }
  el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 3500);
}
const fab = () => document.getElementById('loona-fab');
const mark = st => { const f = fab(); if (!f) return; f.classList.toggle('hf', !!st); f.dataset.hf = st || ''; f.title = st ? 'Loona te escucha: di «Loona…» (toca la llave para apagar)' : 'Hablar con Loona'; };
export const isOn = () => on;
const recording = () => !!document.querySelector('.rec-card .rec-live, .rec-card.recording') || document.body.classList.contains('rec-on');

export async function toggle() { return on ? stop(true) : start(true); }
export async function start(user) {
  if (on) return;
  on = true; try { localStorage.setItem(KEY, '1'); } catch { }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let srOff = false; try { srOff = localStorage.getItem('hfEngine') === 'gemini'; } catch { }
  const beeps = /Android/i.test(navigator.userAgent);   // en Android el dictado suena como radio cada vez: uso el motor silencioso
  if (SR && !srOff && !beeps) startSR(SR); else await startVAD();
  if (user && on) { bubble('Te escucho. Di «Luny» y lo que quieras.'); }
}
export function stop(user) {
  on = false; try { localStorage.removeItem(KEY); } catch { }
  engine?.stop(); engine = null; mark(null);
  if (user) bubble('Ok. Ya no escucho.');
}
// al abrir la app: si lo dejaste prendido, vuelve solo (si el navegador ya dio permiso al micrófono)
export async function resume() {
  let want = false; try { want = localStorage.getItem(KEY) === '1'; } catch { }
  if (!want) return;
  try { const st = await navigator.permissions?.query({ name: 'microphone' }); if (st && st.state !== 'granted') { mark(null); return; } } catch { }
  start(false);
}

// lo que dijiste con el nombre de Loona → conversación u orden
async function heard(text) {
  const t = text.trim(); if (!t) return;
  const m = t.match(WAKE);
  if (!m && Date.now() > follow) return;
  const cmd = (m ? t.slice(m.index + m[0].length).trim() : t) || '(Eve te llamó por tu nombre. Contesta corto y amable.)';
  if (!cmd && Date.now() > follow) { follow = Date.now() + 8000; }
  follow = 0;
  // órdenes simples (pon tal canción, pausa, siguiente, temporizador): sin llamada ni Gemini
  if (localCommand(cmd)) { await talk(cmd); follow = Date.now() + 8000; return; }
  // si Gemini descansa, no intento la llamada en vivo: respondo con lo que se puede
  const st = await db.settings();
  if (geminiResting(st)) { await talk(cmd); follow = Date.now() + 8000; return; }
  // con la llamada en vivo se conversa fluido; al colgar, Loona vuelve a esperar su nombre
  let live = false; try { live = localStorage.getItem('loonaLive') === '1'; } catch { }
  if (!live) { await talk(cmd); follow = Date.now() + 8000; return; }   // sin llamada en vivo: responde por turnos
  const L = await import('./live.js');
  const eng = engine; engine?.stop(); engine = null;
  const back = () => { if (on && !engine) { const SR = window.SpeechRecognition || window.webkitSpeechRecognition; let off = false; try { off = localStorage.getItem('hfEngine') === 'gemini'; } catch { } if (SR && !off && !/Android/i.test(navigator.userAgent)) startSR(SR); else startVAD(); } };
  const r = await L.tryLive({ firstText: cmd, onEnd: () => setTimeout(back, 800) });
  if (r === true) return;
  back();
  await talk(cmd);
  follow = Date.now() + 8000;   // unos segundos para seguir hablando sin repetir su nombre
}

// ---------- motor 1: dictado continuo del navegador ----------
function startSR(SR, forced = false) {
  let r = null, alive = true, gotAudio = false, restarts = 0;
  const fallback = async why => {
    if (forced) { console.warn('dictado', why); if (why === 'no arrancó' || why === 'sin audio') return; alive = false; try { r?.abort(); } catch { } peek('El dictado del celular no funciona aquí; toca la luna y escríbeme.'); return; }
    console.warn('manos libres: cambio a Gemini', why); alive = false; try { r?.abort(); } catch { } try { localStorage.setItem('hfEngine', 'gemini'); } catch { } if (on) await startVAD(); };
  const run = () => {
    if (!alive || !on) return;
    if (isBusy() || recording()) return setTimeout(run, 600);   // no escucha mientras Loona habla o grabas una clase
    r = new SR(); r.lang = 'es-419'; r.continuous = true; r.interimResults = false;
    r.onaudiostart = () => { gotAudio = true; restarts = 0; };
    r.onresult = ev => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) { const t = ev.results[i][0].transcript; peek('Oí: «' + t.trim() + '»'); if (WAKE.test(t) || Date.now() < follow) { try { r.abort(); } catch { } heard(t).finally(() => setTimeout(run, 300)); return; } } };
    r.onerror = e => { if (['network', 'service-not-allowed', 'language-not-supported', 'audio-capture'].includes(e.error)) fallback(e.error); else if (e.error === 'not-allowed') { toast('Permite el micrófono para que Loona te escuche.'); stop(); } };
    r.onend = () => { if (alive && on && !isBusy()) { if (++restarts > 30 && !gotAudio) return fallback('sin audio'); setTimeout(run, 250); } else if (alive && on) setTimeout(run, 600); };
    try { r.start(); } catch { setTimeout(run, 1000); }
  };
  engine = { stop: () => { alive = false; try { r?.abort(); } catch { } } };
  mark('dictado'); run();
  setTimeout(() => { if (alive && on && !gotAudio) fallback('no arrancó'); }, 6000);   // si el navegador no lo deja, cambio de motor
}

// ---------- motor 2: detector de voz + Gemini ----------
async function startVAD() {
  const s = await db.settings();
  if (!s.geminiKey) { toast('Para escucharte siempre necesito tu clave de Gemini (botón IA del inicio).', 4500); return stop(); }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch { toast('Permite el micrófono para que Loona te escuche (candado junto a la dirección).', 4500); return stop(); }
  const ac = new (window.AudioContext || window.webkitAudioContext)(); const an = ac.createAnalyser(); an.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(an); const buf = new Float32Array(an.fftSize);
  const mt = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => window.MediaRecorder?.isTypeSupported?.(t)) || '';
  let alive = true, noise = .01, mr = null, chunks = [], t0 = 0, quiet = 0, lastSend = 0, sending = false, timer = 0;
  const finish = () => {
    const rec = mr; mr = null; if (!rec) return;
    rec.onstop = async () => {
      const dur = Date.now() - t0;
      if (dur < 900 || !alive || !on) return;
      if (Date.now() - lastSend < 4000) return;   // no más de una consulta cada 4 s (cuida la cuota)
      lastSend = Date.now(); sending = true; peek('Escuchando lo que dijiste…');
      try {
        const r = await talkAudio(new Blob(chunks, { type: rec.mimeType || mt || 'audio/webm' }), dummy, { wake: Date.now() > follow });
        if (r === 'resting') return toFree();
        if (r !== 'ignored') follow = Date.now() + 8000; else peek('(no me llamaste: di «Luny…»)');
        if (r === 'bye') follow = 0;
      } finally { sending = false; }
    };
    try { rec.stop(); } catch { }
  };
  const loop = () => {
    if (!alive) return;
    timer = setTimeout(loop, 100);
    if (ac.state === 'suspended') ac.resume().catch(() => { });
    if (sending || isBusy() || recording()) { if (mr) { try { mr.ondataavailable = null; mr.stop(); } catch { } mr = null; } return; }
    an.getFloatTimeDomainData(buf); let sum = 0; for (const v of buf) sum += v * v; const rms = Math.sqrt(sum / buf.length);
    const thr = Math.max(.02, noise * 3);
    if (!mr) {
      noise = noise * .97 + Math.min(rms, .05) * .03;   // aprende el ruido del cuarto (música, ventilador)
      if (rms > thr) { chunks = []; mr = new MediaRecorder(stream, mt ? { mimeType: mt, audioBitsPerSecond: 24000 } : {}); mr.ondataavailable = e => e.data.size && chunks.push(e.data); mr.start(200); t0 = Date.now(); quiet = 0; }
    } else {
      if (rms > thr * .7) quiet = 0; else quiet += 100;
      if (quiet > 900 || Date.now() - t0 > 12000) finish();
    }
  };
  engine = { stop: () => { alive = false; clearTimeout(timer); try { mr?.stop(); } catch { } stream.getTracks().forEach(t => t.stop()); ac.close(); } };
  // Gemini llegó a su límite: sigo escuchando con el dictado gratis del celular (puede sonar un pitido)
  const toFree = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !on) { peek('Gemini descansa; toca la luna y escríbeme.'); return; }
    engine?.stop(); engine = null;
    bubble('Gemini descansa un rato. Sigo escuchándote gratis: di «Luny, pon…», «pausa», «siguiente».');
    startSR(SR, true);
  };
  mark('gemini'); loop();
  if (geminiResting(s)) toFree();
}
