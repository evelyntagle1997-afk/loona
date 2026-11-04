// Inicio estilo launcher en cuero: materias como cuadernos, dock inferior.
import * as db from './db.js';
export const APP_VERSION = 48;
import * as sync from './sync.js';
import { h, icon, iconBtn, COVERS, modal, ask, confirmBox, toast, pickFile, download } from './ui.js';
import { addFontFiles, DAFONT } from './fonts.js';
import { AMBIENTS, play as ambPlay, stop as ambStop, playing as ambPlaying, setVolume as ambVol, volume as ambVolume } from './ambient.js';

const coverOf = id => COVERS.find(c => c.id === id) || COVERS[0];

export async function renderHome(app, go) {
  const subjects = (await db.all('subject')).sort((a, b) => (a.order ?? a.updatedAt) - (b.order ?? b.updatedAt));
  const nbs = await db.all('notebook'), pdfs = await db.all('pdf');
  const shelf = h('div', { class: 'shelf' });
  for (const s of subjects) {
    const cv = coverOf(s.cover);
    const n = nbs.filter(x => x.subject === s.id).length, p = pdfs.filter(x => x.subject === s.id).length;
    shelf.append(h('button', { class: 'cover', style: { '--cb': cv.base, '--ch': cv.hi }, onclick: () => go(`#/m/${s.id}`), 'aria-label': 'Abrir ' + s.name },
      h('span', { class: 'strap' }),
      h('span', { class: 'cover-label' }, h('span', { class: 'cover-name' }, s.name)),
      h('span', { class: 'cover-meta' }, `${n} ${n === 1 ? 'cuaderno' : 'cuadernos'} · ${p} PDF`)));
  }
  shelf.append(h('button', { class: 'cover new', onclick: () => newSubject(go) }, h('span', { class: 'new-plus', html: icon('plus', 34) }), h('span', { class: 'cover-meta' }, 'Nueva materia')));

  const cloud = h('button', { class: 'dock-btn', onclick: () => settings('nube') }, h('span', { class: 'dk-ic', html: icon('cloud') }), h('span', { class: 'dk-l' }, 'Nube'));
  sync.onStatus(st => {
    const map = { off: 'Configurar', signedout: 'Entrar', syncing: 'Guardando…', ok: 'Al día', error: 'Revisar', offline: 'Sin conexión' };
    cloud.querySelector('.dk-l').textContent = map[st.status] || 'Nube';
    cloud.dataset.st = st.status;
    cloud.title = st.error || '';
  });
  let lastS = null; try { lastS = JSON.parse(localStorage.getItem('lastStudy')); } catch { }
  const lastOk = lastS && (await db.get(lastS.id)) && !(await db.get(lastS.id)).deleted;
  const resume = lastOk ? h('button', { class: 'resume leather-strip', onclick: () => go(lastS.hash) },
    h('span', { class: 'resume-ic', html: icon(lastS.pdf ? 'pdf' : 'book', 24) }),
    h('span', { class: 'resume-txt' }, h('b', {}, 'Seguir estudiando'), h('small', {}, lastS.title + (lastS.subject ? ' · ' + lastS.subject : '') + (lastS.page ? ' · pág. ' + lastS.page : '')))) : null;
  // Agenda abierta (foto realista de fondo) con zonas tocables encima
  const P = (cls, l, t, w, hh, ...kids) => h('div', { class: 'ag-z ' + cls, style: { left: l + '%', top: t + '%', width: w + '%', height: hh + '%' } }, ...kids);
  const card = (cls, l, t, w, label, sub, fn) => h('button', { class: 'ag-z ag-card ' + cls, style: { left: l + '%', top: t + '%', width: w + '%' }, onclick: fn, 'aria-label': label }, h('b', {}, label), sub ? h('small', {}, sub) : null);
  const idx = h('div', { class: 'ag-index' },
    h('p', { class: 'ag-idx-h' }, subjects.length ? 'Materias' : 'Empieza aquí'),
    ...subjects.map(s => { const n = nbs.filter(x => x.subject === s.id).length, p = pdfs.filter(x => x.subject === s.id).length;
      return h('button', { class: 'ag-sub', onclick: () => go(`#/m/${s.id}`) }, h('span', {}, s.name), h('small', {}, `${n} cuad. · ${p} PDF`)); }),
    h('button', { class: 'ag-sub ag-new', onclick: () => newSubject(go) }, h('span', { html: icon('plus', 16) }), h('span', {}, 'Nueva materia')));
  const pocket = h('div', { class: 'ag-z ag-pocket', style: { left: '8.6%', top: '56.8%', width: '20.8%', height: '28.6%' }, role: 'button', tabindex: 0, 'aria-label': 'Tu foto en el bolsillo' });
  initPocket(pocket);
  const hour = new Date().getHours(), hi = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const scene = h('div', { class: 'agenda' },
    h('img', { class: 'ag-bg', src: 'img/agenda.webp', srcset: 'img/agenda-s.webp 1024w, img/agenda.webp 1536w', sizes: '(max-width: 700px) 1000px, 100vw', alt: '', draggable: false, fetchpriority: 'high' }),
    h('button', { class: 'ag-z ag-note ag-hot', style: { left: '20.4%', top: '13.6%', width: '15.4%', height: '26.4%' }, 'aria-label': 'Nota del clip: escribe un recordatorio', title: 'Tu nota: toca para escribir un recordatorio', onclick: editNote },
      h('span', { class: 'ag-hi' }, hi + ', Eve'),
      h('span', { class: 'ag-date' }, new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })),
      h('span', { class: 'ag-xo' }, noteText() || (subjects.length ? '¿qué estudiamos hoy?' : 'crea tu primera materia')),
      h('span', { class: 'ag-sign' }, 'XOXO, Loona')),
    card('c1' + (lastOk ? '' : ' dim'), 8.5, 24.3, 10.8, lastOk ? 'Seguir estudiando' : 'Sin pendientes', lastOk ? lastS.title + (lastS.page ? ' · pág. ' + lastS.page : '') : '', () => lastOk && go(lastS.hash)),
    card('c2', 8.5, 31, 10.8, 'Nueva materia', '', () => newSubject(go)),
    card('c3', 8.5, 38.2, 10.8, 'Música', 'YouTube', () => import('./music.js').then(m => m.openMusic())),
    card('c4', 8.5, 45, 16.4, 'Ambiente', ambPlaying() ? 'sonando' : 'lluvia, chimenea…', e => ambientMenu(e.currentTarget)),
    pocket,
    hot('ag-charm', 36.6, 53, 4.4, 17, 'Cristal ámbar: conversar con Loona', () => import('./loona.js').then(m => m.callLoona())),
    hot('ag-medal', 41.6, 54, 4.4, 7, 'Medallón: temporizador de estudio', () => pomodoro()),
    hot('ag-key', 39.6, 61.5, 4.2, 12, 'Llave: Loona te escucha siempre (manos libres)', () => import('./handsfree.js').then(m => m.toggle())),
    hot('ag-clip', 24.8, 0.5, 6.8, 16, 'Clip: tu cuenta en la nube y copia', () => settings('nube')),
    hot('ag-rings', 46.6, 9, 5.4, 82, 'Argollas: ajustes de la IA', () => settings('ia')),
    hot('ag-tab', 88, 27, 2.6, 12.5, 'Pestaña: letras y fuentes', () => settings('fuentes')),
    hot('ag-strap', 91, 40.5, 7.2, 16, 'Broche: pantalla completa', () => toggleFull()),
    P('ag-page', 52, 12, 35, 75, idx),
    h('span', { class: 'ag-word', 'aria-hidden': 'true' }, 'Loona'),
    h('span', { class: 'ag-ver' }, 'v' + APP_VERSION));
  const vp = h('div', { class: 'ag-vp' }, scene);
  app.replaceChildren(h('div', { class: 'home ag-home' },
    h('h1', { class: 'sr-only' }, 'Loona'),
    vp,
    h('nav', { class: 'dock leather-strip ag-dock' },
      cloud,
      h('button', { class: 'dock-btn', onclick: () => settings('ia') }, h('span', { class: 'dk-ic', html: icon('spark') }), h('span', { class: 'dk-l' }, 'IA')),
      h('button', { class: 'dock-btn', onclick: () => settings('fuentes') }, h('span', { class: 'dk-ic', html: icon('font') }), h('span', { class: 'dk-l' }, 'Fuentes')),
      h('button', { class: 'dock-btn', onclick: () => settings('copia') }, h('span', { class: 'dk-ic', html: icon('box') }), h('span', { class: 'dk-l' }, 'Copia')),
      h('button', { class: 'dock-btn', onclick: toggleFull }, h('span', { class: 'dk-ic', html: icon('full') }), h('span', { class: 'dk-l' }, 'Pantalla')),
    )));
  // en celular vertical: la agenda se desliza entre bolsillos y hojas; empieza en las materias
  if (innerWidth < innerHeight) requestAnimationFrame(() => { vp.scrollLeft = scene.offsetWidth * 0.46; });
}

