// Trazos de tinta con presión: lápiz fino, pincel de lettering y marcador.

export const PENS = {
  pen: { name: 'Estilógrafo', thin: .35, smooth: .5 },
  brush: { name: 'Pincel lettering', thin: .85, smooth: .65 },
  marker: { name: 'Marcador', thin: 0, smooth: .7 },
  pencil: { name: 'Lápiz grafito', thin: .2, smooth: .4 },
  glitter: { name: 'Marcador con escarcha', thin: 0, smooth: .7 },
  write: { name: 'Escritura a mano', thin: .3, smooth: .5 },
};

// números "al azar" pero siempre iguales para el mismo trazo (la escarcha no cambia al redibujar)
function rand(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
function tint(hex, k) { // k>0 aclara, k<0 oscurece
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const f = v => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
// escarcha: puntitos y destellos brillantes a lo largo del trazo
function sparkles(ctx, stroke, pts) {
  const seed = Math.round(pts[0][0] * 131 + pts[0][1] * 977 + pts.length * 7);
  const R = rand(seed), W = stroke.w, a = stroke.a ?? .6;
  const cols = ['#FFFFFF', '#FFF4DC', '#F3D9A4', '#E8C27A', tint(stroke.c, .55), tint(stroke.c, -.35)];
  ctx.globalCompositeOperation = 'source-over';
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1], p1 = pts[i];
    const seg = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    acc += seg;
    const step = Math.max(.35, 7 / Math.max(6, W));   // más densa: escarcha de verdad
    const n = Math.floor(acc / step); acc -= n * step;
    for (let j = 0; j < n; j++) {
      const t = R(), x = p0[0] + (p1[0] - p0[0]) * t + (R() - .5) * W * .95, y = p0[1] + (p1[1] - p0[1]) * t + (R() - .5) * W * .95;
      const c = cols[Math.floor(R() * cols.length)], sz = .45 + R() * R() * Math.max(1.6, W * .09);
      ctx.globalAlpha = Math.min(1, .65 + R() * .35) * (.6 + a * .4);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, sz, 0, 7); ctx.fill();
      if (R() < .03) { // destello en cruz
        const L = 2 + R() * W * .3;
        ctx.globalAlpha = 1; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(x - L, y); ctx.lineTo(x + L, y); ctx.moveTo(x, y - L); ctx.lineTo(x, y + L); ctx.stroke();
      }
    }
  }
}

// Presión efectiva: usa la del lápiz óptico; con dedo o mouse la simula por velocidad
export function pressures(pts, simulate) {
  if (!simulate) return pts.map(p => p[2] ?? .5);
  const out = []; let prev = .5;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i];
    const v = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const target = Math.max(.2, Math.min(1, 1 - v / 22));
    prev = prev + (target - prev) * .35;
    out.push(prev);
  }
  return out;
}

function smooth(pts, k) {
  if (pts.length < 3 || !k) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    out.push([b[0] * (1 - k) + (a[0] + c[0]) / 2 * k, b[1] * (1 - k) + (a[1] + c[1]) / 2 * k, b[2]]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Contorno relleno del trazo (anchura variable + tapas redondas)
export function outline(stroke) {
  const cfg = PENS[stroke.t] || PENS.pen;
  let pts = stroke.pts.filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > .4);
  if (!pts.length) return null;
  pts = smooth(smooth(pts, cfg.smooth), cfg.smooth * .6);
  const pr = pressures(pts, stroke.sim);
  const W = stroke.w;
  const rad = pr.map((p, i) => {
    let r = W / 2 * (1 - cfg.thin + cfg.thin * p * 1.6);
    // afinado al inicio y final para que parezca tinta real
    const taper = Math.min(1, (i + 1) / 4, (pts.length - i) / 4);
    if (cfg.thin) r *= .45 + .55 * taper;
    return Math.max(.35, r);
  });
  if (pts.length === 1) return { dot: [pts[0][0], pts[0][1], rad[0]] };
  const L = [], R = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    L.push([pts[i][0] - dy * rad[i], pts[i][1] + dx * rad[i]]);
    R.push([pts[i][0] + dy * rad[i], pts[i][1] - dx * rad[i]]);
  }
  return { L, R, pts, rad, cap: stroke.t !== 'marker' && stroke.t !== 'glitter' };
}

