// Lado cuaderno: páginas con tinta, lettering, cintas, stickers, fotos
// y los resúmenes que llegan desde el PDF.
import * as db from './db.js';
import { h, icon, iconBtn, INKS, LEVELS, levelOf, toast, modal, pickFile, confirmBox, clamp, esc, debounce, kineticPan } from './ui.js';
import { drawStroke, hitStroke, PENS } from './ink.js';
import { STICKERS, stickerURL, recommend, LOONA_STICKERS } from './stickers.js';
import { TAPE_PATTERNS, TAPE_COLORS, tapeStyle, TORN_MASK } from './tapes.js';
import { allFamilies, STYLES, addFontFiles, DAFONT, ensureFont, loadAllFonts } from './fonts.js';
import { editImage } from './imageeditor.js';
import { applyKbMode, sysKeyboard, miniKbOpen, cleanHandwriting } from './minikb.js';
import { attachPartEditor, relink } from './tpledit.js';
import { quizSection } from './quiz.js';
import { TEMPLATES, summaryToMindmap, summaryToTimeline, summaryToCards, summaryTo6 } from './templates.js';
import { grouped, itemFromHl, condense, catLabel, CATS, quickQuestions, aiSummarize, aiOcr, tesseractOcr, classify } from './summarizer.js';

export const PW = 800, PH = 1131;
const PAPERS = [
  { k: 'puntos', name: 'Puntos' }, { k: 'cuadricula', name: 'Cuadrícula' }, { k: 'rayas', name: 'Rayas' },
  { k: 'liso', name: 'Liso' }, { k: 'cornell', name: 'Cornell' },
];
const PAPER_TONES = [{ k: 'negro', c: '#111112' }, { k: 'humo', c: '#2b2b2e' }, { k: 'crema', c: '#FBF5EC' }, { k: 'blanco', c: '#FFFDF9' }, { k: 'rosa', c: '#F8EDEB' }, { k: 'kraft', c: '#E9D9C2' }];
const BLOCKS = [
  { k: 'titulo', name: 'Título con lettering', html: 'Mi tema', w: 520 },
  { k: 'gotico', name: 'Título gótico', html: 'Historia', w: 560 },
  { k: 'cinta', name: 'Encabezado en cinta', html: 'Problema económico', w: 320 },
  { k: 'definicion', name: 'Definición con flecha', html: '<b>Concepto:</b> escribe aquí la definición corta.', w: 340 },
  { k: 'dato', name: 'Caja "Dato clave"', html: '<b>Dato clave</b><br>Lo que no puedes olvidar.', w: 260 },
  { k: 'lista', name: 'Lista con corazones', html: '<ul><li>Primera idea</li><li>Segunda idea</li><li>Tercera idea</li></ul>', w: 320 },
  { k: 'nota', name: 'Nota adhesiva', html: 'Recordar para el examen…', w: 210 },
  { k: 'formula', name: 'Caja de fórmula', html: 'aᵐ · aⁿ = aᵐ⁺ⁿ', w: 240 },
  { k: 'tips', name: 'Dicas rápidas', html: '<b>Tips rápidos</b><ul><li>Tip uno</li><li>Tip dos</li></ul>', w: 300 },
];
const INK_TOOLS = ['pen', 'brush', 'marker', 'pencil', 'glitter', 'write'];

export class Notebook {
  constructor(root, { notebook, subject, ctx = {} }) {
    this.root = root; this.nb = notebook; this.subject = subject; this.ctx = ctx;
    const s = JSON.parse(localStorage.getItem('nbTool') || '{}');
    this.tool = s.tool || 'pen';
    this.pen = Object.assign({ pen: { c: '#F4F1EE', w: 3, a: 1 }, brush: { c: '#D9D5D7', w: 9, a: 1 }, marker: { c: '#C77A3A', w: 18, a: .42 }, pencil: { c: '#B2ADB0', w: 2.5, a: 1 },
      glitter: { c: '#D9D5D7', w: 16, a: .6 }, write: { c: '#F4F1EE', w: 2.6, a: 1 } }, s.pen);
    this.eraserW = +(localStorage.getItem('nbEraserW') || 8);   // grosor del borrador, a tu gusto
    // escritura a mano -> letra: tres pestañas (título, subtítulo, contenido), cada una con su fuente
    this.hwKind = localStorage.getItem('hwKind') || 'contenido';
    this.hwStyles = Object.assign({
      titulo: { font: 'Grenze Gotisch', size: 44, color: '#F4F1EE', style: 'plata', weight: 700 },
      subtitulo: { font: 'Pinyon Script', size: 34, color: '#D9D5D7', style: 'normal', weight: 400 },
      contenido: { font: 'Kalam', size: 19, color: '#E9E5E2', style: 'normal', weight: 400 },
    }, (() => { try { return JSON.parse(localStorage.getItem('hwStyles')) || {}; } catch { return {}; } })());
    this.tape = s.tape || { pattern: 'estrellas', color: 'vino', w: 30 };
    this.textStyle = s.textStyle || { font: 'Grenze Gotisch', size: 40, color: '#F4F1EE', style: 'plata', align: 'left' };
    this.locked = localStorage.getItem('nbLocked') === '1';      // hoja fija: no se mueve ni hace zoom, pero se sigue editando
    this.protectText = localStorage.getItem('nbProtect') !== '0'; // el borrador no toca las letras
    this.penOnly = s.fingerMoves ?? true;   // un dedo mueve la hoja, el lápiz escribe
    this.zoom = 1;
    this.hist = []; this.redoStack = [];
    this.pageEls = new Map();
    this.pages = [];
    this.fit = localStorage.getItem('nbFit') || 'hoja';
    this.build();
    this.setBright(localStorage.getItem('nbBright') || 1);
    this.updateFitBtn();
  }
  saveTool() { localStorage.setItem('nbTool', JSON.stringify({ tool: this.tool, pen: this.pen, tape: this.tape, textStyle: this.textStyle, penOnly: this.penOnly, fingerMoves: this.penOnly })); }

  async open() {
    this.pages = (await db.where('page', p => p.notebook === this.nb.id)).sort((a, b) => a.order - b.order);
    if (!this.pages.length) this.pages.push(await this.newPageRec(0));
    this.pagesEl.innerHTML = '';
    this.pageEls.clear();
    for (const pg of this.pages) this.mountPage(pg);
    this.pagesEl.append(h('button', { class: 'add-page', onclick: () => this.addPage(), html: icon('plus') + 'Nueva página' }));
    this.relayout();
    this.updateRail();
    this.unsub = db.onChange((rec, origin) => { if (origin === 'remote' && rec.kind === 'page' && rec.notebook === this.nb.id) this.onRemotePage(rec); });
  }

  async newPageRec(order) {
    return db.put({ id: db.uid('pg_'), kind: 'page', notebook: this.nb.id, subject: this.nb.subject, order, paper: this.nb.paper || 'puntos', tone: this.nb.tone || 'negro', els: [], strokes: [] });
  }
  async addPage(after = this.pages.length - 1) {
    const order = after < this.pages.length - 1 ? (this.pages[after].order + this.pages[after + 1].order) / 2 : (this.pages.at(-1)?.order ?? 0) + 1;
    const pg = await this.newPageRec(order);
    this.pages.splice(after + 1, 0, pg);
    this.remountAll();
    this.scrollToPage(after + 1);
    return pg;
  }
  remountAll() { const st = this.scroller.scrollTop; this.open_(); this.scroller.scrollTop = st; }
  open_() {
    this.pagesEl.innerHTML = ''; this.pageEls.clear();
    for (const pg of this.pages) this.mountPage(pg);
    this.pagesEl.append(h('button', { class: 'add-page', onclick: () => this.addPage(), html: icon('plus') + 'Nueva página' }));
    this.relayout();
  }
  onRemotePage(rec) {
    const i = this.pages.findIndex(p => p.id === rec.id);
    if (rec.deleted) { if (i >= 0) { this.pages.splice(i, 1); this.open_(); } return; }
    if (i >= 0) {
      const cur = this.pages[i];
      // si estás escribiendo o hay un cambio sin guardar en esta página, gana lo tuyo
      if (cur._t || (this.editing && cur.els?.some(e => e.id === this.editing)) || (rec.updatedAt || 0) <= (cur.updatedAt || 0)) return;
      const selId = this.sel?.pg === cur ? this.sel.el.id : null;
      Object.assign(cur, rec);
      if (this.pageEls.get(rec.id)) { this.applyPaper(cur); this.renderEls(cur); this.renderInk(cur); }
      if (selId) { const e = cur.els.find(x => x.id === selId); e ? this.select(cur, e) : this.select(null); }
    }
    else { this.pages.push(rec); this.pages.sort((a, b) => a.order - b.order); this.open_(); }
  }

  // ---------- estructura ----------
  build() {
    this.root.classList.add('nb');
    this.head = h('div', { class: 'nb-head' },
      h('div', { class: 'nb-title' }, h('span', { class: 'nb-name' }, this.nb.name), this.pageNum = h('span', { class: 'nb-pnum' })),
      this.fitBtn = h('button', { class: 'icbtn fit-btn', onclick: () => this.toggleFit() }),
      iconBtn('page', 'Papel y páginas', () => this.pageMenu()),
      iconBtn('undo', 'Deshacer', () => this.undo()),
      iconBtn('redo', 'Rehacer', () => this.redo()),
    );
    this.rail = h('div', { class: 'nb-rail leather-strip' });
    const railTools = [
      ['select', 'cursor', 'Seleccionar y mover'], ['pen', 'pen', 'Estilógrafo'], ['brush', 'brush', 'Pincel de lettering'],
      ['marker', 'marker', 'Marcador'], ['pencil', 'pencil', 'Lápiz grafito'], ['eraser', 'eraser', 'Borrador'],
      ['tape', 'tape', 'Cinta washi'], ['text', 'text', 'Texto y lettering'],
    ];
    for (const [k, ic, name] of railTools) this.rail.append(h('button', { class: 'rail-btn', 'data-k': k, title: name, 'aria-label': name, html: icon(ic), onclick: () => this.setTool(k) }));
    this.rail.append(h('span', { class: 'rail-sep' }));
    this.rail.append(h('button', { class: 'rail-btn', title: 'Stickers', 'aria-label': 'Stickers', html: icon('sticker'), onclick: () => this.stickerDrawer() }));
    this.rail.append(h('button', { class: 'rail-btn', title: 'Foto', 'aria-label': 'Añadir foto', html: icon('image'), onclick: () => this.addImage() }));
    this.rail.append(h('button', { class: 'rail-btn', title: 'Bloques de diseño', 'aria-label': 'Bloques de diseño', html: icon('blocks'), onclick: () => this.blockDrawer() }));
    this.opts = h('div', { class: 'nb-opts' });
    this.scroller = h('div', { class: 'nb-scroll' });
    this.pagesEl = h('div', { class: 'nb-pages' });
    this.scroller.append(this.pagesEl);
    this.root.append(this.head, h('div', { class: 'nb-main' }, this.rail, h('div', { class: 'nb-stage' }, this.opts, this.scroller)));
    this.ro = new ResizeObserver(() => this.relayout()); this.ro.observe(this.scroller);
    this.scroller.addEventListener('scroll', () => this.updatePageNum());
    import('./pageturn.js').then(m => m.attachPageTurn(this.scroller, '.nb-page')).catch(() => { });   // hoja que gira al pasar de página
    this.scroller.addEventListener('wheel', e => { if (!e.ctrlKey) return; e.preventDefault(); if (this.locked) return; this.setZoom(this.zoom * (e.deltaY < 0 ? 1.08 : .93)); }, { passive: false });
    document.addEventListener('keydown', this.onKey = e => {
      if (!this.root.isConnected || e.target.closest('[contenteditable=true],input,textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.sel) { e.preventDefault(); this.deleteSel(); }
    });
  }

  mountPage(pg) {
    const wrap = h('div', { class: 'nb-page', 'data-id': pg.id });
    const inner = h('div', { class: 'nb-inner' });
    const els = h('div', { class: 'nb-els' });
    const ink = h('canvas', { class: 'nb-ink' });
    const live = h('canvas', { class: 'nb-live' });
    const front = h('div', { class: 'nb-front' }); // marco de selección (sobre la tinta)
    const catcher = h('div', { class: 'nb-catch' });
    // la esquina para achicar el título funciona aunque estés con el lápiz
    catcher.addEventListener('pointerdown', e => {
      const g = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.classList?.contains('sum-title-grip'));
      if (g) { e.stopImmediatePropagation(); e.preventDefault();
        g.dispatchEvent(new PointerEvent('pointerdown', { clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, bubbles: true })); return; }
      // botones de la lámina y del cuestionario (alternativas, sobre, hoja de transición) se pueden tocar con cualquier herramienta
      const b = document.elementsFromPoint(e.clientX, e.clientY).map(n => n.closest?.('.sum .quiz-alt, .sum .lam-veil, .sum .lam-env, .sum .qz-fb .chip, .sum .lam-quiz > summary')).find(Boolean);
      if (!b) return; e.stopImmediatePropagation(); e.preventDefault();
      const up = ev => { removeEventListener('pointerup', up, true); if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 12) b.click(); };
      addEventListener('pointerup', up, true);
    }, true);
    inner.append(els);
    wrap.append(inner, ink, live, h('div', { class: 'nb-front-wrap' }, front), catcher,
      h('button', { class: 'pg-menu', title: 'Opciones de la página', 'aria-label': 'Opciones de la página', html: icon('dots', 18), onclick: () => this.pageMenu(pg) }));
    this.pagesEl.append(wrap);
    const v = { wrap, inner, els, ink, live, front, catcher, pg };
    this.pageEls.set(pg.id, v);
    wrap.addEventListener('pointerdown', e => { if (this.tool === 'select' && !this._gest && !e.target.closest('.el, .sel-frame, .pg-menu, .nb-catch')) this.select(null); });
    this.bindGestures(v);
    this.applyPaper(pg);
    this.bindInput(v);
    this.renderEls(pg);
  }
  applyPaper(pg) {
    const v = this.pageEls.get(pg.id); if (!v) return;
    v.inner.className = 'nb-inner paper-' + (pg.paper || 'puntos');
    v.inner.style.setProperty('--paper', (PAPER_TONES.find(t => t.k === pg.tone) || PAPER_TONES[0]).c);
    v.inner.dataset.tone = ['negro', 'humo'].includes(pg.tone || 'negro') ? 'dark' : 'light';
  }

