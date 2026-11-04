// Órdenes rápidas que Loona entiende sola, sin gastar cuota de Gemini:
// música (pon, pausa, siguiente, volumen…), temporizador y la hora.
const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:"«»]/g, ' ').replace(/\s+/g, ' ').trim();
const WAKE = /^(oye |hey |ey )?(loona|luna|lona|luny|luni|lunny|loonie|looney|loony|lunita|lunie)\b ?/;
const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cuarentaicinco: 45, cincuenta: 50, sesenta: 60, noventa: 90 };
const num = s => { const m = /(\d+)/.exec(s); if (m) return +m[1]; for (const [k, v] of Object.entries(NUM)) if (new RegExp('\\b' + k + '\\b').test(s)) return v; return 0; };

// devuelve { act: 'buscar: …', say: 'Va.' } o null si no es una orden simple
export function localCommand(text) {
  let t = norm(text).replace(WAKE, '').replace(/^(por favor|porfa|porfis) /, '').replace(/ (por favor|porfa|porfis)$/, '').trim();
  if (!t) return null;
  if (/^(que hora es|que hora tienes|dime la hora)$/.test(t)) return { say: 'Son las ' + new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) + '.' };
  if (/^(pausa|pausala|pausalo|pon pausa|para( la musica| la cancion)?|deten( la musica)?|stop|pausa (la musica|la cancion|el video))$/.test(t)) return { act: 'pausar', say: 'Pausado.' };
  if (/^(sigue|continua|reanuda|play|dale play|despausa|quita la pausa|reproduce)( la musica| la cancion| el video)?$/.test(t)) return { act: 'reproducir', say: 'Va.' };
  if (/^(siguiente|la siguiente|otra|otra cancion|cambia(la)?( de cancion| la cancion)?|salta(la)?|pasa(la)?|skip|next)( cancion)?$/.test(t)) return { act: 'siguiente', say: 'Va.' };
  if (/^(anterior|la anterior|la de antes|regresa(la)?|vuelve a la anterior)( cancion)?$/.test(t)) return { act: 'anterior', say: 'Va.' };
  if (/^(sube(le)?|subele|mas (alto|volumen|fuerte)|sube (el )?volumen|subele (al )?volumen)( un poco| mas)?$/.test(t)) return { act: 'subir', say: 'Listo.' };
  if (/^(baja(le)?|bajale|mas (bajo|despacio|bajito)|menos volumen|baja (el )?volumen|bajale (al )?volumen)( un poco| mas)?$/.test(t)) return { act: 'bajar', say: 'Listo.' };
  if (/^(silencio|silencia|mute|muteala|calla la musica)$/.test(t)) return { act: 'silencio', say: 'Listo.' };
  if (/^(quita|cierra|apaga|saca) (la )?(musica|cancion|video|reproductor)$/.test(t)) return { act: 'cerrar_musica', say: 'Listo.' };
  if (/^(adelanta(la)?|adelantala)( \w+)*$/.test(t)) return { act: 'adelantar: ' + (num(t) || 15), say: '' };
  if (/^(atrasa(la)?|regresa \d+ segundos)( \w+)*$/.test(t)) return { act: 'atrasar: ' + (num(t) || 15), say: '' };
  if (/^(para|deten|apaga|quita|cancela) (el )?(temporizador|pomodoro|cronometro|timer)$/.test(t)) return { act: 'detener_temporizador', say: 'Temporizador apagado.' };
  if (/(temporizador|pomodoro|timer|cronometro)/.test(t) || /^(\w+ )?(\d+|\w+) minutos( de estudio| para estudiar)?$/.test(t)) {
    const n = num(t); if (n || /pomodoro/.test(t)) return { act: 'temporizador: ' + (n || 25), say: (n || 25) + ' minutos. Empieza ya.' };
  }
  if (/^(pantalla completa|pon(la)? en pantalla completa)$/.test(t)) return { act: 'pantalla_completa', say: '' };
  // música sin decir cuál
  if (/^(pon(me|nos)?|reproduce|quiero|toca|dame) (algo de )?(musica|algo|una cancion|musiquita|musica para estudiar|algo para estudiar|lo que quieras|algo que me guste)( para estudiar| de fondo)?$/.test(t)) return { act: 'reproducir', say: 'Va, algo de lo tuyo.' };
  // «pon …» / «reproduce …» / «quiero escuchar …» / «la canción que dice …»
  let m = /^(?:pon(?:me|nos)?|reproduce|reproduceme|buscame la cancion|busca la cancion|quiero (?:escuchar|oir)|ponme a|pon a|escuchemos|la cancion que dice|la que dice|una que dice) (.+)$/.exec(t);
  if (m) {
    let q = m[1]; for (let k = 0; k < 3; k++) q = q.replace(/^(la cancion|el tema|la musica|musica|canciones|la de|el de|algo de|un poco de|la que dice|una que dice|que dice|una de|de|a) /, '');
    q = q.replace(/ (en youtube|en el reproductor|por favor)$/, '').trim();
    if (q && !/^(atencion|cuidado|un temporizador|una alarma|una nota|un post ?it)\b/.test(q)) return { act: 'buscar: ' + q, say: 'Va, te la pongo.' };
  }
  return null;
}