// tu foto en el bolsillo transparente (blanco y negro). Al ponerla puedes moverla y agrandarla;
// al tocar «Listo» queda fija y ya no se mueve.
function initPocket(pocket) {
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
  let photo = get('homePhoto'), pos = { x: 0, y: 0, s: 1, r: 0 }, menuT = 0;
  try { pos = { ...pos, ...JSON.parse(get('homePhotoPos') || '{}') }; } catch { }
  const tf = p => `translate(${p.x * 100}%, ${p.y * 100}%) rotate(${p.r}deg) scale(${p.s})`;
  const img = h('img', { alt: '', draggable: false });
  const bar = h('div', { class: 'pk-bar' });
  const b = (txt, fn, cls = '') => h('button', { class: 'pk-b ' + cls, onclick: e => { e.stopPropagation(); fn(); } }, txt);
  const draw = () => {
    if (photo) { img.src = photo; img.style.transform = tf(pos); pocket.replaceChildren(img, bar); }
    else pocket.replaceChildren(h('span', { class: 'ag-pocket-t' }, 'Toca para poner tu foto'));
  };
  // editor grande: la foto se acomoda en un marco con la misma forma del bolsillo
  const editor = () => {
    const r = pocket.getBoundingClientRect(), ratio = r.width / r.height;
    const W = Math.min(innerWidth - 60, 460), H = W / ratio;
    const p = { ...pos };
    const im = h('img', { src: photo, alt: '', draggable: false });
    const frame = h('div', { class: 'pk-frame', style: { width: W + 'px', height: H + 'px' } }, im);
    const put = () => { im.style.transform = tf(p); };
    const zoom = k => { p.s = Math.max(.3, Math.min(5, p.s * k)); put(); };
    const pts = new Map(); let last = null;
    frame.addEventListener('pointerdown', e => { e.preventDefault(); frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = null; });
    frame.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size >= 2) { const [a, c] = [...pts.values()], d = Math.hypot(a[0] - c[0], a[1] - c[1]); if (last) zoom(d / last); last = d; return; }
      p.x = Math.max(-1.5, Math.min(1.5, p.x + (e.clientX - prev[0]) / W)); p.y = Math.max(-1.5, Math.min(1.5, p.y + (e.clientY - prev[1]) / H)); put();
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) last = null; };
    frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
    frame.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-e.deltaY * .002)); }, { passive: false });
    put();
    const m = modal({ title: 'Acomoda tu foto', body: h('div', { class: 'pk-ed' },
      h('p', { class: 'opt-hint' }, 'Arrastra la foto con el dedo o el mouse. Pellizca o usa + y − para el tamaño.'),
      frame,
      h('div', { class: 'ie-row pk-tools' },
        h('button', { class: 'btn', onclick: () => zoom(1 / 1.12) }, '−'), h('button', { class: 'btn', onclick: () => zoom(1.12) }, '+'),
        h('button', { class: 'btn', onclick: () => { p.r -= 90; put(); } }, '↺ Girar'),
        h('button', { class: 'btn', onclick: () => { Object.assign(p, { x: 0, y: 0, s: 1, r: 0 }); put(); } }, 'Centrar'),
        h('button', { class: 'btn', onclick: () => { m.close(); change(); } }, 'Otra foto'))),
      actions: [{ label: 'Cancelar' }, { label: 'Listo', primary: true, onclick: () => { pos = p; set('homePhotoPos', JSON.stringify(pos)); draw(); toast('Foto fija', 1200); } }] });
  };
  const change = async () => {
    const f = await pickFile('image/*'); if (!f) return;
    const bm = await createImageBitmap(f); const sc = Math.min(1, 1000 / Math.max(bm.width, bm.height));
    const c = document.createElement('canvas'); c.width = bm.width * sc; c.height = bm.height * sc;
    const x = c.getContext('2d'); x.filter = 'grayscale(1) contrast(1.15)'; x.drawImage(bm, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', .8);
    if (!set('homePhoto', url)) return toast('La foto es muy grande');
    // empieza llenando el bolsillo (luego la acomodas como quieras)
    const pr = pocket.getBoundingClientRect(), fr = pr.width / pr.height, ir = c.width / c.height;
    photo = url; pos = { x: 0, y: 0, s: +Math.max(fr / ir, ir / fr).toFixed(3), r: 0 }; draw(); editor();
  };
  pocket.addEventListener('click', () => {
    if (!photo) return change();
    bar.replaceChildren(b('Acomodar', editor), b('Cambiar', change));   // menú pequeño; se esconde solo
    clearTimeout(menuT); menuT = setTimeout(() => bar.replaceChildren(), 3500);
  });
  pocket.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pocket.click(); } });
  draw();
}

