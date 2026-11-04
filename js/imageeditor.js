// Editor de fotos: recorte a mano alzada, quitar fondo (IA o varita),
// borrador, contorno tipo sticker. Devuelve un PNG con transparencia.
import { h, icon, modal, toast, clamp } from './ui.js';

const BG_LIB = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.8/+esm';

export function editImage(file) {
  return new Promise(async resolve => {
    const img = await loadImg(file);
    const max = 1600;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const W = Math.round(img.width * k), H = Math.round(img.height * k);
    const orig = canvas(W, H); orig.getContext('2d').drawImage(img, 0, 0, W, H);
    const cur = canvas(W, H); cur.getContext('2d').drawImage(orig, 0, 0);
    const view = h('canvas', { class: 'ie-canvas' });
    const over = h('canvas', { class: 'ie-over' });
    const stage = h('div', { class: 'ie-stage checker' }, view, over);
    let tool = 'lasso', tol = 32, brush = 28, outlineOn = false, history = [];
    const snap = () => { history.push(cur.getContext('2d').getImageData(0, 0, W, H)); if (history.length > 15) history.shift(); };
    const tools = [
      ['lasso', 'lasso', 'Recortar a mano alzada', 'Rodea con el dedo o el lápiz lo que quieres conservar'],
      ['wand', 'wand', 'Borrar color', 'Toca el fondo: se borra todo el color parecido que esté unido'],
      ['eraser', 'eraser', 'Borrador', 'Pasa el dedo por lo que quieras quitar'],
      ['restore', 'brush', 'Recuperar', 'Pinta para devolver partes de la foto original'],
    ];
    const hint = h('p', { class: 'ie-hint' });
    const tb = h('div', { class: 'ie-tools' }, ...tools.map(([k, ic, name, tip]) => h('button', { class: 'chip', 'data-k': k, title: tip, html: icon(ic, 18) + name, onclick: () => { tool = k; sync(); } })));
    const tolIn = h('input', { type: 'range', min: 5, max: 90, value: tol, oninput: e => tol = +e.target.value });
    const brIn = h('input', { type: 'range', min: 6, max: 90, value: brush, oninput: e => brush = +e.target.value });
    const aiBtn = h('button', { class: 'btn primary', html: icon('spark', 18) + 'Quitar fondo automático', onclick: () => removeBgAI() });
    const outlineBtn = h('label', { class: 'dp-tg' }, h('input', { type: 'checkbox', onchange: e => { outlineOn = e.target.checked; paint(); } }), h('span', { class: 'sw' }), 'Borde blanco de sticker');
    const opts = h('div', { class: 'ie-opts' },
      h('label', { class: 'dp-row' }, 'Tolerancia', tolIn),
      h('label', { class: 'dp-row' }, 'Tamaño del pincel', brIn), outlineBtn,
      h('div', { class: 'ie-row' }, h('button', { class: 'chip', html: icon('undo', 18) + 'Deshacer', onclick: () => { const d = history.pop(); if (d) { cur.getContext('2d').putImageData(d, 0, 0); paint(); } } }),
        h('button', { class: 'chip', onclick: () => { snap(); const c = cur.getContext('2d'); c.clearRect(0, 0, W, H); c.drawImage(orig, 0, 0); paint(); } }, 'Volver al original')));
    // filtros que adaptan los colores de la imagen a la paleta de Loona (negro, plata, humo, ámbar)
    const FILTERS = [
      ['Plata nocturna', [[0, [10, 9, 10]], [.55, [140, 136, 139]], [1, [246, 244, 241]]]],
      ['Ámbar', [[0, [14, 10, 8]], [.5, [150, 84, 38]], [1, [250, 226, 196]]]],
      ['Humo', [[0, [28, 27, 28]], [.6, [120, 117, 119]], [1, [214, 211, 209]]]],
      ['Tinta negra', [[0, [8, 7, 8]], [.45, [8, 7, 8]], [.55, [236, 233, 229]], [1, [236, 233, 229]]]],
    ];
    const tone = stops => {
      snap(); const c = cur.getContext('2d'), id = c.getImageData(0, 0, W, H), d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = Math.min(1, (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114) / 255 * 1.05);
        let j = 1; while (j < stops.length - 1 && stops[j][0] < l) j++;
        const [t0, c0] = stops[j - 1], [t1, c1] = stops[j], t = Math.max(0, Math.min(1, (l - t0) / (t1 - t0 || 1)));
        d[i] = c0[0] + (c1[0] - c0[0]) * t; d[i + 1] = c0[1] + (c1[1] - c0[1]) * t; d[i + 2] = c0[2] + (c1[2] - c0[2]) * t;
      }
      c.putImageData(id, 0, 0); paint();
    };
    const filt = h('div', { class: 'ie-row ie-filters' }, ...FILTERS.map(([n, st]) => h('button', { class: 'chip', onclick: () => tone(st) }, n)));
    opts.append(h('p', { class: 'ie-hint' }, 'Colores de tu paleta'), filt);
    const body = h('div', { class: 'ie' }, h('div', { class: 'ie-side' }, aiBtn, tb, hint, opts), stage);
    function sync() {
      tb.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === tool));
      hint.textContent = tools.find(t => t[0] === tool)[3];
      tolIn.parentElement.style.display = tool === 'wand' ? '' : 'none';
      brIn.parentElement.style.display = tool === 'eraser' || tool === 'restore' ? '' : 'none';
    }
    let scale = 1;
    function fit() {
      const r = stage.getBoundingClientRect();
      scale = Math.min((r.width - 8) / W, (r.height - 8) / H, 2);
      for (const c of [view, over]) { c.width = W; c.height = H; c.style.width = W * scale + 'px'; c.style.height = H * scale + 'px'; }
      paint();
    }
    function paint() {
      const c = view.getContext('2d');
      c.clearRect(0, 0, W, H);
      if (outlineOn) c.drawImage(withOutline(cur), -outlinePad(cur), -outlinePad(cur));
      else c.drawImage(cur, 0, 0);
    }
    const pos = e => { const r = over.getBoundingClientRect(); return [(e.clientX - r.left) / scale, (e.clientY - r.top) / scale]; };
    let path = null;
    over.addEventListener('pointerdown', e => {
      e.preventDefault(); over.setPointerCapture(e.pointerId);
      const p = pos(e);
      if (tool === 'wand') { snap(); floodErase(cur, p, tol); paint(); return; }
      if (tool === 'eraser' || tool === 'restore') snap();
      path = [p]; dab(p);
    });
    over.addEventListener('pointermove', e => {
      if (!path) return;
      const p = pos(e); path.push(p);
      if (tool === 'lasso') {
        const c = over.getContext('2d'); c.clearRect(0, 0, W, H);
        c.beginPath(); path.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
        c.lineWidth = 3 / scale; c.setLineDash([8 / scale, 6 / scale]); c.strokeStyle = '#7A2B3A'; c.stroke();
        c.fillStyle = 'rgba(122,43,58,.12)'; c.fill();
      } else dab(p, path[path.length - 2]);
    });
    over.addEventListener('pointerup', () => {
      if (!path) return;
      if (tool === 'lasso' && path.length > 5) {
        snap();
        const c = cur.getContext('2d');
        c.save(); c.globalCompositeOperation = 'destination-in';
        c.beginPath(); path.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.fill(); c.restore();
        over.getContext('2d').clearRect(0, 0, W, H);
        paint();
      }
      path = null;
    });
    function dab(p, prev) {
      if (tool !== 'eraser' && tool !== 'restore') return;
      const c = cur.getContext('2d');
      const r = brush / 2;
      const pts = [p];
      if (prev) { const d = Math.hypot(p[0] - prev[0], p[1] - prev[1]); for (let t = r / 3; t < d; t += r / 3) pts.push([prev[0] + (p[0] - prev[0]) * t / d, prev[1] + (p[1] - prev[1]) * t / d]); }
      for (const q of pts) {
        c.save(); c.beginPath(); c.arc(q[0], q[1], r, 0, 7);
        if (tool === 'eraser') { c.globalCompositeOperation = 'destination-out'; c.fill(); }
        else { c.clip(); c.drawImage(orig, 0, 0); }
        c.restore();
      }
      paint();
    }
    async function removeBgAI() {
      aiBtn.disabled = true; aiBtn.textContent = 'Preparando… (la primera vez descarga el modelo)';
      try {
        const mod = await import(BG_LIB);
        const fn = mod.removeBackground || mod.default;
        const src = await new Promise(r => cur.toBlob(r, 'image/png'));
        const out = await fn(src, {
          model: 'isnet_quint8', output: { format: 'image/png' },
          progress: (k, a, b) => { if (b) aiBtn.textContent = `Descargando modelo ${Math.round(a / b * 100)}%`; },
        });
        const im = await loadImg(out);
        snap();
        const c = cur.getContext('2d'); c.clearRect(0, 0, W, H); c.drawImage(im, 0, 0, W, H);
        paint(); toast('Fondo quitado. Puedes retocar con Borrador o Recuperar.');
      } catch (e) {
        console.warn(e);
        toast('No se pudo quitar el fondo automático (necesita internet). Usa "Borrar color" o "Recortar a mano alzada".', 5000);
      }
      aiBtn.disabled = false; aiBtn.innerHTML = icon('spark', 18) + 'Quitar fondo automático';
    }
    sync();
    const m = modal({
      title: 'Editar foto', wide: true, body,
      actions: [
        { label: 'Cancelar', onclick: () => resolve(null) },
        {
          label: 'Pegar en el cuaderno', primary: true, onclick: async () => {
            let outC = outlineOn ? withOutline(cur) : cur;
            outC = trim(outC);
            const blob = await new Promise(r => outC.toBlob(r, 'image/png'));
            resolve({ blob, w: outC.width, h: outC.height });
          },
        },
      ],
      onClose: () => resolve(null),
    });
    m.box.classList.add('ie-modal');
    requestAnimationFrame(fit);
  });
}

