# 任务10 · 模型能力实测

测试时间：2026-10-15T08:52:26.818Z。真实 KIE 请求，无模拟返回。

## 方法

5个工具（品类枚举、候选数量、实拍短码、颜色+布尔锁定、图位数组），各4次独立请求，共20次，不强制 tool_choice。格式正确要求只有一个函数调用且参数能解析为JSON；参数正确要求函数名、必填字段、值和额外字段均与测试目标一致。20轮中文对话每轮追加约300字材料，检查SKU、品类、锁定特征及轮次；这是20轮历史稳定性测试，不代表模型标称最大上下文窗口。失败与限流计入端到端失败，不补跑覆盖原始结果。

费用采用响应 credits_consumed × $0.005；缺少实际账单时保留估算并标注。均记录在 LlmCall；本次探测不关联生产SKU。

|模型|格式正确|参数正确|平均耗时/次|单次平均USD|20轮稳定|开放建议|
|---|---:|---:|---:|---:|---:|---|
|gpt-6-1-sol|20/20|20/20|31.31秒|$0.001433（实际）|20/20|推荐开放|
|gemini-3-8-flash-openai|19/20|16/20|4.51秒|$0.000130（含估）|20/20|不开放|
|claude-haiku-5-5|0/20|0/20|1.33秒|$0.000186（含估）|0/20|不开放|
|ZenMux · Gemini 2.5 Pro|未测|未测|—|—|未测|未配置ZENMUX_API_KEY，不开放|

推荐开放：**GPT-6.1 Sol**。Gemini 3.8 Flash 低于95%；Claude Haiku 5.5持续限流，不能据此断言模型本身不支持工具，当前可用性未达标。ZenMux 没有凭据，不以KIE结果代替。

## 原生联网观察

问题为测试当日欧洲央行 EUR/USD 参考汇率。未额外提供浏览器或网关原生搜索工具。返回不能联网或请求失败，未得到可核验的当日数值，因此均不依赖原生联网。正式会话使用自建 Tavily web_search；网关原生搜索与函数调用兼容性不影响业务。

### gpt-6-1-sol

原生联网（未添加搜索工具）：我目前无法联网，因此无法核实 **2026 年 10 月 15 日**欧洲央行是否已公布当日欧元兑美元参考汇率，也无法确认具体汇率及公布日期。我不会用历史数据或估算值代替。

你可以通过以下欧洲央行官方来源查询：

- [欧元参考汇率页面](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)
- [最新参考汇率 XML 数据](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml)

在 XML 中，`Cube time="2026-10-15"` 表示数据日期；该日期下的 `currency="USD"` 对应的 `rate` 表示 **1 欧元可兑换多少美元**。若文件显示其他日期，则不能据此认定为今日汇率。

费用合计：$0.049900（实际）。失败请求：0。原始结果：[probe-gpt-6-1-sol.json](./probe-gpt-6-1-sol.json)。

### gemini-3-8-flash-openai

原生联网（未添加搜索工具）：我无法提供今日（2026年10月15日）欧洲央行公布的欧元兑美元参考汇率。

**原因如下：**
1. 我当前无法联网获取实时或未来的外部信息。
2. 我的知识库更新截至2026年1月，无法获取2026年10月的数据。

费用合计：$0.014499（包含失败请求估算，不能视为实际扣费）。失败请求：1。原始结果：[probe-gemini-3-8-flash-openai.json](./probe-gemini-3-8-flash-openai.json)。

### claude-haiku-5-5

原生联网（未添加搜索工具）：KIE：KIE 请求过于频繁，退避重试后仍未成功，请稍后重新生成

费用合计：$0.012409（包含失败请求估算，不能视为实际扣费）。失败请求：41。原始结果：[probe-claude-haiku-5-5.json](./probe-claude-haiku-5-5.json)。

## 来源与复跑

模型ID、协议、工具结构及单价核对自官方页面：

- [GPT Responses文档](https://docs.kie.ai/market/chat/gpt-6-1-sol)；[价格](https://kie.ai/gpt-6-1-sol)
- [Gemini 3.8 Flash文档](https://docs.kie.ai/market/gemini/gemini-3-8-flash-openai)；[价格](https://kie.ai/gemini-3-8-flash)
- [Claude Haiku文档](https://docs.kie.ai/market/claude/claude-haiku-5-5)；[价格](https://kie.ai/claude-haiku-5-5)

运行 node --conditions=react-server --import tsx scripts/probe-task10-models.ts；脚本按JSON检查点续跑，已完成调用不重复付费。node --conditions=react-server --import tsx scripts/report-task10-probe.ts 汇总并更新模型开放门槛。重新完整探测时先另存旧报告，不覆盖旧证据。
