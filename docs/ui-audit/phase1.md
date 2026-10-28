# UI 阶段 1：样式结构重组

基线提交：`a1e3f51e98c45fd7dd3b3134175ba02fa99efec9`。日期：2026-10-28。仅完成阶段 1，等待审阅，不进入阶段 2，不推送。

## 1. 改动摘要

1. 修改 CSS 前，在 a1e3f51 上完成全部常规浏览器回归：10 通过、2 项专用 Agent 按原设计跳过。
2. 新增可复用 `scripts/ui-snapshots.ts`，建立全部 44 张截图基线：11 种页面/状态 × 亮暗主题 × 1440/390 宽度。
3. creative 原 8 个 CSS 全部移入 `src/styles/creative/` 的 9 个职责文件，在 layout 统一按 tokens → base → layout → 各模块加载，删除旧文件。
4. 清除 182 个被后续同选择器、同条件、同属性覆盖的声明；另移除 2 个被通用排版覆盖的旧声明，使拆分后的实际字重/字号保持原样。
5. 对有其他选择器、简写/长写及媒体层叠依赖的互补声明保留分段顺序，标注 `TODO 待确认`，没有强行扁平化。
6. 全部 408 个 CSS 类名保留，未新增或丢失类名；tokens 中仅有自定义变量声明。未清理存量色值、小字号、图标尺寸或 important。
7. 完成 44 张复拍、逐像素比较，以及每状态同一 DOM 的 21 项视觉计算属性核对；42 张完全一致，2 张仅有 1/255 的像素量化差异，详见下文。
8. 记录 KI-001 已知基线失败，更新运行文档和开发记录。费用、配额、队列、双网关、业务/API、Prisma、鉴权、组件交互与功能开关无改动；没有付费模型调用。

## 2. 改动文件清单

| 操作 | 文件 |
| --- | --- |
| 修改引入链 | `src/app/(creative)/layout.tsx` |
| 新增职责样式 | `src/styles/creative/tokens.css`、`base.css`、`layout.css`、`home.css`、`gallery.css`、`chat.css`、`canvas.css`、`library.css`、`admin.css` |
| 删除旧样式 | `src/app/(creative)/preview.css`、`round3.css`、`task8.css`、`round4.css`、`task9.css`、`task9-round1.css`、`task10.css`、`task11.css` |
| 新增截图脚本 | `scripts/ui-snapshots.ts` |
| 新增验收文档 | `docs/ui-audit/known-issues.md`、本报告 |
| 基线截图和元数据 | `docs/ui-audit/baseline/`：44 PNG、manifest.json、catalog.json、admin-catalog.json |
| 复拍和比较证据 | `docs/ui-audit/phase1/`：44 PNG、2 张 diff.png、44 份 styles.json、manifest.json、css-metrics.json、pixel-analysis.json、固定模型目录 JSON |
| 更新运行方式和记录 | `README.md`、`docs/CHANGELOG.md` |

职责：tokens 放亮暗及局部自定义变量；base 放排版、通用表单/按钮/模型选择器/图标/提示；layout 放顶栏、页面框架、产品抽屉；home 放首页任务卡；gallery 放 SKU 列表；chat 放消息、规划确认与执行进度；canvas 放节点、工具条、图片预览、蒙版、扩图；library 放库浏览、详情、采集及品牌原型；admin 放后台和审核配置。隐藏原型的样式仍保留，没有改变显隐规则。

### CSS 文件数与体积

UTF-8 源文件大小，不含 vendor、构建缓存和截图。`globals.css` 完全未改。

| 范围 | 重组前 | 重组后 | 变化 |
| --- | --- | --- | --- |
| creative 自有 CSS 文件数 | 8 | 9 | 按要求拆为 9 个职责文件 |
| creative 自有 CSS 源码 | 105,175 B | 122,239 B | +17,064 B（+16.22%） |
| src 全部 CSS 文件数（含 globals） | 9 | 10 | +1 |
| src 全部 CSS 源码 | 144,112 B | 161,176 B | +17,064 B |
| globals.css | 38,937 B | 38,937 B | 0 |
| 生产构建 creative CSS 块（含 React Flow） | 114,828 B | 112,724 B | −2,104 B（−1.83%） |
| 生产构建全局 CSS 块 | 109,885 B | 109,885 B | 0 |

源码增加来自分组、逐规则展开、逗号选择器按职责拆分与 TODO 注释，未以压缩源码换取体积数字。构建产物去掉注释并压缩后实际减少。每文件明细及静态核对见 [css-metrics.json](phase1/css-metrics.json)。