function canvas(w, h0) { const c = document.createElement('canvas'); c.width = w; c.height = h0; return c; }
export function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i); i.onerror = rej;
    i.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  });
}

function floodErase(cv, [sx, sy], tol) {
  const W = cv.width, H = cv.height, c = cv.getContext('2d');
  const d = c.getImageData(0, 0, W, H), a = d.data;
  sx = clamp(Math.round(sx), 0, W - 1); sy = clamp(Math.round(sy), 0, H - 1);
  const i0 = (sy * W + sx) * 4;
  if (a[i0 + 3] === 0) return;
  const R = a[i0], G = a[i0 + 1], B = a[i0 + 2];
  const t2 = tol * tol * 3;
  const seen = new Uint8Array(W * H);
  const stack = [sy * W + sx];
  while (stack.length) {
    const p = stack.pop();
    if (seen[p]) continue; seen[p] = 1;
    const i = p * 4;
    if (a[i + 3] === 0) continue;
    const dr = a[i] - R, dg = a[i + 1] - G, db = a[i + 2] - B;
    const dist = dr * dr + dg * dg + db * db;
    if (dist > t2) continue;
    // borde suave cerca del límite de tolerancia
    a[i + 3] = dist > t2 * .6 ? Math.round(a[i + 3] * (dist / t2 - .6) / .4) : 0;
    const x = p % W, y = (p / W) | 0;
    if (x > 0) stack.push(p - 1); if (x < W - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - W); if (y < H - 1) stack.push(p + W);
  }
  c.putImageData(d, 0, 0);
}

const outlinePad = cv => Math.max(6, Math.round(Math.max(cv.width, cv.height) * .018));
function withOutline(cv) {
  const pad = outlinePad(cv);
  const out = canvas(cv.width + pad * 2, cv.height + pad * 2);
  const c = out.getContext('2d');
  const sil = canvas(out.width, out.height), s = sil.getContext('2d');
  for (let a = 0; a < 24; a++) s.drawImage(cv, pad + Math.cos(a / 24 * 6.283) * pad, pad + Math.sin(a / 24 * 6.283) * pad);
  s.globalCompositeOperation = 'source-in'; s.fillStyle = '#FFFBF6'; s.fillRect(0, 0, out.width, out.height);
  c.drawImage(sil, 0, 0); c.drawImage(cv, pad, pad);
  return out;
}
function trim(cv) {
  const W = cv.width, H = cv.height, d = cv.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return cv;
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(cv, -x0, -y0);
  return out;
}
