# 任务 3：双网关底座验收（2026-10-13）

## 实现范围

生图逻辑模型 scene-main / edit 使用 ZenMux Google SDK 同步返回与 KIE 异步任务，共享 MinIO / Asset / GenerationJob 保存。看图通过 llm-vision，llm-agent 仅配置和协议适配，无 Agent 界面。未添加图包、批量生成或模板库。

路由默认按有序候选选择，空 Key 跳过；参数 / 权限 4xx 不切换，429 / 5xx / 超时 / 拦截 / 空结果可切换。KIE 已接受任务后，轮询或下载网络故障重试原任务，不重复提交付费生成；明确任务失败才换下一候选。本地保存失败不自动触发另一家生成。

数据库 GatewayCircuit 共享网页和 worker 的熔断：5 分钟内连续 3 次失败暂停 3 分钟，成功或更换 Key 后清除。管理员明确确认的连通性测试允许探测熔断中的指定网关，不切换其他家。

GenerationAttempt 记录每次生图尝试，GenerationJob 记录最终 provider / model / fallback；LlmCall 记录逐次 LLM 用量、费用及错误。旧生成记录已回填到调用账本，旧 cost 保留为估算积分；内部月度额度改为 reservedCredits，实际费用按 credits / USD 分别记录。

## 验证结果

- `npm run test:gateways`：13 项模拟测试，覆盖 SDK inlineData / inline_data、参考图字节和 data URL、无图、内容拦截、5xx、429、空 Key、4xx 不切换、熔断与恢复、KIE HTTP200业务错误、独立 endpoint 和结构化输出。
- `npm run test:generation`：随机隔离数据库和真实 MinIO，覆盖原任务 2、并发配额、事务入队、断网、转存重试、全部比例与编辑版本，新增同步多图转存、5xx 切换异步 KIE、KIE 内容拦截切同步 ZenMux、fallback / 逐次账本、保存错误不重复付费、数据库熔断及 LlmCall 失败记录。无付费生图。
- `npx playwright test`：登录 / 权限、原商品交互、网关状态与 AI 填入 / 手动保存三个流程通过；后台费用确认取消不调用，未确认请求被服务器拒绝，viewer 无权调用提炼或网关测试。截图位于被忽略的 `.local/verification`，桌面和移动端已查看。
- `npm run lint`、`npm run typecheck`、`npm run build` 通过。
- 原有真实 SKU、素材对象及成功生成记录经过数据库与 MinIO HEAD 核对，未删除或重建。测试随机商品 / 账号 / 隔离数据库已清理。真实验证留下调用账本供追溯，不修改真实商品资料。

## 真实 KIE 输出示例

使用已有商品 **NL27TS01** 的实拍，点击“AI 提炼”，请求约 **14.8 秒**返回，provider=kie，model=gemini-3-6-flash-openai，fallback=false。LlmCall `cmv65ohh00000zcv88s68udyw`：输入 2463 / 输出 597 / 合计 3060 token，接口报告 **0.25 credits**。验证文本框已填入，数据库 identityTraits 未改变。

下列为这次输出的摘录，模型判断仍需美工对照照片核对：

> 双门藤编柜门：2扇；中间储物柜配备两扇对开门，门板嵌有网格状藤编/仿藤饰面，边缘为木质框架。
>
> 整体呈高立式狭长结构，标注尺寸为 60x20x194cm。
>
> 主体颜色为浅原木色，表面呈自然清晰的木纹纹理。
>
> 拉手：柜门中央装有2个金属复古金色水滴形/吊坠形拉手，圆环底座配垂吊手柄。
>
> 可见照片未发现，其他面待核对。
>
> 顶部为独特的圆弧拱形设计，避免被AI误生成为直角或平顶。

原始六分类 JSON 和完整中文文本保存在本机被忽略的 `.local/identity-actual.json`；不是伪造的固定测试样例，也未作为商品终稿保存。

## 错误 Key 与恢复

仅在独立验证进程临时使用错误 KIE Key，不改 `.env`：生图和 LLM 在约 1.2 秒内返回中文密钥错误、未自动切换，生图未返回外部任务 ID，预留释放。恢复真实 Key 后，在 GATEWAY_PREFERENCE=zenmux 且 ZenMux Key 为空情况下，KIE 问候成功，fallback=false。没有把模拟测试冒充真实调用；没有新建付费图片。

## 文档差异与未验证事项

详见 [官方核实](gateways.md)：Gemini 生图使用 generateContent，指定的 generate-images API 是 predict；KIE 上传 OpenAPI 域名与 quickstart 不一致；KIE Gemini 结构化字段出现在示例而未列入属性表，实际提炼已成功；该 Gemini 虽有 tools 示例但警告未适配 Agent，因此 supportsTools=false。Agent 候选使用明确支持工具的 GPT Responses endpoint，仅配置，不实际调用。

所有本次选择的模型 slug 均已核实，无猜测或空白 slug。仍未实测 ZenMux（没有 Key），其完整比例、参考上限、精确费用和 Agent 往返留待开通 / 后续任务验证。未知费用标注待确认，不混加美元和积分。启用只需按 README“启用 ZenMux”填写 Key、重启网页 / worker，并在后台确认付费测试，无需改代码。
