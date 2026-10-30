# 项目：家具电商 AI 生图工作台（个人工具）

## 当前方向
- 这是个人自费用的工具，调用成本优先。对话 Agent 是主角：先围绕当前产品资料和用户意见讨论方案，用户确认方案及费用后才生图，不自动开始下一批。
- 用户应能随时在对话中提供参考图，最终生图应真正携带这些参考图；当前尚有接线缺口，见“已知问题/12-B”，不能声称已经完成。
- 满意的生成图由用户手动收藏到素材库，收藏不调用 AI；当前尚无独立手动收藏，留到12-C。本轮只暂停旧AI提炼入口。
- 任何改动都优先考虑调用成本，不新增自动调用模型的环节；不为整理素材、收藏或页面初始化引入新的模型请求。

## 暂停功能清单
代码和数据库中已有数据保留，使用 src/lib/project-features.ts 中的统一开关控制，默认全部关闭；恢复前需用户明确授权并评估调用成本。

| 功能 | 开关（.env.example中默认false） |
|---|---|
| 批量导入历史Listing及导入审核 | NEXT_PUBLIC_FEATURE_LIBRARY_IMPORT |
| 品类打法/经验汇总和逐条审核逻辑、原始JSON展示 | NEXT_PUBLIC_FEATURE_LIBRARY_PATTERNS |
| 自动检索经验库 | NEXT_PUBLIC_FEATURE_LIBRARY_RETRIEVAL |
| 联网搜索、Google Search补充、竞品截图/链接分析 | NEXT_PUBLIC_FEATURE_WEB_RESEARCH |
| 标记优秀、AI提炼案例及其确认入库 | NEXT_PUBLIC_FEATURE_CASE_EXTRACTION |

- 本轮界面恢复到上次提交，只给标记优秀、联网、Listing导入、模板审核/JSON加开关判断；保留品类卡片、假数据展示、原有文案和页面结构，不用整页暂停说明替换模板库。
- 暂停的不仅是按钮：服务端也应在读库、联网或调用模型之前跳过/拒绝相应操作。旧确认卡不能重新触发已暂停的案例流程。
- 标记优秀的原代码保留，不能把AI提炼伪装成手动收藏；12-C按用户另行给出的要求实现普通收藏。
- 不清空或删除用户资料、模板库、历史案例、图包、生成记录或已收藏资源。

## 技术栈与架构（不擅自更换）
- Next.js App Router + TypeScript，Tailwind CSS + shadcn/ui。
- PostgreSQL + Prisma；pg-boss任务队列，不引入Redis。
- S3兼容存储（本地MinIO），Auth.js账号密码登录，sharp处理图片；保留现有LLM/图像Provider及SDK集成。
- 本地docker compose运行Postgres、MinIO；Next.js Web与生图worker为独立进程。
- 外部API只在服务端调用，密钥不得发送到前端、写入日志或提交Git。真实.env被忽略，文档以.env.example为准，不读取或传播真实密钥。
- 生图继续通过ImageProvider、models.config.ts和现有路由表；GenerationJob记录实际provider、model、参数、费用、发起人与结果。
- 不改费用公式、费用指纹、配额预留、账本、队列、熔断或双网关；HTTP接口契约变更需先征求用户确认。
- 不改数据库结构；没有明确授权不迁移或删除数据库数据。

## 供应商实际状态（按代码配置）
- ZenMux和KIE均已接入，不再是“ZenMux待开通”。配置存在不等于本轮验证了上游能力或账号余额；本轮不调用模型探测。
- 对话Agent默认ZenMux Gemini 3.8 Flash，模型ID为google/gemini-3.8-flash（src/lib/agent-default.ts）；使用ZENMUX_API_KEY与ZENMUX_BASE_URL。当前并未读取LLM_MODEL覆盖该默认值。
- 生图默认KIE Nano Banana 2.1（nano-banana-2-1），目录还包含代码登记的GPT Image 2.5、Nano Banana 2、Nano Banana Pro、Qwen3；具体模型与参数以image-models.ts及数据库目录为准，不猜新ID或参数。
- KIE使用KIE_API_KEY、KIE_BASE_URL、KIE_UPLOAD_BASE_URL；异步taskId由worker轮询并转存S3。KIE_CALLBACK_URL本地留空。
- ZenMux生图通过Google Gemini协议，地址为ZENMUX_VERTEX_BASE_URL；保留现有备用路由。
- GATEWAY_PREFERENCE=auto时，生图优先KIE，对话优先ZenMux；按现有候选、配置凭据和熔断状态回退。未配置密钥的网关自动跳过。
- GOOGLE_SEARCH_ENABLED仍是旧联网能力开关，但当前还受FEATURE_WEB_RESEARCH暂停开关限制，不能绕过暂停状态。

