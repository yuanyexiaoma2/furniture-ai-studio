# 任务 2 续作记录

用户于 2026-10-13 明确要求打开项目继续，并在中断后要求检查进程、保留已完成工作后续作。任务已恢复；当前代码与自动验收完成，真实家具 KIE 生图验收尚未完成，不能据此宣称任务 2 已验收或 push。

## 已完成

- 保留原有商品创建、资料与身份特征保存、2～3 张实拍上传和私有图片访问。
- 新增生成面板及 /api/products/[id]/generations：场景意图、1:1 / 3:4 / 4:3 / 16:9，默认 2K / PNG，预计 6 积分（约 $0.03）。产品身份特征与实拍 Asset ID 由服务端读取，完整提示词自动组合，上传后保存 image_input。
- 使用准确模型 nano-banana-2-1；2026-10-13 重新核对官方产品页和 API 示例，字段与价格未变。来源见 docs/kie-notes.md。
- 北京时间自然月配额：事务内锁定用户记录，检查当月 GenerationJob 积分总和；生成记录与 pg-boss fromPrisma(tx) 入队同事务提交。并发配额、入队回滚已在隔离数据库验证。
- 前端每 5 秒刷新并支持手动刷新；显示状态、缩略图、实际 model/provider、分辨率、比例、耗时、积分、taskId 与中文错误。刷新后数据库记录仍保留，候选图可通过鉴权接口下载。
- 明确未提交或提交被拒绝的任务释放积分预留；已提交失败、请求结果不确定或转存超时保留预留。cost 单位为积分，需人工核对未确定扣费，本阶段没有自动对账。
- worker 已启动验证，处理函数提取到 src/lib/generation-worker.ts，脚本与隔离测试共用实现。提交网络错误不自动重发付费请求；查询及结果转存暂时失败每 5 秒重试，10 分钟终止；Asset 与成功状态同事务提交。
- 修复后台 rewrite 的 HTTP 200 与导航 hydration 差异：服务端 forbidden() 返回 403，启用 Next.js experimental.authInterrupts，接口仍返回 JSON 403。完整登录与权限回归通过。
- 图片内容、30MB 限制、最多 3 张、viewer 写入 403、匿名访问 401、下载响应、移动端布局、月界和 429 退避均有自动验证。

## 验收与当前服务

- lint、typecheck、生产 build 已通过。
- tests/auth.spec.ts 登录、用户管理和会话撤销验收通过；旧空列表断言已改为检查项目页，适应有商品的数据库。
- tests/product.spec.ts 商品保存、上传、模拟记录留存、下载和只读权限通过；桌面 / 手机截图位于 .local/verification/product-*.png，已目视检查。
- npm run test:generation 在随机隔离 PostgreSQL 数据库、真实 MinIO 和本地模拟 KIE 服务验证上述队列事务及处理逻辑，通过后删除测试数据库和对象。模拟图不代表真实家具生图验收。
- 临时商品、账号、图片和隔离数据库已清理。启动正式 worker 前确认真实数据库没有 pending / running 任务。
- PostgreSQL / MinIO 已运行，网页 http://localhost:3000 与 KIE worker 已在后台启动。进程 ID 会变，以命令行、端口和 WorkerHeartbeat 为准；不要阻塞等待常驻进程退出，不要重复启动。
- 日志：.local/dev.stdout.log、dev.stderr.log、worker.stdout.log、worker.stderr.log。
- 普通 exec / node_repl 因 Windows 沙箱初始化失败不可用，exec_command 使用 require_escalated 已通过自动审批。Python 只有 WindowsApps 占位入口，未安装实际解释器；已有 Playwright / TypeScript 和 Node.js 正常，记忆通过 UTF-8 Node 文件写入维护。
- web-access 的 bash 检查因 WSL 没有 /bin/bash 失败，公开官方资料通过 web 工具核对。

## 尚未完成：真实验收与最终交付

1. 用户尚未提供 TEST-001 的 2～3 张同一家具不同角度实拍图片本地路径和身份特征。本次已通过异步问题请求，尚未收到；不要用测试图或生成图冒充实拍。
2. 收到资料后，通过管理员页面创建 TEST-001、确认身份并上传实拍，生成真实 2K 场景图。记录真实 taskId、耗时、MinIO key、GenerationJob 状态和参考 URL 可访问性。
3. 真实错误 KIE key 验收尚未做，隔离模拟错误密钥路径已通过。若需真实无效密钥请求，使用隔离 worker 配置，不能修改或泄露原 .env。
4. 完成真实任务验收后，更新 README / 本文件，按阶段中文 commit，最后按用户原要求 git push。当前只保存阶段代码，不提前 push 或宣称全部完成。

## 既有阶段提交

- 0b00a8d：文档核实，确认 KIE Nano Banana 2.1 模型与接口。
- 6d13534：KIE 适配器，接入上传缓存、持久队列和轮询转存。
- 894c51a：配置场景模型、积分价格与提示词模板。
- 253de9f：商品页，保存实拍、身份特征和任务二暂停进度。
- 228f2e0：接通场景生成面板与积分配额，修复任务状态和权限。
- 本次验收与文档阶段提交以 git log 为准，未 push。

## 用户明确范围

只使用 KIE，不做白底主图、抠图、超分、质检、模板库管理、Agent 对话或 ZenMux 接入。所有真实外部 API 请求仅在服务端执行，秘密不写入前端、代码、聊天或 Git。最终报告应包含模型 ID 与官方链接、字段差异、真实第一张图耗时及 taskId、手动事项和未解决问题。
