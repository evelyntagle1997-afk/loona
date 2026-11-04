// La rueda: reemplaza todas las barras de la vista de estudio.
// Queda medio escondida en un borde; se gira con el dedo para ver el resto,
// y cada herramienta abre círculos pequeños con sus opciones.
import { h, icon, LEVELS, levelOf, INKS, toast, clamp } from './ui.js';
import { TAPE_PATTERNS, TAPE_COLORS, tapeStyle } from './tapes.js';
import { STYLES } from './fonts.js';
import { openMiniKb, toggleMiniKb, miniKbOpen, sysKeyboard, setSysKeyboard, applyKbMode } from './minikb.js';
import { AMBIENTS, play as ambPlay, stop as ambStop, playing as ambPlaying, setVolume as ambVol, volume as ambVolume, onAmbient } from './ambient.js';

const R = 128;          // radio del anillo de herramientas
const RS = R + 64;      // radio del anillo de opciones
const D = 2 * (R + 34); // diámetro del disco
const PEN_COLORS = ['#F4F1EE', '#D9D5D7', '#B2ADB0', '#8A8588', '#2A2729', '#0D0C0D', '#C77A3A', '#E6B98A', '#BFC6C9', '#FFFFFF'];
const PEN_SIZES = { pen: [1.5, 3, 5], brush: [5, 9, 16], marker: [12, 18, 28], pencil: [1.5, 2.5, 4], glitter: [10, 16, 26], write: [1.8, 2.6, 4] };

export class Wheel {
  constructor(host, { scope, pv, nb, act, side }) {
    // una rueda por área: la del PDF solo edita el PDF; la del cuaderno, el cuaderno
    this.host = host; this.scope = scope; this.act = act;
    this.pv = scope === 'pdf' ? pv : null; this.nb = scope === 'nb' ? nb : null;
    this.key = 'wheel3-' + scope;
    const s = (() => { try { return JSON.parse(localStorage.getItem(this.key)) || {}; } catch { return {}; } })();
    this.side = s.side || side || (scope === 'pdf' ? 'left' : 'right'); this.y = s.y ?? .5; this.mode = 'min'; this.rot = s.rot || 0;
    this.lastPane = scope;
    this.items = this.defs();
    this.build();
    this.layout(false);
    this.ro = new ResizeObserver(() => this.layout(false)); this.ro.observe(host);
  }
  save() { localStorage.setItem(this.key, JSON.stringify({ side: this.side, y: this.y, mode: this.mode, rot: this.rot })); }

