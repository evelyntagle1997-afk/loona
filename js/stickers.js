// Stickers estáticos, de aspecto realista, en tonos borgoña.
// Cada uno es un SVG con degradados y sombra; se usan como imagen para que
// los id internos no choquen entre sí.

const W = { d: '#3E111B', a: '#5E1F2B', b: '#7A2B3A', c: '#9E4A5C', l: '#C98A95', p: '#E8C3C6' };
const B = { d: '#3B2620', a: '#5B3B2E', c: '#8E6748', k: '#B8865B', s: '#D9B992', cr: '#F4E7D8' };
const BRASS = ['#8A6A3A', '#D8BC85', '#9C7A45'];

const shadow = `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="1.5" dy="3" stdDeviation="2.4" flood-color="#2A0E12" flood-opacity=".38"/></filter>`;
const lin = (id, a, b, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const rad = (id, a, b, cx = .35, cy = .3) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r=".8"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const svg = (defs, body, vb = '0 0 120 120') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><defs>${shadow}${defs}</defs><g filter="url(#sh)">${body}</g></svg>`;

const S = {
  sello: {
    name: 'Sello de lacre', tags: ['importante', 'clave', 'oficial', 'derecho', 'historia', 'carta', 'firma'],
    svg: svg(rad('g', W.c, W.d) + rad('i', W.b, W.d, .6, .65),
      `<path d="M60 10c9 0 12 6 20 8s14 2 18 10 0 14 3 22-2 14-6 20-2 14-10 18-13 2-20 6-11 8-18 6-12-6-19-8-15-4-18-12 0-14-4-22 1-14 6-20 4-14 12-18 12-2 18-6 9-4 18-4z" fill="url(#g)"/>
       <circle cx="60" cy="62" r="30" fill="url(#i)"/><circle cx="60" cy="62" r="30" fill="none" stroke="${W.l}" stroke-opacity=".35" stroke-width="1.5"/>
       <path d="M60 44c-4 6-12 8-12 16 0 6 5 10 12 14 7-4 12-8 12-14 0-8-8-10-12-16z" fill="${W.d}" opacity=".55"/>
       <path d="M60 46c-3 5-10 7-10 14 0 5 4 8 10 12" fill="none" stroke="${W.l}" stroke-opacity=".5" stroke-width="1.4"/>
       <ellipse cx="44" cy="34" rx="12" ry="6" fill="#fff" opacity=".18" transform="rotate(-30 44 34)"/>`),
  },
  rosa: {
    name: 'Rosa prensada', tags: ['literatura', 'arte', 'biología', 'botánica', 'amor', 'poesía', 'decorar'],
    svg: svg(rad('p1', W.c, W.a, .4, .4) + rad('p2', W.l, W.b) + lin('st', '#6E6A45', '#4F4B30'),
      `<path d="M62 64c2 18-4 34-10 48" stroke="url(#st)" stroke-width="3.2" fill="none" stroke-linecap="round"/>
       <path d="M58 86c-10-8-22-6-28 2 10 4 20 4 28-2z" fill="#6B6A44"/><path d="M58 86c-9-3-18-2-26 2" stroke="#4A4930" stroke-width=".8" fill="none"/>
       <path d="M60 92c10-10 22-10 28-4-8 6-18 8-28 4z" fill="#77744B"/>
       <circle cx="60" cy="44" r="26" fill="url(#p1)"/>
       <path d="M40 40c4-12 18-18 28-12 8 4 12 14 6 22-6 10-22 12-30 4-4-4-6-9-4-14z" fill="url(#p2)" opacity=".9"/>
       <path d="M50 40c2-8 12-11 18-6 5 4 5 12-1 15-6 4-14 2-17-3" fill="none" stroke="${W.d}" stroke-width="1.6" opacity=".55"/>
       <path d="M56 42c1-4 6-5 8-2 2 3 0 6-3 6" fill="none" stroke="${W.d}" stroke-width="1.4" opacity=".6"/>
       <path d="M36 50c-2 8 4 18 14 20M84 38c4 8 0 20-10 24" stroke="${W.d}" stroke-width="1.2" fill="none" opacity=".35"/>`),
  },
  lazo: {
    name: 'Lazo de cinta', tags: ['decorar', 'título', 'regalo', 'bonito', 'portada'],
    svg: svg(lin('r1', W.c, W.a) + lin('r2', W.b, W.d, 1, 1),
      `<path d="M60 58C44 38 18 32 14 44s10 30 46 18z" fill="url(#r1)"/><path d="M60 58c16-20 42-26 46-14S96 74 60 62z" fill="url(#r1)"/>
       <path d="M56 62l-16 44 12-4 6 12 6-50zM64 62l16 44-12-4-6 12-6-50z" fill="url(#r2)"/>
       <path d="M22 46c8-4 22 2 34 12M98 46c-8-4-22 2-34 12" stroke="#fff" stroke-opacity=".22" stroke-width="2" fill="none"/>
       <rect x="52" y="52" width="16" height="16" rx="5" fill="${W.b}"/><rect x="54" y="54" width="7" height="5" rx="2" fill="#fff" opacity=".2"/>`),
  },
  clip: {
    name: 'Clip metálico', tags: ['nota', 'adjuntar', 'recordar', 'oficina', 'tarea'],
    svg: svg(lin('m', BRASS[1], BRASS[0], 1, 0),
      `<path d="M48 18v62a12 12 0 0 0 24 0V30a8 8 0 0 0-16 0v46" fill="none" stroke="url(#m)" stroke-width="5" stroke-linecap="round"/>
       <path d="M47 24v54" stroke="#fff" stroke-opacity=".45" stroke-width="1.2"/>
       <path d="M44 84a16 16 0 0 0 32-4V24a12 12 0 0 0-24 0" fill="none" stroke="url(#m)" stroke-width="5" stroke-linecap="round" transform="rotate(8 60 60)" opacity="0"/>`, '20 0 80 120'),
  },
  chincheta: {
    name: 'Chincheta', tags: ['importante', 'recordar', 'nota', 'tarea', 'fijar'],
    svg: svg(rad('h', W.l, W.a, .35, .3) + lin('n', '#D9D2C8', '#7C746A', 1, 0),
      `<path d="M60 74l4 40-2 0z" fill="url(#n)"/><ellipse cx="60" cy="72" rx="18" ry="6" fill="${W.d}"/>
       <path d="M48 70l4-30h16l4 30z" fill="url(#h)"/><ellipse cx="60" cy="40" rx="16" ry="6" fill="${W.a}"/>
       <circle cx="60" cy="30" r="20" fill="url(#h)"/><ellipse cx="52" cy="22" rx="7" ry="4" fill="#fff" opacity=".5" transform="rotate(-25 52 22)"/>`),
  },
  etiqueta: {
    name: 'Etiqueta kraft', tags: ['título', 'nombre', 'materia', 'tema', 'portada'],
    svg: svg(lin('k', '#D7B98F', '#B8935F'),
      `<path d="M30 30h52l26 30-26 30H30a6 6 0 0 1-6-6V36a6 6 0 0 1 6-6z" fill="url(#k)"/>
       <circle cx="84" cy="60" r="5" fill="#F4E7D8" stroke="#8E6748" stroke-width="1.5"/>
       <path d="M89 60c10-2 20 4 26 14" stroke="${W.b}" stroke-width="2.4" fill="none"/>
       <path d="M36 50h36M36 60h40M36 70h28" stroke="#8E6748" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>
       <path d="M30 32h52" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/>`),
  },
  polaroid: {
    name: 'Marco polaroid', tags: ['foto', 'imagen', 'recuerdo', 'ejemplo', 'historia'],
    svg: svg(lin('f', '#FBF6EF', '#E9DDCC') + lin('ph', W.l, W.b, 1, 1),
      `<g transform="rotate(-6 60 60)"><rect x="22" y="14" width="76" height="92" rx="2" fill="url(#f)"/>
       <rect x="30" y="22" width="60" height="58" fill="url(#ph)"/>
       <path d="M30 70l18-16 12 10 10-8 20 18v6H30z" fill="${W.d}" opacity=".5"/><circle cx="76" cy="36" r="6" fill="${W.p}" opacity=".7"/>
       <rect x="44" y="6" width="32" height="14" fill="${W.l}" opacity=".55" transform="rotate(4 60 12)"/></g>`),
  },
  hoja: {
    name: 'Hoja otoñal', tags: ['biología', 'botánica', 'naturaleza', 'ecología', 'ambiente', 'geografía'],
    svg: svg(lin('l', '#A0485A', '#5E1F2B', 1, 1),
      `<path d="M60 108C26 90 18 52 40 22c8 10 18 6 20-8 4 10 16 12 22 4 18 32 8 74-22 90z" fill="url(#l)"/>
       <path d="M60 106V20M60 46l-14-10M60 62l-18-10M60 78l-16-8M60 46l14-12M60 62l18-12M60 78l16-10" stroke="${W.d}" stroke-width="1.4" fill="none" opacity=".6"/>
       <path d="M60 108l-2 10" stroke="${B.a}" stroke-width="2.5" stroke-linecap="round"/>`),
  },
  libros: {
    name: 'Pila de libros', tags: ['lectura', 'estudio', 'literatura', 'historia', 'investigación', 'teoría', 'tesis'],
    svg: svg(lin('a', W.b, W.a, 1, 0) + lin('b2', B.c, B.a, 1, 0) + lin('c', W.l, W.c, 1, 0),
      `<rect x="18" y="80" width="84" height="18" rx="2" fill="url(#a)"/><rect x="18" y="80" width="84" height="4" fill="#fff" opacity=".12"/><rect x="96" y="82" width="5" height="14" fill="${B.cr}"/>
       <rect x="24" y="62" width="74" height="18" rx="2" fill="url(#b2)"/><rect x="92" y="64" width="5" height="14" fill="${B.cr}"/><path d="M34 66v10M38 66v10" stroke="${B.s}" stroke-width="1.5"/>
       <rect x="20" y="44" width="78" height="18" rx="2" fill="url(#c)" transform="rotate(-4 60 53)"/>
       <path d="M30 40l12-28 8 3-12 28z" fill="${W.d}"/><path d="M42 12l8 3 2-4-8-3z" fill="${B.s}"/>`),
  },
  taza: {
    name: 'Taza de café', tags: ['descanso', 'estudio', 'noche', 'pausa', 'motivación'],
    svg: svg(lin('cu', '#F3E6D6', '#CDB8A0', 1, 0) + lin('co', B.a, B.d),
      `<path d="M26 44h60l-6 52a10 10 0 0 1-10 9H42a10 10 0 0 1-10-9z" fill="url(#cu)"/>
       <path d="M86 54c14-2 18 18 2 22" stroke="#CDB8A0" stroke-width="6" fill="none"/>
       <ellipse cx="56" cy="44" rx="30" ry="7" fill="url(#co)"/><path d="M44 44c6-3 18-3 24 0" stroke="${B.s}" stroke-width="1.5" fill="none"/>
       <path d="M34 62h44" stroke="${W.b}" stroke-width="6"/><path d="M48 30c-4-6 4-8 0-16M60 30c-4-6 4-8 0-16" stroke="${W.l}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>`),
  },
  lapiz: {
    name: 'Lápiz', tags: ['escribir', 'tarea', 'nota', 'ejercicio', 'matemática', 'dibujo'],
    svg: svg(lin('pb', W.c, W.a, 0, 1) + lin('wd', '#E9CFA8', '#C9A57A'),
      `<g transform="rotate(-38 60 60)"><rect x="14" y="52" width="70" height="16" fill="url(#pb)"/><rect x="14" y="52" width="70" height="5" fill="#fff" opacity=".18"/>
       <path d="M84 52l20 8-20 8z" fill="url(#wd)"/><path d="M98 57.6l6 2.4-6 2.4z" fill="${B.d}"/>
       <rect x="6" y="51" width="10" height="18" fill="${BRASS[1]}"/><rect x="0" y="52" width="8" height="16" rx="3" fill="${W.l}"/></g>`),
  },
  regla: {
    name: 'Regla y compás', tags: ['ingeniería', 'matemática', 'geometría', 'diseño', 'civil', 'dibujo técnico', 'arquitectura'],
    svg: svg(lin('rg', '#E6CBA0', '#C49C67') + lin('cm', '#DCD3C8', '#8D847A', 1, 0),
      `<rect x="12" y="76" width="96" height="18" rx="2" fill="url(#rg)" transform="rotate(-8 60 85)"/>
       <g transform="rotate(-8 60 85)" stroke="${B.a}" stroke-width="1.2">${Array.from({ length: 19 }, (_, i) => `<path d="M${16 + i * 5} 76v${i % 2 ? 4 : 7}"/>`).join('')}</g>
       <path d="M60 20L40 74M60 20l20 54" stroke="url(#cm)" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="20" r="6" fill="${W.b}"/><path d="M80 74l2 6" stroke="${B.d}" stroke-width="2"/>`),
  },
  casco: {
    name: 'Casco de obra', tags: ['ingeniería', 'civil', 'construcción', 'obra', 'seguridad', 'estructuras'],
    svg: svg(rad('hh', W.c, W.a, .4, .3),
      `<path d="M22 78a38 36 0 0 1 76 0z" fill="url(#hh)"/><rect x="12" y="76" width="96" height="10" rx="5" fill="${W.a}"/>
       <path d="M56 42h8v36h-8z" fill="${W.d}" opacity=".3"/><path d="M40 52v26M80 52v26" stroke="${W.d}" stroke-opacity=".25" stroke-width="3"/><path d="M8 82h104" stroke="#fff" stroke-opacity=".15" stroke-width="2"/><path d="M34 60c4-10 12-16 20-18" stroke="#fff" stroke-opacity=".3" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  },
  puente: {
    name: 'Puente', tags: ['ingeniería', 'civil', 'estructuras', 'puentes', 'vías', 'carretera', 'transporte'],
    svg: svg(lin('pt', W.b, W.a) + lin('wa', '#C7B2A8', '#9C8780'),
      `<rect x="8" y="84" width="104" height="22" rx="3" fill="url(#wa)"/>
       <path d="M8 70h104v8H8z" fill="url(#pt)"/><path d="M28 24v60M92 24v60" stroke="url(#pt)" stroke-width="6"/>
       <path d="M8 66Q28 30 28 26Q60 62 92 26Q92 30 112 66" fill="none" stroke="${W.c}" stroke-width="2.2"/>
       ${[40, 50, 60, 70, 80].map(x => `<path d="M${x} ${70}V${46 + Math.abs(60 - x) * 0.25}" stroke="${W.c}" stroke-width="1.2"/>`).join('')}
       <path d="M20 96h12M54 100h14M88 94h12" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>`),
  },
  matraz: {
    name: 'Matraz', tags: ['química', 'ciencia', 'laboratorio', 'experimento', 'biología'],
    svg: svg(lin('gl', '#F7EEEE', '#D8C7C8', 1, 0) + lin('lq', W.c, W.a),
      `<path d="M48 14h24v30l26 50a10 10 0 0 1-9 14H31a10 10 0 0 1-9-14l26-50z" fill="url(#gl)" opacity=".92"/>
       <path d="M34 76h52l12 18a10 10 0 0 1-9 14H31a10 10 0 0 1-9-14z" fill="url(#lq)"/>
       <circle cx="50" cy="90" r="3" fill="#fff" opacity=".5"/><circle cx="64" cy="96" r="2" fill="#fff" opacity=".5"/><circle cx="58" cy="84" r="1.6" fill="#fff" opacity=".5"/>
       <rect x="44" y="10" width="32" height="7" rx="3" fill="${B.c}"/><path d="M52 22v22l-8 16" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none"/>`),
  },
  celula: {
    name: 'Célula', tags: ['biología', 'histología', 'medicina', 'célula', 'tejido', 'anatomía'],
    svg: svg(rad('cl', '#F1D7D9', W.l, .45, .4) + rad('nu', W.c, W.a),
      `<path d="M60 12c26 0 48 20 46 46s-18 50-48 50S12 86 14 58 34 12 60 12z" fill="url(#cl)" stroke="${W.c}" stroke-width="2"/>
       <circle cx="62" cy="58" r="17" fill="url(#nu)"/><circle cx="66" cy="54" r="5" fill="${W.d}"/>
       <ellipse cx="34" cy="44" rx="9" ry="5" fill="${B.k}" transform="rotate(-20 34 44)"/><path d="M27 44h14" stroke="${B.c}" stroke-width="1"/>
       <ellipse cx="86" cy="80" rx="9" ry="5" fill="${B.k}" transform="rotate(30 86 80)"/>
       <path d="M30 76c6 4 12-2 18 2s10 6 14 2" stroke="${W.b}" stroke-width="2" fill="none"/>
       <circle cx="88" cy="38" r="2.4" fill="${W.b}"/><circle cx="40" cy="92" r="2.4" fill="${W.b}"/><circle cx="74" cy="92" r="2" fill="${W.b}"/>`),
  },
  adn: {
    name: 'ADN', tags: ['biología', 'genética', 'medicina', 'ciencia', 'herencia'],
    svg: svg(lin('d1', W.c, W.a, 1, 0),
      `${Array.from({ length: 9 }, (_, i) => { const y = 14 + i * 11; const x = Math.sin(i * .78) * 22; return `<path d="M${60 - x} ${y}H${60 + x}" stroke="${i % 2 ? B.k : W.l}" stroke-width="3.2" stroke-linecap="round"/>`; }).join('')}
       <path d="M60 10c-30 16 30 36 0 52s30 36 0 52" stroke="url(#d1)" stroke-width="6" fill="none" stroke-linecap="round" transform="translate(-2 0)"/>
       <path d="M60 10c30 16-30 36 0 52s-30 36 0 52" stroke="${W.a}" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  },
  balanza: {
    name: 'Balanza', tags: ['derecho', 'justicia', 'ética', 'ley', 'economía', 'equilibrio'],
    svg: svg(lin('br', BRASS[1], BRASS[0], 1, 0),
      `<rect x="40" y="104" width="40" height="8" rx="3" fill="${W.a}"/><rect x="57.5" y="22" width="5" height="84" fill="url(#br)"/>
       <rect x="16" y="32" width="88" height="4.5" rx="2.2" fill="${BRASS[1]}"/><circle cx="60" cy="22" r="6" fill="${W.b}"/>
       <path d="M24 34l-12 34M24 34l12 34M96 34l-12 34M96 34l12 34" stroke="${BRASS[0]}" stroke-width="1.4"/>
       <path d="M8 68h32a16 8 0 0 1-32 0zM80 68h32a16 8 0 0 1-32 0z" fill="${W.b}"/>`),
  },
  globo: {
    name: 'Globo terráqueo', tags: ['geografía', 'historia', 'economía', 'mundo', 'internacional', 'sociales'],
    svg: svg(rad('gb', W.l, W.b, .35, .3),
      `<path d="M60 108v6M42 114h36" stroke="${B.a}" stroke-width="5" stroke-linecap="round"/>
       <path d="M24 30a44 44 0 0 0 66 66" stroke="${BRASS[0]}" stroke-width="4" fill="none"/>
       <circle cx="60" cy="58" r="36" fill="url(#gb)"/>
       <path d="M40 40c8-4 12 4 20 2s8 8 0 12-14 2-16 10 6 10 2 16c-8-6-16-20-6-40zM74 70c6-2 12 2 14 8-4 6-10 10-14 8z" fill="${W.d}" opacity=".55"/>
       <ellipse cx="48" cy="40" rx="10" ry="6" fill="#fff" opacity=".2"/>`),
  },
  calculadora: {
    name: 'Calculadora', tags: ['matemática', 'cálculo', 'economía', 'contabilidad', 'física', 'ingeniería', 'estadística'],
    svg: svg(lin('cb', W.b, W.d),
      `<rect x="26" y="10" width="68" height="100" rx="8" fill="url(#cb)"/><rect x="34" y="18" width="52" height="20" rx="3" fill="#E8DCCB"/>
       <text x="82" y="33" font-family="monospace" font-size="12" text-anchor="end" fill="${B.a}">3,14</text>
       ${[0, 1, 2, 3].map(r => [0, 1, 2].map(c => `<rect x="${36 + c * 17}" y="${46 + r * 15}" width="13" height="11" rx="2.5" fill="${r === 3 && c === 2 ? B.k : W.l}"/>`).join('')).join('')}`),
  },
  engranaje: {
    name: 'Engranaje', tags: ['ingeniería', 'mecánica', 'proceso', 'sistema', 'industria', 'tecnología'],
    svg: svg(rad('eg', W.l, W.a, .4, .35),
      `<path d="${gear(60, 60, 44, 34, 10)}" fill="url(#eg)"/><circle cx="60" cy="60" r="13" fill="${B.cr}"/><circle cx="60" cy="60" r="13" fill="none" stroke="${W.d}" stroke-width="2"/>`),
  },
  cerebro: {
    name: 'Cerebro', tags: ['psicología', 'memoria', 'medicina', 'neurología', 'aprender', 'estudio'],
    svg: svg(rad('cr', W.p, W.c, .4, .35),
      `<path d="M58 22c-8-8-24-6-28 4-10 0-16 10-12 18-8 6-6 20 4 22-2 10 8 18 18 14 4 8 14 8 18 2zM62 22c8-8 24-6 28 4 10 0 16 10 12 18 8 6 6 20-4 22 2 10-8 18-18 14-4 8-14 8-18 2z" fill="url(#cr)"/>
       <path d="M60 22v64M34 40c6 0 10 4 10 10M30 62c8-4 14 0 16 6M86 40c-6 0-10 4-10 10M90 62c-8-4-14 0-16 6" stroke="${W.b}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
       <path d="M58 86c0 10-2 18-6 24h14c-4-6-6-14-6-24" fill="${W.c}"/>`),
  },
  bombilla: {
    name: 'Idea (bombilla)', tags: ['idea', 'clave', 'importante', 'tip', 'recordar', 'creatividad'],
    svg: svg(rad('bl', '#FFF6EA', W.l, .4, .35),
      `<path d="M60 12a32 32 0 0 0-18 58c4 3 6 8 6 12h24c0-4 2-9 6-12a32 32 0 0 0-18-58z" fill="url(#bl)"/>
       <path d="M54 82V60l-6-8M66 82V60l6-8M48 52h24" stroke="${W.b}" stroke-width="1.8" fill="none"/>
       <rect x="46" y="82" width="28" height="18" rx="3" fill="${B.c}"/><path d="M46 88h28M46 94h28" stroke="${B.d}" stroke-width="1.5"/>
       <path d="M52 100h16l-3 8h-10z" fill="${B.a}"/><ellipse cx="48" cy="30" rx="8" ry="5" fill="#fff" opacity=".6" transform="rotate(-35 48 30)"/>`),
  },
  lupa: {
    name: 'Lupa', tags: ['investigación', 'análisis', 'observar', 'microscopio', 'detalle', 'buscar'],
    svg: svg(lin('lp', '#F6EDEE', '#D9C3C5', 1, 1) + lin('lh', W.b, W.d),
      `<path d="M76 76l30 30" stroke="url(#lh)" stroke-width="12" stroke-linecap="round"/>
       <circle cx="50" cy="50" r="34" fill="url(#lp)" opacity=".75"/><circle cx="50" cy="50" r="34" fill="none" stroke="${BRASS[0]}" stroke-width="6"/>
       <path d="M32 40a20 20 0 0 1 16-14" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`),
  },
  microscopio: {
    name: 'Microscopio', tags: ['biología', 'histología', 'ciencia', 'laboratorio', 'célula', 'medicina'],
    svg: svg(lin('mc', W.b, W.d, 1, 0),
      `<rect x="24" y="100" width="72" height="10" rx="4" fill="${W.d}"/><path d="M72 100c14-10 14-36 0-48" stroke="url(#mc)" stroke-width="8" fill="none" stroke-linecap="round"/>
       <rect x="40" y="76" width="40" height="6" rx="2" fill="${W.a}"/><rect x="44" y="14" width="12" height="46" rx="4" fill="url(#mc)" transform="rotate(-22 50 38)"/>
       <rect x="40" y="10" width="16" height="8" rx="2" fill="${BRASS[1]}" transform="rotate(-22 48 14)"/><circle cx="66" cy="62" r="7" fill="${BRASS[1]}"/>`),
  },
  corazon: {
    name: 'Corazón acolchado', tags: ['decorar', 'amor', 'favorito', 'bonito', 'motivación'],
    svg: svg(rad('hc', W.l, W.a, .35, .3),
      `<path d="M60 104C14 74 10 44 26 30s30-6 34 8c4-14 18-22 34-8s12 44-34 74z" fill="url(#hc)"/>
       <path d="M60 98C24 74 20 50 30 38" stroke="${W.p}" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>
       <ellipse cx="38" cy="40" rx="9" ry="6" fill="#fff" opacity=".35" transform="rotate(-30 38 40)"/>`),
  },
  estrella: {
    name: 'Estrella dorada', tags: ['importante', 'examen', 'clave', 'logro', 'favorito'],
    svg: svg(lin('es', W.l, W.a, 1, 1),
      `<path d="M60 10l14 30 32 4-24 22 6 32-28-16-28 16 6-32-24-22 32-4z" fill="url(#es)"/>
       <path d="M60 10l0 52 46-18zM60 62l28 36-28-16zM60 62L14 44l32-4z" fill="#fff" opacity=".12"/>`),
  },
  mariposa: {
    name: 'Mariposa', tags: ['biología', 'naturaleza', 'cambio', 'transformación', 'decorar'],
    svg: svg(lin('mw', W.l, W.b, 1, 1),
      `<path d="M58 56C40 24 12 22 12 42s20 24 46 16zM62 56c18-32 46-34 46-14s-20 24-46 16zM58 62c-24 4-34 22-24 32s20-8 24-28zM62 62c24 4 34 22 24 32s-20-8-24-28z" fill="url(#mw)"/>
       <circle cx="28" cy="40" r="5" fill="${W.d}" opacity=".5"/><circle cx="92" cy="40" r="5" fill="${W.d}" opacity=".5"/>
       <rect x="57" y="40" width="6" height="44" rx="3" fill="${B.d}"/><path d="M58 40c-4-10-10-14-14-16M62 40c4-10 10-14 14-16" stroke="${B.d}" stroke-width="1.6" fill="none"/>`),
  },
  billete: {
    name: 'Monedas', tags: ['economía', 'finanzas', 'dinero', 'costo', 'presupuesto', 'contabilidad', 'ventas'],
    svg: svg(rad('mo', BRASS[1], BRASS[0], .35, .3) + lin('bi', W.l, W.b, 1, 1),
      `<rect x="14" y="34" width="70" height="40" rx="4" fill="url(#bi)" transform="rotate(-10 49 54)"/><circle cx="48" cy="56" r="10" fill="none" stroke="${W.p}" stroke-width="2" transform="rotate(-10 49 54)"/>
       <ellipse cx="80" cy="92" rx="22" ry="8" fill="${BRASS[0]}"/><ellipse cx="80" cy="86" rx="22" ry="8" fill="url(#mo)"/><ellipse cx="82" cy="74" rx="22" ry="8" fill="${BRASS[0]}"/><ellipse cx="82" cy="70" rx="22" ry="8" fill="url(#mo)"/>`),
  },
  reloj: {
    name: 'Reloj de arena', tags: ['historia', 'tiempo', 'cuándo', 'examen', 'plazo', 'cronología'],
    svg: svg(lin('rw', B.c, B.a, 1, 0) + lin('sa', W.l, W.b),
      `<rect x="24" y="10" width="72" height="10" rx="3" fill="url(#rw)"/><rect x="24" y="100" width="72" height="10" rx="3" fill="url(#rw)"/>
       <path d="M34 20h52c0 24-20 30-20 40s20 16 20 40H34c0-24 20-30 20-40s-20-16-20-40z" fill="#F5ECEC" opacity=".8" stroke="${B.c}" stroke-width="1.5"/>
       <path d="M42 34h36c-4 10-14 14-18 20-4-6-14-10-18-20zM40 98c2-12 14-16 20-24 6 8 18 12 20 24z" fill="url(#sa)"/><path d="M60 54v20" stroke="${W.b}" stroke-width="1.5"/>`),
  },
  pluma: {
    name: 'Pluma', tags: ['literatura', 'historia', 'escritura', 'filosofía', 'redacción', 'carta'],
    svg: svg(lin('pl', W.l, W.a, 1, 1),
      `<path d="M98 10C60 18 34 52 30 92l8-4c4-30 22-56 52-70-24 18-40 44-44 72 34-8 54-42 52-80z" fill="url(#pl)"/>
       <path d="M30 92L20 112" stroke="${B.d}" stroke-width="3" stroke-linecap="round"/><path d="M96 14C70 34 52 60 42 92" stroke="${W.p}" stroke-width="1.4" fill="none"/>`),
  },
};

function gear(cx, cy, R, r, n) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n * .5, a2 = a0 + Math.PI / n, a3 = a0 + Math.PI / n * 1.5;
    const p = (a, rr) => `${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`;
    d += (i ? 'L' : 'M') + p(a0, r) + 'L' + p(a1, R) + 'L' + p(a2, R) + 'L' + p(a3, r);
  }
  return d + 'Z';
}


// ---------- Loona: stickers góticos y de medicina (diseños propios, plata y negro) ----------
const SV = ['#F7F5F2', '#BDB9BC', '#6E6A6D'];   // plata: brillo, medio, sombra
const silverG = id => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SV[0]}"/><stop offset=".5" stop-color="${SV[1]}"/><stop offset="1" stop-color="${SV[2]}"/></linearGradient>`;
Object.assign(S, {
  lunaPlata: { name: 'Luna de plata', tags: ['noche', 'estudio', 'gótico', 'calma', 'dormir', 'astronomía', 'física'],
    svg: svg(silverG('m'), `<path d="M74 14a46 46 0 1 0 30 76A38 38 0 1 1 74 14z" fill="url(#m)" stroke="#4a474a" stroke-width="1.2"/><circle cx="96" cy="28" r="2.5" fill="#fff"/><circle cx="20" cy="20" r="1.8" fill="#fff"/>`) },
  murcielago: { name: 'Murciélago', tags: ['gótico', 'noche', 'biología', 'mamíferos', 'halloween', 'actitud'],
    svg: svg(lin('bt', '#2a2729', '#0b0a0b'), `<path d="M60 52c-4-8-4-14 0-18 4 4 4 10 0 18zM60 50c8-12 22-18 40-14-6 4-8 10-6 16-6-4-12-4-16 2-4-4-10-6-18-4zM60 50c-8-12-22-18-40-14 6 4 8 10 6 16 6-4 12-4 16 2 4-4 10-6 18-4z" fill="url(#bt)" stroke="#8a868a" stroke-width=".8"/><circle cx="57" cy="40" r="1.4" fill="#d8d4d6"/><circle cx="63" cy="40" r="1.4" fill="#d8d4d6"/>`) },
  corazonAnat: { name: 'Corazón anatómico', tags: ['medicina', 'biología', 'anatomía', 'corazón', 'circulación', 'sangre', 'cardio'],
    svg: svg(rad('h', '#d9d4d6', '#5e5a5d', .4, .35) + silverG('v'), `<path d="M58 40c-14-6-30 2-30 22 0 22 20 38 34 46 12-8 30-22 30-44 0-12-6-22-18-24" fill="url(#h)" stroke="#2a2729" stroke-width="1.4"/><path d="M52 40V18M62 38V12M72 40c2-10 8-16 16-18" fill="none" stroke="url(#v)" stroke-width="7" stroke-linecap="round"/><path d="M44 64c6 8 14 12 22 12M66 56c4 6 10 10 16 10" fill="none" stroke="#3a3739" stroke-width="1.5" opacity=".7"/>`) },
  adn: { name: 'ADN', tags: ['biología', 'genética', 'medicina', 'célula', 'adn', 'herencia'],
    svg: svg(silverG('d'), `${Array.from({ length: 9 }, (_, i) => { const y = 16 + i * 11, a = Math.sin(i * .7) * 22; return `<line x1="${60 - a}" y1="${y}" x2="${60 + a}" y2="${y}" stroke="#8a868a" stroke-width="2.4"/><circle cx="${60 - a}" cy="${y}" r="4" fill="url(#d)"/><circle cx="${60 + a}" cy="${y}" r="4" fill="#2a2729"/>`; }).join('')}`) },
  estetoscopio: { name: 'Estetoscopio', tags: ['medicina', 'salud', 'doctora', 'unila', 'enfermería', 'clínica'],
    svg: svg(silverG('s'), `<path d="M36 16v28c0 16 12 26 24 26s24-10 24-26V16" fill="none" stroke="#1b191a" stroke-width="6" stroke-linecap="round"/><path d="M60 70v18c0 10 8 16 18 16" fill="none" stroke="#1b191a" stroke-width="6"/><circle cx="84" cy="98" r="12" fill="url(#s)" stroke="#4a474a" stroke-width="1.5"/><circle cx="84" cy="98" r="5" fill="#2a2729"/><circle cx="36" cy="14" r="4" fill="url(#s)"/><circle cx="84" cy="14" r="4" fill="url(#s)"/>`) },
  rosaNegra: { name: 'Rosa negra', tags: ['gótico', 'literatura', 'amor', 'decorar', 'poesía', 'xoxo'],
    svg: svg(rad('r', '#4a4648', '#0d0c0d', .4, .35) + lin('st2', '#5a5d4a', '#2f3127'), `<path d="M60 66c0 18-2 32-6 44" stroke="url(#st2)" stroke-width="3" fill="none"/><path d="M58 90c-12-8-22-4-26 2 10 4 18 4 26-2z" fill="#3f4234"/><circle cx="60" cy="44" r="26" fill="url(#r)"/><path d="M60 26c10 4 14 12 10 20-6 8-18 6-20-2-2-6 2-12 10-12" fill="none" stroke="#9a9698" stroke-width="1.4" opacity=".6"/><path d="M44 40c-2 10 4 20 16 22 10 1 18-6 20-14" fill="none" stroke="#9a9698" stroke-width="1.2" opacity=".45"/>`) },
  polilla: { name: 'Polilla nocturna', tags: ['gótico', 'biología', 'insectos', 'noche', 'transformación'],
    svg: svg(silverG('w') + rad('w2', '#e9e6e3', '#77737a'), `<path d="M60 56C46 30 18 26 14 40s14 26 46 20zM60 56c14-26 42-30 46-16S92 66 60 60z" fill="url(#w2)" stroke="#3a3739" stroke-width="1.2"/><path d="M60 60c-10 6-30 16-28 30 8 6 22-6 28-24zM60 60c10 6 30 16 28 30-8 6-22-6-28-24z" fill="url(#w)" stroke="#3a3739" stroke-width="1.2"/><ellipse cx="60" cy="62" rx="4" ry="16" fill="#1b191a"/><circle cx="36" cy="44" r="6" fill="none" stroke="#3a3739" stroke-width="1.5"/><circle cx="84" cy="44" r="6" fill="none" stroke="#3a3739" stroke-width="1.5"/>`) },
  cristalAmbar: { name: 'Cristal ámbar', tags: ['química', 'cristal', 'minerales', 'energía', 'decorar'],
    svg: svg(lin('c1', '#f4c08c', '#7a3a12', 1, 1) + lin('c2', '#ffe2be', '#b5602a'), `<path d="M60 8l18 24-6 64-12 18-12-18-6-64z" fill="url(#c1)" stroke="#5a2a0c" stroke-width="1.2"/><path d="M60 8l6 24-6 82-6-82z" fill="url(#c2)" opacity=".75"/><path d="M50 30l4 50" stroke="#fff" stroke-width="2" opacity=".55" stroke-linecap="round"/>`) },
  llaveAntigua: { name: 'Llave antigua', tags: ['historia', 'clave', 'secreto', 'importante', 'respuesta'],
    svg: svg(silverG('k'), `<circle cx="34" cy="60" r="18" fill="none" stroke="url(#k)" stroke-width="7"/><circle cx="34" cy="60" r="7" fill="none" stroke="url(#k)" stroke-width="3"/><rect x="50" y="56" width="58" height="8" rx="3" fill="url(#k)"/><rect x="88" y="62" width="7" height="14" fill="url(#k)"/><rect x="100" y="62" width="7" height="18" fill="url(#k)"/>`) },
  sobreXoxo: { name: 'Sobre XOXO', tags: ['xoxo', 'chisme', 'carta', 'resumen', 'secreto', 'gossip'],
    svg: svg(lin('e', '#f1ede7', '#cfc9c1') + rad('wx', '#3a3739', '#0b0a0b'), `<rect x="14" y="30" width="92" height="62" rx="4" fill="url(#e)" stroke="#8a858a" stroke-width="1"/><path d="M14 32l46 34 46-34" fill="none" stroke="#8a858a" stroke-width="1.4"/><circle cx="60" cy="64" r="15" fill="url(#wx)"/><text x="60" y="69" text-anchor="middle" font-family="Georgia,serif" font-size="12" font-weight="700" fill="#d8d4d6">XOXO</text>`) },
  calavera: { name: 'Cráneo de estudio', tags: ['anatomía', 'medicina', 'huesos', 'esqueleto', 'biología', 'gótico'],
    svg: svg(rad('sk', '#f4f1ec', '#9d9893', .4, .3), `<path d="M60 14c-24 0-38 16-38 36 0 12 6 20 12 24v14c0 6 4 10 10 10h32c6 0 10-4 10-10V74c6-4 12-12 12-24 0-20-14-36-38-36z" fill="url(#sk)" stroke="#4a4648" stroke-width="1.4"/><ellipse cx="45" cy="54" rx="9" ry="10" fill="#1b191a"/><ellipse cx="75" cy="54" rx="9" ry="10" fill="#1b191a"/><path d="M60 64l-5 10h10z" fill="#1b191a"/><path d="M46 88v10M54 88v12M62 88v12M70 88v10" stroke="#4a4648" stroke-width="1.6"/><path d="M40 28c6-6 16-8 24-6" fill="none" stroke="#fff" stroke-width="2" opacity=".6"/>`) },
});
export const LOONA_STICKERS = ['lunaPlata', 'murcielago', 'corazonAnat', 'adn', 'estetoscopio', 'rosaNegra', 'polilla', 'cristalAmbar', 'llaveAntigua', 'sobreXoxo', 'calavera'];

export const STICKERS = S;
export const stickerURL = k => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent((S[k] || S.corazon).svg);

// Recomienda stickers según la materia, el tema y lo subrayado
export function recommend(text, n = 6) {
  const t = (text || '').toLowerCase();
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tn = norm(t);
  const scored = Object.entries(S).map(([k, v]) => {
    let sc = 0;
    for (const tag of v.tags) if (tn.includes(norm(tag))) sc += 3;
    for (const w of norm(v.name.toLowerCase()).split(/\W+/)) if (w.length > 3 && tn.includes(w)) sc += 2;
    return [k, sc];
  }).sort((a, b) => b[1] - a[1]);
  const top = scored.filter(s => s[1] > 0).map(s => s[0]);
  const general = ['lunaPlata', 'rosaNegra', 'murcielago', 'llaveAntigua', 'cristalAmbar', 'sobreXoxo'];
  return [...new Set([...top, ...general])].slice(0, n);
}
