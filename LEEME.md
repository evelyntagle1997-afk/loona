# Mis apuntes — guía rápida

App para leer y subrayar PDFs a un lado y tener el cuaderno resumido al otro. Funciona en PC y celular, a pantalla completa y sin internet (la nube y la IA sí necesitan conexión).

## 1. Publicarla en Netlify (5 min)
1. Entra a app.netlify.com → **Add new site → Deploy manually**.
2. Arrastra **la carpeta `cuaderno` descomprimida** (la que tiene `index.html`).
3. Netlify te da un enlace (puedes cambiarle el nombre en *Site configuration → Change site name*).
4. Para actualizarla luego: *Deploys* → arrastra la carpeta nueva.

**Instalar a pantalla completa**
- Celular (Chrome): abre el enlace → menú ⋮ → **Agregar a pantalla principal / Instalar app**.
- PC (Chrome/Edge): ícono de instalar en la barra de direcciones. También tienes el botón **Pantalla** en el dock.

## 2. Nube automática PC ↔ celular (Supabase, gratis)
1. Crea una cuenta en supabase.com → **New project** (anota la contraseña de la base).
2. En **Project Settings → API** copia la **Project URL** y la clave **anon / publishable**.
3. En **SQL Editor → New query** pega el SQL que está en la app (Nube → "Código SQL…" → Copiar SQL) y pulsa **Run**.
4. En **Authentication → Sign In / Providers → Email**, desactiva *Confirm email* (así no tienes que confirmar por correo). Si lo dejas activo, confirma el correo antes de entrar.
5. En la app: **Nube** → pega URL y clave → escribe correo y contraseña → **Crear cuenta** (la primera vez) o **Entrar**.
6. En el otro dispositivo: mismos datos → **Entrar**. Todo se sincroniza solo cada pocos segundos.

## 3. IA para resumir mejor (opcional, gratis)
1. Entra a aistudio.google.com → **Get API key** → crea una clave.
2. En la app: **IA** → pega la clave → Guardar.
Sin clave, la app igual resume sola (detecta definiciones, fechas, lugares, causas, tipos, ejemplos).

## 4. Fuentes de DaFont
1. En la app: **Fuentes** → botones "DaFont: Lettering y caligrafía / Manuscrito / Pincel".
2. En DaFont pulsa **Descargar** en la fuente que te guste (fíjate que diga "100% Gratis" o "Gratis para uso personal").
3. En la app: **Subir .zip de DaFont** → elige el .zip tal cual se descargó. Aparece en "Mis fuentes" (también en el otro dispositivo).

## Cómo se usa
- **Ruedas de herramientas (sin barras)**: el PDF y el cuaderno tienen cada uno su rueda, escondida en el borde. Toca la **pestañita** del borde (muestra la herramienta que tienes) y sale la rueda. **Gírala con el dedo** para ver el resto. Toca una herramienta y aparecen **círculos pequeños** con sus opciones (colores, grosor, fuente, estilo…). La rueda solo se esconde cuando tocas la hoja o el PDF. En Texto, **Formatos** y **Colores** se despliegan desde su propio botón (toca ‹ para volver), y ahí mismo están Duplicar, Enderezar y Eliminar. **Arrastra el centro** para subirla, bajarla o pasarla al otro lado; tócalo para sacarla entera.
- **Nombre de cada botón**: en el celular, pasa el lápiz por encima de un botón de la rueda (sin tocar) y aparece su nombre. Con el dedo, mantén apretado el botón medio segundo: muestra el nombre sin activarlo.
- **Colores por importancia** (círculo del PDF): Título → Idea principal → Dato clave → Detalle → Repasar. Al marcar un **Título** empieza un tema nuevo en el cuaderno; lo que subrayes después se ordena debajo en Definición, Tipos, Cuándo, Dónde, Por qué, Ejemplos…
- **Enderezar trazos**: el subrayado se ajusta solo al renglón y a palabras completas. En el cuaderno, deja el lápiz quieto al final del trazo para volverlo recto.
- **Solo lápiz dibuja**: con el dedo desplazas, con el lápiz óptico escribes.
- **Cuaderno**: estilógrafo, pincel de lettering, marcador, lápiz, borrador (también borra stickers, fotos y cintas), cintas washi (pasa el lápiz), texto con lettering, stickers, fotos (recorte a mano alzada y quitar fondo), bloques de diseño. Con **Seleccionar**: agarra el elemento desde cualquier parte para moverlo; con dos dedos pellizca para agrandar/achicar y gira para rotar; la bolita de la esquina agranda y la de arriba gira. Con un texto elegido, toca **Texto** en la rueda para cambiarle fuente, estilo, tamaño y color. Toca otra vez un texto para escribir.
- **Hoja A4 completa**: en la rueda, círculo de Vista → hoja completa o ajustar al ancho.
- **Explícamelo**: selecciona un resumen → Explícamelo (mapa del tema, preguntas; con IA también explicación y analogía).
- **Descargar PDF con subrayados**: rueda del PDF → Vista → descargar.
- **Copia**: descarga un archivo con todo, por si acaso.

