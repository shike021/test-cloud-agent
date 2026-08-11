# Web Arcade · 纯前端小游戏合集

简体中文 · [English](./README_en.md) · [日本語](./README_jp.md)

一套零运行时依赖的纯前端小游戏合集：**游戏大厅 + 贪吃蛇 + 五子棋 + 2048**。规则被封装在可单元测试的核心模块里，桌面与移动端都能直接玩。

[![CI](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml)

## 快速开始

需要 Node.js 20.10 或更高版本（仅用于开发工具链，游戏本身不依赖 Node）。

```bash
git clone https://github.com/shike021/test-cloud-agent.git
cd test-cloud-agent
npm install
npm run dev            # 启动本地静态服务器
```

打开 <http://127.0.0.1:5173/> 进入游戏大厅。

> 源码使用原生 ES Modules，浏览器不允许通过 `file://` 加载模块，因此请用 `npm run dev`（或任意静态服务器）访问，不要直接双击 HTML 文件。

需要可分发的静态站点时执行 `npm run build`，产物在 `dist/`；`npm run preview` 可在本地预览该产物。

## 页面入口

| 路由       | 页面     | 说明                                     |
| ---------- | -------- | ---------------------------------------- |
| `/`        | 游戏大厅 | 卡片入口，展示本地保存的最高分与对局战绩 |
| `/snake/`  | 贪吃蛇   | 单人，键盘 / 屏幕方向键 / 滑动手势       |
| `/gomoku/` | 五子棋   | 15×15 双人同机，鼠标、触控或键盘光标落子 |
| `/2048/`   | 2048     | 单人 4×4 数字合成，键盘 / 方向键 / 滑动  |

在大厅按 <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> 可直接进入对应游戏。

## 游戏说明

### 贪吃蛇 · Snake

实时单人游戏，采用固定步长逻辑 + 帧间插值，移动是连续滑动而非逐格跳动，并适配高分屏。

**操作**

| 操作        | 键盘                               | 移动端                   |
| ----------- | ---------------------------------- | ------------------------ |
| 移动        | `↑` `↓` `←` `→` 或 `W` `A` `S` `D` | 屏幕方向键，或在棋盘滑动 |
| 开始 / 暂停 | `空格` / `P`                       | 「开始」按钮，或轻点棋盘 |
| 重新开始    | `R` / `Enter`                      | 「重新开始」按钮         |
| 开关音效    | `M`                                | 音效按钮                 |

**规则**

- 吃到红色果实得 **10 分**，蛇身增长一节。
- 每吃 5 个普通果实出现金色星星，得 **50 分**但不增加长度；星星有倒计时（外圈圆环），超时消失。
- 每累计 **60 分**提升一个等级、移动加速，直到达到当前难度的速度上限。
- 撞墙或咬到自己即游戏结束；开启「穿墙模式」后不会撞墙，只会因自咬结束。
- 蛇身填满整个棋盘即为通关。
- 蛇不能立即反向（向右时按「左」无效）；连续快速的按键会按顺序在后续帧生效，不会丢失操作。

难度提供轻松 / 标准 / 困难三档节奏，可单独开启「穿墙模式」。

### 五子棋 · Gomoku

双人同机对弈，15×15 交叉点、木纹底、星位与 A–O / 1–15 坐标（坐标可关闭）。只在落子、撤销、悬停或尺寸变化时按需重绘。

**操作**

| 操作     | 键盘                                          | 鼠标 / 移动端        |
| -------- | --------------------------------------------- | -------------------- |
| 移动光标 | 聚焦棋盘后 `↑` `↓` `←` `→` 或 `W` `A` `S` `D` | 鼠标悬停显示预览棋子 |
| 落子     | `Enter` / `空格`                              | 点击或轻点交叉点     |
| 新局     | `N`                                           | 「新局」按钮         |
| 撤销     | `U` / `Z`                                     | 「撤销」按钮         |
| 开关音效 | `M`                                           | 音效按钮             |

**规则**

- 黑白轮流在交叉点落子，先在横、竖或斜方向连成 **五子及以上**者获胜（无禁手，长连同样算胜）。
- 225 个交叉点全部落满且无人连成五子即为和棋。
- 红圈标记最后一手；获胜时连成的棋子会被金色高亮并画出连线。
- 撤销退回上一手；若撤销的是决胜手，本局战绩也会一并回退。
- 开启「交替先手」后，每开新局都会交换先手方，并记住下次开局的颜色。

黑胜 / 白胜 / 和棋数量与设置一起保存在本地，可一键清空。

### 2048

经典 4×4 数字合成。棋盘是 DOM 方块而非 Canvas：方块的行列坐标写入 CSS 变量，位移、合并与出现动画全部交给样式表完成，因此棋盘随容器自适应，渲染层不需要测量布局。

**操作**

| 操作     | 键盘                               | 鼠标 / 移动端            |
| -------- | ---------------------------------- | ------------------------ |
| 移动     | `↑` `↓` `←` `→` 或 `W` `A` `S` `D` | 屏幕方向键，或在棋盘滑动 |
| 新游戏   | `R`                                | 「新游戏」按钮           |
| 继续挑战 | `C` / `空格`                       | 「继续挑战」按钮         |

**规则**

- 每次移动会把所有方块推向同一方向；两个数字相同的方块相撞后合并为它们的和，并把这个和计入得分。
- 同一个方块在一次移动中只会合并一次：`2 2 2 2` 向左变成 `4 4`，`2 2 4` 向左变成 `4 4` 而不是 `8`；合并从移动方向的边缘开始结算，所以 `2 2 2` 向左是 `4 2`、向右是 `2 4`。
- 只有真正改变了棋盘的移动才会计入步数，并在空格中随机出现一个新方块（90% 是 **2**，10% 是 **4**）。
- 合成 **2048** 即为胜利，此时可以选择重新开始，或继续挑战 4096 及更大的方块。
- 棋盘填满且四个方向都无法移动时本局结束。

得分、最高分、最大方块与步数实时显示，最高分保存在本地并回显到大厅卡片上。

### 共同特性

- **状态持久化**：最高分、战绩、音效开关与偏好保存在 `localStorage`，在隐私模式等不可写场景下自动退化为内存存储；三款游戏使用各自命名空间（`snake-game` / `gomoku` / `game-2048`），互不干扰。
- **无障碍与体验**：语义化标签、`aria-live` 播报、键盘可聚焦控件、`prefers-reduced-motion` 支持、切换标签页自动暂停（贪吃蛇）、棋盘文字描述（2048）。
- **零运行时依赖**：仅使用原生 HTML / CSS / ES Modules 与 Canvas 2D、Web Audio。

## 项目结构

```
.
├── index.html                      # 游戏大厅
├── snake/index.html                # 贪吃蛇页面
├── gomoku/index.html               # 五子棋页面
├── 2048/index.html                 # 2048 页面
├── public/favicon.svg              # 站点图标
├── src/
│   ├── styles/
│   │   ├── base.css                # 设计变量、重置、通用组件（按钮/棋盘框/遮罩/方向键/设置项…）
│   │   ├── lobby.css               # 大厅卡片布局
│   │   ├── main.css                # 贪吃蛇页面布局
│   │   ├── gomoku.css              # 五子棋对局面板与结果卡片
│   │   └── game2048.css            # 2048 棋盘几何、方块配色与动画
│   └── js/
│       ├── main.js                 # 贪吃蛇入口：装配模块、固定步长循环、偏好持久化
│       ├── core/                   # 贪吃蛇纯逻辑，无浏览器 API，可在 Node 中测试
│       │   ├── constants.js        # 方向、状态、食物类型与默认参数
│       │   ├── rng.js              # 可播种的确定性随机数（mulberry32）
│       │   └── snake-game.js       # 全部游戏规则（移动/碰撞/生长/计分/等级/刷新食物）
│       ├── gomoku/
│       │   ├── constants.js        # 玩家、状态、坐标字母与默认参数
│       │   ├── gomoku-game.js      # 全部棋规（合法性/胜负/和棋/历史与撤销），无浏览器 API
│       │   ├── renderer.js         # Canvas 2D 棋盘、棋子、光标与胜线绘制
│       │   ├── hud.js              # 回合指示、战绩与结果卡片
│       │   └── main.js             # 五子棋入口：输入映射、持久化与按需重绘
│       ├── game2048/
│       │   ├── core/
│       │   │   ├── constants.js    # 方向、状态与默认参数（4×4、目标 2048）
│       │   │   └── game-2048.js    # 全部规则（滑动/单次合并/计分/生成/胜负），无浏览器 API
│       │   ├── ui/
│       │   │   ├── renderer.js     # DOM 方块池，按格坐标写入 CSS 变量
│       │   │   ├── input-controller.js # 键盘、方向键与滑动手势 → 移动
│       │   │   └── hud.js          # 计分板、结果卡片与棋盘文字描述
│       │   └── main.js             # 2048 入口：装配、最高分持久化
│       ├── lobby/main.js           # 大厅：读取本地进度、数字键快捷入口
│       ├── services/storage.js     # 带命名空间且容错的 localStorage 工厂
│       └── ui/                     # 贪吃蛇与共用的 UI 模块
│           ├── renderer.js         # Canvas 2D 渲染与帧间插值
│           ├── input-controller.js # 键盘、指针、触控手势 → 语义化动作
│           ├── hud.js              # 计分板、遮罩层与按钮状态
│           └── sound-player.js     # Web Audio 合成音效（无二进制资源，两款游戏共用）
├── scripts/
│   ├── dev-server.mjs              # 零依赖静态服务器（开发与预览）
│   ├── build.mjs                   # esbuild 多页打包 + 内容哈希 + 重写四个入口页
│   └── check-assets.mjs            # 四个入口页的静态资源引用完整性校验
├── tests/                          # Vitest 单元测试
├── task-manager/                   # 独立的全栈 Task Manager 工程（见下）
└── .github/workflows/              # CI 与 GitHub Pages 部署
```

### 架构要点

- **规则与表现分离**：`src/js/core/snake-game.js`、`src/js/gomoku/gomoku-game.js` 与 `src/js/game2048/core/game-2048.js` 都是不依赖任何浏览器 API 的类（贪吃蛇与 2048 的随机数通过构造参数注入），因此规则可以在 Node 中被确定性地测试；渲染、输入、音效、存储各自独立，入口 `main.js` 只负责装配与驱动，规则变更不会牵动渲染代码。
- **三种驱动方式**：贪吃蛇是实时游戏，用固定步长累加器按 `tickIntervalMs` 推进逻辑、每帧用 `alpha`（距下一次 tick 的进度）在前后状态间插值，因此不同刷新率的设备表现一致；五子棋只在输入后变化，没有动画循环，仅按需重绘一帧；2048 同样是回合制，但用 DOM 方块承载动画——核心为每个方块提供稳定 id 与「移动前的位置」，渲染层据此复用元素，滑动与合并动画交给 CSS 过渡。
- **样式分层**：`base.css` 提供设计变量与四页共用组件（按钮、棋盘框、遮罩、屏幕方向键等），页面样式表通过 `@import` 引入后只描述自身布局差异；构建时 esbuild 会内联 `@import`，最终每页只请求一个 CSS 文件。

## 开发脚本

| 命令                   | 说明                                                  |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | 启动本地静态服务器（默认 `127.0.0.1:5173`）           |
| `npm run build`        | 生产构建到 `dist/`（压缩、内容哈希、sourcemap）       |
| `npm run preview`      | 以静态服务器预览 `dist/`                              |
| `npm run lint`         | ESLint 检查（`npm run lint:fix` 自动修复）            |
| `npm run format:check` | Prettier 格式检查（`npm run format` 自动格式化）      |
| `npm run check:assets` | 校验四个入口页引用的本地资源是否存在且为相对路径      |
| `npm test`             | 运行 Vitest 单元测试（`npm run test:watch` 监听模式） |
| `npm run verify`       | 依次执行上面全部检查，等同于 CI 的核心步骤            |

`scripts/dev-server.mjs` 支持 `--root`、`--port`、`--host` 参数，例如 `node scripts/dev-server.mjs --root dist --port 4173`。

## 测试

测试位于 `tests/`，使用 Vitest（`npm test` 运行）：

- `snake-game.test.js`：初始布局、食物刷新（含 50 个随机种子下不与蛇重叠）、参数校验、生命周期、方向缓冲与反向拦截、撞墙 / 穿墙 / 自咬、「尾部同帧让位」的合法移动、计分、等级与速度上限、奖励食物的出现 / 计分 / 过期、填满棋盘的通关判定。
- `gomoku-game.test.js`：初始状态与参数校验、轮次交替与历史记录、越界与重复落子的拒绝、横 / 竖 / 两条斜线的胜负判定、补空成五、长连获胜、四子不算胜、异色不连、不跨越棋盘边界成线、和棋、终局后拒绝落子、撤销（含撤销决胜手后重新开局）与重置换先手。
- `game-2048.test.js`：初始布局与参数校验、注入随机数后的可复现性、四个方向的滑动与列合并、「一次移动只合并一次」与从边缘开始结算、无效移动不计步不生成方块、计分累计、达成 2048 的胜利判定与「继续挑战」、胜利只播报一次、棋盘填满且无相邻同数时结束、渲染层所需的方块 id / 移动前位置 / 合并来源等元数据，以及 `loadBoard` 的入参校验与快照的不可变性。
- `game-2048-ui.test.js`（jsdom）：渲染器生成背景格、方块的格坐标 / 数值 / 位数写入 DOM、滑动时复用同一个元素、合并方块滑入后被移除（下一次移动会立即清理）、重开后不残留旧元素；HUD 的计分板、棋盘文字描述、胜利与结束卡片；2048 输入控制器的按键、方向键与滑动映射。
- `input-controller.test.js`（jsdom）：方向键与 `WASD` 映射、命令键、修饰键忽略、屏幕方向键、滑动与轻点手势、`detach()` 后不再响应。
- `storage.test.js`：数值 / 布尔 / 字符串读写与白名单校验、命名空间隔离、损坏数据回退，以及 `localStorage` 抛异常或不可用时的内存降级。

## GitHub Actions

- **`ci.yml` — 持续集成**：在任意分支 push、所有 Pull Request 及手动触发时运行，在 Node 20 / 22 / 24 矩阵中依次执行 `npm ci`、ESLint、Prettier 检查、静态资源校验、Vitest 测试、生产构建，并逐页断言 `dist/` 下四个入口页及各自哈希后的 JS/CSS 均已生成、HTML 已正确改写，同时检查 `.nojekyll` 与 favicon，最后上传 `dist/` 工件（保留 7 天）。同一分支的新提交会自动取消未完成的旧运行。
- **`deploy-pages.yml` — 部署到 GitHub Pages**：在 `main` 分支 push 或手动触发时构建并发布 `dist/`。首次使用需在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**；启用前该 workflow 会失败，但与 CI 相互独立。由于资源引用均为相对路径，站点在 `https://<user>.github.io/<repo>/` 子路径下也能正常工作。
- **`dependabot.yml` — 依赖维护**：每周检查 npm 依赖与 GitHub Actions 版本更新，开发依赖的 minor/patch 更新会被合并到一个 PR 中。

## `task-manager/` 子工程

仓库同时保留了早期用于验证 Cloud Agent 开发环境的全栈 **Task Manager**（Express + SQLite + React），它已整理到 `task-manager/` 目录，是一个自带 `package.json`、`package-lock.json` 与 ESLint 配置的独立 npm 工程，与本合集的构建、Lint、测试互不影响（根目录的 ESLint 与 Prettier 均忽略该目录）。

```bash
cd task-manager
npm ci
npm run dev        # API :4000 + Web :5173
```

若同时运行游戏合集与 Task Manager 的 Web 端，请给其中一个换端口（例如 `npm run dev -- --port 5175`），两者默认都监听 `5173`。详细文档见 [`task-manager/README.md`](./task-manager/README.md)。

## 浏览器支持

面向支持 ES2022、Canvas 2D、`ResizeObserver`，以及 CSS `aspect-ratio`、容器查询单位（`cqw`）与独立变换属性（`translate` / `scale`）的现代浏览器（Chrome / Edge 111+、Firefox 113+、Safari 16.4+）。Web Audio 不可用时会自动静音而不报错。

## 许可

[MIT](./LICENSE)

## 声明

本仓库是用于测试 Cursor 代码管理安全性的**测试型项目**，与企业信息安全相关。仓库内的小游戏合集仅作为验证 Cursor 在代码托管、变更管理与协作流程中安全表现的示例载体，不代表任何正式产品或生产用途。
