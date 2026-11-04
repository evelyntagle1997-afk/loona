// Teclado propio de la app: angosto, flotante y movible, con texto predictivo.
// El teclado del celular NO aparece dentro de la app (salvo que lo actives en la rueda).
import { h, icon, toast, clamp } from './ui.js';

const KEY = 'miniKb';
const LAYERS = {
  abc: [['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'], ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ñ'], ['⇧', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '⌫'], ['123', ',', ' ', '.', '⌄', '↵']],
  num: [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'], ['á', 'é', 'í', 'ó', 'ú', 'ü', '¿', '?', '¡', '!'], ['(', ')', ':', ';', '-', '"', '%', '/', '⌫'], ['abc', ',', ' ', '.', '⌄', '↵']],
};

// ---------- preferencia: teclado del celular (apagado por defecto) ----------
export const sysKeyboard = () => localStorage.getItem('sysKb') === '1';
export function setSysKeyboard(v) {
  localStorage.setItem('sysKb', v ? '1' : '0');
  document.querySelectorAll('input, textarea, [contenteditable]').forEach(n => applyKbMode(n));
  toast(v ? 'Se usará el teclado del celular' : 'Teclado del celular apagado: se usa el teclado de la app');
}
const isField = n => n && (n.isContentEditable || n.tagName === 'TEXTAREA' || (n.tagName === 'INPUT' && !['file', 'range', 'checkbox', 'radio', 'color', 'button', 'submit'].includes(n.type)));
const isNumeric = n => n.tagName === 'INPUT' && (n.type === 'number' || n.classList.contains('pg-input') || n.getAttribute('inputmode') === 'numeric' || n.dataset.numeric);
export function applyKbMode(n, numeric) {
  if (!n || !(n.isContentEditable || n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.hasAttribute?.('contenteditable'))) return;
  if (numeric) n.dataset.numeric = '1';
  n.inputMode = sysKeyboard() ? (numeric || n.dataset.numeric ? 'numeric' : 'text') : 'none';
}
const touchy = () => matchMedia('(pointer: coarse)').matches;

// Se instala una vez: todo campo de la app nace sin teclado del celular
export function installKeyboardGuard() {
  const fix = root => { if (root.nodeType !== 1) return; if (isField(root) || root.hasAttribute('contenteditable')) applyKbMode(root); root.querySelectorAll?.('input, textarea, [contenteditable]').forEach(n => applyKbMode(n)); };
  fix(document.body);
  new MutationObserver(ms => { for (const m of ms) { m.addedNodes.forEach(fix); if (m.type === 'attributes' && m.target.isContentEditable) applyKbMode(m.target); } })
    .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable'] });
  // antes de que el campo reciba el foco
  document.addEventListener('pointerdown', e => { const t = e.target.closest?.('input, textarea, [contenteditable=true]'); if (t) applyKbMode(t); }, true);
  document.addEventListener('focusin', e => {
    const t = e.target; if (!isField(t)) return;
    applyKbMode(t); lastTarget = t;
    // en ventanas (buscar fuente, nube, nombres…) el teclado de la app aparece solo
    if (!sysKeyboard() && touchy() && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) { const was = !!box; openMiniKb(isNumeric(t)); if (!was) autoOpened = true; }
    else if (box) suggest();
  }, true);
  // si el teclado se abrió solo para un campo, se cierra cuando ese campo se deja o desaparece
  document.addEventListener('focusout', () => {
    if (!box || !autoOpened) return;
    setTimeout(() => { if (box && autoOpened && !isField(document.activeElement)) closeMiniKb(); }, 180);
  }, true);
  new MutationObserver(() => { if (box && autoOpened && lastTarget && !lastTarget.isConnected) closeMiniKb(); }).observe(document.body, { childList: true, subtree: true });
}

// ---------- texto predictivo ----------
const BASE = ('de la que el en y a los se del las un por con no una su para es al lo como más pero sus le ya o fue este ha sí porque esta son entre está cuando muy sin sobre ser tiene también me hasta hay donde han quien están estado desde todo nos durante estados todos uno les ni contra otros fueron ese eso había ante ellos e esto mí antes algunos qué unos yo otro otras otra él tanto esa estos mucho quienes nada muchos cual sea poco ella estar haber estas algunas algo nosotros mi mis tú te ti tu tus ellas nosotras vosotros vosotras os mío mía míos mías tuyo tuya tuyos tuyas suyo suya suyos suyas nuestro nuestra nuestros nuestras vuestro vuestra esos esas estoy estás estamos están ' +
  'definición concepto características causas consecuencias ejemplo ejemplos importancia historia universal tema resumen introducción conclusión objetivo objetivos método análisis proceso estructura función funciones clasificación tipos tipo elementos principales principal desarrollo origen evolución etapa etapas época siglo años guerra imperio revolución sociedad cultura economía política gobierno religión población territorio civilización antigua moderna medieval contemporánea período periodo fecha lugar porque además entonces mientras aunque según través partir ' +
  'ingeniería civil estructura estructuras concreto acero carga cargas diseño cálculo cálculos resistencia materiales suelo suelos cimentación viga vigas columna columnas losa losas fuerza fuerzas momento momentos esfuerzo deformación hidráulica topografía carretera carreteras puente puentes proyecto proyectos memoria descriptiva presupuesto metrado especificaciones técnicas obra obras construcción tesis capítulo marco teórico metodología resultados discusión recomendaciones referencias ' +
  'lunes martes miércoles jueves viernes sábado domingo enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre importante repasar recordar estudiar examen práctica ejercicio ejercicios pregunta preguntas respuesta respuestas idea ideas clave dato datos detalle título subtítulo').split(/\s+/);
const learned = (() => { try { return JSON.parse(localStorage.getItem('kbWords')) || {}; } catch { return {}; } })();
let saveT = 0;
function learn(w) {
  w = w.toLowerCase(); if (w.length < 3 || /\d/.test(w)) return;
  learned[w] = (learned[w] || 0) + 1;
  clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('kbWords', JSON.stringify(Object.fromEntries(Object.entries(learned).sort((a, b) => b[1] - a[1]).slice(0, 3000)))); } catch { } }, 800);
}
// también aprende las palabras que ya están en tus hojas
export function learnFromPage() {
  const txt = [...document.querySelectorAll('.nb-els')].map(n => n.innerText).join(' ');
  for (const w of txt.toLowerCase().match(/[a-záéíóúüñ]{4,}/g) || []) if (!learned[w]) learned[w] = 1;
}
function currentWord() {
  const t = target(); if (!t) return '';
  if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') { const v = t.value.slice(0, t.selectionStart ?? t.value.length); return (v.match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/) || [''])[0]; }
  const sel = getSelection(); if (!sel.rangeCount) return '';
  const r = sel.getRangeAt(0); const n = r.startContainer;
  if (n.nodeType !== 3) return '';
  return (n.textContent.slice(0, r.startOffset).match(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/) || [''])[0];
}
function candidates(pre) {
  const p = pre.toLowerCase(); if (!p) return [];
  const score = new Map();
  for (const w of BASE) if (w.startsWith(p) && w !== p) score.set(w, (score.get(w) || 0) + 2 + 1 / w.length);
  for (const [w, n] of Object.entries(learned)) if (w.startsWith(p) && w !== p) score.set(w, (score.get(w) || 0) + 3 + n);
  const up = pre[0] === pre[0].toUpperCase() && pre[0] !== pre[0].toLowerCase();
  return [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => up ? w[0].toUpperCase() + w.slice(1) : w);
}
function suggest() {
  if (!box) return;
  const bar = box.querySelector('.mk-sug'); bar.innerHTML = '';
  const pre = currentWord();
  const list = candidates(pre);
  if (!list.length) { bar.append(h('span', { class: 'mk-hint' }, pre ? '' : 'sugerencias')); return; }
  for (const w of list) {
    const b = h('button', { class: 'mk-s' }, w);
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const t = target(); if (!t) return;
      if (document.activeElement !== t) t.focus();
      for (let i = 0; i < pre.length; i++) document.execCommand('delete');
      document.execCommand('insertText', false, w + ' ');
      learn(w); suggest();
    });
    bar.append(b);
  }
}

