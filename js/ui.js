// Utilidades de interfaz: nodos, íconos, diálogos y avisos.

export const LEVELS = [
  { n: 1, name: 'Título / tema', short: 'Título', color: '#2A2729', soft: 'rgba(42,39,41,.32)' },
  { n: 2, name: 'Definición o idea principal', short: 'Idea principal', color: '#8F8B8E', soft: 'rgba(143,139,142,.42)' },
  { n: 3, name: 'Dato clave', short: 'Dato clave', color: '#55555B', soft: 'rgba(85,85,91,.38)' },
  { n: 4, name: 'Detalle o ejemplo', short: 'Detalle', color: '#BDB8BB', soft: 'rgba(189,184,187,.55)' },
  { n: 5, name: 'Para repasar', short: 'Repasar', color: '#C9CED6', soft: 'rgba(201,206,214,.55)' },
];
export const levelOf = n => LEVELS.find(l => l.n === n) || LEVELS[1];
// colores de resaltador y subrayado (de verdad distintos) + los de tu estilo vaca gótica
export const HL_COLORS = ['#F4C430', '#E39B4F', '#F2A07B', '#F28FA8', '#D2573C', '#A33B4A', '#8DBF7A', '#4FB3A9', '#5B8DD9', '#A88BD8', '#6B3E26', '#2B1A1E'];   // miel, caramelo, durazno, rosa vaca, terracota, vino, salvia, turquesa, denim, lavanda, chocolate, espresso
// colores que tú elegiste con «Otro color» (se recuerdan)
export const myColors = () => { try { return JSON.parse(localStorage.getItem('myColors')) || []; } catch { return []; } };
export function addMyColor(c) { const a = [c, ...myColors().filter(x => x.toLowerCase() !== c.toLowerCase())].slice(0, 8); try { localStorage.setItem('myColors', JSON.stringify(a)); } catch { } return a; }
// abre el selector de color del sistema (cualquier color) y lo guarda en «tus colores»
export function pickColor(cur = '#FFE066') {
  return new Promise(res => {
    const i = document.createElement('input'); i.type = 'color'; i.value = /^#[0-9a-f]{6}$/i.test(cur) ? cur : '#FFE066';
    Object.assign(i.style, { position: 'fixed', left: '50%', top: '50%', opacity: 0, width: '1px', height: '1px' });
    document.body.append(i);
    let done = false; const fin = v => { if (done) return; done = true; i.remove(); if (v) addMyColor(v); res(v); };
    i.addEventListener('change', () => fin(i.value)); i.addEventListener('blur', () => setTimeout(() => fin(null), 400));
    i.click();
  });
}
// fila de colores: los de la paleta + los tuyos + «＋» para elegir cualquiera
export function colorRow(list, cur, set) {
  const row = h('div', { class: 'swatches color-row' });
  const paint = c => { cur = c; [...row.children].forEach(b => b.classList.toggle('on', b.dataset.c && b.dataset.c.toLowerCase() === (c || '').toLowerCase())); };
  const draw = () => {
    const all = [...new Set([...list, ...myColors()].map(c => c.toUpperCase()))];
    row.replaceChildren(...all.map(c => h('button', { class: 'sw-c', 'data-c': c, style: { '--c': c }, 'aria-label': 'Color ' + c, onclick: () => { set(c); paint(c); } })),
      h('button', { class: 'sw-c sw-plus', title: 'Otro color (cualquiera)', 'aria-label': 'Elegir otro color', onclick: async () => { const c = await pickColor(cur); if (c) { set(c); draw(); paint(c); } } }, '+'));
    paint(cur);
  };
  draw(); return row;
}

