# UI阶段2b：旧视觉迁移

前置修正已独立提交：`7845094`（ui(phase2a-fix)）。2b起点为该提交；旧页参照修正后的`phase2a-studio`，creative仍对照`phase2a`。本报告的严格差异没有用位移对齐或区域裁切替代。未推送；完成后停在2b，不进入阶段3。

## 1. 改动摘要

1. 前置36张修改前复拍、36张修正后复拍和逐页原因已随7845094提交，见[前置报告](phase2a-studio.md)。KI-002已登记初始化GET竞态、networkidle等待及没有削弱断言。
2. 删除18个纸色HEX定义及其radius覆盖；214处其余固定色声明改语义变量，纸色、Georgia和宋体规则退出旧页。核心变量只在纯旧页/登录页启用，不覆盖嵌套creative。
3. globals全部49处小字号升到12px；网关路由small另补实际默认10.4px→12px。工作台字体、登录标题600、tabular-nums落地。
4. .pack-final的important移除，改.generation-card.pack-final双类选择器；没有重组页面或改业务功能。
5. lint:ui白名单287→6，globals的232项HEX和49项小字均清零，剩余6项全是商品/品牌数据色。
6. 36个旧页状态、4个长文本Agent卡片夹具状态完成text-metrics；18个暗色状态可见可操作文字最低5.01:1。登录/用户页axe无serious/critical违规。
7. creative保留44张对存档的严格对比；追加原23e8fbc源码当日隔离构建44张及4张原版蒙版重复拍摄，明确区分环境差异、蒙版渲染波动和混合后台的有意变化。
8. lint:ui、lint、typecheck、build、106单元、5数据库集成、生成模拟、常规e2e和专用Agent回归均执行；见验收表。没有改费用、队列、熔断、网关、鉴权或模型调用业务。

## 2. 文件清单

- 样式：`src/app/globals.css`、`src/styles/creative/tokens.css`。保留creative原有变量值；增加旧页专用作用域。全局Tailwind的muted-foreground映射保持原来指向。
- 检查/截图：`scripts/ui-lint-baseline.json`收紧；`scripts/ui-snapshots.ts`、`scripts/ui-snapshots-studio.ts`扩展对比、文本边界/axe、来源信息和卡片夹具；新增`scripts/ui-studio-audit.ts`。未新增运行时依赖；studio子套件透传失败退出码，audit发现文字/占位文字对比度、边界或严重axe违规会失败，避免只落盘却误报通过。
- 测试：`tests/product.spec.ts`把警告背景颜色的精确断言从旧fff3cf改为语义fff5dd，没有删除颜色检查；`tests/auth.spec.ts`只在辅助退出导航后等networkidle，退出与重登断言保持。
- 文档：README、CHANGELOG、design-system、known-issues、本报告，以及下述截图/JSON证据。所有本地原始日志在`.local/verification/ui-phase2b/`，不提交密钥、登录状态或.env。

## 3. 语义变量、字体及规则变化

### 原纸色变量逐项前后值

以下适用于8个纯旧页/登录页，旧亮暗均被最后的纸色root覆盖。混合`/admin/models`的核心变量原本由p-app控制，本轮保持；只给外壳专用变量和暗色表头修正。

| 变量 | 旧亮/暗值 | 2b亮色 | 2b暗色 |
| --- | --- | --- | --- |
| --background | #f6f5f1 | #fff | #0e0e10 |
| --foreground | #292b27 | #18181b | #fafafa |
| --card | #fffefa | #fff | #16161a |
| --card-foreground | #292b27 | #18181b | #fafafa |
| --popover | #fffefa | #fff | #1e1e23 |
| --popover-foreground | #292b27 | #18181b | #fafafa |
| --primary | #3b493d | #1f3a2e | #fafafa |
| --primary-foreground | #fffefa | #fff | #18181b |
| --secondary | #eeeee7 | #f4f4f5 | #26262c |
| --secondary-foreground | #484e42 | #18181b | #fafafa |
| --muted | #efeee8 | #f7f7f8 | #1e1e23 |
| --muted-foreground | #7a7c72 | #52525b | #a1a1aa |
| --accent | #e9ece4 | #f4f4f5 | #26262c |
| --accent-foreground | #3b493d | #18181b | #fafafa |
| --destructive | #b44932 | #bc3f40 | #f1a1a1 |
| --border | #e0e1d8 | #d1d1d6 | #52525b |
| --input | #dedfd5 | #71717a | #71717a |
| --ring | #839678 | #1f3a2e | #6c907d |
| --radius | .6rem | .75rem | .75rem |