// ---------- teclado ----------
let box = null, layer = 'abc', shift = false, lastTarget = null, autoOpened = false;
function target() {
  const a = document.activeElement;
  if (isField(a)) { lastTarget = a; return a; }
  return lastTarget && lastTarget.isConnected && isField(lastTarget) ? lastTarget : null;
}
export const miniKbOpen = () => !!box;

function press(k) {
  if (k === '123' || k === 'abc') { layer = k === '123' ? 'num' : 'abc'; return draw(); }
  if (k === '⇧') { shift = !shift; return draw(); }
  if (k === '⌄') return closeMiniKb();
  const t = target();
  if (!t) { toast('Toca un texto para escribir (o elige Texto en la rueda y toca la hoja)'); return; }
  if (document.activeElement !== t) t.focus();
  if (k === '⌫') document.execCommand('delete');
  else if (k === '↵') {
    if (t.tagName === 'INPUT') { t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); t.dispatchEvent(new Event('change', { bubbles: true })); }
    else document.execCommand('insertLineBreak');
  } else {
    if (/[\s.,;:!?¡¿)]/.test(k)) { const w = currentWord(); if (w) learn(w); }
    document.execCommand('insertText', false, shift ? k.toUpperCase() : k);
    if (shift) { shift = false; draw(); }
  }
  suggest();
}

