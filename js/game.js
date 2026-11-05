// Modo juego: ganas XP por estudiar de verdad, subes de nivel rumbo a "Doctora Eve", cumples misiones diarias
// que se completan solas y desbloqueas logros. Todo se guarda en la nube con tu cuenta.
import * as db from './db.js';
import { h, modal, toast } from './ui.js';

const ID = 'game';
const XP = { unidad: 60, repaso_ok: 20, repaso_fail: 6, quiz_ok: 12, quiz_fail: 4, bloque: 25, mision: 80, materia: 400, racha: 50 };
export const LEVELS = ['Aprendiz de la noche', 'Lectora de grimorios', 'Alquimista novata', 'Guardiana del atlas', 'Cazadora de errores', 'Bruja de la célula', 'Estratega del ENEM', 'Interna de la luna', 'Residente gótica', 'Futura médica', 'Doctora Eve · UNILA'];
const need = n => Math.round(300 * Math.pow(n, 1.55));   // XP total para llegar al nivel n+1
export const levelOf = xp => { let n = 0; while (n < 60 && xp >= need(n + 1)) n++; return { n: n + 1, name: LEVELS[Math.min(LEVELS.length - 1, Math.floor(n / 2))], from: need(n), to: need(n + 1), xp }; };
const dkey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

let G = null;
export async function state() { if (G) return G; const r = await db.get(ID); G = r && !r.deleted ? r : { id: ID, kind: 'game', xp: 0, log: [], badges: {}, counts: {}, days: {}, missions: {} }; return G; }
const save = () => db.put(G);
const fx = new Set(); export const onGame = fn => { fx.add(fn); return () => fx.delete(fn); };
const emit = () => fx.forEach(f => { try { f(G); } catch { } });

// ---------- logros: se desbloquean solos ----------
export const BADGES = [
  ['primera', '🕯️', 'Primera vela', 'Terminaste tu primera unidad', g => (g.counts.unidad || 0) >= 1],
  ['u25', '📜', 'Pergamino lleno', '25 unidades terminadas', g => (g.counts.unidad || 0) >= 25],
  ['u100', '📚', 'Biblioteca prohibida', '100 unidades terminadas', g => (g.counts.unidad || 0) >= 100],
  ['u250', '🏛️', 'Archivo eterno', '250 unidades terminadas', g => (g.counts.unidad || 0) >= 250],
  ['r3', '🔥', 'Tres noches seguidas', 'Racha de 3 días', g => (g.streak || 0) >= 3],
  ['r7', '🌙', 'Semana lunar', 'Racha de 7 días', g => (g.streak || 0) >= 7],
  ['r30', '🦇', 'Mes sin rendirse', 'Racha de 30 días', g => (g.streak || 0) >= 30],
  ['q50', '🎯', 'Tiradora del ENEM', '50 preguntas acertadas', g => (g.counts.quiz_ok || 0) >= 50],
  ['q200', '🏹', 'Francotiradora', '200 preguntas acertadas', g => (g.counts.quiz_ok || 0) >= 200],
  ['e10', '🩹', 'Cicatrices que enseñan', '10 errores repasados bien', g => (g.counts.repaso_ok || 0) >= 10],
  ['e50', '🧠', 'Cerebro de acero', '50 errores repasados bien', g => (g.counts.repaso_ok || 0) >= 50],
  ['m10', '⭐', 'Diez días perfectos', '10 días con todas las misiones', g => (g.counts.diaperfecto || 0) >= 10],
  ['b50', '⏳', 'Reloj de arena', '50 bloques de 25 minutos', g => (g.counts.bloque || 0) >= 50],
  ['materia', '👑', 'Jefa vencida', 'Terminaste un libro completo', g => (g.counts.materia || 0) >= 1],
  ['nv5', '🗝️', 'Llave plateada', 'Llegaste al nivel 5', g => levelOf(g.xp).n >= 5],
  ['nv10', '🩺', 'Bata blanca', 'Llegaste al nivel 10', g => levelOf(g.xp).n >= 10],
];
function checkBadges() {
  const fresh = [];
  for (const [k, ic, name, desc, test] of BADGES) if (!G.badges[k] && test(G)) { G.badges[k] = Date.now(); fresh.push([ic, name, desc]); }
  return fresh;
}