- **PDF**: con **un dedo** mueves la página (con inercia; puedes deslizar varias veces seguidas). Con la herramienta **Mover** (mano) también el lápiz arrastra el PDF y con el **lápiz** subrayas. Para agrandar con un dedo: **doble toque** (y otro doble toque para volver), o doble toque y **deja el dedo y deslízalo** arriba/abajo. También funciona el pellizco con dos dedos. El **candado** (arriba a la derecha del PDF) fija la página para apoyar la mano y subrayar con el lápiz. **Raya finita** para subrayar fino.
- **Ir a una página del PDF** (rueda del PDF → botón de hoja): círculos para primera página, −10, anterior, siguiente, +10 y última. El círculo del medio muestra en qué página estás; tócalo para escribir el número (por ejemplo 300) y pulsa Ir. Todo sale pegado a la rueda, sin ventanas aparte.
- **Vuelve a donde lo dejaste**: cada PDF se abre en la última página que estabas leyendo, también en el otro dispositivo.
- **Cualquier PDF**: la app guarda en el dispositivo los lectores de imágenes especiales (JPEG 2000, JBIG2), así los libros escaneados se ven aunque no haya internet o el sitio esté pausado. Si una página sale en blanco, cambia sola a modo compatible. Los PDF con contraseña la piden al abrir.
- **Libros escaneados**: al resaltar, la app lee el texto de la imagen (con tu clave de Gemini es más preciso; sin clave usa un lector en el dispositivo, necesita internet la primera vez).
- **Botón PDF** (rueda del cuaderno): muestra u oculta el PDF al lado; si abriste solo el cuaderno, te deja elegir o subir un PDF.
- **Ambiente para estudiar**: botón Ambiente en el inicio o ícono de fogata en la rueda: fogata, fogata con lluvia, noche en el bosque, arroyo, olas, lluvia y viento. Se generan en vivo, sin internet, y siguen sonando mientras estudias.
- **Bloquear la hoja del cuaderno** (candado en la rueda del cuaderno): la hoja ya no se mueve ni se agranda con el dedo o la palma, pero sigues escribiendo, dibujando y moviendo cosas con el lápiz. Toca el candado otra vez para soltarla.
- **Letras protegidas** (rueda → Borrador → escudo, activado de fábrica): el borrador no borra nada encima de textos, títulos, bloques ni resúmenes, ni el lettering hecho con el pincel. Toca el escudo si alguna vez quieres borrar ese lettering.
- **Candado de cada sticker, foto o cinta**: con Seleccionar, toca el sticker y aparece un candadito en su esquina (se esconde al soltarlo). Bloqueado, el borrador no lo toca y no se mueve por accidente.
- **Cuaderno a la izquierda** (arriba en el celular) y PDF a la derecha; se cambia con el botón **Intercambiar** (dos flechas) de cualquier rueda.
- **Mismo tamaño A4 automático**: al abrir un PDF, el PDF y la hoja se ponen del mismo tamaño solos (se quita en Vista).
- **Vista** (en cualquier rueda): más/menos brillo, página completa o ajustada al ancho.
- **Plantillas de estudio** (rueda del cuaderno → Insertar): mapa mental, línea de tiempo, cuadro comparativo, causa y efecto, ciclo, pirámide, pasos, clasificación, Venn, 6 preguntas, ventajas/desventajas, Cornell, Feynman, tarjetas de recuerdo, repaso espaciado, Sé/Quiero saber/Aprendí, 3 frases y truco para memorizar. Un resumen elegido se puede **convertir** en mapa mental, línea de tiempo, tarjetas o 6 preguntas.
- **Lettering**: bloque **Título gótico**; A+/A− agrandan también los títulos de bloque; el selector de fuentes muestra el nombre de cada una y tiene buscador.

