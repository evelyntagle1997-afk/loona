// Libro de verdad: cuando pasas de página (en el cuaderno o en el PDF) una hoja de papel gira sobre la página,
// con curvatura, sombra y brillo, como al pasar una hoja de un libro. Solo efecto visual: no cambia nada.
const lite = () => document.documentElement.classList.contains('lite') || matchMedia('(prefers-reduced-motion: reduce)').matches;
export function attachPageTurn(scroller, pageSel) {
  if (!scroller || scroller._pt) return; scroller._pt = 1;
  let cur = -1, t = 0, busy = false;
  const current = () => {
    const pages = [...scroller.querySelectorAll(pageSel)]; if (!pages.length) return -1;
    const r0 = scroller.getBoundingClientRect(), mid = r0.top + r0.height * .45;
    let best = -1, bd = 1e9;
    pages.forEach((p, i) => { const r = p.getBoundingClientRect(); const d = r.top <= mid && r.bottom >= mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid)); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  const flip = dir => {
    if (busy || lite()) return; busy = true;
    const host = scroller.parentElement; const r = scroller.getBoundingClientRect(), hr = host.getBoundingClientRect();
    const sheet = document.createElement('div');
    sheet.className = 'pt-sheet ' + (dir > 0 ? 'fwd' : 'back');
    Object.assign(sheet.style, { left: (r.left - hr.left) + 'px', top: (r.top - hr.top) + 'px', width: r.width + 'px', height: r.height + 'px' });
    sheet.innerHTML = '<i class="pt-face"></i><i class="pt-shade"></i>';
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.append(sheet);
    setTimeout(() => { sheet.remove(); busy = false; }, 720);
  };
  scroller.addEventListener('scroll', () => {
    clearTimeout(t);
    t = setTimeout(() => { const c = current(); if (c < 0) return; if (cur >= 0 && c !== cur) flip(c > cur ? 1 : -1); cur = c; }, 90);
  }, { passive: true });
  setTimeout(() => { cur = current(); }, 600);
}
