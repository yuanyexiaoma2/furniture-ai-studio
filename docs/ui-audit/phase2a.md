# UI阶段2a：creative设计变量与图标

基线提交：`99f3187`。本轮仅完成2a，未推送；2b和阶段3均未开始。全程未调用付费模型，不改费用、配额、队列、双网关、API、Prisma、鉴权或功能开关。

## 1. 改动摘要

1. 修改样式前补齐9个旧页面×亮暗×1440/390的36张基线，保存在baseline-studio。
2. creative的59组固定色值移入语义tokens，数值不变。亮色primary仍#1f3a2e；暗色primary/foreground仍#fafafa/#18181b，ring/selection仍#6c907d。
3. UI字号统一七档，并保留首页专用40px/600；9处10/11px提升到实际12px，12张补充截图及全部边界数据确认无横向溢出。
4. 圆角按6/10/16/999及气泡12px专用值统一，189条源码声明的逐处前后值均已列出。
5. 库摘要/评价去Georgia；品牌原型Georgia和品牌字号25px保留并注释。99f3187已没有生效或残留的Inter声明，本轮没有虚构一处Inter删除。
6. 图标支持sm/md/lg及数字；21个显式18px调用点逐个归档；修正Library/ContactRound、处理11组旧重复映射，保留原13个未使用导出。
7. 新增lint:ui白名单检查，4类新增违规探针全部拒绝；安全合并10组互补样式，保留103项交叉层叠依赖并说明。
8. 完成44张creative对比、36张旧页基线和12张小字补充。完整回归通过；竞品用例仅增加初始化读取等待，保留原保存逻辑及断言。

## 2. 文件清单

- 新增：`scripts/ui-lint.ts`、`scripts/ui-lint-baseline.json`、`scripts/ui-snapshots-studio.ts`；package.json只增加lint:ui命令，无新增依赖或lock变更。
- 修改：`scripts/ui-snapshots.ts`，扩展旧页基线、补充状态、尺寸改变时的并集比较和来源记录。
- 修改：`src/styles/creative/`全部9个CSS；`src/app/globals.css`只删除末尾两条SVG important规则并更新相关注释。
- 修改：`src/components/icons/concept-icons.ts`及其引用；creative组件/primitive仅调整图标、字号/圆角class和数据说明注释。
- 旧页面的少量源码变化仅为别名替换、18px归类及大号数字图标的兼容呈现；未迁移旧页面字体、色彩、结构。
- `tests/visual-plan.spec.ts`增加两行初始化networkidle等待，不改断言或业务。
- 文档：design-system.md、known-issues.md、README、CHANGELOG及本报告；截图和验证数据分别在baseline-studio、phase2a、phase2a-small-text目录。

### 本轮修改的既有代码文件

- `scripts/ui-snapshots.ts`
- `src/app/(studio)/admin/page.tsx`
- `src/app/(studio)/forbidden/page.tsx`
- `src/app/globals.css`
- `src/components/design-preview/admin.tsx`
- `src/components/design-preview/app.tsx`
- `src/components/design-preview/batch/brand.tsx`
- `src/components/design-preview/batch/glossary.tsx`
- `src/components/design-preview/batch/workflow.tsx`
- `src/components/design-preview/canvas-empty.tsx`
- `src/components/design-preview/canvas.tsx`
- `src/components/design-preview/expand-editor.tsx`
- `src/components/design-preview/home.tsx`
- `src/components/design-preview/icon-guide.tsx`
- `src/components/design-preview/image-preview.tsx`
- `src/components/design-preview/library/admin-library.tsx`
- `src/components/design-preview/library/browser.tsx`
- `src/components/design-preview/library/capture.tsx`
- `src/components/design-preview/library/category-confirmation.tsx`
- `src/components/design-preview/library/shooting.tsx`
- `src/components/design-preview/library/workflow.tsx`
- `src/components/design-preview/listing-import.tsx`
- `src/components/design-preview/live-workspace.tsx`
- `src/components/design-preview/mask-editor.tsx`
- `src/components/design-preview/model-picker.tsx`
- `src/components/design-preview/pattern-library.tsx`
- `src/components/design-preview/product-card.tsx`
- `src/components/design-preview/provider.tsx`
- `src/components/design-preview/task-cover.tsx`
- `src/components/design-preview/ui/badge.tsx`
- `src/components/design-preview/ui/button.tsx`
- `src/components/design-preview/ui/checkbox.tsx`
- `src/components/design-preview/ui/command.tsx`
- `src/components/design-preview/ui/dialog.tsx`
- `src/components/design-preview/ui/dropdown-menu.tsx`
- `src/components/design-preview/ui/input.tsx`
- `src/components/design-preview/ui/popover.tsx`
- `src/components/design-preview/ui/select.tsx`
- `src/components/design-preview/ui/sheet.tsx`
- `src/components/design-preview/ui/skeleton.tsx`
- `src/components/design-preview/ui/slider.tsx`
- `src/components/design-preview/ui/switch.tsx`
- `src/components/design-preview/ui/tabs.tsx`
- `src/components/design-preview/ui/textarea.tsx`
- `src/components/design-preview/ui/tooltip.tsx`
- `src/components/design-preview/version-history.tsx`
- `src/components/design-preview/visual-plan-card.tsx`
- `src/components/design-preview/workspace-progress.tsx`
- `src/components/gateway-manager.tsx`
- `src/components/icons/concept-icons.ts`
- `src/components/icons/icon-badge.tsx`
- `src/components/login-form.tsx`
- `src/components/photo-manager.tsx`
- `src/components/placeholder.tsx`
- `src/components/product-create.tsx`
- `src/components/product-studio.tsx`
- `src/components/ui/checkbox.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/sheet.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/user-manager.tsx`
- `src/styles/creative/admin.css`
- `src/styles/creative/base.css`
- `src/styles/creative/canvas.css`
- `src/styles/creative/chat.css`
- `src/styles/creative/gallery.css`
- `src/styles/creative/home.css`
- `src/styles/creative/layout.css`
- `src/styles/creative/library.css`
- `src/styles/creative/tokens.css`
- `tests/visual-plan.spec.ts`