// zona tocable sobre un objeto de la foto (se ilumina al pasar el mouse y muestra qué hace)
function hot(cls, l, t, w, hh, label, fn) {
  return h('button', { class: 'ag-z ag-hot ' + cls, style: { left: l + '%', top: t + '%', width: w + '%', height: hh + '%' }, 'aria-label': label, title: label, 'data-tip': label.split(':')[1]?.trim() || label, onclick: e => { e.stopPropagation(); fn(e); } });
}
const noteText = () => { try { return localStorage.getItem('homeNote') || ''; } catch { return ''; } };
async function editNote(e) {
  const v = await ask('Tu nota', 'Recordatorio (ej.: repasar genética antes del jueves)', noteText(), 'Guardar');
  if (v == null) return;
  try { localStorage.setItem('homeNote', v.trim().slice(0, 80)); } catch { }
  const el = e.currentTarget?.querySelector?.('.ag-xo') || document.querySelector('.ag-xo'); if (el) el.textContent = v.trim() || '¿qué estudiamos hoy?';
}

// ---------- temporizador de estudio (Pomodoro) ----------
// Sigue contando aunque cambies de pantalla; Loona te avisa con su voz al terminar.
let pomoT = 0;
export function pomodoro() {
  const st = (() => { try { return JSON.parse(localStorage.getItem('pomo')); } catch { return null; } })();
  const run = (min, kind) => { try { localStorage.setItem('pomo', JSON.stringify({ end: Date.now() + min * 60000, kind })); } catch { } m.close(); pomoTick(); toast(kind === 'pausa' ? `Descanso de ${min} min` : `A estudiar ${min} min. Te aviso al terminar.`, 2500); };
  const m = modal({ title: 'Temporizador', body: h('div', { class: 'pomo-box' },
    h('p', {}, st && st.end > Date.now() ? `Faltan ${fmt(st.end - Date.now())} (${st.kind}).` : 'Estudia concentrada y descansa un poco. Loona te avisa.'),
    h('div', { class: 'ie-row' },
      h('button', { class: 'btn primary', onclick: () => run(25, 'estudio') }, 'Estudiar 25 min'),
      h('button', { class: 'btn primary', onclick: () => run(50, 'estudio') }, 'Estudiar 50 min'),
      h('button', { class: 'btn', onclick: () => run(5, 'pausa') }, 'Descanso 5 min')),
    st && st.end > Date.now() ? h('button', { class: 'btn', onclick: () => { localStorage.removeItem('pomo'); pomoTick(); m.close(); } }, 'Detener') : null) });
}
const fmt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export function pomoTick() {
  clearTimeout(pomoT);
  let st = null; try { st = JSON.parse(localStorage.getItem('pomo')); } catch { }
  let chip = document.getElementById('pomo-chip');
  if (!st) { chip?.remove(); return; }
  const left = st.end - Date.now();
  if (left <= 0) {
    try { localStorage.removeItem('pomo'); } catch { } chip?.remove();
    import('./loona.js').then(L => L.speak(st.kind === 'pausa' ? 'Se acabó el descanso, Eve. Vuelve, que el ENEM no espera.' : 'Tiempo, Eve. Bien hecho. Levántate, toma agua y descansa cinco minutos.'));
    return;
  }
  if (!chip) { chip = h('button', { id: 'pomo-chip', class: 'pomo-chip', 'aria-label': 'Temporizador', onclick: pomodoro }); document.body.append(chip); }
  chip.textContent = (st.kind === 'pausa' ? 'Descanso ' : 'Estudio ') + fmt(left);
  pomoT = setTimeout(pomoTick, 1000);
}