旧页字体变量：`--font-body`由Microsoft YaHei UI/PingFang SC/Microsoft YaHei/sans-serif改为Segoe UI/PingFang SC/Microsoft YaHei UI/system-ui/sans-serif；仅旧页启用。creative及不含旧页的基础字体映射保持2a解析。

| 新增旧页专用变量 | 亮色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| --studio-muted-ink | #52525b | #a1a1aa | 辅助文字，旧壳也可使用 |
| --studio-brand-ink | #1f3a2e | #a8cbb7 | 选中/品牌文字 |
| --studio-selection-wash | #eaf1ed | #21342b | 状态/选中底色 |
| --studio-danger-wash | #fce9e9 | #3a2024 | 失败状态底色 |
| --studio-warning-wash | #fff5dd | #332b1c | 警告表面 |
| --studio-warning-ink | #80570e | #e9cb8e | 备用/提醒文字 |
| --studio-shadow | #18181b30 | #00000060 | 旧对话框阴影 |
| --studio-overlay | #18181b80 | #00000080 | 旧遮罩 |
| --studio-control-line | #71717a | #71717a | 混合后台搜索边框 |
| --studio-input-surface | var(--card) | var(--card) | 旧输入表面；creative保留2a共享Input的fffefa值 |

214处声明的每条原值、最终变量和原位置见[完整迁移数据](phase2b-style-migration.json)。部分border/input比creative更清晰，是旧页可读性变量，不改creative边框。

### 字体与终稿边框

- 登录h1：clamp(36px,3.8vw,58px)/400→同clamp/600；原1100宽42px、760宽34px媒体规则保留。去SimSun/Songti/Georgia，使用工作台字体。
- 旧brand-symbol、pack-number、note-number去Georgia；后两者及旧页外壳增加tabular-nums。creative品牌原型.w-brand-logo继续保留Georgia。
- [49处字号前后表](phase2b-small-fonts.md)列出每个原选择器和8/9/10/11px→12px；没有删除规则或缩回字号。
- .generation-card原普通边框为1px单类规则；未发现后续important覆盖。改用.generation-card.pack-final（双类）指定2px选中边框，优先级高于普通边框，故无需important。真实页面内的只读DOM样式探针（非真实终稿）亮暗均验证2px及对应ring色，见[边框证据](phase2b-final-border.json)。

## 4. 截图与逐项核查

### 旧页：36张对修正后2a基线

命令：`node --import tsx scripts/ui-snapshots.ts --suite=studio --mode=compare --baseline=docs/ui-audit/phase2a-studio --output=docs/ui-audit/phase2b-studio --allow-size-change --audit`。