// Tintas del cuaderno: borgoñas, marrones y neutros cálidos
export const INKS = ['#F4F1EE', '#D9D5D7', '#B2ADB0', '#8A8588', '#5E5A5D', '#2A2729', '#0D0C0D', '#C77A3A', '#E6B98A', '#9B7A5A', '#BFC6C9', '#FFFFFF', '#E5484D', '#FF8FB1', '#FFB347', '#FFE066', '#7BE495', '#5EEAD4', '#6EC1FF', '#B48CFF', '#C08A5B', '#8A5A3C', '#2E1B14'];

export const COVERS = [
  { id: 'azabache', base: '#0E0D0E', hi: '#2C292B' },
  { id: 'grafito', base: '#1B191A', hi: '#3E3A3C' },
  { id: 'humo', base: '#2F2D2E', hi: '#5A5658' },
  { id: 'ambar', base: '#2A1A10', hi: '#6E4426' },
  { id: 'plata', base: '#4A4749', hi: '#8E8A8C' },
  { id: 'noche', base: '#14151C', hi: '#33364A' },
];

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? e.style.setProperty(sk, sv) : (e.style[sk] = sv); }
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(kid));
  return e;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const P = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.2 4.5 4.5 0 0 0 7 18z"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  box: '<path d="M4 7l8-4 8 4v10l-8 4-8-4z"/><path d="M4 7l8 4 8-4M12 11v10"/>',
  pdf: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 14h6M9 17h4"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  marker: '<path d="M4 20h6"/><path d="M14.5 4.5l5 5L11 18l-5 1 1-5z"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 20h14"/>',
  pen: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
  pencil: '<path d="M4 20l1.5-5L16 4.5l3.5 3.5L9 18.5z"/><path d="M4 20l4.5-1.5M14 6.5l3.5 3.5"/><path d="M5.5 15l3.5 3.5" stroke-dasharray="1 1.5"/>',
  brush: '<path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-5 2-5 5 0 1.7-1 3-2 3 2 1 8 1 9-3 .4-1.6 0-3-2-5z"/>',
  eraser: '<path d="M7 20h12"/><path d="M5 15l9-9 5 5-8 8H8z"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V4.5a1.5 1.5 0 0 1 3 0V12"/><path d="M14 11.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 13.5a1.5 1.5 0 0 1 2.5-1.6L8 15"/>',
  cursor: '<path d="M5 3l14 7-6 2-2 6z"/>',
  text: '<path d="M5 6V4h14v2"/><path d="M12 4v16M9 20h6"/>',
  tape: '<path d="M3 9l18-3 0 7-18 3z"/><path d="M7 8.5l.6 6.5M12 7.6l.6 6.6M17 6.8l.6 6.5"/>',
  sticker: '<path d="M4 4h16v9l-7 7H4z"/><path d="M13 20v-5a2 2 0 0 1 2-2h5"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 8"/>',
  blocks: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  split: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  page: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6"/>',
  chevL: '<path d="M14 6l-6 6 6 6"/>', chevR: '<path d="M10 6l6 6-6 6"/>',
  lasso: '<path d="M7 17c-3-1-4-4-3-7 1.5-4 8-6 12-4s4 7-1 9c-2 .8-5 .8-7 0"/><path d="M8 15c-1 2-1 4 1 6"/>',
  wand: '<path d="M4 20L15 9"/><path d="M15 3v2M15 13v2M19 7h2M9 7h2M18 4l-1.4 1.4M12 4l1.4 1.4M18 12l-1.4-1.4"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  font: '<path d="M4 20L10 4h1l6 16M6.5 14h8"/><path d="M17 20h4"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  straight: '<path d="M3 18c3-2 4 1 7-1s3-4 6-3 4 1 5 0" stroke-dasharray="2 2"/><path d="M3 9h18"/>',
  select: '<path d="M8 6h11M8 12h11M8 18h7"/><path d="M4 5v14"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  zoomin: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M11 8v6M8 11h6"/>',
  zoomout: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5M8 11h6"/>',
  fitw: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
  fitp: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8l3-3 3 3M9 16l3 3 3-3"/>',
  thin: '<path d="M7 4v6a5 5 0 0 0 10 0V4"/><path d="M4 20h16" stroke-width="1"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  handwrite: '<path d="M3 17c2-4 3-9 5-9s-1 9 1 9 2-6 4-6-1 5 1 5 2-3 3-3"/><path d="M15 4l4 4-7 7H8v-4z"/>',
  glitter: '<path d="M5 19l9-9 3 3-9 9H5z"/><path d="M17 3v4M15 5h4M20 10v2M19 11h2M11 3v2M10 4h2"/>',
  keyboard: '<rect x="3" y="8" width="18" height="9" rx="2"/><path d="M6 11h1M9 11h1M12 11h1M15 11h1M18 11h0M8 14h8"/>',
  phonekb: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M9.5 15h5M9.5 17.5h5M10 12h0M12 12h0M14 12h0"/>',
  swap: '<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  same: '<rect x="2.5" y="4" width="8" height="16" rx="1"/><rect x="13.5" y="4" width="8" height="16" rx="1"/><path d="M10.5 12h3"/>',
  tpl: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M12 9.5V5M12 14.5V19M9.5 12H5M14.5 12H19"/>',
  timeline: '<path d="M3 12h18"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/><path d="M6 10V6M12 14v4M18 10V6"/>',
  fire: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.8 2.5-5 .3 1.8 1.2 2.8 2.2 3.2C11 9 11 6 12 3z"/><path d="M5 21h14"/>',
  rain: '<path d="M7 14h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 5.2 4.5 4.5 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  water: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  wave: '<path d="M2 15c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M4 11c1-4 4-6 8-6 3 0 5 1.5 6 3.5"/>',
  wind: '<path d="M3 9h11a3 3 0 1 0-3-3"/><path d="M3 14h15a3 3 0 1 1-3 3"/><path d="M3 19h6"/>',
  volup: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  voldown: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8.5 12h1M12 12h0M15.5 12h0M8.5 15.5h1M12 15.5h0M15.5 15.5h0M8.5 19h0M12 19h0"/><path d="M15.5 17v2"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  scissors: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5L20 19M8.5 15.5L20 5"/>',
  moon: '<path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.9A7 7 0 1 1 15.5 3.5z"/>',
  play: '<path d="M7 5l12 7-12 7z"/>', pause: '<path d="M8 5v14M16 5v14"/>', prev: '<path d="M6 5v14M19 5l-10 7 10 7z"/>', next: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
  ribbon: '<path d="M7 3h10v18l-5-4-5 4z"/>',
};
export function icon(name, size = 22) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
export function iconBtn(name, title, onclick, cls = '') {
  return h('button', { class: 'icbtn ' + cls, title, 'aria-label': title, onclick, html: icon(name) });
}

