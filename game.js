'use strict';

/** Número de columnas del tablero. */
const COLS = 10;
/** Número de filas del tablero. */
const ROWS = 20;
/** Tamaño en píxeles de cada celda. */
const BLOCK = 30;

/**
 * Representa una pieza activa en el tablero.
 * @typedef {Object} Piece
 * @property {number} type - Índice 1-7 que apunta a PIECES y COLORS.
 * @property {number[][]} shape - Matriz cuadrada con la forma actual (0 = vacío).
 * @property {number} x - Columna del borde izquierdo de la pieza en el tablero.
 * @property {number} y - Fila del borde superior de la pieza en el tablero.
 */

/**
 * Colores de cada tipo de pieza, alineados por índice con PIECES.
 * El índice 0 es null (celda vacía); índices 1-7 corresponden a I, O, T, S, Z, J, L.
 * @type {(string|null)[]}
 */
const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

/**
 * Matrices de forma de cada pieza, alineadas por índice con COLORS.
 * El índice 0 es null; índices 1-7 corresponden a I, O, T, S, Z, J, L.
 * Cada celda no cero contiene el índice del tipo de pieza (= su color en COLORS).
 * @type {(number[][]|null)[]}
 */
const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

/**
 * Puntos base por número de líneas eliminadas simultáneamente (se multiplica por nivel).
 * Índice = cantidad de líneas (0-4); el índice 0 es 0 por conveniencia.
 * @type {number[]}
 */
const LINE_SCORES = [0, 100, 300, 500, 800];

/** @type {HTMLCanvasElement} Canvas principal donde se dibuja el tablero. */
const canvas = document.getElementById('board');
/** @type {CanvasRenderingContext2D} Contexto 2D del canvas principal. */
const ctx = canvas.getContext('2d');
/** @type {HTMLCanvasElement} Canvas de vista previa para la siguiente pieza. */
const nextCanvas = document.getElementById('next-canvas');
/** @type {CanvasRenderingContext2D} Contexto 2D del canvas de vista previa. */
const nextCtx = nextCanvas.getContext('2d');
/** @type {HTMLElement} Elemento del DOM que muestra la puntuación. */
const scoreEl = document.getElementById('score');
/** @type {HTMLElement} Elemento del DOM que muestra el número de líneas eliminadas. */
const linesEl = document.getElementById('lines');
/** @type {HTMLElement} Elemento del DOM que muestra el nivel actual. */
const levelEl = document.getElementById('level');
/** @type {HTMLElement} Panel de superposición para pausa y game over. */
const overlay = document.getElementById('overlay');
/** @type {HTMLElement} Título del panel de superposición (ej. "PAUSA", "GAME OVER"). */
const overlayTitle = document.getElementById('overlay-title');
/** @type {HTMLElement} Texto de puntuación mostrado en el panel de superposición. */
const overlayScore = document.getElementById('overlay-score');
/** @type {HTMLElement} Botón de reinicio del juego. */
const restartBtn = document.getElementById('restart-btn');

/**
 * Estado global del juego. Todas estas variables son reinicializadas por `init()`.
 * @type {number[][]} board - Matriz ROWS×COLS; 0 = vacío, 1-7 = índice de color/pieza fijada.
 * @type {Piece} current - Pieza que está cayendo actualmente.
 * @type {Piece} next - Próxima pieza que entrará al tablero.
 * @type {number} score - Puntuación acumulada.
 * @type {number} lines - Total de líneas eliminadas.
 * @type {number} level - Nivel actual (sube cada 10 líneas).
 * @type {boolean} paused - Indica si el juego está pausado.
 * @type {boolean} gameOver - Indica si la partida ha terminado.
 * @type {number} lastTime - Timestamp del último frame (ms), usado para calcular dt.
 * @type {number} dropAccum - Tiempo acumulado desde la última bajada automática (ms).
 * @type {number} dropInterval - Milisegundos entre bajadas automáticas; disminuye al subir nivel.
 * @type {number} animId - ID del `requestAnimationFrame` activo para poder cancelarlo.
 */
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

/**
 * Crea un tablero vacío de ROWS × COLS relleno con ceros.
 * @returns {number[][]} Matriz bidimensional que representa el tablero vacío.
 */
function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

/**
 * Genera una pieza aleatoria centrada horizontalmente en la parte superior del tablero.
 * La forma se clona para no mutar la definición original en PIECES.
 * @returns {Piece} Nueva pieza con tipo aleatorio entre 1 y 7.
 */
function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

/**
 * Comprueba si una forma colisiona con los bordes del tablero o con celdas ocupadas.
 * Ignora las celdas por encima del tablero (ny < 0) para permitir que las piezas aparezcan.
 * @param {number[][]} shape - Matriz de la forma a comprobar.
 * @param {number} ox - Desplazamiento horizontal (columna del borde izquierdo de la forma).
 * @param {number} oy - Desplazamiento vertical (fila del borde superior de la forma).
 * @returns {boolean} `true` si hay colisión, `false` si la posición es válida.
 */
function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

/**
 * Devuelve una nueva matriz que es la rotación 90° en sentido horario de la forma dada.
 * Implementado como transposición + inversión de columnas.
 * @param {number[][]} shape - Matriz de la forma original.
 * @returns {number[][]} Nueva matriz con la forma rotada.
 */
function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