export function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => toast('Tu navegador no permite pantalla completa aquí. Instala la app desde el menú del navegador.'));
}

function coverPicker(cur) {
  let val = cur || COVERS[0].id;
  const wrap = h('div', { class: 'cover-pick' }, ...COVERS.map(c => {
    const b = h('button', { class: 'mini-cover' + (c.id === val ? ' on' : ''), style: { '--cb': c.base, '--ch': c.hi }, 'aria-label': 'Cuero ' + c.id, onclick: () => { val = c.id; wrap.querySelectorAll('.mini-cover').forEach(x => x.classList.toggle('on', x === b)); } });
    return b;
  }));
  return { wrap, get: () => val };
}

async function newSubject(go, existing) {
  const name = h('input', { class: 'field', value: existing?.name || '', placeholder: 'Ej.: Economía, Histología, Concreto armado' });
  const cp = coverPicker(existing?.cover);
  modal({
    title: existing ? 'Editar materia' : 'Nueva materia',
    body: h('div', {}, h('label', { class: 'lbl' }, 'Nombre', name), h('div', { class: 'lbl' }, 'Color del cuero', cp.wrap)),
    actions: [{ label: 'Cancelar' }, {
      label: existing ? 'Guardar' : 'Crear materia', primary: true, onclick: async () => {
        if (!name.value.trim()) { toast('Escribe el nombre de la materia'); return false; }
        const cv = coverOf(cp.get());
        if (existing) { Object.assign(existing, { name: name.value.trim(), cover: cp.get(), coverColor: '#D9D5D7' }); await db.put(existing); go(location.hash); return; }
        const s = await db.put({ id: db.uid('sub_'), kind: 'subject', name: name.value.trim(), cover: cp.get(), coverColor: '#D9D5D7', order: Date.now() });
        await db.put({ id: db.uid('nb_'), kind: 'notebook', subject: s.id, name: 'Resúmenes', paper: 'puntos', tone: 'negro' });
        go(`#/m/${s.id}`);
      },
    }],
  });
  setTimeout(() => name.focus(), 50);
}

