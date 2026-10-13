# 任务 4：图包与批量生成

## 修改前梳理与复用方案

- 已阅读根目录 AGENTS.md、README、gateways.md、task-2-3-review.md，以及现有 ImagePack / ImageSlot / GenerationJob、scene-generation、quota、generation-queue 和 prompts/scene.ts。
- 复用 scene-generation 的产品锁、身份版本全文快照、参考图选择与任务创建逻辑；提取事务内创建入口供单张和批次共用。批次仅使用 scene-main、2K、PNG。
- 复用 configuredCandidate / estimateImageUsd / assertUsdQuota / monthlySpendUsd：整批锁定用户后检查美元消耗及进行中预留，一次事务创建所有任务并通过 fromPrisma 入队，不重复实现路由、限流或账本。
- 复用现有 worker、双网关失败切换与熔断、KIE 重启接管、save-generation-result 的 MinIO 转存与 sharp 实际像素记录。图位 goal 传入唯一 prompts/scene.ts；不新增机位、光位模板。
- ImagePack 增加版本标识及当前标识，ImageSlot 增加名称、候选数、比例及归档字段。已有图位套用默认草稿时保留原有内容；删除只归档，候选只隐藏 Asset，GenerationJob 始终保留。
- GenerationBatch 记录发起人与估价，逐张 GenerationJob 关联 batchId / slotId；重试保留原失败任务并建立替代关系，进度统计当前有效任务，原费用仍计入配额和审计。
- 看板复用现有认证、同源写入检查、只读权限、素材读取接口。导出读取 MinIO、统一转 PNG 并附 manifest，不依赖上游 URL。
- 本阶段不实现 Agent、模板库、白底主图处理、尺寸图生成、抠图、超分、质检、蒙版或人工上传流程。

## 阶段进度

- [x] 现有代码梳理与复用方案（修改业务代码前记录）
- [x] 图包与图位
- [x] 批量生成与配额确认
- [x] 候选图看板
- [x] 终稿导出
- [x] 模拟测试、浏览器测试和真实 6 张验收
- [x] README 与分阶段提交；最终推送见 Git 远端记录

## 实现与数据取舍

- `/products/[id]/pack` 为当前图包页，SKU 页提供入口。数据库部分唯一索引保证每个商品最多一个当前图包；保留 version 字段，本次无版本切换界面。
- 默认图位全部先留空意图，用户填写并保存后才参与生成。已有图位套用默认图包仅补充缺失项，不覆盖既有意图、参数、候选或终稿。删除图位使用 deletedAt 归档。
- 确认框使用服务端当前候选与 models.config 单价。提交时校验图位、身份快照和价格指纹，若变化则重新确认。用户行锁下整批校验、创建逐张 GenerationJob 和事务入队，避免半批提交。请求编号避免网络重发重复收费。
- 重试产生新 GenerationJob，以 retryOfId 指向失败记录并沿用该图的冻结身份与场景输入；仍关联原 batchId / slotId。原费用保留，重试再次估价确认。批次完成数仅计算未被替代的任务，历史任务数量可大于目标图片数。重复重试受唯一约束保护。
- GenerationBatch 保存发起人、时间、图位数、目标张数、初次估价及状态；数据库触发器随任务状态更新批次。看板进度从任务持久记录计算，包括原有恢复流程的成功 / 失败结果。
- 终稿为每个图位的单一 finalAssetId，选择时校验候选归属、成功状态和未隐藏。隐藏候选不删除 GenerationJob 或 MinIO；原商品页也不再展示隐藏结果。
- 导出使用当前可见图位序号，读取 MinIO 并由 sharp 转 PNG；ZIP 为标准 store 格式（PNG 已压缩），UTF-8 文件名，附实际费用 / 预估标记、原积分、冻结身份全文及版本。未完成图位先提示，确认后导出部分。

## 自动测试证据

- 22 项单元测试通过：配置动态估价、已消耗加预留的配额差额、空意图及人工图位跳过、重试进度、文件名与 ZIP CRC，以及既有双网关测试。
- 隔离 PostgreSQL + 真实 MinIO 集成验收通过：6 张事务入队，重复确认幂等，微额 / 进行中预留导致整批拒绝且无新任务；模拟第 1 张参数失败，其余 5 张完成；同批单张重试成功后 6/6、失败 0，历史失败仍保留。
- 集成测试覆盖批量任务恢复不重新提交、终稿替换唯一性、终稿删除拒绝、已有终稿的图位删除确认、候选软隐藏、套用默认图包保留终稿及 ZIP 读取。
- 4 项浏览器回归通过：登录与权限、网关与身份提炼、原商品页、图包完整流程。图包浏览器测试只模拟收费提交结果，其余图位 CRUD、报价、终稿选择、刷新、导出均真实；不调用付费外网。
- `npm run lint`、`npm run typecheck`、`npm run build` 通过。移动端布局及真实 6 张图片解码检查通过，无 pageerror / 请求失败。

## NL27TS01 真实批次验收

- 批次：`cmv6dcagw000gakv8mfqzgb7i`，主图 / 客厅 / 卧室各 2 张，全部 scene-main、2K、1:1、PNG；“其他空间场景”意图为空，明确跳过，其余人工图位不参与。
- 确认框：6 张、36 积分、预估 **$0.180000**；用户原有身份特征和 2 张实拍保留，6 条输入均冻结当次身份版本。
- 六张全部成功：**144 秒，6 × 2048×2048，实耗 30 积分 / $0.150000**，每张实际 5 积分 / $0.025000，costEstimated=false。预估与实耗价差按接口原样记录，不推测折扣原因。
- 六个 KIE taskId 已取得后实际停止旧 worker 并启动新实例，原任务接管完成；每个 GenerationJob 只有一条实际调用记录，无重复 createTask。网页刷新进度准确。
- 三个图位均选定一张终稿并刷新确认。导出 ZIP 经系统 ZIP 读取器验证含 `NL27TS01_01_main.png`、`NL27TS01_02_scene.png`、`NL27TS01_03_scene.png` 和 `manifest.json`。
- 本地证据（不入 Git）：`.local/task4-real-result.json`、`.local/NL27TS01_finals.zip`、`.local/verification/task4-real-confirm.png`、`task4-real-board.png`、`task4-real-first-slot.png`、`task4-mobile.png`。

## 手动事项与边界

- 本机迁移与网页 / worker 重启已完成，用户无需补配置；可直接打开 SKU 的图包页，人工复核候选并按需要替换验收选择的终稿。
- 在其他部署环境拉取代码后执行迁移并重启网页 / worker。不新增常驻服务。
- ZenMux 无 Key 的真实兼容性与账单 ID 映射仍是任务 3 的已知边界；任务 4 继续复用该链路，模拟覆盖，不宣称真实 ZenMux 生图验收。
- 本任务无已知阻塞问题。人工上传图位、版本切换及其他明确排除功能未实现。