### 层叠处理依据

- 相同选择器/相同媒体条件的每个属性保留原来胜出的值及 important 优先级。重排后逐项检查这些键，未新增属性键或更改声明值。
- 两个显式删除例外：`.p-topbar-title strong` 的旧 `font-weight:550` 原来被后面的 `.p-app strong {font-weight:500}` 覆盖；`.p-admin-nav h2` 的旧 `font-size:16px` 原来被后面的 `.p-app h2 {font-size:18px}` 覆盖。去掉这两个旧声明，恢复原本最终的 500 字重和 18px 标题，未把它们改成阶段 2 的新规范。
- 将 `.r1-output-*`、`.r1-size-line` 与首页任务卡放在同一模块，保留白底主图的原有 object-fit/background 层叠。
- 同选择器的互补分段不等于重复值：例如 padding 与后续 padding-inline、普通规则与响应式条件，移动可能影响其他选择器。不能确认安全合并时按要求保留并注释。CSS 注释使用合法的 `/* TODO 待确认 */`，不使用会破坏 CSS 语法的裸 `//`。

## 3. 截图基线与对比

### 采样方法

```powershell
# 基线：必须处于 a1e3f51；首次建立时执行
node --import tsx scripts/ui-snapshots.ts --mode=baseline

# 重组后复拍与比较
node --import tsx scripts/ui-snapshots.ts --mode=compare

# 额外对照：同一 DOM 临时切回 git 中的原始 CSS，比较21项计算属性
node --import tsx scripts/ui-snapshots.ts --mode=compare --diagnose

# 后续阶段复用上一轮结果
node --import tsx scripts/ui-snapshots.ts --mode=compare --baseline=docs/ui-audit/phase1 --output=docs/ui-audit/phase2
```

截图使用当前本地应用和既有管理员登录；商品/对话/库/画布为浏览器固定夹具，不创建 SKU、不写商品或库。所有业务非 GET 请求均被阻止，画布 PUT 仅更新浏览器内存；鉴权请求正常完成。模型目录只读取得并冻结用于后续比较，不发起模型请求。

固定语言、时区、设备像素比和日期；每图使用独立上下文。屏幕为 1440×1000 / 390×844，普通页面 fullPage，工作台按视口。图片解码完成后截图；关闭截图动画和光标，等待现有缩放/悬停回落结束；首页打字机固定在第15次自然更新。未遮挡或裁掉 UI 元素。

先在 CSS 未修改时完成初版44张基线；发现动态缩放及悬停导致采样波动后，恢复 a1e3f51 的8份原 CSS和原引入链并重新构建，用稳定脚本重采44张。确认原版重复采样后才恢复最终重组版。正式提交的 baseline 即最后这组原版截图，manifest 标记原始提交。首次采样和中间尝试只留在 git 忽略的本地验证目录中。

比较为 RGBA 逐像素严格比较：任意通道不同即计为差异，不忽略抗锯齿、不提高颜色容差、不使用遮罩。差异率＝差异像素 / 总像素。差分图以红色标出差异。原始结果见 [baseline manifest](baseline/manifest.json) 和 [phase1 manifest](phase1/manifest.json)。

### 全部44张结果

文件名统一为 `<状态>-<light|dark>-<1440|390>.png`。

| 状态 | 亮1440 | 暗1440 | 亮390 | 暗390 |
| --- | --- | --- | --- | --- |
| 首页 home | 0% | 0% | 0% | 0% |
| SKU列表 skus | 0% | 0% | 0% | 0% |
| 工作台空画布 workspace-empty | 0% | 0% | 0% | 0% |
| 工作台有图 workspace-images | 0% | 0% | 0% | 0% |
| 单选 workspace-single | 0% | 0% | 0% | 0% |
| 多选 workspace-multi | 0% | 0% | 0% | 0% |
| 蒙版编辑 workspace-mask | 0.13368% | 0.07000% | 0% | 0% |
| 扩图弹窗 workspace-expand | 0% | 0% | 0% | 0% |
| 产品卡抽屉 workspace-product | 0% | 0% | 0% | 0% |
| 资料库 library | 0% | 0% | 0% | 0% |
| 后台 admin | 0% | 0% | 0% | 0% |

### 超过0.1%的逐条解释

仅 **workspace-mask-light-1440：0.1336806%（1925 / 1,440,000 像素）**。