| 状态 | 严格差异% | ±8px对齐差异% | 偏移px | 变化原因 |
| --- | --- | --- | --- | --- |
| login-light-1440 | 99.99861 | 99.99861 | 0 | 米白/纸色改语义表面；标题去宋体并改600，保留clamp和既有媒体字号；提示文字提升至12px。 |
| product-light-1440 | 99.58543 | 93.23468 | 8 | 编辑、实拍、历史、二次编辑等旧类名改语义色；小字12px；原照片内容保留，暗色图片白底不当作UI残留。 |
| agent-light-1440 | 99.98889 | 99.86682 | 8 | 旧策划/图包面板与消息卡改语义表面，字号12px、装饰数字tabular；保留内部滚动与既有结构。 |
| admin-light-1440 | 99.99889 | 99.99889 | 0 | 外壳与管理卡改语义色，标题/辅助字/按钮恢复暗色对比。 |
| users-light-1440 | 99.99857 | 99.99728 | 3 | 表单/列表/角色/配额/日期改语义色与12px；自然换行，没有缩字号。 |
| gateways-light-1440 | 100.00000 | 100.00000 | 0 | 卡片/路由/状态改语义色；默认small实际10.4px补为12px；含近24小时统计的实时数据差异。 |
| models-light-1440 | 7.28731 | 7.28731 | 0 | 混合路由：旧外壳迁移；暗色5列表头从3.73:1提亮；搜索占位文字及边框使用旧页可读性变量；模型表980px最小宽及内部横向滚动保留。 |
| templates-light-1440 | 100.00000 | 100.00000 | 0 | 占位页面保留结构；标题、说明、边框和主按钮改语义色/字号。 |
| forbidden-light-1440 | 100.00000 | 100.00000 | 0 | 403页保留结构；提示/返回按钮/边框改语义色。 |
| login-dark-1440 | 100.00000 | 100.00000 | 0 | 米白/纸色改语义表面；标题去宋体并改600，保留clamp和既有媒体字号；提示文字提升至12px。 |
| product-dark-1440 | 99.58687 | 93.23996 | 8 | 编辑、实拍、历史、二次编辑等旧类名改语义色；小字12px；原照片内容保留，暗色图片白底不当作UI残留。 |
| agent-dark-1440 | 99.98902 | 99.86698 | 8 | 旧策划/图包面板与消息卡改语义表面，字号12px、装饰数字tabular；保留内部滚动与既有结构。 |
| admin-dark-1440 | 100.00000 | 100.00000 | 0 | 外壳与管理卡改语义色，标题/辅助字/按钮恢复暗色对比。 |
| users-dark-1440 | 100.00000 | 100.00000 | 0 | 表单/列表/角色/配额/日期改语义色与12px；自然换行，没有缩字号。 |
| gateways-dark-1440 | 100.00000 | 100.00000 | 0 | 卡片/路由/状态改语义色；默认small实际10.4px补为12px；含近24小时统计的实时数据差异。 |
| models-dark-1440 | 7.45891 | 7.45891 | 0 | 混合路由：旧外壳迁移；暗色5列表头从3.73:1提亮；搜索占位文字及边框使用旧页可读性变量；模型表980px最小宽及内部横向滚动保留。 |
| templates-dark-1440 | 100.00000 | 100.00000 | 0 | 占位页面保留结构；标题、说明、边框和主按钮改语义色/字号。 |
| forbidden-dark-1440 | 100.00000 | 100.00000 | 0 | 403页保留结构；提示/返回按钮/边框改语义色。 |
| login-light-390 | 100.00000 | 99.99701 | 6 | 米白/纸色改语义表面；标题去宋体并改600，保留clamp和既有媒体字号；提示文字提升至12px。 |
| product-light-390 | 99.96048 | 99.92886 | 8 | 编辑、实拍、历史、二次编辑等旧类名改语义色；小字12px；原照片内容保留，暗色图片白底不当作UI残留。 |
| agent-light-390 | 99.99459 | 99.99208 | 8 | 旧策划/图包面板与消息卡改语义表面，字号12px、装饰数字tabular；保留内部滚动与既有结构。 |
| admin-light-390 | 99.99883 | 99.98804 | 8 | 外壳与管理卡改语义色，标题/辅助字/按钮恢复暗色对比。 |
| users-light-390 | 99.99822 | 99.99352 | 7 | 表单/列表/角色/配额/日期改语义色与12px；自然换行，没有缩字号。 |
| gateways-light-390 | 100.00000 | 100.00000 | 0 | 卡片/路由/状态改语义色；默认small实际10.4px补为12px；含近24小时统计的实时数据差异。 |
| models-light-390 | 18.80881 | 11.67409 | 3 | 混合路由：旧外壳迁移；暗色5列表头从3.73:1提亮；搜索占位文字及边框使用旧页可读性变量；模型表980px最小宽及内部横向滚动保留。 |
| templates-light-390 | 100.00000 | 100.00000 | 0 | 占位页面保留结构；标题、说明、边框和主按钮改语义色/字号。 |
| forbidden-light-390 | 100.00000 | 100.00000 | 0 | 403页保留结构；提示/返回按钮/边框改语义色。 |
| login-dark-390 | 100.00000 | 100.00000 | 0 | 米白/纸色改语义表面；标题去宋体并改600，保留clamp和既有媒体字号；提示文字提升至12px。 |
| product-dark-390 | 99.96255 | 99.93068 | 8 | 编辑、实拍、历史、二次编辑等旧类名改语义色；小字12px；原照片内容保留，暗色图片白底不当作UI残留。 |
| agent-dark-390 | 99.99482 | 99.99222 | 8 | 旧策划/图包面板与消息卡改语义表面，字号12px、装饰数字tabular；保留内部滚动与既有结构。 |
| admin-dark-390 | 100.00000 | 100.00000 | 0 | 外壳与管理卡改语义色，标题/辅助字/按钮恢复暗色对比。 |
| users-dark-390 | 100.00000 | 100.00000 | 0 | 表单/列表/角色/配额/日期改语义色与12px；自然换行，没有缩字号。 |
| gateways-dark-390 | 100.00000 | 100.00000 | 0 | 卡片/路由/状态改语义色；默认small实际10.4px补为12px；含近24小时统计的实时数据差异。 |
| models-dark-390 | 18.89879 | 11.86424 | 3 | 混合路由：旧外壳迁移；暗色5列表头从3.73:1提亮；搜索占位文字及边框使用旧页可读性变量；模型表980px最小宽及内部横向滚动保留。 |
| templates-dark-390 | 100.00000 | 100.00000 | 0 | 占位页面保留结构；标题、说明、边框和主按钮改语义色/字号。 |
| forbidden-dark-390 | 100.00000 | 100.00000 | 0 | 403页保留结构；提示/返回按钮/边框改语义色。 |

