# Web Arcade · Colección de minijuegos para el navegador

[简体中文](./README.md) · [English](./README_en.md) · [日本語](./README_jp.md) · Español

Una colección de minijuegos puramente frontend y sin dependencias en tiempo de ejecución: **vestíbulo de juegos + Snake + Gomoku + 2048**. Las reglas están encapsuladas en módulos centrales que se pueden probar de forma unitaria, y todos los juegos se pueden jugar tanto en escritorio como en móvil.

[![CI](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml)

## Inicio rápido

Se necesita Node.js 20.10 o una versión superior (solo para las herramientas de desarrollo; los juegos en sí no dependen de Node).

```bash
git clone https://github.com/shike021/test-cloud-agent.git
cd test-cloud-agent
npm install
npm run dev            # Inicia el servidor estático local
```

Abre <http://127.0.0.1:5173/> para entrar en el vestíbulo de juegos.

> El código fuente usa ES Modules nativos y los navegadores no permiten cargar módulos mediante `file://`, así que accede con `npm run dev` (o con cualquier servidor estático) en lugar de abrir directamente los archivos HTML.

Cuando necesites un sitio estático distribuible, ejecuta `npm run build`; el resultado queda en `dist/`. Con `npm run preview` puedes previsualizarlo en local.

## Rutas de las páginas

| Ruta       | Página    | Descripción                                                                     |
| ---------- | --------- | ------------------------------------------------------------------------------- |
| `/`        | Vestíbulo | Tarjetas de acceso que muestran los récords y el historial guardados localmente |
| `/snake/`  | Snake     | Un jugador; teclado, cruceta en pantalla o gestos de deslizamiento              |
| `/gomoku/` | Gomoku    | 15×15 para dos jugadores en el mismo equipo; ratón, táctil o cursor de teclado  |
| `/2048/`   | 2048      | Un jugador, combinación de números 4×4; teclado, cruceta o deslizamiento        |

En el vestíbulo, las teclas <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> llevan directamente al juego correspondiente.

## Cómo se juega

### Snake · Serpiente

Juego en tiempo real para un jugador con lógica de paso fijo e interpolación entre fotogramas: el movimiento es un deslizamiento continuo en lugar de saltos de casilla en casilla, y se adapta a las pantallas de alta densidad.

**Controles**

| Acción           | Teclado                           | Móvil                                     |
| ---------------- | --------------------------------- | ----------------------------------------- |
| Mover            | `↑` `↓` `←` `→` o `W` `A` `S` `D` | Cruceta en pantalla o deslizar el tablero |
| Iniciar / Pausar | `Espacio` / `P`                   | Botón «Iniciar» o tocar el tablero        |
| Reiniciar        | `R` / `Enter`                     | Botón «Reiniciar»                         |
| Activar sonido   | `M`                               | Botón de sonido                           |

**Reglas**

- Comer una fruta roja otorga **10 puntos** y hace crecer la serpiente un segmento.
- Cada cinco frutas normales aparece una estrella dorada que da **50 puntos** sin aumentar la longitud; la estrella tiene una cuenta atrás (el anillo exterior) y desaparece al agotarse el tiempo.
- Cada **60 puntos** acumulados se sube de nivel y el movimiento se acelera hasta alcanzar el límite de velocidad de la dificultad actual.
- Chocar contra un muro o morderse a sí misma termina la partida; con el «modo atravesar muros» activado no hay choques contra los bordes y la partida solo acaba por morderse.
- Llenar todo el tablero con la serpiente completa el juego.
- La serpiente no puede invertir el sentido de inmediato (pulsar «izquierda» mientras va hacia la derecha no tiene efecto); las pulsaciones rápidas consecutivas se aplican en orden en los fotogramas siguientes, sin perderse.

La dificultad ofrece tres ritmos —fácil, estándar y difícil— y el «modo atravesar muros» se puede activar por separado.

### Gomoku · Cinco en línea

Partida para dos jugadores en el mismo equipo, con 15×15 intersecciones, fondo de vetas de madera, puntos estrella y coordenadas A–O / 1–15 (que se pueden ocultar). El tablero solo se redibuja cuando se coloca o se deshace una piedra, al pasar el puntero o al cambiar de tamaño.

**Controles**

| Acción         | Teclado                                                    | Ratón / Móvil                        |
| -------------- | ---------------------------------------------------------- | ------------------------------------ |
| Mover cursor   | Con el tablero enfocado, `↑` `↓` `←` `→` o `W` `A` `S` `D` | El puntero muestra una piedra previa |
| Colocar piedra | `Enter` / `Espacio`                                        | Clic o toque en una intersección     |
| Nueva partida  | `N`                                                        | Botón «Nueva partida»                |
| Deshacer       | `U` / `Z`                                                  | Botón «Deshacer»                     |
| Activar sonido | `M`                                                        | Botón de sonido                      |

**Reglas**

- Negras y blancas colocan piedras por turnos en las intersecciones; gana quien alinee **cinco o más** en horizontal, vertical o diagonal (no hay jugadas prohibidas y las líneas más largas también ganan).
- Si se ocupan las 225 intersecciones sin que nadie alinee cinco, la partida es tablas.
- Un círculo rojo marca la última jugada; al ganar, las piedras de la línea se resaltan en dorado y se traza la línea ganadora.
- Deshacer retrocede una jugada; si se deshace la jugada decisiva, el historial de la partida también se revierte.
- Con «alternar primer jugador» activado, cada nueva partida intercambia quién empieza y recuerda el color que abrirá la siguiente.

Las victorias de negras y blancas, las tablas y los ajustes se guardan localmente y se pueden borrar de una sola vez.

### 2048

El clásico de combinación de números en 4×4. El tablero está formado por fichas del DOM en lugar de un Canvas: las coordenadas de fila y columna de cada ficha se escriben en variables CSS y la hoja de estilos se encarga del desplazamiento, la fusión y la animación de aparición, de modo que el tablero se adapta a su contenedor y la capa de renderizado no necesita medir el diseño.

**Controles**

| Acción         | Teclado                           | Ratón / Móvil                             |
| -------------- | --------------------------------- | ----------------------------------------- |
| Mover          | `↑` `↓` `←` `→` o `W` `A` `S` `D` | Cruceta en pantalla o deslizar el tablero |
| Nueva partida  | `R`                               | Botón «Nueva partida»                     |
| Seguir jugando | `C` / `Espacio`                   | Botón «Seguir jugando»                    |

**Reglas**

- Cada movimiento empuja todas las fichas hacia la misma dirección; dos fichas con el mismo número se fusionan en su suma y esa suma se añade a la puntuación.
- Una misma ficha solo se fusiona una vez por movimiento: `2 2 2 2` hacia la izquierda da `4 4`, y `2 2 4` hacia la izquierda da `4 4` en lugar de `8`; las fusiones se resuelven desde el borde hacia el que se mueven las fichas, así que `2 2 2` da `4 2` hacia la izquierda y `2 4` hacia la derecha.
- Solo los movimientos que realmente cambian el tablero cuentan como jugada y hacen aparecer una ficha nueva en una casilla libre (**2** con un 90 % de probabilidad y **4** con un 10 %).
- Llegar a **2048** es la victoria; entonces puedes empezar de nuevo o seguir jugando hacia 4096 y fichas mayores.
- La partida termina cuando el tablero está lleno y no es posible mover en ninguna de las cuatro direcciones.

La puntuación, el récord, la ficha mayor y el número de jugadas se muestran en tiempo real; el récord se guarda localmente y se refleja en la tarjeta del vestíbulo.

### Características comunes

- **Estado persistente**: los récords, el historial, el interruptor de sonido y las preferencias se guardan en `localStorage` y, cuando no se puede escribir (por ejemplo, en modo privado), se degradan automáticamente a almacenamiento en memoria; los tres juegos usan espacios de nombres propios (`snake-game` / `gomoku` / `game-2048`) y no interfieren entre sí.
- **Accesibilidad y experiencia**: etiquetas semánticas, anuncios con `aria-live`, controles enfocables con el teclado, compatibilidad con `prefers-reduced-motion`, pausa automática al cambiar de pestaña (Snake) y descripción textual del tablero (2048).
- **Cero dependencias en tiempo de ejecución**: solo HTML, CSS y ES Modules nativos junto con Canvas 2D y Web Audio.

## Estructura del proyecto

```
.
├── index.html                      # Vestíbulo de juegos
├── snake/index.html                # Página de Snake
├── gomoku/index.html               # Página de Gomoku
├── 2048/index.html                 # Página de 2048
├── public/favicon.svg              # Icono del sitio
├── src/
│   ├── styles/
│   │   ├── base.css                # Variables de diseño, reset y componentes comunes (botones/marco del tablero/superposición/cruceta/ajustes…)
│   │   ├── lobby.css               # Diseño de las tarjetas del vestíbulo
│   │   ├── main.css                # Diseño de la página de Snake
│   │   ├── gomoku.css              # Panel de partida y tarjeta de resultado de Gomoku
│   │   └── game2048.css            # Geometría del tablero, paleta de fichas y animaciones de 2048
│   └── js/
│       ├── main.js                 # Entrada de Snake: ensamblado de módulos, bucle de paso fijo y persistencia de preferencias
│       ├── core/                   # Lógica pura de Snake, sin API del navegador, testeable en Node
│       │   ├── constants.js        # Direcciones, estados, tipos de comida y parámetros por defecto
│       │   ├── rng.js              # Generador aleatorio determinista con semilla (mulberry32)
│       │   └── snake-game.js       # Todas las reglas (movimiento/colisiones/crecimiento/puntuación/niveles/generación de comida)
│       ├── gomoku/
│       │   ├── constants.js        # Jugadores, estados, letras de coordenadas y parámetros por defecto
│       │   ├── gomoku-game.js      # Todas las reglas (validez/victoria/tablas/historial y deshacer), sin API del navegador
│       │   ├── renderer.js         # Dibujo en Canvas 2D del tablero, las piedras, el cursor y la línea ganadora
│       │   ├── hud.js              # Indicador de turno, historial y tarjeta de resultado
│       │   └── main.js             # Entrada de Gomoku: mapeo de entrada, persistencia y redibujado bajo demanda
│       ├── game2048/
│       │   ├── core/
│       │   │   ├── constants.js    # Direcciones, estados y parámetros por defecto (4×4, objetivo 2048)
│       │   │   └── game-2048.js    # Todas las reglas (deslizamiento/fusión única/puntuación/generación/victoria y derrota), sin API del navegador
│       │   ├── ui/
│       │   │   ├── renderer.js     # Grupo de fichas del DOM posicionadas con variables CSS
│       │   │   ├── input-controller.js # Teclado, cruceta y gestos de deslizamiento → movimientos
│       │   │   └── hud.js          # Marcador, tarjeta de resultado y descripción textual del tablero
│       │   └── main.js             # Entrada de 2048: ensamblado y persistencia del récord
│       ├── lobby/main.js           # Vestíbulo: lectura del progreso local y accesos con teclas numéricas
│       ├── services/storage.js     # Fábrica de localStorage con espacios de nombres y tolerante a fallos
│       └── ui/                     # Módulos de interfaz de Snake y compartidos
│           ├── renderer.js         # Renderizado en Canvas 2D e interpolación entre fotogramas
│           ├── input-controller.js # Teclado, puntero y gestos táctiles → acciones semánticas
│           ├── hud.js              # Marcador, superposiciones y estado de los botones
│           └── sound-player.js     # Efectos sintetizados con Web Audio (sin recursos binarios, compartidos por ambos juegos)
├── scripts/
│   ├── dev-server.mjs              # Servidor estático sin dependencias (desarrollo y previsualización)
│   ├── build.mjs                   # Empaquetado multipágina con esbuild + hash de contenido + reescritura de las cuatro páginas de entrada
│   └── check-assets.mjs            # Validación de las referencias a recursos estáticos de las cuatro páginas de entrada
├── tests/                          # Pruebas unitarias con Vitest
├── task-manager/                   # Proyecto full-stack Task Manager independiente (ver más adelante)
└── .github/workflows/              # CI y despliegue en GitHub Pages
```

### Claves de la arquitectura

- **Reglas separadas de la presentación**: `src/js/core/snake-game.js`, `src/js/gomoku/gomoku-game.js` y `src/js/game2048/core/game-2048.js` son clases que no dependen de ninguna API del navegador (en Snake y 2048 el generador aleatorio se inyecta por el constructor), de modo que las reglas se pueden probar de forma determinista en Node; el renderizado, la entrada, el sonido y el almacenamiento son independientes, y cada `main.js` de entrada solo se encarga del ensamblado y de dirigir el flujo, así que cambiar las reglas no afecta al código de renderizado.
- **Tres formas de avanzar el juego**: Snake es un juego en tiempo real que usa un acumulador de paso fijo para avanzar la lógica según `tickIntervalMs` y en cada fotograma interpola entre el estado anterior y el actual con `alpha` (el progreso hacia el siguiente tick), por lo que se comporta igual en dispositivos con distintas frecuencias de refresco; Gomoku solo cambia tras una entrada, no tiene bucle de animación y redibuja un único fotograma bajo demanda; 2048 también es por turnos, pero anima con fichas del DOM: el núcleo da a cada ficha un id estable y su «posición antes del movimiento», con lo que la capa de renderizado reutiliza los elementos y deja las animaciones de deslizamiento y fusión a las transiciones CSS.
- **Estilos por capas**: `base.css` aporta las variables de diseño y los componentes comunes a las cuatro páginas (botones, marco del tablero, superposición, cruceta en pantalla, etc.), y cada hoja de estilos de página lo incorpora con `@import` para describir solo sus diferencias de diseño; durante la compilación, esbuild inserta los `@import`, de modo que cada página termina solicitando un único archivo CSS.

## Scripts de desarrollo

| Comando                | Descripción                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`          | Inicia el servidor estático local (por defecto `127.0.0.1:5173`)                              |
| `npm run build`        | Compilación de producción en `dist/` (minificada, con hash de contenido y sourcemaps)         |
| `npm run preview`      | Previsualiza `dist/` con el servidor estático                                                 |
| `npm run lint`         | Comprobación con ESLint (`npm run lint:fix` corrige automáticamente)                          |
| `npm run format:check` | Comprobación de formato con Prettier (`npm run format` formatea automáticamente)              |
| `npm run check:assets` | Verifica que los recursos locales de las cuatro páginas existan y usen rutas relativas        |
| `npm test`             | Ejecuta las pruebas unitarias de Vitest (`npm run test:watch` en modo observación)            |
| `npm run verify`       | Ejecuta en orden todas las comprobaciones anteriores; equivale a los pasos centrales de la CI |

`scripts/dev-server.mjs` admite los parámetros `--root`, `--port` y `--host`, por ejemplo `node scripts/dev-server.mjs --root dist --port 4173`.

## Pruebas

Las pruebas están en `tests/` y usan Vitest (se ejecutan con `npm test`):

- `snake-game.test.js`: disposición inicial, generación de comida (incluida la comprobación de que no se solapa con la serpiente en 50 semillas aleatorias), validación de parámetros, ciclo de vida, búfer de direcciones y bloqueo del giro inverso, choque contra muros / atravesar muros / morderse, el movimiento legal cuando la cola libera la casilla en el mismo fotograma, puntuación, niveles y límite de velocidad, aparición / puntuación / caducidad de la comida extra y la detección de victoria al llenar el tablero.
- `gomoku-game.test.js`: estado inicial y validación de parámetros, alternancia de turnos e historial, rechazo de jugadas fuera del tablero o repetidas, detección de victoria en horizontal / vertical / ambas diagonales, completar un hueco para hacer cinco, victoria con línea larga, cuatro piedras que no ganan, piedras de distinto color que no forman línea, líneas que no cruzan el borde del tablero, tablas, rechazo de jugadas tras el final, deshacer (incluido reiniciar tras deshacer la jugada decisiva) y el reinicio con cambio de primer jugador.
- `game-2048.test.js`: disposición inicial y validación de parámetros, reproducibilidad al inyectar el generador aleatorio, deslizamiento y fusión de columnas en las cuatro direcciones, la regla de «una sola fusión por movimiento» y la resolución desde el borde, los movimientos inválidos que no cuentan como jugada ni generan fichas, la acumulación de puntuación, la victoria al llegar a 2048 y «seguir jugando», el anuncio de victoria una única vez, el final con el tablero lleno y sin vecinos iguales, los metadatos que necesita la capa de renderizado (id de ficha, posición previa al movimiento, origen de la fusión) y la validación de los argumentos de `loadBoard` junto con la inmutabilidad de las instantáneas.
- `game-2048-ui.test.js` (jsdom): el renderizador que genera las casillas de fondo, escribe en el DOM las coordenadas / el valor / el número de dígitos de cada ficha, reutiliza el mismo elemento al deslizar, elimina las fichas fusionadas tras su entrada (el siguiente movimiento las limpia de inmediato) y no deja elementos antiguos tras reiniciar; el marcador del HUD, la descripción textual del tablero y las tarjetas de victoria y fin de partida; y el mapeo de teclas, cruceta y deslizamientos del controlador de entrada de 2048.
- `input-controller.test.js` (jsdom): mapeo de las flechas y de `WASD`, teclas de comando, teclas modificadoras ignoradas, cruceta en pantalla, gestos de deslizamiento y toque, y la ausencia de respuesta después de `detach()`.
- `storage.test.js`: lectura y escritura de números / booleanos / cadenas con validación por lista blanca, aislamiento entre espacios de nombres, recuperación ante datos corruptos y degradación a memoria cuando `localStorage` lanza excepciones o no está disponible.

## GitHub Actions

- **`ci.yml` — Integración continua**: se ejecuta en cada push a cualquier rama, en todos los pull requests y de forma manual; en la matriz de Node 20 / 22 / 24 lanza en orden `npm ci`, ESLint, la comprobación de Prettier, la validación de recursos estáticos, las pruebas de Vitest y la compilación de producción, y después comprueba página por página que en `dist/` estén las cuatro páginas de entrada con sus JS/CSS con hash, que el HTML se haya reescrito correctamente y que existan `.nojekyll` y el favicon, para finalmente subir el artefacto `dist/` (con 7 días de retención). Los nuevos commits de una misma rama cancelan automáticamente las ejecuciones anteriores sin terminar.
- **`deploy-pages.yml` — Despliegue en GitHub Pages**: compila y publica `dist/` en cada push a `main` o de forma manual. La primera vez hay que elegir **GitHub Actions** en **Settings → Pages → Build and deployment → Source**; hasta entonces este workflow falla, pero es independiente de la CI. Como todas las referencias a recursos son relativas, el sitio también funciona bajo la subruta `https://<user>.github.io/<repo>/`.
- **`dependabot.yml` — Mantenimiento de dependencias**: revisa cada semana las actualizaciones de las dependencias npm y de las versiones de GitHub Actions; las actualizaciones minor/patch de las dependencias de desarrollo se agrupan en un único PR.

## Subproyecto `task-manager/`

El repositorio conserva además el **Task Manager** full-stack (Express + SQLite + React) que se usó al principio para validar el entorno de desarrollo de Cloud Agent. Está recogido en el directorio `task-manager/` como un proyecto npm independiente con su propio `package.json`, `package-lock.json` y configuración de ESLint, y no interfiere con la compilación, el lint ni las pruebas de esta colección (tanto ESLint como Prettier de la raíz ignoran ese directorio).

```bash
cd task-manager
npm ci
npm run dev        # API :4000 + Web :5173
```

Si ejecutas a la vez la colección de juegos y la parte web del Task Manager, cambia el puerto de una de ellas (por ejemplo, `npm run dev -- --port 5175`), porque ambas escuchan en `5173` por defecto. La documentación detallada está en [`task-manager/README.md`](./task-manager/README.md).

## Compatibilidad con navegadores

Está pensado para navegadores modernos compatibles con ES2022, Canvas 2D, `ResizeObserver` y las propiedades CSS `aspect-ratio`, las unidades de consulta de contenedor (`cqw`) y las propiedades de transformación individuales (`translate` / `scale`): Chrome / Edge 111+, Firefox 113+ y Safari 16.4+. Si Web Audio no está disponible, el sonido se silencia automáticamente sin lanzar errores.

## Licencia

[MIT](./LICENSE)

## Aviso

Este repositorio es un **proyecto de prueba** destinado a evaluar la seguridad de la gestión de código de Cursor y está relacionado con la seguridad de la información empresarial. La colección de minijuegos solo sirve como soporte de ejemplo para verificar el comportamiento de seguridad de Cursor en el alojamiento de código, la gestión de cambios y los flujos de colaboración, y no representa ningún producto oficial ni un uso en producción.
