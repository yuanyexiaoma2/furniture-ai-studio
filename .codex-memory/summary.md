## 2026-10-15 · 最新：生图模型胶囊与面板小修完成，等待审阅

项目仍在 `C:/Users/Administrator/Projects/furniture-ai-studio`，沿用任务 9（5bd707c）。当前选择器已移除视频分段；Auto 单选显示模型名，多选显示“自动 · N 个模型”和名单 Tooltip，手动指定主色描边。预览价格全部两位小数，源数据精度不变。交付 `docs/design-preview/model-picker-refinement/index.html`：14 张亮暗截图及验收记录，字体实际渲染、Unicode、对齐、价格、持久化和窄屏均通过；lint/typecheck/build 通过。此前任务 9 全部保留，继续纯静态，不接真实模型，等待用户审阅。最新本地预览 localhost:3001，PID 16148 停止前先核实。

## 2026-10-15 · 当前进度：任务 9 已交付，等待审阅

项目：`C:/Users/Administrator/Projects/furniture-ai-studio`。在任务 7 第四轮（729245e）与任务 8A 基础上完成任务 9 静态原型：批量三颜色 Frame、多语言/术语表、导出检查、品牌风格与后台维护、联网/分辨率/三段主题。交付：`docs/task-9/index.html`，30 张亮暗截图，18.134 秒录屏；29 测试、lint/typecheck/build、浏览器验收通过。代码及说明均已保存到本地 Git。当前仍是前端 mock，没有接真实工具，用户明确要求完成后停下等待审阅。下一次先读取 `docs/task-9/README.md` 与最近 Git 提交，不要重建或丢弃先前 UI。生产预览 `http://localhost:3001/design-preview/workspace`，PID 35260 需先核实再停止；Windows exec 用审批 escalated，原生 Python Playwright 环境位于 `.local/round4-test-env`。

# 最新：任务 7 第一阶段第 4 轮完成，等待审阅（2026-10-15）

沿用任务8A与第三轮原型。首页移除品类/拍摄档位，改为56px可删除图片/文件+三行文字/单行模型工具行，两位费用仅有内容显示，黑白40px发送空态40%透明。新任务默认quick，startTask(description)本地识别品类并等待categoryConfirmed；确认到默认strict类别后shootingChoicePending提供严格/本次快速。产品卡头部CategoryPicker复用shadcn Command（cmdk），可搜索修改；档位只留产品卡，弹层间距已修复。category-recognition.ts模拟文字/文件名，没有线索图片用边桌样例，无图片未知则询问，没接真实模型。22项测试、lint/typecheck/build及16张双主题浏览器检查通过；docs/design-preview/round4/README.md与verification.json。预览localhost:3001/design-preview。旧任务的optional确认字段保持兼容；不要重置旧任务。第四轮Python测试用.local/round4-test-env/Scripts/python.exe scripts/verify-design-preview-round4.py（系统Chrome，现有.local/task8a-storage.json登录态）。停第一阶段等待审阅，不进8B，不push远程。

# 最新：任务 8A 完成，等待审阅（2026-10-15）

工作区 C:/Users/Administrator/Projects/furniture-ai-studio。沿用任务 7 第三轮前端，新增模板库五类条目、快速/严格拍摄、PromptComposer、配方去重与三类沉淀、个人/待审/公共审核。数据类型/20 个工具契约在 src/design-preview/library，mock/library.ts 各类至少10（道具20、组10）。SQL 仅 docs/task-8a/migration-draft.sql 草案，没改 Prisma/没执行迁移/没接模型。19项单测和lint/typecheck/build通过；40张双主题+6张窄屏PNG、约20秒WebM及零接口浏览器验收在 docs/task-8a/。录屏真实拖入2张、规划/生成、终稿/保存/搜索、严格档缺失与跳过。预览 localhost:3001/design-preview，库 /design-preview/library；需现有登录。已生成任务可再规划；Bento产品卡沿用当前任务，不覆盖进度。连续编辑每轮同时保留全部原始实拍、冻结父配方和实际所选模型。停止8A，不进入8B；不推送远程（先前自动审批要求显式远程授权）。本机命令仍需 require_escalated，正常sandbox/node_repl初始化失败。

# 最新：任务7第三轮完成，等待审阅（2026-10-15）

