// Funciona sin internet y aunque el sitio esté pausado: guarda TODA la app
// (incluidos los decodificadores de imágenes de PDF) en el dispositivo.
const V = 'apuntes-v85';
const CORE = ["./", "js/ambient.js", "css/app.css", "icons/apple-180.png", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "index.html", "js/app.js", "js/db.js", "js/fonts.js", "js/home.js", "js/imageeditor.js", "js/ink.js", "js/minikb.js", "js/tpledit.js", "js/notebook.js", "js/pdfview.js", "js/stickers.js", "js/study.js", "js/summarizer.js", "js/sync.js", "js/solver.js", "js/loona.js", "js/recorder.js", "js/music.js", "js/backup.js", "js/handsfree.js", "js/live.js", "js/agenda.js", "vendor/page-flip/page-flip.module.js", "img/portada.webp", "img/marco.webp", "img/marco-top.webp", "img/clip.webp", "img/nota-luna.webp", "img/marco-top-claro.webp", "img/marco-top-grafito.webp", "img/cuero.jpg", "img/papel.jpg", "img/agenda.webp", "img/agenda-s.webp", "img/deco-polaroid.webp", "img/deco-corazon.webp", "img/deco-sello.webp", "img/grano.png", "js/tapes.js", "js/templates.js", "js/ui.js", "js/wheel.js", "manifest.webmanifest", "vendor/katex/katex.min.js", "vendor/katex/katex.min.css", "vendor/katex/fonts/KaTeX_AMS-Regular.woff2", "vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2", "vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2", "vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2", "vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2", "vendor/katex/fonts/KaTeX_Main-Bold.woff2", "vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2", "vendor/katex/fonts/KaTeX_Main-Italic.woff2", "vendor/katex/fonts/KaTeX_Main-Regular.woff2", "vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2", "vendor/katex/fonts/KaTeX_Math-Italic.woff2", "vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2", "vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2", "vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2", "vendor/katex/fonts/KaTeX_Script-Regular.woff2", "vendor/katex/fonts/KaTeX_Size1-Regular.woff2", "vendor/katex/fonts/KaTeX_Size2-Regular.woff2", "vendor/katex/fonts/KaTeX_Size3-Regular.woff2", "vendor/katex/fonts/KaTeX_Size4-Regular.woff2", "vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2", "vendor/pdf-lib.min.js", "vendor/pdf.min.mjs", "vendor/pdf.worker.min.mjs", "vendor/standard_fonts/FoxitDingbats.pfb", "vendor/standard_fonts/FoxitFixed.pfb", "vendor/standard_fonts/FoxitFixedBold.pfb", "vendor/standard_fonts/FoxitFixedBoldItalic.pfb", "vendor/standard_fonts/FoxitFixedItalic.pfb", "vendor/standard_fonts/FoxitSerif.pfb", "vendor/standard_fonts/FoxitSerifBold.pfb", "vendor/standard_fonts/FoxitSerifBoldItalic.pfb", "vendor/standard_fonts/FoxitSerifItalic.pfb", "vendor/standard_fonts/FoxitSymbol.pfb", "vendor/standard_fonts/LiberationSans-Bold.ttf", "vendor/standard_fonts/LiberationSans-BoldItalic.ttf", "vendor/standard_fonts/LiberationSans-Italic.ttf", "vendor/standard_fonts/LiberationSans-Regular.ttf", "vendor/wasm/jbig2.wasm", "vendor/wasm/jbig2_nowasm_fallback.js", "vendor/wasm/openjpeg.wasm", "vendor/wasm/openjpeg_nowasm_fallback.js", "vendor/wasm/qcms_bg.wasm"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(async c => {
    // de a poco, para que un archivo que falle no impida guardar el resto
    for (let i = 0; i < CORE.length; i += 20) await Promise.all(CORE.slice(i, i + 20).map(u => c.add(u).catch(() => { })));
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
const isPage = req => req.mode === 'navigate' || /\.html?$|\/$/.test(new URL(req.url).pathname);
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/supabase\.co|generativelanguage|youtube\.com|ytimg\.com|googlevideo/.test(u.href)) return;   // nube e IA: siempre en vivo
  const external = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net|tessdata|staticimgly\.com/.test(u.host);
  if (u.origin !== location.origin && !external) return;
  if (u.origin === location.origin) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request, { ignoreSearch: true });
      try {
        const r = await fetch(e.request);
        // si el servidor responde con error o con una página de aviso en vez del archivo, usa la copia guardada
        const html = (r.headers.get('content-type') || '').includes('text/html');
        if (!r.ok || (html && !isPage(e.request))) return cached || r;
        if (r.ok && (!html || isPage(e.request))) { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); }
        return r;
      } catch { return cached || (isPage(e.request) ? caches.match('./') : Response.error()); }
    })());
    return;
  }
  e.respondWith(caches.match(e.request).then(m => m || fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(V).then(ca => ca.put(e.request, c)); } return r; })));
});
