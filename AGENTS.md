# 项目：家具电商 AI 生图工作台（个人工具）

## 2026-11-11 美图调研后的五项主线优化（覆盖本范围内旧约定）
- 用户同意按调研建议实现参考适配、单图调整、同款换色、具体自主策划、手动收藏与复用；仍只调整创作页，不整体改首页或后台。
- 方案显示产品实拍和各图位参考，长描述用多行编辑；环境自由配色不改变产品本色。更换反推来源或用途后仍须按意见重写，不能确认未重新适配的描述。旧冻结方案和请求不迁移。
- 生成图的描述修改、放大预览和版本对比可以进入绑定原图的修改面板；同一页面内取消后保留该图草稿。提交直接走原报价、指纹、额度和队列，不调用 Agent，不增加费用确认。
- 明确的同款换色通过 appearanceChange 保存目标颜色/材质文字、可选参考和环境策略。保留源图造型、机位、构图；普通编辑仍锁产品颜色，后续修改则继承已完成的变体。目标参考必须真实进入生图输入，不能因上限被静默省略。换色不改产品档案、不与蒙版或扩图同时提交。
- 新的“收藏/我的收藏”使用 StudioLibraryEntry 的 saved_reference 类型，保存图片、实际提示词、参考、方案和用途，不调用模型；按账号隔离。复用时复制到当前产品、默认 prompt_only，不直接把旧产品提示词套给新品。
- 旧“标记优秀”仍为 AI 提炼与人工确认，保留入口；不得与新的手动收藏混称。
- 真实生成效果仍由用户实拍试用确认；本轮仅本地模拟，无真实模型调用或截图。详见 docs/workspace-flow-2026-11-11.md。

## 2026-11-10 工作台视觉优化（覆盖本范围内的旧样式限制）
- 用户明确授权学习美图的交互、UI与图标，优化当前工作台；仅创作页生效，首页与后台不整体改版。
- 工作台采用较窄且可收起的对话栏、独立模型行、分组的浮动图片工具栏、带缩略图的版本列表；保留费用展示、选中/固定引用、原功能及生成参数默认值。
- 收起对话不卸载输入区，不丢草稿或引用。图标按修改、引用、收藏、隐藏和导航的用途区分；新视觉规则集中在 workspace.css，使用 data-workspace 隔离。
- 继续使用本地模拟验收，不调用真实/付费模型、不制作截图。审美与真实出图满意度由用户试用确认。

## 2026-11-09 无参考与画布优化（覆盖冲突的旧约定）
- 用户授权同时优化无参考策划和自由画布交互，重点参考美图 AI 画布；此授权限于本轮工作台操作，不扩大为首页或全站改版。
- 无参考策划在已有调用内给出具体道具摆放、陈列疏密、机位与光线。默认一个完整推荐方案，不再按第4–8图位强制备选；用户要求比较方向时保留方向选择。旧冻结方案不变。
- 画布明确选中与固定引用；选中的图片仍随消息发送，取消选择不取消用户固定引用。隐藏只改布局、可恢复，不删除图片或终稿。
- 新图位默认三列，已有布局保留，主动“整理画布”可撤销。图片版本可定位、修改前后可对比；其他图片功能放入“更多”，不关闭原功能。
- 调研证据、实际浏览限制和验收走法见 docs/canvas-and-autonomous-planning.md。禁止用本地测试宣称实拍出图效果已提高。

## 2026-11-09 已确认的参考适配方向（覆盖下方冲突的旧约定）
- 保留自主策划，本轮优先复现用户有效流程：用户选择同类产品场景参考 → Agent 看图反推并适配本产品 → 只传产品实拍与适配文字生成。自动搜图和挑参考下一轮再做。
- 新对话参考默认 mode=prompt_only；明确要求直接传参考时用 image。历史无 mode 的参考仍传图片，不能改变旧冻结任务。每图位仍最多两张，多个参考通常分别对应多个场景。
- 产品颜色、结构、材质遵守实拍；场景、道具、陈列、机位与氛围按参考适配。用户要求自由配色时只放开环境/道具，不放开产品颜色。
- 道具池、场景池、历史组合去重只作建议，不强制限制池外道具、同场景或同道具复用。用户授权修正这些冲突及其编辑交互，未授权整体改版。
- 反推来源保存为 adaptedReferences / GenerationJob.input.promptReferences，不计作实际生图图片或超限省略。替换反推来源后通过现有“按意见重写”更新描述，无需额外写意见；不能沿用旧描述冒充新参考分析。
- 不增加独立反推调用，复用已有策划调用；不进行真实/付费模型验收，不把本地模拟通过称为出图效果验证。

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
- 独立无AI手动收藏已于2026-11-11实现；“标记优秀”仍为原有AI提炼及人工确认入库。两个入口分别维护，不能混淆。
- 共享类型与真实附件预览仍位于旧mock目录/状态文件，后续单独拆分改名；本轮不删、不改这些共享实现。

### 任务14模型状态
- Gemini 3.8 Flash旧KIE行与ZenMux默认行合并为一条目录记录；旧ID作别名，旧探测留在history，不删除历史调用。
- 2026-10-30经ZenMux实测Flash与Haiku 5.5工具参数及上下文均20/20；Gemini 2.5 Pro上游40次404（区域/项目无模型权限），0/20不代表工具协议不兼容，用户已要求从配置和模型目录移除，不再探测；历史调用保留。
- 生图用户账单只汇总成功尝试，失败预留释放；失败上游尝试保留审计。网络超时时无法保证供应商未收费，不宣称网关端已退款。GPT Image 2.5的ZenMux回退预算暂沿用同款KIE预算作预留参考，实际费用等待账单回填，不伪称固定真实价格。
- 对应关系、探测记录、验证结果和手动步骤见docs/task14/README.md。

- 任务14最后收口：用户要求停止追加检查、立即提交并推送；不将未执行的build或未完成的额外回归标成通过。