export function toast(msg, ms = 2600) {
  let t = $('#toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

export function modal({ title, body, actions = [], wide = false, onClose }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal leather-panel' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true' });
  const close = () => { back.remove(); onClose && onClose(); document.removeEventListener('keydown', esc); };
  const esc = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  box.append(
    h('div', { class: 'modal-head' }, h('h2', {}, title), iconBtn('close', 'Cerrar', close)),
    h('div', { class: 'modal-body' }, body),
  );
  if (actions.length) {
    box.append(h('div', { class: 'modal-actions' }, ...actions.map(a =>
      h('button', { class: 'btn ' + (a.primary ? 'primary' : ''), onclick: async () => { const r = await a.onclick?.(); if (r !== false) close(); } }, a.label))));
  }
  back.append(box);
  back.addEventListener('pointerdown', e => { if (e.target === back) close(); });
  document.body.append(back);
  return { close, box };
}

export function ask(title, label, value = '', okLabel = 'Guardar') {
  return new Promise(res => {
    const inp = h('input', { class: 'field', value, 'aria-label': label });
    const m = modal({
      title, body: h('label', { class: 'lbl' }, label, inp),
      actions: [{ label: 'Cancelar', onclick: () => res(null) }, { label: okLabel, primary: true, onclick: () => res(inp.value.trim()) }],
      onClose: () => res(null),
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { res(inp.value.trim()); m.close(); } });
    setTimeout(() => inp.focus(), 30);
  });
}
export function confirmBox(title, text, okLabel = 'Borrar') {
  return new Promise(res => {
    modal({ title, body: h('p', {}, text), actions: [{ label: 'Cancelar', onclick: () => res(false) }, { label: okLabel, primary: true, onclick: () => res(true) }], onClose: () => res(false) });
  });
}

