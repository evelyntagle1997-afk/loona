// Resolver matemáticas paso a paso (ENEM): escribes, fotografías, recortas del PDF
// o escribes a mano el problema, y la IA lo explica con muchísimo detalle en el cuaderno.
import { h, icon, toast, modal, pickFile, esc } from './ui.js';
const PW = 800, PH = 1131;   // tamaño de la hoja A4 del cuaderno

const KATEX = new URL('../vendor/katex/', import.meta.url).href;   // fórmulas: guardado en la app, funciona sin internet
const SOLVE_W = 720;

// ---------- fórmulas bonitas (KaTeX) ----------
let katexP = null;
function loadKatex() {
  if (window.katex) return Promise.resolve(window.katex);
  return katexP ||= new Promise(res => {
    if (!document.querySelector('link[data-katex]')) document.head.append(h('link', { rel: 'stylesheet', href: KATEX + 'katex.min.css', 'data-katex': '1' }));
    const s = document.createElement('script'); s.src = KATEX + 'katex.min.js';
    s.onload = () => res(window.katex); s.onerror = () => { katexP = null; res(null); };
    document.head.append(s);
  });
}
// texto con $…$ y $$…$$ -> HTML con fórmulas dibujadas
function mathHtml(t, K) {
  if (t == null) return '';
  // el dinero de Brasil (R$ 80,00) no es una fórmula
  const RS = '\u0001';
  const back = x => x.split(RS).join('R$');
  const parts = String(t).replace(/R\$/g, RS).split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return parts.map(p => {
    const disp = p.startsWith('$$') && p.endsWith('$$') && p.length > 4;
    const inl = !disp && p.startsWith('$') && p.endsWith('$') && p.length > 2;
    if (!disp && !inl) return back(esc(p)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    const tex = (disp ? p.slice(2, -2) : p.slice(1, -1)).split(RS).join('\\text{R\\$}');
    if (!K) return `<code>${esc(tex)}</code>`;
    try { return K.renderToString(tex, { displayMode: disp, throwOnError: false, output: 'html' }); } catch { return `<code>${esc(tex)}</code>`; }
  }).join('');
}

// ---------- IA ----------
const PROMPT = (txt, subject) => `Eres una profesora de matemáticas y ciencias EXTREMADAMENTE paciente que prepara a una estudiante hispanohablante para el ENEM (Brasil), con meta de entrar a Medicina.
Materia del cuaderno: ${subject || 'Matemáticas'}.
${txt ? 'Problema (puede estar en portugués o español):\n' + txt : 'El problema está en la imagen adjunta (puede estar en portugués). Léelo con cuidado, incluidas tablas, gráficos y alternativas.'}

Resuélvelo paso a paso, explicando TODO como si ella nunca hubiera visto el tema: qué significa cada dato, por qué se elige cada operación, cómo se hace cada cuenta (sin saltarse cuentas intermedias), y cómo saber que el resultado tiene sentido.
Escribe toda la matemática en LaTeX entre $…$ (en línea) o $$…$$ (destacada). El dinero escríbelo como R$ 80,00 fuera de las fórmulas (dentro de una fórmula usa \\text{R\\$}). Explica en español sencillo.

Devuelve SOLO JSON con esta forma:
{"titulo": "título corto del problema (máx 6 palabras)",
 "area": "área del ENEM y tema (ej.: Matemática · Porcentaje)",
 "enunciado": "el problema transcrito completo y claro, con sus alternativas si las hay",
 "vocabulario": [{"pt": "palabra en portugués del enunciado", "es": "significado en español"}],
 "datos": ["cada dato que da el problema, con su significado"],
 "pide": "qué nos piden encontrar, en una frase",
 "idea": "la idea o estrategia para resolverlo, explicada simple (2-3 frases)",
 "conceptos": [{"nombre": "concepto o fórmula que se usa", "explicacion": "qué es y cuándo se usa, con la fórmula en LaTeX"}],
 "pasos": [{"titulo": "nombre corto del paso", "explicacion": "qué hacemos y por qué, muy detallado", "calculo": "las cuentas de este paso en LaTeX, línea por línea", "ojo": "error común o detalle a cuidar en este paso (vacío si no hay)"}],
 "respuesta": "resultado final con unidades",
 "alternativa": "letra de la alternativa correcta si el problema tiene alternativas, si no vacío",
 "verificacion": "cómo comprobar que la respuesta es correcta",
 "atajo": "un truco o forma más rápida para hacerlo en el día del ENEM (vacío si no hay)",
 "practica": {"enunciado": "un problema parecido para practicar", "respuesta": "su respuesta con una explicación breve"}}
Reglas: entre 4 y 10 pasos; nada de saltos; si algo es ambiguo, dilo y elige la interpretación más probable del ENEM.`;

export async function solveProblem({ key, model, text, image, subject }) {
  const parts = [];
  if (image) parts.push({ inline_data: { mime_type: image.split(';')[0].slice(5) || 'image/png', data: image.split(',')[1] } });
  parts.push({ text: PROMPT(text, subject) });
  let lastErr;
  for (const m of [...new Set([model || 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'])]) {
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
      });
    } catch { throw new Error('Sin conexión a internet: para resolver se necesita internet.'); }
    if (r.status === 404) { lastErr = new Error(`El modelo ${m} no existe`); continue; }
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 400 && /API key/i.test(t)) throw new Error('La clave de Gemini no es válida. Revísala en el botón IA del inicio.');
      if (r.status === 429) throw new Error('Gemini llegó a su límite gratuito por ahora. Prueba en unos minutos.');
      lastErr = new Error('Gemini respondió con error ' + r.status); continue;
    }
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    try { const d = JSON.parse(txt.replace(/^\s*```(json)?\s*|\s*```\s*$/g, '')); d.model = m; return d; }
    catch { lastErr = new Error('La IA respondió algo que no pude leer. Intenta otra vez.'); }
  }
  throw lastErr || new Error('No se pudo usar Gemini');
}