## 3. 基线、对比与逐项变化

### 旧页面基线

命令：`node --import tsx scripts/ui-snapshots.ts --suite=studio --mode=baseline`。在99f3187对应的页面构建上、任何2a样式/图标修改之前完成。使用现有NEW-MVQFFV1P产品，不猜测绑定、不新建SKU；只读导航，不触发生成或保存。

| 页面 | 路径 | 覆盖 |
| --- | --- | --- |
| 登录 | /login | 亮暗×1440/390 |
| 旧产品资料 | /products/[id] | 亮暗×1440/390 |
| 旧Agent图包页 | /products/[id]/pack | 亮暗×1440/390 |
| 后台首页 | /admin | 亮暗×1440/390 |
| 用户管理 | /admin/users | 亮暗×1440/390 |
| 网关管理 | /admin/gateways | 亮暗×1440/390 |
| 模型管理 | /admin/models | 亮暗×1440/390 |
| 旧模板占位页 | /templates | 亮暗×1440/390 |
| 无权限页 | /forbidden | 亮暗×1440/390 |

共36张，全部成功；[清单](baseline-studio/manifest.json)。登录页不填密码截图；旧页面的暗色纸色覆盖问题如实保留，2b再处理。/design-preview/icons因开关关闭返回404，不开启；旧design已删除、design-preview业务路径为301；独立/reviews HTML route不属于(studio)旧页面CSS迁移。

### creative与阶段1对比

```powershell
node --import tsx scripts/ui-snapshots.ts --mode=compare --baseline=docs/ui-audit/phase1 --output=docs/ui-audit/phase2a --allow-size-change
```

44张对比全部成功。任意通道不同即计为差异，不设颜色容差、不遮挡UI。首页高度随18→16px区块标题减少3px：1440屏1227→1224、390屏1488→1485；比较画布使用新旧尺寸并集，额外区域也计入差异。40px/600主标题本身未缩小。

[阶段1参照](phase1/manifest.json) → [2a复拍/差分](phase2a/manifest.json)。原文件名保持一致，差分为对应的.diff.png。

| 状态 | 亮1440 | 暗1440 | 亮390 | 暗390 | 允许的变化 |
| --- | --- | --- | --- | --- | --- |
| home | 13.02171% | 12.40497% | 33.26630% | 31.86690% | 40/600保持；输入框24→16、区块/卡片字号归档、任务卡圆角及图标 |
| skus | 0.61493% | 0.61875% | 2.19954% | 2.21321% | SKU卡片/图片圆角10、卡片15→14、图标线宽与尺寸 |
| workspace-empty | 2.03715% | 2.00146% | 2.93292% | 2.85029% | 空状态字号档位、工具栏md20、容器圆角 |
| workspace-images | 2.93097% | 2.77215% | 2.65616% | 2.52127% | 图片10、气泡12、对话标题16、工具md20 |
| workspace-single | 3.87597% | 3.59174% | 8.90479% | 7.22961% | 浮动工具条14→16、图标20、AI改图动作图标统一 |
| workspace-multi | 4.07896% | 3.75819% | 6.33096% | 4.99271% | 多选工具条16、图标20，原操作与布局机制不变 |
| workspace-mask | 3.82882% | 3.41757% | 3.86256% | 3.39804% | 图片10、蒙版浮层16、工具20，画笔/编辑功能不变 |
| workspace-expand | 2.90229% | 2.76417% | 10.07838% | 8.09697% | 弹窗16、输入/按钮10、图标语义尺寸 |
| workspace-product | 9.16694% | 7.34785% | 19.37781% | 15.69237% | 抽屉/浮层16、输入10、标题与图标规范化 |
| library | 3.61056% | 3.16493% | 11.00468% | 10.35363% | 经验卡圆角16、区块16、表单10、字体档位；源库摘要/评价去Georgia |
| admin | 1.66187% | 1.67359% | 2.65054% | 2.66215% | creative后台标题/按钮/图标规范化；旧外壳纸色不迁移 |

