# 家具电商 AI 生图工作台

## 安装

需要Node.js 22.12+或24 LTS、npm、Docker。个人自用流程为：先在对话里讨论方案，确认方案和费用后再出图。

1. 复制.env.example为.env，填写下方环境变量。真实.env不要提交Git。
2. 启动本地依赖、安装依赖和应用已有迁移：

```powershell
docker compose up -d
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run configure:models
```

seed只在新环境创建管理员，已有管理员不改密码；configure:models登记现有模型目录，不调用模型。不要为启动重新导入task10示例或视觉经验种子，不重置已有数据库。

## 启动

Web与worker分别在两个终端运行：

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

```powershell
npm run worker
```

浏览器打开http://localhost:3000，使用配置的管理员账号登录。MinIO控制台为http://localhost:9001。

生产方式：先npm run build，再分别运行npm run start与npm run worker。仅前端/Web代码更新时重新build并重启Web；worker代码或它使用的环境变量变化时再重启worker。修改公共功能开关后也需重新build并重启Web。已运行的进程不要重复启动。

## 环境变量

| 配置 | 用途 |
|---|---|
| POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / DATABASE_URL | 本地Postgres；URL密码与compose配置一致，特殊字符需URL编码 |
| AUTH_SECRET / AUTH_URL | Auth.js；本地AUTH_URL=http://localhost:3000 |
| ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD | 首次管理员种子；密码至少12字符且UTF-8最多72字节 |
| MINIO_ROOT_USER / MINIO_ROOT_PASSWORD | 本地MinIO账号 |
| S3_ENDPOINT / S3_REGION / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY / S3_FORCE_PATH_STYLE | 私有图片存储；本地endpoint为http://localhost:9000，force path style为true |
| ZENMUX_API_KEY / ZENMUX_BASE_URL | 默认对话Agent走ZenMux Gemini 3.8 Flash；base=https://zenmux.ai/api/v1 |
| ZENMUX_VERTEX_BASE_URL | 现有ZenMux生图备用线路；默认https://zenmux.ai/api/vertex-ai |
| KIE_API_KEY / KIE_BASE_URL / KIE_UPLOAD_BASE_URL | 默认生图走KIE Nano Banana 2.1；base=https://api.kie.ai，上传地址见.env.example |
| GATEWAY_PREFERENCE | auto时对话优先ZenMux、生图优先KIE；也可指定zenmux或kie。空密钥的网关跳过 |
| KIE_CALLBACK_URL / PG_BOSS_SCHEMA | 本地回调地址留空，worker轮询；队列schema默认pgboss |
| GOOGLE_SEARCH_ENABLED | 旧搜索能力开关保持false，仍受下面的暂停开关限制 |
| NEXT_PUBLIC_FEATURE_LIBRARY_IMPORT | 历史Listing导入/审核，默认false |
| NEXT_PUBLIC_FEATURE_LIBRARY_PATTERNS | 品类经验整理、审核与JSON展示，默认false |
| NEXT_PUBLIC_FEATURE_LIBRARY_RETRIEVAL | 自动经验库检索，默认false |
| NEXT_PUBLIC_FEATURE_WEB_RESEARCH | 联网搜索和竞品分析，默认false |
| NEXT_PUBLIC_FEATURE_CASE_EXTRACTION | 标记优秀/AI案例提炼，默认false；手动收藏待12-C |

NEXT_PUBLIC仅用于公开功能开关，不得放密钥。供应商凭据只在服务端使用；配置不代表已完成上游能力验证。参考图尚未接入图包生图的缺口见AGENTS.md已知问题，12-A不修改此链路。

如果模型服务需代理，在启动Web/worker前设置本机实际可用的HTTP_PROXY、HTTPS_PROXY和NODE_USE_ENV_PROXY=1；NO_PROXY=localhost,127.0.0.1,::1保持本地服务直连，不把代理凭据写进代码。
