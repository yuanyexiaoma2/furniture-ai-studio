# 任务 2 / 3 审查与修补（2026-10-13，以本次九项要求为准）

| 项目 | 结论 | 检查理由 / 修补 |
| --- | --- | --- |
| 1. 残留与路由 | 已修复；提示词原本正确 | src业务未发现旧KIE model或旧参考图字段。删除适配器内部默认字符串，统一从models.config读取。生图只经scene-main / edit路由；场景唯一prompts/scene.ts，edit为原图编辑专用提示词，不是旧场景模板。已应用的历史迁移与断言保留模型字符串，不是业务入口。ZenMux正确slug的2.1后缀不能误判为旧KIE型号。 |
| 2. KIE错误 | 已修复；共用code检查原本正确 | 四类请求都经kieRequest；补null/空码检查、中文原因、查询业务失败终止。标准OpenAI成功响应允许不提供code但必须有有效choices；只要提供code则必须为200。余额/参数/内容/参考图都有模拟测试。 |
| 3. URL有效期 | 已修复；23小时余量原本正确 | 依据实际redpanda域名当前文档24小时删除；新增最近uploadedAt，每次重传更新，超23h重传。明确参考图访问错误仅原KIE重传一次，次数持久化、另记尝试，第二次失败停止，不切换。普通404/422/500不推测为过期。 |
| 4. 美元成本 | 已修复 | GenerationJob/LlmCall/GenerationAttempt统一costUsd，保留原credits，优先实耗，缺失按配置预估。ZenMux保存候选generation ID、5分钟后只读账单查询，有界退避和重启持久恢复，校验ID/model后回填actual。 |
| 5. 美元配额 | 已修复并迁移验证 | monthlyQuota为Decimal美元；旧100积分实际迁移成$0.50。用户行锁保护“生图+LLM本月消耗/预留+本次估计”校验，重试/备用实际调用前再校验。管理界面明确美元及六位小数。 |
| 6. 分辨率 | sharp转存原本正确；界面已修复 | 两家共用保存函数，用sharp读取真实width/height。记录逐张显示像素，长边<2000px显示黄色提示，浏览器断言颜色与文本。 |
| 7. 恢复 | 已修复；独立worker架构原本正确 | 唯一worker租约避免重复服务；启动接管旧KIE taskId，取消旧队列占用，恢复遗漏pending。同步ZenMux或未知taskId提交被中断时failed，不自动重发收费；旧异步任务接管后有新10分钟查询窗口。开发/生产独立启动方法已写README。 |
| 8. 上传域名 | 当前选择原本正确；已补文档 | 当前正文/cURL是redpanda，Markdown OpenAPI servers是api.kie.ai；选用与正文一致且已成功的域名，24h也基于实际域名核实。没有官方保证的备用上传地址，故障时依据官方确认替代地址后改KIE_UPLOAD_BASE_URL并重启，不猜测自动切域名。MinIO原图保留。 |
| 9. 身份版本 | 全文快照原本正确；版本记录已修复 | 每次手动保存以事务追加ProductIdentityVersion全文、保存人、保存时间；生成input冻结全文、versionId、savedById、savedAt，后续改商品不改历史任务。历史元数据缺失明确标unknown，不伪造保存人和准确时间。 |

## 验收证据

- 17项单元模拟全部通过，四类HTTP200业务错误、金额换算/实际0、ZenMux账单延迟/ID校验均覆盖。
- 扩展隔离PostgreSQL+真实MinIO测试通过：美元并发额度、极小配额拒绝、缓存最新上传时间、同KIE参考重传一次且不切换、四类业务错误变failed、身份版本冻结、同步/异步保存和重启恢复、账单回填。模拟过程中不调用付费外网。
- 登录/权限、网关与AI提炼、商品工作台三项浏览器回归通过；额外断言64×64实际像素、黄色警告、美元预估、冻结身份快照。仅生成读写临时fixture，结束清理。
- `npm run lint` / `npm run typecheck` / `npm run build` 通过。
- 迁移前后验证：1个真实SKU、4个素材对象、3条生成记录及身份全文保留；真实管理员monthlyQuota从100变为0.50，无数据重置。

## 一次真实生成与网页重启

本次只新增一张真实验收图，job=`cmv6aypd7000b5wv8p6c22f6x`、KIE task=`d5216d6fbe16f7c1dc7befee2a72f4fb`。生成过程中停止并重启dev网页，独立worker继续完成原任务：**2048×2048、creditsConsumed=5、costUsd=$0.025、costEstimated=false**。提交时配置预估6积分/$0.030；已优先以接口实际5积分回填，没有推测价差原因。页面显示实际像素和“实际$0.025000”，候选图已转存MinIO。

该任务input完整冻结原有身份文本“藤编门上的五金把手”，版本指向迁移前历史记录。没有因本次审查替用户覆盖真实商品身份特征。截图和原始验证JSON位于被忽略的.local/verification与.local/review-real-result.json。

## 无法补证的边界

- 迁移前未记录每次保存人和准确保存时间，无法可靠还原旧历史；只保留原内容，historical=true、保存人为空。未来每次保存准确记录。
- 没有ZenMux Key，无法实测响应ID到账单ID的映射、真实账单回填与全比例兼容；接口实现和模拟验证已完成。ID/model不匹配时不伪造实际费用，继续显示预估。
- 官方未确认可用的备用上传域名，不能宣称api.kie.ai上传一定可用。安全的故障处理为官方确认地址后改环境变量，原图与任务记录保留。

文档来源与字段核实见 [kie-notes.md](kie-notes.md)、[gateways.md](gateways.md)。
