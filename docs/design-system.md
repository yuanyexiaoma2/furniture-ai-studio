# 家具创作工作台设计规范

本规范对应UI阶段3准备修正。正式创作页为 `/`、`/skus`、`/workspace`、`/library`；`/admin/models` 使用相同创作组件并继承旧后台外壳。仅提前移除用户批准的首页快捷意图标签；3a已完成，3b/3c尚未执行。

## 主题与颜色

creative配色唯一来源为 `src/styles/creative/tokens.css`。亮色由 `:root:has(.p-app)` 生效，暗色由 `:root.dark:has(.p-app)` 生效。封面、阴影、遮罩和品牌图形底色也在tokens中定义；准备修正按用户舒适度要求更新暗色层级、主文字、输入区和任务遮罩，不统一产品名称或Logo。

| 用途 | 亮色 | 暗色 |
| --- | --- | --- |
| 主按钮 --primary / foreground | #1f3a2e / #ffffff | #fafafa / #18181b |
| 聚焦 --ring / 选中 --p-selection | #1f3a2e | #6c907d |
| 页面背景 / 面板 | #ffffff / #ffffff | #141416 / #1b1b1e |
| 浮层 / 主文字 | #ffffff / #18181b | #222226 / #ececee |
| 正文 / 辅助 | #52525b / #71717a | #a1a1aa / #a1a1aa |
| 输入边框 --input | #8b8b94 | #71717a |
| 分隔线 --border（非控件轮廓） | #e4e4e7 | 白色8% |
| 首页/对话输入表面 / 边框 | #fff / #ececee | #1f1f22 / 白色6% |

墨绿用于**亮色主按钮，以及全主题的选中、聚焦和品牌点缀**；暗色选中和聚焦使用提亮的墨绿#6c907d，主按钮保持白底深字。图片承担主要色彩，禁止大面积浅绿背景。状态色用于终稿、待处理、生成中、未开始的小点和角标。

task-cover.tsx、batch/brand.tsx、batch/workflow.tsx的商品变体或品牌色是数据，不是UI配色，由静态检查的数据白名单登记。旧globals的232项HEX与49项小字号白名单在2b已清零；当前只保留6项数据色。

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

数字用tabular-nums。9处旧task11字号从10/11提升到12px；旧globals的49处在2b均提升为12px，网关路由small的默认0.8em另显式指定12px。画布14/zoom、12/zoom配合反向缩放，不按静态小字号违规处理。

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

3a已实施：单图工具条固定36px高、md图标，AI/普通操作分组，靠近画布顶部翻至下方；长条在窄画布内单行横向滚动，键盘Tab可访问后部操作。像素角标读取原图naturalWidth/Height，长边不足2000显示待处理色点。多选为数量/对比/下载/删除。底部居中集中选择、平移、便签、上传、布局撤销/重做、图层与历史；右下角为缩放菜单、适应、帮助及默认收起的小地图。移动端分成两行。撤销只作用于布局、便签和隐藏，产品切换/服务器新增节点后重置历史；不回退生成、终稿或费用。shimmer只叠加真实排队/生成阶段，失败原因和重试复用原动作。

3b/3c待实施：左栏比较440/520/640三档再确定；新增消息引用图点击定位；两套button变体覆盖交互状态。不存在React Flow默认Controls可删。

## 交互状态

小控件使用2px外描边；大型输入面板聚焦无视觉变化。首页、真实对话及旧工作流控制台输入面板共用composer变量，圆角20px，聚焦前后边框、底色、投影均不变，内部textarea调用处显式取消border/shadow及focus ring/outline，仅保留光标，不改共享Textarea组件。首页dropzone关闭键盘接管，外层无tabIndex，拖拽和添加按钮保持可用。亮色为白底、1px #ececee边框和0 4px 24px黑色6%投影；暗色为#1f1f22底、1px白色6%边框且无投影。底栏智能体模型、生图模型和联网按钮常态显示secondary浅灰胶囊底色（亮暗主题均有），悬停沿用p-hover；发送按钮保持圆形。其他按钮、开关和登录输入框的聚焦样式不变。

