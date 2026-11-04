// Lado PDF: lectura, subrayado que se endereza solo, selección de texto
// y el círculo de herramientas.
import * as pdfjsLib from '../vendor/pdf.min.mjs';
import * as db from './db.js';
import { h, icon, LEVELS, levelOf, toast, makeDraggable, clamp, kineticPan } from './ui.js';
import { aiOcr, tesseractOcr } from './summarizer.js';

// color un poco más oscuro (el lápiz marca más intenso)
function darker(hex, k = .3) { const n = parseInt(hex.slice(1), 16); const f = v => Math.round(v * (1 - k)); return `rgb(${f(n >> 16)},${f(n >> 8 & 255)},${f(n & 255)})`; }

const V = new URL('../vendor/', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = V + 'pdf.worker.min.mjs';

const TOOLS = [
  { k: 'marker', icon: 'marker', name: 'Resaltador' },
  { k: 'underline', icon: 'underline', name: 'Subrayar con línea' },
  { k: 'thin', icon: 'thin', name: 'Subrayar con raya finita' },
  { k: 'pen', icon: 'pen', name: 'Lápiz libre' },
  { k: 'select', icon: 'select', name: 'Seleccionar texto' },
  { k: 'eraser', icon: 'eraser', name: 'Borrar subrayado' },
  { k: 'hand', icon: 'hand', name: 'Mover y leer' },
];

export class PdfView {
  constructor(root, { pdfRec, notebookId, onHighlight, onHighlightRemoved, onHighlightChanged, settings }) {
    this.settings = settings || (() => ({}));
    this.root = root;
    this.rec = pdfRec;
    this.notebookId = notebookId;
    this.cb = { onHighlight, onHighlightRemoved, onHighlightChanged };
    this.pages = [];
    this.hls = new Map();
    this.undo = [];
    this.zoom = 1;
    const saved = JSON.parse(localStorage.getItem('pdfTool') || '{}');
    this.tool = saved.tool || 'marker';
    this.level = saved.level || 2;
    this.width = saved.width || 1;      // grosor relativo
    this.alpha = saved.alpha ?? .75;    // intensidad del color (0.15 a 1)
    this.eraserW = saved.eraserW ?? 10; // grosor del borrador
    this.straight = saved.straight ?? true;
    // por defecto: un dedo mueve la página y el lápiz subraya
    this.penOnly = saved.fingerMoves ?? true;
    this.autoSum = saved.autoSum ?? true;
    this.locked = false;
    this.fit = localStorage.getItem('pdfFit') || 'ancho';
    this.bright = +(localStorage.getItem('pdfBright') || 1);
    this.build();
  }
  saveTool() {
    localStorage.setItem('pdfTool', JSON.stringify({ tool: this.tool, level: this.level, width: this.width, alpha: this.alpha, eraserW: this.eraserW, straight: this.straight, penOnly: this.penOnly, fingerMoves: this.penOnly, autoSum: this.autoSum }));
  }

  build() {
    this.scroller = h('div', { class: 'pdf-scroll' });
    this.pagesEl = h('div', { class: 'pdf-pages' });
    this.scroller.append(this.pagesEl);
    this.root.append(this.scroller);
    this.buildDial();
    this.buildSelBar();
    this.scroller.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const w = this._wz ||= { k: 1, x: e.clientX, y: e.clientY };
      if (w.k === 1) { const r = this.pagesEl.getBoundingClientRect(); this.pagesEl.style.transformOrigin = `${e.clientX - r.left}px ${e.clientY - r.top}px`; w.x = e.clientX; w.y = e.clientY; }
      w.k = clamp(this.zoom * w.k * Math.exp(-e.deltaY * .0025), .6, 4) / this.zoom;
      this.pagesEl.style.transform = `scale(${w.k})`;
      clearTimeout(this._wt);
      this._wt = setTimeout(() => { const k = w.k; this._wz = null; this.pagesEl.style.transform = ''; this.setZoom(this.zoom * k, { clientX: w.x, clientY: w.y }); }, 160);
    }, { passive: false });
    this.ro = new ResizeObserver(() => this.relayout());
    this.ro.observe(this.scroller);
    // pellizcar con dos dedos para agrandar o achicar (desactivado con el candado)
    // Pellizco fluido: mientras mueves los dedos solo se escala la imagen (GPU);
    // al soltar se recalcula una sola vez y las páginas se vuelven a dibujar nítidas.
    let pinch = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    this.scroller.addEventListener('touchstart', e => {
      if (this.locked || e.touches.length !== 2) return;
      const m = mid(e.touches), r = this.pagesEl.getBoundingClientRect();
      pinch = { d: dist(e.touches), z: this.zoom, m, k: 1, tx: 0, ty: 0 };
      this.pagesEl.style.transformOrigin = `${m[0] - r.left}px ${m[1] - r.top}px`;
      this.pagesEl.style.willChange = 'transform';
      this._pinching = true;
    }, { passive: true });
    this.scroller.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const t = e.touches, m = mid(t);
      pinch.k = clamp(pinch.z * dist(t) / pinch.d, .6, 4) / pinch.z;
      pinch.tx = m[0] - pinch.m[0]; pinch.ty = m[1] - pinch.m[1];
      if (!pinch.raf) pinch.raf = requestAnimationFrame(() => {
        if (!pinch) return; pinch.raf = 0;
        this.pagesEl.style.transform = `translate(${pinch.tx}px, ${pinch.ty}px) scale(${pinch.k})`;
      });
    }, { passive: false });
    const endPinch = e => {
      if (e.touches.length >= 2 || !pinch) return;
      const pp = pinch; pinch = null;
      cancelAnimationFrame(pp.raf);
      this.pagesEl.style.transform = ''; this.pagesEl.style.willChange = '';
      if (Math.abs(pp.k - 1) > .01) this.setZoom(pp.z * pp.k, { clientX: pp.m[0], clientY: pp.m[1] });
      this.scroller.scrollLeft -= pp.tx; this.scroller.scrollTop -= pp.ty;
      setTimeout(() => this._pinching = false, 80);
    };
    this.scroller.addEventListener('touchend', endPinch);
    this.scroller.addEventListener('touchcancel', endPinch);
    // candado: fija la página para apoyar la mano
    this.lockBtn = h('button', { class: 'lock-btn', 'aria-label': 'Bloquear la página para apoyar la mano', onclick: () => this.setLocked(!this.locked) });
    this.zoomBox = h('div', { class: 'zoom-box' },
      h('button', { class: 'zb', 'aria-label': 'Agrandar', title: 'Agrandar', html: icon('plus', 16), onclick: () => this.animateZoom(this.zoom * 1.35) }),
      h('button', { class: 'zb', 'aria-label': 'Achicar', title: 'Achicar', html: icon('minus', 16), onclick: () => this.animateZoom(this.zoom / 1.35) }));
    // el candado y el zoom se manejan desde la rueda y con los dedos (sin botones flotantes)
    // un dedo: doble toque = agrandar/volver; doble toque y deslizar = zoom continuo
    // Solo cuenta como "doble toque" si el primer toque fue un toque corto y quieto
    // (antes, deslizar dos veces rápido para bajar el PDF se confundía con zoom y no lo dejaba mover).
    let lastTap = 0, lastXY = null, one = null, first = null;
    this.scroller.addEventListener('touchstart', e => {
      if (this.locked || e.touches.length !== 1) { one = null; first = null; lastTap = 0; return; }
      const t = e.touches[0], now = performance.now();
      if (now - lastTap < 320 && lastXY && Math.hypot(t.clientX - lastXY[0], t.clientY - lastXY[1]) < 40) {
        this._oneZoom = true;  // el dibujo ignora este toque
        const r = this.pagesEl.getBoundingClientRect();
        one = { y: t.clientY, x: t.clientX, k: 1, moved: false };
        this.pagesEl.style.transformOrigin = `${t.clientX - r.left}px ${t.clientY - r.top}px`;
        this.pagesEl.style.willChange = 'transform';
        lastTap = 0; first = null;
      } else { first = { t: now, x: t.clientX, y: t.clientY, moved: false }; lastTap = 0; }
    }, { passive: true, capture: true });
    this.scroller.addEventListener('touchmove', e => {
      if (first && e.touches.length === 1 && Math.hypot(e.touches[0].clientX - first.x, e.touches[0].clientY - first.y) > 12) first.moved = true;
      if (!one || e.touches.length !== 1) return;
      e.preventDefault();
      const dy = e.touches[0].clientY - one.y;
      if (Math.abs(dy) > 6) one.moved = true;
      one.k = clamp(this.zoom * Math.exp(dy * .009), .6, 4) / this.zoom;
      if (!one.raf) one.raf = requestAnimationFrame(() => { if (!one) return; one.raf = 0; this.pagesEl.style.transform = `scale(${one.k})`; });
    }, { passive: false, capture: true });
    this.scroller.addEventListener('touchend', e => {
      if (first) { const f = first; first = null; const now = performance.now(); if (!f.moved && now - f.t < 260 && !e.touches.length) { lastTap = now; lastXY = [f.x, f.y]; } else lastTap = 0; }
      if (!one) return;
      const o = one; one = null; cancelAnimationFrame(o.raf);
      setTimeout(() => this._oneZoom = false, 60);
      if (o.moved) { this.pagesEl.style.transform = ''; this.pagesEl.style.willChange = ''; this.setZoom(this.zoom * o.k, { clientX: o.x, clientY: o.y }); }
      else { this.pagesEl.style.transform = ''; this.animateZoom(this.zoom > 1.25 ? 1 : 2.2, { clientX: o.x, clientY: o.y }); }
    }, { capture: true });
    this.setLocked(false);
    this.setBright(this.bright);
    document.addEventListener('selectionchange', this.onSel = () => this.updateSelBar());
  }

  async open() {
    const blob = await db.getBlob(this.rec.blob) || (window.__fetchRemoteBlob && await window.__fetchRemoteBlob(this.rec.blob));
    if (!blob) { this.pagesEl.append(h('p', { class: 'empty' }, 'Este PDF todavía no bajó de la nube. Revisa tu conexión y vuelve a abrirlo.')); return; }
    this.data = new Uint8Array(await blob.arrayBuffer());
    const msg = h('p', { class: 'empty pdf-msg' }, 'Abriendo el PDF…');
    this.pagesEl.append(msg);
    try { this.doc = await this.loadDoc(); }
    catch (e) {
      console.warn(e);
      msg.textContent = e.name === 'PasswordException' ? 'Este PDF tiene contraseña y no se pudo abrir.' : 'No se pudo abrir este PDF: el archivo parece dañado o incompleto. Prueba descargarlo de nuevo y volver a subirlo.';
      return;
    }
    msg.remove();
    if (!this.rec.pages) { this.rec.pages = this.doc.numPages; db.put(this.rec); }
    for (const h0 of await db.where('hl', x => x.pdf === this.rec.id)) this.hls.set(h0.id, h0);
    // Las páginas se preparan al instante con el tamaño de la primera; cada una se lee del archivo
    // recién cuando vas a verla (antes leía las 550 de golpe y el libro quedaba en "cargando").
    const first = await this.doc.getPage(1);
    const vp0 = first.getViewport({ scale: 1 });
    for (let i = 1; i <= this.doc.numPages; i++) {
      const vp = vp0;
      const p = { n: i, page: i === 1 ? first : null, w: vp.width, h: vp.height, rendered: 0, items: null };
      p.el = h('div', { class: 'pdf-page', 'data-n': i });
      p.canvas = h('canvas');
      p.text = h('div', { class: 'textLayer' });
      p.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      p.svg.setAttribute('class', 'hl-layer');
      p.svg.setAttribute('viewBox', `0 0 ${vp.width} ${vp.height}`);
      p.svg.setAttribute('preserveAspectRatio', 'none');
      p.ink = h('div', { class: 'ink-catch' });
      p.status = h('div', { class: 'pg-status' }, `Cargando página ${i}…`);
      p.el.append(p.canvas, p.svg, p.text, p.ink, p.status, h('span', { class: 'pgnum' }, `${i} / ${this.doc.numPages}`));
      this.pagesEl.append(p.el);
      this.pages.push(p);
      this.bindDraw(p);
    }
    this.io = new IntersectionObserver(ents => ents.forEach(e => { if (e.isIntersecting) this.renderPage(this.pages[+e.target.dataset.n - 1]); }), { root: this.scroller, rootMargin: '600px 0px' });
    this.pages.forEach(p => this.io.observe(p.el));
    this.relayout();
    this.applyTool();
    // abre en la página donde lo dejaste (se guarda en el dispositivo y en la nube)
    const last = this.rec.lastPage || 1;
    if (last > 1) {
      this._hold = last;
      const back = () => this.goto(last);
      requestAnimationFrame(back); setTimeout(back, 250); setTimeout(back, 700);
      setTimeout(() => { back(); this._hold = null; }, 1300);
    }
    this.scroller.addEventListener('scroll', () => {
      if (this._hold) return;   // mientras vuelve a tu página no se guarda nada
      clearTimeout(this._sp);
      this._sp = setTimeout(() => { const n = this.currentPage(); if (n !== this.rec.lastPage) { this.rec.lastPage = n; db.put(this.rec); } }, 800);
    });
  }

  // Abre el PDF tolerando archivos raros: contraseña, errores internos y
  // un modo compatible (sin WebAssembly) para imágenes JPEG 2000 / JBIG2.
  async loadDoc() {
    const opts = {
      data: this.data.slice(), cMapUrl: V + 'cmaps/', cMapPacked: true, standardFontDataUrl: V + 'standard_fonts/',
      wasmUrl: V + 'wasm/', isEvalSupported: false, stopAtErrors: false, enableXfa: true,
      useWasm: !this.compat, maxImageSize: -1,
    };
    this.task = pdfjsLib.getDocument(opts);
    this.task.onPassword = async (update, reason) => {
      const { ask } = await import('./ui.js');
      const pw = await ask(reason === 2 ? 'Contraseña incorrecta' : 'PDF con contraseña', 'Escribe la contraseña del PDF', '', 'Abrir');
      if (pw == null) { this.task.destroy(); return; }
      update(pw);
    };
    return this.task.promise;
  }
  // ¿La página salió en blanco aunque tiene imagen o texto? (decodificador de imágenes que falló)
  async looksBlank(p, c) {
    // una página que falló queda blanca pura; cualquier tinta (aunque sea tenue) indica que sí se dibujó
    const t = document.createElement('canvas'); t.width = 120; t.height = 160;
    const x = t.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, 120, 160);
    const d = x.getImageData(0, 0, 120, 160).data; let ink = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] + d[i + 1] + d[i + 2] < 750) ink++;
    if (ink > 4) return false;
    if (p.textContent?.items?.some(it => it.str?.trim())) return true;
    try {
      const ops = await (await this.ensurePage(p)).getOperatorList(); const O = pdfjsLib.OPS;
      return ops.fnArray.some(f => f === O.paintImageXObject || f === O.paintInlineImageXObject || f === O.paintImageMaskXObject);
    } catch { return false; }
  }
  // lee la página del archivo cuando hace falta (y ajusta su tamaño si es distinto)
  async ensurePage(p) {
    if (p.page) return p.page;
    p._pp ||= this.doc.getPage(p.n).then(page => {
      p.page = page; p._pp = null;
      const vp = page.getViewport({ scale: 1 });
      if (Math.abs(vp.width - p.w) > .5 || Math.abs(vp.height - p.h) > .5) {
        p.w = vp.width; p.h = vp.height; p.svg.setAttribute('viewBox', `0 0 ${vp.width} ${vp.height}`);
        clearTimeout(this._rl2); this._rl2 = setTimeout(() => this.relayout(), 60);
      }
      return page;
    });
    return p._pp;
  }
  async enterCompat() {
    if (this.compat) return; this.compat = true;
    toast('Este PDF usa imágenes especiales: lo abro en modo compatible…', 3500);
    try { this.task?.destroy(); } catch { }
    this.doc = await this.loadDoc();
    for (const p of this.pages) { p.page = null; p._pp = null; p.rendered = 0; p.hires = null; }
    this.pages.filter(p => this.isNear(p)).forEach(p => this.renderPage(p));
  }
  currentPage() { return this._hold || this.curPage(); }
  goto(n) { const p = this.pages[n - 1]; if (p) this.scroller.scrollTop += p.el.getBoundingClientRect().top - this.scroller.getBoundingClientRect().top - 8; }

  baseScale(p) {
    const w = (this.scroller.clientWidth - 24) / p.w;
    return this.fit === 'hoja' ? Math.min(w, (this.scroller.clientHeight - 24) / p.h) : w;
  }
  setLocked(v) {
    this.locked = v;
    this.root.classList.toggle('locked', v);
    this.lockBtn.innerHTML = icon(v ? 'lock' : 'unlock', 18);
    this.lockBtn.title = v ? 'Página bloqueada: apoya la mano y subraya con el lápiz (toca para desbloquear)' : 'Bloquear la página para apoyar la mano';
    this.lockBtn.classList.toggle('on', v);
    if (this.pages.length) toast(v ? 'Página bloqueada: apoya la mano y subraya con el lápiz' : 'Página desbloqueada', 2000);
  }
  setFit(f) {
    const n = this.currentPage();
    this.fit = f; localStorage.setItem('pdfFit', f); this.zoom = 1;
    this.root.classList.toggle('fit-page', f === 'hoja');
    this.relayout(); requestAnimationFrame(() => this.goto(n));
  }
  setBright(b) {
    this.bright = clamp(+b.toFixed(2), .4, 1.3); localStorage.setItem('pdfBright', this.bright);
    this.pagesEl.style.filter = this.bright === 1 ? '' : `brightness(${this.bright})`;
  }
  relayout() {
    if (!this.pages.length) return;
    for (const p of this.pages) {
      const s = this.baseScale(p) * this.zoom;
      p.scale = s;
      p.el.style.width = p.w * s + 'px';
      p.el.style.height = p.h * s + 'px';
      p.el.style.setProperty('--total-scale-factor', s);
      p.el.style.setProperty('--scale-factor', s);
      if (p.rendered && Math.abs(p.rendered - s) > 0.01) { p.rendered = 0; p.needs = true; }
    }
    clearTimeout(this._rl);
    this._rl = setTimeout(() => this.pages.filter(p => p.needs && this.isNear(p)).forEach(p => this.renderPage(p)), 120);
  }
  isNear(p) {
    const r = p.el.getBoundingClientRect(), s = this.scroller.getBoundingClientRect();
    return r.bottom > s.top - 600 && r.top < s.bottom + 600;
  }
  // zoom animado (botones y doble toque): primero se ve suave, luego se dibuja nítido
  animateZoom(z, e) {
    z = clamp(z, .6, 4);
    const k = z / this.zoom; if (Math.abs(k - 1) < .01) return;
    const sr = this.scroller.getBoundingClientRect(), r = this.pagesEl.getBoundingClientRect();
    const fx = e ? e.clientX : sr.left + sr.width / 2, fy = e ? e.clientY : sr.top + sr.height / 2;
    const el = this.pagesEl;
    el.style.transformOrigin = `${fx - r.left}px ${fy - r.top}px`;
    el.style.transition = 'transform .18s ease-out'; el.style.transform = `scale(${k})`;
    clearTimeout(this._az);
    this._az = setTimeout(() => { el.style.transition = ''; el.style.transform = ''; this.setZoom(z, { clientX: fx, clientY: fy }); }, 190);
  }
  // ---------- ir a una página ----------
  curPage() {
    const top = this.scroller.getBoundingClientRect().top + this.scroller.clientHeight / 3;
    let n = 1, lo = 0, hi = this.pages.length - 1;   // búsqueda rápida (libros de cientos de páginas)
    while (lo <= hi) { const m = (lo + hi) >> 1; if (this.pages[m].el.getBoundingClientRect().top <= top) { n = this.pages[m].n; lo = m + 1; } else hi = m - 1; }
    return n;
  }
  goToPage(n) {
    if (!this.pages.length) return;
    n = clamp(Math.round(n) || 1, 1, this.pages.length);
    const p = this.pages[n - 1];
    this._hold = null;
    const go = () => this.goto(n);
    go(); requestAnimationFrame(go); setTimeout(go, 150);   // repite por si la página aún estaba midiéndose
    toast(`Página ${n} de ${this.doc?.numPages || this.pages.length}`, 1400);
  }
  setZoom(z, e) {
    const old = this.zoom;
    this.zoom = clamp(z, 0.6, 4);
    const k = this.zoom / old;
    const sx = this.scroller.scrollLeft, sy = this.scroller.scrollTop;
    const r = this.scroller.getBoundingClientRect();
    const fx = e ? e.clientX - r.left : r.width / 2, fy = e ? e.clientY - r.top : r.height / 2;
    this.relayout();
    this.scroller.scrollLeft = (sx + fx) * k - fx;
    this.scroller.scrollTop = (sy + fy) * k - fy;
  }

  async renderPage(p) {
    if (!p || p.rendering || (p.rendered && Math.abs(p.rendered - p.scale) < 0.01)) return;
    this.busy ||= 0;
    if (this.busy >= 2) { (this.queue ||= new Set()).add(p); return; }
    this.busy++;
    try { await this._render(p); } finally {
      this.busy--;
      this.queue?.clear();
      const cur = this.currentPage();
      this.pages.filter(q => !q.failed && !q.rendering && !(q.rendered && Math.abs(q.rendered - q.scale) < .01) && this.isNear(q))
        .sort((a, b) => Math.abs(a.n - cur) - Math.abs(b.n - cur)).slice(0, 3).forEach(q => this.renderPage(q));
    }
  }
  async _render(p) {
    p.rendering = true; p.needs = false;
    try { await this.ensurePage(p); } catch (e) { console.warn(e); p.rendering = false; p.failed = true; p.status.textContent = 'No se pudo leer la página ' + p.n; return; }
    const s = p.scale;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    // los celulares no dibujan lienzos gigantes (salen en blanco): límite de ~12 millones de píxeles
    const px = p.w * p.h * s * s;
    if (px * dpr * dpr > 12e6) dpr = Math.max(.5, Math.sqrt(12e6 / px));
    const vp = p.page.getViewport({ scale: s * dpr });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    try {
      // si una página se traba más de 25 s, se cancela y se vuelve a intentar sola (una vez)
      const task = p.page.render({ canvas: c, canvasContext: c.getContext('2d'), viewport: vp });
      let tmo; const slow = new Promise((_, rej) => { tmo = setTimeout(() => { try { task.cancel(); } catch { } rej(new Error('la página tardó demasiado')); }, 25000); });
      try { await Promise.race([task.promise, slow]); } finally { clearTimeout(tmo); }
      c.className = p.canvas.className;
      p.canvas.replaceWith(c); p.canvas = c;
      if (!p.items) await this.loadText(p);
      if (!p.textDone || p.textDoc !== this.doc) {
        p.text.innerHTML = '';
        const tl = new pdfjsLib.TextLayer({ textContentSource: p.textContent, container: p.text, viewport: p.page.getViewport({ scale: s }) });
        await tl.render();
        p.textDone = true; p.textDoc = this.doc;
      }
      p.rendered = s;
      p.status.hidden = true;
      this.drawHls(p);
      if (!this.compat && !p.checked) { p.checked = true; if (await this.looksBlank(p, c)) { p.rendering = false; return this.enterCompat(); } }
    } catch (e) {
      console.warn(e);
      if (/tardó/.test(e?.message) && !p.retried) { p.retried = true; p.rendering = false; p.status.textContent = 'Reintentando…'; return setTimeout(() => this.renderPage(p), 300); }
      if (!this.compat) { p.rendering = false; return this.enterCompat(); }
      p.status.hidden = false; p.failed = true;
      p.status.replaceChildren(h('b', {}, 'No se pudo mostrar esta página'), h('small', {}, String(e?.message || e).slice(0, 140)),
        h('button', { class: 'chip', onclick: ev => { ev.stopPropagation(); p.rendered = 0; p.failed = false; p.status.textContent = 'Reintentando…'; this.renderPage(p); } }, 'Reintentar'));
    }
    p.rendering = false;
    if (p.needs) this.renderPage(p);
  }

  // Cajas de texto en coordenadas de la página (pt), agrupadas por renglón
  async loadText(p) {
    await this.ensurePage(p);
    p.textContent = await p.page.getTextContent();
    const vp = p.page.getViewport({ scale: 1 });
    const ctx = document.createElement('canvas').getContext('2d');
    const items = [];
    for (const it of p.textContent.items) {
      if (it.str) it.str = it.str.replace(/[\ufffe\ufffd\u00ad\u200b\u2010]/g, '');
      if (!it.str || !it.str.trim()) continue;
      const tx = pdfjsLib.Util.transform(vp.transform, it.transform);
      const fh = Math.hypot(tx[2], tx[3]);
      if (Math.abs(tx[1]) > 0.2 * fh) continue; // texto girado: se ignora para el enderezado
      const x = tx[4], base = tx[5];
      const w = it.width * (vp.width / p.page.view[2] || 1) || it.str.length * fh * .5;
      ctx.font = `${fh}px sans-serif`;
      const full = ctx.measureText(it.str).width || 1;
      // posiciones de cada letra, escaladas al ancho real del texto en el PDF
      const xs = [0];
      for (let i = 1; i <= it.str.length; i++) xs.push(ctx.measureText(it.str.slice(0, i)).width / full * w);
      items.push({ str: it.str, x, w, top: base - fh * .82, bot: base + fh * .24, base, fh, xs });
    }
    // renglones
    items.sort((a, b) => a.base - b.base || a.x - b.x);
    const lines = [];
    for (const it of items) {
      const ln = lines.find(l => Math.abs(l.base - it.base) < Math.max(l.fh, it.fh) * .45);
      if (ln) { ln.items.push(it); ln.top = Math.min(ln.top, it.top); ln.bot = Math.max(ln.bot, it.bot); ln.fh = Math.max(ln.fh, it.fh); }
      else lines.push({ base: it.base, top: it.top, bot: it.bot, fh: it.fh, items: [it] });
    }
    lines.forEach(l => l.items.sort((a, b) => a.x - b.x));
    p.items = items; p.lines = lines;
  }

  // ---------- dibujo / subrayado ----------
  bindDraw(p) {
    const el = p.ink;
    let pts = null, preview = null, pid = null, panning = null;
    const kin = this.kin ||= kineticPan(this.scroller);
    const toPt = e => { const r = p.el.getBoundingClientRect(); return [(e.clientX - r.left) / p.scale, (e.clientY - r.top) / p.scale]; };
    const touches = new Map();
    el.addEventListener('pointerdown', e => {
      if (this.tool === 'select') return;
      if (e.pointerType === 'pen') this._penSeen = true;
      // herramienta Mover: el dedo y también el lápiz arrastran el PDF
      if (this.tool === 'hand') {
        if (e.pointerType === 'touch') { if (this._oneZoom || this.locked) return; touches.set(e.pointerId, [e.clientX, e.clientY]); if (touches.size >= 2) return; }
        if (e.button > 0) return;
        e.preventDefault(); panning = e.pointerId; kin.start(e); el.setPointerCapture(e.pointerId); return;
      }
      if (e.pointerType === 'touch' && this._oneZoom) return;
      if (e.pointerType === 'touch') {
        // con candado: la mano apoyada no marca nada (si usas lápiz, o si es la palma)
        if (this.locked && (this._penSeen || pid != null || (e.width || 0) > 30 || (e.height || 0) > 30)) { e.preventDefault(); return; }
        touches.set(e.pointerId, [e.clientX, e.clientY]);
        if (touches.size === 2) { // dos dedos: es un pellizco, se cancela el trazo
          if (pts) { preview?.remove(); pts = null; pid = null; }
          return;
        }
        if (this.penOnly && !this.locked) { panning = e.pointerId; kin.start(e); el.setPointerCapture(e.pointerId); return; }
      }
      if (e.button > 0) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      pid = e.pointerId;
      if (this.tool === 'eraser') { const q = toPt(e); this.eraseAt(p, q); this.eraserRing(p, q); pts = []; return; }
      pts = [toPt(e)];
      preview = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const lv = levelOf(this.level);
      const w = this.strokeW(p);
      preview.setAttribute('fill', 'none');
      preview.setAttribute('stroke', this.tool === 'pen' ? darker(lv.color) : lv.color);
      preview.setAttribute('stroke-opacity', this.tool === 'marker' ? .55 * this.alpha : this.alpha);
      preview.setAttribute('stroke-width', this.tool === 'marker' ? w * 2.6 : this.tool === 'thin' ? Math.max(.6, w) : w);
      preview.setAttribute('stroke-linecap', this.tool === 'marker' ? 'butt' : 'round');
      preview.setAttribute('stroke-linejoin', 'round');
      preview.classList.add('preview');
      p.svg.append(preview);
    });
    el.addEventListener('pointermove', e => {
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (touches.size >= 2) return;
      if (this._oneZoom && e.pointerType === 'touch') { if (panning != null) kin.cancel(); if (pts) { preview?.remove(); preview = null; pts = null; pid = null; } return; }
      if (panning != null) { if (touches.size >= 2 || this._pinching) { kin.cancel(); return; } if (e.pointerId === panning) kin.move(e); return; }
      if (!pts || e.pointerId !== pid) return;
      if (this.tool === 'eraser') { const q = toPt(e); this.eraseAt(p, q); this.eraserRing(p, q); return; }
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) pts.push(toPt(ev));
      preview.setAttribute('d', 'M' + pts.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L'));
    });
    const up = e => {
      touches.delete(e.pointerId);
      if (panning != null) { if (e.pointerId === panning) { panning = null; if (!this._pinching) kin.end(); else kin.cancel(); } return; }
      if (!pts || e.pointerId !== pid) return;
      const done = pts; pts = null; pid = null;
      preview?.remove(); preview = null; p.svg.querySelector('.er-ring')?.remove();
      if (this.tool === 'eraser' || done.length < 2) return;
      this.finishStroke(p, done);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
  strokeW(p) { const fh = p.lines?.length ? median(p.lines.map(l => l.fh)) : 11; return fh * (this.tool === 'pen' ? .2 : this.tool === 'thin' ? .06 : .42) * this.width; }

  async finishStroke(p, pts) {
    const lv = this.level;
    if (this.tool === 'pen') {
      const hl = { style: 'free', width: this.strokeW(p), pts: this.straight ? straighten(pts) : simplify(pts, .6), text: '' };
      return this.addHl(p, hl);
    }
    // ¿cubre texto? -> se ajusta a los renglones y a las palabras completas
    const snap = p.lines ? snapToText(p, pts) : null;
    if (snap && snap.text.trim()) return this.addHl(p, { style: this.tool, rects: snap.rects, text: snap.text });
    // sin texto (PDF escaneado o margen): se endereza el trazo y se lee la imagen
    const w = this.strokeW(p);
    const line = this.straight ? straighten(pts) : simplify(pts, .6);
    const band = this.tool === 'marker';
    const hl = await this.addHl(p, { style: band ? 'band' : 'free', width: band ? w * 2.6 : w, pts: line, text: '' }, { notify: false });
    if (!this.autoSum || (p.lines?.length && !snap)) return;
    // zona de la imagen a leer: alrededor del resaltado, o encima de la raya
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const lh = band ? w * 2.6 : 16;
    const box = band
      ? [Math.min(...xs) - 4, Math.min(...ys) - lh * .75, Math.max(...xs) + 4, Math.max(...ys) + lh * .75]
      : [Math.min(...xs) - 4, Math.min(...ys) - 20, Math.max(...xs) + 4, Math.max(...ys) + 2];
    this.ocrHighlight(p, hl, box);
  }

  // Lee el texto de un PDF escaneado: con Gemini si hay clave, si no con Tesseract (en el dispositivo)
  async ocrHighlight(p, hl, box) {
    const t = toast; t('Leyendo el texto del escaneo…', 1800);
    try {
      const crop = await this.cropPage(p, box);
      const st = this.settings() || {};
      let text = '';
      if (st.geminiKey) {
        try { text = await aiOcr({ key: st.geminiKey, model: st.geminiModel, dataUrl: crop.toDataURL('image/png') }); } catch (e) { console.warn(e); }
      }
      if (!text) text = await tesseractOcr(crop);
      text = (text || '').replace(/-\s*\n\s*/g, '').replace(/\s+/g, ' ').trim();
      if (!text) { t('No pude leer texto en esa zona. Prueba resaltando un renglón a la vez.', 3500); return; }
      hl.text = text; hl.ocr = 1;
      await db.put(hl); this.hls.set(hl.id, hl);
      this.cb.onHighlight?.(hl);
    } catch (e) { console.warn(e); t('No se pudo leer el escaneo: ' + e.message, 4000); }
  }
  async cropPage(p, [x0, y0, x1, y1]) {
    const S = 3.2;
    if (!p.hires) {
      await this.ensurePage(p);
      const vp = p.page.getViewport({ scale: S });
      const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      p.hires = p.page.render({ canvas: c, canvasContext: c.getContext('2d'), viewport: vp }).promise.then(() => c);
    }
    const big = await p.hires;
    x0 = clamp(x0, 0, p.w); x1 = clamp(x1, 0, p.w); y0 = clamp(y0, 0, p.h); y1 = clamp(y1, 0, p.h);
    const out = document.createElement('canvas');
    out.width = Math.max(8, Math.round((x1 - x0) * S)); out.height = Math.max(8, Math.round((y1 - y0) * S));
    const c = out.getContext('2d');
    c.fillStyle = '#fff'; c.fillRect(0, 0, out.width, out.height);
    c.drawImage(big, x0 * S, y0 * S, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  }

  async addHl(p, partial, { level = this.level, notify = true } = {}) {
    const hl = {
      id: db.uid('hl_'), kind: 'hl', pdf: this.rec.id, subject: this.rec.subject, page: p.n, level,
      notebook: this.notebookId, created: Date.now(), w: this.width, alpha: this.alpha, ...partial,
    };
    hl.y = hl.rects ? hl.rects[0][1] : Math.min(...hl.pts.map(q => q[1]));
    hl.y1 = hl.rects ? Math.max(...hl.rects.map(r => r[1] + r[3])) : Math.max(...hl.pts.map(q => q[1]));
    hl.lh = hl.rects ? hl.rects.reduce((a, r) => a + r[3], 0) / hl.rects.length : 12;
    hl.x0 = hl.rects ? hl.rects[0][0] : Math.min(...hl.pts.map(q => q[0]));
    hl.ph = p.h;
    // solo el resaltador crea títulos; las rayas y el lápiz siempre son contenido del tema
    if (hl.level === 1 && hl.style !== 'marker' && hl.style !== 'band') hl.level = 2;
    await db.put(hl);
    this.hls.set(hl.id, hl);
    this.drawHls(p);
    this.undo.push({ type: 'add', id: hl.id });
    if (notify && hl.text && this.autoSum) this.cb.onHighlight?.(hl);
    return hl;
  }
  async removeHl(id, { record = true } = {}) {
    const hl = this.hls.get(id); if (!hl) return;
    this.hls.delete(id);
    await db.remove(id);
    const p = this.pages[hl.page - 1]; if (p) this.drawHls(p);
    if (record) this.undo.push({ type: 'del', hl });
    this.cb.onHighlightRemoved?.(hl);
  }
  async doUndo() {
    const a = this.undo.pop(); if (!a) return toast('No hay nada que deshacer');
    if (a.type === 'add') await this.removeHl(a.id, { record: false });
    else {
      const hl = { ...a.hl }; delete hl.deleted;
      await db.put(hl); this.hls.set(hl.id, hl); this.drawHls(this.pages[hl.page - 1]);
      if (hl.text && this.autoSum) this.cb.onHighlight?.(hl);
    }
  }
  // el círculo muestra el tamaño del borrador
  eraserRing(p, [x, y]) {
    let c = p.svg.querySelector('.er-ring');
    if (!c) { c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('class', 'er-ring preview'); p.svg.append(c); }
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', Math.max(1.5, this.eraserW / 2 / (p.scale || 1)));
  }
  eraseAt(p, [x, y]) {
    const r0 = this.eraserW / 2 / (p.scale || 1);   // grosor del borrador en medidas de la página
    for (const hl of this.hls.values()) {
      if (hl.page !== p.n) continue;
      const hit = hl.rects ? hl.rects.some(r => x >= r[0] - r0 && x <= r[0] + r[2] + r0 && y >= r[1] - r0 && y <= r[1] + r[3] + r0)
        : hl.pts.some((q, i) => i && distSeg([x, y], hl.pts[i - 1], q) < r0 + hl.width / 2);
      if (hit) { this.removeHl(hl.id); return; }
    }
  }

  drawHls(p) {
    if (!p) return;
    p.svg.querySelectorAll(':not(.preview)').forEach(n => n.remove());
    const NS = 'http://www.w3.org/2000/svg';
    for (const hl of this.hls.values()) {
      if (hl.page !== p.n) continue;
      const lv = levelOf(hl.level);
      const g = document.createElementNS(NS, 'g');
      g.dataset.id = hl.id;
      if (hl.rects) for (const [x, y, w, hh] of hl.rects) {
        if (hl.style === 'underline' || hl.style === 'thin') {
          const l = document.createElementNS(NS, 'line');
          l.setAttribute('x1', x); l.setAttribute('x2', x + w); l.setAttribute('y1', y + hh + .6); l.setAttribute('y2', y + hh + .6);
          l.setAttribute('stroke', lv.color); l.setAttribute('stroke-width', hl.style === 'thin' ? Math.max(.35, hh * .035 * (hl.w ?? 1)) : Math.max(.8, hh * .1 * (hl.w ?? this.width ?? 1))); l.setAttribute('stroke-linecap', 'round');
          if (hl.alpha != null) l.setAttribute('stroke-opacity', hl.alpha);
          g.append(l);
        } else {
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x - 1); r.setAttribute('y', y + hh * .04); r.setAttribute('width', w + 2); r.setAttribute('height', hh * .96);
          r.setAttribute('rx', hh * .18); r.setAttribute('class', 'mk');
          if (hl.alpha != null) { r.setAttribute('fill', lv.color); r.setAttribute('fill-opacity', .55 * hl.alpha); } else r.setAttribute('fill', lv.soft);
          if (hl.w != null && hl.w !== 1) { const k = clamp(hl.w, .4, 2.2), nh = hh * .96 * Math.min(1.25, .55 + .45 * k); r.setAttribute('y', y + hh * .52 - nh / 2); r.setAttribute('height', nh); }
          g.append(r);
        }
      }
      else if (hl.pts) {
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', 'M' + hl.pts.map(q => q[0] + ' ' + q[1]).join('L'));
        path.setAttribute('fill', 'none');
        if (hl.alpha != null) { path.setAttribute('stroke', hl.style === 'free' ? darker(lv.color) : lv.color); path.setAttribute('stroke-opacity', hl.style === 'band' ? .55 * hl.alpha : hl.alpha); }
        else path.setAttribute('stroke', hl.style === 'band' ? lv.soft : lv.color);
        path.setAttribute('stroke-width', hl.width);
        path.setAttribute('stroke-linecap', hl.style === 'band' ? 'butt' : 'round');
        path.setAttribute('stroke-linejoin', 'round');
        g.append(path);
      }
      p.svg.append(g);
    }
  }

  // ---------- selección de texto ----------
  buildSelBar() {
    this.selBar = h('div', { class: 'selbar leather-chip', hidden: true },
      ...LEVELS.map(l => h('button', { class: 'lvl-dot', style: { '--c': l.color }, title: 'Subrayar como: ' + l.name, onclick: () => this.highlightSelection(l.n) })),
      h('span', { class: 'selbar-txt' }, 'Subrayar'));
    this.root.append(this.selBar);
  }
  updateSelBar() {
    if (this.tool !== 'select') { this.selBar.hidden = true; return; }
    const s = document.getSelection();
    if (!s || s.isCollapsed || !this.pagesEl.contains(s.anchorNode)) { this.selBar.hidden = true; return; }
    const r = s.getRangeAt(0).getBoundingClientRect();
    const box = this.root.getBoundingClientRect();
    this.selBar.hidden = false;
    this.selBar.style.left = clamp(r.left - box.left + r.width / 2 - 110, 6, box.width - 230) + 'px';
    this.selBar.style.top = Math.max(6, r.top - box.top - 52) + 'px';
  }
  async highlightSelection(level) {
    const s = document.getSelection();
    if (!s || s.isCollapsed) return;
    const range = s.getRangeAt(0);
    const rects = [...range.getClientRects()];
    const byPage = new Map();
    for (const r of rects) {
      if (r.width < 1) continue;
      const p = this.pages.find(pp => { const b = pp.el.getBoundingClientRect(); return r.top + r.height / 2 >= b.top && r.top + r.height / 2 <= b.bottom; });
      if (!p) continue;
      const b = p.el.getBoundingClientRect();
      const box = [(r.left - b.left) / p.scale, (r.top - b.top) / p.scale, r.width / p.scale, r.height / p.scale];
      (byPage.get(p) || byPage.set(p, []).get(p)).push(box);
    }
    const text = s.toString().replace(/\s+/g, ' ').trim();
    s.removeAllRanges();
    this.selBar.hidden = true;
    let first = true;
    for (const [p, list] of byPage) {
      await this.addHl(p, { style: 'marker', rects: mergeRects(list), text: first ? text : '' }, { level });
      first = false;
    }
  }

  // ---------- círculo de herramientas ----------
  buildDial() {
    const dial = h('div', { class: 'dial', 'data-open': '0' });
    const core = h('button', { class: 'dial-core leather-btn', 'aria-label': 'Herramientas del PDF', title: 'Herramientas (arrástralo para moverlo)' });
    const ring = h('div', { class: 'dial-ring' });
    TOOLS.forEach(t => {
      const b = h('button', { class: 'dial-item', title: t.name, 'aria-label': t.name, 'data-nodrag': '', 'data-tool': t.k, html: icon(t.icon, 20), onclick: () => { this.tool = t.k; this.applyTool(); } });
      ring.append(b);
    });
    const panel = h('div', { class: 'dial-panel leather-panel', 'data-nodrag': '' },
      h('div', { class: 'dp-title' }, 'Color según importancia'),
      h('div', { class: 'dp-levels' }, ...LEVELS.map(l => h('button', { class: 'lvl', 'data-l': l.n, style: { '--c': l.color }, onclick: () => { this.level = l.n; this.applyTool(); } }, h('i'), l.short))),
      h('label', { class: 'dp-row' }, 'Grosor', this.wIn = h('input', { type: 'range', min: '0.5', max: '2', step: '0.1', value: this.width, oninput: e => { this.width = +e.target.value; this.saveTool(); } })),
      this.tg('straight', 'Enderezar trazos', 'Los subrayados se ajustan solos al renglón'),
      this.tg('penOnly', 'Solo lápiz dibuja', 'El dedo desplaza la página y el lápiz subraya'),
      this.tg('autoSum', 'Pasar al cuaderno', 'Lo que subrayas se resume en el cuaderno'),
      h('div', { class: 'dp-actions' },
        h('button', { class: 'chip', onclick: () => this.doUndo(), html: icon('undo', 18) + 'Deshacer' }),
        h('button', { class: 'chip', onclick: () => this.setZoom(this.zoom * 1.2), html: icon('zoomin', 18) }),
        h('button', { class: 'chip', onclick: () => this.setZoom(this.zoom / 1.2), html: icon('zoomout', 18) }),
      ),
    );
    core.innerHTML = `<span class="core-ic">${icon('marker', 24)}</span><span class="core-dot"></span>`;
    core.addEventListener('click', () => { if (dial.dataset.justMoved) return; dial.dataset.open = dial.dataset.open === '1' ? '0' : '1'; this.placePanel(); });
    dial.append(ring, core, panel);
    this.root.append(dial);
    this.dial = dial; this.core = core; this.panel = panel;
    dial.style.left = '14px'; dial.style.top = '45%';
    makeDraggable(dial, core, { key: 'dialPos', bounds: () => this.root });
    this.placePanel();
  }
  // Las herramientas se abren en semicírculo hacia el lado con espacio
  placePanel() {
    const r = this.dial.getBoundingClientRect(), b = this.root.getBoundingClientRect();
    const left = r.left - b.left > b.width / 2, up = r.top - b.top > b.height / 2;
    this.panel.classList.toggle('left', left);
    this.panel.classList.toggle('up', up);
    const items = [...this.dial.querySelectorAll('.dial-item')];
    items.forEach((it, i) => {
      const deg = -90 + i * (180 / (items.length - 1));
      const a = deg * Math.PI / 180;
      it.style.setProperty('--dx', (left ? -1 : 1) * Math.cos(a) * 74 + 'px');
      it.style.setProperty('--dy', Math.sin(a) * 74 + 'px');
    });
    // que el panel no se salga de la mitad del PDF
    this.panel.style.setProperty('--py', '0px');
    requestAnimationFrame(() => {
      if (this.dial.dataset.open !== '1') return;
      const pr = this.panel.getBoundingClientRect();
      let dy = 0;
      if (pr.bottom > b.bottom - 8) dy = b.bottom - 8 - pr.bottom;
      if (pr.top + dy < b.top + 8) dy = b.top + 8 - pr.top;
      this.panel.style.setProperty('--py', dy + 'px');
    });
  }
  tg(key, label, hint) {
    const inp = h('input', { type: 'checkbox', onchange: e => { this[key] = e.target.checked; this.saveTool(); this.applyTool(); } });
    inp.checked = this[key];
    return h('label', { class: 'dp-tg', title: hint }, inp, h('span', { class: 'sw' }), label);
  }
  applyTool() {
    this.saveTool();
    const lv = levelOf(this.level);
    this.root.dataset.tool = this.tool;
    this.root.classList.toggle('pen-only', this.penOnly);
    this.core.style.setProperty('--c', lv.color);
    this.core.querySelector('.core-ic').innerHTML = icon(TOOLS.find(t => t.k === this.tool).icon, 24);
    this.dial.querySelectorAll('.dial-item').forEach(b => b.classList.toggle('on', b.dataset.tool === this.tool));
    this.panel.querySelectorAll('.lvl').forEach(b => b.classList.toggle('on', +b.dataset.l === this.level));
    if (this.tool !== 'select') document.getSelection()?.removeAllRanges();
  }

  // PDF con los subrayados "impresos", para descargar
  async exportAnnotated() {
    const { PDFDocument, rgb } = window.PDFLib;
    const bytes = await (await db.getBlob(this.rec.blob)).arrayBuffer();
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = doc.getPages();
    const hex = c => { const n = parseInt(c.slice(1), 16); return rgb((n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255); };
    for (const hl of this.hls.values()) {
      const pg = pages[hl.page - 1]; if (!pg) continue;
      const { width: W, height: H } = pg.getSize();
      const box = pg.getCropBox ? pg.getCropBox() : { x: 0, y: 0 };
      const sx = W / this.pages[hl.page - 1].w, sy = H / this.pages[hl.page - 1].h;
      const c = hex(levelOf(hl.level).color);
      if (hl.rects) for (const [x, y, w, hh] of hl.rects) {
        if (hl.style === 'underline' || hl.style === 'thin') pg.drawLine({ start: { x: box.x + x * sx, y: box.y + H - (y + hh) * sy }, end: { x: box.x + (x + w) * sx, y: box.y + H - (y + hh) * sy }, thickness: hl.style === 'thin' ? .5 : 1.2, color: c });
        else pg.drawRectangle({ x: box.x + x * sx, y: box.y + H - (y + hh) * sy, width: w * sx, height: hh * sy, color: c, opacity: hl.alpha != null ? .55 * hl.alpha : .35 });
      } else if (hl.pts) for (let i = 1; i < hl.pts.length; i++) {
        const a = hl.pts[i - 1], b = hl.pts[i];
        pg.drawLine({ start: { x: box.x + a[0] * sx, y: box.y + H - a[1] * sy }, end: { x: box.x + b[0] * sx, y: box.y + H - b[1] * sy }, thickness: hl.width * sx, color: c, opacity: hl.style === 'band' ? (hl.alpha != null ? .55 * hl.alpha : .35) : (hl.alpha ?? 1) });
      }
    }
    return new Blob([await doc.save()], { type: 'application/pdf' });
  }

  destroy() {
    this.io?.disconnect(); this.ro?.disconnect();
    document.removeEventListener('selectionchange', this.onSel);
    try { this.task?.destroy(); } catch { }
  }
}

// ---------- geometría ----------
function median(a) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 11; }
function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1;
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l, 0, 1);
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
function simplify(pts, tol) {
  const out = [pts[0]];
  for (const q of pts) { const l = out[out.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) > tol) out.push(q.map(v => +v.toFixed(1))); }
  return out;
}
// Endereza: si el trazo es casi horizontal queda una línea perfecta a su altura media;
// si no, una recta del inicio al final.
export function straighten(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const dx = Math.max(...xs) - Math.min(...xs), dy = Math.max(...ys) - Math.min(...ys);
  const r = v => +v.toFixed(1);
  if (dy < dx * .35) { const y = ys.reduce((a, b) => a + b, 0) / ys.length; return [[r(Math.min(...xs)), r(y)], [r(Math.max(...xs)), r(y)]]; }
  if (dx < dy * .35) { const x = xs.reduce((a, b) => a + b, 0) / xs.length; return [[r(x), r(Math.min(...ys))], [r(x), r(Math.max(...ys))]]; }
  return [pts[0].map(r), pts[pts.length - 1].map(r)];
}
function mergeRects(list) {
  list.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const out = [];
  for (const r of list) {
    const l = out[out.length - 1];
    if (l && Math.abs(l[1] - r[1]) < r[3] * .5 && r[0] <= l[0] + l[2] + r[3]) {
      const x0 = Math.min(l[0], r[0]), x1 = Math.max(l[0] + l[2], r[0] + r[2]);
      const y0 = Math.min(l[1], r[1]), y1 = Math.max(l[1] + l[3], r[1] + r[3]);
      l[0] = x0; l[2] = x1 - x0; l[1] = y0; l[3] = y1 - y0;
    } else out.push([...r]);
  }
  return out.map(r => r.map(v => +v.toFixed(2)));
}