这些是经授权的字号、字体、圆角和图标变化，不把它们解释为阶段1的“视觉零变化”。颜色只变量化；真实根变量、40px标题和核心圆角的4组浏览器断言全部通过，见[计算值](phase2a/computed-checks.json)。没有调整62px顶栏、640/560左栏、工具组位置、shimmer或新增交互。

### 9处小字号与溢出检查

```powershell
node --import tsx scripts/ui-snapshots.ts --mode=capture --baseline=docs/ui-audit/phase1 --output=docs/ui-audit/phase2a-small-text --small-text
```

进度、历史、保存冲突三状态×亮暗×两宽度，共12张。它们是额外覆盖，没有阶段1同名图，不做像素比较；capture模式的0值不是“零差异”的结论。每图的text-metrics.json保存实际字号、scrollWidth/clientWidth及视口边界。

| 选择器 | 源码原值 | 最终实测 |
| --- | --- | --- |
| `.t11-save-status` | 11px | 12px；无横向溢出 |
| `.t11-save-status button` | 11px | 12px；无横向溢出 |
| `.t11-canvas-history small` | 10px | 12px；无横向溢出 |
| `.t11-references` | 11px | 12px；无横向溢出 |
| `.t11-references>span` | 11px | 12px；无横向溢出 |
| `.t11-progress-heading small` | 10px | 12px；无横向溢出 |
| `.t11-progress-step small` | 10px | 12px；无横向溢出 |
| `.t11-generation-progress small` | 10px | 12px；无横向溢出 |
| `.t11-awaiting` | 11px | 12px；无横向溢出 |

检查命中50个元素，字号集合仅12px，横向溢出0、超视口0。[汇总](phase2a/small-text-checks.json)。保存状态按钮另加了仅针对font-size的限定，使12px不再被通用按钮14px覆盖；按钮高度未改。

### 圆角、字号与字体的逐处证据

- [圆角189条前后对照](phase2a/radius-changes.md)：包括数值不变、只改变量的条目；实际变化不是189个不同组件。
- [最终声明差异](phase2a/final-style-changes.json)：包含347条字号变量化，9条小字号提升及每处媒体条件。
- [Tailwind class映射](phase2a/class-changes.json)：45项登记；浮层16、控件10、小标签6、胶囊999。
- [初始颜色到语义token](phase2a/style-changes.json)：59组固定色值，RGBA/命名色也集中到tokens，非只移动HEX。
- w-brand-logo的Georgia/25px是用户品牌字体数据展示例外，未扩散到正文；库摘要与评论改用工作台字体。

## 4. 图标与TODO

### 18px调用点完整归类

以下位置为99f3187源码行号；每个显式调用逐项列出，没有将多次调用按文件合并计数。