  // ---------- herramientas del anillo ----------
  defs() {
    const pv = this.pv, nb = this.nb, A = this.act;
    const out = [];
    // Rueda ordenada y liviana: pocos botones grandes; lo demás va dentro, agrupado por tema.
    //   PDF: Marcar · Borrar · Mover/leer · Página · Candado | Deshacer · Intercambiar · Vista
    //   Cuaderno: Seleccionar · Escribir · Marcadores · Borrador · Texto · Decorar | Deshacer · Rehacer · Hoja · Intercambiar · Vista
    const colorGroup = (cur, list, set, name = 'Colores') => ({ color: cur, name, group: 1, sub: () => list.map(c => ({ color: c, name: 'Color', on: cur === c, run: () => set(c), keep: 1 })) });
    if (pv) {
      const pdfTool = (k, ic, name, sub) => ({ k: 'pdf-' + k, icon: ic, name, sub, active: () => pv.tool === k, run: () => { pv.tool = k; pv.applyTool(); this.lastPane = 'pdf'; } });
      const pdfSub = () => [
        ...LEVELS.map(l => ({ color: l.color, label: String(l.n), name: l.name, on: pv.level === l.n, run: () => { pv.level = l.n; pv.applyTool(); } })),
        ...[[.6, 'Fino'], [1, 'Medio'], [1.6, 'Grueso']].map(([w, n], i) => ({ size: 6 + i * 5, name: 'Grosor ' + n, on: Math.abs(pv.width - w) < .05, run: () => { pv.width = w; pv.saveTool(); } })),
        { icon: 'sliders', name: 'Ajustes: grosor, intensidad y opciones', group: 1, sub: () => [
          { icon: 'sliders', name: 'Grosor e intensidad a tu gusto', run: () => this.slidersCard('Grosor e intensidad', [
            { label: 'Grosor', min: .3, max: 3, step: .05, value: pv.width, set: v => { pv.width = v; pv.saveTool(); } },
            { label: 'Intensidad', min: .15, max: 1, step: .05, value: pv.alpha, set: v => { pv.alpha = v; pv.saveTool(); } },
          ]) },
          ...this.pdfToggles(),
        ] },
      ];
      const marcar = [
        pdfTool('marker', 'marker', 'Resaltar', pdfSub), pdfTool('underline', 'underline', 'Subrayar con línea', pdfSub),
        pdfTool('thin', 'thin', 'Raya finita', pdfSub), pdfTool('pen', 'pen', 'Lápiz libre', pdfSub),
      ];
      out.push(
        this.family('pdf-marcar', 'Marcar el PDF (resaltar, subrayar, raya finita, lápiz)', 'marcar', 'pdf', marcar, () => levelOf(pv.level).color),
        { k: 'pdf-eraser', cat: 'marcar', group: 'pdf', tool: true, icon: 'eraser', name: 'Borrar subrayado', active: () => pv.tool === 'eraser', run: () => { pv.tool = 'eraser'; pv.applyTool(); this.lastPane = 'pdf'; }, sub: () => [
          ...[[6, 'fino'], [14, 'mediano'], [30, 'grueso']].map(([w, n], i) => ({ size: 6 + i * 5, name: 'Borrador ' + n, on: pv.eraserW === w, run: () => { pv.eraserW = w; pv.saveTool(); } })),
          { icon: 'sliders', name: 'Grosor del borrador a tu gusto', run: () => this.slidersCard('Grosor del borrador', [{ label: 'Grosor', min: 2, max: 80, step: 1, value: pv.eraserW, set: v => { pv.eraserW = v; pv.saveTool(); } }]) },
        ] },
        this.family('pdf-leer', 'Leer: mover el PDF o seleccionar texto', 'leer', 'pdf', [
          pdfTool('hand', 'hand', 'Mover el PDF (dedo o lápiz)', () => this.pdfToggles()),
          pdfTool('select', 'select', 'Seleccionar texto del PDF', null),
        ]),
        { k: 'pdf-page', cat: 'leer', group: 'pdf', icon: 'page', name: 'Ir a una página (escribe el número)', onOpen: () => this.pageCard(pv), sub: () => [
          { icon: 'chevL', name: 'Página anterior', run: () => pv.goToPage(pv.curPage() - 1) },
          { label: String(pv.curPage()), name: 'Escribir el número de página', on: 1, run: () => this.pageCard(pv) },
          { icon: 'chevR', name: 'Página siguiente', run: () => pv.goToPage(pv.curPage() + 1) },
        ] },
        { k: 'pdf-crop', cat: 'leer', group: 'pdf', icon: 'scissors', name: 'Recortar una imagen del PDF al cuaderno', run: () => A.cropImage() },
        { k: 'pdf-solve', cat: 'leer', group: 'pdf', icon: 'calc', name: 'Resolver paso a paso un problema del PDF (marca la zona)', run: () => A.solve({ crop: true }) },
        { k: 'pdf-lock', cat: 'leer', group: 'pdf', icon: 'lock', name: 'Bloquear / desbloquear la página (apoyar la mano)', active: () => pv.locked, run: () => { pv.setLocked(!pv.locked); this.refresh(); } },
      );
    }
    if (nb) {
      const penSub = k => () => [
        colorGroup(nb.pen[k].c, [...PEN_COLORS, ...INKS.filter(c => !PEN_COLORS.includes(c))].slice(0, 16), c => { nb.pen[k].c = c; nb.saveTool(); nb.renderOpts(); this.refresh(); }),
        ...PEN_SIZES[k].map((w, i) => ({ size: 5 + i * 5, name: 'Grosor ' + w, on: nb.pen[k].w === w, run: () => { nb.pen[k].w = w; nb.saveTool(); nb.renderOpts(); this.refresh(); } })),
        { icon: 'sliders', name: 'Grosor e intensidad a tu gusto', run: () => this.slidersCard('Grosor e intensidad', [
          { label: 'Grosor', min: ['marker', 'glitter'].includes(k) ? 4 : .5, max: ['marker', 'glitter'].includes(k) ? 48 : k === 'brush' ? 30 : 14, step: .5, value: nb.pen[k].w, set: v => { nb.pen[k].w = v; nb.saveTool(); this.refresh(); } },
          { label: 'Intensidad', min: .1, max: 1, step: .05, value: nb.pen[k].a ?? 1, set: v => { nb.pen[k].a = v; nb.saveTool(); } },
        ]) },
        { icon: 'hand', name: 'Solo el lápiz dibuja (el dedo mueve)', on: nb.penOnly, run: () => { nb.penOnly = !nb.penOnly; nb.saveTool(); nb.updateRail(); }, keep: 1 },
      ];
      const nbTool = (k, ic, name, sub) => ({ k, icon: ic, name, sub, active: () => nb.tool === k, run: () => { nb.setTool(k); this.lastPane = 'nb'; } });
      out.push(
        { k: 'nb-select', cat: 'elegir', group: 'nb', icon: 'cursor', name: 'Seleccionar, mover y girar', tool: true, active: () => nb.tool === 'select', run: () => { nb.setTool('select'); this.lastPane = 'nb'; }, sub: () => this.selSub() },
        this.family('nb-escribir', 'Escribir y dibujar (estilógrafo, pincel, lápiz, a mano → letra)', 'tinta', 'nb', [
          nbTool('pen', 'pen', 'Estilógrafo', penSub('pen')),
          nbTool('brush', 'brush', 'Pincel de lettering', penSub('brush')),
          nbTool('pencil', 'pencil', 'Lápiz grafito', penSub('pencil')),
          nbTool('write', 'handwrite', 'Escribir a mano → letra bonita', () => this.hwSub()),
        ], () => { const t = ['pen', 'brush', 'pencil', 'write'].includes(nb.tool) ? nb.tool : 'pen'; return nb.pen[t]?.c; }),
        this.family('nb-marcar', 'Marcadores (normal y con escarcha)', 'tinta', 'nb', [
          nbTool('marker', 'marker', 'Marcador', penSub('marker')),
          nbTool('glitter', 'glitter', 'Marcador con escarcha', penSub('glitter')),
        ], () => nb.pen[nb.tool === 'glitter' ? 'glitter' : 'marker'].c),
        { k: 'nb-eraser', cat: 'tinta', group: 'nb', tool: true, icon: 'eraser', name: 'Borrador', active: () => nb.tool === 'eraser', run: () => { nb.setTool('eraser'); this.lastPane = 'nb'; }, sub: () => [
          { icon: nb.protectText ? 'shield' : 'unlock', name: nb.protectText ? 'Letras protegidas: toca para poder borrarlas' : 'Las letras se pueden borrar (toca para protegerlas)', on: nb.protectText, run: () => { nb.setProtect(!nb.protectText); this.refresh(); }, keep: 1 },
          ...[[4, 'fino'], [10, 'mediano'], [26, 'grueso']].map(([w, n], i) => ({ size: 6 + i * 5, name: 'Borrador ' + n, on: nb.eraserW === w, run: () => nb.setEraserW(w) })),
          { icon: 'sliders', name: 'Grosor del borrador a tu gusto', run: () => this.slidersCard('Grosor del borrador', [{ label: 'Grosor', min: 2, max: 80, step: 1, value: nb.eraserW, set: v => nb.setEraserW(v) }]) },
        ] },
        {
          // con un texto elegido, cambia ESE texto (no suelta la selección)
          k: 'nb-text', cat: 'decorar', group: 'nb', tool: true, icon: 'text', name: 'Texto y lettering', sub: () => this.textSub(),
          active: () => nb.tool === 'text' || (nb.tool === 'select' && ['text', 'block', 'summary'].includes(nb.sel?.el.type) && this.open?.k === 'nb-text'),
          run: () => { if (!['text', 'block', 'summary'].includes(nb.sel?.el.type)) nb.setTool('text'); this.lastPane = 'nb'; },
        },
        {
          k: 'nb-insert', cat: 'decorar', group: 'nb', icon: 'sticker', name: 'Decorar: cintas, stickers, fotos, bloques y plantillas', active: () => nb.tool === 'tape', sub: () => [
            { icon: 'tape', name: 'Cinta washi (pasa el lápiz)', on: nb.tool === 'tape', run: () => { nb.setTool('tape'); this.lastPane = 'nb'; }, group: 1, sub: () => [
              ...TAPE_PATTERNS.map(p => ({ tape: p, name: 'Cinta ' + p, on: nb.tape.pattern === p, run: () => { nb.tape.pattern = p; nb.saveTool(); } })),
              colorGroup(TAPE_COLORS.find(c => c.k === nb.tape.color)?.bg, TAPE_COLORS.map(c => c.bg), bg => { nb.tape.color = TAPE_COLORS.find(c => c.bg === bg).k; nb.saveTool(); }, 'Color de la cinta'),
              { icon: 'sliders', name: 'Ancho de la cinta a tu gusto', run: () => this.slidersCard('Ancho de la cinta', [{ label: 'Ancho', min: 14, max: 60, step: 1, value: nb.tape.w, set: v => { nb.tape.w = v; nb.saveTool(); } }]) },
            ] },
            { icon: 'sticker', name: 'Stickers', run: () => nb.stickerDrawer() },
            { icon: 'image', name: 'Foto', run: () => nb.addImage() },
            { icon: 'blocks', name: 'Bloques de diseño', run: () => nb.blockDrawer() },
            { icon: 'tpl', name: 'Plantillas de estudio (esquemas)', run: () => nb.templateDrawer() },
          ],
        },
      );
    }
    if (nb) out.push({ k: 'nb-transform', cat: 'resolver', group: 'nb', icon: 'tpl', name: 'Transformar mi texto con plantilla (eliges cómo se ve)', run: () => nb.transformDrawer() });
    if (nb) out.push({ k: 'nb-solve', cat: 'resolver', group: 'nb', icon: 'calc', name: 'Resolver matemáticas paso a paso', run: () => A.solve({}) },
      { k: 'nb-rec', cat: 'resolver', group: 'nb', icon: 'mic', name: 'Grabar la clase (la IA la transcribe y la resume)', run: () => A.record() });
    out.push({ k: 'loona-talk', cat: 'resolver', group: 'all', icon: 'moon', name: 'Hablar con Loona (música, temporizador, dudas)', run: () => import('./loona.js').then(m => m.callLoona()) });
    out.push(
      // flechas
      { k: 'undo', cat: 'flechas', group: 'all', icon: 'undo', name: 'Deshacer', run: () => pv ? pv.doUndo() : nb.undo() },
      ...(nb ? [{ k: 'redo', cat: 'flechas', group: 'all', icon: 'redo', name: 'Rehacer', run: () => nb.redo() }] : []),
    );
    if (nb) out.push(this.pageItem());
    out.push(
      ...(A.hasPdf ? [{ k: 'swap', cat: 'ver', group: 'all', icon: 'swap', name: 'Intercambiar de lugar el PDF y el cuaderno', run: () => A.swapSides() }] : []),
      {
        k: 'view', cat: 'ver', group: 'all', icon: 'split', name: 'Vista: brillo, mostrar PDF, ambiente, teclado y más', sub: () => [
          nb ? { icon: 'pdf', name: A.hasPdf ? 'Mostrar u ocultar el PDF' : 'Abrir un PDF al lado', on: A.hasPdf && A.mode() !== 'nb', run: () => A.togglePdf() }
            : { icon: 'book', name: 'Mostrar u ocultar el cuaderno', on: A.mode() !== 'pdf', run: () => A.setMode(A.mode() === 'pdf' ? 'split' : 'pdf') },
          { icon: 'sun', name: 'Brillo a tu gusto', run: () => { const t = pv || nb; this.slidersCard('Brillo', [{ label: 'Brillo', min: .4, max: 1.3, step: .02, value: t.bright, set: v => t.setBright(v) }]); } },
          {
            icon: 'fire', name: 'Ambiente para estudiar (fogata, lluvia…)', on: !!ambPlaying(), group: 1, sub: () => [
              ...AMBIENTS.map(a => ({ icon: a.icon, name: a.name, on: ambPlaying() === a.k, run: () => ambPlay(a.k), keep: 1 })),
              { icon: 'sliders', name: 'Volumen a tu gusto', run: () => this.slidersCard('Volumen', [{ label: 'Volumen', min: 0, max: 1, step: .05, value: ambVolume(), set: v => ambVol(v) }]) },
              { icon: 'stop', name: 'Apagar el ambiente', run: () => ambStop(), keep: 1 },
            ],
          },
          { icon: 'music', name: 'YouTube y música (reproductor flotante)', run: () => A.music() },
          { icon: 'mic', name: 'Clases grabadas y transcripciones', run: () => A.audios() },
          { icon: 'keyboard', name: 'Teclado', group: 1, sub: () => this.kbItems() },
          {
            icon: 'fitp', name: 'Tamaño y modo de pantalla', group: 1, sub: () => [
              ...(A.hasPdf ? [
                { icon: 'pdf', name: 'Solo PDF', on: A.mode() === 'pdf', run: () => A.setMode('pdf') },
                { icon: 'split', name: 'PDF y cuaderno', on: A.mode() === 'split', run: () => A.setMode('split') },
                { icon: 'book', name: 'Solo cuaderno', on: A.mode() === 'nb', run: () => A.setMode('nb') },
                { icon: 'same', name: A.sameAuto() ? 'Mismo tamaño A4 siempre: activado (toca para quitar)' : 'PDF y hoja siempre del mismo tamaño A4', on: A.sameAuto(), run: () => A.sameSize(), keep: 1 },
              ] : []),
              ...(pv ? [{ icon: pv.fit === 'hoja' ? 'fitw' : 'fitp', name: pv.fit === 'hoja' ? 'Ajustar el PDF al ancho' : 'Ver la página del PDF completa', run: () => pv.setFit(pv.fit === 'hoja' ? 'ancho' : 'hoja'), keep: 1 }] : []),
              ...(nb ? [{ icon: nb.fit === 'ancho' ? 'fitp' : 'fitw', name: nb.fit === 'ancho' ? 'Ver la hoja A4 completa' : 'Ajustar la hoja al ancho', run: () => nb.toggleFit(), keep: 1 }] : []),
              { icon: 'full', name: 'Pantalla completa', run: () => A.fullscreen() },
            ],
          },
          ...(pv ? [{ icon: 'download', name: 'Descargar el PDF subrayado', run: () => A.exportPdf() }] : []),
          ...(nb ? [{ icon: 'ribbon', name: 'Cambiar de cuaderno', run: () => A.chooseNotebook() }] : []),
          { icon: 'back', name: 'Volver a la materia', run: () => A.back() },
        ],
      },
    );
    return out;
  }
  // varias herramientas parecidas en un solo botón (muestra la que estás usando)
  family(k, name, cat, group, tools, colorFn) {
    const key = 'fam-' + k;
    const last = () => tools.find(t => t.k === localStorage.getItem(key)) || tools[0];
    const cur = () => tools.find(t => t.active());
    return {
      k, cat, group, name, tool: true, icon: tools[0].icon, iconFn: () => (cur() || last()).icon,
      active: () => !!cur(), badge: () => colorFn ? { c: colorFn() } : null,
      run: () => { if (!cur()) last().run(); },
      sub: () => tools.map(t => ({ icon: t.icon, name: t.name, on: t.active(), run: () => { t.run(); localStorage.setItem(key, t.k); this.refresh(); }, sub: t.sub })),
    };
  }
  // Hoja del cuaderno: nueva, borrar, mover antes o después, papel, bloquear
  pageItem() {
    const nb = this.nb;
    return {
      k: 'nb-page', cat: 'hoja', group: 'nb', icon: 'page', name: 'Hoja: nueva, borrar, mover, papel y bloquear', active: () => nb.locked, sub: () => {
        const i = nb.curPageIndex(), n = nb.pages.length;
        const armed = this._delArm && this._delArm.i === i && Date.now() - this._delArm.t < 5000;
        return [
          { label: `${i + 1}/${n}`, name: `Estás en la hoja ${i + 1} de ${n}`, on: 1, run: () => { } , keep: 1 },
          { icon: 'plus', name: 'Nueva hoja después de esta', run: () => nb.addPage(i) },
          { icon: 'chevL', name: 'Mover esta hoja antes', run: () => nb.movePageTo(-1) },
          { icon: 'chevR', name: 'Mover esta hoja después', run: () => nb.movePageTo(1) },
          { icon: 'trash', danger: 1, name: armed ? `¿Seguro? Toca otra vez para borrar la hoja ${i + 1}` : `Borrar la hoja ${i + 1}`, on: armed, run: () => {
            if (armed) { this._delArm = null; nb.deletePageAt(i); }
            else { this._delArm = { i, t: Date.now() }; toast(`Toca otra vez el bote para borrar la hoja ${i + 1} con todo lo que tiene`, 3500); }
          } },
          { icon: 'lock', name: nb.locked ? 'Hoja bloqueada (toca para soltarla)' : 'Bloquear la hoja (no se mueve, sigues editando)', on: nb.locked, run: () => { nb.setLocked(!nb.locked); this.refresh(); }, keep: 1 },
          { icon: 'layers', name: 'Papel y más opciones de la hoja', run: () => nb.pageMenu() },
        ];
      },
    };
  }
  pdfToggles() {
    const pv = this.pv;
    return [
      { icon: 'straight', name: 'Enderezar trazos', on: pv.straight, run: () => { pv.straight = !pv.straight; pv.saveTool(); }, keep: 1 },
      { icon: 'hand', name: 'Solo el lápiz subraya (el dedo mueve)', on: pv.penOnly, run: () => { pv.penOnly = !pv.penOnly; pv.applyTool(); }, keep: 1 },
      { icon: 'book', name: 'Pasar lo subrayado al cuaderno', on: pv.autoSum, run: () => { pv.autoSum = !pv.autoSum; pv.saveTool(); }, keep: 1 },
    ];
  }
  // pestañas de la escritura a mano: título, subtítulo o contenido, cada una con su letra
  hwSub() {
    const nb = this.nb, k = nb.hwKind, st = nb.hwStyles[k];
    const KINDS = [['titulo', 'T', 'Título (gótico vino, nítido)'], ['subtitulo', 'St', 'Subtítulo'], ['contenido', 'Aa', 'Contenido (letra de apuntes)']];
    return [
      ...KINDS.map(([kk, lab, name]) => ({ label: lab, cls: 'hw-tab', name: 'Escribir como: ' + name, on: k === kk, run: () => { nb.setHwKind(kk); toast('Tu letra se convertirá en ' + name.toLowerCase()); }, keep: 1 })),
      { icon: 'font', name: 'Fuente para ' + { titulo: 'títulos', subtitulo: 'subtítulos', contenido: 'el contenido' }[k] + ': ' + st.font, run: () => nb.fontPicker(st.font, f => { st.font = f; nb.saveHw(); }, k) },
      ...PEN_COLORS.slice(0, 6).map(c => ({ color: c, name: 'Color', on: st.color === c, run: () => { st.color = c; nb.saveHw(); } })),
      { label: 'A−', name: 'Letra más pequeña', run: () => { st.size = Math.max(10, Math.round(st.size / 1.12)); nb.saveHw(); toast('Tamaño ' + st.size); }, keep: 1 },
      { label: 'A+', name: 'Letra más grande', run: () => { st.size = Math.min(120, Math.round(st.size * 1.12)); nb.saveHw(); toast('Tamaño ' + st.size); }, keep: 1 },
      {
        label: 'Aa', cls: 'lt-' + (st.style || 'normal'), name: 'Estilo de la letra', group: 1,
        sub: () => STYLES.map(s => ({ label: 'Aa', cls: 'lt-' + s.k, name: s.name, on: st.style === s.k, run: () => { st.style = s.k; nb.saveHw(); }, keep: 1 })),
      },
    ];
  }
  kbItems() {
    return [
      { icon: 'keyboard', name: miniKbOpen() ? 'Esconder el teclado pequeño' : 'Mostrar el teclado pequeño (angosto, se puede mover)', on: miniKbOpen(), run: () => { toggleMiniKb(); this.refresh(); }, keep: 1 },
      { icon: 'phonekb', name: sysKeyboard() ? 'Teclado del celular: activado (toca para esconderlo)' : 'Usar el teclado del celular', on: sysKeyboard(), run: () => setSysKeyboard(!sysKeyboard()), keep: 1 },
    ];
  }
  textSub() {
    const nb = this.nb;
    if (nb.sel?.el?.type === 'summary') {
      const el = nb.sel.el;
      return [
        { icon: 'font', name: 'Fuente del título: ' + (el.titleFont || nb.nb.titleFont || 'Grenze Gotisch'), run: () => nb.fontPicker(el.titleFont || 'Grenze Gotisch', f => nb.textProp('font', f), 'titulo') },
        { label: 'A−', name: 'Título más pequeño', run: () => nb.textProp('size', 1 / 1.12), keep: 1 },
        { label: 'A+', name: 'Título más grande', run: () => nb.textProp('size', 1.12), keep: 1 },
        ...this.kbItems(),
      ];
    }
    const st = ['text', 'block'].includes(nb.sel?.el?.type) ? nb.sel.el : nb.textStyle;
    const selText = ['text', 'block'].includes(nb.sel?.el?.type);
    const a = k => () => nb.selAction(k);
    return [
      { icon: 'font', name: 'Fuente: ' + (st.font || 'la del bloque'), run: () => nb.fontPicker(st.font, f => nb.textProp('font', f)) },
      {
        label: 'Aa', cls: 'lt-' + (st.style || 'normal'), name: 'Formatos de lettering', group: 1,
        sub: () => STYLES.map(s => ({ label: 'Aa', cls: 'lt-' + s.k, name: s.name, on: st.style === s.k, run: () => nb.textProp('style', s.k), keep: 1 })),
      },
      {
        color: st.color, name: 'Colores', group: 1,
        sub: () => PEN_COLORS.map(c => ({ color: c, name: 'Color', on: st.color === c, run: () => nb.textProp('color', c), keep: 1 })),
      },
      { label: 'A−', name: 'Letra más pequeña', run: () => nb.textProp('size', 1 / 1.15), keep: 1 },
      { label: 'A+', name: 'Letra más grande', run: () => nb.textProp('size', 1.15), keep: 1 },
      ...this.kbItems(),
      ...(selText ? [
        { icon: 'copy', name: 'Duplicar texto', run: a('dup'), keep: 1 },
        { icon: 'straight', name: 'Enderezar', run: a('straight'), keep: 1 },
        { icon: 'trash', name: 'Eliminar texto', danger: 1, run: a('delete') },
      ] : []),
    ];
  }
  selSub() {
    const nb = this.nb;
    if (!nb.sel) return [{ icon: 'cursor', name: 'Toca un texto, foto o sticker en la hoja para elegirlo', run: () => { } }];
    const t = nb.sel.el.type;
    const a = k => () => nb.selAction(k);
    return [
      { icon: 'straight', name: 'Enderezar', run: a('straight'), keep: 1 },
      { icon: 'plus', name: 'Agrandar', run: a('bigger'), keep: 1 },
      { icon: 'minus', name: 'Achicar', run: a('smaller'), keep: 1 },
      { icon: 'copy', name: 'Duplicar', run: a('dup') },
      { icon: 'layers', name: 'Traer al frente', run: a('front'), keep: 1 },
      ...(t === 'image' ? [{ icon: 'image', name: 'Cambiar marco', run: a('frame'), keep: 1 }] : []),
      ...(t === 'text' || t === 'block' ? [{ icon: 'font', name: 'Fuente, tamaño, estilo y color', run: () => this.openSub(this.items.find(i => i.k === 'nb-text'), true) }] : []),
      ...(t === 'summary' ? [
        { icon: 'font', name: 'Fuente y tamaño del título', run: () => this.openSub(this.items.find(i => i.k === 'nb-text'), true) },
        { icon: 'spark', name: 'Mejorar con IA', run: () => nb.aiImprove(nb.sel.el.topic, true) },
        { icon: 'bulb', name: 'Explícamelo', run: () => nb.explain(nb.sel.pg, nb.sel.el) },
        { icon: 'tpl', name: 'Convertir en mapa mental', run: () => nb.convertSummary('mapa') },
        { icon: 'timeline', name: 'Convertir en línea de tiempo', run: () => nb.convertSummary('tiempo') },
        { icon: 'copy', name: 'Convertir en tarjetas de repaso', run: () => nb.convertSummary('tarjetas') },
        { icon: 'blocks', name: 'Convertir en las 6 preguntas', run: () => nb.convertSummary('cinco') },
      ] : []),
      { icon: 'trash', name: 'Eliminar', danger: 1, run: a('delete') },
    ];
  }

