# 任务 2 续作记录

用户于 2026-10-12 要求“保存进度，明天继续”。任务已暂停，不能因本文件存在自行继续执行。

## 已完成

- 已阅读根目录 AGENTS.md、README.md，并在 AGENTS.md 外部服务标明当前只启用 KIE，保留 ZenMux 规划。
- 按要求核实官方资料；准确 model 为 `nano-banana-2-1`，参考字段 `image_input`。来源及价格、比例、输出格式、查询与上传方式均记录在 `docs/kie-notes.md`。
- 官方上传文件只保留 24 小时，代码按内容哈希与账户指纹缓存 23 小时，过期刷新；生成结果保留 14 天，因此成功后立即转存 MinIO。
- ImageProvider、KieProvider、S3 读写与图片内容校验、KIE 中文错误、429 指数退避已实现。
- pg-boss 提交队列全局串行，数据库预留 550ms 请求间隔；轮询 worker 已编写，5 秒轮询、10 分钟超时、结果转存与 Asset / GenerationJob 成功状态同事务提交。尚未实际启动 worker 或通过运行验收。
- models.config.ts 已配置 scene-main 与 edit、2K/png/1:1 默认值和 1K=4、2K=6、4K=9 价格；业务代码使用逻辑模型。
- prompts/scene.ts 使用用户提供的完整原文模板，不预设机位或光位。
- 商品创建、详情、资料与身份特征保存、2～3 张实拍上传和登录保护的图片访问 API 已实现，首页已接入商品列表。前端沿用原有绿色与米白风格。
- 增量迁移 `20261012090000_kie_scene` 已通过 `npx prisma migrate deploy` 应用到本机数据库，Prisma 客户端已重新生成。JobStatus 从 succeeded 重命名为 success；新增 productId、时间字段、上传缓存、限流和 worker 心跳表。
- .env 已存在 KIE_API_KEY（只检查是否填写，没有记录或输出密钥）。默认官方网关 URL 已写入 .env.example；本地回调必须留空。

## 阶段提交

- `0b00a8d` 文档核实：确认 KIE Nano Banana 2.1 模型与接口。
- `6d13534` KIE 适配器：接入上传缓存、持久队列和轮询转存。
- `894c51a` 模型路由：配置场景模型、积分价格与提示词模板。
- 商品页与本次暂停记录将在暂停收尾时提交；以 `git log` 为准。
- 尚未 push，用户要求任务完成后 push，不应把当前阶段误称为完成。

## 明天接续顺序

1. 先阅读本文件、AGENTS.md、README.md 和 docs/kie-notes.md；检查 Git 与服务状态。
2. 实现生成 API 与 UI：场景意图、1:1/3:4/4:3/16:9、预计消耗 6 积分（约 $0.03）；服务端读取已保存的 identityTraits 和参考图。
3. 原子校验用户月度积分配额并预留；GenerationJob 与 pg-boss 入队需在同一数据库事务内提交（pg-boss `fromPrisma(tx)` 已从安装包核实）。建议锁定用户记录避免并发超额；明确失败与未确定扣费的配额口径。
4. 生成前检查 KIE 密钥和 worker 心跳，限制 viewer 写入。保存完整 prompt、上传后 image_input、logicalModel/provider/model/cost/createdById/externalTaskId；当前初始 input 应保存 referenceAssetIds，worker 会上传并替换 image_input。
5. 将 ProductEditor 包入管理商品和生成状态的客户端组件（当前详情页仅 ProductEditor，没有生成面板），显示进度和持久生成记录：缩略图、模型、provider、分辨率、耗时、积分、状态和中文错误。刷新后从数据库加载。
6. 启动 `npm run worker` 并验证队列与数据库行为。注意现在 worker 使用 `node --conditions=react-server --import tsx`，尚未运行验证。审查 550ms 预留限流、轮询并发、上传锁与超时、网络失败不重发付费请求、结果下载失败等路径。
7. 用户尚未提供 TEST-001 的 2～3 张同一家具不同角度实拍文件路径或身份特征。已询问；不要用假图或生成图冒充实拍验收。收到实拍后通过管理员界面创建 TEST-001 并完成真实 2K 场景图，记录 taskId、耗时、结果 MinIO key 与数据库状态。
8. 验证错误 KIE key 时明确失败且不 pending，恢复后正常生成；不要泄露或提交真实密钥。可隔离测试 worker 配置，避免修改真实 .env。
9. 验证刷新留存、参考 URL 可访问、MinIO 文件、并发配额与文件格式/大小限制、viewer/未登录权限。更新既有 auth.spec.ts 的空列表断言，避免 TEST-001 存在后旧测试失效。
10. 运行 lint、typecheck、build 与必要浏览器测试；README 更新运行方法、完成内容及 ZenMux 未启用；继续按“生成面板”“验收修复”等阶段中文 commit，最后 git push。

## 验证状态与环境

- 适配器阶段 typecheck 通过。
- 商品页阶段 lint 和 typecheck 均已通过；首次发现的 photos 数组类型问题已修正。
- 尚未跑最终 build、真实生成或浏览器验收。没有第一张图，没有真实生成 taskId。
- PostgreSQL / MinIO 已运行，前一回合启动的 Next dev 在 localhost:3000，日志在 .local/dev.stdout.log 与 dev.stderr.log。worker 尚未启动。
- 普通 exec 和 node_repl 的 Windows 沙箱初始化失败；本回合 exec_command 使用 require_escalated 已通过自动审批。apply_patch 可正常使用。
- web-access 的 bash 检查脚本因当前 bash 指向没有 /bin/bash 的 WSL 失败；官方公开页面已通过 web 工具与 curl 获取。API 模型和上传页面的官方 HTML 在 .local/kie-nanobanana-2-1.html、.local/kie-upload.html，可作暂存证据但不提交。

## 用户明确范围

只使用 KIE，不做白底主图、抠图、超分、质检、模板库管理、Agent 对话、ZenMux 接入。所有真实 API 请求仅服务端执行，秘密不写入代码/前端/Git。完成后报告模型 ID 与官方链接、字段差异、真实第一张图耗时和 taskId、手动事项及未解决问题。
