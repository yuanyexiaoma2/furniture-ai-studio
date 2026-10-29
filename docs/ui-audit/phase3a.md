# 阶段3a · 画布浮层收口

## 1. 改动摘要

### 先单独完成的fix2

提交：01c7336（未推送）。任务卡上半55%无遮罩，标签独立黑55%小底衬，暗色图片0.94；图包移除沙发底图。首页静态placeholder保留Tab；登录左边距clamp。大型输入边框原地变色加柔和光晕，取消双层框。CR-001登记并承诺后续接口先询问。

10张指定页面+8张聚焦态见phase3-prep-fix2及phase3-prep-fix2-focus；白字38954个栅格点最低6.01:1，边框前后亮3.65/暗3.29:1，光晕不裁切，无布局位移。另用同视口重拍10张至phase3a-fix2-check：全部严格0%，证明3a未继续改动这组页面。

### 本轮3a

- 单图工具条整体36px、图标md20，AI/普通操作分组；不随缩放，按画布上缘64px空间翻转；翻转时放在像素角标下方，几何断言确保相隔至少8px。窄画布单行横向滚动，保留全部动作和SHOW_UNCONNECTED_FEATURES逻辑。
- 单选读取图片naturalWidth/Height，不足2000长边显示待处理色点和文字。960×720夹具与数据库2048×1536元数据不一致时仍显示真实960×720。多选切换数量/对比/下载/移除。
- 选择、平移、便签、上传、布局撤销重做、图层和历史集中到底部；右下角集中缩放/适应/帮助/小地图。地图默认收起。移动端分成两排，检查无重叠；帮助提示抬到工具条上方。
- 50步前端布局撤销重做只保存位置/便签/隐藏；套用最新服务端节点数据。产品切换、新结果注册或远端布局恢复后重置历史；不还原生成、终稿、费用或视口。仍由原PUT布局接口保存。
- 保留shimmer；只显示pending排队中、running生成中。错误显示已有服务端原因，重试沿用regenerate/job-id→原settings/retry调用。修正失败占位的更多按钮遮挡重试。
- 完整axe发现原蒙版滑杆的名称只放在根span：现移到实际slider thumb，UI及蒙版算法不变。旧测试缩放断言仅由旧文本类改为新菜单按钮，70%数值、恢复及持久化断言保留。

### 原入口 → 新位置

| 原入口 | 新位置 |
|---|---|
| 左侧选择V、平移H | 底部居中前两项，V/H及空格平移保留 |
| 左侧便签N、上传Ctrl/⌘+O | 底部便签、上传；快捷键保留 |
| 展开对话（收起后出现） | 底部居中首项；手机原对话/画布页签保留 |
| 原底左图层/历史 | 底部居中末两项；仍打开原面板 |
| 撤销/重做（新增布局历史） | 底部中段，Ctrl/⌘+Z、Shift+Z或Y |
| 右下放大/缩小 | 缩放百分比菜单内，另有25/50/75/100/150/200%与适应窗口 |
| 原适应屏幕 | 右下独立按钮及缩放菜单 |
| 原右上帮助/参考拾取提示 | 右下帮助按钮与其上方提示；初次帮助逻辑保留 |
| 原默认展开小地图 | 右下开关，默认收起；打开后可拖动/缩放 |
| 布局保存状态/失败重载 | 原有保存逻辑，画布左下状态；不丢失错误处理入口 |

## 2. 改动文件清单

- `README.md`
- `docs/CHANGELOG.md`
- `docs/design-system.md`
- `docs/ui-audit/phase3-prep-fix2.md`
- `scripts/ui-canvas-check.ts`
- `scripts/ui-snapshots.ts`
- `src/components/design-preview/app.tsx`
- `src/components/design-preview/canvas-layout-history.ts`
- `src/components/design-preview/canvas.tsx`
- `src/components/design-preview/live-store.ts`
- `src/components/design-preview/store.ts`
- `src/components/design-preview/ui/slider.tsx`
- `src/components/design-preview/use-canvas-history.ts`
- `src/components/icons/concept-icons.ts`
- `src/styles/creative/canvas.css`
- `tests/canvas.spec.ts`
- `tests/unit/canvas-ui.test.ts`
- 本报告及截图/审计目录：docs/ui-audit/phase3a{,-new,-studio,-fix2-check}/，目录内manifest列出每一文件与哈希。

## 3. 截图对比路径

