# Mis apuntes — contexto para continuar el proyecto con Claude

Si eres Claude y te pasaron este archivo junto con `cuaderno.zip`: este es el proyecto completo de la app **"Mis apuntes"**, hecho en una conversación anterior hasta la **versión 37 (Loona)**. Descomprime el zip, lee este archivo y `LEEME.md`, y sigue trabajando sobre ese código. No empieces de cero.

---

## Qué es la app
Es una app web instalable (PWA) para estudiar en **PC y celular** (Samsung S24 Ultra con S Pen), a pantalla completa:
- **A un lado, el PDF** del libro o apunte. Se subraya con 5 colores por importancia y se puede escribir encima con el lápiz.
- **Al otro lado, el cuaderno**, al estilo GoodNotes, con hojas A4. Lo que subrayas en el PDF pasa solo al cuaderno como **resumen ordenado por categorías** (definición, cuándo, dónde, por qué, tipos, ejemplos…). Funciona sin IA y da mejores resultados con una clave de Gemini.
- **Herramientas del cuaderno:**
  - Lápices con presión: estilógrafo, pincel de lettering, lápiz grafito, marcador y marcador con escarcha.
  - Escritura a mano que se convierte en letra bonita, con pestañas Título / Subtítulo / Contenido.
  - Texto con fuentes de lettering (incluye importar .zip de DaFont).
  - Cintas washi, stickers burdeos realistas, fotos con recorte a mano alzada y quitar fondo.
  - Bloques de diseño y 33 plantillas de estudio (esquemas), editables parte por parte.
- **Organización y nube:** varias materias y cuadernos. Sincronización con **Supabase** entre PC y celular.
- **Extras:** sonidos de ambiente sintetizados (fogata, lluvia, olas…), brillo ajustable y teclado propio de la app con texto predictivo.

## Estética (muy importante para la usuaria)
- **Desde v34 la app se llama Loona**: agenda de cuero negro realista (img/cuero.jpg + grano), cromo de bandas blanco/negro (`--chrome-v/h`), plata, gris humo y ámbar. Sin rojos. Papel negro por defecto (`data-tone=dark`). Lo de abajo sobre burdeos es historia.
- **Cuero y burdeos**, en una paleta pastel de marrón y vino. El aspecto es **liso, fino y elegante, SIN texturas granuladas** (lo pidió explícitamente).
- **Paleta de importancia:**
  - Título #7A2B3A
  - Idea principal #B57A86
  - Dato clave #B8865B
  - Detalle #D9B992
  - Repasar #D5A9AE
- **Títulos en gótica nítida y legible** (Grenze Gotisch 700), en vino con un filo dorado fino, sin sombras borrosas.

## Reglas de diseño que pidió (respetarlas siempre)
- **Sin barras ni botones flotantes.** Todo se maneja desde **una rueda giratoria por panel** (una para el PDF, otra para el cuaderno), escondida en el borde con una pestañita. La rueda tiene sub-círculos y se esconde con **un solo toque** en la hoja.
- **Rueda ordenada y poco cargada:**
  - Cuaderno: Seleccionar · Escribir · Marcadores · Borrador · Texto · Decorar · Deshacer · Rehacer · Hoja · Intercambiar · Vista.
  - PDF: Marcar · Borrar · Leer · Página · Candado · Deshacer · Intercambiar · Vista.
  - Los botones parecidos van juntos. Tocar un botón **siempre** abre sus opciones, nunca las cierra.
- **Cuaderno a la izquierda** (arriba en el celular de pie) y PDF a la derecha. Se intercambian con un botón de la rueda.
- **Un dedo mueve la hoja; el lápiz escribe.** El zoom es con doble toque, doble toque y arrastrar, o pellizco. **No hay botones de zoom.**
- **El teclado del celular NUNCA aparece** dentro de la app. Se usa el teclado propio, que es angosto, movible, tiene sugerencias y un botón para ocultarlo.
- **Grosor e intensidad ajustables** en todas las herramientas, mediante barras en una tarjeta pegada a la rueda.
- **El borrador tiene un escudo** que protege las letras. Sin el escudo, el borrador borra también textos y títulos.
- **Candados:**
  - La hoja del cuaderno se puede bloquear y se sigue editando.
  - La página del PDF se puede bloquear para apoyar la mano.
  - Cada sticker, foto o cinta tiene su propio candado.
- Responder siempre **en español**, con explicaciones simples. La usuaria **no es programadora**.
- **Entregar en pocas versiones** (juntar varios pedidos en una), porque cada subida gasta créditos del hosting.