// Ajusta un trazo libre a los renglones de texto que toca, completando palabras
export function snapToText(p, pts) {
  const lines = p.lines;
  if (!lines?.length) return null;
  const hits = new Map();
  for (const [x, y] of pts) {
    let best = null, bd = Infinity;
    for (const l of lines) {
      const pad = (l.bot - l.top) * .55;
      if (y < l.top - pad || y > l.bot + pad) continue;
      const d = Math.abs(y - (l.top + l.bot) / 2);
      if (d < bd) { bd = d; best = l; }
    }
    if (!best) continue;
    const r = hits.get(best) || hits.set(best, { x0: x, x1: x, n: 0 }).get(best);
    r.x0 = Math.min(r.x0, x); r.x1 = Math.max(r.x1, x); r.n++;
  }
  // descarta renglones rozados apenas por el inicio o final del trazo
  const chosen = [...hits.entries()].filter(([, r]) => r.n >= 2 && r.x1 - r.x0 > 2).sort((a, b) => a[0].top - b[0].top);
  if (!chosen.length) return null;
  const rects = [], texts = [];
  for (const [l, r] of chosen) {
    let x0 = Infinity, x1 = -Infinity, txt = '';
    for (const it of l.items) {
      if (it.x + it.w < r.x0 || it.x > r.x1) continue;
      let a = 0, b = it.str.length;
      while (a < b && it.x + it.xs[a + 1] <= r.x0) a++;
      while (b > a && it.x + it.xs[b - 1] >= r.x1) b--;
      // extiende a palabras completas
      while (a > 0 && /\S/.test(it.str[a - 1])) a--;
      while (b < it.str.length && /\S/.test(it.str[b])) b++;
      if (b <= a) continue;
      const seg = it.str.slice(a, b);
      if (!seg.trim()) continue;
      x0 = Math.min(x0, it.x + it.xs[a]); x1 = Math.max(x1, it.x + it.xs[b]);
      txt += (txt && !/\s$/.test(txt) && !/^\s/.test(seg) ? ' ' : '') + seg;
    }
    if (x1 > x0) { rects.push([+x0.toFixed(2), +l.top.toFixed(2), +(x1 - x0).toFixed(2), +(l.bot - l.top).toFixed(2)]); texts.push(txt.trim()); }
  }
  // une palabras cortadas con guion al final del renglón
  const text = texts.reduce((acc, t) => acc ? (acc.endsWith('-') ? acc.slice(0, -1) + t : acc + ' ' + t) : t, '');
  return { rects, text };
}