export async function renderSubject(app, go, id) {
  const s = await db.get(id);
  if (!s || s.deleted) return go('#/');
  const cv = coverOf(s.cover);
  const nbs = (await db.where('notebook', x => x.subject === id)).sort((a, b) => (a.created || 0) - (b.created || 0));
  const pdfs = (await db.where('pdf', x => x.subject === id)).sort((a, b) => b.updatedAt - a.updatedAt);
  const hls = await db.where('hl', x => x.subject === id);

  const nbShelf = h('div', { class: 'nb-shelf' }, ...nbs.map(nb => h('div', { class: 'nb-card' },
    h('button', { class: 'cover small', style: { '--cb': cv.base, '--ch': cv.hi }, onclick: () => go(`#/c/${nb.id}`), 'aria-label': 'Abrir cuaderno ' + nb.name },
      h('span', { class: 'strap' }), h('span', { class: 'cover-label' }, h('span', { class: 'cover-name' }, nb.name))),
    h('div', { class: 'card-acts' },
      iconBtn('text', 'Renombrar', async () => { const v = await ask('Renombrar cuaderno', 'Nombre', nb.name); if (v) { nb.name = v; await db.put(nb); go(location.hash); } }),
      iconBtn('trash', 'Borrar cuaderno', async () => {
        if (!await confirmBox('Borrar cuaderno', `Se borrará "${nb.name}" con todas sus páginas.`)) return;
        for (const p of await db.where('page', x => x.notebook === nb.id)) await db.remove(p.id);
        await db.remove(nb.id); go(location.hash);
      })),
  )), h('button', { class: 'cover small new', onclick: async () => { const v = await ask('Nuevo cuaderno', 'Nombre del cuaderno', 'Apuntes de clase', 'Crear'); if (v) { await db.put({ id: db.uid('nb_'), kind: 'notebook', subject: id, name: v, paper: 'puntos', tone: 'negro', created: Date.now() }); go(location.hash); } } }, h('span', { class: 'new-plus', html: icon('plus', 28) }), h('span', { class: 'cover-meta' }, 'Nuevo cuaderno')));

  const pdfList = h('div', { class: 'pdf-list' });
  for (const p of pdfs) {
    const count = hls.filter(x => x.pdf === p.id).length;
    const nbName = nbs.find(n => n.id === p.notebook)?.name;
    pdfList.append(h('div', { class: 'pdf-card' },
      h('button', { class: 'pdf-open', onclick: () => go(`#/e/${p.id}`) },
        h('span', { class: 'pdf-ic', html: icon('pdf', 28) }),
        h('span', { class: 'pdf-txt' }, h('b', {}, p.name), h('small', {}, `${p.pages ? p.pages + ' págs. · ' : ''}${count} ${count === 1 ? 'subrayado' : 'subrayados'}${nbName ? ' · va a ' + nbName : ''}`))),
      h('div', { class: 'card-acts' },
        iconBtn('download', 'Descargar con subrayados', () => go(`#/e/${p.id}?export=1`)),
        iconBtn('trash', 'Borrar PDF', async () => {
          if (!await confirmBox('Borrar PDF', `Se borrará "${p.name}" y sus subrayados. Lo ya pasado al cuaderno se queda.`)) return;
          for (const x of hls.filter(x => x.pdf === p.id)) await db.remove(x.id);
          await db.remove(p.id); go(location.hash);
        }))));
  }
  if (!pdfs.length) pdfList.append(h('p', { class: 'empty' }, 'Sube un PDF para leerlo, subrayarlo y que se resuma solo en tu cuaderno.'));

  const { audioList, audioRow } = await import('./recorder.js');
  const auds = await audioList(id);
  const audSec = h('section', {}, h('h2', { class: 'sec-h' }, 'Clases grabadas'),
    auds.length ? h('div', { class: 'aud-list' }, ...auds.map(a => audioRow(a))) : h('p', { class: 'empty' }, 'Graba una clase desde la rueda del cuaderno (botón del micrófono). Aquí quedan ordenadas con su título y su transcripción.'));
  app.replaceChildren(h('div', { class: 'subject leather-desk', style: { '--cb': cv.base, '--ch': cv.hi } },
    h('header', { class: 'bar leather-strip' },
      iconBtn('back', 'Volver al inicio', () => go('#/')),
      h('h1', { class: 'bar-title' }, s.name),
      iconBtn('text', 'Editar materia', () => newSubject(go, s)),
      iconBtn('trash', 'Borrar materia', async () => {
        if (!await confirmBox('Borrar materia', `Se borrará "${s.name}" con sus cuadernos y PDFs.`)) return;
        for (const k of ['notebook', 'pdf', 'hl', 'page']) for (const x of await db.where(k, x => x.subject === id)) await db.remove(x.id);
        await db.remove(id); go('#/');
      }),
    ),
    h('div', { class: 'subject-body' },
      h('section', {}, h('h2', { class: 'sec-h' }, 'PDFs para estudiar'),
        h('button', { class: 'btn primary upload', html: icon('upload', 20) + 'Subir PDF', onclick: () => uploadPdf(id, nbs, go) }), pdfList),
      h('section', {}, h('h2', { class: 'sec-h' }, 'Cuadernos'), nbShelf),
      audSec,
    )));
}

