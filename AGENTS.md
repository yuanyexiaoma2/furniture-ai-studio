# 项目：家具电商 AI 生图工作台（个人工具）

## 用户已确认的决定
- 这是个人工具，管理员决定模型开放，系统只提示风险，不设硬门槛；能力探测保留作参考，未达标或待验证不阻止打开。
- 智能体统一走ZenMux；生图KIE优先，失败后回退到ZenMux同款模型一次，不替换其它模型；参数、内容审核、余额或额度错误不切换。
- 目标是让工具更好用，不关闭功能；生成和修改点击后直接提交，不做任何费用确认弹窗或卡片，费用只做展示和记账。服务端仍估价、检查额度、预留和记账，余额不足照常报错。
- 除非用户明确要求，不许改动界面布局、样式和按钮。
- 任务13-2已接通对话参考图：每图位0–2张，冻结用途与图片，生图实际传入图片；修改默认沿用原图实际使用的参考图，明确指定新图时替换。未知用途用一句普通对话询问，不加确认弹窗。
- 当前12-A只保留特定产品提示词清理、统一方案入口和对话用户意见传递；不删、不隐藏首页、按钮、示意图或其他界面。唯一获准的样式修改是首页/对话底栏模型与联网按钮恢复常驻浅灰胶囊底色（亮暗均有）。
- 12-A之前的界面基准为00c7c3a；本条取代此前所有12-A调整。数量、分辨率、输入框边框/圆角/聚焦表现均保持该基准，不保留前轮1张/1K改动；任务13-1明确取消所有费用确认，覆盖原费用卡约定。
- 默认不为验收调用真实或付费模型；任务14用户明确要求的三款ZenMux智能体能力探测已获授权，其余测试使用本地模拟，不调用真实生图。

## 技术栈与架构
- Next.js App Router + TypeScript，Tailwind CSS + shadcn/ui；不擅自更换。
- PostgreSQL + Prisma；pg-boss任务队列，不引入Redis；本地docker compose运行Postgres和MinIO。
- S3兼容存储、Auth.js账号密码登录、sharp图片处理；Web与worker为独立进程。
- 外部API仅在服务端调用，密钥不得发送到前端、日志或Git。不得输出真实.env中的密钥。
- 图像继续走ImageProvider及models.config.ts路由表；记录实际provider/model、参数、费用和发起人。
- 默认不改费用公式、预留、账本、队列、熔断、双网关或数据库结构。任务14明确授权在原双网关/熔断框架内调整路由、失败预留释放和成功一次记账；队列名称/并发/限速、权限及数据库结构不变。
- 不删除或重置现有产品、模板库、案例、生成记录或已确认方案。

## 供应商与功能状态
- ZenMux和KIE都已接入；当前对话Agent默认ZenMux Gemini 3.8 Flash（google/gemini-3.8-flash），生图默认KIE Nano Banana 2.1。
- 对话配置为ZENMUX_API_KEY、ZENMUX_BASE_URL；ZenMux生图备用线路为ZENMUX_VERTEX_BASE_URL。KIE使用KIE_API_KEY、KIE_BASE_URL、KIE_UPLOAD_BASE_URL，异步结果由worker转存S3。
- GATEWAY_PREFERENCE保留历史兼容，不再决定新业务路由：所有对话/规划/识别/提炼只走ZenMux，默认Flash；生图KIE优先，再到已核实的ZenMux同款，沿用原熔断。模型支持的分辨率和参数以登记及官方目录为准。
- 12-A新增的project-features.ts和NEXT_PUBLIC_FEATURE_*开关已删除，服务端暂停拦截全部撤销；不影响此前已有的会话联网选择、GOOGLE_SEARCH_ENABLED、权限、模型能力和账号配置检查。是否能返回联网结果仍取决于既有配置与上游支持，本轮不调用模型验证。
- 标记优秀仍是原有AI提炼和人工确认入库流程，并非无AI手动收藏；本轮恢复原入口和逻辑。

## 方案、提示词与生成约定
- propose_image_pack只表达目标reason，统一调用visual-planning.ts的proposeVisualPlan，不维护第二套图位生成逻辑；旧slots仅兼容历史调用。
- proposeVisualPlan接收当前会话最近20条用户意见，与产品资料一起进入已有方案调用；竞品研究、经验库检索按原流程执行。
- 全局prompt只放对所有产品适用的规则；具体结构、部件、尺寸、颜色、材质和拆装状态来自当前产品资料及用户对话。
- 不在全局写死层数/层间距、半透明拆卸或固定参考库图位顺序等规则；根据当前产品资料和用户目标安排图位，经验库只作表达参考。
- 保留主图、特写和后期叠加的既有通用要求，亚马逊主图仍要求至少2000px，不擅自改变分辨率或费用。
- 用户仍须确认产品理解和方案，终稿由用户选择；生成和修改不再等待费用确认，旧自动确认金额阈值不参与提交。手动模式先给“切回整套 / 只生成当前图位”选择，不擅自切模式。

