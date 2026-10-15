# 家具电商 AI 生图工作台

公司内部创意工作空间。已实现账号密码登录、管理员用户管理、商品实拍管理、双网关场景生成和指令二次编辑、AI 提炼产品身份特征及网关状态后台。任务 2 已由用户验收；任务 3 验证记录见 [双网关验收记录](docs/task-3-progress.md)。

## 如何运行

任务 7 第三轮修订：登录后访问 <http://localhost:3001/design-preview>。保留五页结构，新增共享智能体 / 生图模型选择器、Auto 与手动质量档、后台模型可见联动；全面更新首页和画布视觉。全为静态假数据，不调用业务接口。模型配置结构、后台替换说明、20 张亮暗截图、约 24 秒操作录屏与逐条自查见 [第三轮交付](docs/design-preview/round3/README.md)。根路径仍是原业务首页；完成后停在第一阶段等待审阅。

目前只配置 KIE，ZenMux Key 为空时自动跳过。两家生图 / LLM 代码均已接入，无需未来改代码。协议和模型核实记录见 [docs/gateways.md](docs/gateways.md)。

本机重新打开项目：先确认 Docker Desktop 已启动，运行 `docker compose up -d`；在项目目录执行 `npm run dev -- --hostname 127.0.0.1`，另一终端执行 `npm run worker`，然后访问 <http://localhost:3000>。网页与 worker 都是常驻服务，无需等待退出。不要重复启动已运行的服务。

### 1. 环境准备

- 安装 Git、Node.js **22.12+ 或 24 LTS**、npm、Docker Desktop。
- 最初检查要求为 Node.js 20+；本项目 Prisma 7 要求至少 20.19，新环境推荐 Node.js 24 LTS。
- 打开 Docker Desktop，确认 `docker info` 正常返回。

```powershell
git clone https://github.com/yuanyexiaoma2/furniture-ai-studio.git
cd furniture-ai-studio
Copy-Item .env.example .env
```

macOS / Linux 将复制命令改为 `cp .env.example .env`。

### 2. 自行填写 .env

在本地编辑器中填写，不要在聊天、截图或 Git 提交中分享密钥和密码。

| 变量 | 用途 |
| --- | --- |
| `POSTGRES_USER`、`POSTGRES_DB` | 可保留示例的本地用户名和数据库名 |
| `POSTGRES_PASSWORD` | 自选数据库密码 |
| `DATABASE_URL` | `postgresql://furniture:URL编码后的密码@localhost:5432/furniture_ai_studio` |
| `AUTH_SECRET` | 至少 32 字节随机生成的 Auth.js 会话密钥 |
| `AUTH_URL` | 本地保留 `http://localhost:3000` |
| `ADMIN_NAME`、`ADMIN_EMAIL`、`ADMIN_PASSWORD` | 管理员姓名、邮箱和初始密码 |
| `MINIO_ROOT_USER`、`MINIO_ROOT_PASSWORD` | MinIO 账号，密码至少 8 个字符 |
| `S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_FORCE_PATH_STYLE` | 保留本地默认值，bucket 固定为 `assets` |
| `S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY` | 本地分别与 MinIO 用户名、密码一致 |

管理员及新增用户密码至少 12 个字符，UTF-8 编码最多 72 字节。数据库 URL 中密码的特殊字符需要 URL 编码。生成随机会话密钥：

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

如果连接地址格式不正确，可本人运行以下命令，根据已填的 `POSTGRES_PASSWORD` 自动构造本地连接地址，仅改 `.env` 的 `DATABASE_URL`，不显示密码：

```powershell
node scripts/configure-local-env.mjs --database-only
```

省略 `--database-only` 时也会重新生成 `AUTH_SECRET`，已有登录会话会失效。脚本只写本地被 Git 忽略的 `.env`。

