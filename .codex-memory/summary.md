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
