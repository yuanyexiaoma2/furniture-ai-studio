# 任务14：模型开放与网关路由

日期：2026-10-30。无数据库迁移、无CSS改动、无确认弹窗；没有真实生图。真实调用仅限用户要求的三款智能体探测。

## 模型管理

- 管理员在 `/admin` 的模型管理里直接切换“对美工可见”。未探测、未达95%或上下文未满20轮均不阻止；原管理员权限、密钥配置和用户主动关闭仍生效。
- 低分或待验证模型在原行内及打开后的轻提示显示“工具调用正确率 X/20，可能不稳定”，不弹确认框。
- 两条Flash来自旧KIE `agent-flash` 和后来新增的ZenMux默认 `agent-zenmux-flash`。目录只显示后者并保留默认标记；旧ID映射到同一条，旧行和探测历史留存，不删除调用记录。旧KIE参数16/20、上下文20/20留在probe.history。
- 对话、规划、识别、提炼、联网补充等所有生产LLM均由原router和provider工厂限定为ZenMux，不会退回KIE。识别默认也用正常可用的Flash，Gemini 2.5 Pro已按用户最新指令从配置和数据库模型目录移除，历史调用/探测记录保留，不再探测。

## 生图同款对应

| 页面模型 | KIE模型ID | ZenMux同款模型ID |
|---|---|---|
| Nano Banana 2.1 | nano-banana-2-1 | google/gemini-nano-banana-2.1 |
| Nano Banana 2 | nano-banana-2 | google/gemini-3.1-flash-image |
| Nano Banana Pro | nano-banana-pro | google/gemini-3-pro-image |
| GPT Image 2.5 | gpt-image-2-5-sunburst-image-to-image | openai/gpt-image-2.5-sunburst |
| Qwen3 | qwen3/image-to-image | qwen/qwen-image-3.0 |

已核对ZenMux公开模型页：[Banana 2.1](https://zenmux.ai/google/gemini-nano-banana-2.1)、[Banana 2](https://zenmux.ai/google/gemini-3.1-flash-image)、[Banana Pro](https://zenmux.ai/google/gemini-3-pro-image)、[GPT Image 2.5](https://zenmux.ai/openai/gpt-image-2.5-sunburst)、[Qwen Image 3.0标准版](https://zenmux.ai/qwen/qwen-image-3.0)。Qwen没有替换成Pro。目录有记录不等于当前账户一定可调用，本次未花费图片调用费用验证上游可用性。

Google图片沿用generateContent；GPT/Qwen采用ZenMux官方[图片协议](https://zenmux.ai/docs/zh/guide/advanced/image-generation.html)的Vertex editImage及RawReferenceImage多图输入。产品/参考图顺序、原提示词、宽高比和分辨率不变，不悄悄降级成文字参考。

原路由/熔断框架中固定KIE优先，仅在超时、网络、5xx、网关错误、普通任务失败时切同款ZenMux一次。参数、审核、额度/余额、鉴权错误不切换；未知型号没有映射时只报原失败。KIE已成功后的下载失败只重取原结果，不再次付费生成。异步任务超过原10分钟期限时沿用原提交队列补交同款一次，没有新队列或新的并发/限速规则。

图片信息显示实际provider/model、是否切换和原因；新任务失败预留释放，应用美元汇总/额度/账单回填只统计成功尝试。失败尝试及原始KIE积分保留供审计，不冒充供应商退款。特别是提交超时，上游可能已接受请求；切换原因保留扣费状态未确定的说明，无法保证网关余额只发生一次扣费。

GPT Image 2.5上游按输入/输出token收费，不能把老GPT的固定token数当作当前价格。当前回退预留暂沿用同款KIE预算（1K/2K/4K为$0.03/$0.05/$0.08）作参考，明确不是ZenMux固定真实报价；成功后有账单ID则按原账单回填流程更新，否则显示预估/待核对。[OpenAI价格说明](https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst)。

## 真实智能体探测

每款20次工具调用加20轮上下文，ZenMux Chat Completions标准tools，不强制tool_choice，不另加联网测试；原始记录是本目录三个probe JSON。

| 模型 | 工具格式 | 参数正确 | 上下文稳定 | 结果 |
|---|---:|---:|---:|---|
| google/gemini-3.8-flash | 20/20 | 20/20 | 20/20 | 正常 |
| anthropic/claude-haiku-5.5 | 20/20 | 20/20 | 20/20 | 正常 |
| google/gemini-2.5-pro | 0/20 | 0/20 | 0/20 | 40次HTTP404，未获得模型响应 |

Haiku旧记录 `docs/task-10/probe-claude-haiku-5-5.json` 的40次失败均为KIE429限流。现在已核对准确模型名及OpenAI兼容接口，ZenMux标准工具协议正常，无需更换模型或修改工具schema。

Gemini 2.5 Pro虽在[ZenMux公开目录](https://zenmux.ai/api/v1/models)中，上游实际返回“Publisher model ... was not found or your project does not have access ... region”。这是模型/项目/区域可用性，不是工具参数格式错误；需要ZenMux修复该模型上游路由或权限。用户随后明确要求删除该模型：已从可选配置和数据库模型目录移除，保留历史证据，不再测试，不替换成其它Pro。

本机Node直连ZenMux超时，使用现有系统代理127.0.0.1:7897及Node原生环境代理后探测成功；没有修改系统代理、hosts或.env密钥。Web/worker启动环境同样使用现有代理，localhost走NO_PROXY。

## 验证与手动检查

- `npm run lint`、`npm run typecheck`、`npm run test:units`、`npm run build`。
- 新增16项任务14单元，全部单元共160项，覆盖无门槛开放、LLM只走ZenMux、五款同款映射、可切换/不可切换错误、无同款、最多两次、成功记账和实际多图请求。
- `node --conditions=react-server --import tsx scripts/verify-task14-routing.ts`：12个本地隔离场景，包括异步失败、轮询断网、10分钟超时复用队列、下载失败不重交、失败尝试有真实费用但用户只记成功费用；$0.07额度能完成$0.06成功回退，失败预留不累加。
- `npm run test:agent`：原完整Agent链路改用本地ZenMux Chat Completions模拟，保留全部断言，没有付费外网请求。
- 探测runner有本地断点记录，重复执行会跳过已完成的请求，避免无意义重复付费。

手动：进入模型管理，打开任一未达标/待验证模型，应直接切换并仅提示风险；确认只有一行默认Flash。回工作台选择开放模型进行对话。生图后查看图片信息里的网关/切换原因/费用；参数或审核失败应原地报错，不出现确认框。模拟故障和计费释放已经由隔离测试验证，无需为了验收主动制造真实付费失败。

## 最终收口

用户要求立即结束并上传，覆盖原“不推送”指令。lint、typecheck和160项单元已通过，12项隔离路由场景与完整Agent模拟链路已通过。额外旧生成回归在新增KIE异步成功夹具处因未注入模拟图片下载而未全通过，已补本地下载fixture但未再跑；最后移除Gemini 2.5 Pro后不再追加检查，build未运行，不宣称全套验证完成。没有继续调用模型。