`ZENMUX_API_KEY` 当前留空；`ZENMUX_BASE_URL=https://zenmux.ai/api/v1`、`ZENMUX_VERTEX_BASE_URL=https://zenmux.ai/api/vertex-ai`，两者为空也使用官方默认值。`GATEWAY_PREFERENCE=auto` 默认按候选顺序；`zenmux` / `kie` 优先指定网关，未配置直接跳过，符合条件的失败切换另一家。填写 `KIE_API_KEY`；`KIE_BASE_URL` 默认 `https://api.kie.ai`，`KIE_UPLOAD_BASE_URL` 默认 `https://kieai.redpandaai.co`。本地 `KIE_CALLBACK_URL` 留空，使用轮询。`PG_BOSS_SCHEMA` 保留 `pgboss`。旧的 `LLM_MODEL` / `ZENMUX_IMAGE_BASE_URL` 不再使用。

所有 `.env`、`.env.local`、`.env.*` 都已被 Git 忽略，只有 `.env.example` 可提交。可用 `git check-ignore .env .env.local` 验证。

### 3. 启动服务、迁移和种子

```powershell
docker compose up -d
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

已有项目升级时执行 `npm install` 和 `npx prisma migrate deploy`，增量迁移不会重置数据库。在第二个终端进入同一项目目录执行 `npm run worker`。worker 必须持续运行，网页和 worker 均需在修改 `.env` 后重启。密钥未配置、worker 未启动或月度美元配额不足时，页面会给出中文提示。

仓库提供初始迁移，`prisma migrate dev` 会直接应用；修改 schema 后该命令会要求输入新迁移名称。`npm install` 自动生成 Prisma 客户端，之后改 schema 时再执行 `npx prisma generate`。Prisma 7 不会自动执行种子，需显式运行 `npm run seed`。

- 工作台：<http://localhost:3000>，使用 `.env` 管理员账号登录。
- 用户管理：<http://localhost:3000/admin/users>。
- MinIO 控制台：<http://localhost:9001>；S3 API：<http://localhost:9000>。
- `minio-init` 自动创建私有 `assets` bucket，`docker compose ps -a` 中应为 `Exited (0)`。
- 本地使用 PostgreSQL 16；MinIO 来自官方 Quay 镜像，初始化容器复用镜像内置的 `mc`，无需额外下载 mc 镜像。
- 镜像固定到本次验证的 SHA-256 摘要，避免上游标签变化影响启动行为。
- 数据保存在 Docker 命名卷，`docker compose down` 停止服务并保留数据。修改已有数据库密码时，仅修改 `.env` 不会改变数据库内密码。
- 种子可重复执行：管理员已存在时保留现有密码及配置；不会提升已有普通用户权限。重置密码请在管理页面操作。

### 开发和生产 worker 启动与恢复

开发：网页执行 `npm run dev -- --hostname 127.0.0.1`，另一终端执行 `npm run worker`。生产：先 `npm install`、`npx prisma migrate deploy`、`npm run build`，再将 `npm run start` 和 `npm run worker` 分别作为独立常驻服务启动，由部署环境的服务管理器负责开机启动与崩溃重启。两项服务共用服务端环境变量、PostgreSQL和MinIO。不要重复启动worker，也不要等待常驻服务退出。

worker启动会接管旧KIE taskId继续轮询，不重新createTask；恢复遗漏pending，释放旧实例队列占用，接管后的异步任务有新10分钟查询窗口。ZenMux同步请求或未知taskId提交被worker中断时明确failed，不自动重发收费；核对账单后可重新生成。只重启网页不会停止独立worker。

上传默认redpanda，保留24小时，缓存23小时并更新最近上传时间；明确参考图访问失败仅同KIE重传一次。官方未确认备用上传域名，故障时依据官方确认修改 `KIE_UPLOAD_BASE_URL` 并重启，MinIO原图保留。详见 [域名及费用说明](docs/gateways.md)。

### 4. 检查与验收

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:e2e
npm run test:generation
npm run test:gateways
npm run test:agent
npm run test:agent:browser
```

端到端验收需要正在运行的 `npm run dev`、数据库及 `.env` 的管理员账号。默认使用本机 Chrome 的独立无头会话，不操作日常浏览器资料。没有 Chrome 时可运行 `npx playwright install chromium`，随后设置 `PLAYWRIGHT_CHANNEL=chromium`。

浏览器测试仅创建随机临时账号和 `E2E-` 商品，结束后清理自己创建的账号、商品与存储对象，不修改真实管理员密码或角色。验收覆盖登录与权限、商品保存、图片格式与上传数量、生成条件、模拟记录刷新留存、下载及移动端布局。不记录含密码的浏览器 trace，不发起真实 KIE 生图。

