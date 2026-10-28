# UI 阶段 0：现状盘点

日期：2026-10-28（Asia/Shanghai）。盘点基线：`main@7378acd8f0cf59aa4f4ff69e33be04ef941c1993`。开始时 git status 干净。只新增本报告；不修改业务、样式、依赖、数据库结构或功能开关，不调用付费模型。本文记录当前问题，不代表阶段 1–3 已实施。

## 1. CSS 文件、引入链与覆盖

根布局 `src/app/layout.tsx:2` 首先引入 `globals.css`（502 行）。`src/app/(creative)/layout.tsx:3` 引入 React Flow 的 `@xyflow/react/dist/style.css`，随后按下表顺序引入全部 8 个项目 CSS。`/`、`/skus`、`/workspace`、`/library` 共用这条链；没有 page 再单独引入其他 CSS。旧 `(studio)` 页面继承 globals，不加载这 8 个文件。

统计方法：PostCSS 解析声明，拆分逗号选择器；按“相同选择器 + 完全相同的媒体等条件 + 相同属性”判断后文件的重复声明，并尊重 `!important`。数字是每个源文件内去重的选择器数，不是声明条数。相同值重复声明也算重声明。仅计算被**后面的文件**覆盖，不统计文件内部覆盖。
不同选择器的匹配关系、不同但有交集的媒体条件、简写与长写、继承、Tailwind、内联样式不包含在该数量中。因此这是可静态确认的下界，不能据此直接认定“死规则”并删除。

| 顺序 | 文件（均在 src/app/(creative)/） | 行数 | UTF-8 字节 | 唯一选择器 | 后文件同选择器 | 其中同属性被覆盖 | 全部声明被后文件重声明的候选 | 引入点 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `preview.css` | 241 | 26311 | 236 | 83 | 65 | 17 | `layout.tsx:4` |
| 2 | `round3.css` | 209 | 20045 | 212 | 15 | 9 | 6 | `layout.tsx:5` |
| 3 | `task8.css` | 112 | 20752 | 243 | 6 | 3 | 1 | `layout.tsx:6` |
| 4 | `round4.css` | 41 | 3491 | 40 | 0 | 0 | 0 | `layout.tsx:7` |
| 5 | `task9.css` | 20 | 13383 | 150 | 13 | 12 | 1 | `layout.tsx:8` |
| 6 | `task9-round1.css` | 31 | 11403 | 135 | 0 | 0 | 0 | `layout.tsx:9` |
| 7 | `task10.css` | 6 | 1481 | 16 | 0 | 0 | 0 | `layout.tsx:10` |
| 8 | `task11.css` | 59 | 8309 | 84 | 0 | 0 | 0 | `layout.tsx:11` |

合计：719 行、105175 字节。src 内共 9 个 CSS 文件，除上述 8 个外即 globals.css。行数按物理行统计，当前很多规则压在同一行，不能按行数估算复杂度。

### 典型覆盖（30 例以内）

| 选择器 / 条件 | 先声明 | 后续同选择器 | 被重声明的属性 |
| --- | --- | --- | --- |
| `.p-app` | `src/app/(creative)/preview.css:24` | `src/app/(creative)/round3.css:2`、`src/app/(creative)/task8.css:2` | `font-family`、`font-size` |
| `.p-portal` | `src/app/(creative)/preview.css:24` | `src/app/(creative)/round3.css:2` | `font-family`、`font-size` |
| `.p-app h1` | `src/app/(creative)/preview.css:27` | `src/app/(creative)/round3.css:3` | `font-size`、`font-weight` |
| `.p-app h2` | `src/app/(creative)/preview.css:27` | `src/app/(creative)/round3.css:4` | `font-size`、`font-weight` |
| `.p-app h3` | `src/app/(creative)/preview.css:27` | `src/app/(creative)/round3.css:4` | `font-size`、`font-weight` |
| `.p-topbar` | `src/app/(creative)/preview.css:33` | `src/app/(creative)/round3.css:10` | `background` |
| `.p-logo` | `src/app/(creative)/preview.css:34` | `src/app/(creative)/round3.css:11` | `font-size` |
| `.p-logo svg` | `src/app/(creative)/preview.css:35` | `src/app/(creative)/round3.css:12` | `width`、`height` |
| `.p-topbar-end` | `src/app/(creative)/preview.css:39` | `src/app/(creative)/round3.css:13` | `gap` |
| `.p-avatar` | `src/app/(creative)/preview.css:42` | `src/app/(creative)/round3.css:14` | `background` |
| `.p-home` | `src/app/(creative)/preview.css:48` | `src/app/(creative)/round3.css:18` | `max-width`、`padding` |
| `.p-home-heading` | `src/app/(creative)/preview.css:49` | `src/app/(creative)/round3.css:24` | `margin-bottom` |
| `.p-home-heading h1` | `src/app/(creative)/preview.css:50` | `src/app/(creative)/round3.css:27` | `font-size`、`letter-spacing`、`margin`、`font-weight` |
| `.p-home-input` | `src/app/(creative)/preview.css:52` | `src/app/(creative)/round3.css:33`、`src/app/(creative)/round4.css:3` | `max-width`、`background`、`border-radius`、`padding`、`box-shadow` |
| `.p-home-input textarea` | `src/app/(creative)/preview.css:53` | `src/app/(creative)/round3.css:37` | `min-height`、`padding` |
| `.p-app` | `src/app/(creative)/round3.css:2` | `src/app/(creative)/task8.css:2` | `font-variant-numeric` |
| `.p-composer-toolbar` | `src/app/(creative)/round3.css:68` | `src/app/(creative)/task9-round1.css:22` | `gap` |
| `.p-composer-toolbar [data-slot=button].p-send-circle` | `src/app/(creative)/round3.css:77` | `src/app/(creative)/round4.css:14` | `background`、`color` |
| `.dark .p-composer-toolbar [data-slot=button].p-send-circle` | `src/app/(creative)/round3.css:78` | `src/app/(creative)/round4.css:15` | `background`、`color` |
| `.p-composer-toolbar.is-compact .p-model-capsule` | `src/app/(creative)/round3.css:81` | `src/app/(creative)/task9-round1.css:22` | `max-width` |
| `.l-mode-panel` | `src/app/(creative)/task8.css:7` | `src/app/(creative)/round4.css:35` | `width`、`padding` |
| `.l-mode-panel>button` | `src/app/(creative)/task8.css:8` | `src/app/(creative)/round4.css:37` | `height` |
| `.l-mode-panel small` | `src/app/(creative)/task8.css:9` | `src/app/(creative)/round4.css:40` | `font-size` |
| `.w-task-entries` | `src/app/(creative)/task9.css:11` | `src/app/(creative)/task9-round1.css:21` | `gap`、`margin-top` |
| `.w-task-entries button` | `src/app/(creative)/task9.css:11` | `src/app/(creative)/task9-round1.css:21` | `gap`、`padding` |
| `.w-card` | `src/app/(creative)/task9.css:11` | `src/app/(creative)/task9-round1.css:21` | `padding`、`margin` |
| `.w-card>p` | `src/app/(creative)/task9.css:11` | `src/app/(creative)/task9-round1.css:23` | `margin` |
| `.w-card-heading` | `src/app/(creative)/task9.css:11` | `src/app/(creative)/task9-round1.css:21` | `margin-bottom` |

额外的实际层叠例子：`.p-chat` 从 `preview.css:92` 的 380px，经 `round3.css:123` 的 440px，变为 `task9-round1.css:21` 的 600px；同文件第 31 行的 min-width:1201px 再变为 640px。中屏第 26 行为 560px、窄屏第 27 行为 min(600px,100vw)。这些跨媒体/文件内部覆盖不全计入上表。

## 2. globals.css：主题、纸色与强制规则

### 2.1 三个变量声明块

实际不是互不干扰的两套主题：`globals.css:79` 有标准亮色 `:root`，`:115` 有标准暗色 `.dark`，`:161` 又有一套旧纸色 `:root`。后者与 `.dark` 优先级相同，覆盖重叠变量；`html.dark` 下仍会拿到纸色背景/主色等。未被旧块覆盖的 chart/sidebar 等变量仍来自前面的对应主题。

