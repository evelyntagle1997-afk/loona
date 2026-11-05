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
// 1) el índice interno del PDF (marcadores)  2) si no tiene, la IA lee las primeras páginas (sumario)
export async function readChapters(rec) {
  const doc = await pdfDoc(rec);
  const out = [];
  try {
    const ol = await doc.getOutline();
    const pageOf = async it => { try { const dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest; return dest ? (await doc.getPageIndex(dest[0])) + 1 : null; } catch { return null; } };
    if (ol?.length) {
      const top = ol.length >= 3 ? ol : ol.flatMap(x => x.items?.length ? x.items : [x]);   // si hay 1-2 grandes partes, uso sus capítulos
      for (const it of top.slice(0, 80)) out.push({ title: (it.title || '').trim().slice(0, 90), page: await pageOf(it) });
    }
  } catch { }
  if (out.length >= 3) return { chapters: out.filter(c => c.title), pages: doc.numPages, how: 'índice del PDF' };
  // la IA lee el sumario de las primeras páginas
  const s = await db.settings();
  if (!s.geminiKey) return { chapters: [], pages: doc.numPages, how: 'sin índice' };
  let text = '';
  for (let p = 1; p <= Math.min(12, doc.numPages); p++) { const tc = await (await doc.getPage(p)).getTextContent(); text += `\n--- página ${p} ---\n` + tc.items.map(i => i.str).join(' '); if (text.length > 24000) break; }
  const L = await import('./loona.js');
  const t = await L.aiText(s, `Este es el comienzo de un libro/apostila de estudio (${rec.name}). Busca el ÍNDICE o SUMARIO y devuelve SOLO JSON: {"capitulos":[{"titulo":"…","pagina":número o null}]} con los capítulos o unidades principales en orden (máximo 60; si hay unidades con capítulos dentro, usa los capítulos). Si no hay índice, devuelve {"capitulos":[]}.\n\n${text.slice(0, 24000)}`, { fast: true });
  let caps = []; try { caps = JSON.parse(t.replace(/^[\s\S]*?(\{)/, '$1').replace(/\}[^}]*$/, '}')).capitulos || []; } catch { }
  return { chapters: caps.filter(c => c?.titulo).map(c => ({ title: String(c.titulo).slice(0, 90), page: +c.pagina || null })), pages: doc.numPages, how: caps.length ? 'sumario leído por la IA' : 'sin índice' };
}

// ---------- reparto de capítulos en los días ----------
function studyDays(from, deadline, rest) { const out = []; for (let t = day0(from); t <= day0(new Date(deadline + 'T12:00')); t += DAY) if (!rest.includes(new Date(t).getDay())) out.push(t); return out; }
// Los capítulos pendientes de cada libro se reparten a lo largo de todos los días que quedan, intercalando materias.
export function schedule(plan, from = Date.now()) {
  const days = studyDays(from, plan.deadline, plan.restDays || []);
  const map = {}; if (!days.length) return map;
  for (const b of plan.books) {
    const pend = b.chapters.map((c, i) => ({ ...c, i })).filter(c => !c.done);
    if (!pend.length) continue;
    const per = pend.length / days.length;   // capítulos por día (puede ser < 1: un capítulo cada varios días)
    pend.forEach((c, j) => { const di = Math.min(days.length - 1, Math.floor(j / per)); (map[dkey(days[di])] ||= []).push({ book: b.id, name: b.name, subject: b.subject, ch: c }); });
  }
  return map;
}
export async function todayPlan() { const p = await getPlan(); return (schedule(p)[dkey(Date.now())] || []); }
const groupByBook = items => { const g = {}; items.forEach(x => (g[x.book] ||= { id: x.book, name: x.name, subject: x.subject, chs: [] }).chs.push(x.ch)); return Object.values(g); };
export const planLine = items => groupByBook(items).map(g => `${g.subject || g.name}: ${g.chs.length === 1 ? 'capítulo «' + g.chs[0].title + '»' : g.chs.length + ' capítulos'}`).join(' · ');

