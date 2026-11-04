// Plantillas de estudio: esquemas y técnicas para resumir temas.
// Todas se editan tocándolas dos veces (con Seleccionar) y usan la paleta borgoña.
import { esc } from './ui.js';
import { grouped } from './summarizer.js';

const li = arr => arr.map(t => `<li>${t}</li>`).join('');
const N = (n, f) => Array.from({ length: n }, (_, i) => f(i));

export const TEMPLATES = [
  // ---------- esquemas ----------
  {
    k: 'mapa', g: 'Esquemas', name: 'Mapa mental', w: 720,
    how: 'Tema en el centro y una rama por idea. Ideal para ver todo el tema de un vistazo.',
    html: `<div class="mm"><svg class="mm-lines" viewBox="0 0 100 70" preserveAspectRatio="none">${N(6, i => { const a = -90 + i * 60; const x = 50 + Math.cos(a * Math.PI / 180) * 36, y = 35 + Math.sin(a * Math.PI / 180) * 25; return `<path d="M50 35 Q ${(50 + x) / 2 + (i % 2 ? 4 : -4)} ${(35 + y) / 2} ${x} ${y}"/>`; }).join('')}</svg>
<div class="mm-c">Tema central</div>${N(6, i => { const a = -90 + i * 60; const x = 50 + Math.cos(a * Math.PI / 180) * 36, y = 35 + Math.sin(a * Math.PI / 180) * 25; return `<div class="mm-n" style="left:${x}%;top:${y / 70 * 100}%"><b>Idea ${i + 1}</b><br>detalle</div>`; }).join('')}</div>`,
  },
  {
    k: 'tiempo', g: 'Esquemas', name: 'Línea de tiempo', w: 740,
    how: 'Fechas en orden. Sirve para historia, procesos y etapas.',
    html: `<div class="tl">${N(5, i => `<div class="tl-e ${i % 2 ? 'dn' : 'up'}"><b>${1800 + i * 50}</b><span>Hecho importante</span></div>`).join('')}</div>`,
  },
  {
    k: 'comparar', g: 'Esquemas', name: 'Cuadro comparativo', w: 720,
    how: 'Compara 2 o 3 conceptos según los mismos criterios.',
    html: `<table class="cmp"><tr><th>Criterio</th><th>Concepto A</th><th>Concepto B</th></tr>${N(4, i => `<tr><td><b>Criterio ${i + 1}</b></td><td>…</td><td>…</td></tr>`).join('')}</table>`,
  },
  {
    k: 'causa', g: 'Esquemas', name: 'Causa y efecto', w: 720,
    how: 'Por qué pasó (causas) y qué provocó (consecuencias).',
    html: `<div class="ce"><div class="ce-col"><h5>Causas</h5><ul>${li(['Causa 1', 'Causa 2', 'Causa 3'])}</ul></div><div class="ce-mid">Hecho</div><div class="ce-col"><h5>Consecuencias</h5><ul>${li(['Efecto 1', 'Efecto 2', 'Efecto 3'])}</ul></div></div>`,
  },
  {
    k: 'ciclo', g: 'Esquemas', name: 'Ciclo', w: 560,
    how: 'Procesos que se repiten (ciclo del agua, ciclo celular…).',
    html: `<div class="cy"><svg class="cy-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="34"/>${N(4, i => { const a = (i * 90 + 30) * Math.PI / 180; return `<path d="M${50 + Math.cos(a) * 34} ${50 + Math.sin(a) * 34} l ${-Math.sin(a) * 5 - Math.cos(a) * 3} ${Math.cos(a) * 5 - Math.sin(a) * 3} M${50 + Math.cos(a) * 34} ${50 + Math.sin(a) * 34} l ${-Math.sin(a) * 5 + Math.cos(a) * 3} ${Math.cos(a) * 5 + Math.sin(a) * 3}"/>`; }).join('')}</svg><div class="cy-c">Ciclo</div>${N(4, i => { const a = (i * 90 - 90) * Math.PI / 180; return `<div class="cy-n" style="left:${50 + Math.cos(a) * 34}%;top:${50 + Math.sin(a) * 34}%">Etapa ${i + 1}</div>`; }).join('')}</div>`,
  },
  {
    k: 'piramide', g: 'Esquemas', name: 'Pirámide', w: 600,
    how: 'Jerarquías o niveles: de lo más importante (arriba) a lo más general.',
    html: `<div class="py">${N(4, i => `<div style="--i:${i}">Nivel ${i + 1}</div>`).join('')}</div>`,
  },
  {
    k: 'pasos', g: 'Esquemas', name: 'Proceso paso a paso', w: 740,
    how: 'Procedimientos en orden: cómo se hace algo.',
    html: `<div class="st">${N(4, i => `<div class="st-s"><i>${i + 1}</i><span>Paso ${i + 1}</span></div>`).join('')}</div>`,
  },
  {
    k: 'arbol', g: 'Esquemas', name: 'Clasificación (árbol)', w: 720,
    how: 'Tipos y subtipos de un concepto.',
    html: `<div class="tr"><div class="tr-r">Concepto</div><div class="tr-k">${N(3, i => `<div><b>Tipo ${i + 1}</b><ul>${li(['Ejemplo', 'Ejemplo'])}</ul></div>`).join('')}</div></div>`,
  },
  {
    k: 'venn', g: 'Esquemas', name: 'Diagrama de Venn', w: 640,
    how: 'Qué tienen en común y en qué se diferencian dos conceptos.',
    html: `<div class="vn"><div class="vn-a"><b>A</b><span>Solo A</span></div><div class="vn-b"><b>B</b><span>Solo B</span></div><div class="vn-m">En común</div></div>`,
  },
  {
    k: 'cinco', g: 'Esquemas', name: 'Las 6 preguntas', w: 720,
    how: 'Qué, quién, cuándo, dónde, por qué y cómo: no se te escapa nada.',
    html: `<div class="w5">${['¿Qué?', '¿Quién?', '¿Cuándo?', '¿Dónde?', '¿Por qué?', '¿Cómo?'].map(q => `<div><b>${q}</b><p>…</p></div>`).join('')}</div>`,
  },
  {
    k: 'pros', g: 'Esquemas', name: 'Ventajas y desventajas', w: 680,
    how: 'Para evaluar teorías, métodos o decisiones.',
    html: `<div class="pc"><div class="pc-p"><h5>Ventajas</h5><ul>${li(['…', '…', '…'])}</ul></div><div class="pc-c"><h5>Desventajas</h5><ul>${li(['…', '…', '…'])}</ul></div></div>`,
  },
  {
    k: 'llaves', g: 'Esquemas', name: 'Cuadro sinóptico (llaves)', w: 720,
    how: 'El tema a la izquierda y sus partes abiertas con llaves. Clásico para resumir capítulos.',
    html: `<div class="sy"><div class="sy-t">Tema</div><div class="sy-l">${N(3, i => `<div class="sy-i"><b>Subtema ${i + 1}</b><div class="sy-l2"><span>Detalle</span><span>Detalle</span></div></div>`).join('')}</div></div>`,
  },
  {
    k: 'conceptual', g: 'Esquemas', name: 'Mapa conceptual', w: 740,
    how: 'Conceptos unidos con palabras de enlace (es, se divide en, produce…).',
    html: `<div class="cm"><div class="cm-r">Concepto principal</div><div class="cm-k">${['se divide en', 'produce', 'por ejemplo'].map((w, i) => `<div class="cm-b"><i>${w}</i><div class="cm-n">Concepto ${i + 1}</div><div class="cm-s">detalle</div></div>`).join('')}</div></div>`,
  },
  {
    k: 'flujo', g: 'Esquemas', name: 'Diagrama de flujo', w: 460,
    how: 'Procesos con decisiones: inicio, pasos, preguntas sí/no y fin.',
    html: `<div class="fl"><div class="fl-o">Inicio</div><div class="fl-p">Paso 1</div><div class="fl-d"><span>¿Se cumple?</span></div><div class="fl-p">Paso 2</div><div class="fl-p">Paso 3</div><div class="fl-o">Fin</div></div>`,
  },
  {
    k: 'ishikawa', g: 'Esquemas', name: 'Espina de pescado (causas)', w: 760,
    how: 'Todas las causas de un problema ordenadas por grupos.',
    html: `<div class="ik"><div class="ik-row">${N(3, i => `<div class="ik-c"><b>Grupo ${i + 1}</b><span>causa</span><span>causa</span></div>`).join('')}</div><div class="ik-spine"><span>Problema</span></div><div class="ik-row dn">${N(3, i => `<div class="ik-c"><b>Grupo ${i + 4}</b><span>causa</span><span>causa</span></div>`).join('')}</div></div>`,
  },
  {
    k: 'tiempov', g: 'Esquemas', name: 'Línea de tiempo vertical', w: 560,
    how: 'Fechas hacia abajo, con espacio para escribir más en cada una.',
    html: `<div class="tv">${N(5, i => `<div class="tv-e"><b>${1800 + i * 50}</b><span>Hecho importante y por qué importa</span></div>`).join('')}</div>`,
  },
  {
    k: 'foda', g: 'Esquemas', name: 'Matriz de 4 cuadros (FODA)', w: 700,
    how: 'Fortalezas, oportunidades, debilidades y amenazas (o cualquier comparación en 4).',
    html: `<div class="fo">${[['Fortalezas', 'f'], ['Oportunidades', 'o'], ['Debilidades', 'd'], ['Amenazas', 'a']].map(([t, c]) => `<div class="fo-${c}"><h5>${t}</h5><ul>${li(['…', '…'])}</ul></div>`).join('')}</div>`,
  },
  {
    k: 'embudo', g: 'Esquemas', name: 'Embudo (de lo general a lo particular)', w: 600,
    how: 'Arriba lo más amplio y abajo lo más específico.',
    html: `<div class="py py-inv">${N(4, i => `<div style="--i:${3 - i}">Nivel ${i + 1}</div>`).join('')}</div>`,
  },
  {
    k: 'organigrama', g: 'Esquemas', name: 'Organigrama', w: 740,
    how: 'Quién depende de quién: instituciones, gobiernos, empresas, obras.',
    html: `<div class="og"><div class="og-r">Cargo principal</div><div class="og-k">${N(3, i => `<div class="og-b"><b>Área ${i + 1}</b><span>Responsable</span></div>`).join('')}</div></div>`,
  },
  // ---------- técnicas de estudio ----------
  {
    k: 'cornell', g: 'Técnicas de estudio', name: 'Método Cornell', w: 740,
    how: 'Apuntes a la derecha, preguntas clave a la izquierda y resumen abajo. Tapa la derecha y responde las preguntas para repasar.',
    html: `<div class="cn"><div class="cn-q"><h5>Preguntas clave</h5><ul>${li(['¿…?', '¿…?', '¿…?'])}</ul></div><div class="cn-n"><h5>Apuntes</h5><p>Ideas principales del tema…</p></div><div class="cn-s"><h5>Resumen</h5><p>El tema en 2 o 3 frases…</p></div></div>`,
  },
  {
    k: 'feynman', g: 'Técnicas de estudio', name: 'Técnica Feynman', w: 720,
    how: 'Explica el tema como a un niño: donde te trabes, ahí hay algo por repasar.',
    html: `<div class="fy">${[['1', 'Concepto', 'Escribe el nombre del tema'], ['2', 'Explícalo simple', 'Con tus palabras, como a un niño'], ['3', 'Dónde me trabé', 'Lo que no supe explicar'], ['4', 'Analogía', 'Compáralo con algo cotidiano']].map(([n, t, d]) => `<div><i>${n}</i><b>${t}</b><p>${d}</p></div>`).join('')}</div>`,
  },
  {
    k: 'tarjetas', g: 'Técnicas de estudio', name: 'Tarjetas de recuerdo activo', w: 720,
    how: 'Pregunta arriba, respuesta abajo. Tapa la respuesta e intenta recordarla.',
    html: `<div class="fc">${N(4, i => `<div><b>¿Pregunta ${i + 1}?</b><p>Respuesta</p></div>`).join('')}</div>`,
  },
  {
    k: 'repaso', g: 'Técnicas de estudio', name: 'Repaso espaciado', w: 640,
    how: 'Repasa al día 1, 3, 7, 14 y 30: así no se olvida. Marca cada repaso.',
    html: `<table class="sr"><tr><th>Tema</th>${['Día 1', 'Día 3', 'Día 7', 'Día 14', 'Día 30'].map(d => `<th>${d}</th>`).join('')}</tr>${N(4, i => `<tr><td>Tema ${i + 1}</td>${N(5, () => '<td>☐</td>').join('')}</tr>`).join('')}</table>`,
  },
  {
    k: 'kwl', g: 'Técnicas de estudio', name: 'Sé · Quiero saber · Aprendí', w: 720,
    how: 'Antes de leer: qué sabes y qué quieres saber. Después: qué aprendiste.',
    html: `<div class="kw"><div><h5>Lo que sé</h5><p>…</p></div><div><h5>Quiero saber</h5><p>…</p></div><div><h5>Aprendí</h5><p>…</p></div></div>`,
  },
  {
    k: 'tres', g: 'Técnicas de estudio', name: 'El tema en 3 frases', w: 620,
    how: 'Obliga a sintetizar: 3 frases y 5 palabras clave.',
    html: `<div class="t3"><h5>En 3 frases</h5><ol>${li(['…', '…', '…'])}</ol><div class="t3-k"><b>Palabras clave:</b> <span>clave</span><span>clave</span><span>clave</span><span>clave</span><span>clave</span></div></div>`,
  },
  {
    k: 'mnemo', g: 'Técnicas de estudio', name: 'Truco para memorizar', w: 560,
    how: 'Una sigla o frase con la primera letra de cada idea.',
    html: `<div class="mn"><div class="mn-l">${['M', 'C', 'R', 'I'].map(l => `<span>${l}</span>`).join('')}</div><p><b>M</b>ano de obra · <b>C</b>apital · <b>R</b>ecursos naturales · <b>I</b>niciativa</p><p class="mn-f">“Mi Cocina Rinde Increíble”</p></div>`,
  },
  {
    k: 'glosario', g: 'Técnicas de estudio', name: 'Glosario de términos', w: 700,
    how: 'Palabras nuevas con su significado en tus palabras.',
    html: `<table class="cmp gl"><tr><th>Término</th><th>Significado</th></tr>${N(5, () => `<tr><td><b>…</b></td><td>…</td></tr>`).join('')}</table>`,
  },
  {
    k: 'formulas', g: 'Técnicas de estudio', name: 'Fórmulas y unidades', w: 720,
    how: 'Cada fórmula con qué significa cada letra y en qué unidades va.',
    html: `<table class="cmp fm"><tr><th>Fórmula</th><th>Qué significa</th><th>Unidades</th></tr>${N(4, () => `<tr><td><b>F = m · a</b></td><td>…</td><td>…</td></tr>`).join('')}</table>`,
  },
  {
    k: 'problema', g: 'Técnicas de estudio', name: 'Problema resuelto', w: 700,
    how: 'Datos, lo que piden, la fórmula, el desarrollo y la respuesta: ideal para ejercicios.',
    html: `<div class="pr">${[['Datos', '…'], ['Incógnita', '¿Qué me piden?'], ['Fórmula', '…'], ['Desarrollo', '…'], ['Respuesta', '…']].map(([t, d], i) => `<div class="pr-${i}"><h5>${t}</h5><p>${d}</p></div>`).join('')}</div>`,
  },
  {
    k: 'examen', g: 'Técnicas de estudio', name: 'Preguntas de examen', w: 700,
    how: 'Inventa las preguntas que te tomarían y respóndelas sin mirar.',
    html: `<div class="ex">${N(4, i => `<div><b>${i + 1}. ¿…?</b><p>Mi respuesta…</p><span>☐ bien &nbsp; ☐ repasar</span></div>`).join('')}</div>`,
  },
  {
    k: 'semana', g: 'Técnicas de estudio', name: 'Plan de estudio semanal', w: 760,
    how: 'Qué estudias cada día y cuánto tiempo.',
    html: `<table class="cmp wk"><tr>${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => `<th>${d}</th>`).join('')}</tr>${N(3, () => `<tr>${N(7, () => '<td>…</td>').join('')}</tr>`).join('')}</table>`,
  },
  {
    k: 'checklist', g: 'Técnicas de estudio', name: 'Lista de repaso', w: 560,
    how: 'Marca lo que ya dominas y lo que falta.',
    html: `<div class="ck"><h5>Para el examen</h5><ul class="no-dots">${li(N(6, () => '☐ …'))}</ul></div>`,
  },
  {
    k: 'capitulo', g: 'Técnicas de estudio', name: 'Resumen de capítulo', w: 720,
    how: 'Ideas principales, conceptos clave, una cita y tus dudas.',
    html: `<div class="cp"><div class="cp-i"><h5>Ideas principales</h5><ol>${li(['…', '…', '…'])}</ol></div><div class="cp-k"><h5>Conceptos clave</h5><ul>${li(['…', '…'])}</ul></div><div class="cp-q"><h5>Cita o dato importante</h5><p>“…”</p></div><div class="cp-d"><h5>Dudas</h5><ul>${li(['¿…?'])}</ul></div></div>`,
  },
];

