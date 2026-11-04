// Vista de estudio: PDF a un lado, cuaderno al otro (o solo uno de los dos).
import * as db from './db.js';
import { h, icon, iconBtn, toast, download, clamp } from './ui.js';
import { PdfView } from './pdfview.js';
import { Notebook } from './notebook.js';
import { toggleFull } from './home.js';
import { Wheel } from './wheel.js';
import { modal } from './ui.js';

let current = null;
export function leaveStudy() { current?.pdf?.destroy(); current?.nb?.destroy(); current?.wheels?.forEach(w => w.destroy()); current = null; }

export async function renderStudy(app, go, { pdfId, nbId, exportOnly }) {
  leaveStudy();
  const pdf = pdfId ? await db.get(pdfId) : null;
  let nb = nbId ? await db.get(nbId) : pdf?.notebook ? await db.get(pdf.notebook) : null;
  const subjectId = pdf?.subject || nb?.subject;
  const subject = await db.get(subjectId);
  const nbs = (await db.where('notebook', x => x.subject === subjectId)).sort((a, b) => (a.created || 0) - (b.created || 0));
  if (!nb || nb.deleted) nb = nbs[0];
  if (!nb && subjectId) nb = await db.put({ id: db.uid('nb_'), kind: 'notebook', subject: subjectId, name: 'Resúmenes', paper: 'puntos', tone: 'negro' });
  if (pdf && pdf.notebook !== nb?.id) { pdf.notebook = nb.id; await db.put(pdf); }
  let settings = await db.settings();
  db.onChange(r => { if (r.id === 'settings') settings = r; });

  const mode = pdf ? (localStorage.getItem('studyMode') || 'split') : 'nb';
  const pdfPane = h('div', { class: 'pane pdf-pane' });
  const nbPane = h('div', { class: 'pane nb-pane' });
  const divider = h('div', { class: 'divider', role: 'separator', 'aria-label': 'Arrastra para cambiar el tamaño' }, h('span'));
  const split = h('div', { class: 'split', 'data-mode': mode }, pdfPane, divider, nbPane);
  // por defecto el cuaderno va a la izquierda (arriba en el celular) y el PDF a la derecha
  const nbLeft = () => localStorage.getItem('nbLeft') !== '0';
  split.classList.toggle('nb-left', nbLeft());
  const ratio = +localStorage.getItem('splitRatio') || .5;
  split.style.setProperty('--r', ratio);

  const nbSelect = h('select', { class: 'nb-select', 'aria-label': 'Cuaderno de destino', onchange: e => go(pdf ? `#/e/${pdf.id}?nb=${e.target.value}` : `#/c/${e.target.value}`) },
    ...nbs.map(n => { const o = h('option', { value: n.id }, n.name); if (n.id === nb.id) o.selected = true; return o; }));
  const modeBtns = pdf ? h('div', { class: 'seg' }, ...[['pdf', 'pdf', 'Solo PDF'], ['split', 'split', 'PDF y cuaderno'], ['nb', 'book', 'Solo cuaderno']].map(([k, ic, t]) =>
    h('button', { class: 'seg-b' + (k === mode ? ' on' : ''), title: t, 'aria-label': t, html: icon(ic, 20), onclick: e => { split.dataset.mode = k; localStorage.setItem('studyMode', k); e.currentTarget.parentElement.querySelectorAll('.seg-b').forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }))) : null;

  const studyEl = h('div', { class: 'study wheel-mode' });
  app.replaceChildren(studyEl);
  studyEl.append(
    h('header', { class: 'bar leather-strip slim' },
      iconBtn('back', 'Volver a la materia', () => go(`#/m/${subjectId}`)),
      h('div', { class: 'bar-title small' }, pdf ? pdf.name : nb.name, h('small', {}, subject?.name || '')),
      pdf ? h('label', { class: 'to-nb' }, h('span', {}, 'Resumen en'), nbSelect) : nbSelect,
      modeBtns,
      pdf ? iconBtn('download', 'Descargar PDF con subrayados', () => exportPdf()) : null,
      iconBtn('full', 'Pantalla completa', toggleFull),
    ),
    split);

  // divisor arrastrable (horizontal en PC, vertical en celular de pie)
  divider.addEventListener('pointerdown', e => {
    divider.setPointerCapture(e.pointerId);
    const r = split.getBoundingClientRect();
    const vert = getComputedStyle(split).flexDirection === 'column';
    const mv = ev => { let v = vert ? (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width; if (nbLeft()) v = 1 - v; split.style.setProperty('--r', clamp(v, .2, .8)); };
    const up = () => { divider.removeEventListener('pointermove', mv); localStorage.setItem('splitRatio', split.style.getPropertyValue('--r')); };
    divider.addEventListener('pointermove', mv);
    divider.addEventListener('pointerup', up, { once: true });
  });

  const notebook = new Notebook(nbPane, { notebook: nb, subject, ctx: { settings: () => settings } });
  await notebook.open();
  let pv = null;
  if (pdf) {
    const topicFor = async hl => {
      if (hl.level === 1) return { topic: hl.id, title: hl.text };
      const all = [...pv.hls.values()].filter(x => x.level === 1 && x.text && (x.page < hl.page || (x.page === hl.page && x.y <= hl.y)))
        .sort((a, b) => a.page - b.page || a.y - b.y);
      const t = all.at(-1);
      return t ? { topic: t.id, title: t.text } : { topic: 'pdf:' + pdf.id, title: '' };
    };
    pv = new PdfView(pdfPane, {
      pdfRec: pdf, notebookId: nb.id, settings: () => settings,
      onHighlight: async hl => {
        const t = await topicFor(hl);
        hl.topic = t.topic; db.put(hl);
        await notebook.addHighlight(hl, { ...t, pdfName: pdf.name, pdfId: pdf.id });
      },
      onHighlightRemoved: hl => notebook.removeHighlight(hl),
    });
    await pv.open();
  }
  // Sin barras: cada área tiene su rueda
  const act = {
    hasPdf: !!pdf,
    // PDF y hoja del cuaderno a la misma altura: cada uno muestra su página completa
    // PDF y hoja del mismo tamaño A4, automático cada vez que abres (se puede desactivar)
    sameAuto: () => localStorage.getItem('sameA4') !== '0',
    sameSize: () => {
      const on = !act.sameAuto();
      localStorage.setItem('sameA4', on ? '1' : '0');
      if (on) {
        if (split.dataset.mode !== 'split') { split.dataset.mode = 'split'; localStorage.setItem('studyMode', 'split'); }
        pv?.setFit('hoja'); notebook.setFit('hoja');
      }
      toast(on ? 'Listo: el PDF y la hoja siempre se abrirán del mismo tamaño A4' : 'Mismo tamaño A4 desactivado');
    },
    back: () => { import('./loona.js').then(L => L.farewell()); go(`#/m/${subjectId}`); },
    mode: () => split.dataset.mode,
    setMode: k => { split.dataset.mode = k; localStorage.setItem('studyMode', k); },
    exportPdf: () => exportPdf(),
    fullscreen: toggleFull,
    // botón PDF de la rueda: muestra/oculta el PDF, o elige uno si el cuaderno se abrió solo
    togglePdf: async () => {
      if (pdf) { const m = split.dataset.mode === 'nb' ? 'split' : 'nb'; split.dataset.mode = m; localStorage.setItem('studyMode', m); return; }
      const pdfs = (await db.where('pdf', x => x.subject === subjectId)).sort((a, b) => b.updatedAt - a.updatedAt);
      const open = id => { localStorage.setItem('studyMode', 'split'); go(`#/e/${id}?nb=${nb.id}`); };
      const md = modal({
        title: 'Abrir un PDF al lado del cuaderno', wide: true, body: h('div', { class: 'font-list' },
          ...pdfs.map(x => h('button', { class: 'font-row', onclick: () => { md.close(); open(x.id); } }, h('span', { class: 'fr-name', html: icon('pdf', 18) }), h('span', { style: { fontSize: '17px', fontWeight: 700 } }, x.name))),
          !pdfs.length ? h('p', { class: 'opt-hint' }, 'Esta materia todavía no tiene PDFs.') : null,
          h('button', {
            class: 'btn primary', html: icon('upload', 18) + 'Subir un PDF', onclick: async () => {
              const { pickFile } = await import('./ui.js');
              const f = await pickFile('application/pdf,.pdf'); if (!f) return;
              const blobId = db.uid('pdfb_'); await db.putBlob(blobId, f, { type: 'application/pdf' });
              const rec = await db.put({ id: db.uid('pdf_'), kind: 'pdf', subject: subjectId, name: f.name.replace(/\.pdf$/i, ''), blob: blobId, notebook: nb.id });
              md.close(); open(rec.id);
            },
          })),
      });
    },
    // Resolver paso a paso: desde la rueda del cuaderno o recortando el problema en el PDF
    solve: async ({ crop } = {}) => {
      const { openSolver, cropFromPane } = await import('./solver.js');
      const selText = pv ? (document.getSelection()?.toString() || '').trim() : '';
      if (crop && pv && !selText) {
        if (split.dataset.mode === 'pdf') act.setMode('split');
        toast('Marca con el dedo o el lápiz la zona del problema', 2600);
        const img = await cropFromPane(pdfPane);
        if (!img) return;
        if (split.dataset.mode === 'pdf') act.setMode('split');
        return openSolver(notebook, { image: img, cropPane: pdfPane });
      }
      openSolver(notebook, { text: selText, cropPane: pv ? pdfPane : null });
    },
    record: async () => { const { openRecorder } = await import('./recorder.js'); openRecorder({ subject, nb, notebook }); },
    music: async () => { const { openMusic } = await import('./music.js'); openMusic(); },
    audios: async () => {
      const r = await import('./recorder.js');
      const list = await r.audioList(subjectId);
      modal({ title: 'Clases grabadas', wide: true, body: h('div', {}, list.length ? h('div', { class: 'aud-list' }, ...list.map(a => r.audioRow(a, notebook))) : h('p', { class: 'opt-hint' }, 'Todavía no grabaste clases de esta materia. Usa el botón del micrófono en la rueda.')) });
    },
    // recortar una imagen del PDF, quitarle el fondo y darle los colores de tu paleta
    cropImage: async () => {
      const { cropFromPane } = await import('./solver.js');
      if (split.dataset.mode === 'pdf') act.setMode('split');
      toast('Marca con el dedo o el lápiz la imagen que quieres llevar al cuaderno', 2800);
      const d = await cropFromPane(pdfPane); if (!d) return;
      const { editImage } = await import('./imageeditor.js');
      const blob = await (await fetch(d)).blob();
      const r = await editImage(blob); if (!r) return;
      const id = db.uid('img_'); await db.putBlob(id, r.blob);
      const w = Math.min(320, r.w), hh = Math.round(w * r.h / r.w);
      notebook.placeCenter({ type: 'image', blob: id, w, h: hh, frame: 'sombra' });
    },
    nbLeft,
    swapSides: () => {
      localStorage.setItem('nbLeft', nbLeft() ? '0' : '1');
      split.classList.toggle('nb-left', nbLeft());
      wheels.forEach(w => w.setSide(w.scope === 'nb' ? (nbLeft() ? 'left' : 'right') : (nbLeft() ? 'right' : 'left')));
      const vert = getComputedStyle(split).flexDirection === 'column';
      toast(vert ? (nbLeft() ? 'Cuaderno arriba, PDF abajo' : 'PDF arriba, cuaderno abajo') : (nbLeft() ? 'Cuaderno a la izquierda, PDF a la derecha' : 'PDF a la izquierda, cuaderno a la derecha'));
    },
    chooseNotebook: () => {
      const m = modal({
        title: pdf ? 'El resumen va al cuaderno…' : 'Abrir cuaderno', body: h('div', { class: 'font-list' }, ...nbs.map(n => h('button', {
          class: 'font-row' + (n.id === nb.id ? ' on' : ''), style: { fontFamily: 'var(--hand)', fontSize: '22px' },
          onclick: () => { m.close(); go(pdf ? `#/e/${pdf.id}?nb=${n.id}` : `#/c/${n.id}`); },
        }, n.name))),
      });
    },
  };
  if (pv && act.sameAuto()) { pv.setFit('hoja'); notebook.setFit('hoja'); }
  const wheels = [new Wheel(nbPane, { scope: 'nb', nb: notebook, act, side: nbLeft() ? 'left' : 'right' })];
  if (pv) wheels.push(new Wheel(pdfPane, { scope: 'pdf', pv, act, side: nbLeft() ? 'right' : 'left' }));
  current = { pdf: pv, nb: notebook, wheels };
  // recuerda dónde estabas, para "Seguir estudiando" en el inicio
  const saveLast = () => { try { localStorage.setItem('lastStudy', JSON.stringify({ id: pdf?.id || nb.id, pdf: !!pdf, hash: location.hash, title: pdf ? pdf.name : nb.name, subject: subject?.name, page: pv?.curPage?.() })); } catch { } };
  try { localStorage.setItem('wasStudying', '1'); } catch { }
  // el cuaderno vuelve a la misma altura donde lo dejaste
  const nbKey = 'nbScroll-' + nb.id, sc = notebook.scroller;
  if (sc) {
    let pos = null; try { pos = JSON.parse(localStorage.getItem(nbKey)); } catch { }
    if (pos) { const put = () => { sc.scrollTop = pos.f * sc.scrollHeight; }; [60, 400, 1200].forEach(t => setTimeout(put, t)); }
    let st = 0; sc.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => { try { localStorage.setItem(nbKey, JSON.stringify({ f: sc.scrollTop / Math.max(1, sc.scrollHeight) })); } catch { } }, 400); }, { passive: true });
  }
  saveLast(); addEventListener('pagehide', saveLast); const _lt = setInterval(() => { if (current?.nb === notebook) saveLast(); else clearInterval(_lt); }, 15000);
  // la agenda se abre (tapa de cuero que gira) y Loona saluda
  const cover = h('div', { class: 'lo-open', 'aria-hidden': 'true' }, h('div', { class: 'lo-cover' }, h('b', {}, 'Loona')));
  document.body.append(cover); setTimeout(() => cover.remove(), 1500);
  import('./loona.js').then(L => L.greet('open', subject?.name));

  async function exportPdf() {
    if (!window.PDFLib) await loadScript(new URL('../vendor/pdf-lib.min.js', import.meta.url).href);
    toast('Preparando PDF…');
    try { download(await pv.exportAnnotated(), `${pdf.name} (subrayado).pdf`); }
    catch (e) { console.warn(e); toast('No se pudo crear el PDF: ' + e.message, 4000); }
  }
  if (exportOnly && pv) exportPdf();
}

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
}