## 检查与验收

执行 `npm run lint:ui`。ui-lint-baseline.json以“签名+数量”保留6项商品/品牌数据色值，常规检查不扩充白名单。新增十六进制色值、小于12px字号、SVG important、绕开入口的Lucide导入均失败；清理后人工收紧白名单。

阶段3的唯一creative基线为docs/ui-audit/baseline-phase3（已审阅1e6e4bf原版44张）。比较前严格核对Chrome版本、操作系统和字体文件路径/SHA256；不一致时必须重拍原版，不输出差异率。旧页仍保留对phase2b-studio的严格比较；它没有历史字体指纹，显式使用baseline-phase3作本轮环境锚点，不伪造历史字体信息。KI-001按偶发记录；KI-002/003保留初始化竞态待办。本轮3a完成后停止，不进入3b/3c；对比沿用已审阅phase3-prep-fix结果并单列fix2变化。

## 旧页面视觉（2b）

旧页/登录页的root按是否包含studio-shell、login-shell启用；嵌套p-app时不覆盖creative核心变量。亮色白底与墨绿主按钮、暗色深底与白色主按钮。阶段3准备删除同值的studio-muted-ink、studio-control-line，分别改读p-text、input，旧页实际色值不变。警告/危险底色、品牌文字色及不同强度的遮罩/阴影继续保留。主题默认声明只作用于:root.dark，避免React Flow内层.dark重置已验证的变量。全局Tailwind语义映射保留原值。

共享Input表面为card；studio-input-surface兼容别名也指向card。对比度按alpha合成后的实际颜色审计，图片/渐变文字另用文字隐藏后的背景采样；不以axe的incomplete代替通过。普通启用文字最低4.5:1，普通输入边界最低3:1。用户已确认的亮暗两主题首页/对话复合区，静止线仅为装饰，通过浮层底色、placeholder和发送按钮识别，按用户新规范聚焦无视觉变化，内部textarea无outline/ring；该例外不豁免其他输入。任务卡只用单层满幅渐变，标签在遮罩上方，无矩形文案底衬。原准备证据见phase3-prep.md，本轮当前结果见phase3-prep-fix.md。

## 准备修正的内容轴与表单

content-max-list为1200px（SKU/模板库），content-max-home为960px（首页输入/任务）；内容安全边距桌面24px/手机18px。首页实际宽度min(100%,clamp(720px,52vw,960px))，输入20px 24px内边距、textarea至少120px/16px；大型输入面板圆角20px为明确例外。标题区顶部18vh，输入到任务标题约64px。Tab角标和快捷标签移除，Tab补全保留。placeholder为完整静态文案，Tab补全保留；3a工具栏另行实施。

SKU封面4:3、10px圆角；已选主图优先，白底四角检测命中用contain加muted纯色留白，其余cover；悬停只缩放图片1.02。模板库导入区padding24，标题上下间距4/8，标题字号/字重沿用20px/500。原生目录input、details/summary语义不变，summary图标展开旋转90°。登录左右标题600/foreground，空字段按钮可点击，仅在表单UI层做行内校验，鉴权调用不变。产品名/Logo位置清单见修正报告，等待用户选择。

登录标题保留原clamp(36px,3.8vw,58px)及既有42/34px媒体规则，改为工作台字体/600。旧品牌标记、pack-number、note-number去Georgia/宋体，装饰数字采用tabular-nums；不影响creative品牌原型的Georgia。终稿使用.generation-card.pack-final双类选择器覆盖普通边框，不用important。

/admin/models是混合路由，其旧外壳迁移、搜索占位与边框加强、暗色表头由3.73:1提亮至达标，是creative全页对比的明确例外；报告同时保留全页严格差异和.p-app区域差异。其余creative变化需用原2a源码的当日隔离复拍核对，不能以对齐率或“噪声”掩盖代码变化。

## 样式小改动的验收

纯样式小改动（颜色、圆角、间距、边框）只跑lint和build，不截图、不做像素对比、不跑完整回归。改交互、改布局结构或阶段结束时才做完整验收。
