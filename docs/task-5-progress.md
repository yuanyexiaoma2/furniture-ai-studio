# 任务 5：策划 Agent

## 修改前梳理与复用方案（2026-10-14）

已阅读 AGENTS.md、README、docs/gateways.md、docs/task-4-progress.md，核对 LLMProvider、KIE Responses、llm-agent、prompts/identity.ts、image-packs、scene-generation、quota、product-save、图片上传及看板。

- Agent 全部语言模型请求通过 chatWithGateway(llm-agent)，视觉通过同一路由或 llm-vision；复用 KIE 上传和 23 小时缓存、网关熔断、逐次 LlmCall、美元预留与账单回填。现有 llm-agent KIE 缺预估价格，必须核实后补充，禁止以零成本绕过配额。
- ProductDocument 存 MinIO 原件、文本解析状态及图片分类；图片共用 Asset，实拍标为 photo，生成从所有实拍中取最多 3 张。逐文件错误隔离，不覆盖原实拍。
- ProductProfile 草稿与正式版本区分；字段含状态、来源和冲突。美工确认后在同一产品锁事务追加正式档案及 ProductIdentityVersion，更新 identityTraits。后续生成继续冻结身份全文与版本。
- 会话与 ChatMessage 持久保存；新增工具调用记录和确认卡。每次工具先校验 schema 和 SKU 归属。资料视为数据，不接受资料内的指令。
- 方案确认只更新匹配图位、追加新增图位；省略的已有图位保留，候选与终稿不删除。复用默认 7 图位、slotSchema、ImagePack 和 ImageSlot。
- 生成复用 quoteBatch / submitBatch，增加单图位数量、会话关联。编辑提取共享准备逻辑，原候选第一张、最多 3 张实拍及冻结身份，同时关联原图位和父图。复用 worker，不直接请求生图网关。
- 费用卡服务端重新估价、比对指纹、用户行锁和幂等键；会话自动确认默认关闭，首次生成永远手动，单次 <= $1 才自动。缺失或冲突风险必须人工决定。
- 左侧对话、右侧原看板；看板操作持久通知 Agent。快速与手动模式存会话，手动每次一个图位并等待挑选终稿再推进。
- 输出真实 SSE 文本增量和工具进度，Responses 工具往返保留 call_id；对话刷新恢复，不自动重发不确定的收费调用。
- 单元覆盖理解度、冲突、费用门槛、编辑参考、方案保留；mock 集成跑完整流程，浏览器走两模式；最后 lint、typecheck、build 及现有回归。

## 阶段进度

- [x] 文档与代码梳理，先记录复用方案
- [ ] 资料上传与解析
- [ ] 产品档案与确认版本
- [ ] Agent 工具和持久对话
- [ ] 费用确认卡与自动确认
- [ ] 两种模式与看板联动
- [ ] 单张调整
- [ ] 单元、集成、浏览器及真实验收
- [ ] README、分阶段中文提交与 push

## 真实验收资料

已向用户询问本机资料路径及新 SKU；等待真实 3 张实拍、说明书和参数表。mock 数据不得表述为真实产品证据。