已按负责人第三轮要求完成首页/工作台共享 ModelPicker、统一 src/design-preview/mock/models.ts、zustand持久化和会话独立、管理员可见/启用/默认联动，及五页亮暗视觉升级。30张不同家具样图，20张PNG与约24秒WebM在docs/design-preview/round3/。lint/typecheck/build、模型状态/报价/4种宽度/实际字号检查及蒙版PNG、扩图、多选回归通过，页面错误/诊断/业务接口/外部资源请求均0。预览http://localhost:3001/design-preview，根路径是旧业务首页。停在第一阶段等待审阅，不接后端，不修四个业务bug，不推送远程（此前自动审批明确要求用户授权远程main更新）。

# 最新：任务7第一阶段修订版收尾完成（2026-10-15）

家具AI工作台 `/design-preview` 五页双主题原型等待负责人审阅。修复选择图位同步对话作用对象并清除旧图片引用；空图位假生成归属及原候选保留回归通过。lint/typecheck/build、完整浏览器验证通过，页面错误/业务请求/控制台诊断0。十张截图与12.97秒41帧GIF已核对。正式预览 localhost:3001/design-preview，现有账号登录，不启动worker，不调用收费模型。第二阶段后端接入与四个业务bug等待用户确认。详见docs/task-7-progress.md、docs/design-preview/README.md。

# 最新：任务4已完成

图包页 /products/[id]/pack 已实现7默认图位、编辑排序归档、批次确认与美元原子预留、逐张重试、终稿唯一与ZIP。继续复用scene-main和双网关，不创建第二套提示词或限流。重试新建关联原失败任务；原费用保留，进度计算有效替代任务。真实NL27TS01六张2048×2048，144秒，实际30积分/$0.15（估价$0.18），worker重启后原taskId完成，三终稿与导出已验证；不要重复付费验收。新迁移20261013120000_image_packs已应用。详见docs/task-4-progress.md。

# 项目记忆

2026-10-13 最新九项审查已完成。任务2和任务3此前已验收并推送；本次用户明确要求修补后中文commit并push。保留真实SKU NL27TS01，不要求重新上传、创建TEST-001或重复付费生图。

当前费用/配额统一美元：monthlyQuota Decimal默认$0.50，迁移旧100积分为$0.50；GenerationJob/LlmCall/GenerationAttempt costUsd，原credits保留，reservedUsd与生图+LLM共同额度检查。旧cost/currency/reservedCredits仅原始历史，不能再作为当前业务单位。实际费用优先，缺失估算；KIE名义$0.005/积分，ZenMuxGoogle上游预估后5min management/generation查询、严格ID/model校验，有界异步回填。没有ZenMuxKey，真实ID映射/全比例/账单仍待实测。

KIE四类请求检查业务code，错误中文化；标准OpenAI成功无code可接受但有code必须200。redpanda当前文档24h保留，缓存23h并更新uploadedAt；明确参考图访问失败仅原KIE重传一次、独立记录尝试，不把普通HTTP状态猜为过期。适配器默认模型均读models.config，业务仅逻辑路由，场景提示词只有prompts/scene.ts。

独立常驻worker有唯一租约；启动取消旧队列占用，接管旧KIE taskId而不重复提交，恢复pending并给新的10分钟查询窗口；中断的同步ZenMux或未知taskId收费提交failed，先核对账单再重试。网页重启不影响worker。ProductIdentityVersion每次手动保存记录人/时间/全文，生成input冻结版本全文；历史缺失不能伪造。sharp像素转存一直正确，UI显示真实像素和低于2000px黄色警告。

17单元、扩展隔离Postgres/真实MinIO和3浏览器回归、lint/typecheck/build通过。本次仅新增真实job cmv6aypd7000b5wv8p6c22f6x，在dev重启后成功2048x2048，实耗5积分/$0.025（配置预估6积分/$0.030），完整冻结原身份“藤编门上的五金把手”，未改商品资料。迁移前1产品/4素材/3生成记录和配额转换均已核对保留。详见[审查记录](../docs/task-2-3-review.md)、[KIE核实](../docs/kie-notes.md)和[网关文档](../docs/gateways.md)。

启用ZenMux填Pay As You Go Key、重启web+worker后/admin/gateways确认付费测试，无需改代码。官方未确认备用上传域名，失效时确认地址再改KIE_UPLOAD_BASE_URL并重启。所有Key只服务端，不输出或提交；.local日志/证据忽略。停止worker前检查无pending/running，只停止已核实本项目PID，不等待常驻服务退出。Windows普通sandbox初始化失败，用自动审批escalated exec；Python为占位，文件修改用UTF8脚本文件，不能将中文JS直接经PowerShell默认编码stdin传Node（会变问号）。
