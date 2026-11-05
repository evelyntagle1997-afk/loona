// Mis errores: cada pregunta que respondes mal queda anotada (fecha, materia, tema, enunciado, lo que respondiste,
// lo correcto, por qué te equivocaste y un tip). Loona te las vuelve a preguntar con repaso espaciado:
// 2 semanas después; si aciertas, al mes; si vuelves a fallar, a la semana. Tras 2 aciertos seguidos, dominada.
import * as db from './db.js';
import { h, modal, toast, esc } from './ui.js';

const DAY = 864e5;
const dkey = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fmtD = t => new Date(t).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' });
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return +d; };
export const INTERVALS = { first: 14, ok1: 30, fail: 7 };

export async function allErrors() { return (await db.all('error')).sort((a, b) => b.date - a.date); }
export async function dueErrors(at = Date.now()) { return (await allErrors()).filter(e => !e.mastered && e.due <= startOfDay(at) + DAY - 1); }

// texto del ENEM (markdown sencillo + imágenes) -> HTML seguro
export function richText(t) {
  return esc(t || '')
    .replace(/!\[[^\]]*\]\((https:\/\/[^)\s"]+)\)/g, '<img src="$1" alt="" loading="lazy">')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
}

// guarda un error nuevo (abre el formulario para que anotes por qué te equivocaste)
export function recordError(q, { onSaved } = {}) {
  const why = h('textarea', { class: 'field', rows: 2, placeholder: '¿Por qué crees que te equivocaste? (no leí bien, confundí conceptos, me faltó la fórmula…)' });
  const tip = h('textarea', { class: 'field', rows: 2, placeholder: 'Tip u observación para la próxima vez' }, q.explicacion || '');
  const askAI = h('button', { class: 'btn', onclick: async () => {
    askAI.textContent = 'Loona está pensando…';
    try {
      const s = await db.settings(); const L = await import('./loona.js');
      const t = await L.aiText(s, `Pregunta: ${q.stem}\nAlternativas: ${q.alts.map(a => a[0] + ') ' + a[1]).join(' | ')}\nEve respondió ${q.mine}; la correcta es ${q.correct}.\nResponde en español, en dos líneas exactas:\nPOR QUE: (por qué probablemente eligió ${q.mine} y en qué se equivocó, 1-2 frases)\nTIP: (cómo reconocer la correcta la próxima vez, 1 frase)`, { fast: true });
      const pw = /POR QU[EÉ]:\s*(.+)/i.exec(t)?.[1], tp = /TIP:\s*(.+)/i.exec(t)?.[1];
      if (pw && !why.value.trim()) why.value = pw.trim(); if (tp) tip.value = tp.trim();
    } catch (e) { toast(e.message, 3500); }
    askAI.textContent = 'Que Loona me explique';
  } }, 'Que Loona me explique');
  modal({ title: 'Anotar mi error', wide: true, body: h('div', { class: 'err-form' },
    h('p', { class: 'opt-hint' }, `${fmtD(Date.now())} · ${q.subject || 'Sin materia'} · ${q.topic || 'Sin tema'} · ${q.source}`),
    h('div', { class: 'err-stem', html: richText(q.stem) }),
    h('p', {}, h('b', {}, 'Respondí: '), h('span', { class: 'err-bad' }, q.mine + ') ' + (q.alts.find(a => a[0] === q.mine)?.[1] || ''))),
    h('p', {}, h('b', {}, 'Era: '), h('span', { class: 'err-ok' }, q.correct + ') ' + (q.alts.find(a => a[0] === q.correct)?.[1] || ''))),
    h('label', { class: 'opt-hint' }, '¿Por qué erré?'), why, h('label', { class: 'opt-hint' }, 'Tip u observación'), tip, askAI,
    h('p', { class: 'opt-hint' }, `Loona te la vuelve a preguntar el ${fmtD(Date.now() + INTERVALS.first * DAY)} (en 2 semanas).`)),
    actions: [{ label: 'No anotar' }, { label: 'Guardar error', primary: true, onclick: async () => {
      const rec = { id: db.uid('err_'), kind: 'error', date: Date.now(), subject: q.subject || '', topic: q.topic || '', source: q.source, qid: q.qid || '',
        stem: q.stem, alts: q.alts, mine: q.mine, correct: q.correct, why: why.value.trim(), tip: tip.value.trim(), explicacion: q.explicacion || '',
        due: startOfDay(Date.now()) + INTERVALS.first * DAY, step: 0, reviews: [], mastered: false };
      await db.put(rec); toast('Error guardado en tu pestaña de Errores', 2500); onSaved?.(rec);
    } }] });
}

// repaso: respondes de nuevo y se reprograma
function grade(e, ok) {
  e.reviews = [...(e.reviews || []), { date: Date.now(), ok }];
  if (ok) { e.step = (e.step || 0) + 1; if (e.step >= 2) e.mastered = true; else e.due = startOfDay(Date.now()) + INTERVALS.ok1 * DAY; }
  else { e.step = 0; e.due = startOfDay(Date.now()) + INTERVALS.fail * DAY; }
  import('./game.js').then(G => G.award(ok ? 'repaso_ok' : 'repaso_fail', { topic: e.topic })).catch(() => { });
  return db.put(e);
}
export async function reviewSession(list) {
  list = list || await dueErrors();
  if (!list.length) return toast('No tienes preguntas para repasar hoy. ¡Bien!', 2500);
  let i = 0, right = 0; const box = h('div', { class: 'err-rev' });
  const m = modal({ title: 'Repaso de mis errores', wide: true, body: box, onClose: () => refresh() });
  const show = () => {
    if (i >= list.length) { box.replaceChildren(h('p', { class: 'err-done' }, `Listo: ${right} de ${list.length} bien.`), h('p', { class: 'opt-hint' }, right === list.length ? 'Las que acertaste vuelven en un mes; dos aciertos seguidos y quedan dominadas.' : 'Las que fallaste vuelven en una semana. Lee el tip de cada una antes de dormir.')); import('./loona.js').then(L => L.speak(right === list.length ? 'Todas bien, Eve. Eso es aprender de verdad.' : `${right} de ${list.length}. Las otras vuelven en una semana; vas mejorando.`)); return; }
    const e = list[i];
    const alts = h('div', { class: 'quiz-alts' }, ...e.alts.map(([L, t]) => h('button', { class: 'quiz-alt', onclick: async ev => {
      alts.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.dataset.l === e.correct) b.classList.add('ok'); });
      const ok = L === e.correct; if (!ok) ev.currentTarget.classList.add('bad'); else right++;
      await grade(e, ok);
      box.append(h('div', { class: 'err-tip' }, h('b', {}, ok ? '¡Bien! ' : 'Otra vez no. '), e.tip || e.explicacion || ''), h('button', { class: 'btn primary', onclick: () => { i++; show(); } }, i + 1 < list.length ? 'Siguiente' : 'Terminar'));
    }, 'data-l': L }, h('b', {}, L + ')'), ' ', h('span', { html: richText(t) }))));
    box.replaceChildren(h('p', { class: 'opt-hint' }, `${i + 1} de ${list.length} · ${e.subject} · ${e.topic} · ${e.source} · anotada el ${fmtD(e.date)}`), h('div', { class: 'err-stem', html: richText(e.stem) }), alts);
  };
  show();
}