// ---------- ganar XP ----------
export async function award(type, meta = {}) {
  await state();
  const before = levelOf(G.xp).n;
  const pts = XP[type] || 0;
  G.xp += pts; G.counts[type] = (G.counts[type] || 0) + 1;
  const today = dkey();
  if (G.lastDay !== today) { G.streak = G.lastDay === dkey(Date.now() - 864e5) ? (G.streak || 0) + 1 : 1; G.lastDay = today; if (G.streak > 1) G.xp += XP.racha; }
  G.days[today] = (G.days[today] || 0) + pts;
  G.log = [{ t: Date.now(), type, pts, ...meta }, ...(G.log || [])].slice(0, 60);
  // ¿terminó un libro entero? (jefe vencido)
  if (type === 'unidad') {
    try { const P = await import('./plan.js'); const p = await P.getPlan(); for (const b of p.books) if (b.chapters.length && b.chapters.every(c => c.done) && !G.missions['boss-' + b.id]) { G.missions['boss-' + b.id] = Date.now(); G.xp += XP.materia; G.counts.materia = (G.counts.materia || 0) + 1; setTimeout(() => celebrate(`👑 ¡Jefa vencida! Terminaste «${b.name}»`, `+${XP.materia} XP`), 600); } } catch { }
  }
  const fresh = checkBadges();
  await save(); emit();
  floatXP(pts);
  const after = levelOf(G.xp);
  if (after.n > before) setTimeout(() => { celebrate(`Nivel ${after.n}: ${after.name}`, '¡Subiste de nivel!'); import('./loona.js').then(L => L.speak(`Nivel ${after.n}, Eve. ${after.name}. Sigue así.`)); }, 400);
  fresh.forEach(([ic, name, desc], i) => setTimeout(() => celebrate(`${ic} Logro: ${name}`, desc), 900 + i * 1800));
  missionsCheck();
}

// ---------- misiones del día (se completan solas) ----------
export async function missions() {
  await state();
  const P = await import('./plan.js'), E = await import('./errors.js'), C = await import('./coach.js');
  const today = await P.todayPlan(), p = await P.getPlan();
  const allToday = [...today]; p.books.forEach(b => b.chapters.forEach(c => { if (c.done && c.doneAt && dkey(c.doneAt) === dkey()) allToday.push({ ch: c }); }));
  const doneUnits = allToday.filter(x => x.ch.done).length, totalUnits = allToday.length;
  const st = C.stats(), es = await E.errorsSummary();
  const reviewedToday = (await E.allErrors()).filter(e => (e.reviews || []).some(r => dkey(r.date) === dkey())).length;
  const quizToday = (G.log || []).filter(l => /^quiz/.test(l.type) && dkey(l.t) === dkey()).length;
  const list = [
    totalUnits ? { k: 'plan', ic: '📖', t: `Termina tu plan de hoy (${doneUnits}/${totalUnits})`, ok: doneUnits >= totalUnits, p: doneUnits / totalUnits } : null,
    { k: 'tiempo', ic: '⏳', t: `Estudia ${st.goal} minutos efectivos (${st.min}/${st.goal})`, ok: st.min >= st.goal, p: st.min / st.goal },
    es.due + reviewedToday ? { k: 'errores', ic: '🩹', t: `Repasa tus errores de hoy (${reviewedToday}/${es.due + reviewedToday})`, ok: es.due === 0, p: reviewedToday / Math.max(1, es.due + reviewedToday) } : null,
    { k: 'quiz', ic: '🎯', t: `Responde 5 preguntas ENEM (${Math.min(5, quizToday)}/5)`, ok: quizToday >= 5, p: quizToday / 5 },
  ].filter(Boolean);
  return list;
}
let mcBusy = false;
export async function missionsCheck() {
  if (mcBusy) return; mcBusy = true;
  try {
    const list = await missions(), day = dkey();
    G.missions[day] ||= {};
    let changed = false;
    for (const m of list) if (m.ok && !G.missions[day][m.k]) { G.missions[day][m.k] = Date.now(); G.xp += XP.mision; changed = true; celebrate(`${m.ic} Misión cumplida`, m.t.replace(/\s*\(.*\)$/, '') + ` · +${XP.mision} XP`); }
    if (list.length && list.every(m => m.ok) && !G.missions[day].perfecto) { G.missions[day].perfecto = Date.now(); G.counts.diaperfecto = (G.counts.diaperfecto || 0) + 1; changed = true; setTimeout(() => { celebrate('⭐ Día perfecto', 'Todas las misiones de hoy'); import('./loona.js').then(L => L.speak('Día perfecto, Eve. Todas las misiones. Estoy orgullosa de ti.')); }, 1500); }
    if (changed) { checkBadges(); await save(); emit(); }
  } finally { mcBusy = false; }
}

