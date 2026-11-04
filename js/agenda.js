// Mi agenda: eventos y tareas que Loona crea, cambia, borra y te recuerda.
import * as db from './db.js';
import { h, icon, modal, toast } from './ui.js';

const CAT = { trabajo: 'Trabajo', personal: 'Personal', salud: 'Salud', estudio: 'Estudio', ocio: 'Ocio' };
const DUR = { reunion: 30, llamada: 30, almuerzo: 90, comida: 90, cena: 90, cita: 60, medico: 60, estudio: 60, clase: 60 };
const pad = n => String(n).padStart(2, '0');
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const parse = s => s ? new Date(s) : null;
const fmtH = d => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
const fmtD = d => d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });

export async function events(daysAhead = 30) {
  const now = Date.now(), lim = now + daysAhead * 864e5;
  return (await db.all('event')).filter(e => { const t = +parse(e.end_time || e.start_time); return t >= now - 864e5 && +parse(e.start_time) <= lim; })
    .sort((a, b) => parse(a.start_time) - parse(b.start_time));
}
// lo que Loona necesita saber para decidir (fecha actual y lo que ya tienes agendado)
export async function agendaCtx() {
  const d = new Date(), ev = await events(14);
  const list = ev.map(e => `- ${e.start_time} a ${e.end_time || '?'} · ${e.title}${e.category ? ' (' + e.category + ')' : ''}${e.location ? ' @ ' + e.location : ''}`).join('\n');
  return `\nAhora es ${fmtD(d)}, ${fmtH(d)} (${iso(d)}, zona horaria de Eve).\nAgenda de Eve (próximos 14 días):\n${list || '(vacía)'}`;
}
const overlaps = (ev, all) => all.filter(o => o.id !== ev.id && !o.is_all_day && !ev.is_all_day && parse(o.start_time) < parse(ev.end_time) && parse(ev.start_time) < parse(o.end_time));
function fixTimes(d) {
  const st = parse(d.start_time); if (!st || isNaN(st)) return null;
  let en = parse(d.end_time);
  if (!en || isNaN(en) || en <= st) {   // duración por sentido común si no la dijo
    const k = Object.keys(DUR).find(k => (d.title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(k));
    en = new Date(+st + (k ? DUR[k] : d.category === 'estudio' || d.category === 'salud' ? 60 : 15) * 60000);
  }
  return { start_time: iso(st), end_time: iso(en) };
}
async function findEvent(d) {
  const all = await events(60); const t = (d.title || '').toLowerCase();
  return all.find(e => d.id && e.id === d.id) || all.find(e => t && e.title.toLowerCase().includes(t)) || all.find(e => d.start_time && e.start_time.slice(0, 16) === d.start_time.slice(0, 16));
}
// aplica la orden que Loona decidió (JSON) y devuelve un aviso si hay choques
export async function apply(cmd) {
  const a = cmd?.action, d = cmd?.data || {};
  if (a === 'create_event') {
    const t = fixTimes(d); if (!t || !d.title) return '';
    const ev = { id: db.uid('ev_'), kind: 'event', title: d.title, ...t, category: CAT[d.category] ? d.category : 'personal', location: d.location || null, is_all_day: !!d.is_all_day };
    await db.put(ev); refresh();
    const c = overlaps(ev, await events(60));
    return c.length ? `Choca con «${c[0].title}».` : '';
  }
  if (a === 'update_event') {
    const ev = await findEvent(d); if (!ev) return 'No encontré ese evento.';
    Object.assign(ev, Object.fromEntries(Object.entries(d).filter(([k, v]) => v != null && k !== 'id')));
    Object.assign(ev, fixTimes(ev) || {}); await db.put(ev); refresh(); return '';
  }
  if (a === 'delete_event') { const ev = await findEvent(d); if (!ev) return 'No encontré ese evento.'; await db.remove(ev.id); refresh(); return ''; }
  return '';
}

// ---------- recordatorios: 10 minutos antes Loona te avisa ----------
const warned = new Set();
export function startReminders() {
  const tick = async () => {
    const now = Date.now();
    for (const e of await events(1)) {
      const t = +parse(e.start_time), k = e.id + e.start_time;
      if (!e.is_all_day && t - now <= 10 * 60000 && t - now > -60000 && !warned.has(k)) {
        warned.add(k);
        const L = await import('./loona.js');
        L.speak(`Eve. En ${Math.max(1, Math.round((t - now) / 60000))} minutos: ${e.title}. No me hagas repetirlo.`);
      }
    }
  };
  tick(); setInterval(tick, 30000);
}

// ---------- ventana "Mi agenda" ----------
let openBox = null;
function refresh() { if (openBox) openBox(); }
export async function openAgendaView() {
  const list = h('div', { class: 'agv-list' });
  const draw = async () => {
    const ev = await events(30); list.replaceChildren();
    if (!ev.length) list.append(h('p', { class: 'opt-hint' }, 'Nada agendado. Dile a Loona: «Luny, agenda estudiar genética mañana a primera hora».'));
    let day = '';
    for (const e of ev) {
      const st = parse(e.start_time), en = parse(e.end_time), dk = st.toDateString();
      if (dk !== day) { day = dk; list.append(h('h4', { class: 'agv-day' }, fmtD(st))); }
      const clash = overlaps(e, ev).length;
      list.append(h('div', { class: 'agv-ev cat-' + e.category + (clash ? ' clash' : '') },
        h('span', { class: 'agv-h' }, e.is_all_day ? 'Todo el día' : fmtH(st) + (en ? '–' + fmtH(en) : '')),
        h('span', { class: 'agv-t' }, h('b', {}, e.title), h('small', {}, (CAT[e.category] || '') + (e.location ? ' · ' + e.location : '') + (clash ? ' · se cruza con otro' : ''))),
        h('button', { class: 'icbtn', 'aria-label': 'Borrar', html: icon('trash', 16), onclick: async () => { await db.remove(e.id); draw(); } })));
    }
  };
  // agregar a mano (por si no quieres hablar)
  const t = h('input', { class: 'field', placeholder: 'Qué (ej.: Estudiar genética)' });
  const dt = h('input', { class: 'field', type: 'datetime-local', value: iso(new Date(Date.now() + 3600e3)).slice(0, 16) });
  const cat = h('select', { class: 'field' }, ...Object.entries(CAT).map(([k, v]) => h('option', { value: k, selected: k === 'estudio' }, v)));
  const add = h('button', { class: 'btn primary', onclick: async () => { if (!t.value.trim()) return t.focus(); const w = await apply({ action: 'create_event', data: { title: t.value.trim(), start_time: dt.value + ':00', category: cat.value } }); t.value = ''; draw(); if (w) toast(w, 3000); } }, 'Agregar');
  openBox = draw; await draw();
  modal({ title: 'Mi agenda', wide: true, body: h('div', { class: 'agv' }, list, h('div', { class: 'ie-row agv-add' }, t, dt, cat, add)), onClose: () => { openBox = null; } });
}
