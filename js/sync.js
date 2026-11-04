// Sincronización automática con tu propia cuenta gratuita de Supabase.
// Los datos se guardan primero en el dispositivo; la nube copia los cambios
// en ambos sentidos para que PC y celular vean lo mismo.
import * as db from './db.js';

const CFG = 'cloudCfg', SES = 'cloudSession';
let state = { status: 'off', last: 0, error: '' };
const subs = new Set();
export const onStatus = fn => { subs.add(fn); fn(state); return () => subs.delete(fn); };
const set = p => { state = { ...state, ...p }; subs.forEach(f => f(state)); };

export const getCfg = () => { try { return JSON.parse(localStorage.getItem(CFG)) || {}; } catch { return {}; } };
export const setCfg = c => localStorage.setItem(CFG, JSON.stringify(c));
const getSes = () => { try { return JSON.parse(localStorage.getItem(SES)); } catch { return null; } };
const setSes = s => s ? localStorage.setItem(SES, JSON.stringify(s)) : localStorage.removeItem(SES);
export const session = getSes;

function base() {
  const c = getCfg();
  if (!c.url || !c.key) throw new Error('Falta configurar la nube');
  return { url: c.url.replace(/\/+$/, ''), key: c.key };
}
async function authFetch(path, body) {
  const { url, key } = base();
  let r; try { r = await fetch(url + path, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch { throw new Error(es('failed to fetch')); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(es(j.error_description || j.msg || j.message || ('Error ' + r.status)));
  return j;
}
// mensajes de Supabase en español
function es(m) {
  const T = [[/invalid login credentials/i, 'Correo o contraseña incorrectos.'], [/already registered|already been registered/i, 'Ese correo ya tiene cuenta. Usa Entrar (no Crear cuenta).'],
    [/at least 6/i, 'La contraseña debe tener al menos 6 caracteres.'], [/validate email|invalid format|invalid email/i, 'Ese correo no es válido. Revisa que esté bien escrito.'],
    [/email not confirmed/i, 'Falta confirmar tu correo: abre el mensaje de Supabase y luego toca Entrar.'], [/rate limit|too many/i, 'Demasiados intentos. Espera un minuto y prueba otra vez.'],
    [/refresh token/i, 'Tu sesión venció. Vuelve a entrar.'], [/failed to fetch|network/i, 'Sin conexión con la nube. Revisa internet y la dirección del proyecto.'], [/invalid api key|no api key/i, 'La clave pública de Supabase no es correcta.']];
  for (const [re, t] of T) if (re.test(m)) return t;
  return m;
}
function keep(j) { setSes({ access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in - 60) * 1000, user: j.user?.id, email: j.user?.email }); }

export async function signUp(email, password) {
  const j = await authFetch('/auth/v1/signup', { email, password });
  if (j.access_token) { keep(j); return 'ok'; }
  return 'confirm'; // Supabase pide confirmar el correo
}
export async function signIn(email, password) {
  keep(await authFetch('/auth/v1/token?grant_type=password', { email, password }));
  await db.meta('lastPull', null);
  start();
}
export function signOut() { setSes(null); stop(); set({ status: 'off' }); }

async function token() {
  let s = getSes(); if (!s) throw new Error('Inicia sesión en la nube');
  if (Date.now() > s.exp) {
    try { keep(await authFetch('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh })); s = getSes(); }
    catch (e) { setSes(null); throw new Error('Tu sesión de la nube venció. Vuelve a entrar en Ajustes.'); }
  }
  return s;
}
async function api(path, opts = {}) {
  const { url, key } = base(); const s = await token();
  const r = await fetch(url + path, { ...opts, headers: { apikey: key, Authorization: 'Bearer ' + s.access, ...(opts.headers || {}) } });
  if (!r.ok) { const t = await r.text(); throw new Error(r.status === 404 && /relation|items/.test(t) ? 'Falta crear la tabla en Supabase (paso 3 de la guía).' : `Nube: ${r.status} ${t.slice(0, 140)}`); }
  return r;
}

let running = false, again = false, timer = null;
export async function syncNow() {
  if (!getSes() || !getCfg().url) return;
  if (running) { again = true; return; }
  if (!navigator.onLine) { set({ status: 'offline' }); return; }
  running = true; set({ status: 'syncing' });
  try {
    const s = await token();
    // 1) traer lo nuevo de la nube
    const since = await db.meta('lastPull') || '1970-01-01T00:00:00Z';
    let cursor = since, got;
    do {
      const r = await api(`/rest/v1/items?select=id,data,updated_at,deleted,server_ts&server_ts=gt.${encodeURIComponent(cursor)}&order=server_ts.asc&limit=500`);
      got = await r.json();
      for (const row of got) {
        cursor = row.server_ts;   // siempre avanza, aunque la fila ya la tenga (antes podía quedarse en un bucle sin fin)
        const local = await db.get(row.id);
        if (local && (local.updatedAt || 0) >= row.updated_at) continue; // es lo mismo que ya tengo (o lo local es más nuevo)
        const rec = row.data || { id: row.id };
        rec.updatedAt = row.updated_at; if (row.deleted) rec.deleted = 1;
        await db.put(rec, { origin: 'remote', keepTime: true });
      }
    } while (got.length === 500);
    await db.meta('lastPull', cursor);
    // 2) subir archivos (PDF, fotos, fuentes)
    for (const b of await db.pendingBlobs()) {
      await api(`/storage/v1/object/blobs/${s.user}/${encodeURIComponent(b.id)}`, { method: 'POST', headers: { 'Content-Type': b.type || 'application/octet-stream', 'x-upsert': 'true' }, body: b.blob });
      await db.setBlobUploaded(b.id);
    }
    // 3) subir cambios locales
    const dirty = await db.dirtyItems();
    for (let i = 0; i < dirty.length; i += 100) {
      const chunk = dirty.slice(i, i + 100);
      await api('/rest/v1/items?on_conflict=user_id,id', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(chunk.map(r => { const { dirty: _d, ...data } = r; return { id: r.id, user_id: s.user, kind: r.kind, data, updated_at: r.updatedAt || Date.now(), deleted: !!r.deleted }; })),
      });
      const stamps = {}; chunk.forEach(r => stamps[r.id] = r.updatedAt);
      await db.markClean(chunk.map(r => r.id), stamps);
    }
    set({ status: 'ok', last: Date.now(), error: '' });
  } catch (e) {
    console.warn(e);
    set({ status: navigator.onLine ? 'error' : 'offline', error: e.message });
  }
  running = false;
  if (again) { again = false; setTimeout(syncNow, 500); }
}

async function fetchRemoteBlob(id) {
  if (!getSes()) return null;
  try {
    const s = await token();
    const r = await api(`/storage/v1/object/authenticated/blobs/${s.user}/${encodeURIComponent(id)}`);
    const b = await r.blob();
    await db.putBlob(id, b, { uploaded: 1 });
    return b;
  } catch (e) { console.warn('No se pudo bajar', id, e); return null; }
}
window.__fetchRemoteBlob = fetchRemoteBlob;

let unsub = null;
export function start() {
  if (!getSes() || !getCfg().url) { set({ status: getCfg().url ? 'signedout' : 'off' }); return; }
  stop();
  let t;
  unsub = db.onChange((rec, origin) => { if (origin === 'local') { clearTimeout(t); t = setTimeout(syncNow, 3000); } });
  timer = setInterval(syncNow, 45000);
  addEventListener('online', syncNow);
  document.addEventListener('visibilitychange', onVis);
  syncNow();
}
function onVis() { if (document.visibilityState === 'visible') syncNow(); }
export function stop() { clearInterval(timer); unsub?.(); removeEventListener('online', syncNow); document.removeEventListener('visibilitychange', onVis); }

export const SQL = `-- 1) Tabla donde se guardan tus materias, cuadernos, páginas y subrayados
create table if not exists public.items (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  kind text,
  data jsonb,
  updated_at bigint,
  deleted boolean default false,
  server_ts timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists items_ts on public.items (user_id, server_ts);
alter table public.items enable row level security;
create policy "solo mis datos" on public.items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.touch_ts() returns trigger language plpgsql as $$
begin new.server_ts := clock_timestamp(); return new; end $$;
drop trigger if exists items_touch on public.items;
create trigger items_touch before insert or update on public.items
  for each row execute function public.touch_ts();

-- 2) Carpeta privada para PDFs, fotos y fuentes
insert into storage.buckets (id, name, public) values ('blobs', 'blobs', false)
  on conflict (id) do nothing;
create policy "leer mis archivos" on storage.objects for select
  using (bucket_id = 'blobs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "subir mis archivos" on storage.objects for insert
  with check (bucket_id = 'blobs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cambiar mis archivos" on storage.objects for update
  using (bucket_id = 'blobs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar mis archivos" on storage.objects for delete
  using (bucket_id = 'blobs' and (storage.foldername(name))[1] = auth.uid()::text);`;
