// Reproductor de YouTube flotante: música mientras estudias, con controles y se puede mover u ocultar.
import { h, icon, toast } from './ui.js';

let box = null, player = null, apiP = null;
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

export function openMusic() {
  if (box) { box.hidden = false; box.classList.remove('mini'); return; }
  const titleEl = h('b', {}, 'Música');
  const vid = h('div', { class: 'yt-video' }, h('div', { id: 'yt-frame' }));
  const inp = h('input', { class: 'field', type: 'url', placeholder: 'Pega un enlace de YouTube (canción o lista)', 'aria-label': 'Enlace de YouTube' });
  const btn = (ic, label, fn, cls = '') => h('button', { class: cls, 'aria-label': label, title: label, html: typeof ic === 'string' && ic.length < 12 && !ic.includes(' ') ? icon(ic, 18) : ic, onclick: fn });
  const playBtn = btn('play', 'Reproducir o pausar', () => { if (!player?.getPlayerState) return; player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo(); }, 'big');
  const seek = d => player?.seekTo && player.seekTo(Math.max(0, player.getCurrentTime() + d), true);
  const vol = d => { if (!player?.setVolume) return; const v = Math.max(0, Math.min(100, player.getVolume() + d)); player.unMute(); player.setVolume(v); toast('Volumen ' + v, 900); };
  const ctrl = h('div', { class: 'yt-ctrl' },
    btn('prev', 'Canción anterior', () => player?.previousVideo?.()),
    btn('−10', 'Atrasar 10 segundos', () => seek(-10)), playBtn, btn('+10', 'Adelantar 10 segundos', () => seek(10)),
    btn('next', 'Siguiente canción', () => player?.nextVideo?.()),
    btn('vol−', 'Bajar volumen', () => vol(-10)), btn('vol+', 'Subir volumen', () => vol(10)));
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
    h('button', { class: 'icbtn', 'aria-label': 'Minimizar', title: 'Minimizar (la música sigue)', html: icon('minus', 18), onclick: () => box.classList.add('mini') }),
    h('button', { class: 'icbtn', 'aria-label': 'Cerrar la música', title: 'Cerrar la música', html: icon('close', 18), onclick: close }),
    h('button', { class: 'yt-mini-ic', 'aria-label': 'Abrir el reproductor', html: icon('music', 22), onclick: e => { e.stopPropagation(); box.classList.remove('mini'); } }));
  box = h('div', { class: 'yt leather-strip', role: 'region', 'aria-label': 'Reproductor de música' }, head, vid, ctrl, src);
  document.body.append(box);
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
      events: { onStateChange: ev => { playBtn.innerHTML = icon(ev.data === 1 ? 'pause' : 'play', 20); const t = player.getVideoData?.().title; if (t) titleEl.textContent = t; } } };
    if (player?.loadVideoById) { if (p.list) player.loadPlaylist({ list: p.list, listType: 'playlist', index: 0 }); else player.loadVideoById(p.v); return; }
    player = new YT.Player('yt-frame', { ...opts, videoId: p.v || undefined, height: '100%', width: '100%' });
    player.addEventListener?.('onReady', () => player.playVideo());
  }
  const l = last(); if (l) start(l); else inp.focus();
  function close() { player?.destroy?.(); player = null; box.remove(); box = null; }
}
