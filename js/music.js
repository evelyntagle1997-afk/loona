// Reproductor de YouTube flotante: música mientras estudias, con controles y se puede mover u ocultar.
import { h, icon, toast } from './ui.js';

let box = null, player = null, apiP = null, autoHide = null;
const KEY = 'ytLast';
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  return apiP ||= new Promise((res, rej) => {
    window.onYouTubeIframeAPIReady = res;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.onerror = () => { apiP = null; rej(new Error('Sin internet para YouTube')); }; document.head.append(s);
  });
}
// acepta enlaces de video, de lista o de YouTube Music
function parse(url) {
  try {
    const u = new URL(url.trim());
    const list = u.searchParams.get('list');
    let v = u.searchParams.get('v');
    if (!v && /youtu\.be$/.test(u.hostname)) v = u.pathname.slice(1);
    if (!v && /\/shorts\/|\/embed\/|\/live\//.test(u.pathname)) v = u.pathname.split('/').filter(Boolean)[1];
    return v || list ? { v, list } : null;
  } catch { return null; }
}
const save = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { } };
const last = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };

// ---------- control por voz (lo usa Loona) ----------
// cmd: pausar | reproducir | siguiente | anterior | subir | bajar | silencio | adelantar | atrasar | cerrar | buscar
export async function control(cmd, arg) {
  if (cmd === 'buscar') return playSearch(arg);
  if (!box || !player?.getPlayerState) {
    if (cmd === 'reproducir') { openMusic(); return true; }
    return false;
  }
  const v = () => player.getVolume?.() ?? 50;
  switch (cmd) {
    case 'pausar': player.pauseVideo(); break;
    case 'reproducir': player.playVideo(); break;
    case 'siguiente': player.nextVideo(); break;
    case 'anterior': player.previousVideo(); break;
    case 'subir': player.unMute(); player.setVolume(Math.min(100, v() + (+arg || 20))); break;
    case 'bajar': player.setVolume(Math.max(0, v() - (+arg || 20))); break;
    case 'silencio': player.mute(); break;
    case 'adelantar': player.seekTo(player.getCurrentTime() + (+arg || 15), true); break;
    case 'atrasar': player.seekTo(Math.max(0, player.getCurrentTime() - (+arg || 15)), true); break;
    case 'cerrar': box.querySelector('[aria-label="Cerrar la música"]')?.click(); break;
    case 'video': box.classList.remove('novideo', 'mini'); box.classList.add('vonly'); break;
    case 'botones': box.classList.remove('vonly', 'mini'); break;
    default: return false;
  }
  return true;
}
// bajar la música mientras Loona te escucha (para que el micrófono te oiga a ti)
let ducked = null;
export function duck(on) {
  if (!player?.getVolume) return;
  if (on && ducked == null && player.getPlayerState?.() === 1) { ducked = player.getVolume(); player.setVolume(Math.min(ducked, 12)); }
  else if (!on && ducked != null) { player.setVolume(ducked); ducked = null; }
}
// poner un video por id o enlace
export function playUrl(url) { const p = parse(url); if (!p) return false; save(p); openMusic(); startRef?.(p); return true; }
let startRef = null;
// buscar una canción: Gemini (con búsqueda de Google) encuentra el enlace de YouTube
async function playSearch(q) {
  if (!q) return false;
  const db = await import('./db.js'); const s = await db.settings();
  if (!s.geminiKey) { window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank'); return true; }
  for (const m of [s.geminiModel || 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(s.geminiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools: [{ google_search: {} }], contents: [{ role: 'user', parts: [{ text: `Busca en YouTube: "${q}". Responde SOLO con el enlace https://www.youtube.com/watch?v=... del video oficial o más popular (si piden un mix o playlist, puede ser un enlace de lista). Nada más.` }] }] }) });
      if (r.status === 404) continue;
      if (!r.ok) break;
      const j = await r.json(); const txt = j.candidates?.[0]?.content?.parts?.map(x => x.text || '').join(' ') || '';
      const url = (txt.match(/https?:\/\/(?:www\.|music\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s)"]+|playlist\?[^\s)"]+|shorts\/[\w-]+)|youtu\.be\/[\w-]+)/) || [])[0];
      if (url && playUrl(url)) return true;
      break;
    } catch { break; }
  }
  window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(q), '_blank');
  return true;
}