| 变量 | 标准亮色 :79 | 标准暗色 :115 | 旧纸色覆盖 :161 |
| --- | --- | --- | --- |
| `--font-body` | `"Microsoft YaHei UI", "PingFang SC", "Microsoft YaHei", sans-serif`（80） | — | — |
| `--background` | `oklch(1 0 0)`（81） | `oklch(0.145 0 0)`（116） | `#f6f5f1`（162） |
| `--foreground` | `oklch(0.145 0 0)`（82） | `oklch(0.985 0 0)`（117） | `#292b27`（163） |
| `--card` | `oklch(1 0 0)`（83） | `oklch(0.205 0 0)`（118） | `#fffefa`（164） |
| `--card-foreground` | `oklch(0.145 0 0)`（84） | `oklch(0.985 0 0)`（119） | `#292b27`（165） |
| `--popover` | `oklch(1 0 0)`（85） | `oklch(0.205 0 0)`（120） | `#fffefa`（166） |
| `--popover-foreground` | `oklch(0.145 0 0)`（86） | `oklch(0.985 0 0)`（121） | `#292b27`（167） |
| `--primary` | `oklch(0.205 0 0)`（87） | `oklch(0.922 0 0)`（122） | `#3b493d`（168） |
| `--primary-foreground` | `oklch(0.985 0 0)`（88） | `oklch(0.205 0 0)`（123） | `#fffefa`（169） |
| `--secondary` | `oklch(0.97 0 0)`（89） | `oklch(0.269 0 0)`（124） | `#eeeee7`（170） |
| `--secondary-foreground` | `oklch(0.205 0 0)`（90） | `oklch(0.985 0 0)`（125） | `#484e42`（171） |
| `--muted` | `oklch(0.97 0 0)`（91） | `oklch(0.269 0 0)`（126） | `#efeee8`（172） |
| `--muted-foreground` | `oklch(0.556 0 0)`（92） | `oklch(0.708 0 0)`（127） | `#7a7c72`（173） |
| `--accent` | `oklch(0.97 0 0)`（93） | `oklch(0.269 0 0)`（128） | `#e9ece4`（174） |
| `--accent-foreground` | `oklch(0.205 0 0)`（94） | `oklch(0.985 0 0)`（129） | `#3b493d`（175） |
| `--destructive` | `oklch(0.577 0.245 27.325)`（95） | `oklch(0.704 0.191 22.216)`（130） | `#b44932`（176） |
| `--border` | `oklch(0.922 0 0)`（96） | `oklch(1 0 0 / 10%)`（131） | `#e0e1d8`（177） |
| `--input` | `oklch(0.922 0 0)`（97） | `oklch(1 0 0 / 15%)`（132） | `#dedfd5`（178） |
| `--ring` | `oklch(0.708 0 0)`（98） | `oklch(0.556 0 0)`（133） | `#839678`（179） |
| `--chart-1` | `oklch(0.87 0 0)`（99） | `oklch(0.87 0 0)`（134） | — |
| `--chart-2` | `oklch(0.556 0 0)`（100） | `oklch(0.556 0 0)`（135） | — |
| `--chart-3` | `oklch(0.439 0 0)`（101） | `oklch(0.439 0 0)`（136） | — |
| `--chart-4` | `oklch(0.371 0 0)`（102） | `oklch(0.371 0 0)`（137） | — |
| `--chart-5` | `oklch(0.269 0 0)`（103） | `oklch(0.269 0 0)`（138） | — |
| `--radius` | `0.625rem`（104） | — | `.6rem`（180） |
| `--sidebar` | `oklch(0.985 0 0)`（105） | `oklch(0.205 0 0)`（139） | — |
| `--sidebar-foreground` | `oklch(0.145 0 0)`（106） | `oklch(0.985 0 0)`（140） | — |
| `--sidebar-primary` | `oklch(0.205 0 0)`（107） | `oklch(0.488 0.243 264.376)`（141） | — |
| `--sidebar-primary-foreground` | `oklch(0.985 0 0)`（108） | `oklch(0.985 0 0)`（142） | — |
| `--sidebar-accent` | `oklch(0.97 0 0)`（109） | `oklch(0.269 0 0)`（143） | — |
| `--sidebar-accent-foreground` | `oklch(0.205 0 0)`（110） | `oklch(0.985 0 0)`（144） | — |
| `--sidebar-border` | `oklch(0.922 0 0)`（111） | `oklch(1 0 0 / 10%)`（145） | — |
| `--sidebar-ring` | `oklch(0.708 0 0)`（112） | `oklch(0.556 0 0)`（146） | — |

`@theme inline` 在 `globals.css:35` 起把语义变量转成 Tailwind token；`--font-sans`、`--font-heading` 都指向 `--font-body`（38、40 行），等宽字体为 Cascadia Code / Consolas（39 行）。全局基础主题半径原为 0.625rem，被纸色块改为 .6rem。

新版页面出现 `.p-app` 时，`preview.css:2` 的 `:root:has(.p-app)` 和 `:14` 的 `:root.dark:has(.p-app)` 优先级更高，再覆盖为新版主题。离开 creative 后停止覆盖。实际并非所有配色都已集中：除变量定义外仍有硬编码颜色，完整位置见第 5 节。

### 2.2 creative 当前主题变量（补充完整表）

| 变量 | 亮色 :2 | 暗色 :14（— 表示沿用亮色） |
| --- | --- | --- |
| `--background` | `#ffffff`（3） | `#0e0e10`（15） |
| `--foreground` | `#18181b`（3） | `#fafafa`（15） |
| `--card` | `#ffffff`（3） | `#16161a`（15） |
| `--card-foreground` | `#18181b`（3） | `#fafafa`（15） |
| `--popover` | `#ffffff`（4） | `#1e1e23`（16） |
| `--popover-foreground` | `#18181b`（4） | `#fafafa`（16） |
| `--primary` | `#1f3a2e`（4） | `#fafafa`（16） |
| `--primary-foreground` | `#ffffff`（4） | `#18181b`（16） |
| `--secondary` | `#f4f4f5`（5） | `#26262c`（17） |
| `--secondary-foreground` | `#18181b`（5） | `#fafafa`（17） |
| `--muted` | `#f7f7f8`（5） | `#16161a`（17） |
| `--muted-foreground` | `#71717a`（5） | `#71717a`（17） |
| `--accent` | `#f4f4f5`（6） | `#26262c`（18） |
| `--accent-foreground` | `#18181b`（6） | `#fafafa`（18） |
| `--border` | `#e4e4e7`（6） | `#ffffff14`（18） |
| `--input` | `#e4e4e7`（6） | `#ffffff14`（18） |
| `--ring` | `#1f3a2e`（6） | `#6c907d`（18） |
| `--destructive` | `#bc3f40`（7） | `#e58181`（19） |
| `--radius` | `.75rem`（7） | — |
| `--p-canvas` | `#f7f7f8`（7） | `#0e0e10`（19） |
| `--p-panel` | `#ffffff`（7） | `#16161a`（19） |
| `--p-hover` | `#f0f0f2`（7） | `#26262c`（19） |
| `--p-text` | `#52525b`（8） | `#a1a1aa`（20） |
| `--p-subtle` | `#71717a`（8） | `#71717a`（20） |
| `--p-overlay` | `#18181b55`（8） | `#00000080`（20） |
| `--p-shadow` | `#18181b16`（8） | `#00000040`（20） |
| `--p-shadow-strong` | `#18181b30`（8） | `#00000080`（20） |
| `--p-success` | `#44a36b`（9） | — |
| `--p-warning` | `#e3ad42`（9） | — |
| `--p-busy` | `#5895ed`（9） | — |
| `--p-idle` | `#a1a1aa`（9） | — |
| `--p-selection` | `#1f3a2e`（10） | `#6c907d`（21） |
| `--p-mask` | `#5895ed`（10） | — |
| `--p-mask-export` | `#ffffff`（10） | — |
| `--p-mask-empty` | `#000000`（10） | — |
| `--p-dot` | `#d1d1d6`（11） | `#303035`（21） |
| `--p-note` | `#fff7d8`（11） | `#24231f`（21） |
| `--p-note-text` | `#66551b`（11） | `#c7bea4`（21） |
| `--p-glass` | `#fffffff0`（11） | `#1e1e23eb`（21） |
| `--p-check-a` | `#ededf0`（12） | `#26262c`（22） |
| `--p-check-b` | `#ffffff`（12） | `#1e1e23`（22） |
| `--p-floating` | `#ffffff`（12） | `#1e1e23`（22） |
| `--p-highlight` | `#1f3a2e25`（12） | `#6c907d30`（22） |

### 2.3 纸色及衬线字体