`test:generation` 使用随机隔离的本地 PostgreSQL 数据库、真实 MinIO 和本地模拟 KIE 服务，验证并发配额、事务入队、错误密钥、上传缓存、断网不重发、结果转存重试、超时和 429 退避。数据库账号需有创建数据库权限；测试结束会删除该临时数据库及测试对象，原 `.env` 不变。测试图不能替代同一家具 2～3 张不同角度实拍的真实验收。

进入商品页，先保存身份特征，将同一产品的 2～3 张实拍拖入参考区域，松手即上传；也可点击选择文件，选择后自动上传。图片可拖动排序，手机或键盘用户可用左右移动按钮；点击图片上的删除按钮后可重新上传。排序会持久保存，并进入新任务的参考快照。删除只移出当前参考，保留文件供旧任务使用，不影响生成历史。

输入场景意图、选择分辨率和比例后点击“生成一张场景图”。默认 2K / PNG，KIE 2K 预估 $0.030、4K 预估 $0.045，统一美元配额，原始积分另存，预计消耗与服务端配额同步变化。提供官方全部 15 个比例：1:1、2:3、3:2、3:4、4:3、4:5、5:4、9:16、16:9、21:9、1:4、4:1、1:8、8:1、自动。记录每 5 秒刷新，也可手动刷新；生成结果为待美工确认的候选图，可预览和下载。

对不满意的生成图点击“二次编辑”，在原图预览下填写修改要求，可选择 2K / 4K 和任意比例，再点击“生成编辑版本”。服务端核对原图属于当前商品且生成成功，使用原图作为第一张参考，后续为当前按顺序排列的实拍，并注入身份约束。原图保留，新版本记录来源与修改要求，成功后也可继续编辑。

用户月度配额按北京时间自然月以美元计算：`monthlyQuota` 为美元 Decimal，合计生图、LLM已消耗和未完成预留，调用前锁定用户原子校验。统一费用为 `costUsd`，KIE原始 `credits` 保留，`reservedUsd` 防并发超额。旧100积分按$0.005/积分迁移为$0.50，旧原始字段保留。实际消耗优先；缺失按配置预估并明确显示‘预估’。ZenMux由worker查询匹配账单后异步回填为‘实际’。失败且扣费未知时需核对账单。

SKU每次手动保存身份特征都追加全文、保存人和时间；生成input冻结实际使用的全文、版本及保存信息。历史缺失元数据标为未知，不伪造保存人。生成记录显示sharp读取的真实像素，长边小于2000px时显示黄色提示。

SKU 页“AI 提炼”读取已保存资料及排序最前的 2～3 张实拍图，返回结构与数量、比例、材质、五金、Logo 和易出错细节。只填写文本框，不自动保存；请核对修改后点击“保存产品资料”。`npm run test:gateways` 使用模拟 SDK 响应验证 ZenMux、路由与错误处理，不需要 ZenMux Key，也不发起付费请求。

## 启用 ZenMux

1. 在 ZenMux 开通 **Pay As You Go**，生成 API Key；生产环境不能使用 Builder Plan。
2. 在被 Git 忽略的 `.env` 填写 `ZENMUX_API_KEY`。保留 `ZENMUX_BASE_URL=https://zenmux.ai/api/v1`、`ZENMUX_VERTEX_BASE_URL=https://zenmux.ai/api/vertex-ai`、`GATEWAY_PREFERENCE=auto`（省略地址也会使用这些默认值）。不要把 Key 发到聊天或提交 Git。
3. 重启网页和 worker：开发环境重新运行 `npm run dev -- --hostname 127.0.0.1` 与 `npm run worker`；生产环境重启 `npm run start` 所属服务和 worker。无需改代码、模型配置或重建数据库。
4. 管理员进入 `/admin/gateways`，确认 ZenMux 显示已配置，依次点击“连通性测试 · LLM”和“连通性测试 · 1K 生图”。弹窗确认后才会调用并产生费用；测试占用美元月度配额，KIE 1K预估$0.020，ZenMux以参考预估和实际账单为准。测试固定指定网关，不会悄悄切换另一家，成功会清除该网关熔断。
5. 在商品页按正常流程生成或提炼。`auto` 优先 ZenMux；如需优先 KIE，将 `GATEWAY_PREFERENCE=kie` 并重启两项服务。