### 9个暗色页面

text-metrics将字号、可见文字、输入值/占位文字对比度、clientWidth/scrollWidth、控件边框和白底分类落盘；36状态的controlContrastFailures均0。对比度使用alpha合成后的实际颜色，即使大字也按4.5:1检查；sr-only/aria-hidden装饰/禁用控件按可访问性规则排除。没有对禁用文字声称4.5:1。白色主按钮和品牌标识是已确认的暗色设计，真实图片白底也不算UI残留。

| 页面 | 1440最低文字对比度 | 390最低文字对比度 | 白底残留/小字/溢出 | 人工确认 |
| --- | --- | --- | --- | --- |
| login | 6.48:1 | 6.48:1 | 均0 | 表面深色，文字、边框和表单可辨 |
| product | 5.01:1 | 5.01:1 | 均0 | 表面深色，文字、边框和表单可辨 |
| agent | 5.01:1 | 5.01:1 | 均0 | 表面深色，文字、边框和表单可辨 |
| admin | 7.04:1 | 7.04:1 | 均0 | 表面深色，文字、边框和表单可辨 |
| users | 7.04:1 | 7.04:1 | 均0 | 表面深色，文字、边框和表单可辨 |
| gateways | 5.15:1 | 5.15:1 | 均0 | 表面深色，文字、边框和表单可辨 |
| models | 5.87:1 | 5.87:1 | 均0 | 旧壳深底、表头可读、输入可辨；保留原表格内部横向滚动 |
| templates | 7.04:1 | 7.04:1 | 均0 | 表面深色，文字、边框和表单可辨 |
| forbidden | 7.04:1 | 7.04:1 | 均0 | 表面深色，文字、边框和表单可辨 |

登录和用户页在亮暗×1440/390均运行完整WCAG 2 A/AA、2.1 AA axe；dark serious/critical violations=0。其余页面运行color-contrast规则，违规同样为0。axe的incomplete保留在原始JSON：品牌单字符及部分滚动裁切区域由计算对比度和实际截图人工核查，不冒充自动通过。

[核查汇总](phase2b-checks.json)和每张`.text-metrics.json`均随截图提交。后台表格的既有980px最小宽与内部横向滚动属于creative组件原有结构，不是新小字号引起的溢出，本轮不重排表。

Agent长文本补充：`--suite=studio --mode=capture --output=docs/ui-audit/phase2b-agent-cards --probe-cards --audit`。4状态各捕获问题卡/档案卡（共8张局部截图，另有4张页面图）；真实组件通过浏览器GET夹具渲染，不提交、不写DB、不调用模型。4状态小字/文字横向溢出/页面横向溢出均0；保留档案字段的内部纵向滚动。

### creative：保留存档严格对比，再分离环境与代码

命令：`node --import tsx scripts/ui-snapshots.ts --mode=compare --baseline=docs/ui-audit/phase2a --output=docs/ui-audit/phase2b-creative --allow-size-change`。存档严格差异没有归零，主要是中文字形。不能仅凭“看起来一样”视作通过。

