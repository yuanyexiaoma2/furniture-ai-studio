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

本轮品类经验初始化执行 `node --conditions=react-server --import tsx scripts/import-visual-patterns.ts`：保留原示例并标记为示例，导入用户提供的鞋架视觉经验；9条案例图片引用保持待上传。竞品参考以产品资料页上传的5–10张截图或链接为主，不再依赖Tavily。可选的Gemini Google Search文字补充默认关闭（`GOOGLE_SEARCH_ENABLED=false`）；只有验证ZenMux返回带来源的搜索结果后才启用，失败不阻塞规划。

3. 网页和worker分别在两个终端常驻运行：

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3000
```

```powershell
npm run worker
```

打开 http://localhost:3000 使用已配置账号登录。MinIO控制台为 http://localhost:9001。已运行的服务不要重复启动；修改.env后重启网页和worker。生产环境先执行 `npm run build`，再分别运行 `npm run start` 和 `npm run worker`。

如果本机访问模型服务需要代理，在启动网页、worker和真实验收进程前设置 `NODE_USE_ENV_PROXY=1`、`HTTPS_PROXY`、`HTTP_PROXY` 为本机实际可用地址，`NO_PROXY=localhost,127.0.0.1,::1` 保持数据库和MinIO直连。不要把代理端口或凭据写进业务代码。

评分页升级需要执行上面的Prisma生成和迁移命令；新增评分表独立于经验库。打开 `docs/review/<sku>.html` 可离线查看，点击“打开可保存评分的评审页”后登录评分；实时汇总为 `/reviews/summary`，离线汇总为 `docs/review/summary.html`。

本地验证：`npm run lint`、`npm run typecheck`、`npm run build`、`npm run test:units`（完整106项纯单元测试）、`npm run test:visual-plan`、`npm run test:canvas`、`npm run test:image-models`。浏览器回归执行 `npm run test:e2e`，两个隔离Agent流程另用 `npm run test:agent:browser`；需先启动网页和本地依赖，不截图或录屏。自动回归使用本地模拟模型；真实验收另需明确授权。

UI 截图验收需先启动网页并配置本地管理员登录；阶段3使用 `node --import tsx scripts/ui-snapshots.ts --mode=compare --baseline=docs/ui-audit/baseline-phase3 --output=docs/ui-audit/phase3-check --audit`。固定夹具覆盖44种页面/主题/宽度组合，不调用模型或写入商品。比较前核对Chrome、操作系统和字体文件指纹；环境变化先在原版提交重拍基线，不直接出差异率。历史阶段1基线仍保留。已知问题见 [known-issues](docs/ui-audit/known-issues.md)。

UI静态检查执行 `npm run lint:ui`：仅保留6项商品/品牌数据色白名单，禁止新增违规。旧页对比：`node --import tsx scripts/ui-snapshots.ts --suite=studio --mode=compare --baseline=docs/ui-audit/phase2b-studio --environment-baseline=docs/ui-audit/baseline-phase3 --output=docs/ui-audit/phase3-check-studio --allow-size-change --audit`。该历史旧页基线没有字体记录，显式借用本轮原版环境锚点并保留这一限制，不补造历史数据。截图与逐项说明见`docs/ui-audit/phase3-prep.md`。

准备修正的32个状态用 `node --import tsx scripts/ui-snapshots.ts --prep-fix --mode=compare --baseline=docs/ui-audit/phase3-prep-fix-before --output=docs/ui-audit/prep-fix-check --allow-size-change --audit` 复查；聚焦、键盘及图库悬停用 `node --import tsx scripts/ui-prep-fix-check.ts`，目录上传仅本地拦截。逐项说明见`docs/ui-audit/phase3-prep-fix.md`。

## 当前功能

- 首页、SKU与模板库使用共享内容宽度和亮暗层级；SKU优先展示已选主图，白底图完整contain。登录支持空字段行内提示，模板库保留原生文件夹选择与键盘展开。
- 正式入口：`/`创作首页、`/skus`项目列表、`/workspace?sku=产品ID`工作台。原/design-preview对应页面保留301跳转及登录回跳。
- 账号密码登录、角色权限、账号管理和私有素材访问。管理员入口为 `/admin`，模型管理为 `/admin/models`，另有用户及网关管理。
- 实拍/文档上传、产品理解、档案确认；Agent分析本产品卖点、研究竞品、检索品类经验，再提出逐图位可编辑的视觉方案。确认后冻结选择，报价、提交和生成读取同一份快照。
- 关键图位4–8提供2–3个方向及理由，点选后确认冻结；场景和道具从池子挑选，支持陈列/机位/光线/备注编辑及按意见重写。本SKU及同品类最近5个其它SKU的已用组合去重，记录原方案与确认方案差异。对话提案、规划图包及旧单张入口共用同一流程。
- 首页完整静态创作提示保留Tab补全；首页与对话输入面板采用20px圆角、轻边框，聚焦无视觉变化，底栏按钮常态透明；旧工作流控制台共用输入样式，首页外层不接管键盘焦点。
- 画布选图引用、便签与布局保存、生成进度、大图预览、候选修改和下载；固定跟随工具条、真实像素角标、多选对比/下载/移除、布局撤销重做及整合后的底部工具；手机可切换对话与画布。
- 对话按整图或局部范围推进修改；画布支持矩形/画笔蒙版和修改要求，服务端合成保证蒙版外像素不变。每次修改保留新旧版本，可对比、切换终稿；优秀定稿提炼为案例和经验，另经人工确认入库。
- 智能体默认 Gemini 3.8 Flash，经ZenMux调用；生图默认KIE Nano Banana 2.1，另可手动选择GPT Image 2.5、Nano Banana 2、Nano Banana Pro、Qwen3。Auto目前优先默认候选。
- `/products/[id]`保留为“产品资料”，支持身份全文、实拍管理、单张方案与独立历史；新版产品卡可进入。旧图包工作页 `/products/[id]/pack`继续保留。
- 产品资料支持主图与补充图、参数、卖点、竞品截图和链接；竞品逐图拆解空间/道具/陈列/卖点讲法/机位，再归纳常见套路、同质化与差异化机会。无参考图时方案顶部明确提示；联网文字仅作补充参考。
- `/library`支持单个历史Listing文件夹导入（1–30张图片+可选TXT/JSON参数），Agent拆解后先待审，人工编辑审核通过才入库。每次方案生成、确认或样图落盘会更新 `docs/review/<sku>.html`，在同一页查看方案和所有样图版本。
- 盲测评分：每图位“采用 / 小改 / 重做”及一句原因；逐轮冻结方案/样图版本和经验库条目数量，记录登录评分人及北京时间。修改评分保留历史，汇总按产品/轮次列出三档与未评数量，并对比第一、第二轮；评分不计入经验库。验证执行 `npm run test:reviews`。
- `/library`展示真实品类经验：场景、卖点表达、配饰池、常见图位顺序、案例；示例和未上传案例不参与检索。未接通的原型操作、颜色变体、多语言/术语表、品牌和导出前检查继续由统一开关隐藏。

所有模型请求仅在服务端执行，费用、配额、任务及实际模型留痕。真实出图验证仅按用户明确授权执行。开发记录与待办见[CHANGELOG](docs/CHANGELOG.md)，第三方参考授权见[THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md)。
