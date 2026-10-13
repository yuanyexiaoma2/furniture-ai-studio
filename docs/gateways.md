# 双网关官方文档核实（任务 3，2026-10-13）

本文件先于任务 3 接入实现编写。官方网页与公开 Markdown / OpenAPI 原文已读取；临时证据在被忽略的 .local/kie-task3-*。没有 ZenMux Key，不能将模拟测试描述为真实 ZenMux 验收。

## ZenMux：地址、鉴权和生产要求

- 大语言模型走 OpenAI 兼容 POST https://zenmux.ai/api/v1/chat/completions；OpenAI SDK 的 baseURL 为 https://zenmux.ai/api/v1，模型使用“供应商/模型”。鉴权为 Authorization: Bearer ZENMUX_API_KEY。请求 model / messages，非流式响应 choices[0].message.content 和 usage。来源：[快速开始](https://zenmux.ai/docs/zh/guide/quickstart.html)、[Chat API](https://zenmux.ai/docs/zh/api/openai/create-chat-completion.html)。
- Google SDK：GoogleGenAI({ apiKey, vertexai: true, httpOptions: { baseUrl: "https://zenmux.ai/api/vertex-ai", apiVersion: "v1" } })。Google 模型调用 models.generateContent，SDK 负责构造 /v1/publishers/{provider}/models/{model}:generateContent。来源：[快速开始](https://zenmux.ai/docs/zh/guide/quickstart.html)、[Generate Content API](https://zenmux.ai/docs/zh/api/vertexai/generate-content.html)。
- 商业化及生产环境必须使用 Pay As You Go，Builder Plan 不可用于生产；逐次实付费用信息可能延迟 3～5 分钟。本项目按已核实价格记录估算，用量单独保存，未知费用显示未知。来源：[快速开始](https://zenmux.ai/docs/zh/guide/quickstart.html)。

## ZenMux：Google 生图请求与同步结果

- 请求 contents 为 user 消息，parts 包含 { text: prompt } 和参考图 { inlineData: { mimeType, data: base64 } }；config.responseModalities = ["TEXT", "IMAGE"]，config.imageConfig 设置 aspectRatio、imageSize（1K / 2K / 4K）、outputMimeType（image/png 或 image/jpeg）。参考图在服务端从 MinIO 读取。来源：[生图指南](https://zenmux.ai/docs/zh/guide/advanced/image-generation.html)、[Generate Content API](https://zenmux.ai/docs/zh/api/vertexai/generate-content.html)。
- 同步结果遍历 candidates[].content.parts[]，读取 inlineData.data / mimeType；Python 示例采用 inline_data / mime_type。适配器兼容两种拼写，base64 转 Buffer，再通过统一结果保存函数写入 MinIO / Asset / GenerationJob。用量为 usageMetadata.promptTokenCount / candidatesTokenCount / totalTokenCount。来源：[生图指南](https://zenmux.ai/docs/zh/guide/advanced/image-generation.html)、[Generate Content API](https://zenmux.ai/docs/zh/api/vertexai/generate-content.html)。
- 检查 promptFeedback.blockReason、safetyRatings[].blocked 与候选 finishReason。SAFETY / BLOCKLIST / PROHIBITED_CONTENT / IMAGE_PROHIBITED_CONTENT（可能带 FINISH_REASON_ 前缀）按内容拦截处理；无图片按可切换失败处理。来源：[Generate Content API](https://zenmux.ai/docs/zh/api/vertexai/generate-content.html)。
- 指定的 generate-images 参考对应 :predict、instances + parameters，以及 generateImages / editImage，主要用于非 Google 图片模型。Google Gemini 本任务使用 generateContent，不能把 sampleImageSize 等 predict 字段混入其请求。来源：[Generate Images API](https://zenmux.ai/docs/zh/api/vertexai/generate-images.html)、[生图指南](https://zenmux.ai/docs/zh/guide/advanced/image-generation.html)。
- ZenMux 的通用 generateContent 文档列基本比例与部分附加比例；未核实该网关 Nano Banana 2.1 的完整 15 比例及参考数量上限。界面保留 KIE 全比例，传递同一意图；ZenMux 参数 4xx 明确报错，不无条件重复付费切换。真实兼容性待有 Key 验证。来源：[Generate Content API](https://zenmux.ai/docs/zh/api/vertexai/generate-content.html)。

## ZenMux：聊天图片、结构化结果、工具和错误

- 图片 part 使用 { type: "image_url", image_url: { url } }，支持公开 URL 或 data:image/...;base64,...。结构化输出可用 response_format 的 json_object 或 json_schema，服务端仍验证 JSON 结构。tools 与 tool_choice 使用 OpenAI 格式，工具结果来自 message.tool_calls，函数 arguments 为 JSON 字符串。来源：[多模态](https://zenmux.ai/docs/zh/guide/advanced/multimodal.html)、[Chat API](https://zenmux.ai/docs/zh/api/openai/create-chat-completion.html)、[工具调用](https://zenmux.ai/docs/zh/guide/advanced/tool-calls.html)。
- 当前 Chat API 明确 max_tokens 不支持，需使用 max_completion_tokens。来源：[Chat API](https://zenmux.ai/docs/zh/api/openai/create-chat-completion.html)。
- 错误体为 { error: { code: 字符串, type, message } }；429 / 500 / 502 / 503 / 504 可切换，400 / 402 / 403 / 404 / 413 / 422 不可重试。缺失或无效密钥示例是 403 access_denied，可记录请求 ID，不能输出请求密钥。来源：[错误码](https://zenmux.ai/docs/zh/guide/advanced/error-codes.html)。

## KIE：异步图片与上传

- Bearer 鉴权；POST https://api.kie.ai/api/v1/jobs/createTask，顶层 model = nano-banana-2-1、input，可选 callBackUrl（本地留空）。input 为 prompt、image_input（上传 URL 数组）、aspect_ratio、resolution、output_format。成功检查 code=200 与 data.taskId，不能仅依赖 HTTP 200。来源：[入门](https://docs.kie.ai/)、[Nano Banana 2.1](https://docs.kie.ai/market/google/nanobanana-2-1)。
- 输入支持 JPEG / PNG / WEBP、单张 ≤30MB、最多 10 张；分辨率 1K / 2K / 4K，输出 png / jpg。比例包括 1:1、2:3、3:2、1:4、4:1、3:4、4:3、4:5、5:4、1:8、8:1、9:16、16:9、21:9、auto。任务 2 商品实拍仍限定 2～3 张。来源：[模型 API](https://docs.kie.ai/market/google/nanobanana-2-1)、[模型页](https://kie.ai/nano-banana-2-1)。
- GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...；waiting / queuing / generating 为等待，success 为完成，fail 为失败。成功解析 resultJson.resultUrls；还可返回 creditsConsumed、costTime，失败为 failCode / failMsg。结果仅保留 14 天，完成后立即转存。来源：[任务详情](https://docs.kie.ai/market/common/get-task-detail)。
- 参考上传为 POST https://kieai.redpandaai.co/api/file-stream-upload，同一 Bearer 密钥；multipart file / uploadPath 必填，fileName 可选，检查 success / code / data.downloadUrl。免费但文件 24 小时后删除，复用任务 2 的 23 小时缓存。OpenAPI servers 指向 api.kie.ai，而 quickstart / cURL 使用 redpanda，保留已实际验证的 redpanda 地址。来源：[上传 Quickstart](https://docs.kie.ai/file-upload-api/quickstart)、[文件流上传](https://docs.kie.ai/file-upload-api/upload-file-stream)。

## KIE：看图聊天与 Agent 模型协议差异

- 看图使用 POST https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions。该独立 endpoint 的请求 schema 没有 model 字段，发送 messages、stream:false、reasoning_effort:low；图片使用 OpenAI image_url part，须为可访问 URL，复用 KIE 上传服务。来源：[Gemini 3.6 Flash](https://docs.kie.ai/market/gemini/gemini-3-6-flash-openai)。
- JSON 结构化示例包含 response_format: { type: "json_schema", json_schema: { name, strict, schema } }，但属性表漏列 response_format；本任务依照示例发送并在服务端验证。返回 choices[0].message.content、usage.prompt_tokens / completion_tokens / total_tokens 及 credits_consumed。错误可能 HTTP 200 + { code: 非200, msg }，必须检查业务 code 后再读 choices。来源：[Gemini 3.6 Flash](https://docs.kie.ai/market/gemini/gemini-3-6-flash-openai)。
- 该页既给 tools 示例，又明确警告仅聊天、未适配 Agent。采用更保守的 supportsTools=false，llm-agent 不选择此候选。来源：[Gemini 3.6 Flash](https://docs.kie.ai/market/gemini/gemini-3-6-flash-openai)。
- 可确认工具能力的 KIE gpt-6-1-sol 使用 Responses，而不是 chat/completions：POST https://api.kie.ai/codex/v1/responses，model / input 必填，stream:false，tools 为展开的 { type:"function", name, description, parameters }，tool_choice:auto；图片转 input_image，文本转 input_text，responseFormat 转 text.format。输出 output[].content[].text，usage 为 input_tokens / output_tokens / total_tokens，费用 credits_consumed。本任务只配置 Agent 逻辑线路，不实际调用。来源：[GPT 6.1 Sol](https://docs.kie.ai/market/chat/gpt-6-1-sol)。
- Responses 的 function_call / function_call_output 续传在 KIE DeepSeek 文档给出；用于 GPT 基于其 Responses 兼容声明，属于协议推断，未做实际 Agent 往返验收。未找到已明确适配 Agent 的 KIE chat/completions 模型，不将 Responses endpoint 假装成 chat/completions。来源：[DeepSeek Responses](https://docs.kie.ai/market/deepseek-v4-1-flash)、[GPT 6.1 Sol](https://docs.kie.ai/market/chat/gpt-6-1-sol)。

## 已核实模型和价格

| 用途 | 网关 | model / slug | 工具支持 | 价格口径 |
| --- | --- | --- | --- | --- |
| 场景 / 编辑 | ZenMux | google/gemini-nano-banana-2.1 | false | 每图价未核实；目录列输入 $1.5/M、输出 $7.5/M token |
| 看图 / Agent | ZenMux | google/gemini-2.5-pro | true | token 分档价格，精确实付未知 |
| 场景 / 编辑 | KIE | nano-banana-2-1 | false | 1K=4、2K=6、4K=9 积分 |
| 看图 | KIE | gemini-3-6-flash-openai | false | 输入45 / 输出225 积分每百万 token，限时至 2026-12-31 06:00 UTC |
| Agent（仅配置） | KIE | gpt-6-1-sol | true | 未核实精确价格，实际响应 credits_consumed 优先 |

ZenMux 图片 slug 来自指定[模型列表](https://zenmux.ai/models?sort=newest&output_modalities=image)及[模型详情](https://zenmux.ai/google/gemini-nano-banana-2.1)，并非猜测。ZenMux LLM slug 和能力来自[目录](https://zenmux.ai/google)、[模型详情](https://zenmux.ai/google/gemini-2.5-pro)、[多模态](https://zenmux.ai/docs/zh/guide/advanced/multimodal.html)与[工具调用](https://zenmux.ai/docs/zh/guide/advanced/tool-calls.html)。KIE 价格来自[生图模型页](https://kie.ai/nano-banana-2-1)、[聊天模型页](https://kie.ai/gemini-3-6-flash)。目标模型 slug 均已核实；未知的是 ZenMux 每图固定价格、精确分档实付及实际兼容性，不填假价格。

## 本项目路由与记录口径

- 自动按候选顺序，跳过 Key 为空的网关；明确偏好只调整顺序。未配置被跳过不算失败或备用调用。
- 超时、5xx、429、内容拦截、无图片或无有效结果可切换；参数 / 鉴权等 4xx（非429）直接报错。KIE HTTP200业务错误仍须识别，再按有效错误码分类，避免参数错误重复扣费。
- 熔断使用数据库，web 与 worker 共用，网关在5分钟内连续3次失败后暂停3分钟；成功清零，Key更换时重置旧熔断，密钥仅保存不可逆指纹。逐次生成尝试单独记录，轮询不重复算一笔付费生图；LLM每次实际请求写LlmCall。
- 内部月度额度继续用积分预留，与实际网关费用分开。费用分别统计 credits / USD，不把两种币种直接相加；未知显示未知，估算注明估算。备用路线在结果和页面标记。

## 实际调用核对与实现取舍

- 2026-10-13 已用现有 SKU NL27TS01 的真实照片验证 KIE Gemini endpoint、reasoning_effort:low、image_url 和 response_format:json_schema，约14.8秒收到有效六分类 JSON，usage=3060 token、credits_consumed=0.25。未观察到该次调用与文档字段冲突；属性表未列 response_format 的差异已有实际成功证据。详见 [验收记录](task-3-progress.md)。
- 实际错误 Key 生图和聊天均明确失败；恢复后在偏好 ZenMux 且其 Key 为空时使用 KIE 成功。ZenMux 未购买 Key，不能声称真实连通性已验证。
- KIE 已创建的任务遇到查询 / 下载超时、5xx 或429，重试原任务直至10分钟截止，避免另一家再收费；明确终态失败才切换。此为已接受异步任务的费用保护，提交阶段仍按路由规则切换。同步结果本地存储失败不重发生成，保留费用预留供核对。
- Google SDK 显式 retryOptions.attempts=1，OpenAI SDK maxRetries=0；LLM 的 KIE 请求限流即交由路由，不做长时间退避。KIE 生图提交 / 上传保留任务2的限流退避。
- GenerationAttempt / LlmCall 是逐次调用账本；GenerationJob 表示最终生图结果。KIE 实际 creditsConsumed / credits_consumed 优先；缺失时生图按已核实分辨率价格估算。ZenMux 固定美元价未知，不以目录 token 价推造每图固定费用。