为排除代码影响，git archive原23e8fbc应用源码，独立构建并以3003端口运行，同一Chrome与当前截图脚本复拍44状态。原版源码/资源/配置320项经Git blob校验一致（仅归一Windows CRLF，见[来源校验](phase2b-creative-reference/provenance.json)）。原版复拍对存档产生同样中文字形差异；具体系统/浏览器字体变化未追溯，不猜测某次升级。38/40个非后台状态与当前2b PNG完全一致，SHA可核验。

| 状态 | 存档严格% | 存档对齐% | 同日原2a→2b严格% | 解释 |
| --- | --- | --- | --- | --- |
| home-light-1440 | 1.50412 | 1.50412 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| skus-light-1440 | 0.42646 | 0.42646 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-empty-light-1440 | 0.92833 | 0.92833 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-images-light-1440 | 1.51111 | 1.51111 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-single-light-1440 | 1.88368 | 1.88368 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-multi-light-1440 | 1.65715 | 1.65715 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-mask-light-1440 | 1.89063 | 1.89063 | 0.00118 | 桌面蒙版图层栅格/动画波动，原版自身重复对照也存在 |
| workspace-expand-light-1440 | 1.54083 | 1.54083 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-product-light-1440 | 2.65993 | 2.65993 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| library-light-1440 | 1.41882 | 1.41882 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| admin-light-1440 | 8.73645 | 8.73645 | 7.28862 | 混合旧壳迁移；搜索占位/边框与暗色表头可读性修正；窄屏旧壳高度+3px，非噪声 |
| home-dark-1440 | 1.50871 | 1.50871 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| skus-dark-1440 | 0.43028 | 0.43028 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-empty-dark-1440 | 0.92972 | 0.92972 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-images-dark-1440 | 1.51521 | 1.51521 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-single-dark-1440 | 1.84917 | 1.84917 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-multi-dark-1440 | 1.65187 | 1.65187 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-mask-dark-1440 | 1.80708 | 1.80708 | 0.60507 | 桌面蒙版图层栅格/动画波动，原版自身重复对照也存在 |
| workspace-expand-dark-1440 | 1.54340 | 1.54340 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-product-dark-1440 | 2.65424 | 2.65424 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| library-dark-1440 | 1.42444 | 1.42444 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| admin-dark-1440 | 8.83621 | 8.83621 | 7.46005 | 混合旧壳迁移；搜索占位/边框与暗色表头可读性修正；窄屏旧壳高度+3px，非噪声 |
| home-light-390 | 4.18993 | 4.18993 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| skus-light-390 | 1.56185 | 1.56185 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-empty-light-390 | 1.43881 | 1.43881 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-images-light-390 | 1.31912 | 1.31912 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-single-light-390 | 2.78649 | 2.78649 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-multi-light-390 | 1.77361 | 1.77361 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-mask-light-390 | 1.57310 | 1.57310 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-expand-light-390 | 1.61502 | 1.61502 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-product-light-390 | 5.12547 | 5.12547 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| library-light-390 | 5.90685 | 5.90685 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| admin-light-390 | 19.26002 | 13.66266 | 18.81147 | 混合旧壳迁移；搜索占位/边框与暗色表头可读性修正；窄屏旧壳高度+3px，非噪声 |
| home-dark-390 | 4.20375 | 4.20375 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| skus-dark-390 | 1.57522 | 1.57522 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-empty-dark-390 | 1.44702 | 1.44702 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-images-dark-390 | 1.32519 | 1.32519 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-single-dark-390 | 2.98274 | 2.98274 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-multi-dark-390 | 1.71740 | 1.71740 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-mask-dark-390 | 1.58069 | 1.58069 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-expand-dark-390 | 1.61259 | 1.61259 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| workspace-product-dark-390 | 5.09327 | 5.09327 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| library-dark-390 | 5.92447 | 5.92447 | 0.00000 | 当日原2a与2b像素完全一致；存档差异属环境渲染 |
| admin-dark-390 | 19.35199 | 13.81757 | 18.90123 | 混合旧壳迁移；搜索占位/边框与暗色表头可读性修正；窄屏旧壳高度+3px，非噪声 |