## Novedades de la versión 28
- **Botones agrupados por parecido**: en cada rueda van juntos los de marcar, los de leer y moverse, las flechas (deshacer, rehacer, intercambiar) y los de ver (mostrar el otro lado, vista, ambiente). Entre grupo y grupo queda un espacio.
- **Escribir y dibujar** (un solo botón con dos puntitos): adentro están el estilógrafo, el pincel, el lápiz y **Escribir a mano → letra bonita**. **Marcadores**: el normal y el **con escarcha**.
- **Escribir a mano → letra bonita**: escribe con el lápiz directo en la hoja, sin teclado ni recuadros. Al detenerte un segundo, tu letra se cambia sola por texto con tu fuente de lettering (la eliges en sus opciones). Con tu clave de Gemini (botón IA del inicio) lee mucho mejor la letra a mano.
- **Grosor e intensidad a tu gusto** (ícono de barritas) en todas las herramientas: lápices, marcadores, resaltador, subrayados y lápiz del PDF. El lápiz del PDF ahora marca más intenso.
- **Borrador con grosor ajustable**, en el PDF y en el cuaderno; mientras borras ves un círculo del tamaño del borrador.
- **Brillo con barra**: Vista → Brillo a tu gusto.
- **Página del PDF**: al tocar el botón de hoja se abre directo la casilla para escribir el número.
- Ya no hay botones de acercar/alejar; el zoom es con doble toque o pellizco.

## Teclado (versión 29)
- El **teclado del celular queda escondido** para que no tape la hoja (sobre todo con el celular horizontal).
- Para escribir con teclas: rueda → **Texto** (o **Vista**) → **Mostrar el teclado pequeño**. Es angosto y flotante; arrástralo desde la barrita de arriba a donde no estorbe (recuerda el lugar). La ✕ lo cierra. Tiene ñ, tildes (botón 123), mayúscula, borrar (mantén apretado para borrar seguido) y salto de línea.
- Al ir a una página del PDF sale solo con números.
- Si algún día quieres el teclado del celular: rueda → Texto → **Usar el teclado del celular**.