没有 ZenMux Key 时，其真实连通性、完整比例和参考数量上限仍需开通后验证；SDK 返回解析、参数发送、失败和熔断已通过模拟测试。逐次未知费用在后台明确标注，不假设固定美元单价。

### 5. 页面与权限

| 路径 | 权限与内容 |
| --- | --- |
| `/login` | 账号密码登录；已登录成员跳转首页 |
| `/` | 全员登录：SKU 项目列表，非 viewer 可新建商品 |
| `/products/[id]` | 全员登录：商品资料、参考图和持久生成记录，非 viewer 可保存、上传和生成 |
| `/templates` | 全员登录：模板库占位 |
| `/admin` | 仅管理员：用户管理和网关管理入口 |
| `/admin/users` | 仅管理员：新增用户、角色修改与密码重置 |
| `/admin/gateways` | 仅管理员：配置状态、数据库熔断、24 小时调用指标、分币种费用、付费测试和只读路由 |

四种角色为 `admin` / `template_editor` / `designer` / `viewer`。viewer 只读，不能创建、修改商品、上传实拍或生成图片。未登录页面跳转登录页，接口返回 401；非管理员后台请求返回 403。修改角色或重置密码会撤销目标用户旧会话。当前管理员不能降低自己的权限。

## 技术实现