// ---------- ventana del cronograma ----------
export async function openPlan() {
  const body = h('div', { class: 'plan' });
  const draw = async () => {
    const plan = await getPlan();
    const subjects = await db.all('subject'), pdfs = (await db.all('pdf')).filter(p => !p.deleted);
    const sName = id => subjects.find(s => s.id === id)?.name || '';
    const map = schedule(plan), today = [...(map[dkey(Date.now())] || [])];
    // lo que ya terminaste hoy sigue en la lista de hoy (marcado), para que no aparezcan capítulos nuevos de golpe
    plan.books.forEach(b => b.chapters.forEach((c, i) => { if (c.done && c.doneAt && dkey(c.doneAt) === dkey(Date.now())) today.push({ book: b.id, name: b.name, subject: b.subject, ch: { ...c, i } }); }));
    today.sort((a, b) => a.book === b.book ? a.ch.i - b.ch.i : 0);
    const totalCh = plan.books.reduce((a, b) => a + b.chapters.length, 0), doneCh = plan.books.reduce((a, b) => a + b.chapters.filter(c => c.done).length, 0);
    const daysLeft = Math.max(0, Math.ceil((day0(new Date(plan.deadline + 'T12:00')) - day0(Date.now())) / DAY));
    // hoy
    const todayBox = h('div', { class: 'plan-today' }, h('h3', {}, 'Hoy · ' + fmtD(Date.now())),
      ...(today.length ? groupByBook(today).map(g => h('div', { class: 'plan-book' }, h('b', {}, (g.subject ? g.subject + ' — ' : '') + g.name),
        ...g.chs.map(c => h('label', { class: 'plan-ch' }, h('input', { type: 'checkbox', checked: !!c.done, onchange: async e => { const p = await getPlan(); const b = p.books.find(x => x.id === g.id); if (b) { b.chapters[c.i].done = e.target.checked; b.chapters[c.i].doneAt = Date.now(); await savePlan(p); if (e.target.checked) import('./loona.js').then(L => L.bubble('Capítulo listo. Uno menos para Medicina.')); } } }), h('span', {}, c.title + (c.page ? ` (pág. ${c.page})` : ''))))))
        : [h('p', { class: 'opt-hint' }, plan.books.length ? 'Hoy no tienes capítulos nuevos: repasa tus errores o adelanta.' : 'Agrega tus PDF abajo y armo tu cronograma.')]));
    // próximos 14 días
    const next = h('div', { class: 'plan-next' });
    for (let d = 1; d <= 14; d++) { const t = day0(Date.now()) + d * DAY, it = map[dkey(t)]; if (it?.length) next.append(h('div', { class: 'plan-day' }, h('b', {}, new Date(t).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })), h('span', {}, planLine(it)))); }
    // libros
    const books = h('div', { class: 'plan-books' }, ...plan.books.map(b => { const d = b.chapters.filter(c => c.done).length;
      return h('div', { class: 'plan-brow' }, h('span', {}, h('b', {}, b.name), h('small', {}, `${b.subject || ''} · ${d}/${b.chapters.length} capítulos · ${b.how || ''}`)),
        h('i', { class: 'plan-bar' }, h('i', { style: { width: (b.chapters.length ? d / b.chapters.length * 100 : 0) + '%' } })),
        h('button', { class: 'chip', onclick: async () => { const p = await getPlan(); p.books = p.books.filter(x => x.id !== b.id); await savePlan(p); draw(); } }, 'Quitar')); }));
    const free = pdfs.filter(p => !plan.books.some(b => b.id === p.id));
    const sel = h('select', { class: 'field' }, ...free.map(p => h('option', { value: p.id }, (sName(p.subject) ? sName(p.subject) + ' — ' : '') + p.name)));
    const addBtn = h('button', { class: 'btn primary', disabled: !free.length, onclick: async () => {
      const rec = pdfs.find(p => p.id === sel.value); if (!rec) return;
      addBtn.textContent = 'Leyendo el índice…'; addBtn.disabled = true;
      try {
        let r = await readChapters(rec);
        if (!r.chapters.length) { const n = Math.max(1, Math.round(r.pages / 20)); r = { chapters: Array.from({ length: n }, (_, i) => ({ title: `Parte ${i + 1} (págs. ${i * 20 + 1}–${Math.min(r.pages, (i + 1) * 20)})`, page: i * 20 + 1 })), pages: r.pages, how: 'sin índice: partes de 20 páginas' }; }
        const p = await getPlan(); p.books.push({ id: rec.id, name: rec.name, subject: sName(rec.subject), chapters: r.chapters, how: r.how, added: Date.now() }); await savePlan(p);
        toast(`${r.chapters.length} capítulos de «${rec.name}» en tu cronograma`, 3000);
      } catch (e) { toast(e.message, 4500); }
      draw();
    } }, free.length ? 'Agregar al cronograma' : 'Todos tus PDF ya están');
    const dl = h('input', { class: 'field', type: 'date', value: plan.deadline, onchange: async e => { const p = await getPlan(); p.deadline = e.target.value || DEADLINE_DEFAULT; await savePlan(p); draw(); } });
    const restRow = h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Días de descanso:'), ...['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((n, i) => h('button', { class: 'chip' + ((plan.restDays || []).includes(i) ? ' on' : ''), onclick: async () => { const p = await getPlan(); const r = new Set(p.restDays || []); r.has(i) ? r.delete(i) : r.add(i); p.restDays = [...r]; await savePlan(p); draw(); } }, n)));
    body.replaceChildren(
      h('div', { class: 'errv-top' }, h('div', {}, h('b', { class: 'errv-big' }, String(daysLeft)), h('small', {}, 'días hasta la meta')), h('div', {}, h('b', { class: 'errv-big' }, `${doneCh}/${totalCh}`), h('small', {}, 'capítulos')), h('div', {}, h('b', { class: 'errv-big' }, totalCh ? Math.round(doneCh / totalCh * 100) + '%' : '0%'), h('small', {}, 'avance'))),
      todayBox, ...(next.childNodes.length ? [h('div', {}, h('h3', {}, 'Próximos días'), next)] : []),
      h('h3', {}, 'Mis PDF en el cronograma'), books, h('div', { class: 'ie-row' }, sel, addBtn),
      h('div', { class: 'ie-row' }, h('span', { class: 'opt-hint' }, 'Terminar todo antes de:'), dl), restRow,
      h('p', { class: 'opt-hint' }, 'Cómo funciona: leo el índice de cada PDF y reparto los capítulos que faltan entre los días que quedan, intercalando materias. Si un día no estudias, lo pendiente se reparte solo en los días siguientes. Las preguntas que fallas vuelven 2 semanas después en «Errores».'));
  };
  await draw();
  modal({ title: 'Mi cronograma ENEM', wide: true, body });
}
