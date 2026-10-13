# 项目记忆

2026-10-13 任务2已由用户亲自验收并推送。任务3双网关底座已完成，用户明确要求完成后提交推送。保留既有真实SKU NL27TS01、实拍和生成记录；不要要求重复上传或创建TEST-001。

任务3：KIE异步与ZenMux同步生图共享保存函数，统一LLM接口；models.config.ts逻辑候选+GATEWAY_PREFERENCE；空Key跳过，4xx非429不换，其他有效失败备用。DB GatewayCircuit共享熔断（5分钟3次失败，暂停3分钟，完成成功或Key变更恢复）；异步pending不清零失败，查询/下载故障重试原任务防重复收费，终态失败换备用。GenerationAttempt、LlmCall记录每次尝试；GenerationJob记录最终provider/model/fallback，reservedCredits为内部月度额度，cost/currency为实付或估算，美元/积分不混加。

/admin/gateways仅管理员，配置/熔断/24小时指标/分币种费用/确认付费测试/只读路由；显式测试固定网关并允许熔断探测。商品identityTraits旁AI提炼使用已保存资料和2～3实拍，只填文本框需人工保存。提示词src/prompts/identity.ts。

真实NL27TS01 KIE提炼14.8秒、3060token、0.25积分已记录；数据库身份未自动覆盖。真实错误Key生图/LLM失败及恢复、偏好ZenMux空Key走KIE都已验证，无新付费图。13模拟单元、扩展隔离数据库+真实MinIO转存和3浏览器回归、lint/typecheck/build通过。新迁移20261013034846_dual_gateways已应用。目标slug均核实，ZenMux尚无Key只模拟：google/gemini-nano-banana-2.1、google/gemini-2.5-pro；KIE nano-banana-2-1、gemini-3-6-flash-openai（supportsTools=false）、gpt-6-1-sol（Responses，仅配置Agent）。未知ZenMux真实全比例/参考上限/精确费用，不猜价格。

启用ZenMux只填ZENMUX_API_KEY，地址默认OpenAI /api/v1与Google /api/vertex-ai，使用Pay As You Go，重启web+worker后后台确认付费测试。详见[任务3记录](../docs/task-3-progress.md)和[协议核实](../docs/gateways.md)，推送状态以Git远程为准。

网页和worker是常驻后台服务，日志.local/，不要重复启动或等待退出。改.env须重启两者；重启worker前检查无pending/running任务，只停止已核实本项目PID。Windows普通sandbox初始化失败，用已获自动审批的escalated exec；Python为WindowsApps占位，UTF-8记忆维护用Node/tsx。密钥不写日志/Git/前端，测试隔离数据清理。