- Next.js App Router + TypeScript、Tailwind CSS、官方 shadcn/ui 基础组件。
- Auth.js Credentials + JWT 会话、bcrypt 成本 12；权限在入口、布局和写入接口中检查。
- PostgreSQL + Prisma 7（pg driver adapter），业务模型包含关系、唯一约束及索引；新增调用账本和共享熔断表。
- API 使用用户资料字段白名单，密码哈希不会发送给浏览器；写入接口校验同源请求。
- pg-boss 执行串行提交与持久轮询，S3 SDK / sharp 负责实拍验证和结果转存；策划 Agent 已接入 llm-agent，包含流式对话、资料解析、档案/方案/费用确认、两种模式和单张调整。
- 后台页面拒绝访问使用 Next.js `forbidden()`，已启用 `experimental.authInterrupts` 并通过 403 浏览器验收；避免 rewrite 将拒绝页面状态覆盖为 200。参考 [Next.js 官方文档](https://nextjs.org/docs/app/api-reference/functions/forbidden)。
- `AGENTS.md` 保留指定原文，后续模型路由必须核实官方文档。

## 本机环境记录

| 工具 | 检测版本 |
| --- | --- |
| 操作系统 | Windows 11 专业版，64 位，10.0.26200 |
| Git | 2.53.0.windows.2 |
| Node.js / npm | 24.14.0 / 11.9.0 |
| Docker Desktop / Engine | 4.90.0 / 29.7.2 |
| GitHub CLI | 2.102.0 |
| Next.js / Prisma Client | 16.4.0 / 7.10.0 |
| Auth.js | next-auth 5.0.0-beta.32（官方 v5 安装渠道仍为 beta） |

本机 GitHub 登录及 Docker 引擎检查通过。Docker Hub 连接超时已通过复用缓存的 PostgreSQL 镜像和官方 Quay MinIO 镜像完成本地启动；新电脑仍需可以下载这些镜像。

## 本次完成内容

- 2026-10-15 任务 7 第三轮修订：完成首页与工作台共用 ModelPicker、模型统一配置与持久化、会话独立选择、后台可见 / 启用 / 默认联动、视觉质感升级、30 张不同家具样图、20 张亮暗截图和 45 秒内录屏。验证与自查见 [round3](docs/design-preview/round3/README.md)。

- 2026-10-15 任务 7 第一阶段收尾：修复选中图位时的对话作用对象与旧图片引用，补充空图位生成归属回归；lint、typecheck、正式构建及完整浏览器交互通过，十张截图和 12.97 秒操作 GIF 已核对。正式预览入口为 <http://localhost:3001/design-preview>，等待设计审阅。

- 2026-10-14 任务 7 第一阶段修订：新增 `/design-preview` 五页亮暗静态可交互原型；使用 Radix shadcn、React Flow、Konva、zustand、next-themes、motion 与 react-dropzone；交付十张截图、画布操作 GIF、安装前许可证核验记录与完整版权声明。业务逻辑与数据库未修改，等待设计审阅。

- 2026-10-14 任务 7 第一阶段：新增 `/design` 下四张静态高保真设计稿、统一设计规范、页面截图与说明；只读排查理解度、会话费用、实拍数量及旧档案候选四个问题，记录原因与修复方案。现有业务页面及问题逻辑未修改，等待用户确认后再迁移。详见 [任务 7 进度](docs/task-7-progress.md)。

- 2026-10-14 任务 5：实现对话式产品理解、PDF/Word/Excel/CSV资料解析、带来源与冲突的档案版本、7图位策划、生成费用确认、快速/手动模式和候选引用调整；复用既有双网关、配额、账本及身份冻结。自动测试与构建通过；真实SKU验收尚待用户资料和外传授权，不能视为真实验收完成。详见 [任务 5 进度](docs/task-5-progress.md)。

- 任务 4：新增 SKU 当前图包、7 个默认图位、图位编辑排序、批量候选生成、逐张失败重试、终稿选择与 ZIP 导出。仅复用 `scene-main`，默认 2K / PNG；现有双网关、费用账本、美元配额与身份版本冻结继续生效。详见 [任务 4 进度](docs/task-4-progress.md)。

### 图包与批量生成使用方法

1. 升级执行 `npm install`、`npx prisma migrate deploy`，重启网页和独立 worker，确保加载新 Prisma 模型。仍使用上述开发 / 生产启动命令，不增加服务。
2. 在 SKU 页点击“进入图包与批量生成”，套用默认图包。已有图位时会二次确认，仅补充缺失图位，保留已有意图、候选图和终稿。
3. 填写各 AI 场景图位的场景意图并保存；每位 1～4 张，默认 2 张。主图图位也是普通场景，不进行白底主图处理。人工上传图位本阶段只占位。
4. 点击“批量生成候选图”或“再来 N 张”，确认参与图位、张数、实时美元 / 积分估价与剩余额度。空意图自动跳过。配额计入进行中预留，不足则整批拒绝并显示差额。
5. 每张候选对应一个独立任务；失败卡片可单张重试，仍需费用确认。重试创建关联原失败记录的新任务，原扣费保留；进度统计替代后的有效任务，审计总任务数因此可能大于候选目标数。刷新 / 重启仍从数据库恢复。
6. 点击候选图放大，选择终稿。每位只有一个终稿；可取消或替换。删除候选只隐藏素材；终稿必须先取消才能删除。删除图位会归档保留生成审计，有终稿时再次确认。
7. “导出终稿”会列出未完成图位，确认后可只导出已完成部分。ZIP 含按当前图位顺序命名的 PNG 与 `manifest.json`，记录模型、费用、像素、身份版本等。文件从 MinIO 读取。

图包测试包含 `npm run test:gateways` 的规则单元测试、`npm run test:generation` 的隔离批次与失败重试，以及 `npm run test:e2e` 的图包浏览器流程；自动测试不调用付费网关。

- 2026-10-13 任务2/3审查：修补默认模型硬编码、四类业务错误、上传时间与参考重传、美元成本配额及非破坏迁移、像素警告、重启恢复、身份版本与全文冻结。17项单元、扩展隔离和浏览器回归通过；真实2K生成过程中重启网页，结果2048×2048、实耗5积分/$0.025。详见 [逐项审查记录](docs/task-2-3-review.md)。

- 2026-10-13 任务 3：完成 KIE / ZenMux 同步与异步生图、大语言模型抽象、统一路由、数据库共享熔断、调用账本、网关状态后台和 AI 产品身份提炼。真实商品 NL27TS01 的 KIE 提炼约 15 秒，消耗 0.25 积分；真实错误 Key 生图 / LLM 和恢复、偏好 ZenMux 但无 Key 跳过均已验证。13 项单元模拟、扩展隔离转存、3 项浏览器回归以及 lint / typecheck / build 通过；ZenMux 无 Key，仅模拟验证。详见 [任务 3 记录](docs/task-3-progress.md)。

- 2026-10-13 用户验收收尾：用户确认已测试，接受任务 2 及图片交互升级，明确授权保存并推送到 GitHub main。代码此前已通过 lint / typecheck / build、隔离生成测试和浏览器验收；本次保存最终验收记录与项目记忆。真实错误密钥专测未由助手单独执行，其自动模拟失败路径已通过，不将模拟测试表述为真实 API 验收。

- 2026-10-13 图片交互升级：拖入即上传、删除替换、拖动及按钮排序，全部 15 个画面比例与 2K / 4K 定价；新增选中原图的指令二次编辑和连续版本。非破坏性迁移已应用；现有真实商品、3 个素材文件与成功记录均完整保留。lint / typecheck / build、扩展隔离生成与浏览器验收通过；本次自动验收未额外调用付费 API。详见 [升级验收记录](docs/image-workflow-upgrade.md)。

- 2026-10-13 任务 2 续作：完成场景生成 API 与面板、北京时间月度积分原子预留、GenerationJob / pg-boss 事务入队、刷新留存、候选图预览与下载；修复超时预留、转存重试和后台 403。lint、typecheck、生产构建、登录权限回归、商品页浏览器验收及隔离生成测试通过。网页与 worker 已后台启动，未调用付费生图；仍待 TEST-001 实拍与真实 KIE 验收，未 push。详见 [续作记录](docs/task-2-progress.md)。

- 2026-10-12 任务 2 暂停点：商品创建、资料与身份特征保存、私有 MinIO 实拍上传及商品页已实现。生成面板、配额校验、真实 KIE 生图及完整验收尚未完成；本次未发起付费生图，尚未 push。续作清单见 [docs/task-2-progress.md](docs/task-2-progress.md)。

- KIE 适配器：服务端文件上传、23 小时缓存、任务提交与状态解析、429 指数退避；pg-boss 串行提交与持久轮询，10 分钟超时，成功后立刻保存到私有 MinIO。

- 任务 2 文档核实：确认 Nano Banana 2.1 API 模型为 `nano-banana-2-1`，记录价格、输入字段、任务查询与文件上传有效期；ZenMux 规划保留，当前不启用。

- 2026-10-12：重新启动本地工作台并打开登录页，HTTP 200；lint 与 typecheck 通过。

- 创建私有仓库、main 分支与环境变量忽略规则。
- 建立 Next.js / Tailwind / shadcn/ui 骨架与八个 Prisma 数据模型。
- 配置 PostgreSQL、MinIO 和私有 assets bucket 自动初始化。
- 实现登录、退出、全站登录保护与管理员权限。
- 提供管理员种子、用户新增、角色调整和密码重置。
- 提供 SKU 空列表、模板库与管理配置占位页。
- 提供环境模板、完整启动步骤和端到端验收脚本。

验收状态（2026-10-12）：PostgreSQL / MinIO 启动、assets 私有 bucket、初始迁移、管理员种子、完整登录与权限浏览器验收已通过；临时验收账号已清理。lint、typecheck 和生产构建通过。


### 策划 Agent 使用方法（任务 5）

1. 拉取更新后执行 npm install、npx prisma migrate deploy，重启网页和 worker。现有资料、候选、终稿保留；不运行 seed 或重置数据库。本机已执行迁移和重启。
2. 打开 SKU 的“图包与批量生成”页面：左侧策划 Agent，右侧现有图包看板。拖入多张 JPG/PNG/WEBP、PDF、DOCX、XLSX、CSV，或粘贴文字，点击“继续”让 Agent 读资料。单文件30MB，单次100MB，最多15文件；PDF最多200页。扫描/加密/损坏文件明确提示，其他文件照常解析。
3. Agent 先读全部资料和图片，标注图片类型，更新理解度及来源。实拍自动成为photo，生图从排序最前的最多3张实拍取参考；图片类型可在资料列表修改。问题卡每次最多3题；可选选项或填写。“停止提问，继续策划”会取消待答问卡，并要求列出未知项后继续理解确认。
4. 在产品理解卡逐项修改内容和状态，核实冲突后确认。非缺失字段需要内容和来源；美工确认会补记确认来源。确认后追加正式ProductProfile和身份特征版本；推测/缺失保持标注。新资料会取消旧档案、方案和费用卡，要求重新核对。
5. 图包方案从7个基础图位起步，修改名称、类型、方法、意图、比例和数量后确认。可增减方案项；未列出的已有图位继续保留，候选和终稿不删除。精确卖点/安装图的人工制作图位沿用既有占位方式。
6. 快速模式整套生成；手动模式只推进第一个尚未选择终稿的AI图位，先同意意图和费用，挑好后继续。两模式可随时切换，看板原有操作同步记入本人的SKU会话。
7. 生成和调整均显示内容、张数、预估美元和剩余额度。理解仍有必填缺失/冲突时必须勾选风险后继续。自动确认默认关闭，开启后单次不超过$1可直接执行；首次收费生成、第一批整套生成和不确定产品风险仍需手动确认。超过$1仍显示费用卡。手动模式的逐图位意图始终需要美工同意，自动确认不跳过逐位协商；图片调整仍可按门槛自动执行。
8. 候选图点击“和 Agent 调整”，输入“灯光暖一点、地面换成浅色木地板”等要求。编辑使用原候选+最多3张实拍+当前身份全文与版本，仍走edit路由和配额队列；新候选保留父图关系。Agent设终稿需要卡片确认，看板也可直接人工选择。
9. 会话按SKU与使用人保存，刷新继续；顶部显示LLM+生图累计费用，包含预估/预留时明确标注。工具过程及失败记录保留。确认卡执行中断后会核对原入队编号，恢复回执或原卡片，避免重复收费。

Agent测试：test:agent使用随机隔离PostgreSQL、真实MinIO和本地mock网关；test:agent:browser额外启动独立3105端口与.next-agent-test构建目录，完整验证快速和手动模式。普通test:e2e中的Agent两项会跳过，应单独运行前述命令；既有4项仍正常回归。测试不发送产品资料到外网、不调用付费模型。

真实资料兼容性：Next代理请求体允许102MB（业务上传仍为单次100MB/单文件30MB），Excel空值与富文本直接读取，不求值未缓存公式。Agent图片分析使用llm-agent的KIE Responses流式协议与现有图片上传缓存；确认后的作图阶段使用实时图位/任务状态，避免反复重读全文。

KIE费用记录读取Responses完成事件外层credits_consumed，完成后立即释放SSE连接；失败或早期缺少积分的请求保留“预估”标记，不把估算当实际费用。来源短编号映射到本SKU真实ID后严格校验，对话编号新增消息后保持稳定；新图位不得编造已有ID。真实图片仍需人工核对木色、五金、尺寸适配及隐藏部件，身份冻结和多实拍参考不等于零漂移保证。


### 任务 8A · 模板库、道具库与双档拍摄（2026-10-15）

新增结构化资料库、快速/严格拍摄、配方拼装和终稿沉淀静态原型，沿用任务 7 第三轮 UI。入口 `/design-preview/library`，后台新增品类设置与待审核条目；首页改为 Bento + 16:10 场景轮播。数据结构、迁移草案、接口替换说明、截图和录屏见 [任务 8A 交付说明](docs/task-8a/README.md)。当前仅本地 mock，不运行迁移、不调用模型，完成后等待审阅。

测试：`npm run test:prompt-composer`、`npm run lint`、`npm run typecheck`、`npm run build`；浏览器验收 `node scripts/verify-task8a.mjs`，录屏 `node scripts/record-task8a.mjs`。开发仍用 `npm run dev -- --port 3001`，无需启动 worker。任务 7 截图和交互记录保留在 `docs/design-preview/round3/`。


### 任务 7 · 第四轮：首页输入框减负（2026-10-15）

首页收回到附件/文字与单行工具两层，移除品类和拍摄标准；品类由 Agent 确认卡及可搜索选择器处理，严格档按后台默认给出本次选择，修改入口移到产品卡。16 张双主题截图、交互说明和验证命令见 [第四轮交付](docs/design-preview/round4/README.md)。22 项单测、lint/typecheck/build及浏览器验收通过，仍为静态 mock，停下等待审阅。运行方式仍为 `npm run dev -- --port 3001`。
