// Resumen automático de lo subrayado.
// Sin IA: reglas en español que detectan definiciones, fechas, lugares, causas...
// Con IA: Gemini (clave propia) reescribe el resumen y añade explicación fácil.

export const CATS = [
  { k: 'definicion', label: 'Definición' },
  { k: 'caracteristicas', label: 'Características' },
  { k: 'tipos', label: 'Tipos y clasificación' },
  { k: 'funcion', label: 'Para qué sirve' },
  { k: 'como', label: 'Cómo funciona' },
  { k: 'cuando', label: 'Cuándo' },
  { k: 'donde', label: 'Dónde' },
  { k: 'quien', label: 'Quién' },
  { k: 'porque', label: 'Por qué' },
  { k: 'consecuencias', label: 'Consecuencias' },
  { k: 'datos', label: 'Datos y fórmulas' },
  { k: 'ejemplos', label: 'Ejemplos' },
  { k: 'ideas', label: 'Ideas clave' },
];
export const catLabel = k => (CATS.find(c => c.k === k) || { label: k }).label;

const MONTHS = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
const RULES = [
  ['ejemplos', /\b(por ejemplo|ejemplo|ej\.|tales como|como es el caso|verbigracia|p\. ?ej)/i],
  ['definicion', /\b(se define( como)?|se denomina|se llama|se conoce como|consiste en|es (el|la|los|las|un|una) (ciencia|conjunto|proceso|rama|estudio|capacidad|parte|forma|m[eé]todo|sistema|t[eé]cnica|unidad)|significa|definici[oó]n|entendemos por|hace referencia a|es aquel|es aquella|son aquell[oa]s)\b/i],
  ['tipos', /\b(tipos? de|clases? de|se clasifica|clasificaci[oó]n|se divide(n)? en|categor[ií]as?|existen (dos|tres|cuatro|cinco|\d+)|puede(n)? ser)\b/i],
  ['porque', /\b(porque|debido a|ya que|puesto que|dado que|a causa de|causa(s|do)?|motivo|raz[oó]n|origen|se origina|surge (de|por|cuando))\b/i],
  ['consecuencias', /\b(por (lo )?tanto|en consecuencia|como resultado|provoca|genera|produce|ocasiona|conlleva|trae como|lo que (lleva|permite|causa)|efecto(s)?)\b/i],
  ['funcion', /\b(sirve(n)? para|permite(n)?|su funci[oó]n|tiene(n)? como (fin|objetivo|funci[oó]n)|se (usa|utiliza|emplea) (para|en)|objetivo|finalidad|con el fin de|para (que|lograr))\b/i],
  ['como', /\b(proceso|pasos?|etapas?|fases?|procedimiento|primero|luego|despu[eé]s|finalmente|mediante|a trav[eé]s de|se realiza|se obtiene|se calcula|funciona)\b/i],
  ['cuando', new RegExp(`\\b(en (el )?(año|siglo|d[eé]cada|periodo|per[ií]odo|[eé]poca)|siglo [ivxlc]+|\\b(1[0-9]{3}|20[0-9]{2})\\b|${MONTHS}|durante|cuando|antes de|despu[eé]s de|a partir de|desde|hasta)`, 'i')],
  ['donde', /\b(en (el|la|los|las)? ?(pa[ií]s|ciudad|regi[oó]n|continente|zona|lugar|territorio|n[uú]cleo|c[eé]lula|citoplasma|membrana|interior|superficie)|ubicad[oa]|se localiza|se encuentra(n)? en|localizaci[oó]n|donde)\b|\ben [A-ZÁÉÍÓÚ][a-záéíóúñ]{3,}/],
  ['quien', /\b(seg[uú]n [A-ZÁÉÍÓÚ]|propuest[oa] por|cre[oó]|descubri[oó]|fundad[oa] por|autor|cient[ií]fic[oa]|fil[oó]sof[oa])\b/],
  ['datos', /(\d+([.,]\d+)?\s?(%|km|m|cm|mm|kg|g|mg|°|ºc|kn|mpa|kpa|n\b|μm|µm)|=|\bf[oó]rmula\b|\becuaci[oó]n\b|\d{2,})/i],
  ['caracteristicas', /\b(caracter[ií]stic|se caracteriza|presenta(n)?|posee(n)?|tiene(n)?|est[aá](n)? (formad|compuest|constituid)|cuenta con|propiedades)\b/i],
];