export function drawStroke(ctx, stroke) {
  const o = outline(stroke);
  if (!o) return;
  ctx.save();
  ctx.fillStyle = stroke.c;
  ctx.strokeStyle = stroke.c;
  // intensidad elegida (a); si el trazo es antiguo, la de siempre
  const A = stroke.a;
  if (stroke.t === 'marker') { ctx.globalAlpha = A ?? .42; ctx.globalCompositeOperation = 'multiply'; }
  else if (stroke.t === 'glitter') { ctx.globalAlpha = .25 + (A ?? .6) * .7; ctx.globalCompositeOperation = 'multiply'; }
  else if (stroke.t === 'pencil') ctx.globalAlpha = .85 * (A ?? 1);
  else if (A != null) ctx.globalAlpha = A;
  if (o.dot) { ctx.beginPath(); ctx.arc(o.dot[0], o.dot[1], o.dot[2], 0, 7); ctx.fill(); ctx.restore(); return; }
  if (stroke.t === 'marker' || stroke.t === 'glitter') {
    // punta biselada: ancho constante y extremos rectos
    ctx.lineWidth = stroke.w; ctx.lineCap = stroke.t === 'glitter' ? 'round' : 'butt'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(o.pts[0][0], o.pts[0][1]);
    for (let i = 1; i < o.pts.length; i++) ctx.lineTo(o.pts[i][0], o.pts[i][1]);
    ctx.stroke();
    if (stroke.t === 'glitter') {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = .28; ctx.strokeStyle = tint(stroke.c, .6); ctx.lineWidth = stroke.w * .35;
      ctx.beginPath(); ctx.moveTo(o.pts[0][0], o.pts[0][1] - stroke.w * .12);
      for (let i = 1; i < o.pts.length; i++) ctx.lineTo(o.pts[i][0], o.pts[i][1] - stroke.w * .12);
      ctx.stroke();
      sparkles(ctx, stroke, o.pts);
    }
    ctx.restore(); return;
  }
  ctx.beginPath();
  ctx.moveTo(o.L[0][0], o.L[0][1]);
  for (let i = 1; i < o.L.length; i++) {
    const m = [(o.L[i - 1][0] + o.L[i][0]) / 2, (o.L[i - 1][1] + o.L[i][1]) / 2];
    ctx.quadraticCurveTo(o.L[i - 1][0], o.L[i - 1][1], m[0], m[1]);
  }
  const e = o.pts.length - 1;
  ctx.lineTo(o.L[e][0], o.L[e][1]);
  ctx.arc(o.pts[e][0], o.pts[e][1], o.rad[e], Math.atan2(o.L[e][1] - o.pts[e][1], o.L[e][0] - o.pts[e][0]), Math.atan2(o.R[e][1] - o.pts[e][1], o.R[e][0] - o.pts[e][0]), true);
  for (let i = e; i > 0; i--) {
    const m = [(o.R[i - 1][0] + o.R[i][0]) / 2, (o.R[i - 1][1] + o.R[i][1]) / 2];
    ctx.quadraticCurveTo(o.R[i][0], o.R[i][1], m[0], m[1]);
  }
  ctx.lineTo(o.R[0][0], o.R[0][1]);
  ctx.arc(o.pts[0][0], o.pts[0][1], o.rad[0], Math.atan2(o.R[0][1] - o.pts[0][1], o.R[0][0] - o.pts[0][0]), Math.atan2(o.L[0][1] - o.pts[0][1], o.L[0][0] - o.pts[0][0]), true);
  ctx.closePath();
  ctx.fill();
  if (stroke.t === 'pencil') { // grano de grafito
    ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = .25;
    for (let i = 0; i < o.pts.length; i += 2) ctx.fillRect(o.pts[i][0] + (Math.sin(i * 12.9) * o.rad[i]), o.pts[i][1] + Math.cos(i * 7.3) * o.rad[i], .7, .7);
  }
  ctx.restore();
}

export function hitStroke(stroke, x, y, r) {
  const pts = stroke.pts;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l));
    if (Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy) < r + stroke.w / 2) return true;
  }
  return false;
}

export function bbox(stroke) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of stroke.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  const m = stroke.w; return [x0 - m, y0 - m, x1 + m, y1 + m];
}