// ---------- vista completa: errores organizados por materia y tema + calendario de repasos ----------
let refresh = () => { };
export async function openErrors() {
  const body = h('div', { class: 'errv' });
  const draw = async () => {
    const all = await allErrors(), due = all.filter(e => !e.mastered && e.due <= startOfDay(Date.now()) + DAY - 1);
    const subj = [...new Set(all.map(e => e.subject || 'Sin materia'))];
    const fs = h('select', { class: 'field' }, h('option', { value: '' }, 'Todas las materias'), ...subj.map(s => h('option', { value: s }, s)));
    const list = h('div', { class: 'errv-list' });
    const paint = () => {
      const f = fs.value, sel = all.filter(e => !f || (e.subject || 'Sin materia') === f);
      const groups = {}; for (const e of sel) ((groups[e.subject || 'Sin materia'] ||= {})[e.topic || 'Sin tema'] ||= []).push(e);
      list.replaceChildren(...(sel.length ? Object.entries(groups).flatMap(([s, tops]) => [h('h3', { class: 'errv-s' }, s), ...Object.entries(tops).map(([t, es]) => h('details', { class: 'errv-t' },
        h('summary', {}, `${t} · ${es.length} ${es.length === 1 ? 'error' : 'errores'}`),
        ...es.map(e => h('div', { class: 'errv-e' + (e.mastered ? ' done' : '') },
          h('p', { class: 'opt-hint' }, `${fmtD(e.date)} · ${e.source}${e.mastered ? ' · dominada ✓' : ' · repaso: ' + fmtD(e.due)}`),
          h('div', { class: 'err-stem', html: richText(e.stem) }),
          h('p', {}, h('b', {}, 'Respondí: '), h('span', { class: 'err-bad' }, e.mine), ' · ', h('b', {}, 'Era: '), h('span', { class: 'err-ok' }, e.correct + ') ' + (e.alts.find(a => a[0] === e.correct)?.[1] || ''))),
          e.why && h('p', {}, h('b', {}, '¿Por qué erré? '), e.why), (e.tip || e.explicacion) && h('p', {}, h('b', {}, 'Tip: '), e.tip || e.explicacion),
          h('button', { class: 'chip', onclick: async () => { await db.remove(e.id); draw(); } }, 'Borrar')))))])
        : [h('p', { class: 'opt-hint' }, 'Todavía no hay errores anotados. Cuando falles una pregunta del cuestionario de un resumen, aparece aquí.')]));
    };
    fs.addEventListener('change', paint); paint();
    // calendario: qué repasas cada día de las próximas 5 semanas
    const cal = h('div', { class: 'errv-cal' });
    const by = {}; all.filter(e => !e.mastered).forEach(e => (by[dkey(Math.max(e.due, startOfDay(Date.now())))] ||= []).push(e));
    for (let d = 0; d < 35; d++) { const t = startOfDay(Date.now()) + d * DAY, k = dkey(t), n = by[k]?.length || 0;
      cal.append(h('button', { class: 'errv-day' + (n ? ' has' : '') + (d === 0 ? ' today' : ''), title: n ? n + ' para repasar' : '', onclick: () => n && reviewSession(by[k]) }, h('small', {}, new Date(t).toLocaleDateString('es', { weekday: 'narrow' })), h('b', {}, new Date(t).getDate()), n ? h('i', {}, n) : null)); }
    const mastered = all.filter(e => e.mastered).length;
    body.replaceChildren(
      h('div', { class: 'errv-top' }, h('div', {}, h('b', { class: 'errv-big' }, String(due.length)), h('small', {}, 'para repasar hoy')), h('div', {}, h('b', { class: 'errv-big' }, String(all.length - mastered)), h('small', {}, 'pendientes')), h('div', {}, h('b', { class: 'errv-big' }, String(mastered)), h('small', {}, 'dominadas')),
        h('button', { class: 'btn primary', disabled: !due.length, onclick: () => reviewSession(due) }, due.length ? 'Repasar ahora' : 'Nada para hoy')),
      h('p', { class: 'opt-hint' }, 'Calendario de repasos (toca un día con número para repasar esas preguntas):'), cal,
      h('div', { class: 'ie-row' }, fs), list);
  };
  refresh = draw; await draw();
  modal({ title: 'Mis errores', wide: true, body, onClose: () => { refresh = () => { }; } });
}
export async function errorsSummary() { const all = await allErrors(); return { total: all.length, due: all.filter(e => !e.mastered && e.due <= startOfDay(Date.now()) + DAY - 1).length, pending: all.filter(e => !e.mastered).length }; }