function draw() {
  const keys = box.querySelector('.mk-keys'); keys.innerHTML = '';
  for (const row of LAYERS[layer]) {
    const r = h('div', { class: 'mk-row' });
    for (const k of row) {
      const label = k === ' ' ? 'espacio' : k === '⌄' ? '' : shift && k.length === 1 ? k.toUpperCase() : k;
      const b = h('button', { class: 'mk-k' + (k === ' ' ? ' sp' : '') + (['⇧', '⌫', '123', 'abc', '↵', '⌄'].includes(k) ? ' fn' : '') + (k === '⇧' && shift ? ' on' : ''), 'aria-label': k === '⌄' ? 'Ocultar el teclado' : label, title: k === '⌄' ? 'Ocultar el teclado' : '' }, label);
      if (k === '⌄') b.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="10" rx="2"/><path d="M7 8h0M11 8h0M15 8h0M8 11h8M9 18l3 3 3-3"/></svg>';
      // no quitar el foco del texto al tocar una tecla
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); b.classList.add('dn'); press(k); });
      if (k === '⌫') { // mantener apretado borra seguido
        let t0 = null, iv = null;
        b.addEventListener('pointerdown', () => { t0 = setTimeout(() => { iv = setInterval(() => press('⌫'), 70); }, 420); });
        const stop = () => { clearTimeout(t0); clearInterval(iv); };
        b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', stop); b.addEventListener('pointerleave', stop);
      }
      const up = () => b.classList.remove('dn');
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      b.addEventListener('mousedown', e => e.preventDefault());
      r.append(b);
    }
    keys.append(r);
  }
}

export function openMiniKb(numeric) {
  layer = numeric ? 'num' : layer;
  if (box) { draw(); suggest(); return; }
  learnFromPage();
  const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
  box = h('div', { class: 'minikb', role: 'group', 'aria-label': 'Teclado de la app' },
    h('div', { class: 'mk-bar' }, h('span', { class: 'mk-grip' }), h('div', { class: 'mk-sug' }), h('button', { class: 'mk-x', 'aria-label': 'Ocultar el teclado', title: 'Ocultar el teclado', html: icon('close', 15) })),
    h('div', { class: 'mk-keys' }));
  box.addEventListener('pointerdown', e => { if (!e.target.closest('.mk-k, .mk-s')) e.preventDefault(); e.stopPropagation(); });
  box.querySelector('.mk-x').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); closeMiniKb(); });
  document.body.append(box);
  draw(); suggest();
  const place = (x, y) => {
    const W = box.offsetWidth, H = box.offsetHeight;
    x = clamp(x, 4, innerWidth - W - 4); y = clamp(y, 4, innerHeight - H - 4);
    box.style.left = x + 'px'; box.style.top = y + 'px';
    // las ventanas suben para que el teclado no tape sus botones
    document.documentElement.style.setProperty('--kbh', Math.max(0, innerHeight - y) + 'px');
    return [x, y];
  };
  document.documentElement.classList.add('kb-open');
  place(saved.x ?? (innerWidth - box.offsetWidth) / 2, saved.y ?? innerHeight - box.offsetHeight - 10);
  // se arrastra desde la barrita de arriba (la parte sin sugerencias)
  const bar = box.querySelector('.mk-bar');
  bar.addEventListener('pointerdown', e => {
    if (e.target.closest('.mk-x, .mk-s')) return;
    const r = box.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    const mv = ev => place(ev.clientX - dx, ev.clientY - dy);
    const up = ev => { bar.removeEventListener('pointermove', mv); const [x, y] = place(ev.clientX - dx, ev.clientY - dy); localStorage.setItem(KEY, JSON.stringify({ x, y })); };
    bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up, { once: true });
  });
  document.addEventListener('selectionchange', onSel);
}
const onSel = () => { clearTimeout(onSel.t); onSel.t = setTimeout(suggest, 60); };
export function closeMiniKb() { box?.remove(); box = null; autoOpened = false; document.documentElement.classList.remove('kb-open'); document.removeEventListener('selectionchange', onSel); }
export function toggleMiniKb() { box ? closeMiniKb() : (openMiniKb(), autoOpened = false); }

// ---------- corrector para la escritura a mano ----------
// Une letras sueltas ("H o l a" -> "Hola") y corrige palabras casi iguales a una conocida.
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); best = Math.min(best, cur[j]); }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export function cleanHandwriting(text, { fix = true } = {}) {
  let t = (text || '').replace(/[|_~`^]+/g, ' ').replace(/[ \t]+/g, ' ');
  // tres o más letras sueltas seguidas son una sola palabra escrita con espacios
  t = t.replace(/(?:^|(?<=\s))(?:\p{L}\s){2,}\p{L}(?=\s|$|[.,;:!?])/gu, m => m.replace(/\s/g, ''));
  if (!fix) return t.trim();
  learnFromPage();
  const dict = [...new Set([...BASE, ...Object.keys(learned)])].filter(w => w.length > 2);
  const byNoAccent = new Map(dict.map(w => [strip(w), w]));
  return t.replace(/\p{L}{3,}/gu, w => {
    const lw = w.toLowerCase();
    if (dict.includes(lw)) return w;
    const acc = byNoAccent.get(strip(lw)); // misma palabra sin tilde
    let best = acc || null, bd = acc ? 0 : 9;
    if (!best) {
      const max = lw.length >= 7 ? 2 : 1;
      for (const d of dict) { if (d[0] !== lw[0] && lw.length < 6) continue; const k = lev(lw, d, max); if (k < bd) { bd = k; best = d; if (k === 0) break; } }
      if (bd > (lw.length >= 7 ? 2 : 1)) best = null;
    }
    if (!best) return w;
    return w[0] === w[0].toUpperCase() ? best[0].toUpperCase() + best.slice(1) : best;
  }).trim();
}