  // ---------- construcción ----------
  build() {
    this.el = h('div', { class: 'wheel scope-' + this.scope + ' side-' + this.side, role: 'toolbar', 'aria-label': 'Rueda de herramientas' });
    this.disc = h('div', { class: 'wh-disc' });
    this.ring = h('div', { class: 'wh-ring' });
    this.subEl = h('div', { class: 'wh-sub' });
    this.hub = h('button', { class: 'wh-hub', 'aria-label': 'Abrir o mover la rueda' }, h('span', { class: 'hub-ic' }), h('span', { class: 'hub-dot' }));
    this.tip = h('div', { class: 'wh-tip', role: 'status' });
    this.tab = h('button', { class: 'wh-tab', 'aria-label': 'Mostrar la rueda de herramientas', title: 'Herramientas', onclick: () => { this.setMode('half'); if (this.nb?.sel && this.nb.tool === 'select') this.openSub(this.items.find(i => i.k === 'nb-select'), true); } }, h('span', { class: 'tab-ic' }), h('span', { class: 'hub-dot' }));
    this.cardEl = h('div', { class: 'wh-card leather-panel', hidden: true },
      h('div', { class: 'wh-card-head' }, h('b', {}, 'Opciones'), h('button', { class: 'icbtn', 'aria-label': 'Cerrar', html: icon('close', 18), onclick: () => this.cardEl.hidden = true })));
    if (this.nb) this.cardEl.append(this.nb.opts);
    this.el.append(this.disc, this.subEl, this.ring, this.hub);
    this.host.append(this.el, this.tab, this.tip, this.cardEl);
    this.itemEls = this.items.map(it => {
      const b = h('button', { class: 'wh-item g-' + it.group + (it.iconFn ? ' fam' : ''), 'data-k': it.k, 'aria-label': it.name, title: it.name, html: icon(it.iconFn?.() || it.icon, 21) });
      b.append(h('span', { class: 'wh-badge' }));
      this.ring.append(b);
      return b;
    });
    this.bindRing(); this.bindHub(); this.bindNames();
    this.offAmb = onAmbient(() => this.refresh());
    this.refresh();
    // al elegir algo en la hoja, la rueda ofrece sus acciones
    this.nb?.root.addEventListener('nb-select', () => {
      this.refresh();
      const id = this.nb.sel?.el.id || null;
      const changed = id !== this._selId; this._selId = id;
      if (!changed) { if (this.open && this.mode !== 'min') this.openSub(this.open, true); return; } // mismo elemento: mantener las opciones abiertas
      if (id && this.nb.tool === 'select' && this.mode !== 'min') this.openSub(this.items.find(i => i.k === 'nb-select'), true);
      else if (!id && (this.open?.k === 'nb-select' || this.open?.k === 'nb-text')) this.closeSub();
    });
    this.host.addEventListener('pointerdown', e => {
      if (e.target.closest('.wheel, .wh-card, .wh-tab, .modal-back, .lock-btn, .toast')) return;
      // tocar un elemento para elegirlo (con Seleccionar) no esconde la rueda
      if (this.nb && this.nb.tool === 'select' && e.target.closest('.el, .sel-frame')) return;
      if (this.mode === 'min') return;
      // un toque en la hoja la esconde; solo se ignora si caíste justo al lado de un botón de la rueda
      const near = [...this.el.querySelectorAll('.wh-s, .wh-item, .wh-hub')].some(b => {
        const r = b.getBoundingClientRect();
        return e.clientX > r.left - 10 && e.clientX < r.right + 10 && e.clientY > r.top - 10 && e.clientY < r.bottom + 10;
      });
      if (near) { e.stopPropagation(); e.preventDefault(); return; }
      this.setMode('min');
    }, true);
  }

