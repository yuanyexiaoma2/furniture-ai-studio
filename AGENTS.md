# 项目：家具电商 AI 生图工作台（公司内部应用）

## 目标
公司内部 Web 应用，全员登录使用。美工与 AI Agent 对话，策划亚马逊 listing 图包，
调用生图 API 批量生成候选图，挑选、对话精修、下载。

## 技术栈（不要擅自更换）
- Next.js（App Router）+ TypeScript
- Tailwind CSS + shadcn/ui
- PostgreSQL + Prisma
- pg-boss 任务队列（基于 Postgres，不引入 Redis）
- S3 兼容存储（@aws-sdk/client-s3；本地开发用 MinIO）
- Vercel AI SDK（LLM 对话与工具调用）
- Auth.js（第一版账号密码登录）
- sharp（本地图片处理）
- 本地开发用 docker-compose 运行 Postgres 和 MinIO

## 外部服务
- 当前阶段仅启用 KIE，ZenMux 待开通后再接入。以下 ZenMux 规划保留。
- LLM：ZenMux（OpenAI 兼容协议）。环境变量 ZENMUX_API_KEY, ZENMUX_BASE_URL, LLM_MODEL
- 生图：ZenMux + KIE 双网关，互为备份
  - ZenMux 生图走 Google Gemini 协议（@google/genai，base URL 指向 ZenMux），同步返回图片。
    文档：https://zenmux.ai/docs/zh/guide/advanced/image-generation.html
  - KIE 为异步任务（taskId → 回调/轮询），结果仅保留 14 天，必须立即转存到 S3；
    限流 20 请求/10 秒，需队列限速与 429 指数退避。文档：https://docs.kie.ai
  - 模型 ID 与参数必须从官方文档核实，禁止猜测
- 生图统一通过 ImageProvider 接口 + models.config.ts 路由表调用；
  业务代码只使用逻辑模型名（scene-main / edit / remove-bg 等）
- 路由按顺序失败切换（超时/5xx/429/内容拦截），网关级熔断；
  每次生成记录实际使用的 provider 与 model

## 业务规则：场景图
- 输入：同一产品 2~3 张不同角度实拍图（多图参考），可附 1 张风格参考图
- 每个 SKU 有一份「产品身份特征」（LLM 读图 + 商品数据生成，美工确认后保存），生成时自动注入提示词
- 必须锁定：结构与部件数量、尺寸比例、颜色与材质纹理、五金样式与位置、Logo
- 允许模型自由发挥：角度、机位、构图、光线、氛围、房间风格、软装、自然阴影与反光
- 场景模板描述"场景意图"，不规定具体机位光位（除非模板明确要求）
- 默认输出 2K
- 亚马逊主图：纯白背景 RGB(255,255,255)，产品占比 ≥85%，长边 ≥2000px
- Agent 提出图包方案后，必须等用户确认才能批量生成
- 生成结果须美工确认后才成为终稿

## 架构规则
- 所有外部 API 只在服务端调用，密钥不得出现在前端
- 每次生成写入 GenerationJob（provider、model、参数、费用、发起人、结果）
- 生成前检查用户月度配额
- 提示词模板与模型配置放在数据库或配置文件中，不要硬编码在组件里

## 开发约定
- 继续任务 2 前先阅读 `docs/task-2-progress.md` 的暂停点与续作清单，不能将阶段实现视为任务已验收完成。
- UI 文案与代码注释使用中文
- 每个任务完成后 npm run lint 与 npm run typecheck 必须通过；纯样式小改动按下方专用验收规则执行
- 每个任务结束时，在 README 中更新"如何运行"和"本次完成内容"
- 不要实现当前任务范围之外的功能
- 个人项目阶段，优先让功能能真实使用。浏览器录屏、截图、GIF 只在我明确要求时制作。
- README 只保留"如何运行"和"当前功能"，每次的开发记录写入 docs/CHANGELOG.md。
- 全局提示词（src/prompts/）只写对所有家具都成立的规则；只针对某个品类的规则写进品类或模板配置，只针对某个产品的写进该产品的身份特征。
- 不调用付费模型；需要真实出图验证时，列出步骤由我执行。

- 纯样式小改动（颜色、圆角、间距、边框）只跑 npm run lint 和 npm run build，不截图、不做像素对比、不跑完整回归；只有改交互、改布局结构或者阶段结束时，才做完整验收。