export function openMusic() {
  if (box) { box.hidden = false; box.classList.remove('mini'); return; }
  const titleEl = h('b', {}, 'Música');
  const vid = h('div', { class: 'yt-video' }, h('div', { id: 'yt-frame' }));
  const inp = h('input', { class: 'field', type: 'url', placeholder: 'Pega un enlace de YouTube (canción o lista)', 'aria-label': 'Enlace de YouTube' });
  const ICONS = ['prev', 'next', 'play', 'pause'];
  const btn = (ic, label, fn, cls = '') => h('button', { class: cls, 'aria-label': label, title: label, html: ICONS.includes(ic) ? icon(ic, 18) : `<span class="yt-t">${ic}</span>`, onclick: fn });
  const playBtn = btn('play', 'Reproducir o pausar', () => { if (!player?.getPlayerState) return; player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); }, 'big');
  const seek = d => player?.seekTo && player.seekTo(Math.max(0, player.getCurrentTime() + d), true);
  const vol = d => { if (!player?.setVolume) return; const v = Math.max(0, Math.min(100, player.getVolume() + d)); player.unMute(); player.setVolume(v); toast('Volumen ' + v, 900); };
  const ctrl = h('div', { class: 'yt-ctrl' },
    btn('prev', 'Canción anterior', () => player?.previousVideo?.()),
    btn('−10', 'Atrasar 10 segundos', () => seek(-10)), playBtn, btn('+10', 'Adelantar 10 segundos', () => seek(10)),
    btn('next', 'Siguiente canción', () => player?.nextVideo?.()),
    btn('🔉', 'Bajar volumen', () => vol(-10)), btn('🔊', 'Subir volumen', () => vol(10)));
  const go = () => {
    const p = parse(inp.value);
    if (!p) return toast('Ese enlace no es de YouTube. Copia el enlace desde Compartir → Copiar enlace.', 4000);
    save(p); start(p);
  };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  const src = h('div', { class: 'yt-src' }, inp, h('button', { class: 'chip', onclick: go }, 'Poner'),
    h('a', { class: 'chip', href: 'https://www.youtube.com/results?search_query=reggaeton+mix', target: '_blank', rel: 'noopener' }, 'Buscar'));
  const head = h('div', { class: 'yt-head' }, h('span', { html: icon('music', 18) }), titleEl,
    h('button', { class: 'icbtn', 'aria-label': 'Mostrar u ocultar el video', title: 'Mostrar u ocultar el video', html: icon('image', 18), onclick: () => box.classList.toggle('novideo') }),
    h('button', { class: 'icbtn', 'aria-label': 'Solo el video', title: 'Solo el video (oculta los botones)', html: icon('full', 18), onclick: () => onlyVideo(true) }),
    h('button', { class: 'icbtn', 'aria-label': 'Minimizar', title: 'Minimizar (la música sigue)', html: icon('minus', 18), onclick: () => box.classList.add('mini') }),
    h('button', { class: 'icbtn', 'aria-label': 'Cerrar la música', title: 'Cerrar la música', html: icon('close', 18), onclick: close }),
    h('button', { class: 'yt-mini-ic', 'aria-label': 'Abrir el reproductor', html: icon('music', 22), onclick: e => { e.stopPropagation(); box.classList.remove('mini'); } }));
  // modo "solo video": se ocultan todos los botones; queda una pestañita casi invisible para volver y para mover el video
  const back = h('button', { class: 'yt-back', 'aria-label': 'Mostrar los botones', title: 'Mostrar los botones', html: icon('music', 16) });
  const onlyVideo = on => { box.classList.toggle('vonly', on); box.classList.remove('novideo'); try { localStorage.setItem('ytOnly', on ? '1' : ''); } catch { } };
  // esquina para cambiar el tamaño (arrastrar); el tamaño se recuerda
  const grip = h('div', { class: 'yt-grip', 'aria-label': 'Cambiar tamaño', title: 'Arrastra para cambiar el tamaño' });
  box = h('div', { class: 'yt leather-strip', role: 'region', 'aria-label': 'Reproductor de música' }, head, vid, ctrl, src, back, grip);
  try { const w = +localStorage.getItem('ytW'); if (w) box.style.width = Math.min(w, innerWidth - 8) + 'px'; } catch { }
  let gs = null;
  grip.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); gs = { x: e.clientX, w: box.offsetWidth, l: box.offsetLeft }; grip.setPointerCapture(e.pointerId); box.style.left = gs.l + 'px'; box.style.right = 'auto'; vid.style.pointerEvents = 'none'; });
  grip.addEventListener('pointermove', e => { if (!gs) return; const w = Math.max(200, Math.min(innerWidth - 8, gs.w + e.clientX - gs.x)); box.style.width = w + 'px'; box.style.left = Math.max(4, Math.min(gs.l, innerWidth - 4 - w)) + 'px'; });
  const gEnd = () => { if (!gs) return; gs = null; vid.style.pointerEvents = ''; try { localStorage.setItem('ytW', box.offsetWidth); } catch { } };
  grip.addEventListener('pointerup', gEnd); grip.addEventListener('pointercancel', gEnd);
  // la pestañita: un toque vuelve a mostrar los botones; arrastrar mueve el video
  let bst = null;
  back.addEventListener('pointerdown', e => { bst = { x: e.clientX, y: e.clientY, l: box.offsetLeft, t: box.offsetTop, m: false }; back.setPointerCapture(e.pointerId); });
  back.addEventListener('pointermove', e => { if (!bst) return; const dx = e.clientX - bst.x, dy = e.clientY - bst.y; if (!bst.m && Math.hypot(dx, dy) < 6) return; bst.m = true;
    Object.assign(box.style, { left: Math.max(4, Math.min(innerWidth - box.offsetWidth - 4, bst.l + dx)) + 'px', top: Math.max(4, Math.min(innerHeight - 60, bst.t + dy)) + 'px', right: 'auto' }); });
  back.addEventListener('pointerup', () => { const moved = bst?.m; bst = null; if (!moved) onlyVideo(false); });
  document.body.append(box);
  try { if (localStorage.getItem('ytOnly') === '1') box.classList.add('vonly'); } catch { }
  // los botones se esconden solos 4 s después de que empieza a sonar; al pasar el mouse (o tocar la notita) vuelven
  let idleT = 0; const playing = () => player?.getPlayerState?.() === 1;
  const arm = () => { clearTimeout(idleT); idleT = setTimeout(() => { if (box && playing() && !box.matches(':focus-within') && !box.classList.contains('mini')) box.classList.add('vonly'); }, 4000); };
  box.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && box.classList.contains('vonly') && !localStorage.getItem('ytOnly')) box.classList.remove('vonly'); arm(); });
  box.addEventListener('pointerdown', arm);
  autoHide = arm;
  // arrastrar desde la cabecera
  let st = null;
  head.addEventListener('pointerdown', e => { if (e.target.closest('button') && !box.classList.contains('mini')) return; st = { x: e.clientX, y: e.clientY, l: box.offsetLeft, t: box.offsetTop, m: false }; head.setPointerCapture(e.pointerId); });
  head.addEventListener('pointermove', e => { if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; if (!st.m && Math.hypot(dx, dy) < 6) return; st.m = true;
    Object.assign(box.style, { left: Math.max(4, Math.min(innerWidth - box.offsetWidth - 4, st.l + dx)) + 'px', top: Math.max(4, Math.min(innerHeight - 60, st.t + dy)) + 'px', right: 'auto' }); });
  head.addEventListener('pointerup', e => { if (st?.m) { e.stopPropagation(); head.dataset.moved = 1; setTimeout(() => delete head.dataset.moved, 60); } st = null; });
  head.addEventListener('click', e => { if (head.dataset.moved) e.stopImmediatePropagation(); }, true);

  async function start(p) {
    try { await loadApi(); } catch (e) { return toast(e.message); }
    const opts = { playerVars: { playsinline: 1, rel: 0, modestbranding: 1, ...(p.list ? { listType: 'playlist', list: p.list } : {}) },
      events: { onError: () => toast('Ese video no se puede reproducir aquí. Prueba otro enlace.', 3500), onStateChange: ev => { if (ev.data === 1) autoHide?.(); playBtn.innerHTML = icon(ev.data === 1 ? 'pause' : 'play', 20); const t = player.getVideoData?.().title; if (t) titleEl.textContent = t; } } };
    if (player?.loadVideoById) { if (p.list) player.loadPlaylist({ list: p.list, listType: 'playlist', index: 0 }); else player.loadVideoById(p.v); return; }
    player = new YT.Player('yt-frame', { ...opts, videoId: p.v || undefined, height: '100%', width: '100%' });
    player.addEventListener?.('onReady', () => player.playVideo());
  }
  startRef = start;
  const l = last(); if (l) start(l); else inp.focus();
  function close() { player?.destroy?.(); player = null; box.remove(); box = null; startRef = null; }
}