下列规则在全局文件中仍存在。这里只把明确的米白/纸色调色板及其直接使用点列为纸色相关；其他所有十六进制声明位置仍完整收录在第 5 节。

| 位置 | 选择器 | 纸色等硬编码声明 |
| --- | --- | --- |
| `src/app/globals.css:161` | `:root` | `--background: #f6f5f1`；`--foreground: #292b27`；`--card: #fffefa`；`--card-foreground: #292b27`；`--popover: #fffefa`；`--popover-foreground: #292b27`；`--primary: #3b493d`；`--primary-foreground: #fffefa`；`--secondary: #eeeee7`；`--secondary-foreground: #484e42`；`--muted: #efeee8`；`--muted-foreground: #7a7c72`；`--accent: #e9ece4`；`--accent-foreground: #3b493d`；`--destructive: #b44932`；`--border: #e0e1d8`；`--input: #dedfd5`；`--ring: #839678` |
| `src/app/globals.css:184` | `[data-slot="input"]` | `background: #fffefa` |
| `src/app/globals.css:189` | `.studio-header` | `background: #fffefa` |
| `src/app/globals.css:192` | `.brand-symbol` | `background: #3b493d`；`color: #f3f1e7` |
| `src/app/globals.css:213` | `.count-chip` | `background: #eeeee7`；`color: #72786b` |
| `src/app/globals.css:218` | `.square-front` | `background: #fffefa`；`color: #78866a` |
| `src/app/globals.css:242` | `.login-form-panel` | `background: #fffefa` |
| `src/app/globals.css:260` | `.studio-select` | `background: #fffefa`；`color: #536048` |
| `src/app/globals.css:280` | `.studio-textarea` | `background: #fffefa` |
| `src/app/globals.css:317` | `.scene-form textarea` | `background: #fafaf5` |
| `src/app/globals.css:345` | `.job-status` | `background: #fffefa`；`color: #717a65` |
| `src/app/globals.css:413` | `.pack-slot-editor input` | `border: 1px solid #d8ded7`；`background: #fffefa`；`color: #233528` |
| `src/app/globals.css:413` | `.pack-slot-editor select` | `border: 1px solid #d8ded7`；`background: #fffefa`；`color: #233528` |
| `src/app/globals.css:413` | `.pack-slot-editor textarea` | `border: 1px solid #d8ded7`；`background: #fffefa`；`color: #233528` |
| `src/app/globals.css:469` | `.agent-card input:not([type=checkbox])` | `border: 1px solid #d8dfce`；`background: #fffefa` |
| `src/app/globals.css:469` | `.agent-card textarea` | `border: 1px solid #d8dfce`；`background: #fffefa` |
| `src/app/globals.css:469` | `.agent-card select` | `border: 1px solid #d8dfce`；`background: #fffefa` |
| `src/app/globals.css:482` | `.agent-composer textarea` | `background: #fffefa`；`border: 1px solid #c8d2bc` |

| 位置 | 选择器 | 字体 |
| --- | --- | --- |
| `src/app/globals.css:192` | `.brand-symbol` | `font: 28px Georgia, serif` |
| `src/app/globals.css:225` | `.note-number` | `font-family: Georgia, serif` |
| `src/app/globals.css:230` | `.login-story-center h1` | `font-family: "SimSun", "Songti SC", Georgia, serif` |
| `src/app/globals.css:410` | `.pack-number` | `font: italic 28px Georgia,serif` |

登录大标题另有 `clamp(36px,3.8vw,58px)`、400 字重（globals.css:230）。新版库和品牌原型里也还有 Georgia：`task8.css:53` `.l-snippet-preview>span`、`:100` `.l-review-quote`，`task9.css:6` `.w-brand-logo`。因此仅清理 globals 仍不足以完成全站字体统一。

### 2.4 globals.css 的全部 !important

共 3 条规则、6 个声明，完整如下：

```css
/* src/app/globals.css:421 */
.pack-final { border: 2px solid #49734c !important; }
/* src/app/globals.css:501 */
button svg[data-concept-icon],[role=button] svg[data-concept-icon] { width: 16px !important; height: 16px !important; stroke-width: 1.5 !important; }
/* src/app/globals.css:502 */
.concept-icon-box>svg[data-concept-icon] { width: 20px !important; height: 20px !important; }
```

新版还有重复的强制图标规则：`task9-round1.css:4` 把 `.p-app/.p-portal` 按钮及 `.p-app [data-slot=button]` 内的图标统一为 16×16、stroke-width:1.5；第 5 行图标盒强制 20×20。局部 SVG 尺寸包括 `preview.css:35` 的 Logo 25px、`:123` 胶囊12px、`:145` 工具条15px、`:170` 加载SVG 26px，`round3.css:12` Logo24px、`:73` 胶囊16px、`:161` 画布工具20px，以及 `round4.css:9、17、20、21` 的12/20/16/14px。部分普通声明不能战胜图标组件内联尺寸或上述 important；加载SVG规则是否命中还需看实际子节点。

## 3. 规范与实际代码

本节“规范”指当前 `docs/design-system.md`，不是本次任务阶段 2–3 的未来目标。符合的项目也列出，避免误当成待修复差异。

| 项目 | 规范值 / 说明 | 当前实际值 / 状态 | 所在文件:行号 |
| --- | --- | --- | --- |
| 配色文件路径 | src/app/design-preview/preview.css | 已迁移至 (creative)，并叠加 7 个后续 CSS；文档路径失效 | docs/design-system.md:7；src/app/(creative)/layout.tsx:3–11 |
| 创作字体 | Segoe UI + 系统中文，不请求外部字体 | 最终 Segoe UI, Microsoft YaHei UI, PingFang SC, sans-serif；旧声明仍写未导入 Inter，已被覆盖。旧页面并非同一字体 | src/app/(creative)/preview.css:24；round3.css:2；src/app/globals.css:80、230 |
| 首页主标题 | 40px / 600 | 40px / 600；1440/1100/390 两主题均核实，符合旧规范。未来任务要求 36px | src/app/(creative)/round3.css:27、192 |
| 页面 / 区块 / 卡片标题 | 28/600、18/600、15/500 | 基础声明符合；局部组件仍有 14/15/16 等标题值。未来区块目标 16px | src/app/(creative)/round3.css:3–4、43、54、63–64 |
| 正文 / 辅助 / 最小 | 14 / 13 / ≥12px | 主容器14px；58处 font-size 源声明低于12px（含旧页和已覆盖规则），最小8px；不能称全站达标 | round3.css:2；src/app/(creative)/task11.css:1–9；src/app/globals.css:392 |
| 左栏宽 | 440px / 中屏400px | >1200 为640px，761–1200 为560px，≤760 为 min(600px,100vw)；390 屏为390px | src/app/(creative)/task9-round1.css:21、26、27、31 |
| 首页输入圆角 | 24px | 24px，符合旧规范；未来目标16px | src/app/(creative)/round3.css:33 |
| 模板 / Frame 圆角 | 16px / 16px | 16px / 16px，符合；图片节点12px、浮动工具条14px，没有统一四档 | src/app/(creative)/round3.css:46、143、157；preview.css:137 |
| 模型胶囊 | 999px | 999px，符合 | src/app/(creative)/round3.css:70 |
| 图标尺寸 | 规范仅说 lucide，没有 sm/md/lg；图标指南为16/18/20 | fixed 将请求归到16/18/20，24也变20；按钮important强制16；图标盒20 | src/components/icons/concept-icons.ts:7；src/components/design-preview/icon-guide.tsx:7；src/app/globals.css:501–502 |
| 暗色主色 | 白底 / 黑字 | --primary #fafafa、--primary-foreground #18181b，符合旧规范；ring/selection #6c907d，与主色分离。未来目标提亮墨绿 | src/app/(creative)/preview.css:16、18、21 |
| 数字 | tabular-nums | p-app/p-portal 已启用；globals 的旧页未统一声明 | src/app/(creative)/round3.css:2；task8.css:2 |
| 顶栏 | 单行（旧规范未写56px） | 单行62px，工作台高度扣除62px；未来任务明确工作台去整宽栏、其他页56px | src/app/(creative)/preview.css:33、91 |
| 消息图定位 | 消息引用图可点击定位并高亮节点 | 真实 RealChat 的历史引用只渲染 img，无点击处理；当前引用标签支持移除 | src/components/design-preview/live-workspace.tsx:93、104 |
| 生成 / 模型来源 | 模拟1.5秒、不调业务API；mock/models.ts唯一来源 | 已接真实业务 API、模型目录与生成快照；规范停留在任务7原型 | src/components/design-preview/live-workspace.tsx:36–64；src/components/design-preview/live-store.ts；src/lib/studio-models.ts |
| 组件基础 | creative Radix；旧页保留Base UI | 符合当前结构；两套 button 变体，后续交互统一需同时考虑两者 | src/components/design-preview/ui/button.tsx:1–38；src/components/ui/button.tsx:1–40 |

