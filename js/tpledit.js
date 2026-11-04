// Edición libre de esquemas y plantillas: toca una parte (una idea, una fecha, una fila, un paso…)
// y aparece una barrita para agregar otra igual, quitarla, moverla, agrandarla o achicarla.
import { h } from './ui.js';

const FREE = '.mm-n, .mm-c, .cy-n, .cy-c, .vn-m';   // partes que se arrastran a cualquier lugar
const SKIP = new Set(['B', 'I', 'SPAN', 'BR', 'EM', 'STRONG', 'U', 'FONT', 'P', 'H5', 'SVG', 'PATH']);

// la parte "repetible" que contiene al nodo tocado
function partOf(node, bz) {
  let n = node.nodeType === 3 ? node.parentElement : node;
  if (n?.closest('td, th')) n = n.closest('tr');
  while (n && n !== bz) {
    const p = n.parentElement;
    if (n.matches?.(FREE)) return n;
    if (p && !SKIP.has(n.tagName) && [...p.children].filter(c => c !== n && c.tagName === n.tagName && c.className.replace(/\b(up|dn|on)\b/g, '').trim() === n.className.replace(/\b(up|dn|on)\b/g, '').trim()).length) return n;
    n = p;
  }
  return null;
}

// vuelve a dibujar líneas, números y posiciones después de cada cambio
export function relink(bz) {
  bz.querySelectorAll('.mm').forEach(mm => {
    const svg = mm.querySelector('.mm-lines'); if (!svg) return;
    const c = mm.querySelector('.mm-c');
    const cx = parseFloat(c?.style.left) || 50, cy = (parseFloat(c?.style.top) || 50) * .7;
    svg.innerHTML = [...mm.querySelectorAll('.mm-n')].map((n, i) => {
      const x = parseFloat(n.style.left) || 50, y = (parseFloat(n.style.top) || 50) * .7;
      return `<path d="M${cx} ${cy} Q ${(cx + x) / 2 + (i % 2 ? 4 : -4)} ${(cy + y) / 2} ${x} ${y}"/>`;
    }).join('');
  });
  bz.querySelectorAll('.tl').forEach(tl => [...tl.querySelectorAll(':scope > .tl-e')].forEach((e, i) => { e.classList.toggle('up', i % 2 === 0); e.classList.toggle('dn', i % 2 === 1); }));
  bz.querySelectorAll('.st').forEach(st => [...st.querySelectorAll(':scope > .st-s')].forEach((e, i) => { const k = e.querySelector('i'); if (k) k.textContent = i + 1; }));
  bz.querySelectorAll('.fy').forEach(fy => [...fy.children].forEach((e, i) => { const k = e.querySelector('i'); if (k) k.textContent = i + 1; }));
  bz.querySelectorAll('.py').forEach(py => [...py.children].forEach((e, i) => e.style.setProperty('--i', i)));
  bz.querySelectorAll('.cy').forEach(cy => {
    const ns = [...cy.querySelectorAll('.cy-n')], n = ns.length || 1;
    if (cy.dataset.free) return;
    ns.forEach((e, i) => { const a = (i * 360 / n - 90) * Math.PI / 180; e.style.left = 50 + Math.cos(a) * 34 + '%'; e.style.top = 50 + Math.sin(a) * 34 + '%'; });
    const svg = cy.querySelector('.cy-ring');
    if (svg) svg.innerHTML = '<circle cx="50" cy="50" r="34"/>' + ns.map((_, i) => { const a = (i * 360 / n - 90 + 180 / n) * Math.PI / 180; const x = 50 + Math.cos(a) * 34, y = 50 + Math.sin(a) * 34; return `<path d="M${x} ${y} l ${-Math.sin(a) * 5 - Math.cos(a) * 3} ${Math.cos(a) * 5 - Math.sin(a) * 3} M${x} ${y} l ${-Math.sin(a) * 5 + Math.cos(a) * 3} ${Math.cos(a) * 5 + Math.sin(a) * 3}"/>`; }).join('');
  });
}

