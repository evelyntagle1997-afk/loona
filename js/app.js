import * as db from './db.js';
import * as sync from './sync.js';
import { loadGoogleFonts, loadCustomFonts } from './fonts.js';
import { renderHome, renderSubject } from './home.js';
import { renderStudy, leaveStudy } from './study.js';
import { toast } from './ui.js';
import { installKeyboardGuard } from './minikb.js';
import { mountLoona, greet } from './loona.js';

const app = document.getElementById('app');
const go = hash => { if (location.hash === hash) route(); else location.hash = hash; };

let routed = false;
async function route() {
  const raw = location.hash || '#/';
  const [path, q] = raw.split('?');
  const qs = new URLSearchParams(q || '');
  const parts = path.replace(/^#\/?/, '').split('/');
  if (parts[0] !== 'e' && parts[0] !== 'c') { if (routed) { try { localStorage.setItem('wasStudying', '0'); } catch { } } leaveStudy(); }
  routed = true;
  try {
    if (parts[0] === 'm') await renderSubject(app, go, parts[1]);
    else if (parts[0] === 'e') await renderStudy(app, go, { pdfId: parts[1], nbId: qs.get('nb'), exportOnly: qs.get('export') });
    else if (parts[0] === 'c') await renderStudy(app, go, { nbId: parts[1] });
    else await renderHome(app, go);
  } catch (e) {
    console.error(e);
    toast('Algo falló al abrir esta pantalla: ' + e.message, 5000);
  }
}

if ((navigator.deviceMemory && navigator.deviceMemory <= 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (() => { try { return localStorage.getItem('lite') === '1'; } catch { return false; } })()) document.documentElement.classList.add('lite');
installKeyboardGuard();   // el teclado del celular no aparece dentro de la app
mountLoona();
import('./coach.js').then(m => m.startCoach()).catch(() => { });   // Loona entrenadora: tiempo de estudio, meta y empujones
import('./handsfree.js').then(m => m.autoStart()).catch(() => { });   // Loona escucha siempre (di «Luny…»)             // Loona: botón de la luna para conversar
addEventListener('pointerdown', () => { if (!/^#\/(e|c)\//.test(location.hash)) greet('home'); }, { once: true });
addEventListener('hashchange', route);
loadGoogleFonts();
loadCustomFonts().catch(() => { });
// al abrir la app: si la cerraste estudiando, vuelve sola al mismo PDF y cuaderno
(() => {
  try {
    if (!/^#?\/?$/.test(location.hash) || localStorage.getItem('wasStudying') !== '1') return;
    const l = JSON.parse(localStorage.getItem('lastStudy')); if (l?.hash) history.replaceState(null, '', l.hash);
  } catch { }
})();
route();
sync.start();
import('./backup.js').then(b => b.init()).catch(() => { });   // respaldo automático en carpeta (si lo activaste)
db.onChange((rec, origin) => {
  // si llegan materias/cuadernos nuevos desde el otro dispositivo, refresca el inicio
  if (origin === 'remote' && ['subject', 'notebook', 'pdf'].includes(rec.kind) && /^#\/?(m\/.*)?$/.test(location.hash || '#/')) { clearTimeout(window.__rr); window.__rr = setTimeout(route, 600); }
  if (origin === 'remote' && rec.kind === 'font') loadCustomFonts();
});

// actualización automática: si hay una versión nueva, se instala y la app se recarga sola (sin Ctrl+Shift+R)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadCtrl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadCtrl || reloaded) return; reloaded = true; location.reload(); });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update().catch(() => { });
    setInterval(() => reg.update().catch(() => { }), 20 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => { }); });
  }).catch(() => { });
}
if (navigator.storage?.persist) navigator.storage.persist();

import('./home.js').then(m => m.pomoTick?.());

import('./agenda.js').then(m => m.startReminders()).catch(() => { });
