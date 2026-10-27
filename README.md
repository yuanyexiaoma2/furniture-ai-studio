# 家具电商 AI 生图工作台

## 如何运行

需要 Node.js 22.12+或24 LTS、Docker，以及本地PostgreSQL和MinIO。

1. 首次运行：复制 .env.example 为 .env，填写数据库、MinIO、Auth.js及管理员账号配置；AUTH_URL保持 http://localhost:3000。智能体使用服务端ZENMUX_API_KEY，生图使用KIE_API_KEY，所有凭据只保存在本机.env。
2. 安装并启动依赖、应用迁移：

```powershell
docker compose up -d
npm install
npx prisma generate
npx prisma migrate deploy
```

新环境再执行 `npm run seed`、`npm run seed:task10` 和 `npm run configure:models` 初始化账号、品类和模型目录。已有环境升级不需要重复导入种子，也不要重置数据库。

3. 网页和worker分别在两个终端常驻运行：

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

```powershell
npm run worker
```

打开 http://localhost:3000 使用已配置账号登录。MinIO控制台为 http://localhost:9001。已运行的服务不要重复启动；修改.env后重启网页和worker。生产环境先执行 `npm run build`，再分别运行 `npm run start` 和 `npm run worker`。

本地验证：`npm run lint`、`npm run typecheck`、`npm run build`、`npm run test:task10:units`、`npm run test:canvas`、`npm run test:image-models`、`node --import tsx --test tests/unit/workflow-prototype.test.ts`。浏览器回归执行 `npm run test:e2e`，需先启动网页和本地依赖；常规回归不截图或录屏。自动测试使用本地模拟模型，不验证付费出图效果。

## 当前功能

- 正式入口：`/`创作首页、`/skus`项目列表、`/workspace?sku=产品ID`工作台。原/design-preview对应页面保留301跳转及登录回跳。
- 账号密码登录、角色权限、账号管理和私有素材访问。管理员入口为 `/admin`，模型管理为 `/admin/models`，另有用户及网关管理。
- 实拍/文档上传、产品理解、档案确认、图包策划、费用确认、候选生成、选终稿和ZIP导出。
- 画布选图引用、便签与布局保存、生成进度、大图预览、候选修改和下载；手机可切换对话与画布。
- 智能体默认 Gemini 3.8 Flash，经ZenMux调用；生图默认KIE Nano Banana 2.1，另可手动选择GPT Image 2.5、Nano Banana 2、Nano Banana Pro、Qwen3。Auto目前优先默认候选。
- `/products/[id]`保留为“产品资料”，支持身份全文、实拍管理、单张生成与独立历史；新版产品卡可进入。旧图包工作页 `/products/[id]/pack`继续保留。
- 未接通的原型入口由 `src/lib/ui-features.ts` 的 `SHOW_UNCONNECTED_FEATURES=false` 统一隐藏，包括本地模板库操作、颜色变体、多语言/术语表、品牌和导出前检查。`/library`目前仅保留未接通说明。

所有模型请求仅在服务端执行，费用、配额、任务及实际模型留痕。真实出图需要本人确认并执行；不会自动运行付费验证。开发记录与待办见[CHANGELOG](docs/CHANGELOG.md)，第三方参考授权见[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
