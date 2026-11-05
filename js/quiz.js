// Cuestionario de cada resumen: preguntas REALES del ENEM (2009-2023) sobre el tema + preguntas de práctica
// estilo vestibular creadas por la IA. Si fallas, se abre «Anotar mi error».
import { h, toast } from './ui.js';
import { recordError, richText } from './errors.js';

const ANS = 'quizAns';
const getAns = () => { try { return JSON.parse(localStorage.getItem(ANS)) || {}; } catch { return {}; } };
const setAns = (id, l) => { const a = getAns(); a[id] = l; try { localStorage.setItem(ANS, JSON.stringify(a)); } catch { } };

export async function fetchEnem(area, kws, n = 12) {
  if (!kws?.length) return [];
  try {
    const r = await fetch(`/api/enem?area=${encodeURIComponent(area || '')}&n=${n}&k=${encodeURIComponent(kws.join(','))}`, { cache: 'no-store' });
    if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) return [];
    return ((await r.json()).items || []).map(q => ({
      qid: 'enem-' + q.id, source: `ENEM ${q.y} · Q${q.i}`, real: true,
      stem: (q.c ? q.c + '\n\n' : '') + (q.f || []).map(u => `![](${u})`).join('\n') + (q.q ? '\n\n**' + q.q + '**' : ''),
      alts: q.a.map(([L, t, f]) => [L, (t || '') + (f ? ` ![](${f})` : '')]), correct: q.r }));
  } catch { return []; }
}
const practiceQs = el => (el.practica || []).filter(p => p?.enunciado && p.alternativas).map((p, i) => ({
  qid: 'pr-' + (el.id || el.title) + '-' + i, source: `Práctica estilo ${p.estilo || 'vestibular'} (creada por IA)`, real: false,
  stem: p.enunciado, alts: Object.entries(p.alternativas).map(([L, t]) => [L, t]), correct: (p.correcta || '').trim().toUpperCase().slice(0, 1), explicacion: p.explicacion || '' }));

// sección del cuestionario dentro del resumen. save(el) guarda las preguntas del ENEM en el resumen (funcionan sin internet)
export function quizSection(el, subject, save) {
  const wrap = h('details', { class: 'lam-quiz', open: false }, h('summary', {}, h('span', {}, 'Preguntas ENEM y vestibulares'), h('small', {}, 'cargando…')));
  const fill = qs => {
    const ans = getAns();
    wrap.querySelector('small').textContent = qs.length ? `${qs.length} preguntas · responde y aprende de tus errores` : 'sin preguntas todavía (usa «Ordenar con IA»)';
    wrap.querySelectorAll('.qz').forEach(n => n.remove());
    qs.forEach((q, k) => {
      const alts = h('div', { class: 'quiz-alts' });
      const feedback = h('div', { class: 'qz-fb' });
      const mark = (L, fresh) => {
        alts.querySelectorAll('button').forEach(b => { b.disabled = true; if (b.dataset.l === q.correct) b.classList.add('ok'); if (b.dataset.l === L && L !== q.correct) b.classList.add('bad'); });
        const ok = L === q.correct;
        feedback.replaceChildren(h('b', {}, ok ? '¡Correcto! ' : `Era la ${q.correct}. `), q.explicacion || '',
          !ok ? h('button', { class: 'chip', onclick: e => { e.stopPropagation(); recordError({ ...q, mine: L, subject, topic: el.title }); } }, 'Anotar mi error') : null);
        if (fresh && !ok) recordError({ ...q, mine: L, subject, topic: el.title });
        if (fresh) import('./loona.js').then(m => m.bubble(ok ? 'Bien, Eve.' : 'Tranquila: de los errores se aprende. Anótalo.'));
      };
      q.alts.forEach(([L, t]) => alts.append(h('button', { class: 'quiz-alt', 'data-l': L, onclick: e => { e.stopPropagation(); setAns(q.qid, L); mark(L, true); } }, h('b', {}, L + ')'), ' ', h('span', { html: richText(t) }))));
      wrap.append(h('div', { class: 'qz' + (q.real ? ' real' : '') }, h('p', { class: 'qz-src' }, `${k + 1}. ${q.source}`), h('div', { class: 'qz-stem', html: richText(q.stem) }), alts, feedback));
      if (ans[q.qid]) mark(ans[q.qid], false);
    });
  };
  const prac = practiceQs(el);
  if (el.enemQs) fill([...el.enemQs, ...prac]);
  else if (el.enem?.palabras_pt?.length) fetchEnem(el.enem.area, el.enem.palabras_pt).then(qs => { el.enemQs = qs; fill([...qs, ...prac]); if (qs.length) save?.(el); });
  else fill(prac);
  return wrap;
}