| 原位置 | 图标 | 归类 | 理由 |
| --- | --- | --- | --- |
| `src/components/design-preview/admin.tsx:22:484` | s.Icon | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/app.tsx:46:210` | ArrowLeft | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/app.tsx:50:69` | Settings2 | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/batch/workflow.tsx:52:238` | PanelLeftClose | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/canvas.tsx:109:170` | PanelLeftOpen | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/canvas.tsx:109:319` | MousePointer2 | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/canvas.tsx:109:452` | Hand | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/canvas.tsx:109:913` | StickyNote | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/home.tsx:42:330` | ChevronLeft | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/home.tsx:42:488` | ChevronRight | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/icon-guide.tsx:7:735` | conceptIcons.scene | sm（16px） | 文字旁辅助图标，使用16px |
| `src/components/design-preview/library/workflow.tsx:49:238` | PanelLeftClose | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/model-picker.tsx:48:93` | Plus | sm（16px） | 文字旁辅助图标，使用16px |
| `src/components/design-preview/model-picker.tsx:52:136` | MoreHorizontal | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/product-card.tsx:18:931` | ChevronLeft | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/design-preview/product-card.tsx:18:1110` | ChevronRight | md（20px） | 独立导航/侧栏或画布工具按钮，使用20px |
| `src/components/gateway-manager.tsx:23:49` | Radio | sm（16px） | 文字旁辅助图标，使用16px |
| `src/components/login-form.tsx:28:181` | ArrowRight | sm（16px） | 文字旁辅助图标，使用16px |
| `src/components/product-create.tsx:22:74` | Plus | sm（16px） | 文字旁辅助图标，使用16px |
| `src/components/user-manager.tsx:63:181` | Plus | sm（16px） | 文字旁辅助图标，使用16px |
| `src/components/user-manager.tsx:70:153` | UsersRound | sm（16px） | 文字旁辅助图标，使用16px |

另有icon-guide.tsx的动态演示[16,18,20]，现为sm/md/lg（16/20/24），原18演示归md；列表文字旁示例归sm。数字接口仍按实际数字返回，例如18→18；老页面原先38/40/28被旧fixed压到20的调用显式保留md，避免因兼容数字接口提前放大旧页。

11组旧重复映射已全部处理：Package/ContactRound在纠正后分离；Image组中的Library纠正为独立Library，Image/ImageIcon归一；其余归到无Icon后缀名字，Wand2归WandSparkles。CircleCheck/Info/TriangleAlert/OctagonX的单独Icon后缀也统一。92个图标值导出，原13个未使用名均保留（WandSparkles现在因规范化被使用）。不保留旧重复导出的兼容别名。

数字/语义尺寸、线宽、同名真实图形、13导出和重复别名移除均通过[静态渲染检查](phase2a/icon-checks.json)。动作表见[设计规范](../design-system.md)；超清保留ZoomIn，不新增入口。

### TODO处理

安全合并10组互补声明，其余103项交叉依赖保留分段，注释指向[依赖清单](phase2a/todo-dependencies.json)。每项有文件、选择器、媒体条件、属性和阻碍移动的同优先级规则，例如通用排版与局部标题、padding与padding-inline；不靠提高important或删除规则掩盖依赖。

## 5. 检查结果与范围说明

| 命令 / 检查 | 最终结果 |
| --- | --- |
| npm run lint:ui | 通过；232旧HEX+49旧小字号+6数据HEX匹配白名单，0新增违规 |
| 静态检查探针 | 新增HEX、小字号、SVG important、直接Lucide导入均被拒绝；14/zoom不误报 |
| npm run lint | 通过，0错误0警告 |
| npm run typecheck | 通过；Agent临时服务退出后恢复普通next-env类型入口 |
| npm run build | 通过；既有Next.js安全提醒中断后重跑成功，不升级依赖 |
| npm run test:units | 106通过，0跳过 |
| 5项现有数据库集成 | 5通过，0跳过 |
| npm run test:e2e | 最终10通过、2按设计跳过；两项专用Agent另跑 |
| npm run test:agent:browser | 重跑后2/2通过；首次被既有Next.js提示中断 |
| npm run test:generation | 通过，KI-001本轮未复现，不宣称修复 |
| 截图 | 旧页36 + creative对比44 + 小字补充12，状态检查无失败 |
| 浏览器计算值/图标渲染 | 全部通过；实际9处12px、溢出0 |

数据库集成命令与阶段1相同：canvas、image-models、visual-plan、task11c、review-scoring五个integration文件。自动回归用本地模拟模型和临时数据，清理后不保留测试SKU。原始日志在.local/verification/ui-phase2a（忽略不提交），各关键结果已写入本报告。

### 取舍、例外与待审阅事项

- 本轮只做2a；共享图标入口、别名引用和globals末尾SVG规则按用户明确要求更新，因此少量旧组件图标源码变化是必要的共享例外，不是2b旧视觉迁移。
- globals的纸色root、Georgia/宋体、49处小字号、pack-final important全部保留。2b未实施。
- 竞品e2e曾因初始GET晚于填值而得到空链接数组；只补初始化networkidle等待，未削弱断言、未改竞品组件/保存API。完整回归重跑10通过，非KI-001豁免。
- 曾并发类型生成与Agent临时服务时遇到Windows next-env文件占用；服务结束后原命令重跑通过。没有保留生成文件差异。
- 当前Inter在阶段1已被移除；品牌Georgia/25px按用户要求保留。普通UI字号只有七档和首页display专用值，品牌数据不冒充UI档位。
- 未新增运行时依赖；未更改费用、队列、双网关或功能开关。
- 阶段3预告已写入设计规范：保留shimmer后叠加真实阶段文字；重组现有工具/缩放控件；440/520/640三档比较后再定左栏；新增消息引用定位；覆盖两套button交互。全部未执行。

停在阶段2a，等待审阅；不开始2b，不推送。
