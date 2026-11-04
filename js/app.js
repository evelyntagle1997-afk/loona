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

async function route() {
  const raw = location.hash || '#/';
  const [path, q] = raw.split('?');
  const qs = new URLSearchParams(q || '');
  const parts = path.replace(/^#\/?/, '').split('/');
  if (parts[0] !== 'e' && parts[0] !== 'c') leaveStudy();
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
import('./handsfree.js').then(m => m.resume()).catch(() => { });             // Loona: botón de la luna para conversar
addEventListener('pointerdown', () => { if (!/^#\/(e|c)\//.test(location.hash)) greet('home'); }, { once: true });
addEventListener('hashchange', route);
loadGoogleFonts();
loadCustomFonts().catch(() => { });
route();
sync.start();
import('./backup.js').then(b => b.init()).catch(() => { });   // respaldo automático en carpeta (si lo activaste)
db.onChange((rec, origin) => {
  // si llegan materias/cuadernos nuevos desde el otro dispositivo, refresca el inicio
  if (origin === 'remote' && ['subject', 'notebook', 'pdf'].includes(rec.kind) && /^#\/?(m\/.*)?$/.test(location.hash || '#/')) { clearTimeout(window.__rr); window.__rr = setTimeout(route, 600); }
  if (origin === 'remote' && rec.kind === 'font') loadCustomFonts();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => { });
if (navigator.storage?.persist) navigator.storage.persist();

import('./home.js').then(m => m.pomoTick?.());
