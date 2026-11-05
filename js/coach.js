// Loona entrenadora: cuenta el tiempo que estudias DE VERDAD (pantalla de estudio abierta y tú tocando,
// escribiendo o pasando páginas), te pone una meta diaria, lleva tu racha y te empuja con cariño para que
// pases el mayor tiempo posible estudiando bien: pomodoros, descansos, "¿sigues ahí?" y celebraciones.
import { h, toast } from './ui.js';

const K = 'loonaCoach';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const yesterday = () => { const d = new Date(Date.now() - 864e5); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const load = () => { try { return JSON.parse(localStorage.getItem(K)) || {}; } catch { return {}; } };
let S = load();
const save = () => { try { localStorage.setItem(K, JSON.stringify(S)); } catch { } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const say = async t => { try { (await import('./loona.js')).speak(t); } catch { } };

export const coachOn = () => S.on !== false;
export const setCoach = v => { S.on = !!v; save(); };
export const goal = () => S.goal || 180;
export const setGoal = m => { S.goal = m; save(); };
// cambia de día: la racha sube si ayer estudiaste al menos 30 min
function rollDay() {
  const t = today(); if (S.day === t) return;
  if (S.day) S.streak = S.day === yesterday() && (S.min || 0) >= 30 ? (S.streak || 0) + 1 : 0;   // un día sin estudiar corta la racha
  S.prev = S.min || 0; S.day = t; S.min = 0; S.blocks = 0; S.goalDone = false; save();
}
export function stats() { rollDay(); return { min: Math.floor(S.min || 0), goal: goal(), streak: S.streak || 0, left: Math.max(0, goal() - Math.floor(S.min || 0)) }; }
export const statsLine = () => { const s = stats(); return `Hoy: ${s.min}/${s.goal} min${s.streak ? ' · racha ' + s.streak + (s.streak === 1 ? ' día' : ' días') : ''}`; };
// lo que Loona sabe para hablarte con contexto
export function coachCtx() { const s = stats(); return `\nEstudio de Eve hoy: ${s.min} de ${s.goal} minutos efectivos (le faltan ${s.left}); racha: ${s.streak} días seguidos.` + briefTxt; }

const studying = () => /^#\/(e|c)\//.test(location.hash);
let lastAct = Date.now(), hiddenAt = 0, lastNudge = 0, homeSince = Date.now(), started = false;
const MSG = {
  idle: ['¿Sigues ahí, Eve? Una página más y te dejo en paz.', 'Eve, se te fue la mirada. Vuelve, que vas bien.', 'Te quedaste quieta. Respira y lee el siguiente párrafo conmigo.', 'Ey. Dos minutos más de concentración, tú puedes.'],
  back: m => [`Volviste. Te faltan ${m} minutos para tu meta de hoy. Seguimos.`, `Bienvenida de vuelta. ${m} minutos y cumplimos la meta.`, `Ya, el celular puede esperar. Faltan ${m} minutos.`],
  block: ['Veinticinco minutos de estudio de verdad. Estoy orgullosa. Toma cinco de descanso, yo te aviso.', 'Otro bloque completo. Así se entra a Medicina. Cinco minutos de pausa.', 'Bien, Eve. Estírate, toma agua; en cinco minutos seguimos.'],
  goal: s => [`¡Meta cumplida! ${s} minutos hoy. Eso es constancia de futura médica.`, `Lo lograste, Eve: ${s} minutos. Si te quedan ganas, un repaso cortito y listo.`],
  start: m => [`Hoy te faltan ${m} minutos. ¿Empezamos? Te dejo donde te quedaste.`, `Eve, ${m} minutos para tu meta de hoy. Un bloque de veinticinco y vemos.`, `El ENEM se gana un día a la vez. Hoy faltan ${m} minutos. Vamos.`],
};

export function startCoach() {
  if (started) return; started = true; rollDay();
  const act = () => { lastAct = Date.now(); };
  ['pointerdown', 'keydown', 'wheel', 'touchmove'].forEach(ev => addEventListener(ev, act, { passive: true, capture: true }));
  addEventListener('scroll', act, { passive: true, capture: true });
  addEventListener('hashchange', () => { homeSince = Date.now(); if (studying()) maybeStartBlock(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    const away = hiddenAt ? Date.now() - hiddenAt : 0; hiddenAt = 0; act();
    if (!coachOn() || !studying() || away < 60000) return;
    const s = stats(); if (s.left > 0 && Date.now() - lastNudge > 3 * 60000) { lastNudge = Date.now(); say(pick(MSG.back(s.left))); }
  });
  setInterval(tick, 15000);
  setTimeout(dailyBrief, 6000);
}
// una vez al día: qué toca estudiar hoy (cronograma) y cuántas preguntas falladas hay que repasar
let briefTxt = '';
async function dailyBrief() {
  try {
    const P = await import('./plan.js'), E = await import('./errors.js');
    const today = await P.todayPlan(), st = await E.errorsSummary();
    briefTxt = (today.length ? ' Plan de hoy: ' + P.planLine(today) + '.' : '') + (st.due ? ` Preguntas falladas para repasar hoy: ${st.due}.` : '');
    if (!coachOn() || !briefTxt || S.brief === today_()) return;
    S.brief = today_(); save();
    const parts = [];
    if (today.length) parts.push('Hoy toca ' + P.planLine(today).replace(/ · /g, '; ') + '.');
    if (st.due) parts.push(`Y tienes ${st.due} ${st.due === 1 ? 'pregunta' : 'preguntas'} de las que fallaste para repasar. Están en la pestaña Errores.`);
    say('Eve. ' + parts.join(' '));
  } catch (e) { console.warn('plan', e); }
}
const today_ = () => today();
// al abrir el cuaderno o un PDF: si no hay temporizador, empieza un bloque de 25 min
function maybeStartBlock() {
  if (!coachOn()) return;
  let p = null; try { p = JSON.parse(localStorage.getItem('pomo')); } catch { }
  if (p && p.end > Date.now()) return;
  try { localStorage.setItem('pomo', JSON.stringify({ end: Date.now() + 25 * 60000, kind: 'estudio' })); } catch { }
  import('./home.js').then(m => m.pomoTick()).catch(() => { });
}
export async function tick() {
  rollDay();
  const vis = document.visibilityState === 'visible', now = Date.now();
  if (vis && studying() && now - lastAct < 120000 && !onBreak()) {   // estudio efectivo: pantalla de estudio abierta y tú activa
    S.min = (S.min || 0) + .25; save();
    const blocks = Math.floor(S.min / 25);
    if (blocks > (S.blocks || 0)) { import('./game.js').then(G => G.award('bloque')).catch(() => { }); if (!coachOn()) { S.blocks = blocks; save(); } }
    trackPdf();
    if (coachOn() && blocks > (S.blocks || 0)) {
      S.blocks = blocks; save();
      if (!S.goalDone && S.min >= goal()) { S.goalDone = true; save(); say(pick(MSG.goal(Math.floor(S.min)))); celebrate(); }
      else { say(pick(MSG.block)); try { localStorage.setItem('pomo', JSON.stringify({ end: now + 5 * 60000, kind: 'pausa' })); } catch { } (await import('./home.js')).pomoTick(); }
    } else if (coachOn() && !S.goalDone && S.min >= goal()) { S.goalDone = true; save(); say(pick(MSG.goal(Math.floor(S.min)))); celebrate(); }
  }
  if (!coachOn() || !vis) return;
  // en el cuaderno pero sin hacer nada hace 4 minutos (y sin descanso puesto)
  if (studying() && now - lastAct > 4 * 60000 && now - lastNudge > 10 * 60000 && !onBreak()) { lastNudge = now; say(pick(MSG.idle)); }
  // en la agenda sin estudiar: a los 2 minutos te invita a empezar
  if (!studying() && now - homeSince > 2 * 60000 && now - lastNudge > 20 * 60000 && stats().left > 0 && now - lastAct < 5 * 60000) { lastNudge = now; say(pick(MSG.start(stats().left))); }
}
const onBreak = () => { try { const p = JSON.parse(localStorage.getItem('pomo')); return p?.kind === 'pausa' && p.end > Date.now(); } catch { return false; } };
function celebrate() {
  const el = h('div', { class: 'coach-party', 'aria-hidden': 'true' }, ...Array.from({ length: 26 }, (_, i) => h('i', { style: { left: (i * 37 % 100) + '%', animationDelay: (i % 9) * .12 + 's' } })));
  document.body.append(el); setTimeout(() => el.remove(), 4200);
  toast('Meta de hoy cumplida · ' + statsLine(), 4000);
}

// páginas del PDF que de verdad leíste: si cubres una unidad del cronograma, se marca sola
const VK = 'pdfSeen';
let lastAuto = 0;
async function trackPdf() {
  try {
    const cur = (await import('./study.js')).getCurrent?.(); const pdf = cur?.pdf; if (!pdf?.rec?.id || !pdf.currentPage) return;
    const n = pdf.currentPage(); if (!n) return;
    let all = {}; try { all = JSON.parse(localStorage.getItem(VK)) || {}; } catch { }
    const set = new Set(all[pdf.rec.id] || []); if (!set.has(n)) { set.add(n); all[pdf.rec.id] = [...set]; try { localStorage.setItem(VK, JSON.stringify(all)); } catch { } }
    if (Date.now() - lastAuto < 60000) return; lastAuto = Date.now();
    const done = await (await import('./plan.js')).autoComplete(pdf.rec.id, set);
    if (done.length) { const L = await import('./loona.js'); L.speak(done.length === 1 ? `Unidad completada: ${done[0].title}. Bien, Eve.` : `${done.length} unidades completadas. Vas volando.`); }
  } catch (e) { console.warn('pdf', e); }
}
