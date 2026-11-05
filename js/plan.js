// Mi cronograma ENEM: lee el índice de cada PDF (capítulos), y reparte los capítulos de todas las materias
// en los días que quedan hasta la fecha límite. Cada día te dice qué estudiar ("Historia: capítulos 3 a 5").
// Si te atrasas, lo pendiente se reparte solo en los días que quedan. Las preguntas falladas se repasan aparte.
import * as db from './db.js';
import { h, modal, toast } from './ui.js';

const PLAN_ID = 'enem-plan';
export const DEADLINE_DEFAULT = '2027-09-30';
const DAY = 864e5;
const day0 = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
const dkey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtD = t => new Date(t).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

export async function getPlan() { const p = await db.get(PLAN_ID); return p && !p.deleted ? p : { id: PLAN_ID, kind: 'plan', deadline: DEADLINE_DEFAULT, restDays: [0], books: [] }; }
const savePlan = p => db.put(p);

// ---------- capítulos de un PDF ----------
async function pdfDoc(rec) {
  const pdfjsLib = await import('../vendor/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  const blob = await db.getBlob(rec.blob) || (window.__fetchRemoteBlob && await window.__fetchRemoteBlob(rec.blob));
  if (!blob) throw new Error('El PDF «' + rec.name + '» no está en este equipo todavía. Ábrelo una vez y vuelve a intentar.');
  return pdfjsLib.getDocument({ data: await blob.arrayBuffer(), cMapUrl: new URL('../vendor/cmaps/', import.meta.url).href, cMapPacked: true, standardFontDataUrl: new URL('../vendor/standard_fonts/', import.meta.url).href }).promise;
}
// ---------- índices conocidos de tus libros base (data/indices.json) ----------
let IDX = null;
async function indices() { if (IDX) return IDX; try { IDX = await (await fetch('data/indices.json')).json(); } catch { IDX = []; } return IDX; }
export async function knownBook(pages) { return (await indices()).find(b => b.pages === pages) || null; }
const offAt = (b, p) => { if (b.offPts) { const P = b.offPts; let k = 0; while (k < P.length - 2 && p > P[k + 1][0]) k++; const [x0, y0] = P[k], [x1, y1] = P[k + 1]; return Math.round(y0 + (y1 - y0) * Math.max(0, Math.min(1, (p - x0) / (x1 - x0)))); } const [a, z] = b.off || [0, 0]; const c0 = b.chapters[0].page, c1 = b.end || p; return Math.round(a + (z - a) * Math.max(0, Math.min(1, (p - c0) / Math.max(1, c1 - c0)))); };
// capítulos -> unidades de estudio de máximo ~20 páginas (los capítulos largos se parten)
export function makeUnits(chs, end, offFn = () => 0) {
  const out = [];
  chs.forEach((c, k) => {
    const s0 = +c.page || null, e0 = s0 ? ((chs[k + 1]?.page || end || s0 + 10) - 1) : null;
    const size = s0 && e0 ? Math.max(1, e0 - s0 + 1) : 0, n = size > 22 ? Math.ceil(size / 18) : 1;
    for (let q = 0; q < n; q++) {
      const s = s0 ? Math.round(s0 + q * size / n) : null, e = s0 ? Math.round(s0 + (q + 1) * size / n) - 1 : null;
      out.push({ title: c.title + (n > 1 ? ` (parte ${q + 1}/${n})` : ''), page: s, end: e, pdfFrom: s ? s + offFn(s) : null, pdfTo: e ? e + offFn(e) : null });
    }
  });
  return out;
}
const junk = t => /\.pdf\b|p[aá]gina[_ ]\d|^img\d|^\d+$|^page \d/i.test(t || '');
// 1) índice conocido  2) índice interno del PDF  3) la IA lee el sumario  4) partes de 20 páginas
export async function readChapters(rec) {
  const doc = await pdfDoc(rec);
  const kb = await knownBook(doc.numPages);
  if (kb) return { chapters: makeUnits(kb.chapters, kb.end, p => offAt(kb, p)), pages: doc.numPages, how: 'índice del libro', key: kb.key, subject: kb.subject, supersededBy: kb.supersededBy };
  const out = [];
  try {
    const ol = await doc.getOutline();
    const pageOf = async it => { try { const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest; return dest ? (await doc.getPageIndex(dest[0])) + 1 : null; } catch { return null; } };
    if (ol?.length) {
      const top = ol.length >= 3 ? ol : ol.flatMap(x => x.items?.length ? x.items : [x]);
      for (const it of top.slice(0, 80)) if (!junk(it.title)) out.push({ title: (it.title || '').trim().slice(0, 90), page: await pageOf(it) });
    }
  } catch { }
  if (out.length >= 3) return { chapters: makeUnits(out, doc.numPages), pages: doc.numPages, how: 'índice del PDF' };
  const s = await db.settings();
  if (s.geminiKey) {
    let text = '';
    for (let p = 1; p <= Math.min(12, doc.numPages); p++) { const tc = await (await doc.getPage(p)).getTextContent(); text += `\n--- página ${p} ---\n` + tc.items.map(i => i.str).join(' '); if (text.length > 24000) break; }
    if (text.replace(/[-\s\dpágina]/g, '').length > 200) {
      try {
        const L = await import('./loona.js');
        const t = await L.aiText(s, `Este es el comienzo de un libro/apostila de estudio (${rec.name}). Busca el ÍNDICE o SUMARIO y devuelve SOLO JSON: {"capitulos":[{"titulo":"…","pagina":número o null}]} con los capítulos principales en orden (máximo 60). Si no hay índice, devuelve {"capitulos":[]}.\n\n${text.slice(0, 24000)}`, { fast: true });
        const caps = (JSON.parse(t.replace(/^[\s\S]*?(\{)/, '$1').replace(/\}[^}]*$/, '}')).capitulos || []).filter(c => c?.titulo).map(c => ({ title: String(c.titulo).slice(0, 90), page: +c.pagina || null }));
        if (caps.length >= 3) return { chapters: makeUnits(caps, doc.numPages), pages: doc.numPages, how: 'sumario leído por la IA' };
      } catch { }
    }
  }
  const n = Math.max(1, Math.round(doc.numPages / 20));
  return { chapters: Array.from({ length: n }, (_, i) => ({ title: `Parte ${i + 1} (págs. ${i * 20 + 1}–${Math.min(doc.numPages, (i + 1) * 20)})`, page: i * 20 + 1, end: Math.min(doc.numPages, (i + 1) * 20), pdfFrom: i * 20 + 1, pdfTo: Math.min(doc.numPages, (i + 1) * 20) })), pages: doc.numPages, how: 'sin índice: partes de 20 páginas' };
}

