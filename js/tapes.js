// Cintas washi: al pasar el lápiz se dibuja una franja recta con patrón.
const enc = s => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}")`;

export const TAPE_COLORS = [
  { k: 'vino', bg: '#7A2B3A', fg: '#E8C3C6' },
  { k: 'rosa', bg: '#C98A95', fg: '#FFF4F2' },
  { k: 'malva', bg: '#E2C2C4', fg: '#7A2B3A' },
  { k: 'cacao', bg: '#6B4A3A', fg: '#E7CFAF' },
  { k: 'kraft', bg: '#C9A57A', fg: '#6B4A3A' },
  { k: 'crema', bg: '#F1E3D0', fg: '#94505F' },
];

const P = {
  liso: () => '',
  estrellas: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34"><g fill="${f}"><path d="M9 3l1.6 3.6 3.9.4-3 2.6.9 3.8L9 11.4 5.6 13.4l.9-3.8-3-2.6 3.9-.4z"/><path d="M26 19l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.5-2.5 1.5.6-2.8-2.1-1.9 2.8-.3z" opacity=".75"/><circle cx="25" cy="7" r="1.1"/><circle cx="8" cy="27" r="1.1"/></g></svg>`,
  puntos: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><g fill="${f}"><circle cx="4" cy="4" r="2"/><circle cx="12" cy="12" r="2"/></g></svg>`,
  rayas: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M-2 16L16 -2M-2 2L2 -2M12 16L16 12" stroke="${f}" stroke-width="3"/></svg>`,
  corazones: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><g fill="${f}"><path d="M7 12C2 9 2 5 4.5 4S7 5 7 6c0-1 1-3 2.5-2S12 9 7 12z"/><path d="M21 26c-5-3-5-7-2.5-8s2.5 1 2.5 2c0-1 1-3 2.5-2s2.5 5-2.5 8z" opacity=".7"/></g></svg>`,
  cuadros: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><g fill="${f}" opacity=".45"><rect width="8" height="16"/><rect width="16" height="8"/></g><rect width="8" height="8" fill="${f}" opacity=".35"/></svg>`,
  flores: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"><g fill="${f}"><g transform="translate(10 10)">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="2.4" ry="4.4" cy="-4" transform="rotate(${a})"/>`).join('')}<circle r="1.8" fill-opacity=".6"/></g><g transform="translate(27 27) scale(.7)">${[0, 72, 144, 216, 288].map(a => `<ellipse rx="2.4" ry="4.4" cy="-4" transform="rotate(${a})"/>`).join('')}</g></g></svg>`,
  encaje: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="40"><g fill="none" stroke="${f}" stroke-width="1.2"><path d="M0 6a5 5 0 0 0 10 0a5 5 0 0 0 10 0M0 34a5 5 0 0 1 10 0a5 5 0 0 1 10 0"/><circle cx="10" cy="20" r="3.2"/><circle cx="0" cy="20" r="3.2"/><circle cx="20" cy="20" r="3.2"/></g></svg>`,
  hojas: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30"><g fill="${f}"><path d="M6 22C6 12 14 6 22 6c0 10-8 16-16 16z"/><path d="M6 22L18 10" stroke="${f}" stroke-opacity=".5"/></g></svg>`,
  cuadricula: (f) => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="M10 0H0V10" fill="none" stroke="${f}" stroke-width=".8" opacity=".7"/></svg>`,
};
export const TAPE_PATTERNS = Object.keys(P);

export function tapeStyle(pattern, colorKey) {
  const c = TAPE_COLORS.find(x => x.k === colorKey) || TAPE_COLORS[0];
  const p = (P[pattern] || P.liso)(c.fg);
  return { background: p ? `${enc(p)}, ${c.bg}` : c.bg };
}

// Bordes rasgados en los extremos (como cinta cortada con la mano)
const L = enc(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="40" preserveAspectRatio="none" viewBox="0 0 8 40"><path d="M3 0 L0 4 L3 8 L1 12 L4 16 L0 20 L3 24 L1 28 L4 32 L0 36 L3 40 H8 V0Z"/></svg>`);
const R = enc(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="40" preserveAspectRatio="none" viewBox="0 0 8 40"><path d="M5 0 L8 4 L4 8 L7 12 L5 16 L8 20 L4 24 L7 28 L5 32 L8 36 L5 40 H0 V0Z"/></svg>`);
export const TORN_MASK = `${L} left / 8px 100% no-repeat, ${R} right / 8px 100% no-repeat, linear-gradient(#000,#000) center / calc(100% - 15px) 100% no-repeat`;
