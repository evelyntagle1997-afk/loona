// Cuota gratis de Gemini: cada modelo tiene su propio límite. Cuando uno llega al tope (error 429),
// se deja descansar el tiempo que pide Google y se usa el siguiente. Así Loona no se queda muda ni sorda.
const K = 'gemCool';
let cool = {}; try { cool = JSON.parse(localStorage.getItem(K) || '{}'); } catch { cool = {}; }
const save = () => { try { localStorage.setItem(K, JSON.stringify(cool)); } catch { } };

export const cooled = m => (cool[m] || 0) > Date.now();
export function coolDown(m, ms) { cool[m] = Date.now() + ms; save(); }
export function resetCool() { cool = {}; save(); }

// milisegundos hasta la medianoche del Pacífico (cuando Google reinicia la cuota diaria)
function untilPacificMidnight() {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const done = ((+p.hour % 24) * 3600 + +p.minute * 60 + +p.second) * 1000;
    return Math.max(60000, 864e5 - done + 60000);
  } catch { return 6 * 3600e3; }
}
// cuánto esperar según la respuesta de Google
export function waitFrom(body) {
  if (/PerDay|per_day|RequestsPerDay|daily/i.test(body)) return untilPacificMidnight();
  const d = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  return d ? Math.min(10 * 60000, (parseFloat(d[1]) + 2) * 1000) : 65000;
}
// cuándo vuelve el primero de una lista (para avisar)
export function backAt(models) {
  const t = Math.min(...models.map(m => cool[m] || 0));
  return t > Date.now() ? new Date(t) : null;
}
export const allCooled = models => models.every(cooled);

export class QuotaError extends Error {
  constructor(models) {
    const at = backAt(models);
    super('Gemini llegó a su límite gratis' + (at ? ' hasta las ' + at.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '') + '.');
    this.quota = true; this.at = at;
  }
}