  relayout() {
    const avail = this.scroller.clientWidth - 28;
    if (avail <= 0) return;
    const fitW = Math.min(avail / PW, 1.6);
    // "hoja completa": la A4 entera cabe en la pantalla, una hoja por vista
    const fitH = (this.scroller.clientHeight - 28) / PH;
    this.scale = (this.fit === 'ancho' ? fitW : Math.min(fitW, fitH)) * this.zoom;
    this.root.classList.toggle('fit-page', this.fit !== 'ancho');
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    for (const v of this.pageEls.values()) {
      v.wrap.style.width = PW * this.scale + 'px';
      v.wrap.style.height = PH * this.scale + 'px';
      v.inner.style.transform = `scale(${this.scale})`;
      v.front.parentElement.style.transform = `scale(${this.scale})`;
      for (const c of [v.ink, v.live]) { c.width = Math.round(PW * this.scale * dpr); c.height = Math.round(PH * this.scale * dpr); }
      v.dpr = dpr;
      this.renderInk(v.pg);
    }
    this.root.style.setProperty('--s', this.scale);
    this.updatePageNum();
  }
  setFit(f) { if (this.fit !== f) this.toggleFit(); }
  toggleFit() {
    const i = this.visiblePageIndex();
    this.fit = this.fit === 'ancho' ? 'hoja' : 'ancho';
    localStorage.setItem('nbFit', this.fit);
    this.zoom = 1; this.updateFitBtn(); this.relayout();
    requestAnimationFrame(() => { const v = this.pageEls.get(this.pages[i]?.id); if (v) this.scroller.scrollTop = v.wrap.offsetTop - 14; });
  }
  updateFitBtn() {
    const page = this.fit !== 'ancho';
    this.fitBtn.innerHTML = icon(page ? 'fitw' : 'fitp');
    this.fitBtn.title = page ? 'Ajustar la hoja al ancho' : 'Ver la hoja A4 completa';
    this.fitBtn.setAttribute('aria-label', this.fitBtn.title);
    
  }
  setLocked(v) {
    this.locked = v; localStorage.setItem('nbLocked', v ? '1' : '0');
    this.root.classList.toggle('locked', v); this.kin?.cancel?.();
    toast(v ? 'Hoja bloqueada: no se mueve, puedes seguir escribiendo' : 'Hoja desbloqueada');
  }
  setProtect(v) {
    this.protectText = v; localStorage.setItem('nbProtect', v ? '1' : '0');
    toast(v ? 'Letras protegidas: el borrador no borra textos, títulos, resúmenes ni lettering' : 'Listo: ahora el borrador borra títulos, subtítulos, textos y letras a mano con solo pasarlo encima', 3200);
  }
  // ¿este punto está sobre un texto, título, bloque o resumen?
  overText(pg, x, y) {
    return (pg.els || []).some(el => {
      if (!['text', 'block', 'summary'].includes(el.type)) return false;
      const n = this.nodeOf(pg, el); const w = el.w || n?.offsetWidth || 0, hh = el.h || n?.offsetHeight || 40;
      const cx = el.x + w / 2, cy = el.y + hh / 2, a = -(el.rot || 0) * Math.PI / 180, dx = x - cx, dy = y - cy;
      return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= w / 2 + 4 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= hh / 2 + 4;
    });
  }
  setZoom(z) { const k = this.scroller.scrollTop / Math.max(1, this.scroller.scrollHeight); this.zoom = clamp(z, .5, 3); this.relayout(); this.scroller.scrollTop = k * this.scroller.scrollHeight; }
  updatePageNum() {
    const n = this.visiblePageIndex();
    this.pageNum.textContent = `pág. ${n + 1} de ${this.pages.length}`;
  }
  visiblePageIndex() {
    const mid = this.scroller.scrollTop + this.scroller.clientHeight * .35;
    let n = 0;
    this.pages.forEach((pg, i) => { const v = this.pageEls.get(pg.id); if (v && v.wrap.offsetTop <= mid) n = i; });
    return n;
  }
  scrollToPage(i) { const v = this.pageEls.get(this.pages[i]?.id); if (v) this.scroller.scrollTo({ top: v.wrap.offsetTop - 10, behavior: 'smooth' }); }