### 浏览器只读计算样式核对

在正在运行的本地首页用独立浏览器上下文读取 computedStyle，未截图。左栏宽度是将临时 `.p-chat` 探针加入该页 DOM 后测量同一套 CSS，并非声称已验收工作台所有状态；探针仅存在于已关闭的浏览器上下文，不修改源码或数据库。

| 宽度 / 主题 | 首页标题 | 输入框圆角 | 顶栏高 | p-chat 探针宽 | 主色 | 按钮图标 |
| --- | --- | --- | --- | --- | --- | --- |
| 1440 / 亮 | 40px / 600 | 24px | 62px | 640px | #1f3a2e | 16px |
| 1440 / 暗 | 40px / 600 | 24px | 62px | 640px | #fafafa | 16px |
| 1100 / 亮 | 40px / 600 | 24px | 62px | 560px | #1f3a2e | 16px |
| 1100 / 暗 | 40px / 600 | 24px | 62px | 560px | #fafafa | 16px |
| 390 / 亮 | 40px / 600 | 24px | 62px | 390px | #1f3a2e | 16px |
| 390 / 暗 | 40px / 600 | 24px | 62px | 390px | #fafafa | 16px |

## 4. concept-icons.ts 完整映射

共 102 个图标值导出。计数使用 TypeScript 符号解析：只统计 src 内的实际值使用，排除 import、定义、JSX闭合标签；一次 `<Check/>` 算一次，动态 Icon 变量的每次渲染不展开计数。外部引用与本文件 conceptIcons 聚合映射引用分列。表中 Lucide“规范名”来自当前安装版本的导出符号解析，不凭图标外观猜测。

| 导出名（定义行） | Lucide 导入名 → 规范符号 | 外部使用 | 聚合内部使用 | 标记 |
| --- | --- | --- | --- | --- |
| `ArrowLeft`（8） | `ArrowLeft` | 1 | 0 | — |
| `ArrowRight`（9） | `ArrowRight` | 14 | 0 | — |
| `ArrowUp`（10） | `ArrowUp` | 1 | 0 | — |
| `Bookmark`（11） | `Bookmark` | 7 | 1 | — |
| `Bot`（12） | `Bot` | 1 | 0 | — |
| `Boxes`（13） | `Boxes` | 1 | 1 | — |
| `Brush`（14） | `Brush` | 2 | 0 | — |
| `Camera`（15） | `Camera` | 5 | 0 | — |
| `Check`（16） | `Check` | 26 | 0 | 重复别名 |
| `ChevronDown`（17） | `ChevronDown` | 10 | 0 | 重复别名 |
| `ChevronLeft`（18） | `ChevronLeft` | 3 | 0 | — |
| `ChevronRight`（19） | `ChevronRight` | 5 | 0 | 重复别名 |
| `ChevronUp`（20） | `ChevronUp` | 1 | 0 | 重复别名 |
| `Circle`（21） | `Circle` | 1 | 0 | — |
| `CircleHelp`（22） | `CircleHelp` → `CircleQuestionMark` | 3 | 0 | — |
| `Clock3`（23） | `Clock3` | 1 | 0 | — |
| `Columns2`（24） | `Columns2` | 1 | 0 | — |
| `ContactRound`（25） | `Package` | 0 | 0 | 名不副实；重复别名；未使用 |
| `Copy`（26） | `Copy` | 2 | 0 | — |
| `Crop`（27） | `Crop` | 1 | 0 | — |
| `Download`（28） | `Download` | 7 | 0 | — |
| `Eraser`（29） | `Eraser` | 2 | 0 | — |
| `Expand`（30） | `Expand` | 1 | 0 | — |
| `FileText`（31） | `FileText` | 1 | 0 | — |
| `Globe`（32） | `Globe` | 0 | 1 | 重复别名 |
| `Globe2`（33） | `Globe` | 2 | 0 | 重复别名 |
| `Hand`（34） | `Hand` | 1 | 0 | — |
| `Heart`（35） | `Heart` | 1 | 0 | — |
| `History`（36） | `History` | 2 | 0 | — |
| `Image`（37） | `Image` | 0 | 1 | 重复别名 |
| `ImageIcon`（38） | `Image` | 1 | 0 | 重复别名 |
| `ImagePlus`（39） | `ImagePlus` | 5 | 0 | — |
| `Images`（40） | `Images` | 0 | 1 | — |
| `Lamp`（41） | `Lamp` | 0 | 1 | — |
| `Languages`（42） | `Languages` | 0 | 1 | — |
| `Layers`（43） | `Layers` | 0 | 1 | 重复别名 |
| `Layers3`（44） | `Layers` | 4 | 0 | 重复别名 |
| `Library`（45） | `Image` | 0 | 0 | 名不副实；重复别名；未使用 |
| `LockKeyhole`（46） | `LockKeyhole` | 3 | 0 | — |
| `Maximize`（47） | `Maximize` | 3 | 0 | — |
| `Monitor`（48） | `Monitor` | 3 | 0 | — |
| `Moon`（49） | `Moon` | 3 | 0 | — |
| `MoreHorizontal`（50） | `MoreHorizontal` → `Ellipsis` | 2 | 0 | — |
| `MousePointer2`（51） | `MousePointer2` | 1 | 0 | — |
| `Package`（52） | `Package` | 0 | 1 | 重复别名 |
| `Palette`（53） | `Palette` | 0 | 1 | — |
| `PanelLeftClose`（54） | `PanelLeftClose` | 2 | 0 | — |
| `PanelLeftOpen`（55） | `PanelLeftOpen` | 1 | 0 | — |
| `Pencil`（56） | `Pencil` | 4 | 0 | — |
| `Plus`（57） | `Plus` | 10 | 0 | — |
| `Save`（58） | `Save` | 3 | 0 | — |
| `Scan`（59） | `Scan` | 1 | 0 | — |
| `ScanLine`（60） | `ScanLine` | 1 | 0 | — |
| `Search`（61） | `Search` | 3 | 0 | — |
| `Settings2`（62） | `Settings2` | 6 | 0 | — |
| `Shapes`（63） | `Shapes` | 3 | 0 | — |
| `ShieldCheck`（64） | `ShieldCheck` | 2 | 1 | — |
| `SlidersHorizontal`（65） | `SlidersHorizontal` | 3 | 0 | — |
| `Sparkles`（66） | `Sparkles` | 13 | 0 | — |
| `StickyNote`（67） | `StickyNote` | 1 | 0 | — |
| `Sun`（68） | `Sun` | 3 | 0 | — |
| `Tag`（69） | `Tag` | 0 | 1 | — |
| `Trash2`（70） | `Trash2` | 5 | 0 | — |
| `Undo2`（71） | `Undo2` | 1 | 0 | — |
| `Upload`（72） | `Upload` | 8 | 0 | — |
| `UserRound`（73） | `UserRound` | 1 | 0 | — |
| `Users`（74） | `Users` | 1 | 0 | — |
| `Wand2`（75） | `Wand2` → `WandSparkles` | 0 | 1 | 重复别名 |
| `X`（76） | `X` | 12 | 0 | 重复别名 |
| `ZoomIn`（77） | `ZoomIn` | 2 | 0 | — |
| `ZoomOut`（78） | `ZoomOut` | 2 | 0 | — |
| `ArrowLeftRight`（79） | `ArrowLeftRight` | 1 | 0 | — |
| `UsersRound`（80） | `UsersRound` | 2 | 0 | — |
| `ArrowUpRight`（81） | `ArrowUpRight` | 3 | 0 | — |
| `ShieldX`（82） | `ShieldX` | 1 | 0 | — |
| `LayoutTemplate`（83） | `LayoutTemplate` | 2 | 0 | — |
| `ArrowDownToLine`（84） | `ArrowDownToLine` | 0 | 0 | 未使用 |
| `Bell`（85） | `Bell` | 0 | 0 | 未使用 |
| `BookOpen`（86） | `BookOpen` | 0 | 0 | 未使用 |
| `CheckCheck`（87） | `CheckCheck` | 0 | 0 | 未使用 |
| `FolderOpen`（88） | `FolderOpen` | 0 | 0 | 未使用 |
| `LayoutGrid`（89） | `LayoutGrid` | 0 | 0 | 未使用 |
| `MessageCircle`（90） | `MessageCircle` | 0 | 0 | 未使用 |
| `Ruler`（91） | `Ruler` | 0 | 0 | 未使用 |
| `Sofa`（92） | `Sofa` | 0 | 0 | 未使用 |
| `WandSparkles`（93） | `Wand2` → `WandSparkles` | 0 | 0 | 经 Wand2 导入（官方同图标别名）；重复别名；未使用 |
| `Zap`（94） | `Zap` | 0 | 0 | 未使用 |
| `RefreshCw`（95） | `RefreshCw` | 2 | 0 | — |
| `Radio`（96） | `Radio` | 1 | 0 | — |
| `LoaderCircle`（97） | `LoaderCircle` | 10 | 0 | 重复别名 |
| `LogOut`（98） | `LogOut` | 1 | 0 | — |
| `GripVertical`（99） | `GripVertical` | 1 | 0 | — |
| `CheckIcon`（100） | `CheckIcon` → `Check` | 4 | 0 | 重复别名 |
| `XIcon`（101） | `XIcon` → `X` | 2 | 0 | 重复别名 |
| `ChevronRightIcon`（102） | `ChevronRightIcon` → `ChevronRight` | 1 | 0 | 重复别名 |
| `ChevronDownIcon`（103） | `ChevronDownIcon` → `ChevronDown` | 2 | 0 | 重复别名 |
| `ChevronUpIcon`（104） | `ChevronUpIcon` → `ChevronUp` | 1 | 0 | 重复别名 |
| `CircleCheckIcon`（105） | `CircleCheckIcon` → `CircleCheck` | 1 | 0 | — |
| `InfoIcon`（106） | `InfoIcon` → `Info` | 1 | 0 | — |
| `TriangleAlertIcon`（107） | `TriangleAlertIcon` → `TriangleAlert` | 1 | 0 | — |
| `OctagonXIcon`（108） | `OctagonXIcon` → `OctagonX` | 1 | 0 | — |
| `Loader2Icon`（109） | `Loader2Icon` → `LoaderCircle` | 1 | 0 | 重复别名 |