export function classify(text, level) {
  const t = ' ' + text + ' ';
  if (level === 1) return 'titulo';
  const tt = text.trim();
  // "X es algo que…", "X es el/la/un…" al inicio: definición
  if (!/^(por ejemplo|ejemplo|ej\.)/i.test(tt) && /^[^,.;:]{2,55}?\s(es|son)\s(el|la|los|las|un|una|unos|unas|algo|aquel|aquella|aquello|aquellos|aquellas)\b/i.test(tt)) return 'definicion';
  for (const [k, re] of RULES) if (re.test(t)) return k;
  // "X es Y" corto, sin otra pista: casi siempre es una definición
  if (/^[^,.;]{2,60}\s(es|son)\s/i.test(text.trim())) return 'definicion';
  return 'ideas';
}

const FILLER = [
  /\b(es importante (se[ñn]alar|mencionar|destacar|resaltar) que|cabe (se[ñn]alar|mencionar|destacar|resaltar) que|en este sentido|por otro lado|por otra parte|asimismo|adem[aá]s|de esta manera|de este modo|es decir|en otras palabras|sin embargo|no obstante|en general|en efecto|como se mencion[oó]( anteriormente)?|como ya se dijo|de hecho|b[aá]sicamente|en primer lugar|en segundo lugar|finalmente),?\s*/gi,
  /\((?:[^()]*\d{4}[^()]*|ver [^()]*|fig\.?[^()]*|p\.\s?\d+)\)/gi, // citas (Autor, 2019), (ver figura)
  /\[\d+(,\s?\d+)*\]/g,
];

export function condense(text, cat, maxW = 20) {
  let s = text.replace(/\s+/g, ' ').replace(/-\s(?=[a-záéíóúñ])/g, '').trim();
  for (const re of FILLER) s = s.replace(re, '');
  s = s.replace(/\s+([,.;:])/g, '$1').replace(/^[,;:.\-–—\s]+/, '').trim();
  if (cat === 'titulo') return titleCase(s.replace(/[.:;]+$/, '').split(/\s+/).slice(0, 9).join(' '));
  // "La economía es la ciencia que..." -> "Ciencia que..." cuando ya hay título
  if (cat === 'definicion') {
    const m = s.match(/^(.{2,60}?)\s(es|son|se define como|se denomina|consiste en)\s(.+)$/i);
    if (m) s = `${cap(m[1])}: ${m[3]}`;
  }
  const words = s.split(/\s+/);
  if (words.length > maxW) {
    // corta en la primera frase completa, o a ~30 palabras en una pausa natural
    const first = s.match(/^.{40,}?[.;](\s|$)/);
    if (first && first[0].split(/\s+/).length <= maxW + 2 && first[0].split(/\s+/).length >= Math.min(12, maxW * .5)) s = first[0].trim();
    else {
      let cut = words.slice(0, maxW - 2).join(' ');
      const p = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(';'));
      if (p > cut.length * .55) cut = cut.slice(0, p);
      s = cut + '…';
    }
  }
  return cap(s.replace(/[.;,]+$/, ''));
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
function titleCase(s) {
  if (s === s.toUpperCase() && s.length > 3) s = s.toLowerCase();
  return cap(s);
}

// Construye un resumen a partir de una lista de subrayados de un mismo tema
export function buildSummary(hls, fallbackTitle) {
  const sorted = [...hls].sort((a, b) => (a.page - b.page) || (a.y - b.y));
  const titleHl = sorted.find(h => h.level === 1);
  const items = [];
  for (const hl of sorted) {
    if (hl === titleHl) continue;
    items.push(itemFromHl(hl));
  }
  return { title: titleHl ? condense(titleHl.text, 'titulo') : fallbackTitle, items };
}
export function itemFromHl(hl) {
  const cat = classify(hl.text, hl.level === 1 ? 2 : hl.level);
  return { hl: hl.id, cat, level: hl.level, text: condense(hl.text, cat) };
}

// Agrupa por categoría, conservando el orden de importancia (nivel) dentro de cada una
export function grouped(items) {
  const out = [];
  for (const c of CATS) {
    const list = items.filter(i => i.cat === c.k).sort((a, b) => a.level - b.level);
    if (list.length) out.push({ ...c, list });
  }
  return out;
}

// Repaso sin IA: preguntas a partir de definiciones y datos
export function quickQuestions(sum) {
  const qs = [];
  for (const it of sum.items) {
    const m = it.text.match(/^([^:]{2,50}):\s(.+)/);
    if (it.cat === 'definicion' && m) qs.push({ q: `¿Qué es ${m[1].toLowerCase()}?`, a: m[2] });
    else if (it.cat === 'porque') qs.push({ q: `¿Por qué…? ${it.text.split(' ').slice(0, 6).join(' ')}…`, a: it.text });
    else if (it.cat === 'cuando') qs.push({ q: '¿Cuándo ocurre?', a: it.text });
    else if (it.cat === 'tipos') qs.push({ q: '¿Qué tipos hay?', a: it.text });
    if (qs.length >= 5) break;
  }
  return qs;
}

