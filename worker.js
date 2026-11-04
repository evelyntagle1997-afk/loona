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

export default {
  async fetch(req, env, ctx) {
    const u = new URL(req.url);
    if (u.pathname === '/api/yt') return yt(u.searchParams.get('q'), ctx);
    if (u.pathname.startsWith('/api/')) return json({ error: 'no existe' }, 404);
    return env.ASSETS.fetch(req);
  },
};