  // ---------- herramientas ----------
  setTool(k) {
    this.tool = k; this.saveTool();
    this.root.dispatchEvent(new CustomEvent('nb-select', { bubbles: true, detail: true }));
    if (k !== 'select') this.select(null);
    this.updateRail();
  }
  updateRail() {
    this.rail.querySelectorAll('.rail-btn[data-k]').forEach(b => b.classList.toggle('on', b.dataset.k === this.tool));
    this.root.dataset.tool = this.tool;
    this.root.classList.toggle('pen-only', this.penOnly); this.root.classList.toggle('locked', !!this.locked);
    this.renderOpts();
  }
  renderOpts() {
    const o = this.opts; o.innerHTML = '';
    const t = this.tool;
    if (INK_TOOLS.includes(t)) {
      const st = this.pen[t];
      o.append(
        h('div', { class: 'swatches' }, ...INKS.map(c => h('button', { class: 'sw-c' + (c === st.c ? ' on' : ''), style: { '--c': c }, 'aria-label': 'Color ' + c, onclick: () => { st.c = c; this.saveTool(); this.renderOpts(); } }))),
        h('label', { class: 'opt-range' }, 'Grosor', h('input', { type: 'range', min: ['marker', 'glitter'].includes(t) ? 4 : .5, max: ['marker', 'glitter'].includes(t) ? 48 : t === 'brush' ? 30 : 14, step: .5, value: st.w, oninput: e => { st.w = +e.target.value; this.saveTool(); } })),
        h('label', { class: 'opt-range' }, 'Intensidad', h('input', { type: 'range', min: .1, max: 1, step: .05, value: st.a ?? 1, oninput: e => { st.a = +e.target.value; this.saveTool(); } })),
        this.toggle('Solo lápiz dibuja', this.penOnly, v => { this.penOnly = v; this.saveTool(); this.updateRail(); }),
        h('span', { class: 'opt-hint' }, 'Mantén quieto el final del trazo para volverlo recto'),
      );
    } else if (t === 'tape') {
      o.append(
        h('div', { class: 'tape-pats' }, ...TAPE_PATTERNS.map(p => { const b = h('button', { class: 'tape-chip' + (p === this.tape.pattern ? ' on' : ''), title: p, 'aria-label': 'Patrón ' + p, onclick: () => { this.tape.pattern = p; this.saveTool(); this.renderOpts(); } }); Object.assign(b.style, tapeStyle(p, this.tape.color)); return b; })),
        h('div', { class: 'swatches' }, ...TAPE_COLORS.map(c => h('button', { class: 'sw-c' + (c.k === this.tape.color ? ' on' : ''), style: { '--c': c.bg }, 'aria-label': 'Cinta ' + c.k, onclick: () => { this.tape.color = c.k; this.saveTool(); this.renderOpts(); } }))),
        h('label', { class: 'opt-range' }, 'Ancho', h('input', { type: 'range', min: 14, max: 60, value: this.tape.w, oninput: e => { this.tape.w = +e.target.value; this.saveTool(); } })),
        h('span', { class: 'opt-hint' }, 'Pasa el lápiz y la cinta se pega recta'),
      );
    } else if (t === 'text') {
      o.append(...this.textControls(this.textStyle, () => this.saveTool()), h('span', { class: 'opt-hint' }, 'Toca la página donde quieras escribir'));
    } else if (t === 'eraser') {
      o.append(h('label', { class: 'opt-range' }, 'Grosor del borrador', h('input', { type: 'range', min: 2, max: 80, step: 1, value: this.eraserW, oninput: e => this.setEraserW(e.target.value) })),
        h('span', { class: 'opt-hint' }, 'Pasa sobre un trazo, un sticker, una foto o una cinta para borrarlo. Deshacer lo recupera.'));
    } else if (t === 'select') {
      if (this.sel) o.append(...this.selControls());
      else o.append(h('span', { class: 'opt-hint' }, 'Toca un elemento para moverlo, girarlo o cambiar su tamaño. Tócalo otra vez para editar su texto.'));
    }
  }
  toggle(label, val, fn) {
    const i = h('input', { type: 'checkbox', onchange: e => fn(e.target.checked) }); i.checked = val;
    return h('label', { class: 'dp-tg' }, i, h('span', { class: 'sw' }), label);
  }
  textControls(st, onChange) {
    const fam = allFamilies();
    const fontBtn = h('button', { class: 'chip font-pick', style: { fontFamily: `'${st.font}'` }, onclick: () => this.fontPicker(st.font, f => { st.font = f; onChange(); fontBtn.textContent = f; fontBtn.style.fontFamily = `'${f}'`; }) }, st.font);
    void fam;
    return [
      fontBtn,
      h('label', { class: 'opt-range' }, 'Tamaño', h('input', { type: 'range', min: 12, max: 120, value: st.size, oninput: e => { st.size = +e.target.value; onChange(); } })),
      h('div', { class: 'swatches' }, ...INKS.map(c => h('button', { class: 'sw-c' + (c === st.color ? ' on' : ''), style: { '--c': c }, 'aria-label': 'Color ' + c, onclick: e => { st.color = c; onChange(); e.target.parentElement.querySelectorAll('.sw-c').forEach(b => b.classList.toggle('on', b === e.target)); } }))),
      h('div', { class: 'style-chips' }, ...STYLES.map(s => h('button', { class: 'chip lt-' + s.k + (s.k === st.style ? ' on' : ''), style: { '--tc': st.color }, onclick: e => { st.style = s.k; onChange(); e.target.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === e.target)); } }, s.name))),
    ];
  }
  fontPicker(cur, done, tab = 'todas') {
    loadAllFonts();
    const body = h('div', { class: 'font-list' });
    // pestañas: qué tipo de letra buscas
    const TABS = [['todas', 'Todas'], ['titulo', 'Títulos'], ['subtitulo', 'Subtítulos'], ['contenido', 'Contenido']];
    const fits = { titulo: ['Góticas', 'Títulos'], subtitulo: ['Lettering', 'Títulos'], contenido: ['Apuntes', 'Mis fuentes'] };
    const tabBar = h('div', { class: 'font-tabs', role: 'tablist' }, ...TABS.map(([k, n]) => h('button', { class: 'ft' + (k === tab ? ' on' : ''), role: 'tab', 'data-k': k, onclick: () => { tab = k; tabBar.querySelectorAll('.ft').forEach(b => b.classList.toggle('on', b.dataset.k === k)); draw(); } }, n)));
    const search = h('input', { class: 'field font-search', type: 'search', placeholder: 'Buscar fuente por nombre…', 'aria-label': 'Buscar fuente por nombre' });
    const sample = h('input', { class: 'field font-sample', value: '', placeholder: 'Escribe tu ejemplo (opcional)', 'aria-label': 'Texto de muestra' });
    const list = h('div', { class: 'font-rows' });
    // cada fuente se descarga recién cuando su tarjeta aparece en pantalla, así se ve de verdad
    const io = new IntersectionObserver(ents => ents.forEach(en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      const f = en.target.dataset.f;
      document.fonts.load(`20px '${f}'`, 'AaBbÑñ').then(() => en.target.classList.add('ready')).catch(() => { });
    }), { root: null, rootMargin: '200px' });
    const draw = () => {
      const q = search.value.trim().toLowerCase();
      const groups = {};
      for (const f of allFamilies()) if ((tab === 'todas' || !fits[tab] || fits[tab].includes(f.g) || !['Góticas', 'Títulos', 'Lettering', 'Apuntes'].includes(f.g)) && (!q || f.f.toLowerCase().includes(q) || f.g.toLowerCase().includes(q))) (groups[f.g] ||= []).push(f.f);
      list.innerHTML = '';
      if (!Object.keys(groups).length) list.append(h('p', { class: 'opt-hint' }, 'Ninguna fuente con ese nombre. Puedes subirla desde DaFont abajo.'));
      for (const [g, fams] of Object.entries(groups)) {
        list.append(h('h3', {}, g));
        const grid = h('div', { class: 'font-grid' });
        for (const f of fams) {
          const card = h('button', { class: 'font-card' + (f === cur ? ' on' : ''), 'data-f': f, title: f, onclick: () => { done(f); m.close(); } },
            h('span', { class: 'fc-big', style: { fontFamily: `'${f}'` } }, sample.value || f),
            h('span', { class: 'fc-ex', style: { fontFamily: `'${f}'` } }, 'Aa Bb Ññ 123'),
            h('span', { class: 'fc-name' }, f));
          grid.append(card); io.observe(card);
        }
        list.append(grid);
      }
    };
    search.addEventListener('input', draw); sample.addEventListener('input', draw);
    body.append(tabBar, h('div', { class: 'font-tools' }, search, sample), list);
    draw();
    if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => search.focus(), 60);
    body.append(h('h3', {}, 'Más fuentes de DaFont'),
      h('div', { class: 'ie-row' }, ...DAFONT.map(d => h('a', { class: 'chip', href: d.url, target: '_blank', rel: 'noopener' }, d.name))),
      h('button', {
        class: 'btn', html: icon('upload', 18) + 'Subir .zip de DaFont o .ttf/.otf', onclick: async () => {
          const fs = await pickFile('.zip,.ttf,.otf,.woff,.woff2,application/zip', true); if (!fs?.length) return;
          try { const added = await addFontFiles(fs); if (added.length) { toast('Fuente añadida: ' + added.join(', ')); done(added[0]); m.close(); } } catch (e) { toast(e.message, 4500); }
        },
      }));
    const m = modal({ title: 'Elegir fuente', body, wide: true, onClose: () => io.disconnect() });
    m.box.classList.add('font-modal');
  }

  // ---------- entrada (lápiz, dedo, mouse) ----------
  bindInput(v) {
    const c = v.catcher;
    let cur = null, holdT = null, panning = null;
    const kin = this.kin ||= kineticPan(this.scroller);
    const touches = new Map();
    const P = e => { const r = v.wrap.getBoundingClientRect(); return [(e.clientX - r.left) / this.scale, (e.clientY - r.top) / this.scale, e.pointerType === 'pen' ? (e.pressure || .5) : .5]; };
    c.addEventListener('pointerdown', e => {
      if (e.pointerType === 'pen') this._penSeen = true;
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, [e.clientX, e.clientY]);
        // hoja bloqueada: el dedo / la palma no mueven ni agrandan la hoja
        if (this.locked && (this.penOnly || this._penSeen || touches.size > 1 || (e.width || 0) > 30 || (e.height || 0) > 30)) { e.preventDefault(); if (touches.size > 1) { cur = null; this.clearLive(v); } return; }
        if (touches.size === 2) { cur = null; this.clearLive(v); const [a, b] = [...touches.values()]; this._pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: this.zoom }; return; }
        if (this.penOnly) { panning = e.pointerId; kin.start(e); c.setPointerCapture(e.pointerId); return; }
      }
      if (e.button > 0) return;
      e.preventDefault(); c.setPointerCapture(e.pointerId);
      const p = P(e);
      if (this.tool === 'text') {
        const hit = document.elementsFromPoint(e.clientX, e.clientY).find(x => x.classList?.contains('el') && v.els.contains(x));
        if (hit) { const el = v.pg.els.find(x => x.id === hit.dataset.id); if (el) { this.setTool('select'); this.select(v.pg, el); this.dragMove(e, v.pg, el, hit, ['text', 'block'].includes(el.type) ? () => this.startEdit(v.pg, el, hit, el.type === 'block' ? hit.querySelector('.bz') : hit) : null); return; } }
        // con el lápiz: si escribes, tu letra se vuelve texto bonito; si solo tocas, se abre un texto
        if (e.pointerType === 'pen') { cur = { id: e.pointerId, pts: [p], sim: false, v, tool: 'write', tw: true }; clearTimeout(this._hwT); return; }
        this.createText(v.pg, p); return;
      }
      cur = { id: e.pointerId, pts: [p], sim: e.pointerType !== 'pen', v };
      if (this.tool === 'eraser') { this.eraseAt(v.pg, p); this.eraserRing(v, p); return; }
      if (this.tool === 'write') clearTimeout(this._hwT);
    });
    c.addEventListener('pointermove', e => {
      if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.locked && e.pointerType === 'touch' && (!cur || e.pointerId !== cur.id)) return;
      if (this._pinch && touches.size === 2) { const [a, b] = [...touches.values()]; this.setZoom(this._pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / this._pinch.d); return; }
      if (panning != null) { if (touches.size >= 2) { kin.cancel(); return; } if (e.pointerId === panning) kin.move(e); return; }
      if (!cur || e.pointerId !== cur.id) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (this.tool === 'eraser') { const q = P(e); this.eraseAt(v.pg, q); this.eraserRing(v, q); return; }
      for (const ev of evs) cur.pts.push(P(ev));
      cur.straight = false;
      this.drawLive(v, cur);
      clearTimeout(holdT);
      if (INK_TOOLS.includes(this.tool) && this.tool !== 'write' && cur.pts.length > 8) holdT = setTimeout(() => { if (cur) { cur.straight = true; this.drawLive(v, cur); } }, 550);
    });
    const end = e => {
      touches.delete(e.pointerId); if (touches.size < 2) this._pinch = null;
      if (panning != null) { if (e.pointerId === panning) { panning = null; touches.size >= 1 ? kin.cancel() : kin.end(); } return; }
      clearTimeout(holdT);
      if (!cur || e.pointerId !== cur.id) return;
      const s = cur; cur = null; this.clearLive(v);
      if (this.tool === 'eraser') { if (this._erased) { this.commit(v.pg); this._erased = false; } return; }
      if (s.tw) { // Texto con lápiz: tocar = caja de texto; escribir = letra a mano que se convierte
        const a = s.pts[0];
        if (!s.pts.some(q => Math.hypot(q[0] - a[0], q[1] - a[1]) > 5)) return this.createText(v.pg, a);
        return this.finishInk(v.pg, s);
      }
      if (this.tool === 'tape') return this.finishTape(v.pg, s);
      if (INK_TOOLS.includes(this.tool)) this.finishInk(v.pg, s);
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }
  strokeFrom(s) {
    const tool = s.tool || this.tool;
    const st = this.pen[tool];
    let pts = s.pts.map(p => [+p[0].toFixed(1), +p[1].toFixed(1), +(p[2] ?? .5).toFixed(2)]);
    if (s.straight) { const a = pts[0], b = pts.at(-1); pts = [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2]], b]; }
    const o = { t: tool, c: st.c, w: st.w, pts, sim: s.sim ? 1 : 0 };
    if (st.a != null && !(tool === 'marker' && st.a === .42)) o.a = st.a;
    return o;
  }
  drawLive(v, s) {
    const ctx = v.live.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, v.live.width, v.live.height);
    ctx.setTransform(this.scale * v.dpr, 0, 0, this.scale * v.dpr, 0, 0);
    if (this.tool === 'tape') { this.drawTapePreview(ctx, s); return; }
    drawStroke(ctx, this.strokeFrom(s));
  }
  clearLive(v) { const ctx = v.live.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, v.live.width, v.live.height); }
  renderInk(pg) {
    const v = this.pageEls.get(pg.id); if (!v || !v.dpr) return;
    const ctx = v.ink.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, v.ink.width, v.ink.height);
    ctx.setTransform(this.scale * v.dpr, 0, 0, this.scale * v.dpr, 0, 0);
    for (const s of pg.strokes || []) drawStroke(ctx, s);
  }
  finishInk(pg, s) {
    if (s.pts.length < 2 && (this.tool === 'marker' || this.tool === 'glitter')) return;
    if ((s.tool || this.tool) === 'write') { // queda como borrador y, tras una pausa, se vuelve letra bonita
      const st = this.strokeFrom(s); st.hw = 1;
      if (!this._hwPg || this._hwPg !== pg) { this.snapshot(pg); this._hwPg = pg; }
      (pg.strokes ||= []).push(st); this.renderInk(pg);
      clearTimeout(this._hwT); this._hwT = setTimeout(() => this.handwritingToText(pg), 1700);
      return;
    }
    this.snapshot(pg);
    (pg.strokes ||= []).push(this.strokeFrom(s));
    this.renderInk(pg); this.commit(pg, false);
  }
  // círculo que muestra el tamaño del borrador mientras borras
  eraserRing(v, [x, y]) {
    const ctx = v.live.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, v.live.width, v.live.height);
    ctx.setTransform(this.scale * v.dpr, 0, 0, this.scale * v.dpr, 0, 0);
    ctx.beginPath(); ctx.arc(x, y, Math.max(2, this.eraserW / 2), 0, 7);
    ctx.lineWidth = 1.2 / this.scale; ctx.strokeStyle = 'rgba(122,43,58,.75)'; ctx.fillStyle = 'rgba(251,245,236,.35)'; ctx.fill(); ctx.stroke();
  }
  setHwKind(k) { this.hwKind = k; localStorage.setItem('hwKind', k); this._hwLast = null; }
  saveHw() { localStorage.setItem('hwStyles', JSON.stringify(this.hwStyles)); }
  setEraserW(w) { this.eraserW = clamp(+w, 2, 80); localStorage.setItem('nbEraserW', this.eraserW); }

  // ---------- escritura a mano -> letra bonita ----------
  // Escribes con el lápiz directo en la hoja (sin teclado ni recuadros que tapen),
  // y al detenerte la app lee tu letra y la cambia por texto con tu fuente de lettering.
  async handwritingToText(pg) {
    this._hwPg = null;
    const hw = (pg.strokes || []).filter(s => s.hw);
    if (!hw.length) return;
    const boxes = hw.map(s => { let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity; for (const p of s.pts) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); } return [a, b, c, d]; });
    // un toque suelto lejos de lo escrito (por ejemplo, al esconder la rueda) no cuenta
    const big = boxes.filter(q => q[2] - q[0] > 3 || q[3] - q[1] > 3);
    const cx0 = Math.min(...big.map(q => q[0])), cy0 = Math.min(...big.map(q => q[1])), cx1 = Math.max(...big.map(q => q[2])), cy1 = Math.max(...big.map(q => q[3]));
    const near = boxes.filter(q => q[0] > cx0 - 40 && q[2] < cx1 + 40 && q[1] > cy0 - 40 && q[3] < cy1 + 40);
    if (!big.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of near) { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[2]); y1 = Math.max(y1, q[3]); }
    const hs = big.map(q => q[3] - q[1]).sort((a, b) => a - b), letterH = hs[Math.floor(hs.length * .75)] || (y1 - y0);
    const pad = 14, K = 3, W = x1 - x0 + pad * 2, H = y1 - y0 + pad * 2;
    if (W < 8 || H < 6) return;
    const cv = document.createElement('canvas'); cv.width = Math.round(W * K); cv.height = Math.round(H * K);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    cx.setTransform(K, 0, 0, K, -(x0 - pad) * K, -(y0 - pad) * K);
    for (const s of hw) drawStroke(cx, { ...s, c: '#000', a: 1, w: Math.max(2.2, s.w) });
    toast('Leyendo tu letra…', 1500);
    let text = '', byAI = false;
    const st = this.ctx.settings?.() || {};
    try {
      if (st.geminiKey) { text = await aiOcr({ key: st.geminiKey, model: st.geminiModel, dataUrl: cv.toDataURL('image/png'),
        prompt: 'Lee lo que está escrito a mano en esta imagen (en español, son apuntes de estudio). Las letras pueden estar algo separadas o cursivas: júntalas y devuelve palabras completas y bien escritas del español (con tildes), la palabra más probable según el contexto. No separes una palabra en letras sueltas. Respeta los saltos de renglón. Devuelve solo el texto, sin comillas ni comentarios. Si no hay nada legible, devuelve vacío.' }); byAI = !!text; }
    } catch (e) { console.warn(e); }
    if (!text) { try { text = await tesseractOcr(cv); } catch (e) { console.warn(e); } }
    text = (text || '').split('\n').map(l => cleanHandwriting(l, { fix: !byAI })).filter(Boolean).join('\n').trim();
    // si mientras tanto seguiste escribiendo, espera a la siguiente pausa
    if ((pg.strokes || []).filter(s => s.hw).length !== hw.length) return;
    if (!text) {
      pg.strokes.forEach(s => delete s.hw); this.renderInk(pg); this.commit(pg, false);
      toast(st.geminiKey ? 'No pude leer esa letra; queda como trazo. Escribe un poco más grande y despacio.' : 'No pude leer esa letra; queda como trazo. Con tu clave de Gemini (en IA) se lee mucho mejor.', 4200);
      return;
    }
    const lines = text.split('\n');
    const kind = this.hwKind, ts = this.hwStyles[kind] || this.textStyle;
    const size = ts.size || clamp(Math.round(Math.min((y1 - y0) / lines.length, letterH * 1.35)), 16, 96);
    pg.strokes = pg.strokes.filter(s => !s.hw);
    this.renderInk(pg);
    // si sigues escribiendo en el mismo renglón, se agrega al mismo texto (no queda separado)
    const L = this._hwLast;
    if (L && L.pg === pg && L.kind === kind && lines.length === 1 && Date.now() - L.t < 20000 && pg.els.includes(L.el)) {
      const sameLine = y0 < L.y1 - (L.y1 - L.y0) * .25 && y1 > L.y0 + (L.y1 - L.y0) * .25;
      const gap = x0 - L.x1;
      const lh = L.y1 - L.y0;   // altura de tu letra a mano
      if (sameLine && gap > -lh * .5 && gap < lh * 3.5) {
        const glue = gap < lh * .3 && !/[.,;:]$/.test(L.text) ? '' : ' ';
        L.text = L.text + glue + text; L.x1 = Math.max(L.x1, x1); L.t = Date.now();
        L.el.html = esc(L.text); L.el.w = Math.round(Math.min(PW - L.el.x - 10, Math.max(L.el.w, L.x1 - L.el.x + L.size, L.text.length * L.size * .62)));
        this.renderEls(pg); this.commit(pg, false);
        toast('«' + L.text.slice(-40) + '»', 1600);
        return L.el;
      }
    }
    const longest = Math.max(...lines.map(l => l.length));
    const el = await this.addEl(pg, { type: 'text', x: Math.round(x0), y: Math.round(y0 - size * .15), w: Math.round(Math.min(PW - x0 - 10, Math.max(x1 - x0 + size, longest * size * .62, 120))), h: 0,
      html: lines.map(l => esc(l)).join('<br>'), font: ts.font, size, color: ts.color, style: ts.style, align: 'left', weight: ts.weight, hwKind: kind });
    this.commit(pg, false);
    this._hwLast = lines.length === 1 ? { pg, el, text, x1, y0, y1, size, kind, t: Date.now() } : null;
    toast({ titulo: 'Título', subtitulo: 'Subtítulo', contenido: 'Contenido' }[kind] + ': «' + text.replace(/\n/g, ' ').slice(0, 40) + '»', 2200);
    return el;
  }
  eraseAt(pg, [x, y]) {
    // letras protegidas: no se borra nada encima de un texto, ni el lettering hecho con pincel
    if (this.protectText && this.overText(pg, x, y)) {
      if (!this._protHint || Date.now() - this._protHint > 6000) { this._protHint = Date.now(); toast('Esta letra está protegida. En la rueda: Borrador → toca el escudo para poder borrarla.', 3500); }
      return;
    }
    const before = pg.strokes.length;
    const R = this.eraserW / 2;
    const keep = pg.strokes.filter(s => !(hitStroke(s, x, y, R) && !(this.protectText && s.t === 'brush')));
    if (keep.length !== before) {
      if (!this._erased) this.snapshot(pg);
      pg.strokes = keep; this._erased = true; this.renderInk(pg);
    }
    // el borrador también quita stickers, fotos y cintas que toque
    const ERASABLE = this.protectText ? ['sticker', 'image', 'tape'] : ['sticker', 'image', 'tape', 'text', 'block', 'summary'];
    const hit = (pg.els || []).filter(el => ERASABLE.includes(el.type) && !el.locked).reverse().find(el => {
      const v = this.pageEls.get(pg.id), n = v && this.nodeOf(pg, el);
      const w = el.w, hh = el.h || n?.offsetHeight || 40;
      const cx = el.x + w / 2, cy = el.y + hh / 2, a = -(el.rot || 0) * Math.PI / 180;
      const dx = x - cx, dy = y - cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      return Math.abs(lx) <= w / 2 + R && Math.abs(ly) <= hh / 2 + R;
    });
    if (hit) {
      if (!this._erased) this.snapshot(pg);
      this._erased = true;
      const n = this.nodeOf(pg, hit);
      pg.els = pg.els.filter(e => e !== hit);
      if (this.sel?.el === hit) this.select(null);
      if (n) { n.classList.add('erasing'); setTimeout(() => this.renderEls(pg), 160); } else this.renderEls(pg);
    }
  }

  // ---------- cintas ----------
  drawTapePreview(ctx, s) {
    const a = s.pts[0], b = s.pts.at(-1);
    const c = TAPE_COLORS.find(x => x.k === this.tape.color) || TAPE_COLORS[0];
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]));
    ctx.globalAlpha = .75; ctx.fillStyle = c.bg;
    ctx.fillRect(0, -this.tape.w / 2, Math.hypot(b[0] - a[0], b[1] - a[1]), this.tape.w); ctx.restore();
  }
  finishTape(pg, s) {
    const a = s.pts[0], b = s.pts.at(-1);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 20) return;
    let ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
    // casi horizontal o vertical -> se alinea exacto
    for (const t of [0, 90, 180, -90, -180]) if (Math.abs(ang - t) < 4) ang = t;
    const w = this.tape.w;
    this.addEl(pg, { type: 'tape', x: (a[0] + b[0]) / 2 - len / 2, y: (a[1] + b[1]) / 2 - w / 2, w: len, h: w, rot: ang, pattern: this.tape.pattern, color: this.tape.color });
  }

  // ---------- elementos ----------
  async addEl(pg, el, { select = false } = {}) {
    this.snapshot(pg);
    el.id ||= db.uid('el_');
    el.rot ||= 0;
    (pg.els ||= []).push(el);
    this.renderEls(pg);
    this.commit(pg, false);
    if (select) { this.setTool('select'); this.select(pg, el); }
    return el;
  }
  renderEls(pg) {
    const v = this.pageEls.get(pg.id); if (!v) return;
    v.els.innerHTML = '';
    for (const el of pg.els || []) v.els.append(this.elNode(pg, el));
    if (this.sel && this.sel.pg.id === pg.id) { const still = pg.els.find(e => e.id === this.sel.el.id); still ? this.select(pg, still) : this.select(null); }
  }
  elNode(pg, el) {
    const n = h('div', { class: 'el el-' + el.type, 'data-id': el.id });
    this.place(n, el);
    if (el.type === 'tape') { Object.assign(n.style, tapeStyle(el.pattern, el.color)); n.style.mask = TORN_MASK; n.style.webkitMask = TORN_MASK; }
    else if (el.type === 'sticker') n.append(h('img', { src: stickerURL(el.key), alt: STICKERS[el.key]?.name || 'sticker', draggable: 'false' }));
    else if (el.type === 'image') {
      const img = h('img', { alt: 'foto', draggable: 'false' });
      db.blobURL(el.blob).then(u => { if (u) img.src = u; else n.classList.add('missing'); });
      n.classList.add('fr-' + (el.frame || 'sombra'));
      n.append(img);
    }
    else if (el.type === 'text') {
      ensureFont(el.font);
      n.classList.add('lt-' + (el.style || 'normal'));
      Object.assign(n.style, { fontFamily: `'${el.font}'`, fontSize: el.size + 'px', color: el.color, textAlign: el.align || 'left', fontWeight: el.weight || '' }); n.style.setProperty('--tc', el.color);
      n.innerHTML = el.html || '';
    }
    else if (el.type === 'block') {
      n.classList.add('blk-' + el.variant);
      if (el.color) n.style.setProperty('--bc', el.color);
      const bz = h('div', { class: 'bz' + (el.style ? ' lt-' + el.style : ''), html: el.html });
      bz.style.zoom = el.k || 1;
      if (el.font) { ensureFont(el.font); bz.style.fontFamily = `'${el.font}'`; }
      if (el.color) bz.style.setProperty('--tc', el.color);
      n.append(bz);
    }
    else if (el.type === 'summary') n.append(this.summaryDom(pg, el));
    if (el.type === 'text' || el.type === 'block' || el.type === 'summary') n.style.height = 'auto';
    n.addEventListener('pointerdown', e => this.elPointer(e, pg, el, n));
    return n;
  }
  place(n, el) {
    Object.assign(n.style, { left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: el.h ? el.h + 'px' : 'auto', transform: `rotate(${el.rot || 0}deg)`, zIndex: el.z || '' });
  }
  nodeOf(pg, el) { return this.pageEls.get(pg.id)?.els.querySelector(`[data-id="${el.id}"]`); }

  elPointer(e, pg, el, n) {
    if (this.tool !== 'select') return;
    if (this.editing === el.id) return; // escribiendo dentro
    e.stopPropagation();
    if (e.target.closest('button')) return;
    e.preventDefault();
    const already = this.sel && this.sel.el.id === el.id;
    const editTarget = already && ['text', 'block', 'summary'].includes(el.type) ? (el.type === 'summary' ? e.target.closest('[data-edit]') : el.type === 'block' ? n.querySelector('.bz') : n) : null;
    if (!already) this.select(pg, el);
    // se arrastra desde cualquier punto; un toque sin moverse (ya elegido) abre la edición
    this.dragMove(e, pg, el, n, editTarget ? () => this.startEdit(pg, el, n, editTarget) : null);
  }
  dragMove(e, pg, el, n, onTap) {
    const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y; let moved = false;
    const L = this.live(n, ev => {
      if (this._gest || el.locked) return;
      const dx = (ev.clientX - sx) / this.scale, dy = (ev.clientY - sy) / this.scale;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) { this.snapshot(pg); moved = true; }
      el.x = Math.round(ox + dx); el.y = Math.round(oy + dy);
      n.style.left = el.x + 'px'; n.style.top = el.y + 'px'; this.drawFrame();
    });
    const up = () => {
      removeEventListener('pointermove', L.move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      L.end();
      if (moved) this.commit(pg, false);
      else if (onTap && !this._gest) setTimeout(onTap, 0);
    };
    addEventListener('pointermove', L.move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  select(pg, el) {
    if (this.editing) this.stopEdit();
    for (const v of this.pageEls.values()) v.front.innerHTML = '';
    this.sel = pg && el ? { pg, el } : null;
    if (this.sel) this.drawFrame();
    if (this.tool === 'select') this.renderOpts();
    this.root.dispatchEvent(new CustomEvent('nb-select', { bubbles: true, detail: !!this.sel }));
  }
  drawFrame() {
    if (!this.sel) return;
    const { pg, el } = this.sel;
    const v = this.pageEls.get(pg.id);
    const n = this.nodeOf(pg, el); if (!n) return;
    const hh = el.h || n.offsetHeight;
    const old = v.front.querySelector('.sel-frame');
    if (old && old.dataset.id === el.id) {
      Object.assign(old.style, { left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: hh + 'px', transform: `rotate(${el.rot || 0}deg)` });
      return;
    }
    for (const fv of this.pageEls.values()) fv.front.innerHTML = '';
    const f = h('div', { class: 'sel-frame', style: { left: el.x + 'px', top: el.y + 'px', width: el.w + 'px', height: hh + 'px', transform: `rotate(${el.rot || 0}deg)` } });
    const hs = 13 / this.scale;
    const mk = (cls, fn) => { const k = h('span', { class: 'hd ' + cls, style: { width: hs + 'px', height: hs + 'px' } }); k.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); fn(ev); }); return k; };
    if (!el.locked) {
      f.append(
        mk('rot', ev => this.dragRotate(ev, pg, el, n)),
        mk('br', ev => this.dragResize(ev, pg, el, n, 'scale')),
      );
      if (['block', 'summary', 'tape'].includes(el.type)) f.append(mk('rw', ev => this.dragResize(ev, pg, el, n, 'w')));
    }
    // candado propio de cada sticker, foto o cinta: solo se ve mientras está elegido
    if (['sticker', 'image', 'tape'].includes(el.type)) {
      const lk = h('button', { class: 'el-lock' + (el.locked ? ' on' : ''), title: el.locked ? 'Bloqueado: no se borra ni se mueve (toca para desbloquear)' : 'Bloquear para que no se borre ni se mueva', style: { transform: `scale(${1 / this.scale}) rotate(${-(el.rot || 0)}deg)` } });
      lk.innerHTML = icon(el.locked ? 'lock' : 'unlock', 15);
      lk.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); });
      lk.addEventListener('click', ev => {
        ev.stopPropagation(); this.snapshot(pg);
        if (el.locked) delete el.locked; else el.locked = 1;
        this.commit(pg); n.classList.toggle('locked', !!el.locked);
        v.front.innerHTML = ''; this.drawFrame();
        toast(el.locked ? 'Bloqueado: el borrador no lo toca y no se mueve' : 'Desbloqueado');
      });
      f.append(lk);
    }
    f.dataset.id = el.id;
    v.front.append(f);
  }
  // Durante un arrastre: una sola actualización por cuadro y el elemento en su propia capa
  live(n, fn) {
    n.classList.add('dragging');
    let raf = 0, last = null;
    return {
      move: ev => { last = ev; if (!raf) raf = requestAnimationFrame(() => { raf = 0; fn(last); }); },
      end: () => { cancelAnimationFrame(raf); if (last) fn(last); n.classList.remove('dragging'); },
    };
  }
  dragResize(e, pg, el, n, mode) {
    this.snapshot(pg);
    const sx = e.clientX, sy = e.clientY;
    const st = { w: el.w, h: el.h || n.offsetHeight, size: el.size, k: el.k || 1 };
    const rad = (el.rot || 0) * Math.PI / 180;
    const mv = ev => {
      const dx = (ev.clientX - sx) / this.scale, dy = (ev.clientY - sy) / this.scale;
      const d = dx * Math.cos(rad) + dy * Math.sin(rad); // a lo largo del elemento girado
      if (mode === 'w') { el.w = Math.round(Math.max(40, st.w + d)); }
      else this.applyScale(el, st, Math.max(.15, (st.w + d) / st.w));
      this.place(n, el); if (['text', 'block', 'summary'].includes(el.type)) n.style.height = 'auto';
      if (el.type === 'text') n.style.fontSize = el.size + 'px';
      this.drawFrame();
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (el.type === 'summary') el.hMeasured = n.offsetHeight; this.commit(pg, false); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  // Agrandar o achicar: en textos crece la letra; en fotos y stickers, la imagen entera
  applyScale(el, st, k) {
    el.w = Math.round(Math.max(24, st.w * k));
    if (el.type === 'text') el.w = Math.min(el.w, PW - 20);
    if (el.type === 'block') { el.k = clamp((st.k || el.k || 1) * k, .3, 4); el.w = Math.min(el.w, PW - 10); const bz = this.sel && this.nodeOf(this.sel.pg, el)?.querySelector('.bz'); if (bz) bz.style.zoom = el.k; }
    if (el.type === 'text') el.size = Math.round(clamp(st.size * k, 8, 260));
    else if (el.type === 'tape') el.h = Math.round(clamp(st.h * k, 8, 120));
    else if (!['block', 'summary'].includes(el.type)) el.h = Math.round(st.h * k);
  }
  // Dos dedos sobre lo seleccionado: pellizcar para el tamaño, girar para rotar
  bindGestures(v) {
    const pts = new Map();
    v.wrap.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' || this.tool !== 'select' || !this.sel || this.sel.pg !== v.pg) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && !this.sel?.el?.locked) {
        const { pg, el } = this.sel, n = this.nodeOf(pg, el);
        if (this.editing) this.stopEdit();
        const [a, b] = [...pts.values()];
        this.snapshot(pg);
        this._gest = { pg, el, n, d: Math.hypot(a[0] - b[0], a[1] - b[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), rot: el.rot || 0, st: { w: el.w, h: el.h || n.offsetHeight, size: el.size, k: el.k || 1 } };
      }
    }, true);
    v.wrap.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const g = this._gest; if (!g || pts.size < 2) return;
      e.preventDefault();
      const [a, b] = [...pts.values()];
      this.applyScale(g.el, g.st, Math.hypot(a[0] - b[0], a[1] - b[1]) / g.d);
      let r = g.rot + (Math.atan2(b[1] - a[1], b[0] - a[0]) - g.ang) * 180 / Math.PI;
      r = ((r + 540) % 360) - 180;
      g.el.rot = +r.toFixed(1);
      g.n.classList.add('dragging');
      this.place(g.n, g.el);
      if (g.el.type === 'text') g.n.style.fontSize = g.el.size + 'px';
      if (['text', 'block', 'summary'].includes(g.el.type)) g.n.style.height = 'auto';
      this.drawFrame();
    }, { passive: false });
    const up = e => {
      if (!pts.delete(e.pointerId)) return;
      if (this._gest && pts.size < 2) {
        const g = this._gest; setTimeout(() => this._gest = null, 50);
        g.n.classList.remove('dragging');
        for (const t of [0, 90, -90, 180, -180]) if (Math.abs(g.el.rot - t) < 3) g.el.rot = t;
        this.place(g.n, g.el); this.drawFrame(); this.commit(g.pg, false);
      }
    };
    v.wrap.addEventListener('pointerup', up);
    v.wrap.addEventListener('pointercancel', up);
  }
  dragRotate(e, pg, el, n) {
    this.snapshot(pg);
    const r = n.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ang = ev => Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    const a0 = ang(e), r0 = el.rot || 0;
    const L = this.live(n, ev => {
      el.rot = +(r0 + ((ang(ev) - a0 + 540) % 360 - 180)).toFixed(1);
      n.style.transform = `rotate(${el.rot}deg)`; this.drawFrame();
    });
    const up = () => {
      removeEventListener('pointermove', L.move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      L.end();
      const norm = ((el.rot % 360) + 360) % 360;
      for (const t of [0, 90, 180, 270, 360]) if (Math.abs(norm - t) < 3) el.rot = t % 360;
      this.place(n, el); this.drawFrame(); this.commit(pg, false);
    };
    addEventListener('pointermove', L.move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  selControls() {
    const { pg, el } = this.sel;
    const tweak = fn => { this.snapshot(pg); fn(); const n = this.nodeOf(pg, el); if (n) { this.place(n, el); if (el.type === 'text') n.style.fontSize = el.size + 'px'; if (['text', 'block', 'summary'].includes(el.type)) n.style.height = 'auto'; } this.drawFrame(); this.commit(pg, false); };
    const st0 = () => ({ w: el.w, h: el.h || this.nodeOf(pg, el)?.offsetHeight || 0, size: el.size, k: el.k || 1 });
    const out = [
      h('button', { class: 'chip', title: 'Dejarlo recto', html: icon('straight', 18) + 'Enderezar', onclick: () => tweak(() => { el.rot = 0; }) }),
      h('button', { class: 'chip', title: 'Más grande', onclick: () => tweak(() => this.applyScale(el, st0(), 1.15)) }, 'Agrandar'),
      h('button', { class: 'chip', title: 'Más pequeño', onclick: () => tweak(() => this.applyScale(el, st0(), 1 / 1.15)) }, 'Achicar'),
      h('button', { class: 'chip', html: icon('copy', 18) + 'Duplicar', onclick: () => { const c = structuredClone(el); c.id = db.uid('el_'); c.x += 20; c.y += 20; this.addEl(pg, c, { select: true }); } }),
      h('button', { class: 'chip', html: icon('layers', 18) + 'Al frente', onclick: () => { this.snapshot(pg); pg.els = pg.els.filter(x => x !== el).concat(el); this.renderEls(pg); this.commit(pg, false); } }),
      h('button', { class: 'chip', onclick: () => { this.snapshot(pg); pg.els = [el, ...pg.els.filter(x => x !== el)]; this.renderEls(pg); this.commit(pg, false); } }, 'Al fondo'),
      h('button', { class: 'chip danger', html: icon('trash', 18) + 'Eliminar', onclick: () => this.deleteSel() }),
    ];
    if (el.type === 'text') out.unshift(...this.textControls(el, () => { this.snapshot(pg); this.renderEls(pg); this.commit(pg, false); }));
    if (el.type === 'image') out.unshift(h('div', { class: 'style-chips' }, ...[['sombra', 'Sombra'], ['polaroid', 'Polaroid'], ['cinta', 'Con cinta'], ['ninguno', 'Sin marco']].map(([k, nme]) =>
      h('button', { class: 'chip' + ((el.frame || 'sombra') === k ? ' on' : ''), onclick: () => { this.snapshot(pg); el.frame = k; this.renderEls(pg); this.commit(pg, false); this.renderOpts(); } }, nme))));
    if (el.type === 'block') out.unshift(h('div', { class: 'swatches' }, ...['#7A2B3A', '#A8687A', '#C0956A', '#6B4A3A', '#9A8580'].map(c => h('button', { class: 'sw-c' + (el.color === c ? ' on' : ''), style: { '--c': c }, onclick: () => { this.snapshot(pg); el.color = c; this.renderEls(pg); this.commit(pg, false); } }))));
    if (el.type === 'summary') out.unshift(
      h('button', { class: 'chip', html: icon('spark', 18) + 'Mejorar con IA', onclick: () => this.aiImprove(el.topic, true) }),
      h('button', { class: 'chip', html: icon('bulb', 18) + 'Explícamelo', onclick: () => this.explain(pg, el) }),
      h('div', { class: 'style-chips' }, ...[['clasico', 'Clásico'], ['dos', 'Dos columnas'], ['tarjeta', 'Tarjeta']].map(([k, nme]) =>
        h('button', { class: 'chip' + ((el.layout || 'dos') === k ? ' on' : ''), onclick: () => { this.snapshot(pg); el.layout = k; this.renderEls(pg); this.commit(pg, false); this.renderOpts(); } }, nme))),
    );
    return out;
  }
  // Acciones sobre lo seleccionado, para la rueda
  selAction(k) {
    if (!this.sel) return;
    const { pg, el } = this.sel;
    if (k === 'delete') return this.deleteSel();
    if (k === 'dup') { const c = structuredClone(el); c.id = db.uid('el_'); c.x += 20; c.y += 20; return this.addEl(pg, c, { select: true }); }
    this.snapshot(pg);
    const st = { w: el.w, h: el.h || this.nodeOf(pg, el)?.offsetHeight || 0, size: el.size, k: el.k || 1 };
    if (k === 'straight') el.rot = 0;
    else if (k === 'bigger') this.applyScale(el, st, 1.15);
    else if (k === 'smaller') this.applyScale(el, st, 1 / 1.15);
    else if (k === 'front') pg.els = pg.els.filter(x => x !== el).concat(el);
    else if (k === 'back') pg.els = [el, ...pg.els.filter(x => x !== el)];
    else if (k === 'frame') { const f = ['sombra', 'polaroid', 'cinta', 'ninguno']; el.frame = f[(f.indexOf(el.frame || 'sombra') + 1) % f.length]; }
    this.renderEls(pg); this.commit(pg, false);
  }
  // Cambia una propiedad de texto: del texto seleccionado o del próximo que escribas
  textProp(prop, val) {
    const el = this.sel?.el;
    if (el && el.type === 'summary') {
      this.snapshot(this.sel.pg);
      if (prop === 'font') { el.titleFont = val; this.nb.titleFont = val; db.put(this.nb); }
      else if (prop === 'size') el.titleK = clamp((el.titleK || 1) * val, .4, 2.5);
      this.renderEls(this.sel.pg); this.commit(this.sel.pg, false); return;
    }
    const target = el && (el.type === 'text' || el.type === 'block') ? el : this.textStyle;
    if (target === el) this.snapshot(this.sel.pg);
    if (prop === 'size') {
      if (target.type === 'block') { target.k = clamp((target.k || 1) * val, .3, 4); target.w = Math.round(clamp(target.w * val, 60, PW - 10)); }
      else target.size = clamp(Math.round(target.size * val), 10, 260);
    }
    else target[prop] = val;
    this.saveTool();
    if (target === el) { this.renderEls(this.sel.pg); this.commit(this.sel.pg, false); }
    this.renderOpts();
  }
  deleteSel() {
    if (!this.sel) return;
    const { pg, el } = this.sel;
    this.snapshot(pg);
    pg.els = pg.els.filter(x => x.id !== el.id);
    this.select(null); this.renderEls(pg); this.commit(pg, false);
  }
  startEdit(pg, el, n, target) {
    this.editing = el.id;
    this.snapshot(pg);
    target.contentEditable = 'true';
    applyKbMode(target);   // el teclado del celular queda escondido, salvo que lo actives en la rueda
    target.focus();
    if (!sysKeyboard() && !miniKbOpen() && matchMedia('(pointer: coarse)').matches && !localStorage.getItem('kbHint')) {
      localStorage.setItem('kbHint', '1');
      toast('El teclado está escondido. Para escribir: rueda → Texto → teclado pequeño (o escribe a mano con el lápiz).', 5000);
    }
    const r = document.createRange(); r.selectNodeContents(target); r.collapse(false);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    // esquemas y plantillas: cada parte se puede agregar, quitar, mover y cambiar de tamaño
    const offParts = el.type === 'block' ? attachPartEditor(target, () => target.oninput?.()) : null;
    if (offParts && !localStorage.getItem('tpeHint')) { localStorage.setItem('tpeHint', '1'); toast('Toca una parte del esquema: podrás agregar otra, quitarla, moverla o cambiarle el tamaño.', 4500); }
    this._editEnd = () => {
      offParts?.();
      target.contentEditable = 'false';
      if (el.type === 'summary') {
        const key = target.dataset.edit;
        if (key === 'title') el.title = target.innerText.trim();
        else if (key.startsWith('item:')) { const it = el.items.find(i => i.hl === key.slice(5)); if (it) it.text = target.innerText.trim(); }
        else if (key.startsWith('ai:')) { el.ai ||= {}; el.ai[key.slice(3)] = target.innerText.trim(); }
      } else el.html = (el.type === 'block' ? target : n).innerHTML;
      target.oninput = null;
      this.editing = null; this.commit(pg, false);
      if (el.type === 'text' && !n.innerText.trim()) { pg.els = pg.els.filter(x => x.id !== el.id); this.renderEls(pg); }
    };
    target.addEventListener('blur', () => this.stopEdit(), { once: true });
    // guarda mientras escribes, para no perder nada
    target.oninput = () => { if (el.type !== 'summary') el.html = (el.type === 'block' ? target : n).innerHTML; this.commit(pg); };
  }
  stopEdit() { const f = this._editEnd; this._editEnd = null; f && f(); }
  async createText(pg, [x, y]) {
    const st = this.textStyle;
    const el = await this.addEl(pg, { type: 'text', x: Math.round(x), y: Math.round(y - st.size * .7), w: Math.min(PW - x - 20, Math.max(220, st.size * 8)), h: 0, html: '', font: st.font, size: st.size, color: st.color, style: st.style, align: st.align });
    this.setTool('select');
    this.select(pg, el);
    setTimeout(() => { const n = this.nodeOf(pg, el); if (n) this.startEdit(pg, el, n, n); }, 80);
  }

  // ---------- historial ----------
  snapshot(pg) {
    this.hist.push({ id: pg.id, data: JSON.stringify({ els: pg.els, strokes: pg.strokes }) });
    if (this.hist.length > 60) this.hist.shift();
    this.redoStack = [];
  }
  restore(stackFrom, stackTo) {
    const s = stackFrom.pop(); if (!s) return toast('No hay más cambios');
    const pg = this.pages.find(p => p.id === s.id); if (!pg) return;
    stackTo.push({ id: pg.id, data: JSON.stringify({ els: pg.els, strokes: pg.strokes }) });
    Object.assign(pg, JSON.parse(s.data));
    this.select(null); this.renderEls(pg); this.renderInk(pg); this.commit(pg, false);
  }
  undo() { this.restore(this.hist, this.redoStack); }
  redo() { this.restore(this.redoStack, this.hist); }
  commit(pg) {
    clearTimeout(pg._t);
    pg._t = setTimeout(async () => { const { _t, ...rec } = pg; pg._t = null; await db.put(rec); pg.updatedAt = rec.updatedAt; }, 500);
  }

  // ---------- menús ----------
  pageMenu(pg) {
    const idx = pg ? this.pages.indexOf(pg) : this.visiblePageIndex();
    pg = this.pages[idx];
    const body = h('div', { class: 'page-menu' },
      h('h3', {}, 'Tipo de hoja'),
      h('div', { class: 'paper-grid' }, ...PAPERS.map(p => h('button', { class: 'paper-opt paper-' + p.k + (pg.paper === p.k ? ' on' : ''), onclick: () => { pg.paper = p.k; this.applyPaper(pg); this.commit(pg); m.close(); } }, h('span', {}, p.name)))),
      h('h3', {}, 'Color del papel'),
      h('div', { class: 'swatches' }, ...PAPER_TONES.map(t => h('button', { class: 'sw-c' + (pg.tone === t.k ? ' on' : ''), style: { '--c': t.c }, 'aria-label': t.k, onclick: () => { pg.tone = t.k; this.applyPaper(pg); this.commit(pg); m.close(); } }))),
      h('label', { class: 'dp-tg' }, Object.assign(h('input', { type: 'checkbox', onchange: e => { if (e.target.checked) { this.nb.paper = pg.paper; this.nb.tone = pg.tone; db.put(this.nb); toast('Las páginas nuevas usarán esta hoja'); } } })), h('span', { class: 'sw' }), 'Usar esta hoja en las páginas nuevas'),
      h('div', { class: 'ie-row' },
        h('button', { class: 'chip', html: icon('plus', 18) + 'Página después', onclick: () => { m.close(); this.addPage(idx); } }),
        h('button', { class: 'chip', html: icon('copy', 18) + 'Duplicar', onclick: async () => { m.close(); const np = await this.addPage(idx); np.els = structuredClone(pg.els); np.strokes = structuredClone(pg.strokes); np.paper = pg.paper; np.tone = pg.tone; this.applyPaper(np); this.renderEls(np); this.renderInk(np); this.commit(np); } }),
        h('button', { class: 'chip', disabled: idx === 0, onclick: () => { m.close(); this.movePage(idx, -1); } }, 'Subir'),
        h('button', { class: 'chip', disabled: idx === this.pages.length - 1, onclick: () => { m.close(); this.movePage(idx, 1); } }, 'Bajar'),
        h('button', { class: 'chip', html: icon('print', 18) + 'Imprimir o PDF', onclick: () => { m.close(); this.print(); } }),
        h('button', {
          class: 'chip danger', html: icon('trash', 18) + 'Borrar página', onclick: async () => {
            m.close();
            if (this.pages.length === 1) return toast('El cuaderno necesita al menos una página');
            if (!await confirmBox('Borrar página', `Se borrará la página ${idx + 1} con todo lo que tiene.`)) return;
            await db.remove(pg.id); this.pages.splice(idx, 1); this.open_();
          },
        })),
    );
    const m = modal({ title: `Página ${idx + 1}`, body });
  }
  // ---------- hojas desde la rueda ----------
  curPageIndex() { return this.visiblePageIndex(); }
  async deletePageAt(idx) {
    if (this.pages.length === 1) return toast('El cuaderno necesita al menos una hoja');
    const pg = this.pages[idx]; if (!pg) return;
    await db.remove(pg.id); this.pages.splice(idx, 1);
    this.pages.forEach((p, k) => { if (p.order !== k) { p.order = k; this.commit(p); } });
    await this.open_(); this.scrollToPage(Math.min(idx, this.pages.length - 1));
    toast('Hoja ' + (idx + 1) + ' borrada');
  }
  async movePageTo(d) {
    const i = this.curPageIndex(), j = i + d;
    if (j < 0) return toast('Ya es la primera hoja');
    if (j >= this.pages.length) return toast('Ya es la última hoja');
    await this.movePage(i, d);
    toast('La hoja ahora es la ' + (j + 1) + ' de ' + this.pages.length, 1600);
  }
  async movePage(i, d) {
    const j = i + d; [this.pages[i], this.pages[j]] = [this.pages[j], this.pages[i]];
    this.pages.forEach((p, k) => { if (p.order !== k) { p.order = k; this.commit(p); } });
    await this.open_(); this.scrollToPage(j);
  }
  print() {
    document.body.classList.add('printing-nb');
    this.root.classList.add('print-me');
    setTimeout(() => { print(); document.body.classList.remove('printing-nb'); this.root.classList.remove('print-me'); }, 100);
  }

  stickerDrawer() {
    const ctxText = [this.subject?.name, this.nb.name, ...this.pages.flatMap(p => (p.els || []).filter(e => e.type === 'summary').map(e => e.title + ' ' + e.items.map(i => i.text).join(' ')))].join(' ');
    const put = k => { m.close(); this.placeCenter({ type: 'sticker', key: k, w: 110, h: 110 }); };
    const grid = keys => h('div', { class: 'stk-grid' }, ...keys.map(k => h('button', { class: 'stk', title: STICKERS[k].name, onclick: () => put(k) }, h('img', { src: stickerURL(k), alt: '' }), h('span', {}, STICKERS[k].name))));
    const recBox = h('div', {}, grid(recommend(ctxText, 8)));
    // material sugerido por la IA según el tema que estás estudiando
    const aiBtn = h('button', { class: 'chip', html: icon('spark', 16) + 'Sugerir con IA para este tema', onclick: async () => {
      const st = this.ctx.settings?.() || {};
      if (!st.geminiKey) return toast('Pon tu clave de Gemini en el botón IA del inicio para recibir sugerencias.', 4000);
      aiBtn.disabled = true; aiBtn.textContent = 'Pensando…';
      try {
        const { aiText } = await import('./loona.js');
        const words = await aiText(st, `Tema de estudio: "${ctxText.slice(0, 600)}". Devuelve 8 palabras clave en español (separadas por coma) para elegir stickers y decoración gótica elegante para el resumen. Solo las palabras.`);
        recBox.replaceChildren(grid(recommend(words + ' ' + ctxText, 10)));
      } catch (e) { toast(e.message, 4000); }
      aiBtn.disabled = false; aiBtn.innerHTML = icon('spark', 16) + 'Sugerir con IA para este tema';
    } });
    // mis stickers: imágenes propias que subo (se les quita el fondo)
    const mine = h('div', { class: 'stk-grid' });
    const drawMine = async () => {
      const list = await db.all('mysticker');
      mine.replaceChildren(...await Promise.all(list.map(async r => {
        const b = h('button', { class: 'stk', title: r.name, onclick: () => { m.close(); this.placeCenter({ type: 'image', blob: r.blob, w: r.w || 140, h: r.h || 140, frame: 'ninguno' }); } }, h('img', { src: await db.blobURL(r.blob) || '', alt: '' }), h('span', {}, r.name));
        return b;
      })), h('button', { class: 'stk add-stk', onclick: async () => {
        const f = await pickFile('image/*'); if (!f) return;
        const r = await editImage(f); if (!r) return;
        const id = db.uid('stkb_'); await db.putBlob(id, r.blob);
        const k = 140 / Math.max(r.w, r.h);
        await db.put({ id: db.uid('mstk_'), kind: 'mysticker', name: f.name.replace(/\.\w+$/, '').slice(0, 24), blob: id, w: Math.round(r.w * k), h: Math.round(r.h * k) });
        drawMine(); toast('Sticker guardado en Mis stickers (también en tu nube)');
      } }, h('span', { class: 'new-plus', html: icon('plus', 30) }), h('span', {}, 'Subir mi sticker')));
    };
    drawMine();
    const m = modal({ title: 'Stickers', wide: true, body: h('div', {},
      h('h3', {}, 'Recomendados para este tema'), h('div', { class: 'ie-row' }, aiBtn), recBox,
      h('h3', {}, 'Mis stickers'), h('p', { class: 'opt-hint' }, 'Sube tus imágenes (PNG o foto). Puedes quitarles el fondo y darles los colores de tu paleta.'), mine,
      h('h3', {}, 'Loona: gótico y medicina'), grid(LOONA_STICKERS),
      h('h3', {}, 'Todos'), grid(Object.keys(STICKERS).filter(k => !LOONA_STICKERS.includes(k)))) });
  }
  // Transformar tu texto en una página con estilo (eliges cómo se ve ANTES de ponerla)
  transformDrawer() {
    const selEl = this.sel?.el && this.sel.el.type === 'text' ? this.sel.el : null;
    const plain = html => { const d = document.createElement('div'); d.innerHTML = html || ''; return d.innerText.trim(); };
    const ta = h('textarea', { class: 'field tf-text', rows: 5, placeholder: 'Escribe o pega aquí lo que quieres transformar (o selecciona un texto del cuaderno antes de abrir esto).' }, selEl ? plain(selEl.html) : '');
    const title = h('input', { class: 'field', placeholder: 'Título (opcional)' });
    let tpl = 'lamina', theme = themeOf(this.subject?.name), items = null, aiTitle = '', lamina = null, enem = null, practica = null;
    const preview = h('div', { class: 'tf-prev' });
    const local = () => (ta.value.split(/(?<=[.!?;])\s+|\n+/).map(x => x.trim()).filter(x => x.length > 3).slice(0, 18))
      .map((t, i) => { const cat = classify(t, 2); return { hl: 'tf' + i, cat, level: 2, text: condense(t, cat, 22) }; });
    const draw = () => {
      const el = { type: 'summary', title: title.value.trim() || aiTitle || 'Mi tema', items: items || local(), layout: 'dos', tpl, theme, lamina, nopop: true };
      const d = this.summaryDom(null, el); d.classList.add('tf-mini'); preview.replaceChildren(d);
    };
    const pick = (opts, cur, set) => h('div', { class: 'tf-opts' }, ...opts.map(([k, name]) => h('button', { class: 'chip' + (k === cur ? ' on' : ''), onclick: e => { set(k); e.target.parentElement.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b === e.target)); draw(); } }, name)));
    ta.addEventListener('input', () => { items = null; clearTimeout(this._tfT); this._tfT = setTimeout(draw, 300); });
    title.addEventListener('input', draw);
    const aiBtn = h('button', { class: 'btn', onclick: async () => {
      const s = this.ctx.settings?.(); if (!s?.geminiKey) return toast('Para ordenar con IA pon tu clave de Gemini (botón IA del inicio).', 3500);
      if (!ta.value.trim()) return ta.focus();
      aiBtn.textContent = 'Ordenando…';
      try { const r = await aiSummarize({ key: s.geminiKey, model: s.geminiModel, title: title.value.trim() || 'Tema', texts: [{ text: ta.value, level: 2 }], subject: this.subject?.name });
        aiTitle = r.titulo || ''; lamina = r.lamina || null; enem = r.enem || null; practica = r.practica || null; items = (r.items || []).map((it, i) => ({ hl: 'tf' + i, cat: CATS.some(c => c.k === it.cat) ? it.cat : 'ideas', level: clamp(+it.level || 2, 1, 5), text: it.text }));
        draw(); } catch (e) { toast(e.message, 4000); }
      aiBtn.textContent = 'Ordenar con IA';
    } }, 'Ordenar con IA');
    draw();
    modal({ title: 'Transformar con plantilla', wide: true, body: h('div', { class: 'tf' },
      h('div', { class: 'tf-side' }, ta, title,
        h('p', { class: 'opt-hint' }, 'Cómo se ve'), pick([['lamina', 'Lámina ilustrada'], ['ola', 'Ola azul'], ['mapa', 'Mapa conceptual'], ['poster', 'Póster']], tpl, v => tpl = v),
        h('p', { class: 'opt-hint' }, 'Ilustraciones'), pick([['bio', 'Biología'], ['quim', 'Química'], ['gen', 'Luna y polillas']], theme, v => theme = v),
        aiBtn),
      h('div', { class: 'tf-right' }, h('p', { class: 'opt-hint' }, 'Vista previa (así quedará en tu hoja)'), preview)),
      actions: [{ label: 'Cancelar' }, { label: 'Ponerlo en mi hoja', primary: true, onclick: () => {
        if (!ta.value.trim()) { toast('Escribe algo primero'); return false; }
        const pg = this.pages[this.curPageIndex()]; if (!pg) return;
        this.addEl(pg, { type: 'summary', id: db.uid('sum_'), topic: db.uid('tf_'), title: title.value.trim() || aiTitle || 'Mi tema', items: items || local(), layout: 'dos', tpl, theme, lamina, enem, practica, x: 40, y: 50, w: PW - 80, h: 0, rot: 0 }, { select: true });
        if (selEl) { pg.els = pg.els.filter(e => e !== selEl); this.renderEls(pg); this.commit(pg); }
        toast('Listo: tu página con estilo');
      } }] });
  }
  templateDrawer() {
    const groups = {};
    for (const t of TEMPLATES) (groups[t.g] ||= []).push(t);
    const body = h('div', {});
    // la ventana abre al instante; cada vista previa se dibuja cuando aparece en pantalla
    const io = new IntersectionObserver(ents => ents.forEach(en => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      const t = TEMPLATES.find(x => x.k === en.target.dataset.k);
      const inner = h('div', { class: 'el el-block blk-plantilla', style: { position: 'relative', width: t.w + 'px', transform: `scale(${220 / t.w})` } }, h('div', { class: 'bz', html: t.html }));
      en.target.replaceChildren(inner); en.target.classList.add('ready');
    }), { rootMargin: '300px' });
    for (const [g, list] of Object.entries(groups)) {
      body.append(h('h3', {}, g), h('div', { class: 'tpl-grid' }, ...list.map(t => {
        const prev = h('div', { class: 'tpl-prev', 'data-k': t.k });
        io.observe(prev);
        return h('button', { class: 'tpl-opt', onclick: () => { m.close(); this.placeCenter({ type: 'block', variant: 'plantilla', tpl: t.k, html: t.html, w: t.w, h: 0 }); toast('Toca la plantilla dos veces para escribir en ella'); } },
          prev, h('b', {}, t.name), h('small', {}, t.how));
      })));
    }
    const m = modal({ title: 'Plantillas de estudio', wide: true, body, onClose: () => io.disconnect() });
  }
  // Convierte un resumen automático en un esquema (queda debajo o en página nueva)
  async convertSummary(kind) {
    if (!this.sel || this.sel.el.type !== 'summary') return toast('Primero elige un resumen');
    const { pg, el } = this.sel;
    const all = this.summaries(el.topic).map(x => x.el);
    const sum = { title: el.title, items: all.flatMap(x => x.items) };
    const html = kind === 'mapa' ? summaryToMindmap(sum) : kind === 'tiempo' ? summaryToTimeline(sum) : kind === 'tarjetas' ? summaryToCards(sum, el.ai?.preguntas) : summaryTo6(sum);
    const w = kind === 'tiempo' ? 740 : 720;
    let target = pg, y = this.bottomOf(pg) + 30;
    if (y > PH - 340) { target = await this.addPage(this.pages.indexOf(pg)); y = 50; }
    await this.addEl(target, { type: 'block', variant: 'plantilla', tpl: kind, html, w, h: 0, x: Math.round((PW - w) / 2), y }, { select: true });
    this.scrollToPage(this.pages.indexOf(target));
    toast('Esquema creado a partir del resumen');
  }
  setBright(b) {
    this.bright = clamp(+(+b).toFixed(2), .4, 1.3); localStorage.setItem('nbBright', this.bright);
    this.pagesEl.style.filter = this.bright === 1 ? '' : `brightness(${this.bright})`;
  }
  blockDrawer() {
    const m = modal({
      title: 'Bloques de diseño', wide: true, body: h('div', { class: 'blk-grid' }, ...BLOCKS.map(b => {
        const prev = h('div', { class: 'el el-block blk-' + b.k, html: b.html, style: { position: 'relative', width: '100%' } });
        return h('button', { class: 'blk-opt', onclick: () => { m.close(); this.placeCenter({ type: 'block', variant: b.k, html: b.html, w: b.w, h: 0 }); } }, prev, h('span', {}, b.name));
      })),
    });
  }
  async addImage() {
    const f = await pickFile('image/*'); if (!f) return;
    const r = await editImage(f); if (!r) return;
    const id = db.uid('img_');
    await db.putBlob(id, r.blob);
    const w = Math.min(320, r.w), hh = Math.round(w * r.h / r.w);
    this.placeCenter({ type: 'image', blob: id, w, h: hh, frame: 'sombra' });
  }
  placeCenter(el) {
    const pg = this.pages[this.visiblePageIndex()];
    const v = this.pageEls.get(pg.id);
    const top = Math.max(0, (this.scroller.scrollTop - v.wrap.offsetTop) / this.scale);
    const vis = this.scroller.clientHeight / this.scale;
    el.x = Math.round(PW / 2 - el.w / 2 + (Math.random() - .5) * 60);
    el.y = Math.round(clamp(top + vis / 2 - (el.h || 80) / 2, 20, PH - (el.h || 80) - 20));
    if (el.type === 'sticker') el.rot = Math.round((Math.random() - .5) * 16);
    this.addEl(pg, el, { select: true });
  }

  // ---------- resúmenes que llegan del PDF ----------
  summaries(topic) {
    const out = [];
    for (const pg of this.pages) for (const el of pg.els || []) if (el.type === 'summary' && (!topic || el.topic === topic)) out.push({ pg, el });
    return out.sort((a, b) => (a.el.part || 0) - (b.el.part || 0));
  }
  async addHighlight(hl, { topic, title, pdfName, pdfId }) {
    let parts = this.summaries(topic);
    if (hl.level === 1 && !parts.length) {
      await this.newSummary({ topic, title: condense(hl.text, 'titulo'), titleHl: hl.id, pdfName, pdfId });
      this.flash(this.summaries(topic)[0]);
      this.scheduleAI(topic);
      return;
    }
    if (hl.level === 1) { // el título ya existía: se actualiza
      const { pg, el } = parts[0]; el.title = condense(hl.text, 'titulo'); el.titleHl = hl.id; this.renderEls(pg); this.commit(pg); return;
    }
    if (!parts.length) { await this.newSummary({ topic, title, pdfName, pdfId }); parts = this.summaries(topic); }
    let { pg, el } = parts.at(-1);
    this.snapshot(pg);
    // ¿sigue al subrayado anterior (mismo párrafo)? entonces se une en la misma idea
    const prev = el.items.at(-1);
    const near = prev && prev.page === hl.page && prev.y1 != null && hl.y >= prev.y0 - 2 && hl.y - prev.y1 < Math.max(prev.lh || 12, hl.lh || 12) * .7 && (prev.level === hl.level || hl.level > 1 && prev.level > 1);
    const nextPage = prev && prev.ph && prev.page === hl.page - 1 && prev.y1 > prev.ph * .8 && hl.y < prev.ph * .25;
    if (near || nextPage) {
      prev.raw = joinText(prev.raw || prev.text, hl.text);
      prev.text = condense(prev.raw, prev.cat === 'titulo' ? 'ideas' : prev.cat, 38);
      (prev.more ||= []).push(hl.id);
      prev.y1 = hl.y1; prev.page = hl.page; prev.level = Math.min(prev.level, hl.level);
      this.renderEls(pg); this.commit(pg); this.flash({ pg, el }, prev.hl); this.scheduleAI(topic);
      return;
    }
    const item = itemFromHl(hl);
    Object.assign(item, { page: hl.page, y0: hl.y, y1: hl.y1, lh: hl.lh, ph: hl.ph, raw: hl.text });
    el.items.push(item);
    this.renderEls(pg);
    const n = this.nodeOf(pg, el);
    if (n && el.y + n.offsetHeight > PH - 24 && el.items.length > 1) {
      el.items.pop(); this.renderEls(pg); this.commit(pg);
      const cont = await this.newSummary({ topic, title: el.title, pdfName, pdfId, part: (el.part || 0) + 1, cont: true, items: [item] });
      ({ pg, el } = cont);
    }
    this.commit(pg);
    this.flash({ pg, el }, item.hl);
    this.scheduleAI(topic);
  }
  async newSummary({ topic, title, titleHl, pdfName, pdfId, part = 0, cont = false, items = [] }) {
    const need = 180;
    // primer hueco libre en la última página con contenido, si no, página nueva
    let pg = this.pages.at(-1);
    let y = this.bottomOf(pg) + 28;
    if (y + need > PH - 24) { pg = (pg.els.length || pg.strokes.length) ? await this.addPage() : pg; y = this.bottomOf(pg) + 28; }
    const el = { type: 'summary', id: db.uid('sum_'), topic, title, titleHl, pdf: pdfId, pdfName, part, cont, items, layout: 'dos', x: 40, y: Math.max(40, y), w: PW - 80, h: 0, rot: 0 };
    await this.addEl(pg, el);
    return { pg, el };
  }
  bottomOf(pg) {
    let b = 0;
    const v = this.pageEls.get(pg.id);
    for (const el of pg.els || []) { const n = v && this.nodeOf(pg, el); b = Math.max(b, el.y + (el.h || n?.offsetHeight || 60)); }
    for (const s of pg.strokes || []) for (const p of s.pts) b = Math.max(b, p[1]);
    return b;
  }
  removeHighlight(hl) {
    for (const { pg, el } of this.summaries()) {
      const before = el.items.length;
      el.items = el.items.filter(i => i.hl !== hl.id);
      for (const i of el.items) if (i.more?.includes(hl.id)) { i.more = i.more.filter(x => x !== hl.id); }
      if (el.items.length !== before) { this.renderEls(pg); this.commit(pg); }
    }
  }
  updateHighlight(hl) {
    for (const { pg, el } of this.summaries()) {
      const it = el.items.find(i => i.hl === hl.id);
      if (it) { it.level = hl.level; this.renderEls(pg); this.commit(pg); }
    }
  }
  flash(ref, hlId) {
    if (!ref) return;
    const n = this.nodeOf(ref.pg, ref.el); if (!n) return;
    const target = hlId ? n.querySelector(`[data-hl="${hlId}"]`) : n;
    (target || n).classList.add('arrived');
    setTimeout(() => (target || n).classList.remove('arrived'), 1400);
    const v = this.pageEls.get(ref.pg.id);
    const y = v.wrap.offsetTop + (ref.el.y + (target ? target.offsetTop + n.offsetTop - ref.el.y : 0)) * this.scale;
    if (y < this.scroller.scrollTop || y > this.scroller.scrollTop + this.scroller.clientHeight - 60) this.scroller.scrollTo({ top: y - this.scroller.clientHeight / 3, behavior: 'smooth' });
  }

  summaryDom(pg, el) {
    // modelo por defecto: «ola» (hoja negra, olas azules, título en letras de burbuja); los otros siguen disponibles
    // modelo por defecto: «lámina» ilustrada según el tema (plata, blanco y rojo sobre negro); «ola», mapa y póster siguen disponibles
    const tpl = el.tpl && el.tpl !== 'diario' ? el.tpl : 'lamina', theme = el.theme || themeOf(this.subject?.name);
    const ola = tpl === 'ola', lam = tpl === 'lamina';
    const lt = lam ? lamTheme(el, this.subject?.name) : '';
    const root = h('div', { class: 'sum lay-' + (el.layout || 'dos') + ' tpl-' + tpl + ' th-' + theme + (lam ? ' lt-' + lt : '') });
    if (ola) root.append(h('img', { class: 'ola-top', src: 'img/ola-top.webp', alt: '', draggable: false, 'aria-hidden': 'true' }));
    else if (lam) root.append(h('img', { class: 'lam-top', src: 'img/lam-' + lt + '-top.webp', alt: '', draggable: false, 'aria-hidden': 'true' }));
    else {
      root.append(h('i', { class: 'sum-strip l', 'aria-hidden': 'true' }));
      if (tpl === 'poster') root.append(h('i', { class: 'sum-strip r', 'aria-hidden': 'true' }));
      root.append(h('img', { class: 'sum-hero', src: 'img/hero-' + theme + '.webp', alt: '', draggable: false }));   // ilustración grande del tema
    }
    const sub = this.subject;
    root.style.setProperty('--sc', sub?.coverColor || '#7A2B3A');
    root.style.setProperty('--neo', el.theme ? NEON_TH[el.theme] : neonOf(sub?.name));   // brillo neón: plata por defecto; color solo si el tema lo pide
    const tf = el.titleFont || (ola || lam ? 'Pacifico' : this.nb.titleFont || 'Grenze Gotisch'); ensureFont(tf); if (ola || lam) ensureFont('Kalam');
    if (!el.cont && el.title) {
      // título: máximo ~5 cm de alto (270 px de hoja); se achica solo y lo puedes ajustar deslizando la esquina
      const MAXH = ola || lam ? 150 : 270, base = ola || lam ? 58 : 46;
      const t = h('div', { class: 'sum-title', 'data-edit': 'title' }, el.title);
      t.style.fontFamily = `'${tf}', 'Pirata One', serif`;
      const setK = k => { t.style.setProperty('font-size', Math.round(base * k) + 'px', 'important'); };
      setK(el.titleK || 1); root.append(t);
      const fit = () => { if (!t.isConnected) return; let k = el.titleK || 1; while (t.offsetHeight > MAXH && k > .3) { k *= .9; setK(k); } };
      requestAnimationFrame(() => requestAnimationFrame(fit));
      if (pg) {
        const grip = h('span', { class: 'sum-title-grip', title: 'Desliza para agrandar o achicar el título', 'aria-label': 'Tamaño del título' });
        t.append(grip);
        let st = null;
        grip.addEventListener('pointerdown', e => {
          e.preventDefault(); e.stopPropagation();
          const st = { y: e.clientY, x: e.clientX, k: parseFloat(t.style.fontSize) / base };
          const move = ev => { ev.preventDefault(); ev.stopPropagation(); const d = ((ev.clientY - st.y) + (ev.clientX - st.x)) / (this.scale || 1); let k = clamp(st.k * (1 + d / 160), .3, 1.6); setK(k); if (t.offsetHeight > MAXH) setK(st.k); };
          const up = ev => { ev.stopPropagation(); removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); this.snapshot(pg); el.titleK = +(parseFloat(t.style.fontSize) / base).toFixed(2); this.commit(pg); };
          addEventListener('pointermove', move, true); addEventListener('pointerup', up, true);
        });
      }
    }
    else if (el.cont && el.title) root.append(h('div', { class: 'sum-cont' }, el.title + ' (continúa)'));
    const saveEl = pg ? () => this.commit(pg) : null;
    if (lam) { lamBody(root, el, lt, this.subject?.name); if (!el.cont) root.append(quizSection(el, this.subject?.name, saveEl)); return root; }
    const body = h('div', { class: 'sum-body' });
    for (const g of grouped(el.items)) {
      body.append(h('section', { class: 'sum-sec cat-' + g.k },
        h('h4', { class: 'sum-h' }, ola ? (OLA_Q[g.k] || g.label) : g.label),
        h('ul', {}, ...g.list.map(it => h('li', { class: 'lv' + it.level, 'data-hl': it.hl, style: { '--lc': levelOf(it.level).color } },
          h('span', { 'data-edit': 'item:' + it.hl, html: fmtItem(it.text) }))))));
    }
    if (!el.items.length && !el.cont) body.append(h('p', { class: 'sum-empty' }, 'Subraya en el PDF y aquí aparece el resumen ordenado.'));
    root.append(body);
    const foot = ola ? h('div', { class: 'ola-foot' }, h('img', { class: 'ola-big', src: 'img/ola-big.webp', alt: '', draggable: false, 'aria-hidden': 'true' })) : root;
    if (ola) root.append(foot);
    if (el.ai && (el.ai.explicacion || el.ai.analogia)) {
      foot.append(h('div', { class: 'sum-ai' },
        el.ai.explicacion && h('div', { class: 'ai-box exp' }, h('b', {}, 'En palabras simples'), h('p', { 'data-edit': 'ai:explicacion' }, el.ai.explicacion)),
        el.ai.analogia && h('div', { class: 'ai-box ana' }, h('b', {}, 'Imagínalo así'), h('p', { 'data-edit': 'ai:analogia' }, el.ai.analogia)),
        el.ai.mnemotecnia && h('div', { class: 'ai-box mne' }, h('b', {}, 'Truco para recordar'), h('p', { 'data-edit': 'ai:mnemotecnia' }, el.ai.mnemotecnia)),
      ));
    }
    if (ola) root.append(h('span', { class: 'ola-sign' }, '@loona·' + (this.subject?.name || 'apuntes').toLowerCase().replace(/\s+/g, '')));
    if (!el.cont && (el.enem || el.practica || el.enemQs)) root.append(quizSection(el, this.subject?.name, saveEl));
    if (el.ai?.preguntas?.length) root.append(h('details', { class: 'sum-quiz' }, h('summary', {}, `Repaso (${el.ai.preguntas.length} preguntas)`),
      ...el.ai.preguntas.map(q => h('details', { class: 'q' }, h('summary', {}, q.q), h('p', {}, q.a)))));

    return root;
  }

  // IA: se ejecuta sola un rato después del último subrayado (si hay clave)
  scheduleAI(topic) {
    const s = this.ctx.settings?.();
    if (!s?.geminiKey || !s.aiAuto) return;
    clearTimeout(this._aiT?.[topic]);
    (this._aiT ||= {})[topic] = setTimeout(() => this.aiImprove(topic, false), 6000);
  }
  async aiImprove(topic, manual) {
    const s = this.ctx.settings?.();
    if (!s?.geminiKey) {
      if (manual) toast('Para usar IA, pon tu clave de Gemini en Ajustes (en el inicio). Mientras tanto se usa el resumen automático sin IA.', 5200);
      return;
    }
    const parts = this.summaries(topic); if (!parts.length) return;
    const hls = (await db.where('hl', x => parts.some(p => p.el.items.some(i => i.hl === x.id || i.more?.includes(x.id))) || x.id === parts[0].el.titleHl)).sort((a, b) => a.page - b.page || a.y - b.y);
    if (!hls.length) return;
    if (manual) toast('Pidiendo a la IA que ordene el tema…');
    try {
      const r = await aiSummarize({ key: s.geminiKey, model: s.geminiModel, title: parts[0].el.title, texts: hls.map(x => ({ text: x.text, level: x.level })), subject: this.subject?.name });
      const first = parts[0];
      for (const p of parts.slice(1)) { p.pg.els = p.pg.els.filter(e => e !== p.el); this.renderEls(p.pg); this.commit(p.pg); }
      this.snapshot(first.pg);
      first.el.title = r.titulo || first.el.title;
      first.el.items = (r.items || []).map(it => {
        const src = hls[(it.from || 1) - 1] || hls[0];
        return { hl: src.id + (it.from ? '' : '_' + Math.random().toString(36).slice(2, 5)), cat: CATS.some(c => c.k === it.cat) ? it.cat : 'ideas', level: clamp(+it.level || src.level, 1, 5), text: it.text, page: src.page };
      });
      // ids únicos aunque la IA divida un subrayado en varias frases
      const seen = new Set(); first.el.items.forEach(it => { while (seen.has(it.hl)) it.hl += '+'; seen.add(it.hl); });
      first.el.ai = { explicacion: r.explicacion, analogia: r.analogia, mnemotecnia: r.mnemotecnia, preguntas: r.preguntas || [], model: r.model };
      first.el.stickerHint = (r.stickers || []).join(' ');
      if (r.lamina) first.el.lamina = r.lamina;
      if (r.enem) { first.el.enem = r.enem; delete first.el.enemQs; } if (r.practica) first.el.practica = r.practica;
      this.renderEls(first.pg); this.commit(first.pg);
      if (manual) toast('Listo: resumen mejorado con IA');
    } catch (e) {
      console.warn(e);
      if (manual) toast(e.message, 5000);
    }
  }
  explain(pg, el) {
    const qs = el.ai?.preguntas?.length ? el.ai.preguntas : quickQuestions(el);
    const defs = el.items.filter(i => i.cat === 'definicion');
    const body = h('div', { class: 'explain' },
      el.ai?.explicacion ? h('div', { class: 'ai-box exp' }, h('b', {}, 'En palabras simples'), h('p', {}, el.ai.explicacion))
        : h('div', { class: 'ai-box exp' }, h('b', {}, 'La idea en una línea'), h('p', {}, defs[0]?.text || el.items.sort((a, b) => a.level - b.level)[0]?.text || 'Subraya una definición o idea principal para verla aquí.')),
      el.ai?.analogia && h('div', { class: 'ai-box ana' }, h('b', {}, 'Imagínalo así'), h('p', {}, el.ai.analogia)),
      h('div', { class: 'map' }, h('b', {}, 'Mapa del tema'),
        h('div', { class: 'map-root' }, el.title),
        h('div', { class: 'map-kids' }, ...grouped(el.items).map(g => h('div', { class: 'map-kid' }, h('span', {}, g.label), h('small', {}, g.list.length + (g.list.length === 1 ? ' idea' : ' ideas')))))),
      qs.length ? h('div', { class: 'quiz' }, h('b', {}, 'Ponte a prueba'), ...qs.map(q => h('details', { class: 'q' }, h('summary', {}, q.q), h('p', {}, q.a)))) : null,
      !el.ai && h('p', { class: 'opt-hint' }, 'Con una clave de Gemini en Ajustes, aquí verás una explicación sencilla, una analogía y un truco para memorizar.'),
    );
    modal({ title: 'Explícame: ' + (el.title || 'tema'), body, wide: true });
  }

  destroy() { this.ro?.disconnect(); document.removeEventListener('keydown', this.onKey); this.unsub?.(); this.stopEdit(); }
}