- [基线图](baseline/workspace-mask-light-1440.png)、[复拍图](phase1/workspace-mask-light-1440.png)、[差分图](phase1/workspace-mask-light-1440.diff.png)。
- 全部1925个差异像素的 RGBA 最大通道差都只有 **1/255**，没有任何差异像素超过1；范围 x=814–1439、y=327–670，集中于180%编辑取景下图片边缘的栅格化。工具条、文字、画笔颜色和主要画面一致。
- 在同一状态将样式切换为 a1e3f51 原版后，逐元素比较字号、字重、颜色、宽高、边框、outline、transform等21项视觉属性，无差异。四十四个状态的同类核对均为空列表，证据为 `phase1/*.styles.json`。
- 原始 CSS 自身重复采样也出现过量化波动（暗色首页31,733个像素，其中31,316个通道差仅1；暗色蒙版25个像素）。本轮没有修改业务或图片处理来消除渲染量化，也没有把1/255噪声排除出统计，因此保留严格原始差异率并在此解释。

暗色1440蒙版的1008个差异像素同样全部最大通道差1，差异率0.07%，低于阈值。[差分图](phase1/workspace-mask-dark-1440.diff.png)。逐像素分布见 [pixel-analysis.json](phase1/pixel-analysis.json)。

## 4. 检查命令及结果

| 命令 / 检查 | 修改前 | 最终重组后 |
| --- | --- | --- |
| npm run lint | 阶段0通过 | 通过，exit0 |
| npm run typecheck | 阶段0通过 | 通过；专用Agent结束后再次执行，恢复普通类型入口 |
| npm run build | 原版构建通过 | 通过；Next.js安全提醒中断后原命令重跑成功 |
| npm run test:units | 阶段0：106通过 | 106通过、0跳过 |
| 现有5项数据库集成 | 阶段0未重跑 | 5通过、0跳过 |
| npm run test:e2e | a1e3f51：10通过、2按设计跳过 | 10通过、相同2项按设计跳过 |
| npm run test:agent:browser | 阶段0重跑2通过 | 首次被相同Next.js提示中断；原命令重跑2通过 |
| npm run test:generation | KI-001：阶段0实际0.03/预期0 | 本轮原样运行2次均exit0，未复现；保留已知问题，不宣称修复 |
| 截图 | 44张基线，状态检查无失败 | 44张复拍，状态检查无失败；42张0%，1张0.07%，1张0.13368%，均已解释 |
| 计算样式对照 | 原始CSS作参照 | 44状态×每元素21项，均无差异 |
| 类名 / token检查 | 原408类名 | 仍408，缺失0、新增0；tokens仅自定义变量 |

数据库集成执行：

```powershell
$env:VISUAL_REVIEW_TEST_MODE='true'
node --conditions=react-server --import tsx --test tests/integration/canvas.test.ts tests/integration/image-models.test.ts tests/integration/visual-plan.test.ts tests/integration/task11c.test.ts tests/integration/review-scoring.test.ts
```

它们使用临时测试对象并清理，不调用真实模型。普通浏览器跳过的两项仍是 `tests/agent.spec.ts` 快速整套和手动逐张，已在专用隔离 mock 命令下补跑，不属于路由失效。专用测试中既有 React script 标签警告仍会出现；本轮未改业务处理它。

完整终端日志在 `.local/verification/ui-phase1/`（忽略、不提交），关键结果及失败边界已在本文保留。没有新增未解决的测试失败。

## 5. 与指令不符之处、取舍和待确认事项

- “失败状态不变”本轮无法按字面复现：KI-001原样跑两次均通过。相关实现、断言、费用和队列都未改，记录继续保留；不为制造相同失败而修改测试或业务。后续按原命令继续复查。
- 源码体积增加16.22%，原因是职责拆分与可读格式/TODO，而非新增样式值；生产CSS块反而减少1.83%。没有承诺源码压缩，完整数据如上。
- `TODO`保留的是存在层叠依赖的互补分段，并非重复的同属性旧值；不确定时依照任务要求保留。未删除仍被引用的类名、组件或导出。
- 原指令把加载状态称作转圈、把Controls视为待删组件；实际加载节点是既有shimmer，自定义缩放控件已存在。阶段1未改这些交互，仍以阶段0核实结果为准。
- 本阶段按用户明确要求制作截图；未制作录屏或GIF。没有新增运行时依赖，没有更改功能开关，也没有提前实施阶段2/3。
- 阶段2已记下：lint:ui采用“基线白名单+禁止新增”，存量按模块清理；小于12px的字号提升到12px，不删除。尚未实施。

请审阅本阶段报告和截图；停在阶段1，不自动进入阶段2。
