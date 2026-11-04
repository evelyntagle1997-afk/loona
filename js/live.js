// Conversación en vivo con Gemini Live: Loonie te escucha y te habla al mismo tiempo, como una llamada.
// Si hablas mientras ella habla, se calla y te escucha (como una persona). Si el modo en vivo no está
// disponible para tu clave, la app usa la conversación normal.
import * as db from './db.js';
import { toast } from './ui.js';
import { PERSONA, nowCtx, doAction } from './loona.js';

const MODELS = ['gemini-3.8-live', 'gemini-3.1-flash-live-preview', 'gemini-2.5-flash-native-audio-preview-12-2025'];
const WS = key => `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`;
const ORDER_TOOL = {
  functionDeclarations: [{
    name: 'orden',
    description: 'Hace algo en la app de Eve: música de YouTube, temporizador, pantalla. Úsala cuando Eve te pida una de estas cosas.',
    parameters: { type: 'OBJECT', properties: {
      orden: { type: 'STRING', enum: ['pausar', 'reproducir', 'siguiente', 'anterior', 'subir', 'bajar', 'silencio', 'adelantar', 'atrasar', 'cerrar_musica', 'solo_video', 'mostrar_botones', 'buscar', 'temporizador', 'detener_temporizador', 'pantalla_completa', 'inicio', 'colgar'] },
      detalle: { type: 'STRING', description: 'Para buscar: canción o artista. Para temporizador: minutos.' } }, required: ['orden'] },
  }],
};

let S = null;   // sesión activa
export const active = () => !!S;
const subs = new Set(); export const onState = fn => { subs.add(fn); return () => subs.delete(fn); };
const emit = st => subs.forEach(f => { try { f(st); } catch { } });

const b64 = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const WORKLET = `class P extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('cap',P)`;

// abre la conexión probando los modelos en orden
function connect(key, setup) {
  return new Promise((res, rej) => {
    let i = 0;
    const tryNext = () => {
      if (i >= MODELS.length) return rej(new Error('El modo en vivo no está disponible para tu clave.'));
      const model = MODELS[i++]; const ws = new WebSocket(WS(key)); let ok = false;
      ws.onopen = () => ws.send(JSON.stringify({ setup: { ...setup, model: 'models/' + model } }));
      ws.onmessage = async ev => {
        if (ok) return;
        const m = JSON.parse(typeof ev.data === 'string' ? ev.data : await ev.data.text());
        if (m.setupComplete) { ok = true; ws.onmessage = null; ws.onclose = null; ws.onerror = null; res({ ws, model }); }
      };
      ws.onerror = () => { };
      ws.onclose = e => { if (!ok) { console.warn('live', model, e.code, e.reason); if (/key|API_KEY|auth|permission/i.test(e.reason || '') && !/model/i.test(e.reason || '')) return rej(new Error('Tu clave de Gemini no sirve para el modo en vivo.')); tryNext(); } };
    };
    tryNext();
  });
}