// ---------- la solución, en piezas que se reparten entre hojas ----------
export function solutionPieces(s, K) {
  const M = t => mathHtml(t, K);
  const out = [];
  out.push(`<div class="sv-head"><div class="sv-title">${esc(s.titulo || 'Problema resuelto')}</div>${s.area ? `<div class="sv-area">${esc(s.area)}</div>` : ''}</div>`);
  if (s.enunciado) out.push(`<div class="sv-box sv-enun"><h5>Enunciado</h5><p>${M(s.enunciado)}</p></div>`);
  const voc = (s.vocabulario || []).filter(v => v.pt);
  if (voc.length) out.push(`<div class="sv-voc"><h5>Palabras en portugués</h5><p>${voc.map(v => `<span><b>${esc(v.pt)}</b> = ${esc(v.es)}</span>`).join('')}</p></div>`);
  if ((s.datos || []).length || s.pide) out.push(`<div class="sv-two"><div class="sv-box"><h5>Datos</h5><ul>${(s.datos || []).map(d => `<li>${M(d)}</li>`).join('')}</ul></div><div class="sv-box sv-pide"><h5>¿Qué nos piden?</h5><p>${M(s.pide)}</p></div></div>`);
  if (s.idea) out.push(`<div class="sv-idea"><h5>La idea</h5><p>${M(s.idea)}</p></div>`);
  for (const c of s.conceptos || []) out.push(`<div class="sv-concept"><b>${M(c.nombre)}</b><p>${M(c.explicacion)}</p></div>`);
  (s.pasos || []).forEach((p, i) => out.push(`<div class="sv-step"><i>${i + 1}</i><div><h6>${M(p.titulo)}</h6><p>${M(p.explicacion)}</p>${p.calculo ? `<div class="sv-calc">${M(/\$/.test(p.calculo) ? p.calculo : '$$' + p.calculo + '$$')}</div>` : ''}${p.ojo ? `<p class="sv-ojo"><b>Ojo:</b> ${M(p.ojo)}</p>` : ''}</div></div>`));
  out.push(`<div class="sv-ans"><h5>Respuesta</h5><p>${M(s.respuesta)}${s.alternativa ? ` <span class="sv-alt">Alternativa ${esc(s.alternativa)}</span>` : ''}</p></div>`);
  if (s.verificacion) out.push(`<div class="sv-box"><h5>Comprobación</h5><p>${M(s.verificacion)}</p></div>`);
  if (s.atajo) out.push(`<div class="sv-idea sv-tip"><h5>Atajo para el ENEM</h5><p>${M(s.atajo)}</p></div>`);
  if (s.practica?.enunciado) out.push(`<div class="sv-box sv-prac"><h5>Ahora tú</h5><p>${M(s.practica.enunciado)}</p><details><summary>Ver respuesta</summary><p>${M(s.practica.respuesta)}</p></details></div>`);
  return out;
}

// reparte las piezas en bloques que caben en cada hoja A4
function packPieces(pieces, first, rest) {
  const probe = h('div', { class: 'el el-block blk-solucion', style: { position: 'absolute', left: '-99999px', top: '0', width: SOLVE_W + 'px', visibility: 'hidden' } });
  const bz = h('div', { class: 'bz' }); probe.append(bz); document.body.append(probe);
  const chunks = []; let cur = [], lim = first;
  for (const p of pieces) {
    bz.innerHTML = cur.concat(p).join('');
    if (cur.length && bz.offsetHeight > lim) { chunks.push(cur); cur = [p]; lim = rest; }
    else cur.push(p);
  }
  if (cur.length) chunks.push(cur);
  probe.remove();
  return chunks.map(c => c.join(''));
}

