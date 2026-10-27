import "dotenv/config";
import {db} from "../src/lib/db";
import {DEFAULT_AGENT} from "../src/lib/agent-default";
import {json} from "../src/lib/agent-state";

// 只登记用户指定的默认模型，不调用网关，也不覆盖其他模型或历史探测。
try {
 await db.studioModel.upsert({where:{id:DEFAULT_AGENT.id},create:{
  id:DEFAULT_AGENT.id,name:DEFAULT_AGENT.name,kind:"agent",candidate:json(DEFAULT_AGENT.candidate),enabled:true,visible:true,
 },update:{name:DEFAULT_AGENT.name,candidate:json(DEFAULT_AGENT.candidate),enabled:true,visible:true}});
 console.log("默认Agent已登记："+DEFAULT_AGENT.name+"（ZenMux）；未调用付费接口。");
} finally {await db.$disconnect();}
