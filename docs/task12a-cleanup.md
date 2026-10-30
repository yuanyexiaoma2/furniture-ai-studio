# 任务12-A：提示词清理与方案入口统一

此文件以用户最新指令为准，取代此前12-A交付说明。

## 对比基准与恢复结果

首个12-A之前的提交为00c7c3a（不是当前已包含12-A的6edb1bb）。开始时工作区干净，对比发现6个组件/状态文件的默认参数与说明差异：agent-workspace、model-picker、model-store、image-edit-panel、image-pack-board、product-studio；以及服务端1张/1K默认值调整。以上全部撤回。

src/components、src/app、src/design-preview与00c7c3a无差异，首页、按钮、示意图和原型展示均保留。所有CSS恢复该版本后，只把src/styles/creative/base.css中首页/对话底栏的p-model-capsule常态背景改回secondary：亮色浅灰、暗色深灰，沿用5cfebfd之前的常驻胶囊底色；保留既有悬停、边框规则。输入面板边框、20px圆角、聚焦无视觉变化、发送按钮以及所有布局不变。docs/design-system.md仅同步按钮背景说明。

## 保留的代码改动

| 文件 | 相对00c7c3a保留内容 |
|---|---|
| src/lib/visual-plan-rules.ts | “产品结构、层数和层间距比例保持不变，产品完整入画。”替换为通用的“产品结构、部件数量和尺寸比例保持不变，产品完整入画。” |
| src/lib/visual-planning.ts | 移除“特写允许局部取景；拆卸只在本次身份有明确证据时使用，默认不展示半透明拆下的部件。”的特定产品默认；移除“参考库图位顺序但可按产品调整。”，按当前产品与用户目标安排；将当前会话最近20条用户意见传入既有方案请求。 |
| src/lib/agent-tool-schemas.ts | propose_image_pack只向模型公开reason，旧slots解析兼容，避免工具参数再生成另一套图位；其余工具与生成数量约定恢复原版。 |
| src/prompts/agent.ts | 只补充统一proposeVisualPlan和当前用户意见的方案说明，原联网/竞品/库/案例/费用确认指令保留。 |
| src/styles/creative/base.css | 仅模型/联网按钮的常驻胶囊背景从透明恢复secondary（加对应注释）。 |

费用公式、生成默认参数、报价/提交、预留、账本、队列、双网关和数据库结构与00c7c3a一致，未导入、删除或修改数据。

## 功能状态与文档

12-A的project-features.ts以及LIBRARY_IMPORT、LIBRARY_PATTERNS、LIBRARY_RETRIEVAL、WEB_RESEARCH、CASE_EXTRACTION五项公开开关已删除，UI显隐和服务端暂停拦截已撤销；相关服务与原版一致。保留原GOOGLE_SEARCH_ENABLED、用户会话联网选择、权限、模型配置/能力检查；本轮不调用真实模型验证上游。

AGENTS.md没有暂停清单，新增“用户已确认的决定”，明确下一步12-B；已知问题保留RealChat.send、runAgentTurn/canvasContext、analyzeProduct/proposeVisualPlan/confirmVisualPlan、approveAgentCard/applyProposal、planBatch、prepareSceneInput、image-router.generate和KieProvider.generate的位置。

## 验收

按用户要求只运行npm run lint与npm run build，均通过；不截图、不跑浏览器回归、不调用模型。提交“任务12-A：提示词清理与方案入口统一”，不推送；此前112项或3项测试结果不作为本次代码的验证结论。