## 方案与提示词约定
- 方案只有一个真实入口：planning-agent.ts的propose_image_pack转调visual-planning.ts的proposeVisualPlan；其他规划入口也复用该函数，不维护第二套图位生成逻辑。
- propose_image_pack对模型只暴露用户目标reason；旧slots参数仅兼容历史调用。具体图位由统一方案流程生成，用户确认后冻结，再报价/提交。
- retrieveLibrary关闭时直接返回空集合，不查询或利用其他产品的经验；researchCompetitors关闭时直接返回已跳过，不读竞品、联网或调用模型。
- 全局提示词（src/prompts及其他prompt构建文件）只放通用规则。具体结构、部件、尺寸、颜色、材质、功能及特殊陈列只能来自当前产品资料和对话，不把某个SKU或品类的规则写入全局。
- 未知或矛盾资料应明确提示；不猜测尺寸、隐藏部件、性能或拆装状态。产品身份约束来自当前实拍和已确认资料。
- 图像最终包装层保留通用无文字/数字/图标/尺寸线/水印/logo规则；尺寸和说明由后期处理。默认2K；亚马逊主图沿用纯白、产品占比至少85%、长边至少2000px规则。
- 不调用付费模型；任务12-A不调用任何真实模型。需要真实验证时给用户手动步骤，不替用户执行。

## 开发约定
- 硬规则：除非用户明确要求改界面，任何任务都不许改动页面布局和样式。后台清理不得顺带重排界面、调整间距/颜色/文字或替换组件结构；获准隐藏入口时仅加开关判断。
- UI文案、代码注释使用中文；不实现当前任务以外的功能。
- 不确定是否可删的组件、数据或逻辑先保留并列出，不擅自删除。用户已要求本轮保留假数据展示，不得以清理为由修改已认可界面。
- 常规代码任务至少通过npm run lint、npm run typecheck，并按改动运行必要的无模型测试及build。
- 纯样式小改动（颜色、圆角、间距、边框）只跑npm run lint和npm run build，不截图、不做像素对比、不跑完整回归。改交互、布局结构或阶段结束时再做相应完整验收；不得为验收调用真实模型。
- 浏览器录屏、截图、GIF只在用户明确要求时制作。
- README只保留安装、启动、环境变量说明。开发记录和待办写入docs/CHANGELOG.md。
- 默认不自行提交或推送；按当前任务明确要求执行。

## 已知问题
### 12-B：对话参考图尚未接到图包生图请求
- 对话引用的图片目前只送给对话模型；图包生图只读取方案冻结的产品实拍，参考图没有传给生图模型。本轮只记录，不修改生图链路。
- 前端：src/components/design-preview/live-workspace.tsx的RealChat.send传递canvas.referenceAssetIds；服务端src/lib/planning-agent.ts的runAgentTurn经canvasContext收集引用，在LLMInput.images中送给对话模型。
- 方案建立与冻结：src/lib/visual-planning.ts的analyzeProduct/proposeVisualPlan生成identityLock.referenceAssetIds；confirmVisualPlan校验引用。src/lib/agent-actions.ts的approveAgentCard/applyProposal把已确认plan与slot快照写入ImageSlot.visualPlan。
- 图包报价/提交：src/lib/image-packs.ts的planBatch把图位快照交给src/lib/scene-generation.ts的prepareSceneInput；该函数仅用冻结identityLock.referenceAssetIds并按type=photo读取，写入GenerationJob.input.referenceAssetIds。
- 最终生图请求：src/lib/image-router.ts的generate把input.referenceAssetIds映射为ImageRequest.referenceImages，再交给ImageProvider（例如src/lib/kie-provider.ts的KieProvider.generate）。12-B应贯通引用选择、冻结、报价、提交和最终请求，保持它们使用同一份引用快照，另行确认费用影响。

### 12-C：手动收藏尚未实现
- 当前proposeExcellentCase（src/lib/visual-case.ts）会调用AI提炼，已在UI和服务端暂停；旧数据和代码保留。
- 后续普通收藏应由用户手动操作、不调用AI；本轮不改收藏逻辑、不新建收藏接口。

### 技术债：共享类型和真实预览仍位于旧mock文件
- 用户确认本轮保留src/design-preview/mock/models.ts：真实模型页面、选择器、model-store复用模型类型、默认值、modelRate和前端费用估算。真实目录优先来自/api/studio/models，服务端报价仍为最终依据。
- 用户确认本轮保留src/components/design-preview/library/library-store.ts中的readMockFiles、附件状态等：用于首页/画布真实上传文件的Data URL预览、文件名与逐个移除。
- 后续单独拆分并改名，将共享类型/真实附件预览与旧示例库隔离；不要整文件删除，不在本轮改变费用估算或上传逻辑。两个文件顶部均已标注真实用途与不可删除说明。
