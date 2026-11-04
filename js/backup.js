// Respaldo automático en una carpeta de tu PC (Chrome o Edge en computadora).
// Eliges la carpeta una vez; después cada cambio se copia solo:
//   loona-respaldo.json  -> materias, cuadernos, hojas, subrayados, audios (datos)
//   archivos/<id>        -> PDFs, fotos, audios y fuentes (cada uno se copia una sola vez)
import * as db from './db.js';
import { toast } from './ui.js';

const KEY = 'backupDir';
let dir = null, timer = null, busy = false, state = { on: false, last: 0, need: false };
const subs = new Set();
export const onBackup = fn => { subs.add(fn); fn(state); return () => subs.delete(fn); };
const set = p => { state = { ...state, ...p }; subs.forEach(f => f(state)); };
export const supported = () => 'showDirectoryPicker' in window;

async function allowed(h, ask) {
  const o = { mode: 'readwrite' };
  if (!h.queryPermission) return true;
  if (await h.queryPermission(o) === 'granted') return true;
  return ask ? (await h.requestPermission(o)) === 'granted' : false;
}
export async function init() {
  if (!supported()) return;
  const h = await db.meta(KEY);
  if (!h) return;
  dir = h;
  if (await allowed(h, false)) { set({ on: true, need: false }); watch(); schedule(2000); }
  else set({ on: false, need: true });   // el navegador pide confirmar otra vez después de reiniciar
}
export async function choose() {
  if (!supported()) throw new Error('Tu navegador no permite guardar en una carpeta. Usa Chrome o Edge en la computadora, o la Nube.');
  const h = await window.showDirectoryPicker({ id: 'loona-respaldo', mode: 'readwrite' });
  await useDir(h); toast('Respaldo automático activado en la carpeta «' + h.name + '»', 3500);
}
// activa el respaldo en esa carpeta y la recuerda para la próxima vez
export async function useDir(h) {
  dir = h; try { await db.meta(KEY, h); } catch (e) { console.warn(e); }
  set({ on: true, need: false }); watch(); await run();
}
export async function reconnect() { if (dir && await allowed(dir, true)) { set({ on: true, need: false }); watch(); run(); } }
export async function off() { dir = null; await db.meta(KEY, null); set({ on: false, need: false }); }
let unsub = null;
function watch() { unsub?.(); unsub = db.onChange(() => schedule(15000)); addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') run(); }); }
function schedule(ms) { clearTimeout(timer); timer = setTimeout(run, ms); }

export async function run() {
  if (!dir || busy || !state.on) return;
  busy = true;
  try {
    const items = await db.allItems();
    const f = await dir.getFileHandle('loona-respaldo.json', { create: true });
    const w = await f.createWritable(); await w.write(JSON.stringify({ app: 'cuaderno-cuero', v: 2, at: Date.now(), items })); await w.close();
    const sub = await dir.getDirectoryHandle('archivos', { create: true });
    const have = new Set(); for await (const k of sub.keys()) have.add(k);
    for (const b of await db.allBlobs()) {
      if (have.has(b.id)) continue;
      const fh = await sub.getFileHandle(b.id, { create: true }); const ww = await fh.createWritable(); await ww.write(b.blob); await ww.close();
    }
    set({ last: Date.now() });
  } catch (e) { console.warn(e); if (e.name === 'NotAllowedError') set({ on: false, need: true }); }
  busy = false;
}
// recuperar todo desde la carpeta de respaldo
export async function restore() { return restoreFrom(await window.showDirectoryPicker({ id: 'loona-respaldo', mode: 'read' })); }
export async function restoreFrom(h) {
  const data = JSON.parse(await (await (await h.getFileHandle('loona-respaldo.json')).getFile()).text());
  if (data.app !== 'cuaderno-cuero') throw new Error('Esa carpeta no tiene un respaldo de Loona.');
  let sub = null; try { sub = await h.getDirectoryHandle('archivos'); } catch { }
  if (sub) for await (const [name, fh] of sub.entries()) { if (!(await db.getBlobRec(name))) { const file = await fh.getFile(); await db.putBlob(name, file, { type: file.type }); } }
  for (const it of data.items) { const cur = await db.get(it.id); if (!cur || (it.updatedAt || 0) > (cur.updatedAt || 0)) await db.put(it, { keepTime: true }); }
  return data.items.length;
}