// une dos subrayados seguidos, pegando palabras cortadas con guion
function joinText(a, b) {
  a = (a || '').trim(); b = (b || '').trim();
  if (/[A-Za-zÁÉÍÓÚáéíóúñÑ]-$/.test(a) && /^[a-záéíóúñ]/.test(b)) return a.slice(0, -1) + b;
  return a + ' ' + b;
}
// "Concepto: explicación" -> concepto en negrita
// colores con significado: [[azul:sangre venosa]] -> texto en ese color (solo cuando el color explica algo)
const SIG = { rojo: '#E5484D', azul: '#4C8DFF', verde: '#3FB27F', amarillo: '#E9C46A', morado: '#9B7BEA', naranja: '#F08A4B', rosa: '#E77AA8', celeste: '#5BC0EB', marron: '#A8794F', gris: '#9A9AA0' };
function fmtItem(t) {
  let s = esc(t).replace(/\[\[(\w+):([^\]]+)\]\]/g, (m, c, x) => { const k = c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); return SIG[k] ? `<span class="sig" style="--sig:${SIG[k]}">${x}</span>` : x; });
  const m = s.match(/^([^:]{2,48}):\s(.+)$/);
  return m ? `<b>${m[1]}:</b> ${m[2]}` : s;
}
export { LEVELS, catLabel, debounce };

