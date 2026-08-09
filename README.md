# 贪吃蛇 · Snake

一个生产级质量的纯前端贪吃蛇游戏：没有任何运行时第三方依赖，桌面与移动端都可正常使用，游戏规则被完整封装在可单元测试的核心模块中。

[![CI](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/ci.yml)
[![Deploy to GitHub Pages](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/shike021/test-cloud-agent/actions/workflows/deploy-pages.yml)

## 特性

- **多种操控方式**：键盘方向键、`WASD`、屏幕方向键、棋盘滑动手势（移动端）。
- **完整游戏流程**：开始 / 暂停 / 继续 / 重新开始、计分、等级提速、撞墙与自咬判定、填满棋盘的通关状态。
- **输入缓冲**：连续快速按键（例如"上"紧接"左"）会按顺序在后续帧生效，不会因为同一帧内的多次输入而丢失操作。
- **奖励机制**：普通果实 +10 分并使蛇变长；每吃 5 个普通果实出现限时金色星星，+50 分但不增加长度。
- **可调难度**：轻松 / 标准 / 困难三档节奏，另可开启「穿墙模式」（边界穿越而非死亡）。
- **平滑渲染**：固定步长逻辑 + 帧间插值，蛇的移动是连续滑动而不是逐格跳动；支持高分屏（devicePixelRatio）。
- **状态持久化**：最高分、音效开关、难度与穿墙模式保存在 `localStorage`，并在隐私模式等不可写场景下自动退化为内存存储。
- **无障碍与体验**：语义化标签、`aria-live` 播报、键盘可聚焦控件、`prefers-reduced-motion` 支持、切换标签页自动暂停。
- **零运行时依赖**：仅使用原生 HTML / CSS / ES Modules 与 Canvas 2D、Web Audio。

## 快速开始

需要 Node.js 20.10 或更高版本（仅用于开发工具链，游戏本身不依赖 Node）。

```bash
git clone https://github.com/shike021/test-cloud-agent.git
cd test-cloud-agent
npm install
npm run dev
```

然后打开 <http://127.0.0.1:5173/> 即可开始游戏。

> 说明：源码使用原生 ES Modules，浏览器不允许通过 `file://` 协议加载模块，因此请使用 `npm run dev`（或任意静态服务器，例如 `python3 -m http.server`）访问，不要直接双击 `index.html`。
>
> 如果需要一个可以直接分发的静态站点，执行 `npm run build`，产物在 `dist/` 目录（已打包为单个 JS/CSS 文件，可部署到任意静态托管）。

预览构建产物：

```bash
npm run build
npm run preview   # http://127.0.0.1:5173/ ，服务 dist/ 目录
```

## 玩法

| 操作        | 键盘                               | 移动端                   |
| ----------- | ---------------------------------- | ------------------------ |
| 移动        | `↑` `↓` `←` `→` 或 `W` `A` `S` `D` | 屏幕方向键，或在棋盘滑动 |
| 开始 / 暂停 | `空格` / `P`                       | 「开始」按钮，或轻点棋盘 |
| 重新开始    | `R` / `Enter`                      | 「重新开始」按钮         |
| 开关音效    | `M`                                | 音效按钮                 |

规则：

- 吃到红色果实得 **10 分**，蛇身增长一节。
- 每吃 5 个普通果实会出现金色星星，得 **50 分**，但不增加长度；星星有倒计时（外圈圆环），超时消失。
- 每累计 **60 分**提升一个等级，蛇的移动速度随之加快，直到达到该难度的速度上限。
- 撞到墙壁或咬到自己即游戏结束；开启「穿墙模式」后不会撞墙，只会因自咬结束。
- 蛇身填满整个棋盘即为通关。
- 蛇不能立即反向（例如向右移动时按「左」无效），这是贪吃蛇的标准规则。

## 项目结构

```
.
├── index.html                     # 页面骨架与所有可见文案
├── public/favicon.svg             # 站点图标
├── src/
│   ├── styles/main.css            # 主题、响应式布局、组件样式
│   └── js/
│       ├── main.js                # 入口：装配各模块、固定步长游戏循环、偏好持久化
│       ├── core/                  # 纯逻辑，无浏览器 API，可在 Node 中测试
│       │   ├── constants.js       # 方向、状态、食物类型与默认参数
│       │   ├── rng.js             # 可播种的确定性随机数（mulberry32）
│       │   └── snake-game.js      # 全部游戏规则（移动/碰撞/生长/计分/等级/刷新食物）
│       ├── services/storage.js    # 带命名空间且容错的 localStorage 封装
│       └── ui/
│           ├── renderer.js        # Canvas 2D 渲染与帧间插值
│           ├── input-controller.js# 键盘、指针、触控手势 → 语义化动作
│           ├── hud.js             # 计分板、遮罩层与按钮状态
│           └── sound-player.js    # Web Audio 合成音效（无二进制资源）
├── scripts/
│   ├── dev-server.mjs             # 零依赖静态服务器（开发与预览）
│   ├── build.mjs                  # esbuild 打包 + 内容哈希 + 重写 index.html
│   └── check-assets.mjs           # 静态资源引用完整性校验
├── tests/                         # Vitest 单元测试
└── .github/workflows/             # CI 与 GitHub Pages 部署
```

### 架构要点

`src/js/core/snake-game.js` 是一个不依赖任何浏览器 API 的类，随机数通过构造参数注入，因此游戏规则可以在 Node 环境中被确定性地测试；渲染、输入、音效、存储各自独立，`main.js` 只负责装配与驱动循环。这样的分层让规则变更不会牵动渲染代码，反之亦然。

游戏循环采用固定步长累加器：逻辑按 `tickIntervalMs` 推进，渲染每帧执行并用 `alpha`（距下一次 tick 的进度）在上一状态与当前状态之间插值，因此不同刷新率的设备表现一致。

## 开发脚本

| 命令                   | 说明                                                  |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | 启动本地静态服务器（默认 `127.0.0.1:5173`）           |
| `npm run build`        | 生产构建到 `dist/`（压缩、内容哈希、sourcemap）       |
| `npm run preview`      | 以静态服务器预览 `dist/`                              |
| `npm run lint`         | ESLint 检查（`npm run lint:fix` 自动修复）            |
| `npm run format:check` | Prettier 格式检查（`npm run format` 自动格式化）      |
| `npm run check:assets` | 校验 HTML/CSS/JS 中引用的本地资源是否存在且为相对路径 |
| `npm test`             | 运行 Vitest 单元测试（`npm run test:watch` 监听模式） |
| `npm run verify`       | 依次执行上面全部检查，等同于 CI 的核心步骤            |

`scripts/dev-server.mjs` 支持 `--root`、`--port`、`--host` 参数，例如 `node scripts/dev-server.mjs --root dist --port 4173`。

## 测试

测试位于 `tests/`，使用 Vitest：

- `snake-game.test.js`：初始布局、食物刷新（含 50 个随机种子下不与蛇重叠）、参数校验、生命周期、方向缓冲与反向拦截、撞墙 / 穿墙 / 自咬、"尾部同帧让位"的合法移动、计分、等级与速度上限、奖励食物的出现 / 计分 / 过期、填满棋盘的通关判定。
- `input-controller.test.js`（jsdom）：方向键与 `WASD` 映射、命令键、修饰键忽略、屏幕方向键、滑动与轻点手势、`detach()` 后不再响应。
- `storage.test.js`：数值 / 布尔 / 字符串读写与白名单校验、损坏数据回退，以及 `localStorage` 抛异常或不可用时的内存降级。

```bash
npm test
```

## GitHub Actions

### `ci.yml` — 持续集成

在 **任意分支的 push** 与 **所有 Pull Request** 上运行（也可手动触发），在 Node 20 / 22 / 24 三个版本的矩阵中执行：

1. `npm ci` 按 lockfile 安装依赖；
2. ESLint 检查；
3. Prettier 格式检查；
4. 静态资源引用校验（源码目录）；
5. Vitest 单元测试；
6. 生产构建；
7. 构建产物的资源引用校验，并断言 `dist/index.html`、`.nojekyll`、favicon、哈希后的 JS/CSS 均已生成且 HTML 已正确改写；
8. 上传 `dist/` 作为构建工件（保留 7 天），方便在 PR 上直接下载验证。

同一分支的新提交会自动取消尚未完成的旧运行（`concurrency`），避免排队浪费。

### `deploy-pages.yml` — 部署到 GitHub Pages

在 `main` 分支 push 时（或手动触发）构建并发布 `dist/` 到 GitHub Pages。首次使用需在仓库中启用：

**Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

启用前该 workflow 会失败，但它与 CI 相互独立，不会影响 CI 状态。由于所有资源引用都是相对路径，站点在 `https://<user>.github.io/<repo>/` 这样的子路径下也能正常工作。

### `dependabot.yml` — 依赖维护

每周检查 npm 依赖与 GitHub Actions 版本更新，开发依赖的 minor/patch 更新会被合并到一个 PR 中。

## 浏览器支持

面向支持 ES2022、Canvas 2D、`ResizeObserver` 与 CSS `aspect-ratio` 的现代浏览器（Chrome / Edge 111+、Firefox 113+、Safari 16.4+）。Web Audio 不可用时会自动静音而不报错。

## 许可

[MIT](./LICENSE)
