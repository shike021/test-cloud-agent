# Web Arcade · A Collection of Browser Games

[简体中文](./README.md) · English · [日本語](./README_jp.md)

A collection of browser games with zero runtime dependencies: **Game Lobby + Snake + Gomoku + 2048**. The rules are encapsulated in unit-testable core modules, and the games are ready to play on both desktop and mobile devices.

[![CI](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml)

## Quick Start

Node.js 20.10 or later is required for the development toolchain only; the games themselves do not depend on Node.js.

```bash
git clone https://github.com/shike021/test-cloud-agent.git
cd test-cloud-agent
npm install
npm run dev            # Start the local static server
```

Open <http://127.0.0.1:5173/> to enter the game lobby.

> The source code uses native ES Modules. Because browsers do not allow modules to be loaded over `file://`, use `npm run dev` (or any static server) instead of opening the HTML files directly.

Run `npm run build` to create a distributable static site in `dist/`. Use `npm run preview` to preview the build locally.

## Page Routes

| Route      | Page       | Description                                                              |
| ---------- | ---------- | ------------------------------------------------------------------------ |
| `/`        | Game Lobby | Card-based navigation with locally saved high scores and match stats     |
| `/snake/`  | Snake      | Single-player; keyboard, on-screen directional pad, or swipe gestures    |
| `/gomoku/` | Gomoku     | Local two-player game on a 15×15 board; mouse, touch, or keyboard cursor |
| `/2048/`   | 2048       | Single-player 4×4 number merging; keyboard, directional pad, or swipes   |

Press <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> in the lobby to jump straight into a game.

## How to Play

### Snake

A real-time single-player game that combines fixed-timestep logic with inter-frame interpolation, producing smooth continuous movement instead of cell-by-cell jumps while also supporting high-density displays.

**Controls**

| Action        | Keyboard                           | Mobile                                        |
| ------------- | ---------------------------------- | --------------------------------------------- |
| Move          | `↑` `↓` `←` `→` or `W` `A` `S` `D` | On-screen directional pad, or swipe the board |
| Start / Pause | `Space` / `P`                      | Start button, or tap the board                |
| Restart       | `R` / `Enter`                      | Restart button                                |
| Toggle sound  | `M`                                | Sound button                                  |

**Rules**

- Eating a red fruit awards **10 points** and grows the snake by one segment.
- A golden star appears after every five regular fruits. It awards **50 points** without increasing the snake's length. The star has a countdown shown by its outer ring and disappears when time runs out.
- The level increases after every **60 accumulated points**, speeding up movement until the speed limit for the selected difficulty is reached.
- Hitting a wall or biting the snake's own body ends the game. With Wrap-Around Mode enabled, walls are safe and only self-collisions end the game.
- Filling the entire board with the snake completes the game.
- The snake cannot reverse direction immediately (for example, pressing Left while moving right has no effect). Rapid consecutive inputs are buffered and applied in order on subsequent frames rather than being dropped.

Three pace settings are available—Easy, Normal, and Hard—and Wrap-Around Mode can be enabled independently.

### Gomoku

A local two-player game with a 15×15 grid of intersections, a wood-grain board, star points, and A–O / 1–15 coordinates (which can be hidden). The canvas is redrawn on demand only when a stone is placed or undone, the pointer hovers over the board, or the board is resized.

**Controls**

| Action       | Keyboard                                                     | Mouse / Mobile               |
| ------------ | ------------------------------------------------------------ | ---------------------------- |
| Move cursor  | Focus the board, then use `↑` `↓` `←` `→` or `W` `A` `S` `D` | Hover to preview a stone     |
| Place stone  | `Enter` / `Space`                                            | Click or tap an intersection |
| New game     | `N`                                                          | New Game button              |
| Undo         | `U` / `Z`                                                    | Undo button                  |
| Toggle sound | `M`                                                          | Sound button                 |

**Rules**

- Black and White alternate placing stones on intersections. The first player to form a horizontal, vertical, or diagonal line of **five or more stones** wins. There are no forbidden moves, and overlines also count as wins.
- The game is a draw if all 225 intersections are occupied without either player forming a line of five.
- A red ring marks the latest move. On a win, the winning stones are highlighted in gold and connected by a line.
- Undo removes the previous move. If the winning move is undone, the match record is rolled back as well.
- When Alternate First Player is enabled, each new game swaps the starting player and remembers the color that should start next.

Black wins, White wins, draws, and settings are saved locally and can all be cleared with one action.

### 2048

The classic 4×4 number-merging game. The board is built from DOM tiles rather than a canvas: a tile's cell coordinates are written to CSS custom properties, and the stylesheet handles the slide, merge, and appear animations. The board therefore scales with its container and the renderer never has to measure the layout.

**Controls**

| Action     | Keyboard                           | Mouse / Mobile                                |
| ---------- | ---------------------------------- | --------------------------------------------- |
| Move       | `↑` `↓` `←` `→` or `W` `A` `S` `D` | On-screen directional pad, or swipe the board |
| New game   | `R`                                | New Game button                               |
| Keep going | `C` / `Space`                      | Keep Going button                             |

**Rules**

- Every move pushes all tiles towards the same edge. Two tiles with the same number merge into their sum, and that sum is added to the score.
- A tile merges at most once per move: `2 2 2 2` moved left becomes `4 4`, and `2 2 4` becomes `4 4` rather than `8`. Merges resolve from the edge the tiles move towards, so `2 2 2` becomes `4 2` to the left and `2 4` to the right.
- Only a move that actually changes the board counts and spawns a new tile on a free cell (**2** with 90% probability, **4** with 10%).
- Reaching **2048** wins the run. You can then start over or keep going for 4096 and beyond.
- The run ends once the board is full and none of the four directions can move a tile.

Score, best score, largest tile, and move count are shown live; the best score is stored locally and mirrored on the lobby card.

### Shared Features

- **Persistent state**: High scores, match records, sound settings, and preferences are stored in `localStorage`. If storage is unavailable or unwritable, such as in some private-browsing contexts, the app automatically falls back to in-memory storage. Each game uses its own namespace (`snake-game` / `gomoku` / `game-2048`) so their data does not interfere.
- **Accessibility and usability**: Semantic markup, `aria-live` announcements, keyboard-focusable controls, support for `prefers-reduced-motion`, automatic pause when switching tabs (Snake), and a textual board description (2048).
- **Zero runtime dependencies**: Built solely with native HTML, CSS, ES Modules, Canvas 2D, and Web Audio.

## Project Structure

```
.
├── index.html                      # Game lobby
├── snake/index.html                # Snake page
├── gomoku/index.html               # Gomoku page
├── 2048/index.html                 # 2048 page
├── public/favicon.svg              # Site icon
├── src/
│   ├── styles/
│   │   ├── base.css                # Design tokens, reset, and shared components (buttons/board frame/overlay/directional pad/settings...)
│   │   ├── lobby.css               # Lobby card layout
│   │   ├── main.css                # Snake page layout
│   │   ├── gomoku.css              # Gomoku match panel and result card
│   │   └── game2048.css            # 2048 board geometry, tile palette, and animations
│   └── js/
│       ├── main.js                 # Snake entry point: module assembly, fixed-timestep loop, and preference persistence
│       ├── core/                   # Pure Snake logic with no browser APIs; testable in Node.js
│       │   ├── constants.js        # Directions, states, food types, and default parameters
│       │   ├── rng.js              # Seedable deterministic random number generator (mulberry32)
│       │   └── snake-game.js       # All game rules (movement/collision/growth/scoring/levels/food spawning)
│       ├── gomoku/
│       │   ├── constants.js        # Players, states, coordinate letters, and default parameters
│       │   ├── gomoku-game.js      # All rules (legality/wins/draws/history/undo), with no browser APIs
│       │   ├── renderer.js         # Canvas 2D board, stones, cursor, and winning-line rendering
│       │   ├── hud.js              # Turn indicator, match records, and result card
│       │   └── main.js             # Gomoku entry point: input mapping, persistence, and on-demand rendering
│       ├── game2048/
│       │   ├── core/
│       │   │   ├── constants.js    # Directions, states, and default parameters (4×4, 2048 target)
│       │   │   └── game-2048.js    # All rules (sliding/single merge/scoring/spawning/win and loss), with no browser APIs
│       │   ├── ui/
│       │   │   ├── renderer.js     # Pooled DOM tiles positioned through CSS custom properties
│       │   │   ├── input-controller.js # Keyboard, directional pad, and swipe gestures → moves
│       │   │   └── hud.js          # Scoreboard, result card, and textual board description
│       │   └── main.js             # 2048 entry point: assembly and best-score persistence
│       ├── lobby/main.js           # Lobby: reads local progress and provides number-key shortcuts
│       ├── services/storage.js     # Namespaced, fault-tolerant localStorage factory
│       └── ui/                     # Snake and shared UI modules
│           ├── renderer.js         # Canvas 2D rendering and inter-frame interpolation
│           ├── input-controller.js # Keyboard, pointer, and touch gestures → semantic actions
│           ├── hud.js              # Scoreboard, overlays, and button states
│           └── sound-player.js     # Synthesized Web Audio effects (no binary assets; shared by both games)
├── scripts/
│   ├── dev-server.mjs              # Zero-dependency static server for development and previews
│   ├── build.mjs                   # esbuild multi-page bundle, content hashes, and rewriting of all four entry pages
│   └── check-assets.mjs            # Static asset reference validation for all four entry pages
├── tests/                          # Vitest unit tests
├── task-manager/                   # Standalone full-stack Task Manager project (see below)
└── .github/workflows/              # CI and GitHub Pages deployment
```

### Architecture Highlights

- **Rules separated from presentation**: `src/js/core/snake-game.js`, `src/js/gomoku/gomoku-game.js`, and `src/js/game2048/core/game-2048.js` are classes with no browser API dependencies (Snake and 2048 receive their random number generator through the constructor), allowing deterministic rule testing in Node.js. Rendering, input, sound, and storage are independent, while each `main.js` entry point only assembles and drives the modules, so rule changes do not affect rendering code.
- **Three update models**: Snake is a real-time game. A fixed-timestep accumulator advances its logic according to `tickIntervalMs`, while each frame uses `alpha` (progress toward the next tick) to interpolate between the previous and current states, providing consistent behavior across devices with different refresh rates. Gomoku changes only after input, has no animation loop, and redraws a single frame on demand. 2048 is turn-based as well, but animates through DOM tiles: the core gives every tile a stable id and the position it held before the move, which lets the renderer reuse elements and leave the slide and merge animations to CSS transitions.
- **Layered styles**: `base.css` provides design tokens and components shared by all four pages (buttons, board frame, overlay, on-screen directional pad, and more). Each page stylesheet imports it with `@import` and defines only its own layout differences. During the build, esbuild inlines the imports so each page requests only one CSS file.

## Development Scripts

| Command                | Description                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`          | Start the local static server (default: `127.0.0.1:5173`)                                |
| `npm run build`        | Create a production build in `dist/` (minified, content-hashed, with sourcemaps)         |
| `npm run preview`      | Preview `dist/` with the static server                                                   |
| `npm run lint`         | Run ESLint (`npm run lint:fix` applies automatic fixes)                                  |
| `npm run format:check` | Check formatting with Prettier (`npm run format` applies formatting)                     |
| `npm run check:assets` | Verify that local assets referenced by the four entry pages exist and use relative paths |
| `npm test`             | Run Vitest unit tests (`npm run test:watch` starts watch mode)                           |
| `npm run verify`       | Run all checks above in sequence; equivalent to the core CI steps                        |

`scripts/dev-server.mjs` supports the `--root`, `--port`, and `--host` options. For example: `node scripts/dev-server.mjs --root dist --port 4173`.

## Tests

Tests are located in `tests/` and use Vitest (run them with `npm test`):

- `snake-game.test.js`: Initial layout; food spawning, including checks across 50 random seeds that food never overlaps the snake; parameter validation; lifecycle; direction buffering and reverse-direction prevention; wall collisions, wrap-around, and self-collisions; legal movement into a tail cell vacated during the same frame; scoring; levels and speed limits; bonus-food appearance, scoring, and expiration; and completion when the snake fills the board.
- `gomoku-game.test.js`: Initial state and parameter validation; alternating turns and move history; rejection of out-of-bounds and duplicate moves; horizontal, vertical, and both diagonal win detection; completing a gapped line of five; overline wins; four stones not counting as a win; differently colored stones not connecting; lines not continuing across board boundaries; draws; rejecting moves after the game ends; undo, including starting again after undoing a winning move; and resetting with a different starting player.
- `game-2048.test.js`: Initial layout and parameter validation; reproducible runs with an injected random source; sliding and merging in all four directions; the "one merge per tile per move" rule and resolution from the leading edge; moves that change nothing counting neither as a move nor spawning a tile; cumulative scoring; the 2048 win condition and "keep going"; the win being reported only once; the run ending when the board is full without equal neighbours; the tile metadata a renderer needs (ids, previous positions, merge sources); and `loadBoard` validation together with the immutability of the exposed snapshots.
- `game-2048-ui.test.js` (jsdom): The renderer building the background cells, writing a tile's cell, value, and digit count into the DOM, reusing the same element while a tile slides, sliding consumed tiles into the merge before dropping them (and dropping them immediately on the next move), and leaving no stale elements after a restart; the HUD scoreboard, textual board description, and win/game-over cards; and the 2048 input controller's key, pad, and swipe mapping.
- `input-controller.test.js` (jsdom): Arrow-key and `WASD` mapping, command keys, ignoring modified key combinations, on-screen directional controls, swipe and tap gestures, and no response after `detach()`.
- `storage.test.js`: Number, Boolean, and string reads and writes; allowlist validation; namespace isolation; fallback for corrupted data; and in-memory fallback when `localStorage` throws or is unavailable.

## GitHub Actions

- **`ci.yml` — Continuous Integration**: Runs on pushes to any branch, every pull request, and manual dispatch. Across a Node.js 20 / 22 / 24 matrix, it runs `npm ci`, ESLint, Prettier checks, static asset validation, Vitest tests, and the production build. It then verifies, page by page, that all four entry pages and their content-hashed JS/CSS files exist in `dist/`, that the HTML was rewritten correctly, and that `.nojekyll` and the favicon are present, before uploading the `dist/` artifact with a seven-day retention period. New commits to the same branch automatically cancel incomplete older runs.
- **`deploy-pages.yml` — Deploy to GitHub Pages**: Builds and publishes `dist/` on pushes to `main` or manual dispatch. Before first use, select **GitHub Actions** under **Settings → Pages → Build and deployment → Source**. The workflow fails until this is enabled, but remains independent of CI. Because all asset references are relative, the site also works under a `https://<user>.github.io/<repo>/` subpath.
- **`dependabot.yml` — Dependency Maintenance**: Checks npm dependencies and GitHub Actions versions weekly. Minor and patch updates to development dependencies are grouped into a single pull request.

## The `task-manager/` Subproject

The repository also retains an earlier full-stack **Task Manager** (Express + SQLite + React) used to validate the Cloud Agent development environment. It has been organized under `task-manager/` as an independent npm project with its own `package.json`, `package-lock.json`, and ESLint configuration. It does not affect the arcade's build, linting, or tests; the root ESLint and Prettier configurations both ignore this directory.

```bash
cd task-manager
npm ci
npm run dev        # API :4000 + Web :5173
```

If you run the arcade and the Task Manager web app at the same time, change the port for one of them—for example, `npm run dev -- --port 5175`—because both listen on `5173` by default. See [`task-manager/README.md`](./task-manager/README.md) for full documentation.

## Browser Support

Designed for modern browsers that support ES2022, Canvas 2D, `ResizeObserver`, and the CSS `aspect-ratio` property, container query units (`cqw`), and the individual transform properties (`translate` / `scale`): Chrome / Edge 111+, Firefox 113+, and Safari 16.4+. If Web Audio is unavailable, sound is disabled automatically without raising an error.

## License

[MIT](./LICENSE)

## Notice

This repository is a **test project** used to evaluate the security of Cursor's code management capabilities and is related to enterprise information security. The browser game collection serves only as an example vehicle for verifying Cursor's security behavior in code hosting, change management, and collaboration workflows. It does not represent any official product and is not intended for production use.
