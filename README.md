# 家具电商 AI 生图工作台

公司内部创意工作空间。任务 1 实现项目骨架、账号密码登录和管理员用户管理。

## 如何运行

任务 2 仅启用 KIE，ZenMux 未开通、未启用。官方模型与字段核实记录见 [docs/kie-notes.md](docs/kie-notes.md)。

本机重新打开项目：数据库和 MinIO 已运行时，在项目目录执行 `npm run dev -- --hostname 127.0.0.1`，然后访问 <http://localhost:3000>。

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

`ZENMUX_API_KEY`、`ZENMUX_BASE_URL`、`LLM_MODEL`、`ZENMUX_IMAGE_BASE_URL` 留空，ZenMux 未启用。填写 `KIE_API_KEY`；`KIE_BASE_URL` 留空默认 `https://api.kie.ai`，`KIE_UPLOAD_BASE_URL` 留空默认 `https://kieai.redpandaai.co`。本地 `KIE_CALLBACK_URL` 必须留空，使用轮询。`PG_BOSS_SCHEMA` 保留 `pgboss`。

所有 `.env`、`.env.local`、`.env.*` 都已被 Git 忽略，只有 `.env.example` 可提交。可用 `git check-ignore .env .env.local` 验证。

### 3. 启动服务、迁移和种子

```powershell
docker compose up -d
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

任务 2 的增量迁移可通过 `npx prisma migrate deploy` 应用，不会重置数据库。在第二个终端进入同一项目目录执行 `npm run worker`。worker 必须持续运行，网页和 worker 均需在修改 `.env` 后重启。密钥未配置、worker 未启动或月度积分配额不足时，页面会给出中文提示。

仓库提供初始迁移，`prisma migrate dev` 会直接应用；修改 schema 后该命令会要求输入新迁移名称。`npm install` 自动生成 Prisma 客户端，之后改 schema 时再执行 `npx prisma generate`。Prisma 7 不会自动执行种子，需显式运行 `npm run seed`。

- 工作台：<http://localhost:3000>，使用 `.env` 管理员账号登录。
- 用户管理：<http://localhost:3000/admin/users>。
- MinIO 控制台：<http://localhost:9001>；S3 API：<http://localhost:9000>。
- `minio-init` 自动创建私有 `assets` bucket，`docker compose ps -a` 中应为 `Exited (0)`。
- 本地使用 PostgreSQL 16；MinIO 来自官方 Quay 镜像，初始化容器复用镜像内置的 `mc`，无需额外下载 mc 镜像。
- 镜像固定到本次验证的 SHA-256 摘要，避免上游标签变化影响启动行为。
- 数据保存在 Docker 命名卷，`docker compose down` 停止服务并保留数据。修改已有数据库密码时，仅修改 `.env` 不会改变数据库内密码。
- 种子可重复执行：管理员已存在时保留现有密码及配置；不会提升已有普通用户权限。重置密码请在管理页面操作。

### 4. 检查与验收

```powershell
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

端到端验收需要正在运行的 `npm run dev`、数据库及 `.env` 的管理员账号。默认使用本机 Chrome 的独立无头会话，不操作日常浏览器资料。没有 Chrome 时可运行 `npx playwright install chromium`，随后设置 `PLAYWRIGHT_CHANNEL=chromium`。

测试仅创建随机邮箱临时账号，结束后删除自己创建的账号，不修改真实管理员密码或角色。验收覆盖管理员登录、创建设计师、退出后设计师登录、viewer 后台及接口 403、角色变更和密码重置后的会话失效。不记录含密码的浏览器 trace。

### 5. 页面与权限

| 路径 | 权限与内容 |
| --- | --- |
| `/login` | 账号密码登录；已登录成员跳转首页 |
| `/` | 全员登录：SKU 项目空列表 |
| `/templates` | 全员登录：模板库占位 |
| `/admin` | 仅管理员：管理入口，其余设置占位 |
| `/admin/users` | 仅管理员：新增用户、角色修改与密码重置 |

四种角色为 `admin` / `template_editor` / `designer` / `viewer`。本阶段除后台外页面权限相同，后续定义业务权限。未登录页面跳转登录页，接口返回 401；非管理员后台请求返回 403。修改角色或重置密码会撤销目标用户旧会话。当前管理员不能降低自己的权限。

## 技术实现

- Next.js App Router + TypeScript、Tailwind CSS、官方 shadcn/ui 基础组件。
- Auth.js Credentials + JWT 会话、bcrypt 成本 12；权限在入口、布局和写入接口中检查。
- PostgreSQL + Prisma 7（pg driver adapter），八个业务模型包含关系、唯一约束及索引。
- API 使用用户资料字段白名单，密码哈希不会发送给浏览器；写入接口校验同源请求。
- pg-boss、S3 SDK、AI SDK、sharp 已安装，本阶段没有业务调用。
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