async function placeSolution(nb, sol) {
  const K = await loadKatex();
  await placePieces(nb, solutionPieces(sol, K), 'solucion');
}
// coloca piezas HTML en el cuaderno, repartidas por hojas A4 si no caben
export async function placePieces(nb, pieces, variant = 'solucion') {
  if (document.fonts?.ready) await document.fonts.ready;
  let idx = nb.visiblePageIndex(), pg = nb.pages[idx];
  let y = Math.max(40, nb.bottomOf(pg) + 30);
  if (y > PH - 300) { pg = await nb.addPage(idx); idx = nb.pages.indexOf(pg); y = 40; }
  const chunks = packPieces(pieces, PH - y - 30, PH - 90);
  const x = Math.round((PW - SOLVE_W) / 2);
  let firstEl = null;
  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) { pg = await nb.addPage(nb.pages.indexOf(pg)); y = 45; }
    const el = await nb.addEl(pg, { type: 'block', variant, html: chunks[i], w: SOLVE_W, h: 0, x, y });
    firstEl ||= { pg, el };
  }
  nb.scrollToPage(nb.pages.indexOf(firstEl.pg));
  nb.flash?.(firstEl);
  toast(chunks.length > 1 ? `Listo: ocupa ${chunks.length} hojas de tu cuaderno` : 'Listo: ya está en tu cuaderno', 3000);
}

// ---------- recortar una zona del PDF ----------
export function cropFromPane(pane) {
  return new Promise(res => {
    const ov = h('div', { class: 'crop-ov' }, h('div', { class: 'crop-hint' }, 'Arrastra para marcar el problema', h('button', { class: 'crop-x', 'aria-label': 'Cancelar', html: icon('close', 18), onclick: e => { e.stopPropagation(); done(null); } })));
    const box = h('div', { class: 'crop-box', hidden: true }); ov.append(box);
    pane.append(ov);
    let st = null;
    const done = v => { ov.remove(); res(v); };
    ov.addEventListener('pointerdown', e => {
      if (e.target.closest('.crop-hint')) return;
      e.preventDefault(); ov.setPointerCapture(e.pointerId);
      const r = ov.getBoundingClientRect(); st = { x: e.clientX - r.left, y: e.clientY - r.top, r };
      Object.assign(box.style, { left: st.x + 'px', top: st.y + 'px', width: 0, height: 0 }); box.hidden = false;
    });
    ov.addEventListener('pointermove', e => {
      if (!st) return;
      const x = e.clientX - st.r.left, y = e.clientY - st.r.top;
      Object.assign(box.style, { left: Math.min(x, st.x) + 'px', top: Math.min(y, st.y) + 'px', width: Math.abs(x - st.x) + 'px', height: Math.abs(y - st.y) + 'px' });
    });
    ov.addEventListener('pointerup', () => {
      if (!st) return;
      const b = box.getBoundingClientRect(); st = null;
      if (b.width < 24 || b.height < 18) { box.hidden = true; return toast('Marca una zona más grande'); }
      done(grab(pane, b));
    });
  });
}
function grab(pane, b) {
  const K = Math.min(3, Math.max(1.5, 1400 / b.width));
  const cv = document.createElement('canvas'); cv.width = Math.round(b.width * K); cv.height = Math.round(b.height * K);
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
  for (const c of pane.querySelectorAll('.pdf-page > canvas')) {
    const r = c.getBoundingClientRect();
    if (r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom || !c.width) continue;
    const sx = c.width / r.width, sy = c.height / r.height;
    const x0 = Math.max(b.left, r.left), y0 = Math.max(b.top, r.top), x1 = Math.min(b.right, r.right), y1 = Math.min(b.bottom, r.bottom);
    try { cx.drawImage(c, (x0 - r.left) * sx, (y0 - r.top) * sy, (x1 - x0) * sx, (y1 - y0) * sy, (x0 - b.left) * K, (y0 - b.top) * K, (x1 - x0) * K, (y1 - y0) * K); } catch { }
  }
  return cv.toDataURL('image/jpeg', .92);
}

// imagen de una foto, reducida para enviarla rápido
async function fileToDataUrl(f) {
  const bmp = await createImageBitmap(f);
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', .9);
}