// Las barras se esconden solas mientras estudias; la flecha las vuelve a mostrar
function setupAutoHide(root) {
  const tab = h('button', { class: 'bars-toggle', 'aria-label': 'Mostrar u ocultar las barras', title: 'Mostrar barras' });
  root.append(tab);
  let t = null;
  const busy = () => document.querySelector('.modal-back, .sel-frame') || document.activeElement?.isContentEditable || document.activeElement?.matches?.('input, select, textarea')
    || root.querySelector('.dial[data-open="1"]');
  const hide = () => { if (busy()) return schedule(); root.classList.add('bars-hidden'); tab.title = 'Mostrar barras'; };
  const show = () => { root.classList.remove('bars-hidden'); tab.title = 'Ocultar barras'; schedule(); };
  const schedule = (ms = 3500) => { clearTimeout(t); t = setTimeout(hide, ms); };
  tab.addEventListener('click', () => root.classList.contains('bars-hidden') ? show() : (clearTimeout(t), root.classList.add('bars-hidden')));
  // usar las barras las mantiene visibles
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('.bar, .nb-head, .nb-opts, .nb-rail')) { if (!root.classList.contains('bars-hidden')) schedule(); }
    else if (e.target.closest('.nb-catch, .ink-catch, .nb-scroll, .pdf-scroll') && !root.classList.contains('bars-hidden')) schedule(1500);
  }, true);
  // al seleccionar algo en el cuaderno se muestran sus opciones
  root.addEventListener('nb-select', e => { if (e.detail) show(); });
  schedule(4000);
}