// ---------- el cronograma ----------
// Cómo se aprende mejor: (1) cada día solo 2 materias, alternándolas (estudio intercalado), (2) todas avanzan
// parejo hasta el final (ninguna queda olvidada), (3) más peso a lo que más cuenta para Medicina en el ENEM
// (Biología, Química, Física, Matemática), (4) el sábado es más liviano y se usa para repasar la semana,
// (5) las últimas 6 semanas antes de la fecha límite son SOLO de repaso general y simulados.
const WEIGHT = [[/biolog/i, 1.35], [/quim/i, 1.25], [/fisic/i, 1.15], [/razonamiento matem|\brm\b/i, .85], [/razonamiento verbal|\brv\b|lengua|portugu/i, 1.0], [/aritm|algebr|matem/i, 1.1], [/geom|trigon/i, 1.05], [/histor|geograf/i, .9]];
const weightOf = b => (WEIGHT.find(([re]) => re.test((b.subject + ' ' + b.name).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) || [0, 1])[1];
const REVIEW_DAYS = 42;
function studyDays(from, to, rest) { const out = []; for (let t = day0(from); t <= day0(to); t += DAY) if (!rest.includes(new Date(t).getDay())) out.push(t); return out; }
export function phases(plan) { const end = new Date(plan.deadline + 'T12:00'); return { contentEnd: +end - REVIEW_DAYS * DAY, end: +end }; }
export function schedule(plan, from = Date.now()) {
  const map = {}; const { contentEnd, end } = phases(plan);
  const books = plan.books.filter(b => !b.paused);
  const days = studyDays(from, contentEnd, plan.restDays || []);
  const st = books.map(b => ({ b, w: weightOf(b), total: b.chapters.length, done: b.chapters.filter(c => c.done).length, queue: b.chapters.map((c, i) => ({ ...c, i })).filter(c => !c.done) }));
  const remaining = st.reduce((a, x) => a + x.queue.length, 0);
  // cola única: materias en orden de prioridad, cada una completa (todos sus libros) antes de la siguiente
  const order = [...new Set(st.slice().sort((a, c) => c.w - a.w || (a.b.subject || '').localeCompare(c.b.subject || '')).map(x => x.b.subject || x.b.name))];
  const seq = order.flatMap(sub => st.filter(x => (x.b.subject || x.b.name) === sub).flatMap(x => x.queue.map(ch => ({ book: x.b.id, name: x.b.name, subject: x.b.subject, ch }))));
  if (days.length && remaining) {
    const cap = days.reduce((a, t) => a + (new Date(t).getDay() === 6 ? .5 : 1), 0);
    let acc = 0;
    for (const t of days) {
      acc += (new Date(t).getDay() === 6 ? .5 : 1) * Math.max(remaining / cap, plan.pace || 0);
      let n = Math.floor(acc + 1e-9); if (n <= 0) continue; acc -= n;
      // lo que ya terminaste hoy ocupa los lugares de hoy (no aparecen unidades nuevas al completar el plan)
      if (t === day0(from)) { const dt = books.reduce((a, b) => a + b.chapters.filter(c => c.done && c.doneAt && day0(c.doneAt) === t).length, 0); n = Math.max(0, n - dt); if (!n) continue; }
      // UNA materia a la vez: hasta terminarla no empieza la siguiente (orden: lo que más cuenta para Medicina primero)
      const list = (map[dkey(t)] ||= []);
      while (n > 0 && seq.length) { const x = seq.shift(); list.push(x); n--; }
    }
  }
  // si terminas el contenido antes de tiempo, esos días pasan a ser de repaso (más tiempo para simulados)
  if (remaining) for (const t of days) if (!map[dkey(t)]?.length && t > Math.max(...Object.keys(map).filter(k => map[k].some(x => !x.review)).map(k => +new Date(k + 'T00:00')), 0)) (map[dkey(t)] ||= []).push({ review: true });
  for (const t of studyDays(Math.max(from, contentEnd + DAY), end, plan.restDays || [])) (map[dkey(t)] ||= []).push({ review: true });
  return map;
}
// ritmo diario fijo (unidades por día de estudio), calculado cuando agregas o quitas libros
function capacity(plan, from) { const { contentEnd } = phases(plan); return studyDays(from, contentEnd, plan.restDays || []).reduce((a, t) => a + (new Date(t).getDay() === 6 ? .5 : 1), 0); }
const pendingUnits = plan => plan.books.filter(b => !b.paused).reduce((a, b) => a + b.chapters.filter(c => !c.done).length, 0);
export function resetPace(plan) { const cap = capacity(plan, Date.now()); plan.pace = cap ? +(pendingUnits(plan) / cap).toFixed(3) : 0; plan.paceFrom = day0(Date.now()); plan.paceDone = plan.books.filter(b => !b.paused).reduce((a, b) => a + b.chapters.filter(c => c.done).length, 0); return plan; }
// cuántos días vas adelantada (+) o atrasada (−) respecto al ritmo
export function progressInfo(plan) {
  if (!plan.pace) return null;
  const done = plan.books.filter(b => !b.paused).reduce((a, b) => a + b.chapters.filter(c => c.done).length, 0);
  const capSince = studyDays(plan.paceFrom, Date.now() - DAY, plan.restDays || []).reduce((a, t) => a + (new Date(t).getDay() === 6 ? .5 : 1), 0);
  const expected = (plan.paceDone || 0) + plan.pace * capSince;
  const days = Math.round((done - expected) / plan.pace);
  const map = schedule(plan); const last = Object.keys(map).filter(k => map[k].some(x => !x.review)).sort().at(-1);
  return { days, finish: last ? new Date(last + 'T12:00') : null };
}
// siguientes unidades para adelantar (de los próximos días)
export function nextUnits(plan, n = 4) {
  const map = schedule(plan), today = dkey(Date.now()), out = [];
  for (const k of Object.keys(map).sort()) { if (k <= today) continue; for (const x of map[k]) if (!x.review && out.length < n) out.push(x); if (out.length >= n) break; }
  return out;
}
export async function todayPlan() { const p = await getPlan(); return (schedule(p)[dkey(Date.now())] || []).filter(x => !x.review); }
export async function isReviewDay() { const p = await getPlan(); return Date.now() > phases(p).contentEnd; }
const groupByBook = items => { const g = {}; items.filter(x => !x.review).forEach(x => (g[x.book] ||= { id: x.book, name: x.name, subject: x.subject, chs: [] }).chs.push(x.ch)); return Object.values(g); };
export const planLine = items => items.some(x => x.review) && !items.some(x => !x.review) ? 'repaso general y simulado' : groupByBook(items).map(g => `${g.subject || g.name}: ${g.chs.length === 1 ? '«' + g.chs[0].title + '»' : g.chs.length + ' unidades'}`).join(' · ');

// ---------- se completa solo: si leíste las páginas de una unidad en el PDF, queda hecha ----------
export async function autoComplete(pdfId, visited) {
  const p = await getPlan(); const b = p.books.find(x => x.id === pdfId); if (!b) return [];
  const doneNow = [];
  b.chapters.forEach(c => {
    if (c.done || !c.pdfFrom || !c.pdfTo) return;
    const pages = c.pdfTo - c.pdfFrom + 1; let seen = 0;
    for (let q = c.pdfFrom; q <= c.pdfTo; q++) if (visited.has(q) || visited.has(q - 1) || visited.has(q + 1)) seen++;
    if (seen >= Math.max(2, Math.ceil(pages * .7))) { c.done = true; c.doneAt = Date.now(); c.auto = true; doneNow.push(c); }
  });
  if (doneNow.length) { await savePlan(p); const G = await import('./game.js'); for (const c of doneNow) await G.award('unidad', { title: c.title, subject: b.subject }); }
  return doneNow;
}
export async function setDone(bookId, i, done) {
  const p = await getPlan(); const b = p.books.find(x => x.id === bookId); if (!b || !b.chapters[i]) return;
  const was = b.chapters[i].done; b.chapters[i].done = done; b.chapters[i].doneAt = Date.now(); await savePlan(p);
  if (done && !was) {
    const G = await import('./game.js'); await G.award('unidad', { title: b.chapters[i].title, subject: b.subject });
    const t = await todayPlan();
    if (!t.some(x => !x.ch.done)) { const L = await import('./loona.js'); L.speak('Plan de hoy listo, Eve. Si todavía tienes energía, sigue con la próxima unidad: todo lo que adelantes te deja más tiempo de repaso al final.'); }
  }
}

// ---------- importar tus PDF base: crea la materia, su cuaderno y lo pone en el cronograma ----------
const SUBJ = [[/biolog/i, 'Biología'], [/quim/i, 'Química'], [/fisic/i, 'Física'], [/histor/i, 'Historia'], [/aritm|algebr/i, 'Aritmética y Álgebra'], [/geomet|trigon/i, 'Geometría y Trigonometría'], [/razonamiento.?matem|(^|[^a-z])rm([^a-z]|$)/i, 'Razonamiento Matemático'], [/razonamiento.?verbal|(^|[^a-z])rv([^a-z]|$)/i, 'Razonamiento Verbal'], [/geograf/i, 'Geografía'], [/portugu|lengua|literat/i, 'Lenguaje']];
const cleanName = n => n.replace(/\.pdf$/i, '').replace(/^[0-9a-f]{8}-/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
export async function importBasePdfs(files, onStep = () => { }) {
  const pdfjsLib = await import('../vendor/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
  const subjects = await db.all('subject'), nbs = await db.all('notebook');
  const plan = await getPlan(); const added = [];
  for (const f of files) {
    const name = cleanName(f.name); onStep('Leyendo ' + name + '…');
    let pages = 0; try { pages = (await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise).numPages; } catch { }
    const kb = pages ? await knownBook(pages) : null;
    const sname = kb?.subject || (SUBJ.find(([re]) => re.test(name.normalize('NFD').replace(/[̀-ͯ]/g, ''))) || [0, name])[1];
    let sub = subjects.find(s => !s.deleted && s.name.toLowerCase() === sname.toLowerCase());
    if (!sub) { sub = await db.put({ id: db.uid('sub_'), kind: 'subject', name: sname, cover: 'negro', coverColor: '#D9D5D7', order: Date.now() }); subjects.push(sub); }
    let nb = nbs.find(n => n.subject === sub.id && !n.deleted);
    if (!nb) { nb = await db.put({ id: db.uid('nb_'), kind: 'notebook', subject: sub.id, name: 'Cuaderno de ' + sname, paper: 'puntos', tone: 'negro' }); nbs.push(nb); }
    const blobId = db.uid('pdfb_'); await db.putBlob(blobId, f, { type: 'application/pdf' });
    const rec = await db.put({ id: db.uid('pdf_'), kind: 'pdf', subject: sub.id, name, blob: blobId, notebook: nb.id, pages });
    onStep('Armando los capítulos de ' + name + '…');
    let r; try { r = await readChapters(rec); } catch (e) { r = { chapters: [], how: e.message }; }
    added.push({ rec, r, kb, sname });
  }
  // si tienes dos ediciones del mismo libro, al cronograma va solo la nueva
  const keys = new Set([...added.map(a => a.kb?.key), ...plan.books.map(b => b.key)].filter(Boolean));
  for (const a of added) {
    if (!a.r.chapters?.length) continue;
    const skip = a.kb?.supersededBy && keys.has(a.kb.supersededBy);
    plan.books.push({ id: a.rec.id, key: a.kb?.key || '', name: a.rec.name, subject: a.sname, chapters: a.r.chapters, how: a.r.how + (skip ? ' · edición anterior (pausada)' : ''), paused: !!skip, added: Date.now() });
  }
  resetPace(plan); await savePlan(plan);
  return added;
}

// ---------- ventana del cronograma ----------
export async function openPlan() {
  const body = h('div', { class: 'plan' });
  const draw = async () => {
    const plan = await getPlan();
    if (plan.books.length && !plan.pace) { resetPace(plan); await savePlan(plan); }
    const subjects = await db.all('subject'), pdfs = (await db.all('pdf')).filter(p => !p.deleted);
    const sName = id => subjects.find(s => s.id === id)?.name || '';
    const { contentEnd, end } = phases(plan);
    const map = schedule(plan), todayK = dkey(Date.now());
    const today = (map[todayK] || []).filter(x => !x.review);
    plan.books.forEach(b => b.chapters.forEach((c, i) => { if (c.done && c.doneAt && dkey(c.doneAt) === todayK) today.push({ book: b.id, name: b.name, subject: b.subject, ch: { ...c, i } }); }));
    const active = plan.books.filter(b => !b.paused);
    const totalCh = active.reduce((a, b) => a + b.chapters.length, 0), doneCh = active.reduce((a, b) => a + b.chapters.filter(c => c.done).length, 0);
    const daysLeft = Math.max(0, Math.ceil((day0(end) - day0(Date.now())) / DAY)), contentLeft = Math.max(0, Math.ceil((contentEnd - Date.now()) / DAY));
    const inReview = Date.now() > contentEnd;
    // hoy
    const todayBox = h('div', { class: 'plan-today' }, h('h3', {}, 'Hoy · ' + fmtD(Date.now())),
      ...(inReview ? [h('p', {}, 'Fase de repaso: rehace tus errores, repasa tus láminas y haz un simulado ENEM.')]
        : today.length ? groupByBook(today).map(g => h('div', { class: 'plan-book' }, h('b', {}, (g.subject ? g.subject + ' — ' : '') + g.name),
          ...g.chs.map(c => h('label', { class: 'plan-ch' + (c.auto ? ' auto' : '') }, h('input', { type: 'checkbox', checked: !!c.done, onchange: e => setDone(g.id, c.i, e.target.checked) }), h('span', {}, c.title + (c.page ? ` · pág. ${c.page}${c.end ? '–' + c.end : ''}` : '') + (c.auto ? ' · se completó sola ✓' : ''))))))
        : [h('p', { class: 'opt-hint' }, plan.books.length ? (new Date().getDay() === 0 ? 'Domingo de descanso. Mañana seguimos.' : 'Hoy no tienes unidades nuevas: repasa tus errores o adelanta.') : 'Importa tus PDF y armo tu cronograma.')]),
      h('p', { class: 'opt-hint' }, 'Tip: si lees las páginas de la unidad en el PDF, se marca sola.'));
    // seguir estudiando: las siguientes unidades, para adelantar cuando todavía tienes energía
    const todayDone = today.length && today.every(x => x.ch.done);
    const ahead = nextUnits(plan, todayDone ? 4 : 2);
    const aheadBox = !inReview && ahead.length ? h('div', { class: 'plan-ahead' + (todayDone ? ' hot' : '') },
      h('h3', {}, todayDone ? '¿Sigues? Adelanta' : 'Si te sobra tiempo, adelanta'),
      ...ahead.map(x => h('label', { class: 'plan-ch' }, h('input', { type: 'checkbox', onchange: async e => { if (e.target.checked) { await setDone(x.book, x.ch.i, true); const G = await import('./game.js'); await G.award('adelanto', { title: x.ch.title }); draw(); } } }), h('span', {}, `${x.subject || x.name}: ${x.ch.title}` + (x.ch.page ? ` · pág. ${x.ch.page}${x.ch.end ? '–' + x.ch.end : ''}` : '')))),
      h('p', { class: 'opt-hint' }, 'Lo que adelantas no aligera los días siguientes: hace que termines antes y te deja más semanas de repaso y simulados.')) : null;
    const pi = progressInfo(plan);
    const paceRow = pi ? h('p', { class: 'plan-pace ' + (pi.days > 0 ? 'up' : pi.days < 0 ? 'down' : '') }, pi.days > 0 ? `🚀 Vas ${pi.days} ${pi.days === 1 ? 'día' : 'días'} adelantada` : pi.days < 0 ? `⏳ Vas ${-pi.days} ${pi.days === -1 ? 'día' : 'días'} atrasada: el plan reparte lo pendiente solo` : '✓ Vas al día',
      pi.finish ? ` · terminas el contenido el ${pi.finish.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}` : '') : null;
    // próximos 7 días
    const next = h('div', { class: 'plan-next' });
    for (let d = 1, k = 0; d <= 21 && k < 7; d++) { const t = day0(Date.now()) + d * DAY, it = map[dkey(t)]; if (it?.length) { k++; next.append(h('div', { class: 'plan-day' }, h('b', {}, new Date(t).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })), h('span', {}, planLine(it)))); } }
    const books = h('div', { class: 'plan-books' }, ...plan.books.map(b => { const d = b.chapters.filter(c => c.done).length;
      return h('div', { class: 'plan-brow' + (b.paused ? ' paused' : '') }, h('span', {}, h('b', {}, b.name), h('small', {}, `${b.subject || ''} · ${d}/${b.chapters.length} unidades · ${b.how || ''}`)),
        h('i', { class: 'plan-bar' }, h('i', { style: { width: (b.chapters.length ? d / b.chapters.length * 100 : 0) + '%' } })),
        h('span', { class: 'ie-row' }, h('button', { class: 'chip', onclick: async () => { const p = await getPlan(); const x = p.books.find(y => y.id === b.id); x.paused = !x.paused; resetPace(p); await savePlan(p); draw(); } }, b.paused ? 'Activar' : 'Pausar'),
          h('button', { class: 'chip', onclick: async () => { const p = await getPlan(); p.books = p.books.filter(x => x.id !== b.id); resetPace(p); await savePlan(p); draw(); } }, 'Quitar'))); }));
    const free = pdfs.filter(p => !plan.books.some(b => b.id === p.id));
    const sel = h('select', { class: 'field' }, ...free.map(p => h('option', { value: p.id }, (sName(p.subject) ? sName(p.subject) + ' — ' : '') + p.name)));
    const addBtn = h('button', { class: 'btn', disabled: !free.length, onclick: async () => {
      const rec = pdfs.find(p => p.id === sel.value); if (!rec) return;
      addBtn.textContent = 'Leyendo el índice…'; addBtn.disabled = true;
      try { const r = await readChapters(rec); const p = await getPlan(); p.books.push({ id: rec.id, key: r.key || '', name: rec.name, subject: sName(rec.subject) || r.subject || '', chapters: r.chapters, how: r.how, added: Date.now() }); resetPace(p); await savePlan(p); toast(`${r.chapters.length} unidades de «${rec.name}» en tu cronograma`, 3000); }
      catch (e) { toast(e.message, 4500); }
      draw();
    } }, free.length ? 'Agregar al cronograma' : 'Todos tus PDF ya están');
    const status = h('p', { class: 'opt-hint' });
    const impBtn = h('button', { class: 'btn primary', onclick: async () => {
      const { pickFile } = await import('./ui.js'); const files = await pickFile('application/pdf,.pdf', true); if (!files?.length) return;
      impBtn.disabled = true;
      try { const r = await importBasePdfs([...files], m => status.textContent = m); status.textContent = ''; toast(`Listo: ${r.length} PDF con su materia, cuaderno y cronograma`, 4000); import('./loona.js').then(L => L.speak('Tus libros ya están en tu cronograma, Eve. Empezamos hoy.')); }
      catch (e) { toast(e.message, 5000); }
      impBtn.disabled = false; draw();
    } }, 'Importar mis PDF base (crea materias y cuadernos)');
    const dl = h('input', { class: 'field', type: 'date', value: plan.deadline, onchange: async e => { const p = await getPlan(); p.deadline = e.target.value || DEADLINE_DEFAULT; resetPace(p); await savePlan(p); draw(); } });
    const restRow = h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Días de descanso:'), ...['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((n, i) => h('button', { class: 'chip' + ((plan.restDays || []).includes(i) ? ' on' : ''), onclick: async () => { const p = await getPlan(); const r = new Set(p.restDays || []); r.has(i) ? r.delete(i) : r.add(i); p.restDays = [...r]; resetPace(p); await savePlan(p); draw(); } }, n)));
    const G = await import('./game.js');
    body.replaceChildren(
      G.hud(),
      h('div', { class: 'errv-top' }, h('div', {}, h('b', { class: 'errv-big' }, String(contentLeft)), h('small', {}, 'días de contenido')), h('div', {}, h('b', { class: 'errv-big' }, String(daysLeft)), h('small', {}, 'días hasta la meta')), h('div', {}, h('b', { class: 'errv-big' }, `${doneCh}/${totalCh}`), h('small', {}, 'unidades')), h('div', {}, h('b', { class: 'errv-big' }, totalCh ? Math.round(doneCh / totalCh * 100) + '%' : '0%'), h('small', {}, 'avance'))),
      h('div', { class: 'plan-phases' }, h('span', { class: inReview ? '' : 'on' }, `Fase 1 · Contenido (hasta ${new Date(contentEnd).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })})`), h('span', { class: inReview ? 'on' : '' }, 'Fase 2 · Repaso general y simulados (6 semanas)')),
      ...(paceRow ? [paceRow] : []), todayBox, ...(aheadBox ? [aheadBox] : []), ...(next.childNodes.length ? [h('div', {}, h('h3', {}, 'Próximos días'), next)] : []),
      h('h3', {}, 'Mis libros'), books, h('div', { class: 'ie-row' }, impBtn), status, h('div', { class: 'ie-row' }, sel, addBtn),
      h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Terminar todo antes de:'), dl), restRow,
      h('p', { class: 'opt-hint' }, 'Cómo está armado: una materia a la vez; cuando la terminas empieza la siguiente (primero Biología, Química, Física y Matemática, que cuentan más para Medicina). Lo ya estudiado vuelve en tus repasos de errores para que no se olvide. Los capítulos largos se parten en unidades de máx. ~20 páginas. El sábado es más liviano, el domingo descansas, y las últimas 6 semanas son solo de repaso y simulados. El ritmo diario es fijo: si adelantas, terminas antes y ganas semanas de repaso; si te atrasas, lo pendiente se reparte solo en los días que quedan. Si dos ediciones del mismo libro, uso la nueva y pauso la anterior.'));
  };
  await draw();
  modal({ title: 'Mi cronograma ENEM', wide: true, body });
}