## Novedades de la versión 30
- **Aspecto liso y elegante**: sin texturas granuladas.
- **El teclado del celular nunca aparece en la app.** Se usa el teclado de la app: angosto, se mueve desde la barrita, tiene **sugerencias de palabras** (aprende las palabras de tus hojas) y un botón para **ocultarlo** abajo a la derecha. En las ventanas (nombre de materia, buscar fuente…) aparece solo y se cierra al terminar; las ventanas suben para que no tape sus botones.
- **Texto con el lápiz**: con la herramienta Texto, si tocas con el lápiz se abre un texto; si **escribes** con el lápiz, tu letra se vuelve letra bonita sola. Si sigues escribiendo en el mismo renglón, se agrega al mismo texto (no queda separado). Las letras sueltas se juntan en palabras y se corrigen palabras casi iguales.
- **Borrar títulos y textos**: quita el escudo (Borrador → Letras protegidas) y el borrador también borra textos, títulos, bloques y resúmenes.
- **Fuentes**: cada una se muestra escrita con su propia letra, con un ejemplo, en tarjetas pequeñas (también con el celular horizontal).
- **Esquemas editables**: toca dos veces un esquema (con Seleccionar) y toca una parte: aparece una barrita para agregar otra igual (＋), quitarla (−), moverla antes o después (‹ ›), letra más grande o pequeña, más ancha o angosta, viñetas sí/no y, en mapas mentales y ciclos, arrastrarla (✥) con las líneas que se acomodan solas. El esquema entero se agranda o achica con las bolitas o con Seleccionar → Agrandar/Achicar.
- **15 plantillas nuevas**: cuadro sinóptico (llaves), mapa conceptual, diagrama de flujo, espina de pescado, línea de tiempo vertical, matriz de 4 cuadros (FODA), embudo, organigrama, glosario, fórmulas y unidades, problema resuelto, preguntas de examen, plan semanal, lista de repaso y resumen de capítulo.
- **Libros grandes**: las páginas se preparan al instante y cada una se lee al verla (la 9 y todas abren rápido); si una se traba, se reintenta sola.

## Novedades de la versión 31
- **Escribir a mano → letra, con pestañas**: en la rueda (Escribir → Escribir a mano) eliges **T Título**, **St Subtítulo** o **Aa Contenido**. Cada una tiene su propia fuente, color, tamaño (A−/A+) y estilo, y se recuerda:
  - Título: gótica nítida y legible (Grenze Gotisch) en vino con filo dorado fino.
  - Subtítulo: Dancing Script en rosa vino.
  - Contenido: Kalam, letra de apuntes clara y pequeña.
- **Fuentes con pestañas**: Todas · Títulos · Subtítulos · Contenido, en tarjetas pequeñitas y juntas para ver muchas a la vez en el celular.
- **Títulos de los resúmenes**: ahora en gótica nítida y legible, en color vino con brillo dorado fino (sin sombra borrosa).
- **Plantillas al instante**: la ventana abre enseguida y cada esquema se dibuja al aparecer.

## Novedades de la versión 32: rueda ordenada
- **Rueda del cuaderno** (de arriba hacia abajo): Seleccionar · Escribir · Marcadores · Borrador · Texto · Decorar · Deshacer · Rehacer · **Hoja** · Intercambiar · Vista.
- **Rueda del PDF**: Marcar · Borrar · Leer · Página · Candado · Deshacer · Intercambiar · Vista.
- Dentro de cada botón hay pocas opciones; los colores están juntos en un solo círculo (tócalo para ver todos) y los ajustes también.
- **Hoja**: muestra en qué hoja estás, y permite nueva hoja, **mover la hoja antes o después**, **borrar la hoja** (dos toques para confirmar), bloquear la hoja y papel.
- **Decorar**: cinta washi, stickers, foto, bloques y plantillas.
- **Vista**: mostrar el PDF, brillo, ambiente, teclado, tamaño de pantalla, cambiar de cuaderno y volver.
- Tocar un botón **siempre** abre sus opciones (antes, un segundo toque las cerraba y parecía que no funcionaba). Seleccionar → Agrandar / Achicar funciona con líneas de tiempo y esquemas.
- **Borrador**: el primer círculo es el escudo. Tócalo y las letras (títulos, subtítulos, textos, letra a mano) se borran con solo pasar el borrador. Si una letra está protegida, la app te avisa cómo desbloquearla.