### 别名和未使用项

真正语义不符：`Library → Image`（44行）、`ContactRound → Package`（25行）。`WandSparkles → RawWand2`（93行）存在绕名，但当前 lucide 的 Wand2 本身解析为 WandSparkles，不能说画出的不是 WandSparkles。`MoreHorizontal → Ellipsis`、`CircleHelp → CircleQuestionMark` 也属于上游官方别名。

| 实际规范图标 | 本入口的重复导出 |
| --- | --- |
| `Check` | `Check`、`CheckIcon` |
| `ChevronDown` | `ChevronDown`、`ChevronDownIcon` |
| `ChevronRight` | `ChevronRight`、`ChevronRightIcon` |
| `ChevronUp` | `ChevronUp`、`ChevronUpIcon` |
| `Package` | `ContactRound`、`Package` |
| `Globe` | `Globe`、`Globe2` |
| `Image` | `Image`、`ImageIcon`、`Library` |
| `Layers` | `Layers`、`Layers3` |
| `WandSparkles` | `Wand2`、`WandSparkles` |
| `X` | `X`、`XIcon` |
| `LoaderCircle` | `LoaderCircle`、`Loader2Icon` |

13 个未使用图标导出：`ContactRound`、`Library`、`ArrowDownToLine`、`Bell`、`BookOpen`、`CheckCheck`、`FolderOpen`、`LayoutGrid`、`MessageCircle`、`Ruler`、`Sofa`、`WandSparkles`、`Zap`。仅标记，不删除；非图标的类型与聚合导出见下表。

`fixed()` 当前强制 strokeWidth=1.5，并用内联 style 重写调用方的 width/height/strokeWidth。请求小于17→16，17–<19→18，≥19→20，默认16。不支持语义尺寸；包括 size=24 也只能得到20。

### 聚合及类型导出（不作为图标数）

| 导出 | 内容 / 引用 |
| --- | --- |
| conceptIcons :110 | 13项：pack→Layers、variants→Palette、edit→Wand2、translate→Languages、check→ShieldCheck、scene→Image、prop→Lamp、propSet→Boxes、reference→Images、snippet→Tag、product→Package、brand→Bookmark、web→Globe。外部：batch/workflow.tsx:25 一次、icon-badge.tsx:3 一次、icon-guide.tsx:7 四次；本文件类型引用一次。 |
| conceptLabels :112 | 13项中文名称；外部 icon-guide.tsx:7 一次。 |
| IconConcept :111 | 类型导出；外部 icon-badge.tsx:3、icon-guide.tsx:7 各一次；内部 conceptLabels 类型一次。 |
| LucideIcon / LucideProps :5 | 上游类型再导出；LucideIcon 被 placeholder.tsx:3 使用一次，LucideProps 无外部使用。 |

src 直接从 lucide-react 导入的位置只有 concept-icons.ts:2、:4；本轮未发现业务组件绕开统一入口。

## 5. 硬编码颜色、小字号、内联颜色

口径：扫描 src 内全部 `.css` 与 `.tsx`，排除生成目录，不含 docs、public、tests、TS 配置文件或依赖。CSS 统计声明值中的 #RGB/#RGBA/#RRGGBB/#RRGGBBAA，TSX 统计字符串/模板片段中的同类色值；颜色 token 定义本身也计入。一次出现算一次，重复值不合并；注释不计。此项不是“最终可见的违规数量”，已覆盖/隐藏原型声明仍计入。

### 5.1 十六进制色值

合计 **400 次**（CSS 394、TSX 6），大小写归一后 **279 个不同值**。

| 文件 | 出现次数 |
| --- | --- |
| `src/app/(creative)/preview.css` | 77 |
| `src/app/(creative)/round3.css` | 16 |
| `src/app/(creative)/round4.css` | 6 |
| `src/app/(creative)/task11.css` | 2 |
| `src/app/(creative)/task8.css` | 16 |
| `src/app/(creative)/task9-round1.css` | 30 |
| `src/app/(creative)/task9.css` | 15 |
| `src/app/globals.css` | 232 |
| `src/components/design-preview/batch/workflow.tsx` | 2 |
| `src/components/design-preview/batch/brand.tsx` | 1 |
| `src/components/design-preview/task-cover.tsx` | 3 |

完整位置如下：每项为 `行:列=色值`。同一位置不因逗号选择器重复计数。

#### `src/app/(creative)/preview.css`

- `3:17=#ffffff`、`3:40=#18181b`、`3:57=#ffffff`、`3:85=#18181b`
- `4:14=#ffffff`、`4:45=#18181b`、`4:65=#1f3a2e`、`4:96=#ffffff`
- `5:16=#f4f4f5`、`5:49=#18181b`、`5:67=#f7f7f8`、`5:96=#71717a`
- `6:13=#f4f4f5`、`6:43=#18181b`、`6:62=#e4e4e7`、`6:80=#e4e4e7`、`6:97=#1f3a2e`
- `7:18=#bc3f40`、`7:57=#f7f7f8`、`7:77=#ffffff`、`7:97=#f0f0f2`
- `8:13=#52525b`、`8:34=#71717a`、`8:56=#18181b55`、`8:79=#18181b16`、`8:109=#18181b30`
- `9:16=#44a36b`、`9:38=#e3ad42`、`9:57=#5895ed`、`9:76=#a1a1aa`
- `10:18=#1f3a2e`、`10:37=#5895ed`、`10:63=#ffffff`、`10:88=#000000`
- `11:12=#d1d1d6`、`11:31=#fff7d8`、`11:55=#66551b`、`11:75=#fffffff0`
- `12:16=#ededf0`、`12:38=#ffffff`、`12:61=#ffffff`、`12:85=#1f3a2e25`
- `15:17=#0e0e10`、`15:40=#fafafa`、`15:57=#16161a`、`15:85=#fafafa`
- `16:14=#1e1e23`、`16:45=#fafafa`、`16:65=#fafafa`、`16:96=#18181b`
- `17:16=#26262c`、`17:49=#fafafa`、`17:67=#16161a`、`17:96=#71717a`
- `18:13=#26262c`、`18:43=#fafafa`、`18:62=#ffffff14`、`18:82=#ffffff14`、`18:101=#6c907d`
- `19:18=#e58181`、`19:39=#0e0e10`、`19:59=#16161a`、`19:79=#26262c`
- `20:13=#a1a1aa`、`20:34=#71717a`、`20:56=#00000080`、`20:79=#00000040`、`20:109=#00000080`
- `21:18=#6c907d`、`21:36=#303035`、`21:55=#24231f`、`21:79=#c7bea4`、`21:99=#1e1e23eb`
- `22:16=#26262c`、`22:38=#1e1e23`、`22:61=#1e1e23`、`22:85=#6c907d30`