  center() {
    const W = this.host.clientWidth, H = this.host.clientHeight;
    const cy = clamp(this.y * H, 90, H - 90);
    let cx;
    const k = this.k || 1;
    if (this.mode === 'full') cx = this.side === 'left' ? (R + 44) * k : W - (R + 44) * k;
    else if (this.mode === 'half') cx = this.side === 'left' ? 0 : W;
    else cx = this.side === 'left' ? -D * k : W + D * k;
    return [cx, cy];
  }
  layout(anim = true) {
    this.k = clamp(Math.min(this.host.clientWidth, this.host.clientHeight) / 560, .6, 1); // más pequeña en el celular
    const [cx, cy] = this.center();
    this.el.classList.toggle('anim', anim);
    this.el.style.transform = `translate(${cx - D / 2}px, ${cy - D / 2}px) scale(${this.k})`;
    this.el.classList.remove('side-left', 'side-right'); this.el.classList.add('side-' + this.side);
    this.el.dataset.mode = this.mode;
    this.tab.className = 'wh-tab side-' + this.side + (this.mode === 'min' ? ' show' : '');
    this.tab.style.top = cy - 30 + 'px';
    this.placeItems(anim);
  }
  // ángulo (en grados) de cada botón: los del mismo grupo van juntos y entre grupos queda un espacio
  baseAngles() {
    const GAP = .55, its = this.items;
    const pos = []; let u = 0;
    its.forEach((it, i) => { if (i && it.cat !== its[i - 1].cat) u += GAP; pos.push(u); u += 1; });
    if (its.length > 1 && its[0].cat !== its.at(-1).cat) u += GAP;
    return pos.map(x => x * 360 / u);
  }
  angles() { return this.baseAngles().map(a => (a + this.rot) * Math.PI / 180); }
  placeItems(anim) {
    this.ring.classList.toggle('anim', !!anim);
    const ang = this.angles();
    this.itemEls.forEach((b, i) => {
      b.style.transform = `translate(${D / 2 + Math.cos(ang[i]) * R - 24}px, ${D / 2 + Math.sin(ang[i]) * R - 24}px)`;
    });
  }
  refresh() {
    let hubIt = null;
    this.items.forEach((it, i) => {
      const b = this.itemEls[i];
      const on = it.active?.();
      b.classList.toggle('on', !!on);
      if (on && (!hubIt || it.group === this.lastPane)) hubIt = it;
      if (it.iconFn) { const ic = it.iconFn(); if (b.dataset.ic !== ic) { b.dataset.ic = ic; b.querySelector('svg')?.remove(); b.insertAdjacentHTML('afterbegin', icon(ic, 21)); } }
      const bd = it.badge?.();
      const badge = b.querySelector('.wh-badge');
      badge.hidden = !bd;
      if (bd) { badge.style.setProperty('--c', bd.c); badge.textContent = bd.n ? Math.round(bd.n) : ''; }
    });
    const hub = hubIt || this.items[0];
    const hic = hub.iconFn?.() || hub.icon;
    this.hub.querySelector('.hub-ic').innerHTML = icon(hic, 26);
    const bd = hub.badge?.();
    this.hub.querySelector('.hub-dot').style.setProperty('--c', bd?.c || 'transparent');
    this.tab.querySelector('.tab-ic').innerHTML = icon(hic, 20);
    this.tab.querySelector('.hub-dot').style.setProperty('--c', bd?.c || 'transparent');
  }