// ---------- IA (Gemini) ----------
export async function aiSummarize({ key, model, title, texts, subject }) {
  const prompt = `Eres una tutora experta que hace apuntes bonitos y muy sintéticos en español para una estudiante universitaria.
Materia: ${subject || 'general'}. Tema aproximado: ${title || 'sin título'}.
Estos son los fragmentos que la estudiante subrayó, en orden, con su nivel de importancia (1 = título, 2 = idea principal, 3 = dato clave, 4 = detalle, 5 = repasar):
${texts.map((t, i) => `${i + 1}. [nivel ${t.level}] ${t.text}`).join('\n')}

Devuelve SOLO JSON con esta forma:
{"titulo": "título corto del tema",
 "items": [{"cat": "definicion|caracteristicas|tipos|funcion|como|cuando|donde|quien|porque|consecuencias|datos|ejemplos|ideas", "text": "apunte telegráfico de máx 12 palabras", "level": 1-5, "from": número del fragmento}],
 "explicacion": "explicación sencilla del tema en 2-3 frases, como a una amiga",
 "analogia": "una analogía cotidiana que lo haga fácil de recordar",
 "mnemotecnia": "truco para memorizar (sigla, frase o rima); vacío si no aplica",
 "preguntas": [{"q": "pregunta de repaso", "a": "respuesta corta"}],
 "stickers": ["2 a 4 palabras clave del tema en español para elegir ilustraciones"],
 "lamina": {
   "tema_visual": "la ilustración que mejor va con el tema: celula|genetica|corpo|plantas|quimica|fisica|mar",
   "subtitulo": "una frase que diga de qué trata el tema (máx 12 palabras)",
   "svg": "ESQUEMA DIDÁCTICO del tema en SVG (ver reglas)",
   "usa_colores": false,
   "leyenda": [{"color": "…", "significa": "…"}],
   "partes": [{"n": 1, "nombre": "nombre de la parte o concepto", "color": "rojo", "icono": "un emoji que lo represente", "puntos": ["1 a 3 apuntes telegráficos de máx 10 palabras"]}],
   "recuerda": "lo más importante que no puede olvidar (1 frase)",
   "curiosidad": "dato curioso real relacionado (1-2 frases)",
   "tip": "consejo para estudiar o para el ENEM sobre este tema (1 frase)",
   "tabla": {"titulo": "Resumen de …", "columnas": ["…", "…"], "filas": [["…", "…"]]}
 },
 "enem": {"area": "ciencias-natureza|ciencias-humanas|matematica|linguagens", "palabras_pt": ["6 a 12 palabras clave EN PORTUGUÉS para buscar preguntas reales del ENEM sobre este tema, de la más específica a la más general, sin artículos (ej.: mitocôndria, respiração celular, organela, ATP)"]},
 "practica": [{"estilo": "Fuvest|Unicamp|UNILA|UFPR|UFRGS|UERJ|UNESP", "enunciado": "pregunta de opción múltiple con un pequeño contexto, en portugués como en los vestibulares", "alternativas": {"A": "…", "B": "…", "C": "…", "D": "…", "E": "…"}, "correcta": "A-E", "explicacion": "por qué esa es la correcta y por qué las otras no (2-3 frases en español)"}]}
PREGUNTAS: "practica" lleva 5 preguntas de práctica ESTILO vestibular sobre los puntos más importantes del tema, creadas por ti (no digas que son de un examen real ni inventes año). Una sola alternativa correcta, distractores plausibles.
LÁMINA ILUSTRADA (debe ser bonita y funcional, como un cuaderno de estudio de Pinterest):
- "partes": de 4 a 8. Si el tema tiene partes físicas (célula, órgano, sistema, molécula, planta, aparato) cada parte es una estructura numerada del esquema. Si no (historia, procesos, fórmulas), son etapas, causas o conceptos clave en orden lógico.
- COLORES DE LAS TARJETAS: por defecto TODAS las partes llevan el MISMO color ("rojo") y "usa_colores": false, "leyenda": []. Solo si las partes pertenecen a categorías distintas que conviene diferenciar (ej.: organelos de célula animal vs. vegetal, arterias vs. venas, metales vs. no metales, causas vs. consecuencias) pon "usa_colores": true, da el mismo color a las partes de la misma categoría y explica cada color en "leyenda". Nunca colores distintos sin una razón.
- PALETA BASE: negro, plata, blanco y rojo. Usa otro color SOLO para identificar elementos que el tema distingue por color (sangre arterial roja / venosa azul, cloroplastos verdes, indicadores químicos, espectro, átomos), nunca de adorno.
- "svg": ilustración didáctica real del tema como dibujo de cuaderno sobre fondo negro: viewBox="0 0 400 300", formas simples y redondeadas, rellenos en grises plata (#3A3A3E, #6B6B72, #B9B9BE) con detalles rojos (#D4202C) y, si hace falta identificar algo, el color que corresponda; contornos blancos (#F5F5F5) de 2 px; fondo transparente. Debe mostrar el tema de verdad (la célula con sus organelos, el corazón con sus cavidades, el ciclo con flechas, la línea de tiempo, el gráfico…). Marca cada parte con un círculo negro con borde blanco y su número (el "n" de "partes") en <text> blanco, font-size 14, bold, centrado, unido a la parte con una línea fina blanca. Sin frases dentro del SVG (solo números o fórmulas de 1-3 caracteres). Sin <script>, sin imágenes, sin foreignObject. Máximo 4500 caracteres. Comillas simples dentro del SVG.
- "tabla": 3 a 6 filas que resuman lo esencial (estructura → función, etapa → qué pasa, fecha → hecho).
Reglas: LO MÁS CONCISO POSIBLE. Estilo apunte telegráfico: 'Concepto: idea clave', sin artículos ni relleno, máx 12 palabras por item; une fragmentos repetidos en un solo item; corrige errores de lectura (OCR) del texto escaneado. No inventes datos que no estén en los fragmentos salvo en explicacion/analogia (máx 2 frases cortas). Mantén el nivel de importancia que puso la estudiante. COLORES: el resumen va en hoja negra con letras blancas y azules (modelo «ola»), pero si un color es NECESARIO para entender (sangre arterial/venosa, indicadores químicos, colores de llamas, espectro, partes de un esquema que se distinguen por color), es obligatorio marcarlo así: [[rojo:sangre arterial]], [[azul:sangre venosa]] (colores: rojo, azul, verde, amarillo, morado, naranja, rosa, celeste, marron, gris). No uses color si no aporta a la explicación.`;
  const { cooled, coolDown, waitFrom } = await import('./quota.js');
  const models = [...new Set([model, 'gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean))];
  let lastErr, quota = false;
  for (const m of models) {
    if (cooled(m)) { quota = true; continue; }
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4, maxOutputTokens: 8192 } }),
      });
    } catch { throw new Error('Sin conexión a internet.'); }
    if (r.status === 429) { quota = true; coolDown(m, waitFrom(await r.text().catch(() => ''))); continue; }
    if (r.status === 404) { coolDown(m, 3 * 864e5); lastErr = new Error(`El modelo ${m} no existe`); continue; }
    if (!r.ok) {
      const t = await r.text();
      if (/API key|API_KEY/i.test(t) && !/model/i.test(t)) throw new Error('La clave de Gemini no es válida. Revísala en Ajustes.');
      lastErr = new Error('Gemini respondió con error ' + r.status); continue;
    }
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    let data;
    try { data = JSON.parse(txt.replace(/^```json\s*|```$/g, '')); } catch { lastErr = new Error('La IA devolvió algo incompleto; prueba otra vez.'); continue; }
    data.model = m;
    return data;
  }
  if (quota) throw new Error('Gemini llegó a su límite gratis por ahora (todos los modelos). Se usó el resumen sin IA.');
  throw lastErr || new Error('No se pudo usar Gemini');
}

// Lee el texto de una imagen (PDF escaneado) con Gemini
export async function aiOcr({ key, model, dataUrl, prompt }) {
  const b64 = dataUrl.split(',')[1];
  for (const m of [...new Set([model || 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'])]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/png', data: b64 } }, { text: prompt || 'Transcribe exactamente el texto en español de esta imagen recortada de un libro escaneado. Devuelve solo el texto, sin comillas ni comentarios. Une las palabras cortadas con guion al final del renglón.' }] }], generationConfig: { temperature: 0 } }),
    });
    if (r.status === 404 || (r.status >= 400 && r.status < 500 && r.status !== 429 && r.status !== 401)) continue;
    if (!r.ok) throw new Error('Gemini ' + r.status);
    const j = await r.json();
    return j.candidates?.[0]?.content?.parts?.map(p => p.text).join('').trim() || '';
  }
  return '';
}

// OCR en el dispositivo (sin clave): Tesseract en español, se descarga la primera vez
let tessWorker = null;
export async function tesseractOcr(canvas) {
  if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('sin internet para leer')); document.head.append(s); });
  tessWorker ||= window.Tesseract.createWorker('spa');
  const w = await tessWorker;
  const r = await w.recognize(canvas);
  return r.data.text;
}
