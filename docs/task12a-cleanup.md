# 任务12-A：后台清理（界面保持不变）

## 最终范围

用户否决12-A界面清理后，全部恢复至本次开始时HEAD（00c7c3a），再只给标记优秀、联网、Listing导入、模板审核/JSON加开关判断。假数据展示保留；没有改CSS、布局、间距、颜色、文案或组件结构。此前未提交的界面清理说明作废，本文件记录最终结果。

界面恢复：home.tsx、app.tsx、canvas-empty.tsx、admin.tsx、visual-plan-card.tsx、product-editor.tsx、workspace-progress.tsx、agent-workspace.tsx及model-store.ts与HEAD一致。canvas.tsx、live-workspace.tsx、model-picker.tsx、pattern-library.tsx仅多开关导入和条件判断。library-store.ts保留用户要求的顶部用途注释，业务实现与HEAD一致。

## 最终改动文件

| 文件 | 改动 |
|---|---|
| AGENTS.md | 个人自费工具方向、暂停清单、供应商现状、12-B/12-C/共享mock技术债，以及未经明确要求不得改布局样式的硬规则。 |
| README.md | 仅保留安装、启动、环境变量说明，不要求截图验收或原型种子导入。 |
| .env.example | 增加五项默认false的公开功能开关，不含密钥。 |
| docs/CHANGELOG.md | 记录最终后台清理、界面恢复、用户确认的后续事项和验收范围。 |
| docs/task12a-cleanup.md | 本轮最终文件、提示词及验收说明。 |
| src/lib/project-features.ts | 集中定义导入、经验展示、检索、联网、案例提炼开关。 |
| src/components/design-preview/canvas.tsx | 只在既有工具列表过滤中加开关，隐藏标记优秀。 |
| src/components/design-preview/live-workspace.tsx | 只在既有library_case分支加开关，隐藏案例审核/JSON卡，其余完全恢复。 |
| src/components/design-preview/model-picker.tsx | 只给原联网按钮加开关。 |
| src/components/design-preview/pattern-library.tsx | 只给原ListingImport和原查看内容details加开关，其他展示保持原样。 |
| src/design-preview/mock/models.ts | 仅注明真实模型类型、默认值、前端估价用途和不可删除，原实现保留。 |
| src/components/design-preview/library/library-store.ts | 仅注明真实附件预览、移除、上传配对用途和不可删除，原实现保留。 |
| src/lib/planning-agent.ts | 服务端阻止已暂停的web_search，方案仍转调proposeVisualPlan。 |
| src/lib/agent-tool-schemas.ts | 不暴露搜索工具，方案只公开reason，保留旧slots解析兼容。 |
| src/lib/visual-planning.ts | 检索与竞品研究提前跳过，当前会话用户意见进入已有规划调用，清理特定产品默认描述。 |
| src/lib/visual-plan-rules.ts | 通用约束不再默认产品有层数和层间距。 |
| src/prompts/agent.ts | 强调当前资料/对话、统一方案和暂停能力，如实说明参考图未接生图。 |
| src/lib/web-search.ts | 包含verify路径在内，联网前检查暂停开关。 |
| src/lib/listing-import.ts | 导入与审核执行前检查开关，原代码保留。 |
| src/lib/visual-case.ts | 在模型提炼前检查暂停开关，原代码保留。 |
| src/lib/agent-actions.ts | 旧library_case确认入库前检查开关。 |
| tests/unit/studio-main.test.ts | 搜索工具断言跟随功能开关。 |
| tests/unit/task12a.test.ts | 六项无模型测试覆盖暂停守卫、通用提示词、真实目录估价与附件预览。 |
| tests/task12a.spec.ts | 保留零模型浏览器用例，同步原模板页保留、仅入口隐藏的断言。 |
| package.json | 将新增六项单元测试加入原test:units命令。 |

## 提示词删除或替换原文

- composeVisualSlot原文：“产品结构、层数和层间距比例保持不变，产品完整入画。”替换为“产品结构、部件数量和尺寸比例保持不变，产品完整入画。”
- proposeVisualPlan原文：“特写允许局部取景；拆卸只在本次身份有明确证据时使用，默认不展示半透明拆下的部件。”保留局部取景，产品变化只依据当前资料与用户要求，不默认半透明拆卸。
- proposeVisualPlan原文：“参考库图位顺序但可按产品调整。”删除，按当前产品和对话安排。
- proposeVisualPlan原文：“evidence 只能使用检索条目ID、竞品图片ref、提供的来源URL或 identityLock。竞品逐图拆解优先，联网 supplement 仅作低权重文字补充。”暂停期间使用identityLock，不编造来源。
- agent原文：“确认档案后调用 propose_image_pack。服务器统一执行 analyzeProduct → researchCompetitors → retrieveLibrary → proposeVisualPlan：以本产品实拍和参数建立本次身份锁，按卖点排序，检索带来源的竞品信息和可用的品类视觉经验。联网失败可跳过并明确注明，示例库与未上传案例不作依据。”改为reason单入口和暂停说明。
- agent原文：“库里有的功能不代表本产品拥有。”改为产品结构和功能仅来自当前资料/对话。
- agent原文：“优秀案例提炼须另行人工确认才能入库。”改为AI提炼暂停，手动收藏待12-C且不调用AI。
- propose_image_pack工具原文：“启动统一视觉方案流程：分析本产品身份与卖点、竞品研究、检索品类经验、输出可编辑图位卡。reason 写用户目标，slots 可省略，仅作为建议；最终方案必须由服务器真实分析与检索生成，人工确认后冻结。只需一张时在 reason 明确单图请求。”改为当前产品/对话与统一规划，不再要求检索。

scene.ts、edit.ts、identity.ts、image-actions.ts和旧PromptComposer已检查且未改动；“洗衣机应置于产品旁”在本轮开始时已不存在。数据库与品类种子原文保留，不在暂停期间用于自动检索。

## 验收与手动检查

本次按用户要求只运行npm run lint和npm run build，不运行浏览器、截图、对比度或完整回归，不调用真实模型。此前112项单元及3项浏览器通过属于界面恢复前的工作树，本次不将其计为恢复界面的已执行验证。

结果：lint通过；首次build完成编译后被Next.js安全升级提醒中止，按提示原样重跑npm run build通过。依赖版本未改，Next.js的安全升级建议留待单独任务，不混入本次提交。

手动检查时启动项目并登录：模型管理页搜索Qwen3；首页输入草稿但不发送，将Nano Banana 2.1的2K改为4K，观察前端估价；添加一张自己的图片及TXT，确认预览并逐项移除。以上无需调用模型。

需要验证真实方案时由用户新建产品、填主图/参数/卖点，进入对话要求先讨论、确认理解后出方案、不生图；该步骤产生原有LLM费用，本轮不代执行。界面应与已认可版本一致，仅指定入口隐藏，原假数据展示保留。

12-B参考图接线和12-C无AI手动收藏均按用户决定延期，函数位置及现状见AGENTS.md。未修改HTTP接口契约、数据库结构、费用、队列或双网关；用户要求验收后提交，不推送。