export function pickFile(accept, multiple = false) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    if (multiple) i.multiple = true;
    i.onchange = () => { res(multiple ? [...i.files] : i.files[0]); i.remove(); };
    document.body.append(i);
    i.click();
  });
}

export function download(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Mueve un elemento flotante arrastrándolo (círculo de herramientas, paneles)
export function makeDraggable(node, handle = node, { key, bounds } = {}) {
  let sx, sy, ox, oy, moved = false;
  if (key) {
    try { const p = JSON.parse(localStorage.getItem(key)); if (p) { node.style.left = p.x + 'px'; node.style.top = p.y + 'px'; } } catch { }
  }
  handle.addEventListener('pointerdown', e => {
    if (e.target.closest('[data-nodrag]')) return;
    sx = e.clientX; sy = e.clientY; ox = node.offsetLeft; oy = node.offsetTop; moved = false;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    const b = (bounds ? bounds() : node.offsetParent).getBoundingClientRect?.() || { width: innerWidth, height: innerHeight };
    node.style.left = Math.max(0, Math.min(b.width - node.offsetWidth, ox + dx)) + 'px';
    node.style.top = Math.max(0, Math.min(b.height - node.offsetHeight, oy + dy)) + 'px';
  });
  const end = () => {
    if (sx == null) return;
    sx = null;
    if (moved && key) try { localStorage.setItem(key, JSON.stringify({ x: node.offsetLeft, y: node.offsetTop })); } catch { }
    if (moved) { node.dataset.justMoved = '1'; setTimeout(() => delete node.dataset.justMoved, 50); }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

export function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Mover con un dedo, suave y con inercia (como cualquier app de lectura)
export function kineticPan(scroller) {
  let st = null, raf = 0;
  const stopFling = () => { cancelAnimationFrame(raf); raf = 0; };
  return {
    start(e) { stopFling(); st = { x: e.clientX, y: e.clientY, l: scroller.scrollLeft, t: scroller.scrollTop, hist: [[performance.now(), e.clientX, e.clientY]] }; },
    move(e) {
      if (!st) return false;
      st.hist.push([performance.now(), e.clientX, e.clientY]); if (st.hist.length > 6) st.hist.shift();
      st.nx = e.clientX; st.ny = e.clientY;
      if (!st.raf) st.raf = requestAnimationFrame(() => { if (!st) return; st.raf = 0; scroller.scrollLeft = st.l - (st.nx - st.x); scroller.scrollTop = st.t - (st.ny - st.y); });
      return true;
    },
    end() {
      if (!st) return false;
      const h = st.hist, a = h[0], b = h[h.length - 1]; st = null;
      const dt = Math.max(16, b[0] - a[0]);
      if (performance.now() - b[0] > 80) return true;
      let vx = (b[1] - a[1]) / dt * 16, vy = (b[2] - a[2]) / dt * 16;
      const fling = () => {
        scroller.scrollLeft -= vx; scroller.scrollTop -= vy;
        vx *= .94; vy *= .94;
        if (Math.abs(vx) + Math.abs(vy) > .4) raf = requestAnimationFrame(fling); else raf = 0;
      };
      if (Math.abs(vx) + Math.abs(vy) > 1) raf = requestAnimationFrame(fling);
      return true;
    },
    active: () => !!st,
    cancel() { st = null; stopFling(); },
  };
}
