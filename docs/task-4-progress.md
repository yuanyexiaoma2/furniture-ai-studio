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
- [ ] 图包与图位
- [ ] 批量生成与配额确认
- [ ] 候选图看板
- [ ] 终稿导出
- [ ] 模拟测试、浏览器测试和真实 6 张验收
- [ ] README、提交及推送
