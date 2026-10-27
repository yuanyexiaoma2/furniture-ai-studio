import "dotenv/config";
import {readFileSync,writeFileSync} from "node:fs";
import {db} from "../src/lib/db";
import {json} from "../src/lib/agent-state";
import {passedProbe} from "../src/lib/studio-rules";
const mapping=[["agent-sol","gpt-6-1-sol"],["agent-flash","gemini-3-8-flash-openai"],["agent-haiku","claude-haiku-5-5"]];
let report="# 任务10 · 模型能力实测\n\n测试时间："+new Date().toISOString()+"。真实 KIE 请求，无模拟返回。\n\n## 方法\n\n5个工具（品类枚举、候选数量、实拍短码、颜色+布尔锁定、图位数组），各4次独立请求，共20次，不强制 tool_choice。格式正确要求只有一个函数调用且参数能解析为JSON；参数正确要求函数名、必填字段、值和额外字段均与测试目标一致。20轮中文对话每轮追加约300字材料，检查SKU、品类、锁定特征及轮次；这是20轮历史稳定性测试，不代表模型标称最大上下文窗口。失败与限流计入端到端失败，不补跑覆盖原始结果。\n\n费用采用响应 credits_consumed × $0.005；缺少实际账单时保留估算并标注。均记录在 LlmCall；本次探测不关联生产SKU。\n\n|模型|格式正确|参数正确|平均耗时/次|单次平均USD|20轮稳定|开放建议|\n|---|---:|---:|---:|---:|---:|---|\n";
const details:string[]=[];
for(const [id,model] of mapping){
 const data=JSON.parse(readFileSync("docs/task-10/probe-"+model+".json","utf8")),rows=data.rows as {phase:string;formatCorrect?:boolean;parametersCorrect?:boolean;stable?:boolean;durationMs:number;costUsd:number;costEstimated:boolean;text:string;error?:string;toolCalls?:unknown[]}[];
 const tools=rows.filter(r=>r.phase==="tools"),context=rows.filter(r=>r.phase==="context"),probe={toolCalls:tools.length,formatCorrect:tools.filter(r=>r.formatCorrect).length,parameterCorrect:tools.filter(r=>r.parametersCorrect).length,contextStable:context.filter(r=>r.stable).length,contextCalls:context.length,testedAt:new Date().toISOString()};
 const passed=passedProbe(probe);await db.studioModel.update({where:{id},data:{probe:json(probe),visible:passed}});
 const average=(k:"durationMs"|"costUsd")=>tools.reduce((n,r)=>n+r[k],0)/Math.max(1,tools.length);
 report+="|"+model+"|"+probe.formatCorrect+"/20|"+probe.parameterCorrect+"/20|"+(average("durationMs")/1000).toFixed(2)+"秒|$"+average("costUsd").toFixed(6)+(tools.some(r=>r.costEstimated)?"（含估）":"（实际）")+"|"+probe.contextStable+"/20|"+(passed?"推荐开放":"不开放")+"|\n";
 const native=rows.find(r=>r.phase==="native");details.push("### "+model+"\n\n原生联网（未添加搜索工具）："+(native?.error??native?.text??"未完成")+"\n\n费用合计：$"+rows.reduce((n,r)=>n+r.costUsd,0).toFixed(6)+(rows.some(r=>r.costEstimated)?"（包含失败请求估算，不能视为实际扣费）":"（实际）")+"。失败请求："+rows.filter(r=>r.error).length+"。原始结果：[probe-"+model+".json](./probe-"+model+".json)。\n");
}
report+="|ZenMux · Gemini 2.5 Pro|未测|未测|—|—|未测|未配置ZENMUX_API_KEY，不开放|\n\n推荐开放：**GPT-6.1 Sol**。Gemini 3.8 Flash 低于95%；Claude Haiku 5.5持续限流，不能据此断言模型本身不支持工具，当前可用性未达标。ZenMux 没有凭据，不以KIE结果代替。\n\n## 原生联网观察\n\n问题为测试当日欧洲央行 EUR/USD 参考汇率。未额外提供浏览器或网关原生搜索工具。返回不能联网或请求失败，未得到可核验的当日数值，因此均不依赖原生联网。正式会话使用自建 Tavily web_search；网关原生搜索与函数调用兼容性不影响业务。\n\n"+details.join("\n")+"\n## 来源与复跑\n\n模型ID、协议、工具结构及单价核对自官方页面：\n\n- [GPT Responses文档](https://docs.kie.ai/market/chat/gpt-6-1-sol)；[价格](https://kie.ai/gpt-6-1-sol)\n- [Gemini 3.8 Flash文档](https://docs.kie.ai/market/gemini/gemini-3-8-flash-openai)；[价格](https://kie.ai/gemini-3-8-flash)\n- [Claude Haiku文档](https://docs.kie.ai/market/claude/claude-haiku-5-5)；[价格](https://kie.ai/claude-haiku-5-5)\n\n运行 node --conditions=react-server --import tsx scripts/probe-task10-models.ts；脚本按JSON检查点续跑，已完成调用不重复付费。node --conditions=react-server --import tsx scripts/report-task10-probe.ts 汇总并更新模型开放门槛。重新完整探测时先另存旧报告，不覆盖旧证据。\n";
writeFileSync("docs/task-10/model-probe.md",report);console.log("模型报告已写入；仅通过门槛模型开放。");await db.$disconnect();