// color del brillo neón del resumen según la materia (la base siempre es negra; plata si no hace falta otro color)
export function neonOf() { return '#E9E9EC'; }   // paleta: negro, blanco, plomo, plata y rojo neón

// tema de ilustraciones del borde según la materia
export function themeOf(name = '') {
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/bio|anat|fisiolog|medic|salud/.test(n)) return 'bio';
  if (/quim/.test(n)) return 'quim';
  return 'gen';
}
const NEON_TH = { bio: '#E9E9EC', quim: '#E9E9EC', gen: '#E9E9EC' };
// en el modelo «ola» los subtítulos son preguntas, como en un cuaderno a mano
const OLA_Q = { definicion: '¿Qué es?', caracteristicas: '¿Cómo es?', tipos: '¿Qué tipos hay?', funcion: '¿Para qué sirve?', como: '¿Cómo funciona?', cuando: '¿Cuándo?', donde: '¿Dónde?', quien: '¿Quién?', porque: '¿Por qué?', consecuencias: '¿Qué provoca?', datos: 'Datos clave', ejemplos: 'Ejemplos', ideas: 'Ideas clave' };

// ---------- lámina ilustrada: arte según el tema + esquema numerado + tarjetas + tabla + notas ----------
const LAM_THEMES = ['celula', 'genetica', 'corpo', 'plantas', 'quimica', 'fisica', 'mar'];
function lamTheme(el, subject = '') {
  const t = el.lamina?.tema_visual; if (LAM_THEMES.includes(t)) return t;
  const n = ((el.title || '') + ' ' + subject).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/celul|organel|citolog|membrana|mitocond|ribosom/.test(n)) return 'celula';
  if (/genet|dna|adn|cromosom|hered|mendel|gen\b|genes|mutac/.test(n)) return 'genetica';
  if (/coraz|sangu|anatom|fisiolog|organo|orgao|corpo|cuerpo|humano|neur|pulm|digest|sistema|hormon|inmun|imun/.test(n)) return 'corpo';
  if (/planta|botan|fotosint|hoja|folha|flor|veget|semilla|raiz|ecolog/.test(n)) return 'plantas';
  if (/quim|molecul|reacc|reac|acid|enlace|ligac|periodic|estequi|organica|solucion|ph\b/.test(n)) return 'quimica';
  if (/fisic|energ|fuerza|forca|movim|onda|electr|eletr|optic|cinemat|termo|atomo|magnet/.test(n)) return 'fisica';
  return 'mar';
}
const LAM_COL = { plata: '#B98A64', rojo: '#8A5A3C', blanco: '#4A2E22', cafe: '#4A2E22', caramelo: '#8A5A3C', crema: '#B98A64', azul: '#4C8DFF', verde: '#3FB27F', amarillo: '#E9C46A', morado: '#9B7BEA', naranja: '#F08A4B', rosa: '#E77AA8', celeste: '#5BC0EB', gris: '#9A9AA0' };
const lamCol = c => LAM_COL[(c || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')] || '#C9CED6';
// el SVG viene de la IA: se limpia (sin scripts, eventos ni enlaces externos)
function cleanSvg(src) {
  if (!src || !/<svg[\s>]/i.test(src)) return null;
  try {
    const d = new DOMParser().parseFromString(src.replace(/^[\s\S]*?(<svg)/i, '$1').replace(/(<\/svg>)[\s\S]*$/i, '$1'), 'image/svg+xml');
    const svg = d.documentElement; if (!svg || svg.nodeName.toLowerCase() !== 'svg' || d.querySelector('parsererror')) return null;
    svg.querySelectorAll('script,foreignObject,iframe,image,use[href^="http"],a').forEach(n => n.remove());
    svg.querySelectorAll('*').forEach(n => [...n.attributes].forEach(a => { if (/^on/i.test(a.name) || (/href$/i.test(a.name) && !/^#/.test(a.value)) || /javascript:/i.test(a.value)) n.removeAttribute(a.name); }));
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 400 300');
    svg.removeAttribute('width'); svg.removeAttribute('height'); svg.setAttribute('class', 'lam-svg'); svg.setAttribute('role', 'img');
    return document.importNode(svg, true);
  } catch { return null; }
}
const popped = new Set();
function lamBody(root, el, lt, subject) {
  const L = el.lamina || {};
  if (L.subtitulo) root.append(h('p', { class: 'lam-sub' }, L.subtitulo));
  // tarjetas: las partes del esquema (con IA) o las categorías del resumen (sin IA)
  // todas las tarjetas del mismo color (rojo); colores distintos solo si marcan categorías, con su leyenda
  const byCat = L.usa_colores === true && (L.leyenda || []).length > 0;
  let cards = (L.partes || []).filter(p => p && p.nombre).slice(0, 10).map((p, i) => ({ n: p.n || i + 1, name: p.nombre, color: byCat ? lamCol(p.color) : '#8A5A3C', icon: p.icono || '', pts: (p.puntos || []).map(t => ({ html: fmtItem(t) })) }));
  if (!cards.length) cards = grouped(el.items).map((g, i) => ({ n: i + 1, name: OLA_Q[g.k] || g.label, color: '#8A5A3C', icon: '', pts: g.list.map(it => ({ html: fmtItem(it.text), hl: it.hl })) }));
  if (byCat) root.append(h('div', { class: 'lam-legend' }, ...L.leyenda.slice(0, 6).map(x => h('span', {}, h('i', { style: { background: lamCol(x.color) } }), x.significa))));
  const card = c => h('div', { class: 'lam-card', style: { '--cc': c.color } },
    h('div', { class: 'lam-ch' }, h('b', { class: 'lam-n' }, String(c.n)), c.icon && h('span', { class: 'lam-ic' }, c.icon), h('span', {}, c.name)),
    h('ul', {}, ...c.pts.map(p => h('li', {}, h('span', { html: p.html, ...(p.hl ? { 'data-edit': 'item:' + p.hl } : {}) })))));
  const svg = cleanSvg(L.svg);
  if (svg) {
    const half = Math.ceil(cards.length / 2);
    // hoja de transición: papel vegetal con una ventana recortada sobre el esquema; al tocarla gira y lo descubre
    const veil = h('button', { class: 'lam-veil', 'aria-label': 'Abrir la hoja y ver el esquema', onclick: e => { e.stopPropagation(); e.currentTarget.classList.toggle('open'); } },
      h('span', { class: 'lam-veil-win' }), h('span', { class: 'lam-veil-tab' }, 'Abrir'));
    root.append(h('div', { class: 'lam-grid' }, h('div', { class: 'lam-col' }, ...cards.slice(0, half).map(card)), h('figure', { class: 'lam-fig' }, svg, veil), h('div', { class: 'lam-col' }, ...cards.slice(half).map(card))));
  } else root.append(h('div', { class: 'lam-cards' }, ...cards.map(card)));
  if (!cards.length && !el.cont) root.append(h('p', { class: 'sum-empty' }, 'Subraya en el PDF y aquí aparece tu lámina.'));
  const T = L.tabla;
  if (T?.filas?.length) root.append(h('div', { class: 'lam-tabw' }, h('p', { class: 'lam-tt' }, T.titulo || 'Resumen'), h('table', { class: 'lam-tab' },
    T.columnas?.length ? h('thead', {}, h('tr', {}, ...T.columnas.map(c => h('th', {}, c)))) : null,
    h('tbody', {}, ...T.filas.slice(0, 8).map(r => h('tr', {}, ...r.map(c => h('td', { html: fmtItem(String(c)) }))))))));
  // pie: la ilustración grande y las notas (la curiosidad viene en un sobre con sello de cera: tócalo para abrirlo)
  const ai = el.ai || {};
  const notes = h('div', { class: 'lam-notes' },
    (L.recuerda || ai.mnemotecnia) && h('div', { class: 'lam-note rec' }, h('b', {}, L.recuerda ? 'Recuerda' : 'Truco para recordar'), h('p', {}, L.recuerda || ai.mnemotecnia)),
    ai.explicacion && h('div', { class: 'lam-note' }, h('b', {}, 'En palabras simples'), h('p', { 'data-edit': 'ai:explicacion' }, ai.explicacion)),
    L.curiosidad && h('button', { class: 'lam-env', onclick: e => { e.stopPropagation(); e.currentTarget.classList.toggle('open'); } }, h('span', { class: 'lam-flap' }), h('span', { class: 'lam-seal' }), h('span', { class: 'lam-letter' }, h('b', {}, '¿Sabías que…?'), L.curiosidad), h('small', { class: 'lam-envh' }, 'Curiosidad · toca el sello')),
    L.tip && h('div', { class: 'lam-note tip' }, h('b', {}, 'Tip ENEM'), h('p', {}, L.tip)));
  root.append(h('div', { class: 'lam-foot' }, h('img', { class: 'lam-big', src: 'img/lam-' + lt + '-big.webp', alt: '', draggable: false, 'aria-hidden': 'true' }), notes));
  root.append(h('span', { class: 'ola-sign' }, 'XOXO, Loona · ' + (subject || 'apuntes')));
  // objetos en 3D: la lámina se inclina un poco siguiendo tu dedo o el mouse (las ilustraciones flotan por delante)
  if (!document.documentElement.classList.contains('lite')) {
    let raf = 0;
    root.addEventListener('pointermove', e => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const r = root.getBoundingClientRect(); root.style.setProperty('--tx', ((e.clientX - r.left) / r.width - .5).toFixed(3)); root.style.setProperty('--ty', ((e.clientY - r.top) / r.height - .5).toFixed(3)); }); });
    root.addEventListener('pointerleave', () => { root.style.setProperty('--tx', 0); root.style.setProperty('--ty', 0); });
  }
  // se abre como una tarjeta pop-up la primera vez que la ves
  const key = el.id || el.title;
  if (!el.nopop && !popped.has(key) && 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.classList.add('lam-wait');
    const io = new IntersectionObserver(ents => { if (ents.some(x => x.isIntersecting)) { io.disconnect(); popped.add(key); root.classList.remove('lam-wait'); root.classList.add('lam-pop'); setTimeout(() => root.classList.remove('lam-pop'), 2600); } }, { threshold: .15 });
    requestAnimationFrame(() => io.observe(root));
  }
}