// ---------- efectos ----------
function floatXP(pts) { if (!pts) return; const el = h('div', { class: 'xp-float' }, '+' + pts + ' XP'); document.body.append(el); setTimeout(() => el.remove(), 1600); }
export function celebrate(title, sub) {
  const el = h('div', { class: 'game-toast' }, h('b', {}, title), sub ? h('small', {}, sub) : null);
  document.body.append(el); setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3800);
  const party = h('div', { class: 'coach-party', 'aria-hidden': 'true' }, ...Array.from({ length: 22 }, (_, i) => h('i', { style: { left: (i * 41 % 100) + '%', animationDelay: (i % 7) * .1 + 's' } })));
  document.body.append(party); setTimeout(() => party.remove(), 3800);
}

// ---------- HUD (nivel + barra de XP) ----------
export function hud() {
  const lv = h('b', { class: 'hud-lv' }, '1'), nm = h('span', { class: 'hud-nm' }, ''), bar = h('i', { class: 'hud-bar' }, h('i', {})), mi = h('small', { class: 'hud-mi' }, '');
  const el = h('button', { class: 'game-hud', 'aria-label': 'Mi progreso', onclick: e => { e.stopPropagation(); openGame(); } }, lv, h('span', { class: 'hud-txt' }, nm, bar, mi));
  const paint = async () => { const g = await state(), L = levelOf(g.xp); lv.textContent = L.n; nm.textContent = L.name; bar.firstChild.style.width = Math.round((g.xp - L.from) / (L.to - L.from) * 100) + '%';
    const ms = await missions().catch(() => []); mi.textContent = `${ms.filter(m => m.ok).length}/${ms.length} misiones · ${g.streak || 0}🔥`; };
  paint(); const off = onGame(() => { if (!el.isConnected) return off(); paint(); });
  return el;
}

// ---------- ventana "Mi progreso" ----------
export async function openGame() {
  const g = await state(), L = levelOf(g.xp), ms = await missions();
  const P = await import('./plan.js'); const p = await P.getPlan(); const { contentEnd } = P.phases(p);
  const books = p.books.filter(b => !b.paused);
  const map = h('div', { class: 'gm-map' }, ...books.map(b => { const d = b.chapters.filter(c => c.done).length, n = b.chapters.length, pc = n ? d / n : 0;
    return h('div', { class: 'gm-road' + (pc >= 1 ? ' won' : '') }, h('span', { class: 'gm-sub' }, b.subject || b.name), h('i', { class: 'gm-track' }, h('i', { style: { width: Math.round(pc * 100) + '%' } }), h('b', { class: 'gm-me', style: { left: `calc(${Math.round(pc * 100)}% - 9px)` } }, '🦇'), h('b', { class: 'gm-boss' }, pc >= 1 ? '👑' : '🏰')), h('small', {}, `${d}/${n}`)); }));
  const daysLeft = Math.max(0, Math.ceil((contentEnd - Date.now()) / 864e5));
  modal({ title: 'Mi progreso', wide: true, body: h('div', { class: 'gm' },
    h('div', { class: 'gm-head' }, h('b', { class: 'gm-lv' }, String(L.n)), h('div', {}, h('b', {}, L.name), h('i', { class: 'hud-bar big' }, h('i', { style: { width: Math.round((g.xp - L.from) / (L.to - L.from) * 100) + '%' } })), h('small', {}, `${g.xp} XP · faltan ${L.to - g.xp} para el nivel ${L.n + 1} · racha ${g.streak || 0} 🔥`))),
    h('h3', {}, 'Misiones de hoy'), h('div', { class: 'gm-ms' }, ...ms.map(m => h('div', { class: 'gm-m' + (m.ok ? ' ok' : '') }, h('span', {}, m.ic), h('span', {}, m.t), h('i', { class: 'hud-bar' }, h('i', { style: { width: Math.round(Math.min(1, m.p || 0) * 100) + '%' } })), h('b', {}, m.ok ? '✓' : `+${XP.mision}`)))),
    h('h3', {}, 'Camino a los jefes (un libro = un jefe)'), books.length ? map : h('p', { class: 'opt-hint' }, 'Importa tus PDF en «Plan» y aparece tu mapa.'),
    h('p', { class: 'opt-hint' }, `Faltan ${daysLeft} días de contenido nuevo; después vienen 6 semanas de repaso general y simulados.`),
    h('h3', {}, 'Logros'), h('div', { class: 'gm-badges' }, ...BADGES.map(([k, ic, name, desc]) => h('div', { class: 'gm-b' + (g.badges[k] ? ' on' : ''), title: desc }, h('span', {}, ic), h('b', {}, name), h('small', {}, desc)))),
    h('p', { class: 'opt-hint' }, `XP: unidad +${XP.unidad} · misión +${XP.mision} · bloque de 25 min +${XP.bloque} · pregunta bien +${XP.quiz_ok} · error repasado bien +${XP.repaso_ok} · libro terminado +${XP.materia}`)) });
}