- fix2独立报告：phase3-prep-fix2.md；此处先列fix2，再列3a，未混为一个提交。
- creative44张：phase3a/，与已审阅phase3-prep-fix-creative比较。Chrome/OS/字体指纹一致；严格差异率用于0.1%阈值，±8px对齐率仅作诊断。
- 新增12张：phase3a-new/，工具条翻转/失败/低像素 × 亮暗 × 1440/390。capture无历史基线，manifest中0是捕获占位，不是零差异结论。均完成完整axe/颜色审计和交互检查。
- 旧页36张：phase3a-studio/，对比phase3-prep-fix-studio。
- fix2同视口10张：phase3a-fix2-check/，与fix2比较全部严格0%。

### creative逐状态严格差异

| 状态 | 严格差异 | 解释 |
|---|---:|---|
| home-light-1440 | 12.25359% | 仅fix2批准的任务图/遮罩/标签/静态文案；同视口fix2复查0% |
| skus-light-1440 | 0.00000% | 无变化 |
| workspace-empty-light-1440 | 5.49694% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-images-light-1440 | 6.69639% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-single-light-1440 | 14.01042% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-multi-light-1440 | 9.24132% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-mask-light-1440 | 6.97479% | 原画布工具移位、小地图收起；蒙版功能不变 |
| workspace-expand-light-1440 | 6.62514% | 扩图弹窗背后的工具区/小地图变化 |
| workspace-product-light-1440 | 3.32632% | 抽屉背后的画布工具/小地图变化 |
| library-light-1440 | 0.00000% | 无变化 |
| admin-light-1440 | 0.00000% | 无变化 |
| home-dark-1440 | 12.27576% | 仅fix2批准的任务图/遮罩/标签/静态文案；同视口fix2复查0% |
| skus-dark-1440 | 0.00000% | 无变化 |
| workspace-empty-dark-1440 | 5.49236% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-images-dark-1440 | 6.76535% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-single-dark-1440 | 13.48889% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-multi-dark-1440 | 8.99715% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-mask-dark-1440 | 6.95042% | 原画布工具移位、小地图收起；蒙版功能不变 |
| workspace-expand-dark-1440 | 6.77507% | 扩图弹窗背后的工具区/小地图变化 |
| workspace-product-dark-1440 | 3.44819% | 抽屉背后的画布工具/小地图变化 |
| library-dark-1440 | 0.00000% | 无变化 |
| admin-dark-1440 | 0.00000% | 无变化 |
| home-light-390 | 34.09943% | 仅fix2批准的任务图/遮罩/标签/静态文案；同视口fix2复查0% |
| skus-light-390 | 0.00000% | 无变化 |
| workspace-empty-light-390 | 17.04126% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-images-light-390 | 17.47904% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-single-light-390 | 35.13884% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-multi-light-390 | 26.35345% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-mask-light-390 | 17.79013% | 原画布工具移位、小地图收起；蒙版功能不变 |
| workspace-expand-light-390 | 15.44963% | 扩图弹窗背后的工具区/小地图变化 |
| workspace-product-light-390 | 1.05329% | 抽屉背后的画布工具/小地图变化 |
| library-light-390 | 0.00000% | 无变化 |
| admin-light-390 | 0.00000% | 无变化 |
| home-dark-390 | 34.16233% | 仅fix2批准的任务图/遮罩/标签/静态文案；同视口fix2复查0% |
| skus-dark-390 | 0.00000% | 无变化 |
| workspace-empty-dark-390 | 16.24590% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-images-dark-390 | 17.86608% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-single-dark-390 | 34.15786% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-multi-dark-390 | 24.93924% | 底部/右下工具整合，小地图收起；单选增加工具分组/尺寸，多选显示数量；对话输入4px安全区源于fix2 |
| workspace-mask-dark-390 | 17.29281% | 原画布工具移位、小地图收起；蒙版功能不变 |
| workspace-expand-dark-390 | 16.00286% | 扩图弹窗背后的工具区/小地图变化 |
| workspace-product-dark-390 | 0.78746% | 抽屉背后的画布工具/小地图变化 |
| library-dark-390 | 0.00000% | 无变化 |
| admin-dark-390 | 0.00000% | 无变化 |

### 旧页逐状态