## 开发约定
- UI文案和代码注释使用中文；不实现当前任务之外的功能。
- 不确定是否能删的共享代码先保留；mock/models.ts和library-store.ts中仍有真实模型类型、估价、附件预览与上传配对用途，不能因文件名整文件删除。
- 按当前任务执行验证；当前任务跑npm run lint、npm run typecheck、单元测试和npm run build；除用户明确授权的真实探测外，模型调用使用本地模拟，不截图。
- 纯样式小改动只跑lint和build；截图、录屏、GIF只在用户明确要求时制作。
- 开发记录写入docs/CHANGELOG.md；不得把过时交付说明当成当前状态。
- 用户明确要求提交后才提交；未授权不推送。

## 已知问题与后续事项
### 任务13-2：对话参考图链路已修复
- 原12-B缺口已接通：用途保存在AgentSession.settings.conversationImages，图位绑定保存在VisualSlot.references，冻结到ImageSlot.visualPlan，最终GenerationJob.input保存referenceUsage、omittedReferences、referenceLimit和有序referenceAssetIds。没有数据库结构迁移。
- 产品图与参考图分开；参考图只参考purpose明确的光线、构图、场景、色调、道具等，不改变产品身份。用途不清时用一句普通对话询问；上传风格参考不自动取消产品档案/方案。
- 方案卡沿用原样式，允许移除/替换参考图并编辑用途；冻结时验证对话来源、归属、未删除、每图位不超过2张。修改默认沿用原图实际使用的参考图，edit_image.references或局部编辑请求可显式替换，空数组表示不用参考。
- 对话入口：src/components/design-preview/live-workspace.tsx的RealChat.send传递canvas.referenceAssetIds；src/lib/planning-agent.ts的runAgentTurn经canvasContext解析引用，在LLMInput.images里传给对话模型。
- 用途记录：src/lib/conversation-images.ts的saveConversationImages/requireResolvedImages；src/lib/planning-agent.ts的set_image_roles工具处理和resolveSourceAliases。
- 建立与冻结方案：src/lib/visual-planning.ts的analyzeProduct/proposeVisualPlan生成identityLock.referenceAssetIds，confirmVisualPlan校验；src/lib/agent-actions.ts的approveAgentCard/applyProposal冻结ImageSlot.visualPlan。
- 报价与提交：src/lib/image-packs.ts的planBatch调用src/lib/scene-generation.ts的prepareSceneInput，后者读取冻结的identityLock.referenceAssetIds产品实拍及slot.references参考图，按模型上限选择并生成逐张用途说明。报价/提交指纹包含同一图片快照。
- 最终请求：src/lib/image-router.ts的generate将input.referenceAssetIds映射为ImageRequest.referenceImages，再交给ImageProvider，例如src/lib/kie-provider.ts的KieProvider.generate。src/lib/generation-references.ts的requestFromGenerationInput验证顺序，KIE实际发送image_input/input_urls/image_urls，ZenMux发送inlineData。未知多图能力直接报错，不用文字描述替代。
- 上限以供应商文档登记为准，场景图优先产品实拍、再按顺序保留参考图；局部编辑必须先保留编辑原图和蒙版，并至少保留1张实拍，其余同样按产品优先。省略信息显示在图片信息中。

### 其他已知事项
- 独立无AI手动收藏尚未实现；当前“标记优秀”仍为原有AI提炼及人工确认入库，不要称为免费收藏。
- 共享类型与真实附件预览仍位于旧mock目录/状态文件，后续单独拆分改名；本轮不删、不改这些共享实现。

### 任务14模型状态
- Gemini 3.8 Flash旧KIE行与ZenMux默认行合并为一条目录记录；旧ID作别名，旧探测留在history，不删除历史调用。
- 2026-10-30经ZenMux实测Flash与Haiku 5.5工具参数及上下文均20/20；Gemini 2.5 Pro上游40次404（区域/项目无模型权限），0/20不代表工具协议不兼容，用户已要求从配置和模型目录移除，不再探测；历史调用保留。
- 生图用户账单只汇总成功尝试，失败预留释放；失败上游尝试保留审计。网络超时时无法保证供应商未收费，不宣称网关端已退款。GPT Image 2.5的ZenMux回退预算暂沿用同款KIE预算作预留参考，实际费用等待账单回填，不伪称固定真实价格。
- 对应关系、探测记录、验证结果和手动步骤见docs/task14/README.md。

- 任务14最后收口：用户要求停止追加检查、立即提交并推送；不将未执行的build或未完成的额外回归标成通过。