// pizarra pequeña para escribir el problema con el lápiz
function handPad() {
  const cv = h('canvas', { class: 'sv-pad' });
  let ink = false, last = null, dirty = false;
  const fit = () => { const r = cv.getBoundingClientRect(); if (!r.width) return; const d = Math.min(devicePixelRatio || 1, 2); cv.width = r.width * d; cv.height = r.height * d; const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = '#2A0E12'; c.lineWidth = 2.6; dirty = false; };
  requestAnimationFrame(fit);
  cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); ink = true; const r = cv.getBoundingClientRect(); last = [e.clientX - r.left, e.clientY - r.top]; });
  cv.addEventListener('pointermove', e => {
    if (!ink) return; const r = cv.getBoundingClientRect(), c = cv.getContext('2d');
    for (const ev of e.getCoalescedEvents?.() || [e]) { const p = [ev.clientX - r.left, ev.clientY - r.top]; c.lineWidth = ev.pointerType === 'pen' ? 1.4 + (ev.pressure || .5) * 2.6 : 2.6; c.beginPath(); c.moveTo(...last); c.lineTo(...p); c.stroke(); last = p; }
    dirty = true;
  });
  const up = () => { ink = false; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  return { el: cv, clear: fit, has: () => dirty, data: () => { const o = document.createElement('canvas'); o.width = cv.width; o.height = cv.height; const c = o.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, o.width, o.height); c.drawImage(cv, 0, 0); return o.toDataURL('image/png'); } };
}

// ---------- ventana principal ----------
export function openSolver(nb, { text = '', image = null, cropPane = null } = {}) {
  const settings = nb.ctx.settings?.() || {};
  let img = image;
  const ta = h('textarea', { class: 'field sv-text', rows: 4, placeholder: 'Escribe o pega el problema aquí (en español o portugués)…' }); ta.value = text;
  const pad = handPad();
  const prev = h('div', { class: 'sv-prev' });
  const showImg = () => { prev.replaceChildren(...(img ? [h('img', { src: img, alt: 'problema' }), h('button', { class: 'chip', html: icon('trash', 16) + 'Quitar imagen', onclick: () => { img = null; showImg(); } })] : [])); };
  showImg();
  const tabs = h('div', { class: 'font-tabs' });
  const panes = { escribir: h('div', {}, ta), mano: h('div', {}, pad.el, h('div', { class: 'ie-row' }, h('button', { class: 'chip', html: icon('eraser', 16) + 'Borrar', onclick: () => pad.clear() }), h('span', { class: 'opt-hint' }, 'Escribe el problema con el lápiz.'))) };
  let tab = 'escribir';
  const setTab = k => { tab = k; tabs.querySelectorAll('.ft').forEach(b => b.classList.toggle('on', b.dataset.k === k)); Object.entries(panes).forEach(([kk, p]) => p.hidden = kk !== k); if (k === 'mano') requestAnimationFrame(() => pad.clear()); };
  tabs.append(...[['escribir', 'Escribir'], ['mano', 'A mano']].map(([k, n]) => h('button', { class: 'ft', 'data-k': k, onclick: () => setTab(k) }, n)));
  const status = h('p', { class: 'opt-hint sv-status' });
  const body = h('div', { class: 'solver' },
    h('p', { class: 'opt-hint' }, 'La solución llega a tu cuaderno con cada paso explicado, las fórmulas, el porqué de cada cuenta, un atajo para el ENEM y un ejercicio parecido para practicar.'),
    tabs, panes.escribir, panes.mano,
    h('div', { class: 'ie-row' },
      h('button', { class: 'chip', html: icon('image', 16) + 'Foto del problema', onclick: async () => { const f = await pickFile('image/*'); if (f) { img = await fileToDataUrl(f); showImg(); } } }),
      cropPane ? h('button', { class: 'chip', html: icon('lasso', 16) + 'Recortar del PDF', onclick: async () => { m.close(); const d = await cropFromPane(cropPane); if (d) openSolver(nb, { text: ta.value, image: d, cropPane }); } }) : null),
    prev, status);
  setTab('escribir');
  const m = modal({
    title: 'Resolver paso a paso', wide: true, body,
    actions: [{ label: 'Cancelar' }, {
      label: 'Resolver', primary: true, onclick: async () => {
        if (!settings.geminiKey) { status.textContent = 'Para resolver se necesita tu clave gratuita de Gemini: en el inicio toca IA y pégala.'; return false; }
        const t = ta.value.trim(), im = img || (pad.has() ? pad.data() : null);
        if (!t && !im) { status.textContent = 'Escribe el problema, sube una foto, recórtalo del PDF o escríbelo a mano.'; return false; }
        const btn = m.box.querySelector('.modal-actions .btn.primary'); btn.disabled = true; btn.textContent = 'Resolviendo…';
        status.textContent = 'Pensando cada paso con calma… (puede tardar unos segundos)';
        try {
          const sol = await solveProblem({ key: settings.geminiKey, model: settings.geminiModel, text: t, image: im, subject: nb.subject?.name });
          await placeSolution(nb, sol);
        } catch (e) { console.warn(e); status.textContent = e.message; btn.disabled = false; btn.textContent = 'Resolver'; return false; }
      },
    }],
  });
  m.box.classList.add('solver-modal');
  return m;
}

export { placeSolution, loadKatex };