#### `src/app/(creative)/round3.css`

- `19:172=#f4f1ea`、`19:183=#fff`
- `21:78=#1f3a2e40`、`21:91=#0e0e10`
- `33:128=#00000008`、`33:150=#0000000f`
- `34:44=#00000020`、`34:66=#00000035`、`34:90=#ffffff16`
- `35:113=#00000008`、`35:135=#0000000f`
- `50:202=#00000080`
- `77:138=#18181b`、`77:153=#fff`
- `78:73=#fafafa`、`78:88=#18181b`

#### `src/app/(creative)/round4.css`

- `8:152=#18181b`、`8:216=#0003`
- `14:65=#000`、`14:76=#fff`
- `15:71=#fff`、`15:82=#000`

#### `src/app/(creative)/task11.css`

- `7:410=#4b8266`
- `41:296=#0000000d`

#### `src/app/(creative)/task8.css`

- `16:115=#d9d2c4`
- `19:39=#e8e8e8`
- `20:94=#ffffff60`
- `24:107=#F4F4F5`
- `25:42=#ededee`、`25:91=#16161a`、`25:146=#1e1e23`
- `29:165=#fff`
- `33:112=#0003`
- `49:63=#0006`
- `52:65=#0008`
- `94:312=#fff`、`94:328=#ffffff15`、`94:361=#0006`、`94:493=#0008`
- `105:59=#fff`

#### `src/app/(creative)/task9-round1.css`

- `2:149=#EDEDEF`、`2:163=#34343A`
- `3:36=#26262C`、`3:50=#E9E9ED`
- `7:164=#F4F4F5`
- `9:72=#28282E`
- `12:165=#00000006`、`12:186=#DCD8D1`、`12:200=#fff`
- `15:237=#FFFFFFE6`
- `17:66=#DDD8CE`、`17:209=#eae5dc`、`17:239=#0002`、`17:430=#fff`、`17:457=#0009`、`17:486=#5B574F`、`17:698=#0001`、`17:751=#fff`、`17:881=#fff`
- `18:110=#ffffff66`、`18:394=#ffffffaa`
- `19:304=#fff9`、`19:393=#fff`、`19:404=#333`、`19:577=#0004`
- `23:309=#0001`、`23:972=#AC842F`
- `24:1112=#0001`
- `29:106=#fff`、`29:117=#333`

#### `src/app/(creative)/task9.css`

- `4:118=#0000000a`
- `6:109=#171717`
- `10:320=#00000005`、`10:898=#00000002`
- `13:1066=#C3972310`、`13:1093=#C3972330`
- `14:57=#e5d8c4`、`14:327=#ffffffdc`、`14:343=#272525`
- `15:323=#C89C3F`、`15:518=#AC842F`
- `20:41=#000`、`20:52=#fff`、`20:114=#fff`、`20:125=#000`

#### `src/app/globals.css`

- `8:69=#ecece6`、`8:85=#6b7067`
- `9:38=#e5eddf`、`9:54=#355139`
- `12:68=#777d72`
- `13:56=#e5e7dd`、`13:90=#e5e7dd`
- `16:131=#e5e7dd`
- `19:58=#6a7466`
- `20:55=#777d72`
- `22:81=#18211980`
- `23:71=#fffef9`
- `27:26=#977139`
- `28:54=#fff3cf`、`28:70=#926717`
- `30:54=#586d4b`
- `162:17=#f6f5f1`
- `163:17=#292b27`
- `164:11=#fffefa`
- `165:22=#292b27`
- `166:14=#fffefa`
- `167:25=#292b27`
- `168:14=#3b493d`
- `169:25=#fffefa`
- `170:16=#eeeee7`
- `171:27=#484e42`
- `172:12=#efeee8`
- `173:23=#7a7c72`
- `174:13=#e9ece4`
- `175:24=#3b493d`
- `176:18=#b44932`
- `177:13=#e0e1d8`
- `178:12=#dedfd5`
- `179:11=#839678`
- `184:53=#fffefa`
- `189:30=#fffefa`
- `192:92=#3b493d`、`192:108=#f3f1e7`
- `195:100=#787b70`
- `196:26=#3b493d`、`196:47=#f6f7f1`
- `197:27=#3b493d`、`197:57=#3b493d`
- `201:47=#84877a`
- `204:57=#7c8771`
- `206:21=#98a585`
- `207:57=#7a7c72`
- `208:69=#edf0e6`、`208:92=#d8dfcc`、`208:108=#5d6c4e`
- `209:52=#7a8e64`
- `211:171=#5f6756`
- `212:63=#343b2f`
- `213:62=#eeeee7`、`213:78=#72786b`
- `216:84=#c2cdb7`
- `217:74=#eff2e8`
- `218:52=#fffefa`、`218:68=#78866a`
- `219:100=#b6c397`
- `222:61=#848679`
- `223:40=#8f9584`
- `224:108=#8b8f81`
- `225:69=#b2b7a7`
- `226:140=#a1a493`
- `228:28=#e5e7db`
- `231:38=#92a279`
- `232:65=#858b77`
- `233:98=#929984`
- `235:102=#bac5a7`
- `236:101=#c9d0b9`、`236:157=#d6ddc8`
- `238:97=#6d795d`、`238:166=#647151`
- `239:86=#778565`
- `240:100=#8d7e63`、`240:128=#8d7e63`
- `241:87=#bdc7ac`
- `242:89=#fffefa`
- `245:67=#888c7d`
- `246:39=#979b8b`
- `247:75=#a6ab9a`
- `248:184=#6d795e`
- `249:72=#353d2f`
- `250:48=#969b8a`
- `253:46=#6e7a5e`
- `254:69=#3b493d`
- `255:33=#898f7d`
- `256:27=#f0f1e9`
- `260:30=#fffefa`、`260:150=#536048`
- `265:75=#e8ece0`、`265:127=#6c7b58`
- `268:43=#8b927f`
- `269:37=#9b9f91`
- `273:90=#748465`
- `275:71=#647b4f`
- `279:57=#808777`
- `280:112=#fffefa`
- `287:134=#3b493d`
- `292:40=#f1f3e9`
- `294:94=#e9eddf`、`294:143=#768365`
- `295:71=#859175`
- `297:60=#69795a`
- `298:82=#7b856e`
- `303:86=#f0f0e9`
- `304:37=#838e74`
- `305:60=#cbd4be`、`305:136=#91a07d`
- `310:62=#d2dac6`、`310:103=#edf1e5`、`310:138=#5c6b4b`
- `316:71=#414d3a`
- `317:172=#fafaf5`
- `319:44=#9b9e90`
- `324:153=#7a8271`
- `325:52=#eaf0e2`、`325:75=#8e9f79`、`325:91=#3b493d`
- `327:234=#7b856f`
- `328:52=#3b493d`
- `329:50=#929a87`
- `331:48=#869078`
- `333:73=#99a18c`
- `334:175=#839274`
- `335:44=#637355`
- `336:66=#959d8b`
- `338:64=#b44932`
- `341:55=#eff1e8`
- `344:144=#8b9a79`
- `345:70=#fffefa`、`345:141=#717a65`
- `346:23=#3b6443`、`346:44=#eaf0e2`、`346:75=#b44932`、`346:96=#fbede7`
- `347:111=#89917e`
- `348:46=#414d3a`
- `349:90=#b44932`
- `350:84=#4f6940`
- `352:36=#839c6d`、`352:67=#dfe9d3`
- `353:70=#c2cfb3`、`353:111=#f3f6ed`、`353:260=#81916f`
- `354:68=#5d704d`、`354:125=#98a18c`
- `355:52=#edf2e4`
- `358:40=#90a37a`、`358:61=#eaf0df`
- `359:115=#e2e5d9`、`359:136=#fffefae8`、`359:154=#69785b`
- `360:39=#fbede7`、`360:55=#b44932`
- `362:146=#81916f`
- `363:135=#414d3a`
- `365:171=#7a8271`
- `367:56=#eaf0e2`、`367:79=#8e9f79`、`367:95=#3b493d`
- `371:29=#c3d0b7`、`371:80=#f0f4e9`
- `372:164=#eff1e8`
- `373:65=#516541`、`373:134=#879679`
- `375:47=#6d8758`
- `379:42=#898f7d`
- `409:46=#69746b`
- `410:22=#718473`
- `412:72=#5c685e`
- `413:108=#d8ded7`、`413:128=#fffefa`、`413:143=#233528`
- `415:104=#69746b`
- `416:53=#ccd4c9`、`416:68=#75806f`
- `417:104=#ecf0e8`
- `418:63=#67735f`
- `419:64=#52674a`
- `421:32=#49734c`
- `422:69=#edf0e8`
- `424:140=#d9ded3`、`424:180=#fffef8`、`424:195=#243627`、`424:228=#182a2433`
- `425:37=#14241dc0`
- `434:160=#e9ede3`、`434:186=#d6ddcf`
- `437:59=#243b2e`、`437:74=#fffdf5`
- `439:73=#66735f`
- `443:47=#405d39`
- `445:50=#567344`
- `446:61=#797361`
- `447:52=#b8c2ac`、`447:72=#f4f5ec`
- `450:66=#7a806f`
- `451:129=#dde2d3`
- `452:46=#7b826f`
- `453:67=#fffdf4`
- `455:57=#72816b`
- `456:79=#d2daca`、`456:99=#f6f6ef`
- `457:101=#79836c`
- `459:26=#eaf0e3`、`459:53=#70865c`
- `460:70=#8a8a78`
- `462:32=#a6b596`、`462:66=#fffdf6`、`462:114=#dce4d0`
- `465:57=#637b50`
- `468:81=#e0e6d8`、`468:96=#6a7c5e`
- `469:128=#d8dfce`、`469:148=#fffefa`
- `472:53=#7b806f`
- `473:45=#e0e4d6`
- `474:36=#77816c`
- `478:51=#ccd6bf`、`478:89=#f5f7f0`
- `479:48=#dce6d1`、`479:70=#6f875a`
- `480:52=#395332`
- `481:40=#dbe1d2`
- `482:51=#fffefa`、`482:77=#c8d2bc`
- `485:80=#edf2e6`
- `487:41=#5d7c43`
- `488:45=#7d846f`
- `494:23=#638146`

