# 项目：家具电商 AI 生图工作台（个人工具）

## 目标与成本原则
- 目标是让工具更好用：围绕当前产品资料与用户对话策划、确认方案、生成、修改和挑选图片。
- 控制成本的方式是让用户看到费用、自己决定，不是关闭功能。联网搜索、竞品分析、经验检索、标记优秀、Listing导入和模板审核沿用原功能与原配置，不设置12-A暂停开关或拦截。
- 生图默认每图位1张、1K，用户可自行调高数量和分辨率；保留生图前费用确认卡。已有明确设置和历史冻结输入不自动重置。
- 不为本轮验收调用真实或付费模型；需要真实验证时给用户步骤，由用户决定是否执行。

## 界面硬规则
- 除非用户明确要求，不许改动界面布局和样式。后台、提示词或默认参数任务不得顺带改变页面结构、间距、颜色、文案、图标或假数据展示。
- 本轮恢复12-A之前的已认可界面，只有用户指定的数量/分辨率默认值可调整；不截图、录屏或制作GIF。

## 技术栈与架构
- Next.js App Router + TypeScript，Tailwind CSS + shadcn/ui；不擅自更换。
- PostgreSQL + Prisma；pg-boss任务队列，不引入Redis；本地docker compose运行Postgres和MinIO。
- S3兼容存储、Auth.js账号密码登录、sharp图片处理；Web与worker为独立进程。
- 外部API仅在服务端调用，密钥不得发送到前端、日志或Git。不得输出真实.env中的密钥。
- 图像继续走ImageProvider及models.config.ts路由表；记录实际provider/model、参数、费用和发起人。
- 不改费用公式、预留、账本、队列、熔断、双网关或数据库结构。默认参数变化必须同时用于报价和提交；保留原费用确认、指纹和权限检查。
- 不删除或重置现有产品、模板库、案例、生成记录或已确认方案。

## 供应商与功能状态
- ZenMux和KIE都已接入；当前对话Agent默认ZenMux Gemini 3.8 Flash（google/gemini-3.8-flash），生图默认KIE Nano Banana 2.1。
- 对话配置为ZENMUX_API_KEY、ZENMUX_BASE_URL；ZenMux生图备用线路为ZENMUX_VERTEX_BASE_URL。KIE使用KIE_API_KEY、KIE_BASE_URL、KIE_UPLOAD_BASE_URL，异步结果由worker转存S3。
- auto网关偏好沿用原路由与熔断策略；具体模型支持的分辨率和参数以代码登记及真实目录为准，不猜模型ID。
- 12-A新增的project-features.ts和NEXT_PUBLIC_FEATURE_*开关已删除，服务端暂停拦截全部撤销；不影响此前已有的会话联网选择、GOOGLE_SEARCH_ENABLED、权限、模型能力和账号配置检查。是否能返回联网结果仍取决于既有配置与上游支持，本轮不调用模型验证。
- 标记优秀仍是原有AI提炼和人工确认入库流程，并非无AI手动收藏；本轮恢复原入口和逻辑。

## 方案、提示词与生成约定
- propose_image_pack只表达目标reason，统一调用visual-planning.ts的proposeVisualPlan，不维护第二套图位生成逻辑；旧slots仅兼容历史调用。
- proposeVisualPlan接收当前会话最近20条用户意见，与产品资料一起进入已有方案调用；竞品研究、经验库检索按原流程执行。
- 全局prompt只放对所有产品适用的规则；具体结构、部件、尺寸、颜色、材质和拆装状态来自当前产品资料及用户对话。
- 不在全局写死层数/层间距、半透明拆卸等产品特定规则；产品结构、部件数量和尺寸比例要与当前实拍一致。
- 保留主图、特写和后期叠加的既有通用要求；亚马逊主图仍要求至少2000px，1K时由原校验提示用户改选2K/4K，不擅自提高分辨率或费用。
- 用户确认产品理解、方案及费用后再生成；人工选择终稿。自动确认和快速/手动模式沿用原实现，不替用户开启或修改。

## 开发约定
- UI文案和代码注释使用中文；不实现当前任务之外的功能。
- 不确定是否能删的共享代码先保留；mock/models.ts和library-store.ts中仍有真实模型类型、估价、附件预览与上传配对用途，不能因文件名整文件删除。
- 按当前任务执行验证；本轮只跑npm run lint、npm run build，不截图、不跑完整回归、不调用模型。
- 纯样式小改动只跑lint和build；截图、录屏、GIF只在用户明确要求时制作。
- 开发记录写入docs/CHANGELOG.md；不得把过时交付说明当成当前状态。
- 用户明确要求提交后才提交；未授权不推送。

## 已知问题与后续事项
- 12-B：对话引用图片目前只传给对话模型，图包生图仅读取冻结的产品实拍。前端RealChat.send → planning-agent.runAgentTurn/canvasContext → LLMInput.images；生图链为proposeVisualPlan/confirmVisualPlan → agent-actions.approveAgentCard/applyProposal冻结ImageSlot.visualPlan → image-packs.planBatch → scene-generation.prepareSceneInput → image-router.generate。参考图尚未贯通，本轮不修改。
- 12-C：独立无AI手动收藏尚未实现；恢复的“标记优秀”仍可能调用AI提炼，不要把它称为免费收藏。
- 共享类型与真实附件预览仍位于旧mock目录/状态文件，后续单独拆分改名；本轮恢复原文件，不改这些共享实现。