// ---------- convertir un resumen automático en un esquema ----------
const plain = t => esc(t);
export function summaryToMindmap(sum) {
  const groups = grouped(sum.items).slice(0, 6);
  const n = Math.max(groups.length, 1);
  const pos = groups.map((_, i) => { const a = (-90 + i * 360 / n) * Math.PI / 180; return [50 + Math.cos(a) * 36, 35 + Math.sin(a) * 25]; });
  return `<div class="mm"><svg class="mm-lines" viewBox="0 0 100 70" preserveAspectRatio="none">${pos.map(([x, y], i) => `<path d="M50 35 Q ${(50 + x) / 2 + (i % 2 ? 4 : -4)} ${(35 + y) / 2} ${x} ${y}"/>`).join('')}</svg>
<div class="mm-c">${plain(sum.title || 'Tema')}</div>${groups.map((g, i) => `<div class="mm-n" style="left:${pos[i][0]}%;top:${pos[i][1] / 70 * 100}%"><b>${g.label}</b><br>${g.list.slice(0, 2).map(x => plain(x.text.replace(/^[^:]{2,40}:\s*/, ''))).join('<br>')}</div>`).join('')}</div>`;
}
export function summaryToTimeline(sum) {
  let items = sum.items.filter(i => i.cat === 'cuando');
  if (items.length < 2) items = sum.items.slice(0, 6);
  items = items.slice(0, 6);
  return `<div class="tl">${items.map((it, i) => {
    const m = it.text.match(/\b(siglo [ivxlc]+|1[0-9]{3}|20[0-9]{2})\b/i);
    return `<div class="tl-e ${i % 2 ? 'dn' : 'up'}"><b>${m ? plain(m[0]) : 'Paso ' + (i + 1)}</b><span>${plain(it.text)}</span></div>`;
  }).join('')}</div>`;
}
export function summaryToCards(sum, qs) {
  const cards = (qs && qs.length ? qs : sum.items.map(it => {
    const m = it.text.match(/^([^:]{2,50}):\s(.+)/);
    return m ? { q: `¿Qué es ${m[1].toLowerCase()}?`, a: m[2] } : { q: it.text.split(' ').slice(0, 5).join(' ') + '…?', a: it.text };
  })).slice(0, 6);
  return `<div class="fc">${cards.map(c => `<div><b>${plain(c.q)}</b><p>${plain(c.a)}</p></div>`).join('')}</div>`;
}
export function summaryTo6(sum) {
  const map = { '¿Qué?': ['definicion', 'ideas', 'caracteristicas', 'tipos'], '¿Quién?': ['quien'], '¿Cuándo?': ['cuando'], '¿Dónde?': ['donde'], '¿Por qué?': ['porque', 'consecuencias'], '¿Cómo?': ['como', 'funcion'] };
  return `<div class="w5">${Object.entries(map).map(([q, cats]) => { const t = sum.items.filter(i => cats.includes(i.cat)).slice(0, 2).map(i => plain(i.text)).join('<br>'); return `<div><b>${q}</b><p>${t || '…'}</p></div>`; }).join('')}</div>`;
}