async function uploadPdf(subject, nbs, go) {
  const files = await pickFile('application/pdf,.pdf', true);
  if (!files?.length) return;
  let last;
  for (const f of files) {
    const blobId = db.uid('pdfb_');
    await db.putBlob(blobId, f, { type: 'application/pdf' });
    last = await db.put({ id: db.uid('pdf_'), kind: 'pdf', subject, name: f.name.replace(/\.pdf$/i, ''), blob: blobId, notebook: nbs[0]?.id });
  }
  if (files.length === 1) go(`#/e/${last.id}`); else go(location.hash);
}

// ---------- Ajustes ----------
export async function settings(tab = 'nube') {
  const st = await db.settings();
  const tabs = { nube: 'Nube', ia: 'IA', fuentes: 'Fuentes', copia: 'Copia' };
  const body = h('div', { class: 'settings' });
  const nav = h('div', { class: 'tabs' }, ...Object.entries(tabs).map(([k, l]) => h('button', { class: 'tab' + (k === tab ? ' on' : ''), onclick: () => { m.close(); settings(k); } }, l)));
  body.append(nav);
  if (tab === 'nube') {
    const cfg = sync.getCfg(), ses = sync.session();
    const url = h('input', { class: 'field', value: cfg.url || '', placeholder: 'https://xxxx.supabase.co' });
    const key = h('input', { class: 'field', value: cfg.key || '', placeholder: 'clave publishable / anon' });
    const email = h('input', { class: 'field', type: 'email', value: ses?.email || '', placeholder: 'tu correo' });
    const pass = h('input', { class: 'field', type: 'password', placeholder: 'contraseña (mín. 6)' });
    const status = h('p', { class: 'opt-hint' });
    sync.onStatus(s => { status.textContent = ses ? ({ ok: 'Sincronizado ' + (s.last ? 'a las ' + new Date(s.last).toLocaleTimeString().slice(0, 5) : ''), syncing: 'Sincronizando…', error: s.error, offline: 'Sin conexión: se guarda en este dispositivo y se sube luego.' }[s.status] || '') : 'Sin sesión.'; });
    const saveCfg = () => sync.setCfg({ url: url.value.trim(), key: key.value.trim() });
    body.append(
      h('p', {}, 'Tus cuadernos se guardan siempre en este dispositivo. Con la nube, la PC y el celular se ponen al día solos. Usa tu propia cuenta gratuita de Supabase (la guía está en el archivo LEEME).'),
      h('label', { class: 'lbl' }, 'URL del proyecto', url), h('label', { class: 'lbl' }, 'Clave pública (anon)', key),
      h('details', { class: 'sql' }, h('summary', {}, 'Código SQL para crear la tabla (paso 3)'), h('pre', {}, sync.SQL),
        h('button', { class: 'chip', html: icon('copy', 16) + 'Copiar SQL', onclick: () => navigator.clipboard.writeText(sync.SQL).then(() => toast('SQL copiado')) })),
      ses ? h('div', { class: 'ie-row' }, h('b', {}, ses.email), h('button', { class: 'chip', onclick: () => { sync.syncNow(); } }, 'Sincronizar ahora'), h('button', { class: 'chip', onclick: () => { sync.signOut(); m.close(); settings('nube'); } }, 'Cerrar sesión'))
        : h('div', {}, h('label', { class: 'lbl' }, 'Correo', email), h('label', { class: 'lbl' }, 'Contraseña', pass),
          h('div', { class: 'ie-row' },
            h('button', { class: 'btn primary', onclick: async () => { saveCfg(); try { await sync.signIn(email.value.trim(), pass.value); toast('Conectada a la nube'); m.close(); } catch (e) { toast(e.message, 4500); } } }, 'Entrar'),
            h('button', { class: 'btn', onclick: async () => { saveCfg(); try { const r = await sync.signUp(email.value.trim(), pass.value); if (r === 'ok') { sync.start(); toast('Cuenta creada y conectada'); m.close(); } else toast('Revisa tu correo para confirmar la cuenta y luego pulsa Entrar.', 6000); } catch (e) { toast(e.message, 4500); } } }, 'Crear cuenta'))),
      status,
    );
  } else if (tab === 'ia') {
    const key = h('input', { class: 'field', type: 'password', value: st.geminiKey || '', placeholder: 'Pega tu clave de Gemini' });
    const model = h('input', { class: 'field', value: st.geminiModel || 'gemini-3.6-flash' });
    const auto = h('input', { type: 'checkbox' }); auto.checked = st.aiAuto ?? true;
    body.append(
      h('p', {}, 'Sin clave, la app resume sola con reglas (detecta definiciones, fechas, lugares, causas, tipos…). Con una clave gratuita de Google Gemini, además reescribe el resumen más claro, te explica el tema con una analogía, un truco para memorizar y preguntas de repaso.'),
      h('label', { class: 'lbl' }, 'Clave de Gemini (aistudio.google.com → Get API key)', key),
      h('label', { class: 'lbl' }, 'Modelo', model),
      h('label', { class: 'dp-tg' }, auto, h('span', { class: 'sw' }), 'Mejorar con IA automáticamente al terminar de subrayar un tema'),
      h('p', { class: 'opt-hint' }, 'La clave se guarda en tu dispositivo y en tu nube privada. El texto subrayado se envía a Google solo cuando se usa la IA.'),
      h('div', { class: 'ie-row' }, h('button', { class: 'btn primary', onclick: async () => { await db.saveSettings({ geminiKey: key.value.trim(), geminiModel: model.value.trim() || 'gemini-3.6-flash', aiAuto: auto.checked }); toast('Ajustes de IA guardados'); m.close(); } }, 'Guardar')),
    );
  } else if (tab === 'fuentes') {
    const list = h('ul', { class: 'font-own' }, ...(await db.all('font')).map(f => h('li', { style: { fontFamily: `'${f.family}'` } }, f.family)));
    body.append(
      h('p', {}, 'Ya vienen 30 fuentes de lettering y apuntes. Para usar fuentes de DaFont: ábrelo, pulsa "Descargar" en la que te guste y sube aquí el .zip tal cual; la app saca la fuente sola y aparece en "Mis fuentes" en todos tus dispositivos.'),
      h('div', { class: 'ie-row' }, ...DAFONT.map(d => h('a', { class: 'chip', href: d.url, target: '_blank', rel: 'noopener' }, 'DaFont: ' + d.name))),
      h('div', { class: 'ie-row' }, h('button', { class: 'btn primary', html: icon('upload', 18) + 'Subir .zip de DaFont o .ttf/.otf', onclick: async () => { const fs = await pickFile('.zip,.ttf,.otf,.woff,.woff2,application/zip', true); if (!fs?.length) return; try { const added = await addFontFiles(fs); toast(added.length ? 'Fuentes añadidas: ' + added.join(', ') : 'No se encontraron fuentes', 4500); m.close(); settings('fuentes'); } catch (e) { toast(e.message, 4500); } } })),
      h('p', { class: 'opt-hint' }, 'En DaFont fíjate en la etiqueta: "100% Gratis" o "Gratis para uso personal" sirven para tus apuntes.'),
      list,
    );
  } else {
    const bk = await import('./backup.js');
    const bkBox = h('div', {});
    const drawBk = st => bkBox.replaceChildren(
      h('p', {}, bk.supported() ? 'Elige una carpeta de tu PC (por ejemplo, Documentos/Loona) y cada cambio se copiará solo ahí, aunque no uses la nube.' : 'En este dispositivo no se puede guardar en una carpeta. Usa la Nube para tener respaldo automático.'),
      st.on ? h('p', { class: 'opt-hint' }, 'Activado' + (st.last ? ' · última copia a las ' + new Date(st.last).toLocaleTimeString().slice(0, 5) : '')) : st.need ? h('p', { class: 'opt-hint' }, 'El navegador pide confirmar el permiso de la carpeta.') : null,
      bk.supported() ? h('div', { class: 'ie-row' },
        st.need ? h('button', { class: 'btn primary', onclick: () => bk.reconnect() }, 'Permitir de nuevo') : h('button', { class: 'btn primary', onclick: async () => { try { await bk.choose(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, 4500); } } }, st.on ? 'Cambiar carpeta' : 'Elegir carpeta y activar'),
        st.on ? h('button', { class: 'btn', onclick: () => bk.run().then(() => toast('Copia hecha')) }, 'Copiar ahora') : null,
        h('button', { class: 'btn', onclick: async () => { try { const n = await bk.restore(); toast('Recuperado: ' + n + ' elementos'); m.close(); location.reload(); } catch (e) { if (e.name !== 'AbortError') toast(e.message, 4500); } } }, 'Recuperar desde una carpeta'),
        st.on ? h('button', { class: 'chip', onclick: () => bk.off() }, 'Desactivar') : null) : null);
    bk.onBackup(drawBk);
    body.append(
      h('h3', {}, 'Respaldo automático en tu PC'),
      bkBox,
      h('h3', {}, 'Copia en un archivo'),
      h('p', {}, 'Guarda todo (materias, cuadernos, PDFs, fotos) en un solo archivo, por si quieres una copia extra fuera de la nube.'),
      h('div', { class: 'ie-row' },
        h('button', { class: 'btn primary', html: icon('download', 18) + 'Descargar copia', onclick: async () => { toast('Preparando copia…'); download(await db.exportAll(), `mis-apuntes-${new Date().toISOString().slice(0, 10)}.json`); } }),
        h('button', { class: 'btn', html: icon('upload', 18) + 'Restaurar copia', onclick: async () => { const f = await pickFile('.json,application/json'); if (!f) return; try { await db.importAll(f); toast('Copia restaurada'); m.close(); location.reload(); } catch (e) { toast(e.message, 4000); } } })),
    );
  }
  const m = modal({ title: 'Ajustes', body, wide: true });
}