/**
 * Intenta rotar la pieza actual 90° en sentido horario aplicando wall kicks.
 * Prueba desplazamientos horizontales [0, -1, 1, -2, 2] hasta encontrar una posición
 * válida; si ninguno funciona, la rotación se cancela silenciosamente.
 */
function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

/**
 * Fusiona la pieza actual en el tablero, escribiendo su índice de tipo en cada celda ocupada.
 * Debe llamarse solo cuando la pieza ya no puede bajar más.
 */
function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

/**
 * Elimina todas las filas completas del tablero, actualiza score, lines, level y dropInterval.
 * El recorrido va de abajo hacia arriba; tras eliminar una fila con `splice` se incrementa `r`
 * para re-examinar el mismo índice, ya que la fila superior ha descendido a esa posición.
 */
function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++; // Re-examina el mismo índice tras el desplazamiento de filas.
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

/**
 * Calcula la fila Y más baja a la que puede descender la pieza actual sin colisionar.
 * Se usa para dibujar la sombra (ghost) y para el hard drop.
 * @returns {number} Fila Y del ghost de la pieza actual.
 */
function ghostY() {
  let ghostRow = current.y;
  while (!collide(current.shape, current.x, ghostRow + 1)) ghostRow++;
  return ghostRow;
}

/**
 * Baja la pieza actual instantáneamente hasta la posición del ghost y la fija.
 * Otorga 2 puntos por cada fila recorrida en el hard drop.
 */
function hardDrop() {
  const ghostRow = ghostY();
  score += (ghostRow - current.y) * 2;
  current.y = ghostRow;
  lockPiece();
}

/**
 * Baja la pieza actual una fila manualmente (tecla ↓).
 * Otorga 1 punto si el movimiento es posible; fija la pieza si ya no puede bajar.
 */
function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

/**
 * Fija la pieza actual en el tablero, elimina líneas completas y genera la siguiente pieza.
 */
function lockPiece() {
  merge();
  clearLines();
  spawn();
}

/**
 * Hace avanzar la siguiente pieza a la posición activa y genera una nueva siguiente pieza.
 * Si la pieza que acaba de entrar colisiona de inmediato, termina la partida.
 */
function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

/**
 * Actualiza los elementos del HUD (puntuación, líneas y nivel) con los valores actuales.
 */
function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

/**
 * Dibuja un bloque individual con su color y un destello superior semitransparente.
 * No dibuja nada si `colorIndex` es 0 (celda vacía).
 * @param {CanvasRenderingContext2D} context - Contexto 2D sobre el que dibujar.
 * @param {number} x - Posición horizontal en unidades de celda.
 * @param {number} y - Posición vertical en unidades de celda.
 * @param {number} colorIndex - Índice en COLORS (0 = vacío, 1-7 = color de pieza).
 * @param {number} size - Tamaño del bloque en píxeles.
 * @param {number} [alpha=1] - Opacidad del bloque (0.0 - 1.0); usado para el ghost.
 */
function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // Destello superior para dar sensación de profundidad al bloque.
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

/**
 * Dibuja las líneas de la cuadrícula del tablero sobre el canvas principal.
 */
function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

/**
 * Renderiza el frame completo: cuadrícula, celdas fijadas del tablero,
 * ghost (sombra semitransparente) y la pieza activa.
 */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // Celdas fijadas en el tablero.
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // Ghost: sombra de la posición de aterrizaje de la pieza actual.
  const ghostRow = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, ghostRow + r, current.shape[r][c], BLOCK, 0.2);

  // Pieza activa en su posición actual.
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

/**
 * Dibuja la siguiente pieza centrada en el canvas de vista previa.
 * Usa un tamaño de celda fijo de 30px y una cuadrícula de referencia de 4×4.
 */
function drawNext() {
  const nextBlockSize = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offsetX = Math.floor((4 - shape[0].length) / 2);
  const offsetY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offsetX + c, offsetY + r, shape[r][c], nextBlockSize);
}

/**
 * Finaliza la partida: detiene el game loop y muestra el panel de game over con la puntuación.
 */
function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

/**
 * Alterna entre estado pausado y en juego. No hace nada si la partida ha terminado.
 * Al reanudar, reinicia `lastTime` para evitar un salto acumulado de tiempo mientras estuvo pausado.
 */
function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

/**
 * Función principal del game loop, llamada por `requestAnimationFrame` en cada frame.
 * Acumula el tiempo transcurrido y baja la pieza automáticamente cuando supera `dropInterval`.
 * @param {DOMHighResTimeStamp} timestamp - Tiempo en milisegundos proporcionado por rAF.
 */
function loop(timestamp) {
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;
  dropAccum += deltaTime;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

/**
 * Inicializa (o reinicia) el estado completo del juego y arranca el game loop.
 * Es el punto de entrada al cargar la página y al pulsar "Reiniciar".
 */
function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

/**
 * Controles de teclado:
 *  - P          → pausa / reanuda
 *  - ← / →      → mover la pieza horizontalmente
 *  - ↓           → soft drop (bajar una fila, +1 punto)
 *  - ↑ / X      → rotar 90° en sentido horario
 *  - Espacio    → hard drop (caída instantánea, +2 pts/fila)
 */
document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

/** Reinicia el juego al hacer clic en el botón de reinicio del overlay. */
restartBtn.addEventListener('click', init);

init();
