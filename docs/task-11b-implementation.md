# Task 11-B：品类经验与 Agent 视觉方案

本轮采用用户最后确认的方向，之前的“固定鞋架 JSON 绑定 SKU / 新建固定鞋架 SKU”方案取消。原始资料存档保留，但产品身份不导入模板库。不实施 8A SQL，不删除原示例。

## 数据与来源

- `StudioLibraryEntry`仍是主存储，`kind`与`data.type`镜像区分 `scene_pattern / selling_point_pattern / prop_pool / slot_sequence / case`。
- `category-pattern-seed.ts`将用户提供的 `docs/seeds/shoe-rack-vertical.json` 转为24条记录：4个场景经验、4个配饰池、6个卖点表达、1个图位顺序及9个待上传案例引用。15条可检索，9条 `pending_images` 排除。
- 不导入 `sku_identity`、尺寸、层数、产品配色、部件数量；可拆卸、防水、防倾倒等经验带“必须由本产品资料确认”的条件。陈列变量、场景、后期要求、`no_shoes`、`placement_rule`保留为品类经验。
- 原数据库36条 Codex 示例保留，增加 `is_sample=true` 和来源标签；检索排除示例，不通过旧原型场景/道具偷偷回退。
- 新增的验收产品由实际 `1-主图.jpg`进入新产品上传流程，自动内部任务编号；不把原始JSON身份写给现有 SKU。未将找到的其他9张文件擅自登记为已上传案例。

## 表结构

两个增量迁移只增加三个字段，没有新建规范化模板表：

| 表 | 字段 | 用途 |
|---|---|---|
| Product | visualResearch Json? | 竞品摘要、来源、时间、输入指纹缓存；成功缓存7天，失败15分钟；产品参数或身份变更失效 |
| ImageSlot | visualPlan Json? | 完整方案、当前图位选择、确认卡ID快照 |
| ImagePack | confirmedPlanId String? | 当前确认方案；旧图位、候选和终稿保留，旧选择不混入新批次 |

方案草稿/人工确认及执行回执继续保存在 `AgentCard`。真实生成输入冻结到 `GenerationJob.input`；修图从源任务继承身份和实拍，不被后来修改的产品档案覆盖。

## 真实调用链

1. 规划按钮、对话工具 `propose_image_pack`、旧单张 `POST /products/[id]/generations`统一调用 `proposeVisualPlan`。单张只输出一个图位，保留比例和分辨率设置，转入工作台确认。
2. `analyzeProduct`通过现有服务端 LLM 路由读取实拍与参数，返回结构、材质、颜色、功能、排序卖点及来源实拍；`composeIdentityLock`把完整字段注入，不能只使用简略摘要。
3. `researchCompetitors`使用既有 `webSearch`及其费用记录；带来源缓存，失败注明跳过，不伪造链接或竞品结论。
4. `retrieveLibrary / retrievePatterns`按品类与卖点读取真实库；同品类为空时只使用显式相近品类映射并注明，无经验也能依据本产品继续规划。
5. `proposeVisualPlan`输出各图位卖点、空间、道具、陈列、机位、光线、色调、构图、后期与依据。`validateVisualPlan`校验依据，按场景/配饰及SKU历史 `combinationKey`去重。
6. 方案卡可逐项编辑或发送意见重写；`approveAgentCard → confirmVisualPlan → applyProposal`冻结快照，保留人工确认边界。
7. `image-packs.ts → planBatch → prepareSceneInput`只传递确认快照，引用库、身份或旧goal修改不会替换该份选择。原费用指纹、报价汇总、配额预留、入队与账本逻辑继续使用现有实现。
8. `sanitizePrompt`移除内部ID、SKU及物理尺寸数值，转为实拍比例描述。最终包装层统一追加无文字/字母/数字/图标/线/水印/logo约束；摄影提示词不含 `postNotes` 或证据ID。

## 修改与案例

- 对话 `edit_image`明确 `whole / local`。整图走现有费用卡；局部先要求美工进入画布框选或涂抹，不拿无蒙版的整图生成冒充局部。
- 画布输出原图尺寸PNG蒙版，支持矩形、画笔、橡皮与自定义要求。服务器验证蒙版归属、数量、尺寸、参考图优先顺序。
- 当前KIE多图编辑接口没有原生mask字段。使用语义蒙版引导编辑，生成后 `compositeMaskedEdit`只取选区结果与原图合成，保证蒙版外像素不变；没有改双网关或伪造未支持的API参数。依据：[KIE Nano Banana 2参数](https://docs.kie.ai/market/google/nanobanana2)、[Google语义局部编辑说明](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana)。
- 版本列表按来源显示新旧图，可并排对比、切换终稿回退，原候选保留。
- 优秀案例先从真实定稿提炼品类画面语言，写成待确认卡；只有美工再次确认且原图仍是有效终稿，才将 `case`及场景pattern写入库。

## 验收与限制

实际样图、提示词、任务/模型记录和两次修改对比见 [样例索引](task11b-samples/README.md)，完整方案见 [plan.md](task11b-samples/plan.md)。没有制作浏览器截图、录屏或GIF。

- 本机ZenMux直连DNS异常；免费请求定位到已有Clash实际端口17897后，只设置验收进程代理，不改系统网络和网关代码。用户明确授权将本地管理员月度额度从$0.50改为$1.50；失败记录保留，不改费用估算、账本或历史预留。
- 本次未配置Tavily，竞品阶段明确跳过。9张原图案例仍待用户上传。
- 真实候选中仍出现装饰画小字、书脊/蜡烛标签及电子钟数字，说明模型未完全遵守无字约束；不能当作合格终稿。对话示例去掉布袋痕迹，局部示例替换左侧香水瓶区域。最终统一包装层另外明确配饰标签、书脊、时钟显示屏和装饰画署名保持素面；这项补强没有额外收费重跑四张样图，样例提示词保持实际提交原文。
- 模型编辑区域的语义质量、真实产品部件还原仍需美工核对；蒙版外像素保护有独立机器校验。
- 原“首次并发读取偶发500”待办继续保留，本轮没有借此重写会话或计费逻辑。
- 额外隔离生图回归发现既有网关错误汇总丢失 `uncertain`，将模拟断网任务预留从$0.03重试累加至$0.06。用户随后明确批准例外修复：只在 `gateway-router.ts`保留任一次失败的扣费不确定标记，避免上层误判安全重发。新增2项回归；费用公式、配额算法、队列和熔断规则不变。

## 测试口径

- `npm run test:units`完整94项，分别使用服务端/普通React需要的正确运行条件；不能用一个 `react-server`全局命令运行UI store测试。
- `test:visual-plan / test:canvas / test:image-models`另含3项真实数据库集成；无模型调用。
- `test:agent`隔离数据库与模拟网关覆盖完整确认、报价、队列及回执；`test:agent:browser`快速/手动两个流程单独运行。
- `test:e2e`常规浏览器回归保留两个隔离Agent流程的设计性跳过；新增方案编辑、冻结、对比、回退及框选入口测试；不以跳过冒充通过。
