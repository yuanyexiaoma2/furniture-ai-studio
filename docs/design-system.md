# 家具创作工作台设计规范

本规范对应UI阶段2a。正式创作页为 `/`、`/skus`、`/workspace`、`/library`；`/admin/models` 使用相同创作组件并继承旧后台外壳。旧视觉迁移留到2b，布局与交互收口留到阶段3。

## 主题与颜色

creative配色唯一来源为 `src/styles/creative/tokens.css`。亮色由 `:root:has(.p-app)` 生效，暗色由 `:root.dark:has(.p-app)` 生效。封面、阴影、遮罩和品牌图形底色也在tokens中定义，数值沿用阶段1。

| 用途 | 亮色 | 暗色 |
| --- | --- | --- |
| 主按钮 --primary / foreground | #1f3a2e / #ffffff | #fafafa / #18181b |
| 聚焦 --ring / 选中 --p-selection | #1f3a2e | #6c907d |
| 页面背景 / 面板 | #ffffff / #ffffff | #0e0e10 / #16161a |
| 正文 / 辅助 | #52525b / #71717a | #a1a1aa / #71717a |

墨绿用于**亮色主按钮，以及全主题的选中、聚焦和品牌点缀**；暗色选中和聚焦使用提亮的墨绿#6c907d，主按钮保持白底深字。图片承担主要色彩，禁止大面积浅绿背景。状态色用于终稿、待处理、生成中、未开始的小点和角标。

task-cover.tsx、batch/brand.tsx、batch/workflow.tsx的商品变体或品牌色是数据，不是UI配色，由静态检查的数据白名单登记。旧globals的纸色和小字号作为2b存量白名单，禁止新增。

## 字体、字号与圆角

字体栈为 `"Segoe UI", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif`，不请求外部字体，不保留Inter声明。库摘要和评论使用工作台字体。`.w-brand-logo`属于品牌字体展示，保留Georgia和品牌字号25px，不作为UI排版档位。

| 变量 | 值 | 用途 |
| --- | --- | --- |
| --text-xs | 12px | 最小字号、角标 |
| --text-sm | 13px | 辅助 |
| --text-body | 14px | 正文、卡片 |
| --text-section | 16px | 区块标题 |
| --text-xl | 20px | 弹层标题 |
| --text-title | 28px | 页面标题 |
| --text-hero | 36px | 其他大标题 |
| --text-display | 40px | 首页主标题专用，600字重 |

数字用tabular-nums。9处旧task11字号从10/11提升到12px；旧globals的49处留到2b。画布14/zoom、12/zoom配合反向缩放，不按静态小字号违规处理。

| 变量 | 值 | 用途 |
| --- | --- | --- |
| --radius-tag | 6px | 小标签、角标 |
| --radius-control | 10px | 按钮、输入、普通卡片、图片节点 |
| --radius-panel | 16px | 浮层、弹窗、Frame、首页输入框 |
| --radius-pill | 999px | 胶囊与圆形容器 |
| --radius-bubble | 12px | 对称消息气泡专用例外 |

结构需要的0和inherit不算视觉档位。逐处前后值见 `docs/ui-audit/phase2a/style-changes.json`，Tailwind映射见class-changes.json。

## 图标

全站只从 `@/components/icons/concept-icons` 引入。sm=16px/线宽1.75，md=20px/1.5，lg=24px/1.5，默认sm；数字接口仍接受实际数字尺寸。工具条/侧栏/独立导航按钮使用md，文字旁sm，空状态lg。旧页面原本被fixed压到20px的大号调用显式保持md，避免提前放大旧空状态。

尺寸、线宽由组件控制，不用SVG important或局部SVG宽高覆盖。品牌SVG图片保持自身比例。Library和ContactRound映射到同名图形，Wand2统一WandSparkles，重复别名归并；原13个未使用导出保留。

| 动作 | 图标 |
| --- | --- |
| AI改图、整图再生成 | WandSparkles |
| 局部重绘 | Brush |
| 扩图 | Expand |
| 抠图 | ScanLine |
| 超清 | ZoomIn |
| 设为终稿 | Check |
| 下载 | Download |
| 对比 | Columns2 |
| 便签 | StickyNote |
| 删除 | Trash2 |
| 更多 | MoreHorizontal |

不因图标统一显示未接通入口，不新增超清功能。画布缩放ZoomIn/ZoomOut是视图操作，与模型超清入口区分。

## 当前布局及后续边界

当前顶栏62px，左栏宽屏640px/中屏560px/窄屏满宽，可收起；2a不调整。creative使用Radix版design-preview/ui，旧页保留Base UI版components/ui。

画布支持平移缩放、引用、布局/便签保存、多选、蒙版、扩图。生成接真实业务API，须确认方案与费用；模型目录来自后台配置。历史消息引用图目前只展示，尚不支持点击定位。加载保留现有shimmer。

阶段3待实施：左栏比较440/520/640三档再确定；将左侧工具和自定义缩放控件合并到底部/右下角；新增消息引用图点击定位；为shimmer叠加真实阶段文字。不存在React Flow默认Controls可删。两套button变体均需覆盖交互状态。

## 检查与验收

执行 `npm run lint:ui`。ui-lint-baseline.json以“签名+数量”保留旧globals及数据色值，常规检查不扩充白名单。新增十六进制色值、小于12px字号、SVG important、绕开入口的Lucide导入均失败；清理后人工收紧白名单。

creative参照docs/ui-audit/phase1，旧页2b参照baseline-studio。KI-001按偶发记录，不要求复现，但不能新增失败类型。2a结束后停止，待审阅才做2b。
