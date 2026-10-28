import "dotenv/config";
import {mkdir,writeFile} from "node:fs/promises";
import {db} from "../src/lib/db";
import {agentSession} from "../src/lib/agent-state";
import {webSearch} from "../src/lib/web-search";
const user=await db.user.findFirstOrThrow({where:{role:"admin"}});
const product=await db.product.findFirstOrThrow({orderBy:{createdAt:"desc"}});
const session=await agentSession(product.id,user.id);
let result;
try{result={supported:true,...await webSearch(session.id,user.id,"Search the current IKEA shoe storage category. Give one shoe storage keyword and one official source link.",1,true)};}
catch(error){result={supported:null,verified:false,note:error instanceof Error?error.message:"验证失败"};}
await mkdir("docs/review",{recursive:true});
await writeFile("docs/review/grounding-verification.json",JSON.stringify({verifiedAt:new Date().toISOString(),protocol:"Chat Completions / web_search_options",...result},null,2));
console.log(JSON.stringify(result));
await db.$disconnect();
