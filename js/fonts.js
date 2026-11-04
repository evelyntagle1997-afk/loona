// Fuentes para lettering y apuntes (Google Fonts) + fuentes propias que subas.
import * as db from './db.js';

export const FONTS = [
  // lettering con trazo de pincel / caligrafía
  { f: 'Pacifico', g: 'Lettering' }, { f: 'Dancing Script', g: 'Lettering', w: '400;700' }, { f: 'Great Vibes', g: 'Lettering' },
  { f: 'Sacramento', g: 'Lettering' }, { f: 'Parisienne', g: 'Lettering' }, { f: 'Allura', g: 'Lettering' },
  { f: 'Satisfy', g: 'Lettering' }, { f: 'Courgette', g: 'Lettering' }, { f: 'Yellowtail', g: 'Lettering' }, { f: 'Playball', g: 'Lettering' },
  // góticas (blackletter)
  { f: 'UnifrakturMaguntia', g: 'Góticas' }, { f: 'UnifrakturCook', g: 'Góticas', w: '700' }, { f: 'Pirata One', g: 'Góticas' },
  { f: 'Grenze Gotisch', g: 'Góticas', w: '400;700' }, { f: 'Pinyon Script', g: 'Lettering' }, { f: 'New Rocker', g: 'Góticas' }, { f: 'Metamorphous', g: 'Góticas' },
  // títulos gruesos tipo burbuja
  { f: 'Titan One', g: 'Títulos' }, { f: 'Fredoka', g: 'Títulos', w: '400;600;700' }, { f: 'Lilita One', g: 'Títulos' },
  { f: 'Shrikhand', g: 'Títulos' }, { f: 'Rubik Bubbles', g: 'Títulos' }, { f: 'Bungee Shade', g: 'Títulos' },
  { f: 'Abril Fatface', g: 'Títulos' }, { f: 'Cinzel Decorative', g: 'Títulos', w: '400;700' }, { f: 'Playfair Display', g: 'Títulos', w: '400;700', i: true },
  // letra de apuntes
  { f: 'Patrick Hand', g: 'Apuntes' }, { f: 'Kalam', g: 'Apuntes', w: '300;400;700' }, { f: 'Caveat', g: 'Apuntes', w: '400;700' },
  { f: 'Gochi Hand', g: 'Apuntes' }, { f: 'Indie Flower', g: 'Apuntes' }, { f: 'Shadows Into Light', g: 'Apuntes' },
  { f: 'Gaegu', g: 'Apuntes', w: '400;700' }, { f: 'Architects Daughter', g: 'Apuntes' }, { f: 'Short Stack', g: 'Apuntes' },
  { f: 'Amatic SC', g: 'Apuntes', w: '400;700' }, { f: 'Delius', g: 'Apuntes' },
];

export const STYLES = [
  { k: 'normal', name: 'Simple' },
  { k: 'plata', name: 'Plata nítida' },
  { k: 'vino', name: 'Ámbar nítido' },
  { k: 'contorno', name: 'Contorno' },
  { k: 'doble', name: 'Borde doble' },
  { k: 'sombra', name: 'Sombra 3D' },
  { k: 'degradado', name: 'Degradado' },
  { k: 'marcador', name: 'Resaltado' },
  { k: 'relieve', name: 'Grabado' },
];

// Al abrir solo se cargan las fuentes que usa la app; las demás, cuando hacen falta (más liviano).
const CORE = ['Grenze Gotisch', 'Pinyon Script', 'Kalam', 'Caveat', 'Patrick Hand', 'Amatic SC', 'Fredoka'];
const done = new Set();
function addCss(list) {
  const fams = list.filter(f => !done.has(f.f)); if (!fams.length) return;
  fams.forEach(f => done.add(f.f));
  const q = fams.map(x => { let s = 'family=' + x.f.replace(/ /g, '+'); if (x.i) s += ':ital,wght@0,400;0,700;1,400;1,700'; else if (x.w) s += ':wght@' + x.w; return s; }).join('&');
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = `https://fonts.googleapis.com/css2?${q}&display=swap`; document.head.append(l);
}
export function loadGoogleFonts() { addCss(FONTS.filter(f => CORE.includes(f.f))); }
export function ensureFont(name) { const f = FONTS.find(x => x.f === name); if (f) addCss([f]); }
export function loadAllFonts() { addCss(FONTS); }

// Fuentes propias (.ttf/.otf/.woff) guardadas en el dispositivo y en la nube
const custom = new Set();
export async function loadCustomFonts() {
  const list = await db.all('font');
  for (const f of list) await registerCustom(f);
  return list;
}
async function registerCustom(f) {
  if (custom.has(f.family)) return;
  const url = await db.blobURL(f.blob);
  if (!url) return;
  try {
    const face = new FontFace(f.family, `url(${url})`);
    await face.load();
    document.fonts.add(face);
    custom.add(f.family);
  } catch (e) { console.warn('Fuente no válida', f.family, e); }
}
// Acepta .ttf/.otf/.woff o el .zip tal como lo descarga DaFont
export async function addFontFiles(files) {
  const added = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type.includes('zip')) {
      for (const e of await unzipFonts(f)) added.push(await addCustomFont(e));
    } else if (/\.(ttf|otf|woff2?)$/i.test(f.name)) added.push(await addCustomFont(f));
  }
  return added;
}
export const DAFONT = [
  { name: 'Lettering y caligrafía', url: 'https://www.dafont.com/es/mtheme.php?id=6' },
  { name: 'Manuscrito', url: 'https://www.dafont.com/es/theme.php?cat=603' },
  { name: 'Pincel', url: 'https://www.dafont.com/es/theme.php?cat=604' },
  { name: 'Fantasía y títulos', url: 'https://www.dafont.com/es/mtheme.php?id=1' },
];

// Lector mínimo de .zip (sin librerías): busca las fuentes y las descomprime
async function unzipFonts(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('El .zip parece dañado');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let n = 0; n < count; n++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    const base = name.split('/').pop();
    if (!/\.(ttf|otf|woff2?)$/i.test(base) || name.startsWith('__MACOSX')) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + csize);
    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else continue;
    out.push(new File([data], base, { type: /otf$/i.test(base) ? 'font/otf' : 'font/ttf' }));
  }
  if (!out.length) throw new Error('Ese .zip no trae archivos de fuente (.ttf u .otf)');
  return out;
}

export async function addCustomFont(file) {
  const family = file.name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim();
  const exists = (await db.all('font')).find(f => f.family === family);
  if (exists) return family;
  const blobId = db.uid('fb_');
  await db.putBlob(blobId, file, { type: file.type || 'font/ttf' });
  const rec = await db.put({ id: db.uid('font_'), kind: 'font', family, blob: blobId });
  await registerCustom(rec);
  return family;
}
export function allFamilies() {
  return [...FONTS.map(f => ({ f: f.f, g: f.g })), ...[...custom].map(f => ({ f, g: 'Mis fuentes' }))];
}
