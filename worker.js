// Servidor de Loona en Cloudflare: entrega la app y busca canciones en YouTube
// (así poner música no gasta la cuota de Gemini). GET /api/yt?q=arctic monkeys do i wanna know
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

// saca los videos de la página de resultados de YouTube
export function parseResults(html) {
  const out = [], seen = new Set();
  const re = /"videoRenderer":\{"videoId":"([\w-]{11})"/g; let m;
  while ((m = re.exec(html)) && out.length < 10) {
    const id = m[1]; if (seen.has(id)) continue; seen.add(id);
    const nx = html.indexOf('"videoRenderer"', m.index + 20);
    const near = html.slice(m.index, nx > 0 ? Math.min(nx, m.index + 6000) : m.index + 6000);   // solo este video
    const t = /"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/.exec(near);
    let title = ''; try { title = t ? JSON.parse('"' + t[1] + '"') : ''; } catch { title = t?.[1] || ''; }
    const live = /"style":"LIVE"|BADGE_STYLE_TYPE_LIVE_NOW/.test(near);
    out.push({ id, title, live });
  }
  return out.filter(x => !x.live).concat(out.filter(x => x.live)).map(({ id, title }) => ({ id, title }));
}
async function fromYouTube(q) {
  const r = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=EgIQAQ%253D%253D&hl=es&gl=BR', {
    headers: { 'user-agent': UA, 'accept-language': 'es-419,es;q=0.9,en;q=0.8', cookie: 'CONSENT=YES+cb; SOCS=CAI' }, cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error('youtube ' + r.status);
  return parseResults(await r.text());
}
async function fromPiped(q) {   // respaldo si YouTube cambia su página
  for (const host of ['https://pipedapi.kavin.rocks', 'https://api.piped.private.coffee']) {
    try {
      const r = await fetch(host + '/search?filter=videos&q=' + encodeURIComponent(q), { headers: { 'user-agent': UA } });
      if (!r.ok) continue;
      const j = await r.json();
      const items = (j.items || []).map(x => ({ id: (/v=([\w-]{11})/.exec(x.url || '') || [])[1], title: x.title || '' })).filter(x => x.id);
      if (items.length) return items;
    } catch { }
  }
  return [];
}
async function yt(q, ctx) {
  q = (q || '').trim().slice(0, 200);
  if (!q) return json({ items: [], error: 'falta q' }, 400);
  const key = new Request('https://loona-cache.local/yt?q=' + encodeURIComponent(q.toLowerCase()));
  const cache = caches.default;
  const hit = await cache.match(key); if (hit) return hit;
  let items = [];
  try { items = await fromYouTube(q); } catch (e) { console.log('yt', e.message); }
  if (!items.length) items = await fromPiped(q);
  const res = json({ q, items }, 200, items.length ? { 'cache-control': 'public, max-age=86400' } : {});
  if (items.length) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

// ---------- preguntas reales del ENEM (2009-2023, de enem.dev) filtradas por tema ----------
const AREAS = ['ciencias-natureza', 'ciencias-humanas', 'matematica', 'linguagens'];
const bank = {};
const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
async function loadArea(env, origin, a) {
  if (bank[a]) return bank[a];
  const r = await env.ASSETS.fetch(new Request(origin + '/data/enem/' + a + '.json'));
  const list = await r.json();
  return bank[a] = list.map(q => ({ q, t: norm(q.c + ' ' + q.q + ' ' + q.a.map(x => x[1]).join(' ')) }));
}
export async function enem(env, origin, areaParam, kwParam, n = 10) {
  const kws = [...new Set((kwParam || '').split(',').map(k => norm(k).trim()).filter(k => k.length > 2))].slice(0, 14);
  if (!kws.length) return [];
  const areas = AREAS.includes(areaParam) ? [areaParam] : AREAS;
  const scored = [];
  for (const a of areas) for (const { q, t } of await loadArea(env, origin, a)) {
    let sc = 0, hits = 0;
    kws.forEach((k, i) => { const stem = k.length > 6 ? k.slice(0, k.length - 2) : k; const m = t.split(stem).length - 1; if (m) { hits++; sc += Math.min(m, 4) * (i < 3 ? 3 : 1.5); } });
    if (hits >= Math.min(2, kws.length) || (hits && sc >= 6)) scored.push({ q: { ...q, area: a }, sc: sc + hits * 4 + (q.y - 2009) * .05 });
  }
  return scored.sort((x, y) => y.sc - x.sc).slice(0, n).map(x => x.q);
}

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname === '/api/yt') return yt(u.searchParams.get('q'), ctx);
    if (u.pathname === '/api/enem') {
      try { return json({ items: await enem(env, u.origin, u.searchParams.get('area'), u.searchParams.get('k'), Math.min(30, +u.searchParams.get('n') || 12)) }, 200, { 'cache-control': 'public, max-age=86400' }); }
      catch (e) { return json({ items: [], error: e.message }, 500); }
    }
    if (u.pathname.startsWith('/api/')) return json({ error: 'no existe' }, 404);
    return env.ASSETS.fetch(req);
  },
};
