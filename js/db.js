// Almacenamiento local (IndexedDB). Todo lo que creas vive aquí primero;
// la nube (sync.js) solo copia y trae cambios.
const DB_NAME = 'cuaderno-cuero';
const DB_VER = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('items')) {
        const s = db.createObjectStore('items', { keyPath: 'id' });
        s.createIndex('kind', 'kind');
        s.createIndex('dirty', 'dirty');
      }
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(rec, origin) { listeners.forEach(f => { try { f(rec, origin); } catch (e) { console.error(e); } }); }

// kinds: subject, notebook, page, pdf, hl (subrayado), font, setting
export async function put(rec, { origin = 'local', keepTime = false } = {}) {
  if (!keepTime) rec.updatedAt = Date.now();
  if (origin === 'local') rec.dirty = 1; else rec.dirty = 0;
  await tx('items', 'readwrite', s => s.put(rec));
  emit(rec, origin);
  return rec;
}
export async function get(id) { return tx('items', 'readonly', s => req(s.get(id))); }
export async function all(kind, includeDeleted = false) {
  const list = await tx('items', 'readonly', s => req(s.index('kind').getAll(kind)));
  return includeDeleted ? list : list.filter(r => !r.deleted);
}
export async function where(kind, fn) { return (await all(kind)).filter(fn); }
export async function remove(id) {
  const r = await get(id);
  if (!r) return;
  r.deleted = 1;
  // se conserva como "lápida" para que la borrada llegue también al otro dispositivo
  for (const k of Object.keys(r)) if (!['id', 'kind', 'deleted', 'updatedAt', 'parent', 'subject'].includes(k)) delete r[k];
  await put(r);
}
export async function dirtyItems() {
  const list = await tx('items', 'readonly', s => req(s.getAll()));
  return list.filter(r => r.dirty);
}
export async function markClean(ids, stamps) {
  await tx('items', 'readwrite', async s => {
    for (const id of ids) {
      const r = await req(s.get(id));
      if (r && r.updatedAt === stamps[id]) { r.dirty = 0; s.put(r); }
    }
  });
}
export async function allItems() { return tx('items', 'readonly', s => req(s.getAll())); }

// blobs: PDFs, fotos recortadas, fuentes propias
export async function putBlob(id, blob, { uploaded = 0, type } = {}) {
  await tx('blobs', 'readwrite', s => s.put({ id, blob, uploaded, type: type || blob.type }));
  emit({ id, kind: 'blob' }, 'local');
  return id;
}
export async function getBlobRec(id) { return tx('blobs', 'readonly', s => req(s.get(id))); }
export async function getBlob(id) { const r = await getBlobRec(id); return r ? r.blob : null; }
export async function pendingBlobs() {
  const list = await tx('blobs', 'readonly', s => req(s.getAll()));
  return list.filter(b => !b.uploaded);
}
export async function setBlobUploaded(id) {
  await tx('blobs', 'readwrite', async s => { const r = await req(s.get(id)); if (r) { r.uploaded = 1; s.put(r); } });
}
export async function allBlobs() { return tx('blobs', 'readonly', s => req(s.getAll())); }

export async function meta(k, v) {
  if (v === undefined) { const r = await tx('meta', 'readonly', s => req(s.get(k))); return r ? r.v : undefined; }
  await tx('meta', 'readwrite', s => s.put({ k, v }));
  return v;
}

// URLs de objetos con caché, para no recrearlos en cada render
const urlCache = new Map();
export async function blobURL(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  let b = await getBlob(id);
  if (!b && window.__fetchRemoteBlob) b = await window.__fetchRemoteBlob(id);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(id, u);
  return u;
}

// Ajustes sincronizados (un solo registro)
export async function settings() {
  return (await get('settings')) || { id: 'settings', kind: 'setting' };
}
export async function saveSettings(patch) {
  const s = await settings();
  Object.assign(s, patch);
  return put(s);
}

// Copia de seguridad en archivo (además de la nube)
export async function exportAll() {
  const items = await allItems();
  const blobs = await allBlobs();
  const enc = await Promise.all(blobs.map(async b => ({ id: b.id, type: b.type, data: await blobToB64(b.blob) })));
  return new Blob([JSON.stringify({ app: 'cuaderno-cuero', v: 1, at: Date.now(), items, blobs: enc })], { type: 'application/json' });
}
export async function importAll(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'cuaderno-cuero') throw new Error('Ese archivo no es una copia de esta app.');
  for (const b of data.blobs) await putBlob(b.id, b64ToBlob(b.data, b.type));
  for (const it of data.items) {
    const cur = await get(it.id);
    if (!cur || (it.updatedAt || 0) > (cur.updatedAt || 0)) await put(it, { keepTime: true });
  }
}
function blobToB64(b) {
  return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(b); });
}
function b64ToBlob(s, type) {
  const bin = atob(s); const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type });
}