桌面蒙版再以原2a重复拍摄4状态：亮1440严格0.00292%，暗1440严格0.60451%，两张390均0%。当前2b相对原版为0.00118%/0.60507%，原版自身重复对照也有同量级约0.60%的波动；这不代表严格值低于0.1%。没有用对齐率替代阈值，也没有掩盖工具条、边框或蒙版。

原2a当日44张及4张蒙版重复图见`phase2b-creative-reference/`；[代码/环境逐项对照](phase2b-creative/code-comparison.json)保留全页与区域数据。

| 混合后台状态 | 内部p-app当日对比% | 说明 |
| --- | --- | --- |
| admin-light-1440 | 0.11002 | 搜索占位文字/边框的有意修正；窄屏旧外壳高度另增3px |
| admin-dark-1440 | 0.23934 | 5个表头及搜索占位/边框提亮，是旧页可读性要求导致的有意例外 |
| admin-light-390 | 0.36652 | 搜索占位文字/边框的有意修正；窄屏旧外壳高度另增3px |
| admin-dark-390 | 0.49799 | 5个表头及搜索占位/边框提亮，是旧页可读性要求导致的有意例外 |

**与“creative仅0%或噪声”的明确差别**：`/admin/models`本身在9旧页清单中，又包含creative组件。为满足其旧壳暗色及4.5:1要求，全页旧壳、搜索框与暗色表头必然变化；本轮选择实现这两项要求，并明确列出例外，未把它们说成噪声。其他creative应用代码无视觉改变的结论来自当日原2a源码对照，而不是放宽存档阈值。

## 5. 验收、例外与停止点

| 检查 | 结果 |
| --- | --- |
| npm run lint:ui | 通过；6项数据色匹配，0新增 |
| npm run lint | 通过，0错误0警告 |
| npm run typecheck | 通过；专用Agent退出后恢复普通next-env入口 |
| npm run build | 通过 |
| npm run test:units | 106通过 |
| 现有数据库集成5文件 | 5通过 |
| npm run test:generation | 通过；KI-001未复现，不宣称修复 |
| npm run test:e2e | 最终10通过、2专用Agent按设计跳过 |
| npm run test:agent:browser | 原命令重跑2通过 |
| 旧页截图/边界 | 36状态无拍摄失败；可见文本小字/横向溢出0 |
| Agent长文本夹具 | 4状态、8卡片局部截图；边界检查0失败 |
| 严格/对齐差异算法 | ±8px搜索仅在高度改变时执行；合成图识别3px，严格14.88372%/对齐6.97674%；阈值仍用严格值 |

数据库集成命令与阶段1相同：`VISUAL_REVIEW_TEST_MODE=true node --conditions=react-server --import tsx --test tests/integration/canvas.test.ts tests/integration/image-models.test.ts tests/integration/visual-plan.test.ts tests/integration/task11c.test.ts tests/integration/review-scoring.test.ts`。

回归中实际出现并处理的情况：

- 初次e2e的旧fff3cf颜色断言不再符合语义fff5dd；只更新为新精确色值，保留样式断言。
- 本机重启后worker离线使编辑按钮按原业务禁用。先只读确认活动任务为0，再启动已有worker；请求依旧在测试拦截，未发起真实生成。
- 最终重跑曾观察到一次auth辅助退出落回首页；检查到是在模板导航后立即退出，推测与会话读取交错有关，未据此宣称修复鉴权问题。只补networkidle等待，未修改鉴权、Cookie或退出/重登断言；完整重跑结果见上表。该行为不借用KI-001豁免。
- Next.js16.4安全提示在专用Agent首次宿主运行中断命令，原命令重跑成功；版本提示仍在，本轮未升级依赖。
- Windows沙箱阻止测试脚本结束其子进程，导致清理隔离库后仍有连接警告；仅清理本轮进程，改用可完成清理的宿主权限重跑，exit0。next-env类型文件占用经专用服务退出后重跑恢复。未改队列或鉴权处理环境问题。
- 原样式注入的首页计算值一致及原2a独立构建共同确认存档文字差异与2b代码无关；字体环境变化的具体来源未确认。

没有调用付费模型、没有改费用/队列/双网关/数据库结构、没有推送。前置修正和2b分别提交；停在2b，等待审阅。
