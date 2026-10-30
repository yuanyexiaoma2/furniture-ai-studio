import "server-only";
import {db} from "./db";
import {StudioError} from "./studio-error";
import {gatewayConfigured} from "./gateway-router";
import type {ModelCandidate} from "./models.config";
import type {MockModel} from "@/design-preview/mock/models";
export type StudioSettings={conversationImages?:import("./generation-references").ConversationImage[];agentId?:string;imageId?:string;imageIds?:string[];auto?:boolean;webEnabled?:boolean;resolution?:"auto"|"1K"|"2K"|"4K";shootingMode?:"quick"|"strict";categoryConfirmed?:boolean;categoryId?:string;photoAngles?:Record<string,string>;strictSkipped?:boolean;quickHintSeen?:boolean;planRecipes?:Record<string,unknown>};
export function settingsOf(value:unknown):StudioSettings{return(value&&typeof value==="object"?value:{}) as StudioSettings;}
import {agentCanBeUsed,userSelectedAgent} from "./studio-rules";
import {DEFAULT_IMAGE_ID,kieImageSpec} from "./image-models";
import {DEFAULT_AGENT} from "./agent-default";
export async function studioCatalog(admin=false){
 const rows=await db.studioModel.findMany({orderBy:{id:"asc"}});
 return rows.filter(m=>admin||m.enabled&&m.visible&&(m.kind!=="agent"||agentCanBeUsed(m.id,m.candidate,m.probe))&&gatewayConfigured((m.candidate as ModelCandidate).provider)).map(m=>{const c=m.candidate as ModelCandidate;const spec=c.provider==="kie"?kieImageSpec(c.model):undefined;const brand=spec?.brand??(m.name.startsWith("GPT")?"openai":m.name.startsWith("Claude")?"anthropic":"google");return {...(admin?{probe:m.probe,configured:gatewayConfigured(c.provider),userSelected:userSelectedAgent(m.id,m.candidate)}:{}),id:m.id,kind:m.kind,name:m.name,brandIcon:brand==="qwen"?"":"/design-preview/brands/"+brand+".svg",color:"#888888",description:(c.provider==="kie"?"KIE · ":"ZenMux · ")+(m.kind==="agent"?"理解产品、规划图包与对话":spec?.description??"保持产品外观，支持多图参考"),seconds:m.kind==="agent"?8:35,price:m.kind==="agent"?.003:(c.pricing.images?.["2K"]??6)*(c.pricing.currency==="credits"?.005:1),pricesByResolution:m.kind==="image"?Object.fromEntries(Object.entries(c.pricing.images??{}).map(([key,value])=>[key,value*(c.pricing.currency==="credits"?.005:1)])):undefined,supportedResolutions:spec?Object.keys(spec.prices):undefined,referenceImagePrice:(c.pricing.inputImage??0)*.005,provider:c.provider,failureRate:0,enabled:m.enabled,visible:m.visible,isDefault:m.id===DEFAULT_AGENT.id||m.id===DEFAULT_IMAGE_ID} as MockModel;});
}
export async function selectedCandidate(kind:"agent"|"image",settings:StudioSettings):Promise<ModelCandidate>{
 const visible=await studioCatalog(),requested=kind==="agent"?settings.agentId:(settings.auto!==false?settings.imageIds?.[0]??settings.imageId:settings.imageId);
 const model=visible.find(m=>m.kind===kind&&m.id===requested)??(!requested?visible.find(m=>m.kind===kind&&m.isDefault)??visible.find(m=>m.kind===kind):undefined);
 if(!model)throw new StudioError(kind==="agent"?"所选智能体尚未通过能力验证或已下线，请在模型面板重选":"所选生图模型已下线，请在模型面板重选",409);
 return(await db.studioModel.findUniqueOrThrow({where:{id:model.id}})).candidate as ModelCandidate;
}