#### `src/components/design-preview/batch/workflow.tsx`

- `57:1677=#d8cbbb`、`57:1732=#d8cbbb`

#### `src/components/design-preview/batch/brand.tsx`

- `25:258=#B69772`

#### `src/components/design-preview/task-cover.tsx`

- `6:75=#E8DECC`、`6:85=#919D9A`、`6:95=#B37F58`

### 5.2 小于12px的 font-size

共 **58 个源码声明**：globals.css 49、task11.css 9；本次未发现 TSX 中静态小于12px的 fontSize 或任意 Tailwind 字号字面值。rem按16px根字号折算，重复被覆盖声明仍计入。该口径仅统计 font-size / JSX fontSize / Tailwind text-[…]，并人工检查了 CSS font 简写：其中只有继承、12px和28px，没有补漏的小字号。

| 位置 | 选择器 | 值 |
| --- | --- | --- |
| `src/app/(creative)/task11.css:1:91` | `.t11-references` | `11px` |
| `src/app/(creative)/task11.css:2:33` | `.t11-references>span` | `11px` |
| `src/app/(creative)/task11.css:6:180` | `.t11-progress-heading small` | `10px` |
| `src/app/(creative)/task11.css:7:338` | `.t11-progress-step small` | `10px` |
| `src/app/(creative)/task11.css:8:245` | `.t11-generation-progress small` | `10px` |
| `src/app/(creative)/task11.css:8:384` | `.t11-awaiting` | `11px` |
| `src/app/(creative)/task11.css:9:183` | `.t11-save-status` | `11px` |
| `src/app/(creative)/task11.css:9:477` | `.t11-save-status button` | `11px` |
| `src/app/(creative)/task11.css:15:170` | `.t11-canvas-history small` | `10px` |
| `src/app/globals.css:29:37` | `.identity-snapshot` | `11px` |
| `src/app/globals.css:201:23` | `.account-label span` | `10px` |
| `src/app/globals.css:204:12` | `.eyebrow` | `10px` |
| `src/app/globals.css:213:15` | `.count-chip` | `11px` |
| `src/app/globals.css:220:48` | `.empty-projects .eyebrow` | `9px` |
| `src/app/globals.css:223:16` | `.coming-note` | `10px` |
| `src/app/globals.css:224:84` | `.workspace-note` | `11px` |
| `src/app/globals.css:226:149` | `.studio-footer` | `10px` |
| `src/app/globals.css:233:75` | `.story-footer` | `9px` |
| `src/app/globals.css:246:15` | `.login-help` | `10px` |
| `src/app/globals.css:247:52` | `.login-version` | `9px` |
| `src/app/globals.css:268:19` | `.user-info span` | `10px` |
| `src/app/globals.css:269:14` | `.user-meta` | `9px` |
| `src/app/globals.css:271:70` | `.user-row-actions > .studio-select` | `11px` |
| `src/app/globals.css:272:41` | `.password-details` | `11px` |
| `src/app/globals.css:275:29` | `.form-notice, .row-notice` | `11px` |
| `src/app/globals.css:279:15` | `.field-hint` | `11px` |
| `src/app/globals.css:295:47` | `.product-sku` | `10px` |
| `src/app/globals.css:304:46` | `.reference-grid figcaption` | `10px` |
| `src/app/globals.css:309:22` | `.upload-form input` | `11px` |
| `src/app/globals.css:327:210` | `.generation-spec` | `11px` |
| `src/app/globals.css:329:26` | `.generation-spec small` | `10px` |
| `src/app/globals.css:331:24` | `.scene-action > span` | `10px` |
| `src/app/globals.css:336:42` | `.history-empty span, .history-footnote` | `11px` |
| `src/app/globals.css:345:117` | `.job-status` | `10px` |
| `src/app/globals.css:347:87` | `.generation-details` | `10px` |
| `src/app/globals.css:354:101` | `.photo-dropzone span` | `10px` |
| `src/app/globals.css:366:94` | `.resolution-options small` | `10px` |
| `src/app/globals.css:373:92` | `.edit-source p` | `11px` |
| `src/app/globals.css:375:23` | `.edit-version-label` | `10px` |
| `src/app/globals.css:391:155` | `.intro-copy` | `11px` |
| `src/app/globals.css:391:188` | `.stage-badge` | `9px` |
| `src/app/globals.css:392:106` | `.studio-footer` | `8px` |
| `src/app/globals.css:392:152` | `.workspace-note` | `10px` |
| `src/app/globals.css:439:82` | `.agent-mode-bar small, .agent-session-cost small` | `11px` |
| `src/app/globals.css:444:39` | `.agent-heading small` | `10px` |
| `src/app/globals.css:446:22` | `.agent-uncertainty` | `11px` |
| `src/app/globals.css:449:41` | `.agent-upload-label input` | `11px` |
| `src/app/globals.css:450:44` | `.agent-upload-label small` | `10px` |
| `src/app/globals.css:451:138` | `.agent-document` | `11px` |
| `src/app/globals.css:452:55` | `.agent-document small` | `10px` |
| `src/app/globals.css:457:38` | `.agent-message>span` | `10px` |
| `src/app/globals.css:461:19` | `.agent-system p` | `10px` |
| `src/app/globals.css:465:35` | `.agent-card .panel-heading span` | `10px` |
| `src/app/globals.css:468:41` | `.agent-card-receipt` | `11px` |
| `src/app/globals.css:472:31` | `.agent-profile-fields small` | `10px` |
| `src/app/globals.css:474:45` | `.agent-proposal-slot small` | `11px` |
| `src/app/globals.css:484:26` | `.agent-composer button` | `11px` |
| `src/app/globals.css:488:23` | `.agent-tool-history` | `10px` |

需动态判断、不计入58的项：