  // ---------- nombre de cada botón ----------
  // Lápiz (S Pen) pasando por encima: muestra el nombre. Dedo: mantener apretado muestra el nombre sin activarlo.
  bindNames() {
    const btnAt = e => e.target.closest?.('.wh-item, .wh-s, .wh-hub, .wh-tab');
    const name = b => b?.getAttribute('aria-label') || b?.title || '';
    const noHover = matchMedia('(hover: none)').matches;
    let hov = null;
    const over = e => {
      if (e.pointerType === 'touch' || (e.pointerType === 'mouse' && !noHover)) return;   // en PC ya sale el nombre del mouse
      if (e.buttons) return;                                                            // solo al flotar, no al tocar
      const b = btnAt(e); if (b === hov) return; hov = b;
      if (b && name(b)) this.say(name(b));
    };
    for (const el of [this.el, this.tab]) {
      el.addEventListener('pointerover', over); el.addEventListener('pointermove', over);
      el.addEventListener('pointerleave', () => { hov = null; });
    }
    // mantener apretado con el dedo
    let lp = null;
    const down = e => {
      if (e.pointerType !== 'touch') return;
      const b = btnAt(e); if (!b) return;
      clearTimeout(lp?.t);
      lp = { x: e.clientX, y: e.clientY, shown: false, t: setTimeout(() => { if (lp) { lp.shown = true; this.say(name(b)); navigator.vibrate?.(8); } }, 480) };
    };
    const move = e => { if (lp && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 10) { clearTimeout(lp.t); lp = null; } };
    const up = () => { if (lp) { clearTimeout(lp.t); if (lp.shown) { this._nameOnly = true; setTimeout(() => this._nameOnly = false, 350); } lp = null; } };
    for (const el of [this.el, this.tab]) {
      el.addEventListener('pointerdown', down, true); el.addEventListener('pointermove', move, true);
      el.addEventListener('pointerup', up, true); el.addEventListener('pointercancel', up, true);
      // si solo querías ver el nombre, no se activa el botón
      el.addEventListener('click', e => { if (this._nameOnly) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    }
  }

  // ---------- girar el anillo ----------
  bindRing() {
    let st = null;
    const angAt = e => { const r = this.el.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
    this.ring.addEventListener('pointerdown', e => {
      e.preventDefault();
      this.ring.setPointerCapture(e.pointerId);
      st = { a: angAt(e), rot: this.rot, x: e.clientX, y: e.clientY, moved: false, item: e.target.closest('.wh-item') };
    });
    this.ring.addEventListener('pointermove', e => {
      if (!st) return;
      if (!st.moved && Math.hypot(e.clientX - st.x, e.clientY - st.y) < 7) return;
      if (!st.moved) { st.moved = true; this.closeSub(); }
      let d = angAt(e) - st.a; if (d > 180) d -= 360; if (d < -180) d += 360;
      st.a += d; this.rot += d;
      this.placeItems(false);
    });
    const up = () => {
      if (!st) return;
      const s = st; st = null;
      if (s.moved) { this.save(); return; }
      if (this._nameOnly) return;
      if (s.item) this.tapItem(this.items.find(i => i.k === s.item.dataset.k));
    };
    this.ring.addEventListener('pointerup', up);
    this.ring.addEventListener('pointercancel', () => { st = null; });
    this.el.addEventListener('wheel', e => { e.preventDefault(); this.closeSub(); this.rot += e.deltaY > 0 ? 12 : -12; this.placeItems(true); this.save(); }, { passive: false });
  }
  tapItem(it) {
    if (!it) return;
    this.say(it.name);
    if (it.tool) {
      it.run(); this.refresh();
      // tocar una herramienta siempre muestra sus opciones (antes, un segundo toque las cerraba y parecía que no hacía nada)
      if (it.sub) this.openSub(it, true); else this.closeSub();
      return;
    }
    if (it.sub) { this.openSub(it, true); it.onOpen?.(); return; }   // siempre abre sus opciones (no se cierran con un segundo toque)
    it.run(); this.refresh();
  }
  // Gira para que la herramienta quede de frente y abre sus opciones alrededor
  openSub(it, show = true, listFn) {
    if (!it || !show) return this.closeSub();
    if (it !== this.open) this.listFn = null;
    if (listFn) this.listFn = listFn;
    if (this.mode === 'min') this.setMode('half');
    const idx = this.items.indexOf(it);
    const front = this.side === 'left' ? 0 : 180;
    const cur = this.baseAngles()[idx] + this.rot;
    let d = ((front - cur) % 360 + 540) % 360 - 180;
    this.rot += d; this.placeItems(true); this.save();
    this.open = it;
    const subs = (this.listFn || it.sub)();
    this.subEl.innerHTML = '';
    const base = front * Math.PI / 180;
    const rows = subs.length > 11 ? [subs.slice(0, Math.ceil(subs.length / 2)), subs.slice(Math.ceil(subs.length / 2))] : [subs];
    rows.forEach((row, r) => {
      const rad = RS + r * 46;
      const step = 42 / rad;
      row.forEach((s, j) => {
        const a = base + (j - (row.length - 1) / 2) * step;
        const b = h('button', { class: 'wh-s' + (s.on ? ' on' : '') + (s.danger ? ' danger' : ''), title: s.name, 'aria-label': s.name, style: { '--x': D / 2 + Math.cos(a) * rad - 19 + 'px', '--y': D / 2 + Math.sin(a) * rad - 19 + 'px', '--d': (j * 18) + 'ms' } });
        if (s.color) { b.classList.add('col'); b.style.setProperty('--c', s.color); if (s.label) b.textContent = s.label; }
        else if (s.tape) { Object.assign(b.style, tapeStyle(s.tape, this.nb.tape.color)); b.classList.add('tp'); }
        else if (s.size) { b.append(h('i', { style: { width: s.size + 'px', height: s.size + 'px' } })); b.classList.add('sz'); }
        else if (s.icon) b.innerHTML = icon(s.icon, 18);
        else { b.textContent = s.label; if (s.cls) { b.classList.add(s.cls); b.style.setProperty('--tc', '#2A2729'); } }
        if (s.group) b.classList.add('grp');
        b.addEventListener('click', () => {
          if (s.sub) { // abre el grupo en su propio anillo
            const parent = this.listFn;
            s.run?.(); this.refresh();
            this.say(s.name);
            return this.openSub(it, true, () => [{ icon: 'back', name: 'Volver', nav: 1, run: () => this.openSub(it, true, parent || it.sub) }, ...s.sub()]);
          }
          if (s.nav) return s.run();
          s.run(); this.say(s.name); this.refresh();
          // la rueda sigue abierta; solo se esconde al tocar la hoja
          if (this.open) this.openSub(this.open, true);
        });
        this.subEl.append(b);
      });
    });
    this.el.classList.add('sub-open');
  }
  closeSub() { this.open = null; this.listFn = null; this.subEl.innerHTML = ''; this.el.classList.remove('sub-open'); }
  // tarjeta pegada a la rueda con barras para ajustar a tu gusto (grosor, intensidad, brillo, volumen…)
  slidersCard(title, rows) {
    this.card(); this.cardEl.classList.add('pg-mode');
    this.cardEl.querySelector('.wh-card-head b').textContent = title;
    this.pgBox?.remove();
    this.pgBox = h('div', { class: 'sl-box' }, ...rows.map(r => {
      const out = h('output', {}, fmt(r.value, r));
      const inp = h('input', { type: 'range', min: r.min, max: r.max, step: r.step, value: r.value, oninput: e => { r.set(+e.target.value); out.textContent = fmt(+e.target.value, r); } });
      return h('label', { class: 'sl-row' }, h('span', {}, r.label), inp, out);
    }));
    this.cardEl.append(this.pgBox);
    function fmt(v, r) { return ['Intensidad', 'Brillo', 'Volumen'].includes(r.label) ? Math.round(v * 100) + '%' : r.step < 1 ? (+v).toFixed(1) : Math.round(v); }
  }
  // número de página escrito a mano, dentro de la tarjeta de la rueda (sin ventanas aparte)
  pageCard(pv) {
    const total = pv.doc?.numPages || pv.pages.length;
    if (!total) return;
    this.card(); this.cardEl.classList.add('pg-mode');
    this.cardEl.querySelector('.wh-card-head b').textContent = 'Ir a la página';
    this.pgBox?.remove();
    const inp = h('input', { class: 'field pg-input', type: 'text', inputmode: 'numeric', enterkeyhint: 'go', autocomplete: 'off', value: pv.curPage() });
    applyKbMode(inp, true);
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 5); });
    if (!sysKeyboard() && matchMedia('(pointer: coarse)').matches) setTimeout(() => openMiniKb(true), 80);
    const go = () => { pv.goToPage(+inp.value); if (this.open) this.openSub(this.open, true); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); inp.blur(); } });
    inp.addEventListener('change', go);
    this.pgBox = h('div', { class: 'pg-box' }, inp, h('span', {}, 'de ' + total), h('button', { class: 'btn primary', onclick: go }, 'Ir'));
    this.cardEl.append(this.pgBox);
    setTimeout(() => { inp.focus(); inp.select(); }, 50);
  }
  card() {
    this.nb?.renderOpts();
    this.cardEl.classList.remove('pg-mode'); this.pgBox?.remove(); this.pgBox = null;
    const hb = this.cardEl.querySelector('.wh-card-head b'); if (hb) hb.textContent = 'Opciones';
    this.cardEl.hidden = false;
    const [cx, cy] = this.center();
    const W = this.host.clientWidth;
    this.cardEl.style.top = clamp(cy - 120, 10, this.host.clientHeight - 260) + 'px';
    if (this.side === 'left') { this.cardEl.style.left = clamp(cx + (this.mode === 'full' ? R + 40 : RS + 80), 10, W - 330) + 'px'; this.cardEl.style.right = 'auto'; }
    else { this.cardEl.style.right = clamp(W - cx + (this.mode === 'full' ? R + 40 : RS + 80), 10, W - 330) + 'px'; this.cardEl.style.left = 'auto'; }
  }
  say(t) {
    this.tip.textContent = t; this.tip.classList.add('show');
    const [cx, cy] = this.center();
    this.tip.style.top = clamp(cy - D / 2 - 6, 8, this.host.clientHeight - 40) + 'px';
    this.tip.style.left = this.side === 'left' ? Math.max(12, cx + 16) + 'px' : 'auto';
    this.tip.style.right = this.side === 'right' ? Math.max(12, this.host.clientWidth - cx + 16) + 'px' : 'auto';
    clearTimeout(this._tt); this._tt = setTimeout(() => this.tip.classList.remove('show'), 1800);
  }

  // ---------- centro: tocar = abrir/medio; arrastrar = mover de lugar o de lado ----------
  bindHub() {
    let st = null;
    this.hub.addEventListener('pointerdown', e => { e.preventDefault(); this.hub.setPointerCapture(e.pointerId); st = { x: e.clientX, y: e.clientY, moved: false, y0: this.y }; });
    this.hub.addEventListener('pointermove', e => {
      if (!st) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved && Math.hypot(dx, dy) < 8) return;
      if (!st.moved) { st.moved = true; this.closeSub(); }
      this.y = clamp(st.y0 + dy / this.host.clientHeight, .08, .92);
      const [cx, cy] = this.center();
      this.el.classList.remove('anim');
      this.el.style.transform = `translate(${cx + dx - D / 2}px, ${cy - D / 2}px) scale(${this.k || 1})`;
      st.dx = dx; st.cx = e.clientX - this.host.getBoundingClientRect().left;
    });
    const up = () => {
      if (!st) return;
      const s = st; st = null;
      if (!s.moved) { if (this._nameOnly) return; this.setMode(this.mode === 'full' ? 'half' : 'full'); return; }
      const toEdge = this.side === 'left' ? -s.dx : s.dx;
      const W = this.host.clientWidth;
      if (s.cx != null && (s.cx < W * .35 ? 'left' : s.cx > W * .65 ? 'right' : this.side) !== this.side) this.side = this.side === 'left' ? 'right' : 'left';
      else if (toEdge > 70) this.mode = 'min';
      this.save(); this.layout(true);
    };
    this.hub.addEventListener('pointerup', up);
    this.hub.addEventListener('pointercancel', up);
  }
  setSide(side) { this.side = side; this.save(); this.closeSub(); this.layout(true); }
  setMode(m) {
    this.mode = m; if (m === 'min') { this.closeSub(); this.cardEl.hidden = true; }
    this.save(); this.layout(true);
  }
  destroy() { this.offAmb?.(); this.ro?.disconnect(); this.el.remove(); this.tab.remove(); this.tip.remove(); this.cardEl.remove(); }
}