// se activa mientras editas un bloque (dos toques con Seleccionar)
export function attachPartEditor(bz, changed) {
  let part = null;
  const bar = h('div', { class: 'tpe-bar', role: 'toolbar', 'aria-label': 'Editar esta parte' });
  const btn = (label, title, fn, cls = '') => {
    const b = h('button', { class: 'tpe-b ' + cls, title, 'aria-label': title }, label);
    b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (part) fn(e); });
    return b;
  };
  const done = () => { relink(bz); changed(); place(); };
  bar.append(
    btn('＋', 'Agregar otra igual', () => {
      const c = part.cloneNode(true);
      if (c.matches(FREE)) { c.style.left = Math.min(92, (parseFloat(part.style.left) || 50) + 8) + '%'; c.style.top = Math.min(92, (parseFloat(part.style.top) || 50) + 8) + '%'; }
      part.after(c); part = c; done();
    }),
    btn('−', 'Quitar esta parte', () => {
      const sibs = [...part.parentElement.children].filter(x => x.tagName === part.tagName);
      if (sibs.length <= 1 && !part.matches(FREE)) { part.querySelectorAll('b, span, p, td').forEach(x => { if (!x.children.length) x.textContent = '…'; }); }
      else { const nx = part.nextElementSibling || part.previousElementSibling; part.remove(); part = nx && partOf(nx, bz) ? nx : null; }
      done(); if (!part) hide();
    }, 'del'),
    btn('‹', 'Mover antes', () => { const p = part.previousElementSibling; if (p && p.tagName === part.tagName) { p.before(part); done(); } }),
    btn('›', 'Mover después', () => { const n = part.nextElementSibling; if (n && n.tagName === part.tagName) { n.after(part); done(); } }),
    btn('A+', 'Letra más grande en esta parte', () => { const f = parseFloat(part.style.fontSize) || 1; part.style.fontSize = Math.min(3, f * 1.15).toFixed(2) + 'em'; done(); }),
    btn('A−', 'Letra más pequeña en esta parte', () => { const f = parseFloat(part.style.fontSize) || 1; part.style.fontSize = Math.max(.4, f / 1.15).toFixed(2) + 'em'; done(); }),
    btn('⇔', 'Más ancha', () => { const w = part.getBoundingClientRect().width / part.parentElement.getBoundingClientRect().width * 100; part.style.width = Math.min(100, w * 1.15).toFixed(1) + '%'; if (!part.matches(FREE)) part.style.flex = '0 0 auto'; done(); }, 'w'),
    btn('⇥⇤', 'Más angosta', () => { const w = part.getBoundingClientRect().width / part.parentElement.getBoundingClientRect().width * 100; part.style.width = Math.max(8, w / 1.15).toFixed(1) + '%'; if (!part.matches(FREE)) part.style.flex = '0 0 auto'; done(); }, 'w'),
    btn('•', 'Viñetas sí / no', () => { const l = part.closest('ul, ol') || part.querySelector('ul, ol'); if (l) { l.classList.toggle('no-dots'); done(); } }, 'dots'),
    (() => { // arrastrar a cualquier lugar (ideas del mapa mental, etapas del ciclo…)
      const b = btn('✥', 'Arrastrar a otro lugar', e => {
        const box = part.offsetParent?.getBoundingClientRect(); if (!box) return;
        const cy = part.closest('.cy'); if (cy) cy.dataset.free = '1';
        const mv = ev => { part.style.left = Math.max(0, Math.min(100, (ev.clientX - box.left) / box.width * 100)).toFixed(1) + '%'; part.style.top = Math.max(0, Math.min(100, (ev.clientY - box.top) / box.height * 100)).toFixed(1) + '%'; relink(bz); place(); };
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); done(); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      }, 'mv');
      return b;
    })(),
  );
  bar.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); });
  document.body.append(bar);
  const place = () => {
    if (!part || !part.isConnected) return hide();
    const r = part.getBoundingClientRect();
    bar.hidden = false;
    bar.querySelector('.mv').hidden = !part.matches(FREE);
    bar.querySelectorAll('.w').forEach(b => b.hidden = part.tagName === 'TR' || part.tagName === 'LI');
    bar.querySelector('.dots').hidden = !(part.closest('ul, ol') || part.querySelector('ul, ol'));
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    let top = r.top - bh - 6; if (top < 6) top = r.bottom + 6;
    bar.style.left = Math.max(6, Math.min(innerWidth - bw - 6, r.left + r.width / 2 - bw / 2)) + 'px';
    bar.style.top = Math.max(6, Math.min(innerHeight - bh - 6, top)) + 'px';
    document.querySelectorAll('.tpe-on').forEach(x => x.classList.remove('tpe-on'));
    part.classList.add('tpe-on');
  };
  const hide = () => { bar.hidden = true; document.querySelectorAll('.tpe-on').forEach(x => x.classList.remove('tpe-on')); };
  const pick = e => { const p = partOf(e.target, bz); if (p) { part = p; place(); } };
  bz.addEventListener('pointerup', pick);
  hide();
  return () => { bz.removeEventListener('pointerup', pick); bar.remove(); document.querySelectorAll('.tpe-on').forEach(x => x.classList.remove('tpe-on')); };
}
