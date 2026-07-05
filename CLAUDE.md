# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Tetris clásico en JavaScript vanilla + HTML5 Canvas. Sin dependencias, sin bundler, sin build. Cuatro archivos: `index.html`, `style.css`, `game.js`, `README.md`.

## Ejecutar

No hay proceso de build ni tests. Se abre directamente o con cualquier servidor estático:

```bash
open index.html                 # abrir directo (macOS)
python3 -m http.server 8000     # o servidor local -> http://localhost:8000
```

## Arquitectura

Toda la lógica vive en `game.js`, escrito con estado global mutable (no hay clases ni módulos). Variables globales clave: `board`, `current`, `next`, `score`, `lines`, `level`, `dropInterval`, `dropAccum`. `init()` las (re)inicializa; se invoca al cargar la página y desde el botón "Reiniciar".

- **Tablero**: matriz `ROWS × COLS`; cada celda es `0` (vacía) o un índice `1–7` que apunta a `COLORS`/`PIECES` (índice 0 es `null`).
- **Piezas**: matrices cuadradas en `PIECES`. Rotación = transposición + reverso (`rotateCW`); `tryRotate` aplica wall kicks probando desplazamientos `[0,-1,1,-2,2]`.
- **Colisiones**: `collide(shape, x, y)` valida límites y solapamiento; es la base de movimiento, rotación, `ghostY` y bloqueo.
- **Game loop**: `loop(ts)` con `requestAnimationFrame`; acumula `dt` y baja la pieza al superar `dropInterval`. `lockPiece` → `merge` → `clearLines` → `spawn`.
- **Puntuación/nivel**: `LINE_SCORES` × nivel; nivel sube cada 10 líneas y recalcula `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Render**: `draw()` pinta grid, tablero, ghost (alpha 0.2) y pieza actual en el canvas `#board`; `drawNext()` pinta la vista previa en `#next-canvas`.

## Restricciones al editar

- **Dimensiones acopladas**: si cambias `COLS`, `ROWS` o `BLOCK` en `game.js`, ajusta también `width`/`height` del `<canvas id="board">` en `index.html` (`COLS*BLOCK` × `ROWS*BLOCK`). Lo mismo aplica a `#next-canvas`.
- **IDs del DOM son un contrato**: `game.js` referencia por `getElementById` los nodos `board`, `next-canvas`, `score`, `lines`, `level`, `overlay`, `overlay-title`, `overlay-score`, `restart-btn`. Renombrarlos en el HTML rompe el juego sin error visible.
- **`PIECES` y `COLORS` van alineados por índice** (1–7); mantén la correspondencia si añades o reordenas piezas.