## Novedades de la versión 33
- **Títulos góticos en toda la app**: el nombre "Mis apuntes", las portadas de las materias, los títulos de secciones y de todas las ventanas usan la gótica nítida (Grenze Gotisch) en vino con filo dorado fino. Aspecto liso, sin texturas.
- **Resolver matemáticas paso a paso** (botón de calculadora en la rueda del cuaderno):
  - Escribe o pega el problema (en español o portugués), sube una **foto**, o escríbelo **a mano** con el lápiz en la pestaña "A mano".
  - Desde la rueda del **PDF** (botón de calculadora): marca con el dedo o el lápiz la zona del problema y se manda tal cual (con tablas y gráficos). Si antes seleccionaste texto del PDF, usa ese texto.
  - La solución llega al cuaderno con: enunciado, **palabras en portugués** traducidas, datos, qué nos piden, la idea, las fórmulas que se usan, **cada paso explicado** con sus cuentas, avisos de errores comunes, la respuesta (y la alternativa correcta), cómo comprobarla, un **atajo para el ENEM** y un **ejercicio parecido** para practicar (con la respuesta escondida).
  - Si es larga, se reparte sola en varias hojas. Las fórmulas se ven bonitas aunque no haya internet.
  - Necesita la clave de Gemini (botón IA del inicio) e internet para resolver.

## Novedades de la versión 34: Loona
- **Toda la app es tu agenda Loona**: cuero negro con grano real y brillo, costura gris humo, mecanismo y seis argollas de cromo entre el PDF y el cuaderno, hojas negras con tinta plateada y títulos góticos en plata. Al abrir una materia, la tapa de cuero gira y se abre.
- **Loona te habla**: te saluda según la hora ("Buenas noches, Eve…") y se despide al volver. Botón de la luna (se puede mover): escríbele o tócale **Hablar** y conversa contigo con la IA. Voz: IA (más natural, usa tu clave de Gemini), del equipo o sin voz.
- **Grabar la clase** (rueda del cuaderno → micrófono): pon título y tema, graba, pausa y detén. La IA la transcribe y arma el resumen en tu cuaderno. Cada clase queda guardada con su título en la materia ("Clases grabadas"). Al abrirla: reproductor, **Ver transcripción** con la hora de cada parte; toca una frase y el audio salta ahí. Pide permiso al profesor antes de grabar.
- **Música**: botón Música en el inicio o rueda → Vista → YouTube. Pega un enlace de canción o lista (también de YouTube Music). Reproductor flotante que mueves a donde quieras: anterior, siguiente, pausa, ±10 s, volumen, mostrar u ocultar el video, minimizar. Sigue sonando mientras estudias dentro de la app.
- **Recortar imágenes del PDF** (rueda del PDF → tijera): marcas la imagen, le quitas el fondo y le das los colores de tu paleta (Plata nocturna, Ámbar, Humo, Tinta negra). Pasa al cuaderno.
- **Stickers**: nuevos stickers góticos y de medicina (luna, murciélago, corazón anatómico, ADN, estetoscopio, rosa negra, polilla, cristal ámbar, llave, sobre XOXO, cráneo de estudio). **Mis stickers**: sube tus propias imágenes. **Sugerir con IA**: elige material según el tema.
- Papel negro y humo para las hojas; colores de subrayado en negro, plata, ámbar y gris.

## Novedades de la versión 35
- **Grabar la clase con pausa automática**: si hay silencio unos 4 segundos, la grabación se pausa sola y vuelve a grabar en cuanto se escucha la voz otra vez. También se pausa si el micrófono se corta (por ejemplo, una llamada) y sigue al volver. El tiempo de la clase no cuenta los silencios, así la transcripción es más corta y clara. Se puede apagar en la ventana de grabar ("Pausar sola en los silencios…"). El botón Pausar sigue funcionando a mano.

## Novedades de la versión 36: más liviana
- Al abrir solo se cargan 7 fuentes (antes 37); las demás llegan cuando las eliges o una hoja las usa.
- Las hojas del cuaderno y del PDF usan lienzos más livianos (casi la mitad de memoria) y las hojas que no ves no se dibujan.
- El cuero, las argollas y los títulos se ven igual pero sin capas de mezcla ni filtros pesados.
- La pausa automática de la grabación revisa el sonido 6 veces por segundo (antes 60).
- En equipos con poca memoria la app activa sola el modo liviano (sin animación de la tapa).

