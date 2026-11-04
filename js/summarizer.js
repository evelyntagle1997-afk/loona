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
 "stickers": ["2 a 4 palabras clave del tema en español para elegir ilustraciones"]}
Reglas: LO MÁS CONCISO POSIBLE. Estilo apunte telegráfico: 'Concepto: idea clave', sin artículos ni relleno, máx 12 palabras por item; une fragmentos repetidos en un solo item; corrige errores de lectura (OCR) del texto escaneado. No inventes datos que no estén en los fragmentos salvo en explicacion/analogia (máx 2 frases cortas). Mantén el nivel de importancia que puso la estudiante.`;
  const models = [model || 'gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'];
  let lastErr;
  for (const m of [...new Set(models)]) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
    });
    if (r.status === 404) { lastErr = new Error(`El modelo ${m} no existe`); continue; }
    if (!r.ok) {
      const t = await r.text();
      if (r.status === 400 && /API key/i.test(t)) throw new Error('La clave de Gemini no es válida. Revísala en Ajustes.');
      if (r.status === 429) throw new Error('Gemini alcanzó el límite gratuito por ahora. Se usó el resumen sin IA.');
      throw new Error('Gemini respondió con error ' + r.status);
    }
    const j = await r.json();
    const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    const data = JSON.parse(txt.replace(/^```json\s*|```$/g, ''));
    data.model = m;
    return data;
  }
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