// Ambientes para estudiar: fogata, lluvia, bosque…
export function ambientMenu(btn) {
  const list = h('div', { class: 'amb-list' });
  const draw = () => {
    list.replaceChildren(...AMBIENTS.map(a => h('button', { class: 'amb' + (ambPlaying() === a.k ? ' on' : ''), onclick: () => { ambPlaying() === a.k ? ambStop() : ambPlay(a.k); setTimeout(draw, 50); btn?.classList.toggle('on', !!ambPlaying()); } },
      h('span', { class: 'amb-ic', html: icon(a.icon, 26) }), h('span', {}, a.name))));
  };
  draw();
  const volIn = h('input', { type: 'range', min: 0, max: 1, step: .05, value: ambVolume(), oninput: e => ambVol(+e.target.value) });
  modal({
    title: 'Ambiente para estudiar', wide: true,
    body: h('div', {}, h('p', { class: 'opt-hint' }, 'Sonidos de naturaleza generados en vivo: funcionan sin internet y siguen sonando mientras estudias. También están en la rueda (ícono de fogata).'),
      list, h('label', { class: 'dp-row amb-vol' }, 'Volumen', volIn)),
    actions: [{ label: 'Apagar', onclick: () => { ambStop(); btn?.classList.remove('on'); } }, { label: 'Listo', primary: true }],
  });
}