## Novedades de la versión 37
- **Más realismo y liviano**: el cuero tiene grano con luz y brillo de verdad (imagen preparada, no cálculo en vivo). Las páginas del PDF muestran el canto de varias hojas debajo y los botones metálicos se hunden al tocarlos.
- **Subida más rápida a Cloudflare**: 88 archivos en vez de 257 (se quitaron los mapas para PDFs en chino, japonés y coreano, que no usas).
- **Respaldo automático en una carpeta de tu PC** (Ajustes → Copia): eliges una carpeta una vez y cada cambio se copia solo ahí (materias, hojas, subrayados, PDFs, fotos, audios), aunque no uses la nube. Botón para recuperar todo desde esa carpeta. Funciona en Chrome o Edge de computadora; en el celular usa la Nube.
- **Nube más segura**: se corrigió un error que podía dejar la sincronización trabada en un bucle sin fin al volver a entrar con muchos datos. Los mensajes de error de la cuenta ahora están en español.

## Novedades de la versión 39
- **El inicio es tu agenda abierta**, con foto realista: cuero negro, clip, argollas cromadas, papel vegetal ahumado y dijes (cristal ámbar, llave y medallón).
- **Materias** escritas en el papel vegetal: toca una para entrar.
- **Tarjetas en las ranuras**: Seguir estudiando, Nueva materia, Música y Ambiente.
- **Nota del clip**: te saluda según la hora y la fecha.
- **Bolsillo transparente**: tócalo para poner una foto tuya (queda en blanco y negro).
- **Cristal ámbar**: tócalo para hablar con Loona.
- En el celular, desliza la agenda hacia los lados para ver los bolsillos o las materias.

## Novedades de la versión 38
- **Seguir estudiando**: en el inicio aparece un botón con el último libro o cuaderno que abriste (y su página). Un toque y vuelves justo ahí.
- La luna de Loona acompaña el nombre en el inicio; detalles más limpios (textos sin mayúsculas forzadas, sombras más finas).

## Dónde publicarla (sin créditos)
Usa **Cloudflare Pages**: dash.cloudflare.com → Workers & Pages → Create → Pages → Upload assets → arrastra la carpeta `cuaderno`. Para actualizar: Create new deployment. En el enlace nuevo, entra a **Nube** con la misma URL, clave, correo y contraseña → **Entrar**, y tus cuadernos bajan solos.

## v100 — Loona no se queda muda ni sorda
- Cada modelo de Gemini tiene su propia cuota gratis: si uno llega al límite, Loona usa el siguiente y deja descansar al agotado el tiempo que pide Google.
- Música sin Gemini: «Luny, pon…», «pausa», «siguiente», «súbele», «temporizador de 25 minutos» funcionan aunque Gemini esté en su límite. La búsqueda en YouTube la hace el servidor de la app (`worker.js`, ruta `/api/yt`).
- Si un video no se puede poner, salta solo al siguiente resultado.
- Canta o tararea un pedazo y Loona pone la canción (con la letra también funciona: «pon la que dice…»).
- Si se acaba la voz de Google, habla con la voz del celular (panel de Loona → «Si se acaba su voz de Google»).
- En Android, si Gemini descansa, la escucha continua pasa al dictado gratis del celular (puede sonar un pitido).

## v102 — Loona entrenadora y foto en todos tus equipos
- Loona cuenta tus minutos de estudio efectivo (cuaderno o PDF abierto y tú activa), con meta diaria (1–6 h) y racha de días.
- Al abrir un cuaderno empieza sola un bloque de 25 min; cada bloque te felicita y te da 5 min de descanso; si te quedas quieta 4 min o te vas a otra app, te llama de vuelta; al cumplir la meta, celebra.
- Panel de Loona: «Me empuja a estudiar: sí/no» y «Meta diaria».
- La foto del bolsillo ahora se guarda en la nube: aparece en el celular al entrar con tu cuenta.