export async function startLive({ firstText = '', onEnd } = {}) {
  if (S) return S;
  const st = await db.settings();
  if (!st.geminiKey) throw new Error('Necesito tu clave de Gemini (botón IA del inicio).');
  let mic;
  try { mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
  catch { throw new Error('Permite el micrófono para hablar con Loona.'); }
  const setup = {
    generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } }, languageCode: 'es-US' } },
    systemInstruction: { parts: [{ text: PERSONA + nowCtx() + '\nEstás en una llamada de voz en vivo con Eve: habla natural y fluido como una persona, frases cortas, sin listas. Si te interrumpe, para y escúchala. Usa la herramienta "orden" cuando te pida música, temporizador o pantalla; cuando ella se despida, usa orden colgar.' }] },
    tools: [ORDER_TOOL],
    inputAudioTranscription: {}, outputAudioTranscription: {},
  };
  let conn;
  try { conn = await connect(st.geminiKey, setup); } catch (e) { mic.getTracks().forEach(t => t.stop()); throw e; }
  const { ws } = conn;
  // --- salida: audio PCM 24 kHz encadenado sin cortes ---
  const out = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
  let next = 0; const playing = new Set();
  const M = await import('./music.js').catch(() => null);
  const setTalking = on => { if (on) M?.duck(true, 'live'); else M?.duck(false, 'live'); emit({ talking: on }); };
  const play = data => {
    const raw = atob(data), n = raw.length >> 1, f = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = raw.charCodeAt(2 * i) | (raw.charCodeAt(2 * i + 1) << 8); if (v >= 32768) v -= 65536; f[i] = v / 32768; }
    const buf = out.createBuffer(1, n, 24000); buf.copyToChannel(f, 0);
    const src = out.createBufferSource(); src.buffer = buf; src.connect(out.destination);
    const t = Math.max(out.currentTime + .03, next); src.start(t); next = t + buf.duration;
    if (!playing.size) setTalking(true);
    playing.add(src); src.onended = () => { playing.delete(src); if (!playing.size) setTalking(false); };
  };
  const hush = () => { playing.forEach(s => { try { s.stop(); } catch { } }); playing.clear(); next = 0; setTalking(false); };
  // --- entrada: micrófono a 16 kHz en trozos de 100 ms ---
  const inp = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
  await inp.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' })));
  const node = new AudioWorkletNode(inp, 'cap'); inp.createMediaStreamSource(mic).connect(node);
  let acc = new Float32Array(0);
  node.port.onmessage = ev => {
    const c = ev.data, m = new Float32Array(acc.length + c.length); m.set(acc); m.set(c, acc.length); acc = m;
    if (acc.length < 1600 || ws.readyState !== 1) return;
    const pcm = new Int16Array(acc.length); for (let i = 0; i < acc.length; i++) { const v = Math.max(-1, Math.min(1, acc[i])); pcm[i] = v < 0 ? v * 32768 : v * 32767; }
    acc = new Float32Array(0);
    ws.send(JSON.stringify({ realtimeInput: { audio: { data: b64(pcm.buffer), mimeType: 'audio/pcm;rate=16000' } } }));
  };
  // --- mensajes de Gemini ---
  let said = '', heard = '', idle = 0;
  const bump = () => { clearTimeout(idle); idle = setTimeout(() => stopLive('Ok. Me voy. Lo que sea.'), 45000); };   // cuelga sola si nadie habla
  ws.onmessage = async ev => {
    const m = JSON.parse(typeof ev.data === 'string' ? ev.data : await ev.data.text());
    const sc = m.serverContent;
    if (sc) {
      if (sc.interrupted) hush();   // la interrumpiste: se calla y te escucha
      if (sc.inputTranscription?.text) { heard += sc.inputTranscription.text; emit({ heard }); bump(); }
      if (sc.outputTranscription?.text) { said += sc.outputTranscription.text; emit({ said }); }
      for (const p of sc.modelTurn?.parts || []) if (p.inlineData?.data) { play(p.inlineData.data); bump(); }
      if (sc.turnComplete) { said = ''; heard = ''; }
    }
    if (m.toolCall?.functionCalls) {
      const res = [];
      for (const fc of m.toolCall.functionCalls) {
        const a = fc.args || {}; let r = 'ok';
        try { const out = await doAction(a.orden + (a.detalle ? ': ' + a.detalle : '')); if (out === 'bye') { setTimeout(() => stopLive(), 2500); } } catch (e) { r = 'error: ' + e.message; }
        res.push({ id: fc.id, name: fc.name, response: { result: r } });
      }
      if (ws.readyState === 1) ws.send(JSON.stringify({ toolResponse: { functionResponses: res } }));
    }
    if (m.goAway) stopLive();
  };
  ws.onclose = e => { if (S) { console.warn('live cerrado', e.code, e.reason); stopLive(); } };
  S = { ws, mic, inp, out, node, hush, onEnd, model: conn.model };
  bump(); emit({ on: true, model: conn.model });
  if (firstText) ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: firstText }] }], turnComplete: true } }));
  else ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: '(Eve acaba de abrir la llamada. Salúdala con una frase corta y seca.)' }] }], turnComplete: true } }));
  return S;
}

export function stopLive(bye) {
  const s = S; if (!s) return; S = null;
  try { s.ws.close(); } catch { }
  try { s.node.disconnect(); s.inp.close(); } catch { }
  s.mic.getTracks().forEach(t => t.stop());
  setTimeout(() => { try { s.hush(); s.out.close(); } catch { } }, bye ? 0 : 1500);
  emit({ on: false });
  if (bye) import('./loona.js').then(L => L.speak(bye));
  s.onEnd?.();
}

// abre la llamada en vivo o, si no se puede, avisa para usar la conversación normal
export async function tryLive(opts) {
  try { await startLive(opts); return true; }
  catch (e) { console.warn(e); if (!/clave|micrófono/i.test(e.message)) return false; toast(e.message, 4000); return 'stop'; }
}