| 状态 | 严格差异 | 原因 |
|---|---:|---|
| login-light-1440 | 2.755208% | fix2已批准的桌面文案左边距变化 |
| product-light-1440 | 0.000000% | 无变化 |
| agent-light-1440 | 0.000000% | 无变化 |
| admin-light-1440 | 0.000000% | 无变化 |
| users-light-1440 | 0.000000% | 无变化 |
| gateways-light-1440 | 0.000000% | 无变化 |
| models-light-1440 | 0.000000% | 无变化 |
| templates-light-1440 | 0.000000% | 无变化 |
| forbidden-light-1440 | 0.000000% | 无变化 |
| login-dark-1440 | 2.769653% | fix2已批准的桌面文案左边距变化 |
| product-dark-1440 | 0.000000% | 无变化 |
| agent-dark-1440 | 0.000000% | 无变化 |
| admin-dark-1440 | 0.000000% | 无变化 |
| users-dark-1440 | 0.000000% | 无变化 |
| gateways-dark-1440 | 0.000000% | 无变化 |
| models-dark-1440 | 0.000000% | 无变化 |
| templates-dark-1440 | 0.000000% | 无变化 |
| forbidden-dark-1440 | 0.000000% | 无变化 |
| login-light-390 | 0.000000% | 无变化 |
| product-light-390 | 0.000000% | 无变化 |
| agent-light-390 | 0.000329% | 仅16个像素渲染噪声，未改该页源码 |
| admin-light-390 | 0.000000% | 无变化 |
| users-light-390 | 0.000000% | 无变化 |
| gateways-light-390 | 0.000000% | 无变化 |
| models-light-390 | 0.000000% | 无变化 |
| templates-light-390 | 0.000000% | 无变化 |
| forbidden-light-390 | 0.000000% | 无变化 |
| login-dark-390 | 0.000000% | 无变化 |
| product-dark-390 | 0.000000% | 无变化 |
| agent-dark-390 | 0.000000% | 无变化 |
| admin-dark-390 | 0.000000% | 无变化 |
| users-dark-390 | 0.000000% | 无变化 |
| gateways-dark-390 | 0.000000% | 无变化 |
| models-dark-390 | 0.000000% | 无变化 |
| templates-dark-390 | 0.000000% | 无变化 |
| forbidden-dark-390 | 0.000000% | 无变化 |

## 4. 检查命令及结果

| 检查 | 结果 |
|---|---|
| npm run lint:ui | 6项既有数据白名单，0新增违规 |
| npm run lint / typecheck / build | 全部通过 |
| npm run test:units | 106项通过 |
| node --import tsx --test tests/unit/ui-render-environment.test.ts tests/unit/canvas-ui.test.ts | 9项通过（7环境+2布局/阈值） |
| VISUAL_REVIEW_TEST_MODE=true，5个既有integration文件 | 5项通过，真实本地Postgres/MinIO，模型模拟 |
| npm run test:generation | 通过；KI-001未复现，不修改费用逻辑 |
| npm run test:e2e | 10通过，2原设计跳过（Agent专用） |
| npm run test:agent:browser | 2项通过；专用3105、隔离数据库、本地mock；agent-browser-final-retry.log |
| creative44 / 新状态12 | 文字/控件对比度通过，axe serious/critical为0 |
| DOM交互 | 4组单选、4组多选、12组新增状态；36px缩放不变、md20、无控件重叠、全部入口、便签撤销/重做、2张对比/下载/移除与撤销、原settings→retry路径 |

数据库集成命令：VISUAL_REVIEW_TEST_MODE=true node --conditions=react-server --import tsx --test tests/integration/canvas.test.ts tests/integration/image-models.test.ts tests/integration/visual-plan.test.ts tests/integration/task11c.test.ts tests/integration/review-scoring.test.ts。

复拍使用scripts/ui-snapshots.ts：creative为 --mode=compare --baseline=docs/ui-audit/phase3-prep-fix-creative --output=docs/ui-audit/phase3a --allow-size-change --audit --phase3a-check；新状态加 --phase3a-new --mode=capture；旧页使用 --suite=studio，baseline=phase3-prep-fix-studio；fix2复查用 --prep-fix2。

完整日志：.local/verification/ui-phase3a/；最终常规浏览器为e2e-final.log，静态构建为build.log。构建与回归重叠的一轮结果作废，重启固定构建后完整10/10通过；一次Agent模拟worker心跳就绪检查503在浏览器启动前中止，保留agent-browser-final.log，原命令串行重试2/2通过，未修改worker或队列代码。不将这些中间尝试写成最终通过或归入KI-001。

## 5. 取舍、边界和待确认

- 不改HTTP接口、费用公式、配额、账本、队列、双网关；CR-001后无接口变动。无付费模型调用。
- 保留现有全部可用动作，长工具条在有限画布内横向滚动；没有扩大未接通入口的显隐范围。
- 撤销/重做只支持本次打开的布局历史，新服务端结果到达后清空旧历史，避免回滚生成状态。
- 新状态截图使用只读/内存夹具；不代表真实模型出图验收。
- 无需业务决定；完成3a后停止，等待审阅，不进入3b/3c，不推送。