## Cómo está hecha (código)
- **Tecnología:** JavaScript puro con módulos ES, sin frameworks ni compilación. Los datos locales se guardan en **IndexedDB** (`js/db.js`). Hay un **service worker** (`sw.js`) que guarda TODOS los archivos para funcionar sin internet.
- **PDF:** pdf.js 6.2.108 (en `vendor/`) con capa de texto. Las páginas se leen **solo cuando se van a ver**, porque hay libros de 550 páginas. pdf-lib se usa para exportar el PDF subrayado.
- **IA:** Gemini (modelo gemini-3.6-flash, con otros de respaldo). Se usa para los resúmenes, para leer PDFs escaneados y para leer la letra a mano. Tesseract.js sirve de respaldo sin clave.
- **Archivos principales (`js/`):**
  - `study.js`: la vista dividida y las acciones (`act`).
  - `wheel.js`: la rueda. Contiene `defs()`, `family()`, `pageItem()`, `hwSub()`, `slidersCard()` y `pageCard()`.
  - `notebook.js`: el cuaderno. Maneja tinta, elementos, escritura a mano (`handwritingToText`), borrador, hojas, plantillas y selector de fuentes.
  - `pdfview.js`: el PDF. Maneja subrayado, OCR, carga perezosa (`ensurePage`), ir a página y última página leída.
  - `ink.js`: el dibujo de los trazos, incluida la escarcha.
  - `minikb.js`: el teclado propio, el bloqueo del teclado del celular y el corrector de letra a mano (`cleanHandwriting`).
  - `tpledit.js`: la edición de partes de los esquemas.
  - `templates.js`: las plantillas.
  - `fonts.js`: las fuentes, de Google más las propias.
  - `ambient.js`: los sonidos de ambiente.
  - `sync.js`: la nube con Supabase.
  - `home.js`: la pantalla de inicio. Aquí está `APP_VERSION`.
  - `ui.js`: los íconos y utilidades.
  - `loona.js` (v34): voz y conversación de Loona (Gemini TTS voz Aoede, respaldo voz del equipo), botón luna, saludos.
  - `recorder.js` (v34): grabar clase (MediaRecorder 24 kbps), transcripción con tiempos y resumen al cuaderno, lista y reproductor.
  - `backup.js` (v37): respaldo automático en carpeta (File System Access), `useDir`, `restoreFrom`.
  - `music.js` (v34): reproductor flotante de YouTube (IFrame API).
  - `solver.js` (v33): resolver matemáticas paso a paso con Gemini (texto, foto, a mano o recorte del PDF con `cropFromPane`); arma bloques `variant: 'solucion'` repartidos por hojas. KaTeX local en `vendor/katex/`.
- **En CADA versión nueva:**
  1. Subir `APP_VERSION` en `js/home.js`. La usuaria ve "versión N" en el inicio.
  2. Subir el nombre de caché `apuntes-vN` en `sw.js`.
  3. Si hay un archivo JS nuevo, agregarlo a la lista `CORE` de `sw.js`.
- **Probar** con un servidor local (`python3 -m http.server`) y Playwright, en tamaño PC (1366×800) y en celular de pie y horizontal (412×915 y 915×412, táctil). Después, entregar la carpeta comprimida `cuaderno.zip`.

## Publicación (cómo la actualiza la usuaria)
- Está publicada en **Cloudflare** (Workers & Pages), proyecto **proud-scene-0809**. Antes estaba en Netlify, pero se le acabaron los créditos.
- **Para actualizar:** en Cloudflare, abre el proyecto → **Create new deployment** → arrastra la carpeta `cuaderno` descomprimida.
- **Nube (Supabase):** en la app, botón **Nube** → URL del proyecto, clave anon/publishable, correo y contraseña → **Entrar**. Cada dispositivo o navegador nuevo necesita entrar una vez, y los cuadernos bajan solos. **Nunca** borrar el usuario ni el proyecto de Supabase, ni usar "Crear cuenta" de nuevo con el mismo correo.
- **Navegador recomendado en el celular:** Chrome, con la app instalada desde ⋮ → **Instalar app**. Así abre a pantalla completa y aparece en el cajón de apps de Launcher Pro. En Firefox no se puede instalar con ese launcher y queda la barra del navegador.

## Ideas o pendientes que pueden venir
- v33: títulos góticos (Grenze Gotisch, var `--goth`) en inicio, portadas, secciones y ventanas.
- Ideas pedidas para después: simulados ENEM por materia. Usar una foto real de agenda como base si se quiere fotorrealismo total.
- No usar portadas de bandas, fotos de personas reales ni personajes de Helluva Boss (derechos): la usuaria sube sus propias imágenes en Mis stickers.
- La lectura de letra a mano depende de tener la clave de Gemini puesta en el botón IA del inicio. Sin la clave lee mal.
- La usuaria va pidiendo mejoras de uso en el celular, la rueda y el aspecto. Antes de cambiar algo, revisar que no rompa: mover el PDF con un dedo, el cuaderno a la izquierda, la rueda que se esconde con un toque y el teclado del celular siempre oculto.

## v38 (taste-skill)
- Inicio: botón «Seguir estudiando» (localStorage 'lastStudy', guardado en study.js cada 15 s y al salir).
- h1 con luna (brand-mark), sin text-shadow; .sv-area en minúsculas normales; sombra del dock más ligera.
- Inspector taste-skill: se mantiene el texto plateado en degradado (pedido de estética); avisos menores pendientes: tamaño h1, banda vacía en «Nueva materia".
- APP_VERSION 38, caché sw 'apuntes-v38'.

## v39 (agenda fotográfica)
- Inicio = img/agenda.webp (1536x864, generada con Figma IA, archivo Figma "Loona texturas") + zonas tocables en % (home.js, CSS bloque "v39"). Versión chica img/agenda-s.webp.
- Celular vertical: .ag-vp con scroll-snap horizontal (agenda 250vw, empieza en 46%).
- Foto del bolsillo en localStorage 'homePhoto' (JPEG gris 640px).
- Tests: qa.js usa '.ag-new' y '.ag-index'. 45/45 OK; t5 OK.