| 位置 | 表达式 | 说明 |
| --- | --- | --- |
| `src/app/globals.css:230:26` | `clamp(36px, 3.8vw, 58px)` | clamp下界36px，不低于12 |
| `src/components/design-preview/canvas.tsx:42:939` | `14/zoom` | 依赖zoom或用户数据；14/zoom、12/zoom与反向缩放配合，不能直接按源码数值判定屏幕字体 |
| `src/components/design-preview/canvas.tsx:50:153` | `data.copy.fontSize` | 依赖zoom或用户数据；14/zoom、12/zoom与反向缩放配合，不能直接按源码数值判定屏幕字体 |
| `src/components/design-preview/canvas.tsx:51:78` | `12/zoom` | 依赖zoom或用户数据；14/zoom、12/zoom与反向缩放配合，不能直接按源码数值判定屏幕字体 |
| `src/components/design-preview/canvas.tsx:63:324` | `14/zoom` | 依赖zoom或用户数据；14/zoom、12/zoom与反向缩放配合，不能直接按源码数值判定屏幕字体 |

### 5.3 JSX 内联 style 的颜色

共 **9 个颜色相关属性赋值**：5个动态背景、4个CSS变量值；没有直接把十六进制字面值写进 style 对象的赋值。动态背景仍可能来自硬编码数组/模型数据（例如 task-cover.tsx:6 的三色数组），不代表已实现统一 tokens。类型断言包住的 Sonner style 已人工展开计数；`--border-radius` 不属于颜色。

| 位置 | 属性 | 值 | 类型 |
| --- | --- | --- | --- |
| `src/components/design-preview/batch/brand.tsx:14:94` | `background` | `brand.primaryColor` | 动态表达式 |
| `src/components/design-preview/batch/brand.tsx:25:616` | `background` | `b.primaryColor` | 动态表达式 |
| `src/components/design-preview/canvas.tsx:50:67` | `background` | `data.variantColor` | 动态表达式 |
| `src/components/design-preview/task-cover.tsx:6:308` | `background` | `color` | 动态表达式 |
| `src/components/design-preview/task-cover.tsx:6:345` | `background` | `color` | 动态表达式 |
| `src/components/design-preview/app.tsx:48:520` | `background` | `"conic-gradient(var(--p-selection) "+understanding+"%,var(--border) 0)"` | CSS变量 |
| `src/components/ui/sonner.tsx:33:11` | `--normal-bg` | `var(--popover)` | CSS变量 |
| `src/components/ui/sonner.tsx:34:11` | `--normal-text` | `var(--popover-foreground)` | CSS变量 |
| `src/components/ui/sonner.tsx:35:11` | `--normal-border` | `var(--border)` | CSS变量 |

另核对两处间接 style：canvas.tsx:42 的条件对象仅含最大宽度/溢出，canvas.tsx:52 的 labelStyle 定义于:45，仅含 transform/transformOrigin；均无颜色，不计入9。SVG fill/stroke props、Konva颜色 props不属于 style，但其中的十六进制字符串已计入5.1。

## 6. 测试与检查命令的当前状态

本节为本轮实际结果，不能把上次通过当成本轮通过。未执行的项目明确标出。现有 `test:e2e` 会写测试账号、商品、评分、画布等数据，本次阶段0不向现用数据库执行整套写入式回归；用自带隔离数据库的 Agent mock 浏览器回归补充。未生成截图、视频、trace。

| 命令 / 检查 | 本轮结果 | 范围 / 说明 |
| --- | --- | --- |
| npm run lint | 通过（exit 0） | ESLint；无新增运行时依赖 |
| npm run typecheck | 通过（exit 0） | next typegen + tsc；隔离浏览器测试后再次执行，恢复正常生成类型入口 |
| npm run build | 通过（exit 0） | Next.js 16.4.0 Turbopack生产构建，含全部路由 |
| npm run test:units | 106/106通过，0跳过 | 44网关等 +25组合器/库/模型选择/回跳 +3图像模型 +22画布/工作流/视觉方案 +12 task11c/评分 |
| npm run test:gateways | 44项通过（由test:units调用） | agent、audit、gateway、pack、studio-main、读取错误日志 |
| npm run test:prompt-composer | 25项通过（由test:units调用） | prompt-composer、library-store、model-selection、login-destination |
| npm run test:task10:units | 69项通过（由test:units调用） | 以上两组的聚合，不能额外重复累计 |
| npm run test:agent:browser | 重跑2/2通过 | 首次本地Next服务在安全升级提醒后退出，ERR_CONNECTION_REFUSED，2项失败；原命令重跑成功，未修改依赖/代码。另有React客户端script标签警告 |
| npm run test:agent | 共享的服务端模拟流程通过 | test:agent:browser内部先完整执行服务端流程；未另起一次同样命令 |
| npm run test:generation | 失败（exit 1） | scripts/verify-generation.ts:145：expiredQueued.reservedUsd实际0.03、预期0；前四段通过，后续断言未执行。仅记录，不改费用/队列代码或断言 |
| npm run test:e2e | 本轮未整套运行，当前全套是否通过未知 | 10项常规用例本轮未重跑；agent.spec.ts两项默认按设计跳过，须test:agent:browser专门运行（本轮已2/2通过） |
| npm run test:image-models / test:canvas / test:visual-plan / test:reviews | 各自纯单元部分已由test:units覆盖；DB集成本轮未运行 | 这些别名还包含对应tests/integration文件，不可把单元通过写成整个别名通过 |
| tests/integration/task11c.test.ts | 本轮未运行 | 未设独立npm别名；上次记录不替代当前结果 |
| 本地DOM计算样式读取 | 通过 | 首页，1440/1100/390，亮/暗；左栏为样式探针，不是完整工作台交互回归 |
| npm run lint:ui / scripts/ui-snapshots.ts / axe | 目前不存在 / 未运行 | 属于后续阶段要求；未提前新增脚本或依赖 |

### 失败与警告的边界

- `test:generation` 的失败是隔离数据库中的现有基线问题。本轮无源码变更可导致它；不能据此确定是历史实现缺陷还是测试夹具/预期过时。断言涉及超时配额，按本轮约束不修复。对应实现 `src/lib/generation-queue.ts` 的 expireOverdueJobs 根据 submissionAttempted/externalTaskId 决定是否保留预留，进一步确认须单独任务。
- Agent 首次失败与页面断连对应；重跑2项成功。开发服务器日志提示当前 Next.js 有已知安全问题，本轮未核验具体公告、未升级。不能把终端输出里的升级建议当成本轮授权。
- React 提示“组件中 script 标签在客户端渲染不执行”，Agent回归仍通过；这不是本轮新引入的变更。

本地原始检查日志保存在 `.local/verification/ui-phase0/`（git忽略，不提交；只含本轮终端输出/静态与DOM统计，不是截图）：lint.log、typecheck.log、typecheck-final.log、build.log、units.log、generation.log、agent-browser.log、agent-browser-retry.log、static.json、dom.json。报告已保留必要结果，阅读者不需要这些本地临时文件才能看到失败位置或统计位置。

## 7. 与指令不符之处、取舍与待确认事项

- 阶段0按要求只盘点，不把阶段2的新字号/暗色主色目标反写为当前规范；没有提前迁移、删除或修改样式。
- 用户描述中的两套主题之外，实际还有第三个旧纸色覆盖块；报告完整列出并说明层叠影响。
- WandSparkles经RawWand2导入在当前Lucide是同一图形；把它标为绕名/重复别名，不误报为不同图形。
- 阶段3称 `.p-loading` 为转圈，实际 `canvas.tsx:56` 已渲染 `motion.div.p-shimmer` 横向循环，旧的 SVG 转圈规则仍在 `preview.css:170`，但该节点并不渲染 SVG。阶段3还要求删除 React Flow 默认 Controls，当前 `canvas.tsx` 没有导入或渲染 Controls，已有自定义左侧竖向工具条与缩放控件；不能按描述假定仍存在默认 Controls。
- 图标概念映射被动态使用，外部引用为0但聚合引用为1的图标并非未使用；不据此删除。
- 典型覆盖最多30例，完整硬编码位置不截断。覆盖数量保守计算，不能代替阶段1所需全部状态像素比对。
- 只新增本文；不改README、CHANGELOG、design-system或项目记忆，遵守本阶段“只读不改代码”的范围。
- 当前106单元和2专用Agent浏览器通过，但生成集成失败、常规整套浏览器未重跑，不能报告“现有测试全部通过”。阶段1若要求全套全绿，需要先决定如何处理已有超时预留失败；本轮不擅自修费用/队列逻辑。
- 截图对比路径：无。阶段0未要求截图，且用户长期要求只在明确要求时制作；阶段1–3的截图工作尚未开始。

阶段0完成后停止，等待用户审阅；不进入阶段1，不推送。
